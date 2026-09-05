import { batchApplyCells, interpolateCells, type AnimationCellBatchPatch } from "@/editor/databaseAnimationCellOps";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyAutoChromaKeyToBackground } from "@/editor/panels/chromaKey";
import { battleAnimationSheetRmScale } from "@/player/battleAnimationPlayback";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import type { BattleAnimationCell, BattleAnimationFrame, BattleAnimationRecord, BattleAnimationSheet, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const DEFAULT_CELL: BattleAnimationCell = { pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true };
const PATTERN_PREVIEW_COUNT = 8;
const ANIMATION_PLAYBACK_FRAME_MS = Math.round(1000 / 15);

let copiedAnimationCells: BattleAnimationCell[] | null = null;
const previewDisposers = new WeakMap<HTMLElement, () => void>();

/** The tab cache owner must dispose previews before evicting their workspace. */
export function disposeAnimationPreviewsIn(scope: ParentNode): void {
  for (const panel of scope.querySelectorAll<HTMLElement>(".db-animation-stage-panel")) {
    previewDisposers.get(panel)?.();
  }
}

// Mutable, form-owned playback intent survives internal field/frame rerenders only.
export type AnimationPlaybackState = {
  playing: boolean;
  dispose?: () => void;
};

export function createAnimationPlaybackState(): AnimationPlaybackState {
  return { playing: !globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)").matches };
}

export type AnimationPreviewContext = {
  readonly playback?: AnimationPlaybackState;
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
  // 스테이지는 RM px 좌표계다 — 시트 배율(레거시 1, 384px 고해상도 0.25)을 곱해 96px 셀로 맞춘다.
  const rmScale = battleAnimationSheetRmScale(context.sheet);
  preview.style.setProperty("--animation-frame-width", `${context.sheet.frameWidth * rmScale}px`);
  preview.style.setProperty("--animation-frame-height", `${context.sheet.frameHeight * rmScale}px`);
  preview.style.setProperty("--animation-sheet-columns", String(Math.max(1, context.sheet.columns)));
  const cellLayer = el("div", { class: "db-animation-stage-cells" });
  renderStageCells(cellLayer, context, context.selectedFrame, url);
  preview.append(stageCrosshair(), targetSilhouette(), cellLayer);

  const playButton = el("button", {
    class: "btn db-animation-play-button",
    text: "재생",
    attrs: { type: "button", "aria-pressed": "false" },
    dataset: { testid: "db-animation-play" },
  });
  const transport = el("div", {
    class: "db-animation-transport",
    dataset: { testid: "db-animation-transport" },
    children: [playButton],
  });
  bindPlayback(playButton, panel, cellLayer, context, url, transport);
  panel.append(el("h4", { text: "미리보기" }), preview, transport);

  return panel;
}

export function renderAnimationPatternStripPanel(context: AnimationPreviewContext): HTMLElement {
  const panel = el("section", {
    class: "db-animation-pattern-strip-panel",
    dataset: { testid: "db-animation-pattern-strip" },
  });
  const url = animationResourceUrl(context);
  for (let index = 0; index < PATTERN_PREVIEW_COUNT; index += 1) {
    const cell = el("div", {
      class: "db-animation-pattern-cell",
      attrs: { title: `패턴 ${index + 1} · 참고 이미지` },
      children: [el("span", { class: "db-animation-pattern-number", text: String(index + 1).padStart(3, "0") })],
    });
    const preview = el("span", { class: "db-animation-pattern-preview" });
    if (url) applySpriteBackground(preview, context.sheet, index, url);
    cell.prepend(preview);
    panel.append(cell);
  }
  return panel;
}

export function renderAnimationCellCommands(context: AnimationPreviewContext): HTMLElement {
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
  url: string | undefined,
  statusHost: HTMLElement,
): void {
  const playback = context.playback ?? createAnimationPlaybackState();
  playback.dispose?.();
  let timer: number | null = null;
  let frameIndex = 0;
  let ready = false;
  let disposed = false;
  const status = el("div", {
    class: "empty-hint",
    attrs: { role: "status" },
    dataset: { testid: "db-animation-preview-status" },
  });
  statusHost.append(status);

  const stop = (restoreSelectedFrame: boolean): void => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
    button.textContent = "재생";
    button.setAttribute("aria-pressed", "false");
    if (ready) status.textContent = "선택 프레임 · 정지";
    if (restoreSelectedFrame) {
      renderStageCells(cellLayer, context, { cells: context.currentSelectedFrameCells() }, url);
    }
  };

  const start = (): void => {
    if (disposed || !ready || timer !== null || isDisconnected(panel)) return;
    frameIndex = 0;
    renderStageCells(cellLayer, context, context.frames[frameIndex] ?? context.selectedFrame, url);
    button.textContent = "정지";
    button.setAttribute("aria-pressed", "true");
    status.textContent = "반복 재생 중";
    timer = window.setInterval(() => {
      if (isDisconnected(panel)) {
        stop(false);
        return;
      }
      frameIndex = (frameIndex + 1) % context.frames.length;
      renderStageCells(cellLayer, context, context.frames[frameIndex] ?? context.selectedFrame, url);
    }, ANIMATION_PLAYBACK_FRAME_MS);
  };

  // Database tabs cache detached DOM. Pause that cache, resume on attachment,
  // and release the observer on record replacement or modal close. Cache eviction
  // is explicit: detached ancestry alone cannot distinguish retained and evicted tabs.
  let workspace: HTMLElement | null = null;
  let modal: HTMLElement | null = null;
  const observer = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(() => {
    if (panel.isConnected) {
      workspace = panel.closest(".oprn-record-battleAnimations");
      modal = panel.closest(".database-modal-backdrop");
      if (playback.playing) start();
    } else if (workspace?.contains(panel) && modal?.isConnected) {
      stop(false);
    } else {
      dispose();
    }
  });
  const dispose = (): void => {
    disposed = true;
    stop(false);
    observer?.disconnect();
    previewDisposers.delete(panel);
  };
  previewDisposers.set(panel, dispose);
  playback.dispose = dispose;
  observer?.observe(document.body, { childList: true, subtree: true });

  button.addEventListener("click", () => {
    if (!ready || disposed) return;
    playback.playing = !playback.playing;
    if (playback.playing) start();
    else stop(true);
  });

  button.disabled = true;
  status.dataset.state = url ? "loading" : "empty";
  status.textContent = url ? "그래픽 불러오는 중" : "애니메이션 그래픽을 선택하세요.";
  if (!url) {
    cellLayer.replaceChildren();
    return;
  }
  const image = new Image();
  const empty = (): void => {
    if (disposed) return;
    ready = false;
    stop(false);
    button.disabled = true;
    cellLayer.replaceChildren();
    status.dataset.state = "empty";
    status.textContent = "재생할 그래픽이나 표시할 셀이 없습니다.";
  };
  image.addEventListener("error", empty, { once: true });
  image.addEventListener("load", () => {
    if (disposed) return;
    const hasVisibleCells = context.frames.some((frame) => frame.cells.some((cell) =>
      cell.visible && cell.opacity > 0 && cell.zoom > 0 &&
      (cell.pattern % context.sheet.columns + 1) * context.sheet.frameWidth <= image.naturalWidth &&
      (Math.floor(cell.pattern / context.sheet.columns) + 1) * context.sheet.frameHeight <= image.naturalHeight
    ));
    if (!hasVisibleCells) {
      empty();
      return;
    }
    ready = true;
    button.disabled = false;
    status.dataset.state = "ready";
    status.textContent = "선택 프레임 · 정지";
    if (playback.playing) start();
  }, { once: true });
  image.src = url;
}

function renderStageCells(layer: HTMLElement, context: AnimationPreviewContext, frame: BattleAnimationFrame, url: string | undefined): void {
  const cells = url ? frame.cells : [];
  layer.replaceChildren(...cells.map((cell, index) => stageCellSprite(context, cell, url, index)));
}

function stageCellSprite(context: AnimationPreviewContext, cell: BattleAnimationCell, url: string | undefined, index: number): HTMLElement {
  const sprite = el("div", {
    class: `db-animation-stage-cell db-animation-stage-cell-sprite${cell.visible ? "" : " muted"}`,
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
  // 배경 좌표도 스테이지와 같은 RM px 배율로 옮긴다 — 안 그러면 고해상도 시트가 4배로 잘린다.
  const rmScale = battleAnimationSheetRmScale(sheet);
  const frameWidth = sheet.frameWidth * rmScale;
  const frameHeight = sheet.frameHeight * rmScale;
  element.style.backgroundImage = `url("${url}")`;
  element.style.backgroundPosition = `-${column * frameWidth}px -${row * frameHeight}px`;
  element.style.backgroundSize = `${columns * frameWidth}px auto`;
  // 단색 배경 시트(마젠타/녹성/검은 등) 자동 키아웃. 투명 PNG 면 no-op.
  applyAutoChromaKeyToBackground(element, url);
}

function cloneCells(cells: readonly BattleAnimationCell[]): BattleAnimationCell[] {
  return cells.map(({ tone, ...cell }) => (tone ? { ...cell, tone: { ...tone } } : { ...cell }));
}

function isDisconnected(element: HTMLElement): boolean {
  return "isConnected" in element && element.isConnected === false;
}

function panelWrap(title: string, testid: string, className = ""): HTMLElement {
  return el("section", {
    class: `db-animation-panel${className ? ` ${className}` : ""}`,
    dataset: { testid },
    children: title ? [el("h4", { text: title })] : [],
  });
}
