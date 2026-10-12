// Grok (xAI) — 에디터 제공자 id 는 pi-catalog 의 `xai` 와 같아야 한다.
// getBundledModel("xai", "grok-4.7") 가 https://api.x.ai/v1 의 OpenAI 호환 전송을 이미 알고 있다.
//
// 공식 추론 API 인증은 Bearer API 키다(콘솔 https://console.x.ai, 환경 변수 XAI_API_KEY).
// auth.x.ai 에 OIDC(인가·토큰·디바이스 코드)가 있지만, xAI 가 이 앱용 client id 를 공개하지 않는다.
// 다른 제품의 client id 를 저장소에 넣지 않으므로 디바이스 로그인은 연결하지 않는다.

export const XAI_PROVIDER_ID = "xai";
export const XAI_API_BASE_URL = "https://api.x.ai/v1";
export const XAI_DEFAULT_MODEL = "grok-4.7";
export const XAI_API_KEY_ENV = "XAI_API_KEY";

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
