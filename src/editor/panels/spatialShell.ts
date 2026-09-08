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
  if (!requested && cards[0]) {
    if (session.mode === "instances") selectSpatialOccurrence(cards[0].id);
    else selectSpatialDesign(cards[0].id);
    session = spatialSession();
  }
  const selected = visibleSpatialSelection(session);

  const refresh = (): void => rerender();

  const onSelect = (id: string): void => {
    if (session.mode === "instances") selectSpatialOccurrence(id);
    else selectSpatialDesign(id);
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

  const chrome = renderSpatialChrome(session, refresh);
  wireMode(chrome, "spatial-mode-design", () => onMode("design"));
  wireMode(chrome, "spatial-mode-instances", () => onMode("instances"));

  const gallery = el("div", {
    class: "spatial-gallery",
    dataset: { testid: "spatial-gallery" },
    children: [
      renderSpatialSourceChips(session, onSource),
      el("div", {
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
    dataset: { testid: `spatial-shell-${tab}` },
    attrs: { tabindex: "0" },
    children: [chrome, el("div", { class: "spatial-body", children: [gallery, stage] })],
  });
  shell.addEventListener("keydown", (event) => handleShellKey(event, selected, refresh));
  host.append(shell);
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
