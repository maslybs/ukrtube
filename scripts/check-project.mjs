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

for (const readme of ["README.md", "README.uk.md"]) {
  const file = projectPath(readme);
  report(
    existsSync(file) && statSync(file).size > 500,
    `${readme} is missing or incomplete.`,
  );
}

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
