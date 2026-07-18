"use strict";

async function loadVideos({ replace }) {
  if (!state.active || state.loading || (!replace && !state.hasMore)) return;

  const generation = ++state.loadGeneration;
  state.loading = true;
  createSection();

  if (replace) {
    state.videos = [];
    state.videoIds.clear();
    state.aiResults.clear();
    state.cursor = null;
    state.hasMore = true;
    state.aiGeneration += 1;
    state.metadataGeneration += 1;
  }

  state.pendingMetadata = replace ? 12 : 4;
  showMessage("");
  renderVideos();

  try {
    const response = await sendMessage({
      type: "GET_FILTERED_FEED",
      count: PAGE_SIZE,
      cursor: replace ? null : state.cursor,
      filters: state.filters,
    });
    if (!state.active || generation !== state.loadGeneration) return;
    if (!response?.ok) {
      throw new Error(response?.error || "Невідома помилка API");
    }

    const videos = (Array.isArray(response.videos) ? response.videos : [])
      .filter((video) => /^[A-Za-z0-9_-]{11}$/.test(video?.id || ""))
      .filter((video) => !state.videoIds.has(video.id));

    for (const video of videos) {
      state.videoIds.add(video.id);
      state.videos.push(video);
    }

    state.cursor = response.nextCursor || null;
    state.hasMore = Boolean(response.hasMore && response.nextCursor);
    state.pendingMetadata = 0;
    renderVideos();
    void enrichVideoCards(videos, state.metadataGeneration);

    if (!videos.length) {
      showMessage(
        replace
          ? "У базі поки немає відео, які відповідають цим фільтрам. Зміни період, слова або теми."
          : "За цими фільтрами більше відео немає.",
        "empty",
      );
    }
  } catch (error) {
    if (!state.active || generation !== state.loadGeneration) return;
    state.pendingMetadata = 0;
    renderVideos();

    const message = error instanceof Error ? error.message : String(error);
    showMessage(
      message === "API_TOKEN_REQUIRED"
        ? "Додай ключ API у налаштуваннях UkrTube і онови сторінку."
        : `Не вдалося завантажити відео: ${message}`,
      "error",
    );
  } finally {
    if (generation === state.loadGeneration) {
      state.pendingMetadata = 0;
      state.loading = false;
      updateToolbar();
    }
  }
}

// Feed activation and YouTube single-page navigation.

function activate() {
  if (!isYouTubeHome()) return;
  state.active = true;
  setChipActive(true);
  createSection();
  if (!state.videos.length) loadVideos({ replace: true });
  else renderVideos();
}

function createChip() {
  const button = document.createElement("button");
  button.id = CHIP_ID;
  button.type = "button";
  button.className = "ukrtube-chip";
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", "false");
  button.textContent = "UkrTube";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (state.active) loadVideos({ replace: true });
    else activate();
  });
  return button;
}

function attachNativeChipHandler(container) {
  if (container.dataset.ukrtubeListenerAttached === "1") return;
  container.dataset.ukrtubeListenerAttached = "1";
  container.addEventListener(
    "click",
    (event) => {
      if (!state.active) return;
      if (event.target.closest(`#${CHIP_ID}`)) return;
      deactivate();
    },
    true,
  );
}

function ensureChip() {
  if (!isYouTubeHome()) {
    deactivate();
    document.getElementById(CHIP_ID)?.remove();
    return;
  }

  const container = findChipContainer();
  if (!container) return;
  attachNativeChipHandler(container);

  let chip = document.getElementById(CHIP_ID);
  if (!chip) chip = createChip();

  if (!chip.isConnected || chip.parentElement !== container) {
    const nativeChips = [...container.children].filter(
      (element) => element.id !== CHIP_ID,
    );
    const firstNativeChip =
      nativeChips.find((element) =>
        element.matches?.("yt-chip-cloud-chip-renderer, [role='tab'], button"),
      ) || nativeChips[0];
    if (firstNativeChip)
      firstNativeChip.insertAdjacentElement("afterend", chip);
    else container.prepend(chip);
  }

  setChipActive(state.active);
  applyDetectedTheme();
  if (state.active) hideOriginalFeed();
}

function handleNavigation() {
  if (location.href !== state.lastUrl) {
    state.lastUrl = location.href;
    if (!isYouTubeHome()) deactivate();
  }
  ensureChip();
  applyDetectedTheme();
}

const observer = new MutationObserver(() => {
  window.clearTimeout(observer._timer);
  observer._timer = window.setTimeout(handleNavigation, 120);
});

observer.observe(document.documentElement, { childList: true, subtree: true });

let scrollFrame = 0;
window.addEventListener(
  "scroll",
  () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      maybeLoadNextPage();
    });
  },
  { passive: true },
);

window.addEventListener("yt-navigate-finish", handleNavigation);
window.addEventListener("popstate", handleNavigation);

loadStoredFilters().finally(handleNavigation);
