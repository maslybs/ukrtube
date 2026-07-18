"use strict";

importScripts("../config.js");

try {
  importScripts("../config.local.js");
} catch {
  // A local override is optional. The public config remains active when it is absent.
}

importScripts(
  "utils.js",
  "metadata.js",
  "metadata-cache.js",
  "feed-api.js",
  "offscreen-bridge.js",
  "messaging.js",
);
