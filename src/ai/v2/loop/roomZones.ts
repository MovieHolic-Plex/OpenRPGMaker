// 이번 턴에 지은 손 도트 설계 실내 맵마다 room_zones·room_graph 할 일 항목을 맞춘다(2026-10-30 — 옛 「설계 되돌려 보내기」 대신 할 일 고리로).
// 조수가 이미 그 맵에 같은 종류 항목을 달았으면(refs 의 맵 또는 이름이 같음) 덧붙이지 않는다. 덧붙인 항목은 바로 기계 확인을 돌려 ✓ 면 함수가 닫는다.
//  - room_graph: 모델이 방 그래프(zones 의 x·y + connections)를 선언한 맵 — 선언대로 지어졌나(방 수·연결·도달·계단·랜드마크).
//  - room_zones: 방 그래프가 아닌 설계 방 — 구역(design.areas) 수·초점·갈 이유·반복. 방 그래프 맵은 방 하나가 구역 하나라 room_graph 로 충분하다.
// 검사 자체는 todo/checks.ts — 맵 데이터만 읽는다. 함수는 가구를 고르거나 놓지 않는다. 모델이 보는 글(항목 내용·판정)은 영어.
import type { GameMap, Project } from "@/project/types";
import type { TodoChanged, TodoItem } from "../todo/types";
import { runTodoItemCheck } from "../todo/checks";
import { normName } from "../todo/names";
import { isOpen, type TodoStore } from "./todoStore";

const ROOM_TAG = "hand-layout-room";
const GRAPH_TAG = "room-graph";
const mapLabel = (m: GameMap) => String((m as unknown as { displayName?: string }).displayName ?? "").trim() || String(m.name ?? m.id);

/** 요청이 정말 작은 방인가(한 구역을 허락) — designAreas.wantsSmallRoom 과 같은 낱말. */
export const SMALL_ROOM_WORDS = /작은\s*방|좁은|조그만|자그마한|단칸|한\s*칸|골방|cramped|tiny|small room/iu;
const UPPER = /2층|3층|위층|다락|upper|floor\s*[2-9]|_f[2-9]\b/iu;

const designedMap = (m: GameMap) => (m.locations ?? []).some((l) => (l.tags ?? []).includes(ROOM_TAG) && (l.tags ?? []).includes("model-designed"));
const layoutMap = (m: GameMap) => (m.locations ?? []).some((l) => (l.tags ?? []).includes("interior-layout") && (l.tags ?? []).includes("decl"));
const graphMap = (m: GameMap) => (m.locations ?? []).some((l) => (l.tags ?? []).includes(GRAPH_TAG) && (l.tags ?? []).includes("decl"));

/** 이번 턴에 새로 짓거나 바꾼 맵 가운데 모델 설계로 지은 손 도트 실내. */
export function designedInteriorsChanged(project: Project, changed: TodoChanged | undefined): GameMap[] {
  if (!changed) return [];
  return [...changed.mapIds].map((id) => project.maps[id]).filter((m): m is GameMap => !!m && designedMap(m));
}

/** 이 맵을 가리키는 그 종류 항목이 이미 있나. */
function covered(store: TodoStore, m: GameMap, kind: "room_zones" | "room_graph" | "layout_built"): boolean {
  const label = normName(mapLabel(m), true);
  const key = `${kind === "room_graph" ? "graph" : kind === "layout_built" ? "layout" : "zones"}:${m.id}`;
  return store.items.some((i) => i.check?.kind === kind && (i.refs?.mapIds?.includes(m.id) || normName(i.check.map, true) === label || store.meta.get(i.id)?.key === key));
}

const minZones = (m: GameMap, task: string) => (SMALL_ROOM_WORDS.test(task) || UPPER.test(`${m.name ?? ""} ${m.id}`) ? 1 : 2);

/**
 * 빠진 맵마다 항목을 덧붙이고 바로 확인한다. 돌려주는 값: 열린 채 남은(✗) 새 항목.
 * room_zones 의 min: 요청이 정말 작은 방이거나 위층 맵이면 1, 아니면 2.
 */
export function syncRoomZoneItems(store: TodoStore, project: Project, changed: TodoChanged | undefined, task: string): TodoItem[] {
  const opened: TodoItem[] = [];
  for (const m of designedInteriorsChanged(project, changed)) {
    const name = mapLabel(m);
    // 칸 배치로 지은 맵(spec.layout): 배치대로 섰나(layout_built) + 방 그래프(room_graph) 두 항목.
    if (layoutMap(m) && !covered(store, m, "layout_built")) {
      const [item] = store.append("interior layout", [{ content: `"${name}": laid as the layout you wrote — every region and piece on the map, landmark reachable`, check: { kind: "layout_built", map: name, fresh: false }, key: `layout:${m.id}` }], "gate");
      if (item) {
        item.refs = { ...(item.refs ?? {}), mapIds: [m.id] };
        const r = runTodoItemCheck(project, item);
        if (!store.done(item, r, "auto") && isOpen(item.status)) opened.push(item);
      }
    }
    const graph = graphMap(m);
    const kind = graph ? "room_graph" as const : "room_zones" as const;
    if (covered(store, m, kind)) continue;
    const min = minZones(m, task);
    const [item] = graph
      ? store.append("interior rooms", [{ content: `"${name}": built as the declared room graph — every room reachable, connections open, stairs and landmarks placed and reachable`, check: { kind: "room_graph", map: name, fresh: false }, key: `graph:${m.id}` }], "gate")
      : store.append("interior zones", [{ content: `"${name}": at least ${min} distinct zones — a focal part and a reason to go in each`, check: { kind: "room_zones", map: name, ...(min !== 2 ? { min } : {}), fresh: false }, key: `zones:${m.id}` }], "gate");
    if (!item) continue;
    item.refs = { ...(item.refs ?? {}), mapIds: [m.id] };
    const r = runTodoItemCheck(project, item);
    // ✗ 면 store.done 은 끝내지 않고 확인 결과만 남긴다 — 재주입 글이 그 detail(방·구역 상자·걸린 것)을 싣는다.
    if (!store.done(item, r, "auto") && isOpen(item.status)) opened.push(item);
  }
  return opened;
}

/**
 * 짓기·사람·사건 동사 결과에 싣는 구역·방 그래프 확인 줄(설계 실내 맵만) — 할 일 항목과 같은 판정을 미리 보인다(영어, 모델이 받는다).
 */
export function zoneStatusLines(project: Project, mapIds: readonly string[], task = ""): string[] {
  const out: string[] = [];
  for (const id of [...new Set(mapIds)]) {
    const m = project.maps[id];
    if (!m || !designedMap(m)) continue;
    if (layoutMap(m)) {
      const r0 = runTodoItemCheck(project, { check: { kind: "layout_built", map: mapLabel(m) }, refs: { mapIds: [m.id] } });
      out.push(`layout_built ${r0.pass ? "✓" : "✗"} ${r0.en ?? r0.detail}`.slice(0, 900));
    }
    const check = graphMap(m) ? { kind: "room_graph" as const, map: mapLabel(m) } : { kind: "room_zones" as const, map: mapLabel(m), ...(minZones(m, task) !== 2 ? { min: minZones(m, task) } : {}) };
    const r = runTodoItemCheck(project, { check, refs: { mapIds: [m.id] } });
    out.push(`${check.kind} ${r.pass ? "✓" : "✗"} ${r.en ?? r.detail}`.slice(0, 900));
  }
  return out;
}
