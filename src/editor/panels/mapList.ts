import { addMapFolder, duplicateMap, moveMapInTree, moveMapsInTree, renameMap, setStartMap } from "@/editor/actions";
import { confirmAndDeleteMap, confirmAndDeleteMapRecursive, confirmAndDeleteMaps, confirmAndDissolveFolder } from "@/editor/mapDeleteConfirm";
import { editorState } from "@/editor/editorState";
import { addParentChildTransfers, bestTestStartCell } from "@/editor/mapParentLink";
import { selectEditorMap } from "@/editor/mapSelection";
import { mapTreeDropRelation, type MapTreeDropRelation } from "@/editor/mapTreeDrop";
import { openMapCreateDialog, openMapCreateUnder } from "@/editor/panels/mapCreateDialog";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import { openTestPlayModal } from "@/editor/panels/testPlayModal";
import { openMapContextMenu, type MapContextMenuItem, type MapContextMenuPoint } from "@/editor/panels/mapContextMenu";
import { renderMapInspector, type MapInspectorAction, type MapInspectorView } from "@/editor/panels/mapInspectorPane";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { openMapShiftDialog } from "@/editor/panels/mapShiftDialog";
import { collectMapInspection, type MapInspection } from "@/project/mapInspection";
import { collectMapLinkStats } from "@/project/mapLinkStats";
import {
  canReparentMap,
  findParentMapId,
  findTreeNode,
  isMapTreeFolder,
  mapTreeNodeLabel,
  nextMapAfterRemoval,
  selectionRoots,
  siblingIndex,
} from "@/project/mapTree";
import { store } from "@/project/store";
import { toast } from "@/util/toast";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { isMapPanelCollapsed, toggleMapPanelCollapsed } from "@/editor/workspace/mapPanelSection";

type RenderNodeContext = {
  readonly activeId: string;
  readonly startMapId: MapId;
  readonly visibleIds: ReadonlySet<MapId>;
};

type TreeActionSpec = {
  readonly action: () => void;
  readonly ariaExpanded?: boolean;
  readonly disabled?: boolean;
  readonly icon: string;
  readonly label: string;
  /** 헤더의 주 동작 — 글자 라벨과 강조 톤을 받는 버튼 하나. */
  readonly primary?: boolean;
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
  readonly isFolder: boolean;
  readonly mapId: MapId;
  readonly mapName: string;
};

export type MapListVariant = "panel" | "basic";

const COLLAPSED_STORAGE_KEY = "oprn:map-tree-collapsed";
const collapsedMapIds = loadCollapsedMapIds();
let currentMapListContainer: HTMLElement | null = null;
let currentMapListVariant: MapListVariant = "panel";
let mapFilterQuery = "";
type MapFilterFacet = "all" | "empty" | "nolink" | "encounter";
let mapFilterFacet: MapFilterFacet = "all";
/** 맵이 이 개수 이상이면 필터를 처음부터 펼친다. 행 31px × 8 = 248px 로 기본
 *  트리 높이(300px)를 채우기 시작하는 지점이다. */
const FILTER_AUTO_EXPAND_MAPS = 8;
let filterExpandedByUser = false;
let lastExpandedMapId: MapId | null = null;
let draggingMapId: MapId | null = null;
let draggingMapIds: MapId[] = [];
let renamingMapId: MapId | null = null;
const selectedMapIds = new Set<MapId>();
let lastClickedMapId: MapId | null = null;

export function renderMapList(container: HTMLElement, options?: { readonly variant?: MapListVariant }): void {
  currentMapListContainer = container;
  currentMapListVariant = options?.variant ?? "panel";
  clearChildren(container);
  const project = store.getCurrent();
  const state = editorState.get();
  const activeId = state.currentMapId ?? project.startMapId;
  if (activeId !== lastExpandedMapId) {
    expandPathToMap(project.mapTree, activeId);
    lastExpandedMapId = activeId;
  }
  if (mapFilterQuery.trim()) expandMatchingAncestors(project.mapTree, mapFilterQuery);

  const isBasic = currentMapListVariant === "basic";
  const mapCount = Object.keys(project.maps).length;
  const visibleIds = visibleMapIds(project.mapTree, mapFilterQuery, mapFilterFacet);
  const section = el("div", {
    class: "panel-section map-tree-panel" + (isBasic ? " is-basic-flyout" : ""),
    dataset: { testid: "map-tree", mapListVariant: currentMapListVariant },
  });

  // 도크 섹션 접힘은 편집기 셸(editor.ts)이 높이를 줄이고, 여기서는 그 상태를 헤더에 그린다 —
  // 제목 자체가 토글이다(갈매기 + 「맵」 + 개수). 초보 플라이아웃은 접을 도크가 없으므로 해당 없음.
  const sectionCollapsed = !isBasic && isMapPanelCollapsed();
  if (sectionCollapsed) section.classList.add("is-section-collapsed");
  const header = isBasic
    ? makeBasicHeader(mapCount)
    : (() => {
      const node = el("div", { class: "map-tree-header" });
      node.append(el("h3", {
        children: [
          el("button", {
            class: "map-tree-section-toggle",
            attrs: {
              type: "button",
              "aria-expanded": String(!sectionCollapsed),
              title: sectionCollapsed ? "맵 패널 펼치기" : "맵 패널 접기",
            },
            dataset: { testid: "map-tree-section-toggle" },
            children: [
              el("span", {
                class: `rm-tool-icon oprn-icon-tree-${sectionCollapsed ? "closed" : "open"}`,
                attrs: { "aria-hidden": "true" },
              }),
              el("span", { class: "map-tree-title", text: "맵" }),
              el("span", { class: "map-tree-count", text: String(mapCount) }),
            ],
            on: {
              click: (event) => {
                event.stopPropagation();
                toggleMapPanelCollapsed();
                rerenderMapList();
              },
            },
          }),
        ],
      }));
      node.append(makeMapTreeHeaderActions(project.mapTree, mapCount));
      return node;
    })();

  const tree = el("div", {
    class: isBasic ? "map-tree-list map-tree-list-basic" : "map-tree-list",
    attrs: {
      role: "tree",
      "aria-label": "맵 목록",
      "aria-multiselectable": "true",
      // 예전엔 이 조작법이 헤더에서 두 줄을 상시 점유했다(340px 폭에서 줄바꿈). 목록은
      // 이름을 읽는 칸이므로 제스처 설명은 도구설명으로 내린다.
      title: "클릭 선택 · Ctrl/Shift 다중 선택 · 가운데클릭 시연 실행 · 핸들 끌어 이동",
    },
    dataset: { testid: "map-tree-list" },
    on: {
      pointerdown: (event) => beginTreeBoxSelect(event, tree),
    },
  });
  renderNode({
    context: { activeId, startMapId: project.startMapId, visibleIds },
    depth: 0,
    host: tree,
    node: project.mapTree,
  });

  if (isBasic) {
    // 2단 탐색기: 왼쪽은 이름 위주 목록, 오른쪽은 고른 맵의 상세. 행에 정보를 더 밀어넣는
    // 대신 칸을 하나 늘린 이유는 map-panel.modern.css §초보 플라이아웃에 적혀 있다 —
    // 340px 1단에서는 1fr 트랙이 93.59px 이라 메타를 늘리면 그대로 말줄임된다.
    section.append(el("div", {
      class: "map-tree-explorer",
      dataset: { testid: "map-tree-explorer" },
      children: [
        el("div", { class: "map-tree-explorer-list", children: [header, makeFilterField(mapCount), tree] }),
        el("div", {
          class: "map-tree-explorer-detail",
          children: [renderMapInspector(inspectorViewFor(project, activeId))],
        }),
      ],
    }));
  } else {
    section.append(header);
    section.append(makeFilterField(mapCount));
    section.append(tree);
  }
  container.append(section);
  if (typeof globalThis.requestAnimationFrame === "function") {
    globalThis.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-testid="map-tree-node-${activeId}"]`)?.scrollIntoView({ block: "nearest" });
    });
  }
}

function makeBasicHeader(mapCount: number): HTMLElement {
  const header = el("div", { class: "map-tree-header map-tree-header-basic" });
  header.append(
    el("div", {
      class: "map-tree-basic-meta",
      children: [
        el("span", { class: "map-tree-basic-count", text: `${mapCount}개 맵` }),
        el("span", { class: "map-tree-basic-hint", text: "고르면 오른쪽에 상세" }),
      ],
    }),
  );
  if (canToggleMapFilter(mapCount)) {
    header.append(el("button", {
      class: "map-tree-action",
      attrs: { type: "button", title: "맵 필터", "aria-label": "맵 필터", "aria-expanded": String(isFilterExpanded(mapCount)) },
      dataset: { testid: "map-tree-filter-toggle" },
      children: [el("span", { class: "rm-tool-icon oprn-icon-map-search", attrs: { "aria-hidden": "true" } })],
      on: {
        click: () => toggleMapFilterExpansion(),
      },
    }));
  }
  header.append(
    el("button", {
      class: "map-tree-basic-add",
      text: "+ 새 맵",
      attrs: { type: "button", title: "맵 추가" },
      dataset: { testid: "map-add" },
      on: {
        click: () => openMapCreateDialog({ preset: "blank" }),
      },
    }),
  );
  return header;
}

/**
 * 상세 칸이 무엇을 보여줄지 고른다.
 *
 * 분류 폴더 행을 누르면 `selectEditorMap` 을 타지 않아(applyTreeSelection) 활성 맵이 그대로
 * 남는다 — 그때 옆 칸이 다른 맵 상세를 계속 띄우면 "누른 걸 보여준다"는 약속이 깨진다.
 * 마지막으로 누른 행이 폴더면 폴더라고 말한다.
 */
function inspectorViewFor(project: Project, activeId: MapId): MapInspectorView {
  if (lastClickedMapId && !project.maps[lastClickedMapId]) {
    const node = findTreeNode(project.mapTree, lastClickedMapId);
    if (node && isMapTreeFolder(node)) {
      const label = mapTreeNodeLabel(node, project.maps);
      return {
        kind: "empty",
        text: `'${label}' 은 정리용 분류입니다. 하위 ${node.children.length}개 — 플레이되는 맵이 아니라서 크기·이벤트·연결이 없습니다.`,
      };
    }
  }
  const inspection = collectMapInspection(project, activeId);
  if (!inspection) return { kind: "empty", text: "맵을 고르면 여기에 상세가 나옵니다." };
  return { actions: inspectorActions(project, inspection), inspection, kind: "map" };
}

function inspectorActions(project: Project, inspection: MapInspection): readonly MapInspectorAction[] {
  const mapId = inspection.mapId;
  const canDelete = Object.keys(project.maps).length > 1;
  return [
    { id: "properties", label: "맵 설정", primary: true, run: () => openMapProperties(mapId, inspection.name) },
    { id: "test-play", label: "시연 실행", run: () => void playMapFromTree(mapId) },
    { id: "add-child", label: "하위 맵 추가", run: () => openMapCreateUnder(mapId) },
    { id: "duplicate", label: "복제", run: () => duplicateAndSelect(mapId) },
    {
      disabled: inspection.isStart,
      disabledReason: "이미 시작 맵입니다",
      id: "set-start",
      label: "시작 맵으로",
      run: () => {
        setStartMap(mapId);
        toast(`'${inspection.name}'을 시작 맵으로 지정했습니다`, "ok");
      },
    },
    {
      disabled: !canDelete,
      disabledReason: "맵이 하나뿐이라 지울 수 없습니다",
      id: "delete",
      label: "삭제",
      run: () => deleteAndSelectNext(mapId),
    },
  ];
}

function hasActiveMapFilter(): boolean {
  return mapFilterQuery.trim().length > 0 || mapFilterFacet !== "all";
}

/** 활성 질의/패싯이 있으면 개수와 무관하게 편다 — 숨겨진 필터 때문에 "맵이 사라졌다"고
 *  오인하지 않도록 한다. `makeFilterField`와 헤더 토글의 `aria-expanded`가 같은 판단을
 *  공유해야 두 곳이 어긋나지 않는다. */
function isFilterExpanded(mapCount: number): boolean {
  return hasActiveMapFilter() || filterExpandedByUser || mapCount >= FILTER_AUTO_EXPAND_MAPS;
}

/** 토글을 눌러도 상태가 안 바뀌는 경우엔 아예 그리지 않는다 — 질의/패싯이 활성이거나
 *  맵이 많아 이미 강제로 펼쳐져 있으면 `filterExpandedByUser` 를 뒤집어도 `isFilterExpanded`
 *  결과가 그대로라, 눌러도 아무 일 없는 죽은 버튼이 된다(행 접기 화살표가 disabled 표시 없이
 *  죽어 있던 것과 같은 결함 형태 — 이번엔 아예 렌더하지 않는 쪽으로 막는다). */
function canToggleMapFilter(mapCount: number): boolean {
  return !hasActiveMapFilter() && mapCount < FILTER_AUTO_EXPAND_MAPS;
}

/** 전문가 헤더 토글과 초보 플라이아웃 토글이 공유하는 동작. 마크업(치장된
 *  `treeAction` vs 맨 `el("button")`)은 서로 다르지만 상태 전이는 하나뿐이라 —
 *  두 곳에서 따로 구현하면(과거처럼) 한쪽만 펼친 뒤 입력에 포커스를 주는
 *  드리프트가 생긴다. 접는 클릭에서는 필터 입력이 곧바로 hidden 이 되어
 *  `.focus()` 가 조용히 no-op 이 되므로 펼침/접힘을 분기할 필요가 없다. */
function toggleMapFilterExpansion(): void {
  filterExpandedByUser = !filterExpandedByUser;
  rerenderMapList();
  currentMapListContainer
    ?.querySelector<HTMLInputElement>('[data-testid="map-tree-filter"]')
    ?.focus();
}

function makeFilterField(mapCount: number): HTMLElement {
  const expanded = isFilterExpanded(mapCount);
  const chips = el("div", { class: "map-tree-filter-facets" });
  for (const [value, label] of [
    ["all", "전체"],
    ["empty", "빈 맵"],
    ["nolink", "문 없음"],
    ["encounter", "인카운터"],
  ] as const) {
    chips.append(el("button", {
      class: "map-tree-facet" + (mapFilterFacet === value ? " is-active" : ""),
      text: label,
      attrs: { type: "button", "aria-pressed": String(mapFilterFacet === value) },
      dataset: { testid: `map-tree-facet-${value}` },
      on: {
        click: () => {
          mapFilterFacet = value;
          rerenderMapList();
        },
      },
    }));
  }
  const wrap = el("div", {
    class: "map-tree-filter",
    children: [
      el("input", {
        class: "map-tree-filter-input",
        attrs: {
          type: "search",
          placeholder: "이름 또는 id",
          "aria-label": "맵 이름 필터",
        },
        value: mapFilterQuery,
        dataset: { testid: "map-tree-filter" },
        on: {
          input: (event) => {
            mapFilterQuery = (event.target as HTMLInputElement).value;
            rerenderMapList();
            const input = currentMapListContainer?.querySelector<HTMLInputElement>("[data-testid='map-tree-filter']");
            input?.focus();
            if (input) input.setSelectionRange(mapFilterQuery.length, mapFilterQuery.length);
          },
        },
      }),
      chips,
    ],
  });
  if (!expanded) wrap.setAttribute("hidden", "");
  return wrap;
}

function renderNode(spec: RenderNodeSpec): void {
  const { context, depth, host, node } = spec;
  if (!context.visibleIds.has(node.mapId)) return;
  const project = store.getCurrent();
  const map = project.maps[node.mapId];
  const isFolder = isMapTreeFolder(node);
  const isStart = context.startMapId === node.mapId;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedMapIds.has(node.mapId) && !mapFilterQuery.trim() && mapFilterFacet === "all";
  const icon = isFolder || depth === 0 || hasChildren ? "folder" : "map-node";
  const actionContext: MapActionContext = {
    canDelete: isFolder || Object.keys(project.maps).length > 1,
    isFolder,
    mapId: node.mapId,
    mapName: mapTreeNodeLabel(node, project.maps),
  };
  const isBasicRow = currentMapListVariant === "basic";
  const isActive = node.mapId === context.activeId;
  const isMulti = selectedMapIds.has(node.mapId);
  const item = el("div", {
    class: [
      "map-item",
      depth === 0 ? "map-root" : "map-node",
      isActive ? "active" : "",
      isMulti ? "is-multi-selected" : "",
      isFolder ? "is-folder" : "",
      hasChildren ? "has-children" : "",
    ].filter(Boolean).join(" "),
    attrs: {
      "aria-level": String(depth + 1),
      "aria-selected": String(isActive || isMulti),
      draggable: "false",
      role: "treeitem",
      style: `--map-depth:${depth};`,
      tabindex: isActive ? "0" : "-1",
    },
    dataset: { testid: `map-tree-node-${node.mapId}` },
    on: {
      pointerup: (event) => {
        if (!(event instanceof PointerEvent) || event.button !== 1) return;
        if (event.target instanceof Element && event.target.closest("button, input, select, .map-tree-drag-handle")) return;
        event.preventDefault();
        if (!isFolder) void playMapFromTree(node.mapId);
      },
      click: (event) => {
        const target = event.target as { closest?: (selector: string) => unknown } | null;
        if (target && typeof target.closest === "function" && target.closest("button, input, select, .map-tree-drag-handle")) return;
        applyTreeSelection(node.mapId, event, isFolder);
      },
      auxclick: (event) => {
        if (!(event instanceof MouseEvent) || event.button !== 1) return;
        event.preventDefault();
        if (!isFolder) void playMapFromTree(node.mapId);
      },
      dblclick: (event) => {
        if (event.target instanceof Element && event.target.closest("button, input, .map-tree-drag-handle")) return;
        event.preventDefault();
        if (isFolder) beginRename(node.mapId);
        else openMapProperties(node.mapId, actionContext.mapName);
      },
      contextmenu: (event) => {
        event.preventDefault();
        if (!(event instanceof MouseEvent)) return;
        openMapActions(actionContext, { x: event.clientX, y: event.clientY });
      },
      keydown: (event) => handleRowKeydown(event, actionContext, item, hasChildren, isCollapsed),
      dragover: (event) => {
        const dragEvent = event as DragEvent;
        const sourceIds = draggingMapIds.length > 0 ? draggingMapIds : draggingMapId ? [draggingMapId] : [];
        if (sourceIds.length === 0) return;
        const relation = dropRelationFor(dragEvent, item, depth === 0);
        if (!sourceIds.every((sourceId) => canDropRelation(project.mapTree, sourceId, node.mapId, relation))) return;
        event.preventDefault();
        markDropTarget(item, relation);
      },
      dragleave: () => item.classList.remove("drop-target", "drop-before", "drop-after", "drop-child"),
      drop: (event) => {
        const dragEvent = event as DragEvent;
        const sourceIds = draggingMapIds.length > 0 ? draggingMapIds : draggingMapId ? [draggingMapId] : [];
        clearDropTargets();
        if (sourceIds.length === 0) return;
        const relation = dropRelationFor(dragEvent, item, depth === 0);
        if (!sourceIds.every((sourceId) => canDropRelation(project.mapTree, sourceId, node.mapId, relation))) return;
        event.preventDefault();
        applyDrop(project.mapTree, sourceIds, node.mapId, relation);
        collapsedMapIds.delete(node.mapId);
        persistCollapsed();
      },
    },
  });
  if (hasChildren) item.setAttribute("aria-expanded", String(!isCollapsed));
  if (isBasicRow) item.classList.add("map-item-basic");

  item.append(treeToggle(node.mapId, hasChildren, isCollapsed));
  item.append(dragHandle(node.mapId, item, depth > 0));
  // 분류 폴더는 그릴 맵이 없으니 글리프를 쓴다. 맵은 자기 그림을 보여준다 —
  // 하위 맵을 가진 맵도 폴더 글리프가 아니라 자기 썸네일이다.
  item.append(isFolder
    ? el("span", {
      class: `map-tree-icon rm-tool-icon oprn-icon-${icon}`,
      attrs: { "aria-hidden": "true" },
    })
    : createMapThumbnail(node.mapId));

  if (renamingMapId === node.mapId) {
    item.append(renameField(node.mapId, map?.name || ""));
  } else {
    const links = map ? collectMapLinkStats(project, node.mapId) : null;
    const isUnlinked = !isFolder && links !== null && links.playLinkCount === 0;
    const metaBits = isFolder
      ? [`분류`, `하위 ${node.children.length}`]
      : [
        map ? `${map.width}×${map.height}` : "",
        `${map?.events.length ?? 0}이벤트`,
      ].filter(Boolean);
    if (!isFolder && ((map?.encounterRate ?? 0) > 0 || (map?.troopIds?.length ?? 0) > 0)) metaBits.push("인카운터");
    // 초보 2단 탐색기에서는 `문N` 을 뺀다 — 나가는/들어오는/연결로 쪼갠 값이 상세 칸에
    // 있고, 목록 칸의 1fr 트랙은 이름을 읽는 데 써야 한다. 다만 0 일 때는 그 자리에
    // '고립'을 남긴다: 이게 유일하게 행에서 손을 써야 하는 신호다.
    if (isBasicRow && isUnlinked) metaBits.push("고립");
    item.append(el("div", {
      class: "map-tree-copy",
      children: [
        el("span", { class: "map-tree-name", text: actionContext.mapName }),
        el("span", {
          class: "map-tree-meta" + (isUnlinked ? " is-unlinked" : ""),
          text: isFolder || isBasicRow ? metaBits.join(" · ") : `${metaBits.join(" · ")} · 문${links?.playLinkCount ?? 0}`,
          attrs: {
            title: isFolder
              ? "플레이 맵이 아닙니다. 정리용 폴더입니다."
              : links && links.playLinkCount === 0
                ? "이 맵으로 들어오거나 나가는 이동이 없습니다. 트리 계층만으로는 문이 생기지 않습니다."
                : `나가는 이동 ${links?.outgoingTransfers ?? 0} · 들어오는 이동 ${links?.incomingTransfers ?? 0} · 연결 ${links?.connections ?? 0}`,
          },
        }),
      ],
    }));
  }

  if (isStart) {
    item.append(el("span", {
      class: isBasicRow ? "start-mark is-start" : "start-mark",
      text: "시작",
      attrs: { title: "시작 맵" },
    }));
  }

  if (isBasicRow) {
    item.append(
      el("button", {
        class: "map-tree-add-child-quick",
        text: "+",
        attrs: { type: "button", title: "하위 맵 추가", "aria-label": `${actionContext.mapName}에 하위 맵 추가` },
        dataset: { testid: `map-quick-add-child-${node.mapId}` },
        on: {
          click: (event) => {
            event.stopPropagation();
            openMapCreateUnder(node.mapId);
          },
        },
      }),
    );
  }

  item.append(
    el("button", {
      class: isBasicRow ? "map-tree-more" : "map-tree-action map-context-trigger",
      text: isBasicRow ? "⋯" : undefined,
      attrs: {
        type: "button",
        title: "맵 메뉴",
        "aria-haspopup": "menu",
        "aria-label": `${actionContext.mapName} 메뉴`,
      },
      dataset: { testid: isBasicRow ? `map-more-${node.mapId}` : `map-context-trigger-${node.mapId}` },
      children: isBasicRow ? undefined : [el("span", { class: "rm-tool-icon oprn-icon-map-menu", attrs: { "aria-hidden": "true" } })],
      on: {
        click: (event) => {
          event.stopPropagation();
          if (!(event instanceof MouseEvent)) return;
          openMapActions(actionContext, { x: event.clientX, y: event.clientY });
        },
      },
    }),
  );

  host.append(item);

  if (!isCollapsed) {
    const group = el("div", { attrs: { role: "group" } });
    for (const child of node.children) {
      renderNode({ context, depth: depth + 1, host: group, node: child });
    }
    if (group.childNodes.length > 0) host.append(group);
  }
}

function handleRowKeydown(
  event: Event,
  actionContext: MapActionContext,
  item: HTMLElement,
  hasChildren: boolean,
  isCollapsed: boolean,
): void {
  if (!(event instanceof KeyboardEvent) || event.target !== event.currentTarget) return;
  const key = event.key;
  if (key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (!actionContext.isFolder) void playMapFromTree(actionContext.mapId);
    return;
  }
  if (key === "Enter" || key === " ") {
    event.preventDefault();
    applyTreeSelection(actionContext.mapId, event, actionContext.isFolder);
    return;
  }
  if (key === "F2") {
    event.preventDefault();
    beginRename(actionContext.mapId);
    return;
  }
  if (key === "Delete") {
    event.preventDefault();
    deleteSelectionOrRow(actionContext);
    return;
  }
  if (key === "ContextMenu" || (event.shiftKey && key === "F10")) {
    event.preventDefault();
    openMapActions(actionContext, pointBelow(item));
    return;
  }
  if (key === "ArrowRight") {
    event.preventDefault();
    if (hasChildren && isCollapsed) {
      collapsedMapIds.delete(actionContext.mapId);
      persistCollapsed();
      rerenderMapList();
      focusMapRow(actionContext.mapId);
      return;
    }
    focusRelativeRow(actionContext.mapId, 1);
    return;
  }
  if (key === "ArrowLeft") {
    event.preventDefault();
    if (hasChildren && !isCollapsed) {
      collapsedMapIds.add(actionContext.mapId);
      persistCollapsed();
      rerenderMapList();
      focusMapRow(actionContext.mapId);
      return;
    }
    const parentId = findParentMapId(store.getCurrent().mapTree, actionContext.mapId);
    if (parentId) focusMapRow(parentId);
    return;
  }
  if (key === "ArrowDown") {
    event.preventDefault();
    focusRelativeRow(actionContext.mapId, 1);
    return;
  }
  if (key === "ArrowUp") {
    event.preventDefault();
    focusRelativeRow(actionContext.mapId, -1);
    return;
  }
  if (key === "Home") {
    event.preventDefault();
    visibleRowIds()[0] && focusMapRow(visibleRowIds()[0]!);
    return;
  }
  if (key === "End") {
    event.preventDefault();
    const ids = visibleRowIds();
    const last = ids[ids.length - 1];
    if (last) focusMapRow(last);
  }
}

function visibleRowIds(): MapId[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='map-tree-node-']"))
    .map((node) => node.dataset.testid?.replace("map-tree-node-", "") ?? "")
    .filter(Boolean);
}

function focusRelativeRow(mapId: MapId, delta: number): void {
  const ids = visibleRowIds();
  const index = ids.indexOf(mapId);
  const next = ids[index + delta];
  if (next) {
    selectEditorMap(next);
    globalThis.setTimeout?.(() => focusMapRow(next), 0);
  }
}

function dropRelationFor(event: DragEvent, item: HTMLElement, isRoot: boolean): MapTreeDropRelation {
  const rect = item.getBoundingClientRect();
  return mapTreeDropRelation(event.clientY - rect.top, rect.height, isRoot);
}

function canDropRelation(root: MapTreeNode, sourceId: MapId, targetId: MapId, relation: MapTreeDropRelation): boolean {
  if (relation === "child") return canReparentMap(root, sourceId, targetId);
  const parentId = findParentMapId(root, targetId);
  if (parentId === null) return false;
  return canReparentMap(root, sourceId, parentId === root.mapId ? "" : parentId);
}

function applyDrop(root: MapTreeNode, sourceIds: readonly MapId[], targetId: MapId, relation: MapTreeDropRelation): void {
  const ids = selectionRoots(root, sourceIds);
  if (relation === "child") {
    moveMapsInTree(ids, targetId);
    return;
  }
  const parentId = findParentMapId(root, targetId);
  if (parentId === null) return;
  const insertParent = parentId === root.mapId ? "" : parentId;
  const targetIndex = siblingIndex(root, targetId);
  const index = relation === "before" ? targetIndex : targetIndex + 1;
  moveMapsInTree(ids, insertParent, index);
}

function markDropTarget(item: HTMLElement, relation: MapTreeDropRelation): void {
  item.classList.remove("drop-before", "drop-after", "drop-child");
  item.classList.add("drop-target", `drop-${relation}`);
}

function dragHandle(mapId: MapId, row: HTMLElement, enabled: boolean): HTMLElement {
  return el("span", {
    class: "map-tree-drag-handle" + (enabled ? "" : " is-disabled"),
    attrs: {
      "aria-hidden": enabled ? "false" : "true",
      "aria-label": enabled ? "끌어 앞·뒤·하위로 옮기기" : "루트 맵은 옮길 수 없습니다",
      draggable: enabled ? "true" : "false",
      title: enabled ? "끌어 앞·뒤·하위로 옮기기" : "루트 맵은 옮길 수 없습니다",
    },
    dataset: { testid: `map-drag-${mapId}` },
    on: {
      click: (event) => event.stopPropagation(),
      dragstart: (event) => {
        if (!enabled) {
          event.preventDefault();
          return;
        }
        const dragEvent = event as DragEvent;
        if (!dragEvent.dataTransfer) return;
        draggingMapId = mapId;
        draggingMapIds = selectedMapIds.has(mapId) && selectedMapIds.size > 1
          ? selectionRoots(store.getCurrent().mapTree, [...selectedMapIds])
          : [mapId];
        dragEvent.dataTransfer.effectAllowed = "move";
        dragEvent.dataTransfer.setData("text/plain", mapId);
        row.classList.add("dragging");
      },
      dragend: () => {
        draggingMapId = null;
        draggingMapIds = [];
        row.classList.remove("dragging");
        clearDropTargets();
      },
    },
  });
}

function treeToggle(mapId: MapId, hasChildren: boolean, isCollapsed: boolean): HTMLButtonElement {
  return el("button", {
    class: "map-tree-toggle",
    attrs: {
      "aria-expanded": hasChildren ? String(!isCollapsed) : "false",
      "aria-label": hasChildren ? (isCollapsed ? "하위 맵 펼치기" : "하위 맵 접기") : "하위 맵 없음",
      "aria-hidden": hasChildren ? "false" : "true",
      tabindex: hasChildren ? "0" : "-1",
      title: hasChildren ? (isCollapsed ? "펼치기" : "접기") : "",
    },
    children: [
      el("span", {
        class: `rm-tool-icon oprn-icon-tree-${isCollapsed ? "closed" : "open"}`,
        attrs: { "aria-hidden": "true" },
      }),
    ],
    dataset: { testid: `map-toggle-${mapId}` },
    on: {
      click: (event) => {
        event.stopPropagation();
        if (!hasChildren) return;
        if (collapsedMapIds.has(mapId)) collapsedMapIds.delete(mapId);
        else collapsedMapIds.add(mapId);
        persistCollapsed();
        rerenderMapList();
      },
    },
  }) as HTMLButtonElement;
}

function makeMapTreeHeaderActions(root: MapTreeNode, mapCount: number): HTMLElement {
  const allCollapsed = areAllBranchesCollapsed(root);
  return el("div", {
    class: "map-tree-header-actions",
    children: [
      ...(canToggleMapFilter(mapCount) ? [treeAction({
        action: () => toggleMapFilterExpansion(),
        ariaExpanded: isFilterExpanded(mapCount),
        icon: "map-search",
        label: "맵 필터",
        testId: "map-tree-filter-toggle",
      })] : []),
      treeAction({
        action: () => {
          const id = addMapFolder("", "새 분류");
          selectedMapIds.clear();
          selectedMapIds.add(id);
          lastClickedMapId = id;
          rerenderMapList();
          beginRename(id);
        },
        icon: "map-folder",
        label: "분류 추가",
        testId: "map-add-folder",
      }),
      treeAction({
        // 이미 시작 맵일 때 setStartMap 은 무효토산이고 토스트도 없어서 「눌러도 아무 일 없는
        // 버튼」이었다(실측 감사에서 dead). 행 컨텍스트 메뉴는 그 경우 항목 자체를 숨기므로
        // 헤더 버튼만 일관성이 없었다 — 어느 쪽이든 결과를 말해 준다.
        action: () => {
          const mapId = editorState.get().currentMapId ?? store.getCurrent().startMapId;
          if (store.getCurrent().startMapId === mapId) {
            toast("이미 시작 맵입니다", "ok");
            return;
          }
          setStartMap(mapId);
          toast(`'${store.getCurrent().maps[mapId]?.name ?? mapId}'을 시작 맵으로 지정했습니다`, "ok");
        },
        icon: "map-start",
        label: "현재 맵을 시작 맵으로",
        testId: "map-set-start",
      }),
      treeAction({
        action: () => {
          if (allCollapsed) expandAllMapTree(root);
          else collapseAllMapTree(root);
          persistCollapsed();
          rerenderMapList();
        },
        icon: allCollapsed ? "tree-open" : "tree-closed",
        label: allCollapsed ? "전체 펼치기" : "전체 접기",
        testId: "map-toggle-all",
      }),
      // 헤더의 주 동작 하나만 글자를 달고 맨 오른쪽에 둔다 — 아이콘 다섯 개가 같은 무게로
      // 늘어서면 무엇을 눌러 맵을 만드는지 읽어내야 했다. 좁은 패널(컨테이너 쿼리 220px 이하)
      // 에서는 글자만 숨고 아이콘은 남는다.
      treeAction({
        action: () => openMapCreateDialog({ preset: "blank" }),
        icon: "map-child",
        label: "루트에 맵 추가",
        primary: true,
        testId: "map-add",
        text: "새 맵",
      }),
    ],
  });
}

function beginRename(mapId: MapId): void {
  renamingMapId = mapId;
  rerenderMapList();
  const input = currentMapListContainer?.querySelector<HTMLInputElement>(`[data-testid="map-rename-${mapId}"]`);
  input?.focus();
  input?.select();
}

function renameField(mapId: MapId, currentName: string): HTMLInputElement {
  const commit = (value: string): void => {
    const next = value.trim();
    renamingMapId = null;
    if (next && next !== currentName) renameMap(mapId, next);
    rerenderMapList();
    focusMapRow(mapId);
  };
  return el("input", {
    class: "map-tree-rename",
    attrs: { type: "text", "aria-label": "맵 이름" },
    value: currentName,
    dataset: { testid: `map-rename-${mapId}` },
    on: {
      click: (event) => event.stopPropagation(),
      keydown: (event) => {
        if (!(event instanceof KeyboardEvent)) return;
        if (event.key === "Enter") {
          event.preventDefault();
          commit((event.target as HTMLInputElement).value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          renamingMapId = null;
          rerenderMapList();
          focusMapRow(mapId);
        }
      },
      blur: (event) => commit((event.target as HTMLInputElement).value),
    },
  }) as HTMLInputElement;
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

function expandMatchingAncestors(root: MapTreeNode, query: string): void {
  const maps = store.getCurrent().maps;
  const walk = (node: MapTreeNode, path: MapId[]): void => {
    const nextPath = [...path, node.mapId];
    if (nameMatches(maps[node.mapId]?.name ?? "", node.mapId, query)) {
      for (const ancestor of path) collapsedMapIds.delete(ancestor);
    }
    for (const child of node.children) walk(child, nextPath);
  };
  walk(root, []);
}

function visibleMapIds(
  root: MapTreeNode,
  query: string,
  facet: MapFilterFacet,
): Set<MapId> {
  const project = store.getCurrent();
  const trimmed = query.trim();
  const matched = new Set<MapId>();
  const walk = (node: MapTreeNode, path: MapId[]): boolean => {
    const map = project.maps[node.mapId];
    const label = mapTreeNodeLabel(node, project.maps);
    const textHit = !trimmed || nameMatches(label, node.mapId, trimmed);
    const facetHit = facet === "all" || (map ? mapMatchesFacet(map, node.mapId, facet) : false);
    const self = textHit && facetHit;
    let childHit = false;
    for (const child of node.children) {
      if (walk(child, [...path, node.mapId])) childHit = true;
    }
    if (self || childHit) {
      matched.add(node.mapId);
      for (const ancestor of path) matched.add(ancestor);
      return true;
    }
    return false;
  };
  walk(root, []);
  return matched;
}

function mapMatchesFacet(map: { events: { length: number }; encounterRate?: number; troopIds?: readonly string[]; encounterTable?: readonly unknown[] }, mapId: MapId, facet: MapFilterFacet): boolean {
  if (facet === "empty") return map.events.length === 0;
  if (facet === "nolink") return collectMapLinkStats(store.getCurrent(), mapId).playLinkCount === 0;
  if (facet === "encounter") {
    return (map.encounterRate ?? 0) > 0 || (map.troopIds?.length ?? 0) > 0 || (map.encounterTable?.length ?? 0) > 0;
  }
  return true;
}

function nameMatches(name: string, mapId: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return name.toLowerCase().includes(q) || mapId.toLowerCase().includes(q);
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
  if (currentMapListContainer) {
    renderMapList(currentMapListContainer, { variant: currentMapListVariant });
  }
}

function duplicateAndSelect(mapId: MapId): void {
  const id = duplicateMap(mapId);
  if (!id) return;
  selectEditorMap(id);
}

function deleteAndSelectNext(mapId: MapId): void {
  const project = store.getCurrent();
  if (Object.keys(project.maps).length <= 1) return;
  const nextId = nextMapAfterRemoval(project.mapTree, mapId, project.startMapId);
  void confirmAndDeleteMap(mapId).then((result) => {
    if (!result.ok) return;
    const next = store.getCurrent();
    const pick = next.maps[nextId] ? nextId : next.startMapId;
    selectEditorMap(pick);
  });
}

function deleteRecursiveAndSelectNext(mapId: MapId): void {
  const project = store.getCurrent();
  if (Object.keys(project.maps).length <= 1) return;
  const nextId = nextMapAfterRemoval(project.mapTree, mapId, project.startMapId);
  void confirmAndDeleteMapRecursive(mapId).then((result) => {
    if (!result.ok) return;
    const next = store.getCurrent();
    const pick = next.maps[nextId] ? nextId : next.startMapId;
    selectEditorMap(pick);
  });
}

function openMapProperties(mapId: MapId, mapName: string): void {
  openMapPropertiesDialog(mapId, mapName);
}

function openMapActions(context: MapActionContext, point: MapContextMenuPoint): void {
  if (!context.isFolder) selectEditorMap(context.mapId);
  if (!selectedMapIds.has(context.mapId) || selectedMapIds.size <= 1) {
    selectedMapIds.clear();
    selectedMapIds.add(context.mapId);
    lastClickedMapId = context.mapId;
  }
  globalThis.setTimeout?.(() => focusMapRow(context.mapId), 0);
  openMapContextMenu({
    items: mapContextMenuItems(context),
    mapId: context.mapId,
    mapName: context.mapName,
    point,
  });
}

function mapContextMenuItems(context: MapActionContext): readonly MapContextMenuItem[] {
  const tree = store.getCurrent().mapTree;
  const parentId = findParentMapId(tree, context.mapId);
  const canSendToRoot = parentId !== null && parentId !== tree.mapId;
  const multiMaps = [...selectedMapIds].filter((id) => store.getCurrent().maps[id]);
  const items: MapContextMenuItem[] = [];
  if (!context.isFolder) {
    items.push({
      action: () => void playMapFromTree(context.mapId),
      icon: "map-start",
      id: "test-play",
      label: "여기서 시연 실행",
      shortcut: "Ctrl+Enter",
      testId: `map-menu-test-play-${context.mapId}`,
    });
    items.push({
      action: () => openMapProperties(context.mapId, context.mapName),
      icon: "map-settings",
      id: "settings",
      label: "맵 설정",
      testId: `map-settings-${context.mapId}`,
    });
  }
  items.push({
    action: () => beginRename(context.mapId),
    icon: "map-settings",
    id: "rename",
    label: "이름 바꾸기",
    shortcut: "F2",
    testId: `map-menu-rename-${context.mapId}`,
  });
  items.push({
    action: () => openMapCreateUnder(context.mapId),
    icon: "map-child",
    id: "add-child",
    label: "하위 맵 추가",
    separatorBefore: true,
    testId: `map-menu-add-child-${context.mapId}`,
  });
  items.push({
    action: () => {
      const id = addMapFolder(context.mapId, "새 분류");
      selectedMapIds.clear();
      selectedMapIds.add(id);
      lastClickedMapId = id;
      rerenderMapList();
      beginRename(id);
    },
    icon: "folder",
    id: "add-folder",
    label: "하위 분류 추가",
    testId: `map-menu-add-folder-${context.mapId}`,
  });
  if (!context.isFolder) {
    items.push({
      action: () => duplicateAndSelect(context.mapId),
      icon: "copy",
      id: "duplicate",
      label: "복제",
      testId: `map-duplicate-${context.mapId}`,
    });
    items.push({
      action: () => setStartMap(context.mapId),
      icon: "map-start",
      id: "set-start",
      label: "시작 맵으로 지정",
      testId: `map-set-start-${context.mapId}`,
    });
  }
  items.push({
    action: () => moveMapInTree(context.mapId, ""),
    disabled: !canSendToRoot,
    icon: "folder",
    id: "to-root",
    label: "루트로 보내기",
    testId: `map-menu-to-root-${context.mapId}`,
  });
  if (!context.isFolder) {
    items.push({
      action: () => {
        if (!parentId) return;
        if (addParentChildTransfers(parentId, context.mapId)) {
          rerenderMapList();
        }
      },
      disabled: parentId === null || (() => {
        const parentNode = findTreeNode(tree, parentId);
        return !parentNode || isMapTreeFolder(parentNode);
      })(),
      icon: "map-shift",
      id: "link-parent",
      label: "부모와 왕복 이동 넣기",
      testId: `map-menu-link-parent-${context.mapId}`,
    });
  }
  if (multiMaps.length > 1 && multiMaps.includes(context.mapId)) {
    items.push({
      action: () => void deleteSelectedMaps(multiMaps),
      disabled: Object.keys(store.getCurrent().maps).length <= multiMaps.length,
      icon: "trash",
      id: "delete-selected",
      label: `선택 ${multiMaps.length}개 삭제`,
      separatorBefore: true,
      shortcut: "Del",
      testId: `map-menu-delete-selected`,
    });
  } else if (context.isFolder) {
    items.push({
      action: () => void dissolveFolderAndRefresh(context.mapId),
      icon: "trash",
      id: "delete",
      label: "분류 삭제(하위 유지)",
      separatorBefore: true,
      shortcut: "Del",
      testId: `map-menu-delete-${context.mapId}`,
    });
  } else {
    items.push({
      action: () => deleteAndSelectNext(context.mapId),
      disabled: !context.canDelete,
      icon: "trash",
      id: "delete",
      label: "삭제",
      separatorBefore: true,
      shortcut: "Del",
      testId: `map-menu-delete-${context.mapId}`,
    });
    items.push({
      action: () => deleteRecursiveAndSelectNext(context.mapId),
      disabled: !context.canDelete,
      icon: "trash",
      id: "delete-recursive",
      label: "하위 포함 삭제",
      testId: `map-menu-delete-recursive-${context.mapId}`,
    });
    items.push({
      action: () => openMapShiftDialog(context.mapId, context.mapName),
      icon: "map-shift",
      id: "shift",
      label: "맵 밀기",
      separatorBefore: true,
      testId: `map-shift-${context.mapId}`,
    });
  }
  return items;
}

function pointBelow(node: HTMLElement): MapContextMenuPoint {
  const rect = node.getBoundingClientRect();
  return { x: rect.left + Math.max(0, Math.min(28, rect.width - 4)), y: rect.bottom };
}

function focusMapRow(mapId: MapId): void {
  document.querySelector<HTMLElement>(`[data-testid="map-tree-node-${mapId}"]`)?.focus();
}

function clearDropTargets(): void {
  document.querySelectorAll(".map-item.drop-target").forEach((node) => {
    node.classList.remove("drop-target", "drop-before", "drop-after", "drop-child");
  });
}

function treeAction(spec: TreeActionSpec): HTMLButtonElement {
  const button = el("button", {
    class: "map-tree-action" + (spec.primary ? " is-primary" : "") + (spec.text ? " has-text" : ""),
    attrs: {
      title: spec.label,
      "aria-label": spec.label,
      type: "button",
      ...(spec.ariaExpanded !== undefined ? { "aria-expanded": String(spec.ariaExpanded) } : {}),
    },
    children: [
      el("span", { class: `rm-tool-icon oprn-icon-${spec.icon}`, attrs: { "aria-hidden": "true" } }),
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

function loadCollapsedMapIds(): Set<MapId> {
  try {
    const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function persistCollapsed(): void {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify([...collapsedMapIds]));
  } catch {
    /* ignore quota / private mode */
  }
}

function modifierFlag(event: Event, key: "shiftKey" | "ctrlKey" | "metaKey"): boolean {
  return Boolean((event as { [flag in typeof key]?: boolean })[key]);
}

function applyTreeSelection(mapId: MapId, event: Event, isFolder: boolean): void {
  const ids = visibleRowIds();
  const shift = modifierFlag(event, "shiftKey");
  const chord = modifierFlag(event, "ctrlKey") || modifierFlag(event, "metaKey");
  if (shift && lastClickedMapId) {
    const a = ids.indexOf(lastClickedMapId);
    const b = ids.indexOf(mapId);
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      selectedMapIds.clear();
      for (const id of ids.slice(lo, hi + 1)) selectedMapIds.add(id);
    }
  } else if (chord) {
    if (selectedMapIds.has(mapId)) selectedMapIds.delete(mapId);
    else selectedMapIds.add(mapId);
    lastClickedMapId = mapId;
  } else {
    selectedMapIds.clear();
    selectedMapIds.add(mapId);
    lastClickedMapId = mapId;
  }
  if (!isFolder) selectEditorMap(mapId);
  rerenderMapList();
  focusMapRow(mapId);
}

function playMapFromTree(mapId: MapId): Promise<void> {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return Promise.resolve();
  selectEditorMap(mapId);
  const cell = bestTestStartCell(project, map);
  return openTestPlayModal({ mapId, x: cell.x, y: cell.y });
}

function deleteSelectionOrRow(context: MapActionContext): void {
  const multiMaps = [...selectedMapIds].filter((id) => store.getCurrent().maps[id]);
  if (multiMaps.length > 1) {
    void deleteSelectedMaps(multiMaps);
    return;
  }
  if (context.isFolder) {
    void dissolveFolderAndRefresh(context.mapId);
    return;
  }
  deleteAndSelectNext(context.mapId);
}

async function deleteSelectedMaps(mapIds: readonly MapId[]): Promise<void> {
  const result = await confirmAndDeleteMaps(mapIds);
  if (!result.ok) return;
  selectedMapIds.clear();
  const next = store.getCurrent();
  selectEditorMap(next.startMapId);
  rerenderMapList();
}

async function dissolveFolderAndRefresh(folderId: MapId): Promise<void> {
  const result = await confirmAndDissolveFolder(folderId);
  if (!result.ok) return;
  selectedMapIds.delete(folderId);
  rerenderMapList();
}

function beginTreeBoxSelect(event: Event, tree: HTMLElement): void {
  if (!(event instanceof PointerEvent) || event.button !== 0) return;
  if (!(event.target instanceof Element) || event.target.closest(".map-item, button, input")) return;
  event.preventDefault();
  const origin = { x: event.clientX, y: event.clientY };
  const box = el("div", { class: "map-tree-marquee", dataset: { testid: "map-tree-marquee" } });
  document.body.append(box);
  const onMove = (move: PointerEvent): void => {
    const left = Math.min(origin.x, move.clientX);
    const top = Math.min(origin.y, move.clientY);
    const width = Math.abs(move.clientX - origin.x);
    const height = Math.abs(move.clientY - origin.y);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
    const rect = box.getBoundingClientRect();
    selectedMapIds.clear();
    for (const row of tree.querySelectorAll<HTMLElement>("[data-testid^='map-tree-node-']")) {
      const rowRect = row.getBoundingClientRect();
      const hit = rowRect.right >= rect.left && rowRect.left <= rect.right && rowRect.bottom >= rect.top && rowRect.top <= rect.bottom;
      const id = row.dataset.testid?.replace("map-tree-node-", "");
      if (hit && id) selectedMapIds.add(id);
    }
    for (const row of tree.querySelectorAll<HTMLElement>(".map-item")) {
      const id = row.dataset.testid?.replace("map-tree-node-", "");
      row.classList.toggle("is-multi-selected", Boolean(id && selectedMapIds.has(id)));
    }
  };
  const onUp = (): void => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    box.remove();
    lastClickedMapId = [...selectedMapIds][0] ?? lastClickedMapId;
  };
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerup", onUp);
}

export function resetMapListUiStateForTests(): void {
  mapFilterQuery = "";
  mapFilterFacet = "all";
  filterExpandedByUser = false;
  lastExpandedMapId = null;
  draggingMapId = null;
  draggingMapIds = [];
  renamingMapId = null;
  selectedMapIds.clear();
  lastClickedMapId = null;
  collapsedMapIds.clear();
}
