import { addChildMap, addMap, deleteMap, duplicateMap, moveMapInTree, setStartMap } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { openMapContextMenu, type MapContextMenuItem, type MapContextMenuPoint } from "@/editor/panels/mapContextMenu";
import { store } from "@/project/store";
import type { MapId, MapTreeNode } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type RenderNodeContext = {
  readonly activeId: string;
  readonly allMapIds: ReadonlySet<string>;
  readonly startMapId: MapId;
};

type TreeActionSpec = {
  readonly action: () => void;
  readonly disabled?: boolean;
  readonly icon: string;
  readonly label: string;
  readonly testId: string;
};

type RenderNodeSpec = {
  readonly context: RenderNodeContext;
  readonly depth: number;
  readonly host: HTMLElement;
  readonly node: MapTreeNode;
};

type MapActionContext = {
  readonly canDelete: boolean;
  readonly mapId: MapId;
  readonly mapName: string;
};

const collapsedMapIds = new Set<MapId>();

export function renderMapList(container: HTMLElement): void {
  clearChildren(container);
  const project = store.getCurrent();
  const state = editorState.get();
  const activeId = state.currentMapId ?? project.startMapId;

  const section = el("div", { class: "panel-section", dataset: { testid: "map-tree" } });
  section.append(el("h3", { text: "맵 트리" }));

  const allMapIds = new Set(Object.keys(project.maps));
  renderNode({
    context: { activeId, allMapIds, startMapId: project.startMapId },
    depth: 0,
    host: section,
    node: project.mapTree,
  });

  section.append(
    el("button", {
      class: "btn map-tree-wide-action",
      attrs: { "aria-label": "루트 맵 추가" },
      children: [
        el("span", { class: "rm-tool-icon rm-tool-icon-map-child", attrs: { "aria-hidden": "true" } }),
        el("span", { text: "새 맵" }),
      ],
      dataset: { testid: "map-add" },
      on: {
        click: () => {
          const id = addMap("새 맵");
          editorState.set({ currentMapId: id, selectedEventId: null, selectedEventPageId: null });
        },
      },
    }),
    el("button", {
      class: "btn map-tree-wide-action",
      attrs: { "aria-label": "현재 맵을 시작 맵으로" },
      children: [
        el("span", { class: "rm-tool-icon rm-tool-icon-map-start", attrs: { "aria-hidden": "true" } }),
        el("span", { text: "시작 위치" }),
      ],
      dataset: { testid: "map-set-start" },
      on: {
        click: () => setStartMap(activeId),
      },
    })
  );

  container.append(section);
}

function renderNode(spec: RenderNodeSpec): void {
  const { context, depth, host, node } = spec;
  const project = store.getCurrent();
  const map = project.maps[node.mapId];
  const isStart = context.startMapId === node.mapId;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedMapIds.has(node.mapId);
  const actionContext: MapActionContext = {
    canDelete: Object.keys(project.maps).length > 1,
    mapId: node.mapId,
    mapName: map?.name || "(이름 없음)",
  };
  const item = el("div", {
    class: [
      "map-item",
      node.mapId === context.activeId ? "active" : "",
      hasChildren ? "has-children" : "",
    ].filter(Boolean).join(" "),
    attrs: {
      "aria-level": String(depth + 1),
      "aria-selected": String(node.mapId === context.activeId),
      draggable: depth > 0 ? "true" : "false",
      role: "treeitem",
      style: `padding-left:${8 + depth * 14}px;`,
      tabindex: "0",
    },
    dataset: { testid: `map-tree-node-${node.mapId}` },
    on: {
      click: () => selectMap(node.mapId),
      contextmenu: (event) => {
        event.preventDefault();
        if (!(event instanceof MouseEvent)) return;
        openMapActions(actionContext, { x: event.clientX, y: event.clientY });
      },
      keydown: (event) => {
        if (!(event instanceof KeyboardEvent) || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectMap(node.mapId);
          return;
        }
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          openMapActions(actionContext, pointBelow(item));
        }
      },
      dragstart: (event) => {
        const dragEvent = event as DragEvent;
        if (!dragEvent.dataTransfer || depth === 0) return;
        dragEvent.dataTransfer.effectAllowed = "move";
        dragEvent.dataTransfer.setData("application/x-rpg-zzu-map-id", node.mapId);
        item.classList.add("dragging");
      },
      dragend: () => {
        item.classList.remove("dragging");
        clearDropTargets();
      },
      dragover: (event) => {
        const dragEvent = event as DragEvent;
        const sourceId = dragEvent.dataTransfer?.getData("application/x-rpg-zzu-map-id");
        if (!sourceId || !canMoveMapTo(project.mapTree, sourceId, node.mapId)) return;
        event.preventDefault();
        item.classList.add("drop-target");
      },
      dragleave: () => item.classList.remove("drop-target"),
      drop: (event) => {
        const dragEvent = event as DragEvent;
        const sourceId = dragEvent.dataTransfer?.getData("application/x-rpg-zzu-map-id");
        clearDropTargets();
        if (!sourceId || !canMoveMapTo(project.mapTree, sourceId, node.mapId)) return;
        event.preventDefault();
        moveMapInTree(sourceId, node.mapId);
        collapsedMapIds.delete(node.mapId);
      },
    },
  });
  if (hasChildren) item.setAttribute("aria-expanded", String(!isCollapsed));

  item.append(
    treeToggle(node.mapId, hasChildren, isCollapsed),
    el("span", {
      class: "map-tree-icon rm-tool-icon rm-tool-icon-folder",
      attrs: { "aria-hidden": "true" },
    }),
    el("span", { class: "map-tree-name", text: map?.name || "(이름 없음)" })
  );

  item.append(el("span", { class: "start-mark", text: isStart ? "★" : "", attrs: { "aria-hidden": "true" } }));

  item.append(
    treeAction({
      action: () => addChildAndSelect(node.mapId),
      icon: "map-child",
      label: "하위 맵 추가",
      testId: `map-add-child-${node.mapId}`,
    }),
    treeAction({
      action: () => setStartMap(node.mapId),
      icon: "map-start",
      label: "시작 맵으로 지정",
      testId: `map-set-start-${node.mapId}`,
    }),
    treeContextMenuAction(actionContext)
  );

  const parentSel = el("select", {
    class: "map-parent-sel",
    attrs: { title: "부모 맵 변경", "aria-label": "부모 맵 변경" },
    dataset: { testid: `map-parent-select-${node.mapId}` },
  }) as HTMLSelectElement;
  parentSel.append(el("option", { text: "(루트)", attrs: { value: "" } }));
  for (const id of context.allMapIds) {
    if (id === node.mapId) continue;
    parentSel.append(el("option", { text: project.maps[id]?.name || id, attrs: { value: id } }));
  }
  parentSel.addEventListener("change", () => {
    const parentId = parentSel.value;
    if (parentId) moveMapInTree(node.mapId, parentId);
  });
  parentSel.addEventListener("click", (event) => event.stopPropagation());
  item.append(parentSel);

  item.append(
    treeAction({
      action: () => deleteAndSelectNext(node.mapId),
      disabled: !actionContext.canDelete,
      icon: "trash",
      label: "맵 삭제",
      testId: `map-delete-${node.mapId}`,
    })
  );
  host.append(item);

  if (!isCollapsed) {
    for (const child of node.children) {
      renderNode({ context, depth: depth + 1, host, node: child });
    }
  }
}

function treeToggle(mapId: MapId, hasChildren: boolean, isCollapsed: boolean): HTMLButtonElement {
  return el("button", {
    class: "map-tree-toggle",
    attrs: {
      "aria-expanded": hasChildren ? String(!isCollapsed) : "false",
      "aria-label": hasChildren ? (isCollapsed ? "하위 맵 펼치기" : "하위 맵 접기") : "하위 맵 없음",
      title: hasChildren ? (isCollapsed ? "펼치기" : "접기") : "",
    },
    children: [
      el("span", {
        class: `rm-tool-icon rm-tool-icon-tree-${isCollapsed ? "closed" : "open"}`,
        attrs: { "aria-hidden": "true" },
      }),
    ],
    dataset: { testid: `map-toggle-${mapId}` },
    on: {
      click: (event) => {
        event.stopPropagation();
        if (!hasChildren) return;
        if (collapsedMapIds.has(mapId)) {
          collapsedMapIds.delete(mapId);
        } else {
          collapsedMapIds.add(mapId);
        }
        renderMapList(document.querySelector<HTMLElement>('[data-testid="left-map-root"]') ?? document.createElement("div"));
      },
    },
  }) as HTMLButtonElement;
}

function selectMap(mapId: MapId): void {
  editorState.set({ currentMapId: mapId, selectedEventId: null, selectedEventPageId: null });
}

function addChildAndSelect(parentId: MapId): void {
  const id = addChildMap(parentId, "새 맵");
  if (!id) return;
  collapsedMapIds.delete(parentId);
  selectMap(id);
}

function duplicateAndSelect(mapId: MapId): void {
  const id = duplicateMap(mapId);
  if (!id) return;
  collapsedMapIds.delete(mapId);
  selectMap(id);
}

function deleteAndSelectNext(mapId: MapId): void {
  if (Object.keys(store.getCurrent().maps).length <= 1) return;
  deleteMap(mapId);
  const next = store.getCurrent();
  if (!next.maps[editorState.get().currentMapId ?? ""]) {
    selectMap(next.startMapId);
  }
}

function saveMapScreenshot(mapId: MapId): void {
  selectMap(mapId);
  window.setTimeout(() => {
    document.querySelector<HTMLButtonElement>('[data-testid="editor-map-screenshot-button"]')?.click();
  }, 0);
}

function openMapActions(context: MapActionContext, point: MapContextMenuPoint): void {
  selectMap(context.mapId);
  window.setTimeout(() => focusMapRow(context.mapId), 0);
  openMapContextMenu({
    items: mapContextMenuItems(context),
    mapId: context.mapId,
    mapName: context.mapName,
    point,
  });
}

function mapContextMenuItems(context: MapActionContext): readonly MapContextMenuItem[] {
  return [
    {
      action: () => undefined,
      disabled: true,
      icon: "map-settings",
      id: "settings",
      label: "맵 설정",
      testId: `map-settings-${context.mapId}`,
    },
    {
      action: () => addChildAndSelect(context.mapId),
      icon: "map-child",
      id: "add-child",
      label: "새 하위 맵",
      testId: `map-menu-add-child-${context.mapId}`,
    },
    {
      action: () => duplicateAndSelect(context.mapId),
      icon: "copy",
      id: "duplicate",
      label: "복제",
      testId: `map-duplicate-${context.mapId}`,
    },
    {
      action: () => setStartMap(context.mapId),
      icon: "map-start",
      id: "set-start",
      label: "시작 맵으로 지정",
      testId: `map-menu-set-start-${context.mapId}`,
    },
    {
      action: () => saveMapScreenshot(context.mapId),
      icon: "map-screenshot",
      id: "screenshot",
      label: "스크린샷 저장",
      testId: `map-screenshot-${context.mapId}`,
    },
    {
      action: () => deleteAndSelectNext(context.mapId),
      disabled: !context.canDelete,
      icon: "trash",
      id: "delete",
      label: "맵 삭제",
      separatorBefore: true,
      testId: `map-menu-delete-${context.mapId}`,
    },
  ];
}

function pointBelow(node: HTMLElement): MapContextMenuPoint {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + Math.max(0, Math.min(28, rect.width - 4)), y: rect.bottom };
}

function focusMapRow(mapId: MapId): void {
  document.querySelector<HTMLElement>(`[data-testid="map-tree-node-${mapId}"]`)?.focus();
}

function canMoveMapTo(root: MapTreeNode, sourceId: MapId, targetId: MapId): boolean {
  if (sourceId === targetId || sourceId === root.mapId) return false;
  const source = findTreeNode(root, sourceId);
  const target = findTreeNode(root, targetId);
  return Boolean(source && target && !containsMap(source, targetId));
}

function findTreeNode(node: MapTreeNode, mapId: MapId): MapTreeNode | null {
  if (node.mapId === mapId) return node;
  for (const child of node.children) {
    const found = findTreeNode(child, mapId);
    if (found) return found;
  }
  return null;
}

function containsMap(node: MapTreeNode, mapId: MapId): boolean {
  if (node.mapId === mapId) return true;
  return node.children.some((child) => containsMap(child, mapId));
}

function clearDropTargets(): void {
  document.querySelectorAll(".map-item.drop-target").forEach((node) => node.classList.remove("drop-target"));
}

function treeContextMenuAction(context: MapActionContext): HTMLButtonElement {
  return el("button", {
    class: "map-tree-action map-context-trigger",
    attrs: {
      "aria-haspopup": "menu",
      "aria-label": "맵 액션 메뉴",
      title: "맵 액션 메뉴",
      type: "button",
    },
    children: [el("span", { class: "rm-tool-icon rm-tool-icon-map-menu", attrs: { "aria-hidden": "true" } })],
    dataset: { testid: `map-context-trigger-${context.mapId}` },
    on: {
      click: (event) => {
        event.stopPropagation();
        if (!(event.currentTarget instanceof HTMLElement)) return;
        openMapActions(context, pointBelow(event.currentTarget));
      },
    },
  }) as HTMLButtonElement;
}

function treeAction(spec: TreeActionSpec): HTMLButtonElement {
  const button = el("button", {
    class: "map-tree-action",
    attrs: { title: spec.label, "aria-label": spec.label, type: "button" },
    children: [el("span", { class: `rm-tool-icon rm-tool-icon-${spec.icon}`, attrs: { "aria-hidden": "true" } })],
    dataset: { testid: spec.testId },
    on: {
      click: (event) => {
        event.stopPropagation();
        if (spec.disabled) return;
        spec.action();
      },
    },
  }) as HTMLButtonElement;
  button.disabled = Boolean(spec.disabled);
  return button;
}
