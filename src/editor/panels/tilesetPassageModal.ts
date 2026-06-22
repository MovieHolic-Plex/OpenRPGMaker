import { tilesetImageUrl } from "@/editor/tilesetImage";
import { nextPassageMark, passageMarkForTile, setPassageMark, type PassageMark } from "@/project/tilesetPassage";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

const MARK_LABELS = {
  o: "O",
  x: "X",
  star: "★",
} as const satisfies Record<PassageMark, string>;

const EDIT_SCALE = 2;

export function openTilesetSettingsModal(tilesetId: string, rerender: () => void): void {
  const existing = document.querySelector("[data-testid='tileset-settings-modal']");
  if (existing) existing.remove();
  const modal = renderTilesetSettingsModal(tilesetId, () => {
    modal.remove();
    rerender();
  }, rerender);
  document.body.append(modal);
}

function renderTilesetSettingsModal(tilesetId: string, close: () => void, rerender: () => void): HTMLElement {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const backdrop = el("div", { class: "tileset-modal-backdrop", dataset: { testid: "tileset-settings-modal" } });
  if (!tileset) {
    backdrop.append(el("section", { class: "tileset-settings-window", text: "타일셋을 찾을 수 없습니다." }));
    return backdrop;
  }
  const windowEl = el("section", { class: "tileset-settings-window", attrs: { role: "dialog", "aria-label": "칩셋 설정" } });
  const header = el("div", { class: "tileset-settings-header" });
  header.append(
    el("div", {
      children: [
        el("h2", { text: "칩셋 설정" }),
        el("p", { text: `${tileset.name} · 통행 O/X/★ · 지형 태그` }),
      ],
    }),
    el("button", { class: "btn", text: "닫기", dataset: { testid: "tileset-settings-close" }, on: { click: close } })
  );
  windowEl.append(header, renderLegend(), renderChipsetEditor(tileset, tilesetId, rerender));
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  return backdrop;
}

function renderLegend(): HTMLElement {
  return el("div", {
    class: "tileset-settings-legend",
    children: [
      el("span", { text: "O 통행 가능" }),
      el("span", { text: "X 통행 불가" }),
      el("span", { text: "★ 위에 표시 / 하위 통행 따름" }),
      el("span", { text: "클릭하면 O → X → ★ 순환" }),
    ],
  });
}

function renderChipsetEditor(tileset: TilesetDef, tilesetId: string, rerender: () => void): HTMLElement {
  const editCellSize = tileset.tileSize * EDIT_SCALE;
  const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
  const root = el("div", {
    class: "tileset-settings-sheet",
    attrs: {
      style: [
        `--chipset-cols:${tileset.tilesPerRow}`,
        `--chipset-cell:${editCellSize}px`,
        `--chipset-width:${tileset.tilesPerRow * editCellSize}px`,
        `--chipset-height:${rows * editCellSize}px`,
      ].join(";"),
    },
  });
  root.append(el("img", { class: "tileset-settings-image", attrs: { src: tilesetImageUrl(tileset), alt: "" } }));
  const grid = el("div", { class: "tileset-settings-grid" });
  for (let index = 0; index < tileset.count; index += 1) {
    grid.append(renderPassageButton(tileset, tilesetId, index, rerender));
  }
  root.append(grid);
  return root;
}

function renderPassageButton(tileset: TilesetDef, tilesetId: string, index: number, rerender: () => void): HTMLButtonElement {
  const mark = passageMarkForTile(tileset, index);
  return el("button", {
    class: `tileset-passage-cell mark-${mark}`,
    text: MARK_LABELS[mark],
    attrs: { title: `타일 ${index}: ${MARK_LABELS[mark]}`, "aria-label": `타일 ${index} 통행 ${MARK_LABELS[mark]}` },
    dataset: { testid: `tileset-passage-cell-${index}` },
    on: {
      click: () => {
        store.update((project) => {
          const target = project.tilesets[tilesetId];
          if (!target) return;
          setPassageMark(target, index, nextPassageMark(passageMarkForTile(target, index)));
        });
        rerender();
        const modal = document.querySelector("[data-testid='tileset-settings-modal']");
        if (modal) {
          const replacement = renderTilesetSettingsModal(tilesetId, () => {
            replacement.remove();
            rerender();
          }, rerender);
          modal.replaceWith(replacement);
        }
      },
    },
  });
}
