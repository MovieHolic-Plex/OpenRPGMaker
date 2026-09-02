import { tilesetImageUrl } from "@/editor/tilesetImage";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { getTilesetPassagePaint, setTilesetPassagePaint } from "@/editor/panels/tilesetPassagePaint";
import { markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import {
  nextPassageMark,
  passageMarkForTile,
  setPassageMark,
  type PassageMark,
} from "@/project/tilesetPassage";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { passageGlyph } from "@/editor/panels/tilesetChipsetPreview";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

/** 인라인 시트와 같은 글리프를 쓴다 — 예전에는 여기만 "0"/"X" 라 O(문자)와 0(숫자)이 섞였다. */
const MARK_LABELS = {
  o: passageGlyph("o"),
  x: passageGlyph("x"),
  star: passageGlyph("star"),
} as const satisfies Record<PassageMark, string>;

const MARK_SPOKEN = {
  o: "통과",
  x: "막힘",
  star: "위 지나감",
} as const satisfies Record<PassageMark, string>;

const PASSAGE_META = {
  o: "passable",
  x: "solid",
  star: "star",
} as const;

const EDIT_SCALE = 2;

type ModalPaint = PassageMark | "cycle";

let modalPaint: ModalPaint = "x";
let modalStrokeOpen = false;

export function openTilesetSettingsModal(tilesetId: string, rerender: () => void): void {
  const existing = document.querySelector("[data-testid='tileset-settings-modal']");
  if (existing) {
    unregisterModal(existing);
    existing.remove();
  }
  modalPaint = getTilesetPassagePaint();
  const removeSelf = () => {
    const node = document.querySelector("[data-testid='tileset-settings-modal']");
    if (!node) return;
    unregisterModal(node);
    node.remove();
    rerender();
  };
  const root = renderTilesetSettingsModal(tilesetId, () => removeSelf(), rerender);
  document.body.append(root);
  // Escape 는 가장 위 레이어만 닫는다. 예전에는 이 창이 스택에 없어서 Escape 가 뒤의
  // 데이터베이스를 닫아 버렸고, 이 창만 맵 편집기 위에 고아로 남았다.
  registerModal(root, removeSelf);
  // 포커스를 창 안으로 옮긴다 — 안 옮기면 Tab 도 Escape 도 뒤쪽 화면에서 논다.
  const focusTarget =
    root.querySelector<HTMLElement>("[data-testid='tileset-settings-paint-open']") ??
    root.querySelector<HTMLElement>("[data-testid='tileset-settings-close']");
  focusTarget?.focus();
}

function renderTilesetSettingsModal(tilesetId: string, close: () => void, rerender: () => void): HTMLElement {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const backdrop = el("div", { class: "tileset-modal-backdrop", dataset: { testid: "tileset-settings-modal" } });
  if (!tileset) {
    backdrop.append(el("section", { class: "tileset-settings-window", text: "타일셋을 찾을 수 없습니다." }));
    return backdrop;
  }
  // 보이는 제목과 접근 가능한 이름이 달랐다("그림판 설정" vs "그림판 전체 보기").
  // 제목 요소를 그대로 가리켜 둘을 하나로 만든다.
  const titleId = "tileset-full-sheet-title";
  const windowEl = el("section", {
    class: "tileset-settings-window",
    attrs: { role: "dialog", "aria-modal": "true", "aria-labelledby": titleId },
  });
  const header = el("div", { class: "tileset-settings-header" });
  const rows = Math.ceil(tileset.count / tileset.tilesPerRow);
  header.append(
    el("div", {
      children: [
        el("h2", { text: "그림판 전체 보기", attrs: { id: titleId } }),
        el("p", {
          text: `${tileset.name} · ${tileset.count}칸 (${tileset.tilesPerRow}열×${rows}행) · 붓으로 칠하거나 순환`,
        }),
      ],
    }),
    el("button", { class: "btn", text: "닫기", dataset: { testid: "tileset-settings-close" }, on: { click: close } }),
  );
  windowEl.append(header, renderLegend(), renderChipsetEditor(tileset, tilesetId, rerender));
  backdrop.append(windowEl);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  return backdrop;
}

function renderLegend(): HTMLElement {
  const hint = el("span", {
    dataset: { testid: "tileset-settings-paint-hint" },
    text: modalPaint === "cycle" ? "클릭할 때마다 통과 → 막힘 → 위" : "클릭·드래그로 칠합니다",
  });
  const paintButton = (value: ModalPaint, label: string, testid: string): HTMLElement =>
    el("button", {
      class: `btn tileset-settings-paint${modalPaint === value ? " active" : ""}`,
      text: label,
      attrs: { type: "button", "aria-pressed": String(modalPaint === value) },
      dataset: { testid },
      on: {
        click: (event) => {
          modalPaint = value;
          if (value !== "cycle") setTilesetPassagePaint(value);
          const host = (event.currentTarget as HTMLElement).closest(".tileset-settings-legend");
          if (!host) return;
          for (const button of host.querySelectorAll<HTMLButtonElement>(".tileset-settings-paint")) {
            const on = button.dataset.testid === testid;
            button.classList.toggle("active", on);
            button.setAttribute("aria-pressed", String(on));
          }
          const hintEl = host.querySelector("[data-testid='tileset-settings-paint-hint']");
          if (hintEl) hintEl.textContent = value === "cycle" ? "클릭할 때마다 통과 → 막힘 → 위" : "클릭·드래그로 칠합니다";
        },
      },
    });
  return el("div", {
    class: "tileset-settings-legend",
    children: [
      paintButton("o", "통과", "tileset-settings-paint-open"),
      paintButton("x", "막힘", "tileset-settings-paint-blocked"),
      paintButton("star", "위 ★", "tileset-settings-paint-star"),
      paintButton("cycle", "순환", "tileset-settings-paint-cycle"),
      hint,
    ],
  });
}

function renderChipsetEditor(
  tileset: TilesetDef,
  tilesetId: string,
  rerender: () => void,
): HTMLElement {
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
  grid.addEventListener("pointerup", () => {
    modalStrokeOpen = false;
  });
  grid.addEventListener("pointerleave", () => {
    modalStrokeOpen = false;
  });
  root.append(grid);
  return root;
}

function desiredMark(tileset: TilesetDef, index: number): PassageMark {
  if (modalPaint === "cycle") return nextPassageMark(passageMarkForTile(tileset, index));
  return modalPaint;
}

function applyModalMark(tilesetId: string, index: number, mark: PassageMark, button: HTMLButtonElement): void {
  const current = store.getCurrent().tilesets[tilesetId];
  if (!current || passageMarkForTile(current, index) === mark) return;
  if (!modalStrokeOpen) recordProjectSnapshot();
  modalStrokeOpen = true;
  store.update((project) => {
    const target = project.tilesets[tilesetId];
    if (!target) return;
    setPassageMark(target, index, mark);
    markUserTileRuntimeMetadata(target, index, { passage: PASSAGE_META[mark] });
  }, { scope: "project", label: "타일 통행" });
  button.className = `tileset-passage-cell mark-${mark}`;
  button.textContent = MARK_LABELS[mark];
  button.setAttribute("title", `타일 ${index}: ${MARK_SPOKEN[mark]}`);
  button.setAttribute("aria-label", `타일 ${index} ${MARK_SPOKEN[mark]}`);
}

function renderPassageButton(tileset: TilesetDef, tilesetId: string, index: number, rerender: () => void): HTMLButtonElement {
  const mark = passageMarkForTile(tileset, index);
  const button = el("button", {
    class: `tileset-passage-cell mark-${mark}`,
    text: MARK_LABELS[mark],
    attrs: { title: `타일 ${index}: ${MARK_SPOKEN[mark]}`, "aria-label": `타일 ${index} ${MARK_SPOKEN[mark]}` },
    dataset: { testid: `tileset-passage-cell-${index}` },
  });
  const paintFromEvent = () => {
    const live = store.getCurrent().tilesets[tilesetId];
    if (!live) return;
    applyModalMark(tilesetId, index, desiredMark(live, index), button);
    rerender();
  };
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    modalStrokeOpen = false;
    paintFromEvent();
  });
  button.addEventListener("pointerenter", (event) => {
    if (!modalStrokeOpen || (event.buttons & 1) === 0) return;
    const live = store.getCurrent().tilesets[tilesetId];
    if (!live) return;
    const mark = modalPaint === "cycle" ? desiredMark(live, index) : modalPaint;
    applyModalMark(tilesetId, index, mark, button);
  });
  return button;
}
