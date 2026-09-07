import { crc32 } from "node:zlib";
import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { COMMUNITY_SAVE_ISOLATION_CAPABILITY, PROJECT_DEPENDENCY_CLOSURE_CAPABILITY, parseReleaseManifest, parseRuntimeManifest, verifyGameRelease, type GameReleaseManifest, type RuntimeManifest } from "../../src/project/gameRelease";
import { RELEASE_COLLECTOR_FILE, type ReleaseDependencyCollector } from "../../src/project/releaseDependencies";
import { assertUniquePaths, contractPath, isRecord } from "../../src/project/playerDeploymentPaths";

export const MAX_RELEASE_BYTES = 96 * 1024 * 1024;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_FILES = 4096;
const decoder = new TextDecoder("utf-8", { fatal: true });

export class ReleaseUploadError extends Error {
  constructor(readonly code: "invalid-release" | "too-large" | "runtime-unavailable") {
    super(code);
    this.name = "ReleaseUploadError";
  }
}

/** Only the editor stored-ZIP format is accepted; no inflation or ambiguous ZIP views. */
export function readReleaseEntries(bytes: Buffer): ReadonlyMap<string, Uint8Array> {
  if (bytes.length > MAX_RELEASE_BYTES) throw new ReleaseUploadError("too-large");
  const invalid = () => { throw new ReleaseUploadError("invalid-release"); };
  if (bytes.length < 22) return invalid();
  const end = bytes.length - 22;
  if (bytes.readUInt32LE(end) !== 0x06054b50 || bytes.readUInt16LE(end + 20) !== 0
    || bytes.readUInt32LE(end + 4) !== 0) return invalid();
  const count = bytes.readUInt16LE(end + 10);
  const centralStart = bytes.readUInt32LE(end + 16);
  if (!count || count > MAX_FILES || bytes.readUInt16LE(end + 8) !== count
    || centralStart + bytes.readUInt32LE(end + 12) !== end) return invalid();
  const entries = new Map<string, Uint8Array>();
  let central = centralStart;
  let local = 0;
  for (let index = 0; index < count; index++) {
    if (central + 46 > end || bytes.readUInt32LE(central) !== 0x02014b50) return invalid();
    const size = bytes.readUInt32LE(central + 24);
    const nameSize = bytes.readUInt16LE(central + 28);
    if (size > MAX_FILE_BYTES) throw new ReleaseUploadError("too-large");
    if (!nameSize || nameSize > 1024 || central + 46 + nameSize > end
      || bytes.readUInt16LE(central + 8) !== 0x0800 || bytes.readUInt16LE(central + 10) !== 0
      || bytes.readUInt32LE(central + 20) !== size || bytes.readUInt32LE(central + 30) !== 0
      || bytes.readUInt32LE(central + 34) !== 0 || bytes.readUInt32LE(central + 38) !== 0
      || bytes.readUInt32LE(central + 42) !== local
      || local + 30 + nameSize + size > centralStart || bytes.readUInt32LE(local) !== 0x04034b50
      || bytes.readUInt16LE(local + 6) !== 0x0800 || bytes.readUInt16LE(local + 8) !== 0
      || bytes.readUInt32LE(local + 18) !== size || bytes.readUInt32LE(local + 22) !== size
      || bytes.readUInt16LE(local + 26) !== nameSize || bytes.readUInt16LE(local + 28) !== 0
      || bytes.readUInt32LE(local + 14) !== bytes.readUInt32LE(central + 16)) return invalid();
    const nameBytes = bytes.subarray(central + 46, central + 46 + nameSize);
    if (!nameBytes.equals(bytes.subarray(local + 30, local + 30 + nameSize))) return invalid();
    const name = contractPath(decoder.decode(nameBytes));
    if (/[\x00-\x1f\x7f?#]/u.test(name) || entries.has(name)) return invalid();
    const payload = bytes.subarray(local + 30 + nameSize, local + 30 + nameSize + size);
    if (crc32(payload) !== bytes.readUInt32LE(central + 16)) return invalid();
    entries.set(name, payload);
    local += 30 + nameSize + size;
    central += 46 + nameSize;
  }
  if (central !== end || local !== centralStart) return invalid();
  assertUniquePaths([...entries.keys()]);
  const manifest = entries.get("release.json");
  if (!manifest || manifest.length > 1024 * 1024) return invalid();
  return entries;
}

export type RetainedRelease = {
  readonly bytes: Buffer;
  readonly manifest: GameReleaseManifest;
  readonly entries: ReadonlyMap<string, Uint8Array>;
};

export interface OperatorRuntime extends RuntimeManifest {
  readonly collectDependencies?: ReleaseDependencyCollector;
}

/** Call only with operator-controlled bytes. The upload is never a code source. */
export async function operatorRuntimeWithCollector(manifest: RuntimeManifest, collectorBytes: Uint8Array): Promise<OperatorRuntime> {
  await parseRuntimeManifest(manifest);
  const proof = manifest.files.find(file => file.path === `web/${RELEASE_COLLECTOR_FILE}`);
  if (!proof || collectorBytes.length !== proof.bytes || collectorBytes.length > 4 * 1024 * 1024
    || createHash("sha256").update(collectorBytes).digest("hex") !== proof.sha256) throw new ReleaseUploadError("runtime-unavailable");
  const source = decoder.decode(collectorBytes);
  return { ...manifest, collectDependencies: projectJson => runInNewContext(
    `${source}\nOPRN_RELEASE_COLLECTOR.collectReleaseDependencies(projectJson)`,
    { projectJson, TextEncoder, TextDecoder, atob },
    { timeout: 5000, contextCodeGeneration: { strings: false, wasm: false } },
  ) };
}

export async function loadOperatorRuntime(target: string): Promise<OperatorRuntime> {
  if (!/^[a-f0-9]{64}$/.test(target)) throw new ReleaseUploadError("runtime-unavailable");
  const root = process.env.COMMUNITY_RUNTIME_ARCHIVE_ROOT ?? path.resolve(process.cwd(), "..", ".runtime-archive");
  const file = await open(path.join(root, target, "runtime.json"), "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new ReleaseUploadError("runtime-unavailable");
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== stat.size) throw new ReleaseUploadError("runtime-unavailable");
    const manifest = await parseRuntimeManifest(JSON.parse(decoder.decode(bytes.subarray(0, bytesRead))));
    if (manifest.runtimeTarget !== target) throw new ReleaseUploadError("runtime-unavailable");
    if (manifest.collectorVersion !== 2) return manifest;
    const collector = await open(path.join(root, target, "web", RELEASE_COLLECTOR_FILE), "r");
    try {
      const stat = await collector.stat();
      if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw new ReleaseUploadError("runtime-unavailable");
      const bytes = Buffer.alloc(stat.size + 1);
      const { bytesRead } = await collector.read(bytes, 0, bytes.length, 0);
      if (bytesRead !== stat.size) throw new ReleaseUploadError("runtime-unavailable");
      return await operatorRuntimeWithCollector(manifest, bytes.subarray(0, bytesRead));
    } finally { await collector.close(); }
  } finally { await file.close(); }
}

export async function validateReleaseArchive(bytes: Buffer, loadRuntime = loadOperatorRuntime): Promise<RetainedRelease> {
  const entries = readReleaseEntries(bytes);
  const manifest = await manifestFromEntries(entries);
  let trusted: OperatorRuntime;
  try { trusted = await loadRuntime(manifest.publication.runtimeTarget); }
  catch { throw new ReleaseUploadError("runtime-unavailable"); }
  if (!trusted.capabilities?.includes(COMMUNITY_SAVE_ISOLATION_CAPABILITY)
    || !trusted.capabilities.includes(PROJECT_DEPENDENCY_CLOSURE_CAPABILITY) || trusted.collectorVersion !== 2) throw new ReleaseUploadError("runtime-unavailable");
  await verifyGameRelease(bytes, trusted, trusted.collectDependencies);
  const project: unknown = JSON.parse(decoder.decode(entries.get("project.json")));
  if (!isRecord(project) || project.version !== trusted.projectSchema) throw new ReleaseUploadError("invalid-release");
  return { bytes, manifest, entries };
}

export async function manifestFromEntries(entries: ReadonlyMap<string, Uint8Array>): Promise<GameReleaseManifest> {
  const value = entries.get("release.json");
  if (!value) throw new ReleaseUploadError("invalid-release");
  return parseReleaseManifest(JSON.parse(decoder.decode(value)));
}

export function releaseZipDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
