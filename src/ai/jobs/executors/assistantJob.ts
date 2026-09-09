import { AssistantSession } from "../../assistantSessionCore";
import { createLlmIntentDeclarer } from "../../intentDeclarationClient";
import { renderToolImages } from "../../toolImageRenderer";
import type { AiConfig } from "../../llmClient";
import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobResult, BlobRef } from "../contracts";
import { assert } from "@/project/io/guards";
import { canContinuePlan, continuationOutput, createContinuationHistory, resolveAssistantContinuation } from "../assistantContinuation";
import { createSessionJobHost, jsonValue, type SessionJobState, type SessionCheckpointWriter } from "../sessionHost";
import { createJobChat } from "../providerBridge";

import { parseAssistantPayload } from "../assistantPayload";
export type { AssistantJobPayload } from "../assistantPayload";
import { jsonObject, parseProject, parseSessionJobState } from "../checkpointState";

export async function executeAssistantJob(input: AiJobInput & { family: "assistant" }, host: AiJobHost, writer?: SessionCheckpointWriter): Promise<AiJobResult> {
  const payload = parseAssistantPayload(input.payload);
  const baseline = parseProject(await host.readJson(input.projectSnapshot));
  const continuation = await resolveAssistantContinuation(input, payload, baseline, host);
  const priorTranscript = continuation?.priorTranscript ?? payload.priorTranscript;
  const checkpoint = await host.loadCheckpoint();
  const state: SessionJobState = checkpoint ? await parseSessionJobState(checkpoint.state, host)
    : { startedAt: new Date().toISOString(), tools: [], draft: structuredClone(baseline) };
  const job = createSessionJobHost(host, baseline, state, { domain: payload.domain, ...payload.context, writer });
  if (!state.completed) {
    await job.flush("assistant/start");
    const config: AiConfig = { ...payload.config, apiKey: "", baseUrl: "" };
    const chat = createJobChat(host, () => job.flush());
    // Intent also uses the same durable, known-operation provider bridge.
    const session = new AssistantSession(baseline, {
      host: job.execution, config, chat, contextOptions: payload.context,
      getTurnSelection: () => payload.selection, priorTranscript,
      planOnlyContinuation: continuation?.seed,
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat }),
      renderImages: renderToolImages, yieldToUi: () => job.flush(),
    });
    job.sampleUsage(() => session.getUsageTotals());
    const turn = await session.sendUserMessage(payload.instruction, job.observe, undefined, payload.turn);
    await job.flush("assistant/terminal");
    state.draft = session.getProposedProject();
    const output = jsonObject(jsonValue({ ...turn, usage: session.getUsageTotals(), audit: session.getAuditEntries() }));
    let failure: string | null = turn.stoppedReason === "final" ? session.getExecutionCompletionProblem() : turn.stoppedReason;
    try { chat.assertHealthy(); } catch (error) { failure = error instanceof Error ? error.message : String(error); }
    if (failure) {
      state.partial = { reason: failure, turn: output };
      await job.flush("assistant/partial");
      throw new Error(`ASSISTANT_INCOMPLETE: ${failure}`);
    }
    delete state.partial;
    const goals = session.getPlanOnlyContinuationState(), plan = session.getWorkPlan();
    const artifacts: BlobRef[] = [];
    const continuationState = goals && plan && canContinuePlan(plan) && state.tools.length === 0
      ? { version: 1, kind: "plan-only", ...goals, history: createContinuationHistory(priorTranscript, payload.instruction, turn.assistantText),
          inputRef: await host.putJson(jsonValue(input)) } : null;
    if (continuationState) artifacts.push(continuationState.inputRef);
    state.completed = { turn: { ...output, completion: "complete", ...(continuationState ? { continuationState: jsonValue(continuationState) } : {}) },
      generatedSnapshot: await job.retainDraft(), ...(artifacts.length ? { artifacts } : {}) };
    await job.flush("assistant/completed");
  }
  const generatedSnapshot = state.completed.generatedSnapshot;
  const retained = continuationOutput(state.completed.turn);
  if (retained) assert(state.completed.artifacts?.some(ref => ref.sha256 === retained.state.inputRef.sha256
    && ref.byteLength === retained.state.inputRef.byteLength && ref.mediaType === retained.state.inputRef.mediaType) === true, "Continuation input artifact missing from completed checkpoint");
  return { version: 1, family: input.family, jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot, artifacts: state.completed.artifacts ?? [],
    payload: { ...state.completed.turn, persistence: "not-applicable", checkpoint: "private-draft" } };
}
