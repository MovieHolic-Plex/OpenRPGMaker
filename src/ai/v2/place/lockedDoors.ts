// 들어갈 수 없는 건물 입구에 「들어갈 수 없다」 한 줄 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm6 flash·argon jrpg 판정 major «집 문에서 Enter/z 를 눌러도 아무 반응이 없다»): 마을 집 문 대부분에 이벤트가 없어
// 판정자가 문마다 눌러 보고, 고장인지 조건이 있는지 몰라 헤맸다.
// 규칙: 바깥 맵(방으로 깔렸다고 적히지 않았고 실내 기후도 아닌 맵)의 건물 입구(place/entrances.ts — 칩셋의 건물 키트가 문이라고 적어 둔 막힌 칸)
// 가운데 문 앞에 걸어 가 설 수 있고 그 문(옆으로 붙은 칸들이 한 문)이나 문 앞에 이동 이벤트가 없는 문의 칸마다 투명 조사 이벤트를 세운다.
// 문은 이름표 낱말로 읽지 않는다 — 이름표가 「…문」인 칸은 구성기 칩셋에서 걸어서 지나는 성문뿐이었고(집은 키트 한 덩이),
// 그 기둥에 선 「잠겨 있다」 가 눈가림 플레이어를 궁전 밖에 세워 뒀다.
// 되풀이 안전: 세울 문의 목록이 정본이다 — 거기 없는 옛 줄(성문 기둥 · 이제 들어갈 수 있게 된 문)은 걷어 내고, 접촉으로 세운 옛 줄은 조사 키로 바꾼다.
// 조수·사람이 고친 줄(대사 한 줄이 아닌 것 — 열쇠가 있으면 열리는 문)은 그대로 둔다.
// 새 그림은 그리지 않는다.
import type { GameEvent, GameMap } from "@/project/types";
import { reachableCells, unreachableEvents } from "../judge/eventReach";
import { buildingEntrances, type Entrance } from "./entrances";
import type { Laid } from "./exitDress";
import type { BuildRun } from "../shared/types";

const LOCKED_DOOR_PREFIX = "ev_locked_door_";
/** 이 단계가 세운 한 줄인가 — 조수가 지은 조사 지점이 아니다(조사 검사가 센다면 같은 건물의 간판 조사와 «한 물건에 이야기 둘»이 된다). */
export const isEntranceLine = (ev: { readonly id: string }): boolean => ev.id.startsWith(LOCKED_DOOR_PREFIX);
// 집 문·동굴 아가리·천막·승강기 어느 입구에서도 맞는 말 — 키트가 적는 것은 「입구」뿐이라 닫혔는지·집인지는 이 단계가 모른다.
const LINE = "여기로는 들어갈 수 없다.";
// 청사진 단계 이름(「잠긴 문」)과 겹치면 단계 찾기·지름길 검사가 이 칸을 단계로 잡는다 — 단계에 안 쓰일 이름.
const DOOR_NAME = "들어갈 수 없는 입구";
// 조사 키에만 답한다. 접촉(playerTouch)으로 세웠을 때 출하 플레이어에서 본 것(scripts/qa/runtime/locked-entrance.scenario.mjs):
// 막힌 문 칸의 접촉 이벤트는 문 쪽으로 밀 때마다 대사창을 띄우고, 정작 조사 키에는 답하지 않는다 — 처음 지적이 «Enter/z 를 눌러도 반응이 없다» 였다.
const TRIGGER = { kind: "action" } as const;

const hasTransfer = (ev: GameEvent) => JSON.stringify(ev.pages ?? []).includes('"kind":"transfer"');
const indoor = (map: GameMap) => (map as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor";
/** 이 단계가 세운 그대로인 줄인가 — 조수·사람이 고친 것(열쇠가 있으면 열리는 문 …)은 남의 이벤트로 보고 건드리지 않는다. */
const plainLine = (ev: GameEvent) => isEntranceLine(ev) && (ev.pages ?? []).length <= 1 && (ev.pages?.[0]?.commands ?? []).every((c) => c.kind === "text");
const onTouch = (ev: GameEvent) => (ev.pages ?? []).some((p) => (p.trigger as { kind?: string } | undefined)?.kind !== "action");

const lineEvent = (id: string, at: { x: number; y: number }): GameEvent => ({
  id, name: DOOR_NAME, x: at.x, y: at.y, trigger: TRIGGER, commands: [],
  pages: [{
    id: `${id}_p0`, name: DOOR_NAME, conditions: [], graphic: { transparent: true },
    trigger: TRIGGER, priority: "same", overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: LINE }],
  }],
}) as unknown as GameEvent;

export function lockBareHouseDoors(run: BuildRun, mapId: string, laid?: Laid): string[] {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  if (!map || laid === "room" || indoor(map)) return [];
  const w = map.width;
  const others = (map.events ?? []).filter((e) => !plainLine(e));
  const reach = reachableCells(project, map);
  // 문 하나 = 옆으로 붙은 입구 칸들(두 칸짜리 헛간 문) — 한 칸이라도 들어갈 수 있으면 그 문은 들어가는 문이다. buildingEntrances 는 위에서 아래, 왼쪽에서 오른쪽 순이다.
  const doors: Entrance[][] = [];
  for (const e of buildingEntrances(project, map)) {
    const last = doors.at(-1)?.at(-1);
    if (last && last.y === e.y && last.x + 1 === e.x) doors.at(-1)!.push(e); else doors.push([e]);
  }
  // 문 앞이나 곁에 출입 이벤트가 있으면 그 문은 들어가는 문이다.
  const enterable = (door: readonly Entrance[]) => door.some((d) => others.some((o) => Math.abs(o.x - d.x) <= 1 && o.y >= d.y && o.y <= d.y + 1 && hasTransfer(o)));
  // 문 칸마다 하나 — 넓은 문(백화점 네 칸)은 한 칸에만 세우면 다른 칸 앞에서 조사 키가 답하지 않는다.
  const want = new Map<string, Entrance>();
  for (const door of doors) {
    if (enterable(door)) continue;
    for (const at of door) {
      if (others.some((o) => o.x === at.x && o.y === at.y)) continue;
      if (reach && !reach[at.front.y * w + at.front.x]) continue; // 아무도 못 서는 문 앞
      want.set(`${LOCKED_DOOR_PREFIX}${at.x}_${at.y}`, at);
    }
  }
  const mine = (map.events ?? []).filter(plainLine);
  const gone = mine.filter((e) => !want.has(e.id));
  const retouch = mine.filter((e) => want.has(e.id) && onTouch(e));
  const added = [...want].filter(([id]) => !mine.some((e) => e.id === id)).map(([id, at]) => lineEvent(id, at));
  if (!gone.length && !retouch.length && !added.length) return [];
  const drop = new Set(gone.map((e) => e.id)), redo = new Set(retouch.map((e) => e.id));
  const kept = (map.events ?? []).filter((e) => !drop.has(e.id)).map((e) => redo.has(e.id) ? { ...e, trigger: TRIGGER, pages: (e.pages ?? []).map((pg) => ({ ...pg, trigger: TRIGGER })) } as GameEvent : e);
  const notes: string[] = [];
  if (gone.length) notes.push(`건물 입구가 아니거나 이제 들어갈 수 있는 문에 서 있던 「들어갈 수 없다」 ${gone.length}곳을 걷어 냈다: ${gone.map((e) => `(${e.x},${e.y})`).join(" ")}`);
  if (retouch.length) notes.push(`문에 부딪힐 때마다 뜨던 「들어갈 수 없다」 ${retouch.length}곳을 조사 키에만 답하게 바꿨다`);
  run.ctx.project = { ...project, maps: { ...project.maps, [mapId]: { ...map, events: kept } } };
  if (!added.length) return notes;
  const before = new Set(unreachableEvents(run.ctx.project, mapId));
  const next = { ...run.ctx.project, maps: { ...run.ctx.project.maps, [mapId]: { ...map, events: [...kept, ...added] } } };
  // 문 칸은 이미 못 걷는 칸이라 닿는 칸은 줄지 않는다 — 그래도 못 닿는 이벤트가 늘면 세우지 않는다.
  if (unreachableEvents(next, mapId).some((id) => !before.has(id) && !id.startsWith(LOCKED_DOOR_PREFIX))) return notes;
  run.ctx.project = next;
  return [...notes, `들어갈 수 없는 건물 입구 ${added.length}곳에 「들어갈 수 없다」 한 줄(조사 키): ${added.map((e) => `(${e.x},${e.y})`).join(" ")}`];
}
