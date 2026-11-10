// 관문·비평·화면 검수가 짚은 것을 할 일 항목으로 맞춘다(옛 «한 바퀴 더» 글 대신 — 2026-10-30 omo 고리).
// 같은 문제(열쇠)는 새 항목을 만들지 않고, 닫힌 항목이면 다시 연다(시도 +1). 사라진 문제의 항목은 함수가 닫는다.
import type { V2GateProblem } from "../judge/finishGate";
import { AUTOPLAY_GATE_PREFIX } from "../playCheck";
import { TODO_MAX_ATTEMPTS, isOpen, type TodoStore } from "./todoStore";
import type { TodoItem } from "../todo/types";
import type { ProjectIndex } from "./refs";

/** 출하 차단 중 «편집기 기본값이 남았다» 계열(shipChecks EDITOR_DEFAULT_INVENTORY 의 그림·오프닝·제목) — 앞 턴 결과라는 이유로 면제하지 않는다. */
const SHIP_DEFAULT_LEAK = /^\[출하 차단 (?:ending-bg|ending-screen|title-image|title-name|bundled-picture|art-generation|opening|opening-music|opening-missing|maps-min|quests-min|act-depth-min)\]/u;

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
function namedTools(text: string): string[] {
  // 스위치·이벤트 id(«sw_kmt0gqg_k39y2je(「숲길 탐색」)»)는 도구 이름이 아니다 — 2026-10-30 omo-unfinished forest: 깃발 항목이 «고치는 도구가 없다»로 막혔다.
  return [...new Set([...text.matchAll(/\b([a-z][a-z0-9]*(?:_[a-z0-9]+)+)\s*[{(]/gu)].map((m) => m[1]!).filter((n) => !/^(?:sw|var|ev|map|item|troop|enemy|actor|skill|state|class|armor|weapon|chest|npc|tex)_/u.test(n)))];
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
  // 게임 검사·관문이 «이 호출이면 풀린다» 를 문구 맨 끝에 적었는데 항목 내용은 220자에서 잘린다(todoStore) —
  // 잘리지 않은 문제 글에서 꺼내 항목의 다음 호출(meta.nextCall)로 둔다. 재주입의 «Next call» 이 이 호출 그대로 나간다.
  // 출하 차단 줄은 «[출하 차단 id] 문구 고치지 못하면 …» 로 꼬리 문장이 붙는다(verbs.ts gameProblemTexts) — 호출은 문구 끝이 아니라 중간에 있으므로 끝 고정 없이 첫 «})» 까지 읽는다(JSON 안에는 «})» 가 없다).
  // 같은 열쇠의 항목이 아직 열려 있으면 append 는 opened 에 넣지 않는다 — 호출이 바뀌었거나 모델이 호출해 meta 가 지워졌어도 다시 채우도록 열린 gate 항목 전부를 돈다.
  for (const item of store.items) {
    if (item.source !== "gate" || !isOpen(item.status)) continue;
    const call = /Next call: (\w+)\((\{[^\n]*?\})\)/u.exec(problems.find((p) => p.key === keyOf(store, item))?.text ?? "");
    if (!call || (available && !available.has(call[1]!))) continue;
    try {
      const args: unknown = JSON.parse(call[2]!);
      if (args && typeof args === "object" && !Array.isArray(args)) store.meta.set(item.id, { ...(store.meta.get(item.id) ?? {}), nextCall: { verb: call[1]!, text: `${call[1]}(${call[2]})` } });
    } catch { /* 뼈대로 */ }
  }
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
 *  - 문제 글이 짚는 이벤트(ev_…)가 모두 시작 저장본에 같은 지문으로 있거나 함수 마감만 건드렸으면(조수가 안 건드린 기존 이벤트) 기존 결함 — 요청 범위 밖
 * 장소 고치기(place:)는 이번 실행이 지은 장소라 늘 이번 턴 결함이다.
 */
export function splitPreexisting(problems: readonly V2GateProblem[], baselineKeys: ReadonlySet<string> | undefined, baseline: ProjectIndex | undefined, now: ProjectIndex | undefined, autoTouched?: ReadonlyMap<string, string>): { current: V2GateProblem[]; preexisting: V2GateProblem[] } {
  const current: V2GateProblem[] = [];
  const preexisting: V2GateProblem[] = [];
  const byId = new Map<string, string[]>();
  for (const key of now?.events.keys() ?? []) { const id = key.slice(key.indexOf(":") + 1); byId.set(id, [...(byId.get(id) ?? []), key]); }
  for (const p of problems) {
    if (!p.key.startsWith("game:")) { current.push(p); continue; }
    // 편집기 기본값이 남은 것(출하 차단 ending-bg·title-image·opening…)은 시작 저장본에 있었어도 이번 턴이 끝낼 일이다 — 이어 하는 턴의 시작 저장본은 앞 턴의 결과라
    // 기본 그림도 «기존 결함»이 되어 완료를 막지 못했다(2026-11-09 assistant-reward village-1: 엔딩 기본 그림이 2턴째에 항목이 안 됐다).
    if (baselineKeys?.has(p.key) && !SHIP_DEFAULT_LEAK.test(p.text)) { preexisting.push(p); continue; }
    if (p.key.startsWith(AUTOPLAY_GATE_PREFIX)) { current.push(p); continue; }
    const ids = [...new Set([...p.text.matchAll(/\bev_[A-Za-z0-9_\-]+/gu)].map((m) => m[0]))];
    const keys = ids.flatMap((id) => byId.get(id) ?? []);
    // 함수 마감(출구 길 잇기·출구 넓히기)만 건드린 기존 이벤트도 «조수가 안 건드림»으로 본다 — 2026-10-30 boss-room: 마감이 버들마을 출구를 옮기자
    // 원래 그림 없던 출구가 이번 턴 변경으로 잡혀 세 판 모두 할 일이 됐다.
    const untouched = !!baseline && !!now && ids.length > 0 && keys.length > 0
      && keys.every((k) => baseline.events.get(k) === now.events.get(k) || (autoTouched?.has(k) && autoTouched.get(k) === now.events.get(k)));
    (untouched ? preexisting : current).push(p);
  }
  return { current, preexisting };
}
