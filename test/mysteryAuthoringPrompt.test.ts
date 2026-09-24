// 추리 도그푸딩 7회차: 회상 프리셋이 컷신만 찍어 저택을 fill_region 으로 흉내 냈다.
import { describe, expect, it } from "vitest";
import { mentionedToolSchemas } from "@/ai/planToolExposure";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } from "@/editor/welcomeGenrePresets";
import { createBlankProject } from "@/project/defaults";
import { interviewBrief } from "./helpers/gameDesignBrief";

function names(text: string): string[] {
  return (mentionedToolSchemas(text) as { function: { name: string } }[]).map((tool) => tool.function.name);
}

describe("추리 기획 지시", () => {
  it("회상 프리셋이어도 추리 요약이면 실내 시공과 사건 도구를 계획 1순위로 노출한다", () => {
    const brief = interviewBrief("story-cutscene");
    brief.summary += "\n추가 요청: 추리 게임. 독살된 주인의 용의자를 지목한다.";
    const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("story-cutscene")!, brief);
    expect(prompt).toContain("추리 저작 요령");
    expect(prompt.indexOf("추리 저작 요령")).toBeGreaterThan(prompt.indexOf("script_cutscene"));
    expect(prompt).toContain("place_concept");
    expect(prompt).toContain("author_mystery_case");
    expect(prompt).toContain("지금은 run_scene_test 를 호출하지 마라");
    const exposed = names(prompt);
    expect(exposed).toEqual(expect.arrayContaining(["get_concept_facility", "place_concept", "author_mystery_case", "check_mystery_case"]));
  });

  it("추리 낱말이 없는 회상 기획에는 사건 도구를 심지 않는다", () => {
    const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("story-cutscene")!, interviewBrief("story-cutscene"));
    expect(prompt).not.toContain("추리 저작 요령");
    expect(prompt).not.toContain("author_mystery_case");
  });

  it("시스템 프롬프트는 추리 기획일 때만 실내를 먼저 짓게 한다", () => {
    const mystery = createBlankProject();
    const brief = interviewBrief("story-cutscene");
    brief.summary += "\n추리. 용의자 지목.";
    mystery.gameDesignBrief = brief;
    expect(buildPiAgentSystemPrompt(mystery, [], false).join("\n")).toContain("place_concept(plan, 새 mapId)");
    const story = createBlankProject();
    story.gameDesignBrief = interviewBrief("story-cutscene");
    expect(buildPiAgentSystemPrompt(story, [], false).join("\n")).not.toContain("author_mystery_case");
  });
});
