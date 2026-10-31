// 지붕·나무 머리 밑(주인공 위로 그려지는 윗층 그림이 덮은 걸을 수 있는 칸)에 선 시작 자리와 말 걸 대상을 트인 칸으로 옮긴다(끝맺음, 결정적).
//
// 왜(2026-10-31 jb2a terra jrpg, 고친 판 첫 측정): 마을 시작 칸 (10,5)가 집 지붕 한가운데였다. 버들항 집 킷은 지붕 줄을 «뒤로 걸어 지나는»
// 칸(통행 가능 + 윗층 우선)으로 그리므로 주인공이 지붕에 가려 보이지 않은 채 시작했고, 떠돌이 상인 (12,4)도 같은 지붕 밑이었다.
// 판정자는 지붕 뒤 첫 단계 「마을의 호소」(10,1)를 23분 뒤에야 찾았고 엔딩을 못 봤다.
// 규칙: 칸의 윗층(upperTiles·upperOverlayTiles) 그림이 타일셋 우선순위 upper(주인공 위)면 «덮인 칸»이다.
//  - 시작 자리가 덮인 칸이면 같은 걸음 덩이에서 가장 가까운 트인 칸(openStartCell)으로.
//  - 그림·반짝임이 있는 1×1 조사·말 걸기 이벤트(문·이동·접촉·자동 실행 아님)가 덮인 칸이면 6칸 안 트인 칸으로 —
//    걸어 닿는 칸이어야 하고, 옮긴 뒤 못 닿는 이벤트가 늘거나 걸어 닿는 칸이 한 칸보다 많이 줄거나 길이 끊기면 그 자리는 쓰지 않는다.
import { isPassable } from "@/project/collision";
import { eventBodyRect } from "@/project/eventFootprintQuery";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { openStartCell } from "@/editor/tools/startOnBuiltMap";
import { roadCutAt } from "@/editor/tools/roadCutGuard";
import { reachableCells, unreachableEvents } from "./eventReach";
import type { BuildRun } from "./types";

/** 주인공 위로 그려지는 윗층 그림이 덮은 칸인가. */
export function coveredCell(project: Project, map: GameMap, x: number, y: number): boolean {
  const ts = project.tilesets[map.tilesetId];
  if (!ts) return false;
  const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
  const i = y * map.width + x;
  return ["upperTiles", "upperOverlayTiles"].some((k) => {
    const t = m[k]?.[i] ?? -1;
    return t >= 0 && (ts.priority as Record<number, string> | undefined)?.[t] === "upper";
  });
}

const TOUCH = /touch|auto|parallel/iu;
const shown = (ev: GameEvent) => (ev.pages ?? []).some((p) => {
  const g = (p.graphic ?? {}) as { transparent?: boolean; sprite?: unknown; appearanceId?: unknown };
  return (g.transparent !== true && Boolean(g.sprite || g.appearanceId)) || Boolean((p as { nearSparkle?: unknown }).nearSparkle);
});
const talkable = (ev: GameEvent) => (ev.pages ?? []).length > 0 && (ev.pages ?? []).every((p) => !TOUCH.test(String((typeof p.trigger === "string" ? p.trigger : p.trigger?.kind) ?? "action")))
  && !/"kind":"transfer"/u.test(JSON.stringify(ev.pages ?? []));
const oneCell = (ev: GameEvent) => { const r = eventBodyRect(ev); return r.left === r.right && r.top === r.bottom; };
const count = (a: Uint8Array | undefined) => (a ? a.reduce((n, v) => n + (v ? 1 : 0), 0) : 0);

export function stepOutFromUnderRoofs(run: BuildRun): string[] {
  const notes: string[] = [];
  for (const mapId of Object.keys(run.ctx.project.maps)) {
    const project = run.ctx.project;
    const map = project.maps[mapId]!;
    // 시작 자리
    const s = project.startPos;
    if (project.startMapId === mapId && s && coveredCell(project, map, s.x, s.y)) {
      const reach = reachableCells(project, map);
      const area: number[] = [];
      if (reach) for (let j = 0; j < reach.length; j++) if (reach[j] && !coveredCell(project, map, j % map.width, Math.floor(j / map.width))) area.push(j);
      const cell = area.length ? openStartCell(project, map, s, area) : null;
      if (cell) {
        run.ctx.project = { ...project, startPos: { ...s, x: cell.x, y: cell.y } } as Project;
        notes.push(`시작 칸 (${s.x},${s.y})이 지붕·나무 그림 밑이라 (${cell.x},${cell.y})로`);
      }
    }
    // 말 걸기·조사 대상
    for (const ev0 of map.events ?? []) {
      const project1 = run.ctx.project;
      const map1 = project1.maps[mapId]!;
      const ev = map1.events.find((e) => e.id === ev0.id);
      if (!ev || !oneCell(ev) || !talkable(ev) || !shown(ev) || !isPassable(project1, map1, ev.x, ev.y) || !coveredCell(project1, map1, ev.x, ev.y)) continue;
      const reach0 = reachableCells(project1, map1);
      if (!reach0) continue;
      const before = new Set(unreachableEvents(project1, mapId));
      const start = project1.startMapId === mapId ? project1.startPos : undefined;
      const taken = new Set(map1.events.filter((e) => e.id !== ev.id).map((e) => `${e.x},${e.y}`));
      if (start) taken.add(`${start.x},${start.y}`);
      const spots: { x: number; y: number; d: number }[] = [];
      for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const x = ev.x + dx, y = ev.y + dy;
        if (x < 1 || y < 1 || x >= map1.width - 1 || y >= map1.height - 1 || taken.has(`${x},${y}`)) continue;
        if (!reach0[y * map1.width + x] || !isPassable(project1, map1, x, y) || coveredCell(project1, map1, x, y)) continue;
        spots.push({ x, y, d: Math.abs(dx) + Math.abs(dy) });
      }
      spots.sort((a, b) => a.d - b.d);
      for (const spot of spots) {
        if (roadCutAt(project1, map1, [spot])) continue;
        const moved = { ...map1, events: map1.events.map((e) => (e.id === ev.id ? { ...e, x: spot.x, y: spot.y } : e)) } as GameMap;
        const next = { ...project1, maps: { ...project1.maps, [mapId]: moved } } as Project;
        if (count(reach0) - count(reachableCells(next, moved)) > 1 || unreachableEvents(next, mapId).some((id) => !before.has(id))) continue;
        run.ctx.project = next;
        notes.push(`「${ev.name ?? ev.id}」 (${ev.x},${ev.y}) 지붕·나무 그림 밑 → (${spot.x},${spot.y})`);
        break;
      }
    }
  }
  return notes;
}
