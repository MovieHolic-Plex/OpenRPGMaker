export const BATTLE_TRANSITION_FLASH_MS = 340;
export const BATTLE_TRANSITION_CLOSE_MS = 260;
export const BATTLE_TRANSITION_REVEAL_MS = 300;
export const BATTLE_TRANSITION_EXIT_MS = 220;

export const BATTLE_TRANSITION_COVER_MS = BATTLE_TRANSITION_FLASH_MS + BATTLE_TRANSITION_CLOSE_MS;

export type BattleTransitionPhase = "flash" | "close" | "reveal" | "exit";

export interface BattleTransitionTimelineEntry {
  readonly phase: BattleTransitionPhase;
  readonly atMs: number;
  readonly durationMs: number;
}

export function battleEntryTimeline(): readonly BattleTransitionTimelineEntry[] {
  return [
    { phase: "flash", atMs: 0, durationMs: BATTLE_TRANSITION_FLASH_MS },
    { phase: "close", atMs: BATTLE_TRANSITION_FLASH_MS, durationMs: BATTLE_TRANSITION_CLOSE_MS },
  ];
}

export function battleTransitionOverlayNode(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "battle-transition-overlay";
  overlay.dataset.testid = "battle-transition-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const flash = document.createElement("div");
  flash.className = "battle-transition-flash";
  overlay.append(flash);
  const blinds = document.createElement("div");
  blinds.className = "battle-transition-blinds";
  for (let index = 0; index < 8; index += 1) {
    const bar = document.createElement("span");
    bar.className = "battle-transition-blind-bar";
    bar.style.setProperty("--blind-index", String(index));
    blinds.append(bar);
  }
  overlay.append(blinds);
  return overlay;
}

export interface BattleTransition {
  cover(): Promise<void>;
  reveal(): Promise<void>;
  exit(): Promise<void>;
  destroy(): void;
}

export function createBattleTransition(
  host: HTMLElement,
  schedule: (callback: () => void, delayMs: number) => number = (callback, delayMs) => window.setTimeout(callback, delayMs)
): BattleTransition {
  const overlay = battleTransitionOverlayNode();
  const timers = new Set<number>();
  let lastPhase: BattleTransitionPhase | undefined;
  host.append(overlay);

  const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      timers.add(schedule(() => resolve(), ms));
    });

  const setPhase = (phase: BattleTransitionPhase): void => {
    lastPhase = phase;
    overlay.dataset.battleTransitionPhase = phase;
  };

  return {
    async cover() {
      setPhase("flash");
      await wait(BATTLE_TRANSITION_FLASH_MS);
      setPhase("close");
      await wait(BATTLE_TRANSITION_CLOSE_MS);
    },
    async reveal() {
      if (lastPhase === "exit") overlay.querySelector(".battle-transition-blinds")?.remove();
      setPhase("reveal");
      await wait(BATTLE_TRANSITION_REVEAL_MS);
      overlay.remove();
    },
    async exit() {
      setPhase("exit");
      await wait(BATTLE_TRANSITION_EXIT_MS);
    },
    destroy() {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
      overlay.remove();
    },
  };
}
