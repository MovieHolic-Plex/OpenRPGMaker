import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderConditionEvalPreview } from "@/editor/panels/eventEditor/conditionEvalPreview";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Condition } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

const PLAY_TIME_KINDS: readonly { readonly name: string; readonly condition: Condition }[] = [
  { name: "timer", condition: { kind: "timer", timerId: "timer1", seconds: 10 } },
  { name: "timePhase", condition: { kind: "timePhase", phase: "morning" } },
  { name: "season", condition: { kind: "season", season: "spring" } },
  { name: "npcActivity", condition: { kind: "npcActivity", activity: "work" } },
  { name: "friendshipAtLeast", condition: { kind: "friendshipAtLeast", value: 0 } },
  { name: "battleResult", condition: { kind: "battleResult", result: "victory" } },
  { name: "run", condition: { kind: "run", query: "active", value: false } },
];

describe("conditionEvalPreview", () => {
  let restoreDom: (() => void) | undefined;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
    editorState.set({ selectedEventId: "ev_test" });
  });

  afterEach(() => {
    editorState.set({ selectedEventId: null });
    restoreDom?.();
  });

  it("does not render a confident 충족/미충족 for play-time kinds the editor cannot justify", () => {
    for (const { name, condition } of PLAY_TIME_KINDS) {
      const root = renderWithFakeDom(() => renderConditionEvalPreview(condition));
      const undetermined = findByTestId(root, "event-condition-eval-undetermined");
      const badge = findByTestId(root, "event-condition-eval-badge");
      expect(findByTestId(root, "event-condition-eval"), name).toBeTruthy();
      expect(findByTestId(root, "event-condition-eval-summary"), name).toBeTruthy();
      expect(undetermined, `${name} should expose the undeterminable state`).toBeTruthy();
      expect(badge?.textContent, name).not.toBe("충족");
      expect(badge?.textContent, name).not.toBe("미충족");
      expect(badge?.textContent, name).not.toBe("불충족");
      expect(root.dataset.evalOk, name).not.toBe("true");
      expect(root.dataset.evalOk, name).not.toBe("false");
    }
  });

  it("still renders a 충족/불충족 verdict for start-state kinds", () => {
    const switchId = store.getCurrent().switches[0]?.id ?? "sw_0001";
    const root = renderWithFakeDom(() =>
      renderConditionEvalPreview({ kind: "switch", switchId, value: false })
    );
    expect(findByTestId(root, "event-condition-eval-undetermined")).toBeNull();
    expect(findByTestId(root, "event-condition-eval-badge")?.textContent).toBe("충족");
    expect(root.dataset.evalOk).toBe("true");
  });

  it("evaluates timePhase/season against play-start gameTime when the time system is on", () => {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true };
    store.replace(project);

    const morning = renderWithFakeDom(() =>
      renderConditionEvalPreview({ kind: "timePhase", phase: "morning" })
    );
    expect(findByTestId(morning, "event-condition-eval-undetermined")).toBeNull();
    expect(findByTestId(morning, "event-condition-eval-badge")?.textContent).toBe("충족");
    expect(morning.dataset.evalOk).toBe("true");

    const night = renderWithFakeDom(() =>
      renderConditionEvalPreview({ kind: "timePhase", phase: "night" })
    );
    expect(findByTestId(night, "event-condition-eval-undetermined")).toBeNull();
    expect(findByTestId(night, "event-condition-eval-badge")?.textContent).toBe("불충족");
    expect(night.dataset.evalOk).toBe("false");

    const spring = renderWithFakeDom(() =>
      renderConditionEvalPreview({ kind: "season", season: "spring" })
    );
    expect(findByTestId(spring, "event-condition-eval-badge")?.textContent).toBe("충족");

    const winter = renderWithFakeDom(() =>
      renderConditionEvalPreview({ kind: "season", season: "winter" })
    );
    expect(findByTestId(winter, "event-condition-eval-badge")?.textContent).toBe("불충족");
  });
});
