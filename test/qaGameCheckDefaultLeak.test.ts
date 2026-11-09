import { describe, expect, it } from "vitest";
import { runGameCheck } from "@/qa/gameCheck";
import { createBlankProject } from "@/project/defaults";
import { projectDefaultLeaks } from "@/project/defaultLeaks";
import type { Project } from "@/project/types";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";

const leakCodes = (project: Project) => runGameCheck(project, { skipAutoPlay: true }).findings.filter((f) => f.code.startsWith("default-leak-")).map((f) => f.code);

function authoredGame(): Project {
  const project = buildQaFixture("clean");
  project.meta.title = "붉은 달의 여관";
  project.system.titleScreen = { ...project.system.titleScreen!, title: "붉은 달의 여관", backgroundResourceId: "oprn-still-moon-meadow" };
  project.endings = [{ id: "e1", name: "새벽", conditions: [], priority: 1, presentation: { backgroundResourceId: "oprn-still-quiet-room" }, epilogue: [] } as never];
  return project;
}

describe("default leak check (engine defaults must not survive into a finished game)", () => {
  it("a blank project stays quiet", () => {
    expect(projectDefaultLeaks(createBlankProject() as Project)).toEqual([]);
  });

  it("a game that sets its own title, title art and ending art has no leak finding", () => {
    expect(leakCodes(authoredGame())).toEqual([]);
  });

  it("flags the factory title and title art once the game has content, with the exact field", () => {
    const project = authoredGame();
    project.meta.title = "새 프로젝트";
    project.system.titleScreen = { ...project.system.titleScreen!, title: "새 프로젝트", backgroundResourceId: "oprn-title-field" };
    const findings = runGameCheck(project, { skipAutoPlay: true }).findings.filter((f) => f.code.startsWith("default-leak-"));
    expect(findings.map((f) => f.code)).toEqual(expect.arrayContaining(["default-leak-title-name", "default-leak-title-image"]));
    expect(findings.every((f) => f.severity === "warning")).toBe(true);
    expect(findings.find((f) => f.code === "default-leak-title-image")!.message).toContain("system.titleScreen.backgroundResourceId");
  });

  it("flags an ending that would show the default title art (no own background, factory title art)", () => {
    const project = authoredGame();
    project.system.titleScreen = { ...project.system.titleScreen!, backgroundResourceId: "oprn-title-field" };
    project.endings = [{ id: "e1", name: "새벽", conditions: [], priority: 1, epilogue: [] } as never];
    expect(leakCodes(project)).toContain("default-leak-ending-bg");
  });

  it("does not flag an ending that follows an authored title art", () => {
    const project = authoredGame();
    project.endings = [{ id: "e1", name: "새벽", conditions: [], priority: 1, epilogue: [] } as never];
    expect(leakCodes(project)).not.toContain("default-leak-ending-bg");
  });

  it("flags factory starting gear only when the game authored its own equipment", () => {
    const project = authoredGame();
    expect(leakCodes(project)).not.toContain("default-leak-start-gear");
    const sword = structuredClone(project.database.equipment[0]!);
    sword.id = "equip_moon_blade";
    sword.name = "달빛 검";
    project.database.equipment.push(sword);
    const hero = project.database.actors.find((a) => a.id === project.system.startActorIds![0])!;
    hero.initialEquipment = { ...(hero.initialEquipment ?? {}), ...createBlankProject().database.actors.find((a) => a.id === hero.id)!.initialEquipment };
    expect(leakCodes(project)).toContain("default-leak-start-gear");
  });
});
