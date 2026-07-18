"use strict";

async function prepareVideo(video) {
  const combined = [video.title, video.channel, video.metadata]
    .filter(Boolean)
    .join(" — ");
  const detected = await detectLanguage(combined);
  const translated = await translateToEnglish(combined, detected);

  return {
    videoId: normalizeText(video.videoId, 120),
    title: normalizeText(video.title, 500),
    channel: normalizeText(video.channel, 300),
    metadata: normalizeText(video.metadata, 700),
    url: normalizeText(video.url, 500),
    detectedLanguage: detected.code || "und",
    languageConfidence: clamp(detected.confidence || 0, 0, 1),
    englishMetadata: normalizeText(translated, 2200),
  };
}

function buildPrompt(videos, settings, translatedRules) {
  const compactVideos = videos.map((video) => ({
    videoId: video.videoId,
    title: video.title,
    channel: video.channel,
    detectedLanguage: video.detectedLanguage,
    languageConfidence: video.languageConfidence,
    englishMetadata: video.englishMetadata,
  }));

  return [
    "Classify these YouTube recommendations for this specific user.",
    "Use score -100 for definitely unwanted and +100 for strongly wanted.",
    "Use hide only for clear rule violations or strongly irrelevant/repetitive content.",
    "Use lower for uncertain, repetitive, clickbait-like, or low-priority content.",
    "Use allow for neutral or useful content.",
    settings.blockRussian
      ? "Russian-language videos should be hidden. Do not confuse Ukrainian with Russian."
      : "Do not automatically reject videos solely because they are in Russian.",
    `User rules:\n${translatedRules || "Prefer diverse, high-quality, non-repetitive recommendations."}`,
    `Blocked keywords: ${(settings.blockedKeywords || []).join(", ") || "none"}`,
    `Allowed keywords: ${(settings.allowedKeywords || []).join(", ") || "none"}`,
    `Blocked channels: ${(settings.blockedChannels || []).join(", ") || "none"}`,
    `Preferred channels: ${(settings.preferredChannels || []).join(", ") || "none"}`,
    "Return one result for every supplied videoId.",
    `Videos JSON:\n${JSON.stringify(compactVideos)}`,
  ].join("\n\n");
}

function normalizeResult(rawItem, preparedVideo) {
  const detectedLanguage = preparedVideo?.detectedLanguage || "und";
  const detectedConfidence = preparedVideo?.languageConfidence || 0;
  const modelLanguage =
    normalizeText(rawItem?.language, 20) || detectedLanguage;

  return {
    videoId: preparedVideo.videoId,
    score: Math.round(clamp(rawItem?.score ?? 0, -100, 100)),
    action: ["allow", "lower", "hide"].includes(rawItem?.action)
      ? rawItem.action
      : "allow",
    language: detectedConfidence >= 0.72 ? detectedLanguage : modelLanguage,
    topics: Array.isArray(rawItem?.topics)
      ? rawItem.topics
          .map((item) => normalizeText(item, 80))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    entities: Array.isArray(rawItem?.entities)
      ? rawItem.entities
          .map((item) => normalizeText(item, 100))
          .filter(Boolean)
          .slice(0, 5)
      : [],
    reason: normalizeText(rawItem?.reason, 500) || "No clear reason supplied.",
    confidence: clamp(rawItem?.confidence ?? 0.5, 0, 1),
  };
}

async function classifyBatch(payload) {
  const videos = Array.isArray(payload.videos)
    ? payload.videos.slice(0, 5)
    : [];
  if (!videos.length) return { ok: true, items: [] };

  const settings = payload.settings || {};
  runtimeState.status = "preparing";

  const preparedVideos = [];
  for (const video of videos) {
    preparedVideos.push(await prepareVideo(video));
  }

  const rulesLanguage = await detectLanguage(settings.userRules || "");
  const translatedRules = await translateToEnglish(
    settings.userRules || "",
    rulesLanguage,
  );
  const prompt = buildPrompt(preparedVideos, settings, translatedRules);

  const activeSession = await ensureSession();
  runtimeState.status = "classifying";
  runtimeState.lastRequestAt = Date.now();

  if (activeController) {
    throw new Error("AI вже обробляє попередній пакет.");
  }

  stopRequested = false;
  let timedOut = false;
  const controller = new AbortController();
  activeController = controller;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AI_TIMEOUT_MS);

  let response;
  try {
    response = await activeSession.prompt(prompt, {
      responseConstraint: RESPONSE_SCHEMA,
      omitResponseConstraintInput: true,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const wasStoppedManually = stopRequested && !timedOut;
      await destroySession();
      runtimeState.status = wasStoppedManually ? "stopped" : "timeout";
      throw new Error(
        wasStoppedManually
          ? "AI-запит зупинено вручну."
          : "AI-запит перевищив таймаут 60 секунд. Сесію моделі скинуто.",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (activeController === controller) activeController = null;
  }

  modelRequests += 1;
  const parsed = JSON.parse(response);
  const resultMap = new Map(
    (parsed.items || []).map((item) => [String(item.videoId || ""), item]),
  );

  const items = preparedVideos.map((video) =>
    normalizeResult(resultMap.get(video.videoId), video),
  );

  const contextRatio = activeSession.contextWindow
    ? activeSession.contextUsage / activeSession.contextWindow
    : 0;

  if (modelRequests >= 10 || contextRatio > 0.72) {
    await destroySession();
  } else {
    runtimeState.status = "ready";
  }

  return { ok: true, items };
}
