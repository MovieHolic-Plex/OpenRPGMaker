import { describe, expect, it } from "vitest";
import { openStatePixels } from "@/player/playSceneFieldFx";
import { CONTAINER_STYLES } from "@/project/containerFx";

const SIZE = 16;
const W = SIZE * 3, H = SIZE * 2;

/** 가운데 열 아래 칸에 12×10 불투명 물건(위 줄 밝고 아래 줄 어두운 나무)을 그린 캔버스. */
function objectCanvas(): Uint8ClampedArray {
  const src = new Uint8ClampedArray(W * H * 4);
  for (let y = SIZE + 5; y < SIZE + 15; y++) for (let x = SIZE + 2; x < SIZE + 14; x++) {
    const i = (y * W + x) * 4;
    const light = y < SIZE + 8;
    src[i] = light ? 200 : 140; src[i + 1] = light ? 140 : 90; src[i + 2] = light ? 80 : 50; src[i + 3] = 255;
  }
  return src;
}

function changed(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!) + Math.abs(a[i + 3]! - b[i + 3]!) > 60) n++;
  }
  return n;
}

describe("수납 열린 모습 — 물건 그림 자체가 바뀐다(오너: 최소 3픽셀)", () => {
  it("옷장은 합성하지 않고 예전 문짝 덧그림·흔적을 쓴다(블라인드 판정 3회 NO)", () => {
    expect(openStatePixels(objectCanvas(), W, H, SIZE, "wardrobe", 1)).toBeNull();
  });

  it.each(CONTAINER_STYLES.filter((style) => style !== "wardrobe"))("%s: 다 열린 모습은 물건 화소가 6개 이상 바뀐다", (style) => {
    const src = objectCanvas();
    const out = openStatePixels(src, W, H, SIZE, style, 1);
    expect(out).not.toBeNull();
    expect(changed(src, out!)).toBeGreaterThanOrEqual(6);
  });

  it("물건 화소가 없는 칸은 열린 모습을 만들지 않는다(예전 흔적 그림으로 대체)", () => {
    expect(openStatePixels(new Uint8ClampedArray(W * H * 4), W, H, SIZE, "crate", 1)).toBeNull();
  });
});
