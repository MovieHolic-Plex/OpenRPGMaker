import { describe, expect, it } from "vitest";
import { defaultTilesets } from "@/project/defaults/defaultAssets";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { serialize, deserialize } from "@/project/io";
import { applyEasyRpgThemeMetadataPacks } from "@/project/tilesetHarness/themePacks";
import { shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import { lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { createWorldTerrainAutotileGroups, seedWorldTerrainAutotiles, worldTerrainQuarterKit } from "@/project/defaults/worldTerrainAutotiles";
import type { AutotileGroup } from "@/project/types";

// Independently transcribed from the 30-column World.png atlas; do not derive
// expected art roles from WORLD_TERRAIN_BLOCKS or the implementation's kits.
const ART = [
  { key: "dirt", anchor: 6, solid: false, isolatedArt: false },
  { key: "sand", anchor: 9, solid: false, isolatedArt: false },
  { key: "marsh", anchor: 126, solid: true, isolatedArt: false },
  { key: "snow", anchor: 129, solid: false, isolatedArt: false },
  { key: "tall-grass", anchor: 243, solid: false, isolatedArt: false },
  { key: "snow-forest", anchor: 246, solid: true, isolatedArt: true },
  { key: "snow-mountain", anchor: 249, solid: true, isolatedArt: true },
  { key: "forest", anchor: 360, solid: true, isolatedArt: true },
  { key: "mountain", anchor: 363, solid: true, isolatedArt: true },
  { key: "metal-pit", anchor: 366, solid: true, isolatedArt: false },
  { key: "rock-pit", anchor: 369, solid: true, isolatedArt: false },
] as const;
const PREFIX = "harness-world-v2-terrain-";
const tileset = () => defaultTilesets().easyrpg_chipset_world!;
const map = (rows: number[][]) => ({ width: rows[0]!.length, height: rows.length, lowerTiles: rows.flat() });
const neighborBits = [[1,0,1],[2,1,2],[1,2,4],[0,1,8],[2,0,16],[2,2,32],[0,2,64],[0,0,128]] as const;
// Each tuple: two perpendicular neighbor bits, diagonal bit, exposed corner,
// horizontal boundary, vertical boundary, destination quarter and pixel offset.
const quarterRoles = [
  [1,8,128,30,31,60,"nw",0,0], [1,2,16,32,31,62,"ne",8,0],
  [4,8,64,90,91,60,"sw",0,8], [4,2,32,92,91,62,"se",8,8],
] as const;

describe("World terrain autotiles", () => {
  it.each(ART)("composes $key correctly for all 256 independent neighbor topologies", ({ key, anchor, isolatedArt }) => {
    const ts = tileset();
    const group = ts.autotileGroups!.find(g=>g.id===PREFIX+key)!;
    for (let mask = 0; mask < 256; mask++) {
      const m = map([[240,240,240],[240,anchor+61,240],[240,240,240]]);
      for (const [x,y,bit] of neighborBits) if (mask & bit) m.lowerTiles[y*3+x] = anchor+61;
      const composition = chipsetQuarterComposition(m,ts,1,1);
      const expected = quarterRoles.map(([vertical,horizontal,diagonal,corner,hEdge,vEdge,quarter,offsetX,offsetY]) => {
        const joined = Number(Boolean(mask & vertical)) + Number(Boolean(mask & horizontal));
        const offset = joined === 0 ? corner : joined === 2 ? (mask & diagonal ? 61 : 2) : mask & horizontal ? hEdge : vEdge;
        return { quarter, tile: anchor+offset, offsetX, offsetY };
      });
      // A null composition is a deliberate whole-tile optimization, so compare
      // the effective four source quarters, including that renderer fallback.
      const effective = composition?.sources ?? quarterRoles.map((r) => ({ quarter: r[6], tile: anchor+61, offsetX: r[7], offsetY: r[8] }));
      expect(effective, `anchor=${anchor}, mask=${mask}`).toEqual(expected);
      // Verify the persisted variant IDs produced by painting still render the
      // same boundary after neighboring cells have also been reshaped.
      shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
      const shaped = chipsetQuarterComposition(m,ts,1,1);
      if (isolatedArt && (mask & 15) === 0) {
        expect(m.lowerTiles[4]).toBe(anchor);
        expect(shaped).toBeNull();
      } else {
        const shapedEffective = shaped?.sources ?? quarterRoles.map(r=>({quarter:r[6],tile:m.lowerTiles[4],offsetX:r[7],offsetY:r[8]}));
        expect(shapedEffective, `shaped anchor=${anchor}, mask=${mask}`).toEqual(expected);
      }
    }
  });

  it.each(ART)("distinguishes $key isolated artwork from flat ground", ({ anchor, isolatedArt }) => {
    const m = map([[240,240,240],[240,anchor,240],[240,240,240]]);
    const composition = chipsetQuarterComposition(m,tileset(),1,1);
    if (isolatedArt) expect(composition).toBeNull();
    else expect(composition?.sources.map(p=>p.tile)).toEqual([anchor+30,anchor+32,anchor+90,anchor+92]);
  });

  it("shapes newly painted terrain, repairs diagonal erasure, and restores the painted corner", () => {
    const ts = tileset();
    const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
    const m = map([[240,240,240,240,240],[240,421,421,421,240],[240,421,421,421,240],[240,421,421,421,240],[240,240,240,240,240]]);
    const points = m.lowerTiles.map((_,i)=>({x:i%5,y:Math.floor(i/5)}));
    shapeAutotileGroupAround(m,group,points);
    expect([m.lowerTiles[6],m.lowerTiles[7],m.lowerTiles[8],m.lowerTiles[11],m.lowerTiles[12],m.lowerTiles[13],m.lowerTiles[16],m.lowerTiles[17],m.lowerTiles[18]])
      .toEqual([390,391,392,420,421,422,450,451,452]);
    m.lowerTiles[6] = 240;
    shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
    expect(m.lowerTiles[12]).toBe(362);
    expect(chipsetQuarterComposition(m,ts,2,2)?.sources.map(p=>p.tile)).toEqual([362,421,421,421]);
    m.lowerTiles[6] = 421;
    shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
    expect(m.lowerTiles[12]).toBe(421);
    expect(m.lowerTiles[6]).toBe(390);
    const strip = map([[240,240,240,240,240],[240,421,421,421,240],[240,240,240,240,240]]);
    shapeAutotileGroupAround(strip,group,[{x:1,y:1},{x:2,y:1},{x:3,y:1}]);
    expect(chipsetQuarterComposition(strip,ts,2,1)?.sources.map(p=>p.tile)).toEqual([391,391,451,451]);
  });

  it("treats snowy woods and mountains as snow hosts without rewriting their tiles", () => {
    const ts = tileset();
    const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"snow")!;
    const m = map([[307,310,247],[250,190,246],[249,307,310]]);
    const before = [...m.lowerTiles];
    shapeAutotileGroupAround(m,group,[{x:1,y:1}]);
    expect(m.lowerTiles).toEqual(before);
    expect(chipsetQuarterComposition(m,ts,1,1)).toBeNull();
    m.lowerTiles[0] = 240;
    shapeAutotileGroupAround(m,group,[{x:0,y:0}]);
    expect(m.lowerTiles[4]).toBe(131);
    expect(chipsetQuarterComposition(m,ts,1,1)?.sources.map(p=>p.tile)).toEqual([131,190,190,190]);
  });

  it("chooses grass and snow shoreline independently for each corner", () => {
    const ts = tileset();
    const mixed = map([[190,120,240],[120,120,120],[240,120,190]]);
    expect(lakeAutotileQuarterSources(mixed,1,1,ts).map(p=>p.tile)).toEqual([93,90,90,93]);
    for (const snow of [190,247,250,246,307,249,310]) {
      const east = map([[120,120,120],[120,120,snow],[120,120,120]]);
      expect(lakeAutotileQuarterSources(east,1,1,ts).map(p=>p.tile)).toEqual([120,33,120,33]);
    }
    // A stored snow shoreline remains water and must join surrounding ocean.
    expect(lakeAutotileQuarterSources(map([[3]]),0,0,ts).map(p=>p.tile)).toEqual([120,120,120,120]);
    const snowAtSea = map([[120,120,120],[120,190,120],[120,120,120]]);
    const snowGroup = ts.autotileGroups!.find(g=>g.id===PREFIX+"snow")!;
    shapeAutotileGroupAround(snowAtSea,snowGroup,[{x:1,y:1}]);
    expect(snowAtSea.lowerTiles[4]).toBe(190);
  });

  it("seeds all 11 disjoint groups idempotently with consistent layer and passage", () => {
    const ts = tileset();
    ts.autotileGroups = []; ts.tileGroups = [];
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(true);
    expect(applyEasyRpgThemeMetadataPacks(ts)).toBe(false);
    const claimed = new Set<number>();
    for (const {key,anchor,solid} of ART) {
      const group = ts.autotileGroups!.find(g=>g.id===PREFIX+key)!;
      const expected = [anchor,anchor+2,anchor+30,anchor+31,anchor+32,anchor+60,anchor+61,anchor+62,anchor+90,anchor+91,anchor+92];
      expect(group.memberTileIds).toEqual(expected);
      expect(Object.keys(group.variantMap)).toHaveLength(256);
      expect(group.memberTileIds).not.toContain(anchor+1);
      for (const t of expected) {
        expect(claimed.has(t)).toBe(false); claimed.add(t);
        expect(ts.tileMeta![t]).toMatchObject({defaultLayer:"lower",passage:solid?"solid":"passable"});
        expect(ts.priority[t]).toBe("lower");
        expect(Object.values(ts.passability[t]!)).toEqual([!solid,!solid,!solid,!solid]);
      }
    }
    expect(claimed.size).toBe(121);
    expect(claimed.has(240)).toBe(false);
    expect(ts.tileMeta![362]!.passage).toBe("solid"); // Original semantic table had a passable forest corner.
  });

  it("preserves authored overlapping groups and user or locked tile metadata", () => {
    const ts = tileset();
    const custom = { ...createWorldTerrainAutotileGroups().find(g=>g.id===PREFIX+"forest")!, id:"my-forest",name:"내 숲" };
    ts.autotileGroups = [custom];
    ts.tileMeta![421] = {label:"내 숲 몸통",source:"user",defaultLayer:"upper",passage:"passable"};
    ts.tileMeta![424] = {label:"고정 산",source:"bundled-default",userLocked:true,defaultLayer:"upper",passage:"passable"};
    for (const t of [421,424]) { ts.priority[t]="upper"; ts.passability[t]={up:true,down:false,left:true,right:false}; }
    const metadata = [421,424].map(t=>structuredClone({meta:ts.tileMeta![t],priority:ts.priority[t],pass:ts.passability[t]}));
    const original = structuredClone(custom);
    applyEasyRpgThemeMetadataPacks(ts);
    expect(ts.autotileGroups!.find(g=>g.id==="my-forest")).toEqual(original);
    expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
    expect(worldTerrainQuarterKit(ts,421)).toBeNull();
    expect([421,424].map(t=>({meta:ts.tileMeta![t],priority:ts.priority[t],pass:ts.passability[t]}))).toEqual(metadata);
  });

  it.each([
    ["variant",(g:AutotileGroup)=>{g.variantMap["255"]=240;}],
    ["neighborhood",(g:AutotileGroup)=>{g.neighborhood=4;}],
    ["members",(g:AutotileGroup)=>{g.memberTileIds[0]=240;}],
    ["connections",(g:AutotileGroup)=>{g.connectTileIds!.push(240);}],
  ] as const)("disables fixed quarter composition immediately after in-place %s edits", (_,edit) => {
    const ts = tileset();
    const group = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
    expect(worldTerrainQuarterKit(ts,421)).not.toBeNull();
    edit(group);
    const before = structuredClone(group);
    expect(worldTerrainQuarterKit(ts,421)).toBeNull();
    expect(seedWorldTerrainAutotiles(ts)).toBe(false);
    expect(group).toEqual(before);
    expect(chipsetQuarterComposition(map([[421]]),ts,0,0)).toBeNull();
  });

  it("leaves every other bundled tileset untouched even though tile IDs overlap", () => {
    for (const ts of Object.values(defaultTilesets())) {
      if (ts.id === "easyrpg_chipset_world") continue;
      const before = structuredClone(ts);
      expect(seedWorldTerrainAutotiles(ts)).toBe(false);
      for (const {anchor} of ART) expect(worldTerrainQuarterKit(ts,anchor+61)).toBeNull();
      expect(ts).toEqual(before);
    }
  });

  it("preserves grafted artwork by opting its whole source block out of fixed quarter rendering", () => {
    const ts = tileset();
    const original = structuredClone(ts.autotileGroups);
    for (const targetTile of [421,360,390,362]) {
      ts.tileGrafts = [{targetTile,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
      ts.tileMeta![targetTile] = {label:"내 집 그림",source:"user",userLocked:true};
      expect(worldTerrainQuarterKit(ts,421)).toBeNull();
      expect(chipsetQuarterComposition(map([[240,240,240],[240,421,240],[240,240,240]]),ts,1,1)).toBeNull();
      expect(worldTerrainQuarterKit(ts,424)).not.toBeNull();
      expect(seedWorldTerrainAutotiles(ts)).toBe(false);
      expect(ts.autotileGroups).toEqual(original);
    }
    // T+1 is not a source slot; grafting this spare sample must not disable forest.
    ts.tileGrafts = [{targetTile:361,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
    expect(worldTerrainQuarterKit(ts,421)).not.toBeNull();
    ts.tileGrafts = [{targetTile:421,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
    const project = createBlankProject(); project.tilesets[ts.id]=ts;
    const loaded = deserialize(serialize(project)).tilesets[ts.id]!;
    expect(loaded.tileGrafts).toEqual(ts.tileGrafts);
    expect(worldTerrainQuarterKit(loaded,421)).toBeNull();
    delete loaded.tileGrafts;
    expect(worldTerrainQuarterKit(loaded,421)).not.toBeNull();
  });

  it("does not create a canonical terrain group over an existing graft", () => {
    const ts = tileset();
    ts.autotileGroups = []; ts.tileGroups=[];
    ts.tileGrafts = [{targetTile:421,sourceChipset:"tex_easyrpg_chipset_world",sourceTile:262}];
    expect(seedWorldTerrainAutotiles(ts)).toBe(true);
    expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
    expect(ts.tileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(false);
    expect(ts.autotileGroups).toHaveLength(10);
    expect(seedWorldTerrainAutotiles(ts)).toBe(false);
    delete ts.tileGrafts;
    expect(seedWorldTerrainAutotiles(ts)).toBe(true);
    expect(ts.autotileGroups!.some(g=>g.id===PREFIX+"forest")).toBe(true);
    expect(seedWorldTerrainAutotiles(ts)).toBe(false);
  });

  it("retains terrain groups, shaped tiles and quarter rendering through project serialization", () => {
    const project = createBlankProject();
    const ts = project.tilesets.easyrpg_chipset_world!;
    const m = createBlankMap("World terrain serialization contract",5,3,ts.id);
    m.lowerTiles = [240,240,240,240,240,240,421,421,421,240,240,240,240,240,240];
    const forest = ts.autotileGroups!.find(g=>g.id===PREFIX+"forest")!;
    shapeAutotileGroupAround(m,forest,[{x:1,y:1},{x:2,y:1},{x:3,y:1}]);
    project.maps = {[m.id]:m}; project.mapTree={mapId:m.id,children:[]}; project.startMapId=m.id; project.startPos={x:0,y:0};
    const loaded = deserialize(serialize(project));
    const loadedTs=loaded.tilesets[ts.id]!;
    expect(loadedTs.autotileGroups).toEqual(ts.autotileGroups);
    expect(loaded.maps[m.id]!.lowerTiles).toEqual(m.lowerTiles);
    expect(chipsetQuarterComposition(loaded.maps[m.id]!,loadedTs,2,1)).toEqual(chipsetQuarterComposition(m,ts,2,1));
    expect(loadedTs.tileMeta![362]).toEqual(ts.tileMeta![362]);
    expect(applyEasyRpgThemeMetadataPacks(loadedTs)).toBe(false);
  });
});

// Regression from the authored world's road-side cove (63,23): diagonal snow cannot tint a grass edge.
it("chooses snow skin only from land contributing the quarter boundary", () => {
  const ts = defaultTilesets().easyrpg_chipset_world!;
  const m = {width:3,height:3,lowerTiles:[120,240,190,120,120,120,120,120,120]};
  const ne = lakeAutotileQuarterSources(m,1,1,ts).find(p=>p.quarter==="ne")!;
  expect(ne.tile).toBe(60);
  m.lowerTiles[1]=120;
  expect(lakeAutotileQuarterSources(m,1,1,ts).find(p=>p.quarter==="ne")!.tile).toBe(93);
});
