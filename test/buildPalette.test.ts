import { describe, expect, it, vi } from "vitest";
import * as llmClient from "@/ai/llmClient";
import {
  applyBuildPalettePrimitiveToProject,
  BUILD_PALETTE_PRESETS,
  ensureBuildPalettePresets,
  houseKitWingsFromSelection,
  validateHouseKitSelection,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { runTool } from "@/editor/tools";
import { createBlankMap, createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { projectLint } from "@/project/lint/projectLint";
import type { MapId, Project } from "@/project/types";

const MAP_ID = "map_blank_start";

function selection(patch: Partial<BuildPaletteSelection> = {}): BuildPaletteSelection {
  return { mapId: MAP_ID, x: 4, y: 4, width: 6, height: 5, ...patch };
}

function largeProject(width = 60, height = 60): Project {
  const project = createBlankProject();
  const map = createBlankMap("큰 맵", width, height);
  map.id = MAP_ID;
  project.maps = { [MAP_ID]: map } as Record<MapId, typeof map>;
  project.startMapId = MAP_ID;
  project.startPos = { x: 1, y: 1 };
  project.mapTree = { mapId: MAP_ID, children: [] };
  return project;
}

function inRect(point: { readonly x: number; readonly y: number }, rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}

describe("build palette house kit wings", () => {
  it("직사각/ㄱ자/ㄷ자 선택 영역을 하네싱 wings로 분해한다", () => {
    expect(houseKitWingsFromSelection(selection({ x: 2, y: 3, width: 8, height: 7 }), "rect")).toEqual([
      { x: 2, y: 3, w: 8, h: 7 },
    ]);
    expect(houseKitWingsFromSelection(selection({ x: 2, y: 3, width: 8, height: 8 }), "l")).toEqual([
      { x: 2, y: 3, w: 8, h: 5 },
      { x: 2, y: 3, w: 4, h: 8 },
    ]);
    expect(houseKitWingsFromSelection(selection({ x: 2, y: 3, width: 9, height: 8 }), "u")).toEqual([
      { x: 2, y: 3, w: 9, h: 5 },
      { x: 2, y: 3, w: 3, h: 8 },
      { x: 8, y: 3, w: 3, h: 8 },
    ]);
  });

  it("키트 최소 제약에 못 미치는 선택 영역은 툴 호출 전에 거부한다", () => {
    expect(validateHouseKitSelection(selection({ width: 2, height: 5 }), "rect")).toContain("3×5");
    expect(validateHouseKitSelection(selection({ width: 6, height: 4 }), "rect")).toContain("3×5");
    expect(validateHouseKitSelection(selection({ width: 5, height: 6 }), "l")).toContain("ㄱ자");
    expect(validateHouseKitSelection(selection({ width: 8, height: 6 }), "u")).toContain("ㄷ자");

    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ width: 2, height: 5 }), "house");
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("3×5");
    expect(result.toolResults).toHaveLength(0);
  });
});

describe("build palette deterministic stamps", () => {
  it("집 프리미티브가 시작 위치를 덮으면 무결성 오류를 사용자 메시지로 요약한다", () => {
    const project = createBlankProject();
    const result = applyBuildPalettePrimitiveToProject(
      project,
      selection({ x: project.startPos.x - 1, y: project.startPos.y - 2, width: 3, height: 5 }),
      "house"
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("시작 위치");
    expect(result.summary).not.toContain("커밋 거부");
    expect(result.toolResults.some((toolResult) => toolResult.issues?.some((issue) => issue.code === "start-position"))).toBe(true);
  });

  it("선재 무결성 오류가 있어도 무관한 영역의 시공은 허용한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles[project.startPos.y * map.width + project.startPos.x] = 120;
    const preexisting = projectLint(project).filter((issue) => issue.code === "start-position");
    expect(preexisting.length, "선재 오류가 심어져야 함").toBeGreaterThan(0);

    const result = applyBuildPalettePrimitiveToProject(project, selection({ x: 1, y: 1, width: 8, height: 6 }), "house");

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("하네싱");
  });

  it("선재 error가 있어도 커밋 거부 issues는 신규 blocking 오류만 담는다", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId];
    map.lowerTiles[project.startPos.y * map.width + project.startPos.x] = 120;
    map.lowerTiles[1 * map.width + 1] = 120;
    const preexistingCodes = projectLint(project).map((issue) => issue.code);
    expect(preexistingCodes).toContain("start-position");
    expect(preexistingCodes).not.toContain("transfer-impassable");

    const result = runTool({ project }, "upsert_event", {
      mapId,
      event: {
        id: "ev_bad_transfer",
        x: 2,
        y: 2,
        trigger: { kind: "action" },
        commands: [],
        pages: [{
          id: "ev_bad_transfer_page",
          name: "나쁜 전이",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "transfer", mapId, x: 1, y: 1, fade: "black" }],
        }],
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues?.map((issue) => issue.code)).toEqual(["transfer-impassable"]);
  });

  it("집 프리미티브는 build_house_kit를 호출하고 문 이벤트와 창문이 diff에 반영된다", () => {
    const chat = vi.spyOn(llmClient, "chatCompletion");
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 1, y: 1, width: 10, height: 6 }),
      "house",
      { houseShapeId: "rect", houseKitId: "blue-stone" }
    );
    expect(result.ok, result.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    expect(result.toolResults).toHaveLength(1);
    const toolResult = result.toolResults[0];
    expect(toolResult.summary).toContain("하네싱");
    expect(toolResult.diff?.tilesChanged).toBeGreaterThan(0);
    expect(toolResult.diff?.eventsAdded).toBeGreaterThan(0);
    expect(toolResult.diff?.mapsAdded).toBeGreaterThan(0);

    const data = toolResult.data as { readonly kitId: string; readonly doorAt: { readonly x: number; readonly y: number }; readonly wings: unknown };
    expect(data.kitId).toBe("blue-stone");
    expect(data.wings).toEqual([{ x: 1, y: 1, w: 10, h: 6 }]);
    const map = result.project.maps[MAP_ID];
    expect(map.lowerTiles[data.doorAt.y * map.width + data.doorAt.x]).toBe(146);
    expect(map.upperTiles.some((tile) => tile === 87)).toBe(true);
  });

  it("마을 프리미티브는 build_village(bounds)를 호출하고 감사 요약을 메시지에 포함한다", () => {
    const bounds = { x: 10, y: 10, w: 36, h: 36 };
    const result = applyBuildPalettePrimitiveToProject(
      largeProject(),
      selection({ x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h }),
      "village",
      { interior: false }
    );

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("마을 시공:");
    expect(result.summary).toContain("문 연결");
    expect(result.toolResults).toHaveLength(1);
    const data = result.toolResults[0].data as {
      readonly bounds: typeof bounds;
      readonly housesBuilt: number;
      readonly houses: readonly { readonly doorAt: { readonly x: number; readonly y: number }; readonly front: { readonly x: number; readonly y: number } }[];
    };
    expect(data.bounds).toEqual(bounds);
    expect(data.housesBuilt).toBeGreaterThan(0);
    expect(data.houses.every((house) => inRect(house.doorAt, bounds) && inRect(house.front, bounds))).toBe(true);
  });

  it("마을 프리미티브는 build_village 최소 영역과 같은 36×36 기준으로 사전 거부한다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 0, y: 0, width: 20, height: 15 }), "village");
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("36×36");
    expect(result.toolResults).toHaveLength(0);
  });

  it("지붕 프리미티브는 용마루→몸통→처마 3단으로 채운다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 2, y: 10, width: 4, height: 3 }), "roof");
    expect(result.ok, result.summary).toBe(true);
    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    expect(map.lowerTiles[at(2, 10)]).toBe(374);
    expect(map.lowerTiles[at(3, 11)]).toBe(375);
    expect(map.lowerTiles[at(2, 12)]).toBe(405);
    expect(map.lowerTiles[at(5, 12)]).toBe(405);
  });

  it("길과 강 프리미티브도 선택 영역 기반으로 결정론 시공하고 LLM을 호출하지 않는다", () => {
    const chat = vi.spyOn(llmClient, "chatCompletion");
    const pathed = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ y: 10, height: 3 }), "path");
    expect(pathed.ok, pathed.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    const pathMap = pathed.project.maps[MAP_ID];
    const pathMembers = new Set(pathed.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_PRESETS.path)?.tileIds ?? []);
    expect(pathMembers.has(pathMap.lowerTiles[11 * pathMap.width + 6])).toBe(true);

    const rivered = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 2, y: 2, width: 4, height: 3 }), "river");
    expect(rivered.ok, rivered.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    const riverMap = rivered.project.maps[MAP_ID];
    const waterMembers = new Set(rivered.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_PRESETS.water)?.tileIds ?? []);
    expect(waterMembers.has(riverMap.lowerTiles[3 * riverMap.width + 3])).toBe(true);
  });

  it("모래 오토타일 하네스 그룹은 기존 프로젝트 팔레트에서 user 어휘로 승격된다", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const sand = tileset.tileGroups?.find((group) => group.id === "harness-combined-town-sand-autotile");
    expect(sand).toBeTruthy();

    ensureBuildPalettePresets(tileset);

    expect(sand).toMatchObject({
      origin: "user",
      source: "user",
    });
  });
});
