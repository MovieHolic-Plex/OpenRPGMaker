// [P2] 라이브 미리보기/플로우 파생 뷰 + 크로스 컨테이너 이동.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  flattenScript,
  renderEventPageFlow,
  renderEventPagePreview,
} from "@/editor/panels/eventEditor/eventScriptModernViews";
import {
  FORK_THEN_BRANCH_INDEX,
  isContainerInsideCommand,
  moveCommandBetweenLists,
  resolveCommandListAtPath,
} from "@/editor/eventCommandPaths";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const PAGE_BASE: Omit<EventPage, "commands"> = {
  id: "pg_test",
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

describe("이벤트 스크립트 모던 뷰 (P2)", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("flattenScript 는 분기 라벨과 시뮬레이션 상태를 스크립트 순서로 기록한다", () => {
    const commands: Command[] = [
      { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-03", position: "left", flipHorizontally: false },
      { kind: "text", body: "안녕" },
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "", value: true },
        then: [{ kind: "text", body: "참" }],
        else: [{ kind: "text", body: "거짓" }],
      },
    ];
    const steps = flattenScript(commands);
    expect(steps.map((step) => step.command.kind)).toEqual(["changeFace", "text", "fork", "text", "text"]);
    expect(steps[0]?.simState).toBeDefined();
    expect(steps[1]?.simState).toBeDefined();
    expect(steps[2]?.simState).toBeDefined();
    expect(steps[3]?.branchLabel).toBe("조건이 맞을 때");
    expect(steps[4]?.branchLabel).toBe("조건이 맞지 않을 때");
    const forkStep = steps.find((s) => s.command.kind === "fork");
    expect(forkStep?.forkTaken).toBeDefined();
  });

  it("미리보기 패널은 details 접힘 없이 무대와 스텝 조작을 바로 내건다", () => {
    const page = pageWith([{ kind: "text", body: "한 줄" }]);
    const root = renderWithFakeDom(() =>
      renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page })
    );
    const panel = findByTestId(root, "event-page-preview");
    expect(panel).not.toBeNull();
    expect((panel as unknown as { tagName?: string }).tagName?.toLowerCase()).not.toBe("details");
    expect(findByTestId(root, "event-script-live-stage")).not.toBeNull();
    expect(findByTestId(root, "event-script-live-prev")).not.toBeNull();
    expect(findByTestId(root, "event-script-live-next")).not.toBeNull();
    expect(findByTestId(root, "event-script-live-play")).not.toBeNull();
  });

  it("명령이 없으면 미리보기는 빈 안내를 내건다", () => {
    const root = renderWithFakeDom(() =>
      renderEventPagePreview({ mapId: "map_start", eventId: "ev_test", page: pageWith([]) })
    );
    expect(findByTestId(root, "event-page-preview-empty")).not.toBeNull();
    expect(findByTestId(root, "event-script-live-stage")).toBeNull();
  });

  it("플로우는 팝오버 details 가 아니라 칼럼 전체를 쓰는 보기 방식으로 렌더된다", () => {
    const page = pageWith([{ kind: "text", body: "한 줄" }]);
    const root = renderWithFakeDom(() =>
      renderEventPageFlow({ mapId: "map_start", eventId: "ev_test", page })
    );
    // 예전 도구 팝오버 아코디언(`event-script-flowchart`)은 미리보기 위에 겹쳐 떴다 — 이제 없다.
    expect(findByTestId(root, "event-script-flowchart")).toBeNull();
    expect(findByTestId(root, "event-page-flow")).not.toBeNull();
    expect(findByTestId(root, "event-flow-node-text")).not.toBeNull();
  });

  it("플로우는 fork/choices 분기를 하위 컬럼으로 렌더한다", () => {
    const root = renderWithFakeDom(() =>
      renderEventPageFlow({
        mapId: "map_start",
        eventId: "ev_test",
        page: pageWith([
          {
            kind: "choices",
            options: [
              { text: "예", branch: [{ kind: "text", body: "긍정" }] },
              { text: "아니오", branch: [] },
            ],
          },
        ]),
      })
    );
    const flow = findByTestId(root, "event-flowchart-body");
    expect(flow).not.toBeNull();
    const labels = flow ? flow.querySelectorAll(".event-flow-branch-label").map((node) => node.textContent) : [];
    expect(labels).toContain("예");
    expect(labels).toContain("아니오");
    expect(flow?.querySelectorAll(".event-flow-empty").length).toBe(1);
  });
});

describe("크로스 컨테이너 명령 이동 (P2)", () => {
  it("isContainerInsideCommand 는 자기 분기 안 이동만 참이다", () => {
    expect(isContainerInsideCommand([2], [2, FORK_THEN_BRANCH_INDEX])).toBe(true);
    expect(isContainerInsideCommand([2], [1, FORK_THEN_BRANCH_INDEX])).toBe(false);
    expect(isContainerInsideCommand([2, FORK_THEN_BRANCH_INDEX, 0], [])).toBe(false);
    expect(isContainerInsideCommand([0], [0])).toBe(false);
  });

  it("moveCommandBetweenLists 는 루트 → fork then 분기 이동을 수행한다", () => {
    const commands: Command[] = [
      { kind: "text", body: "이동 대상" },
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "", value: true },
        then: [{ kind: "text", body: "기존" }],
      },
    ];
    const targetList = resolveCommandListAtPath(commands, [1, FORK_THEN_BRANCH_INDEX], { missingBranches: "create" });
    expect(targetList).not.toBeNull();
    if (!targetList) return;
    expect(moveCommandBetweenLists(commands, 0, targetList, Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(commands.length).toBe(1);
    expect(commands[0]?.kind).toBe("fork");
    const fork = commands[0];
    if (fork?.kind !== "fork") return;
    expect(fork.then.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["기존", "이동 대상"]);
  });

  it("같은 리스트 이동은 기존 재정렬 규칙(클램프)을 따른다", () => {
    const list: Command[] = [
      { kind: "text", body: "A" },
      { kind: "text", body: "B" },
      { kind: "text", body: "C" },
    ];
    expect(moveCommandBetweenLists(list, 0, list, 99)).toBe(true);
    expect(list.map((cmd) => (cmd.kind === "text" ? cmd.body : ""))).toEqual(["B", "C", "A"]);
  });
});
