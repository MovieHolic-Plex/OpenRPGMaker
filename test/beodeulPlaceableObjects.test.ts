import { readdirSync, readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { buildStampObjectIndex } from "@/ai/stampObjects";
import { BEODEUL_OBJECT_CATEGORIES, BEODEUL_OBJECT_IMAGE_ASSETS, BEODEUL_OBJECT_KIT_PREFIX, BEODEUL_OBJECT_TILE_SIZE, BEODEUL_PLACEABLE_OBJECTS } from "@/assets/beodeulPlaceableObjects";
import { bundledChipsetFrameCount, bundledChipsetTileSize, bundledChipsetTilesPerRow, findBundledImageAsset } from "@/assets/bundled";
import { comboBrushPlacement } from "@/editor/comboBrush";
import { filterProps, recommendProps } from "@/editor/propRecommendations";
import { runTool } from "@/editor/tools/toolRunner";
import { isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults/blankProject";
import { defaultTileset, ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { ensureBeodeulPlaceableObjects } from "@/project/defaults/beodeulPlaceableObjects";
import { deserialize, serialize } from "@/project/io";
import { OBJECT_SPEC_PASSAGE_CHARS, validateObjectSpec } from "@/project/objectSpec";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { prepareWebExport } from "@/project/webExport";

const folder = new URL("../public/assets/beodeul-objects/", import.meta.url);
const kitId = (id: string) => BEODEUL_OBJECT_KIT_PREFIX + id;

describe("bundled Beodeul placeable objects", () => {
  it("has a one-to-one match between the catalog entries and the PNGs on disk", () => {
    const ids = BEODEUL_PLACEABLE_OBJECTS.map(({ id }) => id);
    expect(ids.length).toBeGreaterThan(0);
    const pngs = readdirSync(folder).filter(name => /\.png$/iu.test(name));
    expect(pngs.sort()).toEqual(ids.map(id => `${id}.png`).sort());
  });

  it("describes the source PNG's dimensions, 16px grid coverage, and occupied cells", () => {
    for (const object of BEODEUL_PLACEABLE_OBJECTS) {
      const { id, nameKo, sourceFile, widthPx, heightPx, widthTiles, heightTiles, footprint, tags } = object;
      expect(id).toMatch(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u);
      expect(id).not.toMatch(/_(?:[rv][23])$/u);
      expect(sourceFile.replace(/(?:_(?:[rv][23]))?\.png$/u, "")).toBe(id);
      expect(nameKo).toMatch(/[가-힣]/u);
      expect(BEODEUL_OBJECT_CATEGORIES).toContain(object.category);
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.every(tag => typeof tag === "string" && tag.trim())).toBe(true);

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
    const map = createBlankMap("버들항", 20, 20, tileset.id);
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
      const click = { x: object.widthTiles, y: object.heightTiles };
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

  it("lists the same catalog through both assistant tools and stamps with the authored collision", () => {
    const ctx = { project: createBlankProject() };
    const [map] = Object.values(ctx.project.maps);
    const mapId = map!.id;
    const query = "버들항 기본 기물";
    const expected = BEODEUL_PLACEABLE_OBJECTS.map(object => ({
      id: kitId(object.id), width: object.widthTiles, height: object.heightTiles,
      tags: expect.arrayContaining([...object.tags]),
    }));
    const listed = runTool(ctx, "list_tileset_objects", { mapId, query });
    expect(listed.ok, listed.summary).toBe(true);
    expect(listed.data).toMatchObject({ objects: expected });
    const plannerIndex = buildStampObjectIndex(ctx.project.tilesets[map!.tilesetId]);
    expect(plannerIndex).toEqual(expect.arrayContaining(BEODEUL_PLACEABLE_OBJECTS.map(object => expect.objectContaining({
      id: kitId(object.id), width: object.widthTiles, height: object.heightTiles,
      placement: object.surface ?? "floor", indoor: object.category === "indoor",
    }))));
    const shared = runTool(ctx, "list_spatial_designs", { kind: "object", query, limit: 200 });
    expect(shared.ok, shared.summary).toBe(true);
    expect(shared.data).toMatchObject({ shared: { rows: expected.map(entry => ({
      ...entry, id: `kit:${map!.tilesetId}/${entry.id}`,
    })) } });

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
    const publicPaths = prepareWebExport(ctx.project).assets.flatMap(asset => asset.kind === "public" ? [asset.sourcePath] : []);
    expect(publicPaths).toContain(`assets/beodeul-objects/${object.id}.png`);

    const before = [...painted.upperTiles];
    const reloaded = deserialize(serialize(ctx.project));
    ensureBundledTilesets(reloaded);
    expect(reloaded.maps[mapId]!.upperTiles).toEqual(before);
    for (const [dy, row] of object.footprint.entries()) {
      for (const [dx, mark] of [...row].entries()) {
        expect(isPassable(reloaded, reloaded.maps[mapId]!, x + dx, y + dy)).toBe(mark !== "X");
      }
    }
  });

  it("extends straight dock and hedge sections on their own axes with the intended passage", () => {
    const ctx = { project: createBlankProject() };
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
