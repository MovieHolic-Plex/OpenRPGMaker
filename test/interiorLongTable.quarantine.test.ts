import { describe, expect, it } from "vitest";
import { createBlankMap, createBlankProject, ensureBundledTilesets } from "@/project/defaults";
import { createScarloxyPokemonDemoProject } from "@/project/defaults/defaultProject";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { applyInteriorRoomLayer, ensureInteriorRoomHarness, interiorRoomTileGroups, INTERIOR_ROOM_DEMO_PLANS, INTERIOR_ROOM_TILESET_ID, runInteriorRoomPipeline } from "@/editor/interiorRoomPipeline";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { expandHardClusterPlacement } from "@/editor/tools/clusterRulePlacement";
import { atomFromGroup, fillRun, hardAdjacencyViolation } from "@/editor/tools/v3/rowArrangement";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { projectLint } from "@/project/lint/projectLint";
import { deserialize, serialize, serializeForComparison } from "@/project/io";
import type { TileGroupMetadata } from "@/project/types";

const id = "harness-interior-house-v1-tavern-table";
// Complete factory output at 9a0c335f, including provenance; never derive from the new factory.
function legacy(): TileGroupMetadata {
  return { id, name: "긴 탁자", role: "prop", defaultLayer: "upper", tileIds: [325, 326],
    description: "openFloor, 좌우 한 쌍", placementRules: "openFloor, 좌우 한 쌍", confidence: "high", source: "bundled-default",
    layerHome: "upper", rules: [{ id: "r_interior_long_table_h_pair", kind: "adjacency", strength: "hard",
      message: "긴 탁자 좌(325)는 우(326) 바로 왼쪽에 있어야 합니다 (hard cluster).",
      params: { a: 325, b: 326, relation: "aLeftOfB" } }],
    patternGrammar: { kind: "horizontal_expandable", axis: "horizontal", minWidth: 2, minHeight: 1,
      preserveCaps: true, repeat: "source_order", parts: [{ role: "leftCap", tileIds: [325] }, { role: "rightCap", tileIds: [326] }] } };
}
function scene(rows: number[][]) {
  const project = createBlankProject();
  const map = createBlankMap("Table seam", 12, 8, INTERIOR_ROOM_TILESET_ID);
  map.lowerTiles.fill(42);
  rows.forEach((row,y)=>row.forEach((tile,x)=>map.upperTiles[(y+1)*map.width+x+1]=tile));
  project.maps = { [map.id]: map };
  project.startMapId = map.id;
  project.startPos = { x: 0, y: 0 };
  project.mapTree = { mapId: map.id, children: [] };
  const tileset = project.tilesets[INTERIOR_ROOM_TILESET_ID]!;
  tileset.tileGroups = [interiorRoomTileGroups().find(group=>group.id===id)!];
  return { project, map, tileset };
}
function tableIssues(project: ReturnType<typeof createBlankProject>) {
  return validateClusterRules(project).filter(issue=>issue.groupId===id);
}

describe("interior long-table vocabulary seam", () => {
  it("keeps the original demo integrity gate and placed layers unchanged after both normalizers", () => {
    const project = createScarloxyPokemonDemoProject();
    const maps = structuredClone(project.maps);
    ensureTilesetHarnesses(project);
    expect(projectLint(project).filter(issue=>issue.severity==="error")).toEqual([]);
    ensureInteriorRoomHarness(project);
    const fresh = deserialize(serialize(project));
    ensureBundledTilesets(fresh);
    expect(projectLint(fresh).filter(issue=>issue.severity==="error")).toEqual([]);
    expect(project.maps).toEqual(maps);
    expect(fresh.maps).toEqual(deserialize(serialize({ ...project, maps })).maps);
  });

  it.each([[325,327], [325,326,327], [325,326,326,326,327], [325,327,325,326,327]])("accepts a closed table %j", (...row) => {
    expect(tableIssues(scene([row]).project)).toEqual([]);
  });
  it.each([[325], [326], [327], [325,326], [326,327], [326,326], [327,325], [325,325,326,327], [325,326,327,327], [325,-1,326,327], [325,326,325,327]])("rejects a broken table %j with hard errors", (...row) => {
    const issues = tableIssues(scene([row]).project);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(issue=>issue.severity==="error")).toBe(true);
  });
  it("does not join caps across rows or a map boundary", () => {
    const {project,map}=scene([]);
    map.upperTiles[map.width-1]=325; map.upperTiles[map.width]=327;
    expect(tableIssues(project).length).toBeGreaterThan(0);
  });
  it("exhaustively accepts only closed horizontal runs through length five", () => {
    const {project,map}=scene([]);
    const tiles=[325,326,327,-1], symbols=["L","M","R","_"];
    for(let length=1;length<=5;length++) for(let n=0;n<4**length;n++) {
      let code=n, word="";
      map.upperTiles.fill(-1);
      for(let x=0;x<length;x++) { const digit=code%4; code=Math.floor(code/4); word+=symbols[digit]; map.upperTiles[map.width+x]=tiles[digit]!; }
      expect(tableIssues(project).length===0,word).toBe(/^(?:LM*R|_)*$/.test(word));
    }
  });
  it.each([2,3,5])("the real row painter expands a closed width-%s table", width => {
    const {project,map,tileset}=scene([]), group=tileset.tileGroups![0]!;
    const atom=atomFromGroup(tileset,group,{axis:"horizontal",symmetric:false},{});
    const row=fillRun(atom,{x:1,y:1,w:width,h:1},"horizontal");
    expect(row.cells.map(cell=>cell.tile)).toEqual([325,...Array(width-2).fill(326),327]);
    expect(hardAdjacencyViolation(group,row.cells)).toBeNull();
    for(const cell of row.cells) map.upperTiles[cell.y*map.width+cell.x]=cell.tile;
    expect(tableIssues(project)).toEqual([]);
  });
  it("shares the catalog's complete upper assembly and repeat-body grammar", () => {
    const group = interiorRoomTileGroups().find(group=>group.id===id)!;
    expect(group.tileIds).toEqual([325,326,327]);
    expect(group.patternGrammar).toMatchObject({ repeat: "body", parts: [
      { role: "leftCap", tileIds: [325] }, { role: "repeatBody", tileIds: [326] }, { role: "rightCap", tileIds: [327] },
    ] });
    for (const objectId of ["table_long", "counter"]) {
      const cells=interiorObjectById(objectId)!.cells;
      expect(cells.map(cell=>cell.tile)).toEqual([325,326,327]);
      expect(cells.every(cell=>cell.layer==="upper")).toBe(true);
      expect(tableIssues(scene([cells.map(cell=>cell.tile)]).project)).toEqual([]);
    }
  });
  it("the hard-cluster painter builds a complete table from a middle tile", () => {
    const {project,map,tileset}=scene([]);
    const result=expandHardClusterPlacement({map,tileset,origin:{x:4,y:3},originLayer:"upper",tile:326});
    expect(result.ok).toBe(true);
    for (const edit of result.edits) map.upperTiles[edit.y*map.width+edit.x]=edit.tile;
    expect(map.upperTiles.slice(3*map.width+3,3*map.width+6)).toEqual([325,326,327]);
    expect(tableIssues(project)).toEqual([]);
  });

  it.each([false, true])("the room critique requires the closing cap (short closed table: %s)", shortClosed => {
    const plan=INTERIOR_ROOM_DEMO_PLANS.find(plan=>plan.theme==="tavern")!;
    const built=runInteriorRoomPipeline(plan);
    expect(built.ok).toBe(true);
    const start=built.map.upperTiles.indexOf(325);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(built.map.upperTiles.slice(start,start+3)).toEqual([325,326,327]);
    built.map.upperTiles[start+2]=-1;
    if(shortClosed) built.map.upperTiles[start+1]=327;
    expect(applyInteriorRoomLayer(built.map,plan,"critique").ok).toBe(shortClosed);
  });

  it.each(["load", "author"])("migrates only exact factory data via %s and reaches a serialization fixed point", path => {
    const {project,tileset}=scene([[325,326,326,327]]);
    tileset.tileGroups=[legacy()];
    if(path==="load") ensureBundledTilesets(project); else ensureInteriorRoomHarness(project);
    expect(tileset.tileGroups.find(group=>group.id===id)).toEqual(interiorRoomTileGroups().find(group=>group.id===id));
    expect(tableIssues(project)).toEqual([]);
    ensureBundledTilesets(project); ensureInteriorRoomHarness(project);
    const before=serializeForComparison(project);
    const fresh=deserialize(serialize(project));
    ensureBundledTilesets(fresh); ensureInteriorRoomHarness(fresh);
    expect(serializeForComparison(fresh)).toBe(before);
  });
  it.each(["source", "origin", "missing-provenance", "membership", "rules", "grammar", "layer", "description", "extra-field"])("preserves a customized/ambiguous %s record, kits and maps", kind => {
    const {project,tileset}=scene([[325,326]]);
    const group=legacy();
    if(kind==="source") group.source="user";
    if(kind==="origin") group.origin="user";
    if(kind==="missing-provenance") delete group.source;
    if(kind==="membership") group.tileIds.push(328);
    if(kind==="rules") group.rules![0]!.params.b=327;
    if(kind==="grammar") group.patternGrammar!.minWidth=5;
    if(kind==="layer") group.layerHome="lower";
    if(kind==="description") group.description="Custom";
    if(kind==="extra-field") Object.assign(group,{custom:true});
    tileset.tileGroups=[group];
    tileset.structureKits = [{ id: "own-table", kind: "section", name: "Own table", width: 2, height: 1,
      rows: [{ tiles: [325, 326] }], learnedFrom: "db-authored" }];
    const expected=structuredClone(group), maps=structuredClone(project.maps), kits=structuredClone(tileset.structureKits);
    ensureInteriorRoomHarness(project); ensureBundledTilesets(project);
    expect(tileset.tileGroups.find(g=>g.id===id)).toEqual(expected);
    expect(tileset.structureKits?.find(kit=>kit.id==="own-table")).toEqual(kits[0]);
    expect(project.maps).toEqual(maps);
  });
  it.each([325, 326, 327].flatMap(tile => ["load", "author"].map(path => ({ tile, path }))))(
    "preserves a priority-only lower override on $tile through $path and fresh normalization",
    ({ tile, path }) => {
      const { project, tileset } = scene([[325, 326, 326, 327]]);
      ensureBundledTilesets(project);
      ensureInteriorRoomHarness(project);
      expect(tileset.tileMeta![tile]).toMatchObject({ source: "bundled-default", defaultLayer: "upper" });
      tileset.priority[tile] = "lower";
      const group = legacy();
      tileset.tileGroups = [group];
      const meta = structuredClone(tileset.tileMeta![tile]);
      const maps = structuredClone(project.maps);
      const kits = structuredClone(tileset.structureKits);

      if (path === "load") ensureBundledTilesets(project); else ensureInteriorRoomHarness(project);
      expect(tileset.priority[tile]).toBe("lower");
      expect(tileset.tileGroups.find(candidate => candidate.id === id)).toEqual(group);
      ensureBundledTilesets(project);
      ensureInteriorRoomHarness(project);
      expect(tileset.tileMeta![tile]).toEqual(meta);
      expect(tileset.structureKits).toEqual(kits);
      expect(project.maps).toEqual(maps);

      const before = serializeForComparison(project);
      const fresh = deserialize(serialize(project));
      ensureBundledTilesets(fresh);
      ensureInteriorRoomHarness(fresh);
      expect(fresh.tilesets[INTERIOR_ROOM_TILESET_ID]!.priority[tile]).toBe("lower");
      expect(fresh.tilesets[INTERIOR_ROOM_TILESET_ID]!.tileGroups!.find(candidate => candidate.id === id)).toEqual(group);
      expect(serializeForComparison(fresh)).toBe(before);
      expect(tableIssues(fresh)).toMatchObject([{ severity: "error", coords: [{ x: 3, y: 1 }] }]);
    },
  );
  it("keeps an explicit user hard pair effective instead of globally forgiving repeats", () => {
    const {project,tileset}=scene([[325,326,326,327]]);
    const group=legacy(); group.source="user"; tileset.tileGroups=[group];
    ensureInteriorRoomHarness(project); ensureBundledTilesets(project);
    expect(tableIssues(project)).toMatchObject([{severity:"error",coords:[{x:3,y:1}]}]);
  });
  it.each(["graft", "tile-user", "tile-origin", "tile-locked", "tile-userLocked", "different-art", "different-layout", "duplicate-id", "suppressed"])("does not replace ambiguous artwork/overrides: %s", kind => {
    const {project,tileset}=scene([]);
    tileset.tileGroups=[legacy()];
    if(kind==="graft") tileset.tileGrafts=[{targetTile:326,sourceTile:1,sourceChipset:"tex_easyrpg_chipset_retro_house"}];
    if(kind==="tile-user") tileset.tileMeta![326]={...tileset.tileMeta![326]!,source:"user",defaultLayer:"lower"};
    if(kind==="tile-origin") tileset.tileMeta![326]={...tileset.tileMeta![326]!,origin:"user",defaultLayer:"lower"};
    if(kind==="tile-locked") tileset.tileMeta![326]={...tileset.tileMeta![326]!,locked:true,defaultLayer:"lower"};
    if(kind==="tile-userLocked") tileset.tileMeta![326]={...tileset.tileMeta![326]!,userLocked:true,defaultLayer:"lower"};
    if(kind==="different-art") tileset.image={type:"bundled",id:"tex_easyrpg_chipset_retro_house"};
    if(kind==="different-layout") tileset.tilesPerRow=16;
    if(kind==="duplicate-id") tileset.tileGroups.push(legacy());
    if(kind==="suppressed") { tileset.tileGroups=[]; tileset.suppressedHarnessGroupIds=[id]; }
    const meta=structuredClone(tileset.tileMeta![326]);
    ensureInteriorRoomHarness(project); ensureBundledTilesets(project); ensureInteriorRoomHarness(project);
    expect(tileset.tileGroups.find(g=>g.id===id)).toEqual(kind==="suppressed"?undefined:legacy());
    if(kind.startsWith("tile-")) expect(tileset.tileMeta![326]).toEqual(meta);
  });
});
