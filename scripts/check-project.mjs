import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const errors = [];

function report(condition, message) {
  if (!condition) errors.push(message);
}

function projectPath(relativePath) {
  return path.join(projectRoot, relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(readFileSync(projectPath(relativePath), "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return null;
  }
}

function collectFiles(directory, extension) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath, extension);
    return entry.name.endsWith(extension) ? [entryPath] : [];
  });
}

const manifest = readJson("manifest.json");

if (manifest) {
  report(
    manifest.name === "UkrTube",
    "manifest.json must use the UkrTube name.",
  );
  report(
    manifest.short_name === "UkrTube",
    "manifest.json must use the UkrTube short name.",
  );
  report(
    manifest.manifest_version === 3,
    "manifest.json must use Manifest V3.",
  );
  report(
    manifest.version === "1.3.0",
    "manifest.json and package.json versions must match.",
  );
  report(
    manifest.host_permissions?.includes("https://uatb.bgdn.dev/*"),
    "manifest.json must allow the uatb.bgdn.dev API origin.",
  );
  report(
    !manifest.host_permissions?.some((value) =>
      value.includes("youtube-id-collector.bgdn.workers.dev"),
    ),
    "manifest.json must not retain the retired API origin.",
  );

  const serviceWorker = manifest.background?.service_worker;
  report(
    Boolean(serviceWorker),
    "manifest.json must declare a background service worker.",
  );
  if (serviceWorker) {
    const serviceWorkerPath = projectPath(serviceWorker);
    report(
      existsSync(serviceWorkerPath),
      `Missing service worker: ${serviceWorker}`,
    );

    if (existsSync(serviceWorkerPath)) {
      const source = readFileSync(serviceWorkerPath, "utf8");
      const importedScripts = [...source.matchAll(/"([^"\n]+\.js)"/g)].map(
        (match) => match[1],
      );

      for (const importedScript of importedScripts) {
        if (importedScript.endsWith("config.local.js")) continue;
        report(
          existsSync(
            path.resolve(path.dirname(serviceWorkerPath), importedScript),
          ),
          `Missing background import: ${importedScript}`,
        );
      }
    }
  }

  for (const contentScript of manifest.content_scripts || []) {
    for (const relativePath of [
      ...(contentScript.js || []),
      ...(contentScript.css || []),
    ]) {
      report(
        existsSync(projectPath(relativePath)),
        `Missing manifest resource: ${relativePath}`,
      );
    }
  }

  const optionsPage = manifest.options_ui?.page;
  report(Boolean(optionsPage), "manifest.json must declare an options page.");
  if (optionsPage) {
    const optionsPath = projectPath(optionsPage);
    report(existsSync(optionsPath), `Missing options page: ${optionsPage}`);
    if (existsSync(optionsPath)) {
      const optionsHtml = readFileSync(optionsPath, "utf8");
      for (const resource of ["index.js", "styles.css"]) {
        report(
          optionsHtml.includes(resource) &&
            existsSync(path.resolve(path.dirname(optionsPath), resource)),
          `Missing options resource: ${resource}`,
        );
      }
    }
  }
}

const offscreenDocument = projectPath("src/offscreen/index.html");
report(
  existsSync(offscreenDocument),
  "Missing offscreen document: src/offscreen/index.html",
);

if (existsSync(offscreenDocument)) {
  const html = readFileSync(offscreenDocument, "utf8");
  const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(
    (match) => match[1],
  );
  report(
    scriptSources.length > 0,
    "The offscreen document must load its runtime scripts.",
  );
  for (const source of scriptSources) {
    report(
      existsSync(path.resolve(path.dirname(offscreenDocument), source)),
      `Missing offscreen script: ${source}`,
    );
  }
}

for (const file of collectFiles(projectPath("src"), ".js")) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    errors.push(`${path.relative(projectRoot, file)}: ${result.stderr.trim()}`);
  }
}

const packageJson = readJson("package.json");
if (manifest && packageJson) {
  report(
    manifest.version === packageJson.version,
    "Version mismatch between manifest.json and package.json.",
  );
  report(
    packageJson.name === "ukrtube-extension",
    "package.json must use the UkrTube package name.",
  );
}

report(
  path.basename(projectRoot) === "ukrtube",
  "The project directory must be named ukrtube.",
);

const feedApiSource = readFileSync(
  projectPath("src/background/feed-api.js"),
  "utf8",
);
const controllerSource = readFileSync(
  projectPath("src/content/controller.js"),
  "utf8",
);
const viewSource = readFileSync(projectPath("src/content/view.js"), "utf8");
const optionsSource = readFileSync(projectPath("src/options/index.js"), "utf8");
report(
  controllerSource.includes('type: "GET_FILTERED_FEED"') &&
    feedApiSource.includes('url.pathname = "/feed"'),
  "The main feed must request complete cards from /feed.",
);
report(
  !viewSource.includes("Показано") &&
    !viewSource.includes('data-role="count-label"'),
  "The feed toolbar must not show a video-count label.",
);
report(
  optionsSource.includes("chrome.storage.local") &&
    optionsSource.includes("TEST_API_CONNECTION"),
  "The options page must save the API key locally and test the connection.",
);

for (const readme of ["README.md", "README.en.md"]) {
  const file = projectPath(readme);
  report(
    existsSync(file) && statSync(file).size > 500,
    `${readme} is missing or incomplete.`,
  );
}
const primaryReadme = readFileSync(projectPath("README.md"), "utf8");
const englishReadme = readFileSync(projectPath("README.en.md"), "utf8");
report(
  primaryReadme.includes("## Можливості") &&
    primaryReadme.includes("README.en.md"),
  "README.md must be the primary Ukrainian documentation.",
);
report(
  englishReadme.includes("## Features") && englishReadme.includes("README.md"),
  "README.en.md must contain the English documentation.",
);

const publicConfig = readFileSync(projectPath("src/config.js"), "utf8");
report(
  publicConfig.includes("https://uatb.bgdn.dev") &&
    !publicConfig.includes("youtube-id-collector.bgdn.workers.dev"),
  "src/config.js must use the uatb.bgdn.dev API origin.",
);

const gitignore = existsSync(projectPath(".gitignore"))
  ? readFileSync(projectPath(".gitignore"), "utf8")
  : "";
report(
  gitignore.includes("src/config.local.js"),
  "src/config.local.js must be ignored by Git.",
);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  "Project structure, manifest resources, JSON, and JavaScript syntax are valid.",
);
