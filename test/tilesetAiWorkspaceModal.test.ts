import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderTileGroupPanel } from "@/editor/panels/tilesetGroupEditor";
import { renderTilesetEditor } from "@/editor/panels/tilesetSettingsDetails";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let cleanupDom: (() => void) | null = null;
let tilesetId = "";

function currentTileset(): TilesetDef {
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset fixture");
  return tileset;
}

describe("AI tileset workspace entry", () => {
  beforeEach(() => {
    cleanupDom = installFakeDom();
    const project = createBlankProject();
    tilesetId = Object.keys(project.tilesets)[0] ?? "";
    store.replace(project);
  });

  afterEach(() => {
    cleanupDom?.();
    cleanupDom = null;
  });

  it("keeps the human knowledge editor visible without an inline AI inbox", () => {
    // Given / When
    const panel = renderWithFakeDom(() => renderTileGroupPanel(currentTileset(), () => undefined));

    // Then
    expect(findByTestId(panel, "tileset-knowledge-template-water-autotile-3x3")).not.toBeNull();
    expect(findByTestId(panel, "tileset-ai-review-inbox")).toBeNull();
    expect(findByTestId(panel, "tileset-ai-review-manual")).toBeNull();
  });

  it("puts one AI Tileset launcher at the bottom of the normal editor", () => {
    // Given / When
    const editor = renderWithFakeDom(() => renderTilesetEditor(currentTileset(), () => undefined));

    // Then
    expect(findByTestId(editor, "tileset-ai-workspace-open")?.textContent).toContain("AI");
  });
});
