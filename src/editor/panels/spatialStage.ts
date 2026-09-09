import { renderWorldGenTab } from "@/editor/panels/databaseWorldGenView";
import { renderVillageTab } from "@/editor/panels/databaseVillageView";
import { renderTilesetSpacesTab } from "@/editor/panels/tilesetSpacesTab";
import { listSpatialGalleryCards, spatialCardById, type SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import {
  patchSpatialSession,
  popSpatialBreadcrumb,
  spatialSession,
  type SpatialAuthoringSession,
} from "@/editor/panels/spatialAuthoringSession";
import {
  renderSpatialObjectsCanvas,
  renderSpatialObjectsInspector,
  spatialObjectsChrome,
} from "@/editor/panels/spatialObjectsTab";
import {
  renderSpatialPlacesCanvas,
  renderSpatialPlacesInspector,
  spatialPlacesChrome,
  visiblePlaceSelection,
} from "@/editor/panels/spatialPlacesTab";
import {
  renderSpatialSpacesCanvas,
  renderSpatialSpacesInspector,
  spatialSpacesChrome,
} from "@/editor/panels/spatialSpacesTab";
import { renderSpatialTilesCanvas, spatialTilesChrome, type SpatialDomainChrome } from "@/editor/panels/spatialTilesTab";
import {
  renderSpatialRegionsCanvas,
  renderSpatialRegionsInspector,
  spatialRegionsChrome,
} from "@/editor/panels/spatialRegionsTab";
import {
  renderSpatialWorldsCanvas,
  renderSpatialWorldsInspector,
  spatialWorldsChrome,
} from "@/editor/panels/spatialWorldsTab";
import { restoreGeographyParent } from "@/editor/panels/spatialGeographyNavigate";
import { el } from "@/util/dom";

const TAB_LABEL = {
  tiles: "타일",
  objects: "오브젝트",
  spaces: "공간",
  places: "장소",
  regions: "지역",
  worlds: "세계",
} as const;

function actionButton(id: string, label: string, enabled: boolean, onClick?: () => void): HTMLElement {
  return el("button", {
    class: "spatial-action",
    text: label,
    attrs: { type: "button", ...(enabled ? {} : { disabled: "" }) },
    dataset: { testid: id },
    on: enabled && onClick ? { click: onClick } : undefined,
  });
}

export function inspectorSourceLabel(card: SpatialGalleryCard): string {
  if (card.mapUsage) return "맵 사용";
  if (card.compatibility === "room-rule") return "호환 방 규칙";
  if (card.compatibility === "house-shape") return "호환 집 형태";
  switch (card.source) {
    case "default": return "기본 설계";
    case "own": return "내 설계";
    case "placed": return "배치";
    default: {
      const exhaustive: never = card.source;
      return exhaustive;
    }
  }
}

function domainChrome(session: SpatialAuthoringSession, onChange: () => void): SpatialDomainChrome | undefined {
  const selected = visibleSpatialSelection(session);
  if (session.tab === "tiles") return spatialTilesChrome();
  if (session.tab === "objects") return spatialObjectsChrome(selected, onChange);
  if (session.tab === "spaces") return spatialSpacesChrome(selected, onChange);
  if (session.tab === "places") return spatialPlacesChrome(visiblePlaceSelection(selected), onChange);
  if (session.tab === "regions") return spatialRegionsChrome(selected, onChange);
  if (session.tab === "worlds") return spatialWorldsChrome(selected, onChange);
  return undefined;
}

export function renderSpatialChrome(
  session: SpatialAuthoringSession,
  onChange: () => void,
): HTMLElement {
  const selected = visibleSpatialSelection(session);
  const crumbLabel = selected?.name ?? TAB_LABEL[session.tab];
  const chrome = domainChrome(session, onChange);
  const previewError = chrome?.previewError ?? null;
  return el("div", {
    class: "spatial-chrome",
    children: [
      el("div", {
        class: "spatial-modes",
        children: [
          el("button", {
            class: `spatial-mode${session.mode === "design" ? " is-active" : ""}`,
            text: "설계",
            attrs: { type: "button", "aria-pressed": String(session.mode === "design") },
            dataset: { testid: "spatial-mode-design" },
          }),
          el("button", {
            class: `spatial-mode${session.mode === "instances" ? " is-active" : ""}`,
            text: "배치된 곳",
            attrs: { type: "button", "aria-pressed": String(session.mode === "instances") },
            dataset: { testid: "spatial-mode-instances" },
          }),
          el("button", {
            class: `spatial-inspector-toggle${session.inspectorOpen ? " is-active" : ""}`,
            text: "속성",
            attrs: {
              type: "button",
              "aria-pressed": String(session.inspectorOpen),
              "aria-expanded": String(session.inspectorOpen),
              "aria-controls": "spatial-inspector",
            },
            dataset: { testid: "spatial-inspector-toggle" },
            on: {
              click: () => {
                patchSpatialSession({ inspectorOpen: !spatialSession().inspectorOpen });
                onChange();
              },
            },
          }),
        ],
      }),
      el("nav", {
        class: "spatial-breadcrumb",
        attrs: { "aria-label": "공간 위치" },
        dataset: { testid: "spatial-breadcrumb" },
        children: [
          el("button", {
            class: "spatial-back",
            text: "←",
            attrs: {
              type: "button",
              "aria-label": "뒤로",
              ...(session.breadcrumb.length === 0 ? { disabled: "" } : {}),
            },
            dataset: { testid: "spatial-back" },
            on: {
              click: () => {
                if (session.tab === "regions" || session.tab === "worlds" || session.breadcrumb.length > 0) {
                  restoreGeographyParent(onChange);
                  return;
                }
                popSpatialBreadcrumb();
                onChange();
              },
            },
          }),
          el("span", { class: "spatial-crumb-label", text: crumbLabel, dataset: { testid: "spatial-name" } }),
        ],
      }),
      el("div", {
        class: "spatial-actions",
        children: [
          actionButton("spatial-add", "추가", Boolean(chrome?.add), chrome?.add),
          actionButton("spatial-duplicate", "복제", Boolean(chrome?.duplicate), chrome?.duplicate),
          actionButton("spatial-delete", "삭제", Boolean(chrome?.delete), chrome?.delete),
          actionButton("spatial-preview", "미리보기", Boolean(chrome?.preview), chrome?.preview),
          actionButton("spatial-apply", "적용", Boolean(chrome?.apply), chrome?.apply),
          actionButton("spatial-refresh", "새로고침", Boolean(chrome?.refresh), chrome?.refresh),
          actionButton("spatial-detach", "분리", Boolean(chrome?.detach), chrome?.detach),
          actionButton("spatial-undo", "되돌리기", Boolean(chrome?.undo), chrome?.undo),
          actionButton("spatial-redo", "다시 실행", Boolean(chrome?.redo), chrome?.redo),
          el("span", { class: "spatial-save-state", text: chrome?.saveState ?? "읽기", dataset: { testid: "spatial-save-state" } }),
          el("button", {
            class: "spatial-delete-confirm",
            text: "확인",
            attrs: { type: "button", ...(chrome?.deleteOpen ? {} : { hidden: "" }) },
            dataset: { testid: "spatial-delete-confirm" },
            on: chrome?.onDeleteConfirm ? { click: chrome.onDeleteConfirm } : undefined,
          }),
          el("span", {
            class: "spatial-preview-error",
            text: previewError ?? "",
            attrs: previewError ? {} : { hidden: "" },
            dataset: { testid: "spatial-preview-error" },
          }),
        ],
      }),
    ],
  });
}

function renderLegacyStage(session: SpatialAuthoringSession, rerender: () => void): HTMLElement | null {
  const host = el("div", { class: "spatial-legacy-host" });
  if (session.legacyOrigin === "tilesetSpaces" && session.tab === "spaces") {
    renderTilesetSpacesTab(host, rerender);
    return host;
  }
  if (session.legacyOrigin === "villages" && session.tab === "places") {
    renderVillageTab(host, rerender);
    return host;
  }
  if (session.legacyOrigin === "worldGen" && session.tab === "regions") {
    renderWorldGenTab(host, rerender);
    return host;
  }
  return null;
}

export function renderSpatialCanvas(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  if (session.tab === "tiles") return renderSpatialTilesCanvas(session, card, rerender);
  if (session.tab === "objects") return renderSpatialObjectsCanvas(session, card);
  if (session.tab === "spaces") return renderSpatialSpacesCanvas(session, card, rerender);
  if (session.tab === "places") return renderSpatialPlacesCanvas(session, visiblePlaceSelection(card), rerender);
  if (session.tab === "regions") return renderSpatialRegionsCanvas(session, card, rerender);
  if (session.tab === "worlds") return renderSpatialWorldsCanvas(session, card, rerender);
  const legacy = renderLegacyStage(session, rerender);
  const art = card ? renderSpatialCardThumb(card) : el("div", { class: "spatial-canvas-empty" });
  art.classList.add("spatial-canvas-art");
  return el("div", {
    class: "spatial-canvas",
    attrs: { tabindex: "0", "aria-label": "공간 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [
      el("div", {
        class: "spatial-canvas-camera",
        attrs: {
          style: `transform: translate(${session.camera.x}px, ${session.camera.y}px) scale(${session.camera.zoom})`,
        },
        children: [art],
      }),
      ...(legacy ? [legacy] : []),
    ],
  });
}

export function renderSpatialInspector(
  card: SpatialGalleryCard | undefined,
  open: boolean,
  onChange: () => void = () => undefined,
): HTMLElement {
  if (spatialSession().tab === "objects") return renderSpatialObjectsInspector(card, open, onChange);
  if (spatialSession().tab === "spaces") return renderSpatialSpacesInspector(card, open, onChange);
  if (spatialSession().tab === "places") {
    return renderSpatialPlacesInspector(visiblePlaceSelection(card), open, onChange);
  }
  if (spatialSession().tab === "regions") {
    return renderSpatialRegionsInspector(spatialSession(), card, onChange);
  }
  if (spatialSession().tab === "worlds") {
    return renderSpatialWorldsInspector(spatialSession(), card, onChange);
  }
  const body: HTMLElement[] = [];
  if (card) {
    body.push(el("h3", { class: "spatial-inspector-name", text: card.name }));
    if (card.subtitle) body.push(el("p", { class: "spatial-inspector-sub", text: card.subtitle }));
    body.push(el("dl", {
      class: "spatial-inspector-facts",
      children: [
        el("dt", { text: "원본" }),
        el("dd", { text: inspectorSourceLabel(card) }),
        ...(card.usage > 0 ? [el("dt", { text: "사용" }), el("dd", { text: String(card.usage) })] : []),
      ],
    }));
    body.push(el("button", {
      class: "spatial-open-child",
      text: "열기",
      attrs: { type: "button", disabled: "" },
      dataset: { testid: "spatial-open-child" },
    }));
  }
  return el("aside", {
    class: `spatial-inspector${open ? " is-open" : ""}`,
    attrs: { "aria-label": "속성", id: "spatial-inspector" },
    dataset: { testid: "spatial-inspector" },
    children: body,
  });
}

export function renderSpatialSourceChips(
  session: SpatialAuthoringSession,
  onSource: (source: SpatialAuthoringSession["source"]) => void,
): HTMLElement {
  const chips: Array<{ id: SpatialAuthoringSession["source"]; label: string }> = [
    { id: "all", label: "모두" },
    { id: "defaults", label: "기본 설계" },
    { id: "own", label: "내 설계" },
  ];
  return el("div", {
    class: "spatial-source-chips",
    children: chips.map((chip) => el("button", {
      class: `spatial-source-chip${session.source === chip.id ? " is-active" : ""}`,
      text: chip.label,
      attrs: { type: "button", "aria-pressed": String(session.source === chip.id) },
      dataset: { testid: `spatial-source-${chip.id}` },
      on: { click: () => onSource(chip.id) },
    })),
  });
}

export function visibleSpatialSelection(session: SpatialAuthoringSession): SpatialGalleryCard | undefined {
  const requested = session.mode === "instances" ? session.occurrenceId : session.designId;
  if (requested) return spatialCardById(session, requested);
  return listSpatialGalleryCards(session)[0];
}

export { spatialSession };
