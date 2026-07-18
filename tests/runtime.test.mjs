import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function runFile(context, relativePath) {
  const source = readFileSync(path.join(projectRoot, relativePath), "utf8");
  new vm.Script(source, { filename: relativePath }).runInContext(context);
}

test("background helpers preserve normalization and duration behavior", () => {
  const context = vm.createContext({ URL, console });
  runFile(context, "src/background/utils.js");

  assert.deepEqual(
    Array.from(
      vm.runInContext(
        "normalizeIds({ ids: ['dQw4w9WgXcQ', 'bad', 'dQw4w9WgXcQ'] })",
        context,
      ),
    ),
    ["dQw4w9WgXcQ"],
  );
  assert.equal(
    vm.runInContext("normalizeImageUrl('//i.ytimg.com/image.jpg')", context),
    "https://i.ytimg.com/image.jpg",
  );
  assert.equal(
    vm.runInContext("normalizeText('  one\\n two  ')", context),
    "one two",
  );
  assert.equal(vm.runInContext("formatDuration(65)", context), "1:05");
  assert.equal(vm.runInContext("formatDuration(3661)", context), "1:01:01");
});

test("feed API keeps the existing server-side filter contract", async () => {
  let requestedUrl = "";
  const context = vm.createContext({
    URL,
    console,
    fetch: async (url) => {
      requestedUrl = String(url);
      return {
        ok: true,
        json: async () => ({
          items: [{ id: "dQw4w9WgXcQ", title: "Test" }],
          nextCursor: "next-page",
          hasMore: true,
        }),
      };
    },
  });

  runFile(context, "src/background/utils.js");
  runFile(context, "src/background/feed-api.js");
  vm.runInContext(
    "globalThis.EXTENSION_CONFIG = { apiUrl: 'https://example.test/random', apiToken: 'token' }",
    context,
  );

  const result = await vm.runInContext(
    `getFilteredFeed({
      count: 30,
      cursor: "cursor-1",
      filters: {
        categoryModes: { news: "include", sports: "exclude" },
        includeKeywords: "історія",
        excludeKeywords: "футбол",
        datePreset: "week",
        dateFrom: "2026-01-01",
        dateTo: "2026-01-31"
      }
    })`,
    context,
  );

  const url = new URL(requestedUrl);
  assert.equal(url.pathname, "/feed");
  assert.equal(url.searchParams.get("count"), "30");
  assert.equal(url.searchParams.get("cursor"), "cursor-1");
  assert.equal(url.searchParams.get("include_topics"), "news");
  assert.equal(url.searchParams.get("exclude_topics"), "sports");
  assert.equal(url.searchParams.get("include_keywords"), "історія");
  assert.equal(url.searchParams.get("exclude_keywords"), "футбол");
  assert.equal(url.searchParams.get("date_preset"), "week");
  assert.equal(result.videos.length, 1);
  assert.equal(result.nextCursor, "next-page");
  assert.equal(result.hasMore, true);
});

test("background service worker loads every module and registers messaging", async () => {
  let listener = null;
  const context = vm.createContext({
    URL,
    console,
    fetch: async () => ({ ok: true, json: async () => ({ items: [] }) }),
    chrome: {
      runtime: {
        getURL: (value) => `chrome-extension://test/${value}`,
        getContexts: async () => [],
        onMessage: {
          addListener(callback) {
            listener = callback;
          },
        },
        sendMessage: async () => ({ ok: true }),
      },
      offscreen: {
        createDocument: async () => undefined,
        closeDocument: async () => undefined,
      },
    },
  });

  context.importScripts = (...sources) => {
    for (const source of sources) {
      if (source.endsWith("config.local.js")) {
        throw new Error("Optional local config is absent in a clean clone.");
      }
      const relativePath = path.posix.normalize(`src/background/${source}`);
      runFile(context, relativePath);
    }
  };

  runFile(context, "src/background/service-worker.js");
  assert.equal(typeof listener, "function");

  const response = await new Promise((resolve) => {
    const keepChannelOpen = listener(
      { type: "UNKNOWN_TEST_MESSAGE" },
      {},
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });

  assert.equal(response.ok, false);
  assert.equal(response.error, "Unknown message type: UNKNOWN_TEST_MESSAGE");
});

test("ordered content modules share one isolated runtime", async () => {
  const listeners = new Map();
  let migratedSettings = null;
  const documentElement = {
    hasAttribute: () => false,
  };
  const context = vm.createContext({
    console,
    location: {
      href: "https://example.test/",
      hostname: "example.test",
      pathname: "/",
    },
    document: {
      body: {},
      documentElement,
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    getComputedStyle: () => ({ backgroundColor: "rgb(255, 255, 255)" }),
    matchMedia: () => ({ matches: false }),
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
      }

      observe() {}
    },
    IntersectionObserver: class {
      disconnect() {}
      observe() {}
    },
    window: {
      addEventListener: (name, callback) => listeners.set(name, callback),
      clearTimeout,
      setTimeout,
      requestAnimationFrame: (callback) => setTimeout(callback, 0),
      innerHeight: 900,
    },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage: (_message, callback) => callback({ ok: true }),
      },
      storage: {
        sync: {
          get: async () => ({
            ukrainianFeedFilters: {
              categoryModes: { news: "include" },
              includeKeywords: "історія",
            },
          }),
          set: async (value) => {
            migratedSettings = value;
          },
        },
      },
    },
    navigator: {},
    setTimeout,
    clearTimeout,
  });

  for (const file of [
    "src/content/state.js",
    "src/content/platform.js",
    "src/content/filters.js",
    "src/content/view.js",
    "src/content/ai-filter.js",
    "src/content/controller.js",
  ]) {
    runFile(context, file);
  }

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(vm.runInContext("state.initialized", context), true);
  assert.equal(
    vm.runInContext("state.filters.includeKeywords", context),
    "історія",
  );
  assert.equal(migratedSettings.ukrtubeFeedFilters.includeKeywords, "історія");
  assert.equal(
    vm.runInContext(
      "splitTerms(' Історія, історія; Наука ').join('|')",
      context,
    ),
    "історія|наука",
  );
  assert.equal(listeners.has("scroll"), true);
  assert.equal(listeners.has("yt-navigate-finish"), true);
});

test("offscreen modules preserve the unavailable-model response", async () => {
  let listener = null;
  const context = vm.createContext({
    AbortController,
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      runtime: {
        onMessage: {
          addListener(callback) {
            listener = callback;
          },
        },
      },
    },
  });

  for (const file of [
    "src/offscreen/model-config.js",
    "src/offscreen/runtime-state.js",
    "src/offscreen/language.js",
    "src/offscreen/session.js",
    "src/offscreen/classifier.js",
    "src/offscreen/messaging.js",
  ]) {
    runFile(context, file);
  }

  assert.equal(typeof listener, "function");
  const response = await new Promise((resolve) => {
    const keepChannelOpen = listener(
      { target: "offscreen", type: "GET_AI_STATUS" },
      {},
      resolve,
    );
    assert.equal(keepChannelOpen, true);
  });

  assert.equal(response.ok, false);
  assert.equal(response.status, "unavailable");
});
