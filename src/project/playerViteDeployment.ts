import { contractFailure } from "@/project/playerDeploymentErrors";
import {
  assertUniquePaths,
  compareContractPaths,
  contractPath,
  isRecord,
  pathCollisionKey,
  samePathList,
} from "@/project/playerDeploymentPaths";
import type { ParsedPlayerDeploymentManifest } from "@/project/playerDeploymentTypes";
import { RELEASE_COLLECTOR_FILE } from "./releaseDependencies";

export function verifyViteDeploymentClosure(
  manifest: ParsedPlayerDeploymentManifest,
  viteManifest: Readonly<Record<string, unknown>>,
): void {
  const entries = new Map(Object.entries(viteManifest));
  const entryKeys = [...entries.entries()]
    .filter(([, value]) => isRecord(value)
      && typeof value["file"] === "string"
      && (value["isEntry"] === true || value["file"] === manifest.deployment.entryScript))
    .map(([key]) => key);
  if (entryKeys.length !== 1) contractFailure("manifest-incomplete");
  const firstEntryKey = entryKeys[0];
  if (firstEntryKey === undefined) contractFailure("manifest-incomplete");
  const visited = new Set<string>();
  const outputs = new Map<string, string>();
  const addOutput = (filePath: string): void => {
    const key = pathCollisionKey(filePath);
    const previous = outputs.get(key);
    if (previous !== undefined && previous !== filePath) contractFailure("manifest-path-collision");
    outputs.set(key, filePath);
  };
  const visit = (key: string): void => {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = entries.get(key);
    if (!isRecord(entry) || typeof entry["file"] !== "string") contractFailure("manifest-incomplete");
    addOutput(contractPath(entry["file"]));
    for (const outputPath of optionalPathList(entry["css"])) addOutput(outputPath);
    for (const outputPath of optionalPathList(entry["assets"])) addOutput(outputPath);
    for (const dependency of optionalStringList(entry["imports"])) visit(dependency);
    for (const dependency of optionalStringList(entry["dynamicImports"])) visit(dependency);
  };
  visit(firstEntryKey);
  const outputPaths = [...outputs.values()];
  if (
    !outputPaths.includes(manifest.deployment.entryScript)
    || !outputPaths.some((filePath) => filePath.endsWith(".css"))
  ) {
    contractFailure("manifest-incomplete");
  }
  const expectedPaths = [...new Set([
    manifest.deployment.entryHtml,
    manifest.deployment.viteManifest,
    ...manifest.files.filter(file => file.path === RELEASE_COLLECTOR_FILE).map(file => file.path),
    ...outputPaths,
  ])].sort(compareContractPaths);
  assertUniquePaths(expectedPaths);
  if (!samePathList(expectedPaths, manifest.files.map((file) => file.path))) {
    contractFailure("manifest-incomplete");
  }
}

function optionalStringList(value: unknown): readonly string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    contractFailure("manifest-incomplete");
  }
  return value;
}

function optionalPathList(value: unknown): readonly string[] {
  return optionalStringList(value).map(contractPath);
}
