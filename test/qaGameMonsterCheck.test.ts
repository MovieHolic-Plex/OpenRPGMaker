import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { checkMonster } from "@/qa/gameCheck/monster";

function seed() {
  return createNewProjectSeed(newProjectChoiceById("monster-collect")!.packId, "검사");
}

describe("qa-game monster-collect checks", () => {
  it("flags a seed with no way to get a partner and no wild encounters", () => {
    const codes = checkMonster(seed(), "체육관 관장").map((finding) => finding.code);
    expect(codes).toContain("monster-no-give");
    expect(codes).toContain("monster-no-wild-encounters");
    expect(codes).toContain("monster-no-gym-battle");
  });

  it("flags a capture item that cannot be thrown in battle", () => {
    const project = seed();
    for (const item of project.database.items) if (item.captureProfile) item.occasion = "never";
    expect(checkMonster(project).map((finding) => finding.code)).toContain("monster-capture-item-unusable");
  });

  it("stays silent outside monster games", () => {
    const project = seed();
    project.system.genre = "adventure-jrpg" as never;
    delete project.gameDesignBrief;
    delete project.system.monsterCollection;
    expect(checkMonster(project)).toEqual([]);
  });
});
