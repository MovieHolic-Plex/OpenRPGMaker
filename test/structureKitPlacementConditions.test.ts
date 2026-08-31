import { describe, expect, it } from "vitest";

import { createEmptyToolProject, runTool } from "@/editor/tools";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { TILE } from "@/project/defaults/constants";
import { blockedFlag, passableFlag } from "@/project/tilesetPassage";
import type { PlacementSurfaceCondition, Project, StructureKitDef } from "@/project/types";

/**
 * 배치 조건이 **실제로 집행되는지**.
 *
 * 사람이 팔레트로 찍는 경로(TilePaintEngine)는
 * (`checkKitStampConditions` → `evaluatePlacementConditions`)를 쓴다 — 그쪽 스트로크·안내 규칙은
 * test/structureKitBrushConditions.test.ts 가 본다. AI 도구 stamp_structure_kit 은 시공 자체가 거부된다.
 */

/** 화덕처럼 «북쪽 벽에 등을 대는» 1×2 세로쌍 킷. */
const STOVE_CONDITION: PlacementSurfaceCondition = {
  id: "pc_north_wall",
  strength: "hard",
  zone: "againstWall",
  facing: "north",
};

const WALL_TILE = 300;
const FLOOR_TILE = 400;
const KIT_TOP = 21;
const KIT_BOTTOM = 51;

function projectWithStoveKit(conditions: readonly PlacementSurfaceCondition[]): {
  readonly project: Project;
  readonly mapId: string;
} {
  const project = createEmptyToolProject("배치 조건 테스트");
  const context = { project };
  runTool(context, "create_map", { name: "주방", width: 10, height: 8 });
  const mapId = Object.keys(context.project.maps)[0]!;
  const map = context.project.maps[mapId]!;
  const tileset = context.project.tilesets[map.tilesetId]!;

  // 통행 플래그로 벽·바닥을 정의한다 — 배치 면 판정은 타일 그림이 아니라 통행을 본다.
  tileset.passability[WALL_TILE] = blockedFlag();
  tileset.passability[FLOOR_TILE] = passableFlag();
  tileset.priority[WALL_TILE] = "lower";
  tileset.priority[FLOOR_TILE] = "lower";

  // 맵 전체를 바닥으로 깔고 y=2 행 하나만 벽으로 만든다.
  map.lowerTiles.fill(FLOOR_TILE);
  // 상위 레이어는 반드시 EMPTY(-1) — 0 은 실제 타일이고, tilePassability 는 상위가 있으면
  // 하위 통행을 **덮어쓴다**. 0 으로 채우면 바닥 전체가 통행 불가로 읽힌다.
  map.upperTiles.fill(TILE.EMPTY);
  for (let x = 0; x < map.width; x += 1) map.lowerTiles[2 * map.width + x] = WALL_TILE;

  const kit: StructureKitDef = {
    id: "kit_stove",
    kind: "section",
    name: "화덕",
    width: 1,
    height: 2,
    rows: [{ tiles: [KIT_TOP] }, { tiles: [KIT_BOTTOM] }],
    learnedFrom: "db-authored",
    ai: {
      description: "돌 화덕",
      placementRules: "부엌 북쪽 벽에 붙인다",
      placement: [...conditions],
    },
  };
  tileset.structureKits = [kit];
  return { mapId, project: context.project };
}

describe("stamp_structure_kit — 배치 조건 집행", () => {
  it("조건에 맞는 자리(발밑이 벽 아래 바닥)에는 찍힌다", () => {
    const { project, mapId } = projectWithStoveKit([STOVE_CONDITION]);
    const context = { project };
    const before = [...context.project.maps[mapId]!.lowerTiles];
    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_stove",
      origin: { x: 4, y: 2 },
      repeat: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("사람 팔레트");
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });

  it("북쪽이 벽이 아닌 자리에서는 **거부한다** — 한 칸도 쓰지 않는다", () => {
    const { project, mapId } = projectWithStoveKit([STOVE_CONDITION]);
    const context = { project };
    const before = [...context.project.maps[mapId]!.lowerTiles];
    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_stove",
      origin: { x: 4, y: 5 },
      repeat: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("사람 팔레트");
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });

  it("반복 시공 중 하나라도 위반하면 전부 거부한다 — 반쯤 찍힌 상태를 남기지 않는다", () => {
    const { project, mapId } = projectWithStoveKit([STOVE_CONDITION]);
    const map = project.maps[mapId]!;
    for (let x = 5; x < map.width; x += 1) map.lowerTiles[2 * map.width + x] = FLOOR_TILE;
    const context = { project };
    const before = [...map.lowerTiles];

    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_stove",
      origin: { x: 3, y: 2 },
      repeat: 4,
    });
    expect(result.ok).toBe(false);
    expect(context.project.maps[mapId]!.lowerTiles).toEqual(before);
  });

  it("soft 조건은 막지 않고 요약에 경고만 남긴다", () => {
    const { project, mapId } = projectWithStoveKit([{ ...STOVE_CONDITION, strength: "soft" }]);
    const context = { project };
    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_stove",
      origin: { x: 4, y: 5 },
      repeat: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("사람 팔레트");
  });

  it("조건이 없는 킷은 예전처럼 아무 자리에나 찍힌다 — 하위 호환", () => {
    const { project, mapId } = projectWithStoveKit([]);
    const context = { project };
    const result = runTool(context, "stamp_structure_kit", {
      mapId,
      kitId: "kit_stove",
      origin: { x: 4, y: 5 },
      repeat: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("사람 팔레트");
  });
});

describe("AI 컨텍스트 — 배치 조건은 잘리지 않고 실린다", () => {
  it("조건이 프롬프트에 «필수»로 들어가고, 거부된다는 사실까지 알린다", () => {
    const { project, mapId } = projectWithStoveKit([STOVE_CONDITION]);
    const prompt = buildSystemPrompt(project, { currentMapId: mapId });
    expect(prompt).toContain("화덕");
    expect(prompt).toContain("사람 팔레트 전용");
    expect(prompt).toContain("author_house");
    expect(prompt).not.toContain("배치 조건[필수]");
  });

  it("soft 조건은 «권장»으로 표시된다", () => {
    const { project, mapId } = projectWithStoveKit([{ ...STOVE_CONDITION, strength: "soft" }]);
    const prompt = buildSystemPrompt(project, { currentMapId: mapId });
    expect(prompt).toContain("화덕");
    expect(prompt).toContain("사람 팔레트 전용");
    expect(prompt).not.toContain("배치 조건[권장]");
  });
});
