import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { SessionExecutionHost } from "../sessionExecutionHost";
import type { SessionEvent } from "../assistantSessionCore";
import type { SessionUsageTotals } from "../sessionUsage";
import { createSessionProgressObserver } from "./sessionProgress";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "../toolDomainState";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolDomain, ToolResult } from "@/editor/tools/types";
import type { Project } from "@/project/types";
import type { BlobRef, JsonValue } from "./contracts";

import { jsonValue, jsonObject, projectDelta, applyProjectDelta, type SessionJobState } from "./checkpointState";
export { jsonValue, type SessionJobState } from "./checkpointState";

type CheckpointWrite = Parameters<AiJobHost["saveCheckpoint"]>[0];
export interface SessionCheckpointWriter { write<T>(operation: () => Promise<T>): Promise<T> }
export function createSessionCheckpointWriter(): SessionCheckpointWriter {
  let tail: Promise<unknown> = Promise.resolve();
  return { write<T>(operation: () => Promise<T>): Promise<T> {
    const pending = tail.then(operation);
    tail = pending;
    return pending;
  } };
}

/** Retry starts the same session against its input and replays recorded deterministic stages.
 * The tool journal captures allocated IDs and tool results, before the next paid request.
 * A milestone attaches the cumulative draft and journal to the durable job, not the editor. */
export function createSessionJobHost(host: AiJobHost, baseline: Project, state: SessionJobState, captured: {
  domain: ToolDomain; preferenceMemorySection: string; budgetChars: number;
  writer?: SessionCheckpointWriter;
  captureEnvelope?: () => (checkpoint: CheckpointWrite) => CheckpointWrite;
}): { execution: SessionExecutionHost; observe(event: SessionEvent): void;
  sampleUsage(read: () => SessionUsageTotals): void; flush(stageKey?: string): Promise<void>;
  retainDraft(): Promise<BlobRef> } {
  let toolCursor = 0;
  resetAssistantToolDomainMemory();
  const toolRefs = [...(state.toolRefs ?? [])];
  const observer = createSessionProgressObserver(state.progress);
  const replayToolCount = state.tools.length;
  const reconstructing = () => observer.reconstructing() || toolCursor < replayToolCount;
  let readUsage: (() => SessionUsageTotals) | undefined;
  const writer = captured.writer ?? createSessionCheckpointWriter();
  let savedDraft: { json: string; ref: BlobRef } | undefined;
  const flush = (stageKey = "assistant/execute"): Promise<void> => {
    // Keep the durable draft/frontier intact while replaying earlier milestones.
    if (reconstructing()) return writer.write(async () => {});
    state.progress = observer.snapshot(readUsage?.());
    // Capture at invocation, before any storage await. Every kind of checkpoint uses
    // this same chain; a rejected predecessor fences all later writes and drains.
    const snapshot = structuredClone({ startedAt: state.startedAt, progress: state.progress, completed: state.completed, partial: state.partial });
    const toolCount = state.tools.length, pendingFrom = toolRefs.length;
    const pendingTools = state.tools.slice(pendingFrom).map(tool => jsonValue(tool));
    // One serialization captures even in-place mutations. Do not clone/parse the
    // entire project and durable journal again for every progress-only barrier.
    const draftJson = JSON.stringify(state.draft);
    const envelope = captured.captureEnvelope?.() ?? ((checkpoint: CheckpointWrite) => checkpoint);
    return writer.write(async () => {
      while (toolRefs.length < toolCount) toolRefs.push(await host.putJson(pendingTools[toolRefs.length - pendingFrom]!));
      const refs = toolRefs.slice(0, toolCount);
      const draftRef = savedDraft?.json === draftJson ? savedDraft.ref : await host.putJson(JSON.parse(draftJson) as JsonValue);
      savedDraft = { json: draftJson, ref: draftRef };
      await host.saveCheckpoint(envelope({ stageKey, state: jsonObject(jsonValue({ version: 1, startedAt: snapshot.startedAt,
        toolRefs: refs, draftRef, progress: snapshot.progress, completed: snapshot.completed, partial: snapshot.partial })),
        artifacts: [draftRef, ...refs, ...(snapshot.completed ? [snapshot.completed.generatedSnapshot, ...(snapshot.completed.artifacts ?? [])] : [])] }));
    });
  };
  return {
    flush,
    retainDraft: () => {
      const draftJson = JSON.stringify(state.draft);
      return writer.write(() => savedDraft?.json === draftJson ? Promise.resolve(savedDraft.ref) : host.putJson(JSON.parse(draftJson) as JsonValue));
    },
    observe: observer.observe,
    sampleUsage: read => { readUsage = read; },
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
        if (!reconstructing()) state.draft = structuredClone(project);
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
