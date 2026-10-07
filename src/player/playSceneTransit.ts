// 맵 위를 다니는 탈것(승용차 흐름·버스·노면전차·전철·지하철) — 맵의 `transit` 설정을 순수 시뮬레이션
// (project/mapTransit.ts)으로 돌리고, 탈것마다 스프라이트 하나를 발자국 아래 가장자리에 맞춰 그린다.
//
// - 탈것은 주인공을 막고(playerCanStep), 주인공이 길에 서 있으면 그 앞에서 기다린다(stepTransitSim 의 isBlocked).
// - 정류장에서 문을 연 탈것 옆에서 「조사」하면 정류장의 board 목적지로 이동한다(tryBoardTransit).
// - 상태는 세이브하지 않는다. 맵에 들어올 때마다 처음부터(미리 90초 돌린 상태로) 시작한다.
import type Phaser from "phaser";
import { characterDepth } from "@/player/characterDepth";
import { ensureSceneImageTexture } from "@/player/playSceneImageTexture";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import {
  createTransitSim, stepTransitSim, transitBoardingAt, transitCellBlocked, transitPose,
  type TransitSim, type TransitVehicleDef,
} from "@/project/mapTransit";
import { mapTileSize } from "@/project/tileGeometry";

/** 시트 그림의 한 칸 = 16px(jp_city). 맵 칸 크기가 다르면 비율로 늘린다. */
const SPRITE_CELL = 16;
const STEP_SEC = 1 / 30;

type TransitScene = PlaySceneContext & {
  transitSim?: TransitSim;
  transitMapId?: string;
  transitSprites?: Map<number, Phaser.GameObjects.Image>;
  transitAccumulatorSec?: number;
  transitShutdownHooked?: boolean;
};

const textureKey = (def: TransitVehicleDef): string => `transit-vehicle:${def.id}`;

function ensureFrames(scene: Phaser.Scene, def: TransitVehicleDef): boolean {
  const key = textureKey(def);
  if (!scene.textures.exists(key)) {
    void ensureSceneImageTexture(scene, key, def.image);
    return false;
  }
  const tex = scene.textures.get(key);
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
  s.transitAccumulatorSec = 0;
  s.transitMapId = scene.map?.id;
  s.transitSim = scene.map?.transit?.routes?.length
    ? createTransitSim(scene.map.transit, { width: scene.map.width, height: scene.map.height })
    : undefined;
  if (s.transitSim) for (const v of s.transitSim.vehicles) ensureFrames(scene as unknown as Phaser.Scene, v.def);
  if (!s.transitShutdownHooked) {
    s.transitShutdownHooked = true;
    scene.events?.once?.("shutdown", () => { s.transitSprites?.forEach((sp) => sp.destroy()); s.transitSprites = undefined; s.transitSim = undefined; s.transitShutdownHooked = false; });
  }
}

/** 주인공이 차지한 칸(통행 사각이 1×1 이 아닐 수도 있어 사각 전체). */
function playerBlocksCell(scene: PlaySceneContext): (x: number, y: number) => boolean {
  const px = scene.tileX, py = scene.tileY;
  return (x, y) => x === px && y === py;
}

export function updateTransit(scene: PlaySceneContext, deltaMs: number): void {
  const s = scene as TransitScene;
  if (s.transitMapId !== scene.map?.id) syncTransitForMap(scene);
  const sim = s.transitSim;
  if (!sim) return;
  s.transitAccumulatorSec = Math.min(0.5, (s.transitAccumulatorSec ?? 0) + Math.max(0, deltaMs) / 1000);
  const blocked = playerBlocksCell(scene);
  while (s.transitAccumulatorSec >= STEP_SEC) {
    stepTransitSim(sim, STEP_SEC, blocked);
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
  const alive = new Set<number>();
  for (const v of sim.vehicles) {
    alive.add(v.key);
    if (!ensureFrames(phaser, v.def)) continue;
    const pose = transitPose(sim, v);
    const frameName = pose.open && (pose.dir === "right" || pose.dir === "left") && v.def.frames[`${pose.dir}_open`] ? `${pose.dir}_open` : pose.dir;
    if (!v.def.frames[frameName as keyof TransitVehicleDef["frames"]]) continue;
    let sprite = sprites.get(v.key);
    if (!sprite) {
      sprite = phaser.add.image(0, 0, textureKey(v.def), frameName).setOrigin(0, 1);
      sprites.set(v.key, sprite);
    } else if (sprite.frame.name !== frameName) sprite.setFrame(frameName);
    // 그림 아래 가장자리 = 발자국 아래 가장자리, 왼쪽 = 발자국 왼쪽. 화소 격자에 붙인다.
    const x = Math.round(pose.rect.x * tile);
    const y = Math.round((pose.rect.y + pose.rect.h) * tile);
    sprite.setPosition(x, y).setScale(scale).setDepth(characterDepth("same", y));
  }
  for (const [key, sprite] of sprites) if (!alive.has(key)) { sprite.destroy(); sprites.delete(key); }
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
  vehicles: { key: number; id: string; route: string; rect: { x: number; y: number; w: number; h: number }; dir: string; open: boolean; blockedSec: number; stopAt: number | null; sprite: { frame: string; x: number; y: number; visible: boolean } | null }[];
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
        key: v.key, id: v.def.id, route: sim.routes[v.routeIndex]!.id, rect: p.rect, dir: p.dir, open: p.open, blockedSec: +v.blockedSec.toFixed(2), stopAt: v.stopAt,
        sprite: sp ? { frame: String(sp.frame.name), x: sp.x, y: sp.y, visible: sp.visible } : null,
      };
    }),
  };
}
