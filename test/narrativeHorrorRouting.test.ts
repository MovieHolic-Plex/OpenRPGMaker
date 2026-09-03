import { describe, expect, it } from "vitest";
import {
  ORCHESTRATOR_SYSTEM_PROMPT,
  buildDefaultWorkPlan,
} from "@/ai/workPlan";
import {
  detectNarrativeHorrorGenre,
  requiredSuccessToolsForUserText,
} from "@/ai/narrativeHorrorWorkPlan";

describe("narrative/horror successTools routing", () => {
  it("detects moon / witch / ib genres", () => {
    expect(detectNarrativeHorrorGenre("투더문 회상 컷신")).toBe("moon-cutscene");
    expect(detectNarrativeHorrorGenre("마녀의 집 트랩 호러")).toBe("witch-horror");
    expect(detectNarrativeHorrorGenre("이브 갤러리 조사 퍼즐")).toBe("ib-gallery");
  });

  it("maps genres to template successTools", () => {
    expect(requiredSuccessToolsForUserText("회상 스토리 엔딩")).toEqual(["script_cutscene_preset"]);
    expect(requiredSuccessToolsForUserText("저택 트랩 추격")).toEqual(["make_horror_loop"]);
    expect(requiredSuccessToolsForUserText("미술관 갤러리 조사")).toEqual(["make_gallery_room"]);
  });

  it("fallback work plan pins template tools for gallery intent", () => {
    const plan = buildDefaultWorkPlan("이브 갤러리 조사 호러 10분 슬라이스");
    const item = plan.layers[0]!.items[0]!;
    expect(item.successTools).toContain("make_gallery_room");
    expect(item.instruction).toContain("make_gallery_room");
  });

  it("planner system prompt requires narrative/horror successTools", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("script_cutscene_preset");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("make_horror_loop");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("make_gallery_room");
  });
});
