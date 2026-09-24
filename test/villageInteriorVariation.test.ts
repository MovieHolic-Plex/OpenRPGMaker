import { describe, expect, it } from "vitest";
import { createHouseInteriorMap, houseProgramForOwner, type HouseExteriorHint } from "@/editor/houseInteriors";
import type { InteriorRoomPlan, RoomSpec } from "@/editor/interiorRoomPipeline";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

const plan = (map: GameMap) => map.roomHarnessPlan!.plan as InteriorRoomPlan;

/** Furniture tile multiset of a room, wall face rows included. */
function furniture(map: GameMap, room: RoomSpec): string {
  const tiles: number[] = [];
  for (let y = room.y - 2; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
    const tile = map.upperTiles[y * map.width + x]!;
    if (tile >= 0) tiles.push(tile);
  }
  return tiles.sort((a, b) => a - b).join(",");
}

describe("house interiors — role and seed variation", () => {
  it("reads the owner's trade into an interior program", () => {
    expect(houseProgramForOwner("늙은 어부 바란")).toBe("workshop");
    expect(houseProgramForOwner("수습 선원")).toBe("workshop");
    expect(houseProgramForOwner("등대지기 에릭")).toBe("study");
    expect(houseProgramForOwner("약초꾼 은선")).toBe("study");
    expect(houseProgramForOwner("여관 주인 헬가")).toBe("inn");
    expect(houseProgramForOwner("잡화상 바란")).toBe("shop");
    expect(houseProgramForOwner("카이")).toBeUndefined();
  });

  it("builds the village's houses from their owners' trades instead of the plaza-order shop lottery", () => {
    const context: ToolContext = { project: createEmptyToolProject("probe") };
    const owners = ["늙은 어부 바란", "등대지기 에릭", "여관 주인 헬가", "잡화상 도린", "카이", "엘렌"];
    const result = runTool(context, "author_village", {
      target: { kind: "new", mapId: "v", name: "v", width: 64, height: 40 },
      houseCount: 6, seed: 3, morphology: "street", countPolicy: "exact", forestDensity: "normal", theme: "눈 덮인 항구", npcCount: 0,
      housePlans: owners.map((ownerName) => ({ ownerName })),
    });
    expect(result.ok, result.summary).toBe(true);
    const rooms = (owner: string) => {
      const map = Object.values(context.project.maps).find((m) => m.name.startsWith(`${owner}의 집 내부`));
      expect(map, owner).toBeDefined();
      return (plan(map!).rooms ?? []).map((room) => room.id);
    };
    expect(rooms("늙은 어부 바란")).toContain("work");
    expect(rooms("등대지기 에릭")).toContain("study");
    expect(rooms("여관 주인 헬가")).toContain("tavern");
    expect(rooms("잡화상 도린")).toContain("shop");
  }, 60_000);

  it("gives a house's second bedroom its own furniture instead of a copy of the first", () => {
    const context: ToolContext = { project: createEmptyToolProject("probe") };
    runTool(context, "create_map", { id: "m", name: "m", width: 20, height: 20 });
    let pairs = 0;
    const exteriors: HouseExteriorHint[] = [
      { stories: 2, templateId: "rect-2f", program: "dwelling" },
      { stories: 2, templateId: "rect-2f", program: "inn" },
      { stories: 1, templateId: "rect", program: "inn" },
    ];
    for (const [i, exterior] of exteriors.entries()) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const id = `map_b${i}_${seed}`;
      const result = createHouseInteriorMap({ project: context.project, id, name: id, returnMapId: "m", returnX: 1, returnY: 1, exitEventId: `ev_${id}`, seed, exterior });
      for (const { map } of result.floors) {
        const bedrooms = (plan(map).rooms ?? []).filter((room) => room.theme === "bedroom");
        for (let a = 0; a < bedrooms.length; a += 1) for (let b = a + 1; b < bedrooms.length; b += 1) {
          if (bedrooms[a]!.w !== bedrooms[b]!.w || bedrooms[a]!.h !== bedrooms[b]!.h) continue;
          pairs += 1;
          expect(furniture(map, bedrooms[a]!), `${map.id} ${bedrooms[a]!.id}/${bedrooms[b]!.id}`).not.toBe(furniture(map, bedrooms[b]!));
        }
      }
    }
    expect(pairs).toBeGreaterThan(10);
  });

  it("does not stamp one floor plan for every ordinary home: the seed mirrors the layout", () => {
    const context: ToolContext = { project: createEmptyToolProject("probe") };
    runTool(context, "create_map", { id: "m", name: "m", width: 20, height: 20 });
    const layouts = new Set<string>();
    for (let seed = 1; seed <= 16; seed += 1) {
      const id = `map_d${seed}`;
      const result = createHouseInteriorMap({ project: context.project, id, name: id, returnMapId: "m", returnX: 1, returnY: 1, exitEventId: `ev_${id}`, seed, exterior: { stories: 1, templateId: "rect" } });
      layouts.add(JSON.stringify((plan(result.map).rooms ?? []).map((room) => [room.x, room.y, room.w, room.h])));
    }
    expect(layouts.size).toBeGreaterThan(1);
  });
});
