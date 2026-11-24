import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata } from "@/project/types";

describe("클러스터 규칙 저작", () => {
  it("컨텍스트가 soft/medium 규칙 문구만 선호 힌트로 싣고 hard 규칙은 싣지 않는다", () => {
    // 힌트는 현재(시작) 맵의 타일셋 규칙만 싣는다 — 새 프로젝트 시작 맵은 기본 타일셋(beodeul_city)이다.
    const project = createBlankProject();
    const tileset = project.tilesets[project.maps[project.startMapId].tilesetId];
    expect(tileset?.id).toBe(DEFAULT_TILESET_ID);
    const group = Object.assign(baseGroup(), {
      rules: [
        {
          id: "space-window",
          kind: "spacing",
          strength: "medium",
          params: { min: 2 },
          message: "창문은 최소 2칸 이상 띄우기",
        },
        {
          id: "count-flower",
          kind: "count",
          strength: "soft",
          params: { max: 5 },
          message: "꽃은 한 화면에 너무 많이 쓰지 않기",
        },
        {
          id: "hard-wall",
          kind: "adjacency",
          strength: "hard",
          params: { side: "below" },
          message: "지붕 아래에는 벽이 필요",
        },
      ],
    });
    tileset.tileGroups = [group];

    const prompt = buildSystemPrompt(project);

    expect(prompt).toContain("창문은 최소 2칸 이상 띄우기");
    expect(prompt).toContain("꽃은 한 화면에 너무 많이 쓰지 않기");
    expect(prompt).not.toContain("지붕 아래에는 벽이 필요");
  });
});

function baseGroup(): TileGroupMetadata {
  return {
    defaultLayer: "upper",
    description: "규칙 테스트 그룹",
    id: "roof_rule_group",
    name: "규칙 지붕",
    placementRules: "",
    role: "roof",
    tileIds: [1, 2, 3],
  };
}
