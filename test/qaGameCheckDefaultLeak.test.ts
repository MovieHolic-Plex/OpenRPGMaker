import { describe, expect, it } from "vitest";
import { runGameCheck } from "@/qa/gameCheck";
import { createBlankProject } from "@/project/defaults";
import { factoryArtResourceIds, projectDefaultLeaks } from "@/project/defaultLeaks";
import type { Project } from "@/project/types";
import { buildQaFixture } from "./fixtures/qaGame/qaGameFixtures";

const leakCodes = (project: Project) => runGameCheck(project, { skipAutoPlay: true }).findings.filter((f) => f.code.startsWith("default-leak-")).map((f) => f.code);

// 이 게임이 고른 타이틀 그림 — 빈 프로젝트가 깔아 둔 그림(타이틀 배경 · 기본 오프닝 세 장면)이 아닌 것이어야 한다.
// 전에는 oprn-still-moon-meadow 를 썼는데 그것은 기본 오프닝(kingdom-prologue)의 셋째 장면이라 factoryArtResourceIds 에 든다 — «직접 고른 그림» 이 아니었다.
const OWN_TITLE_ART = "oprn-still-harbor";

function authoredGame(): Project {
  const project = buildQaFixture("clean");
  project.meta.title = "붉은 달의 여관";
  project.system.titleScreen = { ...project.system.titleScreen!, title: "붉은 달의 여관", backgroundResourceId: OWN_TITLE_ART };
  project.endings = [{ id: "e1", name: "새벽", conditions: [], priority: 1, presentation: { backgroundResourceId: "oprn-still-quiet-room" }, epilogue: [] } as never];
  return project;
}

describe("default leak check (engine defaults must not survive into a finished game)", () => {
  it("a blank project stays quiet", () => {
    expect(projectDefaultLeaks(createBlankProject() as Project)).toEqual([]);
  });

  it("a game that sets its own title, title art and ending art has no leak finding", () => {
    expect(factoryArtResourceIds().has(OWN_TITLE_ART)).toBe(false);
    expect(leakCodes(authoredGame())).toEqual([]);
  });

  it("flags a title that reuses a default opening still, not only the default title background", () => {
    // 기본 오프닝의 장면 그림도 엔진이 깔아 둔 그림이다 — 타이틀로 옮겨 걸어도 어느 게임이나 같은 그림이다.
    const openingStill = createBlankProject().system.opening?.scenes.flatMap((scene) => (scene.kind === "image" ? [scene.resourceId] : [])).at(-1);
    expect(openingStill).toBeDefined();
    const project = authoredGame();
    project.system.titleScreen = { ...project.system.titleScreen!, backgroundResourceId: openingStill! };
    expect(leakCodes(project)).toContain("default-leak-title-image");
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
