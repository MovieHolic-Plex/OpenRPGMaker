import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import { parseEventCommandsPayload, parseEventCommandsTarget, type EventCommandsTarget } from "@/ai/jobs/eventCommandsPayload";
import type { AiJob } from "@/ai/jobs/contracts";
import type { Command } from "@/project/types";
import { captureDraftBinding, findDraftOwner } from "./draftOwners";
import { freezeSubmission, admissionWithPinnedAssets } from "./captureSubmission";
import { admitCapturedJob, type SubmitJobOptions } from "./submitAiJob";
import { JobSubmitError } from "./jobSubmitError";

export interface EventCommandsSubmitRequest {
  readonly target: EventCommandsTarget;
  readonly prompt: string;
  readonly baseCommands: readonly Command[];
  readonly selection: number[] | null;
  readonly selectionLabel?: string;
  readonly draftId?: string;
}

export async function submitEventCommandsJob(
  request: EventCommandsSubmitRequest,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string }> {
  const frozen = freezeSubmission("event-command", "event");
  const target = parseEventCommandsTarget(request.target);
  const owner = target.kind === "map-event-page"
    ? { kind: "map-event" as const, mapId: target.mapId, eventId: target.eventId, pageId: target.pageId }
    : { kind: "common-event" as const, commonEventId: target.commonEventId };
  const live = request.draftId ? findDraftOwner(frozen.identity, request.draftId, owner) : null;
  if (request.draftId && !live) throw new JobSubmitError("not-ready", "이벤트 초안이 열려 있지 않습니다.");
  const draftBinding = live ? await captureDraftBinding(live) : undefined;
  const payload = parseEventCommandsPayload({
    prompt: request.prompt,
    config: {
      authMode: frozen.config.authMode,
      model: frozen.config.model,
      maxTokens: frozen.config.maxTokens,
      maxToolCalls: frozen.config.maxToolCalls,
      ...(frozen.config.providerId ? { providerId: frozen.config.providerId } : {}),
      ...(frozen.config.liteModel ? { liteModel: frozen.config.liteModel } : {}),
      ...(frozen.config.reasoningEffort ? { reasoningEffort: frozen.config.reasoningEffort } : {}),
    },
    ...(draftBinding ? { draftBinding } : {}),
    baseCommands: request.baseCommands,
    selection: request.selection,
    selectionLabel: request.selectionLabel,
    preferenceMemorySection: frozen.context.preferenceMemorySection,
    projectScopeKey: frozen.context.projectScopeKey,
  });
  return admitCapturedJob(
    await admissionWithPinnedAssets(frozen, "event-commands", jsonObject(jsonValue(target)), "review", jsonObject(jsonValue(payload))),
    { ...options, fingerprint: options.fingerprint ?? JSON.stringify({ target, prompt: request.prompt }) },
  );
}
