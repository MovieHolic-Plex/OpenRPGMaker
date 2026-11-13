// 숲 구성(stand)·풀밭 얼룩(meadow) — 게임마다 다른 숲: 섞인 수종 · 그 수종의 숲 수관 · 숲 바닥 · 열린 바닥의 재질 섞임(2026-11-13 4차).
// 나무 킷의 칸 번호·통행은 그대로이고 그림만 겹친다. 숲 바닥·얼룩은 2층 덧그림이라 걷는 칸이 달라지지 않는다. 겉모습이 없는 게임은 예전 그대로다.
import { describe, expect, it } from "vitest";
import stands from "@/assets/beodeulStands.json";
import sheet from "@/assets/beodeulCitySheet.json";
import { activeTileGrafts, tileGraftsTextureSuffix } from "@/assets/tileGrafts";
import { describeTilesetLook, tilesetLookGrafts, tilesetLookOptions, tilesetLookTableFor } from "@/assets/tilesetLooks";
import { standOverlaySource, tilesetStand, tilesetStandTableFor } from "@/assets/tilesetStands";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { createBlankProject } from "@/project/defaults";
import { chooseTilesetLook } from "@/project/tilesetLook";
import { isPassable } from "@/project/collision";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { deserialize, serialize } from "@/project/io";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project, TilesetLook } from "@/project/types";

const TS = "beodeul_city";
const looks = tilesetLookTableFor(TS)!;
const table = tilesetStandTableFor(TS)!;

function village(look: Partial<TilesetLook> | undefined, key: string | undefined, salt = 250118, theme?: string): { project: Project; map: GameMap } {
  const project = createBlankProject() as Project;
  if (look) project.tilesets[TS]!.look = { textureKey: looks.texture, ...look };
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext;
  const spec = { type: "village", name: "버들 마을", salt, ...(theme ? { hints: { theme } } : {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
  expect(res.ok).toBe(true);
  return { project: ctx.project, map: ctx.project.maps[res.mapIds[0]!]! };
}
const walkGrid = (project: Project, map: GameMap): string => {
  let out = "";
  for (let y = 0; y < map.height; y += 1) for (let x = 0; x < map.width; x += 1) out += isPassable(project, map, x, y) ? "1" : "0";
  return out;
};
const standCells = (project: Project, map: GameMap): number[] => {
  const own = new Set((project.tilesets[TS]!.tileGrafts ?? []).filter((g) => g.sourceChipset === table.texture).map((g) => g.targetTile));
  const cells: number[] = [];
  for (let i = 0; i < map.width * map.height; i += 1) if (own.has(layerTileAt(map, 2, i))) cells.push(i);
  return cells;
};

describe("tileset stands — 게임마다 다른 숲·바닥", () => {
  it("표: 그림판이 번들에 실리고, 숲 구성마다 나무 킷·밑풀 킷·숲 바닥이 실제로 있다", () => {
    expect(BUNDLED_REFERENCE_CHIPSET_ASSETS.some((asset) => asset.textureKey === table.texture)).toBe(true);
    expect(bundledChipsetFrameCount(table.texture)).toBe(stands.count);
    expect(bundledChipsetTilesPerRow(table.texture)).toBe(table.tilesPerRow);
    const tileset = (createBlankProject() as Project).tilesets[TS]!;
    const kits = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit]));
    const meta = tileset.tileMeta as unknown as ({ tags?: string[] } | undefined)[];
    expect(Object.keys(table.stands).length).toBeGreaterThanOrEqual(12);
    for (const [id, stand] of Object.entries(table.stands)) {
      expect(table.overlays[stand.floor]?.role, id).toBe("floor");
      expect(stand.pairs.length % 2).toBe(0);
      for (let i = 0; i < stand.pairs.length; i += 2) {
        expect(stand.pairs[i]!).toBeLessThan(sheet.count);
        expect((meta[stand.pairs[i]!]?.tags ?? []).includes("tree"), `${id} 칸 ${stand.pairs[i]}`).toBe(true);
        expect(stand.pairs[i + 1]!).toBeLessThan(table.count);
      }
      for (const cells of Object.values(stand.sources)) for (let i = 1; i < cells.length; i += 2) expect(cells[i]!).toBeLessThan(table.count);
      // 주 수종·곁 수종·덤불이 다 있고 킷은 모두 그 타일셋의 나무 킷이다
      for (const role of ["dominant", "companion", "shrub"] as const) expect(stand.kits[role]?.length ?? 0, `${id} ${role}`).toBeGreaterThan(0);
      for (const list of Object.values(stand.kits)) for (const kit of list ?? []) expect(kits.has(kit), `${id} ${kit}`).toBe(true);
      expect(stand.under.length).toBeGreaterThan(3);
      for (const kit of stand.under) expect(kits.has(kit), `${id} ${kit}`).toBe(true);
    }
    for (const [id, overlay] of Object.entries(table.overlays)) {
      for (const list of [overlay.cells, overlay.alt]) {
        expect(list.length).toBe(16);
        for (let mask = 1; mask < 16; mask += 1) { expect(list[mask]!, id).toBeGreaterThan(0); expect(list[mask]!).toBeLessThan(table.count); }
      }
      if (overlay.role === "floor") expect((overlay.shadow ?? []).length, id).toBeGreaterThan(20);
    }
    for (const meadow of Object.values(table.meadows)) for (const patch of meadow.patches) expect(table.overlays[patch]?.role).toBe("patch");
    for (const id of [table.worn, table.verge.water, table.verge.road]) expect(table.overlays[id]).toBeDefined();
    expect(kits.has(table.reed)).toBe(true);
    // 덧그림 원본 타일셋: 모두 걷는 ★ 칸이고 이름표가 있다
    const source = standOverlaySource(table);
    const cell = table.overlays[table.worn]!.cells[15]!;
    expect(source.priority[cell]).toBe("upper");
    expect(source.passability[cell]).toEqual({ up: true, down: true, left: true, right: true });
    expect((source.tileMeta as unknown as { label: string }[])[cell]!.label).toContain("덧그림");
  });

  it("고르기: 숲 구성·풀밭 얼룩은 겉모습 갈래로 골라지고, 고른 게임은 둘째 그림판 열쇠를 적는다", () => {
    expect(tilesetLookOptions(looks, "stand")).toEqual(["", ...Object.keys(table.stands)]);
    expect(tilesetLookOptions(looks, "meadow")).toEqual(["", ...Object.keys(table.meadows)]);
    const seen = new Set<string>();
    for (let n = 0; n < 600; n += 1) {
      const look = chooseTilesetLook(looks, JSON.stringify(["project", `stand-${n}`]));
      seen.add(look?.stand ?? "");
      if (look?.stand || look?.meadow) expect(look.standKey).toBe(table.texture); else expect(look?.standKey).toBeUndefined();
    }
    expect(seen.size).toBe(Object.keys(table.stands).length + 1);
    const project = createBlankProject() as Project;
    project.tilesets[TS]!.look = { textureKey: looks.texture, stand: "oakwood", meadow: "flowers", standKey: table.texture };
    expect(deserialize(serialize(project)).tilesets[TS]!.look).toEqual(project.tilesets[TS]!.look);
    expect(describeTilesetLook(TS, { textureKey: looks.texture, trees: "birch", stand: "oakwood" })).toBe(table.stands.oakwood!.label);
  });

  it("그리는 이식 목록: 숲 구성을 고르면 나무 킷 칸·숲 수관 칸이 숲 그림판 그림으로 겹치고, 수종 하나(trees)는 겹치지 않는다", () => {
    const tileset = (createBlankProject() as Project).tilesets[TS]!;
    const plain = activeTileGrafts(tileset);
    expect(plain.some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    const stand = tilesetStand(TS, "oakwood")!;
    const withStand = { ...tileset, look: { textureKey: looks.texture, trees: "birch", stand: "oakwood" } };
    const drawn = tilesetLookGrafts(withStand);
    expect(drawn.length).toBeGreaterThanOrEqual(stand.pairs.length / 2);
    expect(drawn.every((graft) => graft.sourceChipset === table.texture)).toBe(true);
    expect(drawn.find((graft) => graft.targetTile === stand.pairs[0])!.sourceTile).toBe(stand.pairs[1]);
    expect(tileGraftsTextureSuffix(withStand)).not.toBe(tileGraftsTextureSuffix(tileset));
    expect(tileGraftsTextureSuffix({ ...withStand, look: { ...withStand.look, stand: "pinewood" } })).not.toBe(tileGraftsTextureSuffix(withStand));
    // 표에 없는 이름·풀밭 얼룩만 고른 look 은 그림을 겹치지 않는다(얼룩은 맵의 2층 칸이다)
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: looks.texture, stand: "no-such-stand" } })).toEqual([]);
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: looks.texture, meadow: "flowers" } })).toEqual([]);
  });

  it("마을 짓기: 숲 구성을 고른 게임은 여러 수종·여러 크기의 나무가 서고, 숲 바닥·얼룩은 2층에만 깔려 걷는 칸이 그대로다", () => {
    for (const theme of [undefined, "coast"]) {
      const { project, map } = village({ stand: "oakwood", meadow: "flowers", woods: "clumps", standKey: table.texture }, JSON.stringify(["project", "stand-village"]), 250118, theme);
      const tileset = project.tilesets[TS]!;
      const stand = tilesetStand(TS, "oakwood")!;
      // 놓인 나무 칸이 주 수종·곁 수종·덤불 킷에 고루 걸친다
      const kits = new Map((tileset.structureKits ?? []).map((kit) => [kit.id, kit]));
      const placed = new Set<number>();
      for (let i = 0; i < map.width * map.height; i += 1) { const t = layerTileAt(map, 3, i); if (t >= 0) placed.add(t); }
      const usedKits = (role: "dominant" | "companion" | "shrub"): string[] => (stand.kits[role] ?? []).filter((id) => (kits.get(id)!.rows[0]!.upperTiles ?? []).some((t) => placed.has(t)));
      expect(usedKits("dominant").length).toBeGreaterThan(0);
      expect(usedKits("companion").length).toBeGreaterThan(0);
      expect(usedKits("shrub").length).toBeGreaterThan(1);
      const sizes = new Set([...usedKits("dominant"), ...usedKits("companion"), ...usedKits("shrub")].map((id) => `${kits.get(id)!.width}x${kits.get(id)!.height}`));
      expect(sizes.size).toBeGreaterThanOrEqual(3);
      // 덧그림: 2층에만, 숲 바닥과 얼룩이 둘 다 깔린다
      const cells = standCells(project, map);
      expect(cells.length).toBeGreaterThan(40);
      const labels = new Set(cells.map((i) => (tileset.tileMeta as unknown as { label: string }[])[layerTileAt(map, 2, i)]!.label.split("(")[0]));
      expect([...labels].sort()).toEqual(["숲 바닥 덧그림", "풀밭 바닥 덧그림"]);
      for (const i of cells) expect(tileset.priority[layerTileAt(map, 2, i)]).toBe("upper");
      // 덧그림을 걷어 내도 걷는 칸은 한 칸도 달라지지 않는다
      const before = walkGrid(project, map);
      const bare = structuredClone(map);
      for (const i of cells) setLayerTileAt(bare, 2, i, -1);
      expect(walkGrid(project, bare)).toBe(before);
      // 이벤트 칸·경사로에는 깔지 않는다
      const on = new Set(cells);
      for (const event of map.events) expect(on.has(event.y * map.width + event.x)).toBe(false);
    }
  }, 240_000);

  it("겉모습이 없는 게임·숲 구성 없는 옛 겉모습 게임에는 숲 그림판 칸이 하나도 없다", () => {
    for (const look of [undefined, { surface: "steppe", trees: "birch", woods: "wall" }]) {
      const { project, map } = village(look, look ? JSON.stringify(["project", "old-look"]) : undefined);
      expect(standCells(project, map)).toEqual([]);
      expect((project.tilesets[TS]!.tileGrafts ?? []).some((graft) => graft.sourceChipset === table.texture)).toBe(false);
      expect(activeTileGrafts(project.tilesets[TS]!).some((graft) => graft.sourceChipset === table.texture)).toBe(false);
    }
  }, 240_000);
});
