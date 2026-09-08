import { Buffer } from "node:buffer";
import { CODEX_PROVIDER_ID, decodeJwtPayload } from "../../src/ai/oauth/credentials.ts";
import { ImageReferenceError, parseImageReferences } from "../../src/ai/imageReferences.ts";
import type { GeneratedImage } from "./ohMyPiImageRuntime.ts";

// Internal selection ID, not an upstream model/version. Native responses do not report a version.
export const CODEX_IMAGE_MODEL = "codex-image-default";
const IMAGE_ENDPOINT = "https://chatgpt.com/backend-api/codex/images/generations";
const IMAGE_TIMEOUT_MS = 180_000;

function statusError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

/** Text-only native Codex image sidecar; authentication is resolved by the existing Node adapter. */
export async function generateCodexImage(
  body: Record<string, unknown>,
  options?: { apiKey?: string; fetch?: typeof fetch },
): Promise<GeneratedImage> {
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw statusError("prompt 가 필요합니다.", 400);
  if (body.model !== undefined && body.model !== CODEX_IMAGE_MODEL) {
    throw statusError("Codex 이미지 생성은 codex-image-default 선택만 지원합니다. 다른 모델로 대체하지 않습니다.", 400);
  }
  let references;
  try {
    references = parseImageReferences(body.referenceImages);
  } catch (error) {
    if (error instanceof ImageReferenceError) throw statusError(error.message, 400);
    throw error;
  }
  // An edits endpoint exists in Codex, but this app's reference wire mapping is not verified.
  if (references.length > 0) {
    throw statusError("Codex 이미지 생성은 현재 텍스트 설명만 지원합니다. 참조 그림은 지원하지 않으며 생략해서 생성하지 않습니다.", 409);
  }

  const token = options?.apiKey;
  const claims = token ? decodeJwtPayload<{ "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown } }>(token) : null;
  const accountId = claims?.["https://api.openai.com/auth"]?.chatgpt_account_id;
  if (!token || typeof accountId !== "string" || !accountId.trim() || /[\r\n]/.test(accountId)) {
    throw statusError("Codex 이미지 생성에 유효한 ChatGPT 로그인이 필요합니다. AI 설정에서 Codex 연결을 확인해 주세요.", 401);
  }

  let response: Response;
  let text: string;
  const deadline = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
  try {
    response = await (options?.fetch ?? fetch)(IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "ChatGPT-Account-Id": accountId,
        "Content-Type": "application/json",
        Accept: "application/json",
        originator: "codex_cli_rs",
      },
      // Never send the internal sentinel as a provider model. No version or provider fallback.
      body: JSON.stringify({ prompt, n: 1, size: "1024x1024" }),
      signal: deadline,
      redirect: "manual",
    });
    text = await response.text();
  } catch (error) {
    if (deadline.aborted || (error instanceof Error && error.name === "TimeoutError")) {
      throw statusError("Codex 이미지 생성이 180초 안에 끝나지 않았습니다.", 504);
    }
    // Transport/provider text may contain credentials; do not echo it into the browser.
    throw statusError("Codex 이미지 생성 서버에 연결하거나 응답을 읽지 못했습니다.", 502);
  }
  if (!response.ok) {
    throw statusError("Codex 이미지 생성 실패 (HTTP " + response.status + ").", response.status >= 400 ? response.status : 502);
  }
  let payload: { data?: { b64_json?: unknown }[] } | null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw statusError("Codex 이미지 응답이 올바른 JSON이 아닙니다.", 502);
  }
  if (!Array.isArray(payload?.data) || payload.data.length === 0) {
    throw statusError("Codex 응답에 이미지가 없습니다.", 502);
  }
  if (payload.data.length !== 1) throw statusError("Codex 응답의 이미지 수가 요청과 다릅니다.", 502);
  const base64 = payload.data[0]?.b64_json;
  if (typeof base64 !== "string" || !base64 || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw statusError("Codex 이미지 응답의 base64 데이터가 올바르지 않습니다.", 502);
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.toString("base64") !== base64) throw statusError("Codex 이미지 응답의 base64 데이터가 올바르지 않습니다.", 502);
  const mimeType = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? "image/png"
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      ? "image/jpeg"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
        ? "image/webp"
        : "";
  if (!mimeType) throw statusError("Codex 응답의 이미지 형식을 확인할 수 없습니다.", 502);
  return { provider: CODEX_PROVIDER_ID, model: CODEX_IMAGE_MODEL, mimeType, base64 };
}
