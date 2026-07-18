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

function resetFilters() {
  state.filters = createDefaultFilters();
  state.aiResults.clear();
  onFiltersChanged();
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
  panel.className = "ukrtube-filter-panel";
  panel.hidden = !state.filtersOpen;

  const panelHeader = document.createElement("div");
  panelHeader.className = "ukrtube-filter-header";

  const help = document.createElement("div");
  help.className = "ukrtube-filter-help";
  help.innerHTML =
    "Натискай тему: <b>показувати</b> → <b>не показувати</b> → нейтрально.";

  const resetButton = createButton(
    "ukrtube-reset-button",
    "Скинути",
    "Скинути всі фільтри",
  );
  resetButton.dataset.role = "reset-filters";
  resetButton.disabled = activeFilterCount() === 0;
  resetButton.addEventListener("click", resetFilters);

  panelHeader.append(help, resetButton);
  panel.appendChild(panelHeader);

  const categories = document.createElement("div");
  categories.className = "ukrtube-category-list";
  for (const category of CATEGORIES) {
    const chip = createButton("ukrtube-topic-chip", category.label);
    chip.dataset.categoryId = category.id;
    chip.dataset.mode = categoryMode(category.id);
    chip.title = "Нейтрально → показувати → не показувати";
    chip.addEventListener("click", () => cycleCategory(category.id));
    categories.appendChild(chip);
  }
  panel.appendChild(categories);

  const textGrid = document.createElement("div");
  textGrid.className = "ukrtube-filter-fields";

  const textHelp = document.createElement("div");
  textHelp.className = "ukrtube-keyword-help";
  textHelp.textContent =
    "Слова перевіряються у назві, каналі, описі й ключових словах завантажених відео.";
  textGrid.appendChild(textHelp);

  const includeLabel = document.createElement("label");
  includeLabel.innerHTML = "<span>Показувати, якщо є слова</span>";
  const includeInput = document.createElement("input");
  includeInput.type = "text";
  includeInput.dataset.role = "include-keywords";
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
  excludeInput.dataset.role = "exclude-keywords";
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
  dateBox.className = "ukrtube-date-filter";

  const dateTitle = document.createElement("div");
  dateTitle.className = "ukrtube-date-title";
  dateTitle.textContent = "Дата публікації";

  const presetList = document.createElement("div");
  presetList.className = "ukrtube-date-presets";
  presetList.setAttribute("role", "group");
  presetList.setAttribute("aria-label", "Період публікації");
  for (const preset of DATE_PRESETS) {
    const button = createButton("ukrtube-date-preset", preset.label);
    button.dataset.datePreset = preset.value;
    button.setAttribute(
      "aria-pressed",
      state.filters.datePreset === preset.value ? "true" : "false",
    );
    button.classList.toggle(
      "is-active",
      state.filters.datePreset === preset.value,
    );
    button.addEventListener("click", () => {
      state.filters.datePreset = preset.value;
      syncCustomDateInputs();
      onFiltersChanged();
      if (preset.value === "custom") {
        try {
          fromInput.showPicker?.();
        } catch {
          fromInput.focus();
        }
      }
    });
    presetList.appendChild(button);
  }

  const dateControls = document.createElement("div");
  dateControls.className = "ukrtube-date-controls";

  const fromLabel = document.createElement("label");
  fromLabel.innerHTML = "<span>Від</span>";
  const fromInput = document.createElement("input");
  fromInput.type = "date";
  fromInput.lang = "uk";
  fromInput.dataset.role = "date-from";
  fromInput.value = state.filters.dateFrom || "";
  fromLabel.appendChild(fromInput);

  const toLabel = document.createElement("label");
  toLabel.innerHTML = "<span>До</span>";
  const toInput = document.createElement("input");
  toInput.type = "date";
  toInput.lang = "uk";
  toInput.dataset.role = "date-to";
  toInput.value = state.filters.dateTo || "";
  toLabel.appendChild(toInput);

  function syncCustomDateInputs() {
    const custom = state.filters.datePreset === "custom";
    dateControls.hidden = !custom;
    dateBox.classList.toggle("is-custom", custom);
    fromInput.max = state.filters.dateTo || "";
    toInput.min = state.filters.dateFrom || "";
  }

  fromInput.addEventListener("change", () => {
    state.filters.dateFrom = fromInput.value;
    state.filters.datePreset = "custom";
    if (state.filters.dateTo && state.filters.dateFrom > state.filters.dateTo) {
      state.filters.dateTo = state.filters.dateFrom;
      toInput.value = state.filters.dateTo;
    }
    syncCustomDateInputs();
    onFiltersChanged();
  });

  toInput.addEventListener("change", () => {
    state.filters.dateTo = toInput.value;
    state.filters.datePreset = "custom";
    if (
      state.filters.dateFrom &&
      state.filters.dateTo &&
      state.filters.dateTo < state.filters.dateFrom
    ) {
      state.filters.dateFrom = state.filters.dateTo;
      fromInput.value = state.filters.dateFrom;
    }
    syncCustomDateInputs();
    onFiltersChanged();
  });

  dateControls.append(fromLabel, toLabel);
  dateBox.append(dateTitle, presetList, dateControls);
  panel.appendChild(dateBox);
  syncCustomDateInputs();

  if (SHOW_AI_CONTROLS) {
    const aiBox = document.createElement("div");
    aiBox.className = "ukrtube-ai-box";

    const aiTop = document.createElement("div");
    aiTop.className = "ukrtube-ai-top";
    const aiLabel = document.createElement("label");
    aiLabel.className = "ukrtube-switch-label";
    const aiToggle = document.createElement("input");
    aiToggle.type = "checkbox";
    aiToggle.checked = Boolean(state.filters.aiEnabled);
    const aiSwitch = document.createElement("span");
    aiSwitch.className = "ukrtube-switch";
    const aiText = document.createElement("span");
    aiText.textContent = "Локальний AI-фільтр";
    aiLabel.append(aiToggle, aiSwitch, aiText);

    const aiStatus = document.createElement("span");
    aiStatus.className = "ukrtube-ai-status";
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
