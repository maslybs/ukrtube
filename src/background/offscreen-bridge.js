"use strict";

const OFFSCREEN_PATH = "src/offscreen/index.html";
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (contexts.length > 0) return;
  if (creatingOffscreen) return creatingOffscreen;

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["DOM_PARSER"],
    justification:
      "Run Chrome built-in AI locally to classify YouTube videos by the user's topic rules.",
  });

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

async function callOffscreen(type, payload = {}) {
  await ensureOffscreenDocument();
  return chrome.runtime.sendMessage({
    target: "offscreen",
    type,
    payload,
  });
}

async function stopAi() {
  let result = { ok: true, status: "stopped" };
  try {
    result = await callOffscreen("STOP_AI");
  } catch {
    // The offscreen document may not exist yet.
  }

  try {
    await chrome.offscreen.closeDocument();
  } catch {
    // Already closed.
  }
  return result;
}
