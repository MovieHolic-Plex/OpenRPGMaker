import { addChildMap, addMap, duplicateMap, moveMapInTree, setStartMap } from "@/editor/actions";
import { confirmAndDeleteMap } from "@/editor/mapDeleteConfirm";
import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { statusForMap, type MapEditLockStatus } from "@/editor/mapEditLocks";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import { openMapContextMenu, type MapContextMenuItem, type MapContextMenuPoint } from "@/editor/panels/mapContextMenu";
import { renderMapProps } from "@/editor/panels/mapProps";
import { openMapShiftDialog } from "@/editor/panels/mapShiftDialog";
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
  readonly text?: string;
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
let currentMapListContainer: HTMLElement | null = null;

export function renderMapList(container: HTMLElement): void {
  currentMapListContainer = container;
  clearChildren(container);
  const project = store.getCurrent();
  const state = editorState.get();
  const activeId = state.currentMapId ?? project.startMapId;
  expandPathToMap(project.mapTree, activeId);

  const section = el("div", { class: "panel-section map-tree-panel", dataset: { testid: "map-tree" } });
  const header = el("div", { class: "map-tree-header" });
  header.append(el("h3", { text: `맵 트리 ${Object.keys(project.maps).length}` }));
  header.append(makeMapTreeHeaderActions(activeId, project.mapTree));
  section.append(header);

  const allMapIds = new Set(Object.keys(project.maps));
  renderNode({
    context: { activeId, allMapIds, startMapId: project.startMapId },
    depth: 0,
    host: section,
    node: project.mapTree,
  });

  container.append(section);
}

function renderNode(spec: RenderNodeSpec): void {
  const { context, depth, host, node } = spec;
  const project = store.getCurrent();
  const map = project.maps[node.mapId];
  const isStart = context.startMapId === node.mapId;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedMapIds.has(node.mapId);
  const icon = mapTreeIcon(depth, map?.name ?? "", hasChildren);
  const actionContext: MapActionContext = {
    canDelete: Object.keys(project.maps).length > 1,
    mapId: node.mapId,
    mapName: map?.name || "(이름 없음)",
  };
  const item = el("div", {
    class: [
      "map-item",
      depth === 0 ? "map-root" : "map-node",
      node.mapId === context.activeId ? "active" : "",
      hasChildren ? "has-children" : "",
    ].filter(Boolean).join(" "),
    attrs: {
      "aria-level": String(depth + 1),
      "aria-selected": String(node.mapId === context.activeId),
      draggable: depth > 0 ? "true" : "false",
      role: "treeitem",
      style: `--map-depth:${depth}; padding-left:${6 + depth * 18}px;`,
      tabindex: "0",
    },
    dataset: { testid: `map-tree-node-${node.mapId}` },
    on: {
      click: () => selectEditorMap(node.mapId),
      contextmenu: (event) => {
        event.preventDefault();
        if (!(event instanceof MouseEvent)) return;
        openMapActions(actionContext, { x: event.clientX, y: event.clientY });
      },
      keydown: (event) => {
        if (!(event instanceof KeyboardEvent) || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectEditorMap(node.mapId);
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
      class: `map-tree-icon rm-tool-icon rm-tool-icon-${icon}`,
      attrs: { "aria-hidden": "true" },
    }),
    el("span", { class: "map-tree-name", text: map?.name || "(이름 없음)" }),
    mapLockBadge(node.mapId)
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
        rerenderMapList();
      },
    },
  }) as HTMLButtonElement;
}

function makeMapTreeHeaderActions(activeId: MapId, root: MapTreeNode): HTMLElement {
  const allCollapsed = areAllBranchesCollapsed(root);
  return el("div", {
    class: "map-tree-header-actions",
    children: [
      treeAction({
        action: () => {
          const id = addMap("새 맵");
          selectEditorMap(id);
        },
        icon: "map-child",
        label: "루트 맵 추가",
        testId: "map-add",
      }),
      treeAction({
        action: () => addCategoryAndSelect(activeId),
        icon: "folder",
        label: "현재 맵 아래 카테고리 생성",
        text: "분류",
        testId: "map-add-category",
      }),
      treeAction({
        action: () => setStartMap(activeId),
        icon: "map-start",
        label: "현재 맵을 시작 맵으로",
        testId: "map-set-start",
      }),
      treeAction({
        action: () => {
          if (allCollapsed) expandAllMapTree(root);
          else collapseAllMapTree(root);
          rerenderMapList();
        },
        icon: allCollapsed ? "tree-open" : "tree-closed",
        label: allCollapsed ? "전체 펼치기" : "전체 접기",
        testId: "map-toggle-all",
      }),
    ],
  });
}

function addCategoryAndSelect(parentId: MapId): void {
  const id = addChildMap(parentId, "새 카테고리", { width: 8, height: 8 });
  if (!id) return;
  collapsedMapIds.delete(parentId);
  selectEditorMap(id);
}

function areAllBranchesCollapsed(root: MapTreeNode): boolean {
  const branches = branchMapIds(root);
  return branches.length > 0 && branches.every((mapId) => collapsedMapIds.has(mapId));
}

function collapseAllMapTree(root: MapTreeNode): void {
  for (const mapId of branchMapIds(root)) collapsedMapIds.add(mapId);
}

function expandAllMapTree(root: MapTreeNode): void {
  for (const mapId of branchMapIds(root)) collapsedMapIds.delete(mapId);
}

function branchMapIds(root: MapTreeNode): readonly MapId[] {
  const ids: MapId[] = [];
  collectBranchMapIds(root, ids);
  return ids;
}

function collectBranchMapIds(node: MapTreeNode, ids: MapId[]): void {
  if (node.children.length > 0) ids.push(node.mapId);
  for (const child of node.children) collectBranchMapIds(child, ids);
}

function expandPathToMap(root: MapTreeNode, mapId: MapId): void {
  const path = pathToMap(root, mapId);
  for (const ancestor of path.slice(0, -1)) collapsedMapIds.delete(ancestor);
}

function pathToMap(node: MapTreeNode, mapId: MapId, path: MapId[] = []): readonly MapId[] {
  const nextPath = [...path, node.mapId];
  if (node.mapId === mapId) return nextPath;
  for (const child of node.children) {
    const found = pathToMap(child, mapId, nextPath);
    if (found.length > 0) return found;
  }
  return [];
}

function rerenderMapList(): void {
  if (currentMapListContainer) renderMapList(currentMapListContainer);
}

function mapTreeIcon(depth: number, mapName: string, hasChildren: boolean): string {
  if (depth === 0) return "folder";
  const normalized = mapName.trim().toLowerCase();
  if (hasChildren || normalized.includes("카테고리") || normalized.startsWith("area")) return "folder";
  return "map-node";
}

function mapLockBadge(mapId: MapId): HTMLElement {
  const lockStatus = statusForMap(mapId);
  const label = mapLockBadgeLabel(lockStatus);
  return el("span", {
    class: `map-lock-badge ${lockStatus?.kind ?? "idle"}`,
    text: label,
    attrs: {
      "aria-label": label ? `맵 편집 상태: ${label}` : "맵 편집 상태 없음",
      title: mapLockBadgeTitle(lockStatus),
    },
    dataset: { testid: `map-lock-badge-${mapId}` },
  });
}

function mapLockBadgeLabel(status: MapEditLockStatus | null): string {
  if (!status) return "";
  switch (status.kind) {
    case "checking":
      return "확인";
    case "held":
      return "내 잠금";
    case "locked":
      return `잠김: ${status.ownerLabel}`;
    case "unavailable":
      return "로컬";
    case "idle":
      return "";
  }
}

function mapLockBadgeTitle(status: MapEditLockStatus | null): string {
  if (!status) return "아직 잠금 상태를 확인하지 않았습니다.";
  switch (status.kind) {
    case "checking":
      return "편집 권한 확인 중";
    case "held":
      return "이 브라우저가 이 맵을 편집 중";
    case "locked":
      return `${status.ownerLabel} 세션이 편집 중`;
    case "unavailable":
      return `잠금 확인 불가: ${status.message}`;
    case "idle":
      return "아직 잠금 상태를 확인하지 않았습니다.";
  }
}

function addChildAndSelect(parentId: MapId, name = "새 맵"): void {
  const id = addChildMap(parentId, name);
  if (!id) return;
  collapsedMapIds.delete(parentId);
  selectEditorMap(id);
}

function duplicateAndSelect(mapId: MapId): void {
  const id = duplicateMap(mapId);
  if (!id) return;
  collapsedMapIds.delete(mapId);
  selectEditorMap(id);
}

function deleteAndSelectNext(mapId: MapId): void {
  if (Object.keys(store.getCurrent().maps).length <= 1) return;
  // 확인 다이얼로그(임팩트 요약, 커스텀 모달) + 무결성 가드 경유 삭제(도그푸딩 결함 ①·⑦).
  void confirmAndDeleteMap(mapId).then((result) => {
    if (!result.ok) return;
    const next = store.getCurrent();
    if (!next.maps[editorState.get().currentMapId ?? ""]) {
      selectEditorMap(next.startMapId);
    }
  });
}

function openMapProperties(mapId: MapId, mapName: string): void {
  selectEditorMap(mapId);
  openEventSubdialog({
    render: (body) => renderMapProps(body),
    testId: `map-properties-modal-${mapId}`,
    title: "맵 설정",
    subtitle: mapName,
    width: "narrow",
  });
}

function openMapActions(context: MapActionContext, point: MapContextMenuPoint): void {
  selectEditorMap(context.mapId);
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
      action: () => openMapProperties(context.mapId, context.mapName),
      icon: "map-settings",
      id: "settings",
      label: "맵 설정",
      testId: `map-settings-${context.mapId}`,
    },
    {
      action: () => addChildAndSelect(context.mapId, "New Map"),
      icon: "map-child",
      id: "add-child",
      label: "New Map",
      separatorBefore: true,
      testId: `map-menu-add-child-${context.mapId}`,
    },
    {
      action: () => addChildAndSelect(context.mapId, "New Area"),
      icon: "map-area",
      id: "add-area",
      label: "New Area...",
      testId: `map-menu-add-area-${context.mapId}`,
    },
    {
      action: () => undefined,
      disabled: true,
      icon: "map-dungeon",
      id: "generate-dungeon",
      label: "Generate Dungeon",
      testId: `map-generate-dungeon-${context.mapId}`,
    },
    {
      action: () => duplicateAndSelect(context.mapId),
      icon: "copy",
      id: "duplicate",
      label: "Copy",
      separatorBefore: true,
      shortcut: "Ctrl+C",
      testId: `map-duplicate-${context.mapId}`,
    },
    {
      action: () => undefined,
      disabled: true,
      icon: "paste",
      id: "paste",
      label: "Paste",
      shortcut: "Ctrl+V",
      testId: `map-paste-${context.mapId}`,
    },
    {
      action: () => deleteAndSelectNext(context.mapId),
      disabled: !context.canDelete,
      icon: "trash",
      id: "delete",
      label: "Delete",
      separatorBefore: true,
      shortcut: "Del",
      testId: `map-menu-delete-${context.mapId}`,
    },
    {
      action: () => openMapShiftDialog(context.mapId, context.mapName),
      icon: "map-shift",
      id: "shift",
      label: "Shift...",
      separatorBefore: true,
      shortcut: "Ctrl+H",
      testId: `map-shift-${context.mapId}`,
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
    children: [
      el("span", { class: `rm-tool-icon rm-tool-icon-${spec.icon}`, attrs: { "aria-hidden": "true" } }),
      ...(spec.text ? [el("span", { class: "map-tree-action-text", text: spec.text })] : []),
    ],
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
