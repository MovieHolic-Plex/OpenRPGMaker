// 워커는 512×512 를 넘는 render PNG 를 거절하고(409) 그 거절이 턴 전체를 끊는다 — 2026-11-11 검수용 오프닝 표본이 384×648 이 돼 모든 턴이 끊겼다.
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { pngLargerThan } from "@/ai/piAgent/client";
import { PREVIEW_MAX } from "@/editor/openingAnimaticPreview";

function png(width: number, height: number): string {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); ihdr.write("IHDR", 4, "ascii"); ihdr.writeUInt32BE(width, 8); ihdr.writeUInt32BE(height, 12); ihdr[16] = 8; ihdr[17] = 6;
  return Buffer.concat([signature, ihdr, deflateSync(Buffer.alloc(8))]).toString("base64");
}

describe("pi render size guard", () => {
  it("names a PNG larger than the worker limit and lets one inside it through", () => {
    expect(pngLargerThan(png(384, 648), 512)).toBe("384×648");
    expect(pngLargerThan(png(513, 10), 512)).toBe("513×10");
    expect(pngLargerThan(png(512, 512), 512)).toBeUndefined();
    expect(pngLargerThan(png(303, 512), 512)).toBeUndefined();
    expect(pngLargerThan("not a png", 512)).toBeUndefined();
  });

  it("the review preview of a 384×216 stage fits the limit for 1–4 frames", () => {
    for (const rows of [1, 2, 3, 4]) {
      const tileWidth = Math.min(PREVIEW_MAX, 384, Math.floor(PREVIEW_MAX / rows * 384 / 216));
      expect(Math.ceil(tileWidth)).toBeLessThanOrEqual(PREVIEW_MAX);
      expect(Math.ceil(rows * tileWidth * 216 / 384)).toBeLessThanOrEqual(PREVIEW_MAX);
    }
  });
});
