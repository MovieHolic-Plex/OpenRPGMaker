/**
 * 타격 세기(battleHitIntensity.ts)를 DOM 에 옮기는 얇은 층.
 *
 * 순수 판정은 `hitIntensity()` 가, 값→CSS 변수 매핑은 같은 모듈의 `*Variables()` 가 맡고, 여기는
 * 노드에 심고 걷는 일만 한다 — happy-dom 테스트가 클래스·변수를 그대로 읽을 수 있게 타이머는
 * 짧고 결정적이다.
 */
import type { BattleSnapshot } from "@/battle/runtime";
import {
  HIT_INTENSITY_TARGET_VARIABLES,
  hitIntensityStageVariables,
  hitIntensityTargetVariables,
  type BattleHitIntensity,
} from "@/player/battleHitIntensity";

/** 무대 펀치(순간 확대)를 유지하는 시간. 그 뒤 CSS transition 으로 220ms 동안 돌아온다. */
export const HIT_PUNCH_HOLD_MS = 90;

/**
 * 대상 노드와 씬 루트에 세기를 심는다. 세기가 없으면(빗나감·회복) 전부 걷는다 —
 * 남겨 두면 다음 타격이 이전 세기를 물려받는다(이펙트 CSS 변수와 같은 함정).
 */
export function applyHitIntensity(
  root: HTMLElement,
  target: HTMLElement | null,
  intensity: BattleHitIntensity | undefined
): void {
  if (target) {
    for (const name of HIT_INTENSITY_TARGET_VARIABLES) target.style.removeProperty(name);
    if (intensity) {
      target.dataset.hitIntensity = intensity;
      for (const [name, value] of Object.entries(hitIntensityTargetVariables(intensity))) target.style.setProperty(name, value);
    } else {
      delete target.dataset.hitIntensity;
    }
  }
  if (!intensity) {
    delete root.dataset.hitIntensity;
    root.style.removeProperty("--hit-punch");
    return;
  }
  root.dataset.hitIntensity = intensity;
  // 펀치는 맞은 자리로 당겨 든다 — 필드 가운데를 축으로 키우면 가장자리 적은 오히려 밀려난다.
  const x = target?.style.getPropertyValue("--battle-node-x");
  const y = target?.style.getPropertyValue("--battle-node-y");
  if (x && y) {
    root.style.setProperty("--hit-origin-x", x);
    root.style.setProperty("--hit-origin-y", y);
  } else {
    root.style.removeProperty("--hit-origin-x");
    root.style.removeProperty("--hit-origin-y");
  }
  const stage = hitIntensityStageVariables(intensity);
  root.style.setProperty("--hit-punch", stage["--hit-punch"]!);
  if (stage["--hit-punch"] !== "1") punchStage(root);
}

/**
 * 무대를 순간 확대했다가 놓는다. `.battle-field` 의 `animation` 슬롯은 화면 흔들림이 쓰므로
 * 별도 속성 `scale` + transition 으로 겹치지 않게 한다(04-anim-damage-layers.css).
 */
function punchStage(root: HTMLElement): void {
  root.classList.remove("battle-field-punch");
  // 착탄과 같은 프레임. rAF 로 미루면 허공에 한 프레임 늦는다(battleJuice.flashBattleField 와 같은 이유).
  void root.offsetWidth;
  root.classList.add("battle-field-punch");
  window.setTimeout(() => root.classList.remove("battle-field-punch"), HIT_PUNCH_HOLD_MS);
}

/** 스냅샷에서 배틀러(적 id·아군 id·recordId)의 최대 HP 를 찾는다. 원장이 비어 있을 때의 폴백. */
export function battlerMaxHp(snapshot: BattleSnapshot, targetId: string): number {
  const battler = [...snapshot.enemies, ...snapshot.actors].find(
    (entry) => entry.id === targetId || entry.recordId === targetId
  );
  return battler?.maxHp ?? 1;
}
