import { renderPlaceLibraryControls } from './spatialPlaceLibraryControls';
import { classifyPlaceCard, matchesPlaceClassification } from './spatialPlaceClassification';
import { canUseCompositionWorkspace } from "./spatialCompositionAccess";
import { renderSpatialCompositionWorkspace } from "./spatialCompositionWorkspace";
import { renderSpatialSpaceWorkspace } from "@/editor/panels/spatialSpaceWorkspace";
import { renderSpatialAssetBrowser } from "@/editor/panels/spatialAssetBrowser";
import { listSpatialGalleryCards, type SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import { renderSpatialGalleryCard } from "@/editor/panels/spatialGallery";
import {
  renderSpatialCanvas,
  renderSpatialChrome,
  renderSpatialInspector,
  renderSpatialSourceChips,
  visibleSpatialSelection,
} from "@/editor/panels/spatialStage";
import {
  patchSpatialSession,
  popSpatialBreadcrumb,
  selectSpatialDesign,
  selectSpatialOccurrence,
  setSpatialCamera,
  setSpatialTab,
  spatialSession,
  type SpatialAuthoringMode,
  type SpatialShellTab,
  type SpatialSourceFilter,
} from "@/editor/panels/spatialAuthoringSession";
import { setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { geographyChromeState } from "@/editor/panels/spatialGeographyChromeState";
import {
  dismissSpatialFeedback,
  spatialGalleryEmptyCopy,
  syncSpatialFeedbackSelection,
} from "@/editor/panels/spatialFeedback";
import { dismissAuthoringPreview, hasAuthoringPreview, visibleAuthoringProject } from "@/editor/panels/spatialAuthoringAccess";
import { spatialPlacesChrome, visiblePlaceSelection } from "@/editor/panels/spatialPlaceCommands";
import { spatialSpacesChrome } from "@/editor/panels/spatialSpacesTab";
import {
  designUsage,
  jumpToUsageRow,
  matchesUsageFilter,
  usageChromeState,
  usageSummary,
  type SpatialUsageFilter,
} from "@/editor/panels/spatialUsage";
import { selectSpatialGalleryEntry } from "./spatialGalleryNavigation";
import type { SpatialGalleryCard as GalleryCard } from "@/editor/panels/spatialCatalog";
import { el } from "@/util/dom";

export function renderSpatialAuthoringShell(
  host: HTMLElement,
  tab: SpatialShellTab,
  rerender: () => void,
): void {
  if (spatialSession().tab !== tab && spatialSession().breadcrumb.length === 0) setSpatialTab(tab);
  let session = spatialSession();
  const cards = listSpatialGalleryCards(session);
  const requested = session.mode === "instances" ? session.occurrenceId : session.designId;
  const first = cards.find(card => card.kind === session.tab);
  if (!requested && first) {
    if (session.mode === "instances") selectSpatialOccurrence(first.id);
    else selectSpatialDesign((tab !== "objects" && tab !== "tiles" ? cards.find(card => card.kind === session.tab && card.canonicalSource) : undefined)?.id ?? first.id);
    session = spatialSession();
  }
  let selected = visibleSpatialSelection(session);
  const placesGallery = tab === "places" && session.mode === "design";
  if (placesGallery && selected && !matchesPlaceClassification(selected)) selected = cards.find(matchesPlaceClassification);
  // 지난 화면의 오류 배너·삭제 확인이 새 선택에 따라오면 안 된다.
  syncSpatialFeedbackSelection(`${session.tab}:${session.mode}:${session.source}:${selected?.id ?? ""}`);

  const refresh = (): void => rerender();

  const onSelect = (id: string): void => {
    const card = cards.find(card => card.id === id);
    if (card) {
      selectSpatialGalleryEntry(card);
      // 장소 갤러리에서는 첫 클릭이 선택, 같은 카드 재클릭(또는 편집 버튼)이 편집기 진입이다 —
      // 선택 카드의 맵에 놓기·배치 보기 액션을 건너뛰지 않게 한다.
      if (placesGallery && card.canonicalSource) patchSpatialSession({ listView: card.id !== selected?.id });
      else if (!placesGallery) patchSpatialSession({ listView: false });
      usageChromeState.openPopoverCardId = null;
    }
    if (tab === "tiles") {
      const tilesetId = cards.find((card) => card.id === id)?.tilesetId;
      if (tilesetId) setSelectedTileset(tilesetId);
    }
    refresh();
  };
  const onMode = (mode: SpatialAuthoringMode): void => {
    patchSpatialSession({ mode });
    refresh();
  };
  const onSource = (source: SpatialSourceFilter): void => {
    patchSpatialSession({ source });
    refresh();
  };

  if (selected?.canonicalSource && !selected.regionMapId && tab !== "objects" && tab !== "tiles" && session.mode === "design" && !session.legacyOrigin && !session.listView && canUseCompositionWorkspace(selected.canonicalSource)) {
    const workspace = renderSpatialCompositionWorkspace(session, selected, refresh);
    workspace.addEventListener("keydown", event => handleShellKey(event, selected, refresh));
    latestShellRefresh = refresh; installSpatialEscapeLayer(); host.append(workspace); return;
  }
  if ((tab === "objects" || tab === "spaces") && session.mode === "design" && !session.legacyOrigin) {
    const browser = tab === "spaces"
      ? renderSpatialSpaceWorkspace(session, selected, refresh)
      : renderSpatialAssetBrowser(session, selected, refresh);
    browser.addEventListener("keydown", (event) => handleShellKey(event, selected, refresh));
    latestShellRefresh = refresh;
    installSpatialEscapeLayer();
    host.append(browser);
    return;
  }

  const villageStudio = session.legacyOrigin === "villages" && session.tab === "regions";
  const chrome = villageStudio ? el("div", { class: "spatial-chrome", children: [el("button", {
    class: "db-ws-btn", text: "지역 목록으로", attrs: { type: "button" }, dataset: { testid: "spatial-village-back" },
    on: { click: () => { setSpatialTab("regions"); refresh(); } },
  }), el("strong", { text: "마을 설계서" })] }) : renderSpatialChrome(session, refresh);
  wireMode(chrome, "spatial-mode-design", () => onMode("design"));
  wireMode(chrome, "spatial-mode-instances", () => onMode("instances"));

  const project = visibleAuthoringProject();
  // 기본 카탈로그 카드의 localId 는 라이브러리 설계 id 와 겹치므로 canonical 만 쓰임을 갖는다.
  const designIdOf = (card: GalleryCard): string | undefined => card.canonicalSource?.id;
  const galleryCards = placesGallery
    ? cards.filter((card) => matchesPlaceClassification(card) && matchesUsageFilter(designUsage(project, designIdOf(card)), usageChromeState.filter))
    : cards;
  const aiPlacedCount = placesGallery
    ? cards.filter((card) => designUsage(project, designIdOf(card)).ai > 0).length
    : 0;
  const usageChip = (filter: SpatialUsageFilter, label: string): HTMLElement => el("button", {
    class: `spatial-source-chip${usageChromeState.filter === filter ? " is-active" : ""}`,
    text: label,
    attrs: { type: "button", "aria-pressed": String(usageChromeState.filter === filter) },
    dataset: { testid: `spatial-usage-filter-${filter}` },
    on: { click: () => { usageChromeState.filter = filter; usageChromeState.openPopoverCardId = null; usageChromeState.galleryScrollTop = 0; refresh(); } },
  });
  const renderCell = (card: GalleryCard): HTMLElement => {
    const isSelected = card.id === selected?.id;
    const button = renderSpatialGalleryCard(card, isSelected, onSelect);
    const classification = classifyPlaceCard(card);
    button.append(el('div', { class: 'place-classification-badges', children: [classification.category, classification.environment, ...classification.purposes].map(text => el('span', { text })) }));
    if (!isSelected || !card.canonicalSource) return el("div", { class: "spatial-card-cell", children: [button] });
    const usage = designUsage(project, designIdOf(card));
    const build = card.kind === "places" ? spatialPlacesChrome(visiblePlaceSelection(card), refresh).build
      : card.kind === "spaces" ? spatialSpacesChrome(card, refresh).build : undefined;
    const popoverOpen = usageChromeState.openPopoverCardId === card.id;
    const actions = el("div", { class: "spatial-cell-actions", dataset: { testid: "spatial-cell-actions" }, children: [
      el("button", {
        class: "spatial-action is-primary", text: "맵에 놓기",
        attrs: { type: "button", title: "이 설계로 새 맵을 생성해 미리보기를 만듭니다 — 적용을 누르면 확정", ...(build ? {} : { disabled: "" }) },
        dataset: { testid: "spatial-cell-build" },
        on: build ? { click: () => { build(); refresh(); } } : undefined,
      }),
      el("button", {
        class: "spatial-action", text: "편집",
        attrs: { type: "button" },
        dataset: { testid: "spatial-cell-edit" },
        on: { click: () => { selectSpatialGalleryEntry(card); patchSpatialSession({ listView: false }); usageChromeState.openPopoverCardId = null; refresh(); } },
      }),
      ...(usage.rows.length ? [el("button", {
        class: "spatial-action", text: `배치 ${usage.rows.length} ${popoverOpen ? "▴" : "▾"}`,
        attrs: { type: "button", "aria-expanded": String(popoverOpen) },
        dataset: { testid: "spatial-cell-usage" },
        on: { click: () => { usageChromeState.openPopoverCardId = popoverOpen ? null : card.id; refresh(); } },
      })] : []),
    ] });
    return el("div", {
      class: "spatial-card-cell is-selected",
      children: [button, actions, ...(popoverOpen ? [renderUsagePopover(card, usage)] : [])],
    });
  };
  const gallery = el("div", {
    class: "spatial-gallery",
    dataset: { testid: "spatial-gallery" },
    children: [
      el("div", { class: "spatial-gallery-filters", children: [
        renderSpatialSourceChips(session, onSource),
        ...(placesGallery ? [el("div", { class: "spatial-usage-chips", dataset: { testid: "spatial-usage-chips" }, children: [
          el("span", { class: "spatial-usage-chips-label", text: "쓰임" }),
          usageChip("all", "전체"), usageChip("placed", "배치됨"), usageChip("idle", "안 쓰임"),
          usageChip("ai", aiPlacedCount > 0 ? `AI가 놓음 ${aiPlacedCount}` : "AI가 놓음"),
        ] })] : []),
      ] }),
      galleryCards.length === 0
        ? (() => {
          if (cards.length > 0) {
            return el("div", {
              class: "spatial-gallery-empty",
              dataset: { testid: "spatial-gallery-empty" },
              children: [
                el("p", { class: "spatial-gallery-empty-title", text: "조건에 맞는 설계가 없습니다" }),
                el("p", { class: "spatial-gallery-empty-body", text: "그림체·유형·공간 형태·용도 또는 쓰임 필터를 바꿔 보세요." }),
              ],
            });
          }
          const copy = spatialGalleryEmptyCopy(session.mode, session.tab);
          return el("div", {
            class: "spatial-gallery-empty",
            dataset: { testid: "spatial-gallery-empty" },
            children: [
              el("p", { class: "spatial-gallery-empty-title", text: copy.title }),
              el("p", { class: "spatial-gallery-empty-body", text: copy.body }),
            ],
          });
        })()
        : el("div", {
          class: "spatial-gallery-grid",
          children: placesGallery
            ? galleryCards.map(renderCell)
            : galleryCards.map((card) => renderSpatialGalleryCard(card, card.id === selected?.id, onSelect)),
        }),
    ],
  });

  const stage = el("div", {
    class: `spatial-stage${session.inspectorOpen ? " is-inspector-open" : ""}`,
    children: [
      renderSpatialCanvas(session, selected, refresh),
      renderSpatialInspector(selected, session.inspectorOpen, refresh),
    ],
  });

  const shell = el("div", {
    class: "spatial-shell",
    dataset: { testid: `spatial-shell-${tab}`, ...(villageStudio ? { legacyOrigin: "villages" } : {}) },
    attrs: { tabindex: "0" },
    // 셀은 정확히 두 행(chrome / 본문)이다. 목적 스트립을 셀의 세 번째 자식으로 넣으면
    // 본문이 암시 행으로 밀려 잘린다 — 둘을 한 래퍼로 묶어 둘째 행에 넣는다.
    children: [chrome, placesGallery
      ? el("div", { class: "spatial-shell-main", children: [renderPlaceLibraryControls(cards, refresh), el("div", { class: "spatial-body", children: [gallery, stage] })] })
      : el("div", { class: "spatial-body", children: [gallery, stage] })],
  });
  shell.addEventListener("keydown", (event) => handleShellKey(event, selected, refresh));
  latestShellRefresh = refresh;
  installSpatialEscapeLayer();
  host.append(shell);
  // 셸은 리프레시마다 통째로 다시 만들어져 스크롤이 0 으로 돌아간다. 장소 갤러리에서는 그러면
  // 카드 액션을 누른 사용자가 목록 맨 위로 튕기고, 카드 아래에 붙는 배치 팝오버는 화면 밖에 남는다.
  // 다른 탭은 이 기억을 쓰지 않는다 — 탭을 오가며 남의 목록 위치가 복원되면 안 된다.
  const grid = shell.querySelector<HTMLElement>(".spatial-gallery-grid");
  if (grid) {
    if (placesGallery) {
      grid.scrollTop = usageChromeState.galleryScrollTop;
      grid.addEventListener("scroll", () => { usageChromeState.galleryScrollTop = grid.scrollTop; }, { passive: true });
      if (usageChromeState.openPopoverCardId !== null) {
        shell.querySelector<HTMLElement>('[data-testid="spatial-usage-popover"]')?.scrollIntoView({ block: "nearest" });
      }
    }
  }
}

let latestShellRefresh: (() => void) | null = null;
let escapeLayerInstalled = false;

/**
 * 포커스가 셸 밖(document/body)에 있어도, 오류 배너·미리보기 같은 전이 UI 가 떠 있으면
 * 첫 Escape 는 그것만 걷어야 한다. 모달의 닫기는 document 버블 단계라 캡처에서 앞선다.
 * 모듈에 한 번만 단다 — 셸은 매 렌더마다 다시 만들어지므로 리스너를 따라가지 않는다.
 */
function installSpatialEscapeLayer(): void {
  if (escapeLayerInstalled) return;
  escapeLayerInstalled = true;
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (!document.querySelector(".database-modal-body .spatial-shell")) return;
    const target = event.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
    }
    if (!dismissSpatialFeedback() && !hasAuthoringPreview()) return;
    dismissAuthoringPreview();
    event.preventDefault();
    event.stopPropagation();
    latestShellRefresh?.();
  }, true);
}

function renderUsagePopover(card: GalleryCard, usage: ReturnType<typeof designUsage>): HTMLElement {
  return el("div", {
    class: "spatial-usage-popover",
    dataset: { testid: "spatial-usage-popover" },
    children: [
      el("div", { class: "spatial-usage-popover-head", children: [
        el("strong", { text: `${card.name} — 배치된 곳 ${usage.rows.length}` }),
        el("span", { class: "spatial-usage-popover-count", text: usageSummary(usage) }),
      ] }),
      ...usage.rows.map((row) => el("div", { class: "spatial-usage-row", dataset: { testid: "spatial-usage-row", origin: row.origin }, children: [
        el("span", { class: `spatial-usage-origin${row.origin === "ai" ? " is-ai" : ""}`, text: row.origin === "ai" ? "✦ AI 배치" : "직접 배치" }),
        el("span", { class: "spatial-usage-where", text: `「${row.mapName}」 (${row.x}, ${row.y})` }),
        el("button", {
          class: "spatial-action", text: "맵으로 →",
          attrs: { type: "button", title: "DB 창을 닫고 그 맵의 그 자리로 이동합니다", ...(row.mapId ? {} : { disabled: "" }) },
          dataset: { testid: "spatial-usage-jump" },
          on: row.mapId ? { click: () => { jumpToUsageRow(row); } } : undefined,
        }),
      ] })),
    ],
  });
}

function wireMode(chrome: HTMLElement, testid: string, onClick: () => void): void {
  const button = chrome.querySelector(`[data-testid="${testid}"]`);
  if (!(button instanceof HTMLButtonElement)) return;
  button.addEventListener("click", onClick);
}

function handleShellKey(event: KeyboardEvent, selected: SpatialGalleryCard | undefined, refresh: () => void): void {
  const target = event.target;
  if (target instanceof HTMLElement) {
    const tag = target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
  }
  const session = spatialSession();
  if (event.key === "Escape") {
    if (geographyChromeState.gesture || geographyChromeState.routeDraft.length > 0) {
      event.preventDefault();
      geographyChromeState.gesture = null;
      geographyChromeState.routeDraft = [];
      geographyChromeState.previewError = null;
      refresh();
      return;
    }
    // 떠 있는 오류·미리보기부터 단계적으로 걷는다 — 한 번의 Escape 가 모달까지 닫으면 안 된다.
    if (dismissSpatialFeedback()) {
      event.preventDefault();
      refresh();
      return;
    }
    if (hasAuthoringPreview()) {
      event.preventDefault();
      dismissAuthoringPreview();
      refresh();
      return;
    }
    if (session.inspectorOpen) {
      event.preventDefault();
      patchSpatialSession({ inspectorOpen: false });
      refresh();
      return;
    }
    if (session.breadcrumb.length === 0) return;
    event.preventDefault();
    popSpatialBreadcrumb();
    refresh();
    return;
  }
  if (event.key === "Enter" && selected) {
    if (target instanceof HTMLElement && target !== event.currentTarget) return;
    event.preventDefault();
    return;
  }
  const step = event.shiftKey ? 5 : 1;
  if (event.key === "ArrowLeft") nudge(-step, 0, refresh);
  if (event.key === "ArrowRight") nudge(step, 0, refresh);
  if (event.key === "ArrowUp") nudge(0, -step, refresh);
  if (event.key === "ArrowDown") nudge(0, step, refresh);
}

function nudge(x: number, y: number, refresh: () => void): void {
  const camera = spatialSession().camera;
  setSpatialCamera({ x: camera.x + x, y: camera.y + y, zoom: camera.zoom });
  refresh();
}
