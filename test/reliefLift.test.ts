// test/reliefLift.test.ts
// 높이 지형의 화면 들림(relief/screen.ts)과 절벽 줄 띠: 타일·캐릭터가 그림의 윗면에 앉는 값, 경사로 보간, 줄 소유.
import { describe, expect, it } from "vitest";
import { effectiveHeights, renderRelief } from "@/project/relief/render";
import { cellLift, pointLift, reliefLiftField, reliefRowStrips, reliefSignature } from "@/project/relief/screen";
import { gridFromRelief, type ReliefData } from "@/project/relief/types";
import { rampCode, reliefSlopes } from "@/project/relief/walk";

const W = 12, H = 12;

// y ≤ 5 가 2단 대지(북쪽 고지대), 그 남쪽은 0단. x = 5 칸 (5, 6)·(5, 7) 은 북쪽으로 오르는 경사로(낮은 끝 0단).
function plateau(): ReliefData {
  const levels = Array.from({ length: W * H }, (_, i) => (Math.floor(i / W) <= 5 ? 2 : 0));
  const ramps = new Array(W * H).fill(0);
  ramps[6 * W + 5] = rampCode("n");
  ramps[7 * W + 5] = rampCode("n");
  return { width: W, height: H, levels, ramps };
}

describe("relief lift", () => {
  it("고지대 칸은 그 단, 평지는 0, 맵 밖은 0 이다", () => {
    const field = reliefLiftField(plateau());
    expect(cellLift(field, 3, 2)).toBe(2);
    expect(cellLift(field, 3, 9)).toBe(0);
    expect(cellLift(field, -1, 2)).toBe(0);
  });

  it("매끈한 경사로 칸은 낮은 끝에서 높은 끝으로 칸 중심 위치만큼 오른다", () => {
    const field = reliefLiftField(plateau());
    // 경사로 길이 2칸, 오르막 북쪽: 남쪽 칸 중심은 1/4, 북쪽 칸 중심은 3/4 지점
    expect(cellLift(field, 5, 7)).toBeCloseTo(0.5);
    expect(cellLift(field, 5, 6)).toBeCloseTo(1.5);
  });

  it("계단 칸은 칸 중심이 딛는 디딤판 단에 선다", () => {
    const relief = plateau();
    relief.ramps![6 * W + 5] = rampCode("n", true);
    relief.ramps![7 * W + 5] = rampCode("n", true);
    const field = reliefLiftField(relief);
    // 계단 4단(길이 2 × 2): 칸 중심 1/4·3/4 은 디딤판 경계에 걸리고 그 위 디딤판(0.5·1.5단)을 딛는다
    expect(cellLift(field, 5, 7)).toBeCloseTo(0.5);
    expect(cellLift(field, 5, 6)).toBeCloseTo(1.5);
  });

  it("걷는 중 실수 좌표는 두 칸 사이를 보간하고 정수 좌표에서는 칸 값과 같다", () => {
    const field = reliefLiftField(plateau());
    expect(pointLift(field, 5, 7)).toBeCloseTo(cellLift(field, 5, 7));
    expect(pointLift(field, 5, 6.5)).toBeCloseTo((cellLift(field, 5, 6) + cellLift(field, 5, 7)) / 2);
  });

  it("들림은 렌더러가 실제로 그리는 높이를 따른다 — 1칸 폭 돌기는 깎여 0 이다", () => {
    const levels = new Array(W * H).fill(0);
    levels[6 * W + 6] = 3;
    const field = reliefLiftField({ width: W, height: H, levels });
    expect(cellLift(field, 6, 6)).toBe(0);
  });

  it("서명은 단·경사로·벽면 장식 어느 하나가 바뀌어도 달라진다", () => {
    const base = plateau();
    const withDecor = { ...base, wallDecor: [{ x: 3, y: 5, row: 1, tile: 7 }] };
    const otherDecor = { ...base, wallDecor: [{ x: 3, y: 5, row: 2, tile: 7 }] };
    const noRamp = { ...base, ramps: new Array(W * H).fill(0) };
    const signatures = new Set([base, withDecor, otherDecor, noRamp].map(reliefSignature));
    expect(signatures.size).toBe(4);
    expect(reliefSignature(plateau())).toBe(reliefSignature(base));
  });
});

describe("relief transparent ground", () => {
  it("경사로 아랫도리는 반올림 단이 0 이어도 불투명하다 — 들린 만큼 비는 자리에 타일이 없다", () => {
    const relief = plateau();
    const render = renderRelief(effectiveHeights(gridFromRelief(relief)), { transparentGround: true, slopes: reliefSlopes(relief) });
    let checked = 0;
    for (let i = 0; i < render.kind.length; i++) {
      if (render.kind[i] !== 0 || render.slope[i] === 0 || render.height[i] < 1e-6) continue;
      expect(render.rgba[i * 4 + 3]).toBe(255);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    // 평지(높이 0) 화소는 여전히 투명해 밑 타일이 보인다
    const flat = (render.pad + 10 * 16 + 4) * render.PW + 2 * 16 + 4;
    expect(render.height[flat]).toBe(0);
    expect(render.rgba[flat * 4 + 3]).toBeLessThan(255);
  });
});

describe("relief row strips", () => {
  it("대지 남쪽 끝 줄의 벽 띠는 그 줄 윗면 바로 아래에 단 수만큼 내려온다", () => {
    const relief = plateau();
    const render = renderRelief(effectiveHeights(gridFromRelief(relief)), { transparentGround: true, slopes: reliefSlopes(relief) });
    const wall = reliefRowStrips(render, W, "over").find((strip) => strip.row === 5);
    expect(wall).toBeDefined();
    // 줄 5 윗면은 화면 y = 5·16 + pad - 2·16, 벽은 그 아래(줄 6 자리)에서 2단 = 32px
    const topOfRow = 5 * 16 + render.pad - 2 * 16;
    // 띠 상자에는 맵 가장자리 테두리(edge)도 든다 — 벽 화소(kind≠0)만 따로 재서 그 위치를 본다.
    let wallTop = Infinity, wallBottom = -1;
    for (let i = 0; i < render.src.length; i++) {
      if (render.src[i] < 0 || Math.floor(render.src[i] / W) !== 5 || render.kind[i] === 0 || render.rgba[i * 4 + 3] === 0) continue;
      const sy = (i / render.PW) | 0;
      wallTop = Math.min(wallTop, sy);
      wallBottom = Math.max(wallBottom, sy);
    }
    expect(wallTop).toBeGreaterThanOrEqual(topOfRow + 16);
    expect(wallBottom).toBeLessThanOrEqual(topOfRow + 16 + 2 * 16 + 1);
  });

  it("윗면 띠(under)에는 고지대 줄만 있고 평지 줄은 없다", () => {
    const relief = plateau();
    const render = renderRelief(effectiveHeights(gridFromRelief(relief)), { transparentGround: true, slopes: reliefSlopes(relief) });
    const rows = new Set(reliefRowStrips(render, W, "under").map((strip) => strip.row));
    expect(rows.has(2)).toBe(true);
    expect(rows.has(10)).toBe(false);
  });
});
