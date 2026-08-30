export interface ArtworkPixels {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
}

export interface BackgroundKeyOptions {
  readonly tolerance?: number;
}

const DEFAULT_TOLERANCE = 26;
const BORDER_UNIFORMITY_RATIO = 0.7;

function indexOf(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

function borderPixels(pixels: ArtworkPixels): number[] {
  const { width, height } = pixels;
  const out: number[] = [];
  for (let x = 0; x < width; x += 1) {
    out.push(indexOf(x, 0, width), indexOf(x, height - 1, width));
  }
  for (let y = 1; y < height - 1; y += 1) {
    out.push(indexOf(0, y, width), indexOf(width - 1, y, width));
  }
  return out;
}

function distance(data: Uint8ClampedArray, a: number, key: readonly [number, number, number]): number {
  const dr = data[a]! - key[0];
  const dg = data[a + 1]! - key[1];
  const db = data[a + 2]! - key[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * 테두리 픽셀의 평균색을 배경 후보로 삼고, 그 색이 테두리를 실제로 지배할 때만 배경으로 인정한다.
 * 지배율을 안 보면 배경이 없는 그림(꽉 찬 구도)에서 피사체 색이 키로 뽑혀 그림이 뚫린다.
 */
export function detectBackgroundKey(
  pixels: ArtworkPixels,
  options: BackgroundKeyOptions = {},
): readonly [number, number, number] | null {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const border = borderPixels(pixels);
  if (border.length === 0) return null;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (const index of border) {
    sumR += pixels.data[index]!;
    sumG += pixels.data[index + 1]!;
    sumB += pixels.data[index + 2]!;
  }
  const key: readonly [number, number, number] = [
    Math.round(sumR / border.length),
    Math.round(sumG / border.length),
    Math.round(sumB / border.length),
  ];
  let near = 0;
  for (const index of border) {
    if (distance(pixels.data, index, key) <= tolerance) near += 1;
  }
  return near / border.length >= BORDER_UNIFORMITY_RATIO ? key : null;
}

/**
 * 테두리에서 연결된 배경색 영역만 투명으로 만든다(flood fill). 전역 색상 치환이 아니라
 * 연결성을 보는 이유: 피사체 내부의 같은 색(흰 눈동자 등)을 뚫지 않기 위해서다.
 */
export function keyOutBackground(pixels: ArtworkPixels, options: BackgroundKeyOptions = {}): number {
  const key = detectBackgroundKey(pixels, options);
  if (!key) return 0;
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const { data, width, height } = pixels;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  const push = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const flat = y * width + x;
    if (visited[flat] === 1) return;
    visited[flat] = 1;
    if (distance(data, flat * 4, key) > tolerance) return;
    queue.push(flat);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  let cleared = 0;
  while (queue.length > 0) {
    const flat = queue.pop()!;
    const offset = flat * 4;
    if (data[offset + 3] !== 0) {
      data[offset + 3] = 0;
      cleared += 1;
    }
    const x = flat % width;
    const y = (flat - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return cleared;
}
