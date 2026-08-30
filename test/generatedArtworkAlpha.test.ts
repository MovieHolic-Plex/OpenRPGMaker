import { describe, expect, it } from "vitest";
import { detectBackgroundKey, keyOutBackground } from "@/assets/generatedArtworkAlpha";

function canvas(width: number, height: number, fill: readonly [number, number, number]): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = fill[0];
    data[index * 4 + 1] = fill[1];
    data[index * 4 + 2] = fill[2];
    data[index * 4 + 3] = 255;
  }
  return { data, width, height };
}

function paint(
  target: { data: Uint8ClampedArray; width: number },
  x: number,
  y: number,
  color: readonly [number, number, number],
): void {
  const offset = (y * target.width + x) * 4;
  target.data[offset] = color[0];
  target.data[offset + 1] = color[1];
  target.data[offset + 2] = color[2];
  target.data[offset + 3] = 255;
}

function alphaAt(target: { data: Uint8ClampedArray; width: number }, x: number, y: number): number {
  return target.data[(y * target.width + x) * 4 + 3]!;
}

const WHITE = [255, 255, 255] as const;
const GREEN = [40, 180, 90] as const;

describe("generatedArtworkAlpha", () => {
  it("흰 배경 위의 피사체에서 배경만 투명으로 만든다", () => {
    const image = canvas(8, 8, WHITE);
    for (let y = 3; y <= 4; y += 1) {
      for (let x = 3; x <= 4; x += 1) paint(image, x, y, GREEN);
    }

    const cleared = keyOutBackground(image);

    expect(cleared).toBe(60);
    expect(alphaAt(image, 0, 0)).toBe(0);
    expect(alphaAt(image, 3, 3)).toBe(255);
    expect(alphaAt(image, 4, 4)).toBe(255);
  });

  it("피사체 내부의 배경색 픽셀은 테두리와 끊겨 있으므로 유지한다", () => {
    const image = canvas(9, 9, WHITE);
    for (let y = 2; y <= 6; y += 1) {
      for (let x = 2; x <= 6; x += 1) paint(image, x, y, GREEN);
    }
    paint(image, 4, 4, WHITE);

    keyOutBackground(image);

    expect(alphaAt(image, 4, 4)).toBe(255);
    expect(alphaAt(image, 0, 0)).toBe(0);
  });

  it("배경이 없는 꽉 찬 그림은 건드리지 않는다", () => {
    const image = canvas(6, 6, WHITE);
    for (let y = 0; y < 6; y += 1) {
      for (let x = 0; x < 6; x += 1) paint(image, x, y, x < 3 ? GREEN : [200, 40, 40]);
    }

    expect(detectBackgroundKey(image)).toBeNull();
    expect(keyOutBackground(image)).toBe(0);
    expect(alphaAt(image, 0, 0)).toBe(255);
  });
});
