// editor/panels/worldBoardModal.ts
// Phase 4 & 5 (B × C 하이브리드 · 3-B):
// M 키 월드 보드 — 프로젝트 전체 맵을 연결 그래프 + 실제 썸네일 카드로 조망하고:
// 1) 카드 클릭 1회로 즉시 맵 이동
// 2) 카드를 드래그해 내 세계지도 구도대로 자유 배치·저장 (+ 자동 정렬 복원)
// 3) 카드 가장자리(북·남·서·동) 포트를 다른 맵으로 끌어 놓으면 플로팅 AI 조수에 자연 길·양방향 문 시공 지시 전달

import { addMap } from "@/editor/actions";
import { openAiAssistantPanel } from "@/editor/aiAssistantBridge";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { resolveCurrentMapId, selectEditorMap } from "@/editor/mapSelection";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import { hasOpenModalLayer, isTopModal, registerModal } from "@/editor/ui/modalStack";
import { collectMapLinkGraph, type MapLinkNode } from "@/project/mapLinkStats";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export const WORLD_BOARD_TOGGLE_EVENT = "oprn:world-board-toggle";

const CARD_W = 220;
const CARD_H = 196;
const COL_GAP = 86;
const ROW_GAP = 42;
const BOARD_PAD = 36;
const SVG_NS = "http://www.w3.org/2000/svg";

type CardPos = { readonly x: number; readonly y: number; readonly depth: number };
type PortDir = "north" | "south" | "west" | "east";

const PORT_LABEL: Record<PortDir, string> = {
  north: "북쪽",
  south: "남쪽",
  west: "서쪽",
  east: "동쪽",
};

const OPPOSITE_PORT: Record<PortDir, PortDir> = {
  north: "south",
  south: "north",
  west: "east",
  east: "west",
};

let activeClose: (() => void) | null = null;

export function toggleWorldBoard(): void {
  if (activeClose) {
    activeClose();
    return;
  }
  openWorldBoardModal();
}

function layoutStorageKey(project: Project): string {
  const key = project.startMapId || Object.keys(project.maps)[0] || "default";
  return `oprn:world-board-layout:${key}`;
}

function loadCustomPositions(project: Project): Map<MapId, { x: number; y: number }> {
  const out = new Map<MapId, { x: number; y: number }>();
  try {
    const raw = localStorage.getItem(layoutStorageKey(project));
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Record<string, { x?: unknown; y?: unknown }>;
    for (const [id, v] of Object.entries(parsed)) {
      if (v && typeof v.x === "number" && typeof v.y === "number") {
        out.set(id, { x: Math.max(12, Math.round(v.x)), y: Math.max(12, Math.round(v.y)) });
      }
    }
  } catch { /* ignore */ }
  return out;
}

function saveCustomPositions(project: Project, map: ReadonlyMap<MapId, { x: number; y: number }>): void {
  try {
    const obj: Record<string, { x: number; y: number }> = {};
    for (const [id, pos] of map.entries()) obj[id] = pos;
    localStorage.setItem(layoutStorageKey(project), JSON.stringify(obj));
  } catch { /* ignore */ }
}

function clearCustomPositions(project: Project): void {
  try { localStorage.removeItem(layoutStorageKey(project)); } catch { /* ignore */ }
}

function computeGraphLayout(
  project: Project,
  nodes: readonly MapLinkNode[],
  custom: ReadonlyMap<MapId, { x: number; y: number }>,
): { readonly positions: Map<MapId, CardPos>; readonly width: number; readonly height: number } {
  const byId = new Map(nodes.map((n) => [n.mapId, n]));
  const depths = new Map<MapId, number>();
  const startId = project.startMapId && byId.has(project.startMapId)
    ? project.startMapId
    : nodes[0]?.mapId;

  if (startId) {
    const queue: MapId[] = [startId];
    depths.set(startId, 0);
    for (let i = 0; i < queue.length; i += 1) {
      const id = queue[i]!;
      const d = depths.get(id)!;
      const node = byId.get(id);
      if (!node) continue;
      const neighbors = new Set<MapId>([
        ...node.outgoing.map((e) => e.to),
        ...node.incoming.map((e) => e.from),
      ]);
      for (const next of neighbors) {
        if (!depths.has(next) && byId.has(next)) {
          depths.set(next, d + 1);
          queue.push(next);
        }
      }
    }
  }

  const columns = new Map<number, MapId[]>();
  const isolated: MapId[] = [];
  for (const node of nodes) {
    const d = depths.get(node.mapId);
    if (d === undefined) {
      isolated.push(node.mapId);
    } else {
      const list = columns.get(d) ?? [];
      list.push(node.mapId);
      columns.set(d, list);
    }
  }

  const positions = new Map<MapId, CardPos>();
  const sortedDepths = [...columns.keys()].sort((a, b) => a - b);
  let maxRows = 1;
  for (const d of sortedDepths) {
    maxRows = Math.max(maxRows, columns.get(d)!.length);
  }

  const mainHeight = maxRows * CARD_H + Math.max(0, maxRows - 1) * ROW_GAP;

  for (const [colIndex, d] of sortedDepths.entries()) {
    const list = columns.get(d)!;
    const colH = list.length * CARD_H + Math.max(0, list.length - 1) * ROW_GAP;
    const startY = BOARD_PAD + Math.round((mainHeight - colH) / 2);
    const x = BOARD_PAD + colIndex * (CARD_W + COL_GAP);
    list.forEach((mapId, rowIndex) => {
      const saved = custom.get(mapId);
      positions.set(mapId, {
        x: saved ? saved.x : x,
        y: saved ? saved.y : startY + rowIndex * (CARD_H + ROW_GAP),
        depth: d,
      });
    });
  }

  if (isolated.length > 0) {
    const isoCols = Math.max(Math.max(1, sortedDepths.length), Math.min(4, isolated.length));
    const isoStartY = sortedDepths.length > 0 ? BOARD_PAD + mainHeight + ROW_GAP + 24 : BOARD_PAD;
    isolated.forEach((mapId, idx) => {
      const col = idx % isoCols;
      const row = Math.floor(idx / isoCols);
      const saved = custom.get(mapId);
      positions.set(mapId, {
        x: saved ? saved.x : BOARD_PAD + col * (CARD_W + COL_GAP),
        y: saved ? saved.y : isoStartY + row * (CARD_H + ROW_GAP),
        depth: -1,
      });
    });
  }

  let maxRight = 640;
  let maxBottom = 420;
  for (const pos of positions.values()) {
    maxRight = Math.max(maxRight, pos.x + CARD_W + BOARD_PAD * 2);
    maxBottom = Math.max(maxBottom, pos.y + CARD_H + BOARD_PAD * 2);
  }
  return { positions, width: maxRight, height: maxBottom };
}

type PairEdge = {
  readonly from: MapId;
  readonly to: MapId;
  readonly bidirectional: boolean;
  readonly count: number;
};

function aggregatePairEdges(nodes: readonly MapLinkNode[]): readonly PairEdge[] {
  const directed = new Map<string, number>();
  for (const node of nodes) {
    for (const edge of node.outgoing) {
      if (edge.from === edge.to) continue;
      const key = `${edge.from}=>${edge.to}`;
      directed.set(key, (directed.get(key) ?? 0) + 1);
    }
  }
  const seen = new Set<string>();
  const result: PairEdge[] = [];
  for (const [key, count] of directed.entries()) {
    const [from, to] = key.split("=>") as [MapId, MapId];
    const reverseKey = `${to}=>${from}`;
    const pairId = from < to ? `${from}|${to}` : `${to}|${from}`;
    if (seen.has(pairId)) continue;
    seen.add(pairId);
    const reverseCount = directed.get(reverseKey) ?? 0;
    result.push({
      from,
      to,
      bidirectional: reverseCount > 0,
      count: count + reverseCount,
    });
  }
  return result;
}

function portAnchor(pos: CardPos, dir: PortDir): { readonly x: number; readonly y: number } {
  if (dir === "north") return { x: pos.x + CARD_W / 2, y: pos.y };
  if (dir === "south") return { x: pos.x + CARD_W / 2, y: pos.y + CARD_H };
  if (dir === "west") return { x: pos.x, y: pos.y + CARD_H / 2 };
  return { x: pos.x + CARD_W, y: pos.y + CARD_H / 2 };
}

type DraftWire = {
  readonly fromMapId: MapId;
  readonly fromDir: PortDir;
  readonly toX: number;
  readonly toY: number;
  readonly targetMapId: MapId | null;
  readonly targetDir: PortDir | null;
};

function buildConnectorSvg(
  edges: readonly PairEdge[],
  positions: ReadonlyMap<MapId, CardPos>,
  width: number,
  height: number,
  highlightMapId: MapId | null,
  draftWire: DraftWire | null,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "wb-svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const defs = document.createElementNS(SVG_NS, "defs");
  const makeMarker = (id: string, cls: string): void => {
    const m = document.createElementNS(SVG_NS, "marker");
    m.setAttribute("id", id);
    m.setAttribute("viewBox", "0 0 10 10");
    m.setAttribute("refX", "8");
    m.setAttribute("refY", "5");
    m.setAttribute("markerWidth", "6");
    m.setAttribute("markerHeight", "6");
    m.setAttribute("orient", "auto-start-reverse");
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", "M 1 2 L 9 5 L 1 8 z");
    p.setAttribute("class", cls);
    m.append(p);
    defs.append(m);
  };
  makeMarker("wb-arrow-accent", "wb-arrow-fill is-accent");
  makeMarker("wb-arrow-muted", "wb-arrow-fill is-muted");
  svg.append(defs);

  for (const edge of edges) {
    const a = positions.get(edge.from);
    const b = positions.get(edge.to);
    if (!a || !b) continue;

    const dxCenter = b.x - a.x;
    const dyCenter = b.y - a.y;
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;
    let cx1: number;
    let cy1: number;
    let cx2: number;
    let cy2: number;

    if (Math.abs(dyCenter) > Math.abs(dxCenter) + 40) {
      // Vertical connection
      if (a.y < b.y) {
        x1 = a.x + CARD_W / 2; y1 = a.y + CARD_H;
        x2 = b.x + CARD_W / 2; y2 = b.y;
        const dy = Math.max(36, Math.abs(y2 - y1) * 0.45);
        cx1 = x1; cy1 = y1 + dy; cx2 = x2; cy2 = y2 - dy;
      } else {
        x1 = a.x + CARD_W / 2; y1 = a.y;
        x2 = b.x + CARD_W / 2; y2 = b.y + CARD_H;
        const dy = Math.max(36, Math.abs(y2 - y1) * 0.45);
        cx1 = x1; cy1 = y1 - dy; cx2 = x2; cy2 = y2 + dy;
      }
    } else if (a.x <= b.x) {
      x1 = a.x + CARD_W; y1 = a.y + CARD_H / 2;
      x2 = b.x; y2 = b.y + CARD_H / 2;
      const dx = Math.max(42, Math.abs(x2 - x1) * 0.45);
      cx1 = x1 + dx; cy1 = y1; cx2 = x2 - dx; cy2 = y2;
    } else {
      x1 = a.x; y1 = a.y + CARD_H / 2;
      x2 = b.x + CARD_W; y2 = b.y + CARD_H / 2;
      const dx = Math.max(42, Math.abs(x2 - x1) * 0.45);
      cx1 = x1 - dx; cy1 = y1; cx2 = x2 + dx; cy2 = y2;
    }

    const isHot = highlightMapId === edge.from || highlightMapId === edge.to;
    const accent = edge.bidirectional || isHot;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`);
    path.setAttribute("class", `wb-edge${accent ? " is-accent" : ""}${isHot ? " is-hot" : ""}`);
    path.setAttribute("marker-end", accent ? "url(#wb-arrow-accent)" : "url(#wb-arrow-muted)");
    if (edge.bidirectional) {
      path.setAttribute("marker-start", "url(#wb-arrow-accent)");
    }
    svg.append(path);

    const mx = 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2;
    const my = 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2;
    const labelText = edge.bidirectional ? (edge.count > 2 ? `↔ ${edge.count}` : "↔") : (edge.count > 1 ? `→ ${edge.count}` : "→");
    const pillW = Math.max(24, labelText.length * 8 + 10);
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", String(mx - pillW / 2));
    rect.setAttribute("y", String(my - 10));
    rect.setAttribute("width", String(pillW));
    rect.setAttribute("height", "20");
    rect.setAttribute("rx", "10");
    rect.setAttribute("class", `wb-edge-pill${accent ? " is-accent" : ""}`);
    svg.append(rect);

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", String(mx));
    text.setAttribute("y", String(my + 3.5));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", `wb-edge-text${accent ? " is-accent" : ""}`);
    text.textContent = labelText;
    svg.append(text);
  }

  // Live dragging wire preview
  if (draftWire) {
    const startPos = positions.get(draftWire.fromMapId);
    if (startPos) {
      const start = portAnchor(startPos, draftWire.fromDir);
      const endPos = draftWire.targetMapId ? positions.get(draftWire.targetMapId) : undefined;
      const end = endPos && draftWire.targetDir
        ? portAnchor(endPos, draftWire.targetDir)
        : { x: draftWire.toX, y: draftWire.toY };
      const dx = (end.x - start.x) * 0.45;
      const dy = (end.y - start.y) * 0.45;
      const c1x = draftWire.fromDir === "east" ? start.x + Math.max(40, Math.abs(dx))
        : draftWire.fromDir === "west" ? start.x - Math.max(40, Math.abs(dx)) : start.x;
      const c1y = draftWire.fromDir === "south" ? start.y + Math.max(40, Math.abs(dy))
        : draftWire.fromDir === "north" ? start.y - Math.max(40, Math.abs(dy)) : start.y;
      const wirePath = document.createElementNS(SVG_NS, "path");
      wirePath.setAttribute("d", `M ${start.x} ${start.y} Q ${c1x} ${c1y}, ${end.x} ${end.y}`);
      wirePath.setAttribute("class", "wb-draft-wire");
      wirePath.setAttribute("marker-end", "url(#wb-arrow-accent)");
      svg.append(wirePath);
    }
  }

  return svg;
}

function handoffWorldLinkToAi(
  fromName: string,
  fromDir: PortDir,
  toName: string,
  toDir: PortDir,
): void {
  openAiAssistantPanel();
  const prompt = `${fromName}(${PORT_LABEL[fromDir]})과 ${toName}(${PORT_LABEL[toDir]})을 주변 지형에 어울리게 길과 양방향 이동 이벤트(문)로 자연스럽게 이어 줘`;
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLTextAreaElement>(".ai-right-dock .ai-assistant-input");
    if (!input) return;
    input.value = prompt;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  });
}

export function openWorldBoardModal(): void {
  if (activeClose) {
    activeClose();
    return;
  }

  let searchQuery = "";
  let zoom = 1;
  let hoveredMapId: MapId | null = null;
  let customPositions = loadCustomPositions(store.getCurrent());
  let pendingConnection: {
    readonly fromMapId: MapId;
    readonly fromDir: PortDir;
    readonly toMapId: MapId;
    readonly toDir: PortDir;
  } | null = null;

  const summaryBadge = el("span", { class: "wb-summary", dataset: { testid: "world-board-summary" } });
  const searchInput = el("input", {
    class: "wb-search",
    attrs: { type: "search", placeholder: "맵 이름으로 찾기…", "aria-label": "월드 보드 맵 검색" },
    dataset: { testid: "world-board-search" },
  }) as HTMLInputElement;

  const zoomOptions = [0.75, 1, 1.25] as const;
  const zoomBtns = zoomOptions.map((z) =>
    el("button", {
      class: `wb-zoom-btn${z === zoom ? " is-active" : ""}`,
      attrs: { type: "button" },
      text: `${Math.round(z * 100)}%`,
      on: {
        click: () => {
          zoom = z;
          zoomBtns.forEach((b, i) => b.classList.toggle("is-active", zoomOptions[i] === zoom));
          boardInner.style.transform = `scale(${zoom})`;
        },
      },
    }) as HTMLButtonElement,
  );

  const autoLayoutBtn = el("button", {
    class: "wb-secondary-btn",
    attrs: { type: "button", title: "카드 배치를 기본 연결 그래프로 자동 정렬" },
    dataset: { testid: "world-board-auto-layout" },
    text: "자동 정렬",
    on: {
      click: () => {
        customPositions.clear();
        clearCustomPositions(store.getCurrent());
        renderBoard();
      },
    },
  });

  const newMapBtn = el("button", {
    class: "wb-primary-btn",
    attrs: { type: "button" },
    dataset: { testid: "world-board-new-map" },
    text: "+ 새 맵",
    on: {
      click: () => {
        const project = store.getCurrent();
        const curId = resolveCurrentMapId();
        const curMap = curId ? project.maps[curId] : undefined;
        const count = Object.keys(project.maps).length + 1;
        const id = addMap(`새 맵 ${count}`, curMap?.width ?? 24, curMap?.height ?? 18, curMap?.tilesetId);
        selectEditorMap(id);
        close();
      },
    },
  });

  const closeBtn = el("button", {
    class: "wb-close-btn",
    attrs: { type: "button", title: "닫기 (M / Esc)", "aria-label": "월드 보드 닫기" },
    dataset: { testid: "world-board-close" },
    text: "✕",
    on: { click: () => close() },
  });

  const header = el("header", {
    class: "wb-head",
    children: [
      el("div", {
        class: "wb-head-left",
        children: [
          el("h2", { class: "wb-title", text: "월드 보드" }),
          el("span", { class: "wb-kbd", text: "M" }),
          summaryBadge,
        ],
      }),
      el("div", {
        class: "wb-head-right",
        children: [
          searchInput,
          el("div", { class: "wb-zoom-group", children: zoomBtns }),
          autoLayoutBtn,
          newMapBtn,
          closeBtn,
        ],
      }),
    ],
  });

  const boardInner = el("div", { class: "wb-board-inner", dataset: { testid: "world-board-canvas" } });
  const wireConfirmBar = el("div", { class: "wb-wire-confirm", dataset: { testid: "wb-wire-confirm" } });
  wireConfirmBar.hidden = true;
  const stage = el("div", { class: "wb-stage", children: [boardInner, wireConfirmBar] });

  const footer = el("footer", {
    class: "wb-foot",
    children: [
      el("span", { text: "카드 클릭 = 이동 · 카드 드래그 = 자유 배치 · 가장자리 ● 포트 드래그 = AI 길·문 자연 연결" }),
      el("span", { class: "wb-foot-hint", text: "M 또는 Esc 로 닫기" }),
    ],
  });

  const dialog = el("section", {
    class: "wb-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": "월드 보드" },
    children: [header, stage, footer],
  });

  const backdrop = el("div", {
    class: "wb-backdrop",
    dataset: { testid: "world-board-modal" },
    children: [dialog],
  });

  let cachedThumbProject: Project | null = null;
  const thumbCache = new Map<MapId, HTMLElement>();

  let currentEdges: readonly PairEdge[] = [];
  let currentPositions = new Map<MapId, CardPos>();
  let currentWidth = 640;
  let currentHeight = 420;
  let activeDraftWire: DraftWire | null = null;

  const refreshSvgOnly = (): void => {
    const prevSvg = boardInner.querySelector(".wb-svg");
    prevSvg?.replaceWith(buildConnectorSvg(
      currentEdges,
      currentPositions,
      currentWidth,
      currentHeight,
      hoveredMapId,
      activeDraftWire,
    ));
  };

  const renderWireConfirm = (): void => {
    clearChildren(wireConfirmBar);
    if (!pendingConnection) {
      wireConfirmBar.hidden = true;
      return;
    }
    const project = store.getCurrent();
    const fromMap = project.maps[pendingConnection.fromMapId];
    const toMap = project.maps[pendingConnection.toMapId];
    if (!fromMap || !toMap) {
      pendingConnection = null;
      wireConfirmBar.hidden = true;
      return;
    }
    const { fromMapId, fromDir, toDir } = pendingConnection;
    const fromName = fromMap.name || fromMap.id;
    const toName = toMap.name || toMap.id;

    wireConfirmBar.hidden = false;
    wireConfirmBar.append(
      el("span", {
        class: "wb-wire-text",
        text: `${fromName} (${PORT_LABEL[fromDir]}) ↔ ${toName} (${PORT_LABEL[toDir]})`,
      }),
      el("button", {
        class: "wb-primary-btn",
        attrs: { type: "button" },
        dataset: { testid: "wb-wire-ai" },
        text: "✦ AI로 길·문 자연 연결",
        on: {
          click: () => {
            selectEditorMap(fromMapId);
            close();
            handoffWorldLinkToAi(fromName, fromDir, toName, toDir);
          },
        },
      }),
      el("button", {
        class: "wb-secondary-btn",
        attrs: { type: "button" },
        text: "취소",
        on: {
          click: () => {
            pendingConnection = null;
            activeDraftWire = null;
            renderWireConfirm();
            refreshSvgOnly();
          },
        },
      }),
    );
  };

  const renderBoard = (): void => {
    const project = store.getCurrent();
    const curMapId = resolveCurrentMapId();
    const nodes = collectMapLinkGraph(project);
    currentEdges = aggregatePairEdges(nodes);

    if (cachedThumbProject !== project) {
      thumbCache.clear();
      cachedThumbProject = project;
    }

    const isolatedCount = nodes.length > 1 ? nodes.filter((n) => !n.reachableFromStart).length : 0;
    summaryBadge.textContent = isolatedCount > 0
      ? `맵 ${nodes.length}개 · 연결 ${currentEdges.length}개 · 고립 ${isolatedCount}개`
      : `맵 ${nodes.length}개 · 연결 ${currentEdges.length}개`;

    const query = searchQuery.trim().toLowerCase();
    const layout = computeGraphLayout(project, nodes, customPositions);
    currentPositions = layout.positions;
    currentWidth = layout.width;
    currentHeight = layout.height;

    boardInner.style.width = `${currentWidth}px`;
    boardInner.style.height = `${currentHeight}px`;
    boardInner.style.transform = `scale(${zoom})`;
    clearChildren(boardInner);

    boardInner.append(buildConnectorSvg(
      currentEdges,
      currentPositions,
      currentWidth,
      currentHeight,
      hoveredMapId,
      activeDraftWire,
    ));

    for (const node of nodes) {
      const map = project.maps[node.mapId];
      const pos = currentPositions.get(node.mapId);
      if (!map || !pos) continue;

      const matches = !query || (map.name || map.id).toLowerCase().includes(query) || map.id.toLowerCase().includes(query);
      const isCurrent = map.id === curMapId;
      const isIsolated = nodes.length > 1 && !node.reachableFromStart;

      let thumbEl = thumbCache.get(map.id);
      if (!thumbEl) {
        thumbEl = createMapThumbnail(map.id, { width: 204, height: 114 });
        thumbCache.set(map.id, thumbEl);
      }

      const uniqueTargets: MapId[] = [];
      for (const edge of node.outgoing) {
        if (!uniqueTargets.includes(edge.to) && project.maps[edge.to]) uniqueTargets.push(edge.to);
      }

      const badges: HTMLElement[] = [];
      if (node.isStart) badges.push(el("span", { class: "wb-pill is-start", text: "★ 시작" }));
      if (isCurrent) badges.push(el("span", { class: "wb-pill is-current", text: "현재" }));
      if (isIsolated) badges.push(el("span", { class: "wb-pill is-warn", text: "고립" }));

      const settingsBtn = el("button", {
        class: "wb-card-settings",
        attrs: { type: "button", title: "맵 설정", "aria-label": `${map.name} 설정` },
        text: "⚙",
        on: {
          click: (ev) => {
            ev.stopPropagation();
            close();
            openMapPropertiesDialog(map.id, map.name);
          },
        },
      });

      const warpChips = uniqueTargets.slice(0, 2).map((targetId) => {
        const dest = project.maps[targetId]!;
        return el("button", {
          class: "wb-warp-chip",
          attrs: { type: "button", title: `${dest.name || dest.id}로 바로 이동` },
          text: `⇢ ${dest.name || dest.id}`,
          on: {
            click: (ev) => {
              ev.stopPropagation();
              selectEditorMap(dest.id);
              close();
            },
          },
        });
      });

      const ports = (["north", "south", "west", "east"] as const).map((dir) => {
        const portBtn = el("button", {
          class: `wb-port is-${dir}`,
          attrs: {
            type: "button",
            title: `${map.name} ${PORT_LABEL[dir]}에서 다른 맵으로 드래그해 AI 연결`,
            "aria-label": `${map.name} ${PORT_LABEL[dir]} 연결 포트`,
          },
          dataset: { testid: `wb-port-${map.id}-${dir}`, portMapId: map.id, portDir: dir },
        }) as HTMLButtonElement;

        portBtn.addEventListener("pointerdown", (ev: PointerEvent) => {
          if (ev.button !== 0) return;
          ev.stopPropagation();
          ev.preventDefault();
          pendingConnection = null;
          renderWireConfirm();

          const toBoardCoord = (clientX: number, clientY: number) => {
            const rect = boardInner.getBoundingClientRect();
            return {
              x: (clientX - rect.left) / zoom,
              y: (clientY - rect.top) / zoom,
            };
          };

          const startPt = toBoardCoord(ev.clientX, ev.clientY);
          activeDraftWire = {
            fromMapId: map.id,
            fromDir: dir,
            toX: startPt.x,
            toY: startPt.y,
            targetMapId: null,
            targetDir: null,
          };
          boardInner.classList.add("is-wiring");
          refreshSvgOnly();

          const onMove = (moveEv: PointerEvent): void => {
            const pt = toBoardCoord(moveEv.clientX, moveEv.clientY);
            const elAt = document.elementFromPoint(moveEv.clientX, moveEv.clientY);
            const hitPort = elAt?.closest<HTMLElement>("[data-port-map-id]");
            const hitCard = elAt?.closest<HTMLElement>(".wb-card[data-map-id]");
            let targetMapId: MapId | null = null;
            let targetDir: PortDir | null = null;
            if (hitPort && hitPort.dataset.portMapId && hitPort.dataset.portMapId !== map.id) {
              targetMapId = hitPort.dataset.portMapId;
              targetDir = (hitPort.dataset.portDir as PortDir) ?? OPPOSITE_PORT[dir];
            } else if (hitCard && hitCard.dataset.mapId && hitCard.dataset.mapId !== map.id) {
              targetMapId = hitCard.dataset.mapId;
              targetDir = OPPOSITE_PORT[dir];
            }
            activeDraftWire = {
              fromMapId: map.id,
              fromDir: dir,
              toX: pt.x,
              toY: pt.y,
              targetMapId,
              targetDir,
            };
            refreshSvgOnly();
          };

          const onUp = (): void => {
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            boardInner.classList.remove("is-wiring");
            if (activeDraftWire?.targetMapId) {
              pendingConnection = {
                fromMapId: activeDraftWire.fromMapId,
                fromDir: activeDraftWire.fromDir,
                toMapId: activeDraftWire.targetMapId,
                toDir: activeDraftWire.targetDir ?? OPPOSITE_PORT[activeDraftWire.fromDir],
              };
              renderWireConfirm();
            } else {
              activeDraftWire = null;
              refreshSvgOnly();
            }
          };

          window.addEventListener("pointermove", onMove);
          window.addEventListener("pointerup", onUp);
        });

        return portBtn;
      });

      let dragMoved = false;
      const card = el("article", {
        class: `wb-card${isCurrent ? " is-current" : ""}${matches ? "" : " is-dimmed"}`,
        dataset: { testid: `world-board-card-${map.id}`, mapId: map.id },
        attrs: { tabindex: "0", role: "button", "aria-label": `${map.name || map.id} 열기` },
        children: [
          ...ports,
          el("div", {
            class: "wb-card-thumb",
            children: [
              thumbEl,
              el("div", { class: "wb-card-badges", children: badges }),
              settingsBtn,
            ],
          }),
          el("div", {
            class: "wb-card-body",
            children: [
              el("div", { class: "wb-card-title", text: map.name || map.id }),
              el("div", {
                class: "wb-card-meta",
                text: `${map.width}×${map.height} · 유닛 ${map.events.length} · 문 ${node.outgoing.length}`,
              }),
              ...(warpChips.length > 0 ? [el("div", { class: "wb-card-warps", children: warpChips })] : []),
            ],
          }),
        ],
        on: {
          click: () => {
            if (dragMoved) {
              dragMoved = false;
              return;
            }
            selectEditorMap(map.id);
            close();
          },
          keydown: (ev) => {
            if (ev.target !== ev.currentTarget) return;
            const ke = ev as KeyboardEvent;
            if (ke.key === "Enter" || ke.key === " ") {
              ke.preventDefault();
              selectEditorMap(map.id);
              close();
            }
          },
          mouseenter: () => {
            if (hoveredMapId !== map.id) {
              hoveredMapId = map.id;
              refreshSvgOnly();
            }
          },
          mouseleave: () => {
            if (hoveredMapId === map.id) {
              hoveredMapId = null;
              refreshSvgOnly();
            }
          },
        },
      });

      // Drag card to freely arrange world map layout
      card.addEventListener("pointerdown", (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        if (ev.target instanceof Element && ev.target.closest("button")) return;
        const startClientX = ev.clientX;
        const startClientY = ev.clientY;
        const origin = currentPositions.get(map.id) ?? pos;
        dragMoved = false;

        const onMove = (moveEv: PointerEvent): void => {
          const dx = (moveEv.clientX - startClientX) / zoom;
          const dy = (moveEv.clientY - startClientY) / zoom;
          if (!dragMoved && Math.hypot(dx, dy) < 6) return;
          dragMoved = true;
          card.classList.add("is-dragging");
          const nx = Math.max(12, Math.round(origin.x + dx));
          const ny = Math.max(12, Math.round(origin.y + dy));
          card.style.left = `${nx}px`;
          card.style.top = `${ny}px`;
          currentPositions.set(map.id, { x: nx, y: ny, depth: origin.depth });
          customPositions.set(map.id, { x: nx, y: ny });
          refreshSvgOnly();
        };

        const onUp = (): void => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          card.classList.remove("is-dragging");
          if (dragMoved) {
            saveCustomPositions(store.getCurrent(), customPositions);
          }
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      });

      card.style.left = `${pos.x}px`;
      card.style.top = `${pos.y}px`;
      card.style.width = `${CARD_W}px`;
      boardInner.append(card);
    }
  };

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderBoard();
  });

  const onKeyDown = (ev: KeyboardEvent): void => {
    if (!isTopModal(backdrop)) return;
    if (ev.key === "m" || ev.key === "M") {
      if (document.activeElement !== searchInput && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        close();
      }
    }
  };

  const unsubStore = store.subscribe(() => renderBoard());

  const close = registerModal(backdrop, () => {
    window.removeEventListener("keydown", onKeyDown);
    unsubStore();
    backdrop.remove();
    if (activeClose === close) activeClose = null;
  });
  activeClose = close;

  backdrop.addEventListener("mousedown", (ev) => {
    if (ev.target === backdrop && isTopModal(backdrop)) close();
  });

  window.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  renderBoard();
  searchInput.focus();
}

export function mountWorldBoardHotkeys(): () => void {
  const onToggle = (): void => toggleWorldBoard();
  const onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.repeat) return;
    if (ev.key !== "m" && ev.key !== "M") return;
    if (activeClose) {
      const target = ev.target;
      if (target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      ev.preventDefault();
      activeClose();
      return;
    }
    if (shouldIgnoreEditorShortcut(ev)) return;
    if (hasOpenModalLayer()) return;
    ev.preventDefault();
    openWorldBoardModal();
  };

  window.addEventListener(WORLD_BOARD_TOGGLE_EVENT, onToggle);
  window.addEventListener("keydown", onKeyDown);

  return () => {
    window.removeEventListener(WORLD_BOARD_TOGGLE_EVENT, onToggle);
    window.removeEventListener("keydown", onKeyDown);
    activeClose?.();
  };
}
