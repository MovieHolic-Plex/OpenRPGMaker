import { dbPersistenceStatus, type DbPersistenceDisabledReason } from "../persistenceStatus";
import { createMemoryAssetStore } from "./assetMemoryStore";
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
import { isRemoteTarget, type ProjectTarget, type RemoteProjectTarget } from "./target";
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
  // 원격 전용 어댑터다. 로컬 대상이 들어오면 null(명시적 미설정)로 떨어뜨려 not-configured 로 돌려준다.
  const remoteOrNull = (target: ProjectTarget | null | undefined): RemoteProjectTarget | null | undefined => {
    if (target === undefined) return undefined;
    if (target === null) return null;
    return isRemoteTarget(target) ? target : null;
  };
  const requireRemote = (target: ProjectTarget | null): RemoteProjectTarget | null => (target !== null && isRemoteTarget(target) ? target : null);

  return {
    kind: "remote",
    ...createMemoryAssetStore(),
    currentTarget: (): ProjectTarget | null => supabaseProjectConfig(),
    status: (disabledReason: DbPersistenceDisabledReason | null) => dbPersistenceStatus({ disabledReason }),
    async probe() {
      const config = supabaseProjectConfig();
      if (!config) return false;
      try {
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
    loadProject: (target, onAuthority) => {
      const config = requireRemote(target);
      if (!config) return Promise.resolve(null);
      return loadProjectFromSupabase(config, onAuthority);
    },
    loadSnapshot: (target, options) => {
      const config = requireRemote(target);
      if (!config) return Promise.resolve(null);
      return options === undefined ? loadProjectSnapshotFromSupabase(config) : loadProjectSnapshotFromSupabase(config, options);
    },
    loadForProof: (target, signal) => {
      const config = requireRemote(target);
      if (!config) return Promise.resolve(null);
      return loadProjectForPersistenceProof(config, signal);
    },
    save: (project, target, authority) => {
      const config = requireRemote(target);
      if (!config) return Promise.resolve({ kind: "not-configured" });
      return saveProjectToSupabase(project, config, authority);
    },
    saveMapPatch: (input, target) => {
      const config = requireRemote(target);
      if (!config) return Promise.resolve({ kind: "not-configured" });
      return saveProjectMapPatchToSupabase(input, config);
    },
    activateLegacy: (target) => {
      const config = requireRemote(target);
      if (!config) return Promise.reject(new Error("원격 대상이 아닙니다"));
      return activateSpatialProjectFromRaw(config);
    },
    commits: {
      record: (input, target) => recordProjectCommitToSupabase(input, remoteOrNull(target)),
      list: (limit, target) => listProjectCommitsFromSupabase(limit, remoteOrNull(target)),
      hydrateTip: (target) => hydrateLastRemoteCommitTip(remoteOrNull(target)),
      peekTip: (projectId) => peekLastRemoteCommitTip(projectId),
      seedTip: (projectId, commitId) => seedLastRemoteCommitTip(projectId, commitId),
    },
    ai: {
      recordActivity: (input, target) => recordSupabaseAiActivityLog(input, remoteOrNull(target)),
      listActivity: (limit, target, options) => listSupabaseAiActivityLogs(limit, remoteOrNull(target), options),
      recordConversation: (input, target) => recordSupabaseConversation(input, remoteOrNull(target)),
      listConversations: (options, target) => listSupabaseConversations(options, remoteOrNull(target)),
      loadConversation: (conversationId, target, signal) => loadSupabaseConversation(conversationId, remoteOrNull(target), signal),
      recordAnalysisRun: (input, target) => recordSupabaseAiAnalysisRun(input, remoteOrNull(target)),
    },
  };
}
