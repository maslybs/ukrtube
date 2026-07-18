"use strict";

function normalizeApiToken(value) {
  let token = String(value || "").trim();
  token = token.replace(/^Bearer\s+/i, "").trim();

  const quotePairs = [
    ['"', '"'],
    ["'", "'"],
    ["`", "`"],
    ["“", "”"],
    ["‘", "’"],
  ];
  for (const [opening, closing] of quotePairs) {
    if (token.startsWith(opening) && token.endsWith(closing)) {
      token = token.slice(opening.length, -closing.length).trim();
      break;
    }
  }

  if (!token) return "";
  if (!/^[\x21-\x7e]+$/.test(token)) {
    throw new Error("API_TOKEN_INVALID_CHARACTERS");
  }
  return token;
}
