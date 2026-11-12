// 문 사각형의 폭은 건물 키트가 적어 둔 입구 열까지다 — 문 옆 벽·창 칸은 이름표에 「양개문」이 들어 있어도 문이 아니다.
// 낱말로 넓히던 때(2026-11-12 명세 은행 fun-w3 「눈보라 마을」 선술집 · jrpg-w1 「서리울 마을」 긴집): 문이 4칸으로 적혀 벽 두세 칸이 문짝처럼 열리고,
// 이동 발판이 벽 칸마다 복제됐다(ev_gate_…_r2 · _r3 — 막힌 벽 칸의 부딪힘 이동). 작은 집(4×4 이하)은 이름에 「문」이 있으면 집 한 채가 문 키트로 읽혔다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { inferMapDoor } from "@/project/mapDoorKinds";
import type { GameMap, Project } from "@/project/types";
import { isEntranceArt } from "@/ai/v2/place/entrances";

type Ctx = { project: Project };
type Kit = { id?: string; name?: string; rows: { tiles?: number[]; upperTiles?: number[] }[]; parts?: { kind?: string; dx: number; dy: number; w?: number; h?: number }[] };
const OX = 3, OY = 2;

/** 걷는 바닥만 깐 맵 두 장 — map_t 에 그 키트 한 채를 (3,2) 부터 찍는다. door = 입구 부품의 맨 아래 왼쪽 칸. */
function stage(tilesetId: string, kitId: string): { ctx: Ctx; door: { x: number; y: number }; width: number } {
  const ctx: Ctx = { project: createBlankProject() };
  const tileset = ctx.project.tilesets[tilesetId]!;
  const kit = (tileset as unknown as { structureKits: Kit[] }).structureKits.find((k) => k.id === kitId)!;
  expect(kit, kitId).toBeDefined();
  const part = kit.parts!.find((p) => p.kind === "entrance")!;
  const w = Math.max(12, kit.rows[0]!.tiles!.length + 6), h = Math.max(10, kit.rows.length + 6);
  for (const id of ["map_t", "map_in"]) expect(runTool(ctx, "create_map", { id, name: id, width: w, height: h, tilesetId }).ok).toBe(true);
  const floor = tileset.passability.findIndex((p, t) => !!p && p.up && p.down && p.left && p.right && !!(tileset.tileMeta as unknown as ({ label?: string } | undefined)[])[t]?.label);
  expect(floor).toBeGreaterThanOrEqual(0);
  const maps = { ...ctx.project.maps };
  for (const id of ["map_t", "map_in"]) {
    const map = structuredClone(maps[id]!) as GameMap;
    const lower = map.lowerTiles as number[], upper = map.upperTiles as number[];
    for (let i = 0; i < map.width * map.height; i++) { lower[i] = floor; upper[i] = -1; }
    if (id === "map_t") kit.rows.forEach((row, y) => {
      (row.tiles ?? []).forEach((t, x) => { if (t >= 0) lower[(y + OY) * map.width + x + OX] = t; });
      (row.upperTiles ?? []).forEach((t, x) => { if (t >= 0) upper[(y + OY) * map.width + x + OX] = t; });
    });
    maps[id] = map;
  }
  ctx.project = { ...ctx.project, maps, startMapId: "map_t", startPos: { x: 1, y: h - 2 } } as Project;
  return { ctx, door: { x: part.dx + OX, y: part.dy + (part.h ?? 1) - 1 + OY }, width: part.w ?? 1 };
}
/** 문 앞 칸에서 다른 맵으로 잇고, map_t 에 생긴 이동 이벤트 칸과 적힌 문을 돌려준다. */
function link(s: { ctx: Ctx; door: { x: number; y: number } }): { gates: { x: number; y: number }[]; doors: { x: number; w: number }[] } {
  const r = runTool(s.ctx, "create_transfer_pair", { a: { mapId: "map_t", x: s.door.x, y: s.door.y + 1 }, b: { mapId: "map_in", x: 5, y: 7 } });
  expect(r.ok, r.summary).toBe(true);
  const map = s.ctx.project.maps.map_t!;
  return { gates: map.events.map((e) => ({ x: e.x, y: e.y })), doors: (map.doors ?? []).map((d) => ({ x: d.x, w: d.w })) };
}

describe("a door is as wide as the entrance its building kit declares", () => {
  it("snow tavern (two-leaf door, 2 cells): the door rect and the triggers stay on the two door cells", () => {
    const s = stage("snow_north", "sn-meadhall");
    const project = s.ctx.project, map = project.maps.map_t!;
    expect(s.width).toBe(2);
    const door = inferMapDoor(project, map, s.door)!;
    expect({ kind: door.kind, x: door.rect.x, w: door.rect.w }).toEqual({ kind: "double", x: s.door.x, w: 2 });
    // 문 옆 벽·창 칸: 같은 이름표(「회관 선술집(…양개문…)」)지만 문이 아니다.
    expect(inferMapDoor(project, map, { x: s.door.x - 1, y: s.door.y })).toBeNull();
    expect(inferMapDoor(project, map, { x: s.door.x + 2, y: s.door.y })).toBeNull();
    const { gates, doors } = link(s);
    expect(gates.map((g) => g.x).sort()).toEqual([s.door.x, s.door.x + 1]);
    for (const g of gates) expect(isEntranceArt(s.ctx.project, s.ctx.project.maps.map_t!, g.x, g.y), `(${g.x},${g.y})`).toBe(true);
    expect(doors).toEqual([{ x: s.door.x, w: 2 }]);
  });

  it("snow longhouse (one door cell in a 7-wide front): one trigger, no clones on the wall", () => {
    const s = stage("snow_north", "sn-longhouse");
    const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
    expect({ kind: door.kind, w: door.rect.w }).toEqual({ kind: "swing", w: 1 });
    const { gates } = link(s);
    expect(gates).toEqual([{ x: s.door.x, y: s.door.y }]);
    expect(isPassable(s.ctx.project, s.ctx.project.maps.map_t!, s.door.x, s.door.y)).toBe(false);
  });

  it("a small house is not a door kit: the cabin's door is its one declared cell, not the whole 4×4 house", () => {
    const s = stage("snow_north", "sn-cabin-m");
    const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
    expect({ kind: door.kind, x: door.rect.x, w: door.rect.w, h: door.rect.h }).toEqual({ kind: "swing", x: s.door.x, w: 1, h: 2 });
    const { gates, doors } = link(s);
    expect(gates).toEqual([{ x: s.door.x, y: s.door.y }]);
    expect(doors).toEqual([]);
  });

  it("a kit that is the door itself keeps its size (elevator door 2×2 with one declared cell, lattice door 2×3)", () => {
    const lift = stage("sf_station", "sf-elevator-door");
    const a = inferMapDoor(lift.ctx.project, lift.ctx.project.maps.map_t!, lift.door)!;
    expect({ kind: a.kind, w: a.rect.w, h: a.rect.h }).toEqual({ kind: "auto", w: 2, h: 2 });
    const lattice = stage("jp_city", "jp-door-lattice");
    const b = inferMapDoor(lattice.ctx.project, lattice.ctx.project.maps.map_t!, lattice.door)!;
    expect({ kind: b.kind, w: b.rect.w, h: b.rect.h }).toEqual({ kind: "slide", w: 2, h: 3 });
  });

  it("a shutter drawn with one repeated tile keeps its full width (the same picture is the same door)", () => {
    const s = stage("sf_station", "sf-airlock-wide");
    const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
    expect({ kind: door.kind, x: door.rect.x, w: door.rect.w }).toEqual({ kind: "shutter", x: s.door.x - 1, w: 3 });
  });

  it("kits whose entrance is a walkable doorstep are read as before (the door picture surrounds the step)", () => {
    const s = stage("monster_rooms", "mk-monster-rooms-lg_door");
    const door = inferMapDoor(s.ctx.project, s.ctx.project.maps.map_t!, s.door)!;
    expect({ kind: door.kind, x: door.rect.x, w: door.rect.w }).toEqual({ kind: "double", x: s.door.x - 1, w: 3 });
  });
});
