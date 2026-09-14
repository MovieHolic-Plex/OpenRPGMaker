import { bindSeedHouseInteriorPlan } from "@/editor/interiorConceptPlan";
import { createBlankProject } from "@/project/defaults";
import { withEnvironment } from "@/editor/panels/spatialSpaceDraft";
import { createEmptyRoomMap, applyInteriorRoomLayer } from "@/editor/interiorRoomPipeline";
import { interiorActivityEntries } from "@/editor/interiorActivityEntries";
import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { spatialId, own } from "@/project/spatial/domain";
import { compileSpatialOccurrence } from "@/editor/spatial/compileSpatialOccurrence";
import { spaceLayout } from "@/editor/spatial/spaceLayout";
import { buildHouseInteriorPlan } from "@/editor/houseInteriors";
import { floorMaskFromPlan } from "@/editor/interiorRoomPipeline";
import { fixtureDocument, spaceCompilerFixture, reinstantiateSpace, spaceDesign, spaceRoot } from "./support/spatialSpaceCompilerFixture";

function zoned() {
  return reinstantiateSpace(spaceCompilerFixture(), space => ({ ...space, environment: "interior", role: "entrance",
    zones: [{ id: spatialId("sleep"), name: "침상", x: 0, y: 0, width: 6, height: 5, floor: "stone" },
      { id: spatialId("living"), name: "생활", x: 0, y: 5, width: 16, height: 7, floor: "wood" }],
    objectSlots: space.objectSlots.filter(s => s.id === "beds").map(s => ({ ...s, zoneId: spatialId("sleep") })),
  }));
}
describe("activity zones share one interior shell", () => {
  it("leaves wide openings to reachability checks while preserving narrow doorway reservations", () => {
    const mask=Array.from({length:36},(_,i)=>Math.floor(i/6)<3), full=Array(36).fill(true);
    expect(interiorActivityEntries(mask,full,6,6,true)).toEqual([]);
    expect(interiorActivityEntries(mask,full,6,6,false)).toHaveLength(6);
    const door=mask.map((v,i)=>v || i===3*6+2);
    expect(interiorActivityEntries(mask,door,6,6,true)).toEqual([{x:2,y:2,dx:0,dy:-1}]);
  });
  it("preserves zones in an interior draft and clears assignments when converting outdoors", () => {
    const project=zoned(), source=own(fixtureDocument(project).library.spaces,spaceDesign);
    expect(withEnvironment(source,"interior")).toEqual(source);
    expect(withEnvironment(source,"outdoor").objectSlots.every(slot=>slot.zoneId===undefined)).toBe(true);
  });
  it("opens touching activities only when requested, keeping old gapless partitions", () => {
    const plan={...buildHouseInteriorPlan({mapId:"home",name:"home",seed:7,scale:"cottage2",program:"dwelling"}),width:11,height:12,openPlan:true,door:{x:7,y:9},innerDoors:[],rooms:[{id:"bed",theme:"bedroom",x:2,y:4,w:4,h:2},{id:"cook",theme:"kitchen",x:6,y:4,w:3,h:2},{id:"living",theme:"dining",x:2,y:6,w:7,h:4}]};
    const open=applyInteriorRoomLayer(createEmptyRoomMap(plan),plan,"walls").map;
    const closedPlan={...plan,openPlan:false};
    const closed=applyInteriorRoomLayer(createEmptyRoomMap(closedPlan),closedPlan,"walls").map;
    expect(open.lowerTiles[5*open.width+5]).toBe(72);
    expect(closed.lowerTiles[5*closed.width+5]).not.toBe(72);
  });
  it.each(["cream", "gold-brick", "stone-brick"].flatMap(wall => ["bookshelf", "cabinet", "stone_hearth_lit", "stone_hearth_unlit"].map(kitId => ({wall,kitId}))))("overlaps $kitId with $wall using its frozen graphic identity", ({wall,kitId}) => {
    const project=spaceCompilerFixture(), doc=fixtureDocument(project);
    const object=doc.library.objects["bed-design"]!;
    project.spatialAuthoring={...doc,library:{...doc.library,objects:{...doc.library.objects,
      "bed-design":{...object,graphic:{...object.graphic,kitId}}}}};
    const input=reinstantiateSpace(project,space=>({...space,wall,objectSlots:[{...space.objectSlots[0]!,quantity:1}]}));
    const built=compileSpatialOccurrence(input,{occurrenceId:spaceRoot});
    const child=Object.values(fixtureDocument(built).occurrences).find(o=>o.parentId===spaceRoot)!;
    expect(child.bindings[0]!.rect.y).toBe(["bookshelf", "cabinet"].includes(kitId) ? 3 : 2); // Hearth: two wall rows; bookshelf: one.
    expect(child.bindings[0]!.rect.height).toBe(kitId === "cabinet" ? 2 : 3);
    expect(deserialize(serialize(built)).spatialAuthoring).toEqual(built.spatialAuthoring);
  });
  it("round-trips live and frozen zones, paints different floors without a partition", () => {
    const project = deserialize(serialize(zoned()));
    const source = own(fixtureDocument(project).library.spaces, spaceDesign);
    expect(source.environment === "interior" && source.zones?.length).toBe(2);
    const {map, floor} = spaceLayout(project, source, {mapId:"zoned", seed:7});
    expect(map.lowerTiles[8 * map.width + 4]).toBe(12);
    expect(map.lowerTiles[9 * map.width + 4]).toBe(72);
    expect(floor[8 * map.width + 4] && floor[9 * map.width + 4]).toBe(true);
    const proposal = compileSpatialOccurrence(project, {occurrenceId:spaceRoot});
    const doc = fixtureDocument(proposal);
    const children = Object.values(doc.occurrences).filter(o => o.parentId === spaceRoot);
    expect(children).toHaveLength(2);
    for (const child of children) {
      const rect = child.bindings[0]!.rect;
      expect(rect.x).toBeGreaterThanOrEqual(2); expect(rect.x + rect.width).toBeLessThanOrEqual(8);
      expect(rect.y).toBeGreaterThanOrEqual(4); expect(rect.y + rect.height).toBeLessThanOrEqual(9);
    }
    expect(deserialize(serialize(proposal)).spatialAuthoring).toEqual(proposal.spatialAuthoring);
  });
  it.each(["overlap", "outside", "unknown"])("rejects %s zone inputs rather than silently moving furniture", fault => {
    const project = zoned();
    const raw = JSON.parse(serialize(project));
    const space = raw.spatialAuthoring.library.spaces[spaceDesign];
    if (fault === "overlap") space.zones[1].y = 4;
    if (fault === "outside") space.zones[0].x = -1;
    if (fault === "unknown") space.objectSlots[0].zoneId = "missing";
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
  });
  it("uses one small common table for meals and study in a tiny generated home", () => {
    const plan=buildHouseInteriorPlan({mapId:"home",name:"home",seed:7,scale:"cottage3",program:"study"});
    const bound=bindSeedHouseInteriorPlan(plan,createBlankProject(),"study");
    const tables=Object.values(bound.concept!.rooms).flatMap(r=>r.things).filter(t=>["home_table","table_chairs","dining_table","reading_table","study_desk"].includes(t.objectId));
    expect(tables).toHaveLength(1); expect(tables[0]!.objectId).toBe("home_table");
    expect(bound.width * bound.height).toBeLessThan(220);
  });
  it("defaults small domestic houses to continuous floor, preserving private/public programs", () => {
    const args = {mapId:"home",name:"home",seed:7,scale:"cottage-l" as const};
    const home = buildHouseInteriorPlan({...args,program:"dwelling"});
    expect(home.innerDoors).toEqual([]);
    const mask = floorMaskFromPlan(home);
    expect(mask[8 * home.width + 4] && mask[9 * home.width + 4]).toBe(true);
    expect(buildHouseInteriorPlan({...args,program:"inn"}).innerDoors!.length).toBeGreaterThan(0);
  });
});
