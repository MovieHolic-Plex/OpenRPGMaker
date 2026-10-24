// 「다른 맵을 줄여 그린 배경」(MapBackgroundMapView) — 옥상·전망대에서 내려다본 아래 동네.
//
// 아래 맵의 타일 층을 원 크기로 한 번 그린 뒤 scale 배로 줄이고(가장 가까운 화소, 도트 결 유지)
// 채도를 빼고 안개 색을 섞어 «멀리 아래» 로 보이게 한다. 이벤트·탈것은 그리지 않는다(정지한 동네).
// 결과는 캔버스 하나이고, 배경 층의 그림처럼 텍스처로 올린다(playSceneMapBackground).
import { drawMapTileLayers, loadTilesetImage } from "@/editor/mapTileDraw";
import { withWorldCoastRenderPass } from "@/project/defaults/worldCoastMapping";
import { MAP_VIEW_SCALE_RANGE } from "@/project/mapBackground";
import type { MapBackgroundMapView, Project } from "@/project/types";

const DEFAULT_HAZE = 0.25;
const DEFAULT_DESATURATE = 0.3;
const DEFAULT_HAZE_COLOR = "#c9d6e3";

/** 텍스처 키 — 같은 맵·같은 보기 값이면 같은 키(다시 그리지 않는다). */
export function mapViewTextureKey(view: MapBackgroundMapView): string {
  const s = view.scale ?? MAP_VIEW_SCALE_RANGE.default;
  const r = view.region;
  const parts = [view.mapId, s, view.haze ?? DEFAULT_HAZE, view.desaturate ?? DEFAULT_DESATURATE, view.hazeColor ?? DEFAULT_HAZE_COLOR, ...(r ? [r.x, r.y, r.width, r.height] : []), view.feather ?? 0];
  return `__oprn_map_view_${parts.join("_").replace(/[^a-z0-9_.-]/gi, "_")}`;
}

/** 그릴 칸 범위 — region 을 맵 안으로 자른다(없으면 맵 전체). */
export function mapViewRegion(project: Project, view: MapBackgroundMapView): { x: number; y: number; width: number; height: number } | null {
  const map = project.maps[view.mapId];
  if (!map) return null;
  const r = view.region;
  if (!r) return { x: 0, y: 0, width: map.width, height: map.height };
  const x = Math.min(Math.max(0, r.x), map.width - 1), y = Math.min(Math.max(0, r.y), map.height - 1);
  return { x, y, width: Math.max(1, Math.min(r.width, map.width - x)), height: Math.max(1, Math.min(r.height, map.height - y)) };
}

/** 줄인 그림 크기(px). */
export function mapViewSize(project: Project, view: MapBackgroundMapView): { width: number; height: number } | null {
  const map = project.maps[view.mapId];
  const region = mapViewRegion(project, view);
  if (!map || !region) return null;
  const s = view.scale ?? MAP_VIEW_SCALE_RANGE.default;
  return { width: Math.max(1, Math.round(region.width * map.tileSize * s)), height: Math.max(1, Math.round(region.height * map.tileSize * s)) };
}

function hexRgb(hex: string): [number, number, number] {
  const h = /^#([0-9a-f]{6})$/i.exec(hex)?.[1] ?? "c9d6e3";
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * 화소 처리(순수) — 채도 빼기 후 안개 색과 섞는다. 투명 화소는 안개 색 그대로 불투명으로(하늘·빈 칸이 구멍으로 남지 않게).
 * feather>0 이면 가장자리 띠(짧은 변 × feather)를 바깥으로 갈수록 투명하게 한다(width·height 필요).
 */
export function applyMapViewAtmosphere(data: Uint8ClampedArray, haze: number, desaturate: number, hazeColor: string, feather = 0, width = 0, height = 0): void {
  const [hr, hg, hb] = hexRgb(hazeColor);
  const band = feather > 0 && width > 0 && height > 0 ? Math.max(1, height * feather) : 0;
  for (let i = 0; i < data.length; i += 4) {
    const edge = band > 0 ? (() => {
      // 위·아래 가장자리만 — 가로는 보통 반복해서 좌우를 녹이면 이음매마다 틈이 생긴다.
      const y = Math.floor(i / 4 / width);
      const d = Math.min(y + 0.5, height - y - 0.5);
      return d >= band ? 1 : d / band;
    })() : 1;
    if (data[i + 3]! < 8) { data[i] = hr; data[i + 1] = hg; data[i + 2] = hb; data[i + 3] = Math.round(255 * edge); continue; }
    let r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r += (l - r) * desaturate; g += (l - g) * desaturate; b += (l - b) * desaturate;
    data[i] = r + (hr - r) * haze; data[i + 1] = g + (hg - g) * haze; data[i + 2] = b + (hb - b) * haze; data[i + 3] = Math.round(255 * edge);
  }
}

/**
 * 아래 맵을 줄여 그린 캔버스. 타일셋 그림을 못 읽으면 null(배경 층은 건너뛴다).
 * 큰 맵(50×50·16px = 800px)을 원 크기로 그려도 한 번뿐이고, 결과는 텍스처 캐시에 남는다.
 */
export async function renderMapViewCanvas(project: Project, view: MapBackgroundMapView): Promise<HTMLCanvasElement | null> {
  const map = project.maps[view.mapId];
  const tileset = map ? project.tilesets[map.tilesetId] : undefined;
  const size = mapViewSize(project, view);
  const region = mapViewRegion(project, view);
  if (!map || !tileset || !size || !region || typeof document === "undefined") return null;
  let image;
  try { image = await loadTilesetImage(tileset); } catch { return null; }
  const full = document.createElement("canvas");
  full.width = map.width * map.tileSize;
  full.height = map.height * map.tileSize;
  const fctx = full.getContext("2d");
  if (!fctx) return null;
  fctx.imageSmoothingEnabled = false;
  withWorldCoastRenderPass(() => drawMapTileLayers(fctx, image, map, tileset, map.tileSize / tileset.tileSize));
  const out = document.createElement("canvas");
  out.width = size.width;
  out.height = size.height;
  const octx = out.getContext("2d");
  if (!octx) return null;
  // 줄일 때는 부드럽게 — 가장 가까운 화소로 1/3 까지 줄이면 선이 끊겨 지저분한 점이 된다. 멀리 있는 동네는 조금 흐려도 맞다.
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = "high";
  const ts = map.tileSize;
  octx.drawImage(full, region.x * ts, region.y * ts, region.width * ts, region.height * ts, 0, 0, size.width, size.height);
  const pixels = octx.getImageData(0, 0, size.width, size.height);
  applyMapViewAtmosphere(pixels.data, view.haze ?? DEFAULT_HAZE, view.desaturate ?? DEFAULT_DESATURATE, view.hazeColor ?? DEFAULT_HAZE_COLOR, view.feather ?? 0, size.width, size.height);
  octx.putImageData(pixels, 0, 0);
  return out;
}
