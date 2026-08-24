import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderWorkspaceBar } from "@/editor/panels/workspaceBar";
import { layoutFromPreset } from "@/editor/workspace/workspaceLayout";
import { resetWorkspaceForTests } from "@/editor/workspace/workspaceStore";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  resetWorkspaceForTests(layoutFromPreset("map"));
  editorState.set({ chatDock: "side" });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("workspace assistant placement menu", () => {
  it("uses real assistant dock choices instead of the disconnected generic panel row", () => {
    // Break: the generic 조수 row only changed workspace JSON; the actual assistant never moved.
    const root = document.createElement("div") as unknown as FakeElement;
    root.append(...renderWorkspaceBar() as unknown as FakeElement[]);

    expect(findByTestId(root, "workspace-panel-row-assistant")).toBeNull();
    for (const [dock, label] of [
      ["glass", "왼쪽 카드"],
      ["side", "오른쪽 고정"],
      ["float", "입력줄"],
    ] as const) {
      const button = findByTestId(root, `workspace-assistant-dock-${dock}`);
      expect(button?.getAttribute("aria-label")).toBe(label);
      expect(button?.getAttribute("role")).toBe("menuitemradio");
      expect(button?.getAttribute("aria-checked")).toBe(dock === "side" ? "true" : "false");
    }
  });
});
