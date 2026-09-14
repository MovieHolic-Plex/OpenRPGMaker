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
  const timers = new Map<number, () => void>();
  let destroyed = false;
  let lastPhase: BattleTransitionPhase | undefined;
  host.append(overlay);

  // 감소 모션이면 CSS 가 막대·커버를 1ms 로 접으므로 JS 대기도 한 프레임으로 줄인다 —
  // 시퀀서(battleSequencer.delay)와 같은 계약. 그렇지 않으면 안무 없는 1초 대기가 남는다.
  const reducedMotion = (): boolean =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (requestedMs: number): Promise<void> => {
    if (destroyed) return Promise.resolve();
    const ms = reducedMotion() ? Math.min(requestedMs, 16) : requestedMs;
    return new Promise((resolve) => {
      let timer: number | undefined;
      let fired = false;
      timer = schedule(() => {
        fired = true;
        if (timer !== undefined) timers.delete(timer);
        resolve();
      }, ms);
      if (!fired) timers.set(timer, resolve);
    });
  };

  const setPhase = (phase: BattleTransitionPhase): void => {
    if (destroyed) return;
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
      destroyed = true;
      for (const [timer, resolve] of timers) { window.clearTimeout(timer); resolve(); }
      timers.clear();
      overlay.remove();
    },
  };
}

/** B: 스킨별 트랜지션을 overlay dataset으로 전달한다. CSS가 [data-battle-transition]으로 분기. */
export type SkinBattleTransition = import("@/battle/skins/types").BattleTransition;

const SKIN_TRANSITION_CLASS: Record<string, string> = {
  "slide-pokemon": "battle-transition--slide-pokemon",
  "focus-blur": "battle-transition--focus-blur",
  "sweep-cyan": "battle-transition--sweep-cyan",
  "brave-shift": "battle-transition--brave-shift",
  "psychedelic": "battle-transition--psychedelic",
  "curtain-dq": "battle-transition--curtain-dq",
  "wipe-blue": "battle-transition--wipe-blue",
  "wipe-black": "battle-transition--wipe-black",
  "flash-white": "battle-transition--flash-white",
  "fade": "battle-transition--fade",
};

export function createSkinBattleTransition(
  host: HTMLElement,
  transition: string | undefined,
  schedule: (callback: () => void, delayMs: number) => number = (callback, delayMs) => window.setTimeout(callback, delayMs)
): BattleTransition {
  const skinClass = transition ? (SKIN_TRANSITION_CLASS[transition] ?? "") : "";
  const base = createBattleTransition(host, schedule);
  if (skinClass && host.lastElementChild instanceof HTMLElement) {
    const overlay = host.lastElementChild as HTMLElement;
    if (overlay.classList.contains("battle-transition-overlay")) {
      overlay.dataset.battleTransition = transition ?? "";
      if (skinClass) overlay.classList.add(skinClass);
    }
  }
  return base;
}

