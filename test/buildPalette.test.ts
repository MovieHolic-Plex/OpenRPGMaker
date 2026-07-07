import { describe, expect, it, vi } from "vitest";
import * as llmClient from "@/ai/llmClient";
import {
  applyBuildPalettePrimitiveToProject,
  BUILD_PALETTE_PRESETS,
  type BuildPaletteSelection,
} from "@/editor/panels/buildPaletteCore";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { projectLint } from "@/project/lint/projectLint";

const MAP_ID = "map_blank_start";

function selection(patch: Partial<BuildPaletteSelection> = {}): BuildPaletteSelection {
  return { mapId: MAP_ID, x: 4, y: 4, width: 6, height: 5, ...patch };
}

describe("build palette deterministic stamps", () => {
  it("집 프리미티브는 2×2 미만 선택 영역을 명확한 사유로 거부한다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ width: 1, height: 1 }), "house");
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("최소 2×2");
    expect(result.summary).not.toContain("완료");
    expect(result.toolResults).toHaveLength(0);
  });

  it("집 프리미티브가 시작 위치를 덮으면 무결성 오류를 사용자 메시지로 요약한다", () => {
    const project = createBlankProject();
    const result = applyBuildPalettePrimitiveToProject(
      project,
      selection({ x: project.startPos.x, y: project.startPos.y - 1, width: 3, height: 4 }),
      "house"
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain("시작 위치");
    expect(result.summary).not.toContain("커밋 거부");
    expect(result.toolResults.some((toolResult) => toolResult.issues?.some((issue) => issue.code === "start-position"))).toBe(true);
  });

  // 2026-07-08 회귀: 선재 lint 오류(예: 시작 위치 통행 불가)가 있으면 무관한 편집까지
  // 전부 커밋 거부되던 버그 — 새로 생긴 오류만 차단해야 한다.
  it("선재 무결성 오류가 있어도 무관한 영역의 시공은 허용한다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles[project.startPos.y * map.width + project.startPos.x] = 120; // 물 — 통행 불가
    const preexisting = projectLint(project).filter((issue) => issue.code === "start-position");
    expect(preexisting.length, "선재 오류가 심어져야 함").toBeGreaterThan(0);

    const result = applyBuildPalettePrimitiveToProject(project, selection(), "house");

    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("완료");
  });

  it("집 프리미티브는 LLM 없이 벽, 문, 지붕을 한 번에 시공한다", () => {
    const chat = vi.spyOn(llmClient, "chatCompletion");
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection(), "house");
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toContain("완료");
    expect(chat).not.toHaveBeenCalled();

    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    // 선택 (4,4) 6×5 → 1층 벽 2행을 먼저 확보하고, 나머지 3행은 용마루/몸통/처마 지붕으로 채운다.
    for (let x = 4; x <= 9; x++) {
      expect(map.lowerTiles[at(x, 4)], `ridge(${x},4)`).toBe(374);
      expect(map.lowerTiles[at(x, 5)], `body(${x},5)`).toBe(375);
      expect(map.lowerTiles[at(x, 6)], `eave(${x},6)`).toBe(405);
    }
    expect(map.lowerTiles[at(4, 7)]).not.toBe(0); // wall top-left
    expect(map.lowerTiles[at(7, 8)]).toBe(146); // door bottom
  });

  it("ㄱ자집 프리셋은 열별 yMax 기준으로 남쪽 노출면 두 곳에 벽을 깔고 지붕을 ㄱ자로 채운다", () => {
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 2, y: 2, width: 8, height: 8 }),
      "house",
      { housePresetId: "l-house-1f" }
    );
    expect(result.ok, result.summary).toBe(true);
    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;

    // 왼쪽 위 열: splitY=6이므로 y=4..5가 1층 벽, 그 위 y=2..3이 지붕.
    expect(map.lowerTiles[at(2, 2)]).toBe(374);
    expect(map.lowerTiles[at(2, 3)]).toBe(405);
    expect(map.lowerTiles[at(2, 4)]).not.toBe(0);
    expect(map.lowerTiles[at(2, 5)]).not.toBe(0);

    // 오른쪽 아래 열: 같은 열 규칙으로 하단 y=8..9가 벽, 위쪽은 긴 지붕 열이다.
    expect(map.lowerTiles[at(8, 2)]).toBe(374);
    expect(map.lowerTiles[at(8, 7)]).toBe(405);
    expect(map.lowerTiles[at(8, 8)]).not.toBe(0);
    expect(map.lowerTiles[at(8, 9)]).not.toBe(0);
  });

  it("2층집 프리셋은 벽 공간 4행을 먼저 확보한다", () => {
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 2, y: 2, width: 6, height: 7 }),
      "house",
      { housePresetId: "house-2f" }
    );
    expect(result.ok, result.summary).toBe(true);
    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;

    expect(map.lowerTiles[at(2, 2)]).toBe(374);
    expect(map.lowerTiles[at(2, 3)]).toBe(375);
    expect(map.lowerTiles[at(2, 4)]).toBe(405);
    for (let y = 5; y <= 8; y += 1) expect(map.lowerTiles[at(2, y)], `wall y=${y}`).not.toBe(0);
  });

  // 2026-07-08 학습 반영(연습02): 파랑 지붕 — 몸통 406, 좌/우 가장자리 437/407, 처마 467,
  // 대각 모서리는 상위 레이어 356/357/386/387.
  it("파랑1층 프리셋은 파랑 세트 하위 타일과 상위 대각 모서리로 지붕을 시공한다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection(), "house", {
      housePresetId: "blue-cottage-1f",
    });
    expect(result.ok, result.summary).toBe(true);

    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    // 선택 (4,4) 6×5, 벽 2행 → 지붕 rows 4~6 (처마 6행).
    expect(map.upperTiles[at(4, 4)]).toBe(356); // NW 대각(상위), 하위는 비워 둔다
    expect(map.upperTiles[at(9, 4)]).toBe(357); // NE
    expect(map.lowerTiles[at(5, 4)]).toBe(406); // 최상행 몸통
    expect(map.lowerTiles[at(4, 5)]).toBe(437); // 좌측 가장자리
    expect(map.lowerTiles[at(9, 5)]).toBe(407); // 우측 가장자리
    expect(map.lowerTiles[at(6, 5)]).toBe(406); // 몸통
    for (let x = 4; x <= 9; x++) expect(map.lowerTiles[at(x, 6)], `eave(${x},6)`).toBe(467);
    expect(map.upperTiles[at(4, 6)]).toBe(386); // SW
    expect(map.upperTiles[at(9, 6)]).toBe(387); // SE
  });

  // 2026-07-08 학습 반영(연습08): 밝은 오렌지 — 용마루(374)는 지붕 위 한 줄 상위 레이어,
  // 수직 트림 376/377은 지붕 좌우 바깥 열 상위 레이어.
  it("밝은ㄱ자 프리셋은 용마루·트림을 상위 레이어에 얹는다", () => {
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 3, y: 3, width: 6, height: 6 }),
      "house",
      { housePresetId: "bright-l-1f" }
    );
    expect(result.ok, result.summary).toBe(true);

    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    // 지붕 최상단은 y=3 → 용마루 라인은 y=2 상위 레이어, 좌우 캡은 지붕 바깥.
    expect(map.upperTiles[at(6, 2)]).toBe(374);
    expect(map.upperTiles[at(8, 2)]).toBe(374);
    expect(map.upperTiles[at(2, 2)]).toBe(354); // 좌측 용마루 캡
    expect(map.upperTiles[at(9, 2)]).toBe(355); // 우측 용마루 캡
    // 우측 날개(x=6..8, 지붕 y=3..6) 바깥 열 수직 트림 + 하단 캡.
    expect(map.upperTiles[at(9, 3)]).toBe(377);
    expect(map.upperTiles[at(9, 6)]).toBe(385);
    // 하위 몸통은 404, 각 열의 최하 지붕행은 처마 405.
    expect(map.lowerTiles[at(7, 4)]).toBe(404);
    expect(map.lowerTiles[at(7, 6)]).toBe(405);
  });

  it("마을 프리미티브는 집을 2채 이상 배치한 뒤 문 앞 좌표 사이에 길을 연결하고 시작 위치를 막지 않는다", () => {
    const result = applyBuildPalettePrimitiveToProject(
      createBlankProject(),
      selection({ x: 0, y: 0, width: 20, height: 15 }),
      "village"
    );
    expect(result.ok, result.summary).toBe(true);
    expect(result.summary).toMatch(/마을 시공 완료: \d+채 중 \d+채/);
    const doorResults = result.toolResults.filter((toolResult) => {
      const data = toolResult.data as { at?: { x: number; y: number } } | undefined;
      return Boolean(data?.at);
    });
    expect(doorResults.length).toBeGreaterThanOrEqual(2);

    const pathMembers = new Set(result.project.tilesets[DEFAULT_TILESET_ID].tileGroups?.find((group) => group.id === BUILD_PALETTE_PRESETS.path)?.tileIds ?? []);
    const map = result.project.maps[MAP_ID];
    const firstDoor = (doorResults[0].data as { at: { x: number; y: number } }).at;
    const firstDoorFront = { x: firstDoor.x, y: Math.min(map.height - 1, firstDoor.y + 1) };
    expect(pathMembers.has(map.lowerTiles[firstDoorFront.y * map.width + firstDoorFront.x])).toBe(true);
    expect(projectLint(result.project).filter((issue) => issue.severity === "error" && issue.code === "start-position")).toHaveLength(0);
  });

  it("지붕 프리미티브는 용마루→몸통→처마 3단으로 채운다", () => {
    const result = applyBuildPalettePrimitiveToProject(createBlankProject(), selection({ x: 2, y: 10, width: 4, height: 3 }), "roof");
    expect(result.ok, result.summary).toBe(true);
    const map = result.project.maps[MAP_ID];
    const at = (x: number, y: number) => y * map.width + x;
    expect(map.lowerTiles[at(2, 10)]).toBe(374); // 용마루
    expect(map.lowerTiles[at(3, 11)]).toBe(375); // 몸통
    expect(map.lowerTiles[at(2, 12)]).toBe(405); // 처마(최하단)
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
});
