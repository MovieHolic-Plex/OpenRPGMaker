import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import { parseImageJobDestination, parseImageJobPayload, type ImageJobDestination } from "@/ai/jobs/imagePayload";
import type { AiJob } from "@/ai/jobs/contracts";
import type { GeneratedPictureKind } from "@/editor/generatedPictureAsset";
import { genId } from "@/util/id";
import { freezeSubmission, admissionWithPinnedAssets } from "./captureSubmission";
import { admitCapturedJob, type SubmitJobOptions } from "./submitAiJob";

export interface ImageSubmitRequest {
  readonly kind: GeneratedPictureKind;
  readonly prompt: string;
  readonly name: string;
  readonly destination: ImageJobDestination;
  readonly resourceId?: string;
  readonly postprocess?: "none" | "flatten";
  readonly mode?: "auto" | "review";
}

export function allocateImageResourceId(kind: GeneratedPictureKind, id = genId(kind === "picture" ? "picture" : kind === "faceset" ? "generated-face" : `${kind}_img`)): string {
  return kind === "faceset" && !id.includes("-bust") ? `${id}-bust` : id;
}

export async function submitImageJob(
  request: ImageSubmitRequest,
  options: SubmitJobOptions = {},
): Promise<{ job: AiJob; created: boolean; idempotencyKey: string; resourceId: string }> {
  const frozen = freezeSubmission("chat", "core");
  const resourceId = request.resourceId ?? allocateImageResourceId(request.kind);
  const payload = parseImageJobPayload({
    prompt: request.prompt,
    resourceId,
    name: request.name,
    kind: request.kind,
    model: frozen.config.model,
    postprocess: request.postprocess ?? "none",
  });
  const destination = parseImageJobDestination(request.destination, payload.kind);
  const mode = request.mode ?? "review";
  const receipt = await admitCapturedJob(
    await admissionWithPinnedAssets(frozen, "image", jsonObject(jsonValue(destination)), mode, jsonObject(jsonValue(payload))),
    options,
  );
  return { ...receipt, resourceId };
}
