// ai/session/assistantText.ts
// 사용자에게 나가는 어시스턴트 텍스트의 위생 처리. 모델이 툴콜 마크업을 본문에 흘렸을 때
// 그 지점에서 자르고, 스트리밍 중에도 같은 판정을 선행 버퍼로 적용한다.

import type { TurnResult } from "./types";

const RAW_TOOL_CALL_OMISSION_NOTICE = "…(형식 오류로 일부 생략)";
const RAW_STREAM_GUARD_CHARS = 64;

export const TOKEN_BUDGET_STATUS_TEXT = "요청이 커서 이번 턴에는 일부만 제안합니다. 이어서 요청해 주세요.";

/**
 * 예산 안내를 낼 종료 사유 — 사용자에게 "이어서 요청해 주세요" 라고 말할 자격이 있는 것만.
 *
 * 이 안내는 **런 경계**(finishRunRecap)에서만 나간다. 한 턴 안의 라운드/토큰 상한은 자율
 * 드라이버가 스스로 다음 턴을 여는 흔한 중간 사건이라, 턴 루프에서 내보내면 자동 계속마다
 * 같은 문장이 채팅에 쌓인다(사용자는 이어서 요청한 적이 없는데 계속 그러라는 말을 듣는다).
 */
export const BUDGET_STOP_REASONS: ReadonlySet<TurnResult["stoppedReason"]> = new Set(["token-budget", "max-tool-calls"]);

// 예산 소진으로 모델의 마무리가 없으면 실제 적용분과 아직 적용 전인 제안을 함께 알린다.
// 마일스톤은 제안 큐를 비우므로 pending=0만으로 "변경 없음"을 판단하면 안 된다.
export function truncatedTurnText(existing: string, proposals: number, budgetLabel: string, appliedCalls = 0): string {
  if (existing.trim().length > 0) return existing;
  const changes = [
    ...(appliedCalls > 0 ? [`변경 ${appliedCalls}건은 이미 프로젝트에 적용했습니다.`] : []),
    ...(proposals > 0 ? [`아직 적용 전인 제안 ${proposals}건이 남아 있습니다.`] : []),
  ];
  const progress = changes.length > 0 ? changes.join(" ") : "적용할 만한 변경은 만들지 못했습니다.";
  return `${budgetLabel}을 다 써서 이번 턴을 여기서 멈췄습니다. ${progress} 이어서 요청해 주세요.`;
}

export function rawToolCallMarkupIndex(text: string): number {
  const lower = text.toLowerCase();
  // 공급자 고유의 센티넬 문자열은 여기서 열거하지 않는다 — 전에는 한 공급자의 raw 툴콜
  // 구분자를 하드코딩했는데, 그 공급자를 쓰지 않게 되면서 죽은 문자열만 남았다.
  // `<tool_call>` 과 `<invoke name=` 는 공급자를 가리지 않는 누출 형태다.
  const indexes = [
    lower.indexOf("<tool_call>"),
  ].filter((index) => index >= 0);
  const invoke = /<invoke\s+name\s*=/iu.exec(text);
  if (invoke?.index !== undefined) indexes.push(invoke.index);
  return indexes.length === 0 ? -1 : Math.min(...indexes);
}

export function hasRawToolCallMarkup(text: string): boolean {
  return rawToolCallMarkupIndex(text) >= 0;
}

export function sanitizeAssistantText(text: string): string {
  const index = rawToolCallMarkupIndex(text);
  if (index < 0) return text;
  const safePrefix = text.slice(0, index).trimEnd();
  return `${safePrefix}${RAW_TOOL_CALL_OMISSION_NOTICE}`;
}

export function assistantTextLooksLikeQuestion(text: string): boolean {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-2);
  return lines.some((line) => (
    /[?？]\s*$/u.test(line) ||
    /(까요|을까요|ㄹ까요|나요|인가요|습니까|하시겠어요|해도 될까요)[.!…\s]*$/u.test(line)
  ));
}

export function createRawMarkupTokenGuard(emit: (delta: string) => void): { feed(delta: string): void; flush(): void } {
  let pending = "";
  let blocked = false;
  const emitSafe = (text: string): void => {
    if (text) emit(text);
  };
  return {
    feed(delta: string): void {
      if (blocked || !delta) return;
      pending += delta;
      const rawIndex = rawToolCallMarkupIndex(pending);
      if (rawIndex >= 0) {
        emitSafe(pending.slice(0, rawIndex));
        pending = "";
        blocked = true;
        return;
      }
      if (pending.length <= RAW_STREAM_GUARD_CHARS) return;
      const emitLength = pending.length - RAW_STREAM_GUARD_CHARS;
      emitSafe(pending.slice(0, emitLength));
      pending = pending.slice(emitLength);
    },
    flush(): void {
      if (blocked) return;
      const rawIndex = rawToolCallMarkupIndex(pending);
      if (rawIndex >= 0) {
        emitSafe(pending.slice(0, rawIndex));
        pending = "";
        blocked = true;
        return;
      }
      emitSafe(pending);
      pending = "";
    },
  };
}
