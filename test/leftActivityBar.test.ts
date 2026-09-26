/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAiSidebarWorkspace } from "@/editor/panels/aiSidebarWorkspace";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
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
    resetEditorUiModeForTests("standard");
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
});
