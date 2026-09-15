import { PRODUCT_BRAND } from "@/brand";
import { projectPreview, rawObject, serverSHA } from "./spatial/persistenceWire";
import { rememberCanonicalTarget, routeSpatialSave, ProjectRoutingError, type ProjectWriteAuthority } from "./spatial/saveRouting";
import type { MirrorStatus } from "./spatial/persistenceTypes";
export type { ProjectWriteAuthority } from "./spatial/saveRouting";
import { serialize } from "./io";
import { readProjectV4MapMergeSnapshot } from "./io/shape";
import { SCHEMA_VERSION } from "./types";
import { removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { validateProjectReferences } from "./io/references";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { applyAudioDescriptionDelta } from "./audioDescriptions";
import { applyMonsterMetadataDelta } from "./monsterMetadata";
import { supabaseProjectConfig, type SupabaseProjectConfig } from "./supabaseProjectConfig";
import { sha256HexText } from "../util/sha256";
import { randomUuid } from "../util/id";
import { projectWire, type ProjectWire } from "./persistence/core/projectWire";
export { canonicalJsonString } from "./persistence/core/canonicalJson";
import { changedMapIdsBetween, changedMapTreeIdsBetween, mapSaveConflicts, mergeProjectMaps, type MapSaveConflict } from "./persistence/core/mapMerge";
import { deserializeStoredProjectJson, repairStoredLoadFoundation } from "./persistence/core/loadRepair";
// 타입 전용 import — 런타임 그래프를 넓히지 않는다(선례: projectCommitLog 의 순환 검사 주석).
import type { EditActivityCommitAttachment } from "@/editor/editActivityLog";
import type { ChangeSummary } from "@/project/types";
import type { EditorIdentity } from "./editorIdentity";
import type { GameMap, Project, TilesetDef } from "./types";

const SUPABASE_SCHEMA = "rpg_zzu";
const DEFAULT_PROJECT_TITLE = PRODUCT_BRAND;
export { DEFAULT_SUPABASE_PROJECT_ID } from "./supabaseProjectConfig";

type SupabaseProjectRow = {
  readonly project_id: string | null;
  readonly current_json: unknown;
  readonly current_sha256: string | null;
};

export type SupabaseProjectListConfig = Pick<SupabaseProjectConfig, "anonKey" | "url">;

export type SupabaseProjectListItem = {
  readonly projectId: string;
  readonly title: string;
  readonly mapCount: number;
  readonly tilesetCount: number;
  readonly updatedAt: string | null;
};

type SupabaseProjectListRow = {
  readonly project_id: string;
  readonly title: string | null;
  readonly map_count: number | null;
  readonly tileset_count: number | null;
  readonly updated_at: string | null;
};

/** 목록 카드 썸네일용 최소 재료 — 맵 1장과 그 맵이 쓰는 타일셋 1개. */
export type SupabaseProjectPreview = {
  readonly map: GameMap;
  readonly tileset: TilesetDef;
};

type SupabaseMapMetaRow = {
  readonly map_id: string;
  readonly tileset_id: string;
  readonly width: number;
  readonly height: number;
};

type SupabaseChildTable = "ai_activity_logs" | "ai_analysis_runs" | "ai_conversations" | "maps" | "tilesets";
type SupabaseCommitTable = "project_changes" | "project_commits";
const MAP_PATCH_MAX_ATTEMPTS = 4;
/** project_id → 마지막 성공 insert 커밋 id (parent 계보). */
const lastRemoteCommitIdByProject = new Map<string, string>();

export type SupabaseMapSaveConflict = MapSaveConflict;

export type SupabaseSaveResult =
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly SupabaseMapSaveConflict[] }
  | { readonly kind: "saved"; readonly project?: Project; readonly sha256?: string; readonly commitId?: string; readonly authority?: ProjectWriteAuthority; readonly mirror?: MirrorStatus };

export type SupabaseProjectMapPatchInput = {
  readonly baseProject: Project;
  readonly changedMapIds?: readonly string[];
  readonly project: Project;
  readonly authority?: ProjectWriteAuthority;
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
  /** 직전 원격 커밋 id — 계보 연결. 없으면 null parent. */
  readonly parentCommitId?: string | null;
  /**
   * 이 커밋 경계 안에서 일어난 편집 행위 기록. `patch_json.edits` 로 들어간다.
   * `projectCommitLog` 가 커서로 잘라 넣는다 — 호출부가 직접 채우지 않는다.
   */
  readonly editActivity?: EditActivityCommitAttachment;
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

export type SupabaseProjectSnapshot = {
  readonly authority: ProjectWriteAuthority;
  readonly projectId: string | null;
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

export class SupabaseMigrationRequiredError extends Error {
  constructor(
    readonly table: string,
    readonly migration: string,
  ) {
    super(`Supabase table ${table} is missing. Apply ${migration} with npm run db:migrate.`);
    this.name = "SupabaseMigrationRequiredError";
  }
}

export async function loadProjectFromSupabase(config = supabaseProjectConfig(), onAuthority?: (authority: ProjectWriteAuthority) => void): Promise<Project | null> {
  const snapshot = await loadProjectSnapshotFromSupabase(config);
  if (snapshot) onAuthority?.(snapshot.authority);
  const project = snapshot?.project ?? null;
  if (project && config) void hydrateLastRemoteCommitTip(config);
  return project;
}

/** Same normalized/hybrid read as editor load, without commit-tip hydration or store mutation. */
export async function loadProjectForPersistenceProof(
  config: SupabaseProjectConfig,
  signal?: AbortSignal,
): Promise<SupabaseProjectSnapshot | null> {
  return loadProjectSnapshotFromSupabase(config, { includeProjectId: true, signal });
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
    mapCount: row.map_count ?? 0,
    tilesetCount: row.tileset_count ?? 0,
    updatedAt: row.updated_at,
  }));
}

/**
 * 목록 카드 썸네일 재료를 가져온다. 대표 맵은 타일 수가 가장 많은 맵.
 * 재료가 없거나 응답이 비면 null — 호출 측이 대체 커버로 넘어간다.
 */
export async function loadSupabaseProjectPreview(
  config: SupabaseProjectListConfig,
  projectId: string,
): Promise<SupabaseProjectPreview | null> {
  const target = { ...config, projectId };
  const rootResponse = await fetch(supabaseProjectUrl(target), { headers: supabaseJsonHeaders(config, "read") });
  if (!rootResponse.ok) throw new SupabaseProjectSyncError(await rootResponse.text(), rootResponse.status);
  const rootRow = (await parseProjectRows(rootResponse))[0];
  if (rootRow && isRecord(rootRow.current_json) && Object.hasOwn(rootRow.current_json, "spatialAuthoring")) {
    const project = projectPreview(rawObject(rootRow.current_json), true);
    rememberCanonicalTarget(target);
    const map = Object.values(project.maps).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const tileset = map ? project.tilesets[map.tilesetId] : undefined;
    return map && tileset ? { map, tileset } : null;
  }
  // Legacy preview deliberately does not deserialize/repair the raw root.
  const headers = supabaseJsonHeaders(config, "read");
  const metaResponse = await fetch(supabaseProjectPreviewMapsUrl(config, projectId), { headers });
  if (!metaResponse.ok) return null;
  const metaParsed: unknown = await metaResponse.json();
  if (!Array.isArray(metaParsed)) return null;

  const metas = metaParsed.filter((entry): entry is SupabaseMapMetaRow =>
    isRecord(entry) && typeof entry.map_id === "string" && typeof entry.tileset_id === "string",
  );
  if (metas.length === 0) return null;
  const best = metas.reduce((a, b) => ((b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a));

  const [mapResponse, tilesetResponse] = await Promise.all([
    fetch(supabaseProjectPreviewMapUrl(config, projectId, best.map_id), { headers }),
    fetch(supabaseProjectPreviewTilesetUrl(config, projectId, best.tileset_id), { headers }),
  ]);
  if (!mapResponse.ok || !tilesetResponse.ok) return null;

  const mapRows: unknown = await mapResponse.json();
  const tilesetRows: unknown = await tilesetResponse.json();
  if (!Array.isArray(mapRows) || !Array.isArray(tilesetRows)) return null;
  const mapRow = mapRows[0];
  const tilesetRow = tilesetRows[0];
  if (!isRecord(mapRow) || !isRecord(tilesetRow)) return null;
  if (!isRecord(mapRow.map_json) || !isRecord(tilesetRow.tileset_json)) return null;

  return {
    map: mapRow.map_json as unknown as GameMap,
    tileset: tilesetRow.tileset_json as unknown as TilesetDef,
  };
}

async function loadProjectRowFromSupabase(
  config = supabaseProjectConfig(),
  options: { readonly includeProjectId?: boolean; readonly signal?: AbortSignal } = {},
): Promise<SupabaseProjectRow | null> {
  if (!config) return null;
  const response = await fetch(supabaseProjectUrl(config, options.includeProjectId), {
    headers: supabaseJsonHeaders(config, "read"),
    signal: options.signal,
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  const rows = await parseProjectRows(response);
  return rows[0] ?? null;
}

export async function loadProjectSnapshotFromSupabase(
  config = supabaseProjectConfig(),
  options: { readonly overlayMaps?: boolean; readonly includeProjectId?: boolean; readonly signal?: AbortSignal } = {},
): Promise<SupabaseProjectSnapshot | null> {
  if (!config) return null;
  const row = await loadProjectRowFromSupabase(config, options);
  if (!row) return null;
  const canonical = isRecord(row.current_json) && Object.hasOwn(row.current_json, "spatialAuthoring");
  const project = canonical ? projectPreview(rawObject(row.current_json), true) : deserializeStoredProjectJson(row.current_json);
  const authority: ProjectWriteAuthority = canonical
    ? { mode: "canonical", target: { ...config }, serverSHA: serverSHA(row.current_sha256) }
    : { mode: "legacy", target: { ...config } };
  if (canonical) rememberCanonicalTarget(config);
  // Hybrid maps SoT (editor open / public load): maps table map_json overlays current_json map bodies.
  // Canonical spatial projects own their map bodies; only legacy rows take the overlay.
  // Patch/conflict loads pass overlayMaps:false so concurrent merge still compares current_json.
  if (!canonical && options.overlayMaps !== false) {
    try {
      const mapRows = await loadMapRowsFromSupabase(config, options.signal);
      if (mapRows.length > 0) overlayMapsFromRows(project, mapRows);
    } catch (error) {
      if (!isOptionalTableMissingError(error)) throw error;
    }
  }
  return {
    authority,
    project,
    sha256: row.current_sha256,
    projectId: row.project_id,
  };
}

export async function saveProjectToSupabase(project: Project, config = supabaseProjectConfig(), authority?: ProjectWriteAuthority): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const canonical = await routeSpatialSave(project, config, authority);
  if (canonical) return canonical;
  const persistedProject = projectWithoutEventDrafts(project);
  removeLegacySpriteReferences(persistedProject);
  const wire = await projectWire(persistedProject);
  const response = await fetch(authority?.mode === "create" ? `${config.url}/rest/v1/projects` : supabaseUpsertUrl(config), {
    method: "POST",
    headers: authority?.mode === "create" ? { ...supabaseJsonHeaders(config, "write"), Prefer: "return=minimal" } : supabaseJsonHeaders(config, "write"),
    body: JSON.stringify(projectUpsertPayload(config.projectId, persistedProject, wire)),
  });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  try {
    // maps/tilesets tables are the map/tileset SoT mirror; current_json stays full-project compat blob.
    await saveProjectChildRows(config, persistedProject);
  } catch (error) {
    if (!isOptionalTableMissingError(error)) throw error;
  }
  return { kind: "saved", project: persistedProject, sha256: wire.sha256,
    ...(authority?.mode === "create" ? { authority: { mode: "legacy" as const, target: { ...config } } } : {}) };
}

export async function saveProjectMapPatchToSupabase(
  input: SupabaseProjectMapPatchInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const canonical = await routeSpatialSave(input.project, config, input.authority);
  if (canonical) return canonical;
  const persistedProject = projectWithoutEventDrafts(input.project);
  const baseProject = projectWithoutEventDrafts(input.baseProject);
  removeLegacySpriteReferences(persistedProject);
  removeLegacySpriteReferences(baseProject);
  // Compare all three snapshots with the same shape/compatibility normalization
  // (shop defaults, social IDs, load foundation), without pruning references.
  // Remote roots may lack targets restored by local edits; repairing here would
  // erase concurrent commands before conflict detection or candidate validation.
  const canonicalBase = canonicalizeForMapComparison(baseProject);
  const canonicalLocal = canonicalizeForMapComparison(persistedProject);
  const changedMapIds = input.changedMapIds ?? changedMapIdsBetween(canonicalBase, canonicalLocal);
  const changedMapTreeIds = changedMapTreeIdsBetween(canonicalBase.mapTree, canonicalLocal.mapTree);
  for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
    // Conflict/merge against current_json only (no maps overlay). RTT cut: drop
    // saveChangedMapRowsFromCanonical's before/after full-snapshot pair.
    const latestRow = await loadProjectRowFromSupabase(config);
    // A remotely activated canonical target must not be patched from stale legacy content.
    if (latestRow && isRecord(latestRow.current_json) && Object.hasOwn(latestRow.current_json, "spatialAuthoring")) {
      throw new ProjectRoutingError("activation-required", "The legacy target was activated remotely. Reload before editing; stale content cannot acquire its new token.");
    }
    const latestProject = latestRow ? readMapPatchSnapshot(latestRow.current_json) : canonicalBase;
    const latestSha = latestRow?.current_sha256 ?? null;

    const conflicts = mapSaveConflicts(canonicalBase, canonicalLocal, latestProject, changedMapIds);
    if (conflicts.length > 0) return { kind: "conflict", conflicts };

    const candidate = mergeProjectMaps(latestProject, persistedProject, changedMapIds, changedMapTreeIds);
    const audioDescriptions = applyAudioDescriptionDelta(
      baseProject.audioDescriptions,
      persistedProject.audioDescriptions,
      latestProject.audioDescriptions,
    );
    // mergeProjectMaps returns a detached root; never mutate any input snapshot.
    if (audioDescriptions === undefined) delete candidate.audioDescriptions;
    else candidate.audioDescriptions = audioDescriptions;
    const monsterMetadata = applyMonsterMetadataDelta(
      baseProject.monsterMetadata,
      persistedProject.monsterMetadata,
      latestProject.monsterMetadata,
    );
    if (monsterMetadata === undefined) delete candidate.monsterMetadata;
    else candidate.monsterMetadata = monsterMetadata;
    // Do not let load repair silently discard invalid intended references. Only
    // the fully validated merge may enter the existing SHA-conditional write.
    validateProjectReferences(candidate);
    const mergedProject = deserializeStoredProjectJson(candidate);
    const wire = await projectWire(mergedProject);
    const saved = await saveProjectSnapshotToSupabase(config, mergedProject, latestSha, wire);
    if (!saved) continue;
    try {
      // maps table = map-content SoT mirror written after successful project snapshot.
      await saveChangedMapRows(config, mergedProject, changedMapIds);
    } catch (error) {
      if (!isOptionalTableMissingError(error)) throw error;
    }
    return { kind: "saved", project: mergedProject, sha256: wire.sha256 };
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

export type SupabaseAiActivityLogInput = {
  readonly logId: string;
  /** 탭 1개당 uuid 하나. 같은 project_id 를 쓰는 다른 워크트리/탭의 턴과 갈라내는 유일한 키. */
  readonly runId?: string;
  readonly channel: string;
  readonly instruction: string;
  readonly mapId?: string;
  readonly payload: unknown;
};

/** 채팅/영역 AI 활동 로그 1건. 과거 폴백 행은 조회만 하고 새 로그는 전용 테이블에만 쓴다. */
export const AI_ACTIVITY_FALLBACK_TILESET_ID = "__ai_activity__";

/** run_id 컬럼이 없는 DB 를 한 번 확인하면 이후 요청에서 그 키를 빼서 왕복을 아낀다. */
let aiActivityRunIdColumnMissing = false;

export async function recordSupabaseAiActivityLog(
  input: SupabaseAiActivityLogInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  try {
    await upsertRows(config, "ai_activity_logs", "log_id", [
      aiActivityLogRow(config.projectId, input, { omitRunId: aiActivityRunIdColumnMissing }),
    ]);
    return { kind: "saved" };
  } catch (error) {
    if (input.runId && !aiActivityRunIdColumnMissing && isUnknownColumnError(error, "run_id")) {
      aiActivityRunIdColumnMissing = true;
      await upsertRows(config, "ai_activity_logs", "log_id", [
        aiActivityLogRow(config.projectId, input, { omitRunId: true }),
      ]);
      return { kind: "saved" };
    }
    const missingPrimary =
      (error instanceof SupabaseProjectSyncError && error.status === 404) || isOptionalTableMissingError(error);
    if (!missingPrimary) throw error;
    throw new SupabaseMigrationRequiredError(
      "rpg_zzu.ai_activity_logs",
      "20260709000000_ai_activity_logs.sql",
    );
  }
}

/** 테스트 전용 — 컬럼 없음 캐시를 되돌린다. */
export function resetAiActivityRunIdColumnProbeForTest(): void {
  aiActivityRunIdColumnMissing = false;
}

/**
 * 전용 테이블 + 폴백 테이블에서 최근 AI 활동 로그를 읽어 온다.
 *
 * `runId` 를 주면 그 런의 턴만 본다 — 같은 project_id 를 여러 워크트리·탭이 공유하므로
 * 필터 없는 최신 정렬은 옆 런의 e2e 턴을 준다. 폴백 테이블(ai_analysis_runs)에는 런 정보가
 * 없으므로 runId 를 준 호출에서는 폴백을 섞지 않는다.
 */
export async function listSupabaseAiActivityLogs(
  limit = 20,
  config = supabaseProjectConfig(),
  options: { readonly runId?: string } = {},
): Promise<readonly Record<string, unknown>[]> {
  if (!config) return [];
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  let primary: Record<string, unknown>[] = [];
  let fallback: Record<string, unknown>[] = [];
  try {
    const primaryParams = new URLSearchParams({
      project_id: `eq.${config.projectId}`,
      // run_id 는 필터를 걸 때만 select 에 넣는다 — 20260829000000 미적용 DB 에서
      // 없는 컬럼을 select 하면 400 이고, 이 경로는 오류를 삼키므로 목록이 통째로 빈다.
      select: options.runId
        ? "log_id,run_id,channel,instruction,map_id,payload_json,created_at"
        : "log_id,channel,instruction,map_id,payload_json,created_at",
      order: "created_at.desc",
      limit: String(n),
      ...(options.runId ? { run_id: `eq.${options.runId}` } : {}),
    });
    primary = await fetchJsonArray(`${config.url}/rest/v1/ai_activity_logs?${primaryParams.toString()}`, config);
  } catch {
    /* primary missing or network — still try fallback */
  }
  if (options.runId) return primary.slice(0, n);
  try {
    const fallbackParams = new URLSearchParams({
      project_id: `eq.${config.projectId}`,
      tileset_id: `eq.${AI_ACTIVITY_FALLBACK_TILESET_ID}`,
      select: "run_id,project_id,prompt_context_json,result_json,created_at",
      order: "created_at.desc",
      limit: String(n),
    });
    const rows = await fetchJsonArray(`${config.url}/rest/v1/ai_analysis_runs?${fallbackParams.toString()}`, config);
    fallback = rows.map((row) => ({
      log_id: row.run_id,
      channel: isRecord(row.prompt_context_json) ? row.prompt_context_json.channel : undefined,
      instruction: isRecord(row.prompt_context_json) ? row.prompt_context_json.instruction : undefined,
      map_id: isRecord(row.prompt_context_json) ? row.prompt_context_json.mapId : undefined,
      payload_json: row.result_json,
      created_at: row.created_at,
      source: "ai_analysis_runs_fallback",
    }));
  } catch {
    /* ignore */
  }
  return mergeAiActivityLogRows(primary, fallback, n);
}

function mergeAiActivityLogRows(
  primary: readonly Record<string, unknown>[],
  fallback: readonly Record<string, unknown>[],
  limit: number,
): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of fallback) {
    const id = typeof row.log_id === "string" ? row.log_id : null;
    if (id) byId.set(id, row);
  }
  for (const row of primary) {
    const id = typeof row.log_id === "string" ? row.log_id : null;
    if (id) byId.set(id, { ...row, source: row.source ?? "ai_activity_logs" });
  }
  return [...byId.values()]
    .sort((a, b) => {
      const at = typeof a.created_at === "string" ? a.created_at : "";
      const bt = typeof b.created_at === "string" ? b.created_at : "";
      return bt.localeCompare(at);
    })
    .slice(0, limit);
}

async function fetchJsonArray(url: string, config: SupabaseProjectConfig, signal?: AbortSignal, strict = false): Promise<Record<string, unknown>[]> {
  const response = await fetch(url, { headers: supabaseJsonHeaders(config, "read"), signal });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  const parsed: unknown = await response.json();
  if (strict && (!Array.isArray(parsed) || !parsed.every(isRecord))) {
    throw new SupabaseProjectSyncError("Invalid conversation response");
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isRecord);
}

// ── AI 대화 기록 미러 (로컬 정본, 여기는 기기 간 복원/검색용) ────────────────
export type SupabaseConversationInput = {
  readonly conversationId: string;
  /** Captured before local persistence. No credentials are serialized into the outbox. */
  readonly destinationProjectId?: string | null;
  readonly title: string;
  readonly model: string;
  readonly projectContextKey?: string;
  readonly entries: unknown;
  /** epoch ms */
  readonly savedAt: number;
};

export async function recordSupabaseConversation(
  input: SupabaseConversationInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config || input.destinationProjectId === null) return { kind: "not-configured" };
  const projectId = input.destinationProjectId ?? (input.projectContextKey?.startsWith("remote:") ? input.projectContextKey.slice(7) : config.projectId);
  const destination = { ...config, projectId };
  try {
    await upsertRows(destination, "ai_conversations", "conversation_id", [
      {
        conversation_id: input.conversationId,
        project_id: destination.projectId,
        title: input.title.slice(0, 200),
        model: input.model,
        project_context_key: input.projectContextKey ?? null,
        entries_json: input.entries,
        saved_at: new Date(input.savedAt).toISOString(),
      },
    ]);
    return { kind: "saved" };
  } catch (error) {
    if ((error instanceof SupabaseProjectSyncError && error.status === 404) || isOptionalTableMissingError(error)) {
      throw new SupabaseMigrationRequiredError(
        "rpg_zzu.ai_conversations",
        "20260713000000_ai_conversations_user_skills.sql",
      );
    }
    throw error;
  }
}

/** 대화 요약 목록 — query가 있으면 제목 부분일치(ilike) 검색. entries_json은 내리지 않는다. */
export async function listSupabaseConversations(
  opts: { readonly query?: string; readonly limit?: number; readonly offset?: number; readonly signal?: AbortSignal; readonly includeEntries?: boolean; readonly projectContextKey?: string } = {},
  config = supabaseProjectConfig(),
): Promise<readonly Record<string, unknown>[]> {
  if (!config) throw new Error("Conversation recovery is not configured");
  opts.signal?.throwIfAborted();
  const n = Math.max(1, Math.min(100, Math.floor(opts.limit ?? 50)));
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    select: `project_id,conversation_id,title,model,project_context_key,saved_at${opts.includeEntries ? ",entries_json" : ""}`,
    order: "saved_at.desc,conversation_id.asc",
    limit: String(n),
    offset: String(Math.max(0, Math.floor(opts.offset ?? 0))),
  });
  const query = opts.query?.trim();
  if (query) params.set("title", `ilike.*${query.replaceAll("*", "").replaceAll(",", "")}*`);
  if (opts.projectContextKey !== undefined) params.set("project_context_key", `eq.${opts.projectContextKey}`);
  return fetchJsonArray(`${config.url}/rest/v1/ai_conversations?${params.toString()}`, config, opts.signal, true);
}

/** 대화 1건 전체(entries_json 포함) — 로컬에 없는 대화를 다른 기기에서 복원할 때. */
export async function loadSupabaseConversation(
  conversationId: string,
  config = supabaseProjectConfig(),
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  if (!config) throw new Error("Conversation recovery is not configured");
  signal?.throwIfAborted();
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    conversation_id: `eq.${conversationId}`,
    select: "project_id,conversation_id,title,model,project_context_key,entries_json,saved_at",
    limit: "1",
  });
  const rows = await fetchJsonArray(`${config.url}/rest/v1/ai_conversations?${params.toString()}`, config, signal, true);
  return rows[0] ?? null;
}

/** 원격 최신 commit tip 을 세션 맵에 심는다 — 리로드 후 parent_commit 계보 유지. */
export async function hydrateLastRemoteCommitTip(
  config = supabaseProjectConfig(),
): Promise<string | null> {
  if (!config) return null;
  try {
    const commits = await listProjectCommitsFromSupabase(1, config);
    const tip = commits[0]?.commitId ?? null;
    if (tip) lastRemoteCommitIdByProject.set(config.projectId, tip);
    return tip;
  } catch {
    return null;
  }
}

export function peekLastRemoteCommitTip(projectId: string): string | null {
  return lastRemoteCommitIdByProject.get(projectId) ?? null;
}

export function seedLastRemoteCommitTip(projectId: string, commitId: string | null | undefined): void {
  if (!commitId) return;
  lastRemoteCommitIdByProject.set(projectId, commitId);
}

export async function recordProjectCommitToSupabase(
  input: SupabaseProjectCommitInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const serialized = input.serialized ?? serialize(projectWithoutEventDrafts(input.project));
  const commitId = randomUuid();
  const currentSha256 = await sha256Hex(serialized);
  const parentCommitId = input.parentCommitId ?? lastRemoteCommitIdByProject.get(config.projectId) ?? null;
  try {
    await insertRows(config, "project_commits", [
      projectCommitRow(config.projectId, commitId, currentSha256, input, parentCommitId),
    ]);
    await insertRows(config, "project_changes", [projectChangeRow(config.projectId, commitId, input)]);
  } catch (error) {
    if (isOptionalTableMissingError(error)) return { kind: "not-configured" };
    throw error;
  }
  lastRemoteCommitIdByProject.set(config.projectId, commitId);
  return { kind: "saved", commitId };
}

export async function listProjectCommitsFromSupabase(
  limit = 20,
  config = supabaseProjectConfig(),
): Promise<readonly SupabaseProjectCommitListItem[]> {
  if (!config) throw new SupabaseProjectSyncError("온라인 저장 연결이 필요합니다");
  const response = await fetch(supabaseProjectCommitsListUrl(config, limit), {
    headers: supabaseJsonHeaders(config, "read"),
  });
  if (!response.ok) throw new SupabaseProjectSyncError(await response.text(), response.status);
  const rows = parseProjectCommitRows(await response.json());
  const tip = rows[0]?.commitId;
  if (tip) lastRemoteCommitIdByProject.set(config.projectId, tip);
  return rows;
}

function supabaseProjectUrl(config: SupabaseProjectConfig, includeProjectId = false): string {
  const query = new URLSearchParams({
    select: includeProjectId ? "project_id,current_json,current_sha256" : "current_json,current_sha256",
    project_id: `eq.${config.projectId}`,
  });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

function supabaseProjectListUrl(config: SupabaseProjectListConfig): string {
  // List picker never pulls current_json — those blobs are ~20MB+ each and hang the
  // "목록 불러오기" UI over Tailscale/dbserver. The extra scalar columns are free by
  // comparison and give each card its map/tileset counts and last-updated stamp.
  const query = new URLSearchParams({
    order: "updated_at.desc",
    select: "project_id,title,map_count,tileset_count,updated_at",
  });
  return `${config.url}/rest/v1/projects?${query.toString()}`;
}

/** 프로젝트의 대표 맵(가장 큰 맵) 1장 + 그 타일셋만 받아온다. 맵 1행은 약 5KB. */
function supabaseProjectPreviewMapsUrl(config: SupabaseProjectListConfig, projectId: string): string {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    select: "map_id,tileset_id,width,height",
  });
  return `${config.url}/rest/v1/maps?${query.toString()}`;
}

function supabaseProjectPreviewMapUrl(config: SupabaseProjectListConfig, projectId: string, mapId: string): string {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    map_id: `eq.${mapId}`,
    select: "map_json",
    limit: "1",
  });
  return `${config.url}/rest/v1/maps?${query.toString()}`;
}

function supabaseProjectPreviewTilesetUrl(config: SupabaseProjectListConfig, projectId: string, tilesetId: string): string {
  const query = new URLSearchParams({
    project_id: `eq.${projectId}`,
    tileset_id: `eq.${tilesetId}`,
    select: "tileset_json",
    limit: "1",
  });
  return `${config.url}/rest/v1/tilesets?${query.toString()}`;
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
      project_id: typeof entry.project_id === "string" ? entry.project_id : null,
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
      project_id: entry.project_id,
      title: typeof entry.title === "string" ? entry.title : null,
      map_count: typeof entry.map_count === "number" ? entry.map_count : null,
      tileset_count: typeof entry.tileset_count === "number" ? entry.tileset_count : null,
      updated_at: typeof entry.updated_at === "string" ? entry.updated_at : null,
    };
  });
}

function supabaseProjectListTitle(row: SupabaseProjectListRow): string {
  return trimmedOrUndefined(row.title) ?? row.project_id;
}

function trimmedOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

async function saveProjectSnapshotToSupabase(
  config: SupabaseProjectConfig,
  project: Project,
  expectedCurrentSha256: string | null,
  wire?: ProjectWire,
): Promise<boolean> {
  const resolvedWire = wire ?? await projectWire(project);
  const payload = projectUpsertPayload(config.projectId, project, resolvedWire);
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

function projectUpsertPayload(projectId: string, project: Project, wire: ProjectWire): Record<string, unknown> {
  const terrainTemplateCount = Object.values(project.tilesets).reduce((sum, tileset) => {
    const templates = (tileset as { terrainTemplates?: unknown }).terrainTemplates;
    return sum + (Array.isArray(templates) ? templates.length : 0);
  }, 0);
  return {
    project_id: projectId,
    title: project.meta.title.trim() || DEFAULT_PROJECT_TITLE,
    schema_version: project.version,
    current_json: wire.json,
    current_sha256: wire.sha256,
    // DB에 on-update 트리거가 없어 앱이 직접 유지한다 — 안 보내면 작업 목록의
    // "n분 전" 표시와 저장 시각 감사가 영구히 멈춘다(2026-08-18 UX 리뷰 P0-2).
    updated_at: new Date().toISOString(),
    map_count: Object.keys(project.maps).length,
    tileset_count: Object.keys(project.tilesets).length,
    // DB NOT NULL — upsert 시 null 금지 (둥근 호수 저장 등 전체 저장 경로).
    terrain_template_count: terrainTemplateCount,
  };
}

async function saveProjectChildRows(config: SupabaseProjectConfig, project: Project): Promise<void> {
  await replaceRows(config, "maps", "project_id,map_id", await Promise.all(Object.values(project.maps).map((map) => mapRow(config.projectId, map))));
  await replaceRows(config, "tilesets", "project_id,tileset_id", Object.values(project.tilesets).map((tileset) => tilesetRow(config.projectId, tileset)));
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
    headers: { ...supabaseJsonHeaders(config, "write"), Prefer: "return=minimal" },
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

function aiActivityLogRow(
  projectId: string,
  input: SupabaseAiActivityLogInput,
  options: { readonly omitRunId?: boolean } = {},
): Record<string, unknown> {
  return {
    log_id: input.logId,
    project_id: projectId,
    channel: input.channel,
    instruction: input.instruction.slice(0, 4000),
    map_id: input.mapId ?? null,
    // run_id 는 20260829000000 이후에만 존재한다. 미적용 DB 에서는 PostgREST 가 PGRST204 로
    // 400 을 주므로, 그때는 이 키를 빼고 한 번 더 보낸다(로그가 아예 안 남는 것보다 낫다).
    ...(input.runId && options.omitRunId !== true ? { run_id: input.runId } : {}),
    payload_json: input.payload,
  };
}

function projectCommitRow(
  projectId: string,
  commitId: string,
  currentSha256: string,
  input: SupabaseProjectCommitInput,
  parentCommitId: string | null = null,
): Record<string, unknown> {
  return {
    commit_id: commitId,
    project_id: projectId,
    parent_commit_id: parentCommitId,
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
      // 편집 행위 기록. diff 는 **결과**만 담는다 — "타일 3000" 은 알려주지만 어떤 행위가
      // 그렇게 만들었는지는 못 짚는다(2026-08-29 관측성 감사). 이 축이 원인 쪽이다.
      // 리더: `npm run commit:log -- --edits`.
      ...(input.editActivity
        ? {
            edits: input.editActivity.entries,
            ...(input.editActivity.omitted > 0 ? { editsOmitted: input.editActivity.omitted } : {}),
          }
        : {}),
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

/**
 * Symmetric map comparison keeps load-compatible shape defaults without erasing
 * references before root ownership is resolved. Malformed local intermediates
 * retain the existing comparison fallback; the completed candidate must validate.
 */
function canonicalizeForMapComparison(project: Project): MapPatchSnapshot {
  try {
    return readMapPatchSnapshot(JSON.parse(serialize(project)) as unknown);
  } catch {
    return project;
  }
}

type MapPatchSnapshot = Pick<Project, "maps" | "mapTree"> & Partial<Pick<Project, "audioDescriptions" | "monsterMetadata">>;

// Map merging only needs maps/mapTree, but the audio-description and monster-metadata
// deltas compare the same remote snapshot, so those optional roots stay visible.
function readMapPatchSnapshot(value: unknown): MapPatchSnapshot {
  if (!isRecord(value) || value.version !== SCHEMA_VERSION) return deserializeStoredProjectJson(value);
  const snapshot = structuredClone(value);
  // Keep compatibility foundation changes, but never use ordinary load repair
  // to prune map references against roots that the local candidate may restore.
  repairStoredLoadFoundation(snapshot);
  return readProjectV4MapMergeSnapshot(snapshot);
}

async function loadMapRowsFromSupabase(config: SupabaseProjectConfig, signal?: AbortSignal): Promise<readonly Record<string, unknown>[]> {
  const query = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    select: "map_id,map_json",
  });
  return await fetchJsonArray(`${config.url}/rest/v1/maps?${query.toString()}`, config, signal);
}

function overlayMapsFromRows(project: Project, rows: readonly Record<string, unknown>[]): void {
  for (const row of rows) {
    const mapId = typeof row.map_id === "string" ? row.map_id : null;
    const mapJson = row.map_json;
    if (!mapId || !isRecord(mapJson)) continue;
    const map = mapJson as unknown as GameMap;
    if (typeof map.id !== "string" || typeof map.width !== "number" || typeof map.height !== "number") continue;
    project.maps[mapId] = map;
  }
}

function supabaseListValue(value: string): string {
  // 백슬래시를 먼저 이스케이프해야 한다 — 순서를 바꾸면 원본 backslash가
  // 뒤이은 큰따옴표 이스케이프의 백슬래시까지 삼켜 PostgREST in.() 리스트 파싱이 깨진다.
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function isOptionalTableMissingError(error: unknown): boolean {
  return error instanceof SupabaseProjectSyncError && error.status === 404 && error.message.includes("PGRST205");
}

/**
 * PostgREST 가 "그 컬럼 없음" 으로 거절했는지. 쓰기 경로는 PGRST204 로 400 을 준다.
 * 마이그레이션이 밀린 DB 에서 새 컬럼 때문에 기능 전체가 죽지 않게 하는 판별기다.
 */
function isUnknownColumnError(error: unknown, column: string): boolean {
  if (!(error instanceof SupabaseProjectSyncError) || error.status !== 400) return false;
  if (!error.message.includes(column)) return false;
  return error.message.includes("PGRST204") || /does not exist|could not find/iu.test(error.message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
