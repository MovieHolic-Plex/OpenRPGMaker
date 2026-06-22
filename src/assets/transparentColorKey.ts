export type RgbaColor = {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
};

export function applyTransparentColorKey(pixels: Uint8ClampedArray): RgbaColor {
  const key = readTopLeftPixel(pixels);
  if (pixels.length < 4) return key;
  for (let offset = 0; offset <= pixels.length - 4; offset += 4) {
    if (
      pixels[offset] === key.r &&
      pixels[offset + 1] === key.g &&
      pixels[offset + 2] === key.b
    ) {
      pixels[offset + 3] = 0;
    }
  }
  return key;
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
