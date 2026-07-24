import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | null = null;

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

beforeEach(() => {
  vi.resetModules();
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.resetModules();
});

async function setupWithSelection(): Promise<{
  readonly mapId: string;
  readonly copySelection: (mapId: string) => boolean;
  readonly enterPastePreview: (mapId: string, x: number, y: number) => boolean;
  readonly movePastePreview: (mapId: string, x: number, y: number) => void;
  readonly confirmPastePreview: (mapId: string) => boolean;
  readonly cancelPastePreview: () => boolean;
  readonly clearSelection: () => void;
  readonly clearSelectionRegion: (mapId: string) => boolean;
}> {
  const { editorState } = await import("@/editor/editorState");
  const {
    cancelPastePreview,
    clearSelection,
    clearSelectionRegion,
    confirmPastePreview,
    copySelection,
    enterPastePreview,
    movePastePreview,
    selectTileRegion,
  } = await import("@/editor/mapClipboard");
  const { createBlankProject, TILE } = await import("@/project/defaults");
  const { store } = await import("@/project/store");
  const { paintTile } = await import("@/editor/tileActions");
  store.replace(createBlankProject());
  editorState.set({ selection: null, clipboard: null, pastePreview: null, tool: "select", layer: "lower" });
  const mapId = store.getCurrent().startMapId;
  // 원본 타일 배치
  paintTile(mapId, "lower", 1, 1, TILE.WATER);
  paintTile(mapId, "lower", 2, 1, TILE.GRASS);
  paintTile(mapId, "upper", 1, 1, TILE.FLOWERS);
  // 2x2 선택
  selectTileRegion(mapId, { mapId, x: 1, y: 1, width: 2, height: 2 });
  return {
    mapId,
    copySelection,
    enterPastePreview,
    movePastePreview,
    confirmPastePreview,
    cancelPastePreview,
    clearSelection,
    clearSelectionRegion,
  };
}

describe("북여넣기 미리보기 모드", () => {
  it("복사 후 enterPastePreview → confirmPastePreview로 실제 붙여넣기", async () => {
    const { mapId, copySelection, enterPastePreview, confirmPastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    const { store } = await import("@/project/store");
    const { TILE } = await import("@/project/defaults");

    expect(copySelection(mapId)).toBe(true);

    // 미리보기 진입
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    expect(editorState.get().pastePreview).toEqual({ x: 5, y: 5 });

    // 확정
    expect(confirmPastePreview(mapId)).toBe(true);
    expect(editorState.get().pastePreview).toBeNull();

    // 실제로 붙여넣어졌는지 확인
    const map = store.getCurrent().maps[mapId];
    const idx = 5 * map.width + 5; // (5,5) — 붙여넣기 원점
    expect(map.lowerTiles[idx]).toBe(TILE.WATER);
  });

  it("cancelPastePreview로 미리보기 취소 — 맵 변화 없음", async () => {
    const { mapId, copySelection, enterPastePreview, cancelPastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    const { store } = await import("@/project/store");
    const { TILE } = await import("@/project/defaults");

    expect(copySelection(mapId)).toBe(true);
    const before = [...store.getCurrent().maps[mapId].lowerTiles];

    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    expect(cancelPastePreview()).toBe(true);
    expect(editorState.get().pastePreview).toBeNull();

    // 맵이 변하지 않았는지 확인
    const after = [...store.getCurrent().maps[mapId].lowerTiles];
    expect(after).toEqual(before);
  });

  it("클립보드 없이 enterPastePreview → false + 안내 토스트", async () => {
    const { mapId, enterPastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    editorState.set({ clipboard: null });

    expect(enterPastePreview(mapId, 5, 5)).toBe(false);
    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("복사");
  });

  it("movePastePreview로 위치 갱신", async () => {
    const { mapId, copySelection, enterPastePreview, movePastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");

    expect(copySelection(mapId)).toBe(true);
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    movePastePreview(mapId, 7, 3);
    expect(editorState.get().pastePreview).toEqual({ x: 7, y: 3 });
  });

  it("movePastePreview가 맵 경계를 벗어나지 않게 클램프", async () => {
    const { mapId, copySelection, enterPastePreview, movePastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    const { store } = await import("@/project/store");
    const map = store.getCurrent().maps[mapId];

    expect(copySelection(mapId)).toBe(true);
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    // 맵 밖으로 이동 시도
    movePastePreview(mapId, 9999, 9999);
    const preview = editorState.get().pastePreview!;
    expect(preview.x).toBeLessThanOrEqual(map.width - 2);
    expect(preview.y).toBeLessThanOrEqual(map.height - 2);
  });
});

describe("clearSelection / clearSelectionRegion", () => {
  it("clearSelection이 selection과 pastePreview를 모두 해제", async () => {
    const { mapId, copySelection, enterPastePreview, clearSelection } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");

    expect(copySelection(mapId)).toBe(true);
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    clearSelection();
    expect(editorState.get().selection).toBeNull();
    expect(editorState.get().pastePreview).toBeNull();
  });

  it("clearSelectionRegion이 선택 영역을 빈 칸으로", async () => {
    const { mapId, clearSelectionRegion } = await setupWithSelection();
    const { store } = await import("@/project/store");
    const { TILE } = await import("@/project/defaults");

    expect(clearSelectionRegion(mapId)).toBe(true);
    const map = store.getCurrent().maps[mapId];
    // (1,1) 자리가 비워졌는지
    const idx = 1 * map.width + 1;
    expect(map.lowerTiles[idx]).toBe(-1);
    expect(map.upperTiles[idx]).toBe(-1);
    expect(map.lowerTiles[1 * map.width + 2]).toBe(-1);
  });

  it("clearSelectionRegion 토스트에 '지우기' 포함", async () => {
    const { mapId, clearSelectionRegion } = await setupWithSelection();
    clearSelectionRegion(mapId);
    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("지우기");
  });
});

describe("copySelection 피드백 개선", () => {
  it("복사 토스트에 크기 정보 포함", async () => {
    const { mapId, copySelection } = await setupWithSelection();
    copySelection(mapId);
    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("2×2");
  });
});

describe("renderSelectionActionChips — 복사/붙여넣기/지우기/해제 버튼", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installFakeDom();
  });
  afterEach(() => {
    restore();
  });

  it("복사/지우기/AI/해제 버튼이 렌더된다", async () => {
    const { editorState } = await import("@/editor/editorState");
    const { renderSelectionActionChips } = await import("@/editor/selectionActionChips");
    editorState.set({ clipboard: null });
    const bar = renderSelectionActionChips({ mapId: "map-1", x: 3, y: 4, width: 5, height: 6 });
    document.body.append(bar);
    const body = document.body as unknown as FakeElement;
    expect(findByTestId(body, "selection-chip-copy")).toBeTruthy();
    expect(findByTestId(body, "selection-chip-clear")).toBeTruthy();
    expect(findByTestId(body, "selection-chip-ai")).toBeTruthy();
    expect(findByTestId(body, "selection-chip-dismiss")).toBeTruthy();
    expect(findByTestId(body, "selection-chips-size")?.textContent).toBe("5×6");
  });

  it("클립보드가 있으면 붙여넣기 버튼이 나타난다", async () => {
    const { editorState } = await import("@/editor/editorState");
    const { renderSelectionActionChips } = await import("@/editor/selectionActionChips");
    editorState.set({
      clipboard: { width: 2, height: 2, lower: { tiles: [], stacks: [] }, upper: { tiles: [], stacks: [] } },
    });
    const bar = renderSelectionActionChips({ mapId: "map-1", x: 0, y: 0, width: 1, height: 1 });
    document.body.append(bar);
    expect(findByTestId(document.body as unknown as FakeElement, "selection-chip-paste")).toBeTruthy();
  });

  it("클립보드가 없으면 붙여넣기 버튼이 없다", async () => {
    const { editorState } = await import("@/editor/editorState");
    const { renderSelectionActionChips } = await import("@/editor/selectionActionChips");
    editorState.set({ clipboard: null });
    const bar = renderSelectionActionChips({ mapId: "map-1", x: 0, y: 0, width: 1, height: 1 });
    document.body.append(bar);
    expect(findByTestId(document.body as unknown as FakeElement, "selection-chip-paste")).toBeFalsy();
  });
});
