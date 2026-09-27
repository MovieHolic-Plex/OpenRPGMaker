/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAiSidebarWorkspace } from "@/editor/panels/aiSidebarWorkspace";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { selectPaletteTile } from "@/editor/panels/tilePalette";
import { clearFavoriteTilesForTest } from "@/editor/panels/tileBrushTools";

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
    clearFavoriteTilesForTest();
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

  it("lists all five panes, renders a pane only when it is opened, and restores the saved one", () => {
    mount();
    const bar = [...workspace.root.querySelectorAll<HTMLElement>('[data-testid="left-activity-bar"] button')].map((b) => b.dataset.testid);
    expect(bar).toEqual(["sidebar-tools", "sidebar-maps", "sidebar-favorites", "sidebar-progress", "sidebar-links", "sidebar-inspect"]);
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

  it("collects picked tiles as recent and moves a right-clicked tile to favorites", () => {
    selectPaletteTile(4);
    selectPaletteTile(7);
    mount();
    find("sidebar-favorites")?.click();
    const recent = () => [...workspace.root.querySelectorAll<HTMLElement>('[data-testid="left-favorites-recent"] .left-favorites-cell')].map((c) => c.dataset.tile);
    const starred = () => [...workspace.root.querySelectorAll<HTMLElement>('[data-testid="left-favorites-starred"] .left-favorites-cell')].map((c) => c.dataset.tile);
    expect(recent()).toEqual(["7", "4"]);
    expect(starred()).toEqual([]);
    find("left-favorites-recent-4")?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(starred()).toEqual(["4"]);
    expect(recent()).toEqual(["7"]);
    find("left-favorites-star-4")?.click();
    expect(editorState.get().selectedTile).toBe(4);
  });
});
