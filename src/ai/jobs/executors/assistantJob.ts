import { AssistantSession } from "../../assistantSessionCore";
import { createLlmIntentDeclarer } from "../../intentDeclarationClient";
import { renderToolImages } from "../../toolImageRenderer";
import type { AiConfig } from "../../llmClient";
import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput, AiJobResult } from "../contracts";
import { createSessionJobHost, jsonValue, type SessionJobState } from "../sessionHost";
import { createJobChat } from "../providerBridge";

import { parseAssistantPayload } from "../assistantPayload";
export type { AssistantJobPayload } from "../assistantPayload";
import { jsonObject, parseProject, parseSessionJobState } from "../checkpointState";

export async function executeAssistantJob(input: AiJobInput & { family: "assistant" }, host: AiJobHost): Promise<AiJobResult> {
  const payload = parseAssistantPayload(input.payload);
  const baseline = parseProject(await host.readJson(input.projectSnapshot));
  const checkpoint = await host.loadCheckpoint();
  const state: SessionJobState = checkpoint ? await parseSessionJobState(checkpoint.state, host)
    : { startedAt: new Date().toISOString(), tools: [], draft: structuredClone(baseline) };
  const job = createSessionJobHost(host, baseline, state, { domain: payload.domain, ...payload.context });
  if (!state.completed) {
    await job.flush("assistant/start");
    const config: AiConfig = { ...payload.config, apiKey: "", baseUrl: "" };
    const chat = createJobChat(host, () => job.flush());
    // Intent also uses the same durable, known-operation provider bridge.
    const session = new AssistantSession(baseline, {
      host: job.execution, config, chat, contextOptions: payload.context,
      getTurnSelection: () => payload.selection, priorTranscript: payload.priorTranscript,
      declareIntent: createLlmIntentDeclarer({ getConfig: () => config, chat }),
      renderImages: renderToolImages, yieldToUi: async () => {},
    });
    const turn = await session.sendUserMessage(payload.instruction, () => {}, undefined, payload.turn);
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
    state.completed = { turn: { ...output, completion: "complete" }, generatedSnapshot: await host.putJson(jsonValue(state.draft)) };
    await job.flush("assistant/completed");
  }
  const generatedSnapshot = state.completed.generatedSnapshot;
  return { version: 1, family: input.family, jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot, artifacts: [],
    payload: { ...state.completed.turn, persistence: "not-applicable", checkpoint: "private-draft" } };
}
