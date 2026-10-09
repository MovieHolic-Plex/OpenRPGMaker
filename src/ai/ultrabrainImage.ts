import type { GameMap, Project } from "@/project/types";
import { drawMapTileLayer } from "@/editor/mapTileDraw";
import { canvasDataUrl, createCanvas, drawCheckerBackground, keyedTilesetImage, loadTilesetImage, tileDrawSize } from "./toolImageCanvas";
import { drawRegionEventSprites, resolveRegionEventSprites } from "./toolImageEventSprites";
import { mapVisualEvidenceUnavailable } from "./mapVisualEvidence";

export const HARMONY_IMAGE_MAX_EDGE = 1536;

/** Whole-map art review uses the editor's backing/autotile composition, not raw swatches. */
export async function renderHarmonyMapImages(project: Project, map: GameMap) {
  const unavailable = mapVisualEvidenceUnavailable(map);
  if (unavailable) throw new Error(unavailable);
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset || map.width <= 0 || map.height <= 0) throw new Error("Ultrabrain: 맵 또는 타일셋이 올바르지 않습니다.");
  const size = tileDrawSize(map.width, map.height, tileset.tileSize, HARMONY_IMAGE_MAX_EDGE);
  const pair = createCanvas(map.width * size, map.height * size);
  if (!pair) throw new Error("Ultrabrain: 맵 캡처 캔버스를 만들지 못했습니다.");
  const events = resolveRegionEventSprites(project, map, { x: 0, y: 0, w: map.width, h: map.height }, size);
  if (!events.ok) throw new Error(events.reason);
  const image = keyedTilesetImage(tileset, await loadTilesetImage(tileset));
  const { context, canvas } = pair;
  drawCheckerBackground(context, canvas.width, canvas.height, Math.max(4, size / 2));
  drawMapTileLayer(context, image, map, tileset, "lower", size / tileset.tileSize);
  await drawRegionEventSprites(context, events.sprites.filter(event => event.priority === "below"));
  drawMapTileLayer(context, image, map, tileset, "upper", size / tileset.tileSize);
  await drawRegionEventSprites(context, events.sprites.filter(event => event.priority !== "below"));
  const dataUrl = canvasDataUrl(canvas, HARMONY_IMAGE_MAX_EDGE);
  if (!dataUrl) throw new Error("Ultrabrain: 맵 이미지를 인코딩하지 못했습니다.");
  return [{ dataUrl, label: `전체 맵 (0,0) ${map.width}×${map.height}` }];
}
