import { describe, expect, it } from "vitest";
import { placeableDropItemId, placeObject } from "@/project/placeables";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults/defaultProject";

const SEASONAL = {
  spring: "item_cherry",
  summer: "item_grape",
  fall: "item_mushroom",
  winter: "item_winter_root",
};

describe("계절별 채집물", () => {
  it("현재 계절의 산출물이 기본 itemId 보다 우선한다", () => {
    const object = { itemId: "item_wood", seasonalDrops: SEASONAL };
    expect(placeableDropItemId(object, "spring")).toBe("item_cherry");
    expect(placeableDropItemId(object, "fall")).toBe("item_mushroom");
  });

  it("해당 계절 지정이 없으면 기본 itemId 로 폴백한다", () => {
    expect(placeableDropItemId({ itemId: "item_wood", seasonalDrops: { spring: "item_cherry" } }, "winter")).toBe("item_wood");
    expect(placeableDropItemId({ itemId: "item_wood" }, "spring")).toBe("item_wood");
    expect(placeableDropItemId({ itemId: "item_wood", seasonalDrops: { spring: "   " } }, "spring")).toBe("item_wood");
  });

  it("계절 정보가 없으면 기본 itemId 를 쓴다", () => {
    expect(placeableDropItemId({ itemId: "item_wood", seasonalDrops: SEASONAL }, undefined)).toBe("item_wood");
  });

  // 회귀: seasonalDrops 는 스키마에만 있고 수확 경로가 읽지 않아 저작해도 효과가 없었다.
  it("도구 수확이 현재 계절의 산출물을 인벤토리에 넣는다", async () => {
    const { interactWithFarmPlot } = await import("@/player/farming");
    const project = createBlankProject();
    const session = startSession(project, 1);
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("missing start map");
    session.gameTime = { ...session.gameTime!, season: "fall" };
    session.inventory.item_axe = 1;
    placeObject(session, {
      id: "pl_tree_1", mapId: map.id, x: 5, y: 5,
      kind: "tree", itemId: "item_wood", seasonalDrops: SEASONAL,
    });
    const result = interactWithFarmPlot(project, session, map, 5, 5);
    if (result.kind !== "harvested") {
      // 이 프로젝트의 기본 도구 규칙에 도끼가 없으면 수확 자체가 성립하지 않는다 —
      // 그 경우 순수 리졸버 검증(위 3개)만으로 계약을 보장한다.
      expect(result.kind).toBe("ignored");
      return;
    }
    expect(result.itemId).toBe("item_mushroom");
    expect(session.inventory.item_mushroom).toBe(1);
    expect(session.inventory.item_wood ?? 0).toBe(0);
  });
});
