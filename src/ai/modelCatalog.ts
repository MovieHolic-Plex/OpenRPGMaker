import { getOhMyPiProvider, parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

export interface AiModelCatalogGroup {
  readonly label: string;
  readonly models: readonly string[];
}

/**
 * Codex(ChatGPT 구독) 경로에서 실제로 고를 수 있는 모델.
 *
 * 이 경로는 @oh-my-pi/pi-ai 가 전송을 맡고, 모델은 @oh-my-pi/pi-catalog 의
 * `getBundledModels("openai-codex")` 에서만 해석된다. 카탈로그에 없는 ID 를 보내면 오류가 아니라
 * **조용히 제공자 기본 모델로 떨어진다** — 실측(2026-08-21, 동반 서비스에 같은 본문을 모델만 바꿔 재생):
 *   gpt-5.5           → model=gpt-5.5  "OK"
 *   gpt-5.1-codex-max → model=gpt-5.5  "OK"   ← 카탈로그 밖. 요청한 모델이 무시됐다.
 * 그래서 목록은 pi-catalog 와 동일해야 한다(실측 2026-08-27 `getBundledModels("openai-codex")` 8종).
 * 첫 항목은 제공자 기본값(gpt-5.6-sol)을 유지한다.
 */
const CODEX_MODELS: readonly string[] = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex-spark",
  "gpt-daybreak-blue-latest",
];

/**
 * Antigravity 경로에서 고를 수 있는 모델.
 *
 * `getBundledModels("google-antigravity")` 실측(2026-08-27) 결과를 그대로 쓴다. pi-catalog 가
 * 제공자 전송 계층이 실제로 해석하는 모델 목록이므로, gemini 밖 네임스페이스(Claude·gpt-oss·
 * tab_*)도 여기서는 **Antigravity 소속 모델**이다. 첫 항목만 제품 기본값(gemini-3.7-flash)에
 * 맞춰 앞으로 옮겼다.
 *
 * `gemini-3.7-flash-high` 는 없다 — 실측(2026-08-26) 결과 Cloud Code Assist 가 그 ID 를 404
 * `Requested entity was not found` 로 거부한다. Antigravity 에서 `-high`/`-medium`/`-low` 는
 * 독립 모델이 아니라 `gemini-3.7-flash` 의 `thinking.effortRouting` 대상 이름이다.
 *
 * `gemini-3.8-flash` 도 없다 — 실측(2026-09-10) 결과 번들 17.4.0 의
 * `getBundledModels("google-antigravity")` 19종에 없고, 저장된 Pi 요청이 번들 첫 항목으로
 * 조용히 바뀌어 CCA 404 즉시 실패가 났다. 번들에 들어오면 그때 목록에 올린다.
 */
const ANTIGRAVITY_MODELS: readonly string[] = [
  "gemini-3.7-flash",
  "claude-opus-4-5",
  "claude-opus-4-6",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-3-flash",
  "gemini-3-pro",
  "gemini-3.1-flash-image",
  "gemini-3.1-flash-lite",
  "gemini-3.1-pro",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash-tiered",
  "gpt-oss-120b",
  "tab_flash_lite_preview",
  "tab_jump_flash_lite_preview",
];

/**
 * 제공자별 모델 목록. 에디터가 고를 수 있는 제공자가 둘뿐이므로 카탈로그도 둘뿐이다.
 * 옛 게이트웨이 그룹은 걷어냈다 — 그 모델들에 닿을 제공자가 레지스트리에 없다.
 */
const PROVIDER_MODELS: Readonly<Record<string, readonly string[]>> = {
  [ANTIGRAVITY_PROVIDER_ID]: ANTIGRAVITY_MODELS,
  [CODEX_PROVIDER_ID]: CODEX_MODELS,
};

/**
 * 그 제공자에서 고를 수 있는 모델 그룹.
 *
 * authMode(전송 축)는 목록을 가르지 않는다 — 주입 게이트웨이 설정(노드 스크립트·벤치마크)도
 * 결국 이 두 제공자의 모델을 쓴다. 인자는 호출부 호환을 위해 유지한다.
 */
export function modelCatalogForAuthMode(
  authMode: "chatgpt" | "apiKey",
  providerId?: string,
): readonly AiModelCatalogGroup[] {
  void authMode;
  const id = parseOhMyPiProvider(providerId);
  const provider = getOhMyPiProvider(id);
  const models = PROVIDER_MODELS[id] ?? (provider ? [provider.defaultModel] : []);
  return [{ label: `${provider?.label ?? id} · oh-my-pi`, models }];
}

/**
 * 해당 제공자의 권장 기본 모델. 카탈로그 첫 그룹의 첫 항목을 기준으로 한다.
 * 공장 기본은 Antigravity 의 gemini-3.7-flash — 모든 모델 슬롯이 이 값을 기본으로 쓴다
 * (감독 지시 2026-08-26, 계약은 test/aiDefaultModelForced.test.ts 가 고정한다).
 * Codex 카탈로그 첫 항목은 gpt-5.6-sol.
 * 카탈로그가 비어 있을 리 없지만(방어), 비어 있으면 빈 문자열을 돌려 호출자가 자기 폴백을 쓰게 한다.
 */
export function defaultModelForAuthMode(authMode: "chatgpt" | "apiKey", providerId?: string): string {
  const groups = modelCatalogForAuthMode(authMode, providerId);
  return groups[0]?.models[0] ?? "";
}

/**
 * 모델 ID 가 해당 제공자에서 실제로 쓸 수 있는지 판정한다.
 *
 * apiKey 전송(주입 게이트웨이)은 어떤 ID 든 허용한다 — 그 경로는 UI 가 없고, 설정을 직접 넣는
 * 소비자가 자기 게이트웨이의 모델 이름을 안다.
 *
 * companion 전송에서는 **선택된 제공자의 pi-catalog 목록에 속하는가**로 판정한다. 카탈로그 밖 ID 는
 * `resolveModel` 이 오류 대신 제공자 기본 모델로 조용히 강등시키므로(근거는 CODEX_MODELS 주석의
 * 실측), 다른 모델이 답한 줄 모르게 두기보다 미리 거부해 loadAiConfig 가 그 제공자의 기본값으로
 * 교정하게 한다. 이것이 남의 네임스페이스 ID(Antigravity 에 gpt-…, Codex 에 gemini-…, 옛 기본값
 * z-ai/… 같은 제공자 접두사)가 그대로 실려 나가 400 이 되던 실측 장애를 막는다.
 *
 * 예외 하나: Antigravity 는 gemini 네임스페이스를 번들링 밖이라도 통과시킨다 — 카탈로그는 굳어
 * 있는 스냅샷이고, 아직 번들링에 없는 새 gemini 변형을 사용자가 직접 입력하는 것은 정상 사용이다.
 * 단 사고 강도 변형(`-high`/`-medium`/`-low`)은 그 예외에서 다시 제외한다 — 독립 모델이
 * 아니라 `thinking.effortRouting` 대상 이름이고 실제로 404 다(실측 2026-08-26).
 */
export function isModelValidForAuthMode(
  authMode: "chatgpt" | "apiKey",
  model: string,
  providerId?: string,
): boolean {
  if (authMode !== "chatgpt") return true;
  const provider = parseOhMyPiProvider(providerId);
  const wanted = model.trim().toLowerCase();
  const allowed = PROVIDER_MODELS[provider] ?? [];
  if (allowed.some((id) => id.toLowerCase() === wanted)) return true;
  if (provider !== ANTIGRAVITY_PROVIDER_ID) return false;
  if (/-(?:high|medium|low)$/u.test(wanted)) return false;
  return wanted.startsWith("gemini");
}
