"use strict";

async function getRandomVideoIds(count) {
  const safeCount = Math.min(Math.max(Number(count) || 30, 1), 60);
  const { apiUrl, apiToken } = getConfig();

  if (!apiUrl || !apiToken || apiToken === "PASTE_API_TOKEN_HERE") {
    throw new Error("API_TOKEN_REQUIRED");
  }

  const url = new URL(apiUrl);
  url.pathname = "/random";
  url.search = "";
  url.searchParams.set("count", String(safeCount));

  const response = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.error || `API request failed with HTTP ${response.status}`,
    );
  }

  const ids = normalizeIds(payload).slice(0, safeCount);
  if (!ids.length) throw new Error("API did not return video IDs.");
  return ids;
}

// Offscreen AI bridge.
