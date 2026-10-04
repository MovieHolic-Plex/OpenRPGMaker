import { describe, expect, it } from "vitest";
import { emptyRelief } from "@/project/relief/edit";
import { RELIEF_TIDY_MIN_AREA, roughReliefStroke, tidyReliefRegion } from "@/project/relief/roughBrush";
import { reliefPickCell } from "@/project/relief/screen";
import type { ReliefData } from "@/project/relief/types";

const at = (r: ReliefData, x: number, y: number) => r.levels[y * r.width + x] ?? 0;

describe("러프 높이 붓 (roughReliefStroke)", () => {
  it("올리기는 한 번에 덩이를 세우고 가운데가 봉우리, 가장자리는 단으로 내려간다", () => {
    const r = emptyRelief(48, 48);
    expect(roughReliefStroke(r, 24, 24, "raise", { radius: 4, base: 0, peak: 3, cap: 4 })).toBe(true);
    expect(at(r, 24, 24)).toBe(3);
    expect(Math.max(...r.levels)).toBe(3);
    // 정밀 붓(반지름 1 원)보다 훨씬 넓다 — 1차 스케치용.
    expect(r.levels.filter((v) => v > 0).length).toBeGreaterThan(60);
    // 붓에서 멀리 떨어진 모서리는 그대로.
    expect(at(r, 0, 0)).toBe(0);
    expect(at(r, 47, 47)).toBe(0);
    // 봉우리 밖에는 그보다 낮은 단(비탈)이 있다 — 벽 하나로 끝나지 않는다.
    expect(r.levels.some((v) => v > 0 && v < 3)).toBe(true);
  });

  it("상한을 넘지 않고, 이미 높은 칸은 깎지 않는다", () => {
    const r = emptyRelief(30, 30);
    r.levels[15 * 30 + 15] = 6;
    roughReliefStroke(r, 15, 15, "raise", { radius: 3, base: 0, peak: 9, cap: 2 });
    expect(at(r, 15, 15)).toBe(6);
    expect(at(r, 14, 15)).toBe(2);
  });

  it("내리기는 덩이 안을 바닥 단까지 판다", () => {
    const r = emptyRelief(30, 30);
    r.levels.fill(3);
    roughReliefStroke(r, 15, 15, "lower", { radius: 3, base: 3, peak: 0, cap: 4 });
    expect(at(r, 15, 15)).toBe(0);
    expect(at(r, 0, 0)).toBe(3);
  });

  it("단 지정·평탄은 덩이 안만 바꾼다", () => {
    const r = emptyRelief(30, 30);
    roughReliefStroke(r, 15, 15, "set", { radius: 3, base: 0, peak: 0, cap: 2 });
    expect(at(r, 15, 15)).toBe(2);
    expect(at(r, 15, 25)).toBe(0);
  });
});

describe("붓 뗄 때 정리 (tidyReliefRegion)", () => {
  it("상자 안의 작은 섬·1칸 구멍을 메우고 상자 밖은 건드리지 않는다", () => {
    const r = emptyRelief(20, 20);
    r.levels[5 * 20 + 5] = 2; // 1칸 섬
    for (let y = 10; y < 15; y++) for (let x = 10; x < 15; x++) r.levels[y * 20 + x] = 1; // 25칸 고원
    r.levels[12 * 20 + 12] = 0; // 1칸 구멍
    r.levels[2 * 20 + 18] = 3; // 상자 밖 1칸 섬
    expect(tidyReliefRegion(r, { x0: 0, y0: 0, x1: 15, y1: 15 })).toBe(true);
    expect(at(r, 5, 5)).toBe(0);
    expect(at(r, 12, 12)).toBe(1);
    expect(at(r, 10, 10)).toBe(1);
    expect(at(r, 18, 2)).toBe(3);
  });

  it("작은 섬 문턱보다 큰 덩어리는 남긴다", () => {
    const r = emptyRelief(20, 20);
    for (let i = 0; i < RELIEF_TIDY_MIN_AREA + 1; i++) r.levels[8 * 20 + 3 + i] = 1;
    for (let i = 0; i < RELIEF_TIDY_MIN_AREA + 1; i++) r.levels[9 * 20 + 3 + i] = 1;
    tidyReliefRegion(r, { x0: 0, y0: 0, x1: 19, y1: 19 });
    expect(at(r, 5, 8)).toBe(1);
  });

  it("경사로 칸은 정리하지 않는다", () => {
    const r: ReliefData = { ...emptyRelief(10, 10), ramps: new Array(100).fill(0) };
    r.levels[5 * 10 + 5] = 1;
    r.ramps![5 * 10 + 5] = 5;
    tidyReliefRegion(r, { x0: 0, y0: 0, x1: 9, y1: 9 });
    expect(at(r, 5, 5)).toBe(1);
  });
});

describe("보이는 칸 집기 (reliefPickCell)", () => {
  it("들린 칸은 북쪽으로 올라가 보이므로 그 화면 줄을 누르면 그 칸의 윗면·벽을 고른다", () => {
    const r = emptyRelief(12, 12);
    for (let y = 4; y < 8; y++) for (let x = 3; x < 9; x++) r.levels[y * 12 + x] = 2;
    // 칸 (5,7) 은 2단 — 윗면은 땅 줄 5 에, 남쪽 벽은 땅 줄 6~7 에 그려진다.
    expect(reliefPickCell(r, 5, 5)).toEqual({ x: 5, y: 7, face: "top" });
    expect(reliefPickCell(r, 5, 6)).toEqual({ x: 5, y: 7, face: "wall" });
    expect(reliefPickCell(r, 5, 7)).toEqual({ x: 5, y: 7, face: "wall" });
    // 언덕 아래 평지는 그대로.
    expect(reliefPickCell(r, 5, 9)).toEqual({ x: 5, y: 9, face: "top" });
    // relief 없음
    expect(reliefPickCell(undefined, 2, 3)).toEqual({ x: 2, y: 3, face: "top" });
  });
});
