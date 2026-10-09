import { isUpperOnlyOverlayTile } from "./tilesetHarness";
import type { PassFlag, TilesetDef } from "./types";

export type PassageMark = "o" | "x" | "star";

export type DirectionalPassagePreset = "blocked" | "open" | "star";

export interface DirectionalPassageRule {
  readonly passability: PassFlag;
  readonly priority: "lower" | "upper";
}

export function directionalPassageFromPreset(preset: DirectionalPassagePreset): DirectionalPassageRule {
  switch (preset) {
    case "blocked":
      return { passability: blockedFlag(), priority: "lower" };
    case "open":
      return { passability: passableFlag(), priority: "lower" };
    case "star":
      return { passability: passableFlag(), priority: "upper" };
  }
}

export function togglePassageDirection(passability: PassFlag, direction: keyof PassFlag): PassFlag {
  return { ...passability, [direction]: !passability[direction] };
}

const PASSABLE: PassFlag = { up: true, down: true, left: true, right: true };
const BLOCKED: PassFlag = { up: false, down: false, left: false, right: false };

export function passableFlag(): PassFlag {
  return { ...PASSABLE };
}

export function blockedFlag(): PassFlag {
  return { ...BLOCKED };
}

export function isBlockedPassage(passability: PassFlag | undefined): boolean {
  return !passability || (!passability.up && !passability.down && !passability.left && !passability.right);
}

export function passageMarkForTile(tileset: TilesetDef, tile: number): PassageMark {
  const passability = tileset.passability[tile];
  if (isBlockedPassage(passability)) return "x";
  return tileset.priority[tile] === "upper" ? "star" : "o";
}

export function setPassageMark(tileset: TilesetDef, tile: number, mark: PassageMark): void {
  if (tile < 0 || tile >= tileset.count) return;
  // 투명 배경 칩(상위 전용)은 O/X가 통행만 바꾸고 레이어(priority)는 상위를 유지한다 —
  // 하위로 내리면 투명 부분이 검게 보이므로, 레이어 변경은 레이어 컨트롤(userLocked)로만 한다.
  const keepUpper = isUpperOnlyOverlayTile(tileset, tile);
  switch (mark) {
    case "o":
      if (!keepUpper) tileset.priority[tile] = "lower";
      tileset.passability[tile] = passableFlag();
      return;
    case "x":
      if (!keepUpper) tileset.priority[tile] = "lower";
      tileset.passability[tile] = blockedFlag();
      return;
    case "star":
      tileset.priority[tile] = "upper";
      tileset.passability[tile] = passableFlag();
      return;
  }
}

export function nextPassageMark(mark: PassageMark): PassageMark {
  switch (mark) {
    case "o":
      return "x";
    case "x":
      return "star";
    case "star":
      return "o";
  }
}
