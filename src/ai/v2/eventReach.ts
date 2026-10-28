// 조사 이벤트가 «걸어 가서 말을 걸 수 있는 자리»에 있나 — 퍼즐 고리·청사진 경로 빌더가 놓은 뒤 확인하고, 아니면 옮긴다.
//
// 왜(2026-10-28 mt2 deepseek 방탈출 「서재의 네 자리」): author_puzzle_chain 이 모델이 준 칸에 이벤트를 그대로 두었다.
// 「책상 서랍의 쪽지」(4,7)가 서재 서쪽 반으로 가는 한 칸 통로를 막아, 그 너머의 「문 옆 자물쇠」(4,9)에 영영 못 갔다 —
// 3맵·3턴 112분을 짓고도 엔딩 불가. 규칙(자동 플레이·런타임과 같은 충돌):
//  - 플레이어 시작점·이 맵으로 들어오는 착지점에서 BFS(같은 높이 이벤트는 못 지난다)로 닿는 칸 옆에 있어야 조사할 수 있다.
//  - 놓은 이벤트가 길목을 막아 닿던 칸을 잃게 하면 안 된다(자기 칸 하나만 빼고).
//  - 이름이 문(탈출 문·현관…)이면 그림 「문」 칸에 붙인다 — 그 칸이 길목을 막는 것은 잠긴 문이라 괜찮지만 다른 조사 이벤트를 잃게 하면 안 된다.
// 옮길 때는 원래 자리에서 가장 가까운, 가구 앞(옆이 못 지나는 물건 칸) 빈 바닥을 고른다.
import { canMove, isPassable } from "@/project/collision";
import { playerAnchors } from "@/editor/tools/transferReachability";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { objectAt, tileLabel } from "./people";
import type { BuildRun } from "./types";

type Cell = { x: number; y: number };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const TOUCH = new Set(["playerTouch", "touch", "eventTouch"]);

/** 길을 막는 이벤트인가 — 어느 페이지든 같은 높이·겹침 금지거나 접촉 발동이면 막는 것으로 본다(보수적으로). */
export function eventBlocks(ev: GameEvent): boolean {
  const pages = ev.pages ?? [];
  if (!pages.length) return false;
  return pages.some((p) => {
    const trig = typeof p.trigger === "string" ? p.trigger : p.trigger?.kind;
    return TOUCH.has(String(trig ?? "")) || ((p.priority ?? "same") === "same" && (p as { overlapForbidden?: boolean }).overlapForbidden !== false);
  });
}

/** 시작 맵은 시작점 하나(다른 맵에서 돌아오는 착지점은 잠긴 문 너머일 수 있다), 그 밖의 맵은 들어오는 착지점들. */
function anchorsOf(project: Project, map: GameMap): Cell[] {
  const start = project.startMapId === map.id && project.startPos && isPassable(project, map, project.startPos.x, project.startPos.y) ? [{ x: project.startPos.x, y: project.startPos.y }] : [];
  return start.length ? start : playerAnchors(project, map).filter((a) => isPassable(project, map, a.x, a.y));
}

/** 앵커에서 걸어 닿는 칸(blocked 는 못 지난다). */
function reachFrom(project: Project, map: GameMap, anchors: readonly Cell[], blocked: ReadonlySet<number>): Uint8Array {
  const w = map.width;
  const seen = new Uint8Array(w * map.height);
  const q: number[] = [];
  for (const a of anchors) { const i = a.y * w + a.x; if (!seen[i] && !blocked.has(i)) { seen[i] = 1; q.push(i); } }
  for (let k = 0; k < q.length; k++) {
    const i = q[k]!, x = i % w, y = (i - x) / w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= map.height) continue;
      const j = ny * w + nx;
      if (seen[j] || blocked.has(j) || !canMove(project, map, x, y, nx, ny)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

function blockersOf(map: GameMap, except?: string): Set<number> {
  const out = new Set<number>();
  for (const ev of map.events ?? []) if (ev.id !== except && eventBlocks(ev)) out.add(ev.y * map.width + ev.x);
  return out;
}

const nextTo = (map: GameMap, reach: Uint8Array, c: Cell) => DIRS.some(([dx, dy]) => {
  const x = c.x + dx, y = c.y + dy;
  return x >= 0 && y >= 0 && x < map.width && y < map.height && !!reach[y * map.width + x];
});

/** 이 맵에서 걸어 가 말을 걸 수 없는 이벤트 id(앵커가 없는 맵은 판단하지 않는다). */
export function unreachableEvents(project: Project, mapId: string, eventIds?: readonly string[]): string[] {
  const map = project.maps[mapId];
  if (!map) return [];
  const anchors = anchorsOf(project, map);
  if (!anchors.length) return [];
  const reach = reachFrom(project, map, anchors, blockersOf(map));
  return (map.events ?? []).filter((ev) => (!eventIds || eventIds.includes(ev.id)) && !nextTo(map, reach, ev) && !reach[ev.y * map.width + ev.x]).map((ev) => ev.id);
}

const DOOR_NAME = /문|door|출구|현관|exit|gate/iu;
const NOT_DOOR_NAME = /금고|창문|서랍|문서|문양|문장|주문|질문|자물쇠|lock|safe|window/iu;
const DOOR_ART = /문|door|gate/iu;
const NOT_DOOR_ART = /금고|창문|창틀|문양|문장|window|safe/iu;
/** 이름이 문인 이벤트(탈출 문·현관문) — 문 옆 자물쇠·금고문은 아니다. */
export const isDoorName = (name: string) => DOOR_NAME.test(name) && !NOT_DOOR_NAME.test(name);

/** 그림 「문」 칸들(맨 아래 줄 — 사람이 서서 여는 칸). */
function doorArtCells(project: Project, map: GameMap): Cell[] {
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const hit = (x: number, y: number) => ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"].some((k) => {
    const label = tileLabel(project, map, m[k]?.[y * map.width + x]);
    return !!label && DOOR_ART.test(label) && !NOT_DOOR_ART.test(label);
  });
  const out: Cell[] = [];
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (hit(x, y) && !(y + 1 < map.height && hit(x, y + 1))) out.push({ x, y });
  // 문 그림이 세로로 두 칸이면 아래 칸이 바닥 쪽이다. 아래가 통행 칸이 아니면(벽 줄에 붙은 문) 위 칸도 후보로 둔다.
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (hit(x, y) && y + 1 < map.height && hit(x, y + 1) && !isPassable(project, map, x, y + 1)) out.push({ x, y });
  return out;
}

export interface ReachRepair { readonly moved: string[]; readonly stuck: string[] }

/**
 * 이벤트들(순서 = 고리 순서)을 걸어 가 말을 걸 수 있게 고친다. 막힌 이벤트·길목을 막는 이벤트는 가까운 좋은 칸으로 move_event,
 * 문 이름 이벤트는 그림 문 칸으로. 다른 이벤트(목록 밖 포함)를 못 닿게 만드는 자리는 고르지 않는다.
 */
export function repairEventReach(run: BuildRun, mapId: string, eventIds: readonly string[]): ReachRepair {
  const moved: string[] = [];
  const stuck: string[] = [];
  for (const id of eventIds) {
    const project = run.ctx.project;
    const map = project.maps[mapId];
    const ev = map?.events.find((e) => e.id === id);
    if (!map || !ev) continue;
    const anchors = anchorsOf(project, map);
    if (!anchors.length) continue;
    const w = map.width;
    const othersBlocked = blockersOf(map, id);
    const free = reachFrom(project, map, anchors, othersBlocked);
    const others = (map.events ?? []).filter((e) => e.id !== id);
    // 이 자리에 두면: 다른 이벤트가 다 그대로 닿고, 잃는 칸이 (자기 칸 말고) 없고, 자기 옆에 닿는 칸이 있다.
    const othersOk = (reach: Uint8Array) => others.every((o) => !free[o.y * w + o.x] && !nextTo(map, free, o) ? true : nextTo(map, reach, o) || !!reach[o.y * w + o.x]);
    // 길목을 막아 잃는 칸이 있어도 그 안에 이벤트가 없으면 괜찮다(막다른 구석 앞 책장) — 다른 이벤트를 못 닿게 하면 안 된다.
    const judge = (c: Cell): boolean => {
      const i = c.y * w + c.x;
      const blocked = new Set(othersBlocked);
      if (eventBlocks(ev)) blocked.add(i);
      const reach = reachFrom(project, map, anchors, blocked);
      if (!nextTo(map, reach, c) && !reach[i]) return false;
      return othersOk(reach);
    };
    const name = String((ev as { name?: string }).name ?? "");
    const door = isDoorName(name);
    const doors = door ? doorArtCells(project, map) : [];
    const onDoor = doors.some((d) => d.x === ev.x && d.y === ev.y);
    const here = { x: ev.x, y: ev.y };
    const okHere = judge(here);
    if (okHere && (!door || !doors.length || onDoor)) continue;
    const taken = new Set((map.events ?? []).filter((e) => e.id !== id).map((e) => e.y * w + e.x));
    const anchorSet = new Set(anchors.map((a) => a.y * w + a.x));
    // 1) 문 이름이면 그림 문 칸(가까운 것부터).
    let target: Cell | undefined;
    if (door) target = [...doors].sort((a, b) => Math.abs(a.x - ev.x) + Math.abs(a.y - ev.y) - (Math.abs(b.x - ev.x) + Math.abs(b.y - ev.y)))
      .find((c) => !taken.has(c.y * w + c.x) && !anchorSet.has(c.y * w + c.x) && judge(c));
    if (!target && okHere) continue;
    // 2) 아니면 닿는 빈 바닥 중 원래 자리에서 가까운 것 — 옆에 물건(못 지나는 칸)이 있으면 그 앞이라 더 낫다.
    if (!target) {
      const cands: { c: Cell; s: number }[] = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!free[i] || taken.has(i) || anchorSet.has(i)) continue;
        const besideThing = DIRS.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < map.height && (!isPassable(project, map, nx, ny) || objectAt(map, { x: nx, y: ny })); });
        cands.push({ c: { x, y }, s: Math.abs(x - ev.x) + Math.abs(y - ev.y) + (besideThing ? 0 : 3) });
      }
      cands.sort((a, b) => a.s - b.s);
      target = cands.slice(0, 80).find(({ c }) => judge(c))?.c;
    }
    if (!target) { stuck.push(`${name || id}(${ev.x},${ev.y})`); continue; }
    const res = run.call("move_event", { mapId, eventId: id, x: target.x, y: target.y });
    if (res.ok) moved.push(`${name || id} (${ev.x},${ev.y})→(${target.x},${target.y})${door && doors.some((d) => d.x === target!.x && d.y === target!.y) ? " 문 그림 칸" : ""}`);
    else stuck.push(`${name || id}: ${String(res.summary).slice(0, 120)}`);
  }
  return { moved, stuck };
}
