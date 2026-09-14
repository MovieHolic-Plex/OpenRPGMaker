import { openNewPlaceDialog } from "./spatialNewPlaceDialog";
import { renderWorldGenTab } from "@/editor/panels/databaseWorldGenView";
import { renderVillageTab } from "@/editor/panels/databaseVillageView";
import { renderTilesetSpacesTab } from "@/editor/panels/tilesetSpacesTab";
import { listSpatialGalleryCards, spatialCardById, type SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { renderSpatialCardThumb } from "@/editor/panels/spatialGallery";
import {
  patchSpatialSession,
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
import { renderSpatialBuildChrome, renderSpatialBuildPanel } from "@/editor/panels/spatialBuildChrome";
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
import { cardSubtitle, humanizeSpatialError, spatialSourceLabel } from "@/editor/panels/spatialFeedback";
import { activateSpatialDocument, workingProject } from "@/editor/panels/spatialGeographyCommands";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import { el } from "@/util/dom";

const KIND_GUIDANCE: Partial<Record<SpatialAuthoringSession["tab"], string>> = {
  objects: "오브젝트 · 가구, 소품, 건물 외형처럼 다시 쓰는 그림입니다. 건물 안의 방·층은 장소에서 만드세요.",
  spaces: "장소 · 방, 한 층, 마당처럼 이용할 구역입니다. 바닥·벽·오브젝트·출입구를 정하고 장소에 모을 수 있습니다.",
  places: "장소 · 방·마당부터 여러 층의 건물까지 만듭니다. 새 장소에서 실내·실외·건물을 선택하세요.",
};

const TAB_LABEL = {
  tiles: "타일",
  objects: "오브젝트",
  spaces: "장소",
  places: "장소",
  regions: "지역",
  worlds: "세계",
} as const;

/** 액션 라벨만으로는 분리·시공·적용의 차이를 알 수 없다 — 네이티브 title 로 설명을 단다. */
const ACTION_HINT: Readonly<Record<string, string>> = {
  "spatial-add": "새 설계 초안을 만듭니다",
  "spatial-duplicate": "선택한 설계를 복제해 내 설계로 만듭니다",
  "spatial-delete": "선택한 설계·배치를 삭제합니다",
  "spatial-preview": "편집 초안을 프로젝트에 미리 적용해 봅니다",
  "spatial-apply": "미리보기 상태를 프로젝트에 확정합니다",
  "spatial-refresh": "배치된 곳을 최신 설계로 다시 생성합니다",
  "spatial-detach": "배치를 원본 설계에서 분리해 독립 사본으로 만듭니다",
  "spatial-undo": "마지막 편집을 되돌립니다",
  "spatial-redo": "되돌린 편집을 다시 실행합니다",
};

function actionButton(id: string, label: string, enabled: boolean, onClick?: () => void): HTMLElement {
  return el("button", {
    class: "spatial-action",
    text: label,
    attrs: {
      type: "button",
      ...(ACTION_HINT[id] ? { title: ACTION_HINT[id] } : {}),
      ...(enabled ? {} : { disabled: "" }),
    },
    dataset: { testid: id },
    on: enabled && onClick ? { click: onClick } : undefined,
  });
}

export function inspectorSourceLabel(card: SpatialGalleryCard): string {
  return spatialSourceLabel(card);
}

function domainChrome(session: SpatialAuthoringSession, onChange: () => void): SpatialDomainChrome | undefined {
  const selected = visibleSpatialSelection(session);
  let chrome = session.tab === "tiles" ? spatialTilesChrome()
    : session.tab === "objects" ? spatialObjectsChrome(selected, onChange)
    : session.tab === "spaces" ? spatialSpacesChrome(selected, onChange)
    : session.tab === "places" ? spatialPlacesChrome(visiblePlaceSelection(selected), onChange)
    : session.tab === "regions" ? spatialRegionsChrome(selected, onChange)
    : session.tab === "worlds" ? spatialWorldsChrome(selected, onChange)
    : undefined;
  if (chrome?.add && (session.tab === "spaces" || session.tab === "places")) {
    chrome = { ...chrome, add: () => openNewPlaceDialog(onChange) };
  }
  // Canonical 문서가 없으면 어느 탭이든 프로젝트 수준 활성화 경로와 그 오류를 표면에 올린다.
  if (chrome && !selected?.regionReferenceId && !workingProject().spatialAuthoring) {
    return { ...chrome,
      previewError: chrome.previewError ?? geographyChromeState.previewError,
      activate: chrome.activate ?? (geographyChromeState.activating ? undefined : () => activateSpatialDocument(onChange)) };
  }
  return chrome;
}

export function renderSpatialChrome(
  session: SpatialAuthoringSession,
  onChange: () => void,
  options: { browser?: boolean; onAdd?: () => void } = {},
): HTMLElement {
  if (options.browser) return renderBrowserChrome(session, onChange, options.onAdd);
  const selected = visibleSpatialSelection(session);
  const crumbLabel = selected?.name ?? TAB_LABEL[session.tab];
  const chrome = domainChrome(session, onChange);
  const previewError = chrome?.previewError ?? null;
  const buildPanel = selected?.regionReferenceId ? undefined : renderSpatialBuildPanel(session.tab);
  return el("div", {
    class: "spatial-chrome",
    children: [
      el("div", {
        class: "spatial-modes",
        children: [
          el("button", {
            class: `spatial-mode${session.mode === "design" ? " is-active" : ""}`,
            text: "설계",
            attrs: { type: "button", "aria-pressed": String(session.mode === "design"), title: "설계 — 편집 가능한 설계 도서관" },
            dataset: { testid: "spatial-mode-design" },
          }),
          el("button", {
            class: `spatial-mode${session.mode === "instances" ? " is-active" : ""}`,
            text: "배치된 곳",
            attrs: { type: "button", "aria-pressed": String(session.mode === "instances"), title: "배치된 곳 — 실제 맵에 놓인 결과물" },
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
        attrs: { "aria-label": "장소 위치" },
        dataset: { testid: "spatial-breadcrumb" },
        children: [
          // 항상 disabled인 ← 는 자리만 차지한다 — 되돌아갈 부모가 있을 때만 단다.
          ...(session.breadcrumb.length > 0 ? [el("button", {
            class: "spatial-back",
            text: "←",
            attrs: { type: "button", "aria-label": "뒤로", title: "상위 항목으로 돌아갑니다" },
            dataset: { testid: "spatial-back" },
            on: {
              click: () => {
                restoreGeographyParent(onChange);
              },
            },
          })] : []),
          el("span", { class: "spatial-crumb-label", text: crumbLabel, dataset: { testid: "spatial-name" } }),
        ],
      }),
      el("div", {
        class: "spatial-actions",
        children: [
          ...(selected?.regionReferenceId ? [] : [
            actionButton("spatial-activate", "장소 설계 활성화", Boolean(chrome?.activate), chrome?.activate),
            actionButton("spatial-add", "추가", Boolean(chrome?.add), chrome?.add),
            actionButton("spatial-duplicate", "복제", Boolean(chrome?.duplicate), chrome?.duplicate),
            actionButton("spatial-delete", "삭제", Boolean(chrome?.delete), chrome?.delete),
            actionButton("spatial-preview", "미리보기", Boolean(chrome?.preview), chrome?.preview),
            ...renderSpatialBuildChrome(session.tab, chrome),
            actionButton("spatial-apply", "적용", Boolean(chrome?.apply), chrome?.apply),
            actionButton("spatial-refresh", "새로고침", Boolean(chrome?.refresh), chrome?.refresh),
            actionButton("spatial-detach", "분리", Boolean(chrome?.detach), chrome?.detach),
            actionButton("spatial-undo", "되돌리기", Boolean(chrome?.undo), chrome?.undo),
            actionButton("spatial-redo", "다시 실행", Boolean(chrome?.redo), chrome?.redo),
          ]),
          el("span", {
            class: "spatial-save-state",
            text: chrome?.saveState ?? "읽기",
            attrs: { title: "편집 상태 — 읽기 · 초안 · 미리보기 · 적용" },
            dataset: { testid: "spatial-save-state" },
          }),
          el("button", {
            class: "spatial-delete-confirm",
            text: "확인",
            attrs: { type: "button", ...(chrome?.deleteOpen ? {} : { hidden: "" }) },
            dataset: { testid: "spatial-delete-confirm" },
            on: chrome?.onDeleteConfirm ? { click: chrome.onDeleteConfirm } : undefined,
          }),
          el("span", {
            class: "spatial-preview-error",
            text: humanizeSpatialError(previewError) ?? "",
            attrs: { role: "status", ...(previewError ? {} : { hidden: "" }) },
            dataset: { testid: "spatial-preview-error" },
          }),
        ],
      }),
      ...(KIND_GUIDANCE[session.tab] ? [el("p", {
        class: "spatial-kind-guidance",
        text: KIND_GUIDANCE[session.tab],
        dataset: { testid: "spatial-kind-guidance" },
      })] : []),
      ...(buildPanel ? [buildPanel] : []),
    ],
  });
}

function renderLegacyStage(session: SpatialAuthoringSession, rerender: () => void): HTMLElement | null {
  const host = el("div", { class: "spatial-legacy-host" });
  if (session.legacyOrigin === "tilesetSpaces" && session.tab === "spaces") {
    renderTilesetSpacesTab(host, rerender);
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
  // 기존 마을 설계는 지역 탭의 레거시 스테이지 — 레시피(집 형태·설계서) 편집 표면을 그대로 띄운다.
  if (session.legacyOrigin === "villages" && session.tab === "regions") {
    const host = el("div", { class: "spatial-legacy-host" });
    renderVillageTab(host, rerender);
    return el("div", {
      class: "spatial-canvas",
      attrs: { tabindex: "0", "aria-label": "장소 캔버스" },
      dataset: { testid: "spatial-canvas" },
      children: [host],
    });
  }
  if (session.tab === "tiles") return renderSpatialTilesCanvas(session, card, rerender);
  if (session.tab === "objects") return renderSpatialObjectsCanvas(session, card);
  if (session.tab === "spaces") return renderSpatialSpacesCanvas(session, card, rerender);
  if (session.tab === "places") return renderSpatialPlacesCanvas(session, visiblePlaceSelection(card), rerender);
  if (session.tab === "regions") return renderSpatialRegionsCanvas(session, card, rerender);
  if (session.tab === "worlds") return renderSpatialWorldsCanvas(session, card, rerender);
  const legacy = renderLegacyStage(session, rerender);
  const art = card
    ? renderSpatialCardThumb(card)
    : el("div", {
      class: "spatial-canvas-empty",
      text: "선택된 항목이 없습니다 — 왼쪽 목록에서 고르세요",
      dataset: { testid: "spatial-canvas-empty" },
    });
  art.classList.add("spatial-canvas-art");
  return el("div", {
    class: "spatial-canvas",
    attrs: { tabindex: "0", "aria-label": "장소 캔버스" },
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
    const subtitle = cardSubtitle(card);
    if (subtitle) body.push(el("p", { class: "spatial-inspector-sub", text: subtitle }));
    body.push(el("dl", {
      class: "spatial-inspector-facts",
      children: [
        el("dt", { text: "분류" }),
        el("dd", { text: inspectorSourceLabel(card) }),
        ...(card.usage > 0 ? [el("dt", { text: "사용" }), el("dd", { text: String(card.usage) })] : []),
      ],
    }));
  } else {
    body.push(el("p", { class: "spatial-inspector-sub", text: "선택된 항목이 없습니다" }));
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
  return listSpatialGalleryCards(session).find(card => card.kind === session.tab);
}

export { spatialSession };

function renderBrowserChrome(session: SpatialAuthoringSession, onChange: () => void, onAdd?: () => void): HTMLElement {
  const chrome = domainChrome(session, onChange);
  const panel = renderSpatialBuildPanel(session.tab);
  const more = el("details", { class: "asset-browser-more", attrs: chrome?.deleteOpen ? { open: "" } : {}, children: [
    el("summary", { text: "배치·관리" }),
    el("div", { class: "asset-browser-more-body", children: [
      actionButton("spatial-mode-instances", "맵에 배치된 항목", true, () => { patchSpatialSession({ mode: "instances" }); onChange(); }),
      ...(chrome?.activate && session.tab !== "spaces" ? [actionButton("spatial-activate", "장소 설계 활성화", true, chrome.activate)] : []),
      actionButton("spatial-delete", "삭제", Boolean(chrome?.delete), chrome?.delete),
      ...(chrome?.deleteOpen ? [actionButton("spatial-delete-confirm", "삭제 확인", true, chrome.onDeleteConfirm)] : []),
      ...renderSpatialBuildChrome(session.tab, chrome),
      ...(panel ? [panel] : []),
    ] }),
  ] });
  return el("div", { class: "asset-browser-actions", children: [
    ...(session.breadcrumb.length ? [actionButton("spatial-back", "← 상위 항목", true, () => restoreGeographyParent(onChange))] : []),
    ...(session.tab === "spaces" && chrome?.activate ? [actionButton("spatial-activate", "장소 배치 시작", true, chrome.activate)] : []),
    actionButton("spatial-add", `+ 새 ${TAB_LABEL[session.tab]}`, Boolean(onAdd ?? chrome?.add) && (session.tab !== "spaces" || Boolean(workingProject().spatialAuthoring)), onAdd ?? chrome?.add),
    ...(chrome?.duplicate ? [actionButton("spatial-duplicate", "복제", true, chrome.duplicate)] : []),
    actionButton("spatial-preview", "변경 미리보기", Boolean(chrome?.preview), chrome?.preview),
    actionButton("spatial-apply", "변경 적용", Boolean(chrome?.apply), chrome?.apply),
    actionButton("spatial-undo", "되돌리기", Boolean(chrome?.undo), chrome?.undo),
    actionButton("spatial-redo", "다시 실행", Boolean(chrome?.redo), chrome?.redo),
    more,
    el("span", { class: "asset-browser-status", text: chrome?.saveState === "초안" ? "적용하지 않은 변경이 있습니다" : chrome?.saveState ?? "", dataset: { testid: "spatial-save-state" } }),
    el("p", { class: "asset-browser-error", text: humanizeSpatialError(chrome?.previewError ?? null) ?? "", attrs: { role: "status", ...(chrome?.previewError ? {} : { hidden: "" }) }, dataset: { testid: "spatial-preview-error" } }),
  ] });
}
