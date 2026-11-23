// 생성물끼리 구조 유사도(structureSimilarity): 같은 배치·거울 배치는 1, 다른 배치는 우연 수준(카파).
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { downsample, structureSimilarity } from "@/ai/v2/place/structureSimilarity";

describe("structureSimilarity", () => {
  const n = 8;
  const road = (vertical: boolean) => downsample(Array.from({ length: 64 }, (_, i) => ((vertical ? i % 8 : Math.floor(i / 8)) === 3 ? 1 : 0)), 8, 8, n);

  it("is 1 for the same layout and its mirror", () => {
    const g = downsample(Array.from({ length: 64 }, (_, i) => (i % 8 < 2 ? 2 : i % 8 === 4 ? 1 : 0)), 8, 8, n);
    const mirror = downsample(Array.from({ length: 64 }, (_, i) => (i % 8 > 5 ? 2 : i % 8 === 3 ? 1 : 0)), 8, 8, n);
    expect(structureSimilarity(g, g)).toBe(1);
    expect(structureSimilarity(g, mirror)).toBe(1);
  });

  it("is near chance when the road runs another way", () => {
    expect(structureSimilarity(road(true), road(false))).toBeLessThan(0.2);
  });

  it("does not call two half-floor caves alike just because both are half floor", () => {
    const left = downsample(Array.from({ length: 64 }, (_, i) => (i % 8 < 4 ? 3 : 0)), 8, 8, n);
    const top = downsample(Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) < 4 ? 3 : 0)), 8, 8, n);
    expect(structureSimilarity(left, top)).toBeLessThan(0.2);
  });
});
