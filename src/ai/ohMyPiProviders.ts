// 에디터가 고를 수 있는 LLM 제공자 레지스트리 — **Antigravity 와 Codex 둘뿐이다.**
//
// 예전에는 oh-my-pi 카탈로그(`@oh-my-pi/pi-catalog` CATALOG_PROVIDERS)의 69종을 그대로 베껴
// 두고 authKind 로 분류했다. 그 목록은 고를 수 없는 선택지였다 — 동반 서비스에 로그인 경로가
// 붙어 있는 것은 이 둘뿐이고, 나머지는 화면에 남겨 두면 "고르면 바뀐다"는 거짓 표면이 된다.
// 두 제공자 모두 구독 로그인(oauth)이라 브라우저에는 어떤 비밀도 남지 않는다(자격은 동반
// 서비스의 ~/.rpg-zzu/oh-my-pi-auth.json 에만 있다).
//
// id 문자열은 src/ai/oauth/credentials.ts 에서 가져온다 — 전송 계층(packRequestApiKey)과 UI 가
// 같은 상수를 보게 해서 한쪽만 오타/개명되는 사고를 없앤다.

import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

/**
 * 자격 증명 종류. 레지스트리에는 oauth 만 남았지만 세 값을 유지한다 — 동반 서비스의
 * `/auth/status` 가 저장된 자격의 종류로 `apiKey`·`local` 을 돌려줄 수 있고
 * (chatgptOAuthClient.ChatGptAuthStatus), 그 값을 한국어로 옮길 라벨이 필요하다.
 */
export type OhMyPiAuthKind = "oauth" | "apiKey" | "local";

export type OhMyPiProvider = {
  readonly id: string;
  readonly label: string;
  readonly defaultModel: string;
  readonly envVars: readonly string[];
  readonly authKind: OhMyPiAuthKind;
};

/**
 * 두 제공자. 순서가 곧 UI 순서이고 **첫 항목이 기본값**이다.
 *
 * defaultModel 은 modelCatalog 의 제공자별 첫 항목과 같아야 한다(계약은
 * test/modelCatalog.test.ts 가 고정한다). 카탈로그를 여기서 import 하지 않는 이유는
 * modelCatalog 가 이 모듈을 import 하기 때문 — 순환을 만들지 않고 테스트로 묶는다.
 */
export const OH_MY_PI_PROVIDERS: readonly OhMyPiProvider[] = [
  {
    id: ANTIGRAVITY_PROVIDER_ID,
    label: "Google Antigravity",
    defaultModel: "gemini-3.7-flash",
    envVars: [],
    authKind: "oauth",
  },
  {
    id: CODEX_PROVIDER_ID,
    label: "OpenAI Codex",
    defaultModel: "gpt-5.6-sol",
    envVars: ["OPENAI_CODEX_OAUTH_TOKEN"],
    authKind: "oauth",
  },
];

/** 공장 기본 제공자. 에디터 툴콜이 Codex 보다 안정적이어서 Antigravity 를 앞에 둔다. */
export const DEFAULT_OH_MY_PI_PROVIDER = ANTIGRAVITY_PROVIDER_ID;

const BY_ID = new Map(OH_MY_PI_PROVIDERS.map((provider) => [provider.id, provider]));

export function getOhMyPiProvider(id: string): OhMyPiProvider | undefined {
  return BY_ID.get(id);
}

export function parseOhMyPiProvider(raw: unknown, fallback = DEFAULT_OH_MY_PI_PROVIDER): string {
  if (typeof raw === "string" && BY_ID.has(raw)) return raw;
  return fallback;
}

export function ohMyPiOAuthProviders(): readonly OhMyPiProvider[] {
  return ohMyPiProvidersByAuthKind("oauth");
}

/**
 * 제공자의 자격 증명 종류. **에디터의 인증 UI 는 이 값 하나로 갈라진다.**
 *
 * 모르는 값·undefined 는 기본 제공자의 종류로 떨어진다 — parseOhMyPiProvider 와 같은 관례라
 * undefined 를 만들지 않는다. 호출부가 옵셔널 체이닝을 잊어 조용히 분기를 놓치는 사고를 막는다
 * (예: `getOhMyPiProvider(id)?.authKind === "oauth"` 는 모르는 id 에서 false 가 되어 OAuth
 * 제공자를 API 키처럼 취급했다).
 */
export function ohMyPiAuthKind(providerId: unknown): OhMyPiAuthKind {
  return BY_ID.get(parseOhMyPiProvider(providerId))?.authKind ?? "oauth";
}

/**
 * 종류별 사용자 표시 이름. 영어 enum(`"oauth"`)을 한국어 UI 로 흘리지 않기 위한 단일 출처다 —
 * 제공자 선택기가 옵션 텍스트에 `authKind` 를 그대로 붙여 `"OpenAI Codex · oauth"` 로 보이던 것을 대체한다.
 */
export const OH_MY_PI_AUTH_KIND_LABEL: Record<OhMyPiAuthKind, string> = {
  oauth: "구독 로그인",
  apiKey: "API 키",
  local: "로컬 서버",
};

/** 종류별 제공자 목록. 순서는 레지스트리 순서(기본 제공자 우선)를 유지한다. */
export function ohMyPiProvidersByAuthKind(kind: OhMyPiAuthKind): readonly OhMyPiProvider[] {
  return OH_MY_PI_PROVIDERS.filter((provider) => provider.authKind === kind);
}
