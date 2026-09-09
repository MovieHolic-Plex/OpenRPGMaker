import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import { parseRegionPayload } from "@/ai/jobs/regionPayload";
import type { AiJob } from "@/ai/jobs/contracts";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { freezeSubmission, admissionWithPinnedAssets } from "./captureSubmission";
import { admitCapturedJob, type SubmitJobOptions } from "./submitAiJob";

export interface RegionSubmitRequest {
  readonly mapId: string;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly mode?: "task" | "polish";
}

export async function submitRegionJob(
  request: RegionSubmitRequest,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string }> {
  const frozen = freezeSubmission("region", "map");
  const payload = parseRegionPayload({
    instruction: request.instruction,
    mapId: request.mapId,
    region: request.region,
    mode: request.mode ?? "task",
    config: frozen.config,
    context: { ...frozen.context, currentMapId: request.mapId },
  }, frozen.project);
  return admitCapturedJob(
    await admissionWithPinnedAssets(
      frozen,
      "region",
      jsonObject(jsonValue({ mapId: payload.mapId, region: payload.region })),
      "review",
      jsonObject(jsonValue(payload)),
    ),
    {
      ...options,
      fingerprint: options.fingerprint ?? JSON.stringify({
        mapId: request.mapId,
        region: request.region,
        instruction: request.instruction,
        mode: request.mode ?? "task",
      }),
    },
  );
}
