// 풀 결(look.grain) — 기본 풀 바닥(737) 한 칸이 열린 땅을 덮던 것을 푸는 2층 덧그림(2026-11-14 «기본 바닥타일인 풀 타일들도 좀 다양하게»).
// 1층 칸 번호·3층 물체·이벤트·통행은 그대로여야 하고, 겉모습에 grain 이 없는 게임(옛 게임)에는 한 칸도 깔리지 않아야 한다.
import { describe, expect, it } from "vitest";
import { tilesetLookOptions, tilesetLookTableFor } from "@/assets/tilesetLooks";
import { standGrainTile, standGroundCoverTile, standOverlaySource, tilesetStandTableFor } from "@/assets/tilesetStands";
import { createBlankProject } from "@/project/defaults";
import { chooseTilesetLook } from "@/project/tilesetLook";
import { runTool } from "@/editor/tools/toolRunner";
import { isPassable } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { applyRuntimeMapOverrides } from "@/project/runtimeMap";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { deserialize, serialize } from "@/project/io";
import { v2ToolPool } from "@/ai/v2/request/toolGroups";
import { V2_TOOL_EN } from "@/ai/v2/tools/toolTextEn";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project, TilesetLook } from "@/project/types";

const TS = "beodeul_city", GRASS = 737;
const looks = tilesetLookTableFor(TS)!;
const table = tilesetStandTableFor(TS)!;
const BASE = { stand: "oakwood", meadow: "flowers", woods: "clumps", standKey: table.texture } as const;

function village(look: Partial<TilesetLook>): { project: Project; map: GameMap } {
  const project = createBlankProject() as Project;
  project.tilesets[TS]!.look = { textureKey: looks.texture, ...look };
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, lookKey: JSON.stringify(["project", "grain-village"]) } as ToolContext;
  const spec = { type: "village", name: "버들 마을", salt: 250118 } as PlaceSpec;
  const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
  expect(res.ok).toBe(true);
  return { project: ctx.project, map: ctx.project.maps[res.mapIds[0]!]! };
}
const walkGrid = (project: Project, map: GameMap): string => {
  let out = "";
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) out += isPassable(project, map, x, y) ? "1" : "0";
  return out;
};
const layer2 = (map: GameMap): number[] => Array.from({ length: map.width * map.height }, (_, i) => layerTileAt(map, 2, i));
const grainCells = (project: Project, map: GameMap): number[] => {
  const grain = standGrainTile(project.tilesets[map.tilesetId]);
  return layer2(map).flatMap((tile, i) => (grain(tile) ? [i] : []));
};

describe("버들항 풀 결 — 기본 풀 바닥의 변형", () => {
  it("표: 섞음 넷, 바닥 재질마다 통칸 변형·짙은 결·옅은 결·풀 무늬 칸이 그림판 안에 있고 모두 걷는 ★ 덧그림이다", () => {
    expect(Object.keys(table.grains ?? {})).toEqual(["tufted", "flowery", "drift", "stony"]);
    const families = table.grain!;
    expect(Object.keys(families)).toEqual(expect.arrayContaining(["grass", "ground-dry", "ground-clover", "ground-earth", "ground-sand", "ground-terra"]));
    const source = standOverlaySource(table);
    const meta = source.tileMeta as unknown as { label: string }[];
    const opaque = new Set<number>();
    for (const [id, family] of Object.entries(families)) {
      expect(family.alt.length, id).toBe(4);
      const cells = [...family.alt];
      for (const tone of [family.deep, family.pale]) {
        expect(tone.cells.length).toBe(16); expect(tone.alt.length).toBe(16); expect(tone.fill.length).toBe(3);
        for (let mask = 1; mask < 16; mask += 1) cells.push(tone.cells[mask]!, tone.alt[mask]!);
        cells.push(...tone.fill, ...Object.values(tone.sprigs).flat());
        // 결 속에 얹는 풀 무늬는 그 바닥에 두는 종류와 같다
        expect(Object.keys(tone.sprigs).sort()).toEqual(Object.keys(family.sprigs).sort());
      }
      for (const cell of cells) { expect(opaque.has(cell), `${id} ${cell}`).toBe(false); opaque.add(cell); }
      for (const cell of [...cells, ...Object.values(family.sprigs).flat()]) {
        expect(cell).toBeGreaterThan(0); expect(cell).toBeLessThan(table.count);
        expect(source.priority[cell]).toBe("upper");
        expect(source.passability[cell]).toEqual({ up: true, down: true, left: true, right: true });
        expect(meta[cell]!.label).toContain("풀밭 바닥 덧그림(");
      }
      // 바닥마다 풀 포기는 늘 있고, 섞음이 무게를 준 종류 가운데 그 바닥에 있는 것이 하나 이상이다
      expect(family.sprigs.tuft!.length).toBeGreaterThan(1);
      for (const mix of Object.values(table.grains!)) expect(Object.keys(mix.sprigs).some((kind) => family.sprigs[kind]?.length)).toBe(true);
    }
    // 이름: 풀밭 변형마다 사람이 읽는 이름이 있다
    for (const kind of ["alt", "deep", "pale", ...Object.keys(families.grass!.sprigs)]) expect(table.grainLabels?.[kind], kind).toBeTruthy();
  });

  it("고르기: 새 게임은 늘 풀 결 섞음 하나를 받고(원래 모습 선택지 없음), 게임마다 갈리며, 저장을 지나도 남는다", () => {
    expect(tilesetLookOptions(looks, "grain")).toEqual(Object.keys(table.grains!));
    const seen = new Map<string, number>();
    for (let n = 0; n < 400; n += 1) {
      const key = JSON.stringify(["project", `grain-${n}`]);
      const look = chooseTilesetLook(looks, key)!;
      expect(table.grains![look.grain ?? ""], key).toBeDefined();
      expect(look.standKey).toBe(table.texture);
      expect(chooseTilesetLook(looks, key)).toEqual(look);
      seen.set(look.grain!, (seen.get(look.grain!) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(Object.keys(table.grains!).sort());
    for (const count of seen.values()) expect(count).toBeGreaterThan(60);
    const project = createBlankProject() as Project;
    project.tilesets[TS]!.look = { textureKey: looks.texture, grain: "flowery", standKey: table.texture };
    expect(deserialize(serialize(project)).tilesets[TS]!.look).toEqual(project.tilesets[TS]!.look);
  });

  it("마을 짓기: 풀 결은 풀밭(737)의 빈 2층에만 깔리고, 1층·3층·4층·이벤트·통행과 다른 2층 칸은 결 없는 판과 한 칸도 다르지 않다", () => {
    const plain = village(BASE);
    // 겉모습에 grain 이 없는 게임(옛 게임)에는 한 칸도 없다
    expect(grainCells(plain.project, plain.map)).toEqual([]);
    const walk = walkGrid(plain.project, plain.map), before2 = layer2(plain.map);
    for (const mix of ["tufted", "flowery"]) {
      const { project, map } = village({ ...BASE, grain: mix });
      expect(Array.from(map.lowerTiles)).toEqual(Array.from(plain.map.lowerTiles));
      expect(Array.from(map.upperTiles)).toEqual(Array.from(plain.map.upperTiles));
      expect(map.upperOverlayTiles).toEqual(plain.map.upperOverlayTiles);
      expect(map.events).toEqual(plain.map.events);
      expect(walkGrid(project, map)).toBe(walk);
      const cells = grainCells(project, map), on = new Set(cells), after2 = layer2(map);
      const open = Array.from(map.lowerTiles).filter((tile, i) => tile === GRASS && (map.upperTiles[i] ?? -1) < 0).length;
      // 열린 풀밭의 넉넉한 몫이 맨 칸이 아니다(통칸 변형 포함)
      expect(cells.length / open, mix).toBeGreaterThan(0.3);
      for (let i = 0; i < after2.length; i += 1) {
        if (!on.has(i)) { expect(after2[i], `${mix} 칸 ${i}`).toBe(before2[i]); continue; }
        expect(map.lowerTiles[i]).toBe(GRASS);
        expect(before2[i]).toBe(-1);
        expect(project.tilesets[TS]!.priority[after2[i]!]).toBe("upper");
      }
      for (const event of map.events) expect(on.has(event.y * map.width + event.x)).toBe(false);
      // 짙은·옅은 결은 띠·덩이로 선다 — 이웃에 같은 결이 둘 미만인 외톨이 칸은 드물다(흩뿌림이 아니다)
      const grain = standGrainTile(project.tilesets[TS]);
      const tone = cells.filter((i) => grain(after2[i]!) === 2), toned = new Set(tone);
      expect(tone.length, mix).toBeGreaterThan(60);
      const lonely = tone.filter((i) => {
        const x = i % map.width, y = Math.floor(i / map.width);
        let near = 0;
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx, ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && toned.has(ny * map.width + nx)) near += 1;
        }
        return near < 2;
      });
      expect(lonely.length / tone.length, mix).toBeLessThan(0.08);
    }
  }, 360_000);

  it("도구 lay_beodeul_grass: 고른 자리에 덩이를 깔고 걷으며, 바닥을 바꾸면 그 칸의 결이 같이 걷힌다", () => {
    const { project, map } = village(BASE);
    const ctx = { project, currentMapId: map.id } as ToolContext;
    const lower = Array.from(map.lowerTiles), walk = walkGrid(project, map), before2 = layer2(map);
    // 빈 풀밭 6×3 자리
    const free = (i: number): boolean => map.lowerTiles[i] === GRASS && [2, 3, 4].every((layer) => layerTileAt(map, layer as 2 | 3 | 4, i) < 0) && !map.events.some((e) => e.y * map.width + e.x === i);
    let area: { x: number; y: number; w: number; h: number } | undefined;
    for (let y = 0; y + 3 <= map.height && !area; y += 1) for (let x = 0; x + 6 <= map.width && !area; x += 1) {
      let ok = true;
      for (let dy = 0; dy < 3 && ok; dy += 1) for (let dx = 0; dx < 6 && ok; dx += 1) ok = free((y + dy) * map.width + x + dx);
      if (ok) area = { x, y, w: 6, h: 3 };
    }
    expect(area).toBeDefined();
    const noArea = runTool(ctx, "lay_beodeul_grass", { mapId: map.id, kind: "tall" });
    expect(noArea.ok).toBe(false);
    const laid = runTool(ctx, "lay_beodeul_grass", { mapId: map.id, kind: "tall", area });
    expect(laid.ok, laid.summary).toBe(true);
    let now = ctx.project.maps[map.id]!;
    const cells = grainCells(ctx.project, now);
    expect(cells.length).toBeGreaterThan(6);
    for (const i of cells) { const x = i % now.width, y = Math.floor(i / now.width); expect(x >= area!.x && x < area!.x + 6 && y >= area!.y && y < area!.y + 3).toBe(true); }
    expect(Array.from(now.lowerTiles)).toEqual(lower);
    expect(walkGrid(ctx.project, now)).toBe(walk);
    const flowers = runTool(ctx, "lay_beodeul_grass", { mapId: map.id, kind: "flowers", area });
    expect(flowers.ok, flowers.summary).toBe(true);
    // 바닥을 길로 바꾸면 그 칸의 결은 걷힌다(통칸 결이 새 바닥을 가리지 않는다)
    now = ctx.project.maps[map.id]!;
    const at = grainCells(ctx.project, now)[0]!;
    const meta = project.tilesets[TS]!.tileMeta as unknown as ({ tags?: string[] } | undefined)[];
    const road = Array.from(now.lowerTiles).find((tile) => (meta[tile]?.tags ?? []).includes("road"))!;
    const painted = runTool(ctx, "paint_tiles", { mapId: map.id, layer: "1", mode: "cells", tile: road, cells: [{ x: at % now.width, y: Math.floor(at / now.width) }] });
    expect(painted.ok, painted.summary).toBe(true);
    now = ctx.project.maps[map.id]!;
    expect(now.lowerTiles[at]).not.toBe(GRASS);
    expect(layerTileAt(now, 2, at)).toBe(-1);
    // 실행 중 이벤트가 바닥 칸을 바꿀 때도 같다
    const other = grainCells(ctx.project, now)[0]!;
    const live = structuredClone(now);
    applyRuntimeMapOverrides(live, { mapOverrides: { [map.id]: { lower: { [other]: road }, upper: {} } } }, standGroundCoverTile(ctx.project.tilesets[TS]));
    expect(layerTileAt(live, 2, other)).toBe(-1);
    // 맵 전체 섞음을 깔았다가 걷으면 2층은 처음과 같다(바꾼 한 칸 빼고)
    const mixed = runTool(ctx, "lay_beodeul_grass", { mapId: map.id, kind: "mix", mix: "drift" });
    expect(mixed.ok, mixed.summary).toBe(true);
    expect(grainCells(ctx.project, ctx.project.maps[map.id]!).length).toBeGreaterThan(100);
    expect(walkGrid(ctx.project, ctx.project.maps[map.id]!).split("").filter((v, i) => v !== walk[i]).length).toBeLessThanOrEqual(1);
    const cleared = runTool(ctx, "lay_beodeul_grass", { mapId: map.id, kind: "clear" });
    expect(cleared.ok, cleared.summary).toBe(true);
    now = ctx.project.maps[map.id]!;
    expect(grainCells(ctx.project, now)).toEqual([]);
    expect(layer2(now).filter((tile, i) => i !== at && tile !== before2[i])).toEqual([]);
  }, 360_000);

  it("조수: 도구가 v2 풀에 있고 영어 설명에 한글이 없다", () => {
    expect(v2ToolPool()).toContain("lay_beodeul_grass");
    const text = V2_TOOL_EN.lay_beodeul_grass!;
    expect(text.d.length).toBeGreaterThan(80);
    expect(/[가-힣]/u.test(`${text.d}${Object.values(text.p ?? {}).join("")}`)).toBe(false);
  });
});
