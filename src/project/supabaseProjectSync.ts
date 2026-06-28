import { deserialize, serialize } from "./io";
import { defaultResourceProfiles } from "./defaults/defaultAssets";
import { projectWithoutEventDrafts } from "./eventDrafts";
import {
  defaultBattleAnimationRecords,
  defaultBattlerAnimationRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "./defaults/defaultDatabaseStarterRecords";
import { defaultItemRecords } from "./defaults/defaultDatabaseItemRecords";
import type { GameMap, Project, TerrainTemplateMetadata, TilesetDef } from "./types";

const SUPABASE_SCHEMA = "rpg_zzu";
const DEFAULT_PROJECT_TITLE = "RPG Zzu";
export const DEFAULT_SUPABASE_PROJECT_ID = "rpg-zzu-house-template-gallery";

type SupabaseProjectConfig = {
  readonly anonKey: string;
  readonly projectId: string;
  readonly url: string;
};

type SupabaseProjectRow = {
  readonly current_json: unknown;
};

type SupabaseChildTable = "ai_analysis_runs" | "maps" | "terrain_templates" | "tilesets";

type SupabaseSaveResult =
  | { readonly kind: "not-configured" }
  | { readonly kind: "saved" };

type SupabaseAiAnalysisRunInput = {
  readonly promptContext: unknown;
  readonly result: unknown;
  readonly selectedTiles: readonly number[];
  readonly tilesetId: string;
};

export class SupabaseProjectSyncError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SupabaseProjectSyncError";
  }
}

export async function loadProjectFromSupabase(config = supabaseProjectConfigFromEnv()): Promise<Project | null> {
  if (!config) return null;
  const response = await fetch(supabaseProjectUrl(config), {
    headers: supabaseJsonHeaders(config, "read"),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  const rows = await parseProjectRows(response);
  const row = rows[0];
  if (!row) return null;
  return deserialize(JSON.stringify(repairSupabaseCurrentJson(row.current_json)));
}

export async function saveProjectToSupabase(project: Project, config = supabaseProjectConfigFromEnv()): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const persistedProject = projectWithoutEventDrafts(project);
  const serialized = serialize(persistedProject);
  const response = await fetch(supabaseUpsertUrl(config), {
    method: "POST",
    headers: supabaseJsonHeaders(config, "write"),
    body: JSON.stringify(await projectUpsertPayload(config.projectId, persistedProject, serialized)),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  try {
    await saveProjectChildRows(config, persistedProject);
  } catch (error) {
    if (!isOptionalTableMissingError(error)) throw error;
  }
  return { kind: "saved" };
}

export async function recordSupabaseAiAnalysisRun(
  input: SupabaseAiAnalysisRunInput,
  config = supabaseProjectConfigFromEnv(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  try {
    await upsertRows(config, "ai_analysis_runs", "run_id", [aiAnalysisRunRow(config.projectId, input)]);
  } catch (error) {
    if (error instanceof SupabaseProjectSyncError && error.status === 404) {
      return { kind: "not-configured" };
    }
    throw error;
  }
  return { kind: "saved" };
}

function supabaseProjectConfigFromEnv(): SupabaseProjectConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim() || DEFAULT_SUPABASE_PROJECT_ID;
  if (!url || !anonKey) return null;
  return { anonKey, projectId, url: url.replace(/\/$/, "") };
}

function supabaseProjectUrl(config: SupabaseProjectConfig): string {
  const query = new URLSearchParams({
    select: "current_json",
    project_id: `eq.${config.projectId}`,
  });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseUpsertUrl(config: SupabaseProjectConfig): string {
  const query = new URLSearchParams({ on_conflict: "project_id" });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseTableUpsertUrl(config: SupabaseProjectConfig, table: SupabaseChildTable, conflictColumns: string): string {
  const query = new URLSearchParams({ on_conflict: conflictColumns });
  return `${config.url}/rest/v1/${table}?${query.toString()}`;
}

function supabaseTableDeleteUrl(config: SupabaseProjectConfig, table: SupabaseChildTable): string {
  const query = new URLSearchParams({ project_id: `eq.${config.projectId}` });
  return `${config.url}/rest/v1/${table}?${query.toString()}`;
}

function supabaseJsonHeaders(config: SupabaseProjectConfig, mode: "read" | "write"): HeadersInit {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    ...(mode === "write" ? { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" } : {}),
    ...(mode === "read" ? { "Accept-Profile": SUPABASE_SCHEMA } : { "Content-Profile": SUPABASE_SCHEMA }),
  };
}

async function parseProjectRows(response: Response): Promise<readonly SupabaseProjectRow[]> {
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) throw new SupabaseProjectSyncError("Supabase projects response was not an array");
  return parsed.map((entry) => {
    if (!isRecord(entry) || !("current_json" in entry)) {
      throw new SupabaseProjectSyncError("Supabase project row is missing current_json");
    }
    return { current_json: entry.current_json };
  });
}

async function projectUpsertPayload(projectId: string, project: Project, serialized: string): Promise<Record<string, unknown>> {
  const currentJson: unknown = JSON.parse(serialized);
  return {
    project_id: projectId,
    title: project.meta.title.trim() || DEFAULT_PROJECT_TITLE,
    schema_version: project.version,
    current_json: currentJson,
    current_sha256: await sha256Hex(serialized),
    map_count: Object.keys(project.maps).length,
    tileset_count: Object.keys(project.tilesets).length,
    terrain_template_count: terrainTemplateCount(project),
  };
}

async function saveProjectChildRows(config: SupabaseProjectConfig, project: Project): Promise<void> {
  await replaceRows(config, "maps", "project_id,map_id", await Promise.all(Object.values(project.maps).map((map) => mapRow(config.projectId, map))));
  await replaceRows(config, "tilesets", "project_id,tileset_id", Object.values(project.tilesets).map((tileset) => tilesetRow(config.projectId, tileset)));
  await replaceRows(config, "terrain_templates", "project_id,tileset_id,template_id", terrainTemplateRows(config.projectId, project));
}

async function replaceRows(
  config: SupabaseProjectConfig,
  table: SupabaseChildTable,
  conflictColumns: string,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  await deleteProjectRows(config, table);
  await upsertRows(config, table, conflictColumns, rows);
}

async function deleteProjectRows(config: SupabaseProjectConfig, table: SupabaseChildTable): Promise<void> {
  const response = await fetch(supabaseTableDeleteUrl(config, table), {
    method: "DELETE",
    headers: supabaseJsonHeaders(config, "write"),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
}

async function upsertRows(
  config: SupabaseProjectConfig,
  table: SupabaseChildTable,
  conflictColumns: string,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const response = await fetch(supabaseTableUpsertUrl(config, table, conflictColumns), {
    method: "POST",
    headers: supabaseJsonHeaders(config, "write"),
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
}

async function mapRow(projectId: string, map: GameMap): Promise<Record<string, unknown>> {
  const lowerTiles = JSON.stringify(map.lowerTiles);
  const upperTiles = JSON.stringify(map.upperTiles);
  return {
    project_id: projectId,
    map_id: map.id,
    name: map.name,
    width: map.width,
    height: map.height,
    tileset_id: map.tilesetId,
    lower_sha256: await sha256Hex(lowerTiles),
    upper_sha256: await sha256Hex(upperTiles),
    lower_tile_count: map.lowerTiles.length,
    upper_tile_count: map.upperTiles.length,
    map_json: map,
  };
}

function tilesetRow(projectId: string, tileset: TilesetDef): Record<string, unknown> {
  return {
    project_id: projectId,
    tileset_id: tileset.id,
    name: tileset.name,
    tile_count: tileset.count,
    tileset_json: tileset,
  };
}

function terrainTemplateRows(projectId: string, project: Project): readonly Record<string, unknown>[] {
  return Object.values(project.tilesets).flatMap((tileset) =>
    (tileset.terrainTemplates ?? []).map((template) => terrainTemplateRow(projectId, tileset.id, template)),
  );
}

function terrainTemplateRow(projectId: string, tilesetId: string, template: TerrainTemplateMetadata): Record<string, unknown> {
  return {
    project_id: projectId,
    tileset_id: tilesetId,
    template_id: template.id,
    name: template.name,
    category: null,
    template_json: template,
  };
}

function aiAnalysisRunRow(projectId: string, input: SupabaseAiAnalysisRunInput): Record<string, unknown> {
  return {
    run_id: crypto.randomUUID(),
    project_id: projectId,
    tileset_id: input.tilesetId,
    selected_tile_ids_json: input.selectedTiles,
    prompt_context_json: input.promptContext,
    result_json: input.result,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function terrainTemplateCount(project: Project): number {
  return Object.values(project.tilesets).reduce((count, tileset) => count + (tileset.terrainTemplates?.length ?? 0), 0);
}

function isOptionalTableMissingError(error: unknown): boolean {
  return error instanceof SupabaseProjectSyncError && error.status === 404 && error.message.includes("PGRST205");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function repairSupabaseCurrentJson(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const database = value.database;
  if (isRecord(database)) {
    appendMissingRecords(database, "skills", defaultSkillRecords());
    appendMissingRecords(database, "items", defaultItemRecords());
    appendMissingRecords(database, "states", defaultStateRecords());
    appendMissingRecords(database, "battleAnimations", defaultBattleAnimationRecords());
    appendMissingRecords(database, "battlerAnimations", defaultBattlerAnimationRecords());
  }
  appendMissingResourceProfiles(value, defaultResourceProfiles());
  return value;
}

function appendMissingRecords<T extends { readonly id: string }>(container: Record<string, unknown>, key: string, defaults: readonly T[]): void {
  const target = ensureArray(container, key);
  const ids = new Set(target.map(recordId).filter((id): id is string => id !== undefined));
  for (const defaultRecord of defaults) {
    if (ids.has(defaultRecord.id)) continue;
    target.push(cloneRecord(defaultRecord));
    ids.add(defaultRecord.id);
  }
}

function appendMissingResourceProfiles(project: Record<string, unknown>, defaults: readonly { readonly assetId?: string }[]): void {
  const target = ensureArray(project, "resourceProfiles");
  const assetIds = new Set(target.map(resourceAssetId).filter((assetId): assetId is string => assetId !== undefined));
  for (const profile of defaults) {
    if (!profile.assetId || assetIds.has(profile.assetId)) continue;
    target.push(cloneRecord(profile));
    assetIds.add(profile.assetId);
  }
}

function ensureArray(container: Record<string, unknown>, key: string): unknown[] {
  const value = container[key];
  if (Array.isArray(value)) return value;
  const replacement: unknown[] = [];
  container[key] = replacement;
  return replacement;
}

function recordId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.id === "string" ? value.id : undefined;
}

function resourceAssetId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.assetId === "string" ? value.assetId : undefined;
}

function cloneRecord(value: unknown): Record<string, unknown> {
  const cloned: unknown = JSON.parse(JSON.stringify(value));
  if (!isRecord(cloned)) throw new SupabaseProjectSyncError("Default project repair record was not an object");
  return cloned;
}
