import { batchApplyCells, interpolateCells, type AnimationCellBatchPatch } from "@/editor/databaseAnimationCellOps";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyAutoChromaKeyToBackground } from "@/editor/panels/chromaKey";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import type { BattleAnimationCell, BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const DEFAULT_CELL: BattleAnimationCell = { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true };
const PATTERN_PREVIEW_COUNT = 8;
const ANIMATION_PLAYBACK_FRAME_MS = Math.round(1000 / 15);

let copiedAnimationCells: BattleAnimationCell[] | null = null;

export type AnimationPreviewContext = {
  readonly animation: BattleAnimationRecord;
  readonly sheet: BattleAnimationSheet;
  readonly frames: readonly BattleAnimationFrame[];
  readonly selectedFrameIndex: number;
  readonly selectedFrame: BattleAnimationFrame;
  readonly project: Project;
  readonly duplicateLastFrame: () => void;
  readonly updateSelectedFrameCells: (cells: readonly BattleAnimationCell[]) => void;
  // 셀을 읽는 커맨드(일괄/복사/보간)는 렌더 시점 selectedFrame.cells 대신 이 getter 로
  // store 최신 셀을 읽어야 직전 인라인 수정이 롤백되지 않는다(P2).
  readonly currentSelectedFrameCells: () => BattleAnimationCell[];
};

export function renderAnimationStagePanel(context: AnimationPreviewContext): HTMLElement {
  const panel = panelWrap("", "db-animation-sheet-preview", "db-animation-stage-panel");
  const url = animationResourceUrl(context);
  const preview = el("div", {
    class: "db-animation-sheet-preview db-animation-stage db-animation-stage-surface",
    dataset: { testid: "db-animation-sheet-preview-surface" },
  });
  preview.style.setProperty("--animation-frame-width", `${context.sheet.frameWidth}px`);
  preview.style.setProperty("--animation-frame-height", `${context.sheet.frameHeight}px`);
  preview.style.setProperty("--animation-sheet-columns", String(Math.max(1, context.sheet.columns)));
  const cellLayer = el("div", { class: "db-animation-stage-cells" });
  renderStageCells(cellLayer, context, context.selectedFrame, url);
  preview.append(stageCrosshair(), targetSilhouette(), cellLayer);

  panel.append(commandGrid(context, panel, cellLayer, url), preview, statGrid([["시트", `${context.sheet.frameWidth}x${context.sheet.frameHeight}`], ["열", String(context.sheet.columns)], ["셀", String(context.selectedFrame.cells.length)]]));
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

function commandGrid(context: AnimationPreviewContext, panel: HTMLElement, cellLayer: HTMLElement, url: string | undefined): HTMLElement {
  const pasteButton = el("button", {
    text: "셀 붙여넣기",
    attrs: { type: "button", title: "복사한 셀을 현재 프레임에 덮어쓰기" },
    on: {
      click: () => {
        if (copiedAnimationCells === null) return;
        context.updateSelectedFrameCells(cloneCells(copiedAnimationCells));
      },
    },
  });
  pasteButton.disabled = copiedAnimationCells === null;

  const playButton = el("button", {
    class: "db-animation-play-button",
    text: "▶ 재생",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "db-animation-play" },
  });
  bindPlayback(playButton, panel, cellLayer, context, url);

  const grid = el("div", {
    class: "db-animation-command-grid",
    children: [
      el("button", { text: "마지막 프레임 복제", attrs: { type: "button", title: "마지막 프레임을 복제해 끝에 추가" }, on: { click: () => context.duplicateLastFrame() } }),
      el("button", {
        text: "셀 일괄...",
        attrs: { type: "button", title: "현재 프레임 모든 셀에 동일 값 적용" },
        dataset: { testid: "db-animation-cell-batch" },
        on: {
          click: () => openCellBatchDialog(context.currentSelectedFrameCells(), (patch) => {
            context.updateSelectedFrameCells(batchApplyCells(context.currentSelectedFrameCells(), patch));
          }),
        },
      }),
      el("button", {
        text: "셀 복사",
        attrs: { type: "button", title: "현재 프레임 셀 복사" },
        on: {
          click: () => {
            copiedAnimationCells = cloneCells(context.currentSelectedFrameCells());
            pasteButton.disabled = false;
          },
        },
      }),
      pasteButton,
      playButton,
      el("button", {
        text: "보간",
        attrs: { type: "button", title: "이전·다음 프레임 사이 셀 보간" },
        dataset: { testid: "db-animation-cell-interpolate" },
        on: {
          click: () => {
            const index = context.selectedFrameIndex;
            const prev = context.frames[index - 1];
            const next = context.frames[index + 1];
            if (!prev || !next) {
              toast("보간하려면 이전·다음 프레임이 모두 필요합니다.", "info");
              return;
            }
            context.updateSelectedFrameCells(interpolateCells(prev.cells, next.cells, 0.5));
            toast("선택 프레임 셀을 보간했습니다.", "ok");
          },
        },
      }),
      checkboxLabel("격자 사용", true),
    ],
  });
  return grid;
}

function openCellBatchDialog(cells: readonly BattleAnimationCell[], onApply: (patch: AnimationCellBatchPatch) => void): void {
  document.querySelector("[data-testid='db-animation-cell-batch-dialog']")?.remove();
  const sample = cells[0] ?? DEFAULT_CELL;
  const pattern = el("input", { attrs: { type: "number", min: "0", max: "999" }, value: sample.pattern, dataset: { testid: "db-animation-batch-pattern" } }) as HTMLInputElement;
  const zoom = el("input", { attrs: { type: "number", min: "1", max: "800" }, value: sample.zoom, dataset: { testid: "db-animation-batch-zoom" } }) as HTMLInputElement;
  const opacity = el("input", { attrs: { type: "number", min: "0", max: "255" }, value: sample.opacity, dataset: { testid: "db-animation-batch-opacity" } }) as HTMLInputElement;
  const x = el("input", { attrs: { type: "number", min: "-999", max: "999" }, value: sample.x, dataset: { testid: "db-animation-batch-x" } }) as HTMLInputElement;
  const y = el("input", { attrs: { type: "number", min: "-999", max: "999" }, value: sample.y, dataset: { testid: "db-animation-batch-y" } }) as HTMLInputElement;
  const backdrop = el("div", { class: "db-enemy-dialog-backdrop", dataset: { testid: "db-animation-cell-batch-dialog" } });
  const close = (): void => {
    unregisterModal(backdrop);
    backdrop.remove();
  };
  backdrop.append(
    el("div", {
      class: "db-enemy-dialog",
      children: [
        el("header", { text: "셀 일괄 설정" }),
        el("main", {
          children: [
            fieldRow("패턴", pattern),
            fieldRow("X", x),
            fieldRow("Y", y),
            fieldRow("확대", zoom),
            fieldRow("불투명", opacity),
          ],
        }),
        el("footer", {
          children: [
            el("button", {
              class: "btn small",
              text: "OK",
              dataset: { testid: "db-animation-cell-batch-ok" },
              attrs: { type: "button" },
              on: {
                click: () => {
                  onApply({
                    pattern: Number(pattern.value),
                    x: Number(x.value),
                    y: Number(y.value),
                    zoom: Number(zoom.value),
                    opacity: Number(opacity.value),
                  });
                  close();
                  toast("현재 프레임 셀에 일괄 적용했습니다.", "ok");
                },
              },
            }),
            el("button", {
              class: "btn small",
              text: "Cancel",
              dataset: { testid: "db-animation-cell-batch-cancel" },
              attrs: { type: "button" },
              on: { click: close },
            }),
          ],
        }),
      ],
    }),
  );
  document.body.append(backdrop);
  registerModal(backdrop, close);
}

function fieldRow(label: string, input: HTMLElement): HTMLElement {
  return el("label", { class: "db-field", children: [el("span", { text: label }), input] });
}

function bindPlayback(
  button: HTMLButtonElement,
  panel: HTMLElement,
  cellLayer: HTMLElement,
  context: AnimationPreviewContext,
  url: string | undefined
): void {
  let timer: ReturnType<typeof window.setInterval> | null = null;
  let frameIndex = context.selectedFrameIndex;

  const stop = (restoreSelectedFrame: boolean): void => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    button.textContent = "▶ 재생";
    button.setAttribute("aria-pressed", "false");
    if (restoreSelectedFrame) renderStageCells(cellLayer, context, context.selectedFrame, url);
  };

  const tick = (): void => {
    if (isDisconnected(panel)) {
      stop(false);
      return;
    }
    frameIndex += 1;
    if (frameIndex >= context.frames.length) {
      stop(true);
      return;
    }
    renderStageCells(cellLayer, context, context.frames[frameIndex] ?? context.selectedFrame, url);
  };

  button.addEventListener("click", () => {
    if (timer !== null) {
      stop(true);
      return;
    }
    // RM2003 재생 의미: 선택 프레임과 무관하게 항상 1프레임부터 전체를 1회 재생한다.
    // (선택 프레임에서 시작하면 마지막 프레임 선택 시 즉시 종료돼 무반응처럼 보인다.)
    frameIndex = 0;
    renderStageCells(cellLayer, context, context.frames[frameIndex] ?? context.selectedFrame, url);
    button.textContent = "■ 정지";
    button.setAttribute("aria-pressed", "true");
    timer = window.setInterval(tick, ANIMATION_PLAYBACK_FRAME_MS);
  });
}

function renderStageCells(layer: HTMLElement, context: AnimationPreviewContext, frame: BattleAnimationFrame, url: string | undefined): void {
  const cells = frame.cells.length > 0 ? frame.cells : [DEFAULT_CELL];
  layer.replaceChildren(...cells.map((cell, index) => stageCellSprite(context, cell, url, index)));
}

function stageCellSprite(context: AnimationPreviewContext, cell: BattleAnimationCell, url: string | undefined, index: number): HTMLElement {
  const sprite = el("div", {
    class: `db-animation-stage-cell db-animation-stage-cell-sprite${cell.visible ? "" : " muted"}`,
    children: url ? [] : [el("span"), el("span"), el("span")],
  });
  if (index === 0) sprite.dataset.testid = "db-animation-stage-target";
  if (url) {
    sprite.setAttribute("aria-label", `애니메이션 셀 ${index + 1}`);
    applySpriteBackground(sprite, context.sheet, cell.pattern, url);
    if (!cell.visible) sprite.style.backgroundImage = "";
  }
  sprite.style.setProperty("--animation-cell-x", `${cell.x}px`);
  sprite.style.setProperty("--animation-cell-y", `${cell.y}px`);
  sprite.style.setProperty("--animation-cell-scale", String(cell.zoom / 100));
  sprite.style.transform = `translate(${cell.x}px, ${cell.y}px) scale(${cell.zoom / 100})`;
  sprite.style.opacity = String(cell.visible ? cell.opacity / 255 : Math.min(cell.opacity / 255, 0.38));
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
  // 단색 배경 시트(마젠타/녹성/검은 등) 자동 키아웃. 투명 PNG 면 no-op.
  applyAutoChromaKeyToBackground(element, url);
}

function cloneCells(cells: readonly BattleAnimationCell[]): BattleAnimationCell[] {
  return cells.map(({ tone, ...cell }) => (tone ? { ...cell, tone: { ...tone } } : { ...cell }));
}

function isDisconnected(element: HTMLElement): boolean {
  return "isConnected" in element && element.isConnected === false;
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
