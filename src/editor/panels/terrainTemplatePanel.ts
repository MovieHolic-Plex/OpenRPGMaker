import { createMapScreenshot } from "@/editor/mapScreenshot";
import { editorState } from "@/editor/editorState";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import type { GameMap, TerrainTemplateGrammarRule, TerrainTemplateMetadata, TerrainTemplateRow, TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

export function openTerrainTemplateModal(): void {
  document.querySelector("[data-testid='terrain-template-modal']")?.remove();
  const template = currentTerrainTemplate();
  const closeButton = el("button", {
    class: "database-modal-close",
    text: "x",
    attrs: { type: "button", title: "Close", "aria-label": "Close terrain template" },
    dataset: { testid: "terrain-template-modal-close" },
  });
  const body = el("div", { class: "database-modal-body terrain-template-modal-body" });

  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "terrain-template-modal" },
    children: [
      el("section", {
        class: "database-modal-window terrain-template-modal-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "Terrain template table" },
        children: [
          el("header", {
            class: "database-modal-header",
            children: [el("h2", { text: "지형 템플릿" }), closeButton],
          }),
          body,
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  if (!template) {
    body.append(el("p", { class: "empty-hint", text: "No terrain template is stored on this tileset." }));
  } else {
    const context = currentTemplateContext();
    if (context) body.append(renderTemplate(template, context.map, context.tileset));
    else body.append(renderTemplateWithoutMap(template));
  }
  closeButton.focus();
}

function renderTemplate(template: TerrainTemplateMetadata, map: GameMap, tileset: TilesetDef): HTMLElement {
  const previewImage = el("img", {
    class: "terrain-template-preview-image",
    attrs: { alt: `${template.sourceMapName} screenshot` },
  }) as HTMLImageElement;
  void createMapScreenshot(store.getCurrent(), map).then((screenshot) => {
    const url = URL.createObjectURL(screenshot.blob);
    previewImage.src = url;
    previewImage.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
  }).catch((error: unknown) => {
    previewImage.alt = error instanceof Error ? error.message : "Failed to render map screenshot";
  });

  return el("div", {
    class: "terrain-template-panel",
    children: [
      el("div", {
        class: "terrain-template-layout",
        children: [
          el("section", {
            class: "terrain-template-preview",
            children: [
              el("h3", { text: "스크린샷" }),
              el("div", { class: "terrain-template-preview-frame", children: [previewImage] }),
            ],
          }),
          el("section", {
            class: "terrain-template-text",
            children: [
              el("h3", { text: template.name }),
              renderTemplateMeta(template, map),
              el("h4", { text: "구성 원칙" }),
              renderTemplateRules(template.rules),
              renderTemplateGrammar(template.grammar ?? []),
              renderJsonDetails(template),
            ],
          }),
        ],
      }),
      el("section", {
        class: "terrain-template-table-section",
        children: [
          el("h3", { text: "타일 표" }),
          renderTemplateTable(template.rows, tileset),
        ],
      }),
    ],
  });
}

function renderTemplateWithoutMap(template: TerrainTemplateMetadata): HTMLElement {
  return el("div", {
    class: "terrain-template-panel",
    children: [
      el("p", { class: "terrain-template-summary", text: `${template.name} / ${template.sourceMapName}` }),
      renderTemplateRules(template.rules),
      renderJsonDetails(template),
    ],
  });
}

function renderTemplateMeta(template: TerrainTemplateMetadata, map: GameMap): HTMLElement {
  return el("div", {
    class: "terrain-template-meta-grid",
    children: [
      metaItem("원본", template.sourceMapName),
      metaItem("타일셋", map.tilesetId),
      metaItem("바탕", "240: 풀밭 ground"),
    ],
  });
}

function metaItem(label: string, value: string): HTMLElement {
  return el("div", {
    class: "terrain-template-meta-item",
    children: [
      el("span", { class: "terrain-template-meta-label", text: label }),
      el("span", { class: "terrain-template-meta-value", text: value }),
    ],
  });
}

function currentTerrainTemplate(): TerrainTemplateMetadata | null {
  return currentTemplateContext()?.tileset.terrainTemplates?.[0] ?? null;
}

function currentTemplateContext(): { readonly map: GameMap; readonly tileset: TilesetDef } | null {
  const project = store.getCurrent();
  const state = editorState.get();
  const map = project.maps[state.currentMapId ?? project.startMapId];
  if (!map) return null;
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) return null;
  return { map, tileset };
}

function renderTemplateTable(rows: readonly TerrainTemplateRow[], tileset: TilesetDef): HTMLElement {
  const wrap = el("div", { class: "terrain-template-table-wrap" });
  const table = el("table", { class: "terrain-template-table" });
  table.append(
    rowElement(["구역", "좌표/범위", "하위", "상위", "스택", "의미"], "th")
  );
  for (const row of rows) {
    const tr = el("tr");
    tr.append(
      el("td", { text: row.section }),
      el("td", { class: "terrain-template-coord", text: row.coord }),
      el("td", { children: [renderTileList(tileset, row.lower)] }),
      el("td", { children: [renderTileList(tileset, row.upper)] }),
      el("td", { children: [renderTileList(tileset, row.stack)] }),
      el("td", { text: row.meaning })
    );
    table.append(tr);
  }
  wrap.append(table);
  return wrap;
}

function renderTemplateRules(rules: readonly string[]): HTMLElement {
  const list = el("ul", { class: "terrain-template-rules" });
  for (const rule of rules) list.append(el("li", { text: rule }));
  return list;
}

function renderTemplateGrammar(grammar: readonly TerrainTemplateGrammarRule[]): HTMLElement {
  if (grammar.length === 0) return el("div", { class: "terrain-template-empty", text: "구성 문법 없음" });
  const wrap = el("div", { class: "terrain-template-grammar-wrap" });
  const table = el("table", { class: "terrain-template-grammar-table" });
  table.append(rowElement(["종류", "역할", "레이어", "왼쪽", "반복", "오른쪽", "타일", "조건/의미"], "th"));
  for (const rule of grammar) {
    table.append(rowElement([
      rule.kind,
      rule.role,
      rule.layer,
      tileOrDash(rule.left),
      tileOrDash(rule.middle),
      tileOrDash(rule.right),
      rule.tiles?.join(", ") ?? "-",
      rule.mustTouch ? `${rule.mustTouch}: ${rule.meaning}` : rule.meaning,
    ], "td"));
  }
  wrap.append(table);
  return wrap;
}

function tileOrDash(tile: number | undefined): string {
  return tile === undefined ? "-" : String(tile);
}

function rowElement(cells: readonly string[], cellTag: "td" | "th"): HTMLTableRowElement {
  const row = el("tr");
  for (const cell of cells) row.append(el(cellTag, { text: cell }));
  return row;
}

function renderTileList(tileset: TilesetDef, tiles: readonly number[]): HTMLElement {
  if (tiles.length === 0) return el("span", { class: "terrain-template-empty", text: "-" });
  return el("div", {
    class: "terrain-template-tile-list",
    children: tiles.map((tile) => renderTileChip(tileset, tile)),
  });
}

function renderTileChip(tileset: TilesetDef, tile: number): HTMLElement {
  return el("span", {
    class: "terrain-template-tile-chip",
    attrs: { title: `tile ${tile}` },
    children: [
      el("span", {
        class: "terrain-template-tile-swatch",
        attrs: { style: tilesetTileBackgroundStyle(tileset, tile, 32) },
      }),
      el("span", { class: "terrain-template-tile-id", text: String(tile) }),
    ],
  });
}

function renderJsonDetails(template: TerrainTemplateMetadata): HTMLElement {
  return el("details", {
    class: "terrain-template-json",
    children: [
      el("summary", { text: "JSON" }),
      el("pre", { text: JSON.stringify(template, null, 2) }),
    ],
  });
}
