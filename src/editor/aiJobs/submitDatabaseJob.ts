import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import type { AiDatabaseKind } from "@/ai/databaseGenerationCore";
import type { AiJob } from "@/ai/jobs/contracts";
import { freezeSubmission, admissionWithPinnedAssets } from "./captureSubmission";
import { admitCapturedJob, type SubmitJobOptions } from "./submitAiJob";

export interface DatabaseSubmitRequest {
  readonly kind: AiDatabaseKind;
  readonly brief: string;
  readonly withArtwork: boolean;
  readonly mode?: "auto" | "review";
}

export async function submitDatabaseJob(
  request: DatabaseSubmitRequest,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string }> {
  const frozen = freezeSubmission("chat", "database");
  const payload = jsonObject(jsonValue({
    kind: request.kind,
    brief: request.brief,
    config: frozen.config,
    withArtwork: request.withArtwork,
  }));
  return admitCapturedJob(
    await admissionWithPinnedAssets(frozen, "database", jsonObject({ kind: request.kind }), request.mode ?? "review", payload),
    { ...options, fingerprint: options.fingerprint ?? JSON.stringify({ kind: request.kind, brief: request.brief, withArtwork: request.withArtwork }) },
  );
}
