"use strict";

async function destroySession() {
  try {
    activeController?.abort();
  } catch {
    // Ignore abort errors.
  }
  activeController = null;

  try {
    session?.destroy();
  } catch {
    // Session may already be destroyed.
  }
  session = null;
  modelRequests = 0;
}

async function ensureSession() {
  if (session) return session;
  if (!("LanguageModel" in globalThis)) {
    throw new Error(
      "Chrome Prompt API (LanguageModel) is unavailable in this extension context.",
    );
  }

  runtimeState.status = "checking";
  runtimeState.availability = await LanguageModel.availability(MODEL_OPTIONS);
  if (runtimeState.availability === "unavailable") {
    throw new Error("The local Chrome foundation model is unavailable.");
  }

  runtimeState.status =
    runtimeState.availability === "available" ? "starting" : "downloading";
  session = await LanguageModel.create({
    ...MODEL_OPTIONS,
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        runtimeState.status = `model-download:${Math.round(event.loaded * 100)}`;
      });
    },
  });

  session.addEventListener?.("contextoverflow", () => {
    runtimeState.status = "context-overflow";
  });

  runtimeState.status = "ready";
  runtimeState.lastError = "";
  return session;
}
