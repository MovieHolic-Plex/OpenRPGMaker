// 들어갈 수 없는 집 문 그림에 「잠겨 있다」 한 줄 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm6 flash jrpg 판정 major «집 문 2곳에서 Enter/z 를 눌러도 아무 반응이 없다», argon jrpg «서쪽 집 문(5,21)에서 위로 hold 해도
// 안 들어가지고 z 를 눌러도 안내가 없다»): 버들항 마을의 집 문 그림 칸 대부분에 이벤트가 없다 — 판정자는 문마다 눌러 보고, 반응이 없자
// 고장인지 조건이 있는지 몰라 헤맸다.
// 규칙: 바깥 맵(실내 아님)의 문 그림 칸(doorArtCells)에 이벤트가 없고 바로 아래(문 앞) 칸에도 이동 이벤트가 없으면, 그 칸에 투명·접촉 이벤트
// 「굳게 닫힌 집 문」을 세워 부딪히거나 조사하면 「문이 굳게 잠겨 있다.」 한 줄을 보인다. 문 칸이 걸을 수 있는 칸이면 세우지 않는다(길을 막게 된다).
// 걸어서 지나는 문(성문·아치·목책 문)의 기둥 칸은 집 문이 아니다 — 세우지 않고, 전에 세운 것은 걷어 낸다(isWalkThroughDoorArt).
//   2026-11-11 Terra 게임 둘(fun-x1·fun-w3)의 이 이벤트 27개가 전부 성문 기둥에 서 있었다. 눈가림 플레이어는 궁전 성문에서
//   「문이 굳게 잠겨 있다」 를 읽고 들어가지 않았고, 그 판은 진행 불가로 채점됐다.
// 되풀이 안전(같은 id). 새 그림은 그리지 않는다.
import { isPassable } from "@/project/collision";
import type { GameEvent, GameMap } from "@/project/types";
import { doorArtCells, isWalkThroughDoorArt, unreachableEvents } from "../judge/eventReach";
import type { BuildRun } from "../shared/types";

const LOCKED_DOOR_PREFIX = "ev_locked_door_";
const LINE = "문이 굳게 잠겨 있다. 들어갈 수 없는 집이다.";
// 청사진 단계 이름(「잠긴 문」)과 겹치면 단계 찾기·지름길 검사가 이 칸을 단계로 잡는다(vm5 argon jrpg 재생) — 단계에 안 쓰일 이름.
const DOOR_NAME = "굳게 닫힌 집 문";

const hasTransfer = (ev: GameEvent) => JSON.stringify(ev.pages ?? []).includes('"kind":"transfer"');
const indoor = (map: GameMap) => (map as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor";

export function lockBareHouseDoors(run: BuildRun, mapId: string): string[] {
  let project = run.ctx.project;
  let map = project.maps[mapId];
  if (!map || indoor(map)) return [];
  const notes: string[] = [];
  // 전에 성문 기둥에 세운 것은 걷어 낸다 — 이어 하는 턴이 옛 판을 고친다.
  const stray = (map.events ?? []).filter((e) => e.id.startsWith(LOCKED_DOOR_PREFIX) && isWalkThroughDoorArt(project, map!, e));
  if (stray.length) {
    const gone = new Set(stray.map((e) => e.id));
    map = { ...map, events: map.events.filter((e) => !gone.has(e.id)) };
    project = { ...project, maps: { ...project.maps, [mapId]: map } };
    run.ctx.project = project;
    notes.push(`걸어서 지나는 문 기둥에 서 있던 「잠겨 있다」 ${stray.length}곳을 걷어 냈다: ${stray.map((e) => `(${e.x},${e.y})`).join(" ")}`);
  }
  const doors = doorArtCells(project, map);
  if (!doors.length) return notes;
  const near = (x: number, y: number) => (map.events ?? []).filter((e) => Math.abs(e.x - x) <= 1 && e.y >= y && e.y <= y + 1);
  const added: GameEvent[] = [];
  for (const d of doors) {
    const id = `${LOCKED_DOOR_PREFIX}${d.x}_${d.y}`;
    if ((map.events ?? []).some((e) => e.id === id)) continue;
    if ((map.events ?? []).some((e) => e.x === d.x && e.y === d.y)) continue;
    // 문 앞이나 곁에 출입 이벤트가 있으면 그 문은 들어가는 문이다.
    if (near(d.x, d.y).some(hasTransfer)) continue;
    if (isPassable(project, map, d.x, d.y)) continue;
    if (isWalkThroughDoorArt(project, map, d)) continue;
    added.push({
      id, name: DOOR_NAME, x: d.x, y: d.y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{
        id: `${id}_p0`, name: DOOR_NAME, conditions: [], graphic: { transparent: true },
        trigger: { kind: "playerTouch" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: LINE }],
      }],
    } as unknown as GameEvent);
  }
  if (!added.length) return notes;
  const before = new Set(unreachableEvents(project, mapId));
  const next = { ...project, maps: { ...project.maps, [mapId]: { ...map, events: [...map.events, ...added] } } };
  // 문 칸은 이미 못 걷는 칸이라 닿는 칸은 줄지 않는다 — 그래도 못 닿는 이벤트가 늘면 세우지 않는다.
  if (unreachableEvents(next, mapId).some((id) => !before.has(id) && !id.startsWith(LOCKED_DOOR_PREFIX))) return notes;
  run.ctx.project = next;
  return [...notes, `들어갈 수 없는 집 문 ${added.length}곳에 「잠겨 있다」 한 줄: ${added.map((e) => `(${e.x},${e.y})`).join(" ")}`];
}
