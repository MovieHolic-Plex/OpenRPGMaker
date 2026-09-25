import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { runTool } from "@/editor/tools/toolRunner";

describe("define_monster_species evolution order", () => {
  it("tells the model to define the evolved form first", () => {
    const project = createNewProjectSeed(newProjectChoiceById("monster-collect")!.packId, "진화 순서");
    const base = project.database.monsterSpecies![0]!;
    const result = runTool({ project }, "define_monster_species", { species: { id: base.id, name: base.name, evolutions: [{ toSpeciesId: "species_not_yet", requires: { level: 8 } }] } });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("먼저 define_monster_species 로 정의");
  }, 60_000);
});
