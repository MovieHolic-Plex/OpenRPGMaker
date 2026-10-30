// 맵 위를 다니는 탈것(승용차 흐름·버스·노면전차·전철·지하철) — 맵의 `transit` 설정을 순수 시뮬레이션
// (project/mapTransit.ts)으로 돌리고, 탈것마다 스프라이트 하나를 발자국 아래 가장자리에 맞춰 그린다.
//
// - 탈것은 주인공을 막고(playerCanStep), 주인공·걷는 인물이 길에 서 있으면 그 앞에서 기다린다(stepTransitSim 의 isBlocked).
// - 정류장에서 문을 연 탈것 옆에서 「조사」하면 정류장의 board 목적지로 이동한다(tryBoardTransit).
// - 상태는 세이브하지 않는다. 맵에 들어올 때마다 처음부터(미리 90초 돌린 상태로) 시작한다.
import type Phaser from "phaser";
import { characterDepth } from "@/player/characterDepth";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  createTransitSim, stepTransitSim, transitBoardingAt, transitCellBlocked, transitPose,
  type TransitFrameName, type TransitSim, type TransitVehicleDef,
} from "@/project/mapTransit";
import { mapTileSize } from "@/project/tileGeometry";

/** 시트 그림의 한 칸 = 16px(jp_city · modern_city). 맵 칸 크기가 다르면 비율로 늘린다. */
const SPRITE_CELL = 16;
const STEP_SEC = 1 / 30;

type TransitScene = PlaySceneContext & {
  transitSim?: TransitSim;
  transitMapId?: string;
  transitSprites?: Map<number, Phaser.GameObjects.Image>;
  transitPrevPos?: Map<number, number>;
  transitAccumulatorSec?: number;
  transitShutdownHooked?: boolean;
};

function ensureFrames(phaser: Phaser.Scene, def: TransitVehicleDef): boolean {
  const key = `transit-vehicle:${def.id}`;
  if (!phaser.textures.exists(key)) {
    void ensureSceneImageTexture(phaser, key, def.image);
    return false;
  }
  const tex = phaser.textures.get(key);
  for (const [name, r] of Object.entries(def.frames)) {
    if (r && !tex.has(name)) tex.add(name, 0, r.x, r.y, r.w, r.h);
  }
  return true;
}

/** 맵을 불러올 때 — 이전 맵의 탈것을 치우고 새 맵 설정으로 다시 만든다. */
export function syncTransitForMap(scene: PlaySceneContext): void {
  const s = scene as TransitScene;
  for (const sprite of s.transitSprites?.values() ?? []) sprite.destroy();
  s.transitSprites = new Map();
  s.transitPrevPos = new Map();
  s.transitAccumulatorSec = 0;
  s.transitMapId = scene.map?.id;
  s.transitSim = scene.map?.transit?.routes?.length
    ? createTransitSim(scene.map.transit, { width: scene.map.width, height: scene.map.height })
    : undefined;
  if (s.transitSim) for (const v of s.transitSim.vehicles) ensureFrames(scene as unknown as Phaser.Scene, v.def);
  if (!s.transitShutdownHooked) {
    s.transitShutdownHooked = true;
    scene.events?.once?.("shutdown", () => { s.transitSprites?.forEach((sp) => sp.destroy()); s.transitSprites = undefined; s.transitPrevPos = undefined; s.transitSim = undefined; s.transitShutdownHooked = false; });
  }
}

const STEP_DELTA: Record<string, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/**
 * 차가 양보할 칸 — 주인공과 걸어 다니는 인물(자율 이동 NPC)이 서 있거나, 걸음 도중이거나, 곧 디딜 칸.
 * 걸음은 시작할 때 자리를 도착 칸으로 옮기므로 떠나는 칸(from)도 넣고, 걷는 중이면 같은 방향의 다음 칸도 넣는다
 * — 차선 옆 보도에서 차도로 걸어 들어오는 사람 앞에서 차가 먼저 선다(첫사랑 r4: 횡단보도 행인을 차가 뚫고 지나감).
 * 서 있는 인물은 제 칸만 센다(차도 옆에 서서 보는 사람이 차를 영영 묶지 않게). 투명한(opacity 0) 인물은 세지 않는다.
 */
function playerBlocksCell(scene: PlaySceneContext): (x: number, y: number) => boolean {
  const cells = new Set<number>();
  const add = (x: number, y: number): void => { cells.add(y * 4096 + x); };
  add(scene.tileX, scene.tileY);
  if (scene.moving) {
    if (scene.movingFrom) add(scene.movingFrom.x, scene.movingFrom.y);
    if (scene.movingTo) add(scene.movingTo.x, scene.movingTo.y);
  }
  const positions = scene.eventPositions ?? {};
  for (const [id, mover] of scene.autonomousNPCs?.entries?.() ?? []) {
    const pos = positions[id];
    if (!pos || scene.eventSprites?.get(id)?.visible === false || mover.opacity === 0) continue;
    add(pos.x, pos.y);
    const move = mover.activeMove;
    if (move) {
      add(move.fromX, move.fromY);
      add(move.toX, move.toY);
      const d = STEP_DELTA[move.dir];
      if (d && !move.hop) add(move.toX + d.x, move.toY + d.y);
    }
  }
  return (x, y) => cells.has(y * 4096 + x);
}

export function updateTransit(scene: PlaySceneContext, deltaMs: number): void {
  const s = scene as TransitScene;
  if (s.transitMapId !== scene.map?.id) syncTransitForMap(scene);
  const sim = s.transitSim;
  if (!sim) return;
  s.transitAccumulatorSec = Math.min(0.5, (s.transitAccumulatorSec ?? 0) + Math.max(0, deltaMs) / 1000);
  const blocked = playerBlocksCell(scene);
  const switches = scene.session?.switches;
  const switchOn = (id: string): boolean => switches?.[id] === true;
  while (s.transitAccumulatorSec >= STEP_SEC) {
    stepTransitSim(sim, STEP_SEC, blocked, switchOn);
    s.transitAccumulatorSec -= STEP_SEC;
  }
  syncTransitSprites(scene);
}

export function syncTransitSprites(scene: PlaySceneContext): void {
  const s = scene as TransitScene;
  const sim = s.transitSim;
  if (!sim) return;
  const phaser = scene as unknown as Phaser.Scene;
  const tile = mapTileSize(scene.map);
  const scale = tile / SPRITE_CELL;
  const sprites = s.transitSprites ??= new Map();
  const prevPos = s.transitPrevPos ??= new Map();
  const alive = new Set<number>();
  for (const v of sim.vehicles) {
    alive.add(v.key);
    if (!ensureFrames(phaser, v.def)) continue;
    const pose = transitPose(sim, v);
    const lastPos = prevPos.get(v.key);
    const moving = lastPos === undefined || Math.abs(v.pos - lastPos) > 1e-5;
    prevPos.set(v.key, v.pos);
    // 경광등 차는 바퀴 위상의 홀짝(_1/_3 = 켜짐)을 0.25초 시계로 정한다 — 서 있어도(브레이크 칸 대신) 적·청이 번갈아 깜빡인다.
    const beaconLit = Math.floor(sim.clockSec / 0.25) & 1;
    const phase = v.def.beacon ? ((moving ? Math.floor(v.pos * 4) & 2 : 0) | beaconLit) : Math.floor(v.pos * 4) & 3;
    let frameName: TransitFrameName = pose.dir;
    // 방향지시등: 0.4초 켜짐 / 0.4초 꺼짐(시트에 _sigL/_sigR 칸이 있는 차만).
    const blinkOn = pose.blinker && Math.floor(sim.clockSec / 0.4) % 2 === 0;
    const sigFrame = pose.blinker ? (`${pose.dir}_sig${pose.blinker === "left" ? "L" : "R"}` as TransitFrameName) : null;
    if (pose.open && (pose.dir === "right" || pose.dir === "left") && v.def.frames[`${pose.dir}_open`]) {
      frameName = `${pose.dir}_open`;
    } else if (blinkOn && sigFrame && v.def.frames[sigFrame]) {
      frameName = sigFrame;
    } else if (!moving && !v.def.beacon && v.def.frames[`${pose.dir}_brake` as TransitFrameName]) {
      frameName = `${pose.dir}_brake` as TransitFrameName;
    } else if ((moving || v.def.beacon) && v.def.frames[`${pose.dir}_${phase}` as TransitFrameName]) {
      frameName = `${pose.dir}_${phase}` as TransitFrameName;
    }
    const frameRect = v.def.frames[frameName];
    if (!frameRect) continue;
    const key = `transit-vehicle:${v.def.id}`;
    let sprite = sprites.get(v.key);
    if (!sprite) {
      sprite = phaser.add.image(0, 0, key, frameName).setOrigin(0, 1);
      sprites.set(v.key, sprite);
    } else if (sprite.frame.name !== frameName) sprite.setFrame(frameName);
    // 그림 아래 가장자리 = 발자국 아래 가장자리. 프레임 폭이 발자국 칸 폭과 다르면 중심을 맞춘다.
    const centerX = frameRect.w !== pose.rect.w * SPRITE_CELL;
    const x = centerX
      ? Math.round((pose.rect.x + pose.rect.w / 2) * tile - (frameRect.w * scale) / 2)
      : Math.round(pose.rect.x * tile);
    const y = Math.round((pose.rect.y + pose.rect.h) * tile);
    sprite.setPosition(x, y).setScale(scale).setDepth(characterDepth("same", y));
  }
  for (const [key, sprite] of sprites) if (!alive.has(key)) { sprite.destroy(); sprites.delete(key); prevPos.delete(key); }
}

/** (x, y) 칸이 탈것 몸에 덮였는가 — playerCanStep 이 부른다. */
export function transitBlocksCell(scene: Pick<PlaySceneContext, "map">, x: number, y: number): boolean {
  return transitCellBlocked((scene as TransitScene).transitSim, x, y);
}

/** 정류장에 문 열고 선 탈것 앞에서 조사 → 정류장의 board 목적지로 이동. 처리했으면 true. */
export function tryBoardTransit(scene: Pick<PlaySceneContext, "map" | "running"> & { transferTo?: PlaySceneContext["transferTo"] }, tx: number, ty: number): boolean {
  const target = transitBoardingAt((scene as TransitScene).transitSim, tx, ty);
  if (!target || scene.running || !scene.transferTo) return false;
  void scene.transferTo({ mapId: target.mapId, x: target.x, y: target.y, fade: "black", direction: target.dir ?? "retain" });
  return true;
}

/** QA·시험용 현재 상태(탈것 key·id·머리 칸·방향·정차·막힌 초, 그려진 스프라이트 프레임). */
export function transitDebugState(scene: PlaySceneContext): {
  routes: string[];
  vehicles: { key: number; id: string; route: string; rect: { x: number; y: number; w: number; h: number }; dir: string; blinker: string | null; open: boolean; blockedSec: number; stopAt: number | null; sprite: { frame: string; x: number; y: number; visible: boolean } | null }[];
} | null {
  const s = scene as TransitScene;
  const sim = s.transitSim;
  if (!sim) return null;
  return {
    routes: sim.routes.map((r) => r.id),
    vehicles: sim.vehicles.map((v) => {
      const p = transitPose(sim, v);
      const sp = s.transitSprites?.get(v.key);
      return {
        key: v.key, id: v.def.id, route: sim.routes[v.routeIndex]!.id, rect: p.rect, dir: p.dir, blinker: p.blinker ?? null, open: p.open, blockedSec: +v.blockedSec.toFixed(2), stopAt: v.stopAt,
        sprite: sp ? { frame: String(sp.frame.name), x: sp.x, y: sp.y, visible: sp.visible } : null,
      };
    }),
  };
}
