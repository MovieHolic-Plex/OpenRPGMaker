import { syncLiftRide } from "@/player/playSceneLiftRide";
import { characterBaseOrigin } from "./characterOrigin";
// 타입만 가져온다. 값 import 는 phaser.esm.js 를 끌어와 모듈 평가 때 `window` 를 읽는다 —
// 노드 vitest 에서 이 파일을 거치는 테스트 약 200개가 「window is not defined」로 수집조차 안 됐다(ci-full 40165485978).
// 런타임에는 phaserRuntime 이 window.Phaser 를 꽂으므로 값은 전역 이름공간으로 읽는다(playSceneActionCombat 과 같다).
import type Phaser from "phaser";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import type { StepResult } from "@/player/interpreter/types";
import { characterDepth, characterSpriteY, MAP_UPPER_LAYER_DEPTH } from "@/player/characterDepth";
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
import { runtimeEventViewById, runtimeEventViewsForMap } from "@/project/runtimeEventState";
import { objectiveTargetViews } from "@/player/objectiveTarget";
import { routeDetours, routeField, routeWaypoint } from "@/player/objectiveRoute";
import { currentObjectiveText } from "@/player/zoneFeedback";
import { spentPage, storyPerson, STORY_PERSON_RADIUS } from "@/player/examineTargets";

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
  syncObjectiveMarkers(scene, now);
  syncExamineMarkers(scene, now);
  syncExitLabels(scene, now);
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

// ── 현재 목표의 다음 대상(목표 글이 가리키는 이벤트) — 거리와 무관하게 은은한 표시 ─────────────────
// 2026-10-29 VM 측정 판 5개(deepseek·terra escape, terra·flash·deepseek mystery) 판정자가 모두 「조사 위치가 눈에 안 띈다」:
// 조사 이벤트는 대개 투명이고 가까이 반짝임은 2칸 안에서 한 번뿐이다. 목표 글의 대상(objectiveTargetViews)에 숨 쉬는 금빛 빛무리와
// 바닥 고리를 늘 둔다 — 늘 빛나는 표지(page.glow)보다 옅게. 깊이는 그 칸 사물 줄(앞 줄 사람이 가린다, 주인공 얼굴을 덮지 않는다).

type ObjectiveMarkerParts = { readonly halo: Phaser.GameObjects.Image; readonly ring: Phaser.GameObjects.Image; readonly radiusPx: number; x: number; y: number };
type ObjectiveMarkerState = {
  mapId: string; text: string | null; parts: Map<string, ObjectiveMarkerParts>; nextCheck: number;
  /** 대상 칸 중심(월드 좌표) — 화면 밖이면 가장자리 화살표가 가리킨다. 늘 빛나는 표지가 붙은 대상도 포함. */
  points: { x: number; y: number }[];
  /** 대상 칸(points 와 같은 순서)과 그 칸들까지의 걸음 수 지도(objectiveRoute) — 화살표가 걸어갈 길을 따라 가리킨다. */
  tiles: { x: number; y: number }[];
  route: { key: string; field: Int32Array } | null;
  arrow: Phaser.GameObjects.Image | null;
};
const objectiveMarkerStates = new WeakMap<PlaySceneContext, ObjectiveMarkerState>();
const OBJECTIVE_MARKER_COLOR = 0xffe08a;

function destroyObjectiveMarker(parts: ObjectiveMarkerParts): void {
  parts.halo.destroy();
  parts.ring.destroy();
}

function syncObjectiveMarkers(scene: PlaySceneContext, now: number): void {
  const map = scene.map;
  if (!map || !scene.session || !scene.add) return;
  let state = objectiveMarkerStates.get(scene);
  if (!state || state.mapId !== map.id) {
    for (const parts of state?.parts.values() ?? []) destroyObjectiveMarker(parts);
    state?.arrow?.destroy();
    state = { mapId: map.id, text: null, parts: new Map(), nextCheck: 0, points: [], tiles: [], route: null, arrow: null };
    objectiveMarkerStates.set(scene, state);
  }
  if (now >= state.nextCheck) {
    state.nextCheck = now + 400;
    const project = store.getCurrent();
    const text = currentObjectiveText(scene.session.m2Runtime?.ui);
    state.text = text;
    const views = text ? runtimeEventViewsForMap(project, map, scene.session, scene.eventPositions) : [];
    const all = objectiveTargetViews(project, map, views, text);
    const size0 = mapTileSize(map);
    state.points = all.map((view) => ({ x: (view.x + 0.5) * size0, y: (view.y + 0.5) * size0 }));
    state.tiles = all.map((view) => ({ x: view.x, y: view.y }));
    const routeKey = state.tiles.map((t) => `${t.x},${t.y}`).join(";");
    if (!routeKey) state.route = null;
    else if (state.route?.key !== routeKey) {
      try { state.route = { key: routeKey, field: routeField(project, map, state.tiles) }; } catch { state.route = null; }
    }
    // 늘 빛나는 표지가 이미 있는 대상은 겹쳐 그리지 않는다.
    const targets = all.filter((view) => !view.page?.glow);
    const keep = new Set(targets.map((view) => view.event.id));
    for (const [id, parts] of state.parts) if (!keep.has(id)) { destroyObjectiveMarker(parts); state.parts.delete(id); }
    const size = mapTileSize(map);
    for (const view of targets) {
      const x = (view.x + 0.5) * size;
      const y = (view.y + 0.55) * size;
      const depth = characterDepth("same", characterSpriteY(view.y, size)) + 0.4;
      const existing = state.parts.get(view.event.id);
      if (existing) { existing.x = x; existing.y = y; existing.halo.setDepth(depth); existing.ring.setDepth(depth); continue; }
      ensureGlowTextures(scene);
      const radiusPx = size * 0.9;
      const halo = scene.add.image(x, y, GLOW_TEX.halo).setBlendMode("ADD").setTint(OBJECTIVE_MARKER_COLOR).setDepth(depth);
      const ring = scene.add.image(x, y, GLOW_TEX.ring).setBlendMode("ADD").setTint(OBJECTIVE_MARKER_COLOR).setDepth(depth);
      state.parts.set(view.event.id, { halo, ring, radiusPx, x, y });
    }
  }
  // 2.2초 숨: 빛무리(0.3~0.55)와 바닥 고리(칸 안에서 한 번 퍼졌다 사라짐). 밝은 나무 바닥에서도 읽히는 세기 — 첫 판(0.16~0.34)은
  // 여관 바닥에서 거의 안 보였다(2026-10-29 terra mystery 1배 화면). 늘 빛나는 표지(page.glow: 알갱이·별 반짝임)보다는 조용하다.
  for (const parts of state.parts.values()) {
    const breath = 0.5 + 0.5 * Math.sin((now / 2200) * Math.PI * 2);
    const haloSize = parts.radiusPx * 2 * (0.95 + 0.15 * breath);
    parts.halo.setPosition(parts.x, parts.y - parts.radiusPx * 0.3).setDisplaySize(haloSize, haloSize * 0.9).setAlpha(0.3 + 0.25 * breath);
    const ringT = (now / 2200) % 1;
    const ringSize = parts.radiusPx * (0.5 + 1.2 * ringT);
    parts.ring.setPosition(parts.x, parts.y).setDisplaySize(ringSize, ringSize * 0.5).setAlpha(0.9 * (1 - ringT));
  }
  syncObjectiveArrow(scene, state, now);
}

// 대상이 화면 밖이면 주인공 곁에 그쪽을 가리키는 작은 금빛 화살표 하나(가장 가까운 대상).
// 왜(2026-10-29 vm2 terra jrpg): 동굴 문은 시작 자리에서 26칸 남쪽이라 첫 화면에 없었고, 목표 꼬리 방위만으로는 맵 끝에서 헤맸다.
// 표시는 화면 안 대상의 빛무리와 같은 색이고, 대상이 화면에 들어오면 사라진다.
const OBJECTIVE_ARROW_TEX = "oprn-fx-objective-arrow-v3";
function syncObjectiveArrow(scene: PlaySceneContext, state: ObjectiveMarkerState, now: number): void {
  const camera = scene.cameras?.main;
  const map = scene.map;
  if (!camera || !map) return;
  const view = camera.worldView;
  const size = mapTileSize(map);
  const margin = size * 0.9;
  const px = scene.player?.x ?? view.centerX, py = scene.player?.y ?? view.centerY;
  const inside = (p: { x: number; y: number }) => p.x >= view.x && p.x <= view.right && p.y >= view.y && p.y <= view.bottom;
  // 걸어갈 길(objectiveRoute): 주인공 칸에서 대상까지 걸음 수가 줄어드는 쪽 몇 칸 앞을 가리킨다. 길이 직선보다 크게 돌아가면
  // 대상이 화면 안에 보여도 화살표를 띄운다 — 보이는 쪽으로 곧장 가면 막다른 벽이다(2026-10-29 vm4 terra jrpg 동굴).
  const here = { x: scene.tileX ?? Math.floor(px / size), y: scene.tileY ?? Math.floor(py / size) };
  const way = state.route ? routeWaypoint(state.route.field, map, here) : undefined;
  const nearestTile = way ? state.tiles.reduce<{ x: number; y: number } | undefined>((best, t) =>
    !best || Math.abs(t.x - here.x) + Math.abs(t.y - here.y) < Math.abs(best.x - here.x) + Math.abs(best.y - here.y) ? t : best, undefined) : undefined;
  const detour = Boolean(way && nearestTile && way.steps > 1 && routeDetours(way.steps, here, nearestTile));
  const target = state.points.some(inside) && !detour ? undefined
    : way && way.steps > 0 ? { x: (way.cell.x + 0.5) * size, y: (way.cell.y + 0.5) * size }
    : [...state.points].sort((a, b) => Math.hypot(a.x - px, a.y - py) - Math.hypot(b.x - px, b.y - py))[0];
  if (!target || view.width <= margin * 2 || view.height <= margin * 2) { state.arrow?.setVisible(false); return; }
  if (!state.arrow) {
    // ▼ 조사 표식과 같은 처리 — 굵은 진한 테두리 + 진한 금빛 속. 금빛은 텍스처에 직접 칠한다(캔버스 렌더러는 setTint 를 무시해 흰 화살표로 보였다). 가는 테두리·옅은 금빛은 석순·밝은 바닥에 묻혔다(2026-10-29 vm4 terra 동굴 확대).
    canvasTexture(scene, OBJECTIVE_ARROW_TEX, 32, (ctx, s) => {
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(s - 4, s / 2);
      ctx.lineTo(6, 5);
      ctx.lineTo(12, s / 2);
      ctx.lineTo(6, s - 5);
      ctx.closePath();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(34,20,0,0.95)";
      ctx.stroke();
      ctx.fillStyle = "#ffd23a";
      ctx.fill();
    });
    state.arrow = scene.add.image(0, 0, OBJECTIVE_ARROW_TEX)
      // 높이 지형(relief, ~200k)·상층 ★(250k) 위 — 안내 표시라 수관·들린 땅에 가리면 안 된다(flash jrpg: relief 맵에서 화살표가 땅 밑에 묻혔다).
      .setDepth(MAP_UPPER_LAYER_DEPTH + 1000);
  }
  // 주인공 둘레 1.7칸에 대상 쪽을 가리켜 둔다 — 화면 가장자리에 두면 오른쪽 위 「현재 목표」 칩이 위쪽 화살표를 덮었다
  // (2026-10-29 flash jrpg: 숲 문은 북북동, 가장자리 자리가 칩 밑). 주인공 곁이면 HUD 와 겹치지 않고 눈이 가는 자리다.
  const dx = target.x - px, dy = target.y - py;
  const breath = 0.5 + 0.5 * Math.sin((now / 1100) * Math.PI * 2);
  const angle = Math.atan2(dy, dx);
  const reach = size * (1.7 + 0.2 * breath);
  const ax = Math.min(view.right - margin / 2, Math.max(view.x + margin / 2, px + Math.cos(angle) * reach));
  const ay = Math.min(view.bottom - margin / 2, Math.max(view.y + margin / 2, py - size * 0.4 + Math.sin(angle) * reach));
  state.arrow
    .setVisible(true)
    .setPosition(ax, ay)
    .setRotation(angle)
    .setDisplaySize(size * 0.95, size * 0.95)
    .setAlpha(0.92 + 0.08 * breath);
}

/** QA: 목표 화살표가 떠 있나(대상이 화면 밖). */
export function objectiveArrowVisible(scene: PlaySceneContext): boolean {
  return objectiveMarkerStates.get(scene)?.arrow?.visible === true;
}

/** QA: 지금 목표 표시가 붙은 이벤트 id. */
export function objectiveMarkerIds(scene: PlaySceneContext): string[] {
  return [...(objectiveMarkerStates.get(scene)?.parts.keys() ?? [])];
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

// ── 조사 표식(진한 테두리 금빛 꺾쇠) ─────────────────────────────────────────
// 2026-10-29 vm3 terra escape 판정 «하이라이트가 흐려 어디를 조사할지 찾기 어렵다», terra jrpg «조사 가능한 물체와 아닌 물체가 구분 안 됨»:
// 가까이 반짝임은 2칸 안에 들어설 때 한 번(0.9초)이고, 목표 빛무리·반짝임은 더하기(ADD) 섞기라 밝은 바닥·가구 위에서 흰 번짐으로 사라졌다.
// 조사 대상(가까이 반짝임이 있는 이벤트가 반경 안일 때 + 지금 목표 대상)의 몸 사각 위쪽에 진한 테두리 금빛 꺾쇠를 보통 섞기로 띄운다 —
// 어느 바닥에서도 테두리가 대비를 만든다. 몸 사각(가구 전체) 가운데 위라 주인공 얼굴을 덮지 않는다. 조사가 끝나 표식 페이지가 없어지면 사라진다.

// 금빛은 텍스처에 직접 칠한다 — 캔버스 렌더러는 setTint 를 무시해 흰 표식으로 보였다.
const EXAMINE_MARKER_TEX = "oprn-fx-examine-marker-v2";
type ExamineMarkerState = { mapId: string; markers: Map<string, Phaser.GameObjects.Image>; nextCheck: number; want: Map<string, { x: number; y: number; person: boolean }> };
const examineMarkerStates = new WeakMap<PlaySceneContext, ExamineMarkerState>();

function syncExamineMarkers(scene: PlaySceneContext, now: number): void {
  const map = scene.map;
  if (!map || !scene.session || !scene.add) return;
  let state = examineMarkerStates.get(scene);
  if (!state || state.mapId !== map.id) {
    for (const m of state?.markers.values() ?? []) m.destroy();
    state = { mapId: map.id, markers: new Map(), nextCheck: 0, want: new Map() };
    examineMarkerStates.set(scene, state);
  }
  const size = mapTileSize(map);
  if (now >= state.nextCheck) {
    state.nextCheck = now + 200;
    const project = store.getCurrent();
    const objective = new Set(objectiveMarkerStates.get(scene)?.parts.keys() ?? []);
    const want = new Map<string, { x: number; y: number; person: boolean }>();
    for (const view of runtimeEventViewsForMap(project, map, scene.session, scene.eventPositions)) {
      // 다 본 대상(「더는 볼 것이 없다」 페이지)은 띄우지 않는다 — 목표가 가리켜도.
      if (spentPage(view.event, view.page)) continue;
      const near = view.page?.nearSparkle;
      // 이야기에 필요한 사람(상태를 바꾸는 페이지가 있는 NPC)은 반짝임이 없어도 같은 규칙(가까이 가면)으로 띄운다.
      const radius = near ? Math.max(1, near.radius) : storyPerson(view.event) ? STORY_PERSON_RADIUS : -1;
      const rect = view.bodyRect;
      const dx = Math.max(rect.left - scene.tileX, 0, scene.tileX - rect.right);
      const dy = Math.max(rect.top - scene.tileY, 0, scene.tileY - rect.bottom);
      const inRadius = radius >= 0 && Math.max(dx, dy) <= radius;
      if (!inRadius && !objective.has(view.event.id)) continue;
      // 늘 빛나는 표지(세이브 포인트)는 따로 보인다.
      if (view.page?.glow) continue;
      // 주인공이 바로 위 칸에 서 있으면 표식이 발을 덮는다 — 그때는 화면 아래 「Z 조사 · 이름」 안내가 대신한다.
      if (scene.tileY === rect.top - 1 && scene.tileX >= rect.left && scene.tileX <= rect.right) continue;
      want.set(view.event.id, { x: ((rect.left + rect.right + 1) / 2) * size, y: rect.top * size, person: !!view.sprite });
    }
    state.want = want;
    for (const [id, m] of state.markers) if (!want.has(id)) { m.destroy(); state.markers.delete(id); }
    for (const id of want.keys()) {
      if (state.markers.has(id)) continue;
      canvasTexture(scene, EXAMINE_MARKER_TEX, 32, (ctx, s) => {
        // 아래를 가리키는 꺾쇠(▼) — 금빛 채움 + 진한 갈색 테두리.
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(4, 7);
        ctx.lineTo(s - 4, 7);
        ctx.lineTo(s / 2, s - 6);
        ctx.closePath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(34,20,0,0.95)";
        ctx.stroke();
        ctx.fillStyle = "#ffd23a";
        ctx.fill();
      });
      state.markers.set(id, scene.add.image(0, 0, EXAMINE_MARKER_TEX).setDepth(MAP_UPPER_LAYER_DEPTH + 900));
    }
  }
  const bob = Math.sin((now / 520) * Math.PI);
  for (const [id, marker] of state.markers) {
    const at = state.want.get(id);
    if (!at) continue;
    // 걷는 NPC 는 논리 칸이 걸음 시작에 도착 칸으로 넘어간다 — 표식은 그림을 따라 보간한다.
    const move = scene.autonomousNPCs?.get(id)?.activeMove;
    const mover = scene.autonomousNPCs?.get(id);
    const t = move && mover ? Math.min(1, move.elapsedMs / Math.max(1, move.durationMs ?? mover.moveDurationMs)) : 1;
    const ox = move ? (move.fromX - move.toX) * (1 - t) * size : 0;
    const oy = move ? (move.fromY - move.toY) * (1 - t) * size : 0;
    // 가구는 몸 사각 맨 윗줄 안쪽 — 위로 띄우면 북벽에 붙은 책장 표식이 방 밖 천장 위에 떴다.
    // 사람은 머리 위 — 캐릭터 그림이 칸 위로 반 칸쯤 솟아 칸 안에 두면 얼굴을 덮는다.
    const lift = at.person ? -size * 0.75 : size * 0.22;
    marker.setPosition(at.x + ox, at.y + oy + lift + bob * size * 0.08).setDisplaySize(size * 0.62, size * 0.62).setAlpha(0.92);
  }
}

// ── 출입 칸 목적지 이름 ───────────────────────────────────────────────────
// 2026-10-29 vm3 deepseek 탈출 판정(major): 「방 이동은 바닥의 희미한 빛 위를 걷는 방식이라 출입구인지 알기 어렵다, 어느 빛이 어느 방으로
// 가는지 표시 없음」 — 홀 남쪽 바닥에 응접실·서재·지하실로 가는 투명 접촉 칸 셋이 나란히 있었다.
// 다른 맵으로 옮기는(transfer) 이벤트의 지금 페이지 위에, 주인공이 EXIT_LABEL_RADIUS 칸 안에 오면 「→ 목적지 이름」 도트 글자를 띄운다.
const EXIT_LABEL_RADIUS = 3;
const EXIT_LABEL_FONT = '"Galmuri11 Regular", "Galmuri9", monospace';
const EXIT_LABEL_PX = 12;
type ExitLabelState = { mapId: string; labels: Map<string, Phaser.GameObjects.Text>; nextCheck: number };
const exitLabelStates = new WeakMap<PlaySceneContext, ExitLabelState>();

/** 이 페이지가 맨 윗줄에서 다른 맵으로 옮기면 그 맵 id. */
function exitTargetOf(page: { commands?: readonly unknown[] } | undefined, here: string): string | undefined {
  for (const c of page?.commands ?? []) {
    const r = c as { kind?: string; mapId?: unknown };
    if (r.kind === "transfer" && typeof r.mapId === "string" && r.mapId !== here) return r.mapId;
  }
  return undefined;
}

function syncExitLabels(scene: PlaySceneContext, now: number): void {
  const map = scene.map;
  if (!map || !scene.session || !scene.add) return;
  let state = exitLabelStates.get(scene);
  if (!state || state.mapId !== map.id) {
    for (const t of state?.labels.values() ?? []) t.destroy();
    state = { mapId: map.id, labels: new Map(), nextCheck: 0 };
    exitLabelStates.set(scene, state);
  }
  // 이벤트(대사·나레이션·컷신)가 도는 동안은 숨긴다 — 바닥 근처에 뜬 「→ 사쿠라자카 상점가」가 나레이션이 가리키는 분리수거함을 덮었다
  // (마왕 편의점 처음 하는 사람 검수 2026-10-29). 다 끝나면 다음 검사(200ms) 안에 다시 그린다.
  const hidden = scene.running === true;
  for (const t of state.labels.values()) if (t.visible === hidden) t.setVisible(!hidden);
  if (hidden) return;
  if (now < state.nextCheck) return;
  state.nextCheck = now + 200;
  const project = store.getCurrent();
  const size = mapTileSize(map);
  const zoom = Math.max(1, Math.round(scene.cameras?.main?.zoom || 1));
  const want = new Map<string, { text: string; x: number; y: number }>();
  for (const view of runtimeEventViewsForMap(project, map, scene.session, scene.eventPositions)) {
    const target = exitTargetOf(view.page as { commands?: readonly unknown[] } | undefined, map.id);
    const dest = target ? project.maps[target] : undefined;
    const name = String((dest as { displayName?: string } | undefined)?.displayName || dest?.name || "").trim();
    if (!name) continue;
    const rect = view.bodyRect;
    const dx = Math.max(rect.left - scene.tileX, 0, scene.tileX - rect.right);
    const dy = Math.max(rect.top - scene.tileY, 0, scene.tileY - rect.bottom);
    if (Math.max(dx, dy) > EXIT_LABEL_RADIUS || (dx === 0 && dy === 0)) continue;
    want.set(view.event.id, { text: `→ ${name}`, x: ((rect.left + rect.right + 1) / 2) * size, y: rect.top * size - 2 });
  }
  for (const [id, t] of state.labels) if (!want.has(id)) { t.destroy(); state.labels.delete(id); }
  for (const [id, at] of want) {
    let label = state.labels.get(id);
    if (!label) {
      // 글자 텍스처는 카메라 배율과 같은 해상도, 정수 좌표 — 떠오르는 「+ 이름」 글자(playSceneFieldFx.playLootPopup)와 같은 규칙.
      label = scene.add.text(0, 0, at.text, {
        fontFamily: EXIT_LABEL_FONT, fontSize: `${EXIT_LABEL_PX}px`, color: "#fff4c8",
        // 어두운 받침 — 홀의 의자·탁자 그림 위에서도 글자가 묻히지 않게(첫 캡처에서 「→ 서재」가 안락의자 무늬에 묻혔다).
        backgroundColor: "rgba(26,16,6,0.82)", padding: { x: 3, y: 1 },
      }).setResolution(zoom).setScale(1 / zoom).setOrigin(0, 1).setDepth(MAP_UPPER_LAYER_DEPTH + 901);
      state.labels.set(id, label);
    }
    // 가장자리 출구(2026-10-29 vm3 argon jrpg «마을 가장자리가 어디로도 이어지지 않아 보임»): 글자가 맵 밖으로 반쯤 나가 잘리지 않게 맵 안으로 민다.
    // 맨 윗줄 출구는 칸 위에 둘 자리가 없으니 칸 아래에 둔다.
    const mapW = map.width * size;
    label.x = Math.round(Math.max(1, Math.min(mapW - label.displayWidth - 1, at.x - label.displayWidth / 2)));
    label.y = Math.round(at.y - label.displayHeight < 0 ? at.y + size + 2 + label.displayHeight : at.y);
  }
}

/** QA: 지금 목적지 글자가 붙은 이동 이벤트 id. */
export function exitLabelIds(scene: PlaySceneContext): string[] {
  return [...(exitLabelStates.get(scene)?.labels.keys() ?? [])];
}

/** QA: 지금 조사 표식이 붙은 이벤트 id. */
export function examineMarkerIds(scene: PlaySceneContext): string[] {
  return [...(examineMarkerStates.get(scene)?.markers.keys() ?? [])];
}

/** 테스트·QA 가 파티클 그림 없이 레시피를 대조할 수 있게 내보낸다. */
export function particleRecipeFor(preset: ParticlePreset): { readonly burst: boolean; readonly count: number; readonly texture: string } {
  const recipe = RECIPES[preset];
  return { burst: recipe.burst, count: recipe.count, texture: recipe.texture };
}
