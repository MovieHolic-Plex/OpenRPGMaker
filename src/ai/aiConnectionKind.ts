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
// 레지스트리에는 ChatGPT·Google(oauth)과 Grok(apiKey)이 있다. 자격은 동반 서비스
// 저장소(~/.oprn/oh-my-pi-auth.json)에만 있고 **브라우저에 비밀을 남기지 않는다.**
// `configForConnectionKind` 가 그것을 강제한다.

import { DEFAULT_BASE_URL, type AiConfig } from "@/ai/llmClient";
import {
  RECOMMENDED_OH_MY_PI_PROVIDER,
  OH_MY_PI_PROVIDERS,
  ohMyPiAuthKind,
  parseOhMyPiProvider,
  type OhMyPiProvider,
} from "@/ai/ohMyPiProviders";

/**
 * 사용자가 고르는 연결 방식. 목록 자체는 종류와 무관하게 레지스트리 전체다 —
 * Grok 에서 Google·ChatGPT 로 돌아올 수 있어야 한다.
 */
export type AiConnectionKindId = "oauth" | "apiKey";

/**
 * 설정이 어느 종류에 속하는지 — providerId 에서 파생한다. 저장 필드가 아니다.
 * Grok 은 "apiKey", 구독 두 제공자는 "oauth" 다. 모르는 id 는 옛 기본(Google)으로 스냅된다.
 */
export function editorConnectionKind(config: AiConfig): AiConnectionKindId {
  return ohMyPiAuthKind(config.providerId) === "oauth" ? "oauth" : "apiKey";
}

/**
 * 종류별 제공자 목록 — 두 종류 모두 레지스트리 전체를 돌려준다.
 *
 * 종류로 목록을 갈라 빈 select 가 되면, 고른 제공자에서 다른 제공자로 돌아올 수 없다.
 * 순서는 레지스트리 순서다. 첫 항목은 새로 설정할 때의 권장값(ChatGPT)이다.
 */
export function providersForKind(_kind: AiConnectionKindId): readonly OhMyPiProvider[] {
  return OH_MY_PI_PROVIDERS;
}

/** 제공자가 여럿이므로 사용자에게 실제 선택권이 있다 — UI 는 선택기를 활성화한다. */
export function editorHasProviderChoice(): boolean {
  return OH_MY_PI_PROVIDERS.length > 1;
}

/** 그 종류의 기본 제공자. 두 종류가 같은 목록을 쓰므로 기본값도 하나다. */
export function defaultProviderForKind(_kind: AiConnectionKindId): string {
  return RECOMMENDED_OH_MY_PI_PROVIDER;
}

/**
 * 종류(선택적으로 제공자까지)를 적용한 설정을 만든다.
 *
 * 언제나 전송 축을 companion 으로, `baseUrl`·`apiKey` 를 빈 문자열로 정규화한다 — 에디터가
 * 브라우저에 비밀이나 죽은 게이트웨이 주소를 남기지 못하게 하는 지점이 여기 하나다.
 * 제공자는 요청값(모르는 문자열이면 기본값으로 스냅)이나 기존 설정값을 그대로 이어받는다:
 * 두 제공자가 같은 종류라 "종류에 맞지 않는 제공자"라는 모순 상태가 성립하지 않으므로 종류를
 * 근거로 제공자를 되돌릴 일이 없다.
 */
export function configForConnectionKind(
  base: AiConfig,
  kind: AiConnectionKindId,
  providerId?: string,
): AiConfig {
  void kind;
  const resolved = parseOhMyPiProvider(providerId === undefined ? base.providerId : providerId);
  return {
    ...base,
    authMode: "chatgpt",
    providerId: resolved,
    baseUrl: DEFAULT_BASE_URL,
    apiKey: "",
  };
}
