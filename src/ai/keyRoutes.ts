// API 키 경로표 — 「이미 가진 API 키」를 사용자 지정(OpenAI 호환) 엔드포인트로 입양할 때 쓰는 고정 주소·모델 ID.
//
// 순수 모듈 — 브라우저와 Node(동반 서비스)가 같이 읽는다. 상대 경로 import 만 쓴다(ohMyPiProviders.ts 머리말).
// 주소는 클라이언트가 보내지 않는다: 동반 서비스가 이 표의 baseUrl 로만 키를 보낸다(scripts/lib/detectedKeys.ts).
//
// 출처(2026-11-04 확인, 모두 제공자 공식 문서):
//  - Claude: https://platform.claude.com/docs/en/api/openai-sdk — base_url https://api.anthropic.com/v1/, tools·tool_calls
//    「Fully supported」, reasoning_effort 「Ignored」(그래서 none). 모델 ID·컨텍스트 1M·최대 출력 128K:
//    https://platform.claude.com/docs/en/models/overview
//  - OpenAI: https://developers.openai.com/api/docs/models/compare.md (컨텍스트 1,050,000·최대 출력 128,000),
//    모델 ID 는 각 모델 페이지(gpt-6-astra·gpt-6.1-sol·gpt-6.1-terra·gpt-6-luna)에 있다. 그러나
//    https://developers.openai.com/api/docs/guides/latest-model 이 「GPT-6 Astra, GPT-6.1 Sol, GPT-6.1 Terra support Chat
//    Completions, but tool calling requires Responses. … GPT-6 Luna support function calling in Chat Completions only with
//    reasoning_effort: "none"」 라고 적는다. 이 경로의 전송은 Chat Completions(pi-ai openai-completions)이고 reasoning_effort 를
//    "none" 으로 보내지 않으므로, 도구를 쓰는 조수에게 쓸 수 있는 OpenAI 모델이 이 경로에는 없다 → models 를 비워 둔다.
//  - Gemini: https://ai.google.dev/gemini-api/docs/openai — base_url …/v1beta/openai/, function calling 지원,
//    reasoning_effort → thinking_level 대응. 모델·한도: https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
//    (gemini-4-argon, 1,048,576 통합 창, 출력 65,536), …/models/gemini-3.8-flash (gemini-3.8-flash, 입력 1,048,576, 출력 65,536).
//  - DeepSeek: https://api-docs.deepseek.com/ · https://api-docs.deepseek.com/quick_start/pricing — base_url https://api.deepseek.com,
//    모델 이름 deepseek-flash(현재 DeepSeek-V4.1-Flash-1017 이 응답), 컨텍스트 1M, 최대 출력 384K, Tool Calls 지원.
//    「1017」 은 모델 버전 표기일 뿐 호출 ID 가 아니다 — 스냅숏 ID 는 넣지 않는다.

import type { OpenAiCompatReasoningMode } from "./openAiCompat.ts";
import {
  chooseTeam,
  FAMILY_MODEL_KEYS,
  UNRATED_DEFAULT_WORKER,
  type ModelFamily,
  type TeamModelKey,
} from "./teamScoreboard.ts";

export interface KeyRoute {
  /** 엔드포인트 이름 앞부분(예: 「DeepSeek (DEEPSEEK_API_KEY)」). */
  readonly label: string;
  /** 정규화된 기본 주소(끝 슬래시 없음 — checkOpenAiCompatBaseUrl 결과와 같은 모양). */
  readonly baseUrl: string;
  /** 이 제공자의 키가 들어 있는 환경 변수. */
  readonly envNames: readonly string[];
  readonly reasoningMode: OpenAiCompatReasoningMode;
  readonly contextWindow: number;
  readonly maxOutputTokens?: number;
  /** 팀 모델 키 → 이 제공자 API 가 받는 모델 ID. 이 경로(Chat Completions + 도구)로 쓸 수 있다고 문서로 확인한 것만 있다. */
  readonly models: Partial<Record<TeamModelKey, string>>;
  /** models 가 비어 있을 때 그 이유(사용자에게 보여 준다). */
  readonly unsupportedReason?: string;
}

export const KEY_ROUTES: Readonly<Record<ModelFamily, KeyRoute>> = {
  claude: {
    label: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    // ANTHROPIC_AUTH_TOKEN 은 넣지 않는다 — 프록시(ANTHROPIC_BASE_URL)용 토큰이라 api.anthropic.com 키가 아니다.
    envNames: ["ANTHROPIC_API_KEY"],
    reasoningMode: "none",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    models: { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", haiku: "claude-haiku-5-5" },
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    envNames: ["OPENAI_API_KEY"],
    reasoningMode: "field",
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    // API ID 는 gpt-6-astra·gpt-6.1-sol·gpt-6.1-terra·gpt-6-luna 로 확인했지만, 이 경로로는 도구 호출이 되지 않는다(머리말).
    models: {},
    unsupportedReason: "OpenAI 의 GPT-6 모델은 이 연결 방식(Chat Completions)으로 도구를 호출하지 못해요. 조수는 도구로 맵을 고치므로 ChatGPT 로그인이나 다른 키를 써 주세요.",
  },
  google: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envNames: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
    reasoningMode: "field",
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    models: { argon: "gemini-4-argon", flash: "gemini-3.8-flash" },
  },
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    envNames: ["DEEPSEEK_API_KEY"],
    reasoningMode: "field",
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    models: { deepseek: "deepseek-flash" },
  },
};

/**
 * 키를 입양할 때 시험·기본값으로 쓸 워커 모델. 그 제공자 모델만으로 점수표가 고르는 팀의 워커,
 * 점수표에 행이 없으면 제품 기본값(UNRATED_DEFAULT_WORKER). 이 경로에 쓸 모델이 없으면 undefined.
 */
export function keyRouteAdoptModel(family: ModelFamily): TeamModelKey | undefined {
  const route = KEY_ROUTES[family];
  const keys = FAMILY_MODEL_KEYS[family].filter((key) => route.models[key] !== undefined);
  if (!keys.length) return undefined;
  const worker = chooseTeam(new Set(keys))?.worker ?? UNRATED_DEFAULT_WORKER[family];
  return worker && keys.includes(worker) ? worker : keys[0];
}

/** 브라우저가 보는 키 출처. **값이 없다** — 어디서 찾았는지(label)만 있다. */
export interface KeySourcePublic {
  readonly id: string;
  readonly family: ModelFamily;
  /** 출처를 밝히는 한국어 이름(예: 「DEEPSEEK_API_KEY (환경 변수)」). 키 값은 들어가지 않는다. */
  readonly label: string;
  /** 이 경로로 입양할 수 있는가(KEY_ROUTES[family].models 가 비어 있지 않다). */
  readonly adoptable: boolean;
  /** 입양하면 쓸 모델(팀 모델 키). adoptable 일 때만 있다. */
  readonly model?: TeamModelKey;
  /** adoptable 이 아닐 때 그 이유. */
  readonly note?: string;
}
