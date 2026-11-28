// editor/panels/canvasPortalBadges.ts
// Phase 4: 맵 캔버스 위의 이동(transfer) 이벤트에 떠 있는 원클릭 「⇢ 목적지 맵」 워프 배지.
// 클릭 한 번으로 문 너머 목적지 맵 + 착지 타일 좌표로 카메라가 즉시 점프한다.

import { editorState } from "@/editor/editorState";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { getEditorCameraViewport, subscribeEditorCameraViewport } from "@/editor/editorCameraViewport";
import { resolveCurrentMapId, selectEditorMap } from "@/editor/mapSelection";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";
import { isTileCellChange, store } from "@/project/store";
import type { Command, GameEvent, GameMap, MapId, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type PortalTarget = {
  readonly eventId: string;
  readonly eventX: number;
  readonly eventY: number;
  readonly destMapId: MapId;
  readonly destMapName: string;
  readonly destX: number;
  readonly destY: number;
};

function firstTransferCommand(commands: readonly Command[] | undefined): Extract<Command, { kind: "transfer" }> | null {
  if (!commands) return null;
  for (const cmd of commands) {
    if (cmd.kind === "transfer") return cmd;
    if (cmd.kind === "fork") {
      const hit = firstTransferCommand(cmd.then) ?? firstTransferCommand(cmd.else);
      if (hit) return hit;
    }
    if (cmd.kind === "choices") {
      for (const opt of cmd.options) {
        const hit = firstTransferCommand(opt.branch);
        if (hit) return hit;
      }
      const cancel = firstTransferCommand(cmd.cancelBranch);
      if (cancel) return cancel;
    }
    if (cmd.kind === "presentItem") {
      for (const branch of presentItemBranchLists(cmd)) {
        const hit = firstTransferCommand(branch);
        if (hit) return hit;
      }
    }
    if (cmd.kind === "loop") {
      const hit = firstTransferCommand(cmd.body);
      if (hit) return hit;
    }
  }
  return null;
}

function eventTransfer(ev: GameEvent): Extract<Command, { kind: "transfer" }> | null {
  if (ev.pages?.length) {
    for (const page of ev.pages) {
      const hit = firstTransferCommand(page.commands);
      if (hit) return hit;
    }
    return null;
  }
  return firstTransferCommand(ev.commands);
}

function collectPortals(project: Project, map: GameMap): readonly PortalTarget[] {
  const out: PortalTarget[] = [];
  for (const ev of map.events) {
    const tr = eventTransfer(ev);
    if (!tr || tr.mapId === map.id) continue;
    const dest = project.maps[tr.mapId];
    if (!dest) continue;
    out.push({
      eventId: ev.id,
      eventX: ev.x,
      eventY: ev.y,
      destMapId: dest.id,
      destMapName: dest.name || dest.id,
      destX: tr.x,
      destY: tr.y,
    });
  }
  return out;
}

export function mountCanvasPortalBadges(
  canvasArea: HTMLElement,
  phaserHost: HTMLElement,
): () => void {
  const layer = el("div", {
    class: "canvas-portal-overlay",
    dataset: { testid: "canvas-portal-overlay" },
    attrs: { "aria-label": "맵 이동 포털 바로가기" },
  });
  canvasArea.append(layer);

  let rafId = 0;

  const paint = (): void => {
    const vp = getEditorCameraViewport();
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    const map = mapId ? project.maps[mapId] : undefined;

    clearChildren(layer);
    if (!vp || !map || map.width <= 0 || map.height <= 0 || vp.zoom <= 0) return;

    const portals = collectPortals(project, map);
    if (portals.length === 0) return;

    const areaRect = canvasArea.getBoundingClientRect();
    const hostRect = phaserHost.getBoundingClientRect();
    if (areaRect.width <= 0 || areaRect.height <= 0) return;

    const tileW = vp.mapWidthPx / map.width;
    const tileH = vp.mapHeightPx / map.height;
    const originX = (vp.canvasX ?? hostRect.left) - areaRect.left;
    const originY = (vp.canvasY ?? hostRect.top) - areaRect.top;
    const worldX0 = vp.worldViewX ?? vp.viewX;
    const worldY0 = vp.worldViewY ?? vp.viewY;

    for (const portal of portals) {
      const worldCenterX = portal.eventX * tileW + tileW * 0.5;
      const worldTopY = portal.eventY * tileH;
      const sx = originX + (worldCenterX - worldX0) * vp.zoom;
      const sy = originY + (worldTopY - worldY0) * vp.zoom - 6;

      // Cull badges outside visible canvas safe zone
      if (sx < 40 || sx > areaRect.width - 40 || sy < 52 || sy > areaRect.height - 62) continue;

      const btn = el("button", {
        class: "cpb-badge",
        attrs: {
          type: "button",
          title: `클릭: ${portal.destMapName} (${portal.destX}, ${portal.destY})로 바로 이동`,
        },
        dataset: {
          testid: `canvas-portal-badge-${portal.eventId}`,
          destMapId: portal.destMapId,
        },
        children: [
          el("span", { class: "cpb-arrow", text: "⇢", attrs: { "aria-hidden": "true" } }),
          el("span", { class: "cpb-name", text: portal.destMapName }),
        ],
        on: {
          click: (ev) => {
            ev.stopPropagation();
            selectEditorMap(portal.destMapId);
            requestEditorCameraFocus({
              mapId: portal.destMapId,
              tileX: portal.destX,
              tileY: portal.destY,
              immediate: true,
            });
          },
        },
      });
      btn.style.left = `${Math.round(sx)}px`;
      btn.style.top = `${Math.round(sy)}px`;
      layer.append(btn);
    }
  };

  const schedulePaint = (): void => {
    if (rafId) return;
    if (typeof requestAnimationFrame !== "function") {
      paint();
      return;
    }
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      paint();
    });
  };

  const unsubVp = subscribeEditorCameraViewport(() => schedulePaint());
  let lastPortalMapId = editorState.get().currentMapId;
  const unsubEditor = editorState.subscribe((state) => {
    if (state.currentMapId === lastPortalMapId) return;
    lastPortalMapId = state.currentMapId;
    schedulePaint();
  });
  const unsubStore = store.subscribe((_project, change) => {
    if (!isTileCellChange(change)) schedulePaint();
  });
  window.addEventListener("resize", schedulePaint);
  schedulePaint();

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    unsubVp();
    unsubEditor();
    unsubStore();
    window.removeEventListener("resize", schedulePaint);
    layer.remove();
  };
}
