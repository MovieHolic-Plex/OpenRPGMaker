export const BATTLE_TRANSITION_FLASH_MS = 340;
export const BATTLE_TRANSITION_CLOSE_MS = 260;
export const BATTLE_TRANSITION_REVEAL_MS = 300;
export const BATTLE_TRANSITION_EXIT_MS = 300;
/** 전투가 끝나고 검은 커버가 걷히며 필드가 돌아오는 시간. 진입 열림(REVEAL_MS)보다 길다 —
 *  220/300ms 로는 결과 확인 직후 필드가 "튀어" 돌아왔다(2026-09-25 녹화). */
export const BATTLE_TRANSITION_RETURN_MS = 460;

export const BATTLE_TRANSITION_COVER_MS = BATTLE_TRANSITION_FLASH_MS + BATTLE_TRANSITION_CLOSE_MS;
/** 제자리 페이드 진입의 커버 구간. 전투 UI 페이드 인은 CSS 가 이어서 그린다. */
export const BATTLE_TRANSITION_IN_PLACE_MS = 180;

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

/**
 * `field` 는 전투 밑에 깔린 필드 화면(Phaser 캔버스)이다. 진입 커버 동안 이 화면이 확대·회전하며
 * 빨려 들어가고(`battle-encounter-swirl`), 전투가 끝나 돌아올 때는 살짝 당겨졌다 제자리로 온다
 * (`battle-return-settle`). CSS: battle/23-entry-exit.css. 없으면 커버만 돈다.
 */
export function createBattleTransition(
  host: HTMLElement,
  schedule: (callback: () => void, delayMs: number) => number = (callback, delayMs) => window.setTimeout(callback, delayMs),
  field?: HTMLElement,
  inPlace = false,
): BattleTransition {
  const overlay = battleTransitionOverlayNode();
  // 제자리 페이드(system.battleBackdrop === "field"): 필드가 공간이라 화면이 빨려 들지 않고 막대도 닫지 않는다.
  // 진입 커버는 짧게 지나고, 전투 UI 가 필드 스냅샷 위에 페이드 인한다(23-entry-exit.css).
  if (inPlace) {
    overlay.classList.add("battle-transition--in-place");
    overlay.querySelector(".battle-transition-blinds")?.remove();
  }
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

  const setFieldMotion = (motion: "battle-encounter-swirl" | "battle-return-settle" | undefined): void => {
    if (!field) return;
    field.classList.remove("battle-encounter-swirl", "battle-return-settle");
    if (!motion || destroyed) return;
    void field.offsetWidth;
    field.classList.add(motion);
  };

  const setPhase = (phase: BattleTransitionPhase): void => {
    if (destroyed) return;
    lastPhase = phase;
    overlay.dataset.battleTransitionPhase = phase;
  };

  return {
    async cover() {
      if (inPlace) {
        setPhase("close");
        await wait(BATTLE_TRANSITION_IN_PLACE_MS);
        return;
      }
      setPhase("flash");
      setFieldMotion("battle-encounter-swirl");
      await wait(BATTLE_TRANSITION_FLASH_MS);
      setPhase("close");
      await wait(BATTLE_TRANSITION_CLOSE_MS);
    },
    async reveal() {
      const returning = lastPhase === "exit";
      if (returning) overlay.querySelector(".battle-transition-blinds")?.remove();
      // 진입이면 전투 화면이 필드를 덮었으니 필드 모션을 거둔다. 복귀면 필드가 제자리로 내려앉는다.
      setFieldMotion(returning ? "battle-return-settle" : undefined);
      setPhase("reveal");
      await wait(returning ? BATTLE_TRANSITION_RETURN_MS : BATTLE_TRANSITION_REVEAL_MS);
      overlay.remove();
      if (returning) setFieldMotion(undefined);
    },
    async exit() {
      setPhase("exit");
      await wait(BATTLE_TRANSITION_EXIT_MS);
    },
    destroy() {
      setFieldMotion(undefined);
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
  "shatter-2003": "battle-transition--shatter-2003",
  "slide-pokemon": "battle-transition--slide-pokemon",
  "wipe-black": "battle-transition--wipe-black",
  "flash-white": "battle-transition--flash-white",
};

export function createSkinBattleTransition(
  host: HTMLElement,
  transition: string | undefined,
  schedule: (callback: () => void, delayMs: number) => number = (callback, delayMs) => window.setTimeout(callback, delayMs),
  field?: HTMLElement,
  inPlace = false,
): BattleTransition {
  const skinClass = transition && !inPlace ? (SKIN_TRANSITION_CLASS[transition] ?? "") : "";
  const base = createBattleTransition(host, schedule, inPlace ? undefined : field, inPlace);
  if (skinClass && host.lastElementChild instanceof HTMLElement) {
    const overlay = host.lastElementChild as HTMLElement;
    if (overlay.classList.contains("battle-transition-overlay")) {
      overlay.dataset.battleTransition = transition ?? "";
      if (skinClass) overlay.classList.add(skinClass);
    }
  }
  return base;
}

