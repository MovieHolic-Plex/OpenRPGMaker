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
});
