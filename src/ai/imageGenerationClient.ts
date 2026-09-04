import { companionCompletionsBaseUrl, type AiConfig } from "@/ai/llmClient";
import { ANTIGRAVITY_PROVIDER_ID } from "@/ai/oauth/credentials";

/**
 * 이미지 생성이 실측으로 통과하는 제공자는 Antigravity 하나다. Codex(Responses) 는
 * 호스팅 `image_generation` 툴을 요청할 경로가 pi-ai 에 없다(`Tool.native` 가 computer 만
 * 받는다). 그래서 텍스트 제공자가 무엇이든 그림은 이 제공자로 넘긴다.
 *
 * 요청 모델은 gemini-3.8-flash. 동반 서비스 카탈로그에 없으면
 * getBundledModel 이 gemini-3.1-flash-image 로 떨어진다(IMAGE 모달리티 실측 ID).
 */
export const IMAGE_GENERATION_PROVIDER_ID = ANTIGRAVITY_PROVIDER_ID;
export const IMAGE_GENERATION_MODEL = "gemini-3.8-flash";

const IMAGE_REQUEST_TIMEOUT_MS = 180_000;

export interface GeneratedImageAsset {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly model: string;
  readonly provider: string;
}

export interface GenerateAiImageRequest {
  readonly prompt: string;
  readonly model?: string;
  readonly signal?: AbortSignal;
}

export interface GenerateAiImageDeps {
  readonly fetch?: typeof fetch;
}

export class ImageGenerationError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ImageGenerationError";
    this.status = status;
  }
}

export function imageGenerationEndpoint(): string {
  return `${companionCompletionsBaseUrl().replace(/\/$/, "")}/images/generations`;
}

export function imageGenerationUsesOtherProvider(config: AiConfig): boolean {
  return config.providerId !== IMAGE_GENERATION_PROVIDER_ID;
}

function parseImage(payload: unknown): GeneratedImageAsset {
  const image = (payload as { image?: unknown })?.image;
  if (!image || typeof image !== "object") {
    throw new ImageGenerationError("이미지 응답 형식이 올바르지 않습니다.");
  }
  const record = image as Record<string, unknown>;
  const dataUrl = typeof record.dataUrl === "string" ? record.dataUrl : "";
  if (!dataUrl.startsWith("data:image/")) {
    throw new ImageGenerationError("이미지 응답에 dataUrl 이 없습니다.");
  }
  return {
    dataUrl,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : "image/png",
    model: typeof record.model === "string" ? record.model : IMAGE_GENERATION_MODEL,
    provider: typeof record.provider === "string" ? record.provider : IMAGE_GENERATION_PROVIDER_ID,
  };
}

export async function generateAiImage(
  request: GenerateAiImageRequest,
  deps: GenerateAiImageDeps = {},
): Promise<GeneratedImageAsset> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new ImageGenerationError("그림 설명(prompt)이 비어 있습니다.");

  const doFetch = deps.fetch ?? fetch;
  const timeout = AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS);
  const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await doFetch(imageGenerationEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Rpgzzu-Provider": IMAGE_GENERATION_PROVIDER_ID,
      },
      body: JSON.stringify({ prompt, model: request.model ?? IMAGE_GENERATION_MODEL }),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new ImageGenerationError(
        request.signal?.aborted ? "생성을 취소했습니다" : "이미지 생성이 시간 안에 끝나지 않았습니다.",
      );
    }
    throw new ImageGenerationError(
      `이미지 생성 요청을 보내지 못했습니다: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  const text = await response.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const detail = (payload as { error?: unknown })?.error;
    const message = typeof detail === "string" && detail ? detail : `이미지 생성 실패 (HTTP ${response.status})`;
    throw new ImageGenerationError(message, response.status);
  }
  return parseImage(payload);
}
