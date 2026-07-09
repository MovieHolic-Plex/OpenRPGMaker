import { TILE_SIZE } from "@/assets/bundled";
import type { CropRecord } from "@/project/types";

type OverlayGameObject = {
  setOrigin?(x: number, y: number): void;
  setDepth?(depth: number): void;
  setAlpha?(alpha: number): void;
};

type FarmOverlayScene = {
  readonly map: { readonly id: string };
  readonly session: { readonly farmPlots?: Record<string, Record<string, { readonly tilled: boolean; readonly watered: boolean; readonly cropId?: string; readonly stage?: number; readonly dead?: boolean }>> };
  readonly tileLayer: { add(object: unknown): unknown };
  readonly add: {
    rectangle?: (x: number, y: number, width: number, height: number, fillColor?: number, fillAlpha?: number) => OverlayGameObject;
    text?: (x: number, y: number, text: string, style?: Record<string, string>) => OverlayGameObject;
    sprite?: (x: number, y: number, texture: string, frame?: string | number) => OverlayGameObject;
  };
};

const FARM_BASE_DEPTH = 90_000;
const FARM_CROP_DEPTH = 140_000;

export function renderFarmOverlays(scene: FarmOverlayScene, crops: readonly CropRecord[] = []): void {
  const plots = scene.session.farmPlots?.[scene.map.id];
  if (!plots || typeof scene.add.rectangle !== "function") return;
  const cropById = new Map(crops.map((crop) => [crop.id, crop]));
  for (const [key, plot] of Object.entries(plots)) {
    const [xText, yText] = key.split(",");
    const x = Number(xText);
    const y = Number(yText);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    if (plot.tilled) addRect(scene, x, y, 0x7a4a25, plot.dead ? 0.52 : 0.38, FARM_BASE_DEPTH);
    if (plot.watered) addRect(scene, x, y, 0x3da3ff, 0.26, FARM_BASE_DEPTH + 1);
    if (!plot.cropId) continue;
    const crop = cropById.get(plot.cropId);
    renderCropMarker(scene, x, y, crop, plot.stage ?? 0, plot.dead === true);
  }
}

function renderCropMarker(
  scene: FarmOverlayScene,
  x: number,
  y: number,
  crop: CropRecord | undefined,
  stage: number,
  dead: boolean
): void {
  const graphic = crop?.graphicStages?.[Math.max(0, Math.min(stage, (crop.graphicStages?.length ?? 1) - 1))];
  if (graphic?.resourceId && typeof scene.add.sprite === "function") {
    const sprite = scene.add.sprite(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, graphic.resourceId, graphic.frame);
    sprite.setOrigin?.(0.5, 0.5);
    sprite.setDepth?.(FARM_CROP_DEPTH + y);
    if (dead) sprite.setAlpha?.(0.45);
    scene.tileLayer.add(sprite);
    return;
  }
  addRect(scene, x, y, dead ? 0x5f6166 : 0x2f8f45, dead ? 0.52 : 0.42, FARM_CROP_DEPTH + y);
  if (typeof scene.add.text !== "function") return;
  const label = dead ? "X" : graphic?.label ?? String(stage);
  const text = scene.add.text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, label, {
    color: "#ffffff",
    fontFamily: "monospace",
    fontSize: "10px",
    fontStyle: "bold",
  });
  text.setOrigin?.(0.5, 0.5);
  text.setDepth?.(FARM_CROP_DEPTH + y + 1);
  scene.tileLayer.add(text);
}

function addRect(scene: FarmOverlayScene, x: number, y: number, color: number, alpha: number, depth: number): void {
  const rect = scene.add.rectangle?.(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE, color, alpha);
  if (!rect) return;
  rect.setOrigin?.(0, 0);
  rect.setDepth?.(depth + y);
  scene.tileLayer.add(rect);
}
