// benchmark/interior/inputImages.ts
// 헤드리스 · 바이트 결정적 입력 이미지 렌더러.
//
// 브라우저 캔버스를 쓰지 않는다(기존 src/benchmark/inputImages.ts 는 캔버스라
// CI 에서 돌지 않는다). jimp 로 PNG 를 직접 인코딩하므로 Node · vitest 어디서든
// 같은 바이트가 나오고, 그 바이트의 sha256 이 매니페스트에 들어간다.
//
// 안티-게이밍 하드 규칙: 어떤 이미지에도 글자·캡션·타일 id·라벨·범례를 그리지
// 않는다. jimp 의 print/loadFont 를 호출하지 않으며 test/interiorBenchInputImages
// .test.ts 가 소스에 그 API 가 없음을 검사한다. 모델은 캡션이 아니라 그림을 읽어야 한다.

import Jimp from "jimp";
import { sha256HexBytes } from "./hash";
import { fixtureById, fixtureFloorMask } from "./fixtures";
import { INTERIOR_TILE_SIZE, INTERIOR_TILES_PER_ROW, INTERIOR_TILE_COUNT } from "./types";

/** 아틀라스 확대 배율 — nearest-neighbour 만 쓴다(보간 금지). */
export const ATLAS_SCALE = 3;
/** 그리드 이미지 셀 크기(px). */
export const GRID_CELL_SIZE = 32;

const BACKGROUND = 0x20232aff;
const LATTICE = 0x3a3f4bff;
const FLOOR_MARKER = 0x4fa3d1ff;
const DOOR_MARKER = 0xffcc00ff;

export const INTERIOR_CHIPSET_PNG_PATH = "public/assets/easyrpg-chipset-interior-transparent.png";

export type InteriorImageKey = "atlas" | "houseGrid" | "roomGrid";

export const INTERIOR_IMAGE_KEYS: readonly InteriorImageKey[] = Object.freeze([
  "atlas",
  "houseGrid",
  "roomGrid",
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

/** 전체 시트 아틀라스 — 불투명 배경 위에 합성한 뒤 정수배 nearest 확대. */
export async function renderInteriorAtlasPng(): Promise<Uint8Array> {
  // Jimp.read 가 경로 부하를 직접 처리한다 — node:fs 를 import 하지 않아야 이 모듈이
  // Node 타입 없는 tsconfig.app 그래프에서도 생족한다(실행은 항상 Node 쪽이다).
  const source = await Jimp.read(INTERIOR_CHIPSET_PNG_PATH);
  const rows = INTERIOR_TILE_COUNT / INTERIOR_TILES_PER_ROW;
  const width = INTERIOR_TILES_PER_ROW * INTERIOR_TILE_SIZE;
  const height = rows * INTERIOR_TILE_SIZE;
  if (source.getWidth() !== width || source.getHeight() !== height) {
    throw new Error(
      `interior inputImages: 시트 크기 불일치 — ${source.getWidth()}x${source.getHeight()} (기대 ${width}x${height})`,
    );
  }
  // 투명 소품 칸이 보이도록 불투명 배경 위에 얹는다.
  const canvas = new Jimp(width, height, BACKGROUND);
  canvas.composite(source, 0, 0);
  canvas.resize(width * ATLAS_SCALE, height * ATLAS_SCALE, Jimp.RESIZE_NEAREST_NEIGHBOR);
  return encodePng(canvas);
}

/** 마킹된 빈 그리드 — 바닥 영역과 출입구를 서로 다른 색으로 칠한다. */
export async function renderInteriorGridPng(fixtureId: string): Promise<Uint8Array> {
  const fixture = fixtureById(fixtureId);
  const floor = fixtureFloorMask(fixture);
  const width = fixture.width * GRID_CELL_SIZE;
  const height = fixture.height * GRID_CELL_SIZE;
  const canvas = new Jimp(width, height, BACKGROUND);

  for (let cellY = 0; cellY < fixture.height; cellY += 1) {
    for (let cellX = 0; cellX < fixture.width; cellX += 1) {
      const isDoor = cellX === fixture.door.x && cellY === fixture.door.y;
      const isFloor = floor[cellY * fixture.width + cellX] === true;
      if (!isFloor && !isDoor) continue;
      const colour = isDoor ? DOOR_MARKER : FLOOR_MARKER;
      // 1px 격자선은 남겨 두어 칸 경계가 보이게 한다.
      for (let y = 1; y < GRID_CELL_SIZE; y += 1) {
        for (let x = 1; x < GRID_CELL_SIZE; x += 1) {
          canvas.setPixelColor(colour, cellX * GRID_CELL_SIZE + x, cellY * GRID_CELL_SIZE + y);
        }
      }
    }
  }
  // 격자선.
  for (let x = 0; x < width; x += GRID_CELL_SIZE) {
    for (let y = 0; y < height; y += 1) canvas.setPixelColor(LATTICE, x, y);
  }
  for (let y = 0; y < height; y += GRID_CELL_SIZE) {
    for (let x = 0; x < width; x += 1) canvas.setPixelColor(LATTICE, x, y);
  }
  return encodePng(canvas);
}

export async function renderInteriorImagePng(key: InteriorImageKey): Promise<Uint8Array> {
  return key === "atlas" ? renderInteriorAtlasPng() : renderInteriorGridPng(key);
}

/** 세 이미지의 PNG 바이트 sha256 — 매니페스트의 imageDigests 값. */
export async function interiorImageDigests(): Promise<Record<string, string>> {
  const digests: Record<string, string> = {};
  for (const key of INTERIOR_IMAGE_KEYS) {
    digests[key] = sha256HexBytes(await renderInteriorImagePng(key));
  }
  return digests;
}
