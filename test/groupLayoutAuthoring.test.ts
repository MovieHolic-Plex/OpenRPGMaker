import { describe, expect, it } from "vitest";
import { SYSTEM_SKILLS, type SkillRunContext } from "@/ai/skills";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";

const CTX: SkillRunContext = {
  mapId: "map_1",
  mapName: "테스트 맵",
  selection: null,
};

function clusterEditPrompt(): string {
  const cluster = SYSTEM_SKILLS.find((skill) => skill.id === "cluster-edit");
  return cluster?.buildPrompt?.({ tilesetId: DEFAULT_TILESET_ID, groupId: "roof_layout_group" }, CTX) ?? "";
}

describe("클러스터 구성 저작", () => {
  it("cluster-edit 킥오프가 구성 수정 선택지를 포함한다", () => {
    // Given: the cluster-edit skill is opened.
    const prompt = clusterEditPrompt();

    // Then: users can choose layout authoring separately from rule authoring.
    expect(prompt).toContain("구성 수정(위/아래·좌우 배치)");
  });

  it("구성 수정 프로토콜이 원탭 축 선택, 최소 입력, 이미지 전/후, set_group_layout 저장을 지시한다", () => {
    // Given: the cluster-edit skill is opened.
    const prompt = clusterEditPrompt();

    // Then: vertical/horizontal layout editing stays image-first and routes to set_group_layout.
    expect(prompt).toContain("[선택지] 세로(위/아래) | 가로(좌/우) | 취소");
    expect(prompt).toContain("어느 타일이 **위**? 어느 타일이 **아래**?");
    expect(prompt).toContain("위 260 / 아래 290");
    expect(prompt).toContain("render_group_sample({tilesetId, groupId, proposed.patternGrammar})");
    expect(prompt).toContain("[선택지] 적용 | 다시");
    expect(prompt).toContain("set_group_layout");
    expect(prompt).toContain('axis:"vertical", top:[260], bottom:[290]');
    expect(prompt).toContain('axis:"horizontal"');
    expect(prompt).toContain("전/후 이미지");
  });

  it("구성과 규칙을 구분하고 위/아래가 레이어가 아님을 안내한다", () => {
    // Given: the cluster-edit skill is opened.
    const prompt = clusterEditPrompt();

    // Then: adjacency wording is routed by intent, not by the shared words "위/아래".
    expect(prompt).toContain("'위/아래로 배치·구성·이어지게 해줘'는 구성(set_group_layout)");
    expect(prompt).toContain("'반드시 위/아래여야 한다(제약·검증)'는 규칙(set_cluster_rule)");
    expect(prompt).toContain("'위/아래'는 레이어(상위/하위)가 아니라 세로 인접 칸을 뜻한다");
  });
});
