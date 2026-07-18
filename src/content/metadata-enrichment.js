"use strict";

const METADATA_ENRICHMENT_BATCH_SIZE = 6;

function needsVideoMetadataEnrichment(video) {
  const hasViewCount =
    video?.viewCountAvailable === true || Number(video?.viewCount) > 0;
  return !video?.avatarUrl || !hasViewCount;
}

function applyVideoMetadataEnrichment(video, enrichment) {
  if (!video || !enrichment || video.id !== enrichment.id) return false;

  let changed = false;
  if (enrichment.avatarUrl && enrichment.avatarUrl !== video.avatarUrl) {
    video.avatarUrl = enrichment.avatarUrl;
    changed = true;
  }
  if (enrichment.authorUrl && enrichment.authorUrl !== video.authorUrl) {
    video.authorUrl = enrichment.authorUrl;
    changed = true;
  }
  if (enrichment.channelId && enrichment.channelId !== video.channelId) {
    video.channelId = enrichment.channelId;
    changed = true;
  }
  if (enrichment.isVerified && !video.isVerified) {
    video.isVerified = true;
    changed = true;
  }
  if (enrichment.viewCountAvailable === true) {
    const viewCount = Math.max(0, Number(enrichment.viewCount) || 0);
    if (viewCount !== Number(video.viewCount) || !video.viewCountAvailable) {
      video.viewCount = viewCount;
      video.viewCountAvailable = true;
      changed = true;
    }
  }

  return changed;
}

async function enrichVideoCards(videos, generation) {
  const pending = videos.filter(needsVideoMetadataEnrichment);

  for (
    let offset = 0;
    offset < pending.length;
    offset += METADATA_ENRICHMENT_BATCH_SIZE
  ) {
    if (!state.active || generation !== state.metadataGeneration) return;

    const batch = pending.slice(
      offset,
      offset + METADATA_ENRICHMENT_BATCH_SIZE,
    );

    try {
      const response = await sendMessage({
        type: "ENRICH_VIDEO_METADATA",
        ids: batch.map((video) => video.id),
      });
      if (!state.active || generation !== state.metadataGeneration) return;
      if (!response?.ok || !Array.isArray(response.items)) continue;

      const enrichmentById = new Map(
        response.items.map((item) => [item?.id, item]),
      );
      let changed = false;
      for (const video of batch) {
        if (applyVideoMetadataEnrichment(video, enrichmentById.get(video.id))) {
          changed = true;
        }
      }
      if (changed) renderVideos();
    } catch {
      // The feed remains usable with its original metadata when enrichment fails.
    }
  }
}
