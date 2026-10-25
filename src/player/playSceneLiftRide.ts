import Phaser from "phaser";
import type { StepResult } from "@/player/interpreter/types";
import { characterSpriteY, updateCharacterDepth } from "@/player/characterDepth";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { placePlayerOnCurrentMap } from "@/player/playSceneMapCommands";
import { playSoundEffect } from "@/player/audio";
import { mapTileSize } from "@/project/tileGeometry";
import { store } from "@/project/store";

/**
 * 승강 장치 타기(«Lift Ride») — 발판 · 레일 · 사슬을 그리고 파티를 태워 위/아래로 움직인다.
 *
 * 왜 따로 그리나: 이벤트 그림에는 타일 그림이 없고, 칩셋에 레일 조각도 없다. 승강기를 «바닥 칸 하나» 로
 * 두면 올라탄 것이 아니라 페이드로 사라진 것처럼 보인다(2026-10-25 폴른 스타 지적). 그래서 발판·레일·사슬을
 * 16px 도트 결로 장면이 직접 그린다 — 칩셋과 무관하게 어느 맵에서나 같은 승강기가 선다.
 *
 * 흐름: ① 동료가 발판 빈 칸으로 모인다 ② 덜컹(소리·흔들림) ③ 발판·파티가 함께 움직이고 카메라가 주인공을
 * 따라간다(주인공 스프라이트를 카메라가 이미 따라간다) — 기계음이 되풀이되고 발판이 미세하게 떤다 ④ 멈춤 덜컹.
 * - mode "depart": 움직인 채로 남는다(바로 뒤에 페이드·장소 이동을 둔다).
 * - mode "arrive": 반대쪽에서 출발해 지금 자리로 들어온다(이동 직후 도착 맵 첫 명령).
 * - mode "move": 같은 맵 안 다른 층으로 — 끝나면 주인공이 그 칸에 실제로 선다.
 * 맵이 바뀌면 그림·상태를 걷는다.
 */

type LiftStep = Extract<StepResult, { kind: "liftRide" }>;

type Rider = { sprite: Phaser.GameObjects.Sprite; baseX: number; baseY: number };

type LiftState = {
  mapId: string;
  platform: Phaser.GameObjects.Graphics;
  rails: Phaser.GameObjects.Graphics;
  pit: Phaser.GameObjects.Graphics;
  riders: Rider[];
  /** 발판 왼쪽 위 월드 좌표(움직이기 전). */
  left: number;
  top: number;
  widthPx: number;
  depthPx: number;
  /** 사슬 꼭대기(월드 y) — 화면 밖까지. */
  chainTop: number;
  offset: number;
  jitter: number;
  riding: boolean;
};

const states = new WeakMap<PlaySceneContext, LiftState>();

const PIT_DEPTH = 199_970;
const RAIL_DEPTH = 199_980;
const PLATFORM_DEPTH = 199_990;
const DEFAULT_STOP_SE = "cc0-se-osx-machine-03";

const C = {
  outline: 0x16120e,
  deck: 0x5c544a,
  deckLight: 0x857a6a,
  grate: 0x2e2822,
  lip: 0x3a3028,
  hazardA: 0xd8b040,
  hazardB: 0x1e1812,
  brass: 0xc8a050,
  post: 0x6e645a,
  postLight: 0x9a8e7e,
  chain: 0xa49e92,
  chainDark: 0x4a4640,
  rail: 0x4a4038,
  railLight: 0x7a6e60,
  pit: 0x0a0806,
  pitEdge: 0x2a2420,
} as const;

function clearLift(scene: PlaySceneContext): void {
  const state = states.get(scene);
  if (!state) return;
  state.platform.destroy();
  state.rails.destroy();
  state.pit.destroy();
  states.delete(scene);
}

/** 16px 도트 결 — 한 «화소» 는 칸 크기의 1/16. */
function drawPlatform(g: Phaser.GameObjects.Graphics, w: number, h: number, u: number, postsTall: boolean): void {
  g.clear();
  const px = (x: number, y: number, pw: number, ph: number, color: number): void => {
    g.fillStyle(color, 1);
    g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(pw)), Math.max(1, Math.round(ph)));
  };
  const lipH = 3 * u;
  // 발판 몸통
  px(0, 0, w, h, C.outline);
  px(u, u, w - 2 * u, h - 2 * u - lipH, C.deck);
  px(u, u, w - 2 * u, u, C.deckLight);
  // 쇠창살 무늬
  for (let gy = 3 * u; gy < h - lipH - u; gy += 3 * u) px(2 * u, gy, w - 4 * u, u, C.grate);
  for (let gx = 4 * u; gx < w - 2 * u; gx += 4 * u) px(gx, 2 * u, u, h - lipH - 3 * u, C.grate);
  // 앞 턱: 노랑·검정 경고 띠와 놋쇠 리벳
  px(u, h - lipH - u, w - 2 * u, lipH, C.lip);
  for (let sx = u, i = 0; sx < w - u; sx += 2 * u, i += 1) px(sx, h - lipH, Math.min(2 * u, w - u - sx), u, i % 2 ? C.hazardB : C.hazardA);
  for (let rx = 3 * u; rx < w - 2 * u; rx += 6 * u) px(rx, h - 2 * u, u, u, C.brass);
  // 네 귀퉁이 기둥(사슬을 거는 고리)
  const postH = postsTall ? 6 * u : 4 * u;
  for (const cx of [0, w - 3 * u]) {
    px(cx, -postH + 2 * u, 3 * u, postH, C.outline);
    px(cx + u, -postH + 3 * u, u, postH - 2 * u, C.post);
    px(cx + u, -postH + 3 * u, u, u, C.postLight);
    px(cx + u, -postH + 2 * u, u, u, C.brass);
  }
}

function drawChains(g: Phaser.GameObjects.Graphics, w: number, u: number, fromY: number, toY: number): void {
  // 사슬은 발판 기둥 꼭대기에서 위로 화면 밖까지. 고리는 발판에 붙어 함께 움직인다(fromY 기준으로 찍는다).
  for (const cx of [u, w - 2 * u]) {
    for (let y = fromY, i = 0; y > toY; y -= 3 * u, i += 1) {
      g.fillStyle(C.chainDark, 1);
      if (i % 2 === 0) {
        g.fillRect(cx - u, y - 3 * u, 3 * u, 3 * u);
        g.fillStyle(C.chain, 1);
        g.fillRect(cx - u, y - 3 * u, u, 2 * u);
        g.fillRect(cx + u, y - 3 * u, u, 2 * u);
      } else {
        g.fillRect(cx, y - 3 * u, u, 3 * u);
        g.fillStyle(C.chain, 1);
        g.fillRect(cx, y - 3 * u, u, u);
      }
    }
  }
}

function drawRails(g: Phaser.GameObjects.Graphics, left: number, w: number, u: number, top: number, bottom: number): void {
  g.clear();
  for (const rx of [left - 3 * u, left + w + u]) {
    g.fillStyle(C.outline, 1);
    g.fillRect(rx - u, top, 4 * u, bottom - top);
    g.fillStyle(C.rail, 1);
    g.fillRect(rx, top, 2 * u, bottom - top);
    g.fillStyle(C.railLight, 1);
    g.fillRect(rx, top, u, bottom - top);
    for (let y = top + 4 * u; y < bottom; y += 8 * u) {
      g.fillStyle(C.brass, 1);
      g.fillRect(rx, y, 2 * u, u);
    }
  }
}

function drawPit(g: Phaser.GameObjects.Graphics, left: number, top: number, w: number, h: number, u: number): void {
  g.clear();
  g.fillStyle(C.pitEdge, 1);
  g.fillRect(left, top, w, h);
  g.fillStyle(C.pit, 1);
  g.fillRect(left + u, top + 2 * u, w - 2 * u, h - 3 * u);
}

function riderCells(scene: PlaySceneContext, cellX: number, cellY: number, width: number, depth: number): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
  for (let dy = 0; dy < depth; dy += 1) for (let dx = 0; dx < width; dx += 1) cells.push({ x: cellX + dx, y: cellY + dy });
  const px = scene.tileX;
  const py = scene.tileY;
  return cells
    .filter((cell) => cell.x !== px || cell.y !== py)
    .sort((a, b) => Math.max(Math.abs(a.x - px), Math.abs(a.y - py)) - Math.max(Math.abs(b.x - px), Math.abs(b.y - py)) || a.y - b.y || a.x - b.x);
}

function tween(scene: PlaySceneContext, durationMs: number, onUpdate: (t: number) => void): Promise<void> {
  return new Promise((resolve) => {
    if (!scene.tweens) {
      onUpdate(1);
      resolve();
      return;
    }
    const box = { t: 0 };
    scene.tweens.add({
      targets: box,
      t: 1,
      duration: durationMs,
      ease: "Sine.easeInOut",
      onUpdate: () => onUpdate(box.t),
      onComplete: () => { onUpdate(1); resolve(); },
    });
  });
}

function wait(scene: PlaySceneContext, ms: number): Promise<void> {
  return new Promise((resolve) => (scene.time ? scene.time.delayedCall(ms, resolve) : resolve()));
}

/** 승강 장치 한 번. wait 이면 흐름이 끝까지 기다린다. */
export async function playLiftRide(scene: PlaySceneContext, step: LiftStep): Promise<void> {
  clearLift(scene);
  const size = mapTileSize(scene.map);
  const u = size / 16;
  const opts = step;
  const sign = opts.direction === "up" ? -1 : 1;
  const travel = opts.distance * size * sign;
  // 발판 자리: 주어지지 않으면 주인공 칸이 왼쪽 위.
  const cellX = opts.x ?? scene.tileX;
  const cellY = opts.y ?? scene.tileY;
  const left = cellX * size;
  const top = cellY * size;
  const widthPx = opts.width * size;
  const depthPx = opts.depth * size;
  const project = store.getCurrent();

  const pit = scene.add.graphics().setDepth(PIT_DEPTH);
  const rails = scene.add.graphics().setDepth(RAIL_DEPTH);
  const platform = scene.add.graphics().setDepth(PLATFORM_DEPTH);
  // 갱도: 출발 칸(arrive 는 들어오는 쪽) 아래가 시커멓게 비고, 레일은 이동 경로 전체 + 화면 밖까지.
  const startOffset = opts.mode === "arrive" ? -travel : 0;
  const endOffset = opts.mode === "arrive" ? 0 : travel;
  const pathTop = Math.min(top + startOffset, top + endOffset);
  const pathBottom = Math.max(top + startOffset, top + endOffset) + depthPx;
  const chainTop = pathTop - 12 * size;
  drawRails(rails, left, widthPx, u, chainTop, pathBottom);
  if (opts.mode !== "arrive") drawPit(pit, left, top, widthPx, depthPx, u);
  const state: LiftState = {
    mapId: scene.map.id,
    platform, rails, pit,
    riders: [],
    left, top, widthPx, depthPx, chainTop,
    offset: startOffset,
    jitter: 0,
    riding: true,
  };
  states.set(scene, state);
  redrawPlatform(state, u);

  // ① 파티를 발판에 모은다. 주인공은 이미 발판 위(밟아서 탄다). 동료는 빈 칸으로 짧게 걸어 온다.
  const cells = riderCells(scene, cellX, cellY, opts.width, opts.depth);
  const followers = [...(scene.followerSprites?.values() ?? [])].filter((sprite) => sprite.visible);
  const gathers: Array<{ sprite: Phaser.GameObjects.Sprite; fromX: number; fromY: number; toX: number; toY: number }> = [];
  followers.forEach((sprite, index) => {
    const cell = cells[index % Math.max(1, cells.length)] ?? { x: cellX, y: cellY };
    const toX = (cell.x + 0.5) * size;
    const toY = characterSpriteY(cell.y, size);
    gathers.push({ sprite, fromX: sprite.x, fromY: sprite.y, toX, toY });
  });
  if (scene.player) {
    state.riders.push({ sprite: scene.player, baseX: scene.player.x, baseY: scene.player.y });
  }
  if (opts.mode === "arrive") {
    // 도착: 동료는 처음부터 발판 위에 서서 함께 들어온다.
    for (const g of gathers) state.riders.push({ sprite: g.sprite, baseX: g.toX, baseY: g.toY });
    applyRiders(state);
  } else if (gathers.length > 0) {
    await tween(scene, 360, (t) => {
      for (const g of gathers) {
        g.sprite.x = g.fromX + (g.toX - g.fromX) * t;
        g.sprite.y = g.fromY + (g.toY - g.fromY) * t;
      }
    });
    for (const g of gathers) state.riders.push({ sprite: g.sprite, baseX: g.toX, baseY: g.toY });
  }
  for (const rider of state.riders) {
    rider.sprite.x = rider.baseX;
    rider.sprite.y = rider.baseY;
    updateCharacterDepth(rider.sprite as Parameters<typeof updateCharacterDepth>[0], "same");
  }
  applyRiders(state);

  // ② 출발 덜컹
  playSoundEffect(DEFAULT_STOP_SE, project);
  scene.cameras?.main?.shake(220, 0.004);
  await wait(scene, 260);

  // ③ 움직임: 기계음 되풀이 + 미세 떨림
  playSoundEffect(opts.se, project);
  const loopEvery = 700;
  const loop = scene.time?.addEvent({ delay: loopEvery, loop: true, callback: () => playSoundEffect(opts.se, project) });
  await tween(scene, opts.durationMs, (t) => {
    state.offset = startOffset + (endOffset - startOffset) * t;
    state.jitter = t > 0.04 && t < 0.96 && Math.floor(t * opts.durationMs / 70) % 2 === 0 ? u : 0;
  });
  loop?.remove(false);
  state.jitter = 0;

  // ④ 도착 덜컹
  playSoundEffect(DEFAULT_STOP_SE, project);
  scene.cameras?.main?.shake(200, 0.005);
  state.riding = false;
  await wait(scene, 220);

  if (opts.mode === "move") {
    const dy = Math.round(travel / size);
    clearRidersOnly(state);
    placePlayerOnCurrentMap(scene, scene.tileX, scene.tileY + dy);
    // 발판은 새 층에 그대로 서 있다.
    state.top += travel;
    state.offset = 0;
    drawPit(state.pit, state.left, state.top - travel, state.widthPx, state.depthPx, u);
    redrawPlatform(state, u);
  } else if (opts.mode === "arrive") {
    clearRidersOnly(state);
  }
}

function clearRidersOnly(state: LiftState): void {
  state.riders = [];
}

function redrawPlatform(state: LiftState, u: number): void {
  const g = state.platform;
  drawPlatform(g, state.widthPx, state.depthPx, u, true);
  drawChains(g, state.widthPx, u, -4 * u, state.chainTop - (state.top + state.offset));
  g.setPosition(state.left, state.top + state.offset + state.jitter);
}

function applyRiders(state: LiftState): void {
  const dy = state.offset + state.jitter;
  for (const rider of state.riders) {
    rider.sprite.x = rider.baseX;
    rider.sprite.y = rider.baseY + dy;
  }
}

/** 매 프레임(updateFieldStaging): 발판 위치를 맞추고 탄 사람을 발판에 붙인다(동료 걷기 보간이 덮어쓰지 못하게). */
export function syncLiftRide(scene: PlaySceneContext): void {
  const state = states.get(scene);
  if (!state) return;
  if (!scene.map || scene.map.id !== state.mapId) {
    clearLift(scene);
    return;
  }
  const u = mapTileSize(scene.map) / 16;
  state.platform.setPosition(state.left, state.top + state.offset + state.jitter);
  if (state.riding) redrawPlatform(state, u);
  applyRiders(state);
}

/** QA 훅: 지금 승강기가 서 있는지·움직임 정도. */
export function liftRideSnapshot(scene: PlaySceneContext): { readonly active: boolean; readonly riding: boolean; readonly offsetTiles: number; readonly riders: number } | null {
  const state = states.get(scene);
  if (!state) return null;
  const size = mapTileSize(scene.map) || 1;
  return { active: true, riding: state.riding, offsetTiles: state.offset / size, riders: state.riders.length };
}
