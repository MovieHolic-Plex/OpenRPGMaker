import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { setSpatialCamera } from "@/editor/panels/spatialAuthoringSession";
import { bindGeographyBoard, geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { commitWorkingGeography, viewableGeography, workingProject } from "@/editor/panels/spatialGeographyCommands";
import { geographyDraftTarget, type GeographyDesign, type GeographyKind } from "@/editor/panels/spatialGeographyDraft";
import {
  moveGeographyChild,
  setRegionRoute,
  worldCrossingPoints,
  worldEntryAt,
} from "@/editor/panels/spatialGeographyGeometry";
import { openSelectedChild } from "@/editor/panels/spatialGeographyNavigate";
import { geographyViewChildren } from "@/editor/panels/spatialGeographyQuery";
import { GEOGRAPHY_TILE_PX, renderGeographyRaster } from "@/editor/panels/spatialGeographyRaster";
import { renderGeographyMaterials, renderGeographyTools } from "@/editor/panels/spatialGeographyTools";
import { spatialId } from "@/project/spatial/domain";
import type { RegionDesign, SpatialChildSlot, SpatialId, SpatialPoint } from "@/project/spatial/types";
import { el } from "@/util/dom";

export type GeographyView = {
  readonly session: SpatialAuthoringSession;
  readonly card: SpatialGalleryCard | undefined;
  readonly kind: GeographyKind;
};

function tilePxOf(board: HTMLElement): number {
  const value = Number(board.dataset.tilePx);
  return Number.isFinite(value) && value > 0 ? value : GEOGRAPHY_TILE_PX;
}

export function tileOf(event: PointerEvent, board: HTMLElement): SpatialPoint {
  const box = board.getBoundingClientRect();
  const tilePx = tilePxOf(board);
  return {
    x: Math.floor((event.clientX - box.left) / tilePx),
    y: Math.floor((event.clientY - box.top) / tilePx),
  };
}

function captureBoard(board: HTMLElement, event: PointerEvent): void {
  if (typeof board.setPointerCapture !== "function") return;
  try { board.setPointerCapture(event.pointerId); } catch { /* synthetic events */ }
}

const pendingDrop: { run: (event: PointerEvent) => void } = { run() { return; } };
/** One stable subscription: a rerender replaces pendingDrop.run, so the listener identity must not change. */
const dropListener = (event: PointerEvent): void => pendingDrop.run(event);

function childButton(child: SpatialChildSlot<"space" | "place" | "region">, board: HTMLElement, tilePx: number, readonly: boolean): HTMLElement {
  const selected = geographyChromeState.selectedChildId === child.id;
  return el("button", {
    class: `spatial-geography-child${selected ? " is-selected" : ""}`,
    text: child.source.kind === "region" ? "지역" : "장소",
    attrs: { type: "button", style: `left:${child.x * tilePx}px;top:${child.y * tilePx}px` },
    dataset: {
      testid: `spatial-geography-child-${child.id}`,
      childId: child.id,
      x: String(child.x),
      y: String(child.y),
      frame: "overview",
    },
    on: {
      pointerdown: (event) => {
        event.stopPropagation();
        geographyChromeState.selectedChildId = child.id;
        if (event.currentTarget instanceof HTMLElement) event.currentTarget.classList.add("is-selected");
        if (readonly || geographyChromeState.tool !== "select") return;
        geographyChromeState.gesture = { childId: child.id, originX: child.x, originY: child.y };
        if (event instanceof PointerEvent) captureBoard(board, event);
        document.addEventListener("pointerup", dropListener);
      },
    },
  });
}

function pointAttr(points: readonly SpatialPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function routeLayer(
  design: GeographyDesign,
  children: readonly SpatialChildSlot<"space" | "place" | "region">[],
  tilePx: number,
  rerender: () => void,
): HTMLElement {
  const byId = new Map(children.map((child) => [child.id, child]));
  const segments = "places" in design
    ? design.routes.map((route) => ({ id: route.id, points: route.points, testid: `spatial-geography-route-${route.id}` }))
    : design.connections.map((link) => {
      const from = link.from.childId ? byId.get(link.from.childId) : undefined;
      const to = link.to.childId ? byId.get(link.to.childId) : undefined;
      return { id: link.id, points: from && to ? worldCrossingPoints(from, to) : [], testid: `spatial-geography-crossing-${link.id}` };
    });
  return el("div", {
    class: "spatial-geography-routes",
    dataset: { testid: "spatial-geography-routes" },
    children: segments.flatMap((segment) => {
      if (segment.points.length < 2) return [];
      const selected = geographyChromeState.selectedRouteId === segment.id;
      const nodes: HTMLElement[] = [];
      for (const [index, to] of segment.points.entries()) {
        const from = segment.points[index - 1];
        if (!from) continue;
        const dx = (to.x - from.x) * tilePx;
        const dy = (to.y - from.y) * tilePx;
        nodes.push(el("button", {
          class: `spatial-geography-route${selected ? " is-selected" : ""}`,
          attrs: {
            type: "button",
            "aria-label": "경로",
            style: `left:${from.x * tilePx + 4}px;top:${from.y * tilePx + 4}px;width:${Math.max(1, Math.hypot(dx, dy))}px;transform:rotate(${Math.atan2(dy, dx)}rad)`,
          },
          dataset: { testid: segment.testid, points: pointAttr(segment.points) },
          on: { click: () => { geographyChromeState.selectedRouteId = segment.id; rerender(); } },
        }));
      }
      return nodes;
    }),
  });
}

function finishRoute(design: RegionDesign, target: ReturnType<typeof geographyDraftTarget>, rerender: () => void): void {
  const routeId = geographyChromeState.selectedRouteId ?? design.routes[0]?.id;
  if (!routeId) return;
  if (commitWorkingGeography(target, setRegionRoute(design, routeId, geographyChromeState.routeDraft))) {
    geographyChromeState.routeDraft = [];
  }
  rerender();
}

function hitChildId(event: PointerEvent): SpatialId | undefined {
  const node = event.target;
  if (!(node instanceof Element)) return undefined;
  const hit = node.closest("[data-child-id]");
  if (!(hit instanceof HTMLElement) || !hit.dataset.childId) return undefined;
  return spatialId(hit.dataset.childId);
}

export function renderSpatialGeographyCanvas(view: GeographyView, rerender: () => void): HTMLElement {
  const { session, card, kind } = view;
  bindGeographyBoard(`${session.mode}:${session.tab}:${card?.id ?? ""}`);
  const { design, readonly } = viewableGeography(card, kind);
  const target = card && !readonly ? geographyDraftTarget(card, kind) : undefined;
  const tilePx = GEOGRAPHY_TILE_PX * session.camera.zoom;
  const board = el("div", {
    class: "spatial-geography-board",
    attrs: { tabindex: "0", "aria-label": kind === "region" ? "지역 지도" : "세계 지도" },
    dataset: { testid: "spatial-geography-board", kind, tilePx: String(tilePx), ...(readonly ? { readonly: "1" } : {}) },
  });
  const children = design ? geographyViewChildren(workingProject(), design, target?.occurrenceId) : [];
  if (design) {
    board.style.width = `${design.terrain.width * tilePx}px`;
    board.style.height = `${design.terrain.height * tilePx}px`;
    const raster = renderGeographyRaster(workingProject(), design, target?.occurrenceId);
    if (raster.error) geographyChromeState.previewError = `${raster.error.code}:${raster.error.path}`;
    board.append(raster.node, routeLayer(design, children, tilePx, rerender));
    for (const child of children) board.append(childButton(child, board, tilePx, readonly));
  }
  const finishMove = (event: PointerEvent) => {
    const gesture = geographyChromeState.gesture;
    if (!gesture || !target || !design || readonly) return;
    geographyChromeState.gesture = null;
    document.removeEventListener("pointerup", dropListener);
    const tile = tileOf(event, board);
    if ("places" in design) commitWorkingGeography(target, moveGeographyChild(design, gesture.childId, tile.x, tile.y));
    else commitWorkingGeography(target, moveGeographyChild(design, gesture.childId, tile.x, tile.y));
    rerender();
  };
  pendingDrop.run = finishMove;
  board.addEventListener("pointerup", (event) => {
    if (!target || !design || readonly) return;
    if (geographyChromeState.gesture) {
      finishMove(event);
      return;
    }
    const tile = tileOf(event, board);
    if (geographyChromeState.tool === "route" && "places" in design) {
      geographyChromeState.routeDraft = [...geographyChromeState.routeDraft, tile];
      const last = geographyChromeState.routeDraft[geographyChromeState.routeDraft.length - 1];
      const first = geographyChromeState.routeDraft[0];
      if (first && last && design.places.some((child) => child.x === last.x && child.y === last.y) && geographyChromeState.routeDraft.length >= 2) {
        finishRoute(design, target, rerender);
      } else rerender();
      return;
    }
    if (geographyChromeState.tool === "entry" && "entryPort" in design) {
      commitWorkingGeography(target, worldEntryAt(design, tile, hitChildId(event)));
      rerender();
    }
  });
  board.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!geographyChromeState.gesture && geographyChromeState.routeDraft.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      geographyChromeState.gesture = null;
      geographyChromeState.routeDraft = [];
      geographyChromeState.previewError = null;
      document.removeEventListener("pointerup", dropListener);
      rerender();
      return;
    }
    if (event.key.startsWith("Arrow") && geographyChromeState.selectedChildId && design && target && !readonly) {
      const child = children.find((entry) => entry.id === geographyChromeState.selectedChildId);
      if (!child) return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 5 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if ("places" in design) commitWorkingGeography(target, moveGeographyChild(design, child.id, child.x + dx, child.y + dy));
      else commitWorkingGeography(target, moveGeographyChild(design, child.id, child.x + dx, child.y + dy));
      rerender();
      return;
    }
    if (event.key !== "Enter" || !design || readonly) return;
    event.preventDefault();
    openSelectedChild(session, design, rerender);
  });
  const camera = el("div", { class: "spatial-geography-camera", children: [board] });
  queueMicrotask(() => {
    if (!camera.isConnected) return;
    camera.scrollLeft = Math.max(0, session.camera.x);
    camera.scrollTop = Math.max(0, session.camera.y);
  });
  camera.addEventListener("scroll", () => {
    if (camera.scrollLeft === session.camera.x && camera.scrollTop === session.camera.y) return;
    setSpatialCamera({ x: camera.scrollLeft, y: camera.scrollTop, zoom: session.camera.zoom });
  }, { passive: true });
  if (geographyChromeState.gesture || geographyChromeState.routeDraft.length > 0) {
    queueMicrotask(() => { if (board.isConnected) board.focus(); });
  }
  return el("div", {
    class: "spatial-canvas spatial-geography-canvas",
    attrs: { tabindex: "0", "aria-label": kind === "region" ? "지역 캔버스" : "세계 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [
      readonly
        ? el("p", {
          class: "spatial-readonly-note",
          text: "기본 설계 — 읽기 전용입니다. 「추가」로 내 설계를 만들면 편집할 수 있습니다.",
          dataset: { testid: "spatial-readonly-note" },
        })
        : renderGeographyTools(kind, rerender),
      design && target ? renderGeographyMaterials(design, target, rerender) : el("div"),
      camera,
    ],
  });
}
