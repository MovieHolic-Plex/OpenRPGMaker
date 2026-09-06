import { describe, expect, it } from "vitest";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { createWorldCoastAutotileGroup, hasWorldCoastMapping, isWorldAnimatedTile, seedWorldCoastMapping, WORLD_COAST_GROUP_ID, WORLD_SEA_TILES, WORLD_SNOW_SHORE_TILES, WORLD_WATER_TILES } from "@/project/defaults/worldCoastMapping";
import { createWorldTerrainAutotileGroups } from "@/project/defaults/worldTerrainAutotiles";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { serialize, deserialize } from "@/project/io";

const tileset = () => defaultTilesets().easyrpg_chipset_world!;
const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });

describe("World coast mapping", () => {
  it("seeds existing projects idempotently, keeping terrain and runtime passage aligned", () => {
    const ts = tileset();
    ts.autotileGroups = []; ts.tileGroups = [];
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
    expect(ts.autotileGroups?.map(g => g.id)).toEqual([WORLD_COAST_GROUP_ID, ...createWorldTerrainAutotileGroups().map(g => g.id)]);
    expect(WORLD_WATER_TILES).toHaveLength(36);
    for (const tile of WORLD_WATER_TILES) {
      expect(ts.priority[tile]).toBe("lower");
      expect(Object.values(ts.passability[tile]!)).toEqual([false, false, false, false]);
    }
    expect(Object.values(ts.passability[240]!)).toEqual([true, true, true, true]);
  });

  it("preserves authored groups, locked metadata, and other tilesets", () => {
    const ts = tileset();
    ts.autotileGroups = [{ ...createWorldCoastAutotileGroup(), id: "my-sea", name: "내 바다" }];
    const original = JSON.stringify(ts.autotileGroups);
    seedWorldCoastMapping(ts);
    expect(JSON.stringify(ts.autotileGroups)).toBe(original);
    expect(isLakeAutotileTile(120, ts)).toBe(false);
    ts.tileMeta![120] = { label: "내 타일", source: "user", userLocked: true, defaultLayer: "upper", passage: "passable" };
    ts.priority[120] = "upper";
    applyEasyRpgThemeMetadataPacks(ts);
    expect(ts.tileMeta![120]!.label).toBe("내 타일");
    expect(ts.priority[120]).toBe("upper");
    const retro = defaultTilesets().easyrpg_chipset_retro_world!;
    const before = JSON.stringify(retro);
    expect(seedWorldCoastMapping(retro)).toBe(false);
    expect(JSON.stringify(retro)).toBe(before);
  });

  it("includes snow shores but excludes waterfalls, plain variants, and source props", () => {
    const ts = tileset();
    for (const tile of [123, 125, 240, 301, 322]) {
      expect(isLakeAutotileTile(tile, ts)).toBe(false);
      expect(chipsetQuarterComposition(map([[tile]]), ts, 0, 0)).toBeNull();
    }
    for (const tile of WORLD_SNOW_SHORE_TILES) expect(isLakeAutotileTile(tile, ts)).toBe(true);
    expect(chipsetQuarterComposition(map([[421]]), ts, 0, 0)).not.toBeNull();
    expect(isLakeAutotileTile(3)).toBe(true); // Existing village canal remains supported.
  });

  it("migrates the exact old 24-slot group and its bundled metadata without replacing authored snow", () => {
    const ts = tileset();
    const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds: [...WORLD_SEA_TILES], connectTileIds: [...WORLD_SEA_TILES] };
    ts.autotileGroups = [legacy];
    const coastMetadata = ts.tileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!;
    coastMetadata.tileIds = [...WORLD_SEA_TILES];
    expect(seedWorldCoastMapping(ts)).toBe(true);
    expect(hasWorldCoastMapping(ts)).toBe(true);
    expect(ts.tileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!.tileIds).toEqual(WORLD_WATER_TILES);
    expect(seedWorldCoastMapping(ts)).toBe(false);

    const snow = { ...createWorldCoastAutotileGroup(), id: "my-snow", memberTileIds: [...WORLD_SNOW_SHORE_TILES], connectTileIds: [...WORLD_SNOW_SHORE_TILES] };
    ts.autotileGroups = [legacy, snow];
    const before = structuredClone(ts.autotileGroups);
    expect(seedWorldCoastMapping(ts)).toBe(false);
    expect(ts.autotileGroups).toEqual(before);
  });

  it("opts out immediately after in-place grammar edits and does not silently restore them", () => {
    const ts = tileset();
    const group = ts.autotileGroups!.find(g => g.id === WORLD_COAST_GROUP_ID)!;
    expect(isLakeAutotileTile(120, ts)).toBe(true);
    group.variantMap["255"] = 3;
    expect(isLakeAutotileTile(120, ts)).toBe(false);
    expect(seedWorldCoastMapping(ts)).toBe(false);
    expect(group.variantMap["255"]).toBe(3);
  });

  it("retains v1 grass coast rendering and connection scope beside authored snow", () => {
    const ts = tileset();
    const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
    const snow = { ...createWorldCoastAutotileGroup(), id:"my-snow", memberTileIds:[...WORLD_SNOW_SHORE_TILES], connectTileIds:[...WORLD_SNOW_SHORE_TILES] };
    ts.autotileGroups = [legacy,snow];
    ts.tileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)!.tileIds = [...WORLD_SEA_TILES];
    const before = structuredClone(ts.autotileGroups);
    expect(seedWorldCoastMapping(ts)).toBe(false);
    expect(ts.autotileGroups).toEqual(before);
    expect(hasWorldCoastMapping(ts)).toBe(true);
    expect(isLakeAutotileTile(120,ts)).toBe(true);
    expect(isLakeAutotileTile(3,ts)).toBe(false);
    expect(chipsetQuarterComposition(map([[3]]),ts,0,0)).toBeNull();
    // The user's snow tiles are not members or connections of the grass coast.
    const strip = map([[3,120,3],[3,120,3],[3,120,3]]);
    expect(lakeAutotileQuarterSources(strip,1,1,ts).map(p=>p.tile)).toEqual([30,30,30,30]);
    const snowyLand = map([[190,120,190],[120,120,120],[190,120,190]]);
    expect(lakeAutotileQuarterSources(snowyLand,1,1,ts).map(p=>p.tile)).toEqual([90,90,90,90]);
    expect(ts.tileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)!.tileIds).toEqual(WORLD_SEA_TILES);
    const project = createBlankProject(); project.tilesets[ts.id] = ts;
    const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
    expect(loaded.autotileGroups!.find(g=>g.id==="my-snow")).toEqual(snow);
    expect(isLakeAutotileTile(120,loaded)).toBe(true);
    expect(isLakeAutotileTile(3,loaded)).toBe(false);
  });

  it("expands only v1 slot sets while preserving authored name and trigger scope", () => {
    const ts = tileset();
    const legacy = { ...createWorldCoastAutotileGroup(), name:"내 초원바다", triggerTileIds:[120],
      memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
    ts.autotileGroups = [legacy];
    expect(seedWorldCoastMapping(ts)).toBe(true);
    const migrated = ts.autotileGroups[0]!;
    expect(migrated).toEqual({...legacy,memberTileIds:WORLD_WATER_TILES,connectTileIds:WORLD_WATER_TILES});
    expect(seedWorldCoastMapping(ts)).toBe(false);
    const project = createBlankProject(); project.tilesets[ts.id] = ts;
    const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
    expect(loaded.autotileGroups!.find(g=>g.id===WORLD_COAST_GROUP_ID)).toEqual(migrated);
  });

  it("opts out of fixed coast art when a source or animation frame is grafted", () => {
    const ts = tileset();
    const original = structuredClone(ts.autotileGroups);
    for (const targetTile of [120,0,31,35]) {
      ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      expect(hasWorldCoastMapping(ts)).toBe(false);
      expect(isLakeAutotileTile(120,ts)).toBe(false);
      expect(chipsetQuarterComposition(map([[120]]),ts,0,0)).toBeNull();
      expect(seedWorldCoastMapping(ts)).toBe(false);
      expect(ts.autotileGroups).toEqual(original);
    }
    ts.tileGrafts = [{targetTile:262,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:292}];
    expect(hasWorldCoastMapping(ts)).toBe(true);
    delete ts.tileGrafts;
    expect(hasWorldCoastMapping(ts)).toBe(true);
  });

  it("does not seed or expand a coast group over grafted source slots", () => {
    const ts = tileset();
    ts.autotileGroups = [];
    ts.tileGrafts = [{targetTile:120,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
    expect(seedWorldCoastMapping(ts)).toBe(false);
    expect(ts.autotileGroups).toEqual([]);
    const legacy = { ...createWorldCoastAutotileGroup(), memberTileIds:[...WORLD_SEA_TILES], connectTileIds:[...WORLD_SEA_TILES] };
    ts.autotileGroups = [legacy];
    ts.tileGrafts[0]!.targetTile = 3;
    expect(seedWorldCoastMapping(ts)).toBe(false);
    expect(ts.autotileGroups).toEqual([legacy]);
    expect(isLakeAutotileTile(120,ts)).toBe(true);
    expect(isLakeAutotileTile(3,ts)).toBe(false);
    expect(lakeAutotileQuarterSources(map([[190,120,190],[120,120,120],[190,120,190]]),1,1,ts).map(p=>p.tile)).toEqual([90,90,90,90]);
    delete ts.tileGrafts;
    expect(seedWorldCoastMapping(ts)).toBe(true);
    expect(ts.autotileGroups[0]!.memberTileIds).toEqual(WORLD_WATER_TILES);
  });

  it("stops only the affected three-frame water strip when any frame is grafted", () => {
    const ts = tileset();
    for (const targetTile of [120,121,122]) {
      ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      for (const tile of [120,121,122]) expect(isWorldAnimatedTile(tile,ts)).toBe(false);
      for (const tile of [0,1,2,150,151,152,123,153,183,213]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
    }
    delete ts.tileGrafts;
    for (const tile of [120,121,122]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
    expect(isWorldAnimatedTile(120)).toBe(true);
    expect(isWorldAnimatedTile(262,ts)).toBe(false);
  });

  it("stops only the affected vertical four-frame effect when any frame is grafted", () => {
    const ts = tileset();
    for (const frames of [[123,153,183,213],[124,154,184,214],[125,155,185,215]]) {
      for (const targetTile of frames) {
        ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
        for (const tile of frames) expect(isWorldAnimatedTile(tile,ts)).toBe(false);
        const unrelated = [120,121,122,123,124,125,153,154,155,183,184,185,213,214,215].filter(t=>!frames.includes(t));
        for (const tile of unrelated) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
      }
    }
    ts.tileGrafts = [{targetTile:262,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:292}];
    for (const tile of [123,153,183,213]) expect(isWorldAnimatedTile(tile,ts)).toBe(true);
  });

  it("uses all four independent quarters for every 8-neighbor topology", () => {
    const ts = tileset();
    const offsets = [[1,0,1],[2,1,2],[1,2,4],[0,1,8],[2,0,16],[2,2,32],[0,2,64],[0,0,128]];
    const expectedDirections = [[1,8,128],[1,2,16],[4,8,64],[4,2,32]];
    for (let mask = 0; mask < 256; mask++) {
      const m = map([[240,240,240],[240,120,240],[240,240,240]]);
      for (const [x,y,bit] of offsets) if (mask & bit!) m.lowerTiles[y! * 3 + x!] = 120;
      const parts = lakeAutotileQuarterSources(m, 1, 1, ts);
      for (let q = 0; q < 4; q++) {
        const [v,h,d] = expectedDirections[q]!;
        const expected = !(mask & v!) && !(mask & h!) ? 0 : !(mask & v!) ? 60 : !(mask & h!) ? 30 : !(mask & d!) ? 90 : 120;
        expect(parts[q]!.tile, `mask=${mask}, quarter=${q}`).toBe(expected);
      }
    }
  });

  it("keeps open sea at the canvas edge and reshapes after land is erased", () => {
    const ts = tileset();
    expect(lakeAutotileQuarterSources(map([[120]]),0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
    const m = map([[120,120,120],[120,240,120],[120,120,120]]);
    const before = lakeAutotileQuarterSources(m,0,0,ts);
    expect(before.find(p=>p.quarter === "se")!.tile).toBe(90);
    m.lowerTiles[4] = 120;
    shapeAutotileGroupAround(m, createWorldCoastAutotileGroup(), [{x:1,y:1}]);
    expect(lakeAutotileQuarterSources(m,0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
    const strip = map([[240,240,240],[120,120,120],[240,240,240]]);
    expect(lakeAutotileQuarterSources(strip,1,1,ts).map(p=>p.tile)).toEqual([60,60,60,60]);
  });
});
