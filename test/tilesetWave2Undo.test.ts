import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import {
  addAutotileGroup,
  fillAutotileVariantMap,
  removeAutotileGroup,
  seedDefaultAutotileGroups,
  setAutotileVariant,
  setTerrainTag,
  setTilePassageBulk,
  setTilePassageFlag,
  updateAutotileGroup,
} from "@/editor/tilesetActions";
import { renderTileGroupPanel, handleGroupTileClick } from "@/editor/panels/tilesetGroupEditor";
import { openTilesetSettingsModal } from "@/editor/panels/tilesetPassageModal";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

// tilesetActions.ts/tilesetGroupEditor.ts/tilesetPassageModal.ts/tilesetSettingsDetails.ts
// 전부 store.update만 호출하고 recordProjectSnapshot/recordCoalescedSnapshot을 부르지 않아
// Ctrl+Z가 통째로 무반응이었다(qa-terrain-report.md Critical). 각 뮤테이터가 undo 스냅샷을
// 남기는지 직접 검증한다.

class FakeMouseEvent extends Event {
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
  constructor(type: string, init: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) {
    super(type);
    this.ctrlKey = init.ctrlKey ?? false;
    this.metaKey = init.metaKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
  }
}

let previousWindow: typeof globalThis.window | undefined;
let previousMouseEvent: typeof globalThis.MouseEvent | undefined;

function stubBrowserGlobals(): void {
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      setTimeout: (handler: TimerHandler): number => {
        if (typeof handler === "function") handler();
        return 0;
      },
      clearTimeout,
    },
  });
  previousMouseEvent = globalThis.MouseEvent;
  Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: FakeMouseEvent });
}

function restoreBrowserGlobals(): void {
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  if (previousMouseEvent === undefined) Reflect.deleteProperty(globalThis, "MouseEvent");
  else Object.defineProperty(globalThis, "MouseEvent", { configurable: true, value: previousMouseEvent });
}

function firstTilesetId(): string {
  const id = Object.keys(store.getCurrent().tilesets)[0];
  if (!id) throw new Error("no default tileset");
  return id;
}

describe("tileset wave2 undo wiring", () => {
  let cleanupDom: (() => void) | undefined;
  let tilesetId: string;

  beforeEach(() => {
    cleanupDom = installFakeDom();
    stubBrowserGlobals();
    store.replace(createBlankProject());
    resetMapEditHistory();
    tilesetId = firstTilesetId();
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = undefined;
    restoreBrowserGlobals();
  });

  it("setTerrainTag/setTilePassageFlag/setTilePassageBulk each record an undoable snapshot", () => {
    expect(getMapEditHistoryState().canUndo).toBe(false);

    setTerrainTag(tilesetId, 0, 3);
    expect(store.getCurrent().tilesets[tilesetId]?.terrain[0]).toBe(3);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.terrain[0]).not.toBe(3);

    // establish a known baseline (true) before toggling, so the assertion doesn't
    // depend on the tileset's actual default passability values
    setTilePassageFlag(tilesetId, 1, "up", true);
    resetMapEditHistory();
    setTilePassageFlag(tilesetId, 1, "up", false);
    expect(store.getCurrent().tilesets[tilesetId]?.passability[1]?.up).toBe(false);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.passability[1]?.up).toBe(true);

    setTilePassageBulk(tilesetId, 2, true);
    resetMapEditHistory();
    setTilePassageBulk(tilesetId, 2, false);
    expect(store.getCurrent().tilesets[tilesetId]?.passability[2]).toEqual({ up: false, down: false, left: false, right: false });
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.passability[2]).toEqual({ up: true, down: true, left: true, right: true });
  });

  it("autotile group mutators (add/seed/remove/update/variant/fill) all record undo snapshots", () => {
    const groupId = addAutotileGroup(tilesetId, "테스트 그룹");
    expect(groupId).toBeTruthy();
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.some((group) => group.id === groupId)).toBeFalsy();

    seedDefaultAutotileGroups(tilesetId);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    const seededCount = store.getCurrent().tilesets[tilesetId]?.autotileGroups?.length ?? 0;
    expect(seededCount).toBeGreaterThan(0);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.length ?? 0).toBe(0);

    const id2 = addAutotileGroup(tilesetId, "그룹2");
    if (!id2) throw new Error("failed to add group");
    resetMapEditHistory();

    removeAutotileGroup(tilesetId, id2);
    // removing the only group deletes the (now-empty) autotileGroups field entirely
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.some((group) => group.id === id2) ?? false).toBe(false);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.some((group) => group.id === id2) ?? false).toBe(true);

    setAutotileVariant(tilesetId, id2, 5, 42);
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.find((group) => group.id === id2)?.variantMap["5"]).toBe(42);
    expect(undoMapEdit()).toBe(true);

    fillAutotileVariantMap(tilesetId, id2, {
      body: 0, edgeN: 1, edgeS: 2, edgeE: 3, edgeW: 4,
      cornerNE: 5, cornerNW: 6, cornerSE: 7, cornerSW: 8,
    });
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
  });

  // fix(db): updateAutotileGroup의 patch에 name 같은 텍스트 필드가 오면 호출부(오토타일
  // 에디터)가 키 입력마다 부를 수 있다 — 코얼레스 적용으로 같은 필드의 연속 편집은
  // undo 스택에 1개만 남아야 한다.
  it("coalesces consecutive updateAutotileGroup(name) calls into a single undo snapshot", () => {
    const groupId = addAutotileGroup(tilesetId, "오토타일");
    if (!groupId) throw new Error("failed to add group");
    resetMapEditHistory();

    updateAutotileGroup(tilesetId, groupId, { name: "오" });
    updateAutotileGroup(tilesetId, groupId, { name: "오토" });
    updateAutotileGroup(tilesetId, groupId, { name: "오토타일2" });
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.find((g) => g.id === groupId)?.name).toBe("오토타일2");

    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.autotileGroups?.find((g) => g.id === groupId)?.name).toBe("오토타일");
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("saveGroup (tile group editor) records an undo snapshot", () => {
    const rerender = (): void => undefined;
    const tileset = store.getCurrent().tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const panel = renderTileGroupPanel(tileset, rerender) as unknown as FakeElement;

    handleGroupTileClick(3, new MouseEvent("click"), rerender);

    const saveButton = findByTestId(panel, "tileset-group-save");
    if (!saveButton) throw new Error("missing save button");
    const before = store.getCurrent().tilesets[tilesetId]?.tileGroups?.length ?? 0;
    saveButton.click();

    expect(store.getCurrent().tilesets[tilesetId]?.tileGroups?.length ?? 0).toBe(before + 1);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.tileGroups?.length ?? 0).toBe(before);
  });

  it("the full-sheet passage modal's cell click records an undo snapshot", () => {
    const rerender = (): void => undefined;
    openTilesetSettingsModal(tilesetId, rerender);
    const cell = document.querySelector("[data-testid='tileset-passage-cell-0']");
    if (!(cell instanceof HTMLElement)) throw new Error("missing passage cell");
    const before = store.getCurrent().tilesets[tilesetId]?.passability[0];

    cell.click();

    expect(store.getCurrent().tilesets[tilesetId]?.passability[0]).not.toEqual(before);
    expect(getMapEditHistoryState().canUndo).toBe(true);
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.passability[0]).toEqual(before);
  });

  it("coalesces keystroke edits to the tileset name field into a single undo snapshot", () => {
    const rerender = (): void => undefined;
    const tileset = store.getCurrent().tilesets[tilesetId];
    if (!tileset) throw new Error("missing tileset");
    const editor = renderTilesetEditor(tileset, rerender) as unknown as FakeElement;
    const nameInput = findByTestId(editor, "tileset-rm2k3-name-input");
    if (!nameInput) throw new Error("missing name input");

    for (const next of ["Q", "QA", "QA이", "QA이름"]) {
      nameInput.value = next;
      nameInput.dispatchEvent(new Event("input"));
    }
    expect(store.getCurrent().tilesets[tilesetId]?.name).toBe("QA이름");
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent().tilesets[tilesetId]?.name).toBe(tileset.name);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });
});
