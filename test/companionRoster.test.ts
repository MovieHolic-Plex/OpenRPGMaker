/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { renderCompanionRoster } from "@/editor/panels/eventEditor/companionRoster";
import { createBlankProject } from "@/project/defaults";
import type { ActorRecord, Project } from "@/project/types";

describe("companion roster in the companion command picker", () => {
  it("lists every database actor with a rendered portrait background", () => {
    const project = fixtureProject();
    const root = renderCompanionRoster(project);

    expect(root.dataset.testid).toBe("companion-roster");
    const cards = root.querySelectorAll("[data-testid^='companion-card-']");
    expect(cards.length).toBe(project.database.actors.length);
    for (const actor of project.database.actors) {
      const card = root.querySelector(`[data-testid='companion-card-${actor.id}']`);
      expect(card?.textContent ?? "").toContain(actor.name);
      const thumb = card?.querySelector(`[data-testid='companion-thumb-${actor.id}']`) as HTMLElement | null;
      expect(thumb?.style.backgroundImage ?? "").toContain("url(");
    }
  });

  it("collapses to a hint when no actor exists", () => {
    const project = createBlankProject();
    project.database.actors = [];
    const root = renderCompanionRoster(project);
    expect(root.querySelectorAll("[data-testid^='companion-card-']").length).toBe(0);
  });
});

function fixtureProject(): Project {
  const project = createBlankProject();
  const template = project.database.actors[0];
  if (!template) throw new Error("missing default actor fixture");
  project.database.actors = [template, ...project.database.actors.slice(1)].map((actor, index) => ({
    ...actor,
    faceResourceId: index === 0 ? undefined : actor.faceResourceId,
    characterResourceId: index === 0 ? "easyrpg-charset-object1" : actor.characterResourceId,
    characterIndex: index,
  }));
  return project;
}
