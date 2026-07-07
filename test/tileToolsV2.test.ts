// test/tileToolsV2.test.ts
// 타일 v2 툴 계약 테스트 — v2 재구축(2026-07-07)의 계약 계층을 고정한다:
// (1) 레지스트리: v2 노출 / v1 타일 툴 deprecated(LLM 비노출, 실행 호환 유지)
// (2) 인자 오류마다 "다시 보낼 형식 예시" 동봉 (3) 정상 경로는 v1 엔진과 동일 효과.

import { describe, expect, it } from "vitest";
import { getTool, toOpenAiTools, LEGACY_TILE_KNOWLEDGE_SUPERSEDED } from "@/editor/tools";
import { TILE_TOOLS_V2, V1_TILE_SUPERSEDED } from "@/editor/tools/v2";
import { V2_TILE_SUPERSEDED } from "@/editor/tools/v3";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function freshProject(): { project: Project; mapId: string } {
  const project = createBlankProject();
  const mapId = Object.keys(project.maps)[0];
  return { project, mapId };
}

function runV2(name: string, project: Project, args: Record<string, unknown>) {
  const tool = getTool(name);
  if (!tool) throw new Error(`tool missing: ${name}`);
  return tool.run(project, args);
}

function expectExampleError(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    const message = String((error as Error).message);
    expect(message).toContain("다시 보낼 형식 예시");
    return message;
  }
  throw new Error("ToolError가 발생해야 합니다");
}

describe("타일 v2 레지스트리", () => {
  it("v2 배치 4종(v3 대체)·옛 타일 지식 툴(§2.2.1)·deprecated v1 타일 툴은 노출되지 않는다", () => {
    const exposed = new Set(toOpenAiTools().map((tool) => tool.function.name));
    for (const tool of TILE_TOOLS_V2) {
      // v3 공정 프리미티브(V3B)가 대체한 배치 4종 + v3 어휘 흐름과 경쟁하는 지식 툴
      // (tile_metadata/tile_group/tile_cluster_rule — 2026-07-07 툴 스코핑 §2.2.1)은 비노출.
      const hidden = V2_TILE_SUPERSEDED.has(tool.name) || LEGACY_TILE_KNOWLEDGE_SUPERSEDED.has(tool.name);
      expect(exposed.has(tool.name), tool.name).toBe(!hidden);
    }
    for (const v1Name of V1_TILE_SUPERSEDED.keys()) expect(exposed.has(v1Name), v1Name).toBe(false);
  });

  it("deprecated v1 툴도 getTool로는 계속 실행 가능하며 supersededBy가 유효하다", () => {
    for (const [v1Name, v2Name] of V1_TILE_SUPERSEDED) {
      const v1 = getTool(v1Name);
      expect(v1, v1Name).toBeDefined();
      expect(v1?.deprecated).toBe(true);
      expect(v1?.supersededBy).toBe(v2Name);
      expect(getTool(v2Name), v2Name).toBeDefined();
    }
  });

  it("비타일 v1 툴은 여전히 노출된다 (대체물이 없으므로)", () => {
    const exposed = new Set(toOpenAiTools().map((tool) => tool.function.name));
    for (const name of ["create_map", "resize_map", "place_npc", "run_lint", "get_map_region"]) {
      expect(exposed.has(name), name).toBe(true);
    }
  });
});

describe("tile_paint", () => {
  it("rect 페인트가 타일을 실제로 바꾼다 (v1 엔진 동일 효과)", () => {
    const { project, mapId } = freshProject();
    const before = [...project.maps[mapId].lowerTiles];
    const result = runV2("tile_paint", project, {
      mapId, mode: "rect", tile: 360, from: { x: 1, y: 1 }, to: { x: 3, y: 2 },
    });
    expect(result.summary).toContain("페인트");
    expect(project.maps[mapId].lowerTiles).not.toEqual(before);
  });

  it("action=erase + rect는 clear_region 경로로 동작한다 (tile 불필요)", () => {
    const { project, mapId } = freshProject();
    const result = runV2("tile_paint", project, {
      mapId, action: "erase", mode: "rect", from: { x: 1, y: 1 }, to: { x: 2, y: 2 },
    });
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("paint인데 tile이 없으면 재전송 예시를 동봉해 거부한다", () => {
    const { project, mapId } = freshProject();
    const message = expectExampleError(() => runV2("tile_paint", project, { mapId, mode: "rect", from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }));
    expect(message).toContain("tile");
  });

  it("mode별 필수 좌표 누락도 재전송 예시를 동봉한다", () => {
    const { project, mapId } = freshProject();
    expectExampleError(() => runV2("tile_paint", project, { mapId, mode: "rect", tile: 360 }));
    expectExampleError(() => runV2("tile_paint", project, { mapId, mode: "cells", tile: 360 }));
  });

  it("좌표 숫자 문자열을 정수로 수용한다 (별칭·강제 변환)", () => {
    const { project, mapId } = freshProject();
    const result = runV2("tile_paint", project, {
      mapId, mode: "rect", tile: 360, from: { x: "1", y: "1" }, to: { x: "2", y: "2" },
    });
    expect(result.summary).toContain("페인트");
  });
});

describe("tile_road / tile_scatter / tile_structure", () => {
  it("tile_road가 폴리라인 길을 깐다", () => {
    const { project, mapId } = freshProject();
    const result = runV2("tile_road", project, {
      mapId, points: [{ x: 0, y: 7 }, { x: 9, y: 8 }, { x: 18, y: 5 }], style: "dirt", naturalness: 0.4, seed: 7,
    });
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("tile_road는 경유점 2개 미만이면 예시를 동봉해 거부한다", () => {
    const { project, mapId } = freshProject();
    expectExampleError(() => runV2("tile_road", project, { mapId, points: [{ x: 0, y: 7 }] }));
  });

  it("tile_scatter는 area 누락/그룹·프리셋 둘 다 누락을 예시와 함께 거부한다", () => {
    const { project, mapId } = freshProject();
    expectExampleError(() => runV2("tile_scatter", project, { mapId, count: 5, groupId: "g" }));
    expectExampleError(() => runV2("tile_scatter", project, { mapId, area: { x: 0, y: 0, w: 10, h: 8 }, count: 5 }));
  });

  it("tile_structure kind=house 정상 경로 + kind별 필수 인자 거부", () => {
    const { project, mapId } = freshProject();
    const result = runV2("tile_structure", project, {
      mapId, kind: "house", origin: { x: 3, y: 3 }, width: 6, height: 7, material: "wood",
    });
    expect(result.summary.length).toBeGreaterThan(0);
    expectExampleError(() => runV2("tile_structure", project, { mapId, kind: "house", origin: { x: 3, y: 3 } }));
    expectExampleError(() => runV2("tile_structure", project, { mapId, kind: "structure", origin: { x: 3, y: 3 } }));
    expectExampleError(() => runV2("tile_structure", project, { mapId, kind: "terrain_template", origin: { x: 0, y: 0 } }));
  });
});

describe("tile_metadata / tile_group / tile_cluster_rule / tile_palette_preset", () => {
  it("의미+규칙 필드를 한 entries로 받아 자동 분배한다 (tileId 별칭 수용)", () => {
    const { project } = freshProject();
    const result = runV2("tile_metadata", project, {
      entries: [{ tileId: 260, label: "침엽수 상단", passable: false }],
    });
    expect(result.summary).toContain("/");
  });

  it("설정할 필드가 없는 entry는 예시와 함께 거부한다", () => {
    const { project } = freshProject();
    expectExampleError(() => runV2("tile_metadata", project, { entries: [{ tile: 260 }] }));
  });

  it("tile_group upsert가 그룹을 생성하고, groupId 누락 delete는 예시와 함께 거부한다", () => {
    const { project } = freshProject();
    const tilesetId = Object.keys(project.tilesets)[0];
    const result = runV2("tile_group", project, {
      tilesetId, action: "upsert", group: { name: "테스트 소품", role: "prop", tileIds: [260, 290] },
    });
    expect(result.summary.length).toBeGreaterThan(0);
    expectExampleError(() => runV2("tile_group", project, { action: "delete" }));
  });

  it("tile_palette_preset이 v1 upsert_palette_preset과 동일 계약으로 동작한다", () => {
    const { project } = freshProject();
    const tilesetId = Object.keys(project.tilesets)[0];
    const result = runV2("tile_palette_preset", project, {
      tilesetId, preset: { name: "숲속 마을", slots: [{ role: "ground", tileIds: [0, 1] }] },
    });
    expect(result.summary).toContain("팔레트 프리셋");
    expect(project.tilesets[tilesetId].palettePresets?.length).toBe(1);
  });

  it("tile_cluster_rule은 rule 누락을 예시와 함께 거부한다", () => {
    const { project } = freshProject();
    expectExampleError(() => runV2("tile_cluster_rule", project, { groupId: "g" }));
  });
});

describe("tile_query", () => {
  it("ask별 필수 인자 누락을 예시와 함께 거부한다", () => {
    const { project } = freshProject();
    expectExampleError(() => runV2("tile_query", project, { ask: "tile_info" }));
    expectExampleError(() => runV2("tile_query", project, { ask: "usage" }));
    expectExampleError(() => runV2("tile_query", project, { ask: "similar" }));
    expectExampleError(() => runV2("tile_query", project, { ask: "terrain_template" }));
  });

  it("ask=palette / terrain_templates / tile_info가 v1 읽기와 동일하게 동작한다", () => {
    const { project } = freshProject();
    expect(runV2("tile_query", project, { ask: "palette", limit: 5 }).summary.length).toBeGreaterThan(0);
    expect(runV2("tile_query", project, { ask: "terrain_templates" }).summary.length).toBeGreaterThan(0);
    expect(runV2("tile_query", project, { ask: "tile_info", tileIds: [260] }).summary.length).toBeGreaterThan(0);
  });
});
