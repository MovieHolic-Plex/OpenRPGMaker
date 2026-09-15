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
// 레지스트리에는 Antigravity·Codex 두 제공자만 있고 둘 다 oauth 다. 그래서 자격 축은 실질적으로
// 한 값이고, 사용자의 선택은 "어느 구독으로 갈 것인가"다. 두 제공자 모두 자격을 동반 서비스가
// 자기 저장소(~/.oprn/oh-my-pi-auth.json)에 보관하므로 **브라우저에 비밀을 남기지 않는다.**
// `configForConnectionKind` 가 그것을 강제한다.

import { DEFAULT_BASE_URL, type AiConfig } from "@/ai/llmClient";
import {
  DEFAULT_OH_MY_PI_PROVIDER,
  OH_MY_PI_PROVIDERS,
  ohMyPiAuthKind,
  parseOhMyPiProvider,
  type OhMyPiProvider,
} from "@/ai/ohMyPiProviders";

/**
 * 사용자가 고르는 연결 방식. 두 값을 유지하지만 레지스트리에는 oauth 제공자만 있으므로
 * "API 키" 쪽에 내놓을 제공자가 없다 — 가짜 apiKey 제공자를 만들어 채우지 않는다.
 */
export type AiConnectionKindId = "oauth" | "apiKey";

/**
 * 설정이 어느 종류에 속하는지 — providerId 에서 파생한다. 저장 필드가 아니다.
 * 두 제공자가 모두 구독 로그인이므로 실제로 나오는 값은 항상 "oauth" 다.
 */
export function editorConnectionKind(config: AiConfig): AiConnectionKindId {
  return ohMyPiAuthKind(config.providerId) === "oauth" ? "oauth" : "apiKey";
}

/**
 * 종류별 제공자 목록 — 두 종류 모두 같은 두 제공자(Antigravity·Codex)를 돌려준다.
 *
 * 종류로 목록을 갈랐던 이유는 apiKey 제공자가 따로 있었기 때문이다. 지금은 둘 다 구독 로그인이라
 * "API 키" 쪽에 내놓을 제공자가 없는데, 그렇다고 빈 select 를 세우면 종류를 눌렀을 때 고를 것이
 * 사라져 화면이 고장난 것처럼 보인다(실측: 제공자를 하나로 강제했을 때 apiKey 필터가 빈 select 를
 * 만들었다). 순서는 레지스트리 순서 = 기본 제공자 우선이다 — 첫 항목이 곧 권장값이다.
 */
export function providersForKind(_kind: AiConnectionKindId): readonly OhMyPiProvider[] {
  return OH_MY_PI_PROVIDERS;
}

/** 제공자가 둘이므로 사용자에게 실제 선택권이 있다 — UI 는 선택기를 활성화한다. */
export function editorHasProviderChoice(): boolean {
  return OH_MY_PI_PROVIDERS.length > 1;
}

/** 그 종류의 기본 제공자. 두 종류가 같은 목록을 쓰므로 기본값도 하나다. */
export function defaultProviderForKind(_kind: AiConnectionKindId): string {
  return DEFAULT_OH_MY_PI_PROVIDER;
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
