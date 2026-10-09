/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAiSidebarWorkspace } from "@/editor/panels/aiSidebarWorkspace";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

describe("left activity bar", () => {
  let tools: HTMLElement;
  let workspace: ReturnType<typeof createAiSidebarWorkspace>;
  let resizes = 0;
  const find = (id: string) => workspace.root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const mount = () => {
    workspace = createAiSidebarWorkspace(tools, null, () => { resizes += 1; });
    document.body.append(workspace.root);
  };
  beforeEach(() => {
    localStorage.clear();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId });
    tools = document.createElement("div");
    resizes = 0;
  });
  afterEach(() => {
    workspace.dispose();
    workspace.root.remove();
  });

  it("starts on the drawing pane with no AI pane in the left sidebar", () => {
    mount();
    expect(workspace.root.dataset.pane).toBe("tools");
    expect(tools.hidden).toBe(false);
    expect(find("sidebar-tools")?.getAttribute("aria-pressed")).toBe("true");
    expect(find("sidebar-ai")).toBeNull();
    expect(workspace.root.querySelector('[data-testid="ai-panel"]')).toBeNull();
  });

  it("collapses on a second click of the active item and switches on another", () => {
    mount();
    find("sidebar-tools")?.click();
    expect(workspace.isCollapsed()).toBe(true);
    expect(find("sidebar-tools")?.getAttribute("aria-pressed")).toBe("false");
    expect(resizes).toBe(1);
    find("sidebar-maps")?.click();
    expect(workspace.isCollapsed()).toBe(false);
    expect(workspace.root.dataset.pane).toBe("maps");
    expect(tools.hidden).toBe(true);
    expect(find("sidebar-maps")?.getAttribute("aria-pressed")).toBe("true");
    expect(resizes).toBe(2);
    // 펼친 채 다른 패널로 바꾸면 폭이 그대로다 — 레이아웃을 다시 잴 이유가 없다.
    find("sidebar-tools")?.click();
    expect(resizes).toBe(2);
  });

  it("remembers the last pane and collapsed state across mounts", () => {
    mount();
    find("sidebar-maps")?.click();
    find("sidebar-maps")?.click();
    workspace.dispose();
    workspace.root.remove();
    mount();
    expect(workspace.root.dataset.pane).toBe("maps");
    expect(workspace.isCollapsed()).toBe(true);
  });

  it("opens the drawing pane when another surface asks for tools", () => {
    mount();
    find("sidebar-maps")?.click();
    window.dispatchEvent(new Event("oprn:ai-sidebar-tools"));
    expect(workspace.root.dataset.pane).toBe("tools");
    expect(workspace.isCollapsed()).toBe(false);
  });

  it("lists every pane, renders a pane only when it is opened, and restores the saved one", () => {
    mount();
    const bar = [...workspace.root.querySelectorAll<HTMLElement>('[data-testid="left-activity-bar"] button')].map((b) => b.dataset.testid);
    expect(bar).toEqual(["sidebar-tools", "sidebar-maps", "sidebar-props", "sidebar-progress", "sidebar-links", "sidebar-workshop", "sidebar-store", "sidebar-inspect"]);
    expect(find("left-progress-pane")?.childElementCount).toBe(0);
    find("sidebar-progress")?.click();
    expect(workspace.root.dataset.pane).toBe("progress");
    expect(find("left-progress-pane")?.hidden).toBe(false);
    expect(find("left-progress-count")?.textContent).toMatch(/^\d\/5$/);
    expect(tools.hidden).toBe(true);
    find("sidebar-links")?.click();
    expect(find("left-links-summary")?.textContent).toContain("맵");
    expect(find("left-progress-pane")?.hidden).toBe(true);
    workspace.dispose();
    workspace.root.remove();
    mount();
    expect(workspace.root.dataset.pane).toBe("links");
    expect(find("left-links-pane")?.hidden).toBe(false);
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
    editorState.set({ currentMapId: "qa-other-map" });
    expect(editorState.get().activePaletteStamp).toBeNull();
  });

  it("restores the old favorites preference as the props pane", () => {
    localStorage.setItem("oprn:left-activity-pane", "favorites");
    mount();
    expect(workspace.root.dataset.pane).toBe("props");
    expect(find("sidebar-props")?.getAttribute("aria-pressed")).toBe("true");
  });
});
