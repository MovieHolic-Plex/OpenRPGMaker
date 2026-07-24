/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  BATTLE_TRANSITION_CLOSE_MS,
  BATTLE_TRANSITION_COVER_MS,
  BATTLE_TRANSITION_FLASH_MS,
  battleEntryTimeline,
  battleTransitionOverlayNode,
  createBattleTransition,
} from "@/player/battleTransition";

describe("battle transition", () => {
  it("entry timeline flashes then closes the blinds", () => {
    const entries = battleEntryTimeline();
    expect(entries.map((entry) => entry.phase)).toEqual(["flash", "close"]);
    expect(entries[1]?.atMs).toBe(BATTLE_TRANSITION_FLASH_MS);
    expect(BATTLE_TRANSITION_COVER_MS).toBe(BATTLE_TRANSITION_FLASH_MS + BATTLE_TRANSITION_CLOSE_MS);
  });

  it("overlay node carries a flash layer and eight blind bars", () => {
    const node = battleTransitionOverlayNode();
    expect(node.dataset.testid).toBe("battle-transition-overlay");
    expect(node.querySelector(".battle-transition-flash")).toBeTruthy();
    expect(node.querySelectorAll(".battle-transition-blind-bar")).toHaveLength(8);
  });

  it("cover reaches the close phase before resolving and reveal removes the overlay", async () => {
    const host = document.createElement("div");
    const scheduled: { callback: () => void; delayMs: number }[] = [];
    const transition = createBattleTransition(host, (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return scheduled.length;
    });
    const overlay = () => host.querySelector<HTMLElement>("[data-testid='battle-transition-overlay']");
    expect(overlay()).toBeTruthy();

    let covered = false;
    const coverPromise = transition.cover().then(() => {
      covered = true;
    });
    expect(scheduled[0]?.delayMs).toBe(BATTLE_TRANSITION_FLASH_MS);
    scheduled[0]?.callback();
    await Promise.resolve();
    expect(overlay()?.dataset.battleTransitionPhase).toBe("close");
    expect(covered).toBe(false);
    scheduled[1]?.callback();
    await coverPromise;
    expect(covered).toBe(true);

    const revealPromise = transition.reveal();
    scheduled[2]?.callback();
    await revealPromise;
    expect(overlay()).toBeNull();
  });

  it("reveal after exit drops the blinds so the fade is clean", async () => {
    const host = document.createElement("div");
    const scheduled: { callback: () => void; delayMs: number }[] = [];
    const transition = createBattleTransition(host, (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return scheduled.length;
    });
    const exitPromise = transition.exit();
    scheduled[0]?.callback();
    await exitPromise;
    const revealPromise = transition.reveal();
    const overlay = host.querySelector<HTMLElement>("[data-testid='battle-transition-overlay']");
    expect(overlay?.querySelector(".battle-transition-blinds")).toBeNull();
    scheduled[1]?.callback();
    await revealPromise;
    expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
  });
});
