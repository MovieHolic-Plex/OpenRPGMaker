// 관문·비평·화면 검수가 짚은 것을 할 일 항목으로 맞춘다(옛 «한 바퀴 더» 글 대신 — 2026-10-30 omo 고리).
// 같은 문제(열쇠)는 새 항목을 만들지 않고, 닫힌 항목이면 다시 연다(시도 +1). 사라진 문제의 항목은 함수가 닫는다.
import type { V2GateProblem } from "../verbs";
import { TODO_MAX_ATTEMPTS, isOpen, type TodoStore } from "./todoStore";
import type { TodoItem } from "../todo/types";

const keyOf = (store: TodoStore, item: TodoItem): string | undefined => store.meta.get(item.id)?.key;

/** 다시 연 항목이 시도 상한이면 막힘으로 닫는다. */
function capReopened(store: TodoStore, items: readonly TodoItem[], what: string): TodoItem[] {
  const capped: TodoItem[] = [];
  for (const item of items) {
    if (item.attempts >= TODO_MAX_ATTEMPTS && isOpen(item.status)) { store.block(item, `${what}이 ${item.attempts}번 다시 나옴 — 고치지 못함`, "auto"); capped.push(item); }
  }
  return capped;
}

/**
 * 끝맺음 관문 문제(v2GateProblems)를 gate·critic 항목으로. capMapIds = 고치기 상한에 닿은 장소 맵 — 그 맵의 장소 항목이 문제 목록에서 사라져도
 * «고쳐짐»이 아니라 «상한»이다(막힘으로 닫는다).
 */
export function syncGateItems(store: TodoStore, problems: readonly V2GateProblem[], capMapIds: ReadonlySet<string>): { opened: TodoItem[]; closed: TodoItem[]; capped: TodoItem[] } {
  const keys = new Set(problems.map((p) => p.key));
  const closed: TodoItem[] = [];
  for (const item of store.items) {
    if (item.source !== "gate" && item.source !== "critic") continue;
    const key = keyOf(store, item);
    if (!key || (!key.startsWith("game:") && !key.startsWith("place:")) || keys.has(key)) continue;
    if (!isOpen(item.status) && !(item.status === "completed" && store.meta.get(item.id)?.closedBy === "model")) continue;
    const mapId = key.startsWith("place:") ? key.slice(6, key.indexOf(":", 6)) : "";
    if (mapId && capMapIds.has(mapId)) store.block(item, "장소 고치기 상한(1바퀴)에 닿음 — 남은 문제로 보고", "auto");
    else store.done(item, { pass: true, detail: "함수 검사에서 사라짐" }, "auto");
    closed.push(item);
  }
  const opened = [
    ...store.append("함수 검사", problems.filter((p) => p.source === "gate").map((p) => ({ content: p.text, key: p.key })), "gate"),
    ...store.append("비평", problems.filter((p) => p.source === "critic").map((p) => ({ content: p.text, key: p.key })), "critic"),
  ];
  const capped = capReopened(store, opened, "같은 문제");
  return { opened: opened.filter((i) => !capped.includes(i)), closed, capped };
}
