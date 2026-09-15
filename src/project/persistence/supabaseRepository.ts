import { supabaseProjectConfig } from "../supabaseProjectConfig";
import { dbPersistenceStatus } from "../persistenceStatus";
import type { ProjectRepository } from "./types";

export function createSupabaseRepository(): ProjectRepository {
  const notWired = (name: string) => () => Promise.reject(new Error(`supabaseRepository.${name} 는 Task 7 에서 연결된다`));
  return {
    kind: "remote",
    currentTarget: () => supabaseProjectConfig(),
    status: (disabledReason) => dbPersistenceStatus({ disabledReason }),
    probe: notWired("probe"),
    loadProject: notWired("loadProject"),
    loadSnapshot: notWired("loadSnapshot"),
    loadForProof: notWired("loadForProof"),
    save: notWired("save"),
    saveMapPatch: notWired("saveMapPatch"),
    commits: { record: notWired("commits.record"), list: notWired("commits.list"), hydrateTip: notWired("commits.hydrateTip"), peekTip: () => null, seedTip: () => undefined },
    ai: { recordActivity: notWired("ai.recordActivity"), listActivity: notWired("ai.listActivity"), recordConversation: notWired("ai.recordConversation"), listConversations: notWired("ai.listConversations"), loadConversation: notWired("ai.loadConversation"), recordAnalysisRun: notWired("ai.recordAnalysisRun") },
  };
}
