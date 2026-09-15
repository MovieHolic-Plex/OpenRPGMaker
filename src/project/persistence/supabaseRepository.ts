import { dbPersistenceStatus, type DbPersistenceDisabledReason } from "../persistenceStatus";
import { activateSpatialProjectFromRaw } from "../spatial/saveRouting";
import { supabaseProjectConfig } from "../supabaseProjectConfig";
import {
  hydrateLastRemoteCommitTip,
  listProjectCommitsFromSupabase,
  listSupabaseAiActivityLogs,
  listSupabaseConversations,
  loadProjectForPersistenceProof,
  loadProjectFromSupabase,
  loadProjectSnapshotFromSupabase,
  loadSupabaseConversation,
  peekLastRemoteCommitTip,
  recordProjectCommitToSupabase,
  recordSupabaseAiActivityLog,
  recordSupabaseAiAnalysisRun,
  recordSupabaseConversation,
  saveProjectMapPatchToSupabase,
  saveProjectToSupabase,
  seedLastRemoteCommitTip,
} from "../supabaseProjectSync";
import type { ProjectTarget } from "./target";
import type { ProjectRepository } from "./types";

/**
 * 기존 Supabase sync 모듈을 포트 뒤에 그대로 감싼다. 동작 변화 없음이 목표다.
 *
 * 규칙 둘. (1) sync 함수는 메서드 **본문 안에서** named import 로 부른다 — 모듈 로드 시점에
 * 표로 만들거나 구조 분해로 캐시하면 vi.mock/vi.spyOn 이 바꿔 끼운 함수를 못 본다.
 * (2) 인자는 호출부가 넘긴 그대로 전달한다 — `target` 이 undefined 면 undefined 를 넘겨
 * sync 의 기본 매개변수(`config = supabaseProjectConfig()`)가 대상을 채우게 한다.
 */
export function createSupabaseRepository(): ProjectRepository {
  return {
    kind: "remote",
    currentTarget: (): ProjectTarget | null => supabaseProjectConfig(),
    status: (disabledReason: DbPersistenceDisabledReason | null) => dbPersistenceStatus({ disabledReason }),
    async probe() {
      const config = supabaseProjectConfig();
      if (!config) return false;
      try {
        // GET with limit=0 on a known table in the rpg_zzu schema. Must include Accept-Profile
        // (same as supabaseJsonHeaders "read") so PostgREST resolves the table correctly.
        const response = await fetch(`${config.url}/rest/v1/projects?limit=0`, {
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${config.anonKey}`,
            Accept: "application/json",
            "Accept-Profile": "rpg_zzu",
          },
          signal: AbortSignal.timeout(8000),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    loadProject: (target, onAuthority) => loadProjectFromSupabase(target, onAuthority),
    loadSnapshot: (target, options) => (options === undefined ? loadProjectSnapshotFromSupabase(target) : loadProjectSnapshotFromSupabase(target, options)),
    loadForProof: (target, signal) => loadProjectForPersistenceProof(target, signal),
    save: (project, target, authority) => saveProjectToSupabase(project, target, authority),
    saveMapPatch: (input, target) => saveProjectMapPatchToSupabase(input, target),
    activateLegacy: (target) => activateSpatialProjectFromRaw(target),
    commits: {
      record: (input, target) => recordProjectCommitToSupabase(input, target),
      list: (limit, target) => listProjectCommitsFromSupabase(limit, target),
      hydrateTip: (target) => hydrateLastRemoteCommitTip(target),
      peekTip: (projectId) => peekLastRemoteCommitTip(projectId),
      seedTip: (projectId, commitId) => seedLastRemoteCommitTip(projectId, commitId),
    },
    ai: {
      recordActivity: (input, target) => recordSupabaseAiActivityLog(input, target),
      listActivity: (limit, target, options) => listSupabaseAiActivityLogs(limit, target, options),
      recordConversation: (input, target) => recordSupabaseConversation(input, target),
      listConversations: (options, target) => listSupabaseConversations(options, target),
      loadConversation: (conversationId, target, signal) => loadSupabaseConversation(conversationId, target, signal),
      recordAnalysisRun: (input, target) => recordSupabaseAiAnalysisRun(input, target),
    },
  };
}
