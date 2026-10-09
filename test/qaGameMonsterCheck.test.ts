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

  it("flags a gym map left as a bare create_map field", () => {
    const project = seed();
    const base = Object.values(project.maps)[0]!;
    project.maps.map_gym = { ...base, id: "map_gym", name: "바위 체육관", events: [], lowerTiles: base.lowerTiles.map(() => base.lowerTiles[0]!), upperTiles: base.upperTiles.map(() => -1) };
    expect(checkMonster(project).map((finding) => finding.code)).toContain("monster-gym-map-bare");
  });

  it("stays silent outside monster games", () => {
    const project = seed();
    project.system.genre = "adventure-jrpg" as never;
    delete project.gameDesignBrief;
    delete project.system.monsterCollection;
    expect(checkMonster(project)).toEqual([]);
  });
});
