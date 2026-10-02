/** 생성 원본 한 장 → 격자 도트(출처로 커밋하는 것) → 전투 스프라이트. 브라우저·노드 공용. */
import { extractGrid, type GridOptions } from "./grid";
import { tidyCells } from "./tidy";
import { fitSprite, type FitResult, type SpriteSide } from "./fit";
import { composeOn, cropToInk, scaleNearest, type RgbaImage } from "./image";

export type PixelizeResult = {
  /** 칸 하나 = 픽셀 하나. 정리(색 합치기·외톨이 흡수)까지 끝난 원본 해상도 도트 */
  grid: RgbaImage;
  block: number;
  colors: number;
};

export function pixelize(source: RgbaImage, maxColors = 20, grid: GridOptions = {}): PixelizeResult {
  const { cells, block } = extractGrid(source, grid);
  const { image, colors } = tidyCells(cells, maxColors);
  return { grid: image, block, colors };
}

export function toSprite(grid: RgbaImage, side: SpriteSide, stage: 1 | 2 | 3 = 1): FitResult {
  return fitSprite(grid, side, stage);
}

const MAGENTA = [255, 0, 255, 255] as const;

/**
 * 다음 생성의 참고 이미지: 깨끗한 도트를 정수배로 키워 마젠타 캔버스 가운데 놓는다.
 * 생성 원본 대신 이걸 넣어야 뒷모습·진화형에 후광과 배경 번짐이 덜 따라온다.
 */
export function cleanReference(grid: RgbaImage, size = 1254): RgbaImage {
  const ink = cropToInk(grid);
  const factor = Math.max(1, Math.floor((size * 0.8) / Math.max(ink.width, ink.height)));
  const big = scaleNearest(ink, factor);
  return composeOn(MAGENTA, size, size, big, Math.floor((size - big.width) / 2), Math.floor((size - big.height) / 2));
}

export function magentaCanvas(size = 1254): RgbaImage {
  return composeOn(MAGENTA, size, size, { width: 0, height: 0, data: new Uint8ClampedArray(0) }, 0, 0);
}
