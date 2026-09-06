import { createPaletteStampFromDrag, type PaletteStamp } from "@/editor/tilePaletteStamp";
import type { TilesetDef } from "@/project/types";

/** Source-coordinate drag, never the reflowed default palette. No state mutation until release. */
export function installCustomPaletteGesture(
  sheet: HTMLElement,
  grid: HTMLElement,
  tileset: TilesetDef,
  onSelect: (tile: number) => void,
  onStamp: (stamp: PaletteStamp) => void,
): void {
  let cancel: (() => void) | null = null;
  const tileAt = (event: PointerEvent): HTMLElement | null => {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    const cell = target.closest<HTMLElement>(".chipset-tile");
    return cell && grid.contains(cell) ? cell : null;
  };
  grid.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const start = tileAt(event);
    if (!start) return;
    cancel?.();
    event.preventDefault();
    event.stopPropagation();
    const startTile = Number(start.dataset.tileIndex);
    const pointerId = event.pointerId;
    start.focus({ preventScroll: true });
    const preview = (tile: number): void => {
      const stamp = createPaletteStampFromDrag({ startTile, endTile: tile, tileset });
      const ids = new Set(stamp.cells.map(cell => cell.tile));
      for (const cell of grid.querySelectorAll<HTMLElement>(".chipset-tile")) {
        cell.classList.toggle("stamp-source", ids.has(Number(cell.dataset.tileIndex)));
      }
    };
    const move = (next: PointerEvent): void => {
      if (next.pointerId !== pointerId) return;
      const cell = tileAt(next);
      if (cell) preview(Number(cell.dataset.tileIndex));
    };
    const cleanup = (): void => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", abort);
      sheet.removeEventListener("scroll", cleanup, true);
      window.removeEventListener("blur", cleanup);
      observer.disconnect();
      for (const cell of grid.querySelectorAll(".stamp-source")) cell.classList.remove("stamp-source");
      cancel = null;
    };
    const abort = (next: Event): void => {
      if (next instanceof PointerEvent && next.pointerId !== pointerId) return;
      cleanup();
    };
    const finish = (next: PointerEvent): void => {
      if (next.pointerId !== pointerId) return;
      const cell = tileAt(next);
      cleanup();
      if (!cell || !sheet.isConnected) return;
      const endTile = Number(cell.dataset.tileIndex);
      if (endTile === startTile) onSelect(startTile);
      else onStamp(createPaletteStampFromDrag({ startTile, endTile, tileset }));
    };
    const observer = new MutationObserver(() => { if (!sheet.isConnected) cleanup(); });
    observer.observe(document.body, { childList: true, subtree: true });
    cancel = cleanup;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", abort);
    sheet.addEventListener("scroll", cleanup, true);
    window.addEventListener("blur", cleanup);
  }, true);
}
