import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { INTERIOR_OBJECT_THUMB_BACKGROUND_TILE } from "@/editor/panels/structureKitDbSources";
import { interiorObjectCanvas } from "@/editor/panels/structureKitInspector";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { renderPlaceCardThumb } from "@/editor/panels/spatialPlacePreview";
import { resolveSpatialGraphic } from "@/project/spatial/assets";
import type { SectionStructureKitDef, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

function tilesetOf(card: SpatialGalleryCard): TilesetDef | undefined {
  if (!card.tilesetId) return undefined;
  const tilesets = visibleAuthoringProject().tilesets;
  return Object.hasOwn(tilesets, card.tilesetId) ? tilesets[card.tilesetId] : undefined;
}

function renderBuiltinObject(tileset: TilesetDef, kitId: string): HTMLElement | undefined {
  const probe = resolveSpatialGraphic(
    { tilesets: { [tileset.id]: { ...tileset, structureKits: undefined } } },
    { tilesetId: tileset.id, kitId },
  );
  if (probe?.source !== "builtin") return undefined;
  return interiorObjectCanvas(tileset, probe.object, 3);
}

function renderObjectThumb(card: SpatialGalleryCard): HTMLElement {
  const tileset = tilesetOf(card);
  const kitId = card.objectId ?? card.localId;
  if (tileset && kitId) {
    const resolved = resolveSpatialGraphic(visibleAuthoringProject(), { tilesetId: tileset.id, kitId });
    if (card.source === "default") {
      const builtin = renderBuiltinObject(tileset, kitId);
      if (builtin) return builtin;
    } else if (resolved?.source === "authored" && resolved.kit.kind === "section") {
      return renderTileCellsToCanvas({
        tileset,
        widthTiles: Math.max(1, resolved.kit.width),
        heightTiles: Math.max(1, resolved.kit.height),
        cells: assembledKitCells(resolved.kit, resolved.kit.width),
        scale: 3,
        backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
      });
    } else if (resolved?.source === "builtin") {
      return interiorObjectCanvas(tileset, resolved.object, 3);
    }
    const kit = tileset.structureKits?.find((entry) => entry.id === kitId);
    if (kit?.kind === "section") {
      return renderTileCellsToCanvas({
        tileset,
        widthTiles: Math.max(1, kit.width),
        heightTiles: Math.max(1, kit.height),
        cells: assembledKitCells(kit as SectionStructureKitDef, kit.width),
        scale: 3,
        backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
      });
    }
  }
  const object = kitId ? interiorObjectById(kitId) : undefined;
  if (tileset && object && card.source === "default") {
    const builtin = renderBuiltinObject(tileset, object.id);
    if (builtin) return builtin;
  }
  return el("div", { class: "spatial-card-fallback" });
}

function renderSpaceThumb(card: SpatialGalleryCard): HTMLElement {
  const tileset = tilesetOf(card);
  if (!tileset) return el("div", { class: "spatial-card-fallback" });
  return renderTileCellsToCanvas({
    tileset,
    widthTiles: 6,
    heightTiles: 4,
    cells: [],
    scale: 2,
    backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
  });
}

function renderMapThumb(card: SpatialGalleryCard): HTMLElement {
  const project = visibleAuthoringProject();
  const map = card.mapId && Object.hasOwn(project.maps, card.mapId) ? project.maps[card.mapId] : undefined;
  const tilesetId = map?.tilesetId ?? card.tilesetId;
  const tileset = tilesetId && Object.hasOwn(project.tilesets, tilesetId) ? project.tilesets[tilesetId] : undefined;
  if (!tileset) return el("div", { class: "spatial-card-fallback" });
  return el("img", {
    class: "spatial-card-image",
    attrs: { src: tilesetImageUrl(tileset), alt: "", draggable: "false" },
  });
}

export function renderSpatialCardThumb(card: SpatialGalleryCard): HTMLElement {
  if (card.kind === "places") return renderPlaceCardThumb(card);
  if (card.mapId) return renderMapThumb(card);
  if (card.kind === "tiles") {
    const tileset = tilesetOf(card);
    if (!tileset) return el("div", { class: "spatial-card-fallback" });
    return el("img", {
      class: "spatial-card-image",
      attrs: { src: tilesetImageUrl(tileset), alt: "", draggable: "false" },
    });
  }
  if (card.kind === "objects") return renderObjectThumb(card);
  if (card.kind === "spaces") return renderSpaceThumb(card);
  const tileset = tilesetOf(card);
  if (!tileset) return el("div", { class: "spatial-card-fallback" });
  return el("img", {
    class: "spatial-card-image",
    attrs: { src: tilesetImageUrl(tileset), alt: "", draggable: "false" },
  });
}

export function renderSpatialGalleryCard(
  card: SpatialGalleryCard,
  selected: boolean,
  onSelect: (id: string) => void,
): HTMLElement {
  const thumb = renderSpatialCardThumb(card);
  thumb.classList.add("spatial-card-thumb-art");
  const badges: HTMLElement[] = [];
  if (card.source === "default") badges.push(el("span", { class: "spatial-card-badge", text: "기본" }));
  if (card.source === "own" && !card.compatibility) badges.push(el("span", { class: "spatial-card-badge", text: "내 것" }));
  if (card.compatibility) badges.push(el("span", { class: "spatial-card-badge", text: "호환" }));
  if (card.mapUsage) badges.push(el("span", { class: "spatial-card-badge", text: "맵 사용" }));
  if (card.source === "placed" && !card.mapUsage) badges.push(el("span", { class: "spatial-card-badge", text: "배치" }));
  if (card.usage > 0) badges.push(el("span", { class: "spatial-card-badge is-count", text: String(card.usage) }));
  if (card.missingSource) {
    badges.push(el("span", {
      class: "spatial-card-badge is-missing",
      text: "원본 없음",
      dataset: { testid: "spatial-source-missing" },
    }));
  }
  return el("button", {
    class: `spatial-card${selected ? " is-selected" : ""}`,
    attrs: { type: "button", title: card.name },
    dataset: { testid: `spatial-card-${card.id}`, cardId: card.id, source: card.source },
    on: { click: () => onSelect(card.id) },
    children: [
      el("div", { class: "spatial-card-thumb", children: [thumb] }),
      el("div", { class: "spatial-card-caption", children: [
        el("span", { class: "spatial-card-name", text: card.name }),
        ...(card.subtitle ? [el("span", { class: "spatial-card-sub", text: card.subtitle })] : []),
        el("span", { class: "spatial-card-badges", children: badges }),
      ] }),
    ],
  });
}
