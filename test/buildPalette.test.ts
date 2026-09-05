import { describe, expect, it, vi } from "vitest";
import * as llmClient from "@/ai/llmClient";
import {
  applyBuildPalettePrimitiveToProject,
  BUILD_PALETTE_GROUP_IDS,
  ensureBuildPaletteTileGroups,
  houseKitWingsFromSelection,
  validateHouseKitSelection,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { runTool } from "@/editor/tools";
import { buildHouseKit } from "@/editor/tools/houseKitDomain";
import { captureHouseProtection, houseFootprintCells } from "@/editor/tools/houseProtection";
import { canMove, isPassableLanding } from "@/project/collision";
import { deserialize, serialize } from "@/project/io";
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
  it("집 프리미티브가 시작 위치를 덮으면 시공이 시작점을 복원하고 성공한다", () => {
    const project = createBlankProject();
    const before = structuredClone(project);
    const rect = selection({ x: project.startPos.x - 1, y: project.startPos.y - 2, width: 3, height: 5 });
    const expected = structuredClone(project);
    buildHouseKit(expected, {
      mapId: MAP_ID, kitId: "blue-stone", wings: houseKitWingsFromSelection(rect, "rect"),
      door: true, doorEvent: true, interior: true,
    });
    const result = applyBuildPalettePrimitiveToProject(project, rect, "house");

    expect(result.ok).toBe(true);
    expect(projectLint(result.project).some((issue) => issue.code === "start-position")).toBe(false);
    expect(result.toolResults.some((toolResult) => (toolResult.diff?.tilesChanged ?? 0) > 0)).toBe(true);
    expect(captureHouseProtection(result.project)).toEqual(captureHouseProtection(expected));
    expect(result.project.startPos).not.toEqual(before.startPos);
    expect(project.startPos).toEqual(before.startPos);
    const map = result.project.maps[MAP_ID];
    const start = result.project.startPos;
    const footprint = houseFootprintCells({ x: rect.x, y: rect.y, w: rect.width, h: rect.height }, map);
    expect(footprint).not.toContainEqual(start);
    expect(isPassableLanding(result.project, map, start.x, start.y)).toBe(true);
    expect([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) =>
      !footprint.some((cell) => cell.x === start.x + dx && cell.y === start.y + dy)
      && canMove(result.project, map, start.x, start.y, start.x + dx, start.y + dy))).toBe(true);

    const ctx = { project: deserialize(serialize(result.project)) };
    const accepted = serialize(ctx.project);
    const erase = { mapId: MAP_ID, rect: { x: rect.x, y: rect.y, w: 3, h: 5 } };
    const erased = runTool(ctx, "tile_erase", erase);
    expect(erased.ok).toBe(false);
    expect(erased.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(accepted);

    // Direct human painting remains allowed; AI must preserve those accepted values too.
    const painted = applyBuildPalettePrimitiveToProject(ctx.project, rect, "river");
    expect(painted.ok).toBe(true);
    expect(captureHouseProtection(painted.project)).not.toEqual(captureHouseProtection(expected));
    ctx.project = painted.project;
    const humanAccepted = serialize(ctx.project);
    expect(runTool(ctx, "tile_erase", erase).issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(humanAccepted);
  });

  it.each(["rect", "l", "u"] as const)("manual %s houses reserve the north ridge before choosing a safe start", (houseShapeId) => {
    const project = largeProject();
    project.startPos = { x: 14, y: 9 };
    const result = applyBuildPalettePrimitiveToProject(project, selection({ x: 10, y: 10, width: 9, height: 8 }), "house", { houseShapeId, interior: false });
    expect(result.ok, result.summary).toBe(true);
    expect(result.project.startPos).not.toEqual(project.startPos);
    const map = result.project.maps[MAP_ID];
    expect(houseFootprintCells({ x: 10, y: 10, w: 9, h: 8 }, map)).not.toContainEqual(result.project.startPos);
    expect(isPassableLanding(result.project, map, result.project.startPos.x, result.project.startPos.y)).toBe(true);
  });

  it("manual house start relocation rolls back if construction is rejected", () => {
    const project = largeProject();
    const rect = selection({ x: 10, y: 10, width: 6, height: 5 });
    buildHouseKit(project, {
      mapId: MAP_ID, kitId: "blue-stone", wings: houseKitWingsFromSelection(rect, "rect"),
      door: true, doorEvent: false, interior: false,
    });
    project.startPos = { x: 12, y: 12 };
    ensureBuildPaletteTileGroups(project.tilesets[DEFAULT_TILESET_ID]);
    const before = serialize(project);
    const result = applyBuildPalettePrimitiveToProject(project, rect, "house");
    expect(result.ok).toBe(false);
    expect(result.toolResults[0]?.issues?.[0]?.code).toBe("house-overlap");
    expect(result.project).toBe(project);
    expect(serialize(result.project)).toBe(before);
  });

  it("manual house placement fails atomically when no safe start exists outside its footprint", () => {
    const project = largeProject(10, 10);
    const map = project.maps[MAP_ID];
    map.lowerTiles.fill(120);
    project.startPos = { x: 4, y: 4 };
    map.lowerTiles[44] = 240;
    const before = serialize(project);
    const result = applyBuildPalettePrimitiveToProject(project, selection({ x: 3, y: 2, width: 3, height: 5 }), "house");
    expect(result.ok).toBe(false);
    expect(result.toolResults).toHaveLength(0);
    expect(result.project).toBe(project);
    expect(serialize(result.project)).toBe(before);
  });

  it("manual houses leave starts on another map unchanged", () => {
    const project = largeProject();
    const other = createBlankMap("Other", 60, 60);
    other.id = "other";
    project.maps.other = other;
    project.mapTree.children.push({ mapId: other.id, children: [] });
    project.startPos = { x: 12, y: 12 };
    const result = applyBuildPalettePrimitiveToProject(project, selection({ mapId: "other", x: 10, y: 10 }), "house");
    expect(result.ok, result.summary).toBe(true);
    expect(result.project.startMapId).toBe(MAP_ID);
    expect(result.project.startPos).toEqual(project.startPos);
  });

  it("AI author_house still rejects restoration that would carve its sealed house", () => {
    const ctx = { project: createBlankProject() };
    const before = serialize(ctx.project);
    const result = runTool(ctx, "author_house", {
      kind: "single", mapId: MAP_ID, kitId: "blue-stone", interior: "linked-interior", yard: [],
      wings: [{ x: ctx.project.startPos.x - 1, y: ctx.project.startPos.y - 2, w: 3, h: 5 }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues?.[0]?.code).toBe("protected-house-write");
    expect(serialize(ctx.project)).toBe(before);
  });

  it("선재 무결성 오류가 있어도 무관한 영역의 시공은 허용한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles[project.startPos.y * map.width + project.startPos.x] = 120;
    const preexisting = projectLint(project).filter((issue) => issue.code === "start-position");
    expect(preexisting.length, "선재 오류가 심어져야 함").toBeGreaterThan(0);

    const result = applyBuildPalettePrimitiveToProject(project, selection({ x: 1, y: 1, width: 8, height: 6 }), "house");

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("집");
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

  it("문 이벤트 토글을 끄면 문 이벤트 없이 외장만 시공한다", () => {
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 1, y: 1, width: 10, height: 6 }),
      "house",
      { houseShapeId: "rect", houseKitId: "blue-stone", doorEvent: false }
    );
    expect(result.ok, result.summary).toBe(true);
    expect(result.toolResults).toHaveLength(1);
    const data = result.toolResults[0].data as { houses: readonly { interior?: unknown }[] };
    expect(data.houses[0]!.interior).toBeUndefined();
    expect(Object.keys(result.project.maps)).toEqual(Object.keys(createBlankProject().maps));
    expect(result.project.maps[MAP_ID]!.events).toEqual([]);
  });

  it("내부 토글을 끄면 문 이벤트 없이 외장만 시공한다", () => {
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 1, y: 1, width: 10, height: 6 }),
      "house",
      { houseShapeId: "rect", houseKitId: "blue-stone", interior: false }
    );
    expect(result.ok, result.summary).toBe(true);
    const data = result.toolResults[0].data as { houses: readonly { interior?: unknown }[] };
    expect(data.houses[0]!.interior).toBeUndefined();
    expect(Object.keys(result.project.maps)).toEqual(Object.keys(createBlankProject().maps));
    expect(result.project.maps[MAP_ID]!.events).toEqual([]);
  });

  it("집 프리미티브는 author_house 정본을 호출하고 문 이벤트와 창문이 diff에 반영된다", () => {
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
    expect(toolResult.summary).toContain("집");
    expect(toolResult.diff?.tilesChanged).toBeGreaterThan(0);
    expect(toolResult.diff?.eventsAdded).toBeGreaterThan(0);
    expect(toolResult.diff?.mapsAdded).toBeGreaterThan(0);

    const data = toolResult.data as { readonly houses: readonly { readonly kitId: string; readonly wings: unknown; readonly doorAt: { readonly x: number; readonly y: number } | null }[] };
    const doorAt = data.houses[0]!.doorAt!;
    expect(data.houses[0]!.kitId).toBe("blue-stone");
    expect(data.houses[0]!.wings).toEqual([{ x: 1, y: 1, w: 10, h: 6 }]);
    const map = result.project.maps[MAP_ID];
    // 문 외형은 Object1 문 이벤트가 맡는다 — 문 칸에 타일 문(146)을 겹쳍 깔지 않고, 그 자리에 문 이벤트가 선다.
    expect(map.lowerTiles[doorAt.y * map.width + doorAt.x]).not.toBe(146);
    expect(map.events.some((event) => event.x === doorAt.x && event.y === doorAt.y)).toBe(true);
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
    expect(result.summary.replace(/\s+/g, " ")).toMatch(/마을 시공/);
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
    const pathMembers = new Set(pathed.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_GROUP_IDS.path)?.tileIds ?? []);
    expect(pathMembers.has(pathMap.lowerTiles[11 * pathMap.width + 6])).toBe(true);

    const rivered = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 2, y: 2, width: 4, height: 3 }), "river");
    expect(rivered.ok, rivered.summary).toBe(true);
    expect(chat).not.toHaveBeenCalled();
    const riverMap = rivered.project.maps[MAP_ID];
    const waterMembers = new Set(rivered.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_GROUP_IDS.water)?.tileIds ?? []);
    expect(waterMembers.has(riverMap.lowerTiles[3 * riverMap.width + 3])).toBe(true);
  });

  it("모래 오토타일 하네스 그룹은 기존 프로젝트 팔레트에서 user 어휘로 승격된다", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    const sand = tileset.tileGroups?.find((group) => group.id === "harness-combined-town-sand-autotile");
    expect(sand).toBeTruthy();

    ensureBuildPaletteTileGroups(tileset);

    expect(sand).toMatchObject({
      origin: "user",
      source: "user",
    });
  });

  it("build palette group setup leaves palette presets untouched and is idempotent", () => {
    const tileset = createBlankProject().tilesets[DEFAULT_TILESET_ID];
    tileset.palettePresets = [{
      id: "pp_keep",
      name: "Keep",
      origin: "user",
      slots: [{ role: "ground", tileIds: [1] }],
    }];
    const presetBefore = structuredClone(tileset.palettePresets);
    const missingGroupId = BUILD_PALETTE_GROUP_IDS.prop;
    tileset.tileGroups = tileset.tileGroups?.filter((group) => group.id !== missingGroupId);

    ensureBuildPaletteTileGroups(tileset);
    const afterFirst = structuredClone(tileset.tileGroups);
    ensureBuildPaletteTileGroups(tileset);

    expect(tileset.palettePresets).toEqual(presetBefore);
    expect(tileset.tileGroups).toEqual(afterFirst);
    expect(tileset.tileGroups?.some((group) => group.id === missingGroupId)).toBe(false);
  });
});
