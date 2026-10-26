import type { TileClipboard } from "@/editor/editorState";

/**
 * 붙여넣기 고스트가 그리는 한 칸의 조각. 순서는 맵 렌더와 같다:
 * 1층 → 1층 스택 → 2층 → 그림자 → 3층 → 3층 스택 → 4층.
 * 2·4층은 합성 없이 칩 그대로(`raw`). 1·3층과 스택은 맵과 같이 합성(`composed`).
 */
export type PasteGhostPiece =
  | { readonly draw: "composed" | "raw"; readonly tile: number; readonly alpha: number }
  | { readonly draw: "shadow"; readonly bits: number; readonly alpha: number };

/** 고스트의 1·2층 알파. 3·4층은 그보다 진하게 두어 위층이 읽힌다. */
const LOWER_ALPHA = 0.4;
const UPPER_ALPHA = 0.55;

/**
 * 클립보드 칸 `index` 를 확정 붙여넣기와 같은 순서로 펼친다.
 * 빈 칸(-1)·없는 선택 층은 조각을 만들지 않는다. 옛 클립보드에 overlay·shadow 가 없어도 1·3층은 그대로다.
 */
export function pasteGhostPieces(clipboard: TileClipboard, index: number): readonly PasteGhostPiece[] {
  const pieces: PasteGhostPiece[] = [];
  pushTiles(pieces, clipboard.lower.tiles[index], clipboard.lower.stacks?.[index], "composed", LOWER_ALPHA);
  const lowerOverlay = clipboard.lower.overlay?.[index] ?? -1;
  if (lowerOverlay >= 0) pieces.push({ draw: "raw", tile: lowerOverlay, alpha: LOWER_ALPHA });
  const bits = (clipboard.shadow?.[index] ?? 0) & 0b1111;
  if (bits !== 0) pieces.push({ draw: "shadow", bits, alpha: 0.5 * LOWER_ALPHA });
  pushTiles(pieces, clipboard.upper.tiles[index], clipboard.upper.stacks?.[index], "composed", UPPER_ALPHA);
  const upperOverlay = clipboard.upper.overlay?.[index] ?? -1;
  if (upperOverlay >= 0) pieces.push({ draw: "raw", tile: upperOverlay, alpha: UPPER_ALPHA });
  return pieces;
}

function pushTiles(
  pieces: PasteGhostPiece[],
  base: number | undefined,
  stack: readonly number[] | undefined,
  draw: "composed" | "raw",
  alpha: number,
): void {
  if (base !== undefined && base >= 0) pieces.push({ draw, tile: base, alpha });
  for (const tile of stack ?? []) {
    if (tile >= 0) pieces.push({ draw, tile, alpha });
  }
}
