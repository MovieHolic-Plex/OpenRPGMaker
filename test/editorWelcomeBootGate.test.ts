/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPendingAiBootIntent,
  clearPendingAiBootIntent,
  clearWelcomeIntentBootFlags,
  peekPendingAiBootIntent,
  registerAiBootIntentTarget,
  setPendingAiBootIntent,
  shouldSuppressCoachMarksForWelcomeIntent,
} from "@/editor/aiBootIntent";
import {
  shouldPresentEditorWelcome,
  setEditorWelcomeDismissed,
  EDITOR_WELCOME_DISMISSED_KEY,
} from "@/editor/editorWelcome";

/**
 * Orchestration contract for finishEditorBoot without mounting Phaser:
 * cold gate matrix + D7 guest-then-prefill order + coach suppress.
 */
describe("editor welcome boot gate orchestration", () => {
  beforeEach(() => {
    clearPendingAiBootIntent();
    clearWelcomeIntentBootFlags();
    registerAiBootIntentTarget(null);
    try {
      localStorage.removeItem(EDITOR_WELCOME_DISMISSED_KEY);
    } catch {
      /* ignore */
    }
  });

  it("cold boot presents only when unmounted, not dismissed, not automation", () => {
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: false })).toBe(true);
    expect(shouldPresentEditorWelcome({ modeShellMounted: true, dismissed: false, automation: false })).toBe(false);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: true, automation: false })).toBe(false);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, dismissed: false, automation: true })).toBe(false);
  });

  it("re-entry path clears pending so recovery does not prefill stale intent", () => {
    setPendingAiBootIntent("stale");
    // finishEditorBoot re-entry: modeMounted true → clearPending
    clearPendingAiBootIntent();
    expect(peekPendingAiBootIntent()).toBeNull();
    expect(applyPendingAiBootIntent()).toBe(false);
  });

  it("D7 order: identity can run before applyPending; apply opens+prefills last", () => {
    const order: string[] = [];
    registerAiBootIntentTarget({
      open: () => order.push("open"),
      prefill: (text) => order.push(`prefill:${text}`),
    });
    setPendingAiBootIntent("포켓몬 같은 몬스터 수집");
    expect(shouldSuppressCoachMarksForWelcomeIntent()).toBe(true);

    // Simulate finishEditorBoot intent branch:
    order.push("guest-identity");
    applyPendingAiBootIntent();
    expect(order).toEqual(["guest-identity", "open", "prefill:포켓몬 같은 몬스터 수집"]);
    expect(peekPendingAiBootIntent()).toBeNull();
  });

  it("dismissed storage prevents cold presentation", () => {
    setEditorWelcomeDismissed(true);
    expect(shouldPresentEditorWelcome({ modeShellMounted: false, automation: false })).toBe(false);
  });
});
