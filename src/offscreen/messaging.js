"use strict";

async function getStatus() {
  if (!("LanguageModel" in globalThis)) {
    return {
      ok: false,
      status: "unavailable",
      availability: "unavailable",
      error: "LanguageModel API is missing.",
    };
  }

  try {
    const availability = await LanguageModel.availability(MODEL_OPTIONS);
    runtimeState.availability = availability;
    if (!session && runtimeState.status === "idle") {
      runtimeState.status = availability;
    }
    return { ok: true, ...runtimeState, hasSession: Boolean(session) };
  } catch (error) {
    return { ok: false, status: "error", error: asErrorMessage(error) };
  }
}

async function handleMessage(message) {
  switch (message.type) {
    case "INIT_AI":
      await ensureSession();
      return { ok: true, ...runtimeState, hasSession: true };

    case "GET_AI_STATUS":
      return getStatus();

    case "CLASSIFY_BATCH":
      return classifyBatch(message.payload || {});

    case "STOP_AI":
      stopRequested = true;
      activeController?.abort();
      await destroySession();
      runtimeState.status = "stopped";
      runtimeState.lastError = "";
      return { ok: true, status: "stopped" };

    case "RESET_AI":
      stopRequested = false;
      await destroySession();
      runtimeState.status = "idle";
      runtimeState.lastError = "";
      return { ok: true, status: "idle" };

    default:
      return {
        ok: false,
        error: `Unknown offscreen message type: ${message.type}`,
      };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.target !== "offscreen") return undefined;

  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      const expectedStop = ["stopped", "timeout"].includes(runtimeState.status);
      if (!expectedStop) runtimeState.status = "error";
      runtimeState.lastError = asErrorMessage(error);

      if (expectedStop) {
        console.warn("[UkrTube AI]", runtimeState.lastError);
      } else {
        console.error("[UkrTube AI]", error);
      }

      sendResponse({
        ok: false,
        status: runtimeState.status,
        error: runtimeState.lastError,
      });
    });

  return true;
});
