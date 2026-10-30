// Phaser 텍스처용 타일셋 베이크(투명색 + 타일 이식 합성).
// 에디터와 export 플레이어가 동일한 tilesetImage.ts 의 ensureTilesetTexture 를 공유한다.
import {
  createTransparentColorKeyCanvas,
  isColorKeyedChipsetTextureKey,
  isTransparentColorKeySourceImage,
  rawChipsetTextureKey,
} from "@/assets/chipsetTransparency";
import { activeTileGrafts, createGraftedTilesetCanvas, planGraftedTilesetSteps, type GraftedTilesetPlan } from "@/assets/tileGrafts";
import { normalizeRgbHexColor } from "@/assets/transparentColorKey";
import type { TilesetDef } from "@/project/types";
import type Phaser from "phaser";

type BakeSource = HTMLImageElement | HTMLCanvasElement;

// 베이크(캔버스 텍스처 생성)가 필요한가 — 투명색 지정 또는 타일 이식이 있을 때.
export function tilesetTextureNeedsBake(tileset: TilesetDef): boolean {
  return (
    !!normalizeRgbHexColor(tileset.transparentColor ?? "") ||
    activeTileGrafts(tileset).length > 0
  );
}

// 베이스 이미지(+투명색 처리) 위에 graft 를 16×16 blit 한 캔버스를 만든다.
// 확장 모드(targetTile >= 원본 count)면 캔버스가 세로로 자란다. 실패 시 null.
export function bakeTilesetTextureCanvas(
  scene: Phaser.Scene,
  tileset: TilesetDef,
  baseKey: string
): HTMLCanvasElement | null {
  const base = resolveBakeBase(scene, tileset, baseKey);
  if (!base) return null;
  const grafts = activeTileGrafts(tileset);
  if (grafts.length === 0) {
    return base instanceof HTMLCanvasElement ? base : null;
  }
  return createGraftedTilesetCanvas(tileset, base, (sourceChipset) =>
    resolveGraftSourceImage(scene, sourceChipset)
  );
}

/**
 * 워커 합성용 계획(이식이 있을 때만) — 조각으로 세운다(planGraftedTilesetSteps). 소스는 메인 스레드 합성과 같은
 * 처리 완료본이다(투명색 키 캔버스 포함). 이식이 없으면(투명색만) 합성할 것이 없으므로 null.
 */
export function planTilesetTextureBakeSteps(
  scene: Phaser.Scene,
  tileset: TilesetDef,
  baseKey: string
): Generator<void, GraftedTilesetPlan<BakeSource>, void> | null {
  if ((tileset.tileGrafts?.length ?? 0) === 0) return null;
  const base = resolveBakeBase(scene, tileset, baseKey);
  if (!base) return null;
  return planGraftedTilesetSteps(tileset, base, (sourceChipset) => resolveGraftSourceImage(scene, sourceChipset));
}

/**
 * 그림판 키만으로 세우는 계획 — 그림이 아직 안 실렸어도 된다(첫 맵 로딩과 겹쳐 워커가 파일을 직접 받는다).
 * 소스 칸 좌표는 이식 항목의 기하만 쓰므로 그림 없이 정해진다. 투명색 키 시트는 처리본이 파일과 달라 쓰지 않는다(null).
 */
export function planTilesetTextureBakeStepsFromKeys(
  tileset: TilesetDef,
  baseKey: string
): Generator<void, GraftedTilesetPlan<string>, void> | null {
  if ((tileset.tileGrafts?.length ?? 0) === 0 || normalizeRgbHexColor(tileset.transparentColor ?? "")) return null;
  return planGraftedTilesetSteps<string>(tileset, baseKey, (sourceChipset) => sourceChipset);
}

// 베이스 시트: 사용자 투명색이 있으면 raw 원본에 색상키 적용(기존 선례),
// 없으면 이미 처리된 텍스처(색상키 타일 그림판 포함)를 그대로 쓴다.
function resolveBakeBase(scene: Phaser.Scene, tileset: TilesetDef, baseKey: string): BakeSource | null {
  if (normalizeRgbHexColor(tileset.transparentColor ?? "")) {
    const source = sceneSourceImage(scene, preferRawTextureKey(scene, baseKey));
    if (!source) return null;
    return createTransparentColorKeyCanvas(tileset, source);
  }
  const processed = sceneSourceImage(scene, baseKey);
  if (processed) return processed;
  const raw = sceneSourceImage(scene, rawChipsetTextureKey(baseKey));
  if (!raw) return null;
  if (isColorKeyedChipsetTextureKey(baseKey)) {
    return createTransparentColorKeyCanvas(baseKey, raw) ?? raw;
  }
  return raw;
}

// graft 소스 타일 그림판 이미지: 처리된 텍스처 우선, 없으면 raw 에 타일 그림판 색상키를 적용해 사용.
function resolveGraftSourceImage(scene: Phaser.Scene, sourceChipset: string): BakeSource | null {
  const processed = sceneSourceImage(scene, sourceChipset);
  if (processed) return processed;
  const raw = sceneSourceImage(scene, rawChipsetTextureKey(sourceChipset));
  if (!raw) return null;
  if (isColorKeyedChipsetTextureKey(sourceChipset)) {
    return createTransparentColorKeyCanvas(sourceChipset, raw) ?? raw;
  }
  return raw;
}

function preferRawTextureKey(scene: Phaser.Scene, baseKey: string): string {
  return scene.textures.exists(rawChipsetTextureKey(baseKey)) ? rawChipsetTextureKey(baseKey) : baseKey;
}

function sceneSourceImage(scene: Phaser.Scene, textureKey: string): BakeSource | null {
  if (!scene.textures.exists(textureKey)) return null;
  const source = scene.textures.get(textureKey).getSourceImage();
  return isTransparentColorKeySourceImage(source) ? source : null;
}
