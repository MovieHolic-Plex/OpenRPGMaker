// 「이 칸이 문·계단 그림인가」는 칩셋이 적어 둔 것으로 읽는다(place/entrances.ts isEntranceArt) — 건물 키트의 입구 부품 · 방 키트의 문·계단 기물 ·
// 표면 계약의 계단과 낱장 문(꼬리표 door·문). 이름표 낱말로 읽던 때는 create_transfer_pair 가 「가문비」 밑 칸에 이은 출구의 트리거를 나무 위로 올렸다
// (2026-11-12 문 그림 읽기 × 테마 표: 86장에서 낱말로만 문인 그림 밑 걷는 칸 663칸, 심은 99건 모두 그림 위로 올라갔다).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { isPassable } from "@/project/collision";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { tilesetSurface } from "@/project/tilesetSurface";
import type { GameMap, Project } from "@/project/types";
import { buildingEntrances, isEntranceArt } from "@/ai/v2/place/entrances";

type Ctx = { project: Project };
type Meta = { label?: string; role?: string } | undefined;
const SLOW = 60_000;

const metaOf = (project: Project, tilesetId: string) => project.tilesets[tilesetId]!.tileMeta as unknown as Meta[];
function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
  const tileset = project.tilesets[tilesetId]!;
  const tile = metaOf(project, tilesetId).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
  expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
  return tile;
}
/** 한 가지 바닥을 깐 12×8 맵 두 장(map_t · map_other)에 윗층 그림 타일을 놓는다. */
function flat(tilesetId: string, ground: RegExp, upper: readonly (readonly [number, number, RegExp])[]): Ctx {
  const ctx: Ctx = { project: createBlankProject() };
  for (const id of ["map_t", "map_other"]) expect(runTool(ctx, "create_map", { id, name: id, width: 12, height: 8, tilesetId }).ok).toBe(true);
  const floor = tileOf(ctx.project, tilesetId, ground, true);
  const maps = { ...ctx.project.maps };
  for (const id of ["map_t", "map_other"]) {
    const map = structuredClone(maps[id]!);
    for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
    if (id === "map_t") for (const [x, y, label] of upper) (map.upperTiles as number[])[y * map.width + x] = tileOf(ctx.project, tilesetId, label);
    maps[id] = map;
  }
  ctx.project = { ...ctx.project, maps, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project;
  return ctx;
}
const added = (before: GameMap, after: GameMap) => after.events.filter((e) => !before.events.some((b) => b.id === e.id));

describe("door art is what the chipset declares", () => {
  it("reads a loose door tile by the baker's tag, not by a 「문」 in a label", () => {
    const project = createBlankProject();
    const doors = tilesetSurface(project.tilesets.beodeul_city).doors;
    expect(doors.has(tileOf(project, "beodeul_city", /집 문$/u))).toBe(true);
    // 건물 타일은 꼬리표가 문이어도 낱장 문이 아니다 — 건물의 문은 그 키트가 입구 부품으로 적는다(설원 「목책 문」은 기둥·지붕까지 한 덩이다).
    const snow = tilesetSurface(project.tilesets.snow_north).doors;
    expect(snow.has(tileOf(project, "snow_north", /^목책 문/u))).toBe(false);
    expect(snow.has(tileOf(project, "snow_north", /가문비/u))).toBe(false);
  });

  it("a spruce, a steam vent and a gun port are not door art; a kit's stairs are", () => {
    const { project } = flat("snow_north", /^눈밭/u, [[5, 3, /^큰 가문비/u]]);
    expect(isDoorArtCell(project, project.maps.map_t!, 5, 3)).toBe(true);   // 이름표 낱말로는 문
    expect(isEntranceArt(project, project.maps.map_t!, 5, 3)).toBe(false);
    const one = (tilesetId: string, label: RegExp): boolean => {
      const tile = tileOf(project, tilesetId, label);
      const map = { ...project.maps.map_t!, tilesetId, width: 1, height: 1, lowerTiles: [0], upperTiles: [tile], lowerOverlayTiles: [-1], upperOverlayTiles: [-1] } as unknown as GameMap;
      return isEntranceArt(project, map, 0, 0);
    };
    expect(one("atlas_biome_interior", /^증기 구멍/u)).toBe(false);
    expect(one("atlas_biome_interior", /^포문\(열림\)/u)).toBe(false);
    expect(one("atlas_biome_interior", /^서고 사다리/u)).toBe(false);
    expect(one("atlas_biome_interior", /^순간이동 진/u)).toBe(true);   // 방 키트가 드나드는 것(쓰임 travel)이라 적은 기물 — 이름표에는 문 낱말이 없다
  });

  it("a chipset that declares nothing (an uploaded sheet) is still read by its labels", () => {
    const base = createBlankProject();
    const tileset = { ...base.tilesets.snow_north!, id: "uploaded_sheet", structureKits: [], roomKit: undefined, tileMeta: [{ label: "풀밭" }, { label: "나무 문" }] } as unknown as Project["tilesets"][string];
    const project = { ...base, tilesets: { ...base.tilesets, uploaded_sheet: tileset } } as Project;
    const map = { ...base.maps[base.startMapId]!, tilesetId: "uploaded_sheet", width: 2, height: 1, lowerTiles: [0, 0], upperTiles: [1, -1], lowerOverlayTiles: [-1, -1], upperOverlayTiles: [-1, -1] } as unknown as GameMap;
    expect(isEntranceArt(project, map, 0, 0)).toBe(true);
    expect(isEntranceArt(project, map, 1, 0)).toBe(false);
  });
});

describe("create_transfer_pair puts the trigger on declared door art only", () => {
  it("an exit linked on the cell under a spruce stays on that cell", () => {
    const ctx = flat("snow_north", /^눈밭/u, [[5, 3, /^큰 가문비/u]]);
    const before = ctx.project.maps.map_t!;
    const r = runTool(ctx, "create_transfer_pair", { a: { mapId: "map_t", x: 5, y: 4 }, b: { mapId: "map_other", x: 6, y: 6 } });
    expect(r.ok, r.summary).toBe(true);
    const gate = added(before, ctx.project.maps.map_t!)[0]!;
    // 전에는 (5,3) — 나무 칸에 부딪혀야 넘어갔다.
    expect({ x: gate.x, y: gate.y }).toEqual({ x: 5, y: 4 });
  });

  it("an entrance linked on the cell in front of a building's door goes onto the door", () => {
    const ctx: Ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_d", name: "바자르", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_in", name: "집 안", width: 12, height: 10, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_d", kind: "bazaar", seed: 1 }).ok).toBe(true);
    const built = ctx.project.maps.map_d!;
    const door = buildingEntrances(ctx.project, built).find((d) => !built.events.some((e) => Math.abs(e.x - d.x) <= 1 && Math.abs(e.y - d.y) <= 2))!;
    expect(door).toBeDefined();
    const inside = ctx.project.maps.map_in!;
    let spot = { x: 1, y: 1 };
    for (let y = inside.height - 2; y > 0; y--) for (let x = 1; x < inside.width - 1; x++) if (isPassable(ctx.project, inside, x, y)) { spot = { x, y }; y = 0; break; }
    const r = runTool(ctx, "create_transfer_pair", { a: { mapId: "map_d", x: door.front.x, y: door.front.y }, b: { mapId: "map_in", x: spot.x, y: spot.y } });
    expect(r.ok, r.summary).toBe(true);
    expect(added(built, ctx.project.maps.map_d!).some((e) => e.x === door.x && e.y === door.y)).toBe(true);
  }, SLOW);
});
