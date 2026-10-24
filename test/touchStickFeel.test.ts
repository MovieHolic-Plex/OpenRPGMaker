import { describe, expect, it } from "vitest";
import { stickSector, stickSectorKeys } from "@/player/touchPad";
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
});

describe("system.touchControls", () => {
  it("stores only non-default fields", () => {
    expect(normalizeTouchControls({ tapToMove: true, stick: "auto", haptics: true, runButton: true })).toBeUndefined();
    expect(normalizeTouchControls({ tapToMove: false, stick: "fixed", bogus: 1 })).toEqual({ tapToMove: false, stick: "fixed" });
  });
  it("device preference beats authored value beats default", () => {
    expect(resolveTouchControls(undefined)).toEqual({ tapToMove: true, stick: "auto", haptics: true, runButton: true });
    expect(resolveTouchControls({ tapToMove: false }).tapToMove).toBe(false);
    expect(resolveTouchControls({ tapToMove: false }, { tapToMove: true }).tapToMove).toBe(true);
  });
});
