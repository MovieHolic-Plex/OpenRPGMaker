import { runTool } from "../src/editor/tools/toolRunner";
import { describe, expect, it } from "vitest";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { deserialize, serialize } from "../src/project/io";
import { checkedDocument, own, spatialId } from "../src/project/spatial/domain";
import { computeReachableCells } from "../src/project/lint/reachability";
import { isPassableLanding } from "../src/project/collision";
import { isCeilingTile, shapeInteriorCeiling } from "../src/editor/interiorHouseWallGrammar";
import { fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceRoot, spaceDesign } from "./support/spatialSpaceCompilerFixture";

function divided() {
  return reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, width: 8, height: 6,
    objectSlots: [], ports: [{ id: spatialId("entry"), name: "Entry", x: 3, y: 5 }],
    interiorLayout: { rooms: [
      { id: spatialId("living"), name: "Living", x: 0, y: 0, width: 5, height: 6 },
      { id: spatialId("bedroom"), name: "Bedroom", x: 5, y: 0, width: 3, height: 6 },
    ], doorways: [{ x: 4, y: 3 }] } }));
}

describe("structural interior room layout", () => {
  it("survives save/load and compiles a connected shell with one traversable doorway", () => {
    const input = deserialize(serialize(divided()));
    const result = compileSpatialOccurrence(input, { occurrenceId: spaceRoot });
    const mapId = own(fixtureDocument(result).occurrences, spaceRoot).bindings[0]!.mapId;
    const map = result.maps[mapId]!;
    expect(map.width).toBe(12);
    expect(map.height).toBe(12);
    expect(map.roomHarnessPlan!.plan.rooms).toHaveLength(2);
    for (let y = 1; y <= 4; y++) expect(isCeilingTile(map.lowerTiles[y * 12 + 6]!)).toBe(true);
    for (let y = 4; y < 10; y++) expect(isPassableLanding(result, map, 6, y)).toBe(y === 7);
    const shaped = structuredClone(map);
    shapeInteriorCeiling(shaped);
    expect(shaped.lowerTiles).toEqual(map.lowerTiles);
    expect(computeReachableCells(result, map, 5, 9).has("8,6")).toBe(true);
    const closed = structuredClone(map);
    closed.lowerTiles[7 * 12 + 6] = 430;
    expect(computeReachableCells(result, closed, 5, 9).has("8,6")).toBe(false);
    const reloaded = deserialize(serialize(result));
    expect(reloaded.maps[mapId]).toEqual(map);
    expect(compileSpatialOccurrence(reloaded, { occurrenceId: spaceRoot }).maps[mapId]).toEqual(map);
  });

  it("accepts room subdivisions through the registered AI authoring tool", () => {
    const project = spaceCompilerFixture();
    const source = own(fixtureDocument(divided()).library.spaces, spaceDesign);
    const context = { project };
    const result = runTool(context, "upsert_spatial_design", {
      kind: "space", expectedRevision: 1, space: { ...source, revision: 2 },
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(own(fixtureDocument(context.project).library.spaces, spaceDesign)).toMatchObject({
      interiorLayout: { doorways: [{ x: 4, y: 3 }] },
    });
  });

  it("preserves the legacy single-room layout when no subdivision is authored", () => {
    const result = compileSpatialOccurrence(deserialize(serialize(spaceCompilerFixture())), { occurrenceId: spaceRoot });
    const binding = own(fixtureDocument(result).occurrences, spaceRoot).bindings[0]!;
    expect(result.maps[binding.mapId]!.roomHarnessPlan!.plan.rooms).toHaveLength(1);
  });

  it("rejects an out-of-bounds room before saving the design", () => {
    const input = divided();
    const document = structuredClone(fixtureDocument(input));
    const source = own(document.library.spaces, spaceDesign);
    if (source.environment !== "interior" || !source.interiorLayout) throw new Error("fixture");
    document.library.spaces[spaceDesign] = { ...source, interiorLayout: { ...source.interiorLayout,
      rooms: source.interiorLayout.rooms.map((room, i) => i === 1 ? { ...room, width: 4 } : room) } };
    expect(() => checkedDocument(document, input)).toThrow(/room outside floor/);
  });
});

describe('irregular room materials',()=>{
 it.each(['l-right','bay','notch','cross'] as const)('persists and builds a connected %s footprint',shape=>{
  const input=reinstantiateSpace(spaceCompilerFixture(),space=>({...space,width:10,height:8,shape,wall:'stone-brick',floor:'jade',objectSlots:[],ports:[{id:spatialId('entry'),name:'Entry',x:5,y:7}]}));
  const loaded=deserialize(serialize(input));
  const result=compileSpatialOccurrence(loaded,{occurrenceId:spaceRoot});
  const map=result.maps[own(fixtureDocument(result).occurrences,spaceRoot).bindings[0]!.mapId]!;
  const reached=computeReachableCells(result,map,7,11);
  const floor=[];for(let y=4;y<12;y++)for(let x=2;x<12;x++)if(isPassableLanding(result,map,x,y)){floor.push(`${x},${y}`);expect(reached.has(`${x},${y}`)).toBe(true);}
  expect(floor.length).toBeLessThan(80);expect(floor.length).toBeGreaterThan(30);
  expect(map.lowerTiles).toContain(13);expect(map.lowerTiles).toContain(135);
 });
 it('preserves per-room shapes and different floor materials across save/load',()=>{
  const input=reinstantiateSpace(spaceCompilerFixture(),space=>({...space,width:13,height:8,objectSlots:[],ports:[{id:spatialId('entry'),name:'Entry',x:4,y:7}],interiorLayout:{rooms:[{id:spatialId('main'),name:'Main',x:0,y:0,width:8,height:8,shape:'notch',floor:'gravel'},{id:spatialId('side'),name:'Side',x:9,y:3,width:4,height:5,floor:'jade'}],doorways:[{x:8,y:5}]}}));
  const loaded=deserialize(serialize(input));const result=compileSpatialOccurrence(loaded,{occurrenceId:spaceRoot});const map=result.maps[own(fixtureDocument(result).occurrences,spaceRoot).bindings[0]!.mapId]!;
  expect(map.lowerTiles).toContain(42);expect(map.lowerTiles).toContain(13);expect(computeReachableCells(result,map,6,11).has('12,10')).toBe(true);
 });
});
