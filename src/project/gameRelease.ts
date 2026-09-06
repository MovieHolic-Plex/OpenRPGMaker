import { sha256HexBytes, sha256HexText } from "../util/sha256";
import { parsePublication, PublicationError, type Publication } from "./publication";
import { readStoredZipEntry, readStoredZipEntryNames, writeStoredZip, type ZipEntry } from "./packageZip";
import { assertUniquePaths, compareContractPaths, contractPath, isRecord, parseFileRecords } from "./playerDeploymentPaths";
import type { DeploymentFileRecord } from "./playerDeploymentTypes";

export interface RuntimeManifest {
  readonly sentinel: "oprn/runtime-archive";
  readonly format: 1;
  readonly runtimeTarget: string;
  readonly projectSchema: 4;
  readonly saveSchemas: readonly [4, 5, 6];
  readonly collectorVersion: 1;
  readonly files: readonly DeploymentFileRecord[];
  readonly requiredAssets: readonly string[];
}
export interface GameReleaseManifest {
  readonly sentinel: "oprn/game-release";
  readonly format: 1;
  readonly releaseId: string;
  readonly publication: Publication;
  readonly project: "project.json";
  readonly entry: "player.html";
  readonly files: readonly DeploymentFileRecord[];
}
export class ReleaseError extends Error {
  constructor(readonly code: "invalid-release" | "integrity" | "untrusted-runtime") {
    super(code);
    this.name = "ReleaseError";
  }
}
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
export function jsonBytes(value: unknown): Uint8Array { return encoder.encode(JSON.stringify(value)); }

export async function inventoryEntries(entries: readonly ZipEntry[]): Promise<readonly DeploymentFileRecord[]> {
  assertUniquePaths(entries.map(entry => contractPath(entry.name)));
  return Promise.all([...entries].sort((a, b) => compareContractPaths(a.name, b.name)).map(async entry => ({
    path: entry.name, bytes: entry.bytes.length, sha256: await sha256HexBytes(entry.bytes),
  })));
}

export async function createRuntimeManifest(entries: readonly ZipEntry[], requiredAssets?: readonly string[]): Promise<RuntimeManifest> {
  const files = await inventoryEntries(entries);
  return runtimeManifestForFiles(files, requiredAssets);
}

export async function runtimeManifestForFiles(files: readonly DeploymentFileRecord[], requiredAssets?: readonly string[]): Promise<RuntimeManifest> {
  const body = { sentinel: "oprn/runtime-archive" as const, format: 1 as const, projectSchema: 4 as const,
    saveSchemas: [4, 5, 6] as const, collectorVersion: 1 as const, files: parseFileRecords(files),
    requiredAssets: [...(requiredAssets ?? files.filter(file => file.path.startsWith("public/")).map(file => file.path.slice(7)))].sort(compareContractPaths) };
  return { ...body, runtimeTarget: await sha256HexText(JSON.stringify(body)) };
}

export async function parseRuntimeManifest(value: unknown): Promise<RuntimeManifest> {
  if (!isRecord(value) || value.sentinel !== "oprn/runtime-archive" || value.format !== 1
    || value.projectSchema !== 4 || value.collectorVersion !== 1 || JSON.stringify(value.saveSchemas) !== "[4,5,6]"
    || typeof value.runtimeTarget !== "string" || !Array.isArray(value.requiredAssets)) throw new ReleaseError("untrusted-runtime");
  const files = parseFileRecords(value.files);
  const requiredAssets = value.requiredAssets.map(contractPath);
  assertUniquePaths(requiredAssets);
  if (requiredAssets.some(name => !files.some(file => file.path === `public/${name}`))) throw new ReleaseError("untrusted-runtime");
  const body = { sentinel: "oprn/runtime-archive" as const, format: 1 as const, projectSchema: 4 as const,
    saveSchemas: [4, 5, 6] as const, collectorVersion: 1 as const, files, requiredAssets };
  if (await sha256HexText(JSON.stringify(body)) !== value.runtimeTarget) throw new ReleaseError("integrity");
  return { ...body, runtimeTarget: value.runtimeTarget };
}

export async function createGameRelease(options: { readonly publication: Publication; readonly entries: readonly ZipEntry[] }) {
  const publication = parsePublication(options.publication);
  if (options.entries.some(entry => entry.name === "release.json")) throw new ReleaseError("invalid-release");
  const body = { sentinel: "oprn/game-release" as const, format: 1 as const, publication,
    project: "project.json" as const, entry: "player.html" as const, files: await inventoryEntries(options.entries) };
  const manifest: GameReleaseManifest = { ...body, releaseId: await sha256HexText(JSON.stringify(body)) };
  return { manifest, blob: writeStoredZip([...options.entries, { name: "release.json", bytes: jsonBytes(manifest) }]) };
}

export async function parseReleaseManifest(value: unknown): Promise<GameReleaseManifest> {
  if (!isRecord(value) || value.sentinel !== "oprn/game-release" || value.format !== 1
    || value.project !== "project.json" || value.entry !== "player.html" || typeof value.releaseId !== "string") throw new ReleaseError("invalid-release");
  const body = { sentinel: "oprn/game-release" as const, format: 1 as const, publication: parsePublication(value.publication),
    project: "project.json" as const, entry: "player.html" as const, files: parseFileRecords(value.files) };
  if (body.files.some(file => file.path === "release.json") || await sha256HexText(JSON.stringify(body)) !== value.releaseId) throw new ReleaseError("integrity");
  return { ...body, releaseId: value.releaseId };
}

export function releaseManifestFromZip(bytes: Uint8Array): unknown {
  const raw = readStoredZipEntry(bytes, "release.json");
  if (!raw) throw new ReleaseError("invalid-release");
  return JSON.parse(decoder.decode(raw));
}

/** The trusted manifest must come from operator-controlled storage, never the upload. */
export async function verifyGameRelease(bytes: Uint8Array, trusted: RuntimeManifest | undefined) {
  const manifest = await parseReleaseManifest(releaseManifestFromZip(bytes));
  if (!trusted || trusted.runtimeTarget !== manifest.publication.runtimeTarget) throw new ReleaseError("untrusted-runtime");
  await parseRuntimeManifest(trusted);
  const names = readStoredZipEntryNames(bytes);
  assertUniquePaths(names.map(contractPath));
  if (names.length !== manifest.files.length + 1) throw new ReleaseError("integrity");
  const entries = new Map<string, Uint8Array>();
  for (const record of manifest.files) {
    const payload = readStoredZipEntry(bytes, record.path);
    if (!payload || payload.length !== record.bytes || await sha256HexBytes(payload) !== record.sha256) throw new ReleaseError("integrity");
    entries.set(record.path, payload);
  }
  const trustedFiles = new Map(trusted.files.map(file => [file.path, file]));
  const required = [...trusted.files.filter(file => file.path.startsWith("web/")).map(file => file.path.slice(4)), ...trusted.requiredAssets];
  for (const name of required) {
    const expected = trustedFiles.get(`web/${name}`) ?? trustedFiles.get(`public/${name}`);
    const actual = manifest.files.find(file => file.path === name);
    if (!expected || !actual || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) throw new ReleaseError("untrusted-runtime");
  }
  for (const file of manifest.files) {
    if (file.path === "project.json" || required.includes(file.path)) continue;
    // Uploaded code never becomes same-origin executable content. SVG is served sandboxed.
    if (!/\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|mp4|webm|ogv|woff2?|ttf|json)$/i.test(file.path)) throw new ReleaseError("untrusted-runtime");
  }
  const projectBytes = entries.get("project.json");
  if (!projectBytes) throw new ReleaseError("invalid-release");
  const project: unknown = JSON.parse(decoder.decode(projectBytes));
  if (!isRecord(project) || project.version !== trusted.projectSchema || !isRecord(project.meta)
    || JSON.stringify(parsePublication(project.meta.publication)) !== JSON.stringify(manifest.publication)) throw new PublicationError("invalid-publication");
  return { manifest, entries };
}
