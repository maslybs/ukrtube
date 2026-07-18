"use strict";

async function handleMessage(message) {
  switch (message?.type) {
    case "GET_RANDOM_VIDEO_IDS":
      return { ok: true, ids: await getRandomVideoIds(message.count) };

    case "GET_VIDEO_METADATA": {
      const id = String(message.id || "");
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
        return { ok: false, error: "INVALID_VIDEO_ID" };
      }
      return { ok: true, video: await fetchVideoMetadata(id) };
    }

    case "GET_VIDEO_METADATA_BATCH": {
      const ids = normalizeIds({ ids: message.ids }).slice(0, 12);
      return {
        ok: true,
        videos: await mapWithConcurrency(ids, 6, fetchVideoMetadata),
      };
    }

    case "ENRICH_VIDEO_METADATA":
      return {
        ok: true,
        items: await enrichVideoMetadata(message.ids),
      };

    case "GET_RANDOM_VIDEOS": {
      const ids = await getRandomVideoIds(message.count);
      return {
        ok: true,
        videos: await mapWithConcurrency(ids, 6, fetchVideoMetadata),
      };
    }

    case "INIT_AI":
      return callOffscreen("INIT_AI");

    case "GET_AI_STATUS":
      try {
        return await callOffscreen("GET_AI_STATUS");
      } catch (error) {
        return {
          ok: false,
          status: "unavailable",
          error: error?.message || String(error),
        };
      }

    case "CLASSIFY_BATCH":
      return callOffscreen("CLASSIFY_BATCH", message.payload || {});

    case "STOP_AI":
      return stopAi();

    case "RESET_AI":
      return callOffscreen("RESET_AI");

    default:
      return {
        ok: false,
        error: `Unknown message type: ${message?.type || "unknown"}`,
      };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target === "offscreen") return false;

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return true;
});
