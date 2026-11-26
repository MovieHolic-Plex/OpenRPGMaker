import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMapDissolveVeil } from "@/editor/mapDissolveVeil";
import { editorState } from "@/editor/editorState";
import { renderMapList, resetMapListUiStateForTests } from "@/editor/panels/mapList";
import { isMapPanelCollapsed, resetMapPanelSectionForTests } from "@/editor/workspace/mapPanelSection";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import { FakeElement, findByTestId, flushFakeAnimationFrames, installFakeDom, renderWithFakeDom } from "./fakeDom";

vi.mock("@/editor/mapDissolveVeil", () => ({ clearMapDissolveVeil: vi.fn() }));

vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

describe("map tree panel", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
    vi.mocked(clearMapDissolveVeil).mockClear();
    resetMapListUiStateForTests();
    resetMapPanelSectionForTests();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  });

  afterEach(() => {
    restoreDom();
    vi.mocked(toast).mockClear();
  });

  it("reveals the active map inside the tree scroller without scrolling its ancestors", () => {
    const restoreFrames = installFakeDom({ animationFrames: "manual" });
    try {
      const container = document.createElement("div");
      document.body.append(container);
      renderMapList(container);
      const tree = container.querySelector<HTMLElement>('[data-testid="map-tree-list"]')!;
      const row = tree.querySelector<HTMLElement>(`[data-testid="map-tree-node-${store.getCurrent().startMapId}"]`)!;
      const nativeReveal = vi.spyOn(row, "scrollIntoView");
      Object.defineProperties(tree, { clientHeight: { value: 100 }, scrollHeight: { value: 300 } });
      vi.spyOn(tree, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 100, height: 100 } as DOMRect);
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: 120, bottom: 150, height: 30 } as DOMRect);

      flushFakeAnimationFrames(0, 1);

      expect(tree.scrollTop).toBe(50);
      expect(nativeReveal).not.toHaveBeenCalled();
    } finally {
      restoreFrames();
    }
  });

  it("제목 토글이 도크 섹션을 접고 펴며, 접힘은 aria-expanded 와 패널 클래스로 드러난다", () => {
    const container = document.createElement("div");
    renderWithFakeDom(() => {
      renderMapList(container);
      return container;
    });
    const toggle = findByTestId(container as unknown as FakeElement, "map-tree-section-toggle");
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(toggle?.querySelector(".map-tree-title")?.textContent).toBe("맵");
    expect(container.querySelector(".map-tree-panel")?.className).not.toContain("is-section-collapsed");

    toggle?.dispatchEvent(new Event("click"));

    expect(isMapPanelCollapsed()).toBe(true);
    const reToggle = findByTestId(container as unknown as FakeElement, "map-tree-section-toggle");
    expect(reToggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".map-tree-panel")?.className).toContain("is-section-collapsed");
    // 접혀도 헤더 액션(새 맵 등)은 남는다 — 목록만 숨는 게 계약이다.
    expect(findByTestId(container as unknown as FakeElement, "map-add")).not.toBeNull();

    reToggle?.dispatchEvent(new Event("click"));
    expect(isMapPanelCollapsed()).toBe(false);
    expect(findByTestId(container as unknown as FakeElement, "map-tree-section-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("시작 맵 지정 버튼은 이미 시작 맵이어도 결과를 알린다", () => {
    // Break: 헤더의 「현재 맵을 시작 맵으로」 는 이미 시작 맵일 때 store 갱신이 무효토산되며
    // 토스트도 상태 변화도 없어 사용자에게는 고장으로 보인다(실제 감사에서 dead 로 잡혔다).
    // 행 컨텍스트 메뉴는 이 경우 항목 자율를 숨기므로 헤더만 일관성이 없었다.
    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      return container;
    });

    findByTestId(panel, "map-set-start")?.click();

    expect(vi.mocked(toast)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast).mock.calls[0]?.[0]).toContain("이미");
  });

  it("selects map on click (programmatic HTMLElement.click)", () => {
    const project = createBlankProject();
    const secondId = "map_second";
    project.maps[secondId] = {
      ...project.maps[project.startMapId]!,
      id: secondId,
      name: "두번째 맵",
    };
    project.mapTree = {
      mapId: project.startMapId,
      children: [{ mapId: secondId, children: [] }],
    };
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });

    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      return container;
    });
    const row = findByTestId(panel, `map-tree-node-${secondId}`);
    if (!row) throw new Error("Expected second map row");
    row.dispatchEvent(new Event("click", { bubbles: true }));
    expect(clearMapDissolveVeil).toHaveBeenCalledTimes(1);
    expect(editorState.get().currentMapId).toBe(secondId);
  });

  it("keeps drag on the handle so the row itself is not draggable", () => {
    const project = createBlankProject();
    const childId = "map_child";
    project.maps[childId] = { ...project.maps[project.startMapId]!, id: childId, name: "방" };
    project.mapTree = {
      mapId: project.startMapId,
      children: [{ mapId: childId, children: [] }],
    };
    store.replace(project);

    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      return container;
    });
    const row = findByTestId(panel, `map-tree-node-${childId}`);
    const handle = findByTestId(panel, `map-drag-${childId}`);
    const rootHandle = findByTestId(panel, `map-drag-${project.startMapId}`);
    if (!row || !handle || !rootHandle) throw new Error("Expected row and drag handles");
    expect(row.getAttribute("draggable")).toBe("false");
    expect(handle.getAttribute("draggable")).toBe("true");
    expect(rootHandle.getAttribute("draggable")).toBe("false");
  });

  it("filters the tree to matching names and their ancestors", () => {
    const project = createBlankProject();
    const houseId = "map_house";
    const shopId = "map_shop";
    project.maps[houseId] = { ...project.maps[project.startMapId]!, id: houseId, name: "촌장집" };
    project.maps[shopId] = { ...project.maps[project.startMapId]!, id: shopId, name: "잡화점" };
    project.mapTree = {
      mapId: project.startMapId,
      children: [
        { mapId: houseId, children: [] },
        { mapId: shopId, children: [] },
      ],
    };
    store.replace(project);

    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      const filter = findByTestId(container, "map-tree-filter") as HTMLInputElement | null;
      if (!filter) throw new Error("filter");
      filter.value = "잡화";
      filter.dispatchEvent(new Event("input", { bubbles: true }));
      return container;
    });

    expect(findByTestId(panel, `map-tree-node-${shopId}`)).not.toBeNull();
    expect(findByTestId(panel, `map-tree-node-${project.startMapId}`)).not.toBeNull();
    expect(findByTestId(panel, `map-tree-node-${houseId}`)).toBeNull();
  });

  it("forgets an in-progress filter syllable when IME composition is cancelled", () => {
    const host = document.createElement("div");
    renderMapList(host);
    const filter = host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]');
    if (!filter) throw new Error("filter");
    filter.value = "마";
    const composing = new Event("input", { bubbles: true });
    Object.defineProperty(composing, "isComposing", { value: true });
    filter.dispatchEvent(composing);
    filter.value = "";
    filter.dispatchEvent(new Event("compositionend", { bubbles: true }));
    host.querySelector<HTMLElement>('[data-testid="map-tree-facet-empty"]')?.click();
    expect(host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]')?.value).toBe("");
  });

  it("패싯이 활성이면 토글이 죽은 버튼으로 남지 않도록 렌더하지 않는다", () => {
    // 강제로 펼쳐진 상태에서는 filterExpandedByUser 를 뒤집어도 결과가 안 바뀐다 —
    // 누르면 아무 일 없는 컨트롤을 남기지 않고 아예 그리지 않는다.
    const host = document.createElement("div");
    renderMapList(host);
    const facetButton = host.querySelector<HTMLElement>('[data-testid="map-tree-facet-empty"]');
    facetButton?.click();
    expect(host.querySelector('[data-testid="map-tree-filter-toggle"]')).toBeNull();
    expect(host.querySelector('[data-testid="map-tree-filter"]')?.closest(".map-tree-filter")?.getAttribute("hidden")).toBeNull();
  });

  it("초보 플라이아웃 필터 토글도 펼친 뒤 입력에 포커스를 준다(전문가 헤더와 동일 동작)", () => {
    // Break: 전문가 헤더 토글은 펼친 뒤 필터 입력에 포커스를 주지만 플라이아웃 토글은
    // 별도 구현이라 포커스를 주지 않았다(리뷰 Finding — 두 구현이 드리프트). 이제
    // 둘 다 toggleMapFilterExpansion() 하나를 공유한다.
    const host = document.createElement("div");
    renderMapList(host, { variant: "basic" });
    const toggle = host.querySelector<HTMLElement>('[data-testid="map-tree-filter-toggle"]');
    expect(toggle).not.toBeNull();
    toggle?.click();
    const filterInput = host.querySelector<HTMLElement>('[data-testid="map-tree-filter"]');
    expect(filterInput).not.toBeNull();
    expect(document.activeElement).toBe(filterInput);
  });

  it("맵이 하나뿐이면 삭제 버튼이 이유를 달고 비활성이다", () => {
    const host = document.createElement("div");
    renderMapList(host, { variant: "basic" });
    const remove = host.querySelector<HTMLButtonElement>('[data-testid="map-inspector-action-delete"]');
    expect(remove).not.toBeNull();
    expect(remove?.disabled).toBe(true);
    expect(remove?.getAttribute("title")).toContain("하나");
    // 이미 시작 맵이면 "시작 맵으로" 도 이유를 말한다 (죽은 버튼 금지).
    const setStart = host.querySelector<HTMLButtonElement>('[data-testid="map-inspector-action-set-start"]');
    expect(setStart?.disabled).toBe(true);
    expect(setStart?.getAttribute("title")).toContain("이미 시작 맵");
  });

  it("keeps the map filter caret where the author was typing", () => {
    const host = document.createElement("div");
    renderMapList(host);
    const filter = host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]');
    if (!filter) throw new Error("filter");
    filter.value = "빈맵";
    filter.setSelectionRange(1, 1);
    filter.dispatchEvent(new Event("input", { bubbles: true }));

    const next = host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]');
    expect(next).not.toBe(filter);
    expect(next?.value).toBe("빈맵");
    expect(next?.selectionStart).toBe(1);
    expect(next?.selectionEnd).toBe(1);
    expect(document.activeElement).toBe(next);
  });

  it("keeps the map filter field while an IME composition is in progress", () => {
    const host = document.createElement("div");
    renderMapList(host);
    const startId = store.getCurrent().startMapId;
    const filter = host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]');
    if (!filter) throw new Error("filter");
    filter.dispatchEvent(new Event("compositionstart"));
    filter.value = "ㄱ";
    const composing = new Event("input", { bubbles: true });
    Object.defineProperty(composing, "isComposing", { value: true });
    filter.dispatchEvent(composing);

    expect(host.querySelector('[data-testid="map-tree-filter"]')).toBe(filter);
    expect(host.querySelector(`[data-testid="map-tree-node-${startId}"]`)).not.toBeNull();

    filter.value = "가";
    filter.setSelectionRange(1, 1);
    filter.dispatchEvent(new Event("compositionend", { bubbles: true }));
    const next = host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]');
    expect(next).not.toBe(filter);
    expect(next?.value).toBe("가");
    expect(next?.selectionStart).toBe(1);
    expect(next?.selectionEnd).toBe(1);
    expect(host.querySelector(`[data-testid="map-tree-node-${startId}"]`)).toBeNull();

    // 조합이 끝난 칸에 같은 값의 input 이 한 번 더 와도 커서를 끝으로 밀지 않는다.
    filter.setSelectionRange(filter.value.length, filter.value.length);
    filter.dispatchEvent(new Event("input", { bubbles: true }));
    const after = host.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]');
    expect(after?.selectionStart).toBe(1);
    expect(after?.selectionEnd).toBe(1);
  });
});
