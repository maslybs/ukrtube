"use strict";

const VIDEO_METADATA_CACHE_KEY = "ukrtubeVideoMetadataCacheV1";
const VIDEO_METADATA_CACHE_TTL_MS = 30 * 60 * 1000;
const VIDEO_METADATA_CACHE_LIMIT = 300;
const VIDEO_METADATA_CONCURRENCY = 4;

let videoMetadataCachePromise = null;

async function loadVideoMetadataCache() {
  if (!videoMetadataCachePromise) {
    videoMetadataCachePromise = chrome.storage.local
      .get(VIDEO_METADATA_CACHE_KEY)
      .then((stored) => {
        const cache = stored?.[VIDEO_METADATA_CACHE_KEY];
        return cache && typeof cache === "object" ? cache : {};
      })
      .catch(() => ({}));
  }
  return videoMetadataCachePromise;
}

function createVideoEnrichment(video) {
  const rawViewCount = Number(video?.viewCount);
  const viewCountAvailable =
    video?.viewCountAvailable === true &&
    Number.isFinite(rawViewCount) &&
    rawViewCount >= 0;

  return {
    id: String(video?.id || ""),
    avatarUrl: normalizeImageUrl(video?.avatarUrl),
    authorUrl: typeof video?.authorUrl === "string" ? video.authorUrl : "",
    channelId: typeof video?.channelId === "string" ? video.channelId : "",
    isVerified: Boolean(video?.isVerified),
    viewCount: viewCountAvailable ? rawViewCount : null,
    viewCountAvailable,
    fetchedAt: Date.now(),
  };
}

function isFreshVideoEnrichment(entry) {
  return (
    entry &&
    Number.isFinite(Number(entry.fetchedAt)) &&
    Date.now() - Number(entry.fetchedAt) < VIDEO_METADATA_CACHE_TTL_MS
  );
}

function hasUsefulVideoEnrichment(entry) {
  return Boolean(entry?.avatarUrl || entry?.viewCountAvailable);
}

function trimVideoMetadataCache(cache) {
  const entries = Object.entries(cache);
  if (entries.length <= VIDEO_METADATA_CACHE_LIMIT) return cache;

  return Object.fromEntries(
    entries
      .sort(
        ([, first], [, second]) =>
          Number(second?.fetchedAt || 0) - Number(first?.fetchedAt || 0),
      )
      .slice(0, VIDEO_METADATA_CACHE_LIMIT),
  );
}

async function saveVideoMetadataCache(cache) {
  const trimmed = trimVideoMetadataCache(cache);
  videoMetadataCachePromise = Promise.resolve(trimmed);
  await chrome.storage.local
    .set({ [VIDEO_METADATA_CACHE_KEY]: trimmed })
    .catch(() => {});
}

async function enrichVideoMetadata(ids) {
  const validIds = normalizeIds({ ids }).slice(0, 30);
  if (!validIds.length) return [];

  const cache = await loadVideoMetadataCache();
  let cacheChanged = false;

  const items = await mapWithConcurrency(
    validIds,
    VIDEO_METADATA_CONCURRENCY,
    async (id) => {
      const cached = cache[id];
      if (isFreshVideoEnrichment(cached)) return cached;

      const metadata = await fetchVideoMetadata(id);
      const enrichment = createVideoEnrichment(metadata);
      if (hasUsefulVideoEnrichment(enrichment)) {
        cache[id] = enrichment;
        cacheChanged = true;
        return enrichment;
      }

      return cached || enrichment;
    },
  );

  if (cacheChanged) await saveVideoMetadataCache(cache);
  return items;
}
