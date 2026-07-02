export type RgbaColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

export type RgbColor = Omit<RgbaColor, "a">;

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
    (key) =>
      pixels[offset] === key.r &&
      pixels[offset + 1] === key.g &&
      pixels[offset + 2] === key.b
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
