import type { AiJobHost } from "../../../../scripts/lib/aiJobs/scheduler.mjs";
import { assert, requireArray, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { prepareRegionGeneration, finalizeRegionGeneration } from "@/editor/regionTask/regionGenerationCore";
import type { AiJobCheckpoint, AiJobInput, AiJobResult, BlobRef, JsonObject } from "../contracts";
import { jsonObject, jsonValue, parseProject, parseSessionJobState } from "../checkpointState";
import { parseRegionPayload, type RegionJobPayload, type RegionJobResultMetadata } from "../regionPayload";
import { executeAssistantJob } from "./assistantJob";
export type { RegionJobPayload, RegionJobResultMetadata } from "../regionPayload";

type SessionCheckpoint = Pick<AiJobCheckpoint, "stageKey" | "state" | "artifacts">;
interface RegionCheckpoint {
  preparedSnapshot: BlobRef;
  session?: SessionCheckpoint;
  completed?: { generatedSnapshot: BlobRef; payload: JsonObject };
  failure?: { stage: string; message: string };
}
function ref(value: unknown): BlobRef {
  const r = requireRecord("region blob reference", value);
  const sha256 = requireString("sha256", r.sha256), byteLength = requireNumber("byteLength", r.byteLength);
  assert(/^[a-f0-9]{64}$/.test(sha256) && Number.isSafeInteger(byteLength) && byteLength >= 0 && r.mediaType === "application/json", "Invalid region blob reference");
  return { sha256, byteLength, mediaType: "application/json" };
}
async function restore(checkpoint: AiJobCheckpoint, host: AiJobHost, input: RegionJobPayload): Promise<RegionCheckpoint> {
  const r = requireRecord("region checkpoint", checkpoint.state);
  assert(r.version === 1 && r.kind === "region", "Unsupported region checkpoint");
  const preparedSnapshot = ref(r.preparedSnapshot);
  parseProject(await host.readJson(preparedSnapshot));
  const state: RegionCheckpoint = { preparedSnapshot };
  if (r.session !== undefined) {
    const s = requireRecord("region session checkpoint", r.session);
    state.session = { stageKey: requireString("stageKey", s.stageKey), state: jsonObject(s.state), artifacts: requireArray("artifacts", s.artifacts).map(ref) };
    await parseSessionJobState(state.session.state, host);
  }
  if (r.completed !== undefined) {
    const c = requireRecord("completed region", r.completed);
    const payload = jsonObject(c.payload);
    assert(payload.completion === "complete" && payload.applied === false && payload.persistence === "not-applicable"
      && payload.checkpoint === "private-draft", "Invalid region completion");
    assert(payload.mapId === input.mapId && payload.mode === input.mode && payload.instruction === input.instruction, "Region checkpoint target mismatch");
    const region = requireRecord("completed region rectangle", payload.region);
    assert(Object.entries(input.region).every(([key, value]) => region[key] === value), "Region checkpoint rectangle mismatch");
    for (const key of ["changedCells", "changedEvents", "mapsAdded", "clippedCells", "seamCells"]) {
      const n = requireNumber(key, payload[key]); assert(Number.isSafeInteger(n) && n >= 0, "Invalid region change count");
    }
    requireArray("completedHouses", payload.completedHouses);
    assert(state.session !== undefined && state.session.state.completed !== undefined, "Completed region requires a completed session");
    if (payload.review !== undefined) {
      const review = requireRecord("region review", payload.review);
      requireArray("review issues", review.issues); requireRecord("review metrics", review.metrics);
    }
    state.completed = { generatedSnapshot: ref(c.generatedSnapshot), payload };
    parseProject(await host.readJson(state.completed.generatedSnapshot));
  }
  if (r.failure !== undefined) {
    const f = requireRecord("region failure", r.failure);
    state.failure = { stage: requireString("stage", f.stage), message: requireString("message", f.message) };
  }
  assert(!(state.completed && state.failure), "Region checkpoint cannot be complete and failed");
  return state;
}
const regionStage = (key: string) => key.replace(/^assistant\//, "region/");

/** Real session + region rules. Returns an immutable full proposal, NEVER applies/saves it.
 * Host checkpoints nest the unchanged assistant journal; retries replay completed tools/IDs
 * and provider responses, then run only unfinished deterministic region postprocessing.
 */
export async function executeRegionJob(input: AiJobInput & { family: "region" }, host: AiJobHost): Promise<AiJobResult> {
  const base = parseProject(await host.readJson(input.projectSnapshot));
  const payload = parseRegionPayload(input.payload, base);
  if (input.target.mapId !== undefined) assert(input.target.mapId === payload.mapId, "Region target map mismatch");
  const checkpoint = await host.loadCheckpoint();
  const prepared = prepareRegionGeneration(base, payload);
  const state: RegionCheckpoint = checkpoint ? await restore(checkpoint, host, payload)
    : { preparedSnapshot: await host.putJson(jsonValue(prepared.working)) };
  const artifacts = () => [state.preparedSnapshot, ...(state.session?.artifacts ?? []), ...(state.completed ? [state.completed.generatedSnapshot] : [])];
  const flush = (stageKey: string) => host.saveCheckpoint({ stageKey, state: jsonObject(jsonValue({ version: 1, kind: "region", ...state })), artifacts: artifacts() });
  if (!state.completed) {
    await flush("region/start");
    // Explicit adapter: neither assistant nor shared host code needs region knowledge.
    const sessionHost: AiJobHost = { ...host,
      loadCheckpoint: async () => state.session ? { ...state.session, version: 1, jobId: host.jobId,
        attemptId: host.attemptId, inputSha256: checkpoint?.inputSha256 ?? input.projectSnapshot.sha256 } : null,
      saveCheckpoint: async next => { state.session = next; return flush(`region/session/${next.stageKey.replace(/^assistant\//, "")}`); },
      providerOperation: operation => host.providerOperation({ ...operation, key: regionStage(operation.key) }),
    };
    let stage = "session";
    try {
      const assistant = await executeAssistantJob({ ...input, family: "assistant", projectSnapshot: state.preparedSnapshot,
        payload: jsonObject(jsonValue({ instruction: prepared.message, config: payload.config, context: payload.context,
          domain: "map", selection: { mapId: payload.mapId, ...payload.region },
          turn: { instruction: payload.instruction, scope: { mapId: payload.mapId, region: payload.region } } })) }, sessionHost);
      stage = "review";
      assert(assistant.generatedSnapshot !== null, "Missing region session output");
      const proposed = parseProject(await host.readJson(assistant.generatedSnapshot));
      const toolNames = requireArray("proposedCalls", assistant.payload.proposedCalls).map(call => requireString("tool name", requireRecord("tool call", call).name));
      const finalized = finalizeRegionGeneration(base, proposed, payload, toolNames);
      const { project, report, ...metadata } = finalized;
      state.completed = { generatedSnapshot: await host.putJson(jsonValue(project)), payload: jsonObject(jsonValue({
        ...assistant.payload, ...metadata, mapId: payload.mapId, region: payload.region, mode: payload.mode,
        instruction: payload.instruction, review: report,
        completion: "complete", applied: false, persistence: "not-applicable", checkpoint: "private-draft",
      } satisfies RegionJobResultMetadata)) };
      delete state.failure;
    } catch (error) {
      state.failure = { stage, message: error instanceof Error ? error.message : String(error) };
      await flush(`region/partial/${stage}`);
      throw error;
    }
    await flush("region/completed");
  }
  return { version: 1, family: "region", jobId: host.jobId, attemptId: host.attemptId, project: input.project,
    baseSnapshot: input.projectSnapshot, generatedSnapshot: state.completed.generatedSnapshot, artifacts: artifacts(), payload: state.completed.payload };
}
