// ai/piAgent/userImages.ts
// 첫 화면 「참고 그림」 — 시작 화면 → 편집기 인계 → Pi 실행 요청 → 워커 첫 사용자 차례.
// 시작 화면 번들(startIntent.ts)도 이 파일을 읽으므로 import 를 두지 않는다.

export const MAX_USER_IMAGES = 2;
/** 축소한 그림 하나의 data URL 상한(문자 수). 긴 변 768px JPEG 은 보통 이 값의 절반 아래다. */
export const MAX_USER_IMAGE_URL_CHARS = 400_000;

export const USER_IMAGES_DROPPED_STATUS = "user_images.dropped";
export const USER_IMAGES_ATTACHED_STATUS = "user_images.attached";
export const USER_IMAGES_DROPPED_TEXT = "이 AI 엔진은 그림을 읽지 못해 참고 그림 없이 글만 보냈습니다.";

const DATA_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/u;

/** 믿을 수 없는 값(sessionStorage·HTTP 본문)에서 쓸 수 있는 그림 data URL 만 남긴다. 틀린 항목은 버리고 최대 2장. */
export function parseUserImageDataUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((url): url is string => typeof url === "string" && url.length <= MAX_USER_IMAGE_URL_CHARS && DATA_URL.test(url))
    .slice(0, MAX_USER_IMAGES);
}

export interface UserImageContent {
  readonly type: "image";
  readonly mimeType: string;
  readonly data: string;
  readonly detail: "high";
}

/**
 * 첫 차례에 실을 그림. 로컬 CLI 엔진 중 Claude Code·Codex 는 사용자 차례에 그림을 싣는다(claude: stream-json 이미지 파트,
 * codex: -i 파일 — scripts/lib/localCliAgent). 그림을 못 받는 Gemini CLI 만 글만 보낸다. 예전에는 로컬 CLI 를 모두 막아
 * 구독 사용자가 첫 화면에 붙인 도안이 조용히 버려졌다(2026-11-06 agent-direct-edit 실측: 「그림을 읽지 못해 …」).
 * 카탈로그 모델은 `input` 에 "image" 가 있어야 한다. `input` 을 모르면(바깥에서 넘긴 모델) 보낸다 —
 * 도구 결과 그림 전달 판정(piAgentRuntime modelSeesImages)과 같은 규칙이다.
 * pi-ai 의 OpenAI 호환 변환기가 이 파트를 `image_url` 로 바꾼다.
 */
export function firstPromptImages(input: { readonly urls: unknown; readonly localCli: "claude" | "codex" | "gemini" | undefined; readonly modelInput: unknown }): {
  readonly images: readonly UserImageContent[];
  readonly dropped: number;
} {
  const urls = parseUserImageDataUrls(input.urls);
  if (urls.length === 0) return { images: [], dropped: 0 };
  const takesImages = input.localCli ? input.localCli !== "gemini" : !Array.isArray(input.modelInput) || input.modelInput.includes("image");
  if (!takesImages) return { images: [], dropped: urls.length };
  return {
    images: urls.map((url) => {
      const match = DATA_URL.exec(url)!;
      return { type: "image", mimeType: match[1]!, data: match[2]!, detail: "high" };
    }),
    dropped: 0,
  };
}

export function userImagesPromptNote(count: number): string {
  return `[참고 그림] 사용자가 첫 화면에서 참고 그림 ${count}장을 붙였다(이 메시지에 함께 실림). 화풍·분위기·색감·구도의 참고로 쓰고, 그대로 베끼지 않는다.`;
}
