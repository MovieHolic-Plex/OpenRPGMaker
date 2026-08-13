import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { ensureTileMeta } from "@/editor/panels/tilesetMetadataControls";
import { tilesetImageUrl } from "@/editor/tilesetImage";
import {
  buildTilesetReviewQueue,
  lowConfidenceReviewCount,
  transitionTilesetReviewQueue,
  type TilesetReviewCandidate,
  type TilesetReviewItem,
  type TilesetReviewState,
} from "@/editor/tilesetReviewModel";
import { confirmUserTileMetadata, primaryTileRole } from "@/project/tilesetPalette";
import { passageMarkForTile, setPassageMark } from "@/project/tilesetPassage";
import { store } from "@/project/store";
import type { PaletteSlotRole, TileAiMetadata, TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export interface RenderTilesetReviewWizardOptions {
  readonly candidates?: readonly TilesetReviewCandidate[];
  readonly onClose?: () => void;
  readonly rerender?: () => void;
  readonly tileset: TilesetDef;
}

type OverlayMode = "group" | "passage" | "role";

const ROLE_ICONS: Record<PaletteSlotRole, string> = {
  boundary: "경",
  decor: "장",
  furniture: "가",
  ground: "바",
  path: "길",
  roof: "지",
  wall: "벽",
  water: "물",
};

let activeOverlayMode: OverlayMode = "passage";
let activeWizard: HTMLElement | null = null;

export {
  buildTilesetReviewQueue,
  lowConfidenceReviewCount,
  transitionTilesetReviewQueue,
} from "@/editor/tilesetReviewModel";
export type { TilesetReviewCandidate, TilesetReviewItem, TilesetReviewState } from "@/editor/tilesetReviewModel";

export function applyReviewConfirmation(
  tileset: TilesetDef,
  tile: number,
  candidate?: TilesetReviewCandidate
): TileAiMetadata | null {
  if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) return null;
  const meta = ensureTileMeta(tileset, tile);
  const next = confirmUserTileMetadata(meta, candidate?.meta);
  if (next.passage === "passable") setPassageMark(tileset, tile, "o");
  if (next.passage === "solid") setPassageMark(tileset, tile, "x");
  if (next.passage === "star") setPassageMark(tileset, tile, "star");
  tileset.tileMeta![tile] = next;
  return { ...next };
}

export function confirmReviewTile(tilesetId: string, tile: number, candidate?: TilesetReviewCandidate): void {
  recordProjectSnapshot("타일 검토 확인");
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    applyReviewConfirmation(tileset, tile, candidate);
  });
}

export function approveAllReviewTiles(tilesetId: string, queue: readonly TilesetReviewItem[]): void {
  if (queue.length === 0) return;
  recordProjectSnapshot("타일 검토 일괄 승인");
  store.update((project) => {
    const tileset = project.tilesets[tilesetId];
    if (!tileset) return;
    for (const item of queue) applyReviewConfirmation(tileset, item.tile, item.candidate);
  });
}

export function renderTilesetReviewWizard(options: RenderTilesetReviewWizardOptions): HTMLElement {
  let state: TilesetReviewState = {
    queue: buildTilesetReviewQueue(options.tileset, options.candidates),
    skipped: [],
  };
  const queueHost = el("div", { class: "tileset-review-queue" });
  const approveAll = el("button", {
    class: "database-footer-button primary",
    attrs: { type: "button" },
    dataset: { testid: "tileset-review-approve-all" },
    on: {
      click: () => {
        approveAllReviewTiles(options.tileset.id, state.queue);
        state = { queue: [], skipped: state.skipped };
        refresh();
        options.rerender?.();
      },
    },
  });
  const root = el("section", {
    class: "tileset-review-wizard",
    dataset: { testid: "tileset-review-wizard" },
    children: [
      el("header", {
        class: "tileset-review-header",
        children: [
          el("div", { class: "tileset-review-title", text: `${options.tileset.name} 재감사 검토` }),
          el("button", {
            class: "database-footer-button",
            text: "닫기",
            attrs: { type: "button" },
            on: { click: () => options.onClose?.() },
          }),
        ],
      }),
      renderReviewOverlay(options.tileset, options.candidates, () => {
        replaceOverlay(root, options);
      }),
      queueHost,
      approveAll,
    ],
  });

  function refresh(): void {
    clearChildren(queueHost);
    queueHost.append(renderQueueCard(options.tileset, state.queue[0] ?? null, {
      confirm: (item) => {
        confirmReviewTile(options.tileset.id, item.tile, item.candidate);
        state = transitionTilesetReviewQueue(state, "confirm", item.tile);
        refresh();
        options.rerender?.();
      },
      skip: (item) => {
        state = transitionTilesetReviewQueue(state, "skip", item.tile);
        refresh();
      },
    }));
    approveAll.textContent = `나머지 모두 승인 (낮은 신뢰 ${lowConfidenceReviewCount(state.queue)}칸)`;
    approveAll.disabled = state.queue.length === 0;
  }

  refresh();
  return root;
}

export function openTilesetReviewWizard(tilesetId: string, candidates: readonly TilesetReviewCandidate[] = []): void {
  closeTilesetReviewWizard();
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset || typeof document === "undefined") return;
  const host = el("div", {
    class: "tileset-review-wizard-host",
    children: [
      renderTilesetReviewWizard({
        candidates,
        onClose: closeTilesetReviewWizard,
        rerender: () => undefined,
        tileset,
      }),
    ],
  });
  document.body.append(host);
  activeWizard = host;
}

export function closeTilesetReviewWizard(): void {
  activeWizard?.remove();
  activeWizard = null;
}

function replaceOverlay(root: HTMLElement, options: RenderTilesetReviewWizardOptions): void {
  const current = root.querySelector(".tileset-review-overlay-wrap");
  const next = renderReviewOverlay(options.tileset, options.candidates, () => replaceOverlay(root, options));
  current?.remove();
  root.prepend(next);
}

function renderReviewOverlay(
  tileset: TilesetDef,
  candidates: readonly TilesetReviewCandidate[] | undefined,
  rerender: () => void
): HTMLElement {
  const candidateByTile = new Map((candidates ?? []).map((candidate) => [candidate.tile, candidate.meta]));
  return el("section", {
    class: "tileset-review-overlay-wrap",
    children: [
      el("div", {
        class: "tileset-review-overlay-tabs",
        children: (["passage", "role", "group"] as const).map((mode) =>
          el("button", {
            class: `database-footer-button${activeOverlayMode === mode ? " active" : ""}`,
            text: overlayModeLabel(mode),
            attrs: { type: "button", "aria-pressed": String(activeOverlayMode === mode) },
            dataset: { testid: `tileset-review-overlay-${mode}` },
            on: {
              click: () => {
                activeOverlayMode = mode;
                rerender();
              },
            },
          })
        ),
      }),
      renderOverlayGrid(tileset, candidateByTile),
    ],
  });
}

function renderOverlayGrid(tileset: TilesetDef, candidateByTile: ReadonlyMap<number, TileAiMetadata>): HTMLElement {
  const cell = tileset.tileSize;
  return el("div", {
    class: `tileset-review-overlay-grid mode-${activeOverlayMode}`,
    attrs: {
      style: [
        `--tileset-cols:${tileset.tilesPerRow}`,
        `--tileset-cell:${cell}px`,
        `--tileset-width:${tileset.tilesPerRow * cell}px`,
      ].join(";"),
    },
    children: [
      el("img", { attrs: { src: tilesetImageUrl(tileset), alt: "" } }),
      el("div", {
        class: "tileset-review-overlay-cells",
        children: Array.from({ length: tileset.count }, (_unused, tile) =>
          el("span", {
            class: overlayCellClass(tileset, tile),
            text: overlayCellText(tileset, tile, candidateByTile.get(tile)),
            attrs: { title: `${tile}번` },
          })
        ),
      }),
    ],
  });
}

function renderQueueCard(
  tileset: TilesetDef,
  item: TilesetReviewItem | null,
  actions: {
    readonly confirm: (item: TilesetReviewItem) => void;
    readonly skip: (item: TilesetReviewItem) => void;
  }
): HTMLElement {
  if (!item) {
    return el("article", {
      class: "tileset-review-queue-card empty",
      dataset: { testid: "tileset-review-queue-card" },
      text: "검토할 타일이 없습니다.",
    });
  }
  const role = item.meta.role || primaryTileRole(tileset, item.tile) || "미지정";
  return el("article", {
    class: "tileset-review-queue-card",
    dataset: { testid: "tileset-review-queue-card" },
    children: [
      renderTileThumb(tileset, item.tile, 4),
      el("div", {
        class: "tileset-review-card-body",
        children: [
          el("strong", { text: `${item.tile}번 · 신뢰도 ${percent(item.confidence)}` }),
          el("div", { text: `의미 라벨: ${item.meta.label || "미지정"}` }),
          el("div", { text: `역할: ${role}` }),
          el("div", { text: `통행: ${passageLabel(passageMarkForTile(tileset, item.tile))}` }),
        ],
      }),
      el("div", {
        class: "tileset-review-card-actions",
        children: [
          el("button", {
            class: "database-footer-button primary",
            text: "맞음",
            attrs: { type: "button" },
            dataset: { testid: "tileset-review-confirm" },
            on: { click: () => actions.confirm(item) },
          }),
          el("button", {
            class: "database-footer-button",
            text: "건너뛰기",
            attrs: { type: "button" },
            dataset: { testid: "tileset-review-skip" },
            on: { click: () => actions.skip(item) },
          }),
        ],
      }),
    ],
  });
}

function renderTileThumb(tileset: TilesetDef, tile: number, scale: number): HTMLElement {
  const col = tile % tileset.tilesPerRow;
  const row = Math.floor(tile / tileset.tilesPerRow);
  const size = tileset.tileSize * scale;
  return el("div", {
    class: "tileset-review-tile-thumb",
    attrs: {
      style: [
        `width:${size}px`,
        `height:${size}px`,
        `background-image:url(${tilesetImageUrl(tileset)})`,
        `background-size:${tileset.tilesPerRow * size}px auto`,
        `background-position:-${col * size}px -${row * size}px`,
      ].join(";"),
    },
  });
}

function overlayCellClass(tileset: TilesetDef, tile: number): string {
  const mark = passageMarkForTile(tileset, tile);
  const grouped = (tileset.tileGroups ?? []).some((group) => group.tileIds.includes(tile));
  return [`tileset-review-overlay-cell`, `mark-${mark}`, grouped ? "has-group" : ""].filter(Boolean).join(" ");
}

function overlayCellText(tileset: TilesetDef, tile: number, candidate: TileAiMetadata | undefined): string {
  if (activeOverlayMode === "passage") return passageLabel(passageMarkForTile(tileset, tile));
  if (activeOverlayMode === "group") {
    const count = (tileset.tileGroups ?? []).filter((group) => group.tileIds.includes(tile)).length;
    return count > 0 ? String(count) : "";
  }
  const role = candidate?.role ?? primaryTileRole(tileset, tile);
  return role && isPaletteRole(role) ? ROLE_ICONS[role] : "";
}

function isPaletteRole(value: string): value is PaletteSlotRole {
  return Object.prototype.hasOwnProperty.call(ROLE_ICONS, value);
}

function overlayModeLabel(mode: OverlayMode): string {
  if (mode === "passage") return "통행";
  if (mode === "role") return "역할";
  return "그룹";
}

function passageLabel(mark: string): string {
  if (mark === "x") return "차단";
  if (mark === "star") return "상위";
  return "통행";
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
