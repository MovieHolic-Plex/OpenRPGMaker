/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const openMapPropertiesDialog = vi.fn();
const openEventEditorModal = vi.fn();
vi.mock("@/editor/panels/mapPropertiesDialog", () => ({ openMapPropertiesDialog }));
vi.mock("@/editor/panels/eventEditor/modal", () => ({ openEventEditorModal }));

const { buildInspectorView, mountRightInspector } = await import("@/editor/panels/rightInspector");

describe("right inspector", () => {
  let cursorHost: HTMLElement;
  let mounted: ReturnType<typeof mountRightInspector> | null = null;
  const find = (id: string) => mounted!.root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

  beforeEach(() => {
    openMapPropertiesDialog.mockClear();
    openEventEditorModal.mockClear();
    store.replace(createBlankProject());
    editorState.set({ currentMapId: store.getCurrent().startMapId, layer: "lower", selectedEventId: null });
    cursorHost = document.createElement("div");
    cursorHost.innerHTML = '<span data-testid="cursor-position">outside</span>';
    document.body.append(cursorHost);
  });
  afterEach(() => {
    mounted?.dispose();
    mounted = null;
    cursorHost.remove();
  });

  it("shows the current map name, size and the mock's grouped rows", () => {
    const map = store.getCurrent().maps[store.getCurrent().startMapId]!;
    mounted = mountRightInspector(cursorHost);
    expect(find("right-inspector-title")?.textContent).toBe(map.name);
    expect(find("right-inspector-subtitle")?.textContent).toBe(`맵 · ${map.width} × ${map.height} 칸`);
    const groups = Array.from(mounted.root.querySelectorAll<HTMLElement>("[data-testid^='right-inspector-group-']")).map((node) => node.dataset.testid);
    expect(groups).toEqual(["right-inspector-group-basic", "right-inspector-group-sound", "right-inspector-group-battle", "right-inspector-group-cell"]);
    expect(find("right-inspector-row-size")?.textContent).toContain(`${map.width} × ${map.height}`);
    expect(find("right-inspector-row-bgm")?.textContent).toContain("상위 맵을 따름");
    expect(find("right-inspector-row-encounter")?.textContent).toContain("끔");
    expect(find("right-inspector-advanced")).not.toBeNull();
  });

  it("opens the existing map settings section for a row instead of editing in place", () => {
    const map = store.getCurrent().maps[store.getCurrent().startMapId]!;
    mounted = mountRightInspector(cursorHost);
    find("right-inspector-row-bgm")!.click();
    expect(openMapPropertiesDialog).toHaveBeenLastCalledWith(map.id, map.name, { section: "bgm" });
    find("right-inspector-row-tileset")!.click();
    expect(openMapPropertiesDialog).toHaveBeenLastCalledWith(map.id, map.name, { focus: "tileset" });
    find("right-inspector-row-encounter")!.click();
    expect(openMapPropertiesDialog).toHaveBeenLastCalledWith(map.id, map.name, { focus: "encounter" });
    expect(find("right-inspector-row-cell-tile")?.tagName).toBe("DIV");
  });

  it("reflects a renamed map after a store change", async () => {
    const mapId = store.getCurrent().startMapId;
    mounted = mountRightInspector(cursorHost);
    store.update((project) => { project.maps[mapId]!.name = "광장"; }, { scope: "project", label: "test rename", origin: "human" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(find("right-inspector-title")?.textContent).toBe("광장");
  });

  it("describes the hovered cell and a selected event", () => {
    const project = store.getCurrent();
    const map = project.maps[project.startMapId]!;
    const cell = buildInspectorView(project, { currentMapId: map.id, selectedEventId: null, layer: "lower" }, { x: 0, y: 0 });
    expect(cell.kind).toBe("map");
    const cellRows = cell.kind === "map" ? cell.groups.find((group) => group.key === "cell")!.rows : [];
    expect(cellRows.map((row) => row.value).every((value) => value !== "—")).toBe(true);
    const outside = buildInspectorView(project, { currentMapId: map.id, selectedEventId: null, layer: "lower" }, null);
    expect(outside.kind === "map" && outside.groups.find((group) => group.key === "cell")!.rows.map((row) => row.value)).toEqual(["—", "—"]);

    const event = map.events[0];
    if (!event) return;
    const view = buildInspectorView(project, { currentMapId: map.id, selectedEventId: event.id, layer: "event" }, null);
    expect(view.kind).toBe("event");
    expect(view.kind === "event" && view.subtitle).toBe(`이벤트 · ${event.x}, ${event.y}`);
  });

  it("names a custom BGM once per project object and follows a renamed upload in the next project", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.bgm = { mode: "custom", resourceId: "upload-song" } as typeof map.bgm;
    project.assets.uploaded["upload-song"] = { kind: "music", name: "Old Song" } as (typeof project.assets.uploaded)[string];
    const state = { currentMapId: map.id, selectedEventId: null, layer: "lower" };
    const bgmRow = (view: ReturnType<typeof buildInspectorView>) =>
      view.kind === "map" ? view.groups.flatMap((group) => group.rows).find((row) => row.key === "bgm")?.value : undefined;
    expect(bgmRow(buildInspectorView(project, state, null))).toBe("Old Song");
    expect(bgmRow(buildInspectorView(project, state, { x: 1, y: 1 }))).toBe("Old Song");
    const renamed = { ...project, assets: { ...project.assets, uploaded: { "upload-song": { kind: "music", name: "New Song" } } } } as typeof project;
    expect(bgmRow(buildInspectorView(renamed, state, null))).toBe("New Song");
  });
});
