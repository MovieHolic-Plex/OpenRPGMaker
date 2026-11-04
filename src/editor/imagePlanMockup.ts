// editor/imagePlanMockup.ts
// 그림 도안(src/ai/imagePlan.ts)을 실제로 받는 곳 — 이미지 계정을 확인하고, 이미지 모델에 한 장을 청해 첫 요청에 실을 크기로 줄인다.
import { loadAiConfig } from "@/ai/llmClient";
import { companionCredentialMissing } from "@/ai/chatgptOAuthClient";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { IMAGE_PLAN_FAILED_LINE, IMAGE_PLAN_SKIPPED_LINE, imagePlanPrompt } from "@/ai/imagePlan";
import { DEFAULT_IMAGE_PROVIDER_ID, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { shrinkReferenceImage } from "@/start/firstRun/referenceImage";

export type ImagePlanOutcome =
  | { readonly kind: "mockup"; readonly dataUrl: string; readonly model: string }
  | { readonly kind: "skipped" | "failed"; readonly line: string };

export async function requestImagePlanMockup(widen: { readonly label: string; readonly traits: readonly string[] }, signal?: AbortSignal): Promise<ImagePlanOutcome> {
  const config = loadAiConfig();
  const chosen = config.imageProviderId;
  const candidates = chosen ? [chosen] : [RECOMMENDED_IMAGE_PROVIDER_ID, DEFAULT_IMAGE_PROVIDER_ID];
  const missing = await Promise.all(candidates.map((id) => companionCredentialMissing(id)));
  if (missing.every(Boolean)) return { kind: "skipped", line: IMAGE_PLAN_SKIPPED_LINE };
  try {
    const image = await generateAiImage({ prompt: imagePlanPrompt(widen), ...(signal ? { signal } : {}) });
    const blob = await (await fetch(image.dataUrl)).blob();
    return { kind: "mockup", dataUrl: await shrinkReferenceImage(blob), model: image.model };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { kind: "failed", line: IMAGE_PLAN_FAILED_LINE };
  }
}
