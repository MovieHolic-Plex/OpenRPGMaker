/**
 * 타격감 프리셋(project/battleHitFeel.ts)을 전투 DOM 에 옮기는 층.
 *
 * 기본 impact 는 참고작 문법을 겹친다(~/claude-viz/hit-feel-lab.html §5):
 *  - 아군 피격은 피해 비율과 무관하게 무대를 크게 흔든다(드래곤 퀘스트) — `hurtShakeIntensity`
 *  - 히트스톱 동안 맞은 쪽이 좌우로 떨다 잦아든다(사쿠라이 히트스톱 ①④) — `vibrateStruck`
 *  - 착탄 직전 베기 궤적 + 휘두름 소리(예비동작) — `SWING_LEAD_MS` / `spawnSlashTrail`
 *  - 타격음 아래 저음 한 겹(Vlambeer "more bass") — battleSfx `thud`
 * light 는 이 층을 전부 건너뛴다(2026-09-27 이전 연출). calm 은 CSS 가 흔들림·번쩍임을 끈다.
 *
 * 진동은 CSS animation 이 아니라 WAAPI 로 **개별 `translate` 속성**에 건다. 히트스톱 CSS 는 배틀러 animation 을
 * `paused` 로 붙잡고(22-hit-feel.css ①), 넉백은 `transform` 을 쓴다 — 둘 다 건드리지 않아야 정지·넉백이 그대로다.
 */
import type { BattleHitIntensity } from "@/player/battleHitIntensity";
import type { BattleHitFeel } from "@/project/battleHitFeel";
import { scheduleBattleTimer } from "@/player/battleTimerScope";

/** 아군 피격 흔들림의 바닥. 정면 스킨은 아군을 그리지 않아서 흔들림이 곧 "내가 맞았다" 다. */
export function hurtShakeIntensity(feel: BattleHitFeel, intensity: BattleHitIntensity | undefined): BattleHitIntensity | undefined {
  if (feel !== "impact" || !intensity) return intensity;
  return intensity === "crushing" ? "crushing" : "heavy";
}

export const SWING_LEAD_MS = 160;

const VIBRATE: Readonly<Record<BattleHitIntensity, { readonly px: number; readonly steps: number }>> = {
  graze: { px: 4, steps: 4 },
  normal: { px: 7, steps: 6 },
  heavy: { px: 10, steps: 7 },
  crushing: { px: 12, steps: 8 },
};
const VIBRATE_STEP_MS = 20;

export function vibrateStruck(sprite: HTMLElement, intensity: BattleHitIntensity): void {
  if (typeof sprite.animate !== "function") return;
  const { px, steps } = VIBRATE[intensity];
  const frames: Keyframe[] = [{ translate: "0px 0px" }];
  for (let step = 0; step < steps; step += 1) {
    const amplitude = px * (1 - step / steps);
    frames.push({ translate: `${step % 2 === 0 ? amplitude : -amplitude}px 0px` });
  }
  frames.push({ translate: "0px 0px" });
  sprite.animate(frames, { duration: steps * VIBRATE_STEP_MS + VIBRATE_STEP_MS, easing: "linear" });
}

/** 아군을 그리지 않는 정면 스킨에서 "지금 휘둘렀다" 를 보여 주는 유일한 그림이다. */
export function spawnSlashTrail(target: HTMLElement): void {
  const trail = document.createElement("span");
  trail.className = "battle-slash-trail";
  trail.dataset.testid = "battle-slash-trail";
  trail.setAttribute("aria-hidden", "true");
  target.append(trail);
  scheduleBattleTimer(() => trail.remove(), SWING_LEAD_MS + 220);
}
