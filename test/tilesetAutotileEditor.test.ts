import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyAutotileSheetPick,
  renderAutotileEditorPanel,
  renderAutotileLayoutToolbar,
  resetAutotileComposerState,
} from "@/editor/panels/tilesetAutotileEditor";
import { createBlankProject, DEFAULT_TILESET_ID } from "@/project/defaults";
import { DEFAULT_TILES_PER_ROW } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  resetAutotileComposerState();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  resetAutotileComposerState();
});

function renderComposer(rerender: () => void): FakeElement {
  const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
  const root = document.createElement("div") as unknown as FakeElement;
  (root as unknown as HTMLElement).append(
    renderAutotileLayoutToolbar(tileset, rerender),
    renderAutotileEditorPanel(tileset, rerender),
  );
  return root;
}

describe("tileset autotile editor", () => {
  it("기본 Combined Town 내장 오토타일 그룹을 읽기 전용 칩과 격자로 표시한다", () => {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const root = renderWithFakeDom(() => renderAutotileEditorPanel(tileset, vi.fn()));

    expect(findByTestId(root, "tileset-autotile-group-builtin_dirt_road")).toBeTruthy();
    expect(findByTestId(root, "tileset-autotile-group-builtin_sand")).toBeTruthy();
    expect(findByTestId(root, "tileset-autotile-builtin-builtin_dirt_road")?.textContent).toContain("내장");
    expect(findByTestId(root, "tileset-autotile-builtin-builtin_sand")?.textContent).toContain("내장");
    expect(findByTestId(root, "tileset-autotile-layout-badge-builtin_dirt_road")?.textContent).toBe("11칸");
    expect(findByTestId(root, "tileset-autotile-slot-builtin_dirt_road-body")).toBeTruthy();
  });

  it("9칸·11칸·커스텀 형식 카드가 보인다", () => {
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const toolbar = renderWithFakeDom(() => renderAutotileLayoutToolbar(tileset, vi.fn()));
    expect(findByTestId(toolbar, "tileset-autotile-layout-cells-9")).toBeTruthy();
    expect(findByTestId(toolbar, "tileset-autotile-layout-cells-11")).toBeTruthy();
    expect(findByTestId(toolbar, "tileset-autotile-layout-custom")).toBeTruthy();
  });

  it("9칸을 고르고 시트 앵커를 누르면 3×3 그룹이 생긴다", () => {
    let root: FakeElement = renderComposer(() => {
      root = renderComposer(() => {
        root = renderComposer(() => {});
      });
    });
    (findByTestId(root, "tileset-autotile-layout-cells-9") as unknown as HTMLElement).click();
    applyAutotileSheetPick(store.getCurrent().tilesets[DEFAULT_TILESET_ID]!, 33);

    const groups = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.autotileGroups ?? [];
    const created = groups.find((group) => group.memberTileIds[0] === 33);
    expect(created).toBeTruthy();
    expect(created?.memberTileIds).toHaveLength(9);
    expect(created?.neighborhood).toBe(4);
    expect(created?.memberTileIds).toEqual([
      33, 34, 35,
      33 + DEFAULT_TILES_PER_ROW, 34 + DEFAULT_TILES_PER_ROW, 35 + DEFAULT_TILES_PER_ROW,
      33 + DEFAULT_TILES_PER_ROW * 2, 34 + DEFAULT_TILES_PER_ROW * 2, 35 + DEFAULT_TILES_PER_ROW * 2,
    ]);
  });

  it("커스텀 그룹은 칸을 고른 뒤 시트 타일을 그 역할에 넣는다", () => {
    let root: FakeElement = renderComposer(() => {
      root = renderComposer(() => {
        root = renderComposer(() => {});
      });
    });
    (findByTestId(root, "tileset-autotile-layout-custom") as unknown as HTMLElement).click();
    const tileset = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!;
    const custom = (tileset.autotileGroups ?? []).find((group) => group.name.includes("커스텀"));
    expect(custom).toBeTruthy();
    applyAutotileSheetPick(tileset, 64);
    const updated = store.getCurrent().tilesets[DEFAULT_TILESET_ID]!.autotileGroups?.find((group) => group.id === custom!.id);
    expect(updated?.memberTileIds).toContain(64);
  });
});
