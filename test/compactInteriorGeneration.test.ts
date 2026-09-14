import { bindSeedHouseInteriorPlan } from "@/editor/interiorConceptPlan";
import { createBlankProject } from "@/project/defaults";
import { describe, expect, it } from "vitest";
import { selectInteriorFurnishings } from "@/editor/interiorFurnishingPolicy";
import { buildHouseInteriorPlan } from "@/editor/houseInteriors";
import { runInteriorRoomPipeline, type InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { compactHousePlan } from "@/editor/compactHousePlan";
import type { ConceptOverlayThing } from "@/editor/conceptBundleResolve";
const thing = (id: string, objectId: string, required = false): ConceptOverlayThing => ({ thingId: id, objectId, label: id, chips: ["block"], required });
describe("compact interiors", () => {
  it("one dining assembly already supplies seating in a domestic room", () => {
    const items = [thing("extra", "table_chairs"), thing("meal", "dining_table", true), thing("books", "bookshelf")];
    expect(selectInteriorFurnishings(items, 40).map(t => t.thingId)).toEqual(["meal", "books"]);
    expect(items).toHaveLength(3);
  });
  it("competes similar heating and work surfaces, but not independent functions", () => {
    const items = [thing("heat", "stove", true), thing("extraHeat", "hearth"), thing("work", "table_long", true), thing("extraWork", "work_table"), thing("sales", "counter"), thing("food", "dining_table")];
    expect(selectInteriorFurnishings(items, 36).map(t => t.thingId)).toEqual(["heat", "work", "sales", "food"]);
  });
  it("preserves authored mandatory capacity, beds and inventory", () => {
    const items = [thing("a", "table_chairs", true), thing("b", "dining_table", true), thing("bedA", "bed_v"), thing("bedB", "bed_v"), thing("stockA", "crate"), thing("stockB", "crate")];
    expect(selectInteriorFurnishings(items, 20)).toEqual(items);
  });
  it("larger public floors can support additional automatic seating", () => {
    const items = [thing("a", "dining_table", true), thing("b", "table_chairs"), thing("c", "table_chairs")];
    expect(selectInteriorFurnishings(items, 120)).toHaveLength(2);
  });
  it("uses frozen graphic identities for opaque compiler keys and counts fixed furniture", () => {
    const items = [thing("opaque", "object-0")];
    expect(selectInteriorFurnishings(items, 35, () => "table_chairs", ["dining_table"])).toEqual([]);
    expect(selectInteriorFurnishings(items, 35, () => "bookshelf", ["dining_table"])).toEqual(items);
  });
  it("a home's dining, storage and corridor do not borrow public capacity or stairs", () => {
    const plan = buildHouseInteriorPlan({ mapId:"home",name:"home",seed:7,scale:"mansion",program:"dwelling" });
    const bound = bindSeedHouseInteriorPlan(plan, createBlankProject(), "dwelling");
    const dining = bound.concept!.rooms.dining!;
    expect(dining.placeId).toBe("living");
    expect(dining.things.filter(t => t.objectId === "home_table")).toHaveLength(1);
    expect(bound.concept!.rooms.hall!.things).toEqual([]);
    expect(bound.concept!.rooms.hall!.role).toBe("walkway");
  });
  it("does not mutate an explicit plan when producing a compact copy", () => {
    const plan = { rooms: [{id:"a",x:2,y:3,w:16,h:5},{id:"b",x:2,y:11,w:16,h:6}], wings:[], door:{x:10,y:16} } as unknown as InteriorRoomPlan;
    const before = structuredClone(plan); compactHousePlan(plan); expect(plan).toEqual(before);
  });
  for (const scale of ["cottage2", "cottage3", "cottage-l", "mansion"] as const) {
    it(`${scale}: compact seed geometry retains room access and complete walls`, () => {
      const plan = buildHouseInteriorPlan({mapId:"compact",name:"compact",seed:7,scale,program:"dwelling"});
      const area = plan.rooms!.reduce((n,r)=>n+r.w*r.h,0);
      expect(area).toBeLessThanOrEqual(scale === "mansion" ? 180 : 95);
      const result = runInteriorRoomPipeline(plan);
      expect(result.ok, JSON.stringify(result.warnings)).toBe(true);
    });
  }
});
