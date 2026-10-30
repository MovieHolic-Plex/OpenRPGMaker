// 관문·비평·화면 검수가 짚은 것을 할 일 항목으로 맞춘다(옛 «한 바퀴 더» 글 대신 — 2026-10-30 omo 고리).
// 같은 문제(열쇠)는 새 항목을 만들지 않고, 닫힌 항목이면 다시 연다(시도 +1). 사라진 문제의 항목은 함수가 닫는다.
import type { V2GateProblem } from "../verbs";
import { TODO_MAX_ATTEMPTS, isOpen, type TodoStore } from "./todoStore";
import type { TodoItem } from "../todo/types";
import type { ProjectIndex } from "./refs";

const keyOf = (store: TodoStore, item: TodoItem): string | undefined => store.meta.get(item.id)?.key;

/** 다시 연 항목이 시도 상한이면 막힘으로 닫는다. */
function capReopened(store: TodoStore, items: readonly TodoItem[], what: string): TodoItem[] {
  const capped: TodoItem[] = [];
  for (const item of items) {
    if (item.attempts >= TODO_MAX_ATTEMPTS && isOpen(item.status)) { store.block(item, `${what} — ${item.attempts}번 다시 나옴, 고치지 못함`, "auto"); capped.push(item); }
  }
  return capped;
}

/**
 * 끝맺음 관문 문제(v2GateProblems)를 gate·critic 항목으로. capMapIds = 고치기 상한에 닿은 장소 맵 — 그 맵의 장소 항목이 문제 목록에서 사라져도
 * «고쳐짐»이 아니라 «상한»이다(막힘으로 닫는다).
 */
/** 문제 글이 고치는 법으로 이르는 도구 이름들(`configure_field_menu{…}`·`upsert_actor(…)` 모양). */
export function namedTools(text: string): string[] {
  return [...new Set([...text.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\s*[{(]/gu)].map((m) => m[1]!))];
}

export function syncGateItems(store: TodoStore, problems: readonly V2GateProblem[], capMapIds: ReadonlySet<string>, available?: ReadonlySet<string>): { opened: TodoItem[]; closed: TodoItem[]; capped: TodoItem[] } {
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
  // 고치는 법으로 이른 도구가 이 실행에 하나도 없으면 조수가 할 수 없다 — 돌리지 않고 막힘으로 닫는다(남은 문제로 보고된다).
  // 2026-10-30 omo-loop-1030 ending: «configure_field_menu 로 ESC 메뉴를 기본으로» 항목을 도구 없이 세 번 돌았다.
  if (available) for (const item of opened) {
    if (!isOpen(item.status)) continue;
    const full = problems.find((p) => p.key === keyOf(store, item))?.text ?? item.content;
    const tools = namedTools(full);
    if (tools.length && !tools.some((t) => available.has(t))) { store.block(item, `고치는 도구(${tools.join(", ")})가 이 실행의 도구 목록에 없다 — 남은 문제`, "auto"); capped.push(item); }
  }
  return { opened: opened.filter((i) => !capped.includes(i)), closed, capped };
}

/**
 * 시작 저장본에 이미 있던 결함을 가른다(2026-10-30 감독: 이번 턴에 생긴 결함만 완료를 막는다).
 *  - 게임 검사 문제의 열쇠가 시작 저장본 검사(v2BaselineGameKeys)에도 있으면 기존 결함
 *  - 문제 글이 짚는 이벤트(ev_…)가 모두 시작 저장본에 같은 지문으로 있으면(이번 턴에 안 건드린 이벤트) 기존 결함 — 요청 범위 밖
 * 장소 고치기(place:)는 이번 실행이 지은 장소라 늘 이번 턴 결함이다.
 */
export function splitPreexisting(problems: readonly V2GateProblem[], baselineKeys: ReadonlySet<string> | undefined, baseline: ProjectIndex | undefined, now: ProjectIndex | undefined): { current: V2GateProblem[]; preexisting: V2GateProblem[] } {
  const current: V2GateProblem[] = [];
  const preexisting: V2GateProblem[] = [];
  const byId = new Map<string, string[]>();
  for (const key of now?.events.keys() ?? []) { const id = key.slice(key.indexOf(":") + 1); byId.set(id, [...(byId.get(id) ?? []), key]); }
  for (const p of problems) {
    if (!p.key.startsWith("game:")) { current.push(p); continue; }
    if (baselineKeys?.has(p.key)) { preexisting.push(p); continue; }
    const ids = [...new Set([...p.text.matchAll(/\bev_[A-Za-z0-9_\-]+/gu)].map((m) => m[0]))];
    const keys = ids.flatMap((id) => byId.get(id) ?? []);
    const untouched = !!baseline && !!now && ids.length > 0 && keys.length > 0 && keys.every((k) => baseline.events.get(k) === now.events.get(k));
    (untouched ? preexisting : current).push(p);
  }
  return { current, preexisting };
}
