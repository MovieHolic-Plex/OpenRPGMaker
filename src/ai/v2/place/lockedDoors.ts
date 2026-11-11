// 들어갈 수 없는 건물 입구에 「들어갈 수 없다」 한 줄 — 끝맺음 clearLanes.
//
// 왜(2026-10-29 vm6 flash·argon jrpg 판정 major «집 문에서 Enter/z 를 눌러도 아무 반응이 없다»): 마을 집 문 대부분에 이벤트가 없어
// 판정자가 문마다 눌러 보고, 고장인지 조건이 있는지 몰라 헤맸다.
// 규칙: 바깥 맵(방으로 깔렸다고 적히지 않았고 실내 기후도 아닌 맵)의 건물 입구(place/entrances.ts — 칩셋의 건물 키트가 문이라고 적어 둔 막힌 칸)에 이벤트가 없고
// 그 문이나 문 앞에 이동 이벤트가 없으면, 문 칸에 투명·접촉 이벤트를 세워 부딪히거나 조사하면 한 줄을 보인다.
// 문은 이름표 낱말로 읽지 않는다 — 이름표가 「…문」인 칸은 구성기 칩셋에서 걸어서 지나는 성문뿐이었고(집은 키트 한 덩이),
// 그 기둥에 선 「잠겨 있다」 가 눈가림 플레이어를 궁전 밖에 세워 뒀다. 입구가 아닌 칸에 전에 세운 것은 걷어 낸다.
// 되풀이 안전(같은 id). 새 그림은 그리지 않는다.
import type { GameEvent, GameMap } from "@/project/types";
import { unreachableEvents } from "../judge/eventReach";
import { buildingEntrances } from "./entrances";
import type { Laid } from "./exitDress";
import type { BuildRun } from "../shared/types";

const LOCKED_DOOR_PREFIX = "ev_locked_door_";
// 집 문·동굴 아가리·천막·승강기 어느 입구에서도 맞는 말 — 키트가 적는 것은 「입구」뿐이라 닫혔는지·집인지는 이 단계가 모른다.
const LINE = "여기로는 들어갈 수 없다.";
// 청사진 단계 이름(「잠긴 문」)과 겹치면 단계 찾기·지름길 검사가 이 칸을 단계로 잡는다 — 단계에 안 쓰일 이름.
const DOOR_NAME = "들어갈 수 없는 입구";

const hasTransfer = (ev: GameEvent) => JSON.stringify(ev.pages ?? []).includes('"kind":"transfer"');
const indoor = (map: GameMap) => (map as unknown as { climate?: { mode?: string } }).climate?.mode === "indoor";

export function lockBareHouseDoors(run: BuildRun, mapId: string, laid?: Laid): string[] {
  let project = run.ctx.project;
  let map = project.maps[mapId];
  if (!map || laid === "room" || indoor(map)) return [];
  const notes: string[] = [];
  const entrances = buildingEntrances(project, map);
  const entranceAt = new Set(entrances.map((e) => e.y * map!.width + e.x));
  // 입구가 아닌 칸에 전에 세운 것은 걷어 낸다 — 이어 하는 턴이 옛 판(성문 기둥)을 고친다.
  const stray = (map.events ?? []).filter((e) => e.id.startsWith(LOCKED_DOOR_PREFIX) && !entranceAt.has(e.y * map!.width + e.x));
  if (stray.length) {
    const gone = new Set(stray.map((e) => e.id));
    map = { ...map, events: map.events.filter((e) => !gone.has(e.id)) };
    project = { ...project, maps: { ...project.maps, [mapId]: map } };
    run.ctx.project = project;
    notes.push(`건물 입구가 아닌 칸에 서 있던 「들어갈 수 없다」 ${stray.length}곳을 걷어 냈다: ${stray.map((e) => `(${e.x},${e.y})`).join(" ")}`);
  }
  if (!entrances.length) return notes;
  const near = (x: number, y: number) => (map.events ?? []).filter((e) => Math.abs(e.x - x) <= 1 && e.y >= y && e.y <= y + 1);
  const added: GameEvent[] = [];
  for (const d of entrances) {
    const id = `${LOCKED_DOOR_PREFIX}${d.x}_${d.y}`;
    if ((map.events ?? []).some((e) => e.id === id)) continue;
    if ((map.events ?? []).some((e) => e.x === d.x && e.y === d.y)) continue;
    // 문 앞이나 곁에 출입 이벤트가 있으면 그 문은 들어가는 문이다.
    if (near(d.x, d.y).some(hasTransfer)) continue;
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
  return [...notes, `들어갈 수 없는 건물 입구 ${added.length}곳에 「들어갈 수 없다」 한 줄: ${added.map((e) => `(${e.x},${e.y})`).join(" ")}`];
}
