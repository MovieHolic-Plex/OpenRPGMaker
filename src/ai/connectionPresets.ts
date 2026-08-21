// ai/connectionPresets.ts
// AI 연결 프리셋(내장 4종 + 사용자 저장)과 가용성 자동 검지. 순수 로직/타입 계층이다.
// UI(src/editor/panels/**)는 다음 단계에서 이 파일의 export 만 보고 붙인다.
//
// 설계 근거(전부 실측):
// - vite.config.ts 는 서버 전용 키(APITOPIA_API_KEY / QWENCLOUD_API_KEY / CPENROUTER_API_KEY)가
//   있을 때만 해당 프록시(/api/ai, /api/qwen, /api/cpen)를 등록한다. 키가 없으면 그 경로는 404 다.
//   → probe 가 404 를 받으면 "프록시 미등록 = .env.local 에 키가 없다"(missing-key) 로 읽는다.
// - ChatGPT OAuth(/auth/status)는 API 키가 아니라 로그인 상태다. HTTP 2xx 여도 본문의
//   connected === true 여야 사용 가능(실측 응답 {"connected":true,"planType":"plus"}).
//
// 보안: 사용자 프리셋에 apiKey 는 절대 저장하지 않는다 — localStorage 에 평문 키가 남기 때문.
// 상대 baseUrl(/api/...) 프록시는 서버가 키를 주입하므로 클라이언트 키 자체가 불필요하고,
// 절대 URL 게이트웨이 키는 기존 oprn:ai-config 의 apiKey 필드가 계속 맡는다(이 파일이 안 건드림).

import type { AiConfig } from "@/ai/llmClient";
import { loadAiConfig, saveAiConfig } from "@/ai/llmClient";
// (A) 도달 불가 / (B) 응답했지만 실패 오류 구분은 chatgptOAuthClient 가 이미 정의했다.
// 같은 개념·같은 클래스를 재사용해 검지 결과를 일관되게 판별한다(중복 구현 금지).
import {
  ChatGptCompanionResponseError,
  ChatGptCompanionUnreachableError,
} from "@/ai/chatgptOAuthClient";

// ─────────────────────────────────────────────────────────────────────────────
// (1) 프리셋 정의
// ─────────────────────────────────────────────────────────────────────────────

/** 프리셋의 인증 방식. AiConfig.authMode 와 동일 집합이다. */
export type PresetAuthMode = AiConfig["authMode"];

/**
 * 내장 연결 프리셋. 전부 데이터(읽기 전용)로 선언된다.
 * - apiKey 프리셋의 baseUrl 은 상대 경로(/api/...) → 동일 오리진 vite 프록시가 Authorization 을 주입.
 * - chatgpt 프리셋의 baseUrl 은 빈 문자열 → llmClient.endpoint() 가 기존 기본 동작(DEFAULT_CHATGPT_BASE_URL)을 쓴다.
 */
export interface ConnectionPreset {
  /** 안정 식별자(화면 표시용 아님). 저장/전환 키로 쓴다. */
  readonly id: string;
  /** 사용자용 한국어 이름. */
  readonly label: string;
  /** 초보자가 읽고 고를 수 있는 한 줄 설명. */
  readonly description: string;
  readonly authMode: PresetAuthMode;
  /** apiKey 프리셋은 상대 경로, chatgpt 프리셋은 빈 문자열(기존 기본 동작). */
  readonly baseUrl: string;
  /** 감독 모델 — 그 공급자에서 실제로 존재하는 ID. */
  readonly model: string;
  /** 실행(라이트) 모델 — 그 공급자에서 실제로 존재하는 ID. */
  readonly liteModel: string;
  /** 가용성 검사에 쓸 상대 경로. apiKey 는 `<baseUrl>/models`, chatgpt 는 `/auth/status`. */
  readonly probe: string;
  /** 사용자 안내용 env 변수 이름(값이 아니라 이름만). 키가 없을 때 .env.local 에 무엇을 넣는지 알려준다.
   *  chatgpt 는 env 키가 아니라 OAuth 로그인이라 빈 문자열. */
  readonly keyEnvName: string;
}

/**
 * 내장 프리셋 4종. model/liteModel 은 src/ai/modelCatalog.ts 와 llmClient.ts 기본값에서
 * 실제 존재가 확인된 ID 만 채웠다(근거는 각 항목 주석). 모르는 값은 지어내지 않았다.
 */
export const BUILTIN_CONNECTION_PRESETS: readonly ConnectionPreset[] = [
  {
    id: "chatgpt",
    label: "ChatGPT 구독 (OAuth)",
    description: "ChatGPT 구독 계정으로 로그인해 사용. API 키 없이 device 로그인만 하면 됩니다.",
    authMode: "chatgpt",
    // 빈 문자열 = 기존 기본 동작. llmClient.endpoint() 가 chatgpt 모드에서 DEFAULT_CHATGPT_BASE_URL 을 쓴다.
    baseUrl: "",
    // 근거: modelCatalog.ts CHATGPT_OAUTH_MODELS 첫 항목.
    model: "gpt-5.6-sol",
    // 근거: 같은 카탈로그의 mini 변종(실행 단계용 경량). llmClient 관례상 liteModel 미설정은 model 을 따르므로
    // 이원화를 원치 않으면 model 과 같게 두면 된다.
    liteModel: "gpt-5.4-mini",
    probe: "/auth/status",
    // OAuth 는 env 키 대상이 아니다(로그인 상태가 곧 자격). 안내용 키 이름 없음.
    keyEnvName: "",
  },
  {
    id: "cpenrouter",
    label: "cpenrouter.space",
    description: "cpenrouter.space OpenAI 호환 게이트웨이. .env.local 에 CPENROUTER_API_KEY 가 필요합니다.",
    authMode: "apiKey",
    baseUrl: "/api/cpen",
    // 근거: llmClient.DEFAULT_MODEL 이자 modelCatalog.ts cpenrouter 그룹 첫 항목(채팅 완성 실측 성공 모델).
    model: "cpen/gemini-3-flash",
    // 근거: modelCatalog.ts cpenrouter 그룹의 lite 변종(이름에 lite 가 들어간 실행용 모델).
    liteModel: "cpen/gemini-3-1-flash-lite",
    probe: "/api/cpen/models",
    keyEnvName: "CPENROUTER_API_KEY",
  },
  {
    id: "qwencloud",
    label: "qwencloud (알리바바 MaaS)",
    description: "알리바바 qwencloud OpenAI 호환 엔드포인트. .env.local 에 QWENCLOUD_API_KEY 가 필요합니다.",
    authMode: "apiKey",
    baseUrl: "/api/qwen",
    // 근거: modelCatalog.ts "Qwen · qwencloud" 그룹의 유일 항목.
    model: "qwen3.8-max-preview",
    // qwencloud 전용 모델은 카탈로그에 1종뿐이라 이원화할 두 번째 ID 를 모른다 → model 과 동일하게 둔다
    // (llmClient 관례: liteModel 미설정/동일 = 이원화 비활성). 지어내지 않는다.
    liteModel: "qwen3.8-max-preview",
    probe: "/api/qwen/models",
    keyEnvName: "QWENCLOUD_API_KEY",
  },
  {
    id: "apitopia",
    label: "apitopia 게이트웨이",
    description: "apitopia 공용 게이트웨이. .env.local 에 APITOPIA_API_KEY 가 필요합니다.",
    authMode: "apiKey",
    baseUrl: "/api/ai",
    // 근거: modelCatalog.ts API_GATEWAY_MODELS 는 CHATGPT_OAUTH_MODELS 를 스프레드로 포함하므로
    // 그 첫 항목(gpt-5.6-sol)이 게이트웨이에서도 유효한 첫 모델. 확실하지 않은 전용 ID 는 지어내지 않는다.
    model: "gpt-5.6-sol",
    // 근거: 동일 카탈로그에 포함된 mini 변종(실행 단계용 경량).
    liteModel: "gpt-5.4-mini",
    probe: "/api/ai/models",
    keyEnvName: "APITOPIA_API_KEY",
  },
];

/** id 로 내장 프리셋 조회. 없으면 undefined. */
export function findBuiltinPreset(id: string): ConnectionPreset | undefined {
  return BUILTIN_CONNECTION_PRESETS.find((preset) => preset.id === id);
}

// ─────────────────────────────────────────────────────────────────────────────
// (2) 가용성 자동 검지
// ─────────────────────────────────────────────────────────────────────────────

/** 검지 결과 상태. 세 상태를 구분한다. */
export type PresetAvailabilityStatus = "ready" | "missing-key" | "error";

/**
 * 한 프리셋의 가용성 검지 결과.
 * - ready: 사용 가능(apiKey 프록시는 HTTP 2xx, chatgpt 는 2xx 이고 본문 connected === true).
 * - missing-key: 프록시가 등록되지 않음(404). .env.local 에 keyEnvName 을 넣어야 한다.
 * - error: 응답했지만 실패, 또는 도달 불가/타임아웃. detail 에 서버가 준 원인(본문 JSON 의 error 필드)
 *   이나 판별 메시지를 담는다.
 */
export interface PresetAvailability {
  readonly presetId: string;
  readonly status: PresetAvailabilityStatus;
  /** error 상태의 원인. 서버 응답이 있으면 본문 JSON 의 `error` 필드, 없으면 판별 메시지. */
  readonly detail?: string;
  /** 응답을 받은 경우의 HTTP 상태 코드(도달 불가/타임아웃에는 없음). */
  readonly httpStatus?: number;
}

/** 검지 기본 타임아웃(ms). 패널을 멈추게 하지 않도록 짧게 잡는다. */
export const PROBE_TIMEOUT_MS = 6000;

/**
 * fetch 를 감싸 "서버에 닿지 못함"(A) 을 ChatGptCompanionUnreachableError 로 변환한다.
 * chatgptOAuthClient.companionFetch 와 동일한 관례다. 우리가 거는 타임아웃 abort 는 도달 불가가
 * 아니므로 별도 오류(AbortError)로 그대로 던져 호출자가 구분하게 한다.
 */
async function probeFetch(url: string, signal: AbortSignal): Promise<Response> {
  try {
    return await fetch(url, { signal });
  } catch (cause) {
    // 우리가 abort 한 타임아웃은 네트워크 단절과 의미가 다르다 — 도달 불가로 둔갑시키지 않는다.
    if (signal.aborted) throw cause;
    throw new ChatGptCompanionUnreachableError(cause);
  }
}

/**
 * 실패 응답 본문의 `error` 필드를 읽는다. chatgptOAuthClient.readErrorBody 와 동일 관례다.
 * 본문이 없거나 JSON 이 아니거나 error 가 문자열이 아니면 undefined — 원인을 못 읽어도 실패는 실패다.
 */
async function readProbeErrorBody(response: Response): Promise<string | undefined> {
  try {
    const payload = (await response.json()) as Record<string, unknown> | null;
    const error = payload && typeof payload === "object" ? payload.error : undefined;
    return typeof error === "string" && error.trim() ? error : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 프리셋 하나의 가용성을 검지한다. 절대 reject 하지 않는다 — 모든 실패는 PresetAvailability 로 변환된다.
 * 타임아웃은 AbortController 로 건다(기본 {@link PROBE_TIMEOUT_MS}).
 *
 * 판별 순서:
 * 1. 타임아웃 → error("검지 시간 초과")
 * 2. 도달 불가(A) → error("연결할 수 없음")
 * 3. 404 → missing-key (프록시 미등록 = .env.local 에 키 없음. 근거: vite.config.ts)
 * 4. 나머지 !ok(B) → error, detail = 서버가 준 본문 error 필드
 * 5. 2xx + chatgpt → 본문 connected === true 면 ready, 아니면 error("로그인되지 않음")
 * 6. 2xx + apiKey → ready
 */
export async function probePresetAvailability(
  preset: ConnectionPreset,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<PresetAvailability> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await probeFetch(preset.probe, controller.signal);
    } catch (cause) {
      if (controller.signal.aborted) {
        return { presetId: preset.id, status: "error", detail: "검지 시간 초과" };
      }
      if (cause instanceof ChatGptCompanionUnreachableError) {
        return { presetId: preset.id, status: "error", detail: "엔드포인트에 연결할 수 없습니다" };
      }
      return { presetId: preset.id, status: "error", detail: cause instanceof Error ? cause.message : "검지 실패" };
    }

    // 404 = 프록시 미등록. vite.config.ts 는 키가 있을 때만 프록시를 등록하므로
    // 이 경로의 404 는 곧 ".env.local 에 keyEnvName 이 없다" 는 신호다.
    if (response.status === 404) {
      return { presetId: preset.id, status: "missing-key", httpStatus: 404 };
    }

    if (!response.ok) {
      // 응답했지만 실패(B) — 서버가 알려준 원인을 버리지 않고 본문 error 를 함께 담는다.
      const serverMessage = await readProbeErrorBody(response);
      const error = new ChatGptCompanionResponseError(response.status, serverMessage);
      return { presetId: preset.id, status: "error", httpStatus: response.status, detail: error.serverMessage ?? error.message };
    }

    // 2xx. chatgpt 는 로그인 상태(connected) 까지 봐야 한다 — 200 이어도 미로그인이면 사용 불가.
    if (preset.authMode === "chatgpt") {
      let connected = false;
      try {
        const payload = (await response.json()) as Record<string, unknown> | null;
        connected = payload?.connected === true;
      } catch {
        // 본문을 못 읽으면 connected false 로 취급 — ready 로 잘못 표시하지 않는다.
      }
      if (!connected) {
        return { presetId: preset.id, status: "error", httpStatus: response.status, detail: "ChatGPT 에 로그인되지 않았습니다" };
      }
    }

    return { presetId: preset.id, status: "ready", httpStatus: response.status };
  } finally {
    clearTimeout(timer);
  }
}

/** 여러 프리셋 검지 결과. 어떤 프리셋의 결과인지 짝지어 돌려준다. */
export interface PresetAvailabilityResult {
  readonly preset: ConnectionPreset;
  readonly availability: PresetAvailability;
}

/**
 * 여러 프리셋을 병렬로 검지한다. Promise.allSettled 기반 — 하나가 실패(이론상 불가, 방어) 해도
 * 나머지 결과는 모두 나온다. 기본 대상은 {@link BUILTIN_CONNECTION_PRESETS} 전체.
 */
export async function probeAllPresets(
  presets: readonly ConnectionPreset[] = BUILTIN_CONNECTION_PRESETS,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<PresetAvailabilityResult[]> {
  const settled = await Promise.allSettled(presets.map((preset) => probePresetAvailability(preset, timeoutMs)));
  return settled.map((result, index) => {
    const preset = presets[index];
    // probePresetAvailability 는 reject 하지 않도록 설계했지만, allSettled 의 rejected 도 방어적으로 처리한다.
    const availability: PresetAvailability =
      result.status === "fulfilled"
        ? result.value
        : { presetId: preset.id, status: "error", detail: result.reason instanceof Error ? result.reason.message : "검지 실패" };
    return { preset, availability };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// (3) 사용자 프리셋(저장/불러오기/삭제)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 사용자 프리셋 저장 키. 기존 설정 저장소(oprn:ai-config) 와 별도다 — 기존 저장 동작을 깨지 않는다.
 */
export const AI_PRESETS_STORAGE_KEY = "oprn:ai-presets";

/**
 * localStorage 에 저장되는 사용자 프리셋 항목. AiConfig 의 사용자 설정 필드 전체 + 이름.
 *
 * **apiKey 는 의도적으로 없다.** 프리셋에 키를 담으면 localStorage 에 평문 키가 남는다.
 * 상대 baseUrl 프록시는 서버가 키를 주입해 클라이언트 키가 필요 없고, 절대 URL 키는 기존
 * oprn:ai-config 가 맡는다. 저장/적용 어느 쪽에서도 이 타입은 키를 운반하지 않는다.
 */
export interface SavedAiPreset {
  /** 사용자 지정 이름. 동일 이름은 덮어쓰기 키로 쓴다. */
  readonly name: string;
  readonly authMode: PresetAuthMode;
  readonly baseUrl: string;
  readonly model: string;
  readonly liteModel?: string;
  readonly maxToolCalls: number;
  readonly maxTokens: number;
  readonly reasoningEffort?: AiConfig["reasoningEffort"];
}

/** 알 수 없는 값을 객체로 좁힌다. chatgptOAuthClient.objectValue 와 동일 관례. */
function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/**
 * 저장 항목 하나를 방어적으로 파싱한다. 손상된 JSON·구버전 형태(필드 누락/타입 불일치)는
 * llmClient.loadAiConfig 와 같은 관례로 필드별 검증해, 유효한 항목만 살린다.
 * apiKey 가 섞여 들어와도 여기서 버린다(평문 키 저장 금지).
 */
function parseSavedPreset(raw: unknown): SavedAiPreset | null {
  const obj = objectValue(raw);
  if (!obj) return null;
  const name = typeof obj.name === "string" ? obj.name.trim() : "";
  if (!name) return null;
  const authMode: PresetAuthMode = obj.authMode === "chatgpt" || obj.authMode === "apiKey" ? obj.authMode : "apiKey";
  const baseUrl = typeof obj.baseUrl === "string" ? obj.baseUrl.trim() : "";
  const model = typeof obj.model === "string" ? obj.model.trim() : "";
  if (!model) return null;
  const liteModel = typeof obj.liteModel === "string" && obj.liteModel.trim() ? obj.liteModel.trim() : undefined;
  const maxToolCalls = Number.isFinite(obj.maxToolCalls) && Number(obj.maxToolCalls) > 0 ? Math.floor(Number(obj.maxToolCalls)) : 200;
  const maxTokens = Number.isFinite(obj.maxTokens) && Number(obj.maxTokens) > 0 ? Math.floor(Number(obj.maxTokens)) : 32768;
  const reasoningEffort: AiConfig["reasoningEffort"] =
    obj.reasoningEffort === "off" || obj.reasoningEffort === "low" || obj.reasoningEffort === "medium" || obj.reasoningEffort === "high"
      ? obj.reasoningEffort
      : undefined;
  return { name, authMode, baseUrl, model, liteModel, maxToolCalls, maxTokens, reasoningEffort };
}

/**
 * 저장된 사용자 프리셋 목록을 읽는다. 저장소가 없거나 JSON 이 깨졌으면 빈 배열(기본값) —
 * llmClient.loadAiConfig 의 try/catch 관례 그대로. 배열이 아니거나 항목이 손상되면 유효한 것만 추린다.
 */
export function loadSavedPresets(): SavedAiPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const presets: SavedAiPreset[] = [];
    for (const item of parsed) {
      const preset = parseSavedPreset(item);
      if (preset) presets.push(preset);
    }
    return presets;
  } catch {
    return [];
  }
}

/** 목록을 localStorage 에 직렬화. 내부 전용 — 쓰기 경로는 saveUserPreset/deleteSavedPreset 으로 통일한다. */
function persistSavedPresets(presets: readonly SavedAiPreset[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

/**
 * 현재 설정을 이름 붙여 저장한다. 같은 이름이면 덮어쓴다.
 * config 에서 사용자 설정 필드만 뽑고 **apiKey 는 제외** 한다(평문 키 저장 금지).
 * 저장 후 최신 목록을 반환한다(UI 가 즉시 갱신할 수 있게).
 */
export function saveUserPreset(name: string, config: AiConfig): SavedAiPreset[] {
  const trimmed = name.trim();
  // apiKey 를 의도적으로 빼고 저장한다 — localStorage 에 평문 키를 남기지 않기 위함.
  const preset: SavedAiPreset = {
    name: trimmed,
    authMode: config.authMode,
    baseUrl: config.baseUrl,
    model: config.model,
    liteModel: config.liteModel,
    maxToolCalls: config.maxToolCalls,
    maxTokens: config.maxTokens,
    reasoningEffort: config.reasoningEffort,
  };
  const existing = loadSavedPresets();
  const next = existing.some((item) => item.name === trimmed)
    ? existing.map((item) => (item.name === trimmed ? preset : item))
    : [...existing, preset];
  persistSavedPresets(next);
  return next;
}

/** 이름으로 사용자 프리셋을 삭제한다. 저장 후 최신 목록을 반환한다. */
export function deleteSavedPreset(name: string): SavedAiPreset[] {
  const trimmed = name.trim();
  const next = loadSavedPresets().filter((item) => item.name !== trimmed);
  persistSavedPresets(next);
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// (4) 프리셋을 AiConfig 로 적용
// ─────────────────────────────────────────────────────────────────────────────
// llmClient 에는 saveAiConfig 만 있고 "프리셋 적용" 전용 경로가 없다. 그래서 이 파일이
// AiConfig 를 조립해 saveAiConfig 로 적용한다. llmClient 의 authMode/baseUrl 해석 로직과
// 기본값 상수는 검증된 상태라 건드리지 않는다. import 는 단방향(connectionPresets → llmClient)이라
// 순환이 생기지 않는다.

/**
 * 내장 프리셋을 AiConfig 로 변환한다. base(기본 loadAiConfig()) 위에 프리셋의
 * authMode/baseUrl/model/liteModel 만 덮는다 — apiKey/maxTokens 등 나머지 사용자 값은 유지한다.
 * 저장하지 않고 객체만 돌려준다(적용은 {@link activateConnectionPreset}).
 */
export function connectionPresetToConfig(preset: ConnectionPreset, base: AiConfig = loadAiConfig()): AiConfig {
  return { ...base, authMode: preset.authMode, baseUrl: preset.baseUrl, model: preset.model, liteModel: preset.liteModel };
}

/**
 * 사용자 프리셋을 AiConfig 로 변환한다. 저장된 사용자 설정 필드 전체를 base 위에 덮는다.
 * apiKey 는 SavedAiPreset 에 없으므로 base 의 기존 키가 그대로 유지된다(평문 키 저장 금지의 귀결).
 */
export function savedPresetToConfig(preset: SavedAiPreset, base: AiConfig = loadAiConfig()): AiConfig {
  return {
    ...base,
    authMode: preset.authMode,
    baseUrl: preset.baseUrl,
    model: preset.model,
    liteModel: preset.liteModel,
    maxToolCalls: preset.maxToolCalls,
    maxTokens: preset.maxTokens,
    reasoningEffort: preset.reasoningEffort,
  };
}

/** 내장 프리셋을 현재 설정에 적용하고 saveAiConfig 로 저장한다. 적용된 AiConfig 를 반환한다. */
export function activateConnectionPreset(preset: ConnectionPreset, base: AiConfig = loadAiConfig()): AiConfig {
  const next = connectionPresetToConfig(preset, base);
  saveAiConfig(next);
  return next;
}

/** 사용자 프리셋을 현재 설정에 적용하고 saveAiConfig 로 저장한다. 적용된 AiConfig 를 반환한다. */
export function activateSavedPreset(preset: SavedAiPreset, base: AiConfig = loadAiConfig()): AiConfig {
  const next = savedPresetToConfig(preset, base);
  saveAiConfig(next);
  return next;
}
