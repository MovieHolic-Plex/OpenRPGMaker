// player/playSceneAmbientFlyers.ts
// movement.type "fly" — 새·나비 같은 장식이 칸에 묶이지 않고 하늘을 난다.
//
// 왜(2026-10-23, 아스트라 다우닝 시티 0.2초 프레임): 새가 사용자 지정 경로 「왼쪽 한 칸 · 오른쪽 한 칸」 이벤트였다.
// 칸 걸음이라 한 칸 폭을 오가며 제자리 날갯짓만 했고(갈매기는 연못 칸이 통행 불가라 아예 못 움직였다),
// 사용자는 「공중에 있다기보다 어딘가에 갇혀 있다」고 했다.
//
// 이 갱신기는 이벤트 스프라이트를 직접 움직인다(무버를 만들지 않는다):
//  - 픽셀 좌표로 난다. 진행 방향은 천천히 바뀌는 회전 속도로 꺾여 부드러운 호를 그린다. 맵 밖 두 칸까지 나갔다
//    돌아온다 — 화면 가장자리를 넘나든다. 날갯짓(패턴 0·1·2·1)과 활공(패턴 1 고정)을 번갈아 한다.
//  - 10~20초마다 가까운 칸 하나(땅이나 지붕·나무)에 내려앉아 몇 초 쉬고, 주인공이 가까이 오면 바로 날아오른다.
//  - 땅에 그림자를 따로 그린다(높을수록 작고 옅다). 칩 그림 아래에 붙은 그림자는 잘라 낸다 — 몸과 함께 떠오르면 안 된다.
//  - 날 때는 지붕·상층 위에(가장 위), 땅에 앉으면 사람과 같은 층, 지붕에 앉으면 지붕 위.
// 장식이라 저장하지 않고 세션 난수도 쓰지 않는다(이벤트 id 로 씨앗을 정한 자기 난수) — 게임 난수 흐름을 바꾸지 않는다.
import { charsetIdleFrameIndex, charsetWalkFrameIndex } from "@/player/charsetMotion";
import { characterSpriteX, characterSpriteY } from "@/player/characterDepth";
import { isPassable } from "@/project/collision";
import { isWaterTagged } from "@/project/vehicles";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { Dir } from "@/player/input";
import type { RuntimeEventView } from "@/project/runtimeEventState";
import type { GameMap } from "@/project/types";

type FlyerMode = "fly" | "approach" | "perch" | "takeoff";

type FlyerState = {
  x: number;
  y: number;
  h: number;
  heading: number;
  speed: number;
  turn: number;
  turnTarget: number;
  turnTimer: number;
  mode: FlyerMode;
  modeTimer: number;
  nextLandMs: number;
  flapTimer: number;
  flapping: boolean;
  flapPhaseMs: number;
  cruise: number;
  bobMs: number;
  dir: Dir;
  target?: { x: number; y: number; roof: boolean };
  perchRoof: boolean;
  rng: () => number;
};

type FlyerEntry = {
  readonly id: string;
  readonly home: { readonly x: number; readonly y: number };
  readonly baseFrame: number;
};

type FlyerSceneContext = {
  readonly map: GameMap;
  readonly eventSprites: Map<string, FlyerSprite>;
  readonly tileX: number;
  readonly tileY: number;
  readonly add?: { graphics?: () => FlyerGraphics };
};

type FlyerSprite = {
  x: number;
  y: number;
  scaleY: number;
  visible: boolean;
  setPosition(x: number, y: number): unknown;
  setDepth(depth: number): unknown;
  setFrame(frame: number): unknown;
  setCrop?(x: number, y: number, width: number, height: number): unknown;
  frame?: { readonly width?: number; readonly height?: number };
};

type FlyerGraphics = {
  scene?: unknown;
  clear(): unknown;
  fillStyle(color: number, alpha: number): unknown;
  fillEllipse(x: number, y: number, width: number, height: number): unknown;
  setDepth(depth: number): unknown;
  destroy(): unknown;
};

const flyerEntries = new WeakMap<object, { mapId: string; entries: FlyerEntry[] }>();
const flyerStates = new WeakMap<object, Map<string, FlyerState>>();
const flyerShadows = new WeakMap<object, FlyerGraphics>();

/** 날 때 위로 그리는 깊이 — 상층(250k)·위 이벤트(300k+y)보다 위. */
const FLYING_DEPTH = 390_000;
/** 그림자 깊이 — 하층 지형 위, 사람(200k) 아래, 지붕·수관(250k) 아래(지붕 위 그림자는 지붕이 가린다). */
const SHADOW_DEPTH = 150_000;
const FLAP_FRAME_MS = 90;
const TAKEOFF_FLAP_FRAME_MS = 60;
const WALK_PATTERN_STEPS = 4;

/** 표면 갱신(registerPageMoveRoutes)이 이번 맵의 비행 이벤트를 알려 준다. */
export function noteAmbientFlyers(scene: object, map: GameMap, views: readonly RuntimeEventView[]): void {
  const entries = views
    .filter((view) => view.movement.type === "fly")
    .map((view) => ({ id: view.event.id, home: { x: view.event.x, y: view.event.y }, baseFrame: typeof view.page?.graphic.pattern === "number" ? view.page.graphic.pattern : 0 }));
  const previous = flyerEntries.get(scene);
  if (previous && previous.mapId !== map.id) flyerStates.delete(scene);
  flyerEntries.set(scene, { mapId: map.id, entries });
  if (entries.length === 0) {
    const shadow = flyerShadows.get(scene);
    shadow?.clear();
  }
}

function seededRng(seedText: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) seed = Math.imul(seed ^ seedText.charCodeAt(i), 16777619);
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function between(rng: () => number, lo: number, hi: number): number {
  return lo + rng() * (hi - lo);
}

function newState(entry: FlyerEntry, map: GameMap, tile: number): FlyerState {
  const rng = seededRng(`${map.id}:${entry.id}`);
  const cruise = between(rng, 22, 34);
  return {
    x: characterSpriteX(entry.home.x, tile),
    y: characterSpriteY(entry.home.y, tile) - tile / 2,
    h: cruise,
    heading: rng() * Math.PI * 2,
    speed: between(rng, 32, 46),
    turn: 0,
    turnTarget: between(rng, -1, 1),
    turnTimer: between(rng, 800, 2200),
    mode: "fly",
    modeTimer: 0,
    nextLandMs: between(rng, 6000, 14000),
    flapTimer: between(rng, 700, 1500),
    flapping: true,
    flapPhaseMs: rng() * 400,
    cruise,
    bobMs: rng() * 3000,
    dir: "right",
    perchRoof: false,
    rng,
  };
}

function angleDiff(target: number, current: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function facingFor(vx: number, vy: number, previous: Dir): Dir {
  // 새는 옆모습이 가장 새답다 — 거의 수직으로 날 때만 위·아래 그림을 쓴다.
  if (Math.abs(vy) > Math.abs(vx) * 2.2) return vy < 0 ? "up" : "down";
  if (Math.abs(vx) < 1e-3) return previous;
  return vx < 0 ? "left" : "right";
}

/** 앉을 칸을 고른다 — 새에게서 8칸 안, 주인공에게서 3칸 밖, 물은 빼고. 통행 칸이면 땅, 아니면 지붕·나무 위. */
function pickPerch(state: FlyerState, scene: FlyerSceneContext, tile: number): FlyerState["target"] {
  const project = store.getCurrent();
  const map = scene.map;
  const bx = Math.floor(state.x / tile), by = Math.floor(state.y / tile);
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const tx = bx + Math.round(between(state.rng, -8, 8));
    const ty = by + Math.round(between(state.rng, -6, 6));
    if (tx < 1 || ty < 1 || tx >= map.width - 1 || ty >= map.height - 1) continue;
    if (Math.abs(tx - scene.tileX) + Math.abs(ty - scene.tileY) < 4) continue;
    if (isWaterTagged(project, map, tx, ty)) continue;
    const ground = isPassable(project, map, tx, ty);
    // 사람·간판이 선 칸은 피한다(이벤트 스프라이트 위치로 본다).
    let occupied = false;
    for (const sprite of scene.eventSprites.values()) {
      if (!sprite.visible) continue;
      if (Math.floor(sprite.x / tile) === tx && Math.floor((sprite.y - 1) / tile) === ty) { occupied = true; break; }
    }
    if (occupied) continue;
    return { x: characterSpriteX(tx, tile), y: characterSpriteY(ty, tile) - 3, roof: !ground };
  }
  return undefined;
}

function stepFlyer(state: FlyerState, scene: FlyerSceneContext, tile: number, deltaMs: number): void {
  const dt = Math.min(100, Math.max(0, deltaMs)) / 1000;
  const map = scene.map;
  const heroX = characterSpriteX(scene.tileX, tile), heroY = characterSpriteY(scene.tileY, tile) - tile / 2;
  const heroDist = Math.hypot(heroX - state.x, heroY - state.y);
  state.bobMs += deltaMs;
  state.flapPhaseMs += deltaMs;

  if (state.mode === "perch") {
    state.modeTimer -= deltaMs;
    state.h = 0;
    // 쉬는 동안 가끔 고개를 돌린다(좌우 그림 바꾸기).
    state.turnTimer -= deltaMs;
    if (state.turnTimer <= 0) {
      state.turnTimer = between(state.rng, 700, 1800);
      if (state.rng() < 0.5) state.dir = state.dir === "left" ? "right" : "left";
    }
    if (state.modeTimer <= 0 || heroDist < tile * 2.5) {
      state.mode = "takeoff";
      state.modeTimer = 700;
      // 주인공에게서 멀어지는 쪽으로(놀라서 날아오름), 아니면 아무 쪽.
      state.heading = heroDist < tile * 3 ? Math.atan2(state.y - heroY, state.x - heroX) + between(state.rng, -0.6, 0.6) : state.rng() * Math.PI * 2;
      state.speed = 10;
      state.nextLandMs = between(state.rng, 9000, 18000);
    }
    return;
  }

  // 회전 속도는 목표값으로 천천히 다가간다 — 꺾임이 아니라 호를 그린다.
  state.turnTimer -= deltaMs;
  if (state.turnTimer <= 0) {
    state.turnTimer = between(state.rng, 900, 2400);
    state.turnTarget = between(state.rng, -1.3, 1.3);
  }
  let steer = state.turnTarget;
  const margin = tile * 2;
  const minX = -margin, minY = -margin, maxX = map.width * tile + margin, maxY = map.height * tile + margin;
  if (state.x < minX || state.y < minY || state.x > maxX || state.y > maxY) {
    // 맵 밖으로 두 칸 넘게 나갔다 — 맵 가운데 쪽으로 크게 돈다.
    const back = Math.atan2(map.height * tile / 2 - state.y, map.width * tile / 2 - state.x);
    steer = Math.sign(angleDiff(back, state.heading)) * 2.2;
  }
  if (state.mode === "approach" && state.target) {
    const want = Math.atan2(state.target.y - state.y, state.target.x - state.x);
    steer = Math.max(-3, Math.min(3, angleDiff(want, state.heading) * 3));
  }
  state.turn += (steer - state.turn) * Math.min(1, dt * 2.5);
  state.heading += state.turn * dt;

  if (state.mode === "takeoff") {
    state.modeTimer -= deltaMs;
    state.speed += (40 - state.speed) * Math.min(1, dt * 3);
    state.h += (state.cruise - state.h) * Math.min(1, dt * 3.2);
    state.flapping = true;
    if (state.modeTimer <= 0) { state.mode = "fly"; state.flapTimer = between(state.rng, 600, 1200); }
  } else if (state.mode === "fly") {
    state.nextLandMs -= deltaMs;
    state.speed += (between(state.rng, 34, 44) - state.speed) * Math.min(1, dt);
    state.h += (state.cruise + Math.sin(state.bobMs / 650) * 2 - state.h) * Math.min(1, dt * 2);
    state.flapTimer -= deltaMs;
    if (state.flapTimer <= 0) {
      state.flapping = !state.flapping;
      state.flapTimer = state.flapping ? between(state.rng, 800, 1700) : between(state.rng, 500, 1300);
    }
    if (state.nextLandMs <= 0) {
      const target = pickPerch(state, scene, tile);
      if (target) { state.mode = "approach"; state.target = target; state.modeTimer = 9000; }
      else state.nextLandMs = 3000;
    }
  } else if (state.mode === "approach" && state.target) {
    state.modeTimer -= deltaMs;
    const dist = Math.hypot(state.target.x - state.x, state.target.y - state.y);
    const near = tile * 3;
    // 내려앉는 마지막 세 칸: 고도와 속도를 거리에 맞춰 줄인다. 날갯짓은 빠르게(제동).
    if (dist < near) {
      state.h = Math.min(state.h, state.cruise * (dist / near));
      state.speed = Math.max(14, 40 * (dist / near));
      state.flapping = true;
    } else {
      state.h += (state.cruise - state.h) * Math.min(1, dt * 2);
    }
    if (dist < 2.5 || state.modeTimer <= 0 || Math.hypot(heroX - state.target.x, heroY - state.target.y) < tile * 2.5) {
      if (dist < 2.5) {
        state.x = state.target.x; state.y = state.target.y; state.h = 0;
        state.mode = "perch";
        state.perchRoof = state.target.roof;
        state.modeTimer = between(state.rng, 2500, 6500);
        state.turnTimer = between(state.rng, 600, 1400);
        if (state.dir === "up" || state.dir === "down") state.dir = state.rng() < 0.5 ? "left" : "right";
      } else {
        state.mode = "fly";
        state.nextLandMs = between(state.rng, 4000, 9000);
      }
      state.target = undefined;
      return;
    }
  }
  const vx = Math.cos(state.heading) * state.speed, vy = Math.sin(state.heading) * state.speed;
  state.x += vx * dt;
  state.y += vy * dt;
  state.dir = facingFor(vx, vy, state.dir);
}

function drawFlyer(state: FlyerState, entry: FlyerEntry, sprite: FlyerSprite): void {
  const scale = Math.abs(sprite.scaleY || 1);
  // 칩 칸(24×32) 안의 새는 위쪽 3~18줄, 26~30줄은 칩에 그려 둔 그림자다. 그림자 줄은 잘라 내고 따로 그린다.
  const cellH = sprite.frame?.height ?? 32;
  const cellW = sprite.frame?.width ?? 24;
  sprite.setCrop?.(0, 0, cellW, Math.round(cellH * 0.69));
  // 원점(발)은 칸 맨 아래다. 새 몸 아랫줄(약 18줄)이 땅/착지점에 닿게 그만큼 내린다.
  const bodyDrop = Math.round(cellH * 0.42) * scale;
  sprite.setPosition(Math.round(state.x), Math.round(state.y + bodyDrop - state.h));
  if (state.mode === "perch") {
    sprite.setDepth(state.perchRoof ? 300_000 + state.y : 200_000 + state.y);
    // 앉은 새: 날개 접은 그림(패턴 2), 가끔 짧게 날개를 턴다.
    sprite.setFrame(charsetWalkFrameIndex(entry.baseFrame, state.dir, Math.floor(state.flapPhaseMs / 2600) % 7 === 0 ? 0 : 2));
    return;
  }
  sprite.setDepth(FLYING_DEPTH + state.y);
  if (state.flapping) {
    const frameMs = state.mode === "takeoff" ? TAKEOFF_FLAP_FRAME_MS : FLAP_FRAME_MS;
    sprite.setFrame(charsetWalkFrameIndex(entry.baseFrame, state.dir, Math.floor(state.flapPhaseMs / frameMs) % WALK_PATTERN_STEPS));
  } else {
    sprite.setFrame(charsetIdleFrameIndex(entry.baseFrame, state.dir));
  }
}

/** 매 프레임. 비행 이벤트가 없는 맵이면 아무것도 하지 않는다. */
export function updateAmbientFlyers(scene: FlyerSceneContext, deltaMs: number): void {
  const registered = flyerEntries.get(scene);
  const shadow = flyerShadows.get(scene);
  if (!registered || registered.entries.length === 0 || registered.mapId !== scene.map.id) {
    if (shadow && registered?.mapId !== scene.map.id) shadow.clear();
    return;
  }
  const tile = mapTileSize(scene.map);
  if (!(tile > 0)) return;
  let states = flyerStates.get(scene);
  if (!states) { states = new Map(); flyerStates.set(scene, states); }
  let graphics = shadow;
  if (!graphics || graphics.scene === undefined || graphics.scene === null) {
    graphics = typeof scene.add?.graphics === "function" ? scene.add.graphics() : undefined;
    if (graphics) { graphics.setDepth(SHADOW_DEPTH); flyerShadows.set(scene, graphics); }
  }
  graphics?.clear();
  for (const entry of registered.entries) {
    const sprite = scene.eventSprites.get(entry.id);
    if (!sprite) continue;
    let state = states.get(entry.id);
    if (!state) { state = newState(entry, scene.map, tile); states.set(entry.id, state); }
    stepFlyer(state, scene, tile, deltaMs);
    drawFlyer(state, entry, sprite);
    if (graphics && sprite.visible && !(state.mode === "perch" && state.perchRoof)) {
      // 높을수록 작고 옅은 그림자. 앉으면 발밑에 작게.
      const lift = Math.min(1, state.h / 40);
      graphics.fillStyle(0x1b2a24, 0.28 - lift * 0.14);
      graphics.fillEllipse(Math.round(state.x), Math.round(state.y + 1), Math.max(4, 11 - lift * 5), Math.max(2, 4 - lift * 1.5));
    }
  }
}
