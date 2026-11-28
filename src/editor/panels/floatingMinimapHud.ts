// editor/panels/floatingMinimapHud.ts
// Phase 1 (B × C 하이브리드 · SCMDraft 2 감성):
// 고정 왼쪽 열 없이 캔버스 좌상단에 떠 있는 플로팅 미니맵 + 1클릭 맵 스위처 HUD.
// - 미니맵 클릭·드래그로 즉시 카메라 점프(requestEditorCameraFocus)
// - 현재 모드(유닛/지형/타일)에 맞춰 미니맵 오버레이 자동 전환
// - 맵 이름 클릭 시 연결된 맵 우선 + 전체 맵 트리 스위처 팝오버 열기

import { addMap } from "@/editor/actions";
import { editorState, type EditorState } from "@/editor/editorState";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { getEditorCameraViewport, subscribeEditorCameraViewport } from "@/editor/editorCameraViewport";
import { toggleLeftColumn } from "@/editor/panels/leftColumnDrawer";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { toggleWorldBoard } from "@/editor/panels/worldBoardModal";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import { selectMapModeTool } from "@/editor/panels/tileToolbarActions";
import { resolveCurrentMapId, selectEditorMap } from "@/editor/mapSelection";
import { collectMapLinkGraph } from "@/project/mapLinkStats";
import { isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { isTileCellChange, store } from "@/project/store";
import type { Command, GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export const FLOATING_MINIMAP_TOGGLE_EVENT = "oprn:floating-minimap-toggle";
export const FLOATING_MAP_SWITCHER_OPEN_EVENT = "oprn:floating-map-switcher-open";

const MINIMAP_COLLAPSED_KEY = "oprn:floating-minimap-collapsed";
const MINIMAP_STAGE_W = 180;
const MINIMAP_STAGE_H = 112;
const THUMB_SETTLE_MS = 400;

type MinimapMode = "unit" | "terrain" | "tile";

type StageRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

type EventCategory = "portal" | "enemy" | "npc";

function detectMinimapMode(state: Pick<EditorState, "layer" | "tool">): MinimapMode {
  if (state.tool === "relief") return "terrain";
  if (state.layer === "event") return "unit";
  return "tile";
}

function minimapModeMeta(mode: MinimapMode): { readonly label: string; readonly next: () => void; readonly title: string } {
  if (mode === "unit") {
    return {
      label: "유닛 뷰",
      title: "현재 유닛(이벤트) 뷰 — 누르면 지형 붓 모드로 전환",
      next: () => {
        selectMapModeTool("relief");
        editorState.set({ layer: "lower" });
      },
    };
  }
  if (mode === "terrain") {
    return {
      label: "지형 뷰",
      title: "현재 지형(높이) 뷰 — 누르면 기본 타일 뷰로 전환",
      next: () => selectSidebarLayer("lower"),
    };
  }
  return {
    label: "타일 뷰",
    title: "현재 타일 뷰 — 누르면 유닛(이벤트) 뷰로 전환",
    next: () => selectSidebarLayer("event"),
  };
}

function computeFittedRect(mapWidth: number, mapHeight: number, boxW: number, boxH: number): StageRect {
  const safeW = Math.max(1, mapWidth);
  const safeH = Math.max(1, mapHeight);
  const scale = Math.min(boxW / safeW, boxH / safeH);
  const w = Math.max(12, Math.round(safeW * scale));
  const h = Math.max(12, Math.round(safeH * scale));
  return {
    x: Math.floor((boxW - w) / 2),
    y: Math.floor((boxH - h) / 2),
    w,
    h,
  };
}

function hasCommandKind(commands: readonly Command[] | undefined, kind: Command["kind"]): boolean {
  if (!commands) return false;
  for (const cmd of commands) {
    if (cmd.kind === kind) return true;
    if (cmd.kind === "fork") {
      if (hasCommandKind(cmd.then, kind) || hasCommandKind(cmd.else, kind)) return true;
    } else if (cmd.kind === "choices") {
      for (const opt of cmd.options) {
        if (hasCommandKind(opt.branch, kind)) return true;
      }
      if (hasCommandKind(cmd.cancelBranch, kind)) return true;
    } else if (cmd.kind === "loop") {
      if (hasCommandKind(cmd.body, kind)) return true;
    }
  }
  return false;
}

function classifyEvent(event: GameEvent): EventCategory {
  const pages = event.pages?.length ? event.pages : [{ commands: event.commands }];
  for (const page of pages) {
    if (hasCommandKind(page.commands, "transfer")) return "portal";
  }
  for (const page of pages) {
    if (hasCommandKind(page.commands, "battleProcessing")) return "enemy";
  }
  if (/적|몬스터|보스|산적|슬라임|전투|enemy|boss|monster/iu.test(event.name ?? "")) return "enemy";
  return "npc";
}

function flattenTree(node: MapTreeNode, depth: number, out: { readonly node: MapTreeNode; readonly depth: number }[]): void {
  out.push({ node, depth });
  for (const child of node.children) flattenTree(child, depth + 1, out);
}

export function mountFloatingMinimapHud(canvasArea: HTMLElement): () => void {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(MINIMAP_COLLAPSED_KEY) === "1";
  } catch { /* ignore restricted storage */ }

  let switcherOpen = false;
  let searchQuery = "";
  let dragging = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastThumbKey = "";
  let currentFit: StageRect = { x: 0, y: 0, w: MINIMAP_STAGE_W, h: MINIMAP_STAGE_H };

  // ── Header ──
  const mapNameLabel = el("span", { class: "fmh-map-name", dataset: { testid: "floating-minimap-map-name" }, text: "맵" });
  const mapNameBtn = el("button", {
    class: "fmh-map-trigger",
    attrs: { type: "button", title: "맵 전환 목록 열기", "aria-expanded": "false", "aria-haspopup": "dialog" },
    dataset: { testid: "floating-minimap-map-trigger" },
    children: [el("span", { class: "fmh-caret", attrs: { "aria-hidden": "true" }, text: "▾" }), mapNameLabel],
    on: { click: () => setSwitcherOpen(!switcherOpen) },
  }) as HTMLButtonElement;

  const mapSettingsBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "맵 설정 (이름 · 타일셋 · 크기 · BGM · 적 출현)", "aria-label": "맵 설정 열기" },
    dataset: { testid: "floating-minimap-map-settings" },
    text: "⚙",
    on: {
      click: () => {
        const { mapId, map } = currentContext();
        if (mapId && map) openMapPropertiesDialog(mapId, map.name);
      },
    },
  }) as HTMLButtonElement;

  const sidebarBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "왼쪽 도구 열 접기/펴기", "aria-label": "왼쪽 도구 열 접기/펴기" },
    dataset: { testid: "floating-minimap-toggle-sidebar" },
    text: "◧",
    on: { click: () => toggleLeftColumn() },
  }) as HTMLButtonElement;

  const collapseBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "미니맵 접기/펴기", "aria-label": "미니맵 접기/펴기", "aria-expanded": String(!collapsed) },
    dataset: { testid: "floating-minimap-collapse" },
    text: collapsed ? "+" : "−",
    on: { click: () => setCollapsed(!collapsed) },
  }) as HTMLButtonElement;

  const worldBoardBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "월드 보드 열기 (M)", "aria-label": "월드 보드 열기 (M)" },
    dataset: { testid: "floating-minimap-world-board" },
    text: "◈",
    on: { click: () => toggleWorldBoard() },
  }) as HTMLButtonElement;

  const head = el("div", {
    class: "fmh-head",
    children: [mapNameBtn, el("div", { class: "fmh-head-actions", children: [worldBoardBtn, mapSettingsBtn, sidebarBtn, collapseBtn] })],
  });

  // ── Minimap Stage (Thumbnail + 2× Overlay Canvas) ──
  const thumbSlot = el("div", { class: "fmh-thumb-slot", attrs: { "aria-hidden": "true" } });
  const overlayCanvas = el("canvas", {
    class: "fmh-overlay-canvas",
    attrs: { width: String(MINIMAP_STAGE_W * 2), height: String(MINIMAP_STAGE_H * 2), "aria-hidden": "true" },
  }) as HTMLCanvasElement;
  const stage = el("div", {
    class: "fmh-stage",
    attrs: { role: "slider", tabindex: "0", "aria-label": "미니맵 — 클릭하거나 끌어 카메라 이동" },
    dataset: { testid: "floating-minimap-stage" },
    children: [thumbSlot, overlayCanvas],
  });

  // ── Footer ──
  const modeDot = el("span", { class: "fmh-mode-dot", attrs: { "aria-hidden": "true" } });
  const modeText = el("span", { class: "fmh-mode-text", text: "타일 뷰" });
  const modeBtn = el("button", {
    class: "fmh-mode-btn",
    attrs: { type: "button" },
    dataset: { testid: "floating-minimap-mode" },
    children: [modeDot, modeText],
    on: {
      click: () => {
        const mode = detectMinimapMode(editorState.get());
        minimapModeMeta(mode).next();
      },
    },
  }) as HTMLButtonElement;
  const metaText = el("span", { class: "fmh-meta", dataset: { testid: "floating-minimap-meta" }, text: "" });
  const foot = el("div", { class: "fmh-foot", children: [modeBtn, metaText] });

  // ── Map Switcher Popover ──
  const searchInput = el("input", {
    class: "fmh-search-input",
    attrs: { type: "search", placeholder: "맵 이름으로 빠르게 이동…", "aria-label": "맵 찾기", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: "floating-map-switcher-search" },
  }) as HTMLInputElement;
  const switcherList = el("div", { class: "fmh-switcher-list", dataset: { testid: "floating-map-switcher-list" } });
  const newMapBtn = el("button", {
    class: "fmh-switcher-action",
    attrs: { type: "button" },
    dataset: { testid: "floating-map-switcher-new" },
    text: "+ 새 맵",
    on: {
      click: () => {
        const project = store.getCurrent();
        const curId = resolveCurrentMapId();
        const curMap = curId ? project.maps[curId] : undefined;
        const count = Object.keys(project.maps).length + 1;
        const id = addMap(`새 맵 ${count}`, curMap?.width ?? 24, curMap?.height ?? 18, curMap?.tilesetId);
        selectEditorMap(id);
        setSwitcherOpen(false);
      },
    },
  });
  const openSidebarAction = el("button", {
    class: "fmh-switcher-action",
    attrs: { type: "button" },
    text: "왼쪽 열 ◧",
    on: {
      click: () => {
        setSwitcherOpen(false);
        toggleLeftColumn();
      },
    },
  });
  const switcherFoot = el("div", { class: "fmh-switcher-foot", children: [newMapBtn, openSidebarAction] });
  const popover = el("div", {
    class: "fmh-switcher-popover",
    attrs: { role: "dialog", "aria-label": "맵 빠른 전환" },
    dataset: { testid: "floating-map-switcher-popover" },
    children: [el("div", { class: "fmh-search-wrap", children: [searchInput] }), switcherList, switcherFoot],
  });
  popover.hidden = true;

  const card = el("section", {
    class: "floating-minimap-hud" + (collapsed ? " is-collapsed" : ""),
    attrs: { "aria-label": "플로팅 미니맵" },
    dataset: { testid: "floating-minimap-hud", mode: "tile" },
    children: [head, stage, foot, popover],
  });

  function currentContext(): { readonly project: Project; readonly mapId: MapId | null; readonly map: GameMap | undefined } {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    return { project, mapId, map: mapId ? project.maps[mapId] : undefined };
  }

  function jumpCameraToPointer(clientX: number, clientY: number): void {
    const { mapId, map } = currentContext();
    if (!mapId || !map) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const localX = ((clientX - bounds.left) / bounds.width) * MINIMAP_STAGE_W;
    const localY = ((clientY - bounds.top) / bounds.height) * MINIMAP_STAGE_H;
    const normX = Math.max(0, Math.min(1, (localX - currentFit.x) / Math.max(1, currentFit.w)));
    const normY = Math.max(0, Math.min(1, (localY - currentFit.y) / Math.max(1, currentFit.h)));
    const tileX = Math.max(0, Math.min(map.width - 0.01, normX * map.width));
    const tileY = Math.max(0, Math.min(map.height - 0.01, normY * map.height));
    requestEditorCameraFocus({ mapId, tileX, tileY, immediate: true });
  }

  stage.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    try { stage.setPointerCapture(event.pointerId); } catch { /* happy-dom / unsupported */ }
    jumpCameraToPointer(event.clientX, event.clientY);
  });
  stage.addEventListener("pointermove", (event: PointerEvent) => {
    if (!dragging) return;
    event.preventDefault();
    jumpCameraToPointer(event.clientX, event.clientY);
  });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    try {
      if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  function syncThumbnail(force = false): void {
    const { mapId, map } = currentContext();
    if (!mapId || !map) {
      clearChildren(thumbSlot);
      lastThumbKey = "";
      return;
    }
    const fit = computeFittedRect(map.width, map.height, MINIMAP_STAGE_W, MINIMAP_STAGE_H);
    currentFit = fit;
    const tileSig = `${map.lowerTiles.length}:${map.upperTiles.length}:${map.lowerTiles[0] ?? 0}:${map.lowerTiles[Math.floor(map.lowerTiles.length / 2)] ?? 0}`;
    const key = `${mapId}|${map.tilesetId}|${map.width}x${map.height}|${fit.w}x${fit.h}|${tileSig}`;
    if (!force && key === lastThumbKey && thumbSlot.childElementCount > 0) return;
    lastThumbKey = key;
    const thumb = createMapThumbnail(mapId, {
      width: fit.w,
      height: fit.h,
      className: "fmh-thumb-canvas",
      testId: "floating-minimap-thumb",
    });
    thumb.style.left = `${fit.x}px`;
    thumb.style.top = `${fit.y}px`;
    thumb.style.width = `${fit.w}px`;
    thumb.style.height = `${fit.h}px`;
    thumbSlot.replaceChildren(thumb);
  }

  function drawOverlay(): void {
    if (collapsed) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;
    const scale = 2;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_STAGE_W, MINIMAP_STAGE_H);

    const { project, mapId, map } = currentContext();
    if (!mapId || !map) return;

    const state = editorState.get();
    const mode = detectMinimapMode(state);
    const fit = computeFittedRect(map.width, map.height, MINIMAP_STAGE_W, MINIMAP_STAGE_H);
    currentFit = fit;

    // 1. Subtle border around active fitted map area
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(fit.x + 0.5, fit.y + 0.5, Math.max(1, fit.w - 1), Math.max(1, fit.h - 1));

    const toX = (tx: number) => fit.x + (tx / Math.max(1, map.width)) * fit.w;
    const toY = (ty: number) => fit.y + (ty / Math.max(1, map.height)) * fit.h;

    // 2. Terrain mode: elevation contour tinting from map.relief.levels
    if (mode === "terrain" && map.relief?.levels?.length) {
      const levels = map.relief.levels;
      const cellW = fit.w / Math.max(1, map.width);
      const cellH = fit.h / Math.max(1, map.height);
      const step = Math.max(1, Math.floor(Math.max(map.width, map.height) / 64));
      for (let y = 0; y < map.height; y += step) {
        for (let x = 0; x < map.width; x += step) {
          const level = levels[y * map.width + x] ?? 0;
          if (level <= 0) continue;
          const alpha = Math.min(0.62, 0.16 + level * 0.11);
          ctx.fillStyle = level >= 3 ? `rgba(251, 191, 36, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
          ctx.fillRect(fit.x + x * cellW, fit.y + y * cellH, Math.max(1.5, cellW * step), Math.max(1.5, cellH * step));
        }
      }
    }

    // 3. Unit / Event / Portal markers (prominent in unit mode, subtle in tile/terrain mode)
    const dotRadius = mode === "unit" ? 2.6 : 1.9;
    const dotAlpha = mode === "unit" ? 0.98 : 0.72;
    ctx.save();
    ctx.globalAlpha = dotAlpha;
    for (const ev of map.events) {
      const cx = toX(ev.x + 0.5);
      const cy = toY(ev.y + 0.5);
      const cat = classifyEvent(ev);
      ctx.fillStyle = cat === "portal" ? "#38bdf8" : cat === "enemy" ? "#ef4444" : "#facc15";
      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (state.selectedEventId === ev.id) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius + 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Start position marker ★ (green diamond)
    if (project.startMapId === mapId && project.startPos) {
      const sx = toX(project.startPos.x + 0.5);
      const sy = toY(project.startPos.y + 0.5);
      const r = mode === "unit" ? 3.5 : 2.6;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx, sy + r);
      ctx.lineTo(sx - r, sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#052e16";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();

    // 4. Live StarCraft white camera viewport rectangle
    const vp = getEditorCameraViewport();
    if (vp && vp.mapWidthPx > 0 && vp.mapHeightPx > 0) {
      const rx = fit.x + (vp.viewX / vp.mapWidthPx) * fit.w;
      const ry = fit.y + (vp.viewY / vp.mapHeightPx) * fit.h;
      const rw = (vp.viewWidthPx / vp.mapWidthPx) * fit.w;
      const rh = (vp.viewHeightPx / vp.mapHeightPx) * fit.h;
      const clippedX = Math.max(fit.x, Math.min(fit.x + fit.w - 4, rx));
      const clippedY = Math.max(fit.y, Math.min(fit.y + fit.h - 4, ry));
      const clippedW = Math.max(6, Math.min(fit.x + fit.w - clippedX, rx + rw - clippedX));
      const clippedH = Math.max(6, Math.min(fit.y + fit.h - clippedY, ry + rh - clippedY));
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = 2.6;
      ctx.strokeRect(clippedX, clippedY, clippedW, clippedH);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(clippedX, clippedY, clippedW, clippedH);
    }
  }

  function renderSwitcherList(): void {
    if (!switcherOpen) return;
    const { project, mapId: currentId } = currentContext();
    const query = searchQuery.trim().toLowerCase();
    clearChildren(switcherList);

    const graph = collectMapLinkGraph(project);
    const currentNode = currentId ? graph.find((node) => node.mapId === currentId) : undefined;
    const linkedIds = new Map<MapId, "both" | "out" | "in">();
    if (currentNode) {
      const inSet = new Set(currentNode.incoming.map((e) => e.from));
      for (const edge of currentNode.outgoing) {
        if (edge.to === currentId) continue;
        linkedIds.set(edge.to, inSet.has(edge.to) ? "both" : "out");
      }
      for (const edge of currentNode.incoming) {
        if (edge.from === currentId || linkedIds.has(edge.from)) continue;
        linkedIds.set(edge.from, "in");
      }
    }

    const makeRow = (id: MapId, depth: number, linkDir?: "both" | "out" | "in"): HTMLElement | null => {
      const map = project.maps[id];
      if (!map) return null;
      const label = map.name?.trim() || id;
      if (query && !label.toLowerCase().includes(query) && !id.toLowerCase().includes(query)) return null;
      const thumb = createMapThumbnail(id, {
        width: 28,
        height: 20,
        className: "fmh-switcher-thumb",
        testId: `fmh-switch-thumb-${id}`,
      });
      const badges: HTMLElement[] = [];
      if (linkDir) {
        badges.push(el("span", {
          class: "fmh-switcher-badge is-link",
          text: linkDir === "both" ? "↔ 연결" : linkDir === "out" ? "→ 이동" : "← 진입",
        }));
      }
      if (project.startMapId === id) {
        badges.push(el("span", { class: "fmh-switcher-badge is-start", text: "시작" }));
      }
      const row = el("button", {
        class: "fmh-switcher-row" + (id === currentId ? " is-active" : ""),
        attrs: { type: "button" },
        dataset: { testid: `floating-map-row-${id}`, mapId: id },
        children: [
          thumb,
          el("span", { class: "fmh-switcher-name", text: label }),
          ...badges,
          el("span", { class: "fmh-switcher-dim", text: `${map.width}×${map.height}` }),
        ],
        on: {
          click: () => {
            selectEditorMap(id);
            setSwitcherOpen(false);
          },
        },
      });
      if (depth > 0 && !query) row.style.paddingLeft = `${8 + Math.min(depth, 4) * 12}px`;
      return row;
    };

    // Linked maps section first (when not filtering)
    if (!query && linkedIds.size > 0) {
      const linkedRows: HTMLElement[] = [];
      for (const [id, dir] of linkedIds.entries()) {
        const row = makeRow(id, 0, dir);
        if (row) linkedRows.push(row);
      }
      if (linkedRows.length > 0) {
        switcherList.append(el("div", { class: "fmh-switcher-group", text: "연결된 맵" }), ...linkedRows);
      }
    }

    // Full map tree
    const flat: { readonly node: MapTreeNode; readonly depth: number }[] = [];
    flattenTree(project.mapTree, 0, flat);
    const seen = new Set<MapId>();
    const allRows: HTMLElement[] = [];
    for (const { node, depth } of flat) {
      if (isMapTreeFolder(node)) {
        if (!query) {
          allRows.push(el("div", {
            class: "fmh-switcher-folder",
            text: `▸ ${mapTreeNodeLabel(node, project.maps)}`,
          }));
        }
        continue;
      }
      if (seen.has(node.mapId)) continue;
      seen.add(node.mapId);
      const row = makeRow(node.mapId, depth);
      if (row) allRows.push(row);
    }
    // Any orphan maps not in mapTree
    for (const id of Object.keys(project.maps)) {
      if (seen.has(id)) continue;
      const row = makeRow(id, 0);
      if (row) allRows.push(row);
    }

    if (allRows.length > 0) {
      if (!query && linkedIds.size > 0) {
        switcherList.append(el("div", { class: "fmh-switcher-group", text: "전체 맵" }));
      }
      switcherList.append(...allRows);
    } else {
      switcherList.append(el("div", { class: "fmh-switcher-empty", text: "일치하는 맵이 없습니다." }));
    }
  }

  function syncChrome(): void {
    const { map } = currentContext();
    const state = editorState.get();
    const mode = detectMinimapMode(state);
    const meta = minimapModeMeta(mode);
    card.dataset.mode = mode;
    mapNameLabel.textContent = map?.name?.trim() || map?.id || "맵 없음";
    modeText.textContent = meta.label;
    modeBtn.title = meta.title;
    const zoomPct = Math.round((state.zoom || 1) * 100);
    metaText.textContent = map ? `${map.width}×${map.height} · ${zoomPct}%` : "";
  }

  function setCollapsed(next: boolean): void {
    if (collapsed === next) return;
    collapsed = next;
    card.classList.toggle("is-collapsed", collapsed);
    collapseBtn.textContent = collapsed ? "+" : "−";
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    try { localStorage.setItem(MINIMAP_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
    if (!collapsed) {
      syncThumbnail();
      drawOverlay();
    }
  }

  function setSwitcherOpen(next: boolean): void {
    if (switcherOpen === next) return;
    switcherOpen = next;
    popover.hidden = !switcherOpen;
    mapNameBtn.setAttribute("aria-expanded", String(switcherOpen));
    if (switcherOpen) {
      searchQuery = "";
      searchInput.value = "";
      renderSwitcherList();
      queueMicrotask(() => searchInput.focus());
    }
  }

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderSwitcherList();
  });
  searchInput.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSwitcherOpen(false);
      mapNameBtn.focus();
    } else if (event.key === "Enter") {
      const first = switcherList.querySelector<HTMLButtonElement>(".fmh-switcher-row");
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });

  const onDocPointerDown = (event: PointerEvent): void => {
    if (!switcherOpen) return;
    const target = event.target;
    if (target instanceof Node && !card.contains(target)) setSwitcherOpen(false);
  };
  const onDocKeyDown = (event: KeyboardEvent): void => {
    if (switcherOpen && event.key === "Escape") setSwitcherOpen(false);
  };
  const onToggleEvent = (): void => setCollapsed(!collapsed);
  const onSwitcherEvent = (): void => setSwitcherOpen(true);

  document.addEventListener("pointerdown", onDocPointerDown, true);
  document.addEventListener("keydown", onDocKeyDown);
  window.addEventListener(FLOATING_MINIMAP_TOGGLE_EVENT, onToggleEvent);
  window.addEventListener(FLOATING_MAP_SWITCHER_OPEN_EVENT, onSwitcherEvent);

  const unsubViewport = subscribeEditorCameraViewport(() => drawOverlay());
  let lastMinimapEditor = editorState.get();
  const unsubEditor = editorState.subscribe((state) => {
    const prev = lastMinimapEditor;
    lastMinimapEditor = state;
    if (
      state.currentMapId === prev.currentMapId
      && state.layer === prev.layer
      && state.tool === prev.tool
      && state.zoom === prev.zoom
      && state.selectedEventId === prev.selectedEventId
    ) {
      return;
    }
    syncChrome();
    if (!collapsed) {
      syncThumbnail();
      drawOverlay();
    }
    if (switcherOpen) renderSwitcherList();
  });
  const unsubStore = store.subscribe((_project, change) => {
    if (isTileCellChange(change)) {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        settleTimer = null;
        if (!collapsed) {
          syncThumbnail(true);
          drawOverlay();
        }
      }, THUMB_SETTLE_MS);
      return;
    }
    syncChrome();
    if (!collapsed) {
      syncThumbnail(true);
      drawOverlay();
    }
    if (switcherOpen) renderSwitcherList();
  });

  canvasArea.append(card);
  syncChrome();
  if (!collapsed) {
    syncThumbnail(true);
    drawOverlay();
  }

  return () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    unsubViewport();
    unsubEditor();
    unsubStore();
    document.removeEventListener("pointerdown", onDocPointerDown, true);
    document.removeEventListener("keydown", onDocKeyDown);
    window.removeEventListener(FLOATING_MINIMAP_TOGGLE_EVENT, onToggleEvent);
    window.removeEventListener(FLOATING_MAP_SWITCHER_OPEN_EVENT, onSwitcherEvent);
    card.remove();
  };
}
