import { deserialize, serialize } from "./io";
import { defaultResourceProfiles, removeLegacySpriteReferences } from "./defaults/defaultAssets";
import { projectWithoutEventDrafts } from "./eventDrafts";
import { supabaseProjectConfig, type SupabaseProjectConfig } from "./supabaseProjectConfig";
import { sha256HexText } from "../util/sha256";
import { randomUuid } from "../util/id";
import type { ChangeSummary } from "@/project/types";
import type { EditorIdentity } from "./editorIdentity";
import type { GameMap, MapTreeNode, Project, TilesetDef } from "./types";

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

type SupabaseChildTable = "ai_activity_logs" | "ai_analysis_runs" | "ai_conversations" | "maps" | "tilesets" | "user_skills";
type SupabaseCommitTable = "project_changes" | "project_commits";
const MAP_PATCH_MAX_ATTEMPTS = 4;
/** project_id → 마지막 성공 insert 커밋 id (parent 계보). */
const lastRemoteCommitIdByProject = new Map<string, string>();

export type SupabaseMapSaveConflict = {
  readonly mapId: string;
  readonly name: string;
};

export type SupabaseSaveResult =
  | { readonly kind: "not-configured" }
  | { readonly kind: "conflict"; readonly conflicts: readonly SupabaseMapSaveConflict[] }
  | { readonly kind: "saved"; readonly project?: Project; readonly sha256?: string; readonly commitId?: string };

export type SupabaseProjectMapPatchInput = {
  readonly baseProject: Project;
  readonly changedMapIds?: readonly string[];
  readonly project: Project;
};

type ProjectWire = {
  readonly json: unknown;
  readonly serialized: string;
  readonly sha256: string;
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
  const project = (await loadProjectSnapshotFromSupabase(config))?.project ?? null;
  if (project && config) void hydrateLastRemoteCommitTip(config);
  return project;
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

async function loadProjectSnapshotFromSupabase(
  config = supabaseProjectConfig(),
  options: { readonly overlayMaps?: boolean } = {},
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
  const project = deserialize(JSON.stringify(repairSupabaseCurrentJson(row.current_json)));
  // Hybrid maps SoT (editor open / public load): maps table map_json overlays current_json map bodies.
  // Patch/conflict loads pass overlayMaps:false so concurrent merge still compares current_json.
  if (options.overlayMaps !== false) {
    try {
      const mapRows = await loadMapRowsFromSupabase(config);
      if (mapRows.length > 0) overlayMapsFromRows(project, mapRows);
    } catch (error) {
      if (!isOptionalTableMissingError(error)) throw error;
    }
  }
  return {
    project,
    sha256: row.current_sha256,
  };
}

export async function saveProjectToSupabase(project: Project, config = supabaseProjectConfig()): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const persistedProject = projectWithoutEventDrafts(project);
  removeLegacySpriteReferences(persistedProject);
  const wire = await projectWire(persistedProject);
  const response = await fetch(supabaseUpsertUrl(config), {
    method: "POST",
    headers: supabaseJsonHeaders(config, "write"),
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
  return { kind: "saved", project: persistedProject, sha256: wire.sha256 };
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
  // 비교 정규화(todo 8 실측 결함): 로드 경로(repairSupabaseCurrentJson + deserialize →
  // validateProjectV3)는 저장본을 로드할 때 맵을 **변형**한다 — normalizeShopCommands가
  // shop 커맨드에 branchOnTransaction/transactionBranch/branchOnFailedTransaction/
  // failedTransactionBranch 기본 필드를 주입하고, stampCharacterIdsForSocialEvents가
  // characterId를 스탬프하며, repairProjectReferences가 끊긴 참조를 정리한다. 에디터
  // 메모리의 persistedBaseline/로컬 프로젝트는 이 변형을 거치지 않으므로 같은 논리 맵도
  // JSON 문자열이 달라져 매 flush가 가짜 conflict로 끝났다(데모 행이 첫 마일스톤 이후
  // 저장 불가). base/로컬을 동일한 serialize→deserialize 파이프라인에 통과시켜 비교를
  // 대칭으로 만든다 — 로드가 이미 정규형인 latest와 어느 쪽도 깨지지 않는다.
  // 검증을 통과하지 못하는 중간 상태(끊긴 참조 등)는 원본 그대로 폴백해 기존 conflict
  // 동작을 유지한다(새 예외를 만들지 않는다).
  const canonicalBase = canonicalizeForMapComparison(baseProject);
  const canonicalLocal = canonicalizeForMapComparison(persistedProject);
  const changedMapIds = input.changedMapIds ?? changedMapIdsBetween(canonicalBase, canonicalLocal);
  const changedMapTreeIds = changedMapTreeIdsBetween(canonicalBase.mapTree, canonicalLocal.mapTree);
  for (let attempt = 0; attempt < MAP_PATCH_MAX_ATTEMPTS; attempt += 1) {
    // Conflict/merge against current_json only (no maps overlay). RTT cut: drop
    // saveChangedMapRowsFromCanonical's before/after full-snapshot pair.
    const latestSnapshot = await loadProjectSnapshotFromSupabase(config, { overlayMaps: false });
    const latestProject = latestSnapshot?.project ?? canonicalBase;
    const latestSha = latestSnapshot?.sha256 ?? null;

    const conflicts = mapSaveConflicts(canonicalBase, canonicalLocal, latestProject, changedMapIds);
    if (conflicts.length > 0) return { kind: "conflict", conflicts };

    const mergedProject = mergeProjectMaps(latestProject, persistedProject, changedMapIds, changedMapTreeIds);
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
  readonly channel: string;
  readonly instruction: string;
  readonly mapId?: string;
  readonly payload: unknown;
};

/**
 * 채팅/영역 AI 활동 로그 1건.
 * 1) `ai_activity_logs` 전용 테이블
 * 2) 없으면 기존 `ai_analysis_runs` 에 폴백 저장 (tileset_id = `__ai_activity__`)
 *    — 마이그레이션 전에도 PostgREST로 조회 가능하게.
 */
export const AI_ACTIVITY_FALLBACK_TILESET_ID = "__ai_activity__";

export async function recordSupabaseAiActivityLog(
  input: SupabaseAiActivityLogInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  try {
    await upsertRows(config, "ai_activity_logs", "log_id", [aiActivityLogRow(config.projectId, input)]);
    return { kind: "saved" };
  } catch (error) {
    const missingPrimary =
      (error instanceof SupabaseProjectSyncError && error.status === 404) || isOptionalTableMissingError(error);
    if (!missingPrimary) throw error;
  }
  // 폴백: 이미 존재하는 ai_analysis_runs 에 진단 페이로드를 심는다.
  try {
    await upsertRows(config, "ai_analysis_runs", "run_id", [
      {
        run_id: input.logId,
        project_id: config.projectId,
        tileset_id: AI_ACTIVITY_FALLBACK_TILESET_ID,
        selected_tile_ids_json: [],
        prompt_context_json: {
          kind: "ai-activity-log",
          channel: input.channel,
          instruction: input.instruction.slice(0, 4000),
          mapId: input.mapId ?? null,
        },
        result_json: input.payload,
      },
    ]);
    return { kind: "saved" };
  } catch (error) {
    if (error instanceof SupabaseProjectSyncError && error.status === 404) {
      return { kind: "not-configured" };
    }
    if (isOptionalTableMissingError(error)) return { kind: "not-configured" };
    throw error;
  }
}

/** 전용 테이블 + 폴백 테이블에서 최근 AI 활동 로그를 읽어 온다. */
export async function listSupabaseAiActivityLogs(
  limit = 20,
  config = supabaseProjectConfig(),
): Promise<readonly Record<string, unknown>[]> {
  if (!config) return [];
  const n = Math.max(1, Math.min(100, Math.floor(limit)));
  let primary: Record<string, unknown>[] = [];
  let fallback: Record<string, unknown>[] = [];
  try {
    const primaryParams = new URLSearchParams({
      project_id: `eq.${config.projectId}`,
      select: "log_id,channel,instruction,map_id,payload_json,created_at",
      order: "created_at.desc",
      limit: String(n),
    });
    primary = await fetchJsonArray(`${config.url}/rest/v1/ai_activity_logs?${primaryParams.toString()}`, config);
  } catch {
    /* primary missing or network — still try fallback */
  }
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

async function fetchJsonArray(url: string, config: SupabaseProjectConfig): Promise<Record<string, unknown>[]> {
  const response = await fetch(url, { headers: supabaseJsonHeaders(config, "read") });
  if (!response.ok) {
    throw new SupabaseProjectSyncError(await response.text(), response.status);
  }
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isRecord);
}

// ── AI 대화 기록 미러 (로컬 정본, 여기는 기기 간 복원/검색용) ────────────────
export type SupabaseConversationInput = {
  readonly conversationId: string;
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
  if (!config) return { kind: "not-configured" };
  try {
    await upsertRows(config, "ai_conversations", "conversation_id", [
      {
        conversation_id: input.conversationId,
        project_id: config.projectId,
        title: input.title.slice(0, 200),
        model: input.model,
        project_context_key: input.projectContextKey ?? null,
        entries_json: input.entries,
        saved_at: new Date(input.savedAt).toISOString(),
      },
    ]);
    return { kind: "saved" };
  } catch (error) {
    // 마이그레이션 전(테이블 없음)에도 앱이 죽지 않게 활동 로그와 같은 폴백 규약을 따른다.
    if (error instanceof SupabaseProjectSyncError && error.status === 404) return { kind: "not-configured" };
    if (isOptionalTableMissingError(error)) return { kind: "not-configured" };
    throw error;
  }
}

/** 대화 요약 목록 — query가 있으면 제목 부분일치(ilike) 검색. entries_json은 내리지 않는다. */
export async function listSupabaseConversations(
  opts: { readonly query?: string; readonly limit?: number } = {},
  config = supabaseProjectConfig(),
): Promise<readonly Record<string, unknown>[]> {
  if (!config) return [];
  const n = Math.max(1, Math.min(100, Math.floor(opts.limit ?? 50)));
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    select: "conversation_id,title,model,project_context_key,saved_at",
    order: "saved_at.desc",
    limit: String(n),
  });
  const query = opts.query?.trim();
  if (query) params.set("title", `ilike.*${query.replaceAll("*", "").replaceAll(",", "")}*`);
  try {
    return await fetchJsonArray(`${config.url}/rest/v1/ai_conversations?${params.toString()}`, config);
  } catch {
    return [];
  }
}

/** 대화 1건 전체(entries_json 포함) — 로컬에 없는 대화를 다른 기기에서 복원할 때. */
export async function loadSupabaseConversation(
  conversationId: string,
  config = supabaseProjectConfig(),
): Promise<Record<string, unknown> | null> {
  if (!config) return null;
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    conversation_id: `eq.${conversationId}`,
    select: "conversation_id,title,model,project_context_key,entries_json,saved_at",
    limit: "1",
  });
  try {
    const rows = await fetchJsonArray(`${config.url}/rest/v1/ai_conversations?${params.toString()}`, config);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ── 사용자 정의 스킬 미러 ────────────────────────────────────────────────
export type SupabaseUserSkillInput = {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
  readonly template: string;
  /** params/needsSelection 등 확장 필드 원본(하위호환용 통째 저장). */
  readonly skill: unknown;
};

export async function recordSupabaseUserSkill(
  input: SupabaseUserSkillInput,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  try {
    await upsertRows(config, "user_skills", "project_id,skill_id", [
      {
        skill_id: input.id,
        project_id: config.projectId,
        icon: input.icon || "⭐",
        name: input.name.slice(0, 120),
        description: input.description.slice(0, 500),
        template: input.template,
        skill_json: input.skill,
        updated_at: new Date().toISOString(),
      },
    ]);
    return { kind: "saved" };
  } catch (error) {
    if (error instanceof SupabaseProjectSyncError && error.status === 404) return { kind: "not-configured" };
    if (isOptionalTableMissingError(error)) return { kind: "not-configured" };
    throw error;
  }
}

export async function deleteSupabaseUserSkill(
  skillId: string,
  config = supabaseProjectConfig(),
): Promise<SupabaseSaveResult> {
  if (!config) return { kind: "not-configured" };
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    skill_id: `eq.${skillId}`,
  });
  try {
    const response = await fetch(`${config.url}/rest/v1/user_skills?${params.toString()}`, {
      method: "DELETE",
      headers: supabaseJsonHeaders(config, "write"),
    });
    if (!response.ok) throw new SupabaseProjectSyncError(await response.text(), response.status);
    return { kind: "saved" };
  } catch (error) {
    if (error instanceof SupabaseProjectSyncError && error.status === 404) return { kind: "not-configured" };
    if (isOptionalTableMissingError(error)) return { kind: "not-configured" };
    throw error;
  }
}

export async function listSupabaseUserSkills(
  config = supabaseProjectConfig(),
): Promise<readonly Record<string, unknown>[]> {
  if (!config) return [];
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    select: "skill_id,icon,name,description,template,skill_json,updated_at",
    order: "updated_at.desc",
    limit: "100",
  });
  try {
    return await fetchJsonArray(`${config.url}/rest/v1/user_skills?${params.toString()}`, config);
  } catch {
    return [];
  }
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

function supabaseProjectUrl(config: SupabaseProjectConfig): string {
  const query = new URLSearchParams({
    select: "current_json,current_sha256",
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

async function projectWire(project: Project): Promise<ProjectWire> {
  const serialized = serialize(project);
  return {
    serialized,
    json: JSON.parse(serialized) as unknown,
    sha256: await sha256Hex(serialized),
  };
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

function aiActivityLogRow(projectId: string, input: SupabaseAiActivityLogInput): Record<string, unknown> {
  return {
    log_id: input.logId,
    project_id: projectId,
    channel: input.channel,
    instruction: input.instruction.slice(0, 4000),
    map_id: input.mapId ?? null,
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

/**
 * 맵 스냅샷 비교를 위한 정규화(todo 8 실측 결함 수정).
 *
 * 로드 경로(loadProjectSnapshotFromSupabase)는 저장본을 deserialize(→ validateProjectV3)
 * 로 통과시키면서 맵을 **변형**한다: normalizeShopCommands가 shop 커맨드에 branch
 * 필드(branchOnTransaction/transactionBranch/...)를 주입하고,
 * stampCharacterIdsForSocialEvents가 소셜 이벤트에 characterId를 스탬프하며,
 * repairProjectReferences가 끊긴 참조를 정리한다. 에디터 메모리의 persistedBaseline/로컬
 * 프로젝트는 이 변형을 거치지 않으므로, 같은 논리 맵이라도 원본 JSON 문자열이 달라져
 * 매 flush가 가짜 conflict로 끝났다(데모 행이 첫 마일스톤 이후 저장 불가).
 *
 * 세 주체(base/local/latest)를 같은 serialize→deserialize 파이프라인에 통과시키면
 * 비교가 대칭이 된다 — 실제 동시 수정만 conflict로 감지하고, 로드 정규화 차이는
 * 사라진다. 검증을 통과하지 못하는 중간 상태(끊긴 참조 등)는 원본 그대로 폴백해
 * 기존 conflict 동작을 유지한다(새 예외를 만들지 않는다).
 */
function canonicalizeForMapComparison(project: Project): Project {
  try {
    return deserialize(serialize(project));
  } catch {
    return project;
  }
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

async function loadMapRowsFromSupabase(config: SupabaseProjectConfig): Promise<readonly Record<string, unknown>[]> {
  const query = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    select: "map_id,map_json",
  });
  return await fetchJsonArray(`${config.url}/rest/v1/maps?${query.toString()}`, config);
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

function mapSnapshot(map: GameMap | undefined): string {
  return map ? JSON.stringify(map) : "";
}

function mapConflictName(mapId: string, project: Project, latestProject: Project, baseProject: Project): string {
  return project.maps[mapId]?.name ?? latestProject.maps[mapId]?.name ?? baseProject.maps[mapId]?.name ?? mapId;
}

function supabaseListValue(value: string): string {
  // 백슬래시를 먼저 이스케이프해야 한다 — 순서를 바꾸면 원본 backslash가
  // 뒤이은 큰따옴표 이스케이프의 백슬래시까지 삼켜 PostgREST in.() 리스트 파싱이 깨진다.
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function isOptionalTableMissingError(error: unknown): boolean {
  return error instanceof SupabaseProjectSyncError && error.status === 404 && error.message.includes("PGRST205");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function repairSupabaseCurrentJson(value: unknown): unknown {
  if (!isRecord(value)) return value;
  // DB current_json is the canonical source of truth for authored database records
  // (items, skills, states, animations). Do NOT backfill from JSON defaults on load —
  // defaults seed new projects via createBlankProject -> saveProjectToSupabase, and
  // every load returns exactly what the DB row holds. Local is cache-only.
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

function resourceAssetId(value: unknown): string | undefined {
  return isRecord(value) && typeof value.assetId === "string" ? value.assetId : undefined;
}

function cloneRecord(value: unknown): Record<string, unknown> {
  const cloned: unknown = JSON.parse(JSON.stringify(value));
  if (!isRecord(cloned)) throw new SupabaseProjectSyncError("Default project repair record was not an object");
  return cloned;
}
