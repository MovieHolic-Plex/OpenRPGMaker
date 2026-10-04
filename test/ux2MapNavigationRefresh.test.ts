/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { createMapSidebarSection } from "@/editor/panels/mapSidebarSection";
import { renderMapList, resetMapListUiStateForTests } from "@/editor/panels/mapList";
import { resetMapPanelSectionForTests } from "@/editor/workspace/mapPanelSection";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/editor/panels/mapThumbnail", () => ({ createMapThumbnail: () => document.createElement("canvas") }));
vi.mock("@/editor/mapEditLocks", async (original) => ({
  ...await original<typeof import("@/editor/mapEditLocks")>(),
  checkoutMapForEditing: vi.fn(async () => true),
}));
vi.mock("@/editor/mapDissolveVeil", () => ({ clearMapDissolveVeil: vi.fn() }));
vi.mock("@/util/toast", () => ({ toast: vi.fn() }));

describe("UX2 map navigation refresh ownership", () => {
  let section: ReturnType<typeof createMapSidebarSection> | null;
  let host: HTMLElement;
  let start: string;
  const row = (id: string) => host.querySelector<HTMLElement>(`[data-testid="map-tree-node-${id}"]`)!;
  beforeEach(() => {
    section = null;
    resetMapListUiStateForTests(); resetMapPanelSectionForTests();
    const project = createBlankProject();
    start = project.startMapId;
    for (let i = 1; i <= 20; i += 1) {
      const id = `ux2-map-${i}`;
      project.maps[id] = { ...project.maps[start]!, id, name: id, events: [] };
    }
    const children = Array.from({ length: 20 }, (_, i) => ({ mapId: `ux2-map-${i + 1}`, children: [] }));
    project.mapTree = { mapId: start, children: [{ mapId: "ux2-folder", kind: "folder", name: "Folder", children }] };
    project.maps["ux2-map-20"]!.width = 1025;
    store.replace(project);
    editorState.set({ currentMapId: start, selectedEventId: null, selectedEventPageId: null });
    host = document.createElement("div");
    document.body.append(host);
  });
  afterEach(() => { section?.dispose(); host.remove(); vi.restoreAllMocks(); });
  function mountActivityPane(): HTMLElement {
    section = createMapSidebarSection();
    section.root.hidden = false;
    host.append(section.root);
    section.show();
    return host.querySelector<HTMLElement>('[data-testid="map-sidebar-list"]')!;
  }
  function watchTreeReplacement(list: HTMLElement): () => number {
    // clearChildren's textContent setter is the actual clear before row/canvas construction.
    const spy = vi.spyOn(list, "textContent", "set");
    return () => spy.mock.calls.length;
  }

  it("rebuilds once for a different map under the real synchronous activity-pane subscription", () => {
    const list = mountActivityPane();
    const replacements = watchTreeReplacement(list);
    row("ux2-map-1").click();
    expect(replacements()).toBe(1);
    expect(editorState.get().currentMapId).toBe("ux2-map-1");
    expect(row("ux2-map-1").classList.contains("active")).toBe(true);
    expect(document.activeElement).toBe(row("ux2-map-1"));
  });

  it("still refreshes folders, same-map chord/range selection and rejected navigation", () => {
    const list = mountActivityPane();
    const replacements = watchTreeReplacement(list);
    row("ux2-folder").click();
    expect(replacements()).toBe(1);
    expect(editorState.get().currentMapId).toBe(start);
    expect(row("ux2-folder").getAttribute("aria-selected")).toBe("true");
    row("ux2-map-1").click();
    row("ux2-map-1").dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
    expect(replacements()).toBe(3);
    expect(row("ux2-map-1").classList.contains("is-multi-selected")).toBe(false);
    row("ux2-map-3").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    expect(replacements()).toBe(4);
    expect(row("ux2-map-2").classList.contains("is-multi-selected")).toBe(true);
    row("ux2-map-20").click();
    expect(replacements()).toBe(5);
    expect(editorState.get().currentMapId).toBe("ux2-map-3");
    expect(document.activeElement).toBe(row("ux2-map-20"));
  });

  it("explicitly refreshes a standalone switcher without the activity-pane subscription", () => {
    renderMapList(host, { variant: "switcher" });
    const replacements = watchTreeReplacement(host);
    row("ux2-map-1").click();
    expect(replacements()).toBe(1);
    expect(host.querySelector('[data-map-list-variant="switcher"]')).toBeTruthy();
    expect(row("ux2-map-1").classList.contains("active")).toBe(true);
  });

  it("enumerates map keys once per warm panel render, independent of expanded row count", () => {
    renderMapList(host); // Warm the independent link-input index.
    const maps = store.getCurrent().maps;
    const keys = vi.spyOn(Object, "keys");
    renderMapList(host);
    expect(keys.mock.calls.filter(([value]) => value === maps)).toHaveLength(1);
    expect(host.querySelectorAll('[role="treeitem"]')).toHaveLength(22);
  });
});
