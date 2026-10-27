import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { installFakeDom, renderWithFakeDom } from "./fakeDom";

describe("weekday condition toggles", () => {
  let restoreDom: (() => void) | undefined;

  const actions: CommandListActions = {
    addCommand: () => {},
    insertCommand: () => {},
    replaceCommand: () => {},
    deleteCommand: () => {},
    moveCommand: () => {},
    moveCommandTo: () => {},
  };

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("keeps earlier weekday toggles when the branch form is not rebuilt", () => {
    let cmd: Command = { kind: "fork", condition: { kind: "weekday", weekdays: [0, 6] }, then: [] };
    const body = renderWithFakeDom(() => renderCommandBody({
      path: [0],
      lockKind: true,
      getCurrentCommand: () => cmd,
      actions: { ...actions, replaceCommand: (_path, next) => { cmd = next; } },
    }, cmd));

    const boxes = body.querySelector('[data-testid="event-condition-weekdays"]')?.querySelectorAll("input") ?? [];
    expect(boxes.map((box) => box.checked)).toEqual([true, false, false, false, false, false, true]);
    expect(body.querySelector('[data-testid="event-condition-eval-summary"]')?.textContent).toBe("요일 일·토");

    const sunday = boxes[0];
    const monday = boxes[1];
    if (!sunday || !monday) throw new Error("missing weekday checkboxes");
    sunday.checked = false;
    sunday.dispatchEvent(new Event("change"));
    monday.checked = true;
    monday.dispatchEvent(new Event("change"));

    expect(cmd).toMatchObject({ kind: "fork", condition: { kind: "weekday", weekdays: [1, 6] } });
    expect(body.querySelector('[data-testid="event-condition-eval-summary"]')?.textContent).toBe("요일 월·토");
    expect(boxes.map((box) => box.checked)).toEqual([false, true, false, false, false, false, true]);
  });
});
