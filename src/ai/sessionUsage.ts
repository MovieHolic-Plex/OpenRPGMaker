// ai/sessionUsage.ts
// 세션이 실제로 태운 토큰의 구조화 집계. 순수 함수만 담는다.
//
// 왜 필요한가 (실측): 하네스 모달은 사용량을 **감사 로그 문자열에서 정규식으로 긁어**
// 합산했다 — `/출력 토큰 ~(\d+)/` 로 "턴 종료(final)" 라인을 훑는다(aiHarnessModal.ts).
// 그 값은 (a) 출력 토큰뿐이고, (b) 요약 콜·플래너 콜처럼 턴 종료 라인을 남기지 않는 호출을
// 통째로 빼먹고, (c) 문구를 한 글자 고치면 조용히 0 이 된다. 계량은 로그 파싱이 아니라
// 호출 지점에서 세야 한다.
//
// 비용(USD)은 여기서 계산하지 않는다. 에디터가 실제로 붙는 두 연결(Codex = ChatGPT 구독,
// Antigravity = Google 구독)은 **구독제**라 토큰당 단가가 없다(modelCatalog.ts). 단가표를
// 박아 "$0.42" 를 찍으면 근거 없는 숫자를 감독에게 파는 것이다. 그래서 토큰만 보고한다.

import type { ChatMessage } from "./llmClient";

export interface SessionModelUsage {
  readonly model: string;
  readonly calls: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  /** 공급자가 usage 를 안 준 호출 수(미지원 스트리밍 등) — 합계가 과소집계임을 알리는 근거. */
  readonly callsWithoutUsage: number;
}

export interface SessionUsageTotals {
  readonly calls: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly callsWithoutUsage: number;
  /** 모델별 분해(첫 등장 순서 유지). 감독/실행 모델 이원화의 실제 배분을 본다. */
  readonly byModel: readonly SessionModelUsage[];
}

export const EMPTY_SESSION_USAGE: SessionUsageTotals = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  callsWithoutUsage: 0,
  byModel: [],
};

function positiveInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;
}

// usage가 없는 응답(일부 스트리밍)의 출력 토큰 추정 — 한국어 기준 보수적으로 3자당 1토큰.
// callsWithoutUsage 가 세는 그 호출들의 토큰을 여기서 메꾼다.
export function estimateOutputTokens(message: ChatMessage): number {
  const contentLength = message.content?.length ?? 0;
  const argsLength = (message.tool_calls ?? []).reduce((total, call) => total + call.function.arguments.length + call.function.name.length, 0);
  return Math.ceil((contentLength + argsLength) / 3);
}

/**
 * 호출 1건을 집계에 더한다. usage 가 없어도 호출 수는 센다 — "몇 번 불렀는지" 는 항상 알고,
 * 토큰만 모르는 상태를 callsWithoutUsage 로 드러낸다.
 */
export function addSessionUsage(
  totals: SessionUsageTotals,
  model: string,
  usage: { readonly prompt_tokens?: number; readonly completion_tokens?: number } | undefined,
): SessionUsageTotals {
  const label = model.trim() || "(모델 미지정)";
  const promptTokens = positiveInt(usage?.prompt_tokens);
  const completionTokens = positiveInt(usage?.completion_tokens);
  const missing = promptTokens === 0 && completionTokens === 0 ? 1 : 0;
  const index = totals.byModel.findIndex((entry) => entry.model === label);
  const previous = index >= 0
    ? totals.byModel[index]
    : { model: label, calls: 0, promptTokens: 0, completionTokens: 0, callsWithoutUsage: 0 };
  const merged: SessionModelUsage = {
    model: label,
    calls: previous.calls + 1,
    promptTokens: previous.promptTokens + promptTokens,
    completionTokens: previous.completionTokens + completionTokens,
    callsWithoutUsage: previous.callsWithoutUsage + missing,
  };
  const byModel = index >= 0
    ? totals.byModel.map((entry, at) => (at === index ? merged : entry))
    : [...totals.byModel, merged];
  return {
    calls: totals.calls + 1,
    promptTokens: totals.promptTokens + promptTokens,
    completionTokens: totals.completionTokens + completionTokens,
    callsWithoutUsage: totals.callsWithoutUsage + missing,
    byModel,
  };
}

/** 1,234 형태(로케일 무관 — 테스트가 환경에 안 흔들리게 직접 찍는다). */
export function formatTokenCount(value: number): string {
  const safe = Math.max(0, Math.trunc(value));
  return safe.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

/** 한 줄 요약: "호출 12회 · 입력 84,120 · 출력 6,410". */
export function formatSessionUsage(totals: SessionUsageTotals): string {
  if (totals.calls === 0) return "아직 요청 없음";
  const parts = [
    `호출 ${formatTokenCount(totals.calls)}회`,
    `입력 ${formatTokenCount(totals.promptTokens)}`,
    `출력 ${formatTokenCount(totals.completionTokens)}`,
  ];
  if (totals.callsWithoutUsage > 0) parts.push(`계량 미보고 ${formatTokenCount(totals.callsWithoutUsage)}회`);
  return parts.join(" · ");
}
