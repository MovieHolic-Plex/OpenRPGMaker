import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderTilePalette } from "@/editor/panels/tilePalette";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

const openMapPropertiesDialog = vi.fn();
vi.mock("@/editor/panels/mapPropertiesDialog", () => ({
  openMapPropertiesDialog: (...args: unknown[]) => openMapPropertiesDialog(...args),
}));

/**
 * 선택 칩의 글자 조각은 눌리는 것이다. 2026-09-03 까지 타일셋 이름은 span 이라 버튼처럼
 * 테두리 친 칩에서 눌러도 아무 일이 없었다 — 사용자 지적("타일 세트를 눌러도 반응이 없다").
 */
describe("타일 팔레트 선택 칩", () => {
  let restore: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    restore = installFakeDom();
    openMapPropertiesDialog.mockClear();
    store.replace(createBlankProject());
    container = document.createElement("div");
    document.body.append(container);
    editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId, selectedTile: 0 });
    renderTilePalette(container);
  });

  afterEach(() => {
    restore();
  });

  it("타일셋 이름은 버튼이고, 누르면 현재 맵의 맵 설정을 타일 그림판에 초점을 두고 연다", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId]!;
    const tilesetName = findByTestId(container as unknown as FakeElement, "palette-tileset-name");
    expect(tilesetName).not.toBeNull();
    expect(tilesetName?.tagName).toBe("BUTTON");
    expect(tilesetName?.textContent).toBe(project.tilesets[map.tilesetId]?.name);
    expect(tilesetName?.getAttribute("aria-label")).toContain("맵 설정");

    tilesetName?.click();

    expect(openMapPropertiesDialog).toHaveBeenCalledTimes(1);
    expect(openMapPropertiesDialog).toHaveBeenCalledWith(map.id, map.name, { focus: "tileset" });
  });

  it("선택 타일 이름도 버튼이다 — 칩에서 눌리지 않는 글자를 남기지 않는다", () => {
    const label = findByTestId(container as unknown as FakeElement, "selected-tile-reveal");
    expect(label).not.toBeNull();
    expect(label?.tagName).toBe("BUTTON");
    // 속성(⚙)은 그대로 세 번째 버튼이다.
    expect(findByTestId(container as unknown as FakeElement, "selected-tile-props-open")?.tagName).toBe("BUTTON");
  });
});
