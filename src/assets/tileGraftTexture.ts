// Phaser 텍스처용 타일셋 베이크(투명색 + 타일 이식 합성).
// 에디터와 export 플레이어가 동일한 tilesetImage.ts 의 ensureTilesetTexture 를 공유한다.
import {
  createTransparentColorKeyCanvas,
  isColorKeyedChipsetTextureKey,
  isTransparentColorKeySourceImage,
  rawChipsetTextureKey,
} from "@/assets/chipsetTransparency";
import { activeTileGrafts, createGraftedTilesetCanvas } from "@/assets/tileGrafts";
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
