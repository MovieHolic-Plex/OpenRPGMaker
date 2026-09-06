import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { SessionExecutionHost } from "../sessionExecutionHost";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "../toolDomainState";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolDomain, ToolResult } from "@/editor/tools/types";
import type { Project } from "@/project/types";

import { jsonValue, jsonObject, projectDelta, applyProjectDelta, type SessionJobState } from "./checkpointState";
export { jsonValue, type SessionJobState } from "./checkpointState";

/** Retry starts the same session against its input and replays recorded deterministic stages.
 * The tool journal captures allocated IDs and tool results, before the next paid request.
 * A milestone attaches the cumulative draft and journal to the durable job, not the editor. */
export function createSessionJobHost(host: AiJobHost, baseline: Project, state: SessionJobState, captured: {
  domain: ToolDomain; preferenceMemorySection: string; budgetChars: number;
}): { execution: SessionExecutionHost; flush(stageKey?: string): Promise<void> } {
  let toolCursor = 0;
  resetAssistantToolDomainMemory();
  const toolRefs = state.toolRefs ?? [];
  const flush = async (stageKey = "assistant/execute") => {
    while (toolRefs.length < state.tools.length) toolRefs.push(await host.putJson(jsonValue(state.tools[toolRefs.length])));
    const draftRef = await host.putJson(jsonValue(state.draft));
    await host.saveCheckpoint({ stageKey, state: jsonObject(jsonValue({ version: 1, startedAt: state.startedAt,
      toolRefs, draftRef, completed: state.completed, partial: state.partial })), artifacts: [draftRef, ...toolRefs, ...(state.completed ? [state.completed.generatedSnapshot] : [])] });
  };
  return {
    flush,
    execution: {
      kind: "job",
      checkpointTools: () => flush(`assistant/tool/${toolCursor}`),
      readBaseline: () => structuredClone(baseline),
      now: () => new Date(state.startedAt),
      activeDomains: intent => computeActiveToolDomains(intent, captured.domain),
      preferenceSection: () => captured.preferenceMemorySection,
      budgetChars: () => captured.budgetChars,
      recordTokens: () => { /* job usage is returned, never written to editor preferences */ },
      async checkpointMilestone(project) {
        state.draft = structuredClone(project);
        await flush(`assistant/milestone/${toolCursor}`);
        return { ok: true, kind: "draft-checkpoint" };
      },
      async verifyPersistence(_ctx, audit, event) {
        audit({ kind: "status", text: "job:persistence-not-applicable" });
        event({ type: "status", text: "Private job draft; editor application and persistence are not applicable." });
      },
      runTool(ctx, name, args, options) {
        const encoded = JSON.stringify(jsonValue(args));
        const previous = state.tools[toolCursor++];
        if (previous) {
          if (previous.name !== name || previous.args !== encoded) throw new Error("Checkpoint tool replay mismatch");
          ctx.project = applyProjectDelta(ctx.project, previous.delta);
          return structuredClone(previous.result);
        }
        const before = ctx.project;
        const result: ToolResult = ["list_project_commits", "list_edit_history", "revert_last_edit"].includes(name)
          ? { ok: false, summary: "Live editor history is unavailable in an isolated job", issues: [{ severity: "error", code: "job-history-unavailable", message: "No captured history was submitted" }] }
          : runTool(ctx, name, args, options);
        state.tools.push({ name, args: encoded, delta: projectDelta(before, ctx.project), result: structuredClone(result) });
        state.draft = ctx.project;
        return result;
      },
    },
  };
}
