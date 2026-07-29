export type RgbaColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

export type RgbColor = Omit<RgbaColor, "a">;

const RGB_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * 프로젝트 표준 색상 키 — `src/assets/pngInspection.ts` 의 `isColorKey` 와 동일 기준.
 * 마젠타(#FF00FF) 와 연보라(#FF678B) 를 항상 키아웃한다.
 * 배경색 자동 감지와 함께 쓰면 “이미 알파가 있는 PNG” 는 no-op 이고,
 * 단색 배경 시트는 감지된 색까지 함께 제거한다.
 */
export const STANDARD_COLOR_KEYS: readonly RgbColor[] = [
  { r: 255, g: 0, b: 255 },
  { r: 255, g: 103, b: 139 },
];

const COLOR_KEY_TOLERANCE = 8;

export function parseRgbHexColor(value: string): RgbColor | null {
  const normalized = normalizeRgbHexColor(value);
  if (!normalized) return null;
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function normalizeRgbHexColor(value: string): string | null {
  const trimmed = value.trim();
  return RGB_HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function applyTransparentColorKey(pixels: Uint8ClampedArray): RgbaColor {
  const key = readTopLeftPixel(pixels);
  applyTransparentColorKeys(pixels, [key]);
  return key;
}

export function applyTransparentColorKeys(pixels: Uint8ClampedArray, keys: readonly RgbColor[]): void {
  if (pixels.length < 4) return;
  for (let offset = 0; offset <= pixels.length - 4; offset += 4) {
    if (isTransparentKeyPixel(pixels, offset, keys)) {
      pixels[offset + 3] = 0;
    }
  }
}

function isTransparentKeyPixel(pixels: Uint8ClampedArray, offset: number, keys: readonly RgbColor[]): boolean {
  return keys.some(
    (key) => isColorNear(pixels[offset], key.r) && isColorNear(pixels[offset + 1], key.g) && isColorNear(pixels[offset + 2], key.b)
  );
}

function readTopLeftPixel(pixels: Uint8ClampedArray): RgbaColor {
  if (pixels.length < 4) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: pixels[0],
    g: pixels[1],
    b: pixels[2],
    a: pixels[3],
  };
}

function isColorNear(a: number, b: number, tolerance = COLOR_KEY_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

/**
 * 이미지 테두리(가장자리 한 겹)를 샘플링해 단색 배경색을 감지한다.
 *
 * - 테두리 픽셀 중 하나라도 alpha=0 이면 "이미 투명 PNG" 로 간주해 null 반환 (no-op).
 * - 테두리 픽셀이 모두 같은 불투명 색이면 그 색을 배경색으로 반환.
 * - 테두리가 불투명인데 색이 섞여 있으면(단색 배경이 아님) null 반환 —
 *   잘못된 키아웃을 막기 위해 안전하게 처리하지 않는다.
 *
 * 이 감지는 “어떤 단색 배경이든 자동 제거” 가 목표이므로, 마젠타/녹색/검은
 * 배경 모두 하나의 경로로 커버된다. 투명 PNG 는 모서리가 이미 alpha=0 이라
 * null 이 되어 no-op 로 흘러간다.
 */
export function resolveBackgroundColor(pixels: Uint8ClampedArray, width: number, height: number): RgbColor | null {
  if (width < 2 || height < 2 || pixels.length < width * height * 4) return null;
  const samples: RgbColor[] = [];
  const pushSample = (x: number, y: number): void => {
    const offset = (y * width + x) * 4;
    const alpha = pixels[offset + 3];
    if (alpha === 0) return; // 이미 투명 — 호출자가 alpha 검사로 넘김
    samples.push({ r: pixels[offset], g: pixels[offset + 1], b: pixels[offset + 2] });
  };
  // 위·아래 가장자리
  for (let x = 0; x < width; x += 1) {
    pushSample(x, 0);
    pushSample(x, height - 1);
  }
  // 좌·우 가장자리 (모서리 중복 제외)
  for (let y = 1; y < height - 1; y += 1) {
    pushSample(0, y);
    pushSample(width - 1, y);
  }
  // 테두리에 alpha=0 픽셀이 하나라도 있으면 이미 투명 PNG → no-op
  const borderPixelCount = 2 * width + 2 * (height - 2);
  if (samples.length < borderPixelCount) return null;
  if (samples.length === 0) return null;
  const first = samples[0]!;
  const uniform = samples.every(
    (s) => isColorNear(s.r, first.r) && isColorNear(s.g, first.g) && isColorNear(s.b, first.b)
  );
  if (!uniform) return null;
  return first;
}

/**
 * 자동 투명색 처리 — 프로젝트 표준 키(마젠타/연보라) 항상 적용 +
 * 테두리에서 감지된 단색 배경을 추가로 키아웃한다.
 *
 * - `knownKeys` 를 생략하면 `STANDARD_COLOR_KEYS` 를 쓴다.
 * - `backgroundColor` 를 주면 감지 단계를 건너뛰고 그 색만 추가로 제거한다
 *   (전체 시트에서 한 번 감지한 색을 셀 단위로 재사용할 때).
 * - 둘 다 없으면 표준 키만 적용된다.
 */
export function applyAutoTransparencyKey(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: { readonly knownKeys?: readonly RgbColor[]; readonly backgroundColor?: RgbColor | null } = {}
): void {
  if (pixels.length < 4 || width < 1 || height < 1) return;
  const knownKeys = options.knownKeys ?? STANDARD_COLOR_KEYS;
  const bg = options.backgroundColor === undefined ? resolveBackgroundColor(pixels, width, height) : options.backgroundColor;
  const keys = bg ? [...knownKeys, bg] : knownKeys;
  applyTransparentColorKeys(pixels, keys);
}
