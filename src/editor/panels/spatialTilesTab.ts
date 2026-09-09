import { getMapEditHistoryState, undoMapEdit, redoMapEdit } from "@/editor/mapEditHistory";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { spatialAuthoringController } from "@/editor/panels/spatialAuthoringAccess";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { setSelectedTileset } from "@/editor/panels/tilesetSettingsPanel";
import { store } from "@/project/store";
import { el } from "@/util/dom";

export type SpatialDomainChrome = {
  readonly add?: () => void;
  readonly duplicate?: () => void;
  readonly delete?: () => void;
  readonly preview?: () => void;
  readonly apply?: () => void;
  readonly refresh?: () => void;
  readonly detach?: () => void;
  readonly undo?: () => void;
  readonly redo?: () => void;
  readonly build?: () => void;
  readonly buildSeed?: number | null;
  readonly buildSeedText?: string;
  readonly onBuildSeed?: (raw: string) => void;
  readonly buildInputText?: string;
  readonly saveState: string;
  readonly previewError: string | null;
  readonly deleteOpen?: boolean;
  readonly onDeleteConfirm?: () => void;
};

export function renderSpatialTilesCanvas(
  session: SpatialAuthoringSession,
  card: SpatialGalleryCard | undefined,
  rerender: () => void,
): HTMLElement {
  const tilesetId = card?.tilesetId ?? session.designId;
  const tileset = tilesetId ? store.getCurrent().tilesets[tilesetId] : undefined;
  if (tilesetId) setSelectedTileset(tilesetId);
  if (!tileset) {
    return el("div", {
      class: "spatial-canvas spatial-tiles-canvas",
      attrs: { tabindex: "0", "aria-label": "타일 캔버스" },
      dataset: { testid: "spatial-canvas" },
      children: [el("div", { class: "spatial-canvas-empty", text: "타일셋이 없습니다" })],
    });
  }
  const editor = renderTilesetEditor(tileset, rerender);
  editor.classList.add("spatial-tiles-editor");
  editor.dataset.testid = "spatial-tiles-editor";
  return el("div", {
    class: "spatial-canvas spatial-tiles-canvas tileset-db-workspace db-ws-tilesets",
    attrs: { tabindex: "0", "aria-label": "타일 캔버스" },
    dataset: { testid: "spatial-canvas" },
    children: [editor],
  });
}

export function spatialTilesChrome(): SpatialDomainChrome {
  const controller = spatialAuthoringController();
  const history = getMapEditHistoryState();
  return {
    saveState: "읽기",
    previewError: null,
    undo: controller ? () => { controller.undo(); } : history.canUndo ? () => { undoMapEdit(); } : undefined,
    redo: controller ? () => { controller.redo(); } : history.canRedo ? () => { redoMapEdit(); } : undefined,
  };
}
