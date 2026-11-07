/**
 * 적 그림 하나를 엔진이 움직인다 — 몬스터마다 다른 표·신체도·상수 없이 한 벌의 코드로.
 *
 * 두 단계가 있고, 그림의 주인을 뺏지 않는 것이 이 파일의 유일한 규율이다.
 *   full      칸이 없는 정지 그림 하나. 숨쉬기 · 예비동작→정수 px 돌진→복귀 · 피격 반동+번쩍 · 쓰러짐 기울기+계단 소멸.
 *   translate 칸이 있는 그림(도트 시트·파티 몬스터 시트·걷기 칩·확장 배틀러·idle 스트립).
 *             정수 px 이동과 회전만. 셀 선택(background-position·data-pixel-cell) · filter · scale · opacity ·
 *             clip-path 는 그 원장의 것이므로 손대지 않는다.
 *
 * CSS 의 독립 속성 `translate`·`rotate` 만 쓰고 `transform`·`scale` 은 쓰지 않으므로, 스킨의 숨쉬기(scale) ·
 * 칸 전환(background-position) · 보스 등장(bf-boss-entry 의 transform/filter)과 합성만 되고 서로 덮지 않는다.
 * 무대가 filter·scale·opacity 를 이미 쓰는 노드(bossSink·data-battle-big-boss·intro)에는 translate·rotate 만 건다.
 */
import { prefersReducedBattleMotion, stageOwnsFilters, stillMotionLevel, type EnemyStillMotionMode, type StillMotionLevel } from "@/project/enemyStillMotion";

const ANIMATED_ATTR = "data-enemy-anim";
const IDLE_PERIOD_MS = 2600;

const animations = new WeakMap<HTMLElement, Animation>();

export interface EnemyStillMotionOptions {
  readonly level: StillMotionLevel;
  readonly staged: boolean;
}

export function stillMotionOptionsFor(node: HTMLElement, image: HTMLElement | null | undefined, mode: EnemyStillMotionMode): EnemyStillMotionOptions {
  return { level: stillMotionLevel(node, image, mode), staged: stageOwnsFilters(node) };
}

function fullMotion(opts: EnemyStillMotionOptions): boolean {
  return opts.level === "full" && !opts.staged;
}

function imageOf(node: HTMLElement): HTMLElement | null {
  return node.querySelector<HTMLElement>(".battle-enemy-image");
}

function slide(dx: number, dy = 0, rotate = "0deg"): Keyframe {
  return { translate: `${Math.round(dx)}px ${Math.round(dy)}px`, rotate };
}

function run(node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions, additive = false): void {
  const image = imageOf(node);
  if (!image) return;
  animations.get(node)?.cancel();
  if (prefersReducedBattleMotion()) return;
  image.setAttribute(ANIMATED_ATTR, "true");
  animations.set(node, image.animate(frames, {
    easing: "linear",
    fill: "none",
    // 칸 있는 그림은 자기 이동·진동(돌진 CSS·피격 진동)을 이미 갖고 있다. replace 로 덮으면 그 연출이 사라지므로 더한다.
    ...(additive ? { composite: "add" as CompositeOperation } : {}),
    ...options,
  }));
}

function additive(opts: EnemyStillMotionOptions): boolean {
  return opts.level === "translate";
}

function idle(node: HTMLElement, opts: EnemyStillMotionOptions): void {
  const index = Number(node.style.getPropertyValue("--enemy-index")) || 0;
  run(node, [slide(0), slide(0, -1), slide(0)], {
    duration: IDLE_PERIOD_MS,
    delay: -(index * 370) % IDLE_PERIOD_MS,
    iterations: Infinity,
  }, additive(opts));
}

function windup(node: HTMLElement, beatMs: number, opts: EnemyStillMotionOptions): void {
  run(node, [slide(0), slide(-2)], { duration: Math.max(120, Math.round(beatMs)), fill: "forwards" }, additive(opts));
}

function lunge(node: HTMLElement, beatMs: number, reachPx: number, opts: EnemyStillMotionOptions): void {
  const reach = Math.max(2, Math.round(reachPx));
  run(node, [
    { ...slide(0), offset: 0 },
    { ...slide(reach * 0.7), offset: 0.35 },
    { ...slide(reach), offset: 0.55 },
    { ...slide(reach), offset: 1 },
  ], { duration: Math.max(120, Math.round(beatMs)), fill: "forwards" }, additive(opts));
}

function recover(node: HTMLElement, beatMs: number, reachPx: number, opts: EnemyStillMotionOptions): void {
  const reach = Math.max(2, Math.round(reachPx));
  run(node, [
    { ...slide(reach), offset: 0 },
    { ...slide(reach * 0.2), offset: 0.6 },
    { ...slide(0), offset: 1 },
  ], { duration: Math.max(120, Math.round(beatMs)), fill: "forwards" }, additive(opts));
}

function hit(node: HTMLElement, opts: EnemyStillMotionOptions): void {
  const recoil = [-3, -1, 2, -1, 1, 0];
  const flash = fullMotion(opts);
  run(node, recoil.map((dx, index) => ({
    ...slide(dx),
    offset: index / (recoil.length - 1),
    ...(flash ? { filter: index === 0 ? "brightness(2.2) saturate(0.2)" : "none" } : {}),
  })), { duration: 340 }, additive(opts));
}

function death(node: HTMLElement, opts: EnemyStillMotionOptions): void {
  node.dataset.enemyAnimBeat = "death";
  const dissolve = fullMotion(opts);
  const fade = (opacity: number, clipPath = "inset(0)"): Keyframe => ({ opacity, clipPath });
  run(node, [
    { ...slide(0, 0), offset: 0, ...(dissolve ? fade(1) : {}) },
    { ...slide(-1, 1, "-7deg"), offset: 0.22, ...(dissolve ? fade(1) : {}) },
    { ...slide(-2, 3, "-15deg"), offset: 0.5, ...(dissolve ? fade(0.92) : {}) },
    { ...slide(-3, 5, "-18deg"), offset: 0.72, ...(dissolve ? fade(0.6, "inset(40% 0 0)") : {}) },
    { ...slide(-3, 6, "-18deg"), offset: 0.88, ...(dissolve ? fade(0.3, "inset(75% 0 0)") : {}) },
    { ...slide(-3, 6, "-18deg"), offset: 1, ...(dissolve ? fade(0, "inset(100% 0 0)") : {}) },
  ], { duration: dissolve ? 900 : 520, fill: "forwards" }, additive(opts));
}

export function enemyIdle(node: HTMLElement, opts: EnemyStillMotionOptions): void {
  idle(node, opts);
}

export function enemyWindup(node: HTMLElement, beatMs: number, opts: EnemyStillMotionOptions): void {
  windup(node, beatMs, opts);
}

export function enemyLunge(node: HTMLElement, beatMs: number, reachPx: number, opts: EnemyStillMotionOptions): void {
  lunge(node, beatMs, reachPx, opts);
}

export function enemyRecover(node: HTMLElement, beatMs: number, reachPx: number, opts: EnemyStillMotionOptions): void {
  recover(node, beatMs, reachPx, opts);
}

export function enemyHit(node: HTMLElement, opts: EnemyStillMotionOptions): void {
  hit(node, opts);
}

export function enemyDeath(node: HTMLElement, opts: EnemyStillMotionOptions): void {
  death(node, opts);
}

export function clearEnemyStillMotion(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(".battle-enemy").forEach((node) => {
    animations.get(node)?.cancel();
    animations.delete(node);
    delete node.dataset.enemyAnimBeat;
    imageOf(node)?.removeAttribute(ANIMATED_ATTR);
  });
}
