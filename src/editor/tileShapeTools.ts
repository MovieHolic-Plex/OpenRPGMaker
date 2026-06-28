import type { PaintShape } from "@/editor/editorState";

export type TilePoint = {
  readonly x: number;
  readonly y: number;
};

export type TileBounds = {
  readonly width: number;
  readonly height: number;
};

export type TileRect = TilePoint & {
  readonly width: number;
  readonly height: number;
};

export function tileRectFromDrag(start: TilePoint, end: TilePoint): TileRect {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const right = Math.max(start.x, end.x);
  const bottom = Math.max(start.y, end.y);
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function tileRectWithinBounds(rect: TileRect, bounds: TileBounds): TileRect | null {
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(bounds.width - 1, rect.x + rect.width - 1);
  const bottom = Math.min(bounds.height - 1, rect.y + rect.height - 1);
  if (left > right || top > bottom) return null;
  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function tileCellsForPaintShape(
  shape: PaintShape,
  start: TilePoint,
  end: TilePoint,
  bounds: TileBounds
): readonly TilePoint[] {
  switch (shape) {
    case "pen":
      return isInsideBounds(end, bounds) ? [end] : [];
    case "rect":
      return rectCells(tileRectFromDrag(start, end), bounds);
    case "round":
      return roundCells(tileRectFromDrag(start, end), bounds);
    default:
      return assertNever(shape);
  }
}

function rectCells(rect: TileRect, bounds: TileBounds): readonly TilePoint[] {
  const clipped = tileRectWithinBounds(rect, bounds);
  if (!clipped) return [];
  const cells: TilePoint[] = [];
  for (let y = clipped.y; y < clipped.y + clipped.height; y += 1) {
    for (let x = clipped.x; x < clipped.x + clipped.width; x += 1) {
      cells.push({ x, y });
    }
  }
  return cells;
}

function roundCells(rect: TileRect, bounds: TileBounds): readonly TilePoint[] {
  const clipped = tileRectWithinBounds(rect, bounds);
  if (!clipped) return [];
  const cells: TilePoint[] = [];
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const radiusX = Math.max(rect.width / 2, 0.5);
  const radiusY = Math.max(rect.height / 2, 0.5);
  for (let y = clipped.y; y < clipped.y + clipped.height; y += 1) {
    for (let x = clipped.x; x < clipped.x + clipped.width; x += 1) {
      const normalizedX = (x + 0.5 - centerX) / radiusX;
      const normalizedY = (y + 0.5 - centerY) / radiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) cells.push({ x, y });
    }
  }
  return cells;
}

function isInsideBounds(point: TilePoint, bounds: TileBounds): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < bounds.width && point.y < bounds.height;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled paint shape: ${value}`);
}
