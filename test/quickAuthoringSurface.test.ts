import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { newCommand } from "@/editor/eventActions";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { eventCommandPickerTabEntries } from "@/editor/panels/eventEditor/commandPicker";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { M2_QUICK_AUTHORING_SURFACE_GROUPS } from "@/project/eventCommands/m2PickerLayout";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";
import type { Command } from "@/project/types";

/**
 * 탭 1 「빠른 저작」은 28행 RM 카탈로그 페이지가 아니라 이야기 작업면이다.
 * 계약: `.omo/plans/event-editor-quick-authoring-adversarial-review.md`
 *
 * - 미리보기는 식별 가능하다: 문장·얼굴·맵·경로·상품이 보인다.
 * - 고를 수 없는 안내 행은 탭 1 그리드에 0개다.
 * - 전수 삽입(`entries.length === 28`)은 성공 조건이 아니다.
 */
describe("picker tab 1 information architecture", () => {
  it("puts zero informational (unselectable) rows on the tab-1 grid", () => {
    const entries = eventCommandPickerTabEntries(1);

    expect(entries.filter((entry) => !entry.selectable).map((entry) => entry.commandId)).toEqual([]);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("groups tab 1 by work surface, not by RM classification names", () => {
    const groups = [...new Set(eventCommandPickerTabEntries(1).map((entry) => entry.group))];

    expect(groups).not.toContain("대화/입력");
    expect(groups).not.toContain("조건/흐름");
    expect(groups).not.toContain("보상/상점");
    expect(groups).not.toContain("아이템/경제");
    expect(groups).not.toContain("상점/시설");
    for (const group of groups) expect(M2_QUICK_AUTHORING_SURFACE_GROUPS).toContain(group);
    expect(groups).toContain("말하기");
    expect(groups).toContain("옮기기");
    expect(groups).toContain("거래");
  });

  it("keeps comments off the tab-1 grid instead of treating them as first-class story cards", () => {
    const tabOne = eventCommandPickerTabEntries(1).map((entry) => entry.commandId);

    expect(tabOne).not.toContain("m2-088-comment");
    // 데이터는 남는다 — 다른 탭에서 여전히 고를 수 있다(카탈로그 삭제가 목표가 아니다).
    const elsewhere = [2, 3, 4].flatMap((page) =>
      eventCommandPickerTabEntries(page as 2 | 3 | 4).map((entry) => entry.commandId)
    );
    expect(elsewhere).toContain("m2-088-comment");
  });
});

describe("quick authoring previews are identifiable", () => {
  function withProject<T>(run: () => T): T {
    const restore = installFakeDom();
    try {
      store.replace(createBlankProject());
      return run();
    } finally {
      restore();
    }
  }

  function preview(cmd: Command): FakeElement {
    return renderWithFakeDom(() => renderCommandPreview(cmd));
  }

  it("speaks with sample dialogue and a face when the body is still empty", () => {
    withProject(() => {
      const root = preview({ kind: "text", speaker: "", body: "" });

      const window = findByTestId(root, "ecp-message-window");
      const body = findByTestId(root, "ecp-message-body");
      expect(window?.dataset.sample).toBe("true");
      expect(body?.textContent.trim()).not.toBe("...");
      expect(body?.textContent.length ?? 0).toBeGreaterThan(3);
      expect(findByTestId(root, "ecp-message-sample-note")).toBeTruthy();
      // 얼굴은 카피가 아니라 faceset 크롭이다.
      expect(root.querySelectorAll(".event-command-face-crop-shell").length).toBeGreaterThanOrEqual(1);
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("keeps the authored sentence once the writer types one", () => {
    withProject(() => {
      const root = preview({ kind: "text", speaker: "촌장", body: "달빛 약초를 찾아 주게." });

      expect(findByTestId(root, "ecp-message-window")?.dataset.sample).toBeUndefined();
      expect(findByTestId(root, "ecp-message-body")?.textContent).toContain("달빛 약초");
      expect(findByTestId(root, "ecp-message-sample-note")).toBeNull();
    });
  });

  it("previews a face change as a faceset crop", () => {
    withProject(() => {
      const root = preview({
        kind: "changeFace",
        resourceId: "easyrpg-faceset-actor1-02",
        position: "left",
        flipHorizontally: false,
      });

      expect(root.querySelectorAll(".event-command-face-crop-shell").length).toBeGreaterThanOrEqual(1);
      expect(findByTestId(root, "ecp-face-caption")?.textContent).toContain("왼쪽 · 얼굴");
      // 낱장 얼굴 모델: 캡션에 칸 순번이 다시 들어가지 않는다.
      expect(findByTestId(root, "ecp-face-caption")?.textContent).not.toMatch(/얼굴\s*\d/);
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("draws windows and buttons for choices and number input", () => {
    withProject(() => {
      const choices = preview({
        kind: "choices",
        prompt: "도울까?",
        options: [{ text: "예", branch: [] }, { text: "아니오", branch: [] }],
      });
      expect(choices.querySelectorAll(".ecp-choice-window").length).toBe(1);
      expect(choices.querySelectorAll(".ecp-choice").length).toBe(2);

      const project = store.getCurrent();
      const variableId = project.variables[0]?.id ?? "";
      const number = preview({ kind: "inputNumber", variableId, digits: 4, prompt: "몇 개?" });
      // 변수 표시명이 자리수 미리보기를 삼키지 않는다 — 자리수와 변수 칩이 따로 있다.
      expect(findByTestId(number, "ecp-number-digit-count")?.textContent).toContain("4자리");
      expect(findByTestId(number, "ecp-number-variable")?.textContent).toContain("변수");
      expect(findByTestId(number, "ecp-number-slots")?.childNodes.length).toBe(4);
    });
  });

  it("shows the transfer target on a map, not a coordinate sentence alone", () => {
    withProject(() => {
      const project = store.getCurrent();
      const mapId = project.startMapId;
      const root = preview({ kind: "transfer", mapId, x: 4, y: 5, direction: "retain", fade: "black" });

      expect(findByTestId(root, "ecp-transfer-canvas")).toBeTruthy();
      const caption = root.querySelectorAll(".ecp-map-caption")[0];
      expect(caption?.textContent).toContain("(4, 5)");
      expect(root.querySelectorAll(".ecp-summary-card")).toHaveLength(0);
    });
  });

  it("starts a move route with one trajectory step instead of an empty stage", () => {
    withProject(() => {
      const command = newCommand("moveEvent");
      expect(command.kind).toBe("moveEvent");
      if (command.kind !== "moveEvent") return;
      expect(command.route.moves.length).toBeGreaterThanOrEqual(1);

      const root = preview(command);
      const tape = findByTestId(root, "ecp-move-tape");
      expect(tape?.textContent).not.toContain("이동 명령 없음");
      expect(root.querySelectorAll(".ecp-move-chip").length).toBeGreaterThanOrEqual(1);
      expect(findByTestId(root, "ecp-move-grid-box")?.textContent).toContain("궤적");
    });
  });

  it("stocks a general store on the first shop screen", () => {
    withProject(() => {
      const command = newCommand("shop");
      expect(command.kind).toBe("shop");
      if (command.kind !== "shop") return;
      expect(command.itemIds.length).toBeGreaterThanOrEqual(1);

      const root = preview(command);
      expect(findByTestId(root, "ecp-shop-empty-warn")).toBeNull();
      expect(root.querySelectorAll(".ecp-shop-item-row").length).toBeGreaterThanOrEqual(1);
      expect(root.textContent).not.toContain("상품 없음");
    });
  });

  it("draws wait as a timeline that states the duration once", () => {
    withProject(() => {
      const root = preview({ kind: "wait", ms: 500 });

      expect(findByTestId(root, "ecp-wait-timeline")).toBeTruthy();
      expect(findByTestId(root, "ecp-wait-span")).toBeTruthy();
      expect(root.querySelectorAll(".ecp-wait-node").length).toBe(2);
      expect(root.querySelectorAll(".ecp-wait-card")).toHaveLength(0);
      const occurrences = (root.textContent.match(/0\.5초/g) ?? []).length;
      expect(occurrences).toBe(1);
    });
  });
});

describe("empty event entry", () => {
  it("offers 말하기 / 장소 옮기기 / 상점 열기 as the first move", () => {
    const restore = installFakeDom();
    try {
      store.replace(createBlankProject());
      const picked: string[] = [];
      const board = renderWithFakeDom(() =>
        renderStoryboard([], { onQuickStart: (kind) => picked.push(kind) })
      );

      const quick = findByTestId(board, "event-storyboard-quick-starts");
      expect(quick).toBeTruthy();
      expect(findByTestId(board, "event-storyboard-quick-text")?.textContent).toContain("말하기");
      expect(findByTestId(board, "event-storyboard-quick-transfer")?.textContent).toContain("장소 옮기기");
      expect(findByTestId(board, "event-storyboard-quick-shop")?.textContent).toContain("상점 열기");

      findByTestId(board, "event-storyboard-quick-shop")?.dispatchEvent(new Event("click"));
      expect(picked).toEqual(["shop"]);
    } finally {
      restore();
    }
  });
});
