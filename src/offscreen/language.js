"use strict";

function heuristicLanguage(text) {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) return { code: "und", confidence: 0 };
  if (/[іїєґ]/u.test(normalized)) return { code: "uk", confidence: 0.98 };
  if (/[ыэъё]/u.test(normalized)) return { code: "ru", confidence: 0.98 };
  if (/^[\x00-\x7F\s\p{P}\p{N}]+$/u.test(normalized)) {
    return { code: "en", confidence: 0.85 };
  }
  return null;
}

async function ensureDetector() {
  if (detector) return detector;
  if (!("LanguageDetector" in globalThis)) return null;

  const availability = await LanguageDetector.availability();
  if (availability === "unavailable") return null;

  detector = await LanguageDetector.create({
    monitor(monitor) {
      monitor.addEventListener("downloadprogress", (event) => {
        runtimeState.status = `language-model-download:${Math.round(event.loaded * 100)}`;
      });
    },
  });
  return detector;
}

async function detectLanguage(text) {
  const heuristic = heuristicLanguage(text);
  if (heuristic) return heuristic;

  try {
    const languageDetector = await ensureDetector();
    if (!languageDetector) return { code: "und", confidence: 0 };
    const results = await languageDetector.detect(normalizeText(text, 2000));
    const best = results?.[0];
    return {
      code: best?.detectedLanguage || "und",
      confidence: Number(best?.confidence || 0),
    };
  } catch (error) {
    console.warn("[UkrTube AI] Language detection failed", error);
    return { code: "und", confidence: 0 };
  }
}

async function ensureTranslator(sourceLanguage, targetLanguage = "en") {
  if (!("Translator" in globalThis)) return null;
  const key = `${sourceLanguage}:${targetLanguage}`;
  if (translators.has(key)) return translators.get(key);
  if (unavailableTranslators.has(key)) return null;

  try {
    const availability = await Translator.availability({
      sourceLanguage,
      targetLanguage,
    });
    if (availability === "unavailable") {
      unavailableTranslators.add(key);
      return null;
    }

    const translator = await Translator.create({
      sourceLanguage,
      targetLanguage,
      monitor(monitor) {
        monitor.addEventListener("downloadprogress", (event) => {
          runtimeState.status = `translator-download:${sourceLanguage}:${Math.round(event.loaded * 100)}`;
        });
      },
    });
    translators.set(key, translator);
    return translator;
  } catch (error) {
    unavailableTranslators.add(key);
    console.info(
      `[UkrTube AI] Translator ${key} unavailable: ${error?.name || "unknown error"}`,
    );
    return null;
  }
}

async function translateToEnglish(text, detected = null) {
  const normalized = normalizeText(text, 2500);
  if (!normalized) return "";

  const language = detected || (await detectLanguage(normalized));
  const source = String(language.code || "").split("-")[0];
  if (
    !source ||
    source === "en" ||
    source === "und" ||
    !TRANSLATABLE_TO_EN.has(source)
  )
    return normalized;

  const translator = await ensureTranslator(source, "en");
  if (!translator) return normalized;

  try {
    return await translator.translate(normalized);
  } catch (error) {
    console.warn("[UkrTube AI] Translation failed", error);
    return normalized;
  }
}
