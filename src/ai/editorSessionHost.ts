import { store } from "@/project/store";
import { supabaseProjectConfigDraft } from "@/project/supabaseProjectConfig";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import { runTool } from "@/editor/tools/toolRunner";
import { computeActiveToolDomains } from "@/editor/assistantToolMode";
import { buildPreferenceMemorySection } from "./preferenceMemory";
import { calibratedBudgetChars, loadTokenObservations, recordTokenObservation } from "./tokenBudget";
import type { SessionExecutionHost } from "./sessionExecutionHost";
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export const editorSessionHost: SessionExecutionHost = {
  kind: "editor",
  readBaseline: () => store.getCurrent(),
  checkpointMilestone: applyProposedProject,
  activeDomains: computeActiveToolDomains,
  preferenceSection: buildPreferenceMemorySection,
  budgetChars: fallback => calibratedBudgetChars(fallback, loadTokenObservations()),
  recordTokens: recordTokenObservation,
  runTool,
  now: () => new Date(),
  async verifyPersistence(ctx, audit, onEvent) {
    if (!store.isRemotePersistenceEnabled()) {
      audit({ kind: "status", text: "agent_run_local_only — remote persistence 비활성으로 저장 증명을 건너뜁니다" });
      onEvent({ type: "status", text: "자율 런 완료 — 로컬 전용 저장(remote persistence 비활성)입니다." });
      return;
    }
    try {
      const flushResult = await store.flush();
      if (flushResult.kind !== "saved") {
        audit({ kind: "status", text: `agent_run:save-skipped kind=${flushResult.kind}` });
        onEvent({ type: "status", text: `자율 런 저장 건너뜀(${flushResult.kind}) — 저장 증명이 없습니다.` });
        return;
      }
      const reloadResult = await store.reloadFromRemote();
      const projectId = supabaseProjectConfigDraft().projectId || "(unknown)";
      const sha256 = flushResult.sha256 ?? null;
      let commitId: string | null = null;
      try {
        const commitResult = runTool(ctx, "list_project_commits", { limit: 1 });
        if (commitResult.ok) {
          const data = isRecord(commitResult.data) ? commitResult.data : null;
          const commits = Array.isArray(data?.commits) ? data.commits : [];
          const newest = commits[0];
          commitId = isRecord(newest) && typeof newest.commit_id === "string" ? newest.commit_id : null;
        } else {
          audit({ kind: "status", text: `agent_run:commit-evidence-unavailable — ${commitResult.summary}` });
        }
      } catch (error) {
        audit({
          kind: "status",
          text: `agent_run:commit-evidence-unavailable — ${error instanceof Error ? error.message : String(error)}`,
        });
      }
      audit({
        kind: "status",
        text: `agent_run_saved projectId=${projectId} sha256=${sha256 ?? "none"} commit=${commitId ?? "unavailable"} reload=${reloadResult.kind}`,
      });
      onEvent({ type: "status", text: `자율 런 저장 증명 완료 — projectId=${projectId} sha256=${sha256 ?? "none"} reload=${reloadResult.kind}` });
    } catch (error) {
      audit({
        kind: "status",
        text: `agent_run:save-failed — ${error instanceof Error ? error.message : String(error)}`,
      });
      onEvent({ type: "status", text: "자율 런 원격 저장 실패 — 감사 로그를 확인하세요." });
    }
  },
};
