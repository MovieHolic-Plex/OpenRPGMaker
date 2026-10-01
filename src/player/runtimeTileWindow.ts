import type { CullViewport } from './playSceneTileCulling';

/** worldView updates during render; centerOn/zoom may already have changed now. */
export function runtimeCameraTileView(camera: {
  worldView: CullViewport; scrollX?: number; scrollY?: number;
  width?: number; height?: number; zoomX?: number; zoomY?: number;
}): CullViewport {
  const { scrollX, scrollY, width, height, zoomX, zoomY } = camera;
  if (scrollX === undefined || scrollY === undefined || width === undefined || height === undefined
    || !zoomX || !zoomY) return camera.worldView;
  const displayWidth = Math.floor(width / zoomX + 0.5), displayHeight = Math.floor(height / zoomY + 0.5);
  return { x: Math.floor(scrollX + width / 2 - displayWidth / 2 + 0.5),
    y: Math.floor(scrollY + height / 2 - displayHeight / 2 + 0.5), width: displayWidth, height: displayHeight };
}

export interface ResidentTile {
  destroy?(removeFromDisplayList?: boolean): void;
}

/** Flat containers keep their original row-major order; cells only own lifetime. */
export class RuntimeTileWindow<T extends ResidentTile> {
  readonly cells = new Map<number, T[]>();
  readonly order = new WeakMap<object, { cell: number; part: number }>();
  private windowKey = '';

  constructor(readonly width: number, readonly height: number, readonly tileSize: number) {}

  sync(view: CullViewport, render: (x: number, y: number) => T[], remove: (tile: T) => void): boolean {
    if (![view.x, view.y, view.width, view.height].every(Number.isFinite)
      || view.width <= 0 || view.height <= 0) return false;
    // Four cells cover quarter offsets and a camera step before worldView updates.
    const minX = Math.max(0, Math.floor(view.x / this.tileSize) - 4);
    const minY = Math.max(0, Math.floor(view.y / this.tileSize) - 4);
    const maxX = Math.min(this.width - 1, Math.ceil((view.x + view.width) / this.tileSize) + 4);
    const maxY = Math.min(this.height - 1, Math.ceil((view.y + view.height) / this.tileSize) + 4);
    const key = `${minX},${minY},${maxX},${maxY}`;
    if (key === this.windowKey) return false;
    this.windowKey = key;
    for (const [index, tiles] of this.cells) {
      const x = index % this.width, y = Math.floor(index / this.width);
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) continue;
      for (const tile of tiles) remove(tile);
      this.cells.delete(index);
    }
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const index = y * this.width + x;
        if (this.cells.has(index)) continue;
        const tiles = render(x, y);
        tiles.forEach((tile, part) => this.order.set(tile, { cell: index, part }));
        this.cells.set(index, tiles);
      }
    }
    return true;
  }

  /** Farm/placeable objects have no cell order and stay after terrain, stably. */
  sort(list: unknown[]): void {
    list.sort((left, right) => {
      const a = this.order.get(left as object), b = this.order.get(right as object);
      if (!a) return b ? 1 : 0;
      if (!b) return -1;
      return a.cell - b.cell || a.part - b.part;
    });
  }

  /** Preserve the full renderer's tie order against existing characters too. */
  sortRoots(list: unknown[], beforeTiles: { has(value: object): boolean }): void {
    list.sort((left, right) => {
      const depth = (left as { depth: number }).depth - (right as { depth: number }).depth;
      if (depth) return depth;
      const a = this.order.get(left as object), b = this.order.get(right as object);
      if (a && b) return a.cell - b.cell || a.part - b.part;
      const rank = (image: unknown, tile: boolean) => tile ? 1 : beforeTiles.has(image as object) ? 0 : 2;
      return rank(left, !!a) - rank(right, !!b);
    });
  }
}
