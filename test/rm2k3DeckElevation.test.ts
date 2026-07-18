/**
 * RM2k3 식 데크 고상: wood floor 가장자리 4방향 + 층계만 진입.
 */
import { describe, expect, it } from "vitest";
import { canMove, getTileset, tileAt, tilePassability } from "@/project/collision";
import {
  RM2K3_WOOD_FLOOR_PASSABILITY,
  rm2k3WoodFloorPassFlag,
} from "@/project/defaults/chipsetMapping";
import { buildVillageShoppingStreetProject, VILLAGE_SHOPPING_STREET_MAP_ID } from "@/project/defaults/villageShoppingStreetBuild";
import { passageMarkForTile } from "@/project/tilesetPassage";

describe("RM2k3 wood floor edge passability", () => {
  it("assigns 4-dir flags to wood floor body and edges", () => {
    expect(rm2k3WoodFloorPassFlag(RM2K3_WOOD_FLOOR_PASSABILITY.body)).toEqual({
      up: true,
      down: true,
      left: true,
      right: true,
    });
    expect(rm2k3WoodFloorPassFlag(RM2K3_WOOD_FLOOR_PASSABILITY.edgeWest)?.left).toBe(false);
    expect(rm2k3WoodFloorPassFlag(RM2K3_WOOD_FLOOR_PASSABILITY.edgeEast)?.right).toBe(false);
    expect(rm2k3WoodFloorPassFlag(RM2K3_WOOD_FLOOR_PASSABILITY.edgeNorth)?.up).toBe(false);
    expect(rm2k3WoodFloorPassFlag(RM2K3_WOOD_FLOOR_PASSABILITY.edgeSouth)?.down).toBe(false);
  });

  it("applies edge flags on Combined Town tileset via harness", () => {
    const { project } = buildVillageShoppingStreetProject({ seed: 11, houses: 4 });
    const map = project.maps[VILLAGE_SHOPPING_STREET_MAP_ID]!;
    const ts = getTileset(project, map)!;
    expect(ts.passability[228].left).toBe(false);
    expect(ts.passability[228].right).toBe(true);
    expect(ts.passability[222].left).toBe(true);
    expect(passageMarkForTile(ts, 223)).toBe("x");
    // 돌계단: 밟는 ○ 전방향 (고상 분리는 데크 edge)
    expect(ts.passability[112]).toEqual({ up: true, down: true, left: true, right: true });
    expect(project.system.titleResourceId).toBe("rpg-zzu-title-field");
    expect(project.system.titleScreen?.backgroundResourceId).toBe("rpg-zzu-title-field");
  });
});

describe("village shopping street deck elevation", () => {
  it("blocks side entry onto deck except stair row (y=20,21)", () => {
    const { project } = buildVillageShoppingStreetProject({ seed: 11, houses: 4 });
    const map = project.maps[VILLAGE_SHOPPING_STREET_MAP_ID]!;

    // 데크 서측 가장자리 x=39, 비층계 y=15: 지면(38) ↔ 데크(39) 불가
    expect(canMove(project, map, 38, 15, 39, 15)).toBe(false);
    expect(canMove(project, map, 39, 15, 38, 15)).toBe(false);

    // 층계 y=20: 진입 가능
    expect(canMove(project, map, 38, 20, 39, 20)).toBe(true);
    expect(canMove(project, map, 39, 20, 38, 20)).toBe(true);

    // 층계 y=21 + 층계 칸 세로 이동
    expect(canMove(project, map, 38, 21, 39, 21)).toBe(true);
    expect(canMove(project, map, 38, 20, 38, 21)).toBe(true);
    expect(canMove(project, map, 37, 20, 38, 20)).toBe(true);

    // 데크 내부에서 가장자리 쪽으로는 이동 가능(동→서 내부)
    expect(canMove(project, map, 40, 15, 39, 15)).toBe(true);
  });

  it("tables and crates block passage; shop is on counter, chat on NPC", () => {
    const { project } = buildVillageShoppingStreetProject({ seed: 11, houses: 4 });
    const map = project.maps[VILLAGE_SHOPPING_STREET_MAP_ID]!;
    const ts = getTileset(project, map)!;

    // 탁자 234 등 상위 ×
    expect(passageMarkForTile(ts, 234)).toBe("x");
    expect(passageMarkForTile(ts, 237)).toBe("x");
    expect(passageMarkForTile(ts, 327)).toBe("x");
    // 꽃은 여전히 ★
    expect(passageMarkForTile(ts, 288)).toBe("star");

    // 카운터 칸(39+2, 10+3)=(41,13) 탁자 — 옆 칸에서 진입 불가
    const counter = tileAt(map, 41, 13);
    expect(counter.upper).toBeGreaterThanOrEqual(234);
    const pass = tilePassability(ts, counter.lower, counter.upper);
    expect(pass.up || pass.down || pass.left || pass.right).toBe(false);
    expect(canMove(project, map, 41, 14, 41, 13)).toBe(false);

    const counters = map.events.filter((e) => e.id.startsWith("ev_shop_counter_"));
    const npcs = map.events.filter((e) => e.id.startsWith("ev_shop_npc_"));
    expect(counters.length).toBe(3);
    expect(npcs.length).toBe(3);
    for (const c of counters) {
      const page = c.pages[0]!;
      expect(page.graphic.transparent).toBe(true);
      expect(page.commands.some((cmd) => cmd.kind === "shop")).toBe(true);
    }
    for (const n of npcs) {
      const page = n.pages[0]!;
      expect(page.graphic.transparent).not.toBe(true);
      expect(page.commands.some((cmd) => cmd.kind === "shop")).toBe(false);
      expect(page.commands.some((cmd) => cmd.kind === "text")).toBe(true);
    }
  });
});
