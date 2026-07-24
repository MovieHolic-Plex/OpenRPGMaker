import {
  assertUniquePlayerPaths,
  compareContractPaths,
  contractFail,
  normalizeRelativePath,
  playerPathCollisionKey,
  validateFileRecords,
} from "./playerContractCore.mjs";

export function verifyViteDeploymentClosure({ artifactFiles, viteManifestValue, entryHtml, entryScript, viteManifest }) {
  const safeArtifactFiles = validateFileRecords(artifactFiles, "artifact files", { requireSorted: true });
  const outputPaths = viteOutputClosure(viteManifestValue, normalizeRelativePath(entryScript));
  const expectedPaths = [...new Set([
    normalizeRelativePath(entryHtml),
    normalizeRelativePath(viteManifest),
    ...outputPaths,
  ])].sort(compareContractPaths);
  assertUniquePlayerPaths(expectedPaths, "Vite output closure");
  const actualPaths = safeArtifactFiles.map((file) => file.path);
  if (!samePaths(expectedPaths, actualPaths)) {
    contractFail("deployment-file-set-mismatch", "artifact files do not match the Vite entry closure");
  }
  if (!outputPaths.includes(normalizeRelativePath(entryScript))) {
    contractFail("entry-script-missing", "Vite entry script is missing");
  }
  if (!outputPaths.some((filePath) => filePath.endsWith(".css"))) {
    contractFail("stylesheet-missing", "Vite entry closure has no stylesheet");
  }
  return Object.freeze(expectedPaths);
}

function viteOutputClosure(value, entryScript) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    contractFail("vite-manifest-malformed", "Vite manifest must be an object");
  }
  const entries = new Map(Object.entries(value));
  const entryKeys = [...entries.entries()]
    .filter(([, entry]) => isViteManifestEntry(entry) && (entry.isEntry === true || entry.file === entryScript))
    .map(([key]) => key);
  if (entryKeys.length !== 1) {
    contractFail("vite-entry-mismatch", "Vite manifest must contain exactly one player entry");
  }
  const visited = new Set();
  const outputs = new Map();
  const addOutput = (filePath) => {
    const key = playerPathCollisionKey(filePath);
    const previous = outputs.get(key);
    if (previous !== undefined && previous !== filePath) {
      contractFail("duplicate-path", "Vite output closure contains colliding paths");
    }
    outputs.set(key, filePath);
  };
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = entries.get(key);
    if (!isViteManifestEntry(entry)) {
      contractFail("vite-dependency-missing", "Vite manifest dependency is missing or malformed");
    }
    addOutput(normalizeRelativePath(entry.file));
    for (const outputPath of validatedOptionalPathList(entry.css, "css")) addOutput(outputPath);
    for (const outputPath of validatedOptionalPathList(entry.assets, "assets")) addOutput(outputPath);
    for (const dependencyKey of validatedOptionalStringList(entry.imports, "imports")) visit(dependencyKey);
    for (const dependencyKey of validatedOptionalStringList(entry.dynamicImports, "dynamicImports")) visit(dependencyKey);
  };
  visit(entryKeys[0]);
  return [...outputs.values()].sort(compareContractPaths);
}

function isViteManifestEntry(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof value.file === "string");
}

function validatedOptionalStringList(value, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    contractFail("vite-manifest-malformed", `${label} must contain strings`);
  }
  return value;
}

function validatedOptionalPathList(value, label) {
  return validatedOptionalStringList(value, label).map(normalizeRelativePath);
}

function samePaths(left, right) {
  return left.length === right.length && left.every((filePath, index) => filePath === right[index]);
}
