import { tilesetImageUrl } from "@/editor/tilesetImage";
import { cellsInFillShape } from "@/editor/tools/v3/constructionTools";
import { buildTerrainConstraintMasks, type Rect } from "@/editor/tools/villageTerrainPass";
import { inferRequirementsFromQuery } from "@/editor/tools/villageRequirements";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { GameMap, TilesetDef } from "@/project/types";
import {
  broadleafCountFor,
  coniferCountFor,
  waterShapeFor,
  type ResolvedWorldGenRules,
} from "@/project/worldGenRules";
import { el } from "@/util/dom";

const CONIFER_TOP = 260;
const CONIFER_BOTTOM = 290;
const BROADLEAF_TOP_LEFT = 262;
const BROADLEAF_TOP_RIGHT = 263;
const BROADLEAF_BOTTOM_LEFT = 292;
const BROADLEAF_BOTTOM_RIGHT = 293;

export interface WorldGenPreviewOptions {
  readonly rules: ResolvedWorldGenRules;
  /** 자연어 프롬프트. 낱말 규칙을 그대로 태우므로 미리보기가 규칙 시험대가 된다. */
  readonly query: string;
  readonly cols?: number;
  readonly rows?: number;
  readonly cellPx?: number;
  readonly testid: string;
}

export interface WorldGenPreviewFacts {
  readonly landmarks: readonly string[];
  readonly waterCells: number;
  readonly coniferCount: number;
  readonly broadleafCount: number;
  readonly riverBandDepth: number;
  readonly forestBandDepth: number;
  readonly buildable: Rect;
}

/**
 * 규칙 → 실제 시공기와 **같은 함수**로 계산한 미리보기.
 *
 * 마스크는 `buildTerrainConstraintMasks`, 수면 모양은 `cellsInFillShape`(fill_region 본체),
 * 나무 수는 `coniferCountFor`/`broadleafCountFor` 를 쓴다. 미리보기 전용 근사식을 두면
 * 저자가 본 그림과 깔린 맵이 갈라지므로 어떤 계산도 이 파일에서 새로 만들지 않는다.
 */
export function renderWorldGenPreview(options: WorldGenPreviewOptions): {
  readonly element: HTMLElement;
  readonly facts: WorldGenPreviewFacts;
} {
  const cols = options.cols ?? 60;
  const rows = options.rows ?? 44;
  const cellPx = options.cellPx ?? 7;
  const map: Pick<GameMap, "width" | "height"> = { width: cols, height: rows };
  const requirements = inferRequirementsFromQuery(options.query, options.rules);
  const masks = buildTerrainConstraintMasks(map, requirements, undefined, options.rules);

  const canvas = document.createElement("canvas");
  canvas.width = cols * cellPx;
  canvas.height = rows * cellPx;
  canvas.className = "wg-preview-canvas";
  canvas.dataset.testid = `${options.testid}-canvas`;
  canvas.setAttribute("role", "img");

  const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID];
  const plan = buildPreviewPlan(masks, options.rules, cols, rows);
  canvas.setAttribute(
    "aria-label",
    `미리보기: 물 ${plan.waterCells}칸, 침엽수 목표 ${plan.coniferCount}그루, 활엽수 목표 ${plan.broadleafCount}그루`,
  );

  if (tileset) paintWithChipset(canvas, tileset, plan, cellPx);

  const element = el("div", {
    class: "wg-preview",
    dataset: { testid: options.testid, landmarks: requirements.landmarks.join(",") || "none" },
    children: tileset
      ? [canvas]
      : [
          el("div", {
            class: "wg-preview-fallback",
            attrs: { role: "status" },
            text: "기본 타일셋이 없어 그림 미리보기를 표시할 수 없습니다.",
          }),
        ],
  });

  return {
    element,
    facts: {
      landmarks: requirements.landmarks,
      waterCells: plan.waterCells,
      coniferCount: plan.coniferCount,
      broadleafCount: plan.broadleafCount,
      riverBandDepth: plan.riverBandDepth,
      forestBandDepth: plan.forestBandDepth,
      buildable: masks.buildableRect,
    },
  };
}

type TilePlacement = { readonly x: number; readonly y: number; readonly tile: number };

type PreviewPlan = {
  readonly cols: number;
  readonly rows: number;
  readonly ground: readonly TilePlacement[];
  readonly overlay: readonly TilePlacement[];
  readonly waterCells: number;
  readonly coniferCount: number;
  readonly broadleafCount: number;
  readonly riverBandDepth: number;
  readonly forestBandDepth: number;
};

function buildPreviewPlan(
  masks: ReturnType<typeof buildTerrainConstraintMasks>,
  rules: ResolvedWorldGenRules,
  cols: number,
  rows: number,
): PreviewPlan {
  const ground: TilePlacement[] = [];
  const overlay: TilePlacement[] = [];
  const occupied = new Set<string>();
  const key = (x: number, y: number): string => `${x},${y}`;

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) ground.push({ x, y, tile: TILE.GRASS });
  }

  const shapeMap: GameMap = { width: cols, height: rows } as GameMap;
  let waterCells = 0;
  const water = new Set<string>();
  for (const rect of masks.waterRects) {
    const shape = waterShapeFor(rect.w, rect.h, rules.water);
    for (const cell of cellsInFillShape(shapeMap, rect, shape)) {
      if (water.has(key(cell.x, cell.y))) continue;
      water.add(key(cell.x, cell.y));
      ground.push({ x: cell.x, y: cell.y, tile: TILE.WATER });
      waterCells += 1;
    }
  }

  const pathTile = rules.road.pathStyle === "sand"
    ? SAND_TILE.BODY
    : rules.road.pathStyle === "stone"
      ? TILE.PATH
      : DIRT_ROAD_TILE.BODY;
  for (const cell of villageRoadCells(masks.buildableRect, rules)) {
    if (water.has(key(cell.x, cell.y))) continue;
    if (cell.x < 0 || cell.y < 0 || cell.x >= cols || cell.y >= rows) continue;
    ground.push({ x: cell.x, y: cell.y, tile: pathTile });
    occupied.add(key(cell.x, cell.y));
  }

  let coniferCount = 0;
  let broadleafCount = 0;
  for (const [index, rect] of masks.forestRects.entries()) {
    const areaTiles = rect.w * rect.h;
    const conifers = coniferCountFor(areaTiles, rules.forest);
    const broadleaves = broadleafCountFor(areaTiles, rules.forest);
    coniferCount += conifers;
    broadleafCount += broadleaves;
    const rng = mulberry(7700 + index * 13 + rect.x * 31 + rect.y * 17);

    for (const spot of scatter(rect, broadleaves, rules.forest.broadleafGap + 1, rng, occupied, water, 2, 2)) {
      overlay.push({ x: spot.x, y: spot.y, tile: BROADLEAF_TOP_LEFT });
      overlay.push({ x: spot.x + 1, y: spot.y, tile: BROADLEAF_TOP_RIGHT });
      overlay.push({ x: spot.x, y: spot.y + 1, tile: BROADLEAF_BOTTOM_LEFT });
      overlay.push({ x: spot.x + 1, y: spot.y + 1, tile: BROADLEAF_BOTTOM_RIGHT });
    }
    for (const spot of scatter(rect, conifers, rules.forest.coniferGap, rng, occupied, water, 1, 2)) {
      overlay.push({ x: spot.x, y: spot.y, tile: CONIFER_TOP });
      overlay.push({ x: spot.x, y: spot.y + 1, tile: CONIFER_BOTTOM });
    }
  }

  return {
    cols,
    rows,
    ground,
    overlay,
    waterCells,
    coniferCount,
    broadleafCount,
    riverBandDepth: masks.waterRects[0] ? Math.min(masks.waterRects[0].w, masks.waterRects[0].h) : 0,
    forestBandDepth: masks.forestRects[0] ? Math.min(masks.forestRects[0].w, masks.forestRects[0].h) : 0,
  };
}

/** 주거 영역의 길·광장 얼개. 시공기의 도로 배치를 그대로 재현하지 않고 "이 톤" 만 보여준다. */
function villageRoadCells(
  buildable: Rect,
  rules: ResolvedWorldGenRules,
): readonly { readonly x: number; readonly y: number }[] {
  const cells: { x: number; y: number }[] = [];
  if (buildable.w < 6 || buildable.h < 6) return cells;
  const midY = buildable.y + Math.floor(buildable.h / 2);
  const midX = buildable.x + Math.floor(buildable.w / 2);
  for (let x = buildable.x + 1; x < buildable.x + buildable.w - 1; x += 1) {
    cells.push({ x, y: midY }, { x, y: midY + 1 });
  }
  for (let y = buildable.y + 1; y < buildable.y + buildable.h - 1; y += 1) {
    cells.push({ x: midX, y }, { x: midX + 1, y });
  }
  if (rules.road.plazaStyle === "empty") return cells;
  const plaza = plazaRect(buildable, rules);
  for (let y = plaza.y; y < plaza.y + plaza.h; y += 1) {
    for (let x = plaza.x; x < plaza.x + plaza.w; x += 1) cells.push({ x, y });
  }
  return cells;
}

function plazaRect(buildable: Rect, rules: ResolvedWorldGenRules): Rect {
  const size = Math.max(4, Math.floor(Math.min(buildable.w, buildable.h) * 0.24));
  const centerX = buildable.x + Math.floor((buildable.w - size) / 2);
  const centerY = buildable.y + Math.floor((buildable.h - size) / 2);
  switch (rules.road.plazaLayout) {
    case "north":
      return { x: centerX, y: buildable.y + 2, w: size, h: size };
    case "south":
      return { x: centerX, y: buildable.y + buildable.h - size - 2, w: size, h: size };
    case "west":
      return { x: buildable.x + 2, y: centerY, w: size, h: size };
    case "east":
      return { x: buildable.x + buildable.w - size - 2, y: centerY, w: size, h: size };
    default:
      return { x: centerX, y: centerY, w: size, h: size };
  }
}

/**
 * 최소 간격을 지키는 시드 산포. place_props 와 같은 "간격 우선 거절" 규칙이라
 * 간격을 좁히면 실제로 더 빽빽해지고, 넓히면 목표 그루 수를 못 채운다 —
 * 저자가 슬라이더로 보게 되는 바로 그 트레이드오프.
 */
function scatter(
  rect: Rect,
  count: number,
  minGap: number,
  rng: () => number,
  occupied: Set<string>,
  water: Set<string>,
  footprintW: number,
  footprintH: number,
): readonly { readonly x: number; readonly y: number }[] {
  const spots: { x: number; y: number }[] = [];
  if (count <= 0) return spots;
  const attempts = count * 24;
  for (let i = 0; i < attempts && spots.length < count; i += 1) {
    const x = rect.x + Math.floor(rng() * Math.max(1, rect.w - footprintW));
    const y = rect.y + Math.floor(rng() * Math.max(1, rect.h - footprintH));
    let blocked = false;
    for (let dy = 0; dy < footprintH && !blocked; dy += 1) {
      for (let dx = 0; dx < footprintW; dx += 1) {
        const cell = `${x + dx},${y + dy}`;
        if (occupied.has(cell) || water.has(cell)) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;
    if (spots.some((spot) => Math.abs(spot.x - x) < minGap && Math.abs(spot.y - y) < minGap)) continue;
    spots.push({ x, y });
    for (let dy = 0; dy < footprintH; dy += 1) {
      for (let dx = 0; dx < footprintW; dx += 1) occupied.add(`${x + dx},${y + dy}`);
    }
  }
  return spots;
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintWithChipset(
  canvas: HTMLCanvasElement,
  tileset: TilesetDef,
  plan: PreviewPlan,
  cellPx: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = new Image();
  image.decoding = "async";
  image.onload = () => {
    if (!canvas.isConnected) return;
    ctx.imageSmoothingEnabled = false;
    const size = tileset.tileSize;
    const perRow = tileset.tilesPerRow;
    const draw = (placement: TilePlacement): void => {
      if (placement.x < 0 || placement.y < 0 || placement.x >= plan.cols || placement.y >= plan.rows) return;
      const column = placement.tile % perRow;
      const row = Math.floor(placement.tile / perRow);
      ctx.drawImage(
        image,
        column * size,
        row * size,
        size,
        size,
        placement.x * cellPx,
        placement.y * cellPx,
        cellPx,
        cellPx,
      );
    };
    for (const placement of plan.ground) draw(placement);
    for (const placement of plan.overlay) draw(placement);
    canvas.dataset.painted = "1";
  };
  image.src = tilesetImageUrl(tileset);
}
