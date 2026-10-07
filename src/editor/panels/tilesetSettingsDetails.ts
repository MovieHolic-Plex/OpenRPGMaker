import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { getTilesetSectionTab, renderTilesetMetadataEditor } from "@/editor/panels/tilesetMetadataEditor";
import { renderTilesetRoomKitPanel } from "@/editor/panels/tilesetRoomKitPanel";
import { renderSectionTabs, renderTilesetProperties } from "@/editor/panels/tilesetSettingsProperties";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function renderTilesetEditor(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const tab = getTilesetSectionTab();
  const editor = el("section", {
    class: `tileset-library-editor tileset-library-section-${tab}`,
    children: [renderSectionTabs(rerender), el("div", {
      class: "tileset-library-workbench", attrs: { role: "tabpanel", "aria-label": "타일셋 내용" },
      children: [tab === "settings" ? renderTilesetProperties(tileset, rerender)
        : tab === "rooms" ? renderTilesetRoomKitPanel(tileset, rerender)
        : renderTilesetMetadataEditor(tileset, rerender)],
    })],
  });
  installDelayedTooltips(editor);
  return editor;
}
