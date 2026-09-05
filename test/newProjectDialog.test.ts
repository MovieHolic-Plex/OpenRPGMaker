/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  NEW_PROJECT_STARTERS,
  resolveNewProjectStarterProject,
  showNewProjectDialog,
} from "@/editor/panels/newProjectDialog";
import { WELCOME_GENRE_PRESETS } from "@/editor/welcomeGenrePresets";

describe("resolveNewProjectStarterProject", () => {
  it("blank starter yields a project with no preset genre", () => {
    const project = resolveNewProjectStarterProject({ kind: "blank" });
    expect(project.system.genre).toBeUndefined();
    expect(Object.keys(project.maps).length).toBeGreaterThan(0);
  });

  it("every starter option resolves to a project", () => {
    for (const starter of NEW_PROJECT_STARTERS) {
      const project = resolveNewProjectStarterProject(starter.starter);
      expect(Object.keys(project.maps).length).toBeGreaterThan(0);
    }
    expect(NEW_PROJECT_STARTERS.length).toBe(WELCOME_GENRE_PRESETS.length + 1);
  });

  it("genre preset starter applies that pack's system genre", () => {
    const project = resolveNewProjectStarterProject({
      kind: "system-preset",
      presetId: "farm-life",
    });
    expect(project.system.genre).toBe("farm-life");
  });

  it("dialog opens with name input and starter options, confirm returns choice", async () => {
    const pending = showNewProjectDialog("새 프로젝트");
    const modal = document.querySelector('[data-testid="new-project-modal"]');
    expect(modal).not.toBeNull();
    const cards = document.querySelectorAll('[data-testid^="new-project-starter-"]');
    expect(cards.length).toBe(NEW_PROJECT_STARTERS.length);
    const farmCard = Array.from(cards).find((card) =>
      card.textContent?.includes("농장 생활"),
    ) as HTMLButtonElement | undefined;
    expect(farmCard).toBeDefined();
    farmCard?.click();
    (document.querySelector('[data-testid="new-project-title-input"]') as HTMLInputElement).value = "내 농장";
    (document.querySelector('[data-testid="new-project-confirm"]') as HTMLButtonElement).click();
    const result = await pending;
    expect(result?.title).toBe("내 농장");
    expect(result?.starter).toEqual({ kind: "system-preset", presetId: "farm-life" });
    expect(document.querySelector('[data-testid="new-project-modal"]')).toBeNull();
  });
});
