import { assert, requireArray, requireRecord } from "@/project/io/guards";
import type { Command, CommonEvent, EventPage, GameEvent } from "@/project/types";
import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import { parseAndValidate, resolveAssistScope, runEventCommandAssist, type AssistScope } from "../../eventCommandAssist";
import { parseNonStream, requestBody, type AiConfig } from "../../llmClient";
import { jsonObject, jsonValue, parseProject } from "../checkpointState";
import type { AiJobInput, AiJobResult, AiProjectIdentity, BlobRef } from "../contracts";
import {
  eventCommandsContext, eventCommandsFinalList, parseEventCommandsPayload, parseEventCommandsRef, parseEventCommandsTarget,
  type EventCommandsTarget,
} from "../eventCommandsPayload";
export type { EventCommandsJobPayload, EventCommandsTarget } from "../eventCommandsPayload";

/** Immutable generation artifact. Review derives existing commandDiff rows from the two
 * lists, then applies exclusions in the editor, never in this worker. Row IDs are stable
 * for this frozen pair; no selection or current project is read when reconstructing them. */
export interface EventCommandsJobProposal {
  version: 1;
  kind: "event-commands-proposal";
  project: AiProjectIdentity;
  baseSnapshot: BlobRef;
  target: EventCommandsTarget;
  context: { event?: GameEvent; page?: EventPage; commonEvent?: CommonEvent };
  baseCommands: Command[];
  commands: Command[];
  finalCommands: Command[];
  scope: AssistScope;
  attempts: number;
  selection: number[] | null;
  selectionLabel?: string;
  review: { status: "awaiting-review"; diff: "command-lists-v1"; excludedRowIds: string[] };
}

export async function executeEventCommandsJob(
  input: AiJobInput & { family: "event-commands" }, host: AiJobHost,
): Promise<AiJobResult> {
  assert(input.mode === "review", "Event command proposals require explicit review mode");
  const payload = parseEventCommandsPayload(input.payload);
  const target = parseEventCommandsTarget(input.target);
  const project = parseProject(await host.readJson(input.projectSnapshot));
  const context = eventCommandsContext(project, target, payload);
  const scope = resolveAssistScope(context.page);
  const allowEmpty = scope === "page" && payload.baseCommands.length > 0;
  const inputRef = await host.putJson(jsonValue(input));
  const checkpoint = await host.loadCheckpoint();
  let responseRefs: BlobRef[] = [];
  let proposalRef: BlobRef | undefined;
  if (checkpoint) {
    assert(checkpoint.version === 1 && checkpoint.jobId === host.jobId && checkpoint.inputSha256 === inputRef.sha256,
      "Event commands checkpoint belongs to another input/job");
    const state = requireRecord("event commands checkpoint", checkpoint.state);
    assert(state.version === 1, "Unsupported event commands checkpoint version");
    responseRefs = requireArray("responseRefs", state.responseRefs).map(parseEventCommandsRef);
    assert(responseRefs.length <= 3, "Too many event commands repair responses");
    proposalRef = state.proposalRef === undefined ? undefined : parseEventCommandsRef(state.proposalRef);
    const stage = proposalRef ? "event-commands/completed" : responseRefs.length ? `event-commands/response/${responseRefs.length - 1}` : "event-commands/start";
    assert(checkpoint.stageKey === stage, "Invalid event commands checkpoint stage");
    for (const ref of [...responseRefs, ...(proposalRef ? [proposalRef] : [])]) {
      assert(checkpoint.artifacts.some(artifact => artifact.sha256 === ref.sha256 && artifact.byteLength === ref.byteLength && artifact.mediaType === ref.mediaType),
        "Event commands checkpoint artifact missing from manifest");
    }
  }
  const flush = async (stageKey: string) => {
    await host.saveCheckpoint({ stageKey, state: jsonObject(jsonValue({ version: 1, responseRefs, proposalRef })),
      artifacts: [...responseRefs, ...(proposalRef ? [proposalRef] : [])] });
  };
  const proposal = (commands: Command[], attempts: number): EventCommandsJobProposal => ({
    version: 1, kind: "event-commands-proposal", project: input.project, baseSnapshot: input.projectSnapshot, target,
    context: target.kind === "common-event"
      ? { commonEvent: project.commonEvents.find(event => event.id === target.commonEventId) }
      : { event: context.event, page: context.page },
    baseCommands: payload.baseCommands, commands, finalCommands: eventCommandsFinalList(payload, commands, scope),
    scope, attempts, selection: payload.selection, selectionLabel: payload.selectionLabel,
    review: { status: "awaiting-review", diff: "command-lists-v1", excludedRowIds: [] },
  });
  let completed: EventCommandsJobProposal;
  if (proposalRef) {
    assert(responseRefs.length > 0, "Completed event commands checkpoint has no response");
    const wire = parseNonStream(requireRecord("event commands response", await host.readJson(responseRefs[responseRefs.length - 1])));
    const parsed = parseAndValidate(project, typeof wire.message.content === "string" ? wire.message.content : "", { allowEmpty });
    assert(parsed.ok, "Invalid completed event commands response");
    completed = proposal(parsed.commands, responseRefs.length);
    // Reconstructing checks every persisted field, including final list, scope, exclusions,
    // exact target/base and context. Keep the original immutable ref on completed retry.
    await host.readJson(proposalRef);
    const expectedRef = await host.putJson(jsonValue(completed));
    assert(proposalRef.sha256 === expectedRef.sha256 && proposalRef.byteLength === expectedRef.byteLength,
      "Invalid completed event commands proposal");
  } else {
    if (!checkpoint) await flush("event-commands/start");
    let cursor = 0;
    const config: AiConfig = { ...payload.config, apiKey: "", baseUrl: "" };
    const result = await runEventCommandAssist({
      config, prompt: payload.prompt, context, projectScopeKey: payload.projectScopeKey,
      preferenceMemorySection: payload.preferenceMemorySection,
      chat: async (config, request) => {
        const index = cursor++;
        let ref = responseRefs[index];
        if (!ref) {
          const response = await host.providerOperation({ key: `event-commands/assist/${index}`,
            request: { kind: "text", provider: config.providerId ?? "google-antigravity",
              body: jsonObject(JSON.parse(requestBody(config, request, false))) } });
          ref = await host.putJson(response);
          responseRefs.push(ref);
          // Response is durable before parsing/repair. A transport failure propagates;
          // only the assist's validated invalid content can request the next repair stage.
          await flush(`event-commands/response/${index}`);
        }
        return parseNonStream(requireRecord("event commands response", await host.readJson(ref)), config.model);
      },
    });
    completed = proposal(result.commands, result.attempts);
    proposalRef = await host.putJson(jsonValue(completed));
    await flush("event-commands/completed");
  }
  return {
    version: 1, family: "event-commands", jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot: null, artifacts: [proposalRef],
    payload: jsonObject(jsonValue({ proposalRef, scope: completed.scope, attempts: completed.attempts,
      completion: "complete", review: "required", persistence: "not-applicable", checkpoint: "private-proposal" })),
  };
}
