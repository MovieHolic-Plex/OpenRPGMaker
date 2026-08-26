// ai/aiConnectionKind.ts
// 에디터 인증 UI 의 2종 선택 — **구독 로그인(OAuth)** / **API 키**.
//
// 설계 원칙 하나: **이 종류는 파생값이고 절대 저장하지 않는다.** providerId 의 authKind 에서
// 계산한다. 별도 필드로 저장하면 providerId 와 드리프트하는 세 번째 진실 원천이 생기고, 그게
// 바로 `authMode` 가 전송 축과 자격 축을 겸하다 만든 사고와 같은 부류다.
//
// 축 정리(자세한 근거는 llmClient.aiTransport 주석):
//  - 전송 축  = authMode. 에디터는 **항상** companion 이다(주입 게이트웨이는 UI 가 없다).
//  - 자격 축  = providerId → ohMyPiAuthKind. 사용자가 고르는 것은 이쪽이다.
//
// 동반 서비스는 OAuth 토큰도 API 키도 자기 저장소(~/.rpg-zzu/oh-my-pi-auth.json)에 보관하므로
// 두 종류 모두 **브라우저에 비밀을 남기지 않는다**. `configForConnectionKind` 가 그것을 강제한다.

import { DEFAULT_BASE_URL, type AiConfig } from "@/ai/llmClient";
import {
  DEFAULT_OH_MY_PI_PROVIDER,
  ohMyPiAuthKind,
  parseOhMyPiProvider,
  type OhMyPiProvider, getOhMyPiProvider } from "@/ai/ohMyPiProviders";

/** 사용자가 고르는 연결 방식. `local` 제공자는 "API 키" 쪽에 접는다(키 불필요 안내를 붙인다). */
export type AiConnectionKindId = "oauth" | "apiKey";

/** API 키 종류의 기본 제공자. 레지스트리에 실재하는 id 다(`row("openai", …)`). */
const DEFAULT_API_KEY_PROVIDER = "openai";

/** 설정이 어느 종류에 속하는지 — providerId 에서 파생한다. 저장 필드가 아니다. */
export function editorConnectionKind(config: AiConfig): AiConnectionKindId {
  return ohMyPiAuthKind(config.providerId) === "oauth" ? "oauth" : "apiKey";
}

/**
 * 종류별 제공자 목록. 구독 로그인은 oauth 14종, API 키는 apiKey 50 + local 4 = 54종이다.
 * 순서는 레지스트리 순서를 유지하되, 구독 로그인은 기본 제공자를 맨 앞으로 올린다 —
 * 첫 항목이 곧 권장값이라는 관례를 목록 자체가 지키게 한다.
 */
export function providersForKind(_kind: AiConnectionKindId): readonly OhMyPiProvider[] {
  // 에디터는 Antigravity 하나만 쓴다 (감독 지시 2026-08-26: 모든 AI 를 Antigravity 로 통일,
  // 잔여 경로 없음). 예전에는 종류별로 oauth 14종 / apiKey+local 54종을 노출했지만,
  // loadAiConfig·saveAiConfig 가 제공자를 강제하므로 그 목록은 고를 수 없는 선택지였다 —
  // 화면에 남겨 두면 고르면 바뀌는 것처럼 보이는 거짓 표면이 된다.
  const forced = getOhMyPiProvider(DEFAULT_OH_MY_PI_PROVIDER);
  return forced ? [forced] : [];
}

/** 종류 축은 제공자에서 파생하고 제공자가 하나뿐이므로 항상 구독 로그인이다. */
export function editorHasProviderChoice(): boolean {
  return false;
}

/** 그 종류의 기본 제공자. */
export function defaultProviderForKind(kind: AiConnectionKindId): string {
  return kind === "oauth" ? DEFAULT_OH_MY_PI_PROVIDER : DEFAULT_API_KEY_PROVIDER;
}

/**
 * 종류(선택적으로 제공자까지)를 적용한 설정을 만든다.
 *
 * 언제나 전송 축을 companion 으로, `baseUrl`·`apiKey` 를 빈 문자열로 정규화한다 — 에디터가
 * 브라우저에 비밀이나 죽은 게이트웨이 주소를 남기지 못하게 하는 지점이 여기 하나다.
 * 요청한 제공자가 그 종류에 속하지 않으면 종류의 기본 제공자로 스냅한다(모순 상태 금지).
 */
export function configForConnectionKind(
  base: AiConfig,
  kind: AiConnectionKindId,
  providerId?: string,
): AiConfig {
  const wanted = providerId === undefined ? undefined : parseOhMyPiProvider(providerId);
  const fits = wanted !== undefined
    && (ohMyPiAuthKind(wanted) === "oauth") === (kind === "oauth");
  const keepsKind = editorConnectionKind(base) === kind;
  const resolved = fits
    ? wanted
    : wanted === undefined && keepsKind
      ? parseOhMyPiProvider(base.providerId)
      : defaultProviderForKind(kind);
  return {
    ...base,
    authMode: "chatgpt",
    providerId: resolved,
    baseUrl: DEFAULT_BASE_URL,
    apiKey: "",
  };
}
