import { describe, expect, it } from "vitest";
import { classifyPlainPiTurn } from "@/ai/piAgent/plainTurn";
import { resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { fixedDeclarer } from "./intentFixture";

describe("Pi navigation authority from user intent", () => {
  const classify = (navigation: boolean, level: AutonomyLevel) => classifyPlainPiTurn({
    project: createEmptyToolProject(), text: `location request ${navigation} ${level}`,
    currentMapId: null, selection: null, hasActivePlan: false, piTeam: false,
    autonomy: resolveAutonomy(level),
    declarer: () => fixedDeclarer({ mode: "question", viewNavigation: navigation }),
  });

  it("passes explicit location guidance through the ordinary and read-only request paths", async () => {
    expect((await classify(true, "balanced")).plan).toMatchObject({ readOnly: true, viewNavigation: true });
    expect((await classify(true, "readonly")).plan).toMatchObject({ readOnly: true, viewNavigation: true });
    expect((await classify(false, "balanced")).plan.viewNavigation).toBe(false);
  });

  it("does not turn plan-only execution into a navigation request", async () => {
    expect((await classify(true, "confirm")).plan.viewNavigation).not.toBe(true);
  });
});
