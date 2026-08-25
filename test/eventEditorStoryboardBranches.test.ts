// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { loadStoryboardMode } from "@/editor/panels/eventEditor/storyboardView";
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
  it("uses the visual storyboard as the default authoring view", () => {
    expect(loadStoryboardMode()).toBe("storyboard");
  });

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
    expect(host.querySelectorAll(".event-storyboard-branches")).toHaveLength(1);
  });

  it("renders nested branch commands with their exact selectable command path", () => {
    const command: Command = {
      kind: "choices",
      prompt: "의뢰를 어떻게 하시겠습니까?",
      options: [
        {
          text: "맡는다",
          branch: [
            { kind: "setSwitch", switchId: "0001", value: true },
            { kind: "setVariable", variableId: "0001", op: "=", operand: { kind: "constant", value: 0 } },
            { kind: "text", body: "고맙네. 자네 덕분이야!" },
          ],
        },
        { text: "나중에", branch: [{ kind: "text", body: "알겠네." }] },
      ],
      cancelBehavior: "choice2",
    };
    const selected: number[][] = [];
    const host = renderStoryboard([command], { onSelect: (path) => selected.push(path) });

    expect(host.querySelectorAll(".event-storyboard-branch-command")).toHaveLength(4);
    const nested = host.querySelector<HTMLElement>("[data-cmd-path='[0,0,2]']");
    expect(nested?.textContent).toContain("고맙네. 자네 덕분이야!");
    nested?.click();
    expect(selected).toEqual([[0, 0, 2]]);
  });

  it("recursively renders and selects commands nested two branches deep", () => {
    const command: Command = {
      kind: "choices",
      options: [{
        text: "맡는다",
        branch: [{
          kind: "fork",
          condition: { kind: "switch", switchId: "0001", value: true },
          then: [{ kind: "text", body: "두 단계 안쪽 명령" }],
        }],
      }],
    };
    const selected: number[][] = [];
    const host = renderStoryboard([command], { onSelect: (path) => selected.push(path) });
    const deep = host.querySelector<HTMLElement>("[data-cmd-path='[0,0,0,-2,0]']");
    expect(deep?.textContent).toContain("두 단계 안쪽 명령");
    deep?.click();
    expect(selected).toEqual([[0, 0, 0, -2, 0]]);
  });

  it.each([
    ["shop transaction", { kind: "shop", goods: [], branchOnTransaction: true, transactionBranch: [{ kind: "text", body: "거래 완료" }] } as Command, [0, -1, 0], "거래 완료"],
    ["inn insufficient gold", { kind: "inn", price: 50, branchOnNotEnoughGold: true, notEnoughBranch: [{ kind: "text", body: "골드 부족" }] } as Command, [0, -8, 0], "골드 부족"],
    ["actor promotion success", { kind: "promoteActor", actorId: "actor-1", successBranch: [{ kind: "text", body: "승급 성공" }] } as Command, [0, -6, 0], "승급 성공"],
    ["monster evolution failure", { kind: "evolveMonster", instanceId: "monster-1", failureBranch: [{ kind: "text", body: "진화 실패" }] } as Command, [0, -7, 0], "진화 실패"],
  ])("renders the %s branch with its resolvable path", (_label, command, path, text) => {
    const host = renderStoryboard([command]);
    expect(host.querySelector<HTMLElement>(`[data-cmd-path='${JSON.stringify(path)}']`)?.textContent).toContain(text);
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
