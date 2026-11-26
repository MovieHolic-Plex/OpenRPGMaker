import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// 빈 프로젝트는 케이스마다 모듈을 다시 읽어도(vi.resetModules) 파일에서 한 번만 짓는다 — 타일셋은 동결 공유(support/blankProject.ts).
import { freshBlankProject } from "./support/blankProject";
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
  const { TILE } = await import("@/project/defaults");
  const { store } = await import("@/project/store");
  const { paintTile } = await import("@/editor/tileActions");
  // TILE.* 는 옛 combined_town 칸 번호다 — 기본 칩셋이 beodeul_city 로 바뀐 뒤(PR #2335) 그 칩셋을 직접 깐다.
  const { startOnRetiredCombinedTown } = await import("./support/retiredEasyRpgTilesets");
  store.replace(startOnRetiredCombinedTown(freshBlankProject()));
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
});

describe("renderSelectionActionChips — 복사/붙여넣기/지우기/해제 버튼", () => {
  let restore: () => void;
  beforeEach(() => {
    restore = installFakeDom();
  });
  afterEach(() => {
    restore();
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

describe("붙여넣기는 선택 툴바를 따라오지 않는다", () => {
  it("enterPastePreview는 원본 선택을 유지한다", async () => {
    const { mapId, copySelection, enterPastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    expect(copySelection(mapId)).toBe(true);
    const before = editorState.get().selection;
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    expect(editorState.get().selection).toEqual(before);
    expect(editorState.get().pastePreview).toEqual({ x: 5, y: 5 });
  });

  it("confirmPastePreview는 붙여넣은 칸을 선택하지 않는다", async () => {
    const { mapId, copySelection, enterPastePreview, confirmPastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    expect(copySelection(mapId)).toBe(true);
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    expect(confirmPastePreview(mapId)).toBe(true);
    expect(editorState.get().pastePreview).toBeNull();
    expect(editorState.get().selection).toBeNull();
  });

  it("pasteClipboard는 대상 칸을 선택으로 올리지 않는다", async () => {
    const { mapId, copySelection } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    const { pasteClipboard } = await import("@/editor/mapClipboard");
    expect(copySelection(mapId)).toBe(true);
    const before = editorState.get().selection;
    expect(pasteClipboard(mapId, 5, 5)).toBe(true);
    expect(editorState.get().selection).toEqual(before);
  });

  it("movePastePreview가 같은 칸이면 통지하지 않는다", async () => {
    const { mapId, copySelection, enterPastePreview, movePastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    expect(copySelection(mapId)).toBe(true);
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    let notifications = 0;
    const unsub = editorState.subscribe(() => { notifications += 1; });
    movePastePreview(mapId, 5, 5);
    movePastePreview(mapId, 5, 5);
    unsub();
    expect(notifications).toBe(0);
  });

  it("맵을 바꾸면 붙여넣기 고스트를 버린다 — 다른 맵에 이전 클립보드를 찍지 않는다", async () => {
    const { mapId, copySelection, enterPastePreview, confirmPastePreview } = await setupWithSelection();
    const { editorState } = await import("@/editor/editorState");
    editorState.set({ currentMapId: mapId });
    expect(copySelection(mapId)).toBe(true);
    expect(enterPastePreview(mapId, 5, 5)).toBe(true);
    expect(editorState.get().pastePreview).not.toBeNull();

    editorState.set({ currentMapId: "map_other" });

    expect(editorState.get().pastePreview).toBeNull();
    expect(confirmPastePreview("map_other")).toBe(false);
    expect(editorState.get().clipboard).not.toBeNull();
  });
});
