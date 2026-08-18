// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import type { Command } from "@/project/types";

function choicesCommand(optionTexts: string[], withCancel = false): Command {
  return {
    kind: "choices",
    prompt: "어떻게 할까?",
    options: optionTexts.map((text) => ({ text, branch: [] as Command[] })),
    ...(withCancel ? { cancelBehavior: "branch" as const, cancelBranch: [] as Command[] } : {}),
  };
}

function cardOf(host: HTMLElement, idx: number): HTMLElement {
  const card = host.querySelector<HTMLElement>(`.event-storyboard-card[data-cmd-path='[${idx}]']`);
  if (!card) throw new Error(`card ${idx} not found`);
  return card;
}

describe("storyboard branch chips stay inside their card", () => {
  it("leaves no .event-storyboard-branch as a direct child of the track", () => {
    const host = renderStoryboard([
      choicesCommand(["맡는다", "나중에", "거절한다"]),
      { kind: "fork", condition: { kind: "switch", switchId: "s1", value: true }, then: [], else: [] },
    ]);
    document.body.append(host);

    expect(host.querySelectorAll(".event-storyboard-track > .event-storyboard-branch").length).toBe(0);
    for (const chip of host.querySelectorAll<HTMLElement>(".event-storyboard-branch")) {
      const row = chip.parentElement;
      expect(row?.classList.contains("event-storyboard-card-branches")).toBe(true);
      expect(row?.parentElement?.classList.contains("event-storyboard-card")).toBe(true);
      expect(chip.closest(".event-storyboard-card")).toBe(row?.parentElement ?? null);
    }
    host.remove();
  });

  it("renders at most 2 pills plus a +K badge for a 3-option choices card", () => {
    const host = renderStoryboard([choicesCommand(["맡는다", "나중에", "거절한다"])]);
    const card = cardOf(host, 0);

    const row = card.querySelector(".event-storyboard-card-branches");
    expect(row).not.toBeNull();
    expect(card.lastElementChild).toBe(row);
    const pills = card.querySelectorAll(".event-storyboard-branch");
    expect(pills.length).toBe(2);
    expect(pills[0]?.querySelector(".event-storyboard-branch-label")?.textContent).toBe("맡는다");
    expect(pills[1]?.querySelector(".event-storyboard-branch-label")?.textContent).toBe("나중에");
    expect(card.querySelector(".event-storyboard-branch-more")?.textContent).toBe("+1");
  });

  it("counts the cancel branch as a normal branch in +K, not a mandatory third slot", () => {
    const host = renderStoryboard([choicesCommand(["맡는다", "나중에"], true)]);
    const card = cardOf(host, 0);

    expect(card.querySelectorAll(".event-storyboard-branch").length).toBe(2);
    expect(card.querySelector(".event-storyboard-branch-more")?.textContent).toBe("+1");

    const four = renderStoryboard([choicesCommand(["가", "나", "다", "라"], true)]);
    const fourCard = cardOf(four, 0);
    expect(fourCard.querySelectorAll(".event-storyboard-branch").length).toBe(2);
    expect(fourCard.querySelector(".event-storyboard-branch-more")?.textContent).toBe("+3");
  });

  it("renders no branches row for commands without branches", () => {
    const host = renderStoryboard([{ kind: "wait", ms: 100 }]);
    const card = cardOf(host, 0);
    expect(card.querySelector(".event-storyboard-card-branches")).toBeNull();
    expect(host.querySelectorAll(".event-storyboard-branch").length).toBe(0);
  });
});
