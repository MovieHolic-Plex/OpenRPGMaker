import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { buildClusterEditKickoff } from "@/ai/clusterAssistPrompt";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import type { TileGroupMetadata } from "@/project/types";

describe("클러스터 규칙 저작", () => {
  it("킥오프가 kind와 강도 원탭 선택, 강도 안내, set_cluster_rule 저장 지시를 포함한다", () => {
    const prompt = buildClusterEditKickoff({ tilesetId: DEFAULT_TILESET_ID, groupId: "roof_rule_group", group: null });

    expect(prompt).toContain("render_group_sample");
    expect(prompt).toContain("[선택지] 규칙 추가 | 기존 규칙 보기 | 취소");
    expect(prompt).toContain("[선택지] 인접성 | 간격 | 개수");
    expect(prompt).toContain("[선택지] 강함(반드시) | 중간(권장) | 느슨함(선호)");
    expect(prompt).toContain("강함=커밋에서 거부됨, 중간=경고, 느슨함=참고");
    expect(prompt).toContain("set_cluster_rule");
    expect(prompt).toContain("위반 예시");
  });

  it("컨텍스트가 soft/medium 규칙을 선호 힌트로 싣고 편집 후 run_lint를 권고한다", () => {
    const project = createBlankProject();
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
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

    expect(prompt).toContain("## 클러스터 규칙 선호 힌트");
    expect(prompt).toContain("중간(권장)");
    expect(prompt).toContain("창문은 최소 2칸 이상 띄우기");
    expect(prompt).toContain("느슨함(선호)");
    expect(prompt).toContain("꽃은 한 화면에 너무 많이 쓰지 않기");
    expect(prompt).toContain("강함 규칙 위반은 커밋이 거부됩니다");
    expect(prompt).toContain("맵을 편집한 뒤 run_lint로 규칙 위반을 확인하세요");
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
