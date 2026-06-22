import type { PassFlag, TilesetDef } from "./types";

export type PassageMark = "o" | "x" | "star";

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
  switch (mark) {
    case "o":
      tileset.priority[tile] = "lower";
      tileset.passability[tile] = passableFlag();
      return;
    case "x":
      tileset.priority[tile] = "lower";
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
