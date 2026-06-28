import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleAnimationCell, BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet, Project } from "@/project/types";
import { el } from "@/util/dom";

const DEFAULT_CELL: BattleAnimationCell = { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true };
const PATTERN_PREVIEW_COUNT = 8;

export type AnimationPreviewContext = {
  readonly animation: BattleAnimationRecord;
  readonly sheet: BattleAnimationSheet;
  readonly selectedFrame: BattleAnimationFrame;
  readonly project: Project;
};

export function renderAnimationStagePanel(context: AnimationPreviewContext): HTMLElement {
  const panel = panelWrap("", "db-animation-sheet-preview", "db-animation-stage-panel");
  const preview = el("div", {
    class: "db-animation-sheet-preview db-animation-stage",
    dataset: { testid: "db-animation-sheet-preview-surface" },
  });
  preview.style.setProperty("--animation-frame-width", `${context.sheet.frameWidth}px`);
  preview.style.setProperty("--animation-frame-height", `${context.sheet.frameHeight}px`);
  preview.style.setProperty("--animation-sheet-columns", String(Math.max(1, context.sheet.columns)));
  preview.append(stageCrosshair(), targetSilhouette(), selectedCellSprite(context, animationResourceUrl(context)));

  panel.append(commandGrid(), preview, statGrid([["시트", `${context.sheet.frameWidth}x${context.sheet.frameHeight}`], ["열", String(context.sheet.columns)], ["셀", String(context.selectedFrame.cells.length)]]));
  return panel;
}

export function renderAnimationPatternStripPanel(context: AnimationPreviewContext): HTMLElement {
  const panel = el("section", {
    class: "db-animation-pattern-strip-panel",
    dataset: { testid: "db-animation-pattern-strip" },
  });
  const url = animationResourceUrl(context);
  for (let index = 0; index < PATTERN_PREVIEW_COUNT; index += 1) {
    const cell = el("button", {
      class: `db-animation-pattern-cell${index === 0 ? " active" : ""}`,
      attrs: { type: "button", title: `패턴 ${index + 1}` },
      children: [el("span", { class: "db-animation-pattern-number", text: String(index + 1).padStart(3, "0") })],
    });
    const preview = el("span", { class: "db-animation-pattern-preview" });
    if (url) applySpriteBackground(preview, context.sheet, index, url);
    cell.prepend(preview);
    panel.append(cell);
  }
  return panel;
}

function commandGrid(): HTMLElement {
  return el("div", {
    class: "db-animation-command-grid",
    children: [
      el("button", { text: "마지막 프레임 복제", attrs: { disabled: "true", type: "button" } }),
      el("button", { text: "셀 일괄...", attrs: { type: "button" } }),
      el("button", { text: "셀 복사/지우기", attrs: { type: "button" } }),
      el("button", { class: "db-animation-play-button", text: "▶ 재생", attrs: { type: "button" } }),
      el("button", { text: "보간", attrs: { type: "button" } }),
      checkboxLabel("격자 사용", true),
    ],
  });
}

function selectedCellSprite(context: AnimationPreviewContext, url: string | undefined): HTMLElement {
  const cell = context.selectedFrame.cells[0] ?? DEFAULT_CELL;
  const sprite = el("div", {
    class: `db-animation-stage-cell${cell.visible ? "" : " muted"}`,
    dataset: { testid: "db-animation-stage-target" },
    children: [el("span"), el("span"), el("span")],
  });
  if (url) sprite.setAttribute("aria-label", "선택 셀 효과");
  sprite.style.setProperty("--animation-cell-x", `${cell.x}px`);
  sprite.style.setProperty("--animation-cell-y", `${cell.y}px`);
  sprite.style.setProperty("--animation-cell-scale", String(cell.zoom / 100));
  sprite.style.opacity = String(cell.opacity / 255);
  return sprite;
}

function stageCrosshair(): HTMLElement {
  return el("div", { class: "db-animation-crosshair", attrs: { "aria-hidden": "true" } });
}

function targetSilhouette(): HTMLElement {
  return el("div", {
    class: "db-animation-target-silhouette",
    attrs: { "aria-hidden": "true" },
    children: [el("span"), el("span"), el("span")],
  });
}

function animationResourceUrl(context: AnimationPreviewContext): string | undefined {
  return context.animation.resourceId ? (resolveAssetResourceUrl(context.animation.resourceId, { project: context.project }) ?? undefined) : undefined;
}

function applySpriteBackground(element: HTMLElement, sheet: BattleAnimationSheet, pattern: number, url: string): void {
  const columns = Math.max(1, sheet.columns);
  const column = pattern % columns;
  const row = Math.floor(pattern / columns);
  element.style.backgroundImage = `url("${url}")`;
  element.style.backgroundPosition = `-${column * sheet.frameWidth}px -${row * sheet.frameHeight}px`;
  element.style.backgroundSize = `${columns * sheet.frameWidth}px auto`;
}

function checkboxLabel(label: string, checked: boolean): HTMLElement {
  const input = el("input", { attrs: checked ? { checked: "true", disabled: "true", type: "checkbox" } : { disabled: "true", type: "checkbox" } });
  return el("label", { class: "db-animation-checkbox", children: [input, el("span", { text: label })] });
}

function panelWrap(title: string, testid: string, className = ""): HTMLElement {
  return el("section", {
    class: `db-animation-panel${className ? ` ${className}` : ""}`,
    dataset: { testid },
    children: title ? [el("h4", { text: title })] : [],
  });
}

function statGrid(rows: readonly (readonly [string, string])[]): HTMLElement {
  const grid = el("div", { class: "db-animation-stat-grid" });
  for (const [label, value] of rows) {
    grid.append(el("span", { text: label }), el("strong", { text: value }));
  }
  return grid;
}
