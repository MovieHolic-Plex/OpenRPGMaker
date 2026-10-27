/** @vitest-environment happy-dom */
import { describe, expect, it } from "vitest";
import {
  BATTLE_TRANSITION_CLOSE_MS,
  BATTLE_TRANSITION_COVER_MS,
  BATTLE_TRANSITION_EXIT_MS,
  BATTLE_TRANSITION_FLASH_MS,
  BATTLE_TRANSITION_RETURN_MS,
  battleEntryTimeline,
  battleTransitionOverlayNode,
  createBattleTransition,
  terminalDefeatCoverHoldMs,
} from "@/player/battleTransition";
import { DEFAULT_GAME_OVER_FADE_OUT_MS } from "@/project/cinematicSettings";

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

  it("reveal after exit settles the field back into view", async () => {
    const host = document.createElement("div");
    const field = document.createElement("canvas");
    const scheduled: { callback: () => void; delayMs: number }[] = [];
    const transition = createBattleTransition(host, (callback, delayMs) => {
      scheduled.push({ callback, delayMs });
      return scheduled.length;
    }, field);
    const exitPromise = transition.exit();
    expect(scheduled[0]?.delayMs).toBe(BATTLE_TRANSITION_EXIT_MS);
    scheduled[0]?.callback();
    await exitPromise;
    const revealPromise = transition.reveal();
    expect(field.classList.contains("battle-return-settle")).toBe(true);
    expect(scheduled[1]?.delayMs).toBe(BATTLE_TRANSITION_RETURN_MS);
    scheduled[1]?.callback();
    await revealPromise;
    expect(field.classList.contains("battle-return-settle")).toBe(false);
  });

  it("holds the exit cover until the game-over darken is solid", () => {
    expect(terminalDefeatCoverHoldMs(undefined, false)).toBe(DEFAULT_GAME_OVER_FADE_OUT_MS + 32);
    expect(terminalDefeatCoverHoldMs(400, false)).toBe(432);
    expect(terminalDefeatCoverHoldMs(0, false)).toBe(0);
    expect(terminalDefeatCoverHoldMs(Number.NaN, false)).toBe(DEFAULT_GAME_OVER_FADE_OUT_MS + 32);
    expect(terminalDefeatCoverHoldMs(-20, false)).toBe(0);
    expect(terminalDefeatCoverHoldMs(2000, true)).toBe(0);
  });

  it("destroy during exit removes the cover without settling the field", async () => {
    const host = document.createElement("div");
    const field = document.createElement("canvas");
    field.classList.add("battle-encounter-swirl");
    const scheduled: { callback: () => void }[] = [];
    const transition = createBattleTransition(host, (callback) => {
      scheduled.push({ callback });
      return scheduled.length;
    }, field);
    const exitPromise = transition.exit();
    scheduled[0]?.callback();
    await exitPromise;
    expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeTruthy();
    transition.destroy();
    expect(host.querySelector("[data-testid='battle-transition-overlay']")).toBeNull();
    expect(field.classList.contains("battle-return-settle")).toBe(false);
    expect(field.classList.contains("battle-encounter-swirl")).toBe(false);
  });
});
