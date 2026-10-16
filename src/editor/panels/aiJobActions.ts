// editor/panels/aiJobActions.ts
// 작업 목록 행·상태 줄 팝오버가 같이 쓰는 「그 자리 버튼」 — 위치로 가기·멈춤·검토 확인.
// 같은 클로저를 부른다(대화 카드·받은함·상태 줄과 두 버튼 한 동작) — 입구마다 동작이 갈라지지 않게 여기 한 곳에 둔다.

import { currentTeamReviewActions } from "@/ai/piAgent/teamActivity";
import { focusEditorRegion } from "@/editor/editorReferenceNavigation";
import { selectEditorMap } from "@/editor/mapSelection";
import { peekStampOrderQueue } from "@/editor/stampOrderQueue";
import { el } from "@/util/dom";
import type { JobRow } from "./aiJobList";
import { stopPresence, type Presence } from "./aiPresence";
import { sideThreads } from "./aiSideThreads";

/** 행이 가리키는 자리로 간다 — 좌표가 있으면 그 영역을 강조하고, 없으면 그 맵만 연다. */
export function locateRow(row: JobRow): void {
  if (!row.mapId) return;
  if (row.where) focusEditorRegion({ mapId: row.mapId, x: row.where.x, y: row.where.y, w: row.where.w, h: row.where.h }, { highlight: true });
  else selectEditorMap(row.mapId, { checkoutForEditing: false });
}

/** 멈출 수 있는 일(도는 일)을 멈춘다. 이벤트 작업은 「보이기만」이라 여기서 멈추지 않는다(작업함 패널에서 취소). */
export function stopRow(row: JobRow): void {
  if (row.source.type === "presence") stopPresence(row.source.presence);
  else if (row.source.type === "stamp") peekStampOrderQueue()?.cancel(row.source.orderId);
}

export function canStopRow(row: JobRow): boolean {
  if (row.source.type === "event") return false;
  return row.state === "working" || row.state === "waiting";
}

/**
 * 검토 대기의 「확인 입구」 — 도크를 접었거나 스튜디오여도 바로 적용·버리기를 한다.
 * 다른 맵에서 돈 실행(background)의 검토는 그 실행 카드가 쥐고 있어 그쪽으로 데려간다.
 */
export function reviewButtons(presence: Presence, onDone: () => void, testidPrefix = "ai-status"): HTMLElement[] {
  if (presence.state !== "review") return [];
  if (presence.source === "background") {
    return [el("button", { class: "ai-status-btn is-primary", text: "검토하기", attrs: { type: "button" }, dataset: { testid: `${testidPrefix}-review-open` }, on: { click: () => {
      onDone();
      window.dispatchEvent(new Event("oprn:ai-open-chat"));
      if (presence.ticketId !== undefined) sideThreads()?.reveal(presence.ticketId);
    } } })];
  }
  const actions = (): ReturnType<typeof currentTeamReviewActions> => currentTeamReviewActions();
  const report = actions()?.openReport;
  return [
    el("button", { class: "ai-status-btn is-primary", text: "적용", attrs: { type: "button" }, dataset: { testid: `${testidPrefix}-apply` }, on: { click: () => { onDone(); actions()?.apply(); } } }),
    ...(report ? [el("button", { class: "ai-status-btn", text: "변경 보기", attrs: { type: "button" }, dataset: { testid: `${testidPrefix}-report` }, on: { click: () => { onDone(); actions()?.openReport?.(); } } })] : []),
    el("button", { class: "ai-status-btn", text: "버리기", attrs: { type: "button" }, dataset: { testid: `${testidPrefix}-discard` }, on: { click: () => { onDone(); actions()?.discard(); } } }),
  ];
}
