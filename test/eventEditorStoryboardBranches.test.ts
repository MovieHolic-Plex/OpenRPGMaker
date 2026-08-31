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

// 분기 이름은 카드 아래 펼쳐진 패널이 **한 번만** 찍는다. 예전에는 카드 안에도 앞 2개를
// 12자로 자른 «칩 줄»(`.event-storyboard-card-branches`)이 있어서 같은 목록이 두 번 나왔다.
describe("storyboard renders each branch name exactly once", () => {
  it("uses the visual storyboard as the default authoring view", () => {
    expect(loadStoryboardMode()).toBe("storyboard");
  });

  it("no longer renders the truncated chip row inside the card", () => {
    const host = renderStoryboard([
      choicesCommand(["맡는다", "나중에", "거절한다"]),
      { kind: "fork", condition: { kind: "switch", switchId: "s1", value: true }, then: [], else: [] },
    ]);
    document.body.append(host);

    expect(host.querySelectorAll(".event-storyboard-card-branches").length).toBe(0);
    expect(host.querySelectorAll(".event-storyboard-branch-more").length).toBe(0);
    host.remove();
  });

  it("names every branch of a 3-option choice once, untruncated", () => {
    const host = renderStoryboard([choicesCommand(["맡는다", "나중에", "거절한다"])]);

    expect(host.querySelectorAll(".event-storyboard-branches")).toHaveLength(1);
    const labels = [...host.querySelectorAll(".event-storyboard-branch-label")].map((n) => n.textContent);
    expect(labels).toEqual(["맡는다", "나중에", "거절한다"]);
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
    expect([...host.querySelectorAll<HTMLElement>(".event-storyboard-branch-step")].map((node) => node.textContent))
      .toEqual(["1", "2", "3", "1"]);
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

  it("lists the cancel branch alongside the options, with the shared label", () => {
    const host = renderStoryboard([choicesCommand(["맡는다", "나중에"], true)]);
    const labels = [...host.querySelectorAll(".event-storyboard-branch-label")].map((n) => n.textContent);
    expect(labels).toEqual(["맡는다", "나중에", "취소했을 때"]);

    const four = renderStoryboard([choicesCommand(["가", "나", "다", "라"], true)]);
    expect([...four.querySelectorAll(".event-storyboard-branch-label")].map((n) => n.textContent))
      .toEqual(["가", "나", "다", "라", "취소했을 때"]);
  });

  it("uses the shared empty-branch copy and opens that branch's add route", () => {
    const targets: number[][] = [];
    const host = renderStoryboard([{ kind: "loop", body: [] }], {
      onAddToBranch: (path) => targets.push(path),
    });
    const empty = host.querySelector<HTMLButtonElement>(".event-storyboard-branch-empty");
    expect(empty?.textContent).toBe("비어 있음 — 여기에 명령 추가");
    empty?.click();
    expect(targets).toEqual([[0, -5]]);
  });

  it("renders no branch panel for commands without branches", () => {
    const host = renderStoryboard([{ kind: "wait", ms: 100 }]);
    const card = cardOf(host, 0);
    expect(card.querySelector(".event-storyboard-card-branches")).toBeNull();
    expect(host.querySelectorAll(".event-storyboard-branches").length).toBe(0);
  });
});
