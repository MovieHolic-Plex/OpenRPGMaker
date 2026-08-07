// aiVolatileController — 휘발존(volatile) 타이머·상태 분리 (aiChatPanel 2487줄 분해 1/3)
import { VOLATILE_OVERLAY_IDLE_MS } from "./aiChatPanelHelpers";

export interface VolatileController {
  bind(zone: HTMLElement): void;
  reveal(): void;
  schedule(): void;
  clear(): void;
  isFaded(): boolean;
}

/**
 * 휘발존 페이드 타이머를 소유한다.
 * - turnBusy / runningProgress 가 true면 페이드하지 않는다.
 * - bind()로 zone을 연결, reveal()/schedule()로 제어.
 */
export function createVolatileController(getBusy: () => boolean): VolatileController {
  let zone: HTMLElement | null = null;
  let timer: number | null = null;

  const clear = (): void => {
    if (timer !== null && typeof window !== "undefined") window.clearTimeout(timer);
    timer = null;
  };

  return {
    bind(z: HTMLElement) { zone = z; },
    reveal() {
      if (!zone) return;
      zone.hidden = false;
      zone.classList.remove("is-faded");
      clear();
    },
    schedule() {
      if (!zone || getBusy()) return;
      clear();
      if (typeof window === "undefined" || typeof window.setTimeout !== "function") return;
      timer = window.setTimeout(() => {
        timer = null;
        if (getBusy() || !zone) return;
        zone.classList.add("is-faded");
      }, VOLATILE_OVERLAY_IDLE_MS);
    },
    clear,
    isFaded() { return zone?.classList.contains("is-faded") ?? false; },
  };
}
