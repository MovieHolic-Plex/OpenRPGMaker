// qa:game gen 이 사용자 지정(OpenAI 호환) 엔드포인트로 돌게 하는 설정 — 예: CLIProxyAPI(mdc-server:8318)의 Argon.
//
//   export OPRN_LIVE_KEY=$(cat ~/.config/oprn/live-key)       # 키는 환경변수로만 받는다
//   npm run qa:game -- gen --brief … --out … --compat-base http://127.0.0.1:8318/v1 --compat-model gemini-4-argon-high
//
// 키는 이 프로세스 메모리에만 있다: 저장소·~/.oprn/openai-compat-endpoints.json·녹화 파일(request.json·meta.json)에 쓰지 않는다.
// 엔드포인트 허용/차단 패턴은 편집기 설정과 같은 판정(openAiCompatModelVerdict)을 모든 호출 직전에 거친다 —
// 기본 허용 `gemini-4-argon*`, 차단 `claude-*`. 패턴 밖 모델로는 폴백하지 않고 거절한다.

import type { AiConfig } from "../../../src/ai/llmClient.ts";
import type { RoleModel } from "../../../src/ai/modelRoles.ts";
import {
  OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW,
  OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC,
  OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS,
  checkOpenAiCompatBaseUrl,
  openAiCompatModelVerdict,
  parseOpenAiCompatReasoningMode,
  type OpenAiCompatWorkerEndpoint,
} from "../../../src/ai/openAiCompat.ts";

export const QA_COMPAT_PROVIDER_ID = "openai-compat:qa-gen";
export const QA_COMPAT_DEFAULT_ALLOW = ["gemini-4-argon*"] as const;
export const QA_COMPAT_DEFAULT_BLOCK = ["claude-*"] as const;
export const QA_COMPAT_DEFAULT_KEY_ENV = "OPRN_LIVE_KEY";

export interface QaCompatOptions {
  readonly baseUrl: string;
  readonly model: string;
  /** 역할 모델(계획·실행·시각·작문·시공·감독)에 줄 사고 강도. 기본 medium(감독은 high). */
  readonly thinkingLevel?: RoleModel["thinkingLevel"];
  readonly reasoningMode?: string;
  readonly allowModels?: readonly string[];
  readonly blockModels?: readonly string[];
  /** 키를 읽을 환경변수 이름(값이 아니다). */
  readonly keyEnv?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface QaCompatSetup {
  readonly providerId: string;
  readonly endpoint: OpenAiCompatWorkerEndpoint;
  /** 이 제공자에 쓸 키 — 호출자는 이것을 제공자 키 맵에만 넣고 어디에도 쓰지 않는다. */
  readonly apiKey: string;
  /** AiConfig 에 덮을 부분: 모든 역할이 이 엔드포인트의 한 모델로 간다. */
  readonly configPatch: Partial<AiConfig>;
}

/** 입력 검사 + 엔드포인트 정의 생성. 키·주소·모델이 잘못되면 키 값 없이 문장으로 던진다. */
export function buildQaCompatSetup(options: QaCompatOptions): QaCompatSetup {
  const env = options.env ?? process.env;
  const keyEnv = options.keyEnv || QA_COMPAT_DEFAULT_KEY_ENV;
  const apiKey = env[keyEnv]?.trim();
  if (!apiKey) throw new Error(`환경변수 ${keyEnv} 가 비어 있습니다. 키는 환경변수로만 받습니다(파일·인자로 넘기지 않음).`);
  const check = checkOpenAiCompatBaseUrl(options.baseUrl);
  if (!check.ok || !check.url) throw new Error(`--compat-base 가 올바르지 않습니다: ${check.error ?? options.baseUrl}`);
  if (check.insecurePublic) throw new Error("공개 주소에 http 로 연결하지 않습니다. localhost·사설망·Tailscale 이름이나 https 를 쓰세요.");
  const model = options.model.trim();
  if (!model) throw new Error("--compat-model 이 필요합니다(예: gemini-4-argon-high).");
  const endpoint: OpenAiCompatWorkerEndpoint = {
    id: QA_COMPAT_PROVIDER_ID,
    name: "qa-gen 사용자 지정 연결",
    baseUrl: check.url,
    headers: {},
    keyless: false,
    // 강도가 이름에 박힌 CLIProxyAPI 별칭이 기본이다 — 모르는 인자를 400 으로 거절하는 서버가 많아 none.
    reasoningMode: parseOpenAiCompatReasoningMode(options.reasoningMode ?? "none"),
    allowModels: [...(options.allowModels ?? QA_COMPAT_DEFAULT_ALLOW)],
    blockModels: [...(options.blockModels ?? QA_COMPAT_DEFAULT_BLOCK)],
    supportsImages: false,
    maxOutputTokens: OPENAI_COMPAT_DEFAULT_MAX_OUTPUT_TOKENS,
    contextWindow: OPENAI_COMPAT_DEFAULT_CONTEXT_WINDOW,
    firstTokenTimeoutSec: OPENAI_COMPAT_DEFAULT_FIRST_TOKEN_TIMEOUT_SEC,
  };
  const verdict = openAiCompatModelVerdict(endpoint, model);
  if (!verdict.allowed) throw new Error(`모델 「${model}」 은(는) 허용 패턴 밖입니다. ${verdict.reason ?? ""}`);
  const level = options.thinkingLevel ?? "medium";
  const role = (thinkingLevel: RoleModel["thinkingLevel"]): RoleModel => ({ provider: QA_COMPAT_PROVIDER_ID, model, thinkingLevel });
  const configPatch: Partial<AiConfig> = {
    providerId: QA_COMPAT_PROVIDER_ID,
    model,
    liteModel: model,
    reasoningEffort: level,
    ultrabrainProviderId: QA_COMPAT_PROVIDER_ID,
    ultrabrainModel: model,
    ultrabrainReasoningEffort: "high",
    roleModels: { deep: role(level), vision: role(level), writer: role(level), build: role(level) },
    modelSelectionOverrides: { ultrabrain: true, deep: true, vision: true, writer: true, build: true },
  };
  return { providerId: QA_COMPAT_PROVIDER_ID, endpoint, apiKey, configPatch };
}
