// Grok (xAI) — 제공자 id 는 pi-catalog 와 같아야 한다.
// `xai` 는 API 키, `xai-oauth` 는 SuperGrok / X Premium+ 디바이스 로그인이다.
// getBundledModel 이 둘 다 https://api.x.ai/v1 의 OpenAI 호환 전송을 안다.
// OAuth client id 는 저장소에 적지 않는다. oauthClient("xaiClientId") 가 읽는다.

export const XAI_PROVIDER_ID = "xai";
export const XAI_OAUTH_PROVIDER_ID = "xai-oauth";
export const XAI_API_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL = "grok-4.7";
export const XAI_API_KEY_ENV = "XAI_API_KEY";
export const XAI_OAUTH_TOKEN_ENV = "XAI_OAUTH_TOKEN";

/** 채팅에 쓰는 모델만. 이미지·음성 id 는 채팅 완료에서 400 이 된다. */
export const XAI_MODELS = [
  "grok-4.7",
  "grok-4.6",
  "grok-4.5",
  "grok-4.3",
  "grok-build-0.1",
] as const;

export const XAI_KEY_INSTRUCTIONS =
  "xAI Console(https://console.x.ai)에서 API 키를 만들어 붙여 넣으세요. 서버 환경 변수 XAI_API_KEY 도 사용할 수 있습니다. 키는 브라우저가 아니라 이 컴퓨터의 연결 서비스에만 저장됩니다.";
