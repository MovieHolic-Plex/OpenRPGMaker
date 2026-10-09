import {
  createPaletteStampFromDisplayDrag,
  createPaletteStampFromDrag,
  type PaletteStamp,
} from "@/editor/tilePaletteStamp";
import type { TilesetDef } from "@/project/types";

/**
 * 팔레트 위 사각 드래그 → Combo Brush 한 자루.
 *
 * 예전에는 이 제스처가 **커스텀 아틀라스 전용**이었다(칸 위치 = 원본 좌표라 사각형이 자명했다).
 * 기본 팔레트는 6열 리플로우라 "칸 위치"가 원본 좌표가 아니고, 그래서 조합 선택 자체가
 * 불가능했다 — OPRN-OUT-022 이 부른 바로 그 구멍이다.
 *
 * 두 팔레트의 차이는 **좌표를 무엇으로 읽는가** 하나뿐이므로, 그 한 가지만 `stampFor` 로
 * 주입받고 포인터·취소·미리보기 뼈대는 공유한다. 드래그 중 강조(`stamp-source`)도
 * 실제 만들어질 스탬프의 셀 목록으로 칠하므로 **미리보기와 결과가 어긋날 수 없다**.
 */
export type PaletteStampFactory = (input: {
  readonly endTile: number;
  readonly startTile: number;
}) => PaletteStamp;

/** 커스텀 아틀라스: 칸 위치가 곧 원본 시트 좌표. */
export function sourceCoordinateStampFactory(tileset: TilesetDef): PaletteStampFactory {
  return (input) => createPaletteStampFromDrag({ ...input, tileset });
}

/**
 * 기본(리플로우) 팔레트: 화면에 깔린 순서가 좌표다. 오토타일 대표 칸이 앞에 축약돼 있고
 * 변형 타일은 숨겨져 있으므로 **보이는 목록 그대로**를 격자로 읽어야 사용자가 고른 사각형과
 * 만들어지는 붓이 일치한다.
 */
export function displayOrderStampFactory(input: {
  readonly displayTiles: readonly number[];
  readonly displayTilesPerRow: number;
  readonly tileset: TilesetDef;
}): PaletteStampFactory {
  return (drag) => createPaletteStampFromDisplayDrag({ ...drag, ...input });
}

/** Source-coordinate or display-order drag. No state mutation until release. */
export function installPaletteStampGesture(
  sheet: HTMLElement,
  grid: HTMLElement,
  stampFor: PaletteStampFactory,
  onSelect: (tile: number) => void,
  onStamp: (stamp: PaletteStamp) => void,
): void {
  let cancel: (() => void) | null = null;
  // 창 초점 이탈로 드래그를 버리는 건 브라우저 경계다 — window 가 없는 호스트(경량 DOM 테스트,
  // 서버 렌더)에서는 그 보조 장치만 없을 뿐 제스쳐 자체는 그대로 살아야 한다.
  const hostWindow: Pick<Window, "addEventListener" | "removeEventListener"> | null =
    typeof window === "undefined" ? null : window;
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
      const stamp = stampFor({ startTile, endTile: tile });
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
      hostWindow?.removeEventListener("blur", cleanup);
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
      else onStamp(stampFor({ startTile, endTile }));
    };
    const observer = new MutationObserver(() => { if (!sheet.isConnected) cleanup(); });
    observer.observe(document.body, { childList: true, subtree: true });
    cancel = cleanup;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", abort);
    sheet.addEventListener("scroll", cleanup, true);
    hostWindow?.addEventListener("blur", cleanup);
  }, true);
}

/** 기존 호출 이름 — 커스텀 아틀라스 경로. */
export function installCustomPaletteGesture(
  sheet: HTMLElement,
  grid: HTMLElement,
  tileset: TilesetDef,
  onSelect: (tile: number) => void,
  onStamp: (stamp: PaletteStamp) => void,
): void {
  installPaletteStampGesture(sheet, grid, sourceCoordinateStampFactory(tileset), onSelect, onStamp);
}
