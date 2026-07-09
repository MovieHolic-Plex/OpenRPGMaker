import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBasicLeftRail } from "@/editor/panels/basicLeftRail";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

function click(id: string): void {
  const node = findByTestId(document.body as unknown as FakeElement, id) as unknown as HTMLElement | null;
  if (!node) throw new Error(`testid not found: ${id}`);
  node.click();
}

describe("basic icon rail", () => {
  let restore: () => void;
  let container: HTMLElement;

  beforeEach(() => {
    restore = installFakeDom();
    resetEditorUiModeForTests("basic");
    store.replace(createBlankProject());
    editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId });
    container = document.createElement("div");
    document.body.append(container);
    renderBasicLeftRail(container);
  });
  afterEach(() => { restore(); });

  it("도구 6개 아이콘 버튼을 기존 testid로 렌더한다", () => {
    for (const id of ["select", "paint", "erase", "fill", "event", "eyedropper"]) {
      expect(findByTestId(container as unknown as FakeElement, `tool-${id}`)).toBeTruthy();
    }
  });

  it("도구 클릭이 editorState를 갱신한다 (이벤트 도구는 레이어 동반 전환)", () => {
    click("tool-event");
    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");
    renderBasicLeftRail(container);
    click("tool-paint");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().paintShape).toBe("pen");
  });

  it("타일 토글 → 플라이아웃에 타일 그리드, 타일 클릭 시 브러시 전환", () => {
    click("basic-rail-toggle-tiles");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeTruthy();
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeTruthy();
    click("basic-tile-0");
    expect(editorState.get().selectedTile).toBe(0);
    expect(editorState.get().tool).toBe("paint");
  });

  it("레이어 토글 → 플라이아웃에서 layer-upper 클릭 시 레이어 전환", () => {
    click("basic-rail-toggle-layers");
    renderBasicLeftRail(container);
    click("layer-upper");
    expect(editorState.get().layer).toBe("upper");
  });

  it("맵 토글 → 플라이아웃에 맵 트리 렌더", () => {
    click("basic-rail-toggle-maps");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "map-tree")).toBeTruthy();
  });
});
