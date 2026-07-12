import {
  EASYRPG_FACESET_ASSETS,
} from "@/assets/easyrpgRtp";
import { RESOURCE_SLICING } from "@/assets/resourceSlicing";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { store } from "@/project/store";
import { el } from "@/util/dom";

const FACESET_SLICING = RESOURCE_SLICING.faceset;
const FACESET_COLUMNS = FACESET_SLICING.columns;
const FACESET_FACE_COUNT = FACESET_SLICING.count;
const FACESET_FACE_HEIGHT = FACESET_SLICING.cellHeight;
const FACESET_FACE_WIDTH = FACESET_SLICING.cellWidth;
const FACESET_SHEET_HEIGHT = FACESET_SLICING.sheetHeight;
const FACESET_SHEET_WIDTH = FACESET_SLICING.sheetWidth;
/** Form/editor chip size (RM face is 48×48; scale up for readability). */
const FACE_PREVIEW_WIDTH = 96;
const FACE_PREVIEW_HEIGHT = 96;

export type FacesetPreviewOptions = {
  readonly faceIndex: number;
  readonly flipHorizontally: boolean;
  readonly position: "left" | "right";
  readonly resourceId: string;
  /** Crop pixel size; defaults to 96 for editor cards. */
  readonly displaySize?: number;
};

/** Full card with crop + resource labels (left form / standalone dialogs). */
export function renderFacesetPreview(options: FacesetPreviewOptions): HTMLElement {
  const normalizedIndex = normalizedFaceIndex(options.faceIndex);
  const resourceId = options.resourceId.trim();
  const name = facesetName(resourceId);
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const preview = el("div", {
    class: `event-command-face-preview${options.flipHorizontally ? " flipped" : ""}`,
    dataset: {
      testid: "event-command-face-preview",
      faceIndex: String(normalizedIndex),
      resourceId,
    },
  });

  if (url === null) {
    preview.dataset.empty = "true";
    preview.append(
      el("strong", { text: resourceId || "얼굴 그래픽 없음" }),
      el("span", { text: resourceId ? "미리보기를 찾을 수 없습니다." : "리소스를 선택하면 얼굴이 표시됩니다." })
    );
    return preview;
  }

  const crop = faceCrop(url, normalizedIndex, name, options.displaySize);
  preview.append(
    crop,
    el("div", {
      class: "event-command-face-preview-copy",
      children: [
        el("strong", { text: name }),
        el("span", {
          text: `얼굴 ${normalizedIndex + 1} · ${positionLabel(options.position)}${options.flipHorizontally ? " · 좌우 반전" : ""}`,
        }),
        el("span", { class: "event-command-face-preview-id", text: resourceId }),
      ],
    })
  );
  return preview;
}

/**
 * Crop-only face graphic for in-game message-window mocks.
 * Does not include resource-id chrome — that belongs in the editor form, not the play preview.
 */
export function renderFacesetCrop(options: {
  readonly resourceId: string;
  readonly faceIndex: number;
  readonly flipHorizontally?: boolean;
  readonly displaySize?: number;
}): HTMLElement {
  const normalizedIndex = normalizedFaceIndex(options.faceIndex);
  const resourceId = options.resourceId.trim();
  const name = facesetName(resourceId);
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const shell = el("div", {
    class: `event-command-face-crop-shell${options.flipHorizontally ? " flipped" : ""}`,
    dataset: {
      testid: "event-command-face-crop-shell",
      faceIndex: String(normalizedIndex),
      resourceId,
    },
  });
  if (url === null) {
    shell.dataset.empty = "true";
    shell.append(el("span", { class: "event-command-face-crop-missing", text: resourceId ? "?" : "—" }));
    return shell;
  }
  shell.append(faceCrop(url, normalizedIndex, name, options.displaySize));
  return shell;
}

function faceCrop(url: string, faceIndex: number, name: string, displaySize?: number): HTMLElement {
  const col = faceIndex % FACESET_COLUMNS;
  const row = Math.floor(faceIndex / FACESET_COLUMNS);
  const width = Math.max(48, Math.trunc(displaySize ?? FACE_PREVIEW_WIDTH));
  const height = Math.max(48, Math.trunc(displaySize ?? FACE_PREVIEW_HEIGHT));
  const scaleX = width / FACESET_FACE_WIDTH;
  const scaleY = height / FACESET_FACE_HEIGHT;
  const crop = el("div", {
    class: "event-command-face-crop",
    attrs: { "aria-label": `${name} 얼굴 ${faceIndex + 1} 미리보기`, role: "img" },
    dataset: { testid: "event-command-face-crop" },
  });
  crop.style.setProperty("--face-url", `url("${url}")`);
  crop.style.setProperty("--face-x", `-${col * FACESET_FACE_WIDTH}px`);
  crop.style.setProperty("--face-y", `-${row * FACESET_FACE_HEIGHT}px`);
  crop.style.setProperty("--face-sheet-size", `${FACESET_SHEET_WIDTH}px`);
  crop.style.setProperty("--face-display-width", `${width}px`);
  crop.style.setProperty("--face-display-height", `${height}px`);
  crop.style.setProperty("--face-scaled-x", `-${col * FACESET_FACE_WIDTH * scaleX}px`);
  crop.style.setProperty("--face-scaled-y", `-${row * FACESET_FACE_HEIGHT * scaleY}px`);
  crop.style.setProperty("--face-scaled-sheet-width", `${FACESET_SHEET_WIDTH * scaleX}px`);
  crop.style.setProperty("--face-scaled-sheet-height", `${FACESET_SHEET_HEIGHT * scaleY}px`);
  return crop;
}

function normalizedFaceIndex(faceIndex: number): number {
  return Math.max(0, Math.min(FACESET_FACE_COUNT - 1, Math.trunc(faceIndex)));
}

function facesetName(resourceId: string): string {
  if (!resourceId) return "얼굴 그래픽 없음";
  const project = store.getCurrent();
  const uploaded = project.assets.uploaded[resourceId];
  if (uploaded) return uploaded.name;
  const profile = project.resourceProfiles.find((entry) => entry.assetId === resourceId);
  if (profile) return profile.name;
  return EASYRPG_FACESET_ASSETS.find((asset) => asset.id === resourceId)?.name ?? resourceId;
}

function positionLabel(position: "left" | "right"): string {
  return position === "right" ? "오른쪽" : "왼쪽";
}
