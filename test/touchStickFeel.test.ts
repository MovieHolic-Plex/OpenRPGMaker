import { describe, expect, it } from "vitest";
import { stickRuns, stickSector, stickSectorKeys } from "@/player/touchPad";
import { normalizeTouchControls, resolveTouchControls } from "@/project/touchControls";

const at = (deg: number, r = 40): [number, number] => [Math.cos((deg * Math.PI) / 180) * r, Math.sin((deg * Math.PI) / 180) * r];

describe("touch stick sectors (2026-10-24 mobile feel)", () => {
  it("cardinals are wide, diagonals narrow (28..62 degrees only)", () => {
    expect(stickSectorKeys(stickSector(...at(25), null))).toEqual(["ArrowRight"]);
    expect(stickSectorKeys(stickSector(...at(30), null))).toEqual(["ArrowRight", "ArrowDown"]);
    expect(stickSectorKeys(stickSector(...at(60), null))).toEqual(["ArrowRight", "ArrowDown"]);
    expect(stickSectorKeys(stickSector(...at(65), null))).toEqual(["ArrowDown"]);
    expect(stickSectorKeys(stickSector(...at(-90), null))).toEqual(["ArrowUp"]);
    expect(stickSectorKeys(stickSector(...at(180), null))).toEqual(["ArrowLeft"]);
  });
  it("keeps the held sector across a small wobble (hysteresis)", () => {
    expect(stickSectorKeys(stickSector(...at(32), 0))).toEqual(["ArrowRight"]);
    expect(stickSectorKeys(stickSector(...at(40), 0))).toEqual(["ArrowRight", "ArrowDown"]);
  });
  it("dead zone: 12px to start, 8px to release", () => {
    expect(stickSector(10, 0, null)).toBeNull();
    expect(stickSector(10, 0, 0)).toBe(0);
    expect(stickSector(7, 0, 0)).toBeNull();
  });
  it("dead zone scales with the pad radius: 12% to start, 8% to release (2026-10-30)", () => {
    // 세로 판 반지름 65px: 7.8px 를 넘으면 출발(예전 고정 12px = 18%), 5.2px 밑이면 멈춤.
    expect(stickSector(7, 0, null, 65)).toBeNull();
    expect(stickSector(9, 0, null, 65)).toBe(0);
    expect(stickSector(6, 0, 0, 65)).toBe(0);
    expect(stickSector(5, 0, 0, 65)).toBeNull();
    // 아주 작은 판도 6px 밑으로는 내리지 않는다(엄지를 얹기만 해서 걷지 않게).
    expect(stickSector(5.5, 0, null, 30)).toBeNull();
  });
});

describe("stick deflection runs (2026-10-25, no separate Run button)", () => {
  it("runs past 70% of the radius, walks again below 60%", () => {
    expect(stickRuns(30, 58, false)).toBe(false);
    expect(stickRuns(41, 58, false)).toBe(true);
    expect(stickRuns(37, 58, true)).toBe(true);
    expect(stickRuns(34, 58, true)).toBe(false);
  });
});

describe("system.touchControls", () => {
  it("stores only non-default fields", () => {
    expect(normalizeTouchControls({ tapToMove: true, stick: "auto", haptics: true, runButton: false })).toBeUndefined();
    expect(normalizeTouchControls({ runButton: true })).toEqual({ runButton: true });
    expect(normalizeTouchControls({ tapToMove: false, stick: "fixed", bogus: 1 })).toEqual({ tapToMove: false, stick: "fixed" });
  });
  it("device preference beats authored value beats default", () => {
    expect(resolveTouchControls(undefined)).toEqual({ tapToMove: true, stick: "auto", haptics: true, runButton: false });
    expect(resolveTouchControls({ tapToMove: false }).tapToMove).toBe(false);
    expect(resolveTouchControls({ tapToMove: false }, { tapToMove: true }).tapToMove).toBe(true);
  });
});
