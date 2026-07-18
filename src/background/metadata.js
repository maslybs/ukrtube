"use strict";

async function fetchOEmbed(id, fallback) {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) return fallback;

    const metadata = await response.json();
    return {
      ...fallback,
      title: normalizeText(metadata.title, 500) || fallback.title,
      authorName:
        normalizeText(metadata.author_name, 300) || fallback.authorName,
      authorUrl:
        typeof metadata.author_url === "string"
          ? metadata.author_url
          : fallback.authorUrl,
      thumbnailUrl:
        normalizeImageUrl(metadata.thumbnail_url) || fallback.thumbnailUrl,
    };
  } catch {
    return fallback;
  }
}

async function fetchVideoMetadata(id) {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  const fallback = {
    id,
    title: "Українське відео",
    description: "",
    category: "",
    keywords: [],
    authorName: "YouTube",
    authorUrl: "https://www.youtube.com/",
    channelId: "",
    avatarUrl: "",
    watchUrl,
    thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`,
    durationText: "",
    viewCount: 0,
    publishedAt: "",
    publishedText: "",
    isLive: false,
    isVerified: false,
  };

  try {
    const response = await fetch(
      `${watchUrl}&hl=uk&gl=UA&bpctr=9999999999&has_verified=1`,
      {
        cache: "no-store",
        credentials: "omit",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.5",
        },
      },
    );

    if (!response.ok) return fetchOEmbed(id, fallback);
    const html = await response.text();

    const playerResponse = extractJsonAfterMarker(html, [
      "var ytInitialPlayerResponse =",
      "ytInitialPlayerResponse =",
      'window["ytInitialPlayerResponse"] =',
    ]);

    const initialData = extractJsonAfterMarker(html, [
      "var ytInitialData =",
      "ytInitialData =",
      'window["ytInitialData"] =',
    ]);

    const details = playerResponse?.videoDetails || {};
    const microformat =
      playerResponse?.microformat?.playerMicroformatRenderer || {};
    const channelId =
      typeof details.channelId === "string" ? details.channelId : "";
    const authorName =
      normalizeText(details.author, 300) || fallback.authorName;

    const ownerNode = findObject(initialData, (node) =>
      Boolean(node?.videoOwnerRenderer),
    );
    const owner = ownerNode?.videoOwnerRenderer || null;
    const avatarUrl = bestThumbnail(owner?.thumbnail?.thumbnails, "");
    const badges = Array.isArray(owner?.badges) ? owner.badges : [];
    const isVerified = badges.some((badge) => {
      const label = String(
        badge?.metadataBadgeRenderer?.label ||
          badge?.metadataBadgeRenderer?.tooltip ||
          "",
      ).toLowerCase();
      return label.includes("verified") || label.includes("підтверджено");
    });

    const title = normalizeText(details.title, 500) || fallback.title;
    const description = normalizeText(details.shortDescription, 5000);
    const category = normalizeText(microformat.category, 120);
    const keywords = Array.isArray(details.keywords)
      ? details.keywords
          .map((value) => normalizeText(value, 120))
          .filter(Boolean)
          .slice(0, 40)
      : [];
    const thumbnailUrl = bestThumbnail(
      details?.thumbnail?.thumbnails,
      fallback.thumbnailUrl,
    );
    const lengthSeconds = Number(details.lengthSeconds || 0);
    const isLive = Boolean(
      details.isLiveContent || microformat.liveBroadcastDetails?.isLiveNow,
    );
    const primaryInfoNode = findObject(initialData, (node) =>
      Boolean(node?.videoPrimaryInfoRenderer),
    );
    const primaryInfo = primaryInfoNode?.videoPrimaryInfoRenderer || null;
    const publishedText =
      textOf(primaryInfo?.dateText) || textOf(primaryInfo?.relativeDateText);
    const publishedAt =
      microformat.publishDate ||
      microformat.uploadDate ||
      extractPublishedDateFromHtml(html) ||
      "";

    const enriched = {
      ...fallback,
      title,
      description,
      category,
      keywords,
      authorName,
      authorUrl: channelId
        ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
        : fallback.authorUrl,
      channelId,
      avatarUrl,
      thumbnailUrl,
      durationText: isLive ? "НАЖИВО" : formatDuration(lengthSeconds),
      viewCount: Number(details.viewCount || 0),
      publishedAt,
      publishedText,
      isLive,
      isVerified,
    };

    if (title === fallback.title || authorName === fallback.authorName) {
      return fetchOEmbed(id, enriched);
    }
    return enriched;
  } catch {
    return fetchOEmbed(id, fallback);
  }
}

// Feed API requests.

async function mapWithConcurrency(values, limit, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await mapper(values[index], index);
      } catch {
        results[index] = null;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, () => worker()),
  );
  return results.filter(Boolean);
}
