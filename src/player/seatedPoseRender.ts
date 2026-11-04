// player/seatedPoseRender.ts
// 앉은 자세(graphic.pose = "seated") 그리기 — 서 있는 정지 프레임을 아래로 내리고 아랫단을 잘라 의자가 사람 아래로 보이게 한다.
// 충돌 발자국·깊이(y 정렬)는 그대로다: 내리는 것은 그림 원점뿐이라 가구와의 앞뒤 순서가 바뀌지 않는다.
import { SEATED_CLIP_PX, SEATED_LOWER_PX } from "@/project/seatedPose";
import { characterBaseOrigin, setCharacterBaseOrigin } from "./characterOrigin";

const REFERENCE_TILE_PX = 16;

type SeatedSprite = {
  readonly scaleY: number;
  readonly height?: number;
  readonly frame?: { readonly realHeight?: number; readonly realWidth?: number };
  readonly width?: number;
  setOrigin(x: number, y: number): unknown;
  setCrop?(x: number, y: number, width: number, height: number): unknown;
};

/** 그림을 SEATED_LOWER_PX 만큼 내리고 SEATED_CLIP_PX 만큼 아랫단을 자른다(16px 타일 기준, 칸 크기에 비례). */
export function applySeatedPose(sprite: SeatedSprite, tileSize: number): void {
  const frameH = sprite.frame?.realHeight ?? sprite.height ?? 0;
  const frameW = sprite.frame?.realWidth ?? sprite.width ?? 0;
  const scaleY = Math.abs(sprite.scaleY) || 1;
  if (frameH <= 0 || frameW <= 0) return;
  const unit = tileSize / REFERENCE_TILE_PX;
  const base = characterBaseOrigin(sprite);
  const origin = { x: base.x, y: base.y - (SEATED_LOWER_PX * unit) / (frameH * scaleY) };
  setCharacterBaseOrigin(sprite, origin);
  sprite.setOrigin(origin.x, origin.y);
  const keep = Math.max(1, Math.round(frameH - (SEATED_CLIP_PX * unit) / scaleY));
  sprite.setCrop?.(0, 0, frameW, keep);
}
