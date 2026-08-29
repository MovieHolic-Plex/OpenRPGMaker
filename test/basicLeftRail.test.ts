import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBasicLeftRail, resetBasicLeftRailForTests } from "@/editor/panels/basicLeftRail";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests, setEditorUiMode } from "@/editor/editorUiMode";
import { uiLabel } from "@/editor/uiCopy";
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

  it("hover 없이 모든 도구와 레이어의 한글 라벨을 DOM에 렌더한다", () => {
    const expectedLabels = [
      ["tool-select", "선택"],
      ["tool-paint", "칠하기"],
      ["tool-erase", "지우기"],
      ["tool-fill", "채우기"],
      ["tool-event", "장면"],
      ["tool-eyedropper", "집기"],
      ["layer-lower", "바닥"],
      ["layer-upper", "덧그림"],
      ["layer-event", "이벤트"],
      ["basic-rail-toggle-tiles", "타일"],
      ["basic-rail-toggle-maps", "맵"],
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

  it("타일 토글 → 플라이아웃에 타일 그리드, 타일 클릭 시 브러시 전환", () => {
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeNull();
    click("basic-rail-toggle-tiles");
    // dispatchFlyout 은 lastContainer.isConnected 여야 자가 재렌더한다. fakeDom 은 isConnected 를
    // 구현하지 않으니 토글 후 명시적으로 다시 그린다(상태는 모듈에 살아있다).
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeTruthy();
    expect(findByTestId(container as unknown as FakeElement, "basic-tile-grid")).toBeTruthy();
    click("basic-tile-0");
    expect(editorState.get().selectedTile).toBe(0);
    expect(editorState.get().tool).toBe("paint");
  });

  it("레이어 스위치는 아이콘 위에 바닥/장식/이벤트 한글을 보여 준다", () => {
    const list = findByTestId(container as unknown as FakeElement, "basic-layer-list");
    expect(list?.textContent).toContain("바닥");
    expect(list?.textContent).toContain("덧그림");
    expect(list?.textContent).toContain("이벤트");
    expect(list?.querySelector("svg")).toBeTruthy();
    expect(list?.querySelector(".basic-rail-badge")).toBeNull();
  });

  it("레일에서 하위/상위/이벤트 레이어를 바로 고른다", () => {
    expect(findByTestId(container as unknown as FakeElement, "basic-layer-list")).toBeTruthy();
    click("layer-upper");
    expect(editorState.get().layer).toBe("upper");
    renderBasicLeftRail(container);
    click("layer-event");
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
    renderBasicLeftRail(container);
    click("layer-lower");
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().tool).toBe("paint");
  });

  it("열린 타일 플라이아웃에서 타일셋이 사라지면 초보용 빈 상태를 보여 준다", () => {
    click("basic-rail-toggle-tiles");
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    store.replace({
      ...project,
      tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => id !== map.tilesetId)),
    });
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")?.textContent).toContain("그림이 없습니다");
  });

  it("도구·레이어의 단일 선택을 aria-current 로 노출한다 (aria-pressed 아님)", () => {
    const paint = findByTestId(container as unknown as FakeElement, "tool-paint");
    const select = findByTestId(container as unknown as FakeElement, "tool-select");
    expect(paint?.getAttribute("aria-current")).toBe("true");
    expect(select?.getAttribute("aria-current")).toBeNull();
    expect(paint?.getAttribute("aria-pressed")).toBeNull();
    expect(select?.getAttribute("aria-pressed")).toBeNull();

    const lower = findByTestId(container as unknown as FakeElement, "layer-lower");
    const upper = findByTestId(container as unknown as FakeElement, "layer-upper");
    expect(lower?.getAttribute("aria-current")).toBe("true");
    expect(upper?.getAttribute("aria-current")).toBeNull();
    expect(lower?.getAttribute("aria-pressed")).toBeNull();
  });

  it("세 레이어 버튼이 서로 다른 글리프를 그린다", () => {
    const signatures = ["layer-lower", "layer-upper", "layer-event"].map((id) => {
      const svg = findByTestId(container as unknown as FakeElement, id)?.querySelector("svg");
      expect(svg, id).toBeTruthy();
      return (svg as FakeElement).children
        .map((child) => `${child.tagName}:${JSON.stringify(child.attrs)}`)
        .join("|");
    });
    expect(new Set(signatures).size).toBe(3);
  });

  it("플라이아웃을 닫으면 포커스가 그것을 연 토글로 돌아온다", () => {
    click("basic-rail-toggle-tiles");
    renderBasicLeftRail(container);
    const closeBtn = findByTestId(container as unknown as FakeElement, "basic-flyout-close") as unknown as HTMLElement | null;
    expect(closeBtn).toBeTruthy();
    closeBtn!.focus();
    closeBtn!.click();
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeNull();
    expect(document.activeElement).toBe(findByTestId(container as unknown as FakeElement, "basic-rail-toggle-tiles"));
  });

  it("모드를 바꿨다 초보로 돌아오면 열지 않은 플라이아웃이 남지 않는다", () => {
    click("basic-rail-toggle-tiles");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeTruthy();

    setEditorUiMode("standard", null);
    setEditorUiMode("beginner", null);
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeNull();
  });

  it("쓸 타일이 이미 있으면 칠하기가 방금 닫은 플라이아웃을 다시 열지 않는다", () => {
    editorState.set({ selectedTile: 0, tool: "select" });
    renderBasicLeftRail(container);
    click("basic-rail-toggle-tiles");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeTruthy();
    click("basic-rail-toggle-tiles");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeNull();

    click("tool-paint");
    renderBasicLeftRail(container);
    expect(editorState.get().tool).toBe("paint");
    expect(findByTestId(container as unknown as FakeElement, "basic-rail-flyout")).toBeNull();
  });

  it("타일셋이 없으면 비활성 타일 버튼이 이벤트 레이어가 아니라 실제 원인을 말한다", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId];
    store.replace({
      ...project,
      tilesets: Object.fromEntries(Object.entries(project.tilesets).filter(([id]) => id !== map.tilesetId)),
    });
    renderBasicLeftRail(container);
    const title = findByTestId(container as unknown as FakeElement, "basic-rail-toggle-tiles")?.getAttribute("title");
    expect(title).toContain(uiLabel("tilesetMissing"));
    expect(title).not.toContain("이벤트 레이어");
  });

  it("소비처 없는 data-rail-label 잔해를 더 쓰지 않는다", () => {
    for (const id of ["tool-paint", "layer-lower", "basic-rail-toggle-tiles", "basic-rail-toggle-maps"]) {
      expect(findByTestId(container as unknown as FakeElement, id)?.dataset.railLabel, id).toBeUndefined();
    }
  });

  it("맵 토글 → 플라이아웃에 기본 맵 목록 렌더 (전문가 인라인 액션 없음)", () => {
    click("basic-rail-toggle-maps");
    renderBasicLeftRail(container);
    expect(findByTestId(container as unknown as FakeElement, "map-tree")).toBeTruthy();
    expect(findByTestId(container as unknown as FakeElement, "map-add")).toBeTruthy();
    // 전문가 패널 전용 인라인 컨트롤은 기본 플라이아웃에 없음
    const mapId = store.getCurrent().startMapId;
    expect(findByTestId(container as unknown as FakeElement, `map-parent-select-${mapId}`)).toBeFalsy();
    expect(findByTestId(container as unknown as FakeElement, `map-delete-${mapId}`)).toBeFalsy();
    expect(findByTestId(container as unknown as FakeElement, `map-more-${mapId}`)).toBeTruthy();
    expect(findByTestId(container as unknown as FakeElement, "basic-map-list-host")).toBeTruthy();
  });
});
