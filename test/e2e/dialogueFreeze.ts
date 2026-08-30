/**
 * 짧은 연출을 **시작되는 프레임에 붙잡아** 찍기 위한 도구.
 *
 * 대화창 연출은 140~260ms 만 살아 있고, 끝나면 `animation` 선언 자체가 사라진다. 그냥
 * 찍으면 정착 프레임만 나오므로 "연출을 넣었다"는 증거가 못 된다. rAF 감시자가 관심 있는
 * 애니메이션이 시작되는 프레임에 `pause()` 하고 `currentTime` 을 원하는 비율로 감는다
 * (`test/runtime/battle-flash-map.spec.ts` 가 스냅샷 전에 `getAnimations().pause()` 를
 * 쓰는 것과 같은 계열).
 *
 * 두 함정이 여기 녹아 있다(둘 다 2026-08-30 실측).
 *
 * 1. 첫 얼음은 **init script 안에서** 걸어야 한다. `page.evaluate` 로 걸면 그 시점에는 아직
 *    about:blank 이고, 뒤따르는 내비게이션이 window 를 새로 만들어 지워 버린다.
 * 2. 얼음은 CSS 애니메이션만 멈추고 `dialogue.ts` 의 phase 타이머는 그대로 흐른다.
 *    스크린샷 한 장이 수백 ms 를 먹는 동안 `enter` → `shown` 이 되어 규칙이 안 맞게 되고
 *    멈춰 둔 애니메이션이 폐기된다 — 사진에는 정착 프레임이 찍히고 표의 animationName 은
 *    none 이 된다. `pinPhase` 로 되돌려 붙이면 새 애니메이션이 생기고 같은 비율에서 다시
 *    멈춰 그대로 머문다.
 */
import { expect, type Page } from "@playwright/test";

export type FreezeSpec = {
  /** 이 이름의 애니메이션이 시작되는 프레임에 멈춘다. */
  readonly name: string;
  /** 0~1. 이 비율로 감아 둔다. */
  readonly fraction: number;
  /** 이 phase 로 되돌려 붙인다. 진입/퇴장 연출을 스크린샷 동안 살려 두는 유일한 방법. */
  readonly pinPhase?: string;
};

declare global {
  interface Window {
    __dialogueFreeze?: FreezeSpec | null;
    __dialogueFrozen?: string[];
  }
}

/** 감시자를 심는다. 페이지마다 1회. 부팅 순간에 이미 도는 연출은 `initial` 로 미리 건다. */
export async function installFreezeWatcher(page: Page, initial: FreezeSpec | null = null): Promise<void> {
  await page.addInitScript((armed) => {
    window.__dialogueFreeze = (armed ?? null) as typeof window.__dialogueFreeze;
    window.__dialogueFrozen = [];
    const tick = (): void => {
      const spec = window.__dialogueFreeze;
      if (spec) {
        const box = document.querySelector<HTMLElement>(".dialogue-box");
        if (spec.pinPhase && box && box.dataset.dialoguePhase !== spec.pinPhase) {
          box.dataset.dialoguePhase = spec.pinPhase;
        }
        for (const animation of document.getAnimations()) {
          const name = (animation as CSSAnimation).animationName;
          if (name !== spec.name || animation.playState === "paused") continue;
          const timing = animation.effect?.getComputedTiming();
          const duration = typeof timing?.duration === "number" ? timing.duration : 0;
          animation.pause();
          animation.currentTime = duration * spec.fraction;
          window.__dialogueFrozen?.push(name);
        }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, initial);
}

/** 다음에 붙잡을 연출을 예약한다. 이미 지나간 연출은 잡히지 않으니 **넘기기 전에** 부른다. */
export async function freeze(page: Page, spec: FreezeSpec): Promise<void> {
  await page.evaluate((next) => {
    window.__dialogueFrozen = [];
    window.__dialogueFreeze = next as typeof window.__dialogueFreeze;
  }, spec as unknown as Record<string, unknown>);
}

/** 얼음을 풀고 멈춰 있던 것을 다시 돌린다. 고정해 둔 phase 도 제자리로 돌려놓는다. */
export async function thaw(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__dialogueFreeze = null;
    // enter 로 붙잡아 둔 채 놓아 주면 진입 연출이 무한히 재생되어 뒤 프레임이 전부 흔들린다.
    const box = document.querySelector<HTMLElement>(".dialogue-box");
    if (box?.dataset.dialoguePhase === "enter") box.dataset.dialoguePhase = "shown";
    for (const animation of document.getAnimations()) animation.play();
  });
}

/** 그 연출이 실제로 붙잡혔는지 확인한다. 못 잡았으면 사진은 정착 프레임이다. */
export async function expectFrozen(page: Page, name: string): Promise<void> {
  await expect
    .poll(() => page.evaluate((n) => (window.__dialogueFrozen ?? []).includes(String(n)), name), {
      timeout: 20_000,
      message: `${name} 이 시작되는 프레임을 못 잡았다`,
    })
    .toBe(true);
}

/** 감정별 진입 keyframe 이름. src/styles/dialogue.css 의 규칙과 짝이다. */
export function enterAnimationName(emotion: string): string {
  if (emotion === "happy" || emotion === "surprised") return "dialogue-box-enter-pop";
  if (emotion === "sad") return "dialogue-box-enter-soft";
  return "dialogue-box-enter";
}
