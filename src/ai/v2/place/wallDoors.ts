// 방에서 방으로 가는 문은 벽에 그려진 문이다 — 칩셋에 «벽에 거는 문» 키트가 있으면 뒷벽 벽면에 걸고 그 앞 바닥 칸을 이동 칸으로 쓴다.
// 그런 키트가 없는 칩셋은 undefined — 부르는 쪽이 계단 키트(place/stairLinks)로 간다. 맨바닥 이동 칸은 그 둘이 다 없을 때만 남는다.
// 읽는 것: 위층 타일만으로 된 작은 구조 키트이고 문 칸을 적어 둔 것 — 모든 칸이 표면 계약의 문 타일(tilesetSurface.doors: 역할 door · 꼬리표 door·문)이거나
// 입구 부품(parts entrance)이 있다. 이름표·요청 글은 읽지 않는다. 건물 키트(아래층 타일이 있고 크다)는 여기 들지 않는다.
// 왜(2026-11-13): 구성기 방에는 벽 문 조각이 없어 방 ↔ 방이 계단 그림이거나 맨바닥이었다 — 증기 도시에 방 사이 철문이 생겼다(#4702).
import { isPassable } from "@/project/collision";
import { objectClusterAt } from "@/project/objectFootprint";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project } from "@/project/types";
import { reachableCells } from "../judge/eventReach";
import type { BuildRun } from "../shared/types";
import { isEntranceArt } from "./entrances";

type Kit = { id: string; name?: string; width?: number; height?: number; rows?: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string; dx?: number; dy?: number }[] };
type Meta = { role?: string } | undefined;

/** 벽에 거는 문 한 짝의 칸 수 상한(두 짝 문 2×3 까지) — 건물 한 채는 넘는다. */
const MAX_DOOR_CELLS = 6;

/** 이 칩셋의 «벽에 거는 문» 키트와 문 칸의 열(키트 맨 아랫줄에서). */
export function wallDoorKits(project: Project, map: GameMap): { kit: Kit; doorDx: number }[] {
  const tileset = project.tilesets[map.tilesetId];
  const doors = tilesetSurface(tileset).doors;
  const kits = ((tileset as { structureKits?: readonly Kit[] } | undefined)?.structureKits ?? []) as readonly Kit[];
  const out: { kit: Kit; doorDx: number }[] = [];
  for (const kit of kits) {
    const w = kit.width ?? 1, h = kit.height ?? 1;
    const rows = kit.rows ?? [];
    if (w * h > MAX_DOOR_CELLS || rows.length !== h) continue;
    // 벽면을 덮는 그림: 아래층 타일이 없고 모든 칸에 위층 타일이 있다.
    if (!rows.every((r) => (r.tiles ?? []).every((t) => t < 0) && (r.upperTiles ?? []).length === w && (r.upperTiles ?? []).every((t) => t >= 0))) continue;
    const entrance = (kit.parts ?? []).find((p) => p.kind === "entrance" && p.dy === h - 1 && typeof p.dx === "number");
    const allDoor = rows.every((r) => (r.upperTiles ?? []).every((t) => doors.has(t)));
    if (!entrance && !allDoor) continue;
    out.push({ kit, doorDx: entrance?.dx ?? Math.floor((w - 1) / 2) });
  }
  return out;
}

/**
 * 방 맵의 뒷벽에 문 한 짝을 걸고 이동 칸(문 바로 아래 바닥)과 문 칸을 돌려준다.
 * 자리: 키트의 모든 칸이 빈 벽면(역할 wall, 위에 건 그림 없음)이고 바로 아래가 걸어 닿는 빈 바닥 — 다른 이벤트·출구에서 먼 곳. 문 그림으로 읽히지 않으면 되돌린다.
 */
export function hangWallDoor(run: BuildRun, mapId: string): { x: number; y: number; doorAt: { x: number; y: number }; note: string } | undefined {
  const project0 = run.ctx.project;
  const map0 = project0.maps[mapId];
  const reach0 = map0 ? reachableCells(project0, map0) : undefined;
  if (!map0 || !reach0) return undefined;
  const meta = ((project0.tilesets[map0.tilesetId] as { tileMeta?: unknown } | undefined)?.tileMeta ?? []) as Meta[];
  const events = map0.events ?? [];
  const at = (x: number, y: number) => y * map0.width + x;
  const wall = (x: number, y: number) => x >= 0 && y >= 0 && x < map0.width && y < map0.height && meta[map0.lowerTiles[at(x, y)] ?? -1]?.role === "wall"
    && (map0.upperTiles[at(x, y)] ?? -1) < 0 && (map0.upperOverlayTiles?.[at(x, y)] ?? -1) < 0;
  const floor = (x: number, y: number) => y < map0.height && !!reach0[at(x, y)] && isPassable(project0, map0, x, y) && !objectClusterAt(project0, map0, x, y)
    && !isEntranceArt(project0, map0, x, y) && !events.some((e) => Math.abs(e.x - x) + Math.abs(e.y - y) <= 1);
  for (const { kit, doorDx } of wallDoorKits(project0, map0).slice(0, 2)) {
    const w = kit.width ?? 1, h = kit.height ?? 1;
    const spots: { x: number; y: number; far: number }[] = [];
    for (let y = 0; y + h < map0.height; y += 1) for (let x = 0; x + w <= map0.width; x += 1) {
      let ok = true;
      for (let yy = y; yy < y + h && ok; yy += 1) for (let xx = x; xx < x + w && ok; xx += 1) ok = wall(xx, yy);
      for (let xx = x; xx < x + w && ok; xx += 1) ok = floor(xx, y + h);
      if (ok) spots.push({ x, y, far: Math.min(...events.map((e) => Math.abs(e.x - x - doorDx) + Math.abs(e.y - y - h)), 99) });
    }
    // 다른 이벤트·출구에서 먼 벽 먼저 — 나가는 문 곁에 문이 하나 더 붙지 않게. 같으면 뒷벽(위쪽), 왼쪽부터.
    spots.sort((a, b) => b.far - a.far || a.y - b.y || a.x - b.x);
    for (const spot of spots.slice(0, 4)) {
      const snapshot = run.ctx.project;
      const painted = (kit.rows ?? []).every((row, dy) => (row.upperTiles ?? []).every((tile, dx) => run.call("paint_tiles", { mapId, layer: "3", mode: "cells", tile, cells: [{ x: spot.x + dx, y: spot.y + dy }] }).ok));
      const map = run.ctx.project.maps[mapId]!;
      const door = { x: spot.x + doorDx, y: spot.y + h - 1 };
      const reach = painted ? reachableCells(run.ctx.project, map) : undefined;
      if (reach?.[at(door.x, door.y + 1)] && !isPassable(run.ctx.project, map, door.x, door.y) && isEntranceArt(run.ctx.project, map, door.x, door.y)) {
        return { x: door.x, y: door.y + 1, doorAt: door, note: `벽 문 「${kit.name ?? kit.id}」을 (${spot.x},${spot.y})에 걺` };
      }
      run.ctx.project = snapshot;
    }
  }
  return undefined;
}
