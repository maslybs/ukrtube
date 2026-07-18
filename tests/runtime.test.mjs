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

test("YouTube metadata provides a real avatar and an available view count", async () => {
  const playerResponse = {
    videoDetails: {
      title: "Test video",
      author: "Test channel",
      channelId: "UC123456789",
      lengthSeconds: "65",
      viewCount: "31382",
      thumbnail: {
        thumbnails: [{ url: "https://i.ytimg.com/vi/test/hqdefault.jpg" }],
      },
    },
    microformat: {
      playerMicroformatRenderer: { publishDate: "2026-07-18" },
    },
  };
  const initialData = {
    owner: {
      videoOwnerRenderer: {
        thumbnail: {
          thumbnails: [
            {
              url: "https://yt3.ggpht.com/avatar-small",
              width: 48,
              height: 48,
            },
            {
              url: "https://yt3.ggpht.com/avatar-large",
              width: 128,
              height: 128,
            },
          ],
        },
      },
    },
  };
  const html = [
    `var ytInitialPlayerResponse = ${JSON.stringify(playerResponse)};`,
    `var ytInitialData = ${JSON.stringify(initialData)};`,
  ].join("\n");
  const context = vm.createContext({
    URL,
    console,
    encodeURIComponent,
    fetch: async () => ({ ok: true, text: async () => html }),
  });

  runFile(context, "src/background/utils.js");
  runFile(context, "src/background/metadata.js");
  const video = await vm.runInContext(
    "fetchVideoMetadata('dQw4w9WgXcQ')",
    context,
  );

  assert.equal(video.avatarUrl, "https://yt3.ggpht.com/avatar-large");
  assert.equal(video.viewCount, 31382);
  assert.equal(video.viewCountAvailable, true);
});

test("video metadata enrichment is cached between requests", async () => {
  let metadataRequests = 0;
  let storedCache = null;
  const context = vm.createContext({
    URL,
    console,
    chrome: {
      storage: {
        local: {
          get: async () => ({}),
          set: async (value) => {
            storedCache = value;
          },
        },
      },
    },
  });

  runFile(context, "src/background/utils.js");
  vm.runInContext(
    `async function mapWithConcurrency(values, _limit, mapper) {
      return Promise.all(values.map(mapper));
    }
    async function fetchVideoMetadata(id) {
      metadataRequests += 1;
      return {
        id,
        avatarUrl: "https://yt3.ggpht.com/avatar",
        authorUrl: "https://www.youtube.com/channel/UC123",
        channelId: "UC123",
        isVerified: true,
        viewCount: 0,
        viewCountAvailable: true
      };
    }`,
    context,
  );
  context.metadataRequests = metadataRequests;
  runFile(context, "src/background/metadata-cache.js");

  const first = await vm.runInContext(
    "enrichVideoMetadata(['dQw4w9WgXcQ'])",
    context,
  );
  const second = await vm.runInContext(
    "enrichVideoMetadata(['dQw4w9WgXcQ'])",
    context,
  );

  assert.equal(vm.runInContext("metadataRequests", context), 1);
  assert.equal(first[0].avatarUrl, "https://yt3.ggpht.com/avatar");
  assert.equal(first[0].viewCountAvailable, true);
  assert.equal(second[0].viewCount, 0);
  assert.equal(Boolean(storedCache?.ukrtubeVideoMetadataCacheV1), true);
});

test("view counts include zero and use Ukrainian plural forms", () => {
  const context = vm.createContext({ Intl, console });
  runFile(context, "src/content/view.js");

  assert.equal(
    vm.runInContext("formatViews(0, true)", context),
    "0 переглядів",
  );
  assert.equal(vm.runInContext("formatViews(1, true)", context), "1 перегляд");
  assert.equal(vm.runInContext("formatViews(2, true)", context), "2 перегляди");
  assert.equal(vm.runInContext("formatViews(0, false)", context), "");
});

test("content enrichment updates every card in a returned batch", async () => {
  let renderCount = 0;
  const context = vm.createContext({ console });
  context.state = { active: true, metadataGeneration: 7 };
  context.renderVideos = () => {
    renderCount += 1;
  };
  context.sendMessage = async ({ ids }) => ({
    ok: true,
    items: ids.map((id, index) => ({
      id,
      avatarUrl: `https://yt3.ggpht.com/avatar-${index}`,
      viewCount: index,
      viewCountAvailable: true,
    })),
  });
  runFile(context, "src/content/metadata-enrichment.js");

  const videos = [
    { id: "dQw4w9WgXcQ", avatarUrl: "", viewCount: 0 },
    { id: "aqz-KE-bpKQ", avatarUrl: "", viewCount: 0 },
  ];
  context.videos = videos;
  await vm.runInContext("enrichVideoCards(videos, 7)", context);

  assert.equal(videos[0].avatarUrl, "https://yt3.ggpht.com/avatar-0");
  assert.equal(videos[0].viewCountAvailable, true);
  assert.equal(videos[1].avatarUrl, "https://yt3.ggpht.com/avatar-1");
  assert.equal(videos[1].viewCount, 1);
  assert.equal(renderCount, 1);
});

test("feed API requests a fresh random selection from /random", async () => {
  const requestedUrls = [];
  let requestNumber = 0;
  const context = vm.createContext({
    URL,
    console,
    fetch: async (url) => {
      requestedUrls.push(String(url));
      requestNumber += 1;
      return {
        ok: true,
        json: async () => ({
          ids:
            requestNumber === 1
              ? ["dQw4w9WgXcQ", "aqz-KE-bpKQ"]
              : ["M7lc1UVf-VE", "jNQXAC9IVRw"],
        }),
      };
    },
  });

  runFile(context, "src/background/utils.js");
  runFile(context, "src/background/feed-api.js");
  vm.runInContext(
    "globalThis.EXTENSION_CONFIG = { apiUrl: 'https://example.test/feed?stale=1', apiToken: 'token' }",
    context,
  );

  const first = await vm.runInContext("getRandomVideoIds(2)", context);
  const second = await vm.runInContext("getRandomVideoIds(2)", context);

  assert.deepEqual([...first], ["dQw4w9WgXcQ", "aqz-KE-bpKQ"]);
  assert.deepEqual([...second], ["M7lc1UVf-VE", "jNQXAC9IVRw"]);
  assert.notDeepEqual([...first], [...second]);
  assert.equal(requestedUrls.length, 2);
  for (const requestedUrl of requestedUrls) {
    const url = new URL(requestedUrl);
    assert.equal(url.pathname, "/random");
    assert.equal(url.searchParams.get("count"), "2");
    assert.equal(url.searchParams.has("stale"), false);
  }
});

test("background service worker loads every module and registers messaging", async () => {
  let listener = null;
  const cachedVideoId = "dQw4w9WgXcQ";
  const cachedEnrichment = {
    id: cachedVideoId,
    avatarUrl: "https://yt3.ggpht.com/cached-avatar",
    viewCount: 42,
    viewCountAvailable: true,
    fetchedAt: Date.now(),
  };
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
      storage: {
        local: {
          get: async (key) => ({
            [key]: { [cachedVideoId]: cachedEnrichment },
          }),
          set: async () => undefined,
        },
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

  const enriched = await new Promise((resolve) => {
    listener(
      { type: "ENRICH_VIDEO_METADATA", ids: [cachedVideoId] },
      {},
      resolve,
    );
  });
  assert.equal(enriched.ok, true);
  assert.equal(enriched.items[0].viewCount, 42);
  assert.equal(
    enriched.items[0].avatarUrl,
    "https://yt3.ggpht.com/cached-avatar",
  );
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
    "src/content/metadata-enrichment.js",
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
