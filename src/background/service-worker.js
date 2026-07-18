"use strict";

importScripts("../config.js");

importScripts(
  "../shared/api-token.js",
  "utils.js",
  "metadata.js",
  "metadata-cache.js",
  "feed-api.js",
  "offscreen-bridge.js",
  "messaging.js",
);

chrome.action?.onClicked?.addListener(() => {
  chrome.runtime.openOptionsPage();
});
