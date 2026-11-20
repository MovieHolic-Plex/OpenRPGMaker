import { readdirSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { buildStampObjectIndex } from "@/ai/stampObjects";
import { BEODEUL_OBJECT_IMAGE_ASSETS, BEODEUL_OBJECT_KIT_PREFIX, BEODEUL_OBJECT_TILE_SIZE, BEODEUL_PLACEABLE_OBJECTS, parseBeodeulObjectCatalog } from "@/assets/beodeulPlaceableObjects";
import { bundledChipsetFrameCount, bundledChipsetTileSize, bundledChipsetTilesPerRow, findBundledImageAsset } from "@/assets/bundled";
import { comboBrushPlacement } from "@/editor/comboBrush";
import { filterProps, recommendProps } from "@/editor/propRecommendations";
import { runTool } from "@/editor/tools/toolRunner";
import { bundledTilesetDiffForTest, restoreBundledTilesetDiffs } from "@/project/bundledTilesetDiff";
import { isPassable } from "@/project/collision";
import { createBeodeulCityTileset } from "@/project/defaults/beodeulCity";
import { createBlankProject } from "@/project/defaults/blankProject";
import { defaultTileset } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { ensureBeodeulPlaceableObjects, upgradeBeodeulCrateStackGrafts } from "@/project/defaults/beodeulPlaceableObjects";
import { deserialize, serialize } from "@/project/io";
import { OBJECT_SPEC_PASSAGE_CHARS, validateObjectSpec } from "@/project/objectSpec";
import { passageMarkForTile } from "@/project/tilesetPassage";
import type { TilesetDef } from "@/project/types";
import { collectWebExportAssets } from "@/project/webExportAssets";

const folder = new URL("../public/assets/beodeul-objects/", import.meta.url);
const kitId = (id: string) => BEODEUL_OBJECT_KIT_PREFIX + id;

describe("Beodeul object catalog schema", () => {
  const object = {
    id: "test_tree", nameKo: "시험 나무", category: "nature", group: "nature",
    sourceFile: "test_tree.png", widthPx: 20, heightPx: 16, widthTiles: 2, heightTiles: 1,
    footprint: ["XX"], tags: ["나무", "test"],
  };
  const piece = { ...object, id: "test_fence", nameKo: "시험 울타리", category: "structure",
    sourceFile: "test_fence.png", group: "structures", set: { id: "fence", piece: "end_e" } };
  const groups = [
    { id: "structures", labelKo: "구조물 세트", order: 20 },
    { id: "nature", labelKo: "자연", order: 10 },
  ];
  const manifest = { groups, sets: [{ id: "fence", role: "fence", requiredPieces: ["end_e"] }] };

  it("loads new groups and sets from data and sorts group headings by order", () => {
    const parsed = parseBeodeulObjectCatalog([object, piece], manifest);
    expect(parsed.objects).toEqual([object, piece]);
    expect(parsed.groups.map(group => group.id)).toEqual(["nature", "structures"]);
    expect(parsed.setsById.get("fence")?.role).toBe("fence");
  });

  it.each([
    [{ tags: ["  "] }, /tags/u],
    [{ nameKo: "test tree" }, /nameKo/u],
    [{ group: "unknown" }, /unknown Beodeul object group/u],
    [{ sourceFile: "wrong_tree.png" }, /sourceFile must match/u],
    [{ widthTiles: 1 }, /tile size does not match/u],
    [{ footprint: ["X"] }, /footprint must match/u],
    [{ footprint: [" X", "XX"] }, /footprint must match/u],
    [{ footprint: ["X?"] }, /footprint/u],
    [{ footprint: ["  "] }, /occupied cell/u],
  ])("rejects an invalid entry (%j)", (patch, error) => {
    expect(() => parseBeodeulObjectCatalog([{ ...object, ...patch }], { groups, sets: [] })).toThrow(error);
  });

  it("rejects duplicate objects and broken set membership", () => {
    expect(() => parseBeodeulObjectCatalog([object, object, piece], manifest)).toThrow(/Duplicate Beodeul object id/u);
    expect(() => parseBeodeulObjectCatalog([object], manifest)).toThrow(/fence: missing required set pieces: end_e/u);
    expect(() => parseBeodeulObjectCatalog([{ ...piece, set: { id: "unknown", piece: "end_e" } }], manifest)).toThrow(/unknown Beodeul object set/u);
    expect(() => parseBeodeulObjectCatalog([piece, {
      ...piece, id: "test_fence_variant", sourceFile: "test_fence_variant.png",
    }], manifest)).toThrow(/duplicate piece fence\/end_e/u);
  });
});

describe("bundled Beodeul placeable objects", () => {
  it("has a one-to-one match between the catalog entries and the PNGs on disk", () => {
    const ids = BEODEUL_PLACEABLE_OBJECTS.map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    const pngs = readdirSync(folder).filter(name => /\.png$/iu.test(name));
    expect(pngs.sort()).toEqual(ids.map(id => `${id}.png`).sort());
  });

  it("describes the source PNG's dimensions, 16px grid coverage, and occupied cells", () => {
    for (const object of BEODEUL_PLACEABLE_OBJECTS) {
      const { id, widthPx, heightPx, widthTiles, heightTiles, footprint } = object;
      const tileSize = BEODEUL_OBJECT_TILE_SIZE;
      const image = PNG.sync.read(readFileSync(new URL(`${id}.png`, folder)));
      expect([image.width, image.height]).toEqual([widthPx, heightPx]);
      expect([widthTiles, heightTiles]).toEqual([Math.ceil(widthPx / tileSize), Math.ceil(heightPx / tileSize)]);
      expect(footprint).toHaveLength(heightTiles);
      const drawn = new Set<number>();
      let hasTransparency = false;
      for (let pixel = 0; pixel < image.width * image.height; pixel++) {
        if (image.data[pixel * 4 + 3] === 0) hasTransparency = true;
        else {
          const x = Math.floor((pixel % image.width) / tileSize);
          const y = Math.floor(pixel / (image.width * tileSize));
          drawn.add(y * widthTiles + x);
        }
      }
      expect(hasTransparency).toBe(true);
      expect(drawn.size).toBeGreaterThan(0);
      for (const [y, row] of footprint.entries()) {
        expect(row).toHaveLength(widthTiles);
        for (const [x, mark] of [...row].entries()) {
          expect(OBJECT_SPEC_PASSAGE_CHARS).toContain(mark);
          expect(drawn.has(y * widthTiles + x), `${id} (${x},${y})`).toBe(mark !== " ");
        }
      }
    }
  });

  it("offers every object as a default map brush, with the correct sprite cells and passage", () => {
    const tileset = defaultTileset();
    const width = Math.max(...BEODEUL_PLACEABLE_OBJECTS.map(object => object.widthTiles));
    const height = Math.max(...BEODEUL_PLACEABLE_OBJECTS.map(object => object.heightTiles));
    const map = createBlankMap("버들항", width, height, tileset.id);
    const entries = filterProps(recommendProps(map, tileset), undefined, "버들항 기본 기물");
    const grafts = new Map(tileset.tileGrafts?.map(graft => [graft.targetTile, graft]));
    expect(new Set(entries.map(({ choice }) => choice.id))).toEqual(new Set(BEODEUL_PLACEABLE_OBJECTS.map(({ id }) => kitId(id))));
    for (const [index, object] of BEODEUL_PLACEABLE_OBJECTS.entries()) {
      const asset = BEODEUL_OBJECT_IMAGE_ASSETS[index]!;
      expect(findBundledImageAsset(asset.textureKey)).toEqual(asset);
      expect(bundledChipsetTileSize(asset.textureKey)).toBe(BEODEUL_OBJECT_TILE_SIZE);
      expect(bundledChipsetTilesPerRow(asset.textureKey)).toBe(object.widthTiles);
      expect(bundledChipsetFrameCount(asset.textureKey)).toBe(object.widthTiles * object.heightTiles);
      const kit = tileset.structureKits?.find(kit => kit.id === kitId(object.id));
      expect(validateObjectSpec(kit?.spec).ok).toBe(true);
      if (object.category === "indoor") expect(kit?.spec?.category).toBe("furniture");
      if (object.category === "nature") expect(kit?.spec?.category).toBe("nature");
      expect(kit?.ai?.growthAxis).toBe(object.growthAxis);
      const { stamp } = entries.find(entry => entry.choice.id === kitId(object.id))!.choice;
      expect([stamp.width, stamp.height]).toEqual([object.widthTiles, object.heightTiles]);
      expect(stamp.cells).toHaveLength(object.footprint.join("").replaceAll(" ", "").length);
      const anchor = { dx: Math.floor(object.widthTiles / 2), dy: object.heightTiles - 1 };
      expect(stamp.anchor).toEqual(anchor);
      const click = { x: anchor.dx, y: anchor.dy };
      const placement = comboBrushPlacement({ bounds: map, stamp, ...click });
      expect(placement.cells.every(({ cell, x, y }) => x === click.x + cell.dx - anchor.dx
        && y === click.y + cell.dy - anchor.dy)).toBe(true);
      for (const { dx, dy, tile, layer } of stamp.cells) {
        const mark = object.footprint[dy]![dx];
        expect(layer).toBe("upper");
        expect(grafts.get(tile)).toMatchObject({ sourceChipset: asset.textureKey, sourceTile: dy * object.widthTiles + dx });
        expect(passageMarkForTile(tileset, tile)).toBe(mark === "X" ? "x" : mark === "*" ? "star" : "o");
      }
    }
    expect(ensureBeodeulPlaceableObjects(tileset)).toBe(false);
  });

  it("reuses the four painted crate slots when upgrading a two-column crate to three columns", () => {
    const legacy = createBeodeulCityTileset("pre-ingest");
    const crate = legacy.structureKits!.find(kit => kit.id === kitId("crate_stack"));
    if (crate?.kind !== "section") throw new Error("Missing crate kit");
    const textureKey = "tex_beodeul_object_crate_stack";
    expect(crate.width).toBe(2);
    const oldRows = crate.rows.map(row => row.upperTiles!);
    const view = bundledTilesetDiffForTest.diff(legacy, legacy);
    const wire = { tilesets: { [legacy.id]: structuredClone(view) } };
    expect(restoreBundledTilesetDiffs(wire).restored).toBe(1);
    const tileset = wire.tilesets[legacy.id] as unknown as TilesetDef;
    expect(tileset.passability).toHaveLength(legacy.count);
    expect(tileset.structureKits).toHaveLength(legacy.structureKits!.length);

    const copied = {
      ...tileset,
      structureKits: [],
      tileGrafts: tileset.tileGrafts!.filter(graft => graft.sourceChipset === textureKey),
    };
    expect(upgradeBeodeulCrateStackGrafts(copied)).toBe(true);
    expect(copied.tileGrafts.map(graft => graft.sourceTile)).toEqual([0, 1, 3, 4]);
    expect(upgradeBeodeulCrateStackGrafts(copied)).toBe(false);

    expect(upgradeBeodeulCrateStackGrafts(tileset)).toBe(true);
    expect(ensureBeodeulPlaceableObjects(tileset)).toBe(true);
    const updated = tileset.structureKits!.find(kit => kit.id === kitId("crate_stack"));
    if (updated?.kind !== "section") throw new Error("Missing upgraded crate kit");
    expect(updated.width).toBe(3);
    expect(updated.rows.map(row => row.upperTiles!.slice(0, 2))).toEqual(oldRows);
    expect(oldRows[1]!.map(tile => passageMarkForTile(tileset, tile))).toEqual(["x", "x"]);
    expect(upgradeBeodeulCrateStackGrafts(tileset)).toBe(false);
  });

  function projectWithObjectTileset() {
    const project = createBlankProject();
    const map = Object.values(project.maps)[0]!;
    project.tilesets = { [map.tilesetId]: project.tilesets[map.tilesetId]! };
    return { ctx: { project }, mapId: map.id, tilesetId: map.tilesetId };
  }

  it("lists the full catalog through both assistant tools and the placement planner", () => {
    const { ctx, mapId, tilesetId } = projectWithObjectTileset();
    const query = "버들항 기본 기물";
    const expected = BEODEUL_PLACEABLE_OBJECTS.map(object => ({
      id: kitId(object.id), width: object.widthTiles, height: object.heightTiles,
      tags: expect.arrayContaining([...object.tags]),
    }));
    const listed = runTool(ctx, "list_tileset_objects", { mapId, query });
    expect(listed.ok, listed.summary).toBe(true);
    expect(listed.data).toMatchObject({ objects: expected });
    const plannerIndex = new Map(buildStampObjectIndex(ctx.project.tilesets[tilesetId]).map(entry => [entry.id, entry]));
    for (const object of BEODEUL_PLACEABLE_OBJECTS) {
      expect(plannerIndex.get(kitId(object.id))).toMatchObject({
        width: object.widthTiles, height: object.heightTiles,
        placement: object.surface ?? "floor", indoor: object.category === "indoor",
      });
    }
    const limit = 200;
    for (let offset = 0; offset < expected.length; offset += limit) {
      const shared = runTool(ctx, "list_spatial_designs", { kind: "object", query, limit, offset });
      expect(shared.ok, shared.summary).toBe(true);
      expect(shared.data).toMatchObject({ shared: { total: expected.length, rows: expected.slice(offset, offset + limit).map(entry => ({
        ...entry, id: `kit:${tilesetId}/${entry.id}`,
      })) } });
    }
  });

  it("preserves stamped collision through serialization and includes the painted asset in web export", () => {
    const { ctx, mapId } = projectWithObjectTileset();
    const object = BEODEUL_PLACEABLE_OBJECTS.find(entry => entry.id === "lantern_post")!;
    const x = 4, y = 4;
    const stamped = runTool(ctx, "stamp_tileset_object", { mapId, objectId: kitId(object.id), at: { x, y } });
    expect(stamped.ok, stamped.summary).toBe(true);
    const painted = ctx.project.maps[mapId]!;
    for (const [dy, row] of object.footprint.entries()) {
      for (const [dx, mark] of [...row].entries()) {
        expect(isPassable(ctx.project, painted, x + dx, y + dy)).toBe(mark !== "X");
      }
    }
    const publicPaths = collectWebExportAssets(ctx.project).flatMap(asset => asset.kind === "public" ? [asset.sourcePath] : []);
    expect(publicPaths).toContain(`assets/beodeul-objects/${object.id}.png`);

    const before = [...painted.upperTiles];
    const reloaded = deserialize(serialize(ctx.project));
    expect(reloaded.maps[mapId]!.upperTiles).toEqual(before);
    for (const [dy, row] of object.footprint.entries()) {
      for (const [dx, mark] of [...row].entries()) {
        expect(isPassable(reloaded, reloaded.maps[mapId]!, x + dx, y + dy)).toBe(mark !== "X");
      }
    }
  }, 60_000);

  it("extends straight dock and hedge sections on their own axes with the intended passage", () => {
    const { ctx } = projectWithObjectTileset();
    const map = Object.values(ctx.project.maps)[0]!;
    const tileset = ctx.project.tilesets[map.tilesetId]!;
    const water = tileset.tileMeta!.findIndex((meta, tile) =>
      meta?.tags?.includes("water") && passageMarkForTile(tileset, tile) === "x");
    expect(water).toBeGreaterThanOrEqual(0);
    const x = 4, y = 4;
    const dock = { mapId: map.id, objectId: kitId("dock_h_straight"), at: { x, y }, repeat: { x: 2 } };
    const refused = runTool(ctx, "stamp_tileset_object", dock);
    expect(refused.ok).toBe(false);
    expect(refused.summary).toContain("물 위");
    for (const dx of [0, 1]) map.lowerTiles[y * map.width + x + dx] = water;
    const placed = runTool(ctx, "stamp_tileset_object", dock);
    expect(placed.ok, placed.summary).toBe(true);
    const hedge = { mapId: map.id, objectId: kitId("hedge_v_straight"), at: { x, y: y + 1 } };
    expect(runTool(ctx, "stamp_tileset_object", { ...hedge, repeat: { x: 2 } }).ok).toBe(false);
    const hedgePlaced = runTool(ctx, "stamp_tileset_object", { ...hedge, repeat: { y: 2 } });
    expect(hedgePlaced.ok, hedgePlaced.summary).toBe(true);
    const painted = ctx.project.maps[map.id]!;
    for (const dx of [0, 1]) expect(isPassable(ctx.project, painted, x + dx, y)).toBe(true);
    for (const dy of [1, 2]) expect(isPassable(ctx.project, painted, x, y + dy)).toBe(false);
  });
});
