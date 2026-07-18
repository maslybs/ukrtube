"use strict";

function activeFilterCount() {
  const categoryCount = Object.values(state.filters.categoryModes || {}).filter(
    (mode) => mode === "include" || mode === "exclude",
  ).length;
  return (
    categoryCount +
    (splitTerms(state.filters.includeKeywords).length ? 1 : 0) +
    (splitTerms(state.filters.excludeKeywords).length ? 1 : 0) +
    (state.filters.datePreset && state.filters.datePreset !== "any" ? 1 : 0)
  );
}

// Filter controls.

function buildAiRule() {
  const includeCategories = CATEGORIES.filter(
    (category) => state.filters.categoryModes?.[category.id] === "include",
  ).map((category) => category.label);
  const excludeCategories = CATEGORIES.filter(
    (category) => state.filters.categoryModes?.[category.id] === "exclude",
  ).map((category) => category.label);

  return (
    [
      includeCategories.length
        ? `Надавай перевагу темам: ${includeCategories.join(", ")}.`
        : "",
      excludeCategories.length
        ? `Приховуй теми: ${excludeCategories.join(", ")}.`
        : "",
      state.filters.aiRule.trim(),
    ]
      .filter(Boolean)
      .join("\n") ||
    "Показуй різноманітні змістовні українські відео. Приховуй явно нерелевантний контент за правилами користувача."
  );
}

function categoryMode(categoryId) {
  const value = state.filters.categoryModes?.[categoryId];
  return value === "include" || value === "exclude" ? value : "neutral";
}

function cycleCategory(categoryId) {
  const current = categoryMode(categoryId);
  const next =
    current === "neutral"
      ? "include"
      : current === "include"
        ? "exclude"
        : "neutral";

  const modes = { ...(state.filters.categoryModes || {}) };
  if (next === "neutral") delete modes[categoryId];
  else modes[categoryId] = next;
  state.filters.categoryModes = modes;
  onFiltersChanged(true);
}

function createFilterPanel() {
  const panel = document.createElement("div");
  panel.className = "ukr-random-filter-panel";
  panel.hidden = !state.filtersOpen;

  const help = document.createElement("div");
  help.className = "ukr-random-filter-help";
  help.innerHTML =
    "Натискай тему: <b>показувати</b> → <b>не показувати</b> → нейтрально.";
  panel.appendChild(help);

  const categories = document.createElement("div");
  categories.className = "ukr-random-category-list";
  for (const category of CATEGORIES) {
    const chip = createButton("ukr-random-topic-chip", category.label);
    chip.dataset.categoryId = category.id;
    chip.dataset.mode = categoryMode(category.id);
    chip.title = "Нейтрально → показувати → не показувати";
    chip.addEventListener("click", () => cycleCategory(category.id));
    categories.appendChild(chip);
  }
  panel.appendChild(categories);

  const textGrid = document.createElement("div");
  textGrid.className = "ukr-random-filter-fields";

  const includeLabel = document.createElement("label");
  includeLabel.innerHTML = "<span>Показувати, якщо є слова</span>";
  const includeInput = document.createElement("input");
  includeInput.type = "text";
  includeInput.placeholder = "наприклад: технології, історія";
  includeInput.value = state.filters.includeKeywords;
  includeInput.addEventListener("input", () => {
    state.filters.includeKeywords = includeInput.value;
    onFiltersChanged(true);
  });
  includeLabel.appendChild(includeInput);

  const excludeLabel = document.createElement("label");
  excludeLabel.innerHTML = "<span>Не показувати, якщо є слова</span>";
  const excludeInput = document.createElement("input");
  excludeInput.type = "text";
  excludeInput.placeholder = "наприклад: політика, футбол";
  excludeInput.value = state.filters.excludeKeywords;
  excludeInput.addEventListener("input", () => {
    state.filters.excludeKeywords = excludeInput.value;
    onFiltersChanged(true);
  });
  excludeLabel.appendChild(excludeInput);
  textGrid.append(includeLabel, excludeLabel);
  panel.appendChild(textGrid);

  const dateBox = document.createElement("div");
  dateBox.className = "ukr-random-date-filter";

  const dateTitle = document.createElement("div");
  dateTitle.className = "ukr-random-date-title";
  dateTitle.textContent = "Дата публікації";

  const dateControls = document.createElement("div");
  dateControls.className = "ukr-random-date-controls";

  const presetLabel = document.createElement("label");
  presetLabel.innerHTML = "<span>Період</span>";
  const presetSelect = document.createElement("select");
  for (const preset of DATE_PRESETS) {
    const option = document.createElement("option");
    option.value = preset.value;
    option.textContent = preset.label;
    presetSelect.appendChild(option);
  }
  presetSelect.value = state.filters.datePreset || "any";
  presetLabel.appendChild(presetSelect);

  const fromLabel = document.createElement("label");
  fromLabel.innerHTML = "<span>Від</span>";
  const fromInput = document.createElement("input");
  fromInput.type = "date";
  fromInput.value = state.filters.dateFrom || "";
  fromLabel.appendChild(fromInput);

  const toLabel = document.createElement("label");
  toLabel.innerHTML = "<span>До</span>";
  const toInput = document.createElement("input");
  toInput.type = "date";
  toInput.value = state.filters.dateTo || "";
  toLabel.appendChild(toInput);

  function syncCustomDateInputs() {
    const custom = presetSelect.value === "custom";
    fromInput.disabled = !custom;
    toInput.disabled = !custom;
    dateBox.classList.toggle("is-custom", custom);
  }

  presetSelect.addEventListener("change", () => {
    state.filters.datePreset = presetSelect.value;
    syncCustomDateInputs();
    onFiltersChanged(false);
  });

  fromInput.addEventListener("change", () => {
    state.filters.dateFrom = fromInput.value;
    state.filters.datePreset = "custom";
    presetSelect.value = "custom";
    syncCustomDateInputs();
    onFiltersChanged(false);
  });

  toInput.addEventListener("change", () => {
    state.filters.dateTo = toInput.value;
    state.filters.datePreset = "custom";
    presetSelect.value = "custom";
    syncCustomDateInputs();
    onFiltersChanged(false);
  });

  dateControls.append(presetLabel, fromLabel, toLabel);
  dateBox.append(dateTitle, dateControls);
  panel.appendChild(dateBox);
  syncCustomDateInputs();

  if (SHOW_AI_CONTROLS) {
    const aiBox = document.createElement("div");
    aiBox.className = "ukr-random-ai-box";

    const aiTop = document.createElement("div");
    aiTop.className = "ukr-random-ai-top";
    const aiLabel = document.createElement("label");
    aiLabel.className = "ukr-random-switch-label";
    const aiToggle = document.createElement("input");
    aiToggle.type = "checkbox";
    aiToggle.checked = Boolean(state.filters.aiEnabled);
    const aiSwitch = document.createElement("span");
    aiSwitch.className = "ukr-random-switch";
    const aiText = document.createElement("span");
    aiText.textContent = "Локальний AI-фільтр";
    aiLabel.append(aiToggle, aiSwitch, aiText);

    const aiStatus = document.createElement("span");
    aiStatus.className = "ukr-random-ai-status";
    aiStatus.dataset.role = "ai-status";
    aiStatus.textContent = state.aiStatus;
    aiTop.append(aiLabel, aiStatus);

    const aiRule = document.createElement("textarea");
    aiRule.rows = 3;
    aiRule.placeholder =
      "Наприклад: не показуй військові новини; більше відео про технології, науку та подорожі.";
    aiRule.value = state.filters.aiRule;
    aiRule.disabled = !state.filters.aiEnabled;
    aiRule.addEventListener("input", () => {
      state.filters.aiRule = aiRule.value;
      onFiltersChanged(true);
    });

    aiToggle.addEventListener("change", async () => {
      state.filters.aiEnabled = aiToggle.checked;
      aiRule.disabled = !aiToggle.checked;
      saveFilters();
      state.aiGeneration += 1;

      if (aiToggle.checked) {
        state.aiResults.clear();
        state.aiStatus = "Запуск локального AI…";
        updateAiStatus();
        classifyPendingVideos();
      } else {
        state.aiStatus = "AI вимкнено";
        state.aiProcessing = false;
        updateAiStatus();
        renderVideos();
        sendMessage({ type: "STOP_AI" }).catch(() => {});
      }
    });

    aiBox.append(aiTop, aiRule);
    panel.appendChild(aiBox);
  }
  return panel;
}
