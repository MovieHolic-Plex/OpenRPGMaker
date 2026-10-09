import { characterBaseOrigin } from "./characterOrigin";
import type Phaser from "phaser";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { StepResult } from "@/player/interpreter/types";
import { characterSpriteY } from "@/player/characterDepth";
import { runtimeMapWorldScale } from "@/player/runtimeViewScale";
import { screenOverlayHost } from "@/player/playSceneScreenEffects";
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
export function playParticleEffect(scene: PlaySceneContext, step: ParticleStep, currentEventId?: string): Promise<void> {
  ensureFxTextures(scene);
  const recipe = RECIPES[step.preset];
  const scale = runtimeMapWorldScale(scene);
  const sprite = targetSprite(scene, step.target, currentEventId);
  const size = mapTileSize(scene.map);
  // 칸 대상은 칸 발밑 중앙(캐릭터 원점과 같은 기준)에 둔다.
  const x = sprite ? sprite.x : step.target.kind === "tile" ? (step.target.x + 0.5) * size : scene.player?.x ?? 0;
  const y = sprite ? sprite.y : step.target.kind === "tile" ? characterSpriteY(step.target.y, size) : scene.player?.y ?? 0;
  // 따라가는 이미터는 원점(0,0)에 만든다. startFollow 는 입자를 대상의 월드 좌표에 뿌리는데 이미터 위치도
  // 그리기 변환에 더해져, 대상 자리에 만들면 좌표가 두 번 더해져 화면 밖에 그려졌다(2026-10-02 실측).
  const emitter = scene.add.particles(sprite ? 0 : x, sprite ? 0 : y, recipe.texture, recipe.config(scale));
  emitter.setDepth(PARTICLE_DEPTH);
  if (sprite) emitter.startFollow(sprite);
  const longestLife = 1500;
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
    if (definite.tintFill) sprite.setTintFill(hexToInt(definite.tint));
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
  ghost.setTintFill(0x9ec8ff);
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

function syncLetterbox(scene: PlaySceneContext): void {
  const screen = scene.session.m2Runtime?.screen;
  const percent = normalizeLetterboxPercent(screen?.letterbox);
  const host = screenOverlayHost(scene);
  if (!host) return;
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
}

/** 테스트·QA 가 파티클 그림 없이 레시피를 대조할 수 있게 내보낸다. */
export function particleRecipeFor(preset: ParticlePreset): { readonly burst: boolean; readonly count: number; readonly texture: string } {
  const recipe = RECIPES[preset];
  return { burst: recipe.burst, count: recipe.count, texture: recipe.texture };
}
