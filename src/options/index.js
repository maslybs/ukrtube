"use strict";

const API_SETTINGS_KEY = "ukrtubeApiSettings";

const form = document.querySelector('[data-role="api-form"]');
const tokenInput = document.getElementById("api-token");
const visibilityButton = document.querySelector(
  '[data-role="toggle-visibility"]',
);
const removeButton = document.querySelector('[data-role="remove-token"]');
const statusMessage = document.querySelector('[data-role="status"]');
const statusDot = document.querySelector('[data-role="connection-dot"]');

function setStatus(message, kind = "info") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message${kind === "info" ? "" : ` is-${kind}`}`;
  statusDot.className = `status-dot${kind === "info" ? "" : ` is-${kind}`}`;
}

function setBusy(busy) {
  for (const button of form.querySelectorAll("button")) {
    button.disabled = busy;
  }
  removeButton.disabled = busy || !tokenInput.value.trim();
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(API_SETTINGS_KEY);
  const value = stored?.[API_SETTINGS_KEY];
  tokenInput.value =
    value && typeof value.apiToken === "string" ? value.apiToken : "";
  removeButton.disabled = !tokenInput.value.trim();
  setStatus(
    tokenInput.value
      ? "Ключ збережено. Натисніть «Зберегти й перевірити», щоб перевірити з’єднання."
      : "Додайте ключ API, щоб UkrTube міг завантажувати відео.",
  );
}

async function saveAndTest(event) {
  event.preventDefault();
  const apiToken = tokenInput.value.trim();
  if (!apiToken) {
    setStatus("Введіть ключ API.", "error");
    tokenInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Зберігаю ключ і перевіряю з’єднання…");
  try {
    await chrome.storage.local.set({
      [API_SETTINGS_KEY]: { apiToken, updatedAt: Date.now() },
    });
    const response = await sendMessage({ type: "TEST_API_CONNECTION" });
    if (!response?.ok) {
      throw new Error(response?.error || "Не вдалося перевірити з’єднання.");
    }
    setStatus("Ключ збережено. З’єднання з uatb.bgdn.dev працює.", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setStatus(
      message === "API_TOKEN_REQUIRED" || /unauthorized/i.test(message)
        ? "Ключ не прийнято. Перевірте його та спробуйте ще раз."
        : `Не вдалося перевірити з’єднання: ${message}`,
      "error",
    );
  } finally {
    setBusy(false);
  }
}

async function removeToken() {
  setBusy(true);
  try {
    await chrome.storage.local.remove(API_SETTINGS_KEY);
    tokenInput.value = "";
    setStatus("Ключ видалено з цього профілю Chrome.");
  } catch (error) {
    setStatus(
      `Не вдалося видалити ключ: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  } finally {
    setBusy(false);
  }
}

function toggleVisibility() {
  const visible = tokenInput.type === "text";
  tokenInput.type = visible ? "password" : "text";
  visibilityButton.textContent = visible ? "Показати" : "Сховати";
  visibilityButton.setAttribute(
    "aria-label",
    visible ? "Показати ключ" : "Сховати ключ",
  );
}

form.addEventListener("submit", saveAndTest);
visibilityButton.addEventListener("click", toggleVisibility);
removeButton.addEventListener("click", removeToken);
tokenInput.addEventListener("input", () => {
  removeButton.disabled = !tokenInput.value.trim();
});

loadSettings().catch((error) => {
  setStatus(
    `Не вдалося прочитати налаштування: ${error instanceof Error ? error.message : String(error)}`,
    "error",
  );
});
