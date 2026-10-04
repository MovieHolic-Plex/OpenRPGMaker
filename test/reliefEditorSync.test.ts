// test/reliefEditorSync.test.ts
// 높이 붓·조수 도구가 경사로·장식·양식을 잃지 않는지(carryReliefExtras), 편집기가 들림이 바뀐 칸만 다시 그리는지(reliefTileSlotChangedCells).
import { describe, expect, it } from "vitest";
import { carryReliefExtras } from "@/project/relief/edit";
import { reliefTileSlotChangedCells } from "@/project/relief/screen";
import type { ReliefData } from "@/project/relief/types";

const W = 8, H = 6;
const flat = (): ReliefData => ({ width: W, height: H, levels: new Array(W * H).fill(0) });
const block = (level: number): ReliefData => {
  const r = flat();
  for (let y = 1; y <= 3; y++) for (let x = 2; x <= 5; x++) r.levels[y * W + x] = level;
  return r;
};

describe("reliefTileSlotChangedCells", () => {
  it("같은 relief(또는 둘 다 없음)는 바뀐 칸이 없다", () => {
    const a = block(3);
    expect(reliefTileSlotChangedCells(a, a, W, H)).toEqual([]);
    expect(reliefTileSlotChangedCells(undefined, undefined, W, H)).toEqual([]);
  });
  it("평지에 덩이를 올리면 덩이 자리만 바뀐다", () => {
    const changed = reliefTileSlotChangedCells(undefined, block(3), W, H);
    expect(changed.length).toBeGreaterThan(0);
    for (const { x, y } of changed) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(5);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(3);
    }
  });
  it("덩이를 다시 평지로 내리면 올렸던 자리가 같이 바뀐다", () => {
    const up = reliefTileSlotChangedCells(undefined, block(3), W, H);
    const down = reliefTileSlotChangedCells(block(3), undefined, W, H);
    expect(down).toEqual(up);
  });
});

describe("carryReliefExtras", () => {
  const prev = (): ReliefData => ({
    ...block(3),
    ramps: Object.assign(new Array(W * H).fill(0), { [2 * W + 3]: 1, [3 * W + 4]: 1 }),
    wallDecor: [{ x: 2, y: 1, row: 1, tile: 5 }, { x: 5, y: 3, row: 1, tile: 6 }],
    style: "grass-cliff",
  });

  it("단이 안 바뀐 칸의 경사로·장식과 양식을 잇는다", () => {
    const next = { ...block(3) };
    next.levels = next.levels.slice();
    next.levels[3 * W + 5] = 1; // (5,3) 의 단만 바뀐다
    const out = carryReliefExtras(prev(), next);
    expect(out.style).toBe("grass-cliff");
    expect(out.ramps?.[2 * W + 3]).toBe(1);
    expect(out.wallDecor).toEqual([{ x: 2, y: 1, row: 1, tile: 5 }]);
  });
  it("단이 바뀐 칸의 경사로는 버린다", () => {
    const next = { ...block(3) };
    next.levels = next.levels.slice();
    next.levels[3 * W + 4] = 0; // (4,3) 의 경사로 칸 단이 바뀐다
    const out = carryReliefExtras(prev(), next);
    expect(out.ramps?.[3 * W + 4] ?? 0).toBe(0);
    expect(out.ramps?.[2 * W + 3]).toBe(1);
  });
  it("맵 크기가 다르면 양식만 잇는다", () => {
    const out = carryReliefExtras(prev(), { width: 4, height: 4, levels: new Array(16).fill(1) });
    expect(out.style).toBe("grass-cliff");
    expect(out.ramps).toBeUndefined();
    expect(out.wallDecor).toBeUndefined();
  });
  it("이전 relief 가 없으면 새 relief 를 그대로 돌려준다", () => {
    const next = block(2);
    expect(carryReliefExtras(undefined, next)).toBe(next);
  });
});
