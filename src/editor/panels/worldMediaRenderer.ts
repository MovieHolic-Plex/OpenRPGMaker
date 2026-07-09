import { EASYRPG_CHARSET_ASSETS } from "@/assets/easyrpgRtp";
import { renderEventGraphicIcon } from "@/editor/panels/eventEditor/eventGraphicPreview";
import { drawTransferFallback, drawTransferMapPreview } from "@/editor/panels/eventEditor/transferMapPreview";
import type { WorldEntity } from "@/project/world/types";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { ENTITY_TYPE_LABELS } from "./worldManager";

export function renderEntityMedia(entity: WorldEntity, project: Project): HTMLElement {
  if (entity.type === "character") {
    const actorRef = entity.refs?.find((ref) => ref.kind === "actor");
    const actor = actorRef ? project.database.actors.find((record) => record.id === actorRef.id) : undefined;
    const asset = actor?.characterResourceId
      ? EASYRPG_CHARSET_ASSETS.find((candidate) => candidate.id === actor.characterResourceId)
      : undefined;
    if (asset) {
      const preview = renderEventGraphicIcon({ sprite: { type: "bundled", id: asset.textureKey } });
      preview.classList.add("world-card-sprite");
      return preview;
    }
  }
  if (entity.type === "place") {
    const mapRef = entity.refs?.find((ref) => ref.kind === "map");
    if (mapRef) return renderMapThumbnail(project, mapRef.id);
  }
  return renderPlaceholder(entity);
}

function renderMapThumbnail(project: Project, mapId: string): HTMLElement {
  const map = project.maps[mapId];
  if (!map) return renderPlaceholder({ name: "?", type: "place" } as WorldEntity);
  const canvas = document.createElement("canvas") as HTMLCanvasElement;
  canvas.className = "world-card-map-canvas";
  canvas.dataset.testid = `world-map-thumb-${mapId}`;
  const wrap = el("div", {
    class: "world-card-map-thumb",
    attrs: { role: "img", "aria-label": `${map.name} 맵` },
    children: [canvas],
  });
  const hasCanvas = typeof canvas.getContext === "function";
  if (!hasCanvas) {
    wrap.dataset.fallback = "true";
    return wrap;
  }
  const zoom = Math.min(1, 96 / Math.max(map.width * map.tileSize, map.height * map.tileSize, 1));
  const selection = { x: -1, y: -1, zoom };
  void drawTransferMapPreview({ canvas, project, mapId, selection, isCurrent: () => canvas.isConnected }).catch(() => {
    drawTransferFallback({ canvas, map, selection });
  });
  return wrap;
}

function renderPlaceholder(entity: Pick<WorldEntity, "name" | "type">): HTMLElement {
  const text = entity.name.trim().charAt(0) || ENTITY_TYPE_LABELS[entity.type].charAt(0);
  return el("div", {
    class: `world-card-placeholder ${entity.type}`,
    attrs: { "aria-hidden": "true" },
    text,
  });
}
