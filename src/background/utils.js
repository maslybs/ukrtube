"use strict";

function getConfig() {
  const config = globalThis.EXTENSION_CONFIG || {};
  return {
    apiUrl: typeof config.apiUrl === "string" ? config.apiUrl.trim() : "",
    apiToken: typeof config.apiToken === "string" ? config.apiToken.trim() : "",
  };
}

function normalizeIds(payload) {
  const rawIds = Array.isArray(payload?.ids)
    ? payload.ids
    : typeof payload?.id === "string"
      ? [payload.id]
      : [];

  return [...new Set(rawIds)].filter((id) => /^[A-Za-z0-9_-]{11}$/.test(id));
}

function normalizeImageUrl(value) {
  if (typeof value !== "string" || !value) return "";
  if (value.startsWith("//")) return `https:${value}`;
  return value;
}

function normalizeText(value, maxLength = 6000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function textOf(node) {
  if (!node) return "";
  if (typeof node === "string") return normalizeText(node);
  if (typeof node.simpleText === "string")
    return normalizeText(node.simpleText);
  if (Array.isArray(node.runs)) {
    return normalizeText(node.runs.map((run) => run?.text || "").join(""));
  }
  return "";
}

function extractPublishedDateFromHtml(html) {
  const patterns = [
    /"publishDate"\s*:\s*"(\d{4}-\d{2}-\d{2}(?:T[^"\\]+)?)"/i,
    /"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2}(?:T[^"\\]+)?)"/i,
    /itemprop=["']uploadDate["'][^>]*content=["']([^"']+)["']/i,
    /itemprop=["']datePublished["'][^>]*content=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function extractJsonAfterMarker(html, markers) {
  for (const marker of markers) {
    let markerIndex = html.indexOf(marker);
    while (markerIndex !== -1) {
      const start = html.indexOf("{", markerIndex + marker.length);
      if (start === -1) break;

      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let index = start; index < html.length; index += 1) {
        const char = html[index];

        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }

        if (char === '"') {
          inString = true;
          continue;
        }

        if (char === "{") depth += 1;
        else if (char === "}") {
          depth -= 1;
          if (depth === 0) {
            try {
              return JSON.parse(html.slice(start, index + 1));
            } catch {
              break;
            }
          }
        }
      }

      markerIndex = html.indexOf(marker, markerIndex + marker.length);
    }
  }
  return null;
}

function findObject(root, predicate) {
  if (!root || typeof root !== "object") return null;
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;
    if (predicate(current)) return current;

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }

  return null;
}

function bestThumbnail(thumbnails, fallback) {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return fallback;
  const sorted = [...thumbnails].sort(
    (a, b) =>
      Number(a?.width || 0) * Number(a?.height || 0) -
      Number(b?.width || 0) * Number(b?.height || 0),
  );
  return normalizeImageUrl(sorted.at(-1)?.url) || fallback;
}

function formatDuration(totalSeconds) {
  const secondsValue = Math.max(0, Number(totalSeconds) || 0);
  if (!secondsValue) return "";

  const hours = Math.floor(secondsValue / 3600);
  const minutes = Math.floor((secondsValue % 3600) / 60);
  const seconds = secondsValue % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
