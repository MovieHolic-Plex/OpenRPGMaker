import { describe, expect, it } from "vitest";
import { applyEditedGameTitle } from "@/project/defaults/defaultOpeningSequence";
import type { CinematicSequence } from "@/project/types";

function titleCard(narration: string): CinematicSequence {
  return {
    enabled: true,
    skippable: true,
    scenes: [{ id: "card", kind: "text", narration, durationMs: 1000 }],
  };
}

describe("applyEditedGameTitle", () => {
  it("자료집 게임 타이틀을 고치면 프로젝트 이름과 씨앗 제목 카드도 따라간다", () => {
    const project = {
      meta: { title: "새 게임" },
      system: { opening: titleCard("— 새 게임 —") },
    };
    applyEditedGameTitle(project, "새 프로젝트", "달빛 항구");
    expect(project.meta.title).toBe("달빛 항구");
    expect(project.system.opening.scenes[0]).toMatchObject({ narration: "— 달빛 항구 —" });
  });

  it("칸을 비우는 중간에는 프로젝트 이름을 지우지 않는다", () => {
    const project = { meta: { title: "달빛 항구" }, system: { opening: titleCard("— 달빛 항구 —") } };
    applyEditedGameTitle(project, "달빛 항구", "   ");
    expect(project.meta.title).toBe("달빛 항구");
    expect(project.system.opening.scenes[0]).toMatchObject({ narration: "— 달빛 항구 —" });
  });

  it("장면이 여러 개인 오프닝 글은 그대로 둔다", () => {
    const opening = titleCard("숲으로 들어가자");
    opening.scenes.push({ id: "next", kind: "text", narration: "그리고 밤이 왔다", durationMs: 1000 });
    const project = { meta: { title: "새 게임" }, system: { opening } };
    applyEditedGameTitle(project, "새 게임", "달빛 항구");
    expect(project.meta.title).toBe("달빛 항구");
    expect(project.system.opening.scenes[0]).toMatchObject({ narration: "숲으로 들어가자" });
  });
});
