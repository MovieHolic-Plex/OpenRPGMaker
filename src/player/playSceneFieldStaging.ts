import { syncLiftRide } from "@/player/playSceneLiftRide";
import { characterBaseOrigin } from "./characterOrigin";
// 타입만 가져온다. 값 import 는 phaser.esm.js 를 끌어와 모듈 평가 때 `window` 를 읽는다 —
// 노드 vitest 에서 이 파일을 거치는 테스트 약 200개가 「window is not defined」로 수집조차 안 됐다(ci-full 40165485978).
// 런타임에는 phaserRuntime 이 window.Phaser 를 꽂으므로 값은 전역 이름공간으로 읽는다(playSceneActionCombat 과 같다).
import type Phaser from "phaser";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { StepResult } from "@/player/interpreter/types";
import { characterDepth, characterSpriteY } from "@/player/characterDepth";
import { runtimeMapWorldScale } from "@/player/runtimeViewScale";
import { screenOverlayHost } from "@/player/playSceneScreenEffects";
import { syncDoors } from "@/player/playSceneDoors";
import { syncFreezeFrame } from "@/player/playSceneFreezeFrame";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  isEmptySpriteLook,
  nextSpriteLook,
  normalizeLetterboxPercent,
  normalizeSpriteLook,
  spriteLookKey,
  type ParticlePreset,
  type SpriteLook,
} from "@/project/eventCommands/cinematicStaging";
import { mapTileSize } from "@/project/tileGeometry";
import { store } from "@/project/store";
import { runtimeEventViewById } from "@/project/runtimeEventState";

/** Phaser.TintModes.FILL (Phaser 4). 값 import 없이 쓰려고 숫자로 둔다. */
const TINT_MODE_FILL = 1;

/**
 * 필드 연출 렌더러 — 파티클 · 캐릭터 모습 효과 · 레터박스.
 *
 * - 파티클: Phaser 파티클 이미터. 대상 캐릭터를 따라다닌다(startFollow). 그림은 장면마다 한 번 만든
 *   작은 캔버스 텍스처(점·별·연기·십자·물방울)라 에셋이 필요 없다.
 * - 모습 효과: 세션(`m2Runtime.screen.spriteLooks`)을 매 프레임 스프라이트에 입힌다. 이벤트 스프라이트는
 *   맵 동기화가 다시 만들거나 원점·배율을 되돌리므로, «한 번 적용» 이 아니라 매 프레임 덮어쓴다.
 *   포즈의 위치 이동은 원점(origin)으로 낸다 — y 를 건드리면 걷기 트윈과 다툰다.
 * - 레터박스: DOM 띠 두 장. 캔버스에 그리면 화면 기울기·물결이 띠까지 비튼다. z 28 = 그림(26)·화면 효과(27)
 *   위, 타이머(29)·HUD(30)·대사창(39) 아래 — 대사는 띠 위에 자막처럼 뜬다.
 */

const PARTICLE_DEPTH = 350_000;
const LETTERBOX_Z_INDEX = 28;

// ── 텍스처 ─────────────────────────────────────────────────────────

const TEX = {
  dot: "oprn-fx-dot",
  star: "oprn-fx-star",
  puff: "oprn-fx-puff",
  plus: "oprn-fx-plus",
  drop: "oprn-fx-drop",
  paper: "oprn-fx-paper",
  petal: "oprn-fx-petal",
} as const;

/**
 * 떼어낸 캔버스에 다 그린 뒤 `addCanvas` 로 넘긴다. `createCanvas` 후 그리고 `refresh()` 하면
 * 이 런타임에서 픽셀이 안 나온다(characterShadow.ts 의 2026-08-29 실측).
 */
function canvasTexture(scene: PlaySceneContext, key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): void {
  if (scene.textures.exists(key) || typeof document === "undefined") return;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  draw(ctx, size);
  scene.textures.addCanvas(key, canvas);
}

function softCircle(ctx: CanvasRenderingContext2D, size: number, inner: number): void {
  const r = size / 2;
  const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(inner, "rgba(255,255,255,0.85)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
}

function ensureFxTextures(scene: PlaySceneContext): void {
  canvasTexture(scene, TEX.dot, 8, (ctx, size) => softCircle(ctx, size, 0.35));
  canvasTexture(scene, TEX.puff, 24, (ctx, size) => softCircle(ctx, size, 0.2));
  canvasTexture(scene, TEX.drop, 4, (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(1, 0, 2, 4);
    ctx.fillRect(0, 1, 4, 2);
  });
  // 도트 화풍에 맞춰 별·십자는 픽셀로 찍는다(흐린 원은 연기·불티만).
  canvasTexture(scene, TEX.star, 7, (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(3, 0, 1, 7);
    ctx.fillRect(0, 3, 7, 1);
    ctx.fillRect(2, 2, 3, 3);
  });
  // 종이 한 장(도트): 흰 면·아래 그늘·글줄 셋. 꽃잎: 연분홍 둥근 조각 + 짙은 끝.
  canvasTexture(scene, TEX.paper, 7, (ctx) => {
    ctx.fillStyle = "#c3c8d2"; ctx.fillRect(0, 0, 6, 7);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 5, 6);
    ctx.fillStyle = "#9aa1ad"; ctx.fillRect(1, 1, 3, 1); ctx.fillRect(1, 3, 3, 1); ctx.fillRect(1, 5, 2, 1);
  });
  canvasTexture(scene, TEX.petal, 4, (ctx) => {
    ctx.fillStyle = "#ffd1df"; ctx.fillRect(1, 0, 2, 1); ctx.fillRect(0, 1, 4, 2);
    ctx.fillStyle = "#e88aa8"; ctx.fillRect(1, 3, 2, 1); ctx.fillRect(3, 2, 1, 1);
  });
  canvasTexture(scene, TEX.plus, 5, (ctx) => {
    ctx.fillStyle = "#fff";
    ctx.fillRect(2, 0, 1, 5);
    ctx.fillRect(0, 2, 5, 1);
  });
}

// ── 파티클 ─────────────────────────────────────────────────────────

type ParticleRecipe = {
  readonly texture: string;
  /** true 면 한 번에 터뜨린다(explode). false 면 시간 동안 뿜는다. */
  readonly burst: boolean;
  readonly count: number;
  readonly config: (s: number) => Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
};

/** 수치는 16px 칸 기준 월드 px. s = 맵 세계 배율(칸이 큰 맵에서 같은 비율로 보이게). */
const RECIPES: Record<ParticlePreset, ParticleRecipe> = {
  sparkle: {
    texture: TEX.star, burst: false, count: 1,
    config: (s) => ({
      x: { min: -9 * s, max: 9 * s }, y: { min: -28 * s, max: -2 * s },
      speed: { min: 2 * s, max: 10 * s }, lifespan: 700, frequency: 70, quantity: 1,
      scale: { start: s, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xfff6a0, 0xffffff, 0xffd860], blendMode: "ADD",
    }),
  },
  magic: {
    texture: TEX.dot, burst: false, count: 1,
    config: (s) => ({
      x: { min: -10 * s, max: 10 * s }, y: { min: -6 * s, max: 0 },
      speedX: { min: -6 * s, max: 6 * s }, speedY: { min: -34 * s, max: -14 * s },
      lifespan: 950, frequency: 45, quantity: 1,
      scale: { start: 0.9 * s, end: 0 }, alpha: { start: 0.95, end: 0 },
      tint: [0xb070ff, 0x7090ff, 0xe0b0ff], blendMode: "ADD",
    }),
  },
  heal: {
    texture: TEX.plus, burst: false, count: 1,
    config: (s) => ({
      x: { min: -9 * s, max: 9 * s }, y: { min: -20 * s, max: 0 },
      speedY: { min: -20 * s, max: -9 * s }, lifespan: 1000, frequency: 90, quantity: 1,
      scale: { start: s, end: 0.6 * s }, alpha: { start: 1, end: 0 },
      tint: [0x80ff90, 0xc0ffc0, 0x60e0a0], blendMode: "ADD",
    }),
  },
  fire: {
    texture: TEX.dot, burst: false, count: 2,
    config: (s) => ({
      x: { min: -6 * s, max: 6 * s }, y: { min: -4 * s, max: 0 },
      speedX: { min: -5 * s, max: 5 * s }, speedY: { min: -42 * s, max: -16 * s },
      lifespan: 620, frequency: 30, quantity: 2,
      scale: { start: 1.1 * s, end: 0.1 * s }, alpha: { start: 1, end: 0 },
      tint: [0xffe060, 0xff9a30, 0xff4a18], blendMode: "ADD",
    }),
  },
  smoke: {
    texture: TEX.puff, burst: false, count: 1,
    config: (s) => ({
      x: { min: -5 * s, max: 5 * s }, y: { min: -10 * s, max: -2 * s },
      speedX: { min: -5 * s, max: 5 * s }, speedY: { min: -22 * s, max: -8 * s },
      lifespan: 1500, frequency: 110, quantity: 1,
      scale: { start: 0.35 * s, end: 1.3 * s }, alpha: { start: 0.55, end: 0 },
      tint: [0x8a8a8a, 0xa0a0a0, 0x707070],
    }),
  },
  dust: {
    texture: TEX.puff, burst: true, count: 12,
    config: (s) => ({
      x: { min: -8 * s, max: 8 * s }, y: { min: -3 * s, max: 0 },
      speed: { min: 12 * s, max: 34 * s }, angle: { min: 190, max: 350 },
      gravityY: 30 * s, lifespan: 520,
      scale: { start: 0.25 * s, end: 0.75 * s }, alpha: { start: 0.65, end: 0 },
      tint: [0xb59670, 0xc8ad86, 0x9a7e5c], emitting: false,
    }),
  },
  explosion: {
    texture: TEX.dot, burst: true, count: 44,
    config: (s) => ({
      y: { min: -14 * s, max: -6 * s },
      speed: { min: 30 * s, max: 120 * s }, angle: { min: 0, max: 360 },
      lifespan: { min: 380, max: 720 },
      scale: { start: 1.6 * s, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xffffff, 0xffe060, 0xff8a30, 0xff3a18], blendMode: "ADD", emitting: false,
    }),
  },
  // 부딪혀 떨군 서류 — 위로 확 흩어졌다가 천천히 회전하며 내려앉는다(낙하가 느려 «종이»로 읽힌다).
  paper: {
    texture: TEX.paper, burst: true, count: 9,
    config: (s) => ({
      x: { min: -6 * s, max: 6 * s }, y: { min: -18 * s, max: -10 * s },
      speed: { min: 24 * s, max: 62 * s }, angle: { min: 200, max: 340 },
      gravityY: 34 * s, lifespan: { min: 1500, max: 2300 },
      rotate: { start: 0, end: 540 }, scale: { start: s, end: 0.9 * s }, alpha: { start: 1, end: 0.15 },
      emitting: false,
    }),
  },
  // 바람에 흩날리는 꽃잎 — 대상 위쪽에서 비스듬히 흘러내린다.
  petals: {
    texture: TEX.petal, burst: false, count: 1,
    config: (s) => ({
      x: { min: -40 * s, max: 40 * s }, y: { min: -48 * s, max: -30 * s },
      speedX: { min: 6 * s, max: 22 * s }, speedY: { min: 8 * s, max: 20 * s },
      lifespan: 2200, frequency: 120, quantity: 1,
      rotate: { start: 0, end: 360 }, scale: { start: s, end: 0.8 * s }, alpha: { start: 1, end: 0 },
    }),
  },
  splash: {
    texture: TEX.drop, burst: true, count: 26,
    config: (s) => ({
      x: { min: -6 * s, max: 6 * s }, y: { min: -2 * s, max: 0 },
      speed: { min: 34 * s, max: 78 * s }, angle: { min: 230, max: 310 },
      gravityY: 240 * s, lifespan: 720,
      scale: { start: s, end: 0.5 * s }, alpha: { start: 1, end: 0.2 },
      tint: [0xa8dcff, 0xffffff, 0x6aaee8], emitting: false,
    }),
  },
};

type ParticleStep = Extract<StepResult, { kind: "particleEffect" }>;

function targetSprite(scene: PlaySceneContext, target: ParticleStep["target"], currentEventId: string | undefined): Phaser.GameObjects.Sprite | undefined {
  if (target.kind === "player") return scene.player;
  if (target.kind === "event") return scene.eventSprites.get(target.eventId || currentEventId || "");
  return undefined;
}

/** 파티클 한 번. 다 사라지면(뿜기 시간 + 수명) 이행되는 약속을 돌려준다 — wait 면 흐름이 기다린다. */
export function playParticleEffect(scene: PlaySceneContext, step: ParticleStep, currentEventId?: string, depth: number = PARTICLE_DEPTH): Promise<void> {
  ensureFxTextures(scene);
  const recipe = RECIPES[step.preset];
  // 크기(%)는 입자 그림과 퍼지는 거리를 함께 키운다(레시피 수치가 모두 s 배) — 1배 화면에서 서류·불티가 점으로 보이던 것을 키운다.
  const scale = runtimeMapWorldScale(scene) * ((step.sizePercent ?? 100) / 100);
  const sprite = targetSprite(scene, step.target, currentEventId);
  const size = mapTileSize(scene.map);
  // 칸 대상은 칸 발밑 중앙(캐릭터 원점과 같은 기준)에 둔다.
  const x = sprite ? sprite.x : step.target.kind === "tile" ? (step.target.x + 0.5) * size : scene.player?.x ?? 0;
  const y = sprite ? sprite.y : step.target.kind === "tile" ? characterSpriteY(step.target.y, size) : scene.player?.y ?? 0;
  // 따라가는 이미터는 원점(0,0)에 만든다. startFollow 는 입자를 대상의 월드 좌표에 뿌리는데 이미터 위치도
  // 그리기 변환에 더해져, 대상 자리에 만들면 좌표가 두 번 더해져 화면 밖에 그려졌다(2026-10-02 실측).
  const emitter = scene.add.particles(sprite ? 0 : x, sprite ? 0 : y, recipe.texture, recipe.config(scale));
  emitter.setDepth(depth);
  if (sprite) emitter.startFollow(sprite);
  const longestLife = step.preset === "paper" || step.preset === "petals" ? 2400 : 1500;
  return new Promise((resolve) => {
    const finish = (): void => {
      emitter.destroy();
      resolve();
    };
    if (recipe.burst) {
      emitter.explode(recipe.count);
      // 긴 시간을 주면 그동안 몇 번 더 터뜨린다(연쇄 폭발·계속 튀는 물보라).
      const repeats = Math.max(0, Math.floor(step.durationMs / 700) - 1);
      for (let index = 1; index <= repeats; index += 1) {
        scene.time.delayedCall(index * 700, () => emitter.explode(Math.ceil(recipe.count * 0.6)));
      }
      scene.time.delayedCall(Math.max(step.durationMs, 400) + longestLife, finish);
      return;
    }
    scene.time.delayedCall(step.durationMs, () => emitter.stop());
    scene.time.delayedCall(step.durationMs + longestLife, finish);
  });
}

// ── 캐릭터 모습 효과 ─────────────────────────────────────────────────

type SpriteLookStep = Extract<StepResult, { kind: "spriteLook" }>;

function lookKeyFor(scene: PlaySceneContext, target: SpriteLookStep["target"], currentEventId: string | undefined): string {
  if (target.kind === "player") return spriteLookKey({ kind: "player" });
  return spriteLookKey({ kind: "event", mapId: scene.session.currentMapId, eventId: target.eventId || currentEventId || "" });
}

/** 「모습 효과」 명령을 세션에 적는다. 그리기는 매 프레임 `updateFieldStaging`. */
export function applySpriteLookStep(scene: PlaySceneContext, step: SpriteLookStep, currentEventId?: string): void {
  const screen = ensureM2Runtime(scene.session).screen;
  const key = lookKeyFor(scene, step.target, currentEventId);
  const looks = { ...(screen.spriteLooks ?? {}) };
  const next = nextSpriteLook(looks[key], step.fields);
  if (isEmptySpriteLook(next)) delete looks[key];
  else looks[key] = next;
  if (Object.keys(looks).length > 0) screen.spriteLooks = looks;
  else delete screen.spriteLooks;
}

/** 효과를 입히기 전 값. 효과가 풀리면 이것으로 돌려놓는다(이동 경로가 준 불투명도 등을 지키려고). */
type AppliedLook = { readonly alpha: number; lastGhostAt: number; lastX: number; lastY: number };

const applied = new WeakMap<object, AppliedLook>();

const POSE_ORIGIN: Record<NonNullable<SpriteLook["pose"]>, { x: number; y: number; angle: number }> = {
  // 원점을 바꿔 회전 뒤에도 몸이 발밑 줄 위에 눕게 한다.
  // angle 90: 로컬 (u,v) → 화면 (-v, u). 바닥 = (1-ox)·w = 0 → ox = 1, 가로 가운데 → oy = 0.5.
  // angle -90 은 거울상이라 ox = 0.
  fallen: { x: 1, y: 0.5, angle: 90 },
  fallenLeft: { x: 0, y: 0.5, angle: -90 },
  crouch: { x: 0.5, y: 1, angle: 0 },
  float: { x: 0.5, y: 1, angle: 0 },
};

function hexToInt(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function lookTargets(scene: PlaySceneContext): Array<[Phaser.GameObjects.Sprite, SpriteLook | undefined]> {
  const looks = scene.session.m2Runtime?.screen.spriteLooks;
  const result: Array<[Phaser.GameObjects.Sprite, SpriteLook | undefined]> = [];
  if (scene.player) result.push([scene.player, looks?.player]);
  for (const [eventId, sprite] of scene.eventSprites) {
    result.push([sprite, looks?.[spriteLookKey({ kind: "event", mapId: scene.session.currentMapId, eventId })]]);
  }
  return result;
}

function applyLook(scene: PlaySceneContext, sprite: Phaser.GameObjects.Sprite, raw: SpriteLook | undefined, now: number): void {
  const look = raw ? normalizeSpriteLook(raw) : undefined;
  const state = applied.get(sprite);
  const baseOrigin = characterBaseOrigin(sprite);
  if (isEmptySpriteLook(look)) {
    if (!state) return;
    // 풀기 — 맵 동기화가 쓰는 기본값(저작 발 기준점 · 정비율 · 회전 0)으로 되돌린다.
    sprite.clearTint();
    sprite.setFlipX(false);
    sprite.setAngle(0);
    sprite.setOrigin(baseOrigin.x, baseOrigin.y);
    sprite.setScale(sprite.scaleX);
    sprite.setAlpha(state.alpha);
    applied.delete(sprite);
    return;
  }
  const current = state ?? { alpha: sprite.alpha, lastGhostAt: now, lastX: sprite.x, lastY: sprite.y };
  if (!state) applied.set(sprite, current);
  const definite = look as SpriteLook;

  if (definite.tint) {
    if (definite.tintFill) sprite.setTint(hexToInt(definite.tint)).setTintMode(TINT_MODE_FILL);
    else sprite.setTint(hexToInt(definite.tint));
  } else sprite.clearTint();
  sprite.setFlipX(definite.flip === true);
  const pose = definite.pose ? POSE_ORIGIN[definite.pose] : { x: 0.5, y: 1, angle: 0 };
  const fallen = definite.pose === "fallen" || definite.pose === "fallenLeft";
  let originY = fallen ? pose.y : baseOrigin.y;
  if (definite.pose === "float") {
    // 위로 3~7px 오르내림. 원점으로 올리므로 걷기 트윈의 y 와 다투지 않는다.
    const height = Math.max(1, sprite.height);
    const lift = (5 + 2 * Math.sin(now / 420)) * runtimeMapWorldScale(scene) / Math.max(0.0001, sprite.scaleY || 1);
    originY = baseOrigin.y + lift / height;
  }
  sprite.setOrigin(fallen ? pose.x : baseOrigin.x, originY);
  sprite.setAngle(pose.angle + (definite.angle ?? 0));
  sprite.setScale(sprite.scaleX, definite.pose === "crouch" ? sprite.scaleX * 0.75 : sprite.scaleX);
  sprite.setAlpha(definite.alpha ?? current.alpha);

  if (definite.afterimage) spawnAfterimage(scene, sprite, current, now);
}

/** 잔상 — 움직였을 때만 50ms 마다 한 장. 서 있을 때 잔상이 겹겹이 쌓이면 그냥 진한 그림자다. */
function spawnAfterimage(scene: PlaySceneContext, sprite: Phaser.GameObjects.Sprite, state: AppliedLook, now: number): void {
  const moved = Math.abs(sprite.x - state.lastX) + Math.abs(sprite.y - state.lastY);
  if (moved < 0.5 || now - state.lastGhostAt < 50) return;
  state.lastGhostAt = now;
  state.lastX = sprite.x;
  state.lastY = sprite.y;
  const ghost = scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name);
  ghost.setOrigin(sprite.originX, sprite.originY);
  ghost.setScale(sprite.scaleX, sprite.scaleY);
  ghost.setAngle(sprite.angle);
  ghost.setFlipX(sprite.flipX);
  ghost.setTint(0x9ec8ff).setTintMode(TINT_MODE_FILL);
  ghost.setAlpha(0.45);
  ghost.setDepth(sprite.depth - 1);
  scene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
}

// ── 레터박스 ────────────────────────────────────────────────────────

const letterboxShown = new WeakMap<HTMLElement, number>();

function letterboxBar(host: HTMLElement, edge: "top" | "bottom"): HTMLElement {
  const testid = `runtime-letterbox-${edge}`;
  const existing = host.querySelector<HTMLElement>(`[data-testid='${testid}']`);
  if (existing) return existing;
  const bar = document.createElement("div");
  bar.className = `runtime-letterbox runtime-letterbox-${edge}`;
  bar.dataset.testid = testid;
  bar.setAttribute("aria-hidden", "true");
  Object.assign(bar.style, {
    position: "absolute",
    left: "0",
    right: "0",
    [edge]: "0",
    height: "0",
    background: "#000",
    pointerEvents: "none",
    zIndex: String(LETTERBOX_Z_INDEX),
    transitionProperty: "height",
    transitionTimingFunction: "ease-in-out",
  });
  host.append(bar);
  return bar;
}

/**
 * 대사창이 레터박스 띠 안쪽(보이는 그림 위)에 서도록 띠의 논리 px 높이를 무대에 알린다.
 * CSS(playSurface.css 「레터박스 안쪽」)가 `--runtime-letterbox-px` 에서 크롭 여백을 뺀 만큼만 창을 띠 밖으로 민다.
 * 무대 크기가 바뀌어도 맞도록 퍼센트가 같아도 높이를 다시 잰다(값이 같으면 쓰지 않는다).
 */
function syncLetterboxInset(host: HTMLElement, percent: number): void {
  if (percent <= 0) {
    if (host.dataset.letterbox === undefined) return;
    delete host.dataset.letterbox;
    host.style.setProperty("--runtime-letterbox-px", "0px");
    return;
  }
  const px = `${Math.round((host.clientHeight * percent) / 100)}px`;
  if (host.dataset.letterbox === String(percent) && host.style.getPropertyValue("--runtime-letterbox-px") === px) return;
  host.dataset.letterbox = String(percent);
  host.style.setProperty("--runtime-letterbox-px", px);
}

function syncLetterbox(scene: PlaySceneContext): void {
  const screen = scene.session.m2Runtime?.screen;
  const percent = normalizeLetterboxPercent(screen?.letterbox);
  const host = screenOverlayHost(scene);
  if (!host) return;
  syncLetterboxInset(host, percent);
  if (letterboxShown.get(host) === percent) return;
  if (percent === 0 && !host.querySelector("[data-testid='runtime-letterbox-top']")) {
    letterboxShown.set(host, 0);
    return;
  }
  // 처음 보는 상태(새 게임·불러오기)는 전환 없이 그 상태로 선다.
  const first = !letterboxShown.has(host);
  const durationMs = first ? 0 : Math.max(0, screen?.letterboxDurationMs ?? 0);
  letterboxShown.set(host, percent);
  for (const edge of ["top", "bottom"] as const) {
    const bar = letterboxBar(host, edge);
    bar.style.transitionDuration = `${durationMs}ms`;
    bar.style.height = `${percent}%`;
    bar.dataset.percent = String(percent);
  }
}

// ── 매 프레임 ───────────────────────────────────────────────────────

export function updateFieldStaging(scene: PlaySceneContext): void {
  const now = scene.time?.now ?? 0;
  for (const [sprite, look] of lookTargets(scene)) applyLook(scene, sprite, look, now);
  syncLetterbox(scene);
  syncDoors(scene);
  syncFreezeFrame(scene);
  syncNearSparkles(scene, now);
  syncEventGlows(scene, now);
  syncLiftRide(scene);
}

// ── 늘 빛나는 표지(page.glow) ────────────────────────────────────────────

const GLOW_TEX = { halo: "oprn-fx-glow-halo", ring: "oprn-fx-glow-ring" } as const;
const GLOW_HALO_DEPTH = 150_000;
const DEFAULT_GLOW_COLOR = 0x8fd8ff;

type GlowParts = {
  readonly halo: Phaser.GameObjects.Image;
  readonly core: Phaser.GameObjects.Image;
  readonly twinkles: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly motes: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly ring: Phaser.GameObjects.Image;
  readonly radiusPx: number;
  readonly phase: number;
  x: number;
  y: number;
};
type GlowState = { mapId: string; ids: readonly string[]; parts: Map<string, GlowParts>; nextCheck: number };
const glowStates = new WeakMap<PlaySceneContext, GlowState>();

function ensureGlowTextures(scene: PlaySceneContext): void {
  canvasTexture(scene, GLOW_TEX.halo, 64, (ctx, size) => softCircle(ctx, size, 0.05));
  canvasTexture(scene, GLOW_TEX.ring, 64, (ctx, size) => {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function destroyGlow(parts: GlowParts): void {
  parts.halo.destroy();
  parts.core.destroy();
  parts.ring.destroy();
  parts.twinkles.destroy();
  parts.motes.destroy();
}

function glowColor(hex: string | undefined): number {
  return typeof hex === "string" && /^#[0-9a-f]{6}$/i.test(hex) ? Number.parseInt(hex.slice(1), 16) : DEFAULT_GLOW_COLOR;
}

/** 세이브 포인트처럼 page.glow 가 있는 이벤트 — 거리와 무관하게 늘 숨 쉬는 빛무리·반짝임·오르는 빛 알갱이·퍼지는 고리. */
function syncEventGlows(scene: PlaySceneContext, now: number): void {
  const map = scene.map;
  if (!map || !scene.session || !scene.add) return;
  let state = glowStates.get(scene);
  if (!state || state.mapId !== map.id) {
    for (const parts of state?.parts.values() ?? []) destroyGlow(parts);
    state = { mapId: map.id, ids: map.events.filter((event) => event.pages?.some((page) => page.glow)).map((event) => event.id), parts: new Map(), nextCheck: 0 };
    glowStates.set(scene, state);
  }
  if (state.ids.length === 0) return;
  if (now >= state.nextCheck) {
    state.nextCheck = now + 300;
    const project = store.getCurrent();
    const size = mapTileSize(map);
    const s = runtimeMapWorldScale(scene);
    for (const id of state.ids) {
      const view = runtimeEventViewById(project, map, scene.session, scene.eventPositions, id);
      const glow = view?.page?.glow;
      const existing = state.parts.get(id);
      if (!view || !glow) {
        if (existing) { destroyGlow(existing); state.parts.delete(id); }
        continue;
      }
      const x = (view.x + 0.5 + (glow.offsetX ?? 0)) * size;
      const y = (view.y + 0.35 + (glow.offsetY ?? 0)) * size;
      if (existing) { existing.x = x; existing.y = y; continue; }
      ensureFxTextures(scene);
      ensureGlowTextures(scene);
      const color = glowColor(glow.color);
      const radiusPx = Math.max(1, Math.min(3, glow.radius ?? 2)) * size;
      const halo = scene.add.image(x, y, GLOW_TEX.halo).setBlendMode("ADD").setTint(color).setDepth(GLOW_HALO_DEPTH);
      const core = scene.add.image(x, y, GLOW_TEX.halo).setBlendMode("ADD").setTint(0xffffff).setDepth(GLOW_HALO_DEPTH + 1);
      const ring = scene.add.image(x, y, GLOW_TEX.ring).setBlendMode("ADD").setTint(color).setDepth(GLOW_HALO_DEPTH + 2);
      const twinkles = scene.add.particles(x, y, TEX.star, {
        x: { min: -radiusPx * 0.75, max: radiusPx * 0.75 }, y: { min: -radiusPx * 0.9, max: radiusPx * 0.35 },
        lifespan: 650, frequency: 170, quantity: 1, speed: 0,
        scale: { start: 1.2 * s, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xffffff, color, 0xfff6c0], blendMode: "ADD",
      });
      twinkles.setDepth(PARTICLE_DEPTH);
      const motes = scene.add.particles(x, y, TEX.dot, {
        x: { min: -size * 0.55, max: size * 0.55 }, y: { min: -size * 0.1, max: size * 0.3 },
        speedX: { min: -3 * s, max: 3 * s }, speedY: { min: -30 * s, max: -16 * s },
        lifespan: 1500, frequency: 110, quantity: 1,
        scale: { start: 0.8 * s, end: 0.1 * s }, alpha: { start: 0.95, end: 0 },
        tint: [color, 0xffffff], blendMode: "ADD",
      });
      motes.setDepth(PARTICLE_DEPTH);
      state.parts.set(id, { halo, core, ring, twinkles, motes, radiusPx, phase: (state.parts.size * 0.37) % 1, x, y });
    }
  }
  // 숨 쉬는 빛: 1.8초 주기로 빛무리가 커졌다 작아지고, 2.4초마다 고리가 퍼진다.
  // 더하기(ADD) 섞기라 밝은 돌바닥 위에서는 흰 덩이로 번져 바닥·석판 형태를 지웠다(2026-10-28 지하묘지 쉼터 결정, 적대 VQA).
  // 빛무리·흰 심지·고리를 예전의 절반 남짓으로 낮춰 표지로만 읽히게 한다.
  for (const parts of state.parts.values()) {
    const breath = 0.5 + 0.5 * Math.sin((now / 1800 + parts.phase) * Math.PI * 2);
    const haloSize = parts.radiusPx * 2 * (0.85 + 0.25 * breath);
    parts.halo.setPosition(parts.x, parts.y).setDisplaySize(haloSize, haloSize * 0.8).setAlpha(0.18 + 0.2 * breath);
    const coreSize = parts.radiusPx * (0.55 + 0.2 * (1 - breath));
    parts.core.setPosition(parts.x, parts.y).setDisplaySize(coreSize, coreSize).setAlpha(0.1 + 0.15 * breath);
    const ringT = ((now / 2400 + parts.phase) % 1);
    const ringSize = parts.radiusPx * (0.4 + 1.9 * ringT);
    parts.ring.setPosition(parts.x, parts.y + parts.radiusPx * 0.2).setDisplaySize(ringSize, ringSize * 0.5).setAlpha(0.45 * (1 - ringT));
    parts.twinkles.setPosition(parts.x, parts.y);
    parts.motes.setPosition(parts.x, parts.y);
  }
}

/** QA: 지금 빛나는 표지 수. */
export function eventGlowCount(scene: PlaySceneContext): number {
  return glowStates.get(scene)?.parts.size ?? 0;
}

// ── 가까이 오면 반짝임(page.nearSparkle) ────────────────────────────────

type NearSparkleState = { mapId: string; ids: readonly string[]; inside: Set<string>; nextCheck: number };
const nearSparkleStates = new WeakMap<PlaySceneContext, NearSparkleState>();

/** 세이브 포인트처럼 page.nearSparkle 이 있는 이벤트 — 플레이어가 반경 안으로 들어오는 순간 그 칸에 반짝임 한 번. */
function syncNearSparkles(scene: PlaySceneContext, now: number): void {
  const map = scene.map;
  if (!map || !scene.session) return;
  let state = nearSparkleStates.get(scene);
  if (!state || state.mapId !== map.id) {
    state = { mapId: map.id, ids: map.events.filter((event) => event.pages?.some((page) => page.nearSparkle)).map((event) => event.id), inside: new Set(), nextCheck: 0 };
    nearSparkleStates.set(scene, state);
  }
  if (state.ids.length === 0 || now < state.nextCheck) return;
  state.nextCheck = now + 150;
  const project = store.getCurrent();
  for (const id of state.ids) {
    const view = runtimeEventViewById(project, map, scene.session, scene.eventPositions, id);
    const near = view?.page?.nearSparkle;
    if (!view || !near) { state.inside.delete(id); continue; }
    const distance = Math.max(Math.abs(view.x - scene.tileX), Math.abs(view.y - scene.tileY));
    if (distance > near.radius) { state.inside.delete(id); continue; }
    if (state.inside.has(id)) continue;
    state.inside.add(id);
    // 표지 반짝임은 그 칸의 사물과 같은 줄 깊이에 둔다 — 맨 위(PARTICLE_DEPTH)에 두면 바로 아래 칸에 선 주인공의 얼굴을 덮었다
    // (2026-10-29 VQA mt3 argon·flash: 책상 표지 반짝이가 주인공 머리 위로 쏟아져 「얼굴이 가려진다·어디가 대상인지 모른다」). 앞 줄 사람은 반짝이를 가린다.
    const markerDepth = characterDepth("same", characterSpriteY(view.y, mapTileSize(map))) + 0.5;
    void playParticleEffect(scene, { kind: "particleEffect", preset: near.preset ?? "sparkle", target: { kind: "tile", x: view.x, y: view.y }, durationMs: 900, wait: false }, undefined, markerDepth);
  }
}

/** 테스트·QA 가 파티클 그림 없이 레시피를 대조할 수 있게 내보낸다. */
export function particleRecipeFor(preset: ParticlePreset): { readonly burst: boolean; readonly count: number; readonly texture: string } {
  const recipe = RECIPES[preset];
  return { burst: recipe.burst, count: recipe.count, texture: recipe.texture };
}
