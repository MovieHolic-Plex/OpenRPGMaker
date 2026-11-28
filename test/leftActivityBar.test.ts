/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAiSidebarWorkspace } from "@/editor/panels/aiSidebarWorkspace";
import { listEditorCommands } from "@/editor/commandRegistry";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

// 왼쪽 한 칸(2026-11-03 목업): 검색칸 → 맵 → 타일 → 아래 링크(진행·기물). 세로 아이콘 막대는 없다.
describe("left column", () => {
  let tools: HTMLElement;
  let workspace: ReturnType<typeof createAiSidebarWorkspace>;
  let resizes = 0;
  const find = (id: string) => workspace.root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const command = (id: string) => listEditorCommands().find((entry) => entry.id === id);
  const mount = () => {
    workspace = createAiSidebarWorkspace(tools, null, () => { resizes += 1; });
    document.body.append(workspace.root);
  };
  beforeEach(() => {
    localStorage.clear();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, layer: "lower", tool: "paint", activePaletteStamp: null });
    tools = document.createElement("div");
    resizes = 0;
  });
  afterEach(() => {
    workspace.dispose();
    workspace.root.remove();
  });

  it("진행·기물 단추와 Ctrl K 글자는 DOM 에만 남고 화면에서 걷힌다", () => {
    mount();
    // 버튼 줄이기 2회차: 입구는 프로젝트 메뉴(menu-more-progress·menu-more-props)와 단축키다.
    for (const hidden of ["sidebar-progress", "sidebar-props", "left-column-command-palette"]) expect(find(hidden)?.hidden, hidden).toBe(true);
  });

  it("filters the map tree from the top search box", () => {
    const project = createBlankProject();
    store.replace(project);
    mount();
    const search = find("map-tree-filter") as HTMLInputElement;
    search.value = "없는 이름 zz";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(find("map-tree-filter-empty")).not.toBeNull();
    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(find("map-tree-filter-empty")).toBeNull();
  });

  it("opens a bottom link as a drawer over maps and tiles and returns with back", () => {
    mount();
    find("sidebar-progress")?.click();
    expect(workspace.root.dataset.pane).toBe("progress");
    expect(find("sidebar-progress")?.getAttribute("aria-pressed")).toBe("true");
    expect(find("left-progress-pane")?.hidden).toBe(false);
    expect(find("left-progress-count")?.textContent).toMatch(/^\d\/5$/);
    expect(tools.hidden).toBe(true);
    expect(find("map-sidebar-section")?.hidden).toBe(true);
    find("left-drawer-back")?.click();
    expect(workspace.root.dataset.pane).toBe("main");
    expect(tools.hidden).toBe(false);
    find("sidebar-props")?.click();
    expect(workspace.root.dataset.pane).toBe("props");
    find("sidebar-props")?.click();
    expect(workspace.root.dataset.pane).toBe("main");
  });

  it("collapses to a restore handle and remembers it across mounts", () => {
    mount();
    find("left-column-collapse")?.click();
    expect(workspace.isCollapsed()).toBe(true);
    expect(resizes).toBe(1);
    expect(find("left-column-restore")?.hidden).toBe(false);
    expect(tools.hidden).toBe(true);
    workspace.dispose();
    workspace.root.remove();
    mount();
    expect(workspace.isCollapsed()).toBe(true);
    find("left-column-restore")?.click();
    expect(workspace.isCollapsed()).toBe(false);
    expect(tools.hidden).toBe(false);
  });

  it("returns to maps and tiles when another surface asks for tools or maps", () => {
    mount();
    find("sidebar-progress")?.click();
    window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
    expect(workspace.root.dataset.pane).toBe("main");
    find("sidebar-props")?.click();
    window.dispatchEvent(new Event("oprn:ai-sidebar-maps"));
    expect(workspace.root.dataset.pane).toBe("main");
    expect(workspace.isCollapsed()).toBe(false);
  });

  it("reaches links, workshop and store only through ⌘K commands", () => {
    mount();
    command("left-drawer-links")?.run();
    expect(workspace.root.dataset.pane).toBe("links");
    expect(find("left-links-summary")?.textContent).toContain("맵");
    command("left-drawer-workshop")?.run();
    expect(workspace.root.dataset.pane).toBe("workshop");
    expect(find("left-workshop-pane")?.hidden).toBe(false);
    command("left-drawer-store")?.run();
    expect(workspace.root.dataset.pane).toBe("store");
    expect(find("left-store-pane")?.hidden).toBe(false);
    expect(document.querySelector(".store-host")).toBeNull();
    expect(command("left-drawer-links")?.label).toBe("화면: 맵 연결 보기");
    expect(command("left-drawer-workshop")?.label).toBe("화면: 공방 열기");
    expect(command("left-drawer-store")?.label).toBe("화면: 에셋 스토어 열기");
    expect(command("inspect-rule-violations")?.label).toBe("검사: 규칙 위반 보기");
  });

  it("toggles the column through ⌘K", () => {
    mount();
    command("left-column-toggle")?.run();
    expect(workspace.isCollapsed()).toBe(true);
    command("left-column-toggle")?.run();
    expect(workspace.isCollapsed()).toBe(false);
  });

  it("keeps the column collapsed by default even with stale localStorage and ignores passive layer/map signals while collapsed", () => {
    localStorage.setItem("oprn:left-column-collapsed", "0");
    workspace = createAiSidebarWorkspace(tools, null, () => { resizes += 1; }, { defaultCollapsed: true });
    document.body.append(workspace.root);

    expect(workspace.isCollapsed()).toBe(true);
    expect(tools.hidden).toBe(true);
    expect(find("left-column-restore")?.hidden).toBe(false);

    // Topbar layer switches / map reveal signals must not force-open a collapsed left sidebar.
    window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
    window.dispatchEvent(new Event("oprn:ai-sidebar-maps"));
    expect(workspace.isCollapsed()).toBe(true);
    expect(tools.hidden).toBe(true);

    // Explicit toggle still opens the column for the current session without persisting open across mounts.
    command("left-column-toggle")?.run();
    expect(workspace.isCollapsed()).toBe(false);
    expect(tools.hidden).toBe(false);

    workspace.dispose();
    workspace.root.remove();
    workspace = createAiSidebarWorkspace(tools, null, () => { resizes += 1; }, { defaultCollapsed: true });
    document.body.append(workspace.root);
    expect(workspace.isCollapsed()).toBe(true);
    expect(tools.hidden).toBe(true);
  });

  it("selects a complete prop without painting and clears its stamp on a foreign chipset", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    map.name = "기물 시험";
    tileset.structureKits = [{ id: "qa:bench", kind: "section", name: "기물 시험 벤치", width: 2, height: 1, rows: [{ tiles: [-1, -1], upperTiles: [4, 7] }] }];
    const other = { ...tileset, id: "qa-other", structureKits: [] };
    project.tilesets[other.id] = other;
    project.maps["qa-other-map"] = { ...map, id: "qa-other-map", tilesetId: other.id };
    store.replace(project);
    editorState.set({ currentMapId: map.id, activePaletteStamp: null });
    const original = [...store.getCurrent().maps[map.id]!.upperTiles];
    mount();
    find("sidebar-props")?.click();
    const button = workspace.root.querySelector<HTMLButtonElement>('[data-prop-id="qa:bench"]');
    expect(button).not.toBeNull();
    editorState.set({ layer: "event" });
    button!.click();
    expect(editorState.get().layer).toBe("upper");
    expect(editorState.get().activePaletteStamp).toMatchObject({ width: 2, height: 1, source: { tilesetId: tileset.id }, cells: [{ dx: 0, dy: 0, layer: "upper", tile: 4 }, { dx: 1, dy: 0, layer: "upper", tile: 7 }] });
    expect(store.getCurrent().maps[map.id]!.upperTiles).toEqual(original);
    button!.click();
    expect(editorState.get().activePaletteStamp).toBeNull();
    button!.click();
    expect(editorState.get().activePaletteStamp).not.toBeNull();
    editorState.set({ currentMapId: "qa-other-map" });
    expect(editorState.get().activePaletteStamp).toBeNull();
  });
});
