import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

function ctx() {
  const context = { project: createBlankProject() } as ToolContext;
  return { context, mapId: context.project.startMapId };
}

describe("place_npc archetype movement inference", () => {
  it("infers random for roaming archetypes when movement is omitted", () => {
    const { context, mapId } = ctx();
    for (const [index, name] of ["장터 아이", "떠돌이 행상", "마을 개"].entries()) {
      const id = `npc_roam_${index}`;
      const result = runTool(context, "place_npc", {
        mapId, x: 1 + index * 3, y: 1, id, name, pages: [{ text: "어슬렁." }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === id)?.pages?.[0]?.movement.type).toBe("random");
      expect(((result.diff?.warnings ?? []) as readonly string[]).join("\n")).toContain("random(배회");
    }
  });

  it("keeps fixed for anchored archetypes when movement is omitted", () => {
    const { context, mapId } = ctx();
    for (const [index, name] of ["잡화점 주인", "북문 문지기", "마을 안내판"].entries()) {
      const id = `npc_anchor_${index}`;
      const result = runTool(context, "place_npc", {
        mapId, x: 1 + index * 3, y: 5, id, name, pages: [{ text: "어서 오게." }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.maps[mapId]?.events.find((e) => e.id === id)?.pages?.[0]?.movement.type).toBe("fixed");
    }
  });

  it("infers approach for stalker-named monsters when movement is omitted", () => {
    const { context, mapId } = ctx();
    const result = runTool(context, "place_npc", {
      mapId, x: 8, y: 8, id: "npc_stalker", name: "숲속 추격자",
      graphic: { query: "monster" }, pages: [{ text: "으르렁." }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_stalker")?.pages?.[0]?.movement.type).toBe("approach");
    expect(((result.diff?.warnings ?? []) as readonly string[]).join("\n")).toContain("approach(접근");
  });

  it("explicit movement always wins over inference", () => {
    const { context, mapId } = ctx();
    const pinned = runTool(context, "place_npc", {
      mapId, x: 12, y: 1, id: "npc_pinned", name: "장터 아이",
      movement: "fixed", pages: [{ text: "가만히." }],
    });
    expect(pinned.ok, pinned.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_pinned")?.pages?.[0]?.movement.type).toBe("fixed");
    const roamer = runTool(context, "place_npc", {
      mapId, x: 12, y: 5, id: "npc_roamer", name: "잡화점 주인",
      movement: "random", pages: [{ text: "돌아다녀." }],
    });
    expect(roamer.ok, roamer.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_roamer")?.pages?.[0]?.movement.type).toBe("random");
  });

  it("falls back to fixed for ambiguous names when movement is omitted", () => {
    const { context, mapId } = ctx();
    const result = runTool(context, "place_npc", {
      mapId, x: 14, y: 10, id: "npc_ambiguous", name: "나그네",
      pages: [{ text: "길을 묻는다." }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.id === "npc_ambiguous")?.pages?.[0]?.movement.type).toBe("fixed");
  });
});

describe("make_villager archetype movement inference", () => {
  it("infers random for roaming names and fixed for shopkeepers when omitted", () => {
    const { context, mapId } = ctx();
    const roam = runTool(context, "make_villager", {
      mapId, name: "장터 아이", home: { x: 2, y: 2 }, dialogue: [{ text: "놀자!" }],
    });
    expect(roam.ok, roam.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.pages?.[0]?.name === "장터 아이")?.pages?.[0]?.movement.type).toBe("random");

    const shop = runTool(context, "make_villager", {
      mapId, name: "대장간 주인", home: { x: 6, y: 6 }, dialogue: [{ text: "무기 봐라." }],
    });
    expect(shop.ok, shop.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.pages?.[0]?.name === "대장간 주인")?.pages?.[0]?.movement.type).toBe("fixed");
  });
});

describe("place_battle_blocker movement option", () => {
  it("defaults to fixed and accepts explicit random", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const troopId = context.project.database.troops[0]?.id;
    if (!troopId) throw new Error("troop missing");
    const guard = runTool(context, "place_battle_blocker", {
      mapId, x: 4, y: 4, id: "ev_guard", troopId,
    });
    expect(guard.ok, guard.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.id === "ev_guard")?.pages?.[0]?.movement.type).toBe("fixed");
    const patrol = runTool(context, "place_battle_blocker", {
      mapId, x: 8, y: 8, id: "ev_patrol", troopId, fightMovement: "random",
    });
    expect(patrol.ok, patrol.summary).toBe(true);
    expect(context.project.maps[mapId]?.events.find((e) => e.id === "ev_patrol")?.pages?.[0]?.movement.type).toBe("random");
  });
});

describe("make_hunting_ground chase default", () => {
  it("defaults chase to true and respects explicit false", () => {
    const context: ToolContext = { project: createBlankProject() };
    const mapId = context.project.startMapId;
    const troopId = context.project.database.troops[0]?.id;
    if (!troopId) throw new Error("troop missing");
    const first = runTool(context, "make_hunting_ground", {
      mapId, area: { x: 1, y: 1, w: 3, h: 3 }, troopId,
    });
    expect(first.ok, first.summary).toBe(true);
    expect(context.project.maps[mapId]?.fieldSpawns?.at(-1)?.chase).toBe(true);
    const second = runTool(context, "make_hunting_ground", {
      mapId, area: { x: 6, y: 6, w: 2, h: 2 }, troopId, chase: false,
    });
    expect(second.ok, second.summary).toBe(true);
    expect(context.project.maps[mapId]?.fieldSpawns?.at(-1)?.chase).toBe(false);
  });
});
