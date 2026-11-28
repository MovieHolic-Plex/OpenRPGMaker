// Google Antigravity 직접 OAuth 이미지 생성은 계정 정지 위험으로 비활성화되었다(2026-11-28).
// 기본 그림 생성 경로는 ChatGPT(Codex)의 codexImageRuntime.ts 이다.
import { applyLegacyEnvAliases } from "./oprnEnv.mjs";

applyLegacyEnvAliases();

export const IMAGE_PROVIDER_ID = "google-antigravity";
export const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

export interface GeneratedImage {
  readonly provider: string;
  readonly model: string;
  readonly mimeType: string;
  readonly base64: string;
}

const IMAGE_DISABLED_MESSAGE =
  "Google 계정 직접 로그인(google-antigravity)은 계정 정지 위험으로 비활성화되어 있습니다. AI 설정 → 「그림·도트 모델」에서 ChatGPT(Codex)를 사용해 주세요.";

export function resolveDefaultImageModel(_provider: string = IMAGE_PROVIDER_ID): string | null {
  return DEFAULT_IMAGE_MODEL;
}

export async function generateProviderImage(
  provider: string,
  body: Record<string, unknown>,
  _options?: { apiKey?: string; signal?: AbortSignal },
): Promise<GeneratedImage> {
  if (process.env.OPRN_OH_MY_PI_TEST_STUB === "1") {
    return {
      provider,
      model: typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_IMAGE_MODEL,
      mimeType: "image/png",
      base64: TRANSPARENT_PNG_BASE64,
    };
  }
  if (provider !== IMAGE_PROVIDER_ID) {
    const error = new Error(`지원하지 않는 이미지 제공자입니다: ${provider}`) as Error & { status?: number };
    error.status = 409;
    throw error;
  }
  const error = new Error(IMAGE_DISABLED_MESSAGE) as Error & { status?: number };
  error.status = 400;
  throw error;
}
