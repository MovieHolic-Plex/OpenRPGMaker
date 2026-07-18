import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import type { Command } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const noopActions = {
  addCommand: () => undefined,
  deleteCommand: () => undefined,
  insertCommand: () => undefined,
  moveCommand: () => undefined,
  moveCommandTo: () => undefined,
  replaceCommand: () => undefined,
};

describe("choices command body", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders only active option rows (no ghost empty slots)", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions },
        {
          kind: "choices",
          prompt: "진행할까요?",
          options: [
            { text: "예", branch: [] },
            { text: "아니오", branch: [] },
          ],
          cancelBehavior: "choice2",
        } satisfies Command
      )
    );

    expect(findByTestId(body, "event-choice-option-1")).not.toBeNull();
    expect(findByTestId(body, "event-choice-option-2")).not.toBeNull();
    expect(findByTestId(body, "event-choice-option-3")).toBeNull();
    expect(findByTestId(body, "event-choice-option-4")).toBeNull();
    expect(findByTestId(body, "event-choice-option-5")).toBeNull();
    expect(findByTestId(body, "event-choice-add")).not.toBeNull();
    expect(findByTestId(body, "event-choice-cancel-choice1")).not.toBeNull();
    expect(findByTestId(body, "event-choice-cancel-choice2")).not.toBeNull();
    expect(findByTestId(body, "event-choice-cancel-choice3")).toBeNull();
    expect(findByTestId(body, "event-choice-remove-1")).not.toBeNull();
    expect(findByTestId(body, "event-choice-remove-2")).not.toBeNull();

    const optionRow = findByTestId(body, "event-choice-option-1")?.parentElement;
    expect(optionRow?.className).toContain("event-command-choice-row");
    expect(optionRow?.className).not.toContain("event-command-choice-row-prompt");

    const promptRow = findByTestId(body, "event-choice-prompt")?.parentElement;
    expect(promptRow?.className).toContain("event-command-choice-row-prompt");
  });

  it("is RM2003-style: texts + cancel only (no inline branch editors)", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions },
        {
          kind: "choices",
          options: [
            { text: "A", branch: [{ kind: "text", body: "hi" }] },
            { text: "B", branch: [] },
            { text: "C", branch: [] },
          ],
          cancelBehavior: "branch",
          cancelBranch: [{ kind: "text", body: "cancel" }],
        } satisfies Command
      )
    );

    // Branch editing stays in the main event command list, not this dialog.
    expect(findByTestId(body, "event-choice-branch-1")).toBeNull();
    expect(findByTestId(body, "event-choice-branch-add-1")).toBeNull();
    expect(findByTestId(body, "event-choice-cancel-branch-body")).toBeNull();
    expect(findByTestId(body, "event-choice-cancel-branch-add")).toBeNull();
    expect(findByTestId(body, "event-choice-delete-1")).toBeNull();
    expect(findByTestId(body, "event-choice-branch-list-note")).not.toBeNull();
  });

  it("uses short labels and omits long help paragraphs", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions },
        {
          kind: "choices",
          options: [
            { text: "예", branch: [] },
            { text: "아니오", branch: [] },
          ],
          cancelBehavior: "choice2",
        } satisfies Command
      )
    );

    const text = body.textContent ?? "";
    expect(text).not.toContain("플레이어가 취소");
    expect(text).not.toContain("오른쪽 미리보기");
    expect(text).not.toContain("접어서 편집");
    expect(text).not.toContain("응답 명령");
    expect(text).not.toContain("명령 추가");
    expect(text).toContain("이벤트 목록에서 편집");
    expect(findByTestId(body, "event-choice-cancel-disallow")).not.toBeNull();
    expect(findByTestId(body, "event-choice-add")?.textContent).toContain("추가");
  });
});
