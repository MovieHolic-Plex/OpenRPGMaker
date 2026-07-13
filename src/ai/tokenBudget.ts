// ai/tokenBudget.ts
// 토큰 예산 보정 — contextBuilder의 "문자 수 근사" 예산을 LLM 실측 usage로 보정한다.
// 한국어는 문자↔토큰 비율(chars/token)이 영어(≈4)보다 낮아(≈1.5~2.5) 문자 예산이
// 실제 토큰 예산을 크게 초과 주입할 수 있다. 매 턴 응답의 usage.prompt_tokens와
// 그 턴에 보낸 프롬프트 총 문자 수를 짝지어 관측하고, 최근 관측의 중앙값으로
// 문자 예산을 재척도한다(중앙값 — EMA보다 아웃라이어에 강함).
//
// 구성:
// - 순수 계산: charsPerTokenEstimate / calibratedBudgetChars / estimatePromptChars.
// - localStorage 게이트: load/save/recordTokenObservations —
//   브라우저 비의존. localStorage가 없으면(Node/테스트) 로드는 빈 목록, 저장은 조용히 no-op.
//
// 보수적 기본값: 관측이 없으면 DEFAULT_CHARS_PER_TOKEN(=4, contextBuilder의 length/4
// 근사와 동일)이 그대로 쓰여 현행 예산(12000자)을 정확히 재현한다. 보정 계수는
// 기본값의 0.5×~1.5×로 클램프되어 잘못된 관측이 예산을 폭주시키지 못한다.

export interface TokenObservation {
  /** 그 턴에 모델로 보낸 프롬프트(시스템+히스토리+툴 스키마) 총 문자 수. */
  promptChars: number;
  /** 응답 usage.prompt_tokens 실측값. */
  promptTokens: number;
  /** ISO 타임스탬프(선택 — 디버깅용). */
  at?: string;
}

// contextBuilder.estimateTokens(length/4)와 같은 근사. 관측이 없으면 이 계수 → 현행 동작 보존.
export const DEFAULT_CHARS_PER_TOKEN = 4;
// 보정 계수 안전 클램프: 기본값의 0.5×~1.5× (기본 예산 12000자 기준 6000~18000자).
export const CALIBRATION_CLAMP_MIN_RATIO = 0.5;
export const CALIBRATION_CLAMP_MAX_RATIO = 1.5;
// 최근 N개 관측 윈도우(중앙값 계산·저장 상한).
export const CALIBRATION_WINDOW = 12;

export const TOKEN_CALIBRATION_STORAGE_KEY = "rpg-zzu:ai-token-calibration";

export function isValidTokenObservation(value: unknown): value is TokenObservation {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.promptChars === "number" && Number.isFinite(rec.promptChars) && rec.promptChars > 0
    && typeof rec.promptTokens === "number" && Number.isFinite(rec.promptTokens) && rec.promptTokens > 0
    && (rec.at === undefined || typeof rec.at === "string")
  );
}

/**
 * 관측된 문자/토큰 계수(chars per token). 유효한 최근 CALIBRATION_WINDOW개의
 * 중앙값을 쓰고, 기본값의 0.5×~1.5×로 클램프한다. 관측이 없으면 기본값.
 */
export function charsPerTokenEstimate(
  observations: readonly TokenObservation[],
  defaultRatio: number = DEFAULT_CHARS_PER_TOKEN,
): number {
  const ratios = observations
    .filter(isValidTokenObservation)
    .slice(-CALIBRATION_WINDOW)
    .map((obs) => obs.promptChars / obs.promptTokens)
    .filter((ratio) => Number.isFinite(ratio) && ratio > 0);
  if (ratios.length === 0) return defaultRatio;
  return clamp(
    medianOf(ratios),
    defaultRatio * CALIBRATION_CLAMP_MIN_RATIO,
    defaultRatio * CALIBRATION_CLAMP_MAX_RATIO,
  );
}

/**
 * 보정된 문자 예산. base 예산이 함의하는 토큰 목표(base/defaultRatio)를 유지한 채
 * 문자 예산만 관측 계수로 재척도한다: base × (관측 계수 / 기본 계수).
 * 관측이 없으면 base를 그대로 돌려준다(현행 동작).
 */
export function calibratedBudgetChars(
  baseBudgetChars: number,
  observations: readonly TokenObservation[],
  defaultRatio: number = DEFAULT_CHARS_PER_TOKEN,
): number {
  if (!Number.isFinite(baseBudgetChars) || baseBudgetChars <= 0) return baseBudgetChars;
  const ratio = charsPerTokenEstimate(observations, defaultRatio);
  return Math.round(baseBudgetChars * (ratio / defaultRatio));
}

// ── 프롬프트 문자 수 추정(관측의 분자) ────────────────────────────
// llmClient.ChatMessage와 구조 호환되는 최소 형태만 요구한다(순수 모듈 — llmClient 비의존).

interface CountableContentPart {
  readonly type: string;
  readonly text?: unknown;
}

export interface CountablePromptMessage {
  readonly content: string | readonly CountableContentPart[] | null;
  readonly tool_calls?: readonly { readonly function: { readonly name: string; readonly arguments: string } }[];
}

export interface PromptCharsEstimate {
  /** 텍스트 문자 수 합(문자열 content + text 파트 + tool_calls 이름/인자 + extraChars). */
  chars: number;
  /** 이미지 파트 포함 여부 — 이미지 토큰은 문자 수와 비례하지 않으므로 관측에서 제외해야 한다. */
  hasImages: boolean;
}

export function estimatePromptChars(
  messages: readonly CountablePromptMessage[],
  extraChars = 0,
): PromptCharsEstimate {
  let chars = Number.isFinite(extraChars) && extraChars > 0 ? extraChars : 0;
  let hasImages = false;
  for (const message of messages) {
    if (typeof message.content === "string") {
      chars += message.content.length;
    } else if (message.content) {
      for (const part of message.content) {
        if (part.type === "image_url") {
          hasImages = true;
          continue;
        }
        if (typeof part.text === "string") chars += part.text.length;
      }
    }
    for (const call of message.tool_calls ?? []) {
      chars += call.function.name.length + call.function.arguments.length;
    }
  }
  return { chars, hasImages };
}

// ── localStorage 게이트 ───────────────────────────────────────────

/** 저장된 관측 로드. localStorage가 없거나 값이 깨졌으면 빈 목록(조용한 폴백). */
export function loadTokenObservations(): TokenObservation[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOKEN_CALIBRATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).observations)
        ? ((parsed as Record<string, unknown>).observations as unknown[])
        : [];
    return list.filter(isValidTokenObservation).slice(-CALIBRATION_WINDOW);
  } catch {
    return [];
  }
}

/** 관측 저장(최근 CALIBRATION_WINDOW개만). localStorage가 없으면 조용히 no-op. */
export function saveTokenObservations(observations: readonly TokenObservation[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    const kept = observations.filter(isValidTokenObservation).slice(-CALIBRATION_WINDOW);
    localStorage.setItem(TOKEN_CALIBRATION_STORAGE_KEY, JSON.stringify({ observations: kept }));
  } catch {
    /* 쿼터 초과 등 저장 실패는 치명적이지 않다 — 보정만 늦어진다. */
  }
}

/**
 * 관측 1건 기록(로드→추가→트림→저장) 후 최신 목록 반환.
 * 무효 관측은 조용히 무시된다. localStorage가 없으면 저장 없이 목록만 돌려준다.
 */
export function recordTokenObservation(observation: TokenObservation): TokenObservation[] {
  if (!isValidTokenObservation(observation)) return loadTokenObservations();
  const next = [...loadTokenObservations(), observation].slice(-CALIBRATION_WINDOW);
  saveTokenObservations(next);
  return next;
}

function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
