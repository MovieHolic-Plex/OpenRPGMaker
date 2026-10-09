// 영역 작업 before/after 썸네일 — 프로젝트+맵의 지정 사각형만 크롭 렌더한다.
// 이벤트(NPC)는 셀 마커(파란 원)로 단순 표시. fakeDom(테스트)에는 canvas가 없으므로
// 모달은 이 함수를 주입형 옵션으로 받는다(스펙 §2-C).
import { drawMapTileLayers, loadTilesetImage, MapTileDrawError, type TilesetCanvasImage } from "@/editor/mapTileDraw";
import type { RegionRect } from "@/editor/regionTask/clipToRegion";
import { inRegion } from "@/editor/regionTask/clipToRegion";
import type { GameEvent, GameMap, Project } from "@/project/types";

const DEFAULT_TARGET_WIDTH = 140;
const MAX_SCALE = 2;
const MIN_SCALE = 0.0625; // 16px 타일 기준 타일당 1px

/** 목표 폭 대비 배율 — [MIN_SCALE, MAX_SCALE] 클램프. 비정상 입력은 1. */
export function regionSnapshotScale(regionWidthPx: number, targetWidth = DEFAULT_TARGET_WIDTH): number {
  if (!Number.isFinite(regionWidthPx) || regionWidthPx <= 0) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, targetWidth / regionWidthPx));
}

export function eventsInRegion(map: GameMap, region: RegionRect): readonly GameEvent[] {
  return (map.events ?? []).filter((event) => inRegion(event.x, event.y, region));
}

export async function renderRegionSnapshot(
  project: Project,
  map: GameMap,
  region: RegionRect,
  opts?: { readonly targetWidth?: number; readonly image?: TilesetCanvasImage },
): Promise<HTMLCanvasElement> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new MapTileDrawError("맵의 타일셋을 찾지 못했습니다.");
  const tileSize = map.tileSize;
  const scale = regionSnapshotScale(region.width * tileSize, opts?.targetWidth);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.width * tileSize * scale));
  canvas.height = Math.max(1, Math.round(region.height * tileSize * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new MapTileDrawError("썸네일 캔버스를 만들지 못했습니다.");
  context.imageSmoothingEnabled = false;
  // 절대 맵 좌표로 그리는 draw 함수를 영역 원점으로 평행이동 — 캔버스 밖은 자동 클립.
  context.translate(-Math.round(region.x * tileSize * scale), -Math.round(region.y * tileSize * scale));

  const image = opts?.image ?? await loadTilesetImage(tileset);
  drawMapTileLayers(context, image, map, tileset, scale);

  // 이벤트 마커: 셀 중앙의 파란 원(단순 표시 — 차셋 스프라이트는 비목표)
  for (const event of eventsInRegion(map, region)) {
    const cx = (event.x + 0.5) * tileSize * scale;
    const cy = (event.y + 0.5) * tileSize * scale;
    const radius = Math.max(2, tileSize * scale * 0.32);
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = "rgba(21, 170, 191, 0.9)";
    context.fill();
    context.lineWidth = Math.max(1, scale);
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.stroke();
  }
  return canvas;
}
