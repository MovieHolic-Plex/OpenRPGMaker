// @vitest-environment happy-dom
//
// 플로우가 «미리보기 위에 겹치는 팝오버» 에서 «네 번째 보기 방식» 으로 승격된 계약.
//
// 회귀 배경(실측 2026-08-31): 플로우는 도구 팝오버 안 `<details>` 아코디언이었고
// 618×280 으로 묶여 있었다. 1440px 높이 화면에서도 280px 만 써서 최상위 명령 7개 중
// 2개만 보였고, 무엇보다 미리보기 **위에** 절대 배치로 떠서 「자동 재생」 버튼과 단계
// 카운터를 덮었다. 겹쳐 뜨는 동안에도 미리보기가 몇 번째 단계인지 알려주지 않아
// 두 화면이 서로 남남이었다.
//
// 여기서 못박는 것:
//  1) 플로우는 `<details>` 팝오버가 아니다 (겹칠 오버레이가 없다)
//  2) 보기 방식 세그먼트에 네 번째 버튼으로 있고, 미리보기와 배타적이다
//  3) 미리보기가 보던 단계를 **경로로** 짚는다 — 인덱스로 짚으면 `breakLoop` 에서 어긋난다
import { describe, expect, it } from "vitest";
import {
  renderEventPageFlow,
  renderEventPagePreview,
} from "@/editor/panels/eventEditor/eventScriptModernViews";
import { renderViewToggle } from "@/editor/panels/eventEditor/storyboardView";
import { simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";

const PAGE_BASE: Omit<EventPage, "commands"> = {
  id: "pg_flow",
  name: "테스트",
  conditions: [],
  graphic: {},
  trigger: { kind: "action" },
  priority: "same",
  movement: { type: "fixed", speed: 3, frequency: 3 },
};

function pageWith(commands: Command[]): EventPage {
  return { ...PAGE_BASE, commands };
}

/** 분기 안쪽에 명령이 있는 페이지 — 경로가 여러 칸인 단계를 만든다. */
function branchingPage(): EventPage {
  return pageWith([
    { kind: "text", body: "첫 줄" },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "", value: true },
      then: [{ kind: "text", body: "참 쪽" }],
      else: [{ kind: "text", body: "거짓 쪽" }],
    },
    { kind: "text", body: "마지막 줄" },
  ] as Command[]);
}

function flowFor(page: EventPage, opts?: { onSelect?: (path: number[]) => void }): HTMLElement {
  store.replace(createBlankProject());
  return renderEventPageFlow({ mapId: "map_start", eventId: "ev_flow", page, ...opts });
}

describe("플로우 보기 승격", () => {
  it("팝오버 details 가 아니라 칼럼을 쓰는 section 이다", () => {
    const flow = flowFor(branchingPage());
    expect(flow.tagName.toLowerCase()).toBe("section");
    expect(flow.querySelector("details")).toBeNull();
    expect(flow.querySelector("[data-testid='event-script-flowchart']")).toBeNull();
    expect(flow.dataset.testid).toBe("event-page-flow");
  });

  it("보기 방식 세그먼트의 네 번째 버튼이고 미리보기와 배타적이다", () => {
    const bar = renderViewToggle("flow", () => {});
    const labels = Array.from(bar.querySelectorAll("button")).map((btn) => btn.textContent);
    expect(labels).toEqual(["목록", "스토리", "미리보기", "플로우"]);
    const flowBtn = bar.querySelector("[data-testid='event-view-toggle-flow']");
    const previewBtn = bar.querySelector("[data-testid='event-view-toggle-preview']");
    expect(flowBtn?.getAttribute("aria-selected")).toBe("true");
    expect(previewBtn?.getAttribute("aria-selected")).toBe("false");
  });

  it("미리보기를 한 번도 열지 않았으면 강조하지 않고, 안내만 보여준다", () => {
    const flow = flowFor(pageWith([{ kind: "text", body: "혼자" }] as Command[]));
    expect(flow.querySelectorAll(".event-flow-node.is-current").length).toBe(0);
    expect(flow.querySelector("[data-testid='event-page-flow-current']")?.textContent)
      .toContain("미리보기에서 보던 단계");
  });

  it("미리보기가 보던 단계를 이어받아 그 노드를 짚는다", () => {
    const page = branchingPage();
    store.replace(createBlankProject());
    // 미리보기를 열고 「다음」을 세 번 눌러 참 쪽 분기 안(경로 [1,-2,0])까지 간다.
    const preview = renderEventPagePreview({ mapId: "map_start", eventId: "ev_flow", page });
    const next = preview.querySelector<HTMLElement>("[data-testid='event-script-live-next']");
    if (!next) throw new Error("미리보기 「다음」 버튼을 찾지 못했다");
    next.click();
    next.click();

    const steps = simulatePageCommands(page.commands, "ev_flow").steps;
    const expectedPath = steps[2]?.path;
    expect(expectedPath).toEqual([1, -2, 0]);

    const flow = renderEventPageFlow({ mapId: "map_start", eventId: "ev_flow", page });
    const current = flow.querySelectorAll<HTMLElement>(".event-flow-node.is-current");
    expect(current.length).toBe(1);
    expect(current[0]?.dataset.cmdPath).toBe(JSON.stringify(expectedPath));
    expect(current[0]?.getAttribute("aria-current")).toBe("step");
    expect(flow.querySelector("[data-testid='event-page-flow-current']")?.textContent)
      .toBe(`미리보기 현재 단계 3/${steps.length}`);
  });

  it("노드를 누르면 목록·스토리와 같은 편집 경로를 넘긴다", () => {
    const picked: number[][] = [];
    const flow = flowFor(branchingPage(), { onSelect: (path) => picked.push(path) });
    const nodes = flow.querySelectorAll<HTMLElement>(".event-flow-node");
    // 순차 명령 3개 + 분기 안 2개 = 5개 노드.
    expect(nodes.length).toBe(5);
    nodes[2]?.click();
    expect(picked).toEqual([[1, -2, 0]]);
  });

  it("`breakLoop` 이 뒤 명령을 끊어도 단계 경로는 어긋나지 않는다", () => {
    // 인덱스로 짝지으면 여기서 깨진다: 단계는 breakLoop 에서 멈추지만 플로우는 뒤 노드도 그린다.
    const page = pageWith([
      {
        kind: "loop",
        body: [
          { kind: "breakLoop" },
          { kind: "text", body: "닿지 않는 줄" },
        ],
      },
      { kind: "text", body: "반복 다음" },
    ] as Command[]);
    store.replace(createBlankProject());
    const steps = simulatePageCommands(page.commands, "ev_flow").steps;
    // 단계: loop, breakLoop, (뒤 텍스트는 걷지 않음), 반복 다음
    expect(steps.map((step) => step.command.kind)).toEqual(["loop", "breakLoop", "text"]);
    expect(steps.map((step) => step.path)).toEqual([[0], [0, -5, 0], [1]]);

    const flow = flowFor(page);
    // 플로우는 닿지 않는 줄까지 그리므로 노드는 4개 — 단계 수(3)와 다르다.
    const paths = Array.from(flow.querySelectorAll<HTMLElement>(".event-flow-node"))
      .map((node) => node.dataset.cmdPath);
    expect(paths).toEqual([
      JSON.stringify([0]),
      JSON.stringify([0, -5, 0]),
      JSON.stringify([0, -5, 1]),
      JSON.stringify([1]),
    ]);
    expect(paths.length).not.toBe(steps.length);
  });
});
