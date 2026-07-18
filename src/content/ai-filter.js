"use strict";

function refreshFilterChipStates() {
  const section = document.getElementById(SECTION_ID);
  if (!section) return;
  for (const chip of section.querySelectorAll(".ukrtube-topic-chip")) {
    chip.dataset.mode = categoryMode(chip.dataset.categoryId);
  }
}

let filterReloadTimer = null;
function onFiltersChanged() {
  saveFilters();
  refreshFilterChipStates();
  state.loadGeneration += 1;
  state.loading = false;
  state.pendingMetadata = 0;
  state.hasMore = false;
  window.clearTimeout(filterReloadTimer);
  filterReloadTimer = window.setTimeout(() => {
    if (state.active) loadVideos({ replace: true });
  }, 420);
}

function aiVideoPayload(video) {
  return {
    videoId: video.id,
    title: video.title,
    channel: video.authorName,
    metadata: [
      video.description,
      video.category ? `Category: ${video.category}` : "",
      Array.isArray(video.keywords) && video.keywords.length
        ? `Keywords: ${video.keywords.slice(0, 15).join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" — "),
    url: video.watchUrl,
  };
}

// Optional local AI classification.

async function classifyPendingVideos() {
  if (!state.active || !state.filters.aiEnabled || state.aiProcessing) return;
  const generation = state.aiGeneration;
  const pending = state.videos.filter(
    (video) => !state.aiResults.has(video.id),
  );
  if (!pending.length) {
    state.aiStatus = "AI: усе класифіковано";
    updateAiStatus();
    return;
  }

  state.aiProcessing = true;
  state.aiStatus = `AI: підготовка ${pending.length} відео…`;
  updateAiStatus();

  let failed = false;
  try {
    const init = await sendMessage({ type: "INIT_AI" });
    if (!init?.ok) throw new Error(init?.error || "Локальний AI недоступний");

    for (let offset = 0; offset < pending.length; offset += 5) {
      if (
        generation !== state.aiGeneration ||
        !state.active ||
        !state.filters.aiEnabled
      )
        break;

      const batch = pending.slice(offset, offset + 5);
      state.aiStatus = `AI: ${Math.min(offset + batch.length, pending.length)} із ${pending.length}`;
      updateAiStatus();

      const response = await sendMessage({
        type: "CLASSIFY_BATCH",
        payload: {
          videos: batch.map(aiVideoPayload),
          settings: {
            blockRussian: true,
            blockedKeywords: splitTerms(state.filters.excludeKeywords),
            allowedKeywords: splitTerms(state.filters.includeKeywords),
            blockedChannels: [],
            preferredChannels: [],
            userRules: buildAiRule(),
          },
        },
      });

      if (!response?.ok)
        throw new Error(response?.error || "Помилка локального AI");
      for (const item of response.items || []) {
        if (item?.videoId) state.aiResults.set(item.videoId, item);
      }
      renderVideos();
    }

    if (generation === state.aiGeneration && state.filters.aiEnabled) {
      state.aiStatus = `AI: готово (${state.aiResults.size})`;
    }
  } catch (error) {
    failed = true;
    state.aiStatus = `AI недоступний: ${error instanceof Error ? error.message : String(error)}`;
  } finally {
    state.aiProcessing = false;
    updateAiStatus();

    const hasPending = state.videos.some(
      (video) => !state.aiResults.has(video.id),
    );
    if (!failed && state.active && state.filters.aiEnabled && hasPending) {
      window.setTimeout(() => classifyPendingVideos(), 100);
    }
  }
}
