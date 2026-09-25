import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBasicLeftRail, resetBasicLeftRailForTests } from "@/editor/panels/basicLeftRail";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { uiLabel } from "@/editor/uiCopy";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { clearChildren } from "@/util/dom";
import { createMapFromSpec } from "@/editor/actions";
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
    resetEditorUiModeForTests("beginner");
    store.replace(createBlankProject());
    editorState.set({ tool: "paint", layer: "lower", currentMapId: store.getCurrent().startMapId });
    container = document.createElement("div");
    document.body.append(container);
    renderBasicLeftRail(container);
  });
  afterEach(() => {
    resetBasicLeftRailForTests();
    restore();
  });

  it("도구 6개 아이콘 버튼을 기존 testid로 렌더한다", () => {
    for (const id of ["select", "paint", "erase", "fill", "event", "eyedropper"]) {
      expect(findByTestId(container as unknown as FakeElement, `tool-${id}`)).toBeTruthy();
    }
  });

  it("hover 없이 모든 도구의 한글 라벨을 DOM에 렌더한다", () => {
    const expectedLabels = [
      ["tool-select", "선택"],
      ["tool-paint", "칠하기"],
      ["tool-erase", "지우기"],
      ["tool-fill", "채우기"],
      ["tool-event", "장면"],
      ["tool-eyedropper", "집기"],
      ["oprn-tool-undo", "되돌리기"],
    ] as const;

    for (const [testId, label] of expectedLabels) {
      const button = findByTestId(container as unknown as FakeElement, testId);
      const persistentLabel = button?.querySelector(".basic-rail-label");
      expect(persistentLabel?.textContent, testId).toBe(label);
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
    expect(editorState.get().layer).toBe("lower");
  });

  it("타일은 처음부터 보이고 선택 뒤에도 남는다", () => {
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeTruthy();
    click("basic-tile-0");
    renderBasicLeftRail(container);
    expect(editorState.get().selectedTile).toBe(0);
    expect(editorState.get().tool).toBe("paint");
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeTruthy();
  });

  it("레이어 전환을 팔레트에 중복 렌더하지 않는다", () => {
    for (const id of ["layer-lower", "layer-upper", "layer-event"]) {
      expect(findByTestId(container as unknown as FakeElement, id)).toBeNull();
    }
  });

  it("캔버스 레이어 전환에 맞춰 레일 내용을 바꾼다", () => {
    selectSidebarLayer("upper");
    expect(editorState.get().layer).toBe("upper");
    renderBasicLeftRail(container);
    selectSidebarLayer("event");
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
    renderBasicLeftRail(container);
    selectSidebarLayer("lower");
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().tool).toBe("paint");
  });

  it("타일셋이 사라지면 상시 패널에 빈 상태를 보여 준다", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    store.replace({
      ...project,
      tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => id !== map.tilesetId)),
    });
    renderBasicLeftRail(container);
    expect(container.querySelector(".empty-hint")).not.toBeNull();
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeNull();
  });

  it("도구의 단일 선택을 aria-current 로 노출한다 (aria-pressed 아님)", () => {
    const paint = findByTestId(container as unknown as FakeElement, "tool-paint");
    const select = findByTestId(container as unknown as FakeElement, "tool-select");
    expect(paint?.getAttribute("aria-current")).toBe("true");
    expect(select?.getAttribute("aria-current")).toBeNull();
    expect(paint?.getAttribute("aria-pressed")).toBeNull();
    expect(select?.getAttribute("aria-pressed")).toBeNull();
  });

  it("이벤트 레이어에서는 타일 도구를 숨기고 선택·장면만 남긴다", () => {
    selectSidebarLayer("event");
    renderBasicLeftRail(container);
    for (const id of ["tool-paint", "tool-erase", "tool-fill", "tool-eyedropper"]) {
      expect(findByTestId(container as unknown as FakeElement, id), id).toBeNull();
    }
    expect(findByTestId(container as unknown as FakeElement, "tool-select")).toBeTruthy();
    expect(findByTestId(container as unknown as FakeElement, "tool-event")?.getAttribute("aria-current")).toBe("true");
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeNull();
    expect(findByTestId(container as unknown as FakeElement, "brush-size-1")).toBeNull();
    // 붓 줄은 레이어 이름을 한 번만 말한다 — 「이벤트 · 이벤트」가 아니다.
    expect(findByTestId(container as unknown as FakeElement, "tile-brush-state")?.textContent).toBe("이벤트");
    selectSidebarLayer("lower");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "tool-paint")).toBeTruthy();
  });

  it("붓 크기는 크기가 뜻 있는 도구(칠하기·지우기)에서만 보인다", () => {
    expect(findByTestId(container as unknown as FakeElement, "brush-size-1")).toBeTruthy();
    for (const tool of ["fill", "select", "eyedropper"] as const) {
      editorState.set({ tool });
      renderBasicLeftRail(container);
      expect(findByTestId(container as unknown as FakeElement, "brush-size-1"), tool).toBeNull();
    }
    editorState.set({ tool: "erase" });
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "brush-size-1")).toBeTruthy();
  });

  it("타일셋이 없으면 빈 상태의 원인을 말한다", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    store.replace({
      ...project,
      tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => id !== map.tilesetId)),
    });
    renderBasicLeftRail(container);
    expect(container.querySelector(".empty-hint")?.textContent).toBe(uiLabel("tilesetMissing"));
  });

  it("소비처 없는 data-rail-label 잔해를 더 쓰지 않는다", () => {
    expect(findByTestId(container as unknown as FakeElement, "tool-paint")?.dataset.railLabel).toBeUndefined();
  });

  it("맵 고르기는 「맵」 탭 하나가 집이다 — 그리기 탭에 맵 목록·지름길을 다시 두지 않는다", () => {
    createMapFromSpec({ name: "두번째맵" });
    clearChildren(container);
    renderBasicLeftRail(container);
    for (const id of ["map-tree", "basic-map-field", "basic-rail-toggle-maps", "basic-rail-toggle-tiles", "basic-panel-toggles"]) {
      expect(findByTestId(container as unknown as FakeElement, id), id).toBeNull();
    }
  });
});
