// 견본 복사 측정(mapTemplateOverlap): 평행이동·좌우반전을 해도 같은 판을 찾아내고, 다른 타일셋 견본은 재지 않는다.
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
import { describe, expect, it } from "vitest";
import { maxTemplateOverlap, templateOverlap, type OverlapGrid } from "@/project/mapTemplateOverlap";

const grid = (width: number, height: number, cell: (x: number, y: number) => number, tilesetId = "t"): OverlapGrid =>
  ({ width, height, tilesetId, lower: Array.from({ length: width * height }, (_, i) => cell(i % width, Math.floor(i / width))) });
const noise = (x: number, y: number) => (Math.imul(x + 3, 2654435761) ^ Math.imul(y + 7, 40503)) >>> 0;

describe("templateOverlap", () => {
  it("is 1 for an identical map", () => {
    const t = grid(12, 10, (x, y) => noise(x, y) % 9);
    expect(templateOverlap(t, t).overlap).toBe(1);
  });

  it("finds a copy moved by a few tiles", () => {
    const t = grid(12, 10, (x, y) => noise(x, y) % 9);
    const moved = grid(12, 10, (x, y) => (x >= 3 ? noise(x - 3, y) % 9 : 100));
    const hit = templateOverlap(moved, t);
    expect(hit.dx).toBe(3);
    expect(hit.overlap).toBeCloseTo((9 * 10) / (12 * 10), 5);
  });

  it("finds a mirrored copy", () => {
    const t = grid(12, 10, (x, y) => noise(x, y) % 9);
    const mirrored = grid(12, 10, (x, y) => noise(11 - x, y) % 9);
    const hit = templateOverlap(mirrored, t);
    expect(hit.flip).toBe(true);
    expect(hit.overlap).toBe(1);
  });

  it("stays low for an unrelated layout", () => {
    const t = grid(12, 10, (x, y) => noise(x, y) % 9);
    const other = grid(12, 10, (x, y) => noise(y + 50, x + 50) % 9);
    expect(templateOverlap(other, t).overlap).toBeLessThan(0.4);
  });
});

describe("maxTemplateOverlap", () => {
  it("compares only templates on the same tileset", () => {
    const map = grid(8, 8, () => 1);
    const hit = maxTemplateOverlap(map, { a: grid(8, 8, () => 1, "other"), b: grid(8, 8, (x) => (x < 4 ? 1 : 2)) });
    expect(hit?.key).toBe("b");
    expect(hit?.overlap).toBe(0.5);
  });

  it("skips templates whose tile counts cannot reach the floor", () => {
    const map = grid(8, 8, () => 1);
    expect(maxTemplateOverlap(map, { b: grid(8, 8, (x) => (x < 2 ? 1 : 2)) }, { floor: 0.4 })).toBeUndefined();
    expect(maxTemplateOverlap(map, { b: grid(8, 8, (x) => (x < 4 ? 1 : 2)) }, { floor: 0.4 })?.overlap).toBe(0.5);
  });
});
