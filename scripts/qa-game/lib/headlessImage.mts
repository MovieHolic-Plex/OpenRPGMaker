// 헤드리스(qa-game gen) 이미지 생성 백엔드 — 편집기의 /v1/images/generations 와 같은 동반 앱 경로를 프로세스 안에서 부른다.
import { DEFAULT_OH_MY_PI_PROVIDER } from "../../../src/ai/ohMyPiProviders";
import type { GenerateAiImageRequest, GeneratedImageAsset } from "../../../src/ai/imageGenerationClient";
import { spawnSync } from "node:child_process";
import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_PROVIDER_ID } from "../../../src/ai/imageModelCatalog";
// @ts-expect-error — .mjs 동반 앱 라이브러리
import { createOhMyPiAdapters } from "../../lib/ohMyPiPiAi.mjs";
// @ts-expect-error — .mjs 동반 앱 라이브러리
import { handleCompanionRequest } from "../../lib/ohMyPiHttp.mjs";

let adapters: unknown;
export async function headlessGenerateImage(request: GenerateAiImageRequest): Promise<GeneratedImageAsset> {
  adapters ??= await createOhMyPiAdapters();
  const providerId = request.providerId ?? DEFAULT_IMAGE_PROVIDER_ID;
  const model = request.model ?? DEFAULT_IMAGE_MODEL;
  const result = await handleCompanionRequest(
    { method: "POST", url: "/v1/images/generations", headers: { "x-oprn-provider": providerId ?? DEFAULT_OH_MY_PI_PROVIDER }, body: { prompt: request.prompt, model, ...(request.referenceImages?.length ? { referenceImages: request.referenceImages } : {}) } },
    adapters,
  );
  if (result.status !== 200) throw new Error(`image HTTP ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
  const image = result.body?.image;
  if (!image?.dataUrl) throw new Error(`image: 응답에 dataUrl 이 없다 ${JSON.stringify(result.body).slice(0, 200)}`);
  return { dataUrl: toPngDataUrl(image.dataUrl), mimeType: "image/png", model, provider: providerId };
}

/** 응답이 JPEG 여도 후처리(src/editor/cutsceneArt)는 PNG 만 읽는다 — ffmpeg 로 바꿔 건넨다. */
function toPngDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith("data:image/png")) return dataUrl;
  const converted = spawnSync("ffmpeg", ["-v", "error", "-i", "pipe:0", "-f", "image2pipe", "-c:v", "png", "pipe:1"], {
    input: Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"), maxBuffer: 64 * 1024 * 1024,
  });
  if (converted.status !== 0 || converted.stdout.length === 0) throw new Error(`ffmpeg PNG 변환 실패: ${String(converted.stderr).slice(0, 200)}`);
  return `data:image/png;base64,${converted.stdout.toString("base64")}`;
}
