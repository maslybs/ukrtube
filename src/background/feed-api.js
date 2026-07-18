"use strict";

async function getRandomVideoIds(count) {
  const safeCount = Math.min(Math.max(Number(count) || 30, 1), 60);
  const { apiUrl, apiToken } = getConfig();

  if (!apiUrl || !apiToken || apiToken === "PASTE_API_TOKEN_HERE") {
    throw new Error("API_TOKEN_REQUIRED");
  }

  const url = new URL(apiUrl);
  url.searchParams.set("count", String(safeCount));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error || `API request failed with HTTP ${response.status}`,
    );
  }

  const ids = normalizeIds(payload).slice(0, safeCount);
  if (!ids.length) throw new Error("API did not return video IDs.");
  return ids;
}

function feedEndpointUrl(apiUrl) {
  const url = new URL(apiUrl);
  url.pathname = "/feed";
  url.search = "";
  return url;
}

function normalizedFilterModes(filters) {
  const modes =
    filters?.categoryModes && typeof filters.categoryModes === "object"
      ? filters.categoryModes
      : {};
  const include = [];
  const exclude = [];
  for (const [category, mode] of Object.entries(modes)) {
    if (mode === "include") include.push(category);
    else if (mode === "exclude") exclude.push(category);
  }
  return { include, exclude };
}

async function getFilteredFeed({ count, cursor, filters }) {
  const safeCount = Math.min(Math.max(Number(count) || 30, 1), 60);
  const { apiUrl, apiToken } = getConfig();
  if (!apiUrl || !apiToken || apiToken === "PASTE_API_TOKEN_HERE") {
    throw new Error("API_TOKEN_REQUIRED");
  }

  const url = feedEndpointUrl(apiUrl);
  url.searchParams.set("count", String(safeCount));
  if (cursor) url.searchParams.set("cursor", String(cursor));

  const modes = normalizedFilterModes(filters);
  if (modes.include.length)
    url.searchParams.set("include_topics", modes.include.join(","));
  if (modes.exclude.length)
    url.searchParams.set("exclude_topics", modes.exclude.join(","));
  if (filters?.includeKeywords)
    url.searchParams.set("include_keywords", filters.includeKeywords);
  if (filters?.excludeKeywords)
    url.searchParams.set("exclude_keywords", filters.excludeKeywords);
  if (filters?.datePreset)
    url.searchParams.set("date_preset", filters.datePreset);
  if (filters?.dateFrom) url.searchParams.set("date_from", filters.dateFrom);
  if (filters?.dateTo) url.searchParams.set("date_to", filters.dateTo);

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error || `API request failed with HTTP ${response.status}`,
    );
  }

  const videos = Array.isArray(payload?.items)
    ? payload.items.filter((video) =>
        /^[A-Za-z0-9_-]{11}$/.test(video?.id || ""),
      )
    : [];
  return {
    videos,
    nextCursor: payload?.nextCursor || null,
    hasMore: Boolean(payload?.hasMore),
  };
}

// Offscreen AI bridge.
