/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import { createObjectiveCard, syncObjectiveCard } from "@/player/objectiveCard";

function host(touch: boolean): HTMLElement {
  const viewport = document.createElement("div");
  viewport.className = "play-viewport";
  if (touch) viewport.dataset.touchUi = "true";
  const stage = document.createElement("div");
  viewport.append(stage);
  document.body.append(viewport);
  return stage;
}

function firstCardControls(touch: boolean): string {
  const card = createObjectiveCard();
  const stage = host(touch);
  stage.append(card.element);
  syncObjectiveCard(card, stage, {}, null, true, 0);
  return card.element.querySelector(".objective-card-controls")?.textContent ?? "";
}

describe("objective card controls line (fs-vqa-fix-all, 390 touch)", () => {
  it("names keyboard keys on a keyboard screen", () => {
    expect(firstCardControls(false)).toContain("Esc");
  });

  it("names the on-screen buttons on a touch screen, not keyboard keys", () => {
    const text = firstCardControls(true);
    expect(text).not.toMatch(/Esc|Z |방향키/u);
    expect(text).toContain("A");
  });
});
