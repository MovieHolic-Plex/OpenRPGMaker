import { describe, expect, it } from "vitest";
import { TOOL_CATEGORIES } from "@/editor/panels/toolBrowserModal";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import { allTools } from "@/editor/tools/toolRegistry";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";

interface VillageData {
  readonly mapId: string;
  readonly housesBuilt: number;
  readonly doorsConnected: number;
  readonly roadComponents: number;
  readonly npcCount: number;
}

interface VillageSnapshot {
  readonly lowerTiles: readonly number[];
  readonly upperTiles: readonly number[];
  readonly events: readonly { readonly x: number; readonly y: number }[];
}

function villageData(value: unknown): VillageData {
  if (!isVillageData(value)) throw new Error(`build_village data shape mismatch: ${JSON.stringify(value)}`);
  return value;
}

function isVillageData(value: unknown): value is VillageData {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return typeof Reflect.get(value, "mapId") === "string"
    && typeof Reflect.get(value, "housesBuilt") === "number"
    && typeof Reflect.get(value, "doorsConnected") === "number"
    && typeof Reflect.get(value, "roadComponents") === "number"
    && typeof Reflect.get(value, "npcCount") === "number";
}

function buildVillage(seed: number): { readonly context: ToolContext; readonly data: VillageData; readonly snapshot: VillageSnapshot } {
  const context: ToolContext = { project: createEmptyToolProject("마을 테스트") };
  const result = runTool(context, "build_village", { seed });
  expect(result.ok, result.summary).toBe(true);
  const data = villageData(result.data);
  const map = context.project.maps[data.mapId];
  expect(map, data.mapId).toBeTruthy();
  return {
    context,
    data,
    snapshot: {
      lowerTiles: [...map.lowerTiles],
      upperTiles: [...map.upperTiles],
      events: map.events.map((event) => ({ x: event.x, y: event.y })),
    },
  };
}

describe("build_village", () => {
  it("빈 프로젝트에서 seed만으로 50x50 마을을 완성한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    expect(map.width).toBe(50);
    expect(map.height).toBe(50);
    expect(data.housesBuilt).toBe(8);
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
    expect(data.npcCount).toBe(10);
    // 문 타일 무결성: 진입로가 집을 관통해 문을 덮으면 146 개수가 줄어든다 (회귀 방지).
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
    expect(map.lowerTiles.filter((tile) => tile === 116)).toHaveLength(8);
  });

  it("기본 시드에서도 문 8개가 전부 온전하다 (진입로 관통 회귀)", () => {
    const { context, data } = buildVillage(1);
    const map = context.project.maps[data.mapId];
    expect(map.lowerTiles.filter((tile) => tile === 146)).toHaveLength(8);
    expect(data.doorsConnected).toBe(8);
    expect(data.roadComponents).toBe(1);
  });

  it("같은 seed는 타일과 이벤트 좌표가 같고 다른 seed는 하위 타일이 달라진다", () => {
    const first = buildVillage(7).snapshot;
    const second = buildVillage(7).snapshot;
    const different = buildVillage(8).snapshot;

    expect(second.lowerTiles).toEqual(first.lowerTiles);
    expect(second.upperTiles).toEqual(first.upperTiles);
    expect(second.events).toEqual(first.events);
    expect(different.lowerTiles).not.toEqual(first.lowerTiles);
  });

  it("하네싱 창문을 상위 레이어에 배치한다", () => {
    const { context, data } = buildVillage(7);
    const map = context.project.maps[data.mapId];
    expect(map.upperTiles.some((tile) => tile === 85 || tile === 87)).toBe(true);
  });

  it("기존 40x40 맵에는 시공하고 30x30 맵은 거부한다", () => {
    const context: ToolContext = { project: createBlankProject() };
    expect(runTool(context, "create_map", { id: "map_40", name: "기존 40", width: 40, height: 40 }).ok).toBe(true);
    const built = runTool(context, "build_village", { mapId: "map_40", seed: 7 });
    expect(built.ok, built.summary).toBe(true);
    expect(villageData(built.data).housesBuilt).toBe(8);

    expect(runTool(context, "create_map", { id: "map_30", name: "기존 30", width: 30, height: 30 }).ok).toBe(true);
    const rejected = runTool(context, "build_village", { mapId: "map_30", seed: 7 });
    expect(rejected.ok).toBe(false);
    expect(rejected.issues?.[0]?.code).toBe("map-too-small");
  });

  it("레지스트리와 툴 브라우저에 등록되고 runTool 경로로 실행된다", () => {
    expect(allTools().map((tool) => tool.name)).toContain("build_village");
    expect(TOOL_CATEGORIES.flatMap((category) => category.tools.map((tool) => tool.name))).toContain("build_village");

    const context: ToolContext = { project: createEmptyToolProject("레지스트리 테스트") };
    const result = runTool(context, "build_village", { seed: 13 });
    expect(result.ok, result.summary).toBe(true);
    expect(villageData(result.data).roadComponents).toBe(1);
  });
});
