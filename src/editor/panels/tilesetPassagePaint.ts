import type { PassageMark } from "@/project/tilesetPassage";

let passagePaint: PassageMark = "o";

export function getTilesetPassagePaint(): PassageMark {
  return passagePaint;
}

export function setTilesetPassagePaint(mark: PassageMark): void {
  passagePaint = mark;
}
