// 필드의 탈것: 타기·내리기와 세워 둔 탈것 스프라이트. 통행·착륙·위치 규칙은 project/vehicles.ts.
// 탑승 중 주인공 그림(playerSpriteResources)과 동료 숨김(playSceneFollowers)은 session.vehicle 에서 파생된다.
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { characterSpriteX, characterSpriteY, placeCharacterSprite, updateCharacterDepth } from "@/player/characterDepth";
import type { Dir } from "@/player/input";
import { placePlayerOnCurrentMap } from "@/player/playSceneMapCommands";
import { findBlockingEventForPlayerBody } from "@/player/playSceneMovement";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { mapCharacterScale, mapCharacterSizeFactor } from "@/project/characterScale";
import { inBounds, isPassable } from "@/project/collision";
import { projectReferenceTileSize } from "@/project/mapViewScale";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import {
  airshipCanLand,
  boardedVehicleId,
  parkedVehicleAt,
  setParkedVehicleLocation,
  VEHICLE_CHARSET_TEXTURE_KEY,
  VEHICLE_IDS,
  vehicleCharacterIndex,
  vehicleLocation,
  type VehicleId,
} from "@/project/vehicles";

type VehicleSprite = Phaser.GameObjects.Sprite;
const vehicleSprites = new WeakMap<object, Map<VehicleId, VehicleSprite>>();

function frontOf(scene: Pick<PlaySceneContext, "tileX" | "tileY" | "facing">): { x: number; y: number } {
  const delta: Record<Dir, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
  return { x: scene.tileX + delta[scene.facing].x, y: scene.tileY + delta[scene.facing].y };
}

/** 확인 키: 타고 있으면 내리기, 아니면 정면(또는 발밑)의 탈것에 타기. 아무 일도 없으면 false. */
export function tryVehicleAction(scene: PlaySceneContext): boolean {
  return boardedVehicleId(scene.session) ? tryGetOffVehicle(scene) : tryBoardVehicle(scene);
}

export function tryBoardVehicle(scene: PlaySceneContext): boolean {
  if (scene.moving || scene.playerHop || boardedVehicleId(scene.session)) return false;
  const project = store.getCurrent();
  for (const cell of [frontOf(scene), { x: scene.tileX, y: scene.tileY }]) {
    const id = parkedVehicleAt(project, scene.session, scene.map.id, cell.x, cell.y);
    if (!id) continue;
    const parked = scene.session.vehicle?.positions?.[id];
    scene.session.vehicle = { ...(scene.session.vehicle ?? {}), boardedId: id };
    if (parked) {
      const { [id]: _, ...rest } = scene.session.vehicle.positions ?? {};
      scene.session.vehicle.positions = rest;
    }
    placePlayerOnCurrentMap(scene, cell.x, cell.y);
    scene.refreshRuntimeSurfaces();
    scene.syncRuntimeState();
    return true;
  }
  return false;
}

/**
 * 내리기. 배는 정면의 걸을 수 있는 칸으로 내리고 배는 그 자리에 남는다. 비행선은 발밑 지형이 착륙을
 * 허용할 때만 그 칸에 내려앉는다. 안 되면 false — 상태는 그대로다.
 */
export function tryGetOffVehicle(scene: PlaySceneContext): boolean {
  const id = boardedVehicleId(scene.session);
  if (!id || scene.moving || scene.playerHop) return false;
  const project = store.getCurrent();
  const here = { x: scene.tileX, y: scene.tileY };
  let target = here;
  if (id === "airship") {
    if (!airshipCanLand(project, scene.map, here.x, here.y)) return false;
  } else {
    target = frontOf(scene);
    if (!inBounds(scene.map, target.x, target.y) || !isPassable(project, scene.map, target.x, target.y)) return false;
    if (findBlockingEventForPlayerBody(scene, resolvePlayerBody(project, scene.session), target.x, target.y)) return false;
  }
  setParkedVehicleLocation(scene.session, id, { mapId: scene.map.id, x: here.x, y: here.y, direction: scene.facing });
  delete scene.session.vehicle!.boardedId;
  placePlayerOnCurrentMap(scene, target.x, target.y);
  scene.refreshRuntimeSurfaces();
  scene.syncRuntimeState();
  return true;
}

/** 이 맵에 세워 둔 탈것을 그린다. 타고 있는 탈것은 주인공 스프라이트가 그 모습이므로 따로 그리지 않는다. */
export function syncVehicleSprites(scene: PlaySceneContext): void {
  const project = store.getCurrent();
  let sprites = vehicleSprites.get(scene);
  if (!sprites) {
    sprites = new Map();
    vehicleSprites.set(scene, sprites);
  }
  const tileSize = mapTileSize(scene.map);
  for (const id of VEHICLE_IDS) {
    const location = boardedVehicleId(scene.session) === id ? undefined : vehicleLocation(project, scene.session, id);
    let sprite = sprites.get(id);
    // 씬 재시작은 게임오브젝트를 파괴하지만 씬 인스턴스는 재사용한다 — 죽은 스프라이트는 새로 만든다.
    if (sprite && !sprite.scene) {
      sprites.delete(id);
      sprite = undefined;
    }
    if (!location || location.mapId !== scene.map.id || !scene.textures.exists(VEHICLE_CHARSET_TEXTURE_KEY)) {
      sprite?.destroy();
      sprites.delete(id);
      continue;
    }
    const frame = charsetFrameIndex({ characterIndex: vehicleCharacterIndex(project, id), direction: location.direction ?? "down", pattern: 1 });
    const x = characterSpriteX(location.x, tileSize);
    const y = characterSpriteY(location.y, tileSize);
    if (!sprite) {
      sprite = scene.add.sprite(x, y, VEHICLE_CHARSET_TEXTURE_KEY, frame);
      placeCharacterSprite(sprite, "same");
      sprites.set(id, sprite);
    } else {
      sprite.setTexture(VEHICLE_CHARSET_TEXTURE_KEY, frame);
      sprite.setPosition(x, y);
      updateCharacterDepth(sprite, "same");
    }
    sprite.setScale(mapCharacterScale(sprite.width, tileSize, projectReferenceTileSize(project)) * mapCharacterSizeFactor(scene.map));
  }
}

export function vehicleSpritesDebug(scene: object): Record<string, { readonly textureKey: string; readonly frame: string | number; readonly x: number; readonly y: number }> {
  const out: Record<string, { readonly textureKey: string; readonly frame: string | number; readonly x: number; readonly y: number }> = {};
  for (const [id, sprite] of vehicleSprites.get(scene) ?? []) {
    if (!sprite.scene) continue;
    out[id] = { textureKey: sprite.texture.key, frame: sprite.frame.name, x: sprite.x, y: sprite.y };
  }
  return out;
}
