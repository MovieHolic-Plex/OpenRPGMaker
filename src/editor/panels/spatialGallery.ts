import { regionMapPreview } from "./regionMapView";
import { regionReferenceImage } from "./regionReferenceView";
import { interiorObjectById, interiorObjectsForTheme } from "@/editor/interiorObjectCatalog";
import { cellsFromMapRect, assembledKitCells, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { INTERIOR_OBJECT_THUMB_BACKGROUND_TILE, interiorThemeCards } from "@/editor/panels/structureKitDbSources";
import { interiorObjectCanvas } from "@/editor/panels/structureKitInspector";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import { visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { cardSubtitle } from "@/editor/panels/spatialFeedback";
import {
  catalogRegionDesign,
  catalogWorldDesign,
} from "@/editor/content/spatial/catalogSeed";
import { renderPlaceCardThumb } from "@/editor/panels/spatialPlacePreview";
import { spaceCanvasLayout } from "@/editor/panels/spatialSpaceLayoutView";
import {
  blankSettlementRegionDesign,
  geographyDraftTarget,
  geographyFromProject,
  type GeographyDesign,
} from "@/editor/panels/spatialGeographyDraft";
import { renderGeographyThumb } from "@/editor/panels/spatialGeographyRaster";
import { deferredSpatialCardThumb } from "@/editor/panels/spatialCardThumbs";
import { designUsage, usageSummary } from "@/editor/panels/spatialUsage";
import { spatialId } from "@/project/spatial/domain";
import { resolveSpatialGraphic } from "@/project/spatial/assets";
import { BUILTIN_INTERIOR_ROOM_KINDS } from "@/project/defaults/interiorRoomKinds";
import type { InteriorRoomKindRecord, SectionStructureKitDef, TilesetDef } from "@/project/types";
import type { SpaceDesign } from "@/project/spatial/types";
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

/** 라이브러리·배치 공간은 실제 레이아웃을 굽는다 — 카드마다 다른 그림이 나와야 한다. */
function renderSpaceDesignThumb(space: SpaceDesign): HTMLElement {
  const project = visibleAuthoringProject();
  const tileset = project.tilesets[space.tilesetId];
  if (!tileset) return el("div", { class: "spatial-card-fallback" });
  try {
    const layout = spaceCanvasLayout(project, space);
    const { map } = layout;
    const scale = Math.min(2, 128 / Math.max(1, map.height * 16));
    return renderTileCellsToCanvas({
      tileset,
      widthTiles: map.width,
      heightTiles: map.height,
      cells: cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height }),
      scale,
      backgroundTile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
    });
  } catch {
    return el("div", { class: "spatial-card-fallback" });
  }
}

/**
 * 기본 방 종류(침실·선술집…)는 설계 레코드가 없다 — 종류 문법으로 알아볼 수 있는
 * 조합 그림을 만든다: 마루 바탕 + 필수 역할 가구 스프라이트. 통로는 바닥 띠만 낸다.
 */
function renderRoomKindThumb(card: SpatialGalleryCard, kind: InteriorRoomKindRecord): HTMLElement {
  const tileset = tilesetOf(card);
  const wrap = el("div", { class: "spatial-card-room", dataset: { roomKind: kind.id } });
  if (!tileset) {
    wrap.append(el("span", { class: "spatial-card-room-label", text: kind.label }));
    return wrap;
  }
  const floorCells = kind.walkway
    ? Array.from({ length: 12 }, (_, i) => ({
      dx: i % 6, dy: 1 + Math.floor(i / 6), layer: "lower" as const,
      tile: INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
    }))
    : [];
  const floor = renderTileCellsToCanvas({
    tileset,
    widthTiles: 6,
    heightTiles: kind.walkway ? 3 : 4,
    cells: floorCells,
    scale: 2,
    backgroundTile: kind.walkway ? null : INTERIOR_OBJECT_THUMB_BACKGROUND_TILE,
  });
  floor.classList.add("spatial-card-room-floor");
  wrap.append(floor);
  const theme = interiorThemeCards(tileset, [kind])[0];
  const roleObjects = (theme?.roles ?? []).flatMap((role) => (role.object ? [role.object] : []));
  const pool = roleObjects.length > 0 ? roleObjects : interiorObjectsForTheme(kind.id).slice(0, 3);
  const sprites = el("div", {
    class: "spatial-card-room-sprites",
    children: pool.slice(0, 3).map((object) => interiorObjectCanvas(tileset, object, 1.5)),
  });
  wrap.append(sprites);
  return wrap;
}

/** 카드가 가리키는 방 종류 레코드 — 기본 7종 또는 타일셋 저작 호환 규칙. */
export function roomKindOf(card: SpatialGalleryCard): InteriorRoomKindRecord | undefined {
  if (card.source !== "default") return tilesetOf(card)?.interiorRoomKinds?.find((entry) => entry.id === card.localId);
  return BUILTIN_INTERIOR_ROOM_KINDS.find((entry) => entry.id === card.localId);
}

function renderSpaceThumb(card: SpatialGalleryCard): HTMLElement {
  const project = visibleAuthoringProject();
  const spaceId = card.canonicalSource?.kind === "space"
    ? card.canonicalSource.id
    : card.localId !== undefined && card.source !== "default" ? spatialId(card.localId) : undefined;
  const space = spaceId ? project.spatialAuthoring?.library.spaces[spaceId] : undefined;
  if (space) return renderSpaceDesignThumb(space);
  const kind = roomKindOf(card);
  if (kind) return renderRoomKindThumb(card, kind);
  return el("div", { class: "spatial-card-fallback" });
}

/** 마을 설계서 카드용 정주지 프리뷰 설계 — 레시피 id 당 한 번만 만든다. */
const settlementThumbDesigns = new Map<string, GeographyDesign>();

function geographyThumbDesign(card: SpatialGalleryCard): GeographyDesign | undefined {
  const kind = card.kind === "worlds" ? "world" : "region";
  const project = visibleAuthoringProject();
  const live = geographyFromProject(project, geographyDraftTarget(card, kind));
  if (live) return live;
  if (card.source !== "default" || !card.localId) {
    // 마을 설계서 카드: 레시피이지만 정주지 프리뷰로 무엇을 만드는지 보여 준다.
    if (kind === "region" && card.regionKind === "settlement" && card.localId) {
      let design = settlementThumbDesigns.get(card.localId);
      if (!design) {
        design = blankSettlementRegionDesign(project, card.localId, card.name);
        settlementThumbDesigns.set(card.localId, design);
      }
      return design;
    }
    return undefined;
  }
  return kind === "region" ? catalogRegionDesign(card.localId) : catalogWorldDesign(card.localId);
}

function renderGeographyCardThumb(card: SpatialGalleryCard): HTMLElement {
  const design = geographyThumbDesign(card);
  if (!design) return el("div", { class: "spatial-card-fallback" });
  return renderGeographyThumb(visibleAuthoringProject(), design);
}

function renderMapThumb(card: SpatialGalleryCard): HTMLElement {
  const project = visibleAuthoringProject();
  const map = card.mapId && Object.hasOwn(project.maps, card.mapId) ? project.maps[card.mapId] : undefined;
  const tilesetId = map?.tilesetId ?? card.tilesetId;
  const tileset = tilesetId && Object.hasOwn(project.tilesets, tilesetId) ? project.tilesets[tilesetId] : undefined;
  if (!tileset) return el("div", { class: "spatial-card-fallback" });
  if (map) {
    // 배치 카드는 실제 맵 내용을 보여 준다 — 칩셋 통째 이미지는 모든 카드가 똑같아진다.
    const scale = Math.min(2, 160 / Math.max(1, map.width * 16), 128 / Math.max(1, map.height * 16));
    return renderTileCellsToCanvas({
      tileset,
      widthTiles: map.width,
      heightTiles: map.height,
      cells: cellsFromMapRect(map, { x: 0, y: 0, width: map.width, height: map.height }),
      scale: Math.max(scale, 0.25),
      backgroundTile: null,
    });
  }
  return el("img", {
    class: "spatial-card-image",
    attrs: { src: tilesetImageUrl(tileset), alt: "", draggable: "false" },
  });
}

export function renderSpatialCardThumb(card: SpatialGalleryCard): HTMLElement {
  if (card.regionMapId) return regionMapPreview(card.regionMapId, true);
  if (card.regionReferenceId) return regionReferenceImage(card.regionReferenceId, true);
  if (card.kind === "places") return renderPlaceCardThumb(card);
  if (card.kind === "regions" || card.kind === "worlds") return renderGeographyCardThumb(card);
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
  // 썸네일은 맵 컴파일이다 — 마운트에서 카드 전부를 구우면 탭이 멈춘다(spatialCardThumbs 참고).
  const thumb = deferredSpatialCardThumb(card, () => renderSpatialCardThumb(card));
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
  const subtitle = cardSubtitle(card);
  // 설계 카드는 쓰임을 말한다 — 안 쓰이는 설계가 눈에 보여야 지우든 쓰든 결정이 된다.
  // canonical 설계만 센다: 기본 카탈로그 카드의 localId 는 라이브러리 설계 id 와
  // 거리낌없이 겹친다(둘 다 "inn"). 그대로 두면 기본 카드가 내 설계의 배치를 빌려 표시한다.
  const usage = card.canonicalSource ? designUsage(visibleAuthoringProject(), card.canonicalSource.id) : null;
  const usageLine = usage === null ? null : el("span", {
    class: `spatial-card-usage${usage.rows.length === 0 ? " is-idle" : ""}`,
    text: usageSummary(usage),
    dataset: { testid: `spatial-card-usage-${card.id}` },
  });
  return el("button", {
    class: `spatial-card${selected ? " is-selected" : ""}`,
    attrs: { type: "button", title: card.name },
    dataset: { testid: `spatial-card-${card.id}`, cardId: card.id, source: card.source },
    on: { click: () => onSelect(card.id) },
    children: [
      el("div", { class: "spatial-card-thumb", children: [thumb] }),
      el("div", { class: "spatial-card-caption", children: [
        el("span", { class: "spatial-card-name", text: card.name }),
        ...(subtitle ? [el("span", { class: "spatial-card-sub", text: subtitle })] : []),
        ...(usageLine ? [usageLine] : []),
        el("span", { class: "spatial-card-badges", children: badges }),
      ] }),
    ],
  });
}
