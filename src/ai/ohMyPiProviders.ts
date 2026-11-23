// 에디터가 고를 수 있는 LLM 제공자 레지스트리.
//
// 2026-11-02: 예전에는 **Antigravity 와 Codex 둘뿐**이었다. 이유는 정당했다 — 그때는 로그인·갱신 코드가
// 그 둘만 손으로 구현돼 있었고, 목록에만 올려 두면 «고르면 바뀐다» 는 거짓 표면이 됐다.
// 이제 상황이 다르다: 사용자가 OMP(pi) 에서 이미 로그인해 둔 자격을 그대로 가져다 쓸 수 있고
// (scripts/lib/omp-auth-probe.mjs), pi 의 카탈로그에 각 제공자의 기본 모델이 있다
// (@oh-my-pi/pi-catalog DEFAULT_MODEL_PER_PROVIDER).
//
// 등록 기준은 **교집합**이다: (pi 에 로그인 정책이 있다) AND (그 제공자의 모델 정책이 있다).
// 모델 정책이 없는 제공자(zai-coding-plan·perplexity·stencil)나, 자격을 네트워크로 받아와야만
// 모델이 생기는 곳(factory-droid)은 올리지 않는다 — 올려도 고르는 순간 실패한다.
//
// 순서는 화면 순서일 뿐이다 — 첫 항목은 권장 제공자(RECOMMENDED_OH_MY_PI_PROVIDER)이고, 옛 저장값을 읽을 때의
// 제공자는 순서가 아니라 DEFAULT_OH_MY_PI_PROVIDER 상수가 정한다. 그래서 순서를 바꿔도 기존 사용자가 다른 제공자로 넘어가지 않는다.
// 2026-11-16(오너 결정): Claude 를 맨 앞으로 올렸다 — 조수 기본이 Claude Opus 5.5 · medium 이었다.
// 2026-11-19(오너 결정): ChatGPT 를 맨 앞으로 올렸다 — 조수 기본이 ChatGPT(Codex 로그인) GPT-6.2 Sol · medium 이다.
// 2026-11-23(오너 결정): Claude 를 다시 맨 앞으로 올렸다 — 조수 기본이 Claude Sonnet 5.5 · high 다(ChatGPT 는 둘째, 그대로 고를 수 있다).
//
// 모든 제공자의 자격은 동반 서비스(~/.oprn/oh-my-pi-auth.json)에만 있고 브라우저로 나가지 않는다.

// id 문자열은 src/ai/oauth/credentials.ts 에서 가져온다 — 전송 계층(packRequestApiKey)과 UI 가
// 같은 상수를 보게 해서 한쪽만 오타/개명되는 사고를 없앤다.

// 상대 경로 + 확장자로 가져온다: 이 모듈은 브라우저 번들뿐 아니라 **순수 Node**(동반 서비스의
// scripts/lib/aiAuthRuntime.ts)에서도 로드된다. Node 는 `@/` 별칭도, 확장자 없는 지정자도 풀지 못한다.
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "./oauth/credentials.ts";
import {
  getKnownOpenAiCompatEndpoint,
  isOpenAiCompatProviderId,
  listKnownOpenAiCompatEndpoints,
  openAiCompatSlug,
} from "./openAiCompat.ts";
import { isLocalCliProviderId, LOCAL_CLI_DEFAULT_MODELS, LOCAL_CLI_LABELS, localCliOfProvider } from "./localCliEngine.ts";
import { ASSISTANT_CLAUDE_EFFORT, ASSISTANT_CLAUDE_MODEL } from "./claudeDefault.ts";
import { ASSISTANT_CHATGPT_EFFORT, ASSISTANT_CHATGPT_MODEL } from "./chatgptDefault.ts";

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

/** Claude 계정(편집기 안 로그인 · ANTHROPIC_API_KEY). id 는 pi 의 제공자 이름이자 저장값이다. */
export const ANTHROPIC_PROVIDER_ID = "anthropic";
/** 조수 공장 기본 모델(오너 결정 2026-11-23): Claude Sonnet 5.5. 새 설정의 모든 역할이 이 한 모델이다. Claude 로 도는 모든 길(구독 CLI · 키 · 편집기 안 계정)의 모든 역할이 이 한 모델이다. */
export const CLAUDE_DEFAULT_MODEL = ASSISTANT_CLAUDE_MODEL;
/** 조수 공장 기본 추론 강도(오너 결정 2026-11-23): high. */
export const CLAUDE_DEFAULT_EFFORT = ASSISTANT_CLAUDE_EFFORT;
/** ChatGPT 길의 기본 모델: GPT-6.2 Sol(src/ai/chatgptDefault.ts). 2026-11-19 부터 2026-11-22 까지는 조수 공장 기본이었고, 지금은 ChatGPT 를 고른 설정·ChatGPT 로그인 첫 실행의 기본이다. */
export const CHATGPT_DEFAULT_MODEL = ASSISTANT_CHATGPT_MODEL;
/** ChatGPT 길의 기본 추론 강도: medium. */
export const CHATGPT_DEFAULT_EFFORT = ASSISTANT_CHATGPT_EFFORT;

/**
 * 제공자 목록. 순서가 곧 UI 순서이고 **첫 항목이 권장값**이다(옛 저장값의 기본 제공자는 DEFAULT_OH_MY_PI_PROVIDER).
 *
 * label 은 **사용자가 보는 유일한 이름**이다 — 제공자 카드·연결 패널·상단 칩(`${label} 연결됨`)이
 * 모두 이 값을 쓴다. 2026-09-23 실측: 카드는 "Google Gemini", 패널은 "Google Antigravity",
 * 사용자는 "agy" 라 불러 한 제공자에 이름이 셋이었다. 로그인하는 **계정**의 이름으로 통일한다
 * (Google / ChatGPT). 제품명(Gemini·Antigravity·Codex)은 카드 보조 줄에만 남긴다.
 * id 는 저장값이라 바꾸지 않는다.
 *
 * defaultModel 은 modelCatalog 의 제공자별 첫 항목과 같아야 한다(계약은
 * test/modelCatalog.test.ts 가 고정한다). 카탈로그를 여기서 import 하지 않는 이유는
 * modelCatalog 가 이 모듈을 import 하기 때문 — 순환을 만들지 않고 테스트로 묶는다.
 */
export const OH_MY_PI_PROVIDERS: readonly OhMyPiProvider[] = [
  // defaultModel 은 조수 기본 모델이다(Claude 는 공장 기본 2026-11-23, ChatGPT·Google 은 @oh-my-pi/pi-catalog DEFAULT_MODEL_PER_PROVIDER 실측값 2026-11-02).
  { id: ANTHROPIC_PROVIDER_ID, label: "Claude", defaultModel: CLAUDE_DEFAULT_MODEL, envVars: ["ANTHROPIC_API_KEY"], authKind: "oauth" },
  {
    id: CODEX_PROVIDER_ID,
    label: "ChatGPT",
    defaultModel: CHATGPT_DEFAULT_MODEL,
    envVars: ["OPENAI_CODEX_OAUTH_TOKEN"],
    authKind: "oauth",
  },
  {
    id: ANTIGRAVITY_PROVIDER_ID,
    label: "Google",
    defaultModel: "gemini-4-argon",
    envVars: [],
    authKind: "oauth",
  },
  // ── 이하 2026-11-02 추가: pi 가 로그인을 구현했고 모델 정책도 있는 제공자 ─────────────
  // defaultModel 은 @oh-my-pi/pi-catalog DEFAULT_MODEL_PER_PROVIDER 실측값이다(2026-11-02).
  // resolveOhMyPiModel 이 이 id/모델 쌍을 카탈로그에서 찾으므로, 값을 바꾸면 실제 호출이 400 이 된다.
  { id: "openrouter", label: "OpenRouter", defaultModel: "openai/gpt-5.5", envVars: ["OPENROUTER_API_KEY"], authKind: "oauth" },
  { id: "google-gemini-cli", label: "Gemini CLI", defaultModel: "gemini-3.1-pro-preview", envVars: [], authKind: "oauth" },
  { id: "github-copilot", label: "GitHub Copilot", defaultModel: "gpt-5.5", envVars: ["GITHUB_TOKEN"], authKind: "oauth" },
  { id: "cursor", label: "Cursor", defaultModel: "claude-opus-5-high", envVars: [], authKind: "oauth" },
  { id: "xai-oauth", label: "xAI Grok", defaultModel: "grok-4.6", envVars: ["XAI_OAUTH_TOKEN"], authKind: "oauth" },
  { id: "kilo", label: "Kilo", defaultModel: "anthropic/claude-opus-5", envVars: [], authKind: "oauth" },
  { id: "kimi-code", label: "Kimi", defaultModel: "kimi-for-coding", envVars: [], authKind: "oauth" },
  { id: "muse-code", label: "Muse", defaultModel: "muse-spark-1.3", envVars: [], authKind: "oauth" },
  { id: "devin", label: "Devin", defaultModel: "swe-1-6", envVars: [], authKind: "oauth" },
  { id: "gitlab-duo", label: "GitLab Duo", defaultModel: "duo-chat-opus-4-6", envVars: ["GITLAB_TOKEN"], authKind: "oauth" },
  { id: "alibaba-coding-plan", label: "Alibaba", defaultModel: "qwen3.7-plus", envVars: [], authKind: "oauth" },
  { id: "cloudflare-ai-gateway", label: "Cloudflare", defaultModel: "anthropic/claude-opus-5", envVars: [], authKind: "oauth" },
  { id: "snowflake", label: "Snowflake", defaultModel: "claude-opus-5-5", envVars: [], authKind: "oauth" },
  { id: "xiaomi", label: "Xiaomi", defaultModel: "mimo-v2.5", envVars: [], authKind: "oauth" },
];

/**
 * 옛 저장값을 읽을 때의 제공자. providerId 가 없는 옛 blob 은 Antigravity 시절에 저장된 것이므로
 * 그대로 Antigravity 로 읽는다 — 이 값을 바꾸면 Google 만 연결한 기존 사용자가 말없이 ChatGPT 로 넘어간다.
 */
export const DEFAULT_OH_MY_PI_PROVIDER = ANTIGRAVITY_PROVIDER_ID;

/**
 * 새로 설정하는 사용자에게 권하는 제공자 = Claude(구독 CLI · 키 · 편집기 안 계정)의 Sonnet 5.5(추론 강도 high).
 * 오너 결정(2026-11-23): 「조수는 sonnet 5.5 high 만 쓰게」.
 * 지난 기본: 2026-10-07 ChatGPT(gpt-6.1-sol) → 2026-10-14 Google(Gemini 4 Argon medium, PR #2535) → 2026-11-16 Claude(Opus 5.5 medium)
 * → 2026-11-19 ChatGPT(GPT-6.2 Sol medium) → 2026-11-23 Claude(Sonnet 5.5 high).
 * 이미 ChatGPT·Google 을 고른 저장값은 그대로 둔다. Claude 를 쓸 수 없는 사용자(ChatGPT 구독만 · Google 로그인만)는
 * 첫 실행 마법사가 그 계정의 지금 기본(GPT-6.2 Sol medium · Argon)으로 맞춘다.
 * 제공자 목록 순서도 이 값을 첫 항목으로 둔다(첫 항목 = 권장값).
 * 제공자 레코드의 defaultModel 과 공장 기본 모델은 모두 CLAUDE_DEFAULT_MODEL 을 쓴다.
 */
export const RECOMMENDED_OH_MY_PI_PROVIDER = ANTHROPIC_PROVIDER_ID;

const BY_ID = new Map(OH_MY_PI_PROVIDERS.map((provider) => [provider.id, provider]));

/**
 * 사용자 지정(OpenAI 호환) 엔드포인트를 레지스트리 행으로 보이게 한 것. 정적 목록(OH_MY_PI_PROVIDERS)에는 넣지 않는다 —
 * 사용자가 만들고 지우는 동적 항목이고, 정적 목록의 불변식(첫 항목 = 권장값, 카탈로그와의 짝)을 건드리지 않기 위해서다.
 * 엔드포인트 목록을 아직 못 받았어도(부팅 직후) id 만으로 행이 만들어져 상태 칩·역할 표가 깨지지 않는다.
 */
function compatProviderRow(id: string): OhMyPiProvider {
  const known = getKnownOpenAiCompatEndpoint(id);
  return {
    id,
    label: known?.name || openAiCompatSlug(id),
    defaultModel: known?.defaultModel || known?.models[0] || "",
    envVars: [],
    authKind: "apiKey",
  };
}

/** 사용자 PC 의 에이전트 CLI(local-cli:claude 등). 자격은 그 CLI 가 갖고 있다 — 우리 쪽엔 아무 비밀도 없다. */
function localCliProviderRow(id: string): OhMyPiProvider | undefined {
  const cli = localCliOfProvider(id);
  return cli ? { id, label: LOCAL_CLI_LABELS[cli], defaultModel: cli === "codex" ? LOCAL_CLI_DEFAULT_MODELS.codex.deep : LOCAL_CLI_DEFAULT_MODELS[cli].routine, envVars: [], authKind: "local" } : undefined;
}

export function getOhMyPiProvider(id: string): OhMyPiProvider | undefined {
  return BY_ID.get(id) ?? (isOpenAiCompatProviderId(id) ? compatProviderRow(id) : localCliProviderRow(id));
}

/**
 * 저장값·HTTP 경계에서 들어온 제공자 id 를 정규화한다. 정적 레지스트리 id 와 사용자 지정 엔드포인트 id
 * (`openai-compat:<slug>`)만 통과하고, 그 밖의 값은 fallback 으로 스냅한다.
 * 엔드포인트가 이미 지워졌어도 id 는 살려 둔다 — 말없이 Google 로 바꿔치지 않고 요청 시점에 「없는 엔드포인트」 오류를 낸다.
 */
export function parseOhMyPiProvider(raw: unknown, fallback = DEFAULT_OH_MY_PI_PROVIDER): string {
  if (typeof raw === "string" && (BY_ID.has(raw) || isOpenAiCompatProviderId(raw) || isLocalCliProviderId(raw))) return raw;
  return fallback;
}

/** 설정 화면의 제공자 선택지 — 정적 제공자 뒤에 사용자 지정 엔드포인트가 이어진다. */
export function selectableOhMyPiProviders(): readonly OhMyPiProvider[] {
  return [...OH_MY_PI_PROVIDERS, ...listKnownOpenAiCompatEndpoints().map((endpoint) => compatProviderRow(endpoint.id))];
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
  const id = parseOhMyPiProvider(providerId);
  return getOhMyPiProvider(id)?.authKind ?? "oauth";
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
