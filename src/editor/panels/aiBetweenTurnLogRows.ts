// 조수 대화의 «턴 사이» 기록 — 사람이 조수 UI 에서 누른 것만 남는 프론트 액션 로그
// (`src/ai/uiEventLog.ts`)를 읽는 표면의 순수 부분.
//
// 턴 «안» 구간의 도구·단계 기록은 실행 기록(activityTrace)이 담당한다. uiEventLog 는 2026-08-30
// 부터 모든 프론트 액션을 남기고 있었지만 볼 화면이 없었다 — 턴 행에 실린 사본(turn 안 구간)만
// 보였으므로, 이 모듈은 그 둘 중 «턴 밖» 만 다룬다(2026-10-05 사용자 요청).
//
// 화면(aiBetweenTurnLog.ts)과 분리한 이유: 라벨·필터·내보내기 문장을 DOM 없이 검증해야 하고,
// 나중에 콘솔·하네스가 같은 문장을 쓰더라도 두 벌이 되지 않아야 한다.
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";
import type { AiUiEvent } from "@/ai/uiEventTypes";

export const BETWEEN_TURN_SURFACE_LABELS: Readonly<Record<string, string>> = {
  "history-modal": "대화 기록 창",
  "instructions-modal": "지시문 창",
  "harness-modal": "하네스 창",
  "context-panel": "맥락 패널",
  "command-menu": "명령 메뉴",
  "suggest-popover": "추천 팝오버",
  composer: "입력창",
  panel: "조수 패널",
};

const BETWEEN_TURN_ACTION_LABELS: Readonly<Record<string, string>> = {
  [AI_UI_ACTIONS.contextCompact]: "맥락 압축",
  [AI_UI_ACTIONS.contextCompactUndo]: "압축 되돌리기",
  [AI_UI_ACTIONS.conversationRestore]: "대화 복원",
  [AI_UI_ACTIONS.conversationDelete]: "대화 삭제",
  [AI_UI_ACTIONS.conversationExport]: "대화 내보내기",
  [AI_UI_ACTIONS.instructionsSave]: "지시문 저장",
  [AI_UI_ACTIONS.turnRewind]: "턴 되감기",
  [AI_UI_ACTIONS.panelCollapse]: "패널 접기",
  [AI_UI_ACTIONS.newConversation]: "새 대화",
  [AI_UI_ACTIONS.turnAbort]: "턴 중단",
  [AI_UI_ACTIONS.turnRetry]: "턴 재시도",
};

/** 위임 수집이 남기는 `동작:testid` 의 동작 앞부분. */
const DELEGATED_ACTIONS: Readonly<Record<string, string>> = {
  click: "클릭",
  change: "값 변경",
};

const DETAIL_MAX = 200;
const DEFAULT_LIMIT = 100;

export function betweenTurnSurfaceLabel(surface: string): string {
  return BETWEEN_TURN_SURFACE_LABELS[surface] ?? surface;
}

export function betweenTurnActionLabel(action: string): string {
  const named = BETWEEN_TURN_ACTION_LABELS[action];
  if (named) return named;
  const [kind = ""] = action.split(":");
  return DELEGATED_ACTIONS[kind] ?? action;
}

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** 시각을 못 읽는 값(옛 행)은 원문을 그대로 보여 준다 — 지어내지 않는다. */
export function betweenTurnClock(at: string): string {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return at;
  const date = new Date(time);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function betweenTurnStamp(at: string): string {
  const time = Date.parse(at);
  if (!Number.isFinite(time)) return at;
  const date = new Date(time);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${betweenTurnClock(at)}`;
}

/**
 * `detail`(의미 이벤트가 남긴 결과 수치)을 한 줄로. 값이 크면 자르고 **자른 사실을 적는다** —
 * 조용히 자르면 나중에 「원래 그만큼이었다」 로 읽힌다.
 */
export function betweenTurnDetailText(detail: Record<string, unknown> | undefined): string | undefined {
  if (!detail) return undefined;
  if (!Object.keys(detail).length) return undefined;
  let raw: string;
  try {
    raw = JSON.stringify(detail);
  } catch {
    return "[상세를 읽을 수 없음]";
  }
  if (raw === undefined || raw === "{}") return undefined;
  return raw.length > DETAIL_MAX ? `${raw.slice(0, DETAIL_MAX)}… [${raw.length - DETAIL_MAX}자 생략]` : raw;
}

export interface BetweenTurnRow {
  /** `seq` 기반 — 같은 행이 갱신돼도 목록 키가 흔들리지 않는다. */
  readonly key: string;
  readonly seq: number;
  readonly at: string;
  readonly clock: string;
  readonly surface: string;
  readonly surfaceLabel: string;
  readonly action: string;
  readonly actionLabel: string;
  readonly target: string;
  readonly reason?: string;
  readonly detail?: string;
  readonly disabled: boolean;
}

/** 검색은 사람이 읽는 이름과 원문(영문 testid·표면 id)을 모두 본다. */
function searchText(row: BetweenTurnRow): string {
  return [
    row.surface, row.surfaceLabel, row.action, row.actionLabel,
    row.target, row.reason ?? "", row.detail ?? "",
  ].join("\n").toLowerCase();
}

/**
 * 최신이 앞. `query` 는 이름·원문·이유·상세를 모두 본다. `limit` 은 보여 줄 최대 행 수이고,
 * 더 있으면 호출자가 늘려 다시 부른다 — 자르는 일은 화면이 결정하고 이 함수는 순서만 안다.
 */
export function buildBetweenTurnRows(
  events: readonly AiUiEvent[],
  options: { readonly query?: string; readonly limit?: number; readonly now?: string } = {},
): BetweenTurnRow[] {
  const query = (options.query ?? "").trim().toLowerCase();
  const limit = Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT));
  const rows: BetweenTurnRow[] = [];
  const seen = new Set<number>();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!event || seen.has(event.seq)) continue;
    seen.add(event.seq);
    const reason = event.reason?.trim();
    const detail = betweenTurnDetailText(event.detail);
    const row: BetweenTurnRow = {
      key: String(event.seq),
      seq: event.seq,
      at: event.at,
      clock: betweenTurnClock(event.at),
      surface: event.surface,
      surfaceLabel: betweenTurnSurfaceLabel(event.surface),
      action: event.action,
      actionLabel: betweenTurnActionLabel(event.action),
      target: event.label?.trim() || event.testid || "",
      ...(reason ? { reason } : {}),
      ...(detail ? { detail } : {}),
      disabled: event.disabled === true,
    };
    if (query && !searchText(row).includes(query)) continue;
    rows.push(row);
    if (rows.length >= limit) break;
  }
  return rows;
}

/** 화면 행과 복사 결과가 같은 문장을 쓴다. */
export function betweenTurnRowText(row: BetweenTurnRow): string {
  const parts = [betweenTurnSurfaceLabel(row.surface), row.actionLabel];
  if (row.target) parts.push(row.target);
  return parts.join(" · ");
}

export function betweenTurnLogText(rows: readonly BetweenTurnRow[], at: string = new Date().toISOString()): string {
  const header = `조수 턴 사이 기록 · ${rows.length}건 · ${betweenTurnStamp(at)}`;
  if (!rows.length) return `${header}\n(기록 없음)`;
  const lines = rows.map((row) => {
    const tail = [
      row.reason ? `이유: ${row.reason}` : "",
      row.detail ? `상세: ${row.detail}` : "",
      row.disabled ? "비활성 상태" : "",
    ].filter(Boolean).join(" · ");
    return `${betweenTurnStamp(row.at)} · ${betweenTurnRowText(row)}${tail ? ` — ${tail}` : ""}`;
  });
  return [header, ...lines].join("\n");
}
