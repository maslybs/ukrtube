"use strict";

function createSection() {
  let section = document.getElementById(SECTION_ID);
  if (section) return section;

  section = document.createElement("section");
  section.id = SECTION_ID;
  section.setAttribute("aria-label", "Українська стрічка відео");

  const toolbar = document.createElement("div");
  toolbar.className = "ukr-random-toolbar";

  const label = document.createElement("div");
  label.className = "ukr-random-toolbar-label";
  label.dataset.role = "count-label";
  label.textContent = "Українська стрічка";

  const actions = document.createElement("div");
  actions.className = "ukr-random-toolbar-actions";

  const filterButton = createButton(
    "ukr-random-action-button",
    "Фільтри",
    "Відкрити фільтри",
  );
  filterButton.dataset.role = "filter-button";
  filterButton.addEventListener("click", () => {
    state.filtersOpen = !state.filtersOpen;
    const panel = section.querySelector(".ukr-random-filter-panel");
    if (panel) panel.hidden = !state.filtersOpen;
    filterButton.classList.toggle("is-active", state.filtersOpen);
  });

  const refreshButton = createButton(
    "ukr-random-action-button is-primary",
    "Оновити",
    "Завантажити нову добірку",
  );
  refreshButton.dataset.role = "refresh-button";
  refreshButton.addEventListener("click", () => loadVideos({ replace: true }));

  actions.append(filterButton, refreshButton);
  toolbar.append(label, actions);

  const filterPanel = createFilterPanel();
  const grid = document.createElement("div");
  grid.className = "ukr-random-grid";
  grid.dataset.role = "grid";

  const message = document.createElement("div");
  message.className = "ukr-random-inline-message";
  message.dataset.role = "message";
  message.hidden = true;

  const sentinel = document.createElement("div");
  sentinel.className = "ukr-random-infinite-sentinel";
  sentinel.dataset.role = "infinite-sentinel";
  sentinel.setAttribute("aria-hidden", "true");
  sentinel.innerHTML = '<span class="ukr-random-infinite-spinner"></span>';

  section.append(toolbar, filterPanel, message, grid, sentinel);

  const contents = hideOriginalFeed();
  if (contents?.parentNode) contents.parentNode.insertBefore(section, contents);
  else {
    const renderer = findGridRenderer();
    (
      renderer ||
      document.querySelector("#primary, ytd-page-manager") ||
      document.body
    ).appendChild(section);
  }

  attachInfiniteScroll(section);
  applyDetectedTheme();
  return section;
}

// Feed layout and video cards.

function updateAiStatus() {
  const section = document.getElementById(SECTION_ID);
  const status = section?.querySelector('[data-role="ai-status"]');
  if (status) status.textContent = state.aiStatus;
}

function updateToolbar(visibleCount = null) {
  const section = document.getElementById(SECTION_ID);
  if (!section) return;

  const visible = visibleCount == null ? filteredVideos().length : visibleCount;
  const countLabel = section.querySelector('[data-role="count-label"]');
  if (countLabel) {
    if (state.pendingMetadata > 0) {
      countLabel.textContent = state.videos.length
        ? `Показано ${state.videos.length}; завантажується наступна порція`
        : "Завантаження української стрічки…";
    } else {
      countLabel.textContent = state.videos.length
        ? `Показано ${state.videos.length} відео`
        : "Українська стрічка";
    }
  }

  const filterButton = section.querySelector('[data-role="filter-button"]');
  if (filterButton) {
    const count = activeFilterCount();
    filterButton.textContent = count ? `Фільтри (${count})` : "Фільтри";
    filterButton.classList.toggle("has-filters", count > 0);
    filterButton.classList.toggle("is-active", state.filtersOpen);
  }

  const refreshButton = section.querySelector('[data-role="refresh-button"]');
  if (refreshButton) refreshButton.disabled = state.loading;

  const sentinel = section.querySelector('[data-role="infinite-sentinel"]');
  if (sentinel) {
    sentinel.classList.toggle("is-loading", state.loading);
    sentinel.hidden = !state.hasMore && !state.loading;
  }
}

function createSkeletonCard() {
  const card = document.createElement("div");
  card.className = "ukr-random-card ukr-random-skeleton";
  card.innerHTML = `
    <div class="ukr-random-skeleton-thumb"></div>
    <div class="ukr-random-skeleton-details">
      <div class="ukr-random-skeleton-avatar"></div>
      <div class="ukr-random-skeleton-copy">
        <div class="ukr-random-skeleton-line"></div>
        <div class="ukr-random-skeleton-line short"></div>
        <div class="ukr-random-skeleton-line tiny"></div>
      </div>
    </div>`;
  return card;
}

function renderLoadingSkeletons(count = PAGE_SIZE) {
  const section = createSection();
  const grid = section.querySelector('[data-role="grid"]');
  if (!grid) return;
  grid.textContent = "";

  for (let index = 0; index < count; index += 1) {
    grid.appendChild(createSkeletonCard());
  }
}

function showMessage(text, kind = "info") {
  const section = createSection();
  const box = section.querySelector('[data-role="message"]');
  if (!box) return;
  box.hidden = !text;
  box.dataset.kind = kind;
  box.textContent = text || "";
}

function videoSearchText(video) {
  return normalize(
    [
      video.title,
      video.authorName,
      video.description,
      video.category,
      ...(Array.isArray(video.keywords) ? video.keywords : []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function detectedCategories(video) {
  if (Array.isArray(video.__detectedCategories))
    return video.__detectedCategories;
  const text = videoSearchText(video);
  const detected = CATEGORIES.filter((category) =>
    category.keywords.some((keyword) => text.includes(normalize(keyword))),
  ).map((category) => category.id);
  Object.defineProperty(video, "__detectedCategories", {
    value: detected,
    configurable: true,
    enumerable: false,
    writable: true,
  });
  return detected;
}

function publishedTimestamp(video) {
  if (!video?.publishedAt) return Number.NaN;
  const timestamp = new Date(video.publishedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function passesDateFilter(video) {
  const preset = state.filters.datePreset || "any";
  if (preset === "any") return true;

  const timestamp = publishedTimestamp(video);
  if (!Number.isFinite(timestamp)) return false;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (preset === "day") return timestamp >= now - day;
  if (preset === "week") return timestamp >= now - 7 * day;
  if (preset === "month") return timestamp >= now - 30 * day;
  if (preset === "three-months") return timestamp >= now - 90 * day;
  if (preset === "year") return timestamp >= now - 365 * day;
  if (preset === "older-year") return timestamp < now - 365 * day;

  if (preset === "custom") {
    const from = state.filters.dateFrom
      ? new Date(`${state.filters.dateFrom}T00:00:00`).getTime()
      : Number.NEGATIVE_INFINITY;
    const to = state.filters.dateTo
      ? new Date(`${state.filters.dateTo}T23:59:59.999`).getTime()
      : Number.POSITIVE_INFINITY;
    return timestamp >= from && timestamp <= to;
  }

  return true;
}

function passesLocalFilters(video) {
  const text = videoSearchText(video);
  const categories = detectedCategories(video);
  const includeCategories = CATEGORIES.filter(
    (category) => categoryMode(category.id) === "include",
  ).map((category) => category.id);
  const excludeCategories = CATEGORIES.filter(
    (category) => categoryMode(category.id) === "exclude",
  ).map((category) => category.id);

  if (excludeCategories.some((id) => categories.includes(id))) return false;
  if (
    includeCategories.length &&
    !includeCategories.some((id) => categories.includes(id))
  ) {
    return false;
  }

  const includeTerms = splitTerms(state.filters.includeKeywords);
  const excludeTerms = splitTerms(state.filters.excludeKeywords);
  if (excludeTerms.some((term) => text.includes(term))) return false;
  if (includeTerms.length && !includeTerms.some((term) => text.includes(term)))
    return false;
  if (!passesDateFilter(video)) return false;

  const aiResult = state.aiResults.get(video.id);
  if (state.filters.aiEnabled && aiResult?.action === "hide") return false;
  return true;
}

function filteredVideos() {
  return [...state.videos];
}

function formatViews(viewCount) {
  const count = Number(viewCount || 0);
  if (!count) return "";
  try {
    return `${new Intl.NumberFormat("uk-UA", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(count)} переглядів`;
  } catch {
    return `${count.toLocaleString("uk-UA")} переглядів`;
  }
}

function formatCalendarDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString("uk-UA");
  }
}

function formatRelativeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const formatter = new Intl.RelativeTimeFormat("uk-UA", { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === "minute") {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return "";
}

function createAvatar(video) {
  const link = document.createElement("a");
  link.className = "ukr-random-avatar-link";
  link.href = video.authorUrl || "https://www.youtube.com/";
  link.setAttribute("aria-label", video.authorName || "YouTube");

  if (video.avatarUrl) {
    const image = document.createElement("img");
    image.className = "ukr-random-avatar";
    image.src = video.avatarUrl;
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener(
      "error",
      () => {
        image.remove();
        link.classList.add("has-fallback");
        link.textContent = (video.authorName || "Y")
          .trim()
          .charAt(0)
          .toUpperCase();
      },
      { once: true },
    );
    link.appendChild(image);
  } else {
    link.classList.add("has-fallback");
    link.textContent = (video.authorName || "Y").trim().charAt(0).toUpperCase();
  }
  return link;
}

function createVideoCard(video) {
  const article = document.createElement("article");
  article.className = "ukr-random-card";
  article.dataset.videoId = video.id;

  const aiResult = state.aiResults.get(video.id);
  if (aiResult?.action) article.dataset.aiAction = aiResult.action;

  const thumbnailLink = document.createElement("a");
  thumbnailLink.className = "ukr-random-thumbnail-link";
  thumbnailLink.href = video.watchUrl;
  thumbnailLink.title = video.title;

  const image = document.createElement("img");
  image.className = "ukr-random-thumbnail";
  image.src = video.thumbnailUrl;
  image.alt = video.title;
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.addEventListener(
    "error",
    () => {
      image.src = `https://i.ytimg.com/vi/${encodeURIComponent(video.id)}/hqdefault.jpg`;
    },
    { once: true },
  );
  thumbnailLink.appendChild(image);

  if (video.durationText) {
    const duration = document.createElement("span");
    duration.className = video.isLive
      ? "ukr-random-duration is-live"
      : "ukr-random-duration";
    duration.textContent = video.durationText;
    thumbnailLink.appendChild(duration);
  }

  const details = document.createElement("div");
  details.className = "ukr-random-details";
  const avatar = createAvatar(video);
  const copy = document.createElement("div");
  copy.className = "ukr-random-copy";

  const titleLink = document.createElement("a");
  titleLink.className = "ukr-random-title";
  titleLink.href = video.watchUrl;
  titleLink.title = video.title;
  titleLink.textContent = video.title;

  const channelLine = document.createElement("div");
  channelLine.className = "ukr-random-channel-line";
  const channel = document.createElement("a");
  channel.className = "ukr-random-channel";
  channel.href = video.authorUrl || "https://www.youtube.com/";
  channel.textContent = video.authorName || "YouTube";
  channel.title = video.authorName || "YouTube";
  channelLine.appendChild(channel);

  if (video.isVerified) {
    const verified = document.createElement("span");
    verified.className = "ukr-random-verified";
    verified.title = "Підтверджений канал";
    verified.textContent = "✓";
    channelLine.appendChild(verified);
  }

  const metadata = document.createElement("div");
  metadata.className = "ukr-random-metadata";
  const relativeDate = formatRelativeDate(video.publishedAt);
  const calendarDate = formatCalendarDate(video.publishedAt);
  const publishedLabel =
    Number(video.dateQuality || 0) === 1
      ? `≈ ${String(video.publishedText || relativeDate || calendarDate).trim()}`
      : [calendarDate, relativeDate].filter(Boolean).join(" • ");
  metadata.textContent =
    [formatViews(video.viewCount), publishedLabel]
      .filter(Boolean)
      .join(" • ") || "Дата недоступна";

  if (state.filters.aiEnabled && aiResult) {
    const aiBadge = document.createElement("span");
    aiBadge.className = `ukr-random-ai-badge is-${aiResult.action}`;
    aiBadge.textContent = aiResult.action === "lower" ? "AI: нижче" : "AI";
    aiBadge.title = aiResult.reason || "Оцінено локальним AI";
    metadata.append(" ", aiBadge);
  }

  copy.append(titleLink, channelLine, metadata);

  const menu = createButton("ukr-random-menu", "⋮", "Скопіювати посилання");
  menu.addEventListener("click", () => {
    navigator.clipboard?.writeText(video.watchUrl).catch(() => {});
    menu.textContent = "✓";
    window.setTimeout(() => {
      menu.textContent = "⋮";
    }, 1000);
  });

  details.append(avatar, copy, menu);
  article.append(thumbnailLink, details);
  return article;
}

function renderVideos() {
  if (!state.active) return;
  const section = createSection();
  const grid = section.querySelector('[data-role="grid"]');
  if (!grid) return;

  const videos = filteredVideos();
  grid.textContent = "";
  for (const video of videos) grid.appendChild(createVideoCard(video));
  for (let index = 0; index < state.pendingMetadata; index += 1) {
    grid.appendChild(createSkeletonCard());
  }

  if (!videos.length && state.videos.length && state.pendingMetadata === 0) {
    showMessage(
      "За поточними фільтрами нічого не залишилося. Зміни фільтри або завантаж ще відео.",
      "empty",
    );
  } else {
    showMessage("");
  }
  updateToolbar(videos.length);
}

function renderProgressiveVideo(video) {
  if (!state.active) return;
  const section = createSection();
  const grid = section.querySelector('[data-role="grid"]');
  if (!grid) {
    renderVideos();
    return;
  }

  grid.querySelector(".ukr-random-skeleton")?.remove();

  if (video && passesLocalFilters(video)) {
    const card = createVideoCard(video);
    const firstSkeleton = grid.querySelector(".ukr-random-skeleton");
    if (firstSkeleton) grid.insertBefore(card, firstSkeleton);
    else grid.appendChild(card);
  }

  updateToolbar(filteredVideos().length);
}
