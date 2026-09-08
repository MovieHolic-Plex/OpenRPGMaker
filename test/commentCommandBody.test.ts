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

  it("edits comment text and color through catalog controls without losing either field", () => {
    let cmd: Command = { ...newM2Command("m2-088-comment"), fields: { comment: "문 연 뒤 대사", color: "yellow" } };
    const body = renderWithFakeDom(() => renderCommandBody({
      path: [0], lockKind: true, getCurrentCommand: () => cmd,
      actions: { ...actions, replaceCommand: (_path, next) => { cmd = next; } },
    }, cmd));

    expect(findByTestId(body, "m2-command-body-m2-088-comment")).toBeTruthy();
    expect(findByTestId(body, "m2-command-comment-textarea")).toBeTruthy();
    const text = findByTestId(body, "m2-command-comment-textarea");
    const color = findByTestId(body, "m2-command-color-option-select");
    if (!text || !color) throw new Error("missing comment controls");
    expect(text.value).toBe("문 연 뒤 대사");
    expect(color.value).toBe("yellow");
    text.value = "수정된 주석";
    text.dispatchEvent(new Event("change"));
    color.value = "cyan";
    color.dispatchEvent(new Event("change"));
    expect(cmd).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "수정된 주석", color: "cyan" } });
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
    const event = new Event("keydown", { bubbles: true, cancelable: true });
    Object.defineProperties(event, { ctrlKey: { value: true }, altKey: { value: false }, key: { value: "/" } });

    handleCommandShortcut(event as KeyboardEvent, {
      x: 0,
      y: 0,
      item: item as unknown as HTMLElement,
      command: { kind: "text", body: "x" },
      path: [0],
      actions,
      openEditor: () => {},
    });

    expect(event.defaultPrevented).toBe(true);
    expect(inserted).toBeUndefined();
    const text = document.querySelector<HTMLTextAreaElement>('[data-testid="m2-command-comment-textarea"]');
    if (!text) throw new Error("shortcut did not open comment editor");
    text.value = "shortcut comment";
    text.dispatchEvent(new Event("change"));
    document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-ok"]')?.click();
    expect(inserted).toEqual({ kind: "m2Command", commandId: "m2-088-comment", fields: { comment: "shortcut comment", color: "green" } });
  });
});
