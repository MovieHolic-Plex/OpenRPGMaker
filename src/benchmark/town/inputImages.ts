// benchmark/town/inputImages.ts
// 헤드리스 · 바이트 결정적 입력 이미지 렌더러.
//
// 브라우저 캔버스를 쓰지 않는다(1세대 src/benchmark/inputImages.ts 는 캔버스라
// CI 에서 돌지 않는다). jimp 로 PNG 를 직접 인코딩하므로 Node · vitest 어디서든
// 같은 바이트가 나오고, 그 바이트의 sha256 이 매니페스트에 들어간다.
//
// 안티게이밍 하드 규칙: 어떤 이미지에도 **글자를 그리지 않는다** — 타일 번호도,
// 라벨도, 범례도 없다. jimp 의 print/loadFont 를 호출하지 않으며
// test/townBenchInputImages.test.ts 가 소스에 그 API 가 없음을 검사한다.
// 팔레트 스트립은 오름차순 읽기 순서로만 id 와 대응한다(프롬프트가 그렇게 말한다).
//
// 이미지 하나 = 태스크 하나. 배치 태스크의 이미지는 위에 팔레트 스트립, 아래에
// 마킹된 그리드를 쌓은 한 장이다 — 모델이 "이 id 가 어떤 그림인지"를 보려면
// 둘이 같은 그림 안에 있어야 한다.

import Jimp from "jimp";
import { rectHouseHeight } from "@/editor/houseKit";
import { expandRect } from "@/editor/tools/village/constants";
import { sha256HexBytes } from "../interior/hash";
import {
  AFRAME_GRID,
  AUTOTILE_SHAPE_HEIGHT,
  AUTOTILE_SHAPE_ROWS,
  AUTOTILE_SHAPE_WIDTH,
  DOOR_GRID,
  FENCE_GRID,
  LAYER_PROBE_TILES,
  PASSABILITY_PROBE_TILES,
  ROAD_GRID,
  TREE_GRID,
  VILLAGE_GRID,
  WALL_GRID,
  WALL_PROBE_TILES,
  type FixtureHousePlan,
} from "./fixtures";
import { buildTownGroundTruth } from "./groundTruth";
import { paletteFor } from "./palettes";
import {
  EMPTY_CELL,
  TOWN_TILES_PER_ROW,
  TOWN_TILE_SIZE,
  type TownImageKey,
  type TownPlacementKey,
} from "./types";

export const TOWN_CHIPSET_PNG_PATH = "public/assets/easyrpg-chipset-combined-town-transparent.png";

/** 팔레트 타일 확대 배율(3배 = 48px) — 그림을 구분할 수 있는 최소 크기. */
const PALETTE_SCALE = 3;
/** 그리드 셀 확대 배율(2배 = 32px). */
const GRID_SCALE = 2;
/**
 * 팔레트 스트립 한 줄에 놓는 타일 수. 넘치면 다음 줄로 감는다(읽기 순서).
 * 8 로 좁게 잡은 이유: 16 이면 스트립 폭(768px)이 작은 그리드(9칸=288px)보다
 * 훨씬 넓어져 이미지의 절반 이상이 빈 배경이 된다 — 비전 토큰 낭비다.
 */
const PALETTE_PER_ROW = 8;
/** 팔레트와 그리드 사이 구분 띠 높이(px). */
const SEPARATOR_HEIGHT = 8;

const BACKGROUND = 0x20232aff;
const LATTICE = 0x3a3f4bff;
const SEPARATOR = 0x11131aff;

// 마킹 색 — 서로 충분히 떨어진 색만 쓴다(모델이 색을 구분해야 한다).
const MARK_PATH = 0x8a6a3aff; // 오토타일 도형: 길로 칠할 칸
const MARK_TREE = 0x2f7d4fff; // 나무 심을 칸
const MARK_BUILDING = 0x4a4f5aff; // 길 과제: 침범 금지 건물
const MARK_ANCHOR = 0xffcc00ff; // 이어야 하는 지점 / 문 자리 / 길 진입점
const MARK_FOOTPRINT = 0x3f77a8ff; // 집 발자국
const MARK_PLAZA = 0x7a4fa8ff; // 광장
const MARK_FENCE_LINE = 0xd8d8d8ff; // 울타리를 칠 줄

export const TOWN_IMAGE_KEYS: readonly TownImageKey[] = Object.freeze([
  "wallProbe",
  "passabilityProbe",
  "layerProbe",
  "autotileShape",
  "treeGrid",
  "roadGrid",
  "wallGrid",
  "aframeGrid",
  "doorGrid",
  "fenceGrid",
  "villageGrid",
]);

/**
 * PNG 인코딩을 고정한다. jimp 는 기본적으로 타임스탬프 같은 가변 메타데이터를
 * 넣지 않지만, 필터 타입과 deflate 레벨을 명시해 두어야 라이브러리 기본값이
 * 바뀌어도 바이트가 흔들리지 않는다.
 */
function pinPngEncoding(image: Jimp): void {
  image.deflateLevel(9);
  image.deflateStrategy(0);
  image.filterType(Jimp.PNG_FILTER_NONE);
  image.colorType(6);
}

async function encodePng(image: Jimp): Promise<Uint8Array> {
  pinPngEncoding(image);
  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
  return Uint8Array.from(buffer as unknown as ArrayLike<number>);
}

let sheetPromise: Promise<Jimp> | null = null;

/** 칩셋 시트를 한 번만 읽는다(11장을 그리는 동안 같은 픽셀을 다시 읽지 않는다). */
async function chipsetSheet(): Promise<Jimp> {
  if (!sheetPromise) {
    sheetPromise = Jimp.read(TOWN_CHIPSET_PNG_PATH).then((sheet) => {
      const rows = 480 / TOWN_TILES_PER_ROW;
      const width = TOWN_TILES_PER_ROW * TOWN_TILE_SIZE;
      const height = rows * TOWN_TILE_SIZE;
      if (sheet.getWidth() !== width || sheet.getHeight() !== height) {
        throw new Error(
          `town inputImages: 시트 크기 불일치 — ${sheet.getWidth()}x${sheet.getHeight()} (기대 ${width}x${height})`,
        );
      }
      return sheet;
    });
  }
  return sheetPromise;
}

/**
 * 타일 하나를 nearest-neighbour 정수배로 그린다. 투명 픽셀은 배경을 그대로 남겨
 * 상위 소품(캐노피·캡)이 "뒤가 비치는 조각"으로 보이게 한다 — 레이어 문항의
 * 핵심 단서가 투명도이므로 불투명 배경으로 뭉개면 안 된다.
 */
function drawTile(canvas: Jimp, sheet: Jimp, tileId: number, destX: number, destY: number, scale: number): void {
  const sourceX = (tileId % TOWN_TILES_PER_ROW) * TOWN_TILE_SIZE;
  const sourceY = Math.floor(tileId / TOWN_TILES_PER_ROW) * TOWN_TILE_SIZE;
  for (let y = 0; y < TOWN_TILE_SIZE; y += 1) {
    for (let x = 0; x < TOWN_TILE_SIZE; x += 1) {
      const colour = sheet.getPixelColor(sourceX + x, sourceY + y);
      if ((colour & 0xff) === 0) continue; // 완전 투명 — 배경 유지
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          canvas.setPixelColor(colour, destX + x * scale + dx, destY + y * scale + dy);
        }
      }
    }
  }
}

/** 셀 하나를 단색으로 채운다(격자선 1px 은 남긴다). */
function fillCell(canvas: Jimp, destX: number, destY: number, size: number, colour: number): void {
  for (let y = 1; y < size; y += 1) {
    for (let x = 1; x < size; x += 1) canvas.setPixelColor(colour, destX + x, destY + y);
  }
}

/** 셀 하나에 테두리만 그린다(바탕 그림을 지우지 않고 표시할 때). */
function outlineCell(canvas: Jimp, destX: number, destY: number, size: number, colour: number): void {
  const thickness = 3;
  for (let t = 0; t < thickness; t += 1) {
    for (let x = 0; x < size; x += 1) {
      canvas.setPixelColor(colour, destX + x, destY + t);
      canvas.setPixelColor(colour, destX + x, destY + size - 1 - t);
    }
    for (let y = 0; y < size; y += 1) {
      canvas.setPixelColor(colour, destX + t, destY + y);
      canvas.setPixelColor(colour, destX + size - 1 - t, destY + y);
    }
  }
}

function drawLattice(canvas: Jimp, originY: number, width: number, height: number, cell: number): void {
  for (let x = 0; x <= width; x += cell) {
    for (let y = 0; y < height; y += 1) canvas.setPixelColor(LATTICE, Math.min(x, width - 1), originY + y);
  }
  for (let y = 0; y <= height; y += cell) {
    for (let x = 0; x < width; x += 1) canvas.setPixelColor(LATTICE, x, originY + Math.min(y, height - 1));
  }
}

// ── 프로브 스트립 ─────────────────────────────────────────────────────────

async function renderProbeStrip(tiles: readonly number[]): Promise<Uint8Array> {
  const sheet = await chipsetSheet();
  const cell = TOWN_TILE_SIZE * PALETTE_SCALE;
  const canvas = new Jimp(cell * tiles.length, cell, BACKGROUND);
  for (let index = 0; index < tiles.length; index += 1) {
    drawTile(canvas, sheet, tiles[index]!, index * cell, 0, PALETTE_SCALE);
  }
  drawLattice(canvas, 0, cell * tiles.length, cell, cell);
  return encodePng(canvas);
}

// ── 팔레트 + 그리드 ───────────────────────────────────────────────────────

interface GridMark {
  readonly x: number;
  readonly y: number;
  readonly colour: number;
  /** true 면 바탕 그림을 지우지 않고 테두리만 그린다. */
  readonly outline?: boolean;
}

function footprintMarks(plan: FixtureHousePlan, colour: number): GridMark[] {
  const height = rectHouseHeight({
    stories: plan.stories,
    roofBodyRows: plan.roofBodyRows,
    kitId: plan.kitId,
    width: plan.width,
    lowWall: plan.lowWall,
  });
  const marks: GridMark[] = [];
  for (let y = plan.y; y < plan.y + height; y += 1) {
    for (let x = plan.x; x < plan.x + plan.width; x += 1) marks.push({ x, y, colour });
  }
  return marks;
}

function marksFor(key: TownPlacementKey | "autotileShape"): GridMark[] {
  if (key === "autotileShape") {
    const marks: GridMark[] = [];
    for (let y = 0; y < AUTOTILE_SHAPE_HEIGHT; y += 1) {
      const row = AUTOTILE_SHAPE_ROWS[y] ?? "";
      for (let x = 0; x < AUTOTILE_SHAPE_WIDTH; x += 1) {
        if (row[x] === "X") marks.push({ x, y, colour: MARK_PATH });
      }
    }
    return marks;
  }
  if (key === "treeGrid") {
    return TREE_GRID.spots.map((spot) => ({ x: spot.x, y: spot.y, colour: MARK_TREE }));
  }
  if (key === "roadGrid") {
    const marks: GridMark[] = [];
    for (const building of ROAD_GRID.buildings) {
      for (let y = building.y; y < building.y + building.h; y += 1) {
        for (let x = building.x; x < building.x + building.w; x += 1) marks.push({ x, y, colour: MARK_BUILDING });
      }
    }
    for (const anchor of ROAD_GRID.anchors) marks.push({ x: anchor.x, y: anchor.y, colour: MARK_ANCHOR });
    return marks;
  }
  if (key === "wallGrid") return footprintMarks(WALL_GRID.house, MARK_FOOTPRINT);
  if (key === "aframeGrid") return footprintMarks(AFRAME_GRID.house, MARK_FOOTPRINT);
  if (key === "doorGrid") {
    return [{ x: DOOR_GRID.doorAt.x, y: DOOR_GRID.doorAt.y, colour: MARK_ANCHOR, outline: true }];
  }
  if (key === "fenceGrid") {
    // 울타리를 칠 줄 = 필지 앞줄. 문 앞 ±1 은 게이트로 따로 표시한다.
    // 필지는 **집 bbox** + 1칸이다 — 그리드 높이를 넣으면 앞줄이 엉뚱한 행이 된다.
    const houseHeight = rectHouseHeight({
      stories: FENCE_GRID.house.stories,
      roofBodyRows: FENCE_GRID.house.roofBodyRows,
      kitId: FENCE_GRID.house.kitId,
      width: FENCE_GRID.house.width,
      lowWall: FENCE_GRID.house.lowWall,
    });
    const lot = expandRect(
      { x: FENCE_GRID.house.x, y: FENCE_GRID.house.y, w: FENCE_GRID.house.width, h: houseHeight },
      1,
    );
    const lastY = Math.min(FENCE_GRID.height - 1, lot.y + lot.h - 1);
    const marks: GridMark[] = [];
    for (let x = Math.max(0, lot.x); x < Math.min(FENCE_GRID.width, lot.x + lot.w); x += 1) {
      const isGate = Math.abs(x - FENCE_GRID.doorAt.x) <= 1;
      marks.push({ x, y: lastY, colour: isGate ? MARK_ANCHOR : MARK_FENCE_LINE, outline: true });
    }
    return marks;
  }
  const marks: GridMark[] = [];
  for (const house of VILLAGE_GRID.houses) marks.push(...footprintMarks(house, MARK_FOOTPRINT));
  for (let y = VILLAGE_GRID.plaza.y; y < VILLAGE_GRID.plaza.y + VILLAGE_GRID.plaza.h; y += 1) {
    for (let x = VILLAGE_GRID.plaza.x; x < VILLAGE_GRID.plaza.x + VILLAGE_GRID.plaza.w; x += 1) {
      marks.push({ x, y, colour: MARK_PLAZA });
    }
  }
  for (const anchor of VILLAGE_GRID.roadAnchors) marks.push({ x: anchor.x, y: anchor.y, colour: MARK_ANCHOR });
  return marks;
}

function gridShapeFor(key: TownPlacementKey | "autotileShape"): { width: number; height: number } {
  if (key === "autotileShape") return { width: AUTOTILE_SHAPE_WIDTH, height: AUTOTILE_SHAPE_HEIGHT };
  if (key === "treeGrid") return TREE_GRID;
  if (key === "roadGrid") return ROAD_GRID;
  if (key === "wallGrid") return WALL_GRID;
  if (key === "aframeGrid") return AFRAME_GRID;
  if (key === "doorGrid") return DOOR_GRID;
  if (key === "fenceGrid") return FENCE_GRID;
  return VILLAGE_GRID;
}

/** 문·울타리 과제처럼 그림에 이미 지어져 있는 바탕. 없으면 null. */
function baseArtFor(key: TownPlacementKey | "autotileShape"): { lower: readonly number[]; upper: readonly number[] } | null {
  if (key !== "doorGrid" && key !== "fenceGrid") return null;
  const reference = buildTownGroundTruth().placements[key];
  return { lower: reference.baseLower, upper: reference.baseUpper };
}

async function renderPaletteGrid(key: TownPlacementKey | "autotileShape"): Promise<Uint8Array> {
  const sheet = await chipsetSheet();
  const palette = paletteFor(key === "autotileShape" ? "autotileShape" : key);
  const { width, height } = gridShapeFor(key);

  const paletteCell = TOWN_TILE_SIZE * PALETTE_SCALE;
  const paletteRows = Math.ceil(palette.length / PALETTE_PER_ROW);
  const paletteWidth = Math.min(palette.length, PALETTE_PER_ROW) * paletteCell;
  const paletteHeight = paletteRows * paletteCell;

  const gridCell = TOWN_TILE_SIZE * GRID_SCALE;
  const gridWidth = width * gridCell;
  const gridHeight = height * gridCell;

  const canvasWidth = Math.max(paletteWidth, gridWidth);
  const gridOriginY = paletteHeight + SEPARATOR_HEIGHT;
  const canvas = new Jimp(canvasWidth, gridOriginY + gridHeight, BACKGROUND);

  // 팔레트 스트립 — 오름차순, 좌→우 · 위→아래 읽기 순서.
  for (let index = 0; index < palette.length; index += 1) {
    const column = index % PALETTE_PER_ROW;
    const row = Math.floor(index / PALETTE_PER_ROW);
    drawTile(canvas, sheet, palette[index]!, column * paletteCell, row * paletteCell, PALETTE_SCALE);
  }
  drawLattice(canvas, 0, paletteWidth, paletteHeight, paletteCell);

  // 구분 띠.
  for (let y = paletteHeight; y < gridOriginY; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) canvas.setPixelColor(SEPARATOR, x, y);
  }

  // 바탕 그림(이미 지어진 집) → 하위 먼저, 상위 나중.
  const base = baseArtFor(key);
  if (base) {
    for (const layer of [base.lower, base.upper]) {
      for (let index = 0; index < layer.length; index += 1) {
        const tile = layer[index]!;
        if (tile === EMPTY_CELL) continue;
        const x = index % width;
        const y = Math.floor(index / width);
        drawTile(canvas, sheet, tile, x * gridCell, gridOriginY + y * gridCell, GRID_SCALE);
      }
    }
  }

  // 마킹.
  for (const mark of marksFor(key)) {
    const destX = mark.x * gridCell;
    const destY = gridOriginY + mark.y * gridCell;
    if (mark.outline) outlineCell(canvas, destX, destY, gridCell, mark.colour);
    else fillCell(canvas, destX, destY, gridCell, mark.colour);
  }

  drawLattice(canvas, gridOriginY, gridWidth, gridHeight, gridCell);
  return encodePng(canvas);
}

// ── 공개 진입점 ───────────────────────────────────────────────────────────

export async function renderTownImagePng(key: TownImageKey): Promise<Uint8Array> {
  if (key === "wallProbe") return renderProbeStrip(WALL_PROBE_TILES);
  if (key === "passabilityProbe") return renderProbeStrip(PASSABILITY_PROBE_TILES);
  if (key === "layerProbe") return renderProbeStrip(LAYER_PROBE_TILES);
  return renderPaletteGrid(key);
}

/**
 * 두 레이어를 실제 칩셋 그림으로 합성한다 — 증거 시트(evidence.ts)가 모델의 답을
 * 감독이 눈으로 볼 수 있게 굽는 데 쓴다. 입력 이미지와 같은 렌더 경로를 쓰므로
 * "채점기가 본 것"과 "감독이 본 것"이 어긋날 수 없다.
 */
export async function renderTileGridPng(input: {
  readonly width: number;
  readonly height: number;
  readonly lower: readonly number[];
  readonly upper: readonly number[];
}): Promise<Uint8Array> {
  const sheet = await chipsetSheet();
  const cell = TOWN_TILE_SIZE * GRID_SCALE;
  const canvas = new Jimp(input.width * cell, input.height * cell, BACKGROUND);
  for (const layer of [input.lower, input.upper]) {
    for (let index = 0; index < layer.length; index += 1) {
      const tile = layer[index]!;
      if (tile === EMPTY_CELL) continue;
      drawTile(canvas, sheet, tile, (index % input.width) * cell, Math.floor(index / input.width) * cell, GRID_SCALE);
    }
  }
  drawLattice(canvas, 0, input.width * cell, input.height * cell, cell);
  return encodePng(canvas);
}

/** 11장의 PNG 바이트 sha256 — 매니페스트의 imageDigests 값. */
export async function townImageDigests(): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const key of TOWN_IMAGE_KEYS) {
    digests[key] = sha256HexBytes(await renderTownImagePng(key));
  }
  return digests;
}
