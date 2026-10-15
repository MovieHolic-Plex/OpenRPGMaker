import { describe, expect, it } from "vitest";
import { aiVisibleWorld, isAiHiddenEntity } from "@/project/world/visibility";
import { HIDDEN_ID, HIDDEN_MARKER, HIDDEN_NAME, PUBLIC_MARKER, modelPathOutputs, worldAiPathsProject } from "./helpers/worldAiPaths";

describe("AI 비공개 카드는 모델로 가는 모든 경로에서 빠진다", () => {
  const hidden = modelPathOutputs(worldAiPathsProject(true));
  const open = modelPathOutputs(worldAiPathsProject(false));

  for (const path of Object.keys(hidden)) {
    it(`${path}: 숨긴 카드의 이름·표지·id 가 나오지 않는다`, () => {
      expect(hidden[path]).not.toContain(HIDDEN_MARKER);
      expect(hidden[path]).not.toContain(HIDDEN_NAME);
      expect(hidden[path]).not.toContain(HIDDEN_ID);
    });
  }

  it("대조군: 같은 카드를 공개로 두면 최소한 한 경로에서는 보인다(필터가 아니라 우연히 안 보이는 것이 아님)", () => {
    expect(Object.values(open).some((text) => text.includes(HIDDEN_MARKER))).toBe(true);
    for (const path of ["system prompt (buildSystemPrompt)", "read_project_wiki ids (직접 지목)", "get_original_context (/world 항목)", "위키 추출기 입력"]) {
      expect(open[path], path).toContain(HIDDEN_MARKER);
    }
    expect(open["NPC 대사 작성기 이름 목록"]).toContain(HIDDEN_NAME);
  });

  it("공개 카드는 숨긴 카드가 있어도 그대로 모델에 간다", () => {
    expect(hidden["projectWikiContext"]).toContain(PUBLIC_MARKER);
    expect(hidden["read_project_wiki ids (직접 지목)"]).toContain(PUBLIC_MARKER);
  });

  it("숨긴 카드가 없으면 aiVisibleWorld 는 같은 객체를 돌려준다(저장·참조 동일)", () => {
    const project = worldAiPathsProject(false);
    expect(aiVisibleWorld(project.world!)).toBe(project.world);
    expect(project.world!.entities.some(isAiHiddenEntity)).toBe(false);
  });
});
