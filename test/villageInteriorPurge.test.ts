// 2026-09-24 연애 도그푸딩 romance-r2: author_village 재실행이 이전 마을 실내를 고아로 남겨
// unreachable-map 막힘 3건(빵집·잡화점·주민집 내부)이 났다. 재시공 정리의 회귀 고정.
import { describe, expect, it } from "vitest";
import { createVillageHouseInteriors } from "@/editor/tools/village/interiors";
import { findTreeNode } from "@/project/mapTree";
import type { BuiltHouse } from "@/editor/tools/village/constants";
import type { Project } from "@/project/types";
import type { Project } from "@/project/types";
import { preparedProject } from "./support/authorHouseFacadeFixture";

const HOUSE: BuiltHouse = {
  kitId: "blue-stone",
  templateId: "rect",
  bbox: { x: 3, y: 3, w: 8, h: 6 },
  doorAt: { x: 6, y: 8 },
  front: { x: 6, y: 9 },
  stories: 1,
  ownerName: "빵집",
};

describe("마을 실내 재시공 정리", () => {
  it("같은 마을을 다시 시공하면 이전 실내·문이 고아로 남지 않는다", () => {
    const project = preparedProject();
    const first = createVillageHouseInteriors(project, project.maps.m1!, [HOUSE], [], 7);
    expect(first).toHaveLength(1);
    const firstInteriorId = first[0]!.interiorMapId;
    expect(project.maps[firstInteriorId]).toBeDefined();

    const warnings: string[] = [];
    const second = createVillageHouseInteriors(project, project.maps.m1!, [HOUSE], [], 7, warnings);
    expect(second).toHaveLength(1);
    expect(warnings.join(" ")).toContain("이전 마을 실내 정리");

    // 실내가 중복(_2 접미사)으로 늘어나지 않는다 — 옛 실내는 정리되고 새 실내만 남는다.
    expect(Object.keys(project.maps).filter((id) => id.startsWith("map_house_interior"))).toEqual([second[0]!.interiorMapId]);
    // 맵 트리에도 고아 실내 노드가 없다.
    const m1Node = findTreeNode(project.mapTree, "m1")!;
    expect(m1Node.children.map((child) => child.mapId)).toEqual([second[0]!.interiorMapId]);
    // 문 이벤트는 옛 step 없이 하나이고, 실내로 transfer 한다.
    const doors = project.maps.m1!.events.filter((event) => event.id.startsWith("ev_house_door"));
    expect(doors).toHaveLength(2); // 문 + 문 앞 발판
    const targets = JSON.stringify(doors);
    expect(targets).toContain(second[0]!.interiorMapId);
    if (firstInteriorId !== second[0]!.interiorMapId) expect(targets).not.toContain(firstInteriorId);
  });

  it("author_house 실내(맵 id 로 시작하는 문)는 마을 재시공 정리에 걸리지 않는다", () => {
    const project = preparedProject();
    const authoredId = "map_house_interior_m1_kit_6_8";
    project.maps[authoredId] = {
      id: authoredId,
      name: "직접 지은 집 내부",
      width: 13,
      height: 10,
      tilesetId: project.maps.m1!.tilesetId,
      tileSize: 32,
      lowerTiles: new Array<number>(13 * 10).fill(1),
      upperTiles: new Array<number>(13 * 10).fill(0),
      events: [],
    };
    const m1Node = findTreeNode(project.mapTree, "m1")!;
    m1Node.children.push({ mapId: authoredId, children: [] });
    project.maps.m1!.events.push({
      id: "ev_house_door_m1_kit_6_8",
      x: 6,
      y: 8,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "p",
        conditions: [],
        priority: "below",
        trigger: { kind: "action" },
        commands: [{ kind: "transfer", mapId: authoredId, x: 6, y: 6, fade: "black" }],
      }],
    } as never);

    createVillageHouseInteriors(project, project.maps.m1!, [HOUSE], [], 7);

    expect(project.maps[authoredId]).toBeDefined();
    expect(project.maps.m1!.events.some((event) => event.id === "ev_house_door_m1_kit_6_8")).toBe(true);
    // 마을 실내는 새로 생겼다.
    expect(Object.keys(project.maps).some((id) => id.startsWith("map_house_interior") && id !== authoredId)).toBe(true);
  });
});
