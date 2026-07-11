import { drawMapTileLayers, loadTilesetImage, MapTileDrawError } from "@/editor/mapTileDraw";
import type { GameMap, Project } from "@/project/types";

/** 큰 맵은 배율 낮춤 — 브라우저 캔버스 한도·메모리 초과 방지 */
const MAX_CANVAS_EDGE = 4096;

export type MapScreenshot = {
  readonly blob: Blob;
  readonly fileName: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
};

export class MapScreenshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapScreenshotError";
  }
}

export function screenshotScaleForMap(map: GameMap): number {
  const base = map.tileSize > 0 ? map.tileSize : 16;
  const w = map.width * base;
  const h = map.height * base;
  // 기본 2배, 긴 변이 MAX 넘지 않게
  let scale = 2;
  const long = Math.max(w, h) * scale;
  if (long > MAX_CANVAS_EDGE) {
    scale = Math.max(1, Math.floor((MAX_CANVAS_EDGE / Math.max(w, h)) * 100) / 100);
  }
  // 최소 1, 너무 큰 맵은 1 고정
  if (map.width * map.height > 80 * 80) scale = Math.min(scale, 1.5);
  if (map.width * map.height > 120 * 120) scale = 1;
  return Math.max(1, scale);
}

export async function createMapScreenshot(project: Project, map: GameMap): Promise<MapScreenshot> {
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) throw new MapScreenshotError("현재 맵의 타일셋을 찾지 못했습니다.");

  let image: HTMLImageElement;
  try {
    image = await loadTilesetImage(tileset);
  } catch (error) {
    if (error instanceof MapTileDrawError) throw new MapScreenshotError(error.message);
    throw error;
  }

  // CORS 타일셋이 taint 되면 toBlob 실패 — 동일 출처 보장 후 재시도
  if (!image.complete || image.naturalWidth === 0) {
    throw new MapScreenshotError("타일셋 이미지가 아직 로드되지 않았습니다.");
  }

  const scale = screenshotScaleForMap(map);
  const tile = map.tileSize || tileset.tileSize || 16;
  const width = Math.floor(map.width * tile * scale);
  const height = Math.floor(map.height * tile * scale);
  if (width <= 0 || height <= 0) {
    throw new MapScreenshotError(`맵 크기가 유효하지 않습니다 (${map.width}×${map.height}).`);
  }
  if (width > MAX_CANVAS_EDGE || height > MAX_CANVAS_EDGE) {
    throw new MapScreenshotError(
      `맵이 너무 커서 캡처할 수 없습니다 (${width}×${height}px). 영역을 줄이거나 맵을 나누세요.`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
  if (!context) throw new MapScreenshotError("맵 캡처 캔버스를 만들지 못했습니다.");

  context.imageSmoothingEnabled = false;
  // 투명 배경 대신 잔디색 계열 채워 빈 칸·PNG 깨짐 방지
  context.fillStyle = "#3d6b3a";
  context.fillRect(0, 0, width, height);
  drawMapTileLayers(context, image, map, tileset, scale);

  // 이벤트 스프라이트는 번들 로드 비용이 커서, 위치만 작은 마커로 표시
  drawEventMarkers(context, map, tile, scale);

  const blob = await canvasToPngBlob(canvas);
  if (blob.size < 100) {
    throw new MapScreenshotError("캡처 결과가 비어 있습니다. 타일셋 로딩을 확인하세요.");
  }

  return {
    blob,
    fileName: mapScreenshotFileName(map),
    width,
    height,
    scale,
  };
}

function drawEventMarkers(
  context: CanvasRenderingContext2D,
  map: GameMap,
  tile: number,
  scale: number,
): void {
  const size = Math.max(3, Math.floor(tile * scale * 0.35));
  for (const event of map.events) {
    const page = event.pages?.[0];
    const graphic = page?.graphic;
    if (graphic?.transparent) continue;
    const cx = (event.x * tile + tile / 2) * scale;
    const cy = (event.y * tile + tile / 2) * scale;
    context.fillStyle = graphic?.sprite ? "#f0c040" : "#e8e8e8";
    context.beginPath();
    context.arc(cx, cy, size / 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(0,0,0,0.55)";
    context.lineWidth = 1;
    context.stroke();
  }
}

export function mapScreenshotFileName(map: GameMap): string {
  return `${sanitizeFileName(map.name)}-map.png`;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) {
          resolve(blob);
          return;
        }
        // toBlob 실패 시 dataURL 폴백 (일부 환경)
        try {
          const dataUrl = canvas.toDataURL("image/png");
          const comma = dataUrl.indexOf(",");
          if (comma < 0) {
            reject(new MapScreenshotError("PNG 파일을 만들지 못했습니다."));
            return;
          }
          const binary = atob(dataUrl.slice(comma + 1));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
          resolve(new Blob([bytes], { type: "image/png" }));
        } catch {
          reject(new MapScreenshotError("PNG 파일을 만들지 못했습니다. (캔버스 오염/용량)"));
        }
      }, "image/png");
    } catch {
      reject(new MapScreenshotError("PNG 인코딩에 실패했습니다."));
    }
  });
}

function sanitizeFileName(value: string): string {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_").replace(/\s+/g, "_");
  return sanitized.length > 0 ? sanitized : "map";
}
