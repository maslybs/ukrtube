"use strict";

let session = null;
let detector = null;
let modelRequests = 0;
let activeController = null;
let stopRequested = false;
const AI_TIMEOUT_MS = 60000;
const translators = new Map();
const unavailableTranslators = new Set();
const TRANSLATABLE_TO_EN = new Set(["uk", "ru"]);

const runtimeState = {
  status: "idle",
  availability: "unknown",
  lastError: "",
  lastRequestAt: 0,
};

function asErrorMessage(error) {
  return error?.message || String(error || "Unknown error");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function normalizeText(value, maxLength = 1200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}
