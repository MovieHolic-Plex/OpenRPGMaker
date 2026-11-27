// Git-friendly deterministic text-tree serializer / deserializer for OPRN Studio projects.
//
// Pure TypeScript with type-only imports so it runs identically in browsers, tests,
// and Node 24 CLI scripts (`scripts/project-git-sync.mjs`) with zero extra dependencies.

import type { Project } from "./types/project";
import type { ScriptModule } from "./script/types";

export const GIT_SYNC_FORMAT_VERSION = 1 as const;

export const GIT_SYNC_FORMAT_FILE = "oprn-git-format.json";
export const GIT_SYNC_META_FILE = "meta.json";
export const GIT_SYNC_SYSTEM_FILE = "system.json";
export const GIT_SYNC_VARS_SWITCHES_FILE = "variables-switches.json";
export const GIT_SYNC_ROOT_FILE = "project-root.json";
export const GIT_SYNC_ASSETS_MANIFEST_FILE = "assets/manifest.json";
export const GIT_SYNC_COMMON_EVENTS_FILE = "database/commonEvents.json";
export const GIT_SYNC_QUESTS_FILE = "database/quests.json";

export interface GitSyncScriptEntry {
  readonly id: string;
  readonly sourceFile: string;
  readonly metaFile: string;
}

export interface GitSyncManifest {
  readonly databaseFiles: Readonly<Record<string, string>>;
  readonly hasCommonEvents: boolean;
  readonly hasQuests: boolean;
  readonly hasScriptLibrary: boolean;
  readonly maps: Readonly<Record<string, string>>;
  readonly tilesets: Readonly<Record<string, string>>;
  readonly scripts: readonly GitSyncScriptEntry[];
  readonly inlineAssetFiles: Readonly<Record<string, string>>;
}

export interface GitSyncFormatHeader {
  readonly formatVersion: typeof GIT_SYNC_FORMAT_VERSION;
  readonly projectVersion: number;
  readonly projectId?: string;
  readonly manifest: GitSyncManifest;
}

export interface UnpackProjectOptions {
  readonly projectId?: string;
}

export interface GitSyncValidationIssue {
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly message: string;
}

export interface GitSyncValidationResult {
  readonly ok: boolean;
  readonly projectId?: string;
  readonly projectVersion?: number;
  readonly counts: {
    readonly maps: number;
    readonly tilesets: number;
    readonly databaseKinds: number;
    readonly scripts: number;
    readonly uploadedAssets: number;
  };
  readonly errors: readonly GitSyncValidationIssue[];
  readonly warnings: readonly GitSyncValidationIssue[];
}

export type TextFileMap = Record<string, string>;
export type TextFileInput = Readonly<Record<string, string>> | ReadonlyMap<string, string>;

const EXTRACTED_ROOT_KEYS = new Set<string>([
  "meta",
  "system",
  "switches",
  "variables",
  "flags",
  "storyFlags",
  "database",
  "commonEvents",
  "quests",
  "maps",
  "tilesets",
  "scriptLibrary",
  "assets",
  "resourceProfiles",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively clones JSON-compatible values with lexicographically sorted object keys.
 * Undefined object entries are omitted to match JSON.stringify semantics; array order is preserved.
 */
export function stableSortValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stableSortValue(item)));
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const entry = record[key];
    if (entry === undefined || typeof entry === "function" || typeof entry === "symbol") continue;
    sorted[key] = stableSortValue(entry);
  }
  return sorted;
}

/** Deterministic 2-space pretty JSON with sorted keys and trailing newline for minimal Git diffs. */
export function stablePrettyJson(value: unknown): string {
  return `${JSON.stringify(stableSortValue(value), null, 2)}\n`;
}

function sanitizeFileSegment(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/gu, "_").replace(/^\.+|\.+$/gu, "");
  if (!cleaned || cleaned === "." || cleaned === "..") return fallback;
  return cleaned.slice(0, 120);
}

function allocateUniquePath(
  dirPrefix: string,
  rawId: string,
  extension: string,
  usedPaths: Set<string>,
  fallback: string,
): string {
  const base = sanitizeFileSegment(rawId, fallback);
  let candidate = `${dirPrefix}/${base}${extension}`;
  let suffix = 2;
  while (usedPaths.has(candidate)) {
    candidate = `${dirPrefix}/${base}__${suffix}${extension}`;
    suffix += 1;
  }
  usedPaths.add(candidate);
  return candidate;
}

function normalizeInputFiles(input: TextFileInput): Map<string, string> {
  const map = new Map<string, string>();
  const entries = input instanceof Map ? Array.from(input.entries()) : Object.entries(input);
  for (const [rawPath, content] of entries) {
    const normalized = rawPath.replace(/\\/gu, "/").replace(/^\.\/+/u, "");
    map.set(normalized, content);
  }
  return map;
}

function parseJsonFile(files: ReadonlyMap<string, string>, filePath: string): unknown {
  const raw = files.get(filePath);
  if (raw === undefined) {
    throw new Error(`Missing required project file: ${filePath}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Unpacks a single OPRN Studio `Project` object into a deterministic, Git-diff-friendly
 * text file tree (`relativePath -> utf8Content`).
 */
export function unpackProjectToTextFiles(project: Project, options?: UnpackProjectOptions): TextFileMap {
  // Normalize through JSON semantics once so undefined properties match serialized Project equality.
  const normalized = JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
  const rawFiles: Record<string, string> = {};

  rawFiles[GIT_SYNC_META_FILE] = stablePrettyJson(normalized.meta ?? {});
  rawFiles[GIT_SYNC_SYSTEM_FILE] = stablePrettyJson(normalized.system ?? {});

  const varsAndSwitches: Record<string, unknown> = {
    switches: normalized.switches ?? [],
    variables: normalized.variables ?? [],
    flags: normalized.flags ?? {},
  };
  if (Object.prototype.hasOwnProperty.call(normalized, "storyFlags")) {
    varsAndSwitches.storyFlags = normalized.storyFlags;
  }
  rawFiles[GIT_SYNC_VARS_SWITCHES_FILE] = stablePrettyJson(varsAndSwitches);

  // Database kinds split into database/<kind>.json
  const databaseFiles: Record<string, string> = {};
  const usedDatabasePaths = new Set<string>([GIT_SYNC_COMMON_EVENTS_FILE, GIT_SYNC_QUESTS_FILE]);
  const dbRecord = isPlainRecord(normalized.database) ? normalized.database : {};
  for (const kind of Object.keys(dbRecord).sort()) {
    const filePath = allocateUniquePath("database", kind, ".json", usedDatabasePaths, "db");
    databaseFiles[kind] = filePath;
    rawFiles[filePath] = stablePrettyJson(dbRecord[kind]);
  }

  const hasCommonEvents = Object.prototype.hasOwnProperty.call(normalized, "commonEvents");
  if (hasCommonEvents) {
    rawFiles[GIT_SYNC_COMMON_EVENTS_FILE] = stablePrettyJson(normalized.commonEvents);
  }

  const hasQuests = Object.prototype.hasOwnProperty.call(normalized, "quests");
  if (hasQuests) {
    rawFiles[GIT_SYNC_QUESTS_FILE] = stablePrettyJson(normalized.quests);
  }

  // Maps split into independent maps/<mapId>.json files
  const mapManifest: Record<string, string> = {};
  const usedMapPaths = new Set<string>();
  const mapsRecord = isPlainRecord(normalized.maps) ? normalized.maps : {};
  for (const mapId of Object.keys(mapsRecord).sort()) {
    const filePath = allocateUniquePath("maps", mapId, ".json", usedMapPaths, "map");
    mapManifest[mapId] = filePath;
    rawFiles[filePath] = stablePrettyJson(mapsRecord[mapId]);
  }

  // Tilesets split into independent tilesets/<tilesetId>.json files
  const tilesetManifest: Record<string, string> = {};
  const usedTilesetPaths = new Set<string>();
  const tilesetsRecord = isPlainRecord(normalized.tilesets) ? normalized.tilesets : {};
  for (const tilesetId of Object.keys(tilesetsRecord).sort()) {
    const filePath = allocateUniquePath("tilesets", tilesetId, ".json", usedTilesetPaths, "tileset");
    tilesetManifest[tilesetId] = filePath;
    rawFiles[filePath] = stablePrettyJson(tilesetsRecord[tilesetId]);
  }

  // Script library extracted to real .ts files (+ .meta.json for compiled/effects/hashes)
  const hasScriptLibrary = Object.prototype.hasOwnProperty.call(normalized, "scriptLibrary");
  const scriptEntries: GitSyncScriptEntry[] = [];
  if (hasScriptLibrary && Array.isArray(normalized.scriptLibrary)) {
    const usedScriptPaths = new Set<string>();
    for (const rawModule of normalized.scriptLibrary) {
      if (!isPlainRecord(rawModule)) continue;
      const id = typeof rawModule.id === "string" ? rawModule.id : `script_${scriptEntries.length}`;
      const source = typeof rawModule.source === "string" ? rawModule.source : "";
      const sourceFile = allocateUniquePath("scripts", id, ".ts", usedScriptPaths, "script");
      const metaFile = sourceFile.replace(/\.ts$/u, ".meta.json");
      usedScriptPaths.add(metaFile);

      const metaCopy: Record<string, unknown> = {};
      for (const key of Object.keys(rawModule).sort()) {
        if (key === "source") continue;
        metaCopy[key] = rawModule[key];
      }
      rawFiles[sourceFile] = source;
      rawFiles[metaFile] = stablePrettyJson(metaCopy);
      scriptEntries.push({ id, sourceFile, metaFile });
    }
  }

  // Assets manifest + separated inline dataUrls
  const assetsRecord = isPlainRecord(normalized.assets) ? normalized.assets : {};
  const uploadedRecord = isPlainRecord(assetsRecord.uploaded) ? assetsRecord.uploaded : {};
  const inlineAssetFiles: Record<string, string> = {};
  const usedInlinePaths = new Set<string>();
  const uploadedManifest: Record<string, unknown> = {};

  for (const assetId of Object.keys(uploadedRecord).sort()) {
    const rawAsset = uploadedRecord[assetId];
    if (!isPlainRecord(rawAsset)) {
      uploadedManifest[assetId] = rawAsset;
      continue;
    }
    const assetCopy: Record<string, unknown> = {};
    for (const key of Object.keys(rawAsset).sort()) {
      if (key === "dataUrl") continue;
      assetCopy[key] = rawAsset[key];
    }
    if (typeof rawAsset.dataUrl === "string") {
      const dataFile = allocateUniquePath("assets/inline", assetId, ".dataurl", usedInlinePaths, "asset");
      inlineAssetFiles[assetId] = dataFile;
      rawFiles[dataFile] = rawAsset.dataUrl;
    }
    uploadedManifest[assetId] = assetCopy;
  }

  const assetsManifestPayload: Record<string, unknown> = {
    sprites: assetsRecord.sprites ?? {},
    uploaded: uploadedManifest,
  };
  // Preserve any extra keys on `assets` if present
  for (const key of Object.keys(assetsRecord).sort()) {
    if (key === "sprites" || key === "uploaded") continue;
    assetsManifestPayload[key] = assetsRecord[key];
  }
  if (Object.prototype.hasOwnProperty.call(normalized, "resourceProfiles")) {
    assetsManifestPayload.resourceProfiles = normalized.resourceProfiles;
  }
  rawFiles[GIT_SYNC_ASSETS_MANIFEST_FILE] = stablePrettyJson(assetsManifestPayload);

  // Remaining root fields so no optional or future Project field is ever lost
  const rootRemainder: Record<string, unknown> = {};
  for (const key of Object.keys(normalized).sort()) {
    if (EXTRACTED_ROOT_KEYS.has(key)) continue;
    rootRemainder[key] = normalized[key];
  }
  rawFiles[GIT_SYNC_ROOT_FILE] = stablePrettyJson(rootRemainder);

  const header: GitSyncFormatHeader = {
    formatVersion: GIT_SYNC_FORMAT_VERSION,
    projectVersion: typeof normalized.version === "number" ? normalized.version : 4,
    ...(options?.projectId ? { projectId: options.projectId } : {}),
    manifest: {
      databaseFiles,
      hasCommonEvents,
      hasQuests,
      hasScriptLibrary,
      maps: mapManifest,
      tilesets: tilesetManifest,
      scripts: scriptEntries,
      inlineAssetFiles,
    },
  };
  rawFiles[GIT_SYNC_FORMAT_FILE] = stablePrettyJson(header);

  // Return files in deterministic sorted key order
  const ordered: TextFileMap = {};
  for (const filePath of Object.keys(rawFiles).sort()) {
    ordered[filePath] = rawFiles[filePath]!;
  }
  return ordered;
}

/**
 * Reassembles a `Project` from the text file tree produced by `unpackProjectToTextFiles`.
 * Guarantees 100% lossless deep-equality roundtrip for unchanged trees, and also picks up
 * newly added map/tileset/script files created by teammates in Git branches.
 */
export function packTextFilesToProject(input: TextFileInput): Project {
  const files = normalizeInputFiles(input);
  const rawHeader = parseJsonFile(files, GIT_SYNC_FORMAT_FILE);
  if (!isPlainRecord(rawHeader)) {
    throw new Error(`${GIT_SYNC_FORMAT_FILE} must be a JSON object`);
  }
  if (rawHeader.formatVersion !== GIT_SYNC_FORMAT_VERSION) {
    throw new Error(`Unsupported oprn-git-format version: ${String(rawHeader.formatVersion)} (expected ${GIT_SYNC_FORMAT_VERSION})`);
  }
  const manifest = isPlainRecord(rawHeader.manifest) ? (rawHeader.manifest as unknown as GitSyncManifest) : undefined;
  if (!manifest) {
    throw new Error(`${GIT_SYNC_FORMAT_FILE} is missing manifest`);
  }

  const rootRemainder = parseJsonFile(files, GIT_SYNC_ROOT_FILE);
  if (!isPlainRecord(rootRemainder)) {
    throw new Error(`${GIT_SYNC_ROOT_FILE} must be a JSON object`);
  }
  const project: Record<string, unknown> = { ...rootRemainder };

  project.meta = parseJsonFile(files, GIT_SYNC_META_FILE);
  project.system = parseJsonFile(files, GIT_SYNC_SYSTEM_FILE);

  const varsAndSwitches = parseJsonFile(files, GIT_SYNC_VARS_SWITCHES_FILE);
  if (!isPlainRecord(varsAndSwitches)) {
    throw new Error(`${GIT_SYNC_VARS_SWITCHES_FILE} must be a JSON object`);
  }
  project.switches = varsAndSwitches.switches ?? [];
  project.variables = varsAndSwitches.variables ?? [];
  project.flags = varsAndSwitches.flags ?? {};
  if (Object.prototype.hasOwnProperty.call(varsAndSwitches, "storyFlags")) {
    project.storyFlags = varsAndSwitches.storyFlags;
  }

  // Reassemble database
  const database: Record<string, unknown> = {};
  const consumedDatabaseFiles = new Set<string>([GIT_SYNC_COMMON_EVENTS_FILE, GIT_SYNC_QUESTS_FILE]);
  const databaseFiles = isPlainRecord(manifest.databaseFiles) ? manifest.databaseFiles : {};
  for (const [kind, filePath] of Object.entries(databaseFiles)) {
    if (typeof filePath !== "string") continue;
    consumedDatabaseFiles.add(filePath);
    database[kind] = parseJsonFile(files, filePath);
  }
  // Discover any extra database/<kind>.json added directly in Git
  for (const filePath of Array.from(files.keys()).sort()) {
    if (!filePath.startsWith("database/") || !filePath.endsWith(".json") || consumedDatabaseFiles.has(filePath)) continue;
    const kind = filePath.slice("database/".length, -".json".length);
    if (kind && !Object.prototype.hasOwnProperty.call(database, kind)) {
      database[kind] = parseJsonFile(files, filePath);
    }
  }
  project.database = database;

  if (manifest.hasCommonEvents || files.has(GIT_SYNC_COMMON_EVENTS_FILE)) {
    project.commonEvents = parseJsonFile(files, GIT_SYNC_COMMON_EVENTS_FILE);
  }
  if (manifest.hasQuests || files.has(GIT_SYNC_QUESTS_FILE)) {
    project.quests = parseJsonFile(files, GIT_SYNC_QUESTS_FILE);
  }

  // Reassemble maps
  const maps: Record<string, unknown> = {};
  const consumedMapFiles = new Set<string>();
  const mapManifest = isPlainRecord(manifest.maps) ? manifest.maps : {};
  for (const [mapId, filePath] of Object.entries(mapManifest)) {
    if (typeof filePath !== "string") continue;
    consumedMapFiles.add(filePath);
    maps[mapId] = parseJsonFile(files, filePath);
  }
  for (const filePath of Array.from(files.keys()).sort()) {
    if (!filePath.startsWith("maps/") || !filePath.endsWith(".json") || consumedMapFiles.has(filePath)) continue;
    const parsed = parseJsonFile(files, filePath);
    const id = isPlainRecord(parsed) && typeof parsed.id === "string" && parsed.id
      ? parsed.id
      : filePath.slice("maps/".length, -".json".length);
    if (!Object.prototype.hasOwnProperty.call(maps, id)) {
      maps[id] = parsed;
    }
  }
  project.maps = maps;

  // Reassemble tilesets
  const tilesets: Record<string, unknown> = {};
  const consumedTilesetFiles = new Set<string>();
  const tilesetManifest = isPlainRecord(manifest.tilesets) ? manifest.tilesets : {};
  for (const [tilesetId, filePath] of Object.entries(tilesetManifest)) {
    if (typeof filePath !== "string") continue;
    consumedTilesetFiles.add(filePath);
    tilesets[tilesetId] = parseJsonFile(files, filePath);
  }
  for (const filePath of Array.from(files.keys()).sort()) {
    if (!filePath.startsWith("tilesets/") || !filePath.endsWith(".json") || consumedTilesetFiles.has(filePath)) continue;
    const parsed = parseJsonFile(files, filePath);
    const id = isPlainRecord(parsed) && typeof parsed.id === "string" && parsed.id
      ? parsed.id
      : filePath.slice("tilesets/".length, -".json".length);
    if (!Object.prototype.hasOwnProperty.call(tilesets, id)) {
      tilesets[id] = parsed;
    }
  }
  project.tilesets = tilesets;

  // Reassemble scriptLibrary from scripts/<id>.ts + scripts/<id>.meta.json
  const scriptList: ScriptModule[] = [];
  const consumedScriptFiles = new Set<string>();
  const manifestScripts = Array.isArray(manifest.scripts) ? manifest.scripts : [];
  for (const entry of manifestScripts) {
    if (!isPlainRecord(entry)) continue;
    const sourceFile = typeof entry.sourceFile === "string" ? entry.sourceFile : "";
    const metaFile = typeof entry.metaFile === "string" ? entry.metaFile : "";
    if (!sourceFile || !metaFile) continue;
    consumedScriptFiles.add(sourceFile);
    consumedScriptFiles.add(metaFile);

    const source = files.get(sourceFile);
    if (source === undefined) {
      throw new Error(`Missing script source file: ${sourceFile}`);
    }
    const meta = parseJsonFile(files, metaFile);
    if (!isPlainRecord(meta)) {
      throw new Error(`${metaFile} must be a JSON object`);
    }
    scriptList.push({
      ...meta,
      source,
    } as unknown as ScriptModule);
  }
  // Discover any extra scripts/*.ts added directly in Git
  for (const filePath of Array.from(files.keys()).sort()) {
    if (!filePath.startsWith("scripts/") || !filePath.endsWith(".ts") || consumedScriptFiles.has(filePath)) continue;
    const source = files.get(filePath) ?? "";
    const metaFile = filePath.replace(/\.ts$/u, ".meta.json");
    const fallbackId = filePath.slice("scripts/".length, -".ts".length);
    if (files.has(metaFile)) {
      const meta = parseJsonFile(files, metaFile);
      if (isPlainRecord(meta)) {
        scriptList.push({ ...meta, source } as unknown as ScriptModule);
        continue;
      }
    }
    scriptList.push({
      id: fallbackId,
      source,
      compiled: "",
    });
  }
  if (manifest.hasScriptLibrary || scriptList.length > 0) {
    project.scriptLibrary = scriptList;
  }

  // Reassemble assets + resourceProfiles
  const assetsManifest = parseJsonFile(files, GIT_SYNC_ASSETS_MANIFEST_FILE);
  if (!isPlainRecord(assetsManifest)) {
    throw new Error(`${GIT_SYNC_ASSETS_MANIFEST_FILE} must be a JSON object`);
  }
  const inlineAssetFiles = isPlainRecord(manifest.inlineAssetFiles) ? manifest.inlineAssetFiles : {};
  const rawUploaded = isPlainRecord(assetsManifest.uploaded) ? assetsManifest.uploaded : {};
  const uploaded: Record<string, unknown> = {};
  for (const [assetId, rawAsset] of Object.entries(rawUploaded)) {
    if (!isPlainRecord(rawAsset)) {
      uploaded[assetId] = rawAsset;
      continue;
    }
    const restored: Record<string, unknown> = { ...rawAsset };
    const inlineFile = inlineAssetFiles[assetId];
    if (typeof inlineFile === "string") {
      const dataUrl = files.get(inlineFile);
      if (dataUrl === undefined) {
        throw new Error(`Missing inline asset data file: ${inlineFile}`);
      }
      restored.dataUrl = dataUrl;
    }
    uploaded[assetId] = restored;
  }

  const assetsObj: Record<string, unknown> = {
    sprites: assetsManifest.sprites ?? {},
    uploaded,
  };
  for (const [key, value] of Object.entries(assetsManifest)) {
    if (key === "sprites" || key === "uploaded" || key === "resourceProfiles") continue;
    assetsObj[key] = value;
  }
  project.assets = assetsObj;
  if (Object.prototype.hasOwnProperty.call(assetsManifest, "resourceProfiles")) {
    project.resourceProfiles = assetsManifest.resourceProfiles;
  }

  return project as unknown as Project;
}

function collectMapTreeIds(node: unknown, out: string[]): void {
  if (!isPlainRecord(node)) return;
  if (node.kind !== "folder" && typeof node.mapId === "string" && node.mapId) {
    out.push(node.mapId);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectMapTreeIds(child, out);
  }
}

function djb2SourceHash(source: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = (Math.imul(h2, 33) + code) | 0;
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Validates an unpacked Git project directory's integrity:
 * format header, JSON syntax, map/tileset/script cross-references, stale compiled scripts, and lossless packability.
 */
export function validateUnpackedProjectFiles(input: TextFileInput): GitSyncValidationResult {
  const files = normalizeInputFiles(input);
  const errors: GitSyncValidationIssue[] = [];
  const warnings: GitSyncValidationIssue[] = [];

  let projectId: string | undefined;
  let projectVersion: number | undefined;

  if (!files.has(GIT_SYNC_FORMAT_FILE)) {
    errors.push({ severity: "error", path: GIT_SYNC_FORMAT_FILE, message: "Missing oprn-git-format.json header." });
    return {
      ok: false,
      counts: { maps: 0, tilesets: 0, databaseKinds: 0, scripts: 0, uploadedAssets: 0 },
      errors,
      warnings,
    };
  }

  let header: Record<string, unknown> | undefined;
  try {
    const parsed = parseJsonFile(files, GIT_SYNC_FORMAT_FILE);
    if (!isPlainRecord(parsed)) {
      errors.push({ severity: "error", path: GIT_SYNC_FORMAT_FILE, message: "Header must be a JSON object." });
    } else {
      header = parsed;
      if (typeof parsed.projectId === "string") projectId = parsed.projectId;
      if (typeof parsed.projectVersion === "number") projectVersion = parsed.projectVersion;
      if (parsed.formatVersion !== GIT_SYNC_FORMAT_VERSION) {
        errors.push({
          severity: "error",
          path: GIT_SYNC_FORMAT_FILE,
          message: `Unsupported formatVersion: ${String(parsed.formatVersion)}`,
        });
      }
    }
  } catch (error) {
    errors.push({
      severity: "error",
      path: GIT_SYNC_FORMAT_FILE,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  let packed: Project | undefined;
  if (errors.length === 0) {
    try {
      packed = packTextFilesToProject(files);
    } catch (error) {
      errors.push({
        severity: "error",
        path: GIT_SYNC_FORMAT_FILE,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!packed) {
    return {
      ok: false,
      projectId,
      projectVersion,
      counts: { maps: 0, tilesets: 0, databaseKinds: 0, scripts: 0, uploadedAssets: 0 },
      errors,
      warnings,
    };
  }

  const maps = isPlainRecord(packed.maps) ? packed.maps : {};
  const tilesets = isPlainRecord(packed.tilesets) ? packed.tilesets : {};
  const database = isPlainRecord(packed.database) ? packed.database : {};
  const scripts = Array.isArray(packed.scriptLibrary) ? packed.scriptLibrary : [];
  const uploaded = isPlainRecord(packed.assets?.uploaded) ? packed.assets.uploaded : {};

  // Check startMapId
  if (typeof packed.startMapId === "string" && packed.startMapId && !Object.prototype.hasOwnProperty.call(maps, packed.startMapId)) {
    errors.push({
      severity: "error",
      path: GIT_SYNC_ROOT_FILE,
      message: `startMapId "${packed.startMapId}" does not exist in maps/`,
    });
  }

  // Check each map's id and tilesetId reference
  const manifestMaps = isPlainRecord(header?.manifest) && isPlainRecord(header.manifest.maps) ? header.manifest.maps : {};
  for (const [mapId, mapValue] of Object.entries(maps)) {
    const filePath = typeof manifestMaps[mapId] === "string" ? String(manifestMaps[mapId]) : `maps/${mapId}.json`;
    if (!isPlainRecord(mapValue)) {
      errors.push({ severity: "error", path: filePath, message: `Map "${mapId}" must be an object.` });
      continue;
    }
    if (mapValue.id !== mapId) {
      errors.push({
        severity: "error",
        path: filePath,
        message: `Map id mismatch: manifest key "${mapId}" vs file id "${String(mapValue.id)}"`,
      });
    }
    if (typeof mapValue.tilesetId === "string" && mapValue.tilesetId && !Object.prototype.hasOwnProperty.call(tilesets, mapValue.tilesetId)) {
      errors.push({
        severity: "error",
        path: filePath,
        message: `Map "${mapId}" references missing tilesetId "${mapValue.tilesetId}"`,
      });
    }
  }

  // Check mapTree references
  const treeMapIds: string[] = [];
  collectMapTreeIds(packed.mapTree, treeMapIds);
  for (const treeMapId of treeMapIds) {
    if (!Object.prototype.hasOwnProperty.call(maps, treeMapId)) {
      errors.push({
        severity: "error",
        path: GIT_SYNC_ROOT_FILE,
        message: `mapTree references missing map "${treeMapId}"`,
      });
    }
  }

  // Check each tileset's id consistency
  const manifestTilesets = isPlainRecord(header?.manifest) && isPlainRecord(header.manifest.tilesets) ? header.manifest.tilesets : {};
  for (const [tilesetId, tilesetValue] of Object.entries(tilesets)) {
    const filePath = typeof manifestTilesets[tilesetId] === "string" ? String(manifestTilesets[tilesetId]) : `tilesets/${tilesetId}.json`;
    if (!isPlainRecord(tilesetValue)) {
      errors.push({ severity: "error", path: filePath, message: `Tileset "${tilesetId}" must be an object.` });
      continue;
    }
    if (tilesetValue.id !== tilesetId) {
      errors.push({
        severity: "error",
        path: filePath,
        message: `Tileset id mismatch: manifest key "${tilesetId}" vs file id "${String(tilesetValue.id)}"`,
      });
    }
  }

  // Check scripts for duplicate IDs or stale sourceHash (source edited directly in IDE without recompile)
  const seenScriptIds = new Set<string>();
  for (const mod of scripts) {
    if (!mod || typeof mod.id !== "string" || !mod.id) {
      errors.push({ severity: "error", path: "scripts/", message: "Script module is missing a valid id." });
      continue;
    }
    if (seenScriptIds.has(mod.id)) {
      errors.push({ severity: "error", path: `scripts/${mod.id}.ts`, message: `Duplicate script module id "${mod.id}"` });
    }
    seenScriptIds.add(mod.id);
    if (typeof mod.sourceHash === "string" && mod.sourceHash && djb2SourceHash(mod.source) !== mod.sourceHash) {
      warnings.push({
        severity: "warning",
        path: `scripts/${mod.id}.ts`,
        message: `Script "${mod.id}" source changed since last compile (sourceHash mismatch); recompile in editor before shipping.`,
      });
    }
  }

  // Check canonical formatting drift on JSON files
  const canonical = unpackProjectToTextFiles(packed, projectId ? { projectId } : undefined);
  for (const [filePath, expectedContent] of Object.entries(canonical)) {
    const actualContent = files.get(filePath);
    if (actualContent !== undefined && actualContent !== expectedContent) {
      warnings.push({
        severity: "warning",
        path: filePath,
        message: "Non-canonical formatting detected (re-running unpack will normalize key order/indentation).",
      });
    }
  }

  return {
    ok: errors.length === 0,
    projectId,
    projectVersion: packed.version,
    counts: {
      maps: Object.keys(maps).length,
      tilesets: Object.keys(tilesets).length,
      databaseKinds: Object.keys(database).length,
      scripts: scripts.length,
      uploadedAssets: Object.keys(uploaded).length,
    },
    errors,
    warnings,
  };
}
