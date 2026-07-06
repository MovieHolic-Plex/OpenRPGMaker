// 맵 관리·조회 툴 확장 계약(2026-07-05): get_event / set_map_properties / resize_map
// / remove_map(파괴적) / rename_variable.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";

function ctxWithMap(width = 12, height = 12): { context: ToolContext; mapId: string } {
  const context: ToolContext = { project: createBlankProject() };
  const created = runTool(context, "create_map", { name: "관리 테스트", width, height, id: "map_mgmt" });
  expect(created.ok, created.summary).toBe(true);
  return { context, mapId: "map_mgmt" };
}

describe("get_event", () => {
  it("이벤트 전체 정의를 돌려주고, 없으면 보유 목록을 안내한다", () => {
    const { context, mapId } = ctxWithMap();
    expect(runTool(context, "place_npc", { mapId, x: 3, y: 3, name: "주민", pages: [{ lines: ["안녕"] }], id: "ev_npc" }).ok).toBe(true);
    const result = runTool(context, "get_event", { mapId, eventId: "ev_npc" });
    expect(result.ok, result.summary).toBe(true);
    const event = (result.data as { event: { id: string; pages: unknown[] } }).event;
    expect(event.id).toBe("ev_npc");
    expect(event.pages.length).toBeGreaterThan(0);
    const missing = runTool(context, "get_event", { mapId, eventId: "ghost" });
    expect(missing.ok).toBe(false);
    expect(missing.summary).toContain("ev_npc");
  });
});

describe("set_map_properties", () => {
  it("이름/인카운트율/트룹을 설정하고, 없는 트룹은 거부한다", () => {
    const { context, mapId } = ctxWithMap();
    const troopId = context.project.database.troops[0]?.id;
    expect(troopId).toBeDefined();
    const result = runTool(context, "set_map_properties", { mapId, name: "안개 골짜기", encounterRate: 3, troopIds: [troopId] });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    expect(map.name).toBe("안개 골짜기");
    expect(map.encounterRate).toBe(3);
    expect(map.troopIds).toEqual([troopId]);
    expect(runTool(context, "set_map_properties", { mapId, troopIds: ["troop_ghost"] }).ok).toBe(false);
  });
});

describe("resize_map", () => {
  it("확장부는 잔디로 채우고 기존 타일은 보존한다", () => {
    const { context, mapId } = ctxWithMap(8, 8);
    runTool(context, "paint_tiles", { mapId, layer: "lower", mode: "cells", tile: TILE.WATER, cells: [{ x: 2, y: 2 }] });
    const result = runTool(context, "resize_map", { mapId, width: 14, height: 10 });
    expect(result.ok, result.summary).toBe(true);
    const map = context.project.maps[mapId];
    expect(map.width).toBe(14);
    expect(map.lowerTiles[2 * 14 + 2]).toBe(TILE.WATER); // 기존 타일 보존.
    expect(map.lowerTiles[5 * 14 + 12]).toBe(TILE.GRASS); // 확장부 잔디.
  });

  it("축소로 이벤트가 밖에 나가면 거부한다", () => {
    const { context, mapId } = ctxWithMap(12, 12);
    expect(runTool(context, "place_npc", { mapId, x: 9, y: 9, name: "구석 주민", pages: [{ lines: ["!"] }], id: "ev_corner" }).ok).toBe(true);
    const result = runTool(context, "resize_map", { mapId, width: 6, height: 6 });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("ev_corner");
  });
});

describe("remove_map", () => {
  it("일반 맵은 삭제되고 맵 트리에서도 사라진다", () => {
    const { context } = ctxWithMap();
    runTool(context, "create_map", { name: "지울 맵", width: 6, height: 6, id: "map_doomed" });
    const result = runTool(context, "remove_map", { mapId: "map_doomed" });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.maps.map_doomed).toBeUndefined();
    expect(JSON.stringify(context.project.mapTree)).not.toContain("map_doomed");
  });

  it("시작 맵은 삭제를 거부한다", () => {
    const { context } = ctxWithMap();
    const startMapId = context.project.startMapId;
    const result = runTool(context, "remove_map", { mapId: startMapId });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("시작 맵");
  });
});

describe("rename_variable", () => {
  it("정의·세션·커맨드·조건의 변수 참조를 일괄 치환한다", () => {
    const { context, mapId } = ctxWithMap();
    const oldId = context.project.variables[0].id;
    context.project.variables[0].name = "용사 명성";
    // setVariable + fork 변수 조건 + 피연산자 참조를 가진 이벤트.
    expect(
      runTool(context, "upsert_event", {
        mapId,
        event: {
          id: "ev_var",
          x: 4,
          y: 4,
          pages: [
            {
              id: "p1",
              name: "본문",
              conditions: [],
              graphic: {},
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              trigger: { kind: "action" },
              commands: [
                { kind: "setVariable", variableId: oldId, op: "+=", value: { kind: "var", id: oldId } },
                { kind: "fork", condition: { kind: "variable", variableId: oldId, op: ">=", value: 5 }, then: [], else: [] },
              ],
            },
          ],
        },
      }).ok
    ).toBe(true);
    const result = runTool(context, "rename_variable", { fromName: "용사 명성", to: "var_fame" });
    expect(result.ok, result.summary).toBe(true);
    const replaced = (result.data as { replaced: number }).replaced;
    expect(replaced).toBeGreaterThanOrEqual(4); // 정의+세션+setVariable+피연산자+조건.
    const page = context.project.maps[mapId].events.find((event) => event.id === "ev_var")?.pages?.[0];
    const json = JSON.stringify(page);
    expect(json).toContain("var_fame");
    expect(json).not.toContain(`"${oldId}"`);
  });
});
