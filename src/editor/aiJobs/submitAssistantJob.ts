import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import { parseAssistantPayload, type AssistantJobPayload } from "@/ai/jobs/assistantPayload";
import type { AiJob } from "@/ai/jobs/contracts";
import { freezeSubmission, admissionWithPinnedAssets } from "./captureSubmission";
import { admitCapturedJob, type SubmitJobOptions } from "./submitAiJob";

export interface AssistantSubmitRequest {
  readonly instruction: string;
  readonly domain?: AssistantJobPayload["domain"];
  readonly selection?: AssistantJobPayload["selection"];
  readonly turn?: AssistantJobPayload["turn"];
  readonly priorTranscript?: string;
  readonly mode?: "auto" | "review";
}

export async function submitAssistantJob(
  request: AssistantSubmitRequest,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string }> {
  const frozen = freezeSubmission("chat", request.domain ?? "core");
  const payload = parseAssistantPayload({
    instruction: request.instruction,
    config: frozen.config,
    context: frozen.context,
    domain: request.domain ?? "core",
    selection: request.selection,
    turn: request.turn,
    priorTranscript: request.priorTranscript,
  });
  const mode = request.mode ?? (payload.turn?.autonomous ? "auto" : "review");
  return admitCapturedJob(
    await admissionWithPinnedAssets(frozen, "assistant", jsonObject({}), mode, jsonObject(jsonValue(payload))),
    options,
  );
}
