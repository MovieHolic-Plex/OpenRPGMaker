import type { BattleActionBeat } from "@/player/battleActionBeats";
import { battlerSpriteNode, findBattlerNode } from "@/player/battleFieldDom";

/**
 * 포켓몬 스킨 타격 안무 (2026-10-02).
 *
 * 예전 연출은 돌진이 72px(상대까지 약 300px)에서 끝나 허공을 쳤고, 맞은 쪽은 노드 filter 와 juice 애니메이션이
 * 겹쳐 발판까지 0.36초 동안 하얗게 바랬다 — 「때렸다/맞았다」가 아니라 「흐려졌다」로 읽혔다. 여기서는:
 *  - 공격자: 뒤로 웅크림(예비) → 상대 몸에 닿는 자리까지 대각선 돌진(늘어남) → 히트스톱 동안 접촉 자세로 붙듦(찌그러짐)
 *    → 살짝 튕기며 제자리. 적의 돌진도 예고 비트 끝에 같은 모양으로 온다(예전엔 정지 비트 60ms 안에 끝났다).
 *  - 맞는 쪽: 접촉 순간 16px 밀린 채 흰 실루엣으로 정지(22-hit-feel ①) → 풀리면서 48px 날아갔다 튕겨 돌아오며 좌우로 떨고,
 *    보였다 안 보였다 세 번 깜빡인다(battleDom → blinkBattlerNode).
 *
 * 움직이는 것은 노드가 아니라 **그림**(battlerSpriteNode)이다 — 발판이 노드의 ::before 라 노드를 옮기면 발판도 따라갔다.
 * 개별 변환 속성(translate·scale)을 WAAPI 로 돌려 스킨의 transform 과 섞이지 않게 하고, CSS 히트스톱
 * (animation-play-state: paused)은 WAAPI 를 멈추지 않으므로 정지는 키프레임으로 붙든다.
 * 노드의 battle-motion-* 클래스는 상태 표시로 그대로 남는다(포켓몬 CSS 는 그 클래스의 이동·filter 를 끈다).
 */

type Vec = { readonly x: number; readonly y: number };

interface Strike {
  /** 공격자 그림이 접촉 자리까지 옮겨 간 양(그림 로컬 px) */
  contact: Vec;
  /** 제자리 기준 공격자 → 상대 단위 벡터. 넉백 방향이다 */
  unit: Vec;
  targetId?: string;
}

const strikes = new WeakMap<HTMLElement, Strike>();
const knocked = new WeakMap<HTMLElement, Vec>();

/** 뒤로 웅크리는 거리·밀리는 거리(로컬 px) */
const WIND_BACK = 14;
const PUSH = 16;
const KNOCK = 48;

function reduced(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function center(rect: DOMRect): Vec {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** 화면 px → 그림 로컬 px. 무대 배율과 필드 zoom 이 겹쳐 있어 그림 자신의 레이아웃 폭으로 잰다(battleRetroMotion 과 같은 방식). */
function localScale(sprite: HTMLElement, rect: DOMRect): number {
  return sprite.offsetWidth > 0 && rect.width > 0 ? rect.width / sprite.offsetWidth : 1;
}

/** 공격자가 상대 몸에 닿는 자리. 중심 거리가 두 몸 반지름 합의 75% 가 되는 곳 — 앞끝만 살짝 겹친다.
 *  (반지름 합의 50% 까지 들어가면 큰 뒷모습 그림이 상대를 통째로 덮어 넉백이 안 보였다.) */
function contactVector(user: HTMLElement, target: HTMLElement): { contact: Vec; unit: Vec } | null {
  const userSprite = battlerSpriteNode(user);
  const targetSprite = battlerSpriteNode(target);
  // 진행 중인 안무가 있으면 그 자리를 빼고 잰다
  for (const animation of userSprite.getAnimations()) animation.cancel();
  const a = userSprite.getBoundingClientRect();
  const b = targetSprite.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return null;
  const from = center(a);
  const to = center(b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return null;
  const radius = (Math.min(a.width, a.height) + Math.min(b.width, b.height)) / 4;
  const reach = Math.max(0.3, Math.min(0.8, (distance - radius * 1.5) / distance));
  const scale = localScale(userSprite, a);
  return { contact: { x: (dx * reach) / scale, y: (dy * reach) / scale }, unit: { x: dx / distance, y: dy / distance } };
}

function px(v: Vec, k = 1): string {
  return `${Math.round(v.x * k * 10) / 10}px ${Math.round(v.y * k * 10) / 10}px`;
}

function prepare(sprite: HTMLElement): void {
  sprite.style.transformOrigin = "50% 100%";
}

/** 예비동작 → 대각선 돌진. 비트 끝에 접촉 자리에 도착한다. */
function windupAndDash(user: HTMLElement, target: HTMLElement | null, durationMs: number, dashMs: number, targetId?: string): void {
  const sprite = battlerSpriteNode(user);
  const vector = target ? contactVector(user, target) : null;
  if (!vector) return;
  prepare(sprite);
  const { contact, unit } = vector;
  const back = { x: -unit.x * WIND_BACK, y: -unit.y * WIND_BACK };
  const dash = Math.min(dashMs, durationMs * 0.7);
  const windEnd = Math.max(0, (durationMs - dash) / durationMs);
  sprite.animate(
    [
      { translate: "0px 0px", scale: "1 1", offset: 0 },
      { translate: px(back), scale: "1.07 0.9", offset: windEnd, easing: "cubic-bezier(0.55, 0, 0.9, 0.45)" },
      { translate: px(contact), scale: "1.12 0.93", offset: 1 },
    ],
    { duration: durationMs, easing: "ease-out", fill: "forwards" },
  );
  strikes.set(user, { contact, unit, targetId });
}

/** 착탄 정지 비트 — 접촉 자리에서 찌그러졌다 펴진다. 앞 비트에 돌진이 없었으면(예고 0) 여기서 짧게 덮친다. */
function holdContact(user: HTMLElement, target: HTMLElement | null, durationMs: number): void {
  const sprite = battlerSpriteNode(user);
  let strike = strikes.get(user);
  if (!strike) {
    const vector = target ? contactVector(user, target) : null;
    if (!vector) return;
    strike = { contact: vector.contact, unit: vector.unit };
    strikes.set(user, strike);
    prepare(sprite);
    sprite.animate([{ translate: "0px 0px" }, { translate: px(strike.contact) }], { duration: 60, easing: "ease-in", fill: "forwards" });
    return;
  }
  sprite.animate(
    [
      { translate: px(strike.contact), scale: "0.9 1.08" },
      { translate: px(strike.contact), scale: "1 1" },
    ],
    { duration: Math.max(60, durationMs), easing: "ease-out", fill: "forwards" },
  );
}

/** 제자리로 — 살짝 지나쳤다 돌아온다. 끝나면 안무를 지운다. */
function returnHome(user: HTMLElement, durationMs: number): void {
  const strike = strikes.get(user);
  strikes.delete(user);
  if (!strike) return;
  const sprite = battlerSpriteNode(user);
  const animation = sprite.animate(
    [
      { translate: px(strike.contact), scale: "1 1" },
      { translate: px(strike.contact, -0.06), scale: "1.04 0.97", offset: 0.7 },
      { translate: "0px 0px", scale: "1 1" },
    ],
    { duration: Math.max(120, Math.min(durationMs, 260)), easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
  );
  animation.onfinish = () => {
    if (!strikes.has(user)) for (const running of sprite.getAnimations()) running.cancel();
  };
}

/** 착탄 — 맞은 쪽이 공격 방향으로 밀린 채 정지 비트 동안 붙들린다(흰 실루엣은 22-hit-feel ①). */
function pushTarget(target: HTMLElement, attacker: HTMLElement | null, durationMs: number): void {
  const sprite = battlerSpriteNode(target);
  // 방향은 돌진을 시작할 때 제자리에서 잰 값을 쓴다 — 착탄 순간의 공격자 그림은 상대 몸 안까지 들어와 있어서
  // 지금 위치로 재면 넉백이 공격자 쪽으로 뒤집혔다(2026-10-02 녹화). 돌진이 없었으면 노드(움직이지 않는 발판 상자)로 잰다.
  let unit = attacker ? strikes.get(attacker)?.unit : undefined;
  if (!unit) {
    const a = attacker?.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const from = a && a.width > 0 ? center(a) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const to = center(b);
    const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    unit = { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
  }
  prepare(sprite);
  sprite.animate(
    [
      { translate: px(unit, PUSH * 0.7), scale: "0.94 1.04" },
      { translate: px(unit, PUSH), scale: "0.96 1.03" },
    ],
    { duration: Math.max(60, durationMs), fill: "forwards" },
  );
  knocked.set(target, unit);
}

/** 정지가 풀리면 날아갔다 튕겨 돌아오며 좌우로 떤다. 다 돌아온 뒤 두 번 꺼졌다 켜진다 —
 *  날아가는 동안 깜빡이면 넉백이 깜빡임에 가려 안 보였다(그래서 포켓몬은 blinkBattlerNode 를 쓰지 않는다). */
function releaseTarget(target: HTMLElement): void {
  const unit = knocked.get(target);
  knocked.delete(target);
  if (!unit) return;
  const sprite = battlerSpriteNode(target);
  const shake = [7, -6, 5, -4, 2];
  const animation = sprite.animate(
    [
      { translate: px(unit, PUSH), scale: "0.96 1.03", offset: 0 },
      { translate: px(unit, KNOCK), scale: "1 1", offset: 0.2, easing: "cubic-bezier(0.3, 0, 0.4, 1)" },
      ...shake.map((dx, index) => ({ translate: `${Math.round(unit.x * KNOCK * (1 - (index + 1) / 6) + dx)}px ${Math.round(unit.y * KNOCK * (1 - (index + 1) / 6))}px`, offset: 0.3 + index * 0.12 })),
      { translate: "0px 0px", scale: "1 1", offset: 1 },
    ],
    { duration: 380, easing: "linear", fill: "forwards" },
  );
  animation.onfinish = () => {
    if (!knocked.has(target)) for (const running of sprite.getAnimations()) running.cancel();
  };
  sprite.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 340, easing: "steps(1, end)" });
}

/** 강타·급소·막타만 화면을 짧게 3px 흔든다. 보통 타격은 흔들지 않는다(포켓몬 문법). */
export function pokemonHeavyShake(field: HTMLElement): void {
  if (reduced() || typeof field.animate !== "function") return;
  field.animate(
    [{ translate: "0 0" }, { translate: "3px -2px" }, { translate: "-3px 2px" }, { translate: "2px 1px" }, { translate: "-1px -1px" }, { translate: "0 0" }],
    { duration: 180, easing: "linear" },
  );
}

/**
 * 시퀀서 비트 하나를 포켓몬 안무로 옮긴다. `lungeMs` 는 돌진 구간 길이(--motion-lunge-ms).
 * 비트 순서: 내 공격 approach(lunge) → impact(knockback) → recover(return),
 *            적 공격 approach(windup) → impact(lunge+knockback) → recover(return).
 */
export function pokemonActionMotion(field: HTMLElement, beat: BattleActionBeat | undefined, lungeMs: number): void {
  if (!beat || reduced() || typeof HTMLElement.prototype.animate !== "function") return;
  const user = beat.userId ? findBattlerNode(field, beat.userId) : null;
  const target = beat.targetId ? findBattlerNode(field, beat.targetId) : null;
  if (beat.kind === "approach" && user && (beat.userMotion === "lunge" || beat.userMotion === "windup") && target && target !== user) {
    windupAndDash(user, target, beat.durationMs, lungeMs, beat.targetId);
  } else if (beat.kind === "impact") {
    if (user && target && target !== user && beat.userMotion === "lunge") holdContact(user, target, beat.durationMs);
    if (target && beat.targetMotion === "knockback") pushTarget(target, user, beat.durationMs);
  } else if (beat.kind === "recover") {
    if (user) returnHome(user, beat.durationMs);
    if (target) releaseTarget(target);
  }
}
