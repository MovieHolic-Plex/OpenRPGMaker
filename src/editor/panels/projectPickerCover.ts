// DB 연결 모달의 프로젝트 목록 카드 커버.
//
// current_json(20MB+)을 건드리지 않고 maps/tilesets 테이블에서 대표 맵 1장과
// 그 타일셋만 받아 실제 맵 그림을 그린다. 재료를 못 구하면 프로젝트 id 해시로
// 만든 대체 커버를 그린다 — 빈 회색 칸을 남기지 않되, 맵 그림인 척하지도 않는다.
import { drawMapTileLayers, loadTilesetImage } from "@/editor/mapTileDraw";
import { loadSupabaseProjectPreview, type SupabaseProjectListConfig } from "@/project/supabaseProjectSync";

export const COVER_WIDTH = 320;
export const COVER_HEIGHT = 200;

/** 동시 요청 상한 — dbserver를 목록 크기만큼 한꺼번에 때리지 않는다. */
const MAX_PARALLEL = 3;

const CACHE_PREFIX = "oprn:project-cover:";
const memoryCache = new Map<string, string>();

let active = 0;
const queue: (() => void)[] = [];

function acquire(): Promise<void> {
  if (active < MAX_PARALLEL) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queue.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = queue.shift();
  if (next) next();
}

function cacheKey(projectId: string, updatedAt: string | null): string {
  return `${CACHE_PREFIX}${projectId}@${updatedAt ?? "-"}`;
}

function readCache(key: string): string | null {
  const hit = memoryCache.get(key);
  if (hit) return hit;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored) memoryCache.set(key, stored);
    return stored;
  } catch {
    return null;
  }
}

function writeCache(key: string, dataUrl: string): void {
  memoryCache.set(key, dataUrl);
  try {
    window.sessionStorage.setItem(key, dataUrl);
  } catch {
    // 용량 초과는 무시 — 메모리 캐시만으로도 같은 세션 재렌더는 막힌다.
  }
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 재료를 못 구했을 때의 대체 커버. 같은 프로젝트는 항상 같은 그림이 나온다. */
export function drawFallbackCover(context: CanvasRenderingContext2D, projectId: string): void {
  let seed = hash(projectId);
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const hue = hash(projectId) % 360;

  context.fillStyle = `hsl(${hue}, 18%, 16%)`;
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);

  const cols = 8 + Math.floor(random() * 4);
  const cellW = COVER_WIDTH / cols;
  const rows = Math.max(1, Math.round(COVER_HEIGHT / cellW));
  const cellH = COVER_HEIGHT / rows;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const r = random();
      if (r < 0.45) continue;
      context.fillStyle = `hsla(${hue}, 42%, 62%, ${(0.08 + r * 0.34).toFixed(3)})`;
      context.fillRect(x * cellW + cellW * 0.16, y * cellH + cellH * 0.16, cellW * 0.68, cellH * 0.68);
    }
  }
}

function fitScale(mapPixelWidth: number, mapPixelHeight: number): number {
  if (mapPixelWidth <= 0 || mapPixelHeight <= 0) return 1;
  return Math.min(COVER_WIDTH / mapPixelWidth, COVER_HEIGHT / mapPixelHeight);
}

async function renderMapCover(
  context: CanvasRenderingContext2D,
  config: SupabaseProjectListConfig,
  projectId: string,
): Promise<boolean> {
  const preview = await loadSupabaseProjectPreview(config, projectId);
  if (!preview) return false;

  const { map, tileset } = preview;
  const tile = map.tileSize || tileset.tileSize || 16;
  const pixelWidth = map.width * tile;
  const pixelHeight = map.height * tile;
  if (pixelWidth <= 0 || pixelHeight <= 0) return false;

  const image = await loadTilesetImage(tileset);
  if ("complete" in image && (!image.complete || image.naturalWidth === 0)) return false;

  const scale = fitScale(pixelWidth, pixelHeight);
  const drawWidth = Math.max(1, Math.floor(pixelWidth * scale));
  const drawHeight = Math.max(1, Math.floor(pixelHeight * scale));

  // 맵 전체가 보이도록 contain 배치 — 픽커에서는 확대보다 형태 파악이 중요하다.
  const stage = document.createElement("canvas");
  stage.width = drawWidth;
  stage.height = drawHeight;
  const stageContext = stage.getContext("2d", { alpha: false });
  if (!stageContext) return false;
  stageContext.imageSmoothingEnabled = false;
  stageContext.fillStyle = "#3d6b3a";
  stageContext.fillRect(0, 0, drawWidth, drawHeight);
  drawMapTileLayers(stageContext, image, map, tileset, scale);

  context.imageSmoothingEnabled = false;
  context.fillStyle = "#22252c";
  context.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
  context.drawImage(
    stage,
    Math.floor((COVER_WIDTH - drawWidth) / 2),
    Math.floor((COVER_HEIGHT - drawHeight) / 2),
  );
  return true;
}

/**
 * 카드 캔버스에 커버를 그린다. 성공하면 "map", 대체 커버면 "fallback".
 * 실패해도 예외를 던지지 않는다 — 목록 렌더가 커버 하나 때문에 멈추면 안 된다.
 */
export async function paintProjectCover(
  canvas: HTMLCanvasElement,
  config: SupabaseProjectListConfig,
  projectId: string,
  updatedAt: string | null,
): Promise<"map" | "fallback"> {
  canvas.width = COVER_WIDTH;
  canvas.height = COVER_HEIGHT;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return "fallback";

  const key = cacheKey(projectId, updatedAt);
  const cached = readCache(key);
  if (cached) {
    const drawn = await new Promise<boolean>((resolve) => {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, COVER_WIDTH, COVER_HEIGHT);
        resolve(true);
      };
      image.onerror = () => resolve(false);
      image.src = cached;
    });
    if (drawn) return "map";
  }

  await acquire();
  try {
    const ok = await renderMapCover(context, config, projectId);
    if (ok) {
      try {
        writeCache(key, canvas.toDataURL("image/webp", 0.7));
      } catch {
        // 타일셋이 교차 출처면 toDataURL이 막힌다. 그림 자체는 이미 그려졌다.
      }
      return "map";
    }
  } catch {
    // 아래 대체 커버로 떨어진다.
  } finally {
    release();
  }

  drawFallbackCover(context, projectId);
  return "fallback";
}
