/**
 * Live job progress reader — one guarded immutable read per invalidation, no polling.
 *
 * The queue's public surface never streams progress: SSE stays `admitted|updated|outcome|
 * inbox-read` with job states only (LIVE-PROGRESS-HANDOFF.md). The running job's session
 * observation lives inside the durable checkpoint blob at `job.checkpointRef`, so the editor
 * reads it exactly the way it reads any other artifact: manifest membership from a fresh
 * detail read, then hash/byte verification through `ApplicationClient.bytes`.
 *
 * This module is presentation-only. Neither the returned plan nor its frontier may drive
 * execution, and a retained `currentTool` is history, not proof of a live worker.
 */
import type { AiJob, AiJobCheckpoint, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import { parseSessionProgress, type SessionProgress } from "@/ai/jobs/sessionProgress";
import { assert } from "@/project/io/guards";
import { getJobClient, type JobClient } from "./jobClient";

/**
 * One progress observation, attributed to the exact identity it was read from.
 *
 * `live` is the only field that may animate chrome: it is true only when the job is still
 * running **and** the checkpoint belongs to the job's current attempt. During a replaying
 * retry the previous attempt's checkpoint is still the head, so `live` is false and its
 * retained `currentTool` must be shown as history.
 */
export interface JobProgressSnapshot {
  readonly jobId: string;
  readonly attemptId: string;
  readonly checkpointRef: BlobRef;
  readonly generation: AiJob["generation"];
  readonly live: boolean;
  readonly progress: SessionProgress;
}

function checkpointRecord(value: JsonValue | undefined): JsonObject | null {
  if (value === undefined || value === null) return null;
  assert(typeof value === "object" && !Array.isArray(value), "Checkpoint session state must be an object");
  return Object.fromEntries(Object.entries(value));
}

/**
 * Family-nested session state (LIVE-PROGRESS-HANDOFF.md "Exact existing reads"):
 * assistant `C.state`, region `C.state.session.state`, tileset cluster `C.state.session`.
 * A missing session (early region checkpoint, non-session tileset operation) is not an error.
 */
export function selectSessionState(family: AiJob["family"], state: JsonObject): JsonObject | null {
  if (family === "assistant") return state;
  if (family === "region") {
    const session = checkpointRecord(state.session);
    if (!session) return null;
    return checkpointRecord(session.state as JsonValue | undefined);
  }
  if (family === "tileset") return checkpointRecord(state.session);
  return null;
}

/**
 * Verify the blob really is this job's checkpoint before trusting any field of it.
 * A head replacement that dropped this ref out of the current manifest is a stale read,
 * not a licence to fetch arbitrary blobs.
 */
function assertOwnedCheckpoint(job: AiJob, ref: BlobRef, manifest: readonly BlobRef[], checkpoint: AiJobCheckpoint): void {
  assert(
    manifest.some(item => item.sha256 === ref.sha256 && item.byteLength === ref.byteLength && item.mediaType === ref.mediaType),
    "Checkpoint is outside the current job manifest",
  );
  assert(checkpoint.version === 1, "Unsupported checkpoint version");
  assert(checkpoint.jobId === job.id, "Foreign checkpoint job");
  assert(checkpoint.inputSha256 === job.inputRef.sha256, "Foreign checkpoint input");
}

/**
 * One detail read + one artifact read. Returns null when this job has no checkpoint, no
 * session-nested state, or no observed progress — "unavailable", never "zero work done".
 */
export async function readJobProgress(
  jobId: string,
  client: JobClient = getJobClient(),
): Promise<JobProgressSnapshot | null> {
  const detail = await client.artifacts.detail(jobId);
  const job = detail.job;
  const ref = job.checkpointRef;
  if (!ref) return null;
  const checkpoint = await client.artifacts.json<AiJobCheckpoint>(job.id, ref);
  assertOwnedCheckpoint(job, ref, detail.manifest, checkpoint);
  const session = selectSessionState(job.family, checkpoint.state);
  if (!session) return null;
  const raw = session.progress;
  if (raw === undefined || raw === null) return null;
  return {
    jobId: job.id,
    attemptId: checkpoint.attemptId,
    checkpointRef: ref,
    generation: job.generation,
    // A retained checkpoint from an older attempt is historical during replay.
    live: job.generation === "running" && checkpoint.attemptId === job.activeAttemptId,
    progress: parseSessionProgress(raw),
  };
}

export interface JobProgressBinding {
  readonly stop: () => void;
  /** Settled after the currently scheduled read (if any) finishes. Test-facing seam. */
  readonly whenIdle: () => Promise<void>;
}

export interface JobProgressBindingOptions {
  readonly client?: JobClient;
  /** Extra ownership predicate evaluated after every await (conversation/project owner). */
  readonly owns?: () => boolean;
  readonly onError?: (error: unknown) => void;
}

/**
 * Invalidate on the client's existing change notification (driven by the durable `updated`
 * event), then perform at most one guarded read at a time. Deduplicated by checkpoint ref,
 * because `revision` is not a head identity: usage/stage can move without it.
 */
export function bindJobProgress(
  jobId: string,
  onSnapshot: (snapshot: JobProgressSnapshot | null) => void,
  options: JobProgressBindingOptions = {},
): JobProgressBinding {
  const client = options.client ?? getJobClient();
  const owns = options.owns ?? ((): boolean => true);
  let stopped = false;
  let reading: Promise<void> | null = null;
  let queued = false;
  let lastKey = "";
  const read = async (): Promise<void> => {
    try {
      do {
        queued = false;
        const job = client.jobs.get(jobId);
        const ref = job?.checkpointRef;
        if (!job || !ref) continue;
        // Attempt id and generation belong to the key: the same retained checkpoint means
        // something different once the job goes terminal or a new attempt takes over.
        const key = `${job.id}:${ref.sha256}:${job.activeAttemptId ?? ""}:${job.generation}`;
        if (key === lastKey) continue;
        const snapshot = await readJobProgress(jobId, client);
        if (stopped || !owns()) return;
        // Only commit the key once this read actually owned the surface.
        lastKey = key;
        onSnapshot(snapshot);
      } while (queued && !stopped && owns());
    } catch (error) {
      if (!stopped && owns()) options.onError?.(error);
    }
  };
  const invalidate = (): void => {
    if (stopped || !owns()) return;
    if (reading) {
      queued = true;
      return;
    }
    const pending = read().finally(() => {
      if (reading === pending) reading = null;
    });
    reading = pending;
  };
  const unsubscribe = client.subscribe(invalidate);
  invalidate();
  return {
    stop: (): void => {
      stopped = true;
      unsubscribe();
    },
    whenIdle: async (): Promise<void> => {
      // The loop can enqueue another pass while awaiting; drain until nothing is in flight.
      while (reading) await reading;
    },
  };
}
