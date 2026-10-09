// OPRN-OUT-026 편집기 표면 — 사용자가 가져온 메타를 받아들이기 전에 홈 레이어와
// 받침 정책을 직접 보고 바꿀 수 있어야 한다. 검토 목록은 자동으로 적용되지 않는다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { setTilesetMetadataEditMode } from "@/editor/panels/tilesetMetadataEditor";
import { setTileBackingOverride, userTileBackingOverride, userTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { tileBackingTile } from "@/editor/tileLayerPolicy";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID, TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const CONIFER_TRUNK = 290;

describe("타일 레이어·배경 정책 편집기 표면", () => {
  let restoreDom: (() => void) | null = null;

  beforeEach(() => {
    store.replace(createBlankProject());
    restoreDom = installFakeDom();
    setTilesetMetadataEditMode("passage", () => {});
  });

  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  function renderEditor(): FakeElement {
    const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
    return renderTilesetEditor(tileset, () => {}) as unknown as FakeElement;
  }

  function selectTile(tile: number): FakeElement {
    let editor = renderEditor();
    (findByTestId(editor, `tileset-db-cell-${tile}`) as unknown as HTMLElement).click();
    editor = renderEditor();
    return editor;
  }

  it("밑동을 고르면 정책 부류·근거와 다중 조각 제약이 보인다", () => {
    const editor = selectTile(CONIFER_TRUNK);
    const reason = findByTestId(editor, "tileset-layer-policy-reason") as unknown as { textContent?: string };
    expect(String(reason.textContent ?? "")).toContain("받침 있는 하위");
    expect(findByTestId(editor, "tileset-layer-multipart")).toBeTruthy();
  });

  it("받침 컨트롤에서 없음을 고르면 사용자 확정으로 기록되고 렌더 받침이 사라진다", () => {
    let editor = selectTile(CONIFER_TRUNK);
    expect(findByTestId(editor, "tileset-rule-backing")).toBeTruthy();
    (findByTestId(editor, "tileset-backing-none") as unknown as HTMLElement).click();

    const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
    expect(userTileBackingOverride(tileset, CONIFER_TRUNK)).toBe("none");
    expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBeNull();

    editor = selectTile(CONIFER_TRUNK);
    expect(findByTestId(editor, "tileset-layer-warning")).toBeTruthy();
  });

  it("받침을 잔디로 되돌리면 렌더 받침이 다시 붙는다", () => {
    selectTile(CONIFER_TRUNK);
    (findByTestId(renderEditor(), "tileset-backing-none") as unknown as HTMLElement).click();
    (findByTestId(renderEditor(), "tileset-backing-tile") as unknown as HTMLElement).click();

    const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
    expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.GRASS);
  });

  it("검토 목록은 받침 없는 투명 하위 타일이 생길 때만 나타난다", () => {
    expect(findByTestId(selectTile(CONIFER_TRUNK), "tileset-rule-review")).toBeNull();

    store.update((project) => {
      const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
      if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    });

    const editor = selectTile(CONIFER_TRUNK);
    expect(findByTestId(editor, "tileset-rule-review")).toBeTruthy();
    expect(findByTestId(editor, `tileset-review-item-${CONIFER_TRUNK}`)).toBeTruthy();
  });

  it("검토 항목의 상위 오버레이 선택은 그 타일만 상위로 확정한다", () => {
    store.update((project) => {
      const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
      if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    });
    const editor = selectTile(CONIFER_TRUNK);
    (findByTestId(editor, `tileset-review-${CONIFER_TRUNK}-overlay`) as unknown as HTMLElement).click();

    const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
    expect(userTileLayerOverride(tileset, CONIFER_TRUNK)).toBe("upper");
    expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("upper");
    expect(tileLayerHome(tileset, 291)).toBe("lower");
  });

  it("검토 항목의 자동 선택은 하네스 기본값으로 되돌린다", () => {
    store.update((project) => {
      const tileset = project.tilesets[COMBINED_TOWN_TILESET_ID];
      if (tileset) setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    });
    const editor = selectTile(CONIFER_TRUNK);
    (findByTestId(editor, `tileset-review-${CONIFER_TRUNK}-auto`) as unknown as HTMLElement).click();

    const tileset = store.getCurrent().tilesets[COMBINED_TOWN_TILESET_ID];
    expect(userTileLayerOverride(tileset, CONIFER_TRUNK)).toBeNull();
    expect(tileLayerHome(tileset, CONIFER_TRUNK)).toBe("lower");
    expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.GRASS);
  });
});
