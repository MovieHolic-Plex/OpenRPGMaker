import runtimeAssetInventory from "@/player/runtimeAssets.json";
import { contractFailure, WebExportContractError, type WebExportContractErrorCode } from "@/project/playerDeploymentErrors";
import type { DeploymentFileRecord } from "@/project/playerDeploymentTypes";
import { unicodeCaseFoldKey } from "@/project/unicodeCaseFold.js";

const decoder = new TextDecoder("utf-8", { fatal: true });

export const pathCollisionKey = unicodeCaseFoldKey;

export function contractPath(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.includes("\0")
    || value.includes("\\")
    || value.includes("://")
    || /%(?:2e|2f|5c)/iu.test(value)
    || value.startsWith("/")
    || /^[A-Za-z]:\//u.test(value)
  ) {
    contractFailure("manifest-contract-mismatch");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    contractFailure("manifest-contract-mismatch");
  }
  return value;
}

export function assertUniquePaths(paths: readonly string[]): void {
  const seen = new Set<string>();
  for (const filePath of paths) {
    const key = pathCollisionKey(filePath);
    if (seen.has(key)) contractFailure("manifest-path-collision");
    seen.add(key);
  }
}

export function assertDisjointPathSets(left: readonly string[], right: readonly string[]): void {
  const keys = new Set(left.map(pathCollisionKey));
  if (right.some((filePath) => keys.has(pathCollisionKey(filePath)))) {
    contractFailure("manifest-path-collision");
  }
}

export function parseFileRecords(value: unknown): readonly DeploymentFileRecord[] {
  if (!Array.isArray(value) || value.length === 0) contractFailure("manifest-contract-mismatch");
  const records = value.map((entry): DeploymentFileRecord => {
    if (!isRecord(entry)) contractFailure("manifest-contract-mismatch");
    const filePath = contractPath(entry["path"]);
    const byteCount = entry["bytes"];
    const digest = entry["sha256"];
    if (
      !Number.isInteger(byteCount)
      || typeof byteCount !== "number"
      || byteCount < 0
      || typeof digest !== "string"
      || !/^[a-f0-9]{64}$/u.test(digest)
    ) {
      contractFailure("manifest-contract-mismatch");
    }
    return { path: filePath, bytes: byteCount, sha256: digest };
  });
  assertUniquePaths(records.map((record) => record.path));
  const sorted = [...records].sort((left, right) => compareContractPaths(left.path, right.path));
  if (records.some((record, index) => record.path !== sorted[index]?.path)) {
    contractFailure("manifest-contract-mismatch");
  }
  return Object.freeze(records);
}

export function parsePathList(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) contractFailure("manifest-contract-mismatch");
  const paths = value.map(contractPath);
  assertUniquePaths(paths);
  const sorted = [...paths].sort(compareContractPaths);
  if (paths.some((filePath, index) => filePath !== sorted[index])) contractFailure("manifest-contract-mismatch");
  return Object.freeze(paths);
}

export function parseJsonObject(
  bytes: Uint8Array,
  code: WebExportContractErrorCode,
  parseJson: (text: string) => unknown,
): Readonly<Record<string, unknown>> {
  try {
    const parsed = parseJson(decoder.decode(bytes));
    if (!isRecord(parsed)) contractFailure(code);
    return parsed;
  } catch (error) {
    if (error instanceof WebExportContractError) throw error;
    contractFailure(code);
  }
}

function parseRuntimeAssetInventory(value: unknown): readonly string[] {
  if (!isRecord(value) || value["schemaVersion"] !== 1 || !Array.isArray(value["paths"]) || value["paths"].length === 0) {
    contractFailure("manifest-contract-mismatch");
  }
  const paths = value["paths"].map(contractPath);
  assertUniquePaths(paths);
  const sorted = [...paths].sort(compareContractPaths);
  if (paths.some((filePath, index) => filePath !== sorted[index])) contractFailure("manifest-contract-mismatch");
  return Object.freeze(paths);
}

export function compareContractPaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function samePathList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((filePath, index) => filePath === right[index]);
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const PLAYER_RUNTIME_ASSET_PATHS = parseRuntimeAssetInventory(runtimeAssetInventory);
