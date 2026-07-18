import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { renderCommandPreview } from "@/editor/panels/eventEditor/commandPreview";
import { commandSummaryParts } from "@/editor/panels/eventEditor/commandSummary";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
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

describe("wait command body", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });

  afterEach(() => {
    restoreDom?.();
  });

  it("renders time mode with seconds + presets (not a bare ms field)", () => {
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions },
        { kind: "wait", ms: 500 } satisfies Command
      )
    );

    expect(findByTestId(body, "event-command-wait-body")).not.toBeNull();
    expect(findByTestId(body, "event-wait-mode-time")).not.toBeNull();
    expect(findByTestId(body, "event-wait-mode-variable")).not.toBeNull();
    expect(findByTestId(body, "event-wait-seconds")).not.toBeNull();
    expect(findByTestId(body, "event-wait-preset-1000")).not.toBeNull();
    expect(findByTestId(body, "event-wait-time-panel")?.hidden).toBe(false);
    expect(findByTestId(body, "event-wait-variable-panel")?.hidden).toBe(true);
  });

  it("shows variable panel when wait uses variableId", () => {
    const variableId = store.getCurrent().variables[0]?.id ?? "var_0001";
    const body = renderWithFakeDom(() =>
      renderCommandBody(
        { path: [], actions: noopActions },
        { kind: "wait", ms: 0, variableId } satisfies Command
      )
    );

    expect(findByTestId(body, "event-wait-variable-panel")?.hidden).toBe(false);
    expect(findByTestId(body, "event-wait-time-panel")?.hidden).toBe(true);
    const summary = commandSummaryParts({ kind: "wait", ms: 0, variableId }).map((part) => part.text).join("");
    expect(summary).toContain("변수");
  });

  it("previews fixed wait in seconds", () => {
    const preview = renderWithFakeDom(() => renderCommandPreview({ kind: "wait", ms: 1500 }));
    expect(findByTestId(preview, "ecp-wait-stage")).not.toBeNull();
    expect(preview.textContent ?? "").toContain("1.5초");
  });
});
