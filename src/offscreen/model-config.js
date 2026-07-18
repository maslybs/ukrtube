"use strict";

const MODEL_OPTIONS = Object.freeze({
  expectedInputs: [{ type: "text", languages: ["en"] }],
  expectedOutputs: [{ type: "text", languages: ["en"] }],
  initialPrompts: [
    {
      role: "system",
      content: [
        "You are a strict local recommendation classifier for YouTube.",
        "Evaluate each candidate only from the supplied metadata and user rules.",
        "Prefer diversity and user agency. A single watched video is not proof of a lasting interest.",
        "Do not invent facts about a video. If metadata is insufficient, lower confidence.",
        "Return only data matching the required JSON schema.",
      ].join(" "),
    },
  ],
});

const RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          videoId: { type: "string" },
          score: { type: "integer", minimum: -100, maximum: 100 },
          action: { type: "string", enum: ["allow", "lower", "hide"] },
          language: { type: "string" },
          topics: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
          },
          entities: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
          },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: [
          "videoId",
          "score",
          "action",
          "language",
          "topics",
          "entities",
          "reason",
          "confidence",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
});
