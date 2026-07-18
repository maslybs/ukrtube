"use strict";

// YouTube page integration and saved settings.

function isYouTubeHome() {
  return location.hostname === "www.youtube.com" && location.pathname === "/";
}

function detectedPageTheme() {
  if (
    document.documentElement.hasAttribute("dark") ||
    document.querySelector("ytd-app[dark]")
  ) {
    return "dark";
  }

  const candidates = [
    document.querySelector("ytd-app"),
    document.body,
    document.documentElement,
  ].filter(Boolean);
  for (const element of candidates) {
    const color = getComputedStyle(element).backgroundColor;
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) continue;
    const [red, green, blue] = match.slice(1).map(Number);
    if (red === 0 && green === 0 && blue === 0 && color.includes(", 0)"))
      continue;
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    return luminance < 0.45 ? "dark" : "light";
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyDetectedTheme() {
  const theme = detectedPageTheme();
  const section = document.getElementById(SECTION_ID);
  const chip = document.getElementById(CHIP_ID);
  if (section) section.dataset.theme = theme;
  if (chip) chip.dataset.theme = theme;
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTerms(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[,;\n]+/)
        .map((item) => normalize(item))
        .filter(Boolean),
    ),
  ];
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function loadStoredFilters() {
  try {
    const stored = await chrome.storage.sync.get([
      SETTINGS_KEY,
      LEGACY_SETTINGS_KEY,
    ]);
    const value = stored?.[SETTINGS_KEY] || stored?.[LEGACY_SETTINGS_KEY] || {};
    state.filters = {
      ...DEFAULT_FILTERS,
      ...value,
      aiEnabled: false,
      categoryModes:
        value.categoryModes && typeof value.categoryModes === "object"
          ? { ...value.categoryModes }
          : {},
    };

    if (!stored?.[SETTINGS_KEY] && stored?.[LEGACY_SETTINGS_KEY]) {
      await chrome.storage.sync
        .set({ [SETTINGS_KEY]: state.filters })
        .catch(() => {});
    }
  } catch {
    state.filters = { ...DEFAULT_FILTERS, categoryModes: {} };
  }
  state.initialized = true;
}

let saveTimer = null;
function saveFilters() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: state.filters }).catch(() => {});
  }, 250);
}

function findChipContainer() {
  const selectors = [
    "ytd-feed-filter-chip-bar-renderer #chips",
    "yt-chip-cloud-renderer #chips",
    "ytd-feed-filter-chip-bar-renderer #scroll-container",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function findGridRenderer() {
  return document.querySelector(
    'ytd-browse[page-subtype="home"] ytd-rich-grid-renderer, ytd-rich-grid-renderer',
  );
}

function findNativeContents() {
  const renderer = findGridRenderer();
  if (!renderer) return null;
  return (
    renderer.querySelector(":scope > #contents") ||
    renderer.querySelector("#contents")
  );
}

function setChipActive(active) {
  const chip = document.getElementById(CHIP_ID);
  if (!chip) return;
  chip.classList.toggle("is-active", active);
  chip.setAttribute("aria-selected", active ? "true" : "false");
  chip.setAttribute("data-selected", active ? "true" : "false");
}

function rememberAndHide(element) {
  if (!element) return;
  if (!element.dataset.ukrtubeOriginalDisplay) {
    element.dataset.ukrtubeOriginalDisplay =
      element.style.display || "__empty__";
  }
  element.style.display = "none";
}

function hideOriginalFeed() {
  const renderer = findGridRenderer();
  const contents = findNativeContents();
  if (!renderer || !contents) return null;

  rememberAndHide(contents);
  for (const continuation of renderer.querySelectorAll(
    "ytd-continuation-item-renderer",
  )) {
    if (!continuation.closest(`#${SECTION_ID}`)) rememberAndHide(continuation);
  }
  return contents;
}

function restoreOriginalFeed() {
  const hidden = document.querySelectorAll("[data-ukrtube-original-display]");
  for (const element of hidden) {
    const previous = element.dataset.ukrtubeOriginalDisplay;
    element.style.display = previous === "__empty__" ? "" : previous;
    delete element.dataset.ukrtubeOriginalDisplay;
  }
}

function removeCustomSection() {
  infiniteScrollObserver?.disconnect();
  infiniteScrollObserver = null;
  document.getElementById(SECTION_ID)?.remove();
}

function maybeLoadNextPage() {
  if (
    !state.active ||
    state.loading ||
    !state.hasMore ||
    state.videos.length === 0
  )
    return;
  const sentinel = document.querySelector(
    `#${SECTION_ID} [data-role="infinite-sentinel"]`,
  );
  if (!sentinel) return;

  const rect = sentinel.getBoundingClientRect();
  if (rect.top <= window.innerHeight + 1400) {
    loadVideos({ replace: false });
  }
}

function attachInfiniteScroll(section) {
  const sentinel = section?.querySelector('[data-role="infinite-sentinel"]');
  if (!sentinel) return;

  infiniteScrollObserver?.disconnect();
  infiniteScrollObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        maybeLoadNextPage();
      }
    },
    {
      root: null,
      rootMargin: "1400px 0px",
      threshold: 0,
    },
  );

  infiniteScrollObserver.observe(sentinel);
}

function deactivate() {
  state.active = false;
  state.loading = false;
  state.aiGeneration += 1;
  state.loadGeneration += 1;
  setChipActive(false);
  removeCustomSection();
  restoreOriginalFeed();
}

function createButton(className, text, ariaLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  return button;
}
