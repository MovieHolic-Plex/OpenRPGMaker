import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { commitWorkingGeography, workingGeography, workingProject } from "@/editor/panels/spatialGeographyCommands";
import { geographyDraftTarget, type GeographyDesign, type GeographyKind } from "@/editor/panels/spatialGeographyDraft";
import {
  geographyChildren,
  moveGeographyChild,
  setRegionRoute,
  setWorldEntry,
  worldCrossingPoints,
} from "@/editor/panels/spatialGeographyGeometry";
import { openSelectedChild } from "@/editor/panels/spatialGeographyNavigate";
import { GEOGRAPHY_TILE_PX, renderGeographyRaster } from "@/editor/panels/spatialGeographyRaster";
import { renderGeographyMaterials, renderGeographyTools } from "@/editor/panels/spatialGeographyTools";
import type { RegionDesign, SpatialId, SpatialPoint } from "@/project/spatial/types";
import { el } from "@/util/dom";

export type GeographyView = {
  readonly session: SpatialAuthoringSession;
  readonly card: SpatialGalleryCard | undefined;
  readonly kind: GeographyKind;
};

export function tileOf(event: PointerEvent, board: HTMLElement): SpatialPoint {
  const box = board.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - box.left) / GEOGRAPHY_TILE_PX),
    y: Math.floor((event.clientY - box.top) / GEOGRAPHY_TILE_PX),
  };
}

function childButton(design: GeographyDesign, childId: SpatialId, rerender: () => void): HTMLElement {
  const child = geographyChildren(design).find((entry) => entry.id === childId);
  if (!child) return el("span");
  const selected = geographyChromeState.selectedChildId === childId;
  const label = child.source.kind === "region" ? "지역" : "장소";
  return el("button", {
    class: `spatial-geography-child${selected ? " is-selected" : ""}`,
    text: label,
    attrs: {
      type: "button",
      style: `left:${child.x * GEOGRAPHY_TILE_PX}px;top:${child.y * GEOGRAPHY_TILE_PX}px`,
    },
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
        geographyChromeState.selectedChildId = childId;
        geographyChromeState.gesture = { childId, originX: child.x, originY: child.y };
        rerender();
      },
    },
  });
}

function pointAttr(points: readonly SpatialPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function routeLayer(design: GeographyDesign, rerender: () => void): HTMLElement {
  const children = new Map(geographyChildren(design).map((child) => [child.id, child]));
  const segments = "places" in design
    ? design.routes.map((route) => ({
      id: route.id,
      points: route.points,
      testid: `spatial-geography-route-${route.id}`,
    }))
    : design.connections.map((link) => {
      const from = link.from.childId ? children.get(link.from.childId) : undefined;
      const to = link.to.childId ? children.get(link.to.childId) : undefined;
      const points = from && to ? worldCrossingPoints(from, to) : [];
      return { id: link.id, points, testid: `spatial-geography-crossing-${link.id}` };
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
        const dx = (to.x - from.x) * GEOGRAPHY_TILE_PX;
        const dy = (to.y - from.y) * GEOGRAPHY_TILE_PX;
        const length = Math.max(1, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);
        nodes.push(el("button", {
          class: `spatial-geography-route${selected ? " is-selected" : ""}`,
          attrs: {
            type: "button",
            "aria-label": "경로",
            style: `left:${from.x * GEOGRAPHY_TILE_PX + 4}px;top:${from.y * GEOGRAPHY_TILE_PX + 4}px;width:${length}px;transform:rotate(${angle}rad)`,
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
  const committed = commitWorkingGeography(target, setRegionRoute(design, routeId, geographyChromeState.routeDraft));
  if (committed) geographyChromeState.routeDraft = [];
  rerender();
}

export function renderSpatialGeographyCanvas(view: GeographyView, rerender: () => void): HTMLElement {
  const { session, card, kind } = view;
  const design = workingGeography(card, kind);
  const target = card ? geographyDraftTarget(card, kind) : undefined;
  const board = el("div", {
    class: "spatial-geography-board",
    attrs: { tabindex: "0", "aria-label": kind === "region" ? "지역 지도" : "세계 지도" },
    dataset: { testid: "spatial-geography-board", kind },
  });
  if (design) {
    const raster = renderGeographyRaster(workingProject(), design, target?.occurrenceId);
    if (raster.error) geographyChromeState.previewError = `${raster.error.code}:${raster.error.path}`;
    board.append(raster.node, routeLayer(design, rerender));
    for (const child of geographyChildren(design)) board.append(childButton(design, child.id, rerender));
  }
  board.addEventListener("pointerup", (event) => {
    if (!target || !design) return;
    const tile = tileOf(event, board);
    const gesture = geographyChromeState.gesture;
    if (gesture && geographyChromeState.tool === "select") {
      geographyChromeState.gesture = null;
      if ("places" in design) {
        commitWorkingGeography(target, moveGeographyChild(design, gesture.childId, tile.x, tile.y));
      } else {
        commitWorkingGeography(target, moveGeographyChild(design, gesture.childId, tile.x, tile.y));
      }
      rerender();
      return;
    }
    if (geographyChromeState.tool === "route" && "places" in design) {
      geographyChromeState.routeDraft = [...geographyChromeState.routeDraft, tile];
      const last = geographyChromeState.routeDraft[geographyChromeState.routeDraft.length - 1];
      const first = geographyChromeState.routeDraft[0];
      const ends = design.places;
      if (first && last && ends.some((child) => child.x === last.x && child.y === last.y) && geographyChromeState.routeDraft.length >= 2) {
        finishRoute(design, target, rerender);
      } else rerender();
      return;
    }
    if (geographyChromeState.tool === "entry" && "entryPort" in design) {
      const child = design.regions.find((entry) => entry.x === tile.x && entry.y === tile.y);
      if (child) {
        commitWorkingGeography(target, setWorldEntry(design, {
          childId: child.id,
          portId: design.entryPort.portId,
        }));
      }
      rerender();
    }
  });
  if (geographyChromeState.gesture || geographyChromeState.routeDraft.length > 0) {
    queueMicrotask(() => {
      if (board.isConnected) board.focus();
    });
  }
  board.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!geographyChromeState.gesture && geographyChromeState.routeDraft.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      geographyChromeState.gesture = null;
      geographyChromeState.routeDraft = [];
      geographyChromeState.previewError = null;
      rerender();
      return;
    }
    if (event.key.startsWith("Arrow") && geographyChromeState.selectedChildId && design && target) {
      const child = geographyChildren(design).find((entry) => entry.id === geographyChromeState.selectedChildId);
      if (!child) return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? 5 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if ("places" in design) {
        commitWorkingGeography(target, moveGeographyChild(design, child.id, child.x + dx, child.y + dy));
      } else {
        commitWorkingGeography(target, moveGeographyChild(design, child.id, child.x + dx, child.y + dy));
      }
      rerender();
      return;
    }
    if (event.key !== "Enter" || !design) return;
    event.preventDefault();
    openSelectedChild(session, design, rerender);
  });
  const camera = session.camera;
  return el("div", {
    class: "spatial-canvas spatial-geography-canvas",
    attrs: { tabindex: "0", "aria-label": kind === "region" ? "지역 캔버스" : "세계 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [
      renderGeographyTools(kind, rerender),
      design && target ? renderGeographyMaterials(design, target, rerender) : el("div"),
      el("div", {
        class: "spatial-geography-camera",
        attrs: { style: `transform: translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` },
        children: [board],
      }),
    ],
  });
}

