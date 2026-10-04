import { Buffer } from "node:buffer";
import {
  buildResponsesRequest,
  extractImageGeneration,
  loadCodexSession,
  parseSseText,
  resolveConfig,
} from "god-tibo-imagen";
import { CODEX_PROVIDER_ID, decodeJwtPayload } from "../../src/ai/oauth/credentials.ts";
import { ImageReferenceError, parseImageReferences } from "../../src/ai/imageReferences.ts";
import type { GeneratedImage } from "./ohMyPiImageRuntime.ts";

// Stable app selection ID; never send this sentinel upstream.
export const CODEX_IMAGE_MODEL = "codex-image-default";
// god-tibo-imagen(https://github.com/NomaDamas/god-tibo-imagen) 경로: Codex `/responses` 에 image_generation 도구를 붙여 부른다.
// `/images/generations` 와 달리 참조 그림(input_image)을 받는다 — 설계도 기준 이미지로 건물을 그릴 때 필요하다.
// 모델·이미지 모델·기본 주소는 god-tibo-imagen 설정(CODEX_IMAGEGEN_* 환경 변수)을 그대로 따른다.
const IMAGE_TIMEOUT_MS = 300_000;
const SIZES = new Set(["auto", "1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840"]);

function statusError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

const AUTH_MESSAGE = "Codex 이미지 생성에 유효한 ChatGPT 로그인이 필요합니다. AI 설정에서 Codex 연결을 확인하거나 `codex login` 으로 로그인해 주세요.";

/** 앱의 Codex 로그인 토큰이 있으면 그것을, 없으면 codex CLI 로그인(~/.codex/auth.json)을 쓴다. */
async function resolveSession(apiKey: string | undefined, config: ReturnType<typeof resolveConfig>) {
  if (apiKey) {
    const claims = decodeJwtPayload<{ "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown } }>(apiKey);
    const accountId = claims?.["https://api.openai.com/auth"]?.chatgpt_account_id;
    if (typeof accountId !== "string" || !accountId.trim() || /[\r\n]/.test(accountId)) throw statusError(AUTH_MESSAGE, 401);
    return { accessToken: apiKey, accountId, installationId: null };
  }
  const session = await loadCodexSession(config).catch(() => null);
  if (!session?.accessToken || !session.accountId || session.authMode !== "chatgpt") throw statusError(AUTH_MESSAGE, 401);
  return { accessToken: session.accessToken, accountId: session.accountId, installationId: session.installationId };
}

/** Codex 이미지 생성. 참조 그림은 최대 2장(parseImageReferences 경계), 크기는 god-tibo-imagen 이 받는 값만. */
export async function generateCodexImage(
  body: Record<string, unknown>,
  options?: { apiKey?: string; fetch?: typeof fetch; signal?: AbortSignal },
): Promise<GeneratedImage> {
  options?.signal?.throwIfAborted();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw statusError("prompt 가 필요합니다.", 400);
  if (body.model !== undefined && body.model !== CODEX_IMAGE_MODEL) {
    throw statusError("Codex 이미지 생성은 codex-image-default 선택만 지원합니다. 다른 모델로 대체하지 않습니다.", 400);
  }
  const size = body.size === undefined ? "auto" : String(body.size);
  if (!SIZES.has(size)) throw statusError(`Codex 이미지 크기 ${size} 는 지원하지 않습니다.`, 400);
  let references;
  try {
    references = parseImageReferences(body.referenceImages);
  } catch (error) {
    if (error instanceof ImageReferenceError) throw statusError(error.message, 400);
    throw error;
  }

  const config = resolveConfig();
  const session = await resolveSession(options?.apiKey, config);
  const request = buildResponsesRequest({
    baseUrl: config.baseUrl,
    session,
    prompt,
    model: config.defaultModel,
    originator: config.defaultOriginator,
    images: references.map((image) => `data:${image.mimeType};base64,${image.data}`),
    size,
    imageModel: config.defaultImageModel,
  });

  let response: Response;
  let text: string;
  const deadline = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
  try {
    response = await (options?.fetch ?? fetch)(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
      signal: options?.signal ? AbortSignal.any([deadline, options.signal]) : deadline,
      redirect: "manual",
    });
    text = await response.text();
  } catch (error) {
    options?.signal?.throwIfAborted();
    if (deadline.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      throw statusError(`Codex 이미지 생성이 ${IMAGE_TIMEOUT_MS / 1000}초 안에 끝나지 않았습니다.`, 504);
    }
    // Transport/provider text may contain credentials; do not echo it into the browser.
    throw statusError("Codex 이미지 생성 서버에 연결하거나 응답을 읽지 못했습니다.", 502);
  }
  options?.signal?.throwIfAborted();
  if (response.status === 401) throw statusError(AUTH_MESSAGE, 401);
  if (!response.ok) {
    throw statusError("Codex 이미지 생성 실패 (HTTP " + response.status + ").", response.status >= 400 ? response.status : 502);
  }
  let base64: string;
  try {
    const trimmed = text.trimStart();
    const parsed = trimmed.startsWith("event:") || trimmed.startsWith("data:")
      ? parseSseText(text)
      : { events: [], items: JSON.parse(text)?.output ?? [] };
    base64 = extractImageGeneration(parsed).resultBase64;
  } catch {
    throw statusError("Codex 응답에 이미지가 없습니다(모델이 그림 대신 글로 답했을 수 있습니다).", 502);
  }
  if (typeof base64 !== "string" || !base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw statusError("Codex 이미지 응답의 base64 데이터가 올바르지 않습니다.", 502);
  }
  const bytes = Buffer.from(base64, "base64");
  const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : "";
  if (!mimeType) throw statusError("Codex 응답의 이미지 형식을 확인할 수 없습니다.", 502);
  return { provider: CODEX_PROVIDER_ID, model: config.defaultImageModel, mimeType, base64 };
}
