import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { hashValue, sha256Bytes } from "./preflightCore.mjs";

export type DirtyPathRecord = {
  readonly bytes: number | null;
  readonly path: string;
  readonly sha256: string | null;
  readonly status: string;
};
export type GitSourceState = {
  readonly dirtyInventory: readonly DirtyPathRecord[];
  readonly dirtyInventorySha256: string;
  readonly gitHeadOrNull: string | null;
  readonly porcelainV2zSha256: string;
  readonly trackedDiffSha256: string;
  readonly untrackedInventorySha256: string;
};
export type GitDriftClassification = {
  readonly externalPaths: readonly string[];
  readonly gitMarkers: readonly string[];
  readonly protectedPaths: readonly string[];
};

export async function collectGitSourceState(cwd: string): Promise<GitSourceState> {
  const headResult = git(cwd, ["rev-parse", "HEAD"], true);
  const gitHeadOrNull = headResult.status === 0 ? headResult.stdout.toString("utf8").trim() : null;
  const diff = git(cwd, ["diff", "--binary", "--no-ext-diff", "HEAD", "--"]);
  const status = git(cwd, ["status", "--porcelain=v2", "-z", "--untracked-files=all"]);
  const parsed = parsePorcelainV2z(status.stdout);
  const dirtyInventory: DirtyPathRecord[] = [];
  for (const entry of parsed) {
    const absolute = path.resolve(cwd, entry.path);
    const fingerprint = await pathFingerprint(absolute);
    dirtyInventory.push({ ...entry, ...fingerprint });
  }
  const untracked = dirtyInventory.filter((entry) => entry.status === "?");
  return {
    dirtyInventory,
    dirtyInventorySha256: hashValue(dirtyInventory),
    gitHeadOrNull,
    porcelainV2zSha256: sha256Bytes(status.stdout),
    trackedDiffSha256: sha256Bytes(diff.stdout),
    untrackedInventorySha256: hashValue(untracked),
  };
}

export async function findDirtyInventoryDrift(cwd: string, inventory: readonly DirtyPathRecord[]): Promise<readonly string[]> {
  const drift: string[] = [];
  for (const entry of inventory) {
    const current = await pathFingerprint(path.resolve(cwd, entry.path));
    if (current.bytes !== entry.bytes || current.sha256 !== entry.sha256) drift.push(entry.path);
  }
  return drift;
}

export function findGitSourceStateDrift(before: GitSourceState, after: GitSourceState): readonly string[] {
  const changed = new Set<string>();
  const beforeByPath = groupInventoryByPath(before.dirtyInventory);
  const afterByPath = groupInventoryByPath(after.dirtyInventory);
  for (const dirtyPath of new Set([...beforeByPath.keys(), ...afterByPath.keys()])) {
    if (hashValue(beforeByPath.get(dirtyPath) ?? []) !== hashValue(afterByPath.get(dirtyPath) ?? [])) changed.add(dirtyPath);
  }
  if (before.porcelainV2zSha256 !== after.porcelainV2zSha256) changed.add("git:porcelain-v2-z");
  if (before.trackedDiffSha256 !== after.trackedDiffSha256) changed.add("git:tracked-diff");
  if (before.untrackedInventorySha256 !== after.untrackedInventorySha256) changed.add("git:untracked-inventory");
  return [...changed].sort((left, right) => left.localeCompare(right));
}

export function classifyGitSourceStateDrift(
  before: GitSourceState,
  after: GitSourceState,
  protectedPathSet: ReadonlySet<string>,
): GitDriftClassification {
  const drift = findGitSourceStateDrift(before, after);
  const gitMarkers = drift.filter((entry) => entry.startsWith("git:"));
  const changedPaths = drift.filter((entry) => !entry.startsWith("git:"));
  const protectedPaths = changedPaths.filter((entry) => protectedPathSet.has(entry));
  const externalPaths = changedPaths.filter((entry) => !protectedPathSet.has(entry));
  if (changedPaths.length === 0 && gitMarkers.length > 0) protectedPaths.push(...gitMarkers);
  return { externalPaths, gitMarkers, protectedPaths };
}

export async function collectPathSet(cwd: string, paths: readonly string[]): Promise<readonly DirtyPathRecord[]> {
  const records: DirtyPathRecord[] = [];
  for (const dependencyPath of [...new Set(paths)].sort((left, right) => left.localeCompare(right))) {
    records.push({ ...(await pathFingerprint(path.resolve(cwd, dependencyPath))), path: dependencyPath, status: "dependency" });
  }
  return records;
}

export function findPathSetDrift(
  before: readonly DirtyPathRecord[],
  after: readonly DirtyPathRecord[],
): readonly string[] {
  const beforeByPath = groupInventoryByPath(before);
  const afterByPath = groupInventoryByPath(after);
  return [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])]
    .filter((entry) => hashValue(beforeByPath.get(entry) ?? []) !== hashValue(afterByPath.get(entry) ?? []))
    .sort((left, right) => left.localeCompare(right));
}

export function parsePorcelainV2z(bytes: Uint8Array): readonly Pick<DirtyPathRecord, "path" | "status">[] {
  const fields = Buffer.from(bytes).toString("utf8").split("\0");
  const entries: Pick<DirtyPathRecord, "path" | "status">[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const line = fields[index];
    if (!line) continue;
    const kind = line[0];
    if (kind === "?" || kind === "!") {
      entries.push({ path: line.slice(2), status: kind });
      continue;
    }
    const metaCount = kind === "2" ? 9 : kind === "u" ? 10 : 8;
    const pathStart = nthSpaceIndex(line, metaCount);
    if (pathStart < 0) throw new Error(`Unsupported porcelain record: ${kind}`);
    entries.push({ path: line.slice(pathStart + 1), status: line.slice(0, 4) });
    if (kind === "2") {
      const original = fields[index + 1];
      if (original) entries.push({ path: original, status: "R.orig" });
      index += 1;
    }
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path) || left.status.localeCompare(right.status));
}

async function pathFingerprint(absolute: string): Promise<{ readonly bytes: number | null; readonly sha256: string | null }> {
  try {
    const stats = await lstat(absolute);
    if (stats.isSymbolicLink()) return { bytes: stats.size, sha256: sha256Bytes(await readFile(absolute, "utf8")) };
    if (!stats.isFile()) return { bytes: 0, sha256: sha256Bytes("DIRECTORY") };
    const hash = createHash("sha256");
    hash.update(await readFile(absolute));
    return { bytes: stats.size, sha256: hash.digest("hex") };
  } catch (error) {
    if (isMissing(error)) return { bytes: null, sha256: null };
    throw error;
  }
}

function groupInventoryByPath(inventory: readonly DirtyPathRecord[]): ReadonlyMap<string, readonly DirtyPathRecord[]> {
  const grouped = new Map<string, DirtyPathRecord[]>();
  for (const entry of inventory) grouped.set(entry.path, [...(grouped.get(entry.path) ?? []), entry]);
  return grouped;
}

function nthSpaceIndex(value: string, count: number): number {
  let found = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== " ") continue;
    found += 1;
    if (found === count) return index;
  }
  return -1;
}

function git(cwd: string, args: readonly string[], allowFailure = false): { readonly status: number; readonly stdout: Buffer } {
  const result = spawnSync("git", args, { cwd, encoding: "buffer", maxBuffer: 256 * 1024 * 1024 });
  const status = result.status ?? -1;
  if (!allowFailure && status !== 0) throw new Error(`git ${args[0]} failed with ${status}`);
  return { status, stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0) };
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
