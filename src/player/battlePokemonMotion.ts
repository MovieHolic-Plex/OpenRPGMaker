import type { BattleActionBeat } from "@/player/battleActionBeats";
import { battlerSpriteNode, findBattlerNode } from "@/player/battleFieldDom";
import { spriteEmitPoint, type PokemonMoveMotion } from "@/battle/pokemonMoveMotion";

/**
 * 포켓몬 스킨 기술 안무 (2026-10-02).
 *
 * 기술마다 「움직임 종류」(battle/pokemonMoveMotion.ts) 하나로 그린다. 모든 종류가 같은 박자를 쓴다 — 쓰는 쪽의 준비·발동은
 * 시퀀서 approach 비트 안에서 끝나고, 비트 끝(= impact 시작)에 맞는 쪽에 닿는다. 그래서 기술 이펙트·타격음·HP 바와 어긋나지 않는다.
 *  - 접촉: 뒤로 웅크림 → 상대 몸 앞끝까지 대각선 돌진(늘어남) → 정지 비트 동안 접촉 자세(찌그러짐) → 튕기며 제자리.
 *  - 발사체: 뒤로 젖혀 모음(속성 빛) → 앞으로 반동하며 입·손 자리에서 쏨 → 빛 덩이가 꼬리를 끌고 날아가 비트 끝에 닿아 터짐.
 *  - 현장 발생: 위로 솟으며 부름 → 상대 자리에 위에서 번개·빛기둥이 꽂히거나(아래로 눌림) 땅에서 솟음(위로 튐).
 *  - 범위: 뛰어올랐다 발을 구름 → 발밑 충격파 + 필드 흔들림, 맞는 쪽 전부 넉백.
 *  - 능력 올리기·회복: 제자리에서 두 번 뜀 / 부르는 자세 → 받는 쪽에 빛 고리·위 화살표 / 빛 기둥·반짝이. 넉백 없음.
 *  - 상태 걸기: 상대 쪽으로 몸을 기울여 부름 → 상대 자리에 색 안개 + 아래 화살표, 상대가 잘게 떤다. 흰 번쩍임·넉백 없음.
 * 맞는 쪽(피해가 있을 때): 정지 동안 밀린 흰 실루엣(22-hit-feel ①) → 풀리며 날아갔다 떨며 복귀 → 두 번 꺼졌다 켜짐.
 *
 * 움직이는 것은 노드가 아니라 **그림**(battlerSpriteNode)이다 — 발판이 노드의 ::before 라 노드를 옮기면 발판도 따라갔다.
 * 개별 변환 속성(translate·scale)을 WAAPI 로 돌리고, CSS 히트스톱(animation-play-state: paused)은 WAAPI 를 멈추지 않으므로
 * 정지는 키프레임으로 붙든다. 노드의 battle-motion-* 클래스는 상태 표시로 남는다(포켓몬 CSS 가 그 이동·filter 를 끈다).
 */

export interface PokemonMoveContext {
  readonly motion: PokemonMoveMotion;
  /** 발사체·빛·안개 색 */
  readonly color: string;
  /** 현장 발생이 땅에서 솟는가(아니면 위에서 떨어진다) */
  readonly fromBelow: boolean;
  /** 같은 행동의 엔트리를 묶는 번호 — 범위기의 필드 흔들림을 한 번만 */
  readonly actionId?: number;
}

type Vec = { readonly x: number; readonly y: number };

interface Pose {
  /** 쓰는 쪽 그림이 approach 끝에 머무는 자리(그림 로컬 px) */
  rest: Vec;
  /** 제자리 기준 쓰는 쪽 → 상대 단위 벡터(화면) */
  unit: Vec;
  /** 이 시각(performance.now)까지는 제자리로 돌아가지 않는다 — 부르는 동작이 비트보다 길다 */
  holdUntil?: number;
}

interface Knock {
  unit: Vec;
  /** 밀림 배율(발사체 0.7, 현장 발생 0.6 …) */
  k: number;
  /** 아래로 눌리는 찌그러짐(현장 발생) */
  squash: boolean;
}

const poses = new WeakMap<HTMLElement, Pose>();
const knocked = new WeakMap<HTMLElement, Knock>();
let shakenActionId: number | undefined;

/** 뒤로 웅크리는 거리·밀리는 거리(로컬 px) */
const WIND_BACK = 14;
const PUSH = 16;
const KNOCK = 48;
/** 발사체가 나는 시간 상한·비트 대비 비율 */
const TRAVEL_MS = 220;
/** 능력 올리기·회복·상태 걸기의 부르는 동작 길이. 보조 기술의 approach 비트는 가벼운 무게(0.72배)라 190ms 남짓이어서
 *  비트 길이로 뛰면 읽히지 않았다 — 시퀀서는 이 뒤로도 대사·이펙트로 1초 가까이 기다리므로 비트보다 길게 둔다. */
const CALL_MS = 620;

function reduced(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function center(rect: DOMRect): Vec {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** 화면 px → 그림 로컬 px. 무대 배율과 필드 zoom 이 겹쳐 있어 그림 자신의 레이아웃 폭으로 잰다(battleRetroMotion 과 같은 방식). */
function localScale(element: HTMLElement, rect: DOMRect): number {
  return element.offsetWidth > 0 && rect.width > 0 ? rect.width / element.offsetWidth : 1;
}

function px(v: Vec, k = 1): string {
  return `${Math.round(v.x * k * 10) / 10}px ${Math.round(v.y * k * 10) / 10}px`;
}

function prepare(sprite: HTMLElement): void {
  sprite.style.transformOrigin = "50% 100%";
}

/** 진행 중인 안무를 걷고 제자리 상자를 잰다 */
function restRect(node: HTMLElement): DOMRect {
  const sprite = battlerSpriteNode(node);
  for (const animation of sprite.getAnimations()) if (!(animation as CSSAnimation).animationName) animation.cancel();
  return sprite.getBoundingClientRect();
}

function unitBetween(a: DOMRect, b: DOMRect): Vec | null {
  const from = center(a);
  const to = center(b);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance < 1) return null;
  return { x: (to.x - from.x) / distance, y: (to.y - from.y) / distance };
}

/** 공격자가 상대 몸에 닿는 자리. 중심 거리가 두 몸 반지름 합의 75% 가 되는 곳 — 앞끝만 살짝 겹친다.
 *  (반지름 합의 50% 까지 들어가면 큰 뒷모습 그림이 상대를 통째로 덮어 넉백이 안 보였다.) */
function contactVector(a: DOMRect, b: DOMRect, scale: number): Vec {
  const from = center(a);
  const to = center(b);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const radius = (Math.min(a.width, a.height) + Math.min(b.width, b.height)) / 4;
  const reach = Math.max(0.3, Math.min(0.8, (distance - radius * 1.5) / distance));
  return { x: (dx * reach) / scale, y: (dy * reach) / scale };
}

// ---- 필드 위 이펙트 조각 ---------------------------------------------------

/** 화면 좌표 → 필드 로컬 좌표 */
function fieldPoint(field: HTMLElement, p: Vec): Vec {
  const rect = field.getBoundingClientRect();
  const scale = localScale(field, rect);
  return { x: (p.x - rect.left) / scale, y: (p.y - rect.top) / scale };
}

function fx(field: HTMLElement, at: Vec, css: string, text?: string): HTMLElement {
  const node = document.createElement("span");
  node.className = "pkmn-fx";
  node.setAttribute("aria-hidden", "true");
  node.style.cssText = `position:absolute;left:${Math.round(at.x)}px;top:${Math.round(at.y)}px;pointer-events:none;z-index:40;${css}`;
  if (text) node.textContent = text;
  field.append(node);
  return node;
}

function play(node: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions): void {
  const animation = node.animate(frames, { fill: "both", ...options });
  animation.onfinish = () => node.remove();
  animation.oncancel = () => node.remove();
}

function orbCss(size: number, color: string): string {
  return `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;`
    + `background:radial-gradient(circle,#fff 0 28%,${color} 46%,transparent 72%);filter:drop-shadow(0 0 6px ${color});`;
}

/** 빛 고리 — 착탄·충격파·능력 오름 */
function ring(field: HTMLElement, at: Vec, color: string, size: number, durationMs: number, delayMs = 0, flat = 1): void {
  const node = fx(field, at, `width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;border:4px solid ${color};box-shadow:0 0 10px ${color};`);
  play(node, [
    { transform: `scale(0.25, ${0.25 * flat})`, opacity: 1 },
    { transform: `scale(1, ${flat})`, opacity: 0 },
  ], { duration: durationMs, delay: delayMs, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" });
}

/** 위·아래 화살표 셋 — 능력 오름(빨강 ▲ 솟음)·상태(파랑 ▼ 내려앉음). 글꼴에 기대지 않게 삼각형을 직접 그린다.
 *  색은 기술 색이 아니라 포켓몬 관례 색이다 — 속성 없는 보조기는 흰색이라 밝아진 그림 위에서 흰 화살표가 사라졌다(2026-10-02 녹화). */
function arrows(field: HTMLElement, at: Vec, up: boolean, delayMs: number): void {
  const color = up ? "#ff5a36" : "#3f86ff";
  for (let i = 0; i < 3; i += 1) {
    const x = at.x + (i - 1) * 30;
    // clip-path 는 filter 뒤에 적용돼 외곽선까지 잘라 낸다 — 바깥 조각이 흰 외곽선, 안 조각이 삼각형
    const node = fx(field, { x, y: at.y + (i === 1 ? -10 : 0) }, "width:24px;height:22px;margin:-11px 0 0 -12px;"
      + "filter:drop-shadow(1.5px 0 0 #fff) drop-shadow(-1.5px 0 0 #fff) drop-shadow(0 1.5px 0 #fff) drop-shadow(0 -1.5px 0 #fff) drop-shadow(0 1px 2px rgba(0,0,0,.45));");
    const shape = document.createElement("span");
    shape.style.cssText = `position:absolute;inset:0;background:${color};clip-path:polygon(${up ? "50% 0, 100% 100%, 0 100%" : "0 0, 100% 0, 50% 100%"});`;
    node.append(shape);
    const rise = up ? -52 : 44;
    play(node, [
      { transform: `translateY(${up ? 16 : -16}px)`, opacity: 0 },
      { transform: "translateY(0)", opacity: 1, offset: 0.2 },
      { transform: `translateY(${rise * 0.6}px)`, opacity: 1, offset: 0.7 },
      { transform: `translateY(${rise}px)`, opacity: 0 },
    ], { duration: 700, delay: delayMs + i * 80, easing: "ease-out" });
  }
}

/** 흙먼지 — 범위기 착탄 때 맞는 쪽 발밑에서 좌우로 퍼진다 */
function dust(field: HTMLElement, feet: Vec, delayMs: number): void {
  for (let i = 0; i < 6; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const far = 30 + Math.floor(i / 2) * 22;
    const puff = fx(field, feet, orbCss(30 - Math.floor(i / 2) * 4, "#b89a6a"));
    play(puff, [
      { transform: "translate(0px, 0px) scale(0.4)", opacity: 0.95 },
      { transform: `translate(${side * far}px, -${10 + (i % 3) * 6}px) scale(1.2)`, opacity: 0.8, offset: 0.5 },
      { transform: `translate(${side * far * 1.3}px, -${18 + (i % 3) * 6}px) scale(1.5)`, opacity: 0 },
    ], { duration: 520, delay: delayMs + Math.floor(i / 2) * 40, easing: "ease-out" });
  }
}

// ---- 「입·손」 자리 ---------------------------------------------------------

const emitCache = new Map<string, Vec | null>();

/** 그림의 입·손 자리(화면 좌표). 이미지를 읽어 몸 위쪽에서 상대 방향으로 가장 튀어나온 칸을 찾는다(spriteEmitPoint).
 *  가로로 긴 동작 스트립(`data-strip-frames`)은 첫 칸만 본다. `data-emit-x/y`(칸 좌표)가 있으면 그것. 못 읽으면 그림 상자 위쪽 앞끝. */
function emitPoint(sprite: HTMLElement, rect: DOMRect, dir: Vec): Vec {
  const fallback = { x: rect.left + rect.width * (dir.x > 0 ? 0.78 : 0.22), y: rect.top + rect.height * 0.35 };
  if (!(sprite instanceof HTMLImageElement) || !sprite.complete || sprite.naturalWidth === 0) return fallback;
  const frames = Math.max(1, Number(sprite.dataset.stripFrames) || 1);
  // 그림에 입 자리가 적혀 있으면(몬스터 하네스 anim.json 의 emit — 손 고친 값 포함) 그것을 쓴다. 칸 좌표다.
  const markedX = Number(sprite.dataset.emitX);
  const markedY = Number(sprite.dataset.emitY);
  const marked = sprite.dataset.emitX !== undefined && Number.isFinite(markedX) && Number.isFinite(markedY);
  const key = `${sprite.currentSrc || sprite.src}|${frames}|${Math.sign(dir.x)}|${Math.sign(dir.y)}`;
  if (marked) emitCache.set(key + "|marked", { x: (markedX + 0.5) / (sprite.naturalWidth / frames), y: (markedY + 0.5) / sprite.naturalHeight });
  else if (!emitCache.has(key)) {
    let point: Vec | null = null;
    try {
      const w = Math.floor(sprite.naturalWidth / frames);
      const h = sprite.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(sprite, 0, 0, w, h, 0, 0, w, h);
        const data = context.getImageData(0, 0, w, h).data;
        const found = spriteEmitPoint(w, h, (x, y) => data[(y * w + x) * 4 + 3]! > 128, dir);
        if (found) point = { x: (found.x + 0.5) / w, y: (found.y + 0.5) / h };
      }
    } catch {
      point = null; // 교차 출처 그림 — 상자 기준으로 물러난다
    }
    emitCache.set(key, point);
  }
  const point = emitCache.get(marked ? key + "|marked" : key);
  if (!point) return fallback;
  // 그림 상자 안의 내용 자리(object-fit: contain 기본, 스트립은 칸 하나가 상자를 채운다)
  const frameW = sprite.naturalWidth / frames;
  const frameH = sprite.naturalHeight;
  const fit = frames > 1 ? Math.max(rect.width / frameW, rect.height / frameH) : Math.min(rect.width / frameW, rect.height / frameH);
  const contentW = frameW * fit;
  const contentH = frameH * fit;
  const position = getComputedStyle(sprite).objectPosition.split(" ").map((part) => (part.endsWith("%") ? Number.parseFloat(part) / 100 : 0.5));
  const ox = frames > 1 ? 0 : (rect.width - contentW) * (position[0] ?? 0.5);
  const oy = (rect.height - contentH) * (position[1] ?? 0.5);
  return { x: rect.left + ox + point.x * contentW, y: rect.top + oy + point.y * contentH };
}

// ---- 쓰는 쪽 ----------------------------------------------------------------

/** 접촉: 예비동작 → 대각선 돌진. 비트 끝에 접촉 자리에 도착한다. */
function dash(user: HTMLElement, target: HTMLElement, durationMs: number, lungeMs: number): void {
  const sprite = battlerSpriteNode(user);
  const a = restRect(user);
  const b = restRect(target);
  const unit = unitBetween(a, b);
  if (!unit || b.width === 0) return;
  const contact = contactVector(a, b, localScale(sprite, a));
  prepare(sprite);
  const back = { x: -unit.x * WIND_BACK, y: -unit.y * WIND_BACK };
  const dashMs = Math.min(lungeMs, durationMs * 0.7);
  const windEnd = Math.max(0, (durationMs - dashMs) / durationMs);
  sprite.animate(
    [
      { translate: "0px 0px", scale: "1 1", offset: 0 },
      { translate: px(back), scale: "1.07 0.9", offset: windEnd, easing: "cubic-bezier(0.55, 0, 0.9, 0.45)" },
      { translate: px(contact), scale: "1.12 0.93", offset: 1 },
    ],
    { duration: durationMs, easing: "ease-out", fill: "forwards" },
  );
  poses.set(user, { rest: contact, unit });
}

/** 발사체: 젖혀 모음 → 반동하며 쏨. 빛 덩이가 입·손 자리에서 나가 비트 끝에 상대에 닿는다. */
function shoot(field: HTMLElement, user: HTMLElement, target: HTMLElement, durationMs: number, color: string): void {
  const sprite = battlerSpriteNode(user);
  const a = restRect(user);
  const b = restRect(target);
  const unit = unitBetween(a, b);
  if (!unit || b.width === 0) return;
  const scale = localScale(sprite, a);
  prepare(sprite);
  const travel = Math.min(TRAVEL_MS, durationMs * 0.6);
  const release = Math.max(0, durationMs - travel);
  const back = { x: -unit.x * 10, y: -unit.y * 10 };
  const recoil = { x: unit.x * 12, y: unit.y * 12 };
  sprite.animate(
    [
      { translate: "0px 0px", scale: "1 1", filter: "none", offset: 0 },
      { translate: px(back), scale: "1.05 0.93", filter: `drop-shadow(0 0 7px ${color})`, offset: Math.max(0.05, release / durationMs - 0.05), easing: "ease-in" },
      { translate: px(recoil), scale: "1.1 0.95", filter: `drop-shadow(0 0 4px ${color})`, offset: Math.min(0.98, release / durationMs + 0.12) },
      { translate: px(recoil), scale: "1 1", filter: "none", offset: 1 },
    ],
    { duration: durationMs, easing: "linear", fill: "forwards" },
  );
  poses.set(user, { rest: recoil, unit });
  // 쏘는 순간의 입 자리 = 제자리 입 + 반동만큼
  const mouth = emitPoint(sprite, a, unit);
  const from = fieldPoint(field, { x: mouth.x + recoil.x * scale, y: mouth.y + recoil.y * scale });
  const to = fieldPoint(field, center(b));
  const d = { x: to.x - from.x, y: to.y - from.y };
  // 모으는 동안 입에 빛이 맺힌다
  const charge = fx(field, fieldPoint(field, mouth), orbCss(30, color));
  play(charge, [{ transform: "scale(0.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1, offset: 0.85 }, { transform: "scale(0.6)", opacity: 0 }], { duration: Math.max(60, release + 40), easing: "ease-in" });
  for (let i = 0; i < 5; i += 1) {
    const size = 44 - i * 7;
    const orb = fx(field, from, orbCss(size, color));
    play(orb, [
      { transform: "translate(0px, 0px) scale(0.5)", opacity: 0 },
      { transform: "translate(0px, 0px) scale(1)", opacity: 1 - i * 0.16, offset: 0.08 },
      { transform: `translate(${d.x}px, ${d.y}px) scale(1)`, opacity: 1 - i * 0.16 },
    ], { duration: travel, delay: release + i * 28, easing: "cubic-bezier(0.4, 0, 0.9, 0.6)" });
  }
  ring(field, to, color, 160, 300, durationMs);
  ring(field, to, "#ffffff", 110, 220, durationMs);
}

/** 현장 발생: 솟으며 부름 → 상대 자리에 위에서 꽂히거나 아래에서 솟는다(비트 끝에 닿는다). */
function summonStrike(field: HTMLElement, user: HTMLElement, target: HTMLElement, durationMs: number, color: string, fromBelow: boolean): void {
  const sprite = battlerSpriteNode(user);
  const a = restRect(user);
  const b = restRect(target);
  const unit = unitBetween(a, b) ?? { x: 0, y: -1 };
  prepare(sprite);
  const lift = { x: 0, y: -12 };
  sprite.animate(
    [
      { translate: "0px 0px", scale: "1 1", filter: "none" },
      { translate: px(lift), scale: "0.93 1.1", filter: `drop-shadow(0 0 8px ${color})`, offset: 0.55, easing: "ease-out" },
      { translate: px(lift, 0.6), scale: "1 1.04", filter: `drop-shadow(0 0 5px ${color})` },
    ],
    { duration: durationMs, fill: "forwards" },
  );
  poses.set(user, { rest: { x: 0, y: lift.y * 0.6 }, unit });
  const growMs = 110;
  const start = Math.max(0, durationMs - growMs);
  const targetCenter = fieldPoint(field, center(b));
  const feet = fieldPoint(field, { x: center(b).x, y: b.bottom });
  if (fromBelow) {
    // 땅에서 솟는 바위·물기둥 — 발밑에서 몸 높이의 70% 까지
    const height = Math.max(40, (feet.y - targetCenter.y) * 1.6);
    for (const [dx, w] of [[-22, 18], [0, 26], [22, 18]] as const) {
      const spike = fx(field, { x: feet.x + dx, y: feet.y }, `width:${w}px;height:${height}px;margin:${-height}px 0 0 ${-w / 2}px;transform-origin:50% 100%;`
        + `background:linear-gradient(to top, ${color}, #fff 85%);clip-path:polygon(50% 0, 100% 100%, 0 100%);filter:drop-shadow(0 0 6px ${color});`);
      play(spike, [
        { transform: "scaleY(0)", opacity: 1 },
        { transform: "scaleY(1)", opacity: 1, offset: 0.3 },
        { transform: "scaleY(1)", opacity: 1, offset: 0.7 },
        { transform: "scaleY(0.2)", opacity: 0 },
      ], { duration: growMs + 380, delay: start + Math.abs(dx), easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" });
    }
  } else {
    // 위에서 꽂히는 번개·빛기둥 — 필드 위끝에서 상대 가운데까지
    const height = Math.max(60, targetCenter.y + 20);
    const bolt = fx(field, { x: targetCenter.x, y: targetCenter.y + 20 }, `width:46px;height:${height}px;margin:${-height}px 0 0 -23px;transform-origin:50% 0;`
      + `background:linear-gradient(to right, transparent, ${color} 30%, #fff 50%, ${color} 70%, transparent);filter:drop-shadow(0 0 10px ${color});`);
    play(bolt, [
      { transform: "scaleY(0)", opacity: 1 },
      { transform: "scaleY(1) scaleX(1.4)", opacity: 1, offset: 0.25 },
      { transform: "scaleY(1) scaleX(0.6)", opacity: 1, offset: 0.55 },
      { transform: "scaleY(1) scaleX(0.2)", opacity: 0 },
    ], { duration: growMs + 300, delay: start, easing: "ease-out" });
  }
  ring(field, fromBelow ? feet : targetCenter, color, 140, 280, durationMs, fromBelow ? 0.35 : 1);
}

/** 범위: 뛰어올랐다 발을 구른다. 발밑 충격파와 필드 흔들림이 비트 끝에 온다(행동 하나에 한 번). */
function stomp(field: HTMLElement, user: HTMLElement, durationMs: number, color: string, actionId: number | undefined): void {
  const sprite = battlerSpriteNode(user);
  const a = restRect(user);
  prepare(sprite);
  sprite.animate(
    [
      { translate: "0px 0px", scale: "1 1" },
      { translate: "0px 4px", scale: "1.1 0.88", offset: 0.2 },
      { translate: "0px -26px", scale: "0.92 1.1", offset: 0.6, easing: "ease-in" },
      { translate: "0px 0px", scale: "1.18 0.84" },
    ],
    { duration: durationMs, easing: "ease-out", fill: "forwards" },
  );
  poses.set(user, { rest: { x: 0, y: 0 }, unit: { x: 0, y: 1 } });
  if (actionId !== undefined && shakenActionId === actionId) return;
  shakenActionId = actionId;
  const feet = fieldPoint(field, { x: center(a).x, y: a.bottom });
  ring(field, feet, color, 420, 420, durationMs, 0.3);
  ring(field, feet, "#ffffff", 300, 320, durationMs + 60, 0.3);
  window.setTimeout(() => {
    if (!field.isConnected || typeof field.animate !== "function") return;
    field.animate(
      [{ translate: "0 0" }, { translate: "0 10px" }, { translate: "0 -9px" }, { translate: "0 7px" }, { translate: "0 -5px" }, { translate: "0 3px" }, { translate: "0 0" }],
      { duration: 340, easing: "linear" },
    );
  }, durationMs);
}

/** 능력 올리기·회복·상태 걸기: 쓰는 쪽은 제자리에서 부른다(두 번 뜀 / 기울임). */
function call(user: HTMLElement, target: HTMLElement | null, color: string, hops: boolean): void {
  const durationMs = CALL_MS;
  const sprite = battlerSpriteNode(user);
  const a = restRect(user);
  const b = target && target !== user ? restRect(target) : null;
  const unit = (b && unitBetween(a, b)) ?? { x: 0, y: -1 };
  prepare(sprite);
  const lean = b ? { x: unit.x * 8, y: unit.y * 8 } : { x: 0, y: 0 };
  sprite.animate(
    hops
      ? [
        { translate: "0px 0px", scale: "1 1", filter: "none" },
        { translate: "0px -14px", scale: "0.95 1.06", offset: 0.25, filter: `drop-shadow(0 0 6px ${color})` },
        { translate: "0px 0px", scale: "1.06 0.94", offset: 0.45 },
        { translate: "0px -14px", scale: "0.95 1.06", offset: 0.7, filter: `drop-shadow(0 0 8px ${color})` },
        { translate: "0px 0px", scale: "1 1", filter: "none" },
      ]
      : [
        { translate: "0px 0px", scale: "1 1", filter: "none" },
        { translate: px(lean, -0.6), scale: "1.04 0.95", offset: 0.4, filter: `drop-shadow(0 0 6px ${color})` },
        { translate: px(lean), scale: "1.06 0.97", filter: `drop-shadow(0 0 3px ${color})` },
      ],
    { duration: durationMs, easing: "ease-in-out", fill: "forwards" },
  );
  poses.set(user, { rest: hops ? { x: 0, y: 0 } : lean, unit, holdUntil: performance.now() + durationMs });
}

/** 받는 쪽 이펙트(능력 오름·회복·상태) — 비트 끝에 시작한다. */
function aura(field: HTMLElement, receiver: HTMLElement, motion: "boost" | "heal" | "status", moveColor: string, delayMs: number): void {
  const rect = restRect(receiver);
  const middle = fieldPoint(field, center(rect));
  // 속성 없는 보조기는 흰색이다 — 흰 고리·안개는 밝아진 그림·밝은 배경 위에서 안 보인다
  const color = moveColor.toLowerCase() === "#ffffff" ? (motion === "status" ? "#a37cf0" : "#ffb340") : moveColor;
  const sprite = battlerSpriteNode(receiver);
  prepare(sprite);
  if (motion === "boost") {
    ring(field, middle, color, Math.max(rect.width, 120), 520, delayMs);
    ring(field, middle, "#ffffff", Math.max(rect.width, 120) * 0.7, 420, delayMs + 120);
    arrows(field, { x: middle.x, y: middle.y - 10 }, true, delayMs + 80);
    sprite.animate([{ filter: "brightness(1)" }, { filter: `brightness(1.5) drop-shadow(0 0 8px ${color})`, offset: 0.3 }, { filter: "brightness(1)" }], { duration: 560, delay: delayMs });
  } else if (motion === "heal") {
    const top = fieldPoint(field, { x: center(rect).x, y: rect.top });
    const pillar = fx(field, { x: top.x, y: top.y + rect.height }, `width:${Math.round(rect.width * 0.6)}px;height:${Math.round(rect.height * 1.4)}px;margin:${-Math.round(rect.height * 1.4)}px 0 0 ${-Math.round(rect.width * 0.3)}px;transform-origin:50% 0;`
      + `background:linear-gradient(to right, transparent, ${color}99 30%, #ffffffcc 50%, ${color}99 70%, transparent);`);
    play(pillar, [{ transform: "scaleY(0)", opacity: 0.9 }, { transform: "scaleY(1)", opacity: 0.9, offset: 0.35 }, { transform: "scaleY(1)", opacity: 0 }], { duration: 640, delay: delayMs, easing: "ease-out" });
    for (let i = 0; i < 6; i += 1) {
      const spark = fx(field, { x: middle.x + (i - 2.5) * 16, y: middle.y + 24 }, orbCss(10, color));
      play(spark, [{ transform: "translateY(0)", opacity: 0 }, { transform: "translateY(-18px)", opacity: 1, offset: 0.3 }, { transform: "translateY(-60px)", opacity: 0 }], { duration: 640, delay: delayMs + 120 + (i % 3) * 70 });
    }
    sprite.animate([{ filter: "brightness(1)" }, { filter: `brightness(1.45) drop-shadow(0 0 8px ${color})`, offset: 0.35 }, { filter: "brightness(1)" }], { duration: 620, delay: delayMs });
  } else {
    for (let i = 0; i < 5; i += 1) {
      const puff = fx(field, { x: middle.x + (i - 2) * 18, y: middle.y + ((i % 2) * 2 - 1) * 10 }, orbCss(46, color));
      play(puff, [{ transform: "scale(0.3)", opacity: 0 }, { transform: "scale(1)", opacity: 0.75, offset: 0.35 }, { transform: "scale(1.3) translateY(-10px)", opacity: 0 }], { duration: 640, delay: delayMs + i * 40, easing: "ease-out" });
    }
    arrows(field, { x: middle.x, y: middle.y - 30 }, false, delayMs + 120);
    const shiver = [4, -4, 3, -3, 3, -2, 2, -1, 0];
    sprite.animate(shiver.map((dx) => ({ translate: `${dx}px 0px` })), { duration: 420, delay: delayMs + 60, easing: "linear" });
    sprite.animate([{ filter: "none" }, { filter: `brightness(0.8) drop-shadow(0 0 6px ${color})`, offset: 0.3 }, { filter: "none" }], { duration: 640, delay: delayMs });
  }
}

/** 착탄 정지 비트 — 접촉 자리에서 찌그러졌다 펴진다. 앞 비트에 돌진이 없었으면(예고 0) 여기서 짧게 덮친다. */
function holdContact(user: HTMLElement, target: HTMLElement | null, durationMs: number): void {
  const sprite = battlerSpriteNode(user);
  const pose = poses.get(user);
  if (!pose) {
    if (!target) return;
    const a = restRect(user);
    const b = restRect(target);
    const unit = unitBetween(a, b);
    if (!unit) return;
    const contact = contactVector(a, b, localScale(sprite, a));
    poses.set(user, { rest: contact, unit });
    prepare(sprite);
    sprite.animate([{ translate: "0px 0px" }, { translate: px(contact) }], { duration: 60, easing: "ease-in", fill: "forwards" });
    return;
  }
  sprite.animate(
    [
      { translate: px(pose.rest), scale: "0.9 1.08" },
      { translate: px(pose.rest), scale: "1 1" },
    ],
    { duration: Math.max(60, durationMs), easing: "ease-out", fill: "forwards" },
  );
}

/** 제자리로 — 살짝 지나쳤다 돌아온다. 끝나면 안무를 지운다. */
function returnHome(user: HTMLElement, durationMs: number): void {
  const pose = poses.get(user);
  poses.delete(user);
  if (!pose) return;
  const sprite = battlerSpriteNode(user);
  const wait = Math.max(0, (pose.holdUntil ?? 0) - performance.now());
  const animation = sprite.animate(
    [
      { translate: px(pose.rest), scale: "1 1" },
      { translate: px(pose.rest, -0.06), scale: "1.04 0.97", offset: 0.7 },
      { translate: "0px 0px", scale: "1 1" },
    ],
    { duration: Math.max(120, Math.min(durationMs, 260)), delay: wait, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
  );
  animation.onfinish = () => {
    if (!poses.has(user)) for (const running of sprite.getAnimations()) if (!(running as CSSAnimation).animationName) running.cancel();
  };
}

// ---- 맞는 쪽 ----------------------------------------------------------------

/** 착탄 — 맞은 쪽이 밀린 채 정지 비트 동안 붙들린다(흰 실루엣은 22-hit-feel ①).
 *  방향은 approach 를 시작할 때 제자리에서 잰 값을 쓴다 — 착탄 순간의 공격자 그림은 상대 몸 안까지 들어와 있어서
 *  지금 위치로 재면 넉백이 공격자 쪽으로 뒤집혔다(2026-10-02 녹화). */
function pushTarget(target: HTMLElement, attacker: HTMLElement | null, durationMs: number, motion: PokemonMoveMotion, fromBelow: boolean): void {
  const sprite = battlerSpriteNode(target);
  let unit = attacker ? poses.get(attacker)?.unit : undefined;
  if (!unit || motion === "area") {
    const a = attacker?.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    unit = (a && a.width > 0 && unitBetween(a, b)) || { x: 1, y: -1 };
  }
  // 현장 발생은 내리꽂혀 아래로 눌리거나(위에서) 솟구쳐 위로 튄다(아래에서)
  if (motion === "strike") unit = fromBelow ? { x: 0, y: -1 } : { x: 0, y: 1 };
  const k = motion === "contact" ? 1 : motion === "strike" ? 0.6 : 0.75;
  // 범위기: 땅을 타고 온 충격이 맞는 쪽 발밑에서 한 번 더 퍼진다
  if (motion === "area" && target.parentElement) {
    const field = target.closest<HTMLElement>(".battle-field");
    const rect = sprite.getBoundingClientRect();
    if (field) {
      const feet = fieldPoint(field, { x: center(rect).x, y: rect.bottom - 6 });
      ring(field, feet, "#7a4a1e", Math.max(180, rect.width * 1.4), 380, 0, 0.32);
      dust(field, feet, 0);
    }
  }
  const squash = motion === "strike" && !fromBelow;
  prepare(sprite);
  sprite.animate(
    [
      { translate: px(unit, PUSH * 0.7 * k), scale: squash ? "1.12 0.86" : "0.94 1.04" },
      { translate: px(unit, PUSH * k), scale: squash ? "1.1 0.88" : "0.96 1.03" },
    ],
    { duration: Math.max(60, durationMs), fill: "forwards" },
  );
  knocked.set(target, { unit, k, squash });
}

/** 정지가 풀리면 날아갔다 튕겨 돌아오며 좌우로 떤다. 다 돌아온 뒤 두 번 꺼졌다 켜진다 —
 *  날아가는 동안 깜빡이면 넉백이 깜빡임에 가려 안 보였다(그래서 포켓몬은 blinkBattlerNode 를 쓰지 않는다). */
function releaseTarget(target: HTMLElement): void {
  const knock = knocked.get(target);
  knocked.delete(target);
  if (!knock) return;
  const { unit, k, squash } = knock;
  const sprite = battlerSpriteNode(target);
  const far = KNOCK * k;
  const shake = [7, -6, 5, -4, 2];
  const animation = sprite.animate(
    [
      { translate: px(unit, PUSH * k), scale: squash ? "1.1 0.88" : "0.96 1.03", offset: 0 },
      { translate: px(unit, far), scale: "1 1", offset: 0.2, easing: "cubic-bezier(0.3, 0, 0.4, 1)" },
      ...shake.map((dx, index) => ({ translate: `${Math.round(unit.x * far * (1 - (index + 1) / 6) + dx)}px ${Math.round(unit.y * far * (1 - (index + 1) / 6))}px`, offset: 0.3 + index * 0.12 })),
      { translate: "0px 0px", scale: "1 1", offset: 1 },
    ],
    { duration: 380, easing: "linear", fill: "forwards" },
  );
  animation.onfinish = () => {
    if (!knocked.has(target)) for (const running of sprite.getAnimations()) if (!(running as CSSAnimation).animationName) running.cancel();
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
 * 비트 순서: 내 행동 approach(lunge) → impact(knockback) → recover(return),
 *            적 행동 approach(windup) → impact(lunge+knockback) → recover(return).
 */
export function pokemonActionMotion(field: HTMLElement, beat: BattleActionBeat | undefined, lungeMs: number, move: PokemonMoveContext): void {
  if (!beat || reduced() || typeof HTMLElement.prototype.animate !== "function") return;
  const user = beat.userId ? findBattlerNode(field, beat.userId) : null;
  const target = beat.targetId ? findBattlerNode(field, beat.targetId) : null;
  const other = target && target !== user ? target : null;
  const { motion, color } = move;
  if (beat.kind === "approach" && user && (beat.userMotion === "lunge" || beat.userMotion === "windup")) {
    const D = beat.durationMs;
    if (motion === "contact" && other) dash(user, other, D, lungeMs);
    else if (motion === "projectile" && other) shoot(field, user, other, D, color);
    else if (motion === "strike" && other) summonStrike(field, user, other, D, color, move.fromBelow);
    else if (motion === "area") stomp(field, user, D, color, move.actionId);
    else if (motion === "boost" || motion === "heal") {
      call(user, target, color, motion === "boost");
      if (target) aura(field, target, motion, color, Math.max(D, CALL_MS * 0.45));
    } else if (motion === "status") {
      call(user, other, color, false);
      if (other) aura(field, other, "status", color, Math.max(D, CALL_MS * 0.45));
    } else if (other) dash(user, other, D, lungeMs);
  } else if (beat.kind === "impact") {
    if (user && other && beat.userMotion === "lunge" && motion === "contact") holdContact(user, other, beat.durationMs);
    if (target && beat.targetMotion === "knockback") pushTarget(target, user, beat.durationMs, motion, move.fromBelow);
  } else if (beat.kind === "recover") {
    if (user) returnHome(user, beat.durationMs);
    if (target) releaseTarget(target);
  }
}
