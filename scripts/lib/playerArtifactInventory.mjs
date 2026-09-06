import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  assertUniquePlayerPaths,
  compareContractPaths,
  contractFail,
  normalizeRelativePath,
  playerPathCollisionKey,
  sha256Value,
  validateFileRecords,
} from "./playerContractCore.mjs";

export const PLAYER_SOURCE_INPUT_INVENTORY = Object.freeze([
  ...[
    "player.html",
    "vite.player.config.ts",
    "vite.standalone.config.ts",
    "package.json",
    "package-lock.json",
    "scripts/build-player-sdk.mjs",
    "scripts/build-community.mjs",
    "community-site/package.json",
    "community-site/scripts/sync-player.mjs",
  ]
    .map((inputPath) => Object.freeze({ kind: "file", path: inputPath })),
  ...[
    "scripts/lib/playerArtifactContract.mjs",
    "scripts/lib/playerArtifactInventory.mjs",
    "scripts/lib/playerContractCore.mjs",
    "scripts/lib/playerDeploymentContract.mjs",
    "scripts/lib/playerDeploymentManifest.mjs",
    "scripts/lib/playerManifestAtomicWriter.mjs",
    "scripts/lib/playerViteClosure.mjs",
  ].map((inputPath) => Object.freeze({ kind: "file", path: inputPath })),
  ...[
    "src/app",
    "src/assets",
    "src/battle",
    "src/player",
    "src/project",
    "src/styles/runtime",
    "src/util",
    "community-site/scripts/lib",
  ]
    .map((inputPath) => Object.freeze({ kind: "directory", path: inputPath })),
  ...["src/styles/tokens.css", "src/styles/dialogue.css", "src/styles/database/tabs-b-title-screen.css", "src/testing/debugSession.ts"]
    .map((inputPath) => Object.freeze({ kind: "file", path: inputPath })),
  ...["src/editor/eventCommands", "src/editor/cutscene", "public/assets", "public/generated"]
    .map((inputPath) => Object.freeze({ kind: "directory", path: inputPath })),
  Object.freeze({ kind: "file", path: "src/editor/tilesetImage.ts" }),
]);

const TEXT_EXTENSIONS = new Set([".css", ".cjs", ".html", ".js", ".json", ".map", ".mjs", ".svg", ".txt", ".xml"]);
const MAX_TEXT_SCAN_BYTES = 16 * 1024 * 1024;
const SECRET_RULES = Object.freeze([
  Object.freeze({ rule: "private-key", category: "private-key", pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/u }),
  Object.freeze({ rule: "provider-key", category: "api-credential", pattern: /\b(?:sk|rk|pk)-(?:live-)?[A-Za-z0-9_-]{20,}\b/u }),
  Object.freeze({ rule: "google-api-key", category: "api-credential", pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/u }),
  Object.freeze({ rule: "slack-token", category: "api-credential", pattern: /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/u }),
  Object.freeze({ rule: "github-token", category: "api-credential", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u }),
  Object.freeze({ rule: "jwt", category: "bearer-token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u }),
  Object.freeze({ rule: "credential-url", category: "connection-credential", pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^/\s:@]+:[^@\s/]+@/iu }),
  Object.freeze({ rule: "credential-assignment", category: "embedded-credential", pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|password)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}["']/iu }),
]);

async function fileRecord(fullPath, relativePath) {
  const bytes = await readFile(fullPath);
  return Object.freeze({ path: normalizeRelativePath(relativePath), bytes: bytes.length, sha256: sha256Value(bytes) });
}

export async function collectFileRecords(root, options = {}) {
  const excluded = new Set((options.excludePaths ?? []).map(normalizeRelativePath));
  async function walk(directory, prefix = "") {
    const records = [];
    const entries = (await readdir(directory, { withFileTypes: true }))
      .sort((left, right) => compareContractPaths(left.name, right.name));
    for (const entry of entries) {
      const relativePath = normalizeRelativePath(prefix ? `${prefix}/${entry.name}` : entry.name);
      if (excluded.has(relativePath)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) contractFail("symbolic-link", "symbolic links are not allowed in player inventory");
      if (entry.isDirectory()) records.push(...await walk(fullPath, relativePath));
      else if (entry.isFile()) records.push(await fileRecord(fullPath, relativePath));
      else contractFail("unsupported-entry", "player inventory contains an unsupported filesystem entry");
    }
    return records;
  }
  return Object.freeze(await walk(path.resolve(root)));
}

export async function collectListedFileRecords(root, filePaths) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    contractFail("invalid-inventory", "listed file inventory must be non-empty");
  }
  const normalizedPaths = filePaths.map(normalizeRelativePath).sort(compareContractPaths);
  assertUniquePlayerPaths(normalizedPaths, "listed file inventory");
  const resolvedRoot = path.resolve(root);
  return Object.freeze(await Promise.all(normalizedPaths.map((relativePath) => (
    fileRecord(path.resolve(resolvedRoot, relativePath), relativePath)
  ))));
}

export async function collectSourceInputRecords(repoRoot, options = {}) {
  const inventory = options.inventory ?? PLAYER_SOURCE_INPUT_INVENTORY;
  const records = [];
  for (const input of inventory) {
    const inputPath = normalizeRelativePath(input.path);
    if (input.kind === "file") records.push(await fileRecord(path.resolve(repoRoot, inputPath), inputPath));
    else if (input.kind === "directory") {
      const nested = await collectFileRecords(path.resolve(repoRoot, inputPath));
      records.push(...nested.map((entry) => Object.freeze({ ...entry, path: `${inputPath}/${entry.path}` })));
    } else contractFail("invalid-inventory", "source inventory contains an unsupported kind");
  }
  records.sort((left, right) => compareContractPaths(left.path, right.path));
  const seen = new Set();
  for (const record of records) {
    const key = playerPathCollisionKey(record.path);
    if (seen.has(key)) contractFail("duplicate-path", "source input inventory contains colliding paths");
    seen.add(key);
  }
  return Object.freeze(records);
}

export async function scanSecretShapedFiles({ root, files }) {
  const findings = [];
  for (const file of validateFileRecords(files, "scan files")) {
    if (!TEXT_EXTENSIONS.has(path.extname(file.path).toLowerCase())) continue;
    if (file.bytes > MAX_TEXT_SCAN_BYTES) contractFail("scan-limit", "text scan size limit exceeded");
    const text = await readFile(path.resolve(root, file.path), "utf8");
    for (const rule of SECRET_RULES) {
      if (rule.pattern.test(text)) findings.push(Object.freeze({ path: file.path, rule: rule.rule, category: rule.category }));
    }
  }
  return Object.freeze(findings.sort((left, right) => (
    compareContractPaths(`${left.path}\0${left.rule}`, `${right.path}\0${right.rule}`)
  )));
}

export function assertSecretScanClean(findings) {
  if (findings.length === 0) return;
  const summary = findings.map(({ path: filePath, rule, category }) => `${filePath} [${category}/${rule}]`).join(", ");
  contractFail("secret-scan-failed", `secret-shaped content rejected: ${summary}`);
}
