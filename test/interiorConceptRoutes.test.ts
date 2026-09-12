import { describe, expect, it } from "vitest";
import { bindInteriorConceptPlan } from "@/editor/interiorConceptPlan";
import { createHouseInteriorMap } from "@/editor/houseInteriors";
import { INTERIOR_ROOM_TILESET_ID, type InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { runTool } from "@/editor/tools/toolRunner";
import { runAuthorHouse } from "@/editor/tools/authorHouseFacade";
import { createVillageHouseInteriors } from "@/editor/tools/village/interiors";
import { cloneConceptFacilityTemplates } from "@/project/defaults/conceptFacilityTemplates";
import { deserialize, serialize } from "@/project/io";
import { preparedProject, exteriorSingle, requireHouseData } from "./support/authorHouseFacadeFixture";
import { isPassable } from "@/project/collision";
import { runWalkthrough, type WalkthroughStep } from "@/testing/walkthroughRunner";

function projectWithEditedHouse() {
  const project = preparedProject();
  const bundles = cloneConceptFacilityTemplates();
  const house = bundles.find(bundle => bundle.id === "house")!;
  house.facilities[0]!.label = "작은 서점";
  house.things = house.things.filter(thing => thing.id !== "bed_v");
  house.things.push({ id: "reading_clock", label: "내가 고른 시계", objectId: "clock", placeIds: ["bedroom"], chips: ["wall", "event"], required: true });
  project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = bundles;
  return project;
}
const roomArgs = {
  mapId: "concept_room", name: "작은 방", width: 16, height: 14,
  rooms: [{ id: "bedroom", x: 3, y: 4, w: 9, h: 6, theme: "bedroom" }],
  door: { x: 7, y: 9 }, seed: 7,
};
function planOf(map: { roomHarnessPlan?: { plan: unknown } }) {
  return map.roomHarnessPlan!.plan as InteriorRoomPlan;
}

describe("all AI interior routes consume concept bundles", () => {
  it("author_house preserves authored inn flights and connects only the authored descent on each floor", () => {
    const ctx = { project: preparedProject() };
    // 저작된 여관만 도면 정본이다 — 초안 그대로면 씨앗(절차 도면)으로 간다. 구조를 한 끗 바꿔 저작본으로 만든다.
    const bundles = cloneConceptFacilityTemplates();
    const innBundle = bundles.find(bundle => bundle.id === "inn")!;
    innBundle.places.find(place => place.id === "pantry")!.size = "m";
    ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = bundles;
    const result = runAuthorHouse(ctx, { ...exteriorSingle, interior: "linked-interior", ownerName: "Inn" });
    expect(result.ok, result.summary).toBe(true);
    const house = requireHouseData(result.data).houses[0]?.interior;
    if (!house) throw new Error("Linked interior missing");
    const ids = [house.interiorMapId, `${house.interiorMapId}_f2`, `${house.interiorMapId}_f3`];
    const maps = ids.map(id => {
      const map = ctx.project.maps[id];
      if (!map) throw new Error(`Missing floor ${id}`);
      return map;
    });
    const ground = maps[0];
    if (!ground) throw new Error("Ground floor missing");
    const groundDoor = planOf(ground).door;
    expect(ground.upperTiles[groundDoor.y * ground.width + groundDoor.x]).toBe(176);
    const steps: WalkthroughStep[] = [];
    for (const [index,map] of maps.entries()) {
      const flights = map.events.filter(event => event.id.includes("_main_stair_") || event.id.includes("_upper_stair_"));
      for (const flight of flights) for (const dy of [-2,-1,0]) {
        expect(map.lowerTiles.slice((flight.y+dy)*map.width+flight.x-1,(flight.y+dy)*map.width+flight.x+2)).toEqual([141,111,171]);
      }
      if (index > 0) {
        const stairIndices = map.upperTiles.flatMap((tile,index) => tile === 474 ? [index] : []);
        expect(stairIndices).toHaveLength(1);
        const stairIndex = stairIndices[0];
        if (stairIndex === undefined) throw new Error("Descent missing");
        const descent = map.events.find(event => event.x === stairIndex % map.width && event.y === Math.floor(stairIndex/map.width));
        expect(descent?.pages?.some(page => page.commands.some(command => command.kind === "transfer" && command.mapId === ids[index-1]))).toBe(true);
      }
    }
    ctx.project.startMapId = ground.id;
    ctx.project.startPos = { x: groundDoor.x, y: groundDoor.y-1 };
    for (const [from,to] of [[0,1],[1,2],[2,1],[1,0]] as const) {
      const map = maps[from];
      const target = maps[to];
      if (!map || !target) throw new Error("Route floor missing");
      const event = map.events.find(event => event.pages?.some(page => page.commands.some(command => command.kind === "transfer" && command.mapId === target.id)));
      if (!event) throw new Error("Floor transfer missing");
      for (const page of event.pages ?? []) for (const command of page.commands) {
        if (command.kind === "transfer") expect(isPassable(ctx.project,target,command.x,command.y)).toBe(true);
      }
      steps.push({expect:"mapId",mapId:map.id},{do:"moveTo",mapId:map.id,x:event.x,y:event.y+1},{do:"interact",eventId:event.id},{expect:"mapId",mapId:target.id});
    }
    const walkthrough = runWalkthrough(deserialize(serialize(ctx.project)),steps);
    expect(walkthrough.ok,walkthrough.failureReason).toBe(true);
  });

  it.each(["run_interior_room_pipeline", "start_interior_room_session"])("%s records edited concept contents before building", tool => {
    const ctx = { project: projectWithEditedHouse() };
    const result = runTool(ctx, tool, roomArgs, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const plan = planOf(ctx.project.maps.concept_room!);
    const things = plan.concept!.rooms.bedroom!.things;
    expect(things.some(thing => thing.objectId === "bed_v")).toBe(false);
    expect(things).toContainEqual(expect.objectContaining({ thingId: "reading_clock", required: true }));
    if (tool === "run_interior_room_pipeline") {
      expect(ctx.project.maps.concept_room!.events.some(event => event.id.includes("reading_clock"))).toBe(true);
    }
  });

  it("author_house uses edited facility layout, objects, and keeps its return transfer", () => {
    const ctx = { project: projectWithEditedHouse() };
    const house = ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find(bundle => bundle.id === "house")!;
    house.facilities[0]!.placeIds = ["bedroom", "living"];
    house.places.find(place => place.id === "bedroom")!.count = 2;
    const result = runAuthorHouse(ctx, { ...exteriorSingle, interior: "linked-interior", ownerName: "주민" });
    expect(result.ok, result.summary).toBe(true);
    const interior = requireHouseData(result.data).houses[0]!.interior!;
    const map = ctx.project.maps[interior.interiorMapId]!;
    expect(planOf(map).concept!.facilityLabel).toBe("작은 서점");
    expect(Object.values(planOf(map).concept!.rooms).map(room => room.placeId).sort()).toEqual(["bedroom", "bedroom", "living"]);
    expect(map.events.some(event => event.id.includes("reading_clock"))).toBe(true);
    expect(map.events.find(event => event.id === interior.exitEventId)?.pages?.[0]?.commands)
      .toContainEqual(expect.objectContaining({ kind: "transfer", mapId: "m1" }));
  });

  it("village-generated interiors consume the same edited bundle", () => {
    const project = projectWithEditedHouse();
    const refs = createVillageHouseInteriors(project, project.maps.m1!, [{
      kitId: "blue-stone", templateId: "rect", bbox: { x: 3, y: 3, w: 8, h: 6 },
      doorAt: { x: 6, y: 8 }, front: { x: 6, y: 9 }, stories: 1, ownerName: "주민",
    }], [], 7);
    expect(refs).toHaveLength(1);
    const map = Object.values(project.maps).find(map => map.id !== "m1")!;
    expect(planOf(map).concept!.facilityLabel).toBe("작은 서점");
    expect(map.events.some(event => event.id.includes("reading_clock"))).toBe(true);
  });

  it("linked manors use the authored manor and preserve the house fallback for older projects", () => {
    const project = projectWithEditedHouse();
    const input = {
      project, id: "manor_linked", name: "저택", returnMapId: "m1", returnX: 1, returnY: 1,
      exitEventId: "manor_exit", seed: 7, exterior: { stories: 1 as const, program: "manor" as const },
    };
    const manor = project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find(bundle => bundle.id === "manor")!;
    manor.facilities[0]!.label = "내 저택";
    // 구조가 초안과 달라야 저작본으로 인정된다 — 라벨만 바꾼 초안은 씨앗이다.
    manor.places.find(place => place.id === "salon")!.size = "m";
    const built = createHouseInteriorMap(input);
    expect(planOf(built.map).concept!.facilityLabel).toBe("내 저택");
    expect(Object.values(planOf(built.map).concept!.rooms).map(room => room.placeId)).toEqual(["suite", "study", "salon"]);
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.filter(bundle => bundle.id !== "manor");
    expect(planOf(createHouseInteriorMap(input).map).concept!.facilityLabel).toBe("작은 서점");
  });

  it("linked upper floors and serialized plans keep the authored contents", () => {
    const project = projectWithEditedHouse();
    const built = createHouseInteriorMap({
      project, id: "linked", name: "집", returnMapId: "m1", returnX: 1, returnY: 1,
      exitEventId: "exit", seed: 7, exterior: { stories: 2, program: "dwelling" },
    });
    expect(built.floors).toHaveLength(2);
    for (const floor of built.floors) {
      expect(planOf(floor.map).concept!.facilityLabel).toBe("작은 서점");
      project.maps[floor.mapId] = floor.map;
    }
    const loaded = deserialize(serialize(project));
    expect(planOf(loaded.maps.linked!).concept).toEqual(planOf(built.map).concept);
    expect(built.map.events.some(event => event.pages?.some(page => page.commands.some(command => command.kind === "transfer" && command.mapId === "linked_f2")))).toBe(true);
  });

  it("unknown facilities expose actual authored source plans for composition", () => {
    const ctx = { project: projectWithEditedHouse() };
    const result = runTool(ctx, "get_concept_facility", { query: "연금술 실험실" });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { template: unknown; sources: { facilityLabel: string; plan: { things: { id: string }[] } }[] };
    expect(data.template).toBeNull();
    const source = data.sources.find(source => source.facilityLabel === "작은 서점")!;
    expect(source.plan.things.some(thing => thing.id === "reading_clock")).toBe(true);
  });

  it("linking upper floors preserves the staircase drawn by the bundle", () => {
    const project = projectWithEditedHouse();
    const inn = project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles!.find(bundle => bundle.id === "inn")!;
    // A single-floor authored inn tests the exterior's additional-story request independently of defaults.
    inn.places = [{ id: "hall", label: "홀", role: "entrance", size: "l" }];
    inn.facilities[0]!.placeIds = ["hall"];
    inn.things = [{ id: "stairs", label: "연결 계단", objectId: "stairs_small", placeIds: ["hall"], chips: ["transfer"], required: true }];
    const input = { project, id: "inn_stairs", name: "여관", returnMapId: "m1", returnX: 1, returnY: 1, exitEventId: "exit", seed: 7 };
    const single = createHouseInteriorMap({ ...input, exterior: { program: "inn", stories: 1 } });
    const linked = createHouseInteriorMap({ ...input, exterior: { program: "inn", stories: 2 } });
    expect(linked.map.upperTiles).toEqual(single.map.upperTiles);
    const stairs = linked.map.events.filter(event => event.id.startsWith("ev_concept_inn_stairs_stairs_"));
    expect(stairs.length).toBeGreaterThan(0);
    expect(stairs.every(event => event.pages?.some(page => page.commands.some(command => command.kind === "transfer" && command.mapId === "inn_stairs_f2")))).toBe(true);
  });

  it("deleted bundles and unknown places cannot silently use legacy furniture", () => {
    const project = projectWithEditedHouse();
    const plan = { ...roomArgs, wings: [], theme: "unknown" , rooms: [{ ...roomArgs.rooms[0]!, theme: "unknown" }] };
    expect(() => bindInteriorConceptPlan(plan, project)).toThrow("get_concept_facility");
    project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [];
    const result = runTool({ project }, "run_interior_room_pipeline", roomArgs, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(project.maps.concept_room).toBeUndefined();
  });

  it("explicit room and plan materials take precedence over the concept default", () => {
    const project = projectWithEditedHouse();
    const base = { ...roomArgs, wings: [], theme: "kitchen", rooms: [{ ...roomArgs.rooms[0]!, theme: "kitchen" }] };
    expect(bindInteriorConceptPlan(base, project).rooms![0]!.floorTile).toBe(102);
    expect(bindInteriorConceptPlan({ ...base, floorTile: 12 }, project).rooms![0]!.floorTile).toBe(12);
    expect(bindInteriorConceptPlan({ ...base, floorTile: 12, rooms: [{ ...base.rooms[0]!, floorTile: 139 }] }, project).rooms![0]!.floorTile).toBe(139);
  });

  it("generic generation cannot bypass concept interiors", () => {
    const ctx = { project: projectWithEditedHouse() };
    const result = runTool(ctx, "generate_map", { id: "bypass", theme: "village", tilesetId: INTERIOR_ROOM_TILESET_ID, width: 20, height: 20 }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.issues?.some(issue => issue.code === "concept-interior-required")).toBe(true);
    expect(ctx.project.maps.bypass).toBeUndefined();
  });

  it("re-furnishing a room replaces only its generated interactions without duplicate ids", () => {
    const ctx = { project: projectWithEditedHouse() };
    const result = runTool(ctx, "run_interior_room_pipeline", {
      ...roomArgs, width: 25,
      rooms: [roomArgs.rooms[0], { ...roomArgs.rooms[0], id: "other", x: 13 }],
      innerDoors: [{ x: 12, y: 6 }],
    }, { dryRun: false });
    expect(result.ok, result.summary).toBe(true);
    const otherEvents = ctx.project.maps.concept_room!.events.filter(event => event.x >= 13);
    expect(otherEvents.some(event => event.id.includes("reading_clock"))).toBe(true);
    for (const seed of [8, 9]) {
      const reroll = runTool(ctx, "furnish_interior_space", { mapId: "concept_room", roomId: "bedroom", seed }, { dryRun: false });
      expect(reroll.ok, reroll.summary).toBe(true);
      const events = ctx.project.maps.concept_room!.events;
      expect(new Set(events.map(event => event.id)).size).toBe(events.length);
      expect(events.filter(event => event.id.includes("reading_clock"))).toHaveLength(2);
      expect(events.filter(event => event.x >= 13)).toEqual(otherEvents);
    }
  });

  it("author_house 는 interiorPlan 설계를 그대로 짓는다(템플릿 대신)", () => {
    const ctx = { project: preparedProject() };
    const result = runAuthorHouse(ctx, {
      ...exteriorSingle,
      interior: "linked-interior",
      ownerName: "주민",
      interiorPlan: {
        places: [{ id: "hall", label: "홀", role: "entrance", size: "l", floor: "plank" }],
        things: [{ objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true }],
      },
    });
    expect(result.ok, result.summary).toBe(true);
    const house = requireHouseData(result.data).houses[0]?.interior;
    if (!house) throw new Error("Linked interior missing");
    const plan = planOf(ctx.project.maps[house.interiorMapId]!);
    // 템플릿(민가 bedroom·kitchen·living)이 아니라 설계한 홀 하나가 선다.
    expect(Object.values(plan.concept!.rooms).map(room => room.placeId)).toEqual(["hall"]);
    expect(result.warnings ?? []).not.toContain(expect.stringContaining("설계하지 않아"));
  });

  it("author_house 는 설계 없이 지으면 템플릿 찍기를 경고로 되먹인다", () => {
    const ctx = { project: preparedProject() };
    const result = runAuthorHouse(ctx, { ...exteriorSingle, interior: "linked-interior", ownerName: "주민" });
    expect(result.ok, result.summary).toBe(true);
    const warnings = [...(result.warnings ?? []), ...(result.data.construction.warnings ?? [])];
    expect(warnings.some(line => line.includes("설계하지 않아"))).toBe(true);
  });

  it("new unknown facilities can be built by combining the returned sources", () => {
    const ctx = { project: projectWithEditedHouse() };
    const read = runTool(ctx, "get_concept_facility", { query: "시계 수리실" });
    const sources = (read.data as { sources: { facilityId: string; plan: { places: { id: string }[]; things: { placeIds: string[] }[] } }[] }).sources;
    const source = sources.find(source => source.facilityId === "house")!.plan;
    const plan = {
      places: source.places.filter(place => place.id === "bedroom"),
      things: source.things.filter(thing => thing.placeIds.includes("bedroom")).map(thing => ({ ...thing, placeIds: ["bedroom"] })),
    };
    const built = runTool(ctx, "place_concept", { query: "시계 수리실", mapId: "clock_shop", plan }, { dryRun: false });
    expect(built.ok, built.summary).toBe(true);
    expect(ctx.project.maps.clock_shop!.events.some(event => event.id.includes("reading_clock"))).toBe(true);
    ctx.project.tilesets[INTERIOR_ROOM_TILESET_ID]!.scratchConceptBundles = [];
    const empty = runTool(ctx, "place_concept", { query: "수리실", mapId: "empty_source", plan }, { dryRun: false });
    expect(empty.ok).toBe(false);
    expect(ctx.project.maps.empty_source).toBeUndefined();
  });
});
