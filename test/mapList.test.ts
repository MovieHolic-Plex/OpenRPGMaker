import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderMapList, resetMapListUiStateForTests } from "@/editor/panels/mapList";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

describe("map tree panel", () => {
  let restoreDom: () => void;

  beforeEach(() => {
    restoreDom = installFakeDom();
    resetMapListUiStateForTests();
    const project = createBlankProject();
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });
  });

  afterEach(() => {
    restoreDom();
    vi.mocked(toast).mockClear();
  });

  it("renders compact map organization controls", () => {
    const panel = renderWithFakeDom(() => {
      const container = document.createElement("div");
      renderMapList(container);
      return container;
    });

    expect(findByTestId(panel, "map-add")).not.toBeNull();
    expect(findByTestId(panel, "map-set-start")).not.toBeNull();
    expect(findByTestId(panel, "map-toggle-all")).not.toBeNull();
    expect(findByTestId(panel, "map-tree-filter")).not.toBeNull();
    expect(findByTestId(panel, "map-add-category")).toBeNull();
    expect(findByTestId(panel, "map-add-folder")).not.toBeNull();
  });

  it("헤더 제목과 개수를 별도 span으로 렌더한다(맵 N 합침 회귀 방지)", () => {
    const project = createBlankProject();
    const secondId = "map_second";
    project.maps[secondId] = { ...project.maps[project.startMapId]!, id: secondId, name: "두번째 맵" };
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

    const title = panel.querySelector(".map-tree-title");
    const count = panel.querySelector(".map-tree-count");
    expect(title).not.toBeNull();
    expect(count).not.toBeNull();
    expect(title).not.toBe(count);
    expect(title?.textContent).toBe("맵");
    expect(count?.textContent).toBe(String(Object.keys(project.maps).length));
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

  it("맵이 8개 미만이면 필터를 접고 토글만 노출한다", () => {
    // 시드 프로젝트는 맵 1개다.
    const host = document.createElement("div");
    renderMapList(host);
    const filter = host.querySelector<HTMLElement>('[data-testid="map-tree-filter"]');
    const toggle = host.querySelector<HTMLElement>('[data-testid="map-tree-filter-toggle"]');
    expect(toggle).not.toBeNull();
    // DOM 에는 남아 있되 hidden 이어야 한다 — 기존 e2e 가 fill() 로 접근한다.
    // fakeDom 의 FakeElement 는 hasAttribute()를 흉내내지 않으므로(node 환경, happy-dom 아님)
    // getAttribute() 로 동등하게 검증한다.
    expect(filter).not.toBeNull();
    expect(filter?.closest(".map-tree-filter")?.getAttribute("hidden")).not.toBeNull();
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

  it("맵이 8개 이상이면 토글 없이 필터가 처음부터 펼쳐진다", () => {
    const project = createBlankProject();
    for (let i = 0; i < 7; i += 1) {
      const id = `map_extra_${i}`;
      project.maps[id] = { ...project.maps[project.startMapId]!, id, name: `여분 맵 ${i}` };
      project.mapTree.children.push({ mapId: id, children: [] });
    }
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, selectedEventId: null, selectedEventPageId: null });

    const host = document.createElement("div");
    renderMapList(host);
    expect(Object.keys(store.getCurrent().maps).length).toBe(8);
    expect(host.querySelector('[data-testid="map-tree-filter-toggle"]')).toBeNull();
    expect(host.querySelector('[data-testid="map-tree-filter"]')?.closest(".map-tree-filter")?.getAttribute("hidden")).toBeNull();
  });
});
