import { deserialize, serialize } from "./io";
import { defaultResourceProfiles, removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { projectWithoutEventDrafts } from "./eventDrafts";
import {
  defaultBattleAnimationRecords,
  defaultBattlerAnimationRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "./defaults/defaultDatabaseStarterRecords";
import { defaultItemRecords } from "./defaults/defaultDatabaseItemRecords";
import { supabaseProjectConfig, type SupabaseProjectConfig } from "./supabaseProjectConfig";
import { sha256HexText } from "../util/sha256";
import { randomUuid } from "../util/id";
import type { ChangeSummary } from "@/editor/tools/types";
import type { EditorIdentity } from "./editorIdentity";
import type { GameMap, MapTreeNode, Project, TerrainTemplateMetadata, TilesetDef } from "./types";

const SUPABASE_SCHEMA = "rpg_zzu";
const DEFAULT_PROJECT_TITLE = "RPG Zzu";
export { DEFAULT_SUPABASE_PROJECT_ID } from "./supabaseProjectConfig";

type SupabaseProjectRow = {
  readonly current_json: unknown;
  readonly current_sha256: string | null;
};

export type SupabaseProjectListConfig = Pick<SupabaseProjectConfig, "anonKey" | "url">;

export type SupabaseProjectListItem = {
  readonly projectId: string;
  readonly title: string;
};

type SupabaseProjectListRow = {
  readonly current_json: unknown;
  readonly project_id: string;
  readonly title: string | null;
};

type SupabaseChildTable = "ai_analysis_runs" | "maps" | "terrain_templates" | "tilesets";
type SupabaseCommitTable = "project_changes" | "project_commits";
const MAP_PATCH_MAX_ATTEMPTS = 4;

export type SupabaseMapSaveConflict = {
  readonly mapId: string;
  readonly name: string;
};

export type SupabaseSaveResult =
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly SupabaseMapSaveConflict[] }
  | { readonly kind: "saved"; readonly project?: Project };

export type SupabaseProjectMapPatchInput = {
  readonly baseProject: Project;
  readonly changedMapIds?: readonly string[];
  readonly project: Project;
};

type SupabaseAiAnalysisRunInput = {
  readonly promptContext: unknown;
  readonly result: unknown;
  readonly selectedTiles: readonly number[];
  readonly tilesetId: string;
};

export type ProjectCommitReviewStatus = "approved" | "direct";

export type SupabaseProjectCommitInput = {
  readonly diff?: ChangeSummary;
  readonly identity: EditorIdentity;
  readonly project: Project;
  readonly reviewStatus: ProjectCommitReviewStatus;
  readonly serialized?: string;
  readonly summary: string;
  readonly toolNames: readonly string[];
};

export type SupabaseProjectCommitListItem = {
  readonly agentName: string | null;
  readonly authorId: string | null;
  readonly authorKind: string | null;
  readonly authorLabel: string | null;
  readonly commitId: string;
  readonly createdAt: string | null;
  readonly message: string;
  readonly reviewStatus: string | null;
  readonly summary: string | null;
};

type SupabaseProjectSnapshot = {
  readonly project: Project;
  readonly sha256: string | null;
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

export async function loadProjectFromSupabase(config = supabaseProjectConfig()): Promise<Project | null> {
  return (await loadProjectSnapshotFromSupabase(config))?.project ?? null;
}

export async function listSupabaseProjects(config: SupabaseProjectListConfig): Promise<readonly SupabaseProjectListItem[]> {
  const response = await fetch(supabaseProjectListUrl(config), {
    headers: supabaseJsonHeaders(config, "read"),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  const rows = await parseProjectListRows(response);
  return rows.map((row) => ({
    projectId: row.project_id,
    title: supabaseProjectListTitle(row),
  }));
}

async function loadProjectSnapshotFromSupabase(
  config = supabaseProjectConfig(),
): Promise<SupabaseProjectSnapshot | null> {
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
  return {
    project: deserialize(JSON.stringify(repairSupabaseCurrentJson(row.current_json))),
    sha256: row.current_sha256,
  };
}

export async function saveProjectToSupabase(project: Project, config = supabaseProjectConfig()): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const persistedProject = projectWithoutEventDrafts(project);
  removeLegacySpriteReferences(persistedProject);
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

export async function saveProjectMapPatchToSupabase(
  input: SupabaseProjectMapPatchInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const persistedProject = projectWithoutEventDrafts(input.project);
  const baseProject = projectWithoutEventDrafts(input.baseProject);
  removeLegacySpriteReferences(persistedProject);
  removeLegacySpriteReferences(baseProject);
  const changedMapIds = input.changedMapIds ?? changedMapIdsBetween(baseProject, persistedProject);
  const changedMapTreeIds = changedMapTreeIdsBetween(baseProject.mapTree, persistedProject.mapTree);
  for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
    const latestSnapshot = await loadProjectSnapshotFromSupabase(config);
    const latestProject = latestSnapshot?.project ?? baseProject;
    const conflicts = mapSaveConflicts(baseProject, persistedProject, latestProject, changedMapIds);
    if (conflicts.length > 0) return { kind: "conflict", conflicts };
    const mergedProject = mergeProjectMaps(latestProject, persistedProject, changedMapIds, changedMapTreeIds);
    const saved = await saveProjectSnapshotToSupabase(config, mergedProject, latestSnapshot?.sha256 ?? null);
    if (!saved) continue;
    try {
      if (latestSnapshot?.sha256) {
        await saveChangedMapRowsFromCanonical(config, mergedProject, changedMapIds);
      } else {
        await saveChangedMapRows(config, mergedProject, changedMapIds);
      }
    } catch (error) {
      if (!isOptionalTableMissingError(error)) throw error;
    }
    return { kind: "saved", project: mergedProject };
  }
  throw new SupabaseProjectSyncError("Supabase project changed too often while saving map patch", 409);
}

export async function recordSupabaseAiAnalysisRun(
  input: SupabaseAiAnalysisRunInput,
  config = supabaseProjectConfig(),
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

export async function recordProjectCommitToSupabase(
  input: SupabaseProjectCommitInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const serialized = input.serialized ?? serialize(projectWithoutEventDrafts(input.project));
  const commitId = randomUuid();
  const currentSha256 = await sha256Hex(serialized);
  try {
    await insertRows(config, "project_commits", [projectCommitRow(config.projectId, commitId, currentSha256, input)]);
    await insertRows(config, "project_changes", [projectChangeRow(config.projectId, commitId, input)]);
  } catch (error) {
    if (isOptionalTableMissingError(error)) return { kind: "not-configured" };
    throw error;
  }
  return { kind: "saved" };
}

export async function listProjectCommitsFromSupabase(
  limit = 20,
  config = supabaseProjectConfig(),
): Promise<readonly SupabaseProjectCommitListItem[]> {
  if (!config) throw new SupabaseProjectSyncError("Supabase 설정 없음");
  const response = await fetch(supabaseProjectCommitsListUrl(config, limit), {
    headers: supabaseJsonHeaders(config, "read"),
  });
  if (!response.ok) throw new SupabaseProjectSyncError(await response.text(), response.status);
  return parseProjectCommitRows(await response.json());
}

function supabaseProjectUrl(config: SupabaseProjectConfig): string {
  const query = new URLSearchParams({
    select: "current_json,current_sha256",
    project_id: `eq.${config.projectId}`,
  });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseProjectListUrl(config: SupabaseProjectListConfig): string {
  const query = new URLSearchParams({
    order: "project_id.asc",
    select: "project_id,title,current_json",
  });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseUpsertUrl(config: SupabaseProjectConfig): string {
  const query = new URLSearchParams({ on_conflict: "project_id" });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseConditionalUpdateUrl(config: SupabaseProjectConfig, currentSha256: string): string {
  const query = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    current_sha256: `eq.${currentSha256}`,
  });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseTableUpsertUrl(config: SupabaseProjectConfig, table: SupabaseChildTable, conflictColumns: string): string {
  const query = new URLSearchParams({ on_conflict: conflictColumns });
  return `${config.url}/rest/v1/${table}?${query.toString()}`;
}

function supabaseTableInsertUrl(config: SupabaseProjectConfig, table: SupabaseCommitTable): string {
  return `${config.url}/rest/v1/${table}`;
}

function supabaseTableDeleteUrl(config: SupabaseProjectConfig, table: SupabaseChildTable): string {
  const query = new URLSearchParams({ project_id: `eq.${config.projectId}` });
  return `${config.url}/rest/v1/${table}?${query.toString()}`;
}

function supabaseMapRowsDeleteUrl(config: SupabaseProjectConfig, mapIds: readonly string[]): string {
  const query = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    map_id: `in.(${mapIds.map(supabaseListValue).join(",")})`,
  });
  return `${config.url}/rest/v1/maps?${query.toString()}`;
}

function supabaseProjectCommitsListUrl(config: SupabaseProjectConfig, limit: number): string {
  const query = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    limit: String(Math.max(1, Math.min(100, Math.floor(limit)))),
    order: "created_at.desc",
    select: "commit_id,message,summary,review_status,author_id,author_label,author_kind,agent_name,created_at",
  });
  return `${config.url}/rest/v1/project_commits?${query.toString()}`;
}

function supabaseJsonHeaders(
  config: SupabaseProjectListConfig,
  mode: "read" | "write",
  returnMode: "minimal" | "representation" = "minimal",
): HeadersInit {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${config.anonKey}`,
    Accept: "application/json",
    ...(mode === "write" ? { "Content-Type": "application/json", Prefer: `resolution=merge-duplicates,return=${returnMode}` } : {}),
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
    return {
      current_json: entry.current_json,
      current_sha256: typeof entry.current_sha256 === "string" ? entry.current_sha256 : null,
    };
  });
}

async function parseProjectListRows(response: Response): Promise<readonly SupabaseProjectListRow[]> {
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) throw new SupabaseProjectSyncError("Supabase projects list response was not an array");
  return parsed.map((entry) => {
    if (!isRecord(entry) || typeof entry.project_id !== "string") {
      throw new SupabaseProjectSyncError("Supabase projects list row is missing project_id");
    }
    return {
      current_json: entry.current_json,
      project_id: entry.project_id,
      title: typeof entry.title === "string" ? entry.title : null,
    };
  });
}

function supabaseProjectListTitle(row: SupabaseProjectListRow): string {
  const directTitle = trimmedOrUndefined(row.title);
  if (directTitle) return directTitle;
  if (isRecord(row.current_json) && isRecord(row.current_json.meta)) {
    const metaTitle = trimmedOrUndefined(row.current_json.meta.title);
    if (metaTitle) return metaTitle;
  }
  return row.project_id;
}

function trimmedOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function saveProjectSnapshotToSupabase(
  config: SupabaseProjectConfig,
  project: Project,
  expectedCurrentSha256: string | null,
): Promise<boolean> {
  const serialized = serialize(project);
  const payload = await projectUpsertPayload(config.projectId, project, serialized);
  if (expectedCurrentSha256 === null) {
    const response = await fetch(supabaseUpsertUrl(config), {
      method: "POST",
      headers: supabaseJsonHeaders(config, "write"),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new SupabaseProjectSyncError(await response.text(), response.status);
    }
    return true;
  }
  const response = await fetch(supabaseConditionalUpdateUrl(config, expectedCurrentSha256), {
    method: "PATCH",
    headers: supabaseJsonHeaders(config, "write", "representation"),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  return await responseUpdatedRows(response);
}

async function responseUpdatedRows(response: Response): Promise<boolean> {
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) {
    throw new SupabaseProjectSyncError("Supabase conditional update response was not an array");
  }
  return parsed.length > 0;
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

async function saveChangedMapRows(
  config: SupabaseProjectConfig,
  project: Project,
  changedMapIds: readonly string[],
): Promise<void> {
  const mapRows = await Promise.all(
    changedMapIds
      .map((mapId) => project.maps[mapId])
      .filter((map): map is GameMap => map !== undefined)
      .map((map) => mapRow(config.projectId, map)),
  );
  const deletedMapIds = changedMapIds.filter((mapId) => project.maps[mapId] === undefined);
  if (deletedMapIds.length > 0) await deleteMapRows(config, deletedMapIds);
  await upsertRows(config, "maps", "project_id,map_id", mapRows);
}

async function saveChangedMapRowsFromCanonical(
  config: SupabaseProjectConfig,
  fallbackProject: Project,
  changedMapIds: readonly string[],
): Promise<void> {
  let project = fallbackProject;
  let beforeSha256: string | null = null;
  for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
    const beforeSnapshot = await loadProjectSnapshotFromSupabase(config);
    if (beforeSnapshot) {
      project = beforeSnapshot.project;
      beforeSha256 = beforeSnapshot.sha256;
    }
    await saveChangedMapRows(config, project, changedMapIds);
    const afterSnapshot = await loadProjectSnapshotFromSupabase(config);
    if (!afterSnapshot || afterSnapshot.sha256 === beforeSha256) return;
    project = afterSnapshot.project;
    beforeSha256 = afterSnapshot.sha256;
  }
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

async function deleteMapRows(config: SupabaseProjectConfig, mapIds: readonly string[]): Promise<void> {
  const response = await fetch(supabaseMapRowsDeleteUrl(config, mapIds), {
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

async function insertRows(
  config: SupabaseProjectConfig,
  table: SupabaseCommitTable,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const response = await fetch(supabaseTableInsertUrl(config, table), {
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
    run_id: randomUuid(),
    project_id: projectId,
    tileset_id: input.tilesetId,
    selected_tile_ids_json: input.selectedTiles,
    prompt_context_json: input.promptContext,
    result_json: input.result,
  };
}

function projectCommitRow(
  projectId: string,
  commitId: string,
  currentSha256: string,
  input: SupabaseProjectCommitInput,
): Record<string, unknown> {
  return {
    commit_id: commitId,
    project_id: projectId,
    parent_commit_id: null,
    message: input.summary,
    summary: input.summary,
    review_status: input.reviewStatus,
    author_id: input.identity.id,
    author_label: input.identity.label,
    author_kind: input.identity.kind,
    agent_name: input.identity.kind === "agent" ? input.identity.agentName ?? null : null,
    current_sha256: currentSha256,
  };
}

function projectChangeRow(
  projectId: string,
  commitId: string,
  input: SupabaseProjectCommitInput,
): Record<string, unknown> {
  return {
    commit_id: commitId,
    entity_type: "project",
    entity_id: projectId,
    operation: "changeset",
    patch_json: {
      diff: input.diff ?? null,
      toolNames: input.toolNames,
    },
  };
}

function parseProjectCommitRows(parsed: unknown): readonly SupabaseProjectCommitListItem[] {
  if (!Array.isArray(parsed)) throw new SupabaseProjectSyncError("Supabase project commits response was not an array");
  return parsed.map((entry) => {
    if (!isRecord(entry) || typeof entry.commit_id !== "string" || typeof entry.message !== "string") {
      throw new SupabaseProjectSyncError("Supabase project commit row is missing commit_id/message");
    }
    return {
      agentName: typeof entry.agent_name === "string" ? entry.agent_name : null,
      authorId: typeof entry.author_id === "string" ? entry.author_id : null,
      authorKind: typeof entry.author_kind === "string" ? entry.author_kind : null,
      authorLabel: typeof entry.author_label === "string" ? entry.author_label : null,
      commitId: entry.commit_id,
      createdAt: typeof entry.created_at === "string" ? entry.created_at : null,
      message: entry.message,
      reviewStatus: typeof entry.review_status === "string" ? entry.review_status : null,
      summary: typeof entry.summary === "string" ? entry.summary : null,
    };
  });
}

async function sha256Hex(value: string): Promise<string> {
  return sha256HexText(value);
}

function terrainTemplateCount(project: Project): number {
  return Object.values(project.tilesets).reduce((count, tileset) => count + (tileset.terrainTemplates?.length ?? 0), 0);
}

function changedMapIdsBetween(baseProject: Project, project: Project): readonly string[] {
  const mapIds = [...new Set([...Object.keys(baseProject.maps), ...Object.keys(project.maps)])]
    .filter((mapId) => mapSnapshot(baseProject.maps[mapId]) !== mapSnapshot(project.maps[mapId]));
  return [...new Set([...mapIds, ...changedMapTreeIdsBetween(baseProject.mapTree, project.mapTree)])];
}

function mapSaveConflicts(
  baseProject: Project,
  project: Project,
  latestProject: Project,
  changedMapIds: readonly string[],
): readonly SupabaseMapSaveConflict[] {
  return changedMapIds
    .filter((mapId) => {
      const baseSnapshot = mapSnapshot(baseProject.maps[mapId]);
      const latestSnapshot = mapSnapshot(latestProject.maps[mapId]);
      const localSnapshot = mapSnapshot(project.maps[mapId]);
      return latestSnapshot !== baseSnapshot && latestSnapshot !== localSnapshot;
    })
    .map((mapId) => ({ mapId, name: mapConflictName(mapId, project, latestProject, baseProject) }));
}

function mergeProjectMaps(
  latestProject: Project,
  project: Project,
  changedMapIds: readonly string[],
  changedMapTreeIds: readonly string[],
): Project {
  const mergedMaps = { ...latestProject.maps };
  for (const mapId of changedMapIds) {
    const map = project.maps[mapId];
    if (map) {
      mergedMaps[mapId] = map;
    } else {
      delete mergedMaps[mapId];
    }
  }
  return {
    ...project,
    maps: mergedMaps,
    mapTree: mergeMapTree(latestProject.mapTree, project.mapTree, changedMapTreeIds),
  };
}

function changedMapTreeIdsBetween(baseTree: MapTreeNode, tree: MapTreeNode): readonly string[] {
  const baseLocations = mapTreeLocations(baseTree);
  const locations = mapTreeLocations(tree);
  return [...new Set([...baseLocations.keys(), ...locations.keys()])]
    .filter((mapId) => baseLocations.get(mapId) !== locations.get(mapId));
}

function mapTreeLocations(tree: MapTreeNode): Map<string, string> {
  const locations = new Map<string, string>();
  visitMapTreeLocations(tree, null, 0, locations);
  return locations;
}

function visitMapTreeLocations(
  node: MapTreeNode,
  parentId: string | null,
  index: number,
  locations: Map<string, string>,
): void {
  locations.set(node.mapId, `${parentId ?? ""}/${index}`);
  node.children.forEach((child, childIndex) => visitMapTreeLocations(child, node.mapId, childIndex, locations));
}

function mergeMapTree(latestTree: MapTreeNode, tree: MapTreeNode, changedMapIds: readonly string[]): MapTreeNode {
  return changedMapIds.reduce(
    (mergedTree, mapId) => mergeMapTreeNode(mergedTree, latestTree, tree, mapId),
    structuredClone(latestTree),
  );
}

function mergeMapTreeNode(
  mergedTree: MapTreeNode,
  latestTree: MapTreeNode,
  tree: MapTreeNode,
  mapId: string,
): MapTreeNode {
  const localPlacement = findMapTreePlacement(tree, mapId);
  const latestPlacement = findMapTreePlacement(latestTree, mapId);
  const treeWithoutNode = removeMapTreeNode(mergedTree, mapId);
  if (!localPlacement) return treeWithoutNode;
  const node = latestPlacement
    ? { ...structuredClone(latestPlacement.node), mapId }
    : structuredClone(localPlacement.node);
  return insertMapTreeNode(treeWithoutNode, localPlacement.parentId, localPlacement.index, node);
}

type MapTreePlacement = {
  readonly index: number;
  readonly node: MapTreeNode;
  readonly parentId: string | null;
};

function findMapTreePlacement(
  node: MapTreeNode,
  mapId: string,
  parentId: string | null = null,
  index = 0,
): MapTreePlacement | null {
  if (node.mapId === mapId) return { index, node, parentId };
  for (let childIndex = 0; childIndex < node.children.length; childIndex += 1) {
    const child = node.children[childIndex];
    if (!child) continue;
    const found = findMapTreePlacement(child, mapId, node.mapId, childIndex);
    if (found) return found;
  }
  return null;
}

function removeMapTreeNode(node: MapTreeNode, mapId: string): MapTreeNode {
  if (node.mapId === mapId) {
    return { ...node, children: node.children.filter((child) => child.mapId !== mapId).map((child) => removeMapTreeNode(child, mapId)) };
  }
  return {
    ...node,
    children: node.children
      .filter((child) => child.mapId !== mapId)
      .map((child) => removeMapTreeNode(child, mapId)),
  };
}

function insertMapTreeNode(node: MapTreeNode, parentId: string | null, index: number, childNode: MapTreeNode): MapTreeNode {
  if (parentId === null) return childNode;
  if (node.mapId === parentId) {
    const children = [...node.children];
    children.splice(Math.min(index, children.length), 0, childNode);
    return { ...node, children };
  }
  return { ...node, children: node.children.map((child) => insertMapTreeNode(child, parentId, index, childNode)) };
}

function mapSnapshot(map: GameMap | undefined): string {
  return map ? JSON.stringify(map) : "";
}

function mapConflictName(mapId: string, project: Project, latestProject: Project, baseProject: Project): string {
  return project.maps[mapId]?.name ?? latestProject.maps[mapId]?.name ?? baseProject.maps[mapId]?.name ?? mapId;
}

function supabaseListValue(value: string): string {
  return `"${value.replaceAll("\"", "\\\"")}"`;
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
  pruneInvalidVillageInfoDocuments(value);
  removeLegacySpriteReferences(value);
  appendMissingResourceProfiles(value, defaultResourceProfiles());
  return value;
}

function pruneInvalidVillageInfoDocuments(project: Record<string, unknown>): void {
  if (!isRecord(project.maps) || !Array.isArray(project.villageInfoDocuments)) return;
  const mapIds = new Set(Object.keys(project.maps));
  project.villageInfoDocuments = project.villageInfoDocuments.filter((entry) => {
    if (!isRecord(entry)) return true;
    return typeof entry.mapId !== "string" || mapIds.has(entry.mapId);
  });
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
