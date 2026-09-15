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
import { dismissAuthoringPreview, hasAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { selectSpatialGalleryEntry } from "./spatialGalleryNavigation";
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
  const selected = visibleSpatialSelection(session);
  // 지난 화면의 오류 배너·삭제 확인이 새 선택에 따라오면 안 된다.
  syncSpatialFeedbackSelection(`${session.tab}:${session.mode}:${session.source}:${selected?.id ?? ""}`);

  const refresh = (): void => rerender();

  const onSelect = (id: string): void => {
    const card = cards.find(card => card.id === id);
    if (card) {
      selectSpatialGalleryEntry(card);
      // 갤러리에서 카드를 골랐으니 목록 보기를 끍다 — canonical 카드는 편집기로 들어간다.
      patchSpatialSession({ listView: false });
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

  const gallery = el("div", {
    class: "spatial-gallery",
    dataset: { testid: "spatial-gallery" },
    children: [
      renderSpatialSourceChips(session, onSource),
      cards.length === 0
        ? (() => {
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
          children: cards.map((card) => renderSpatialGalleryCard(card, card.id === selected?.id, onSelect)),
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
    children: [chrome, el("div", { class: "spatial-body", children: [gallery, stage] })],
  });
  shell.addEventListener("keydown", (event) => handleShellKey(event, selected, refresh));
  latestShellRefresh = refresh;
  installSpatialEscapeLayer();
  host.append(shell);
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
