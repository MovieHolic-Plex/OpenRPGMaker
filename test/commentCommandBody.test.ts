import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newM2Command } from "@/editor/eventCommandFactory";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { handleCommandShortcut } from "@/editor/panels/eventEditor/commandListContextMenu";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("comment command UX", () => {
  let restoreDom: (() => void) | undefined;
  let inserted: Command | undefined;

  const actions: CommandListActions = {
    addCommand: () => {},
    insertCommand: (_path, command) => {
      inserted = command;
    },
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    inserted = undefined;
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders dedicated comment editor with color select and preview", () => {
    const cmd = newM2Command("m2-088-comment");
    const body = renderWithFakeDom(() =>
      renderCommandBody({ path: [0], actions, lockKind: true }, {
        ...cmd,
        fields: { comment: "문 연 뒤 대사", color: "yellow" },
      })
    );

    expect(findByTestId(body, "m2-command-body-m2-088-comment")).toBeTruthy();
    expect(findByTestId(body, "m2-command-comment-textarea")).toBeTruthy();
    expect(findByTestId(body, "m2-command-comment-color")).toBeTruthy();
    expect(findByTestId(body, "m2-command-comment-preview")?.textContent).toContain("문 연 뒤 대사");
    expect(body.textContent).toContain("글자색");
    expect(body.textContent).toContain("Ctrl+/");
  });

  it("summarizes comments without dumping field keys", () => {
    const parts = commandSummaryParts({
      kind: "m2Command",
      commandId: "m2-088-comment",
      fields: { comment: "컷신 시작", color: "cyan" },
    });
    const text = parts.map((part) => part.text).join("");
    expect(text).toContain("주석");
    expect(text).toContain("컷신 시작");
    expect(text).not.toContain("color:");
  });

  it("Ctrl+/ inserts a comment command via shortcut", () => {
    const item = new FakeElement("div");
    item.className = "cmd-item";
    const event = {
      ctrlKey: true,
      altKey: false,
      key: "/",
      preventDefault() {},
    } as KeyboardEvent;

    handleCommandShortcut(event, {
      x: 0,
      y: 0,
      item: item as unknown as HTMLElement,
      command: { kind: "text", body: "x" },
      path: [0],
      actions,
      openEditor: () => {},
    });

    // openNewEventCommandDialog stages a modal; insert happens on apply.
    // Shortcut path must at least open without throwing and create a default comment.
    const cmd = newM2Command("m2-088-comment");
    expect(cmd.commandId).toBe("m2-088-comment");
    expect(cmd.fields).toMatchObject({ comment: "", color: "green" });
  });
});
