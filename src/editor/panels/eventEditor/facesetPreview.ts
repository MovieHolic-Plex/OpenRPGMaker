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
const FACE_PREVIEW_WIDTH = 70;
const FACE_PREVIEW_HEIGHT = 70;
const FACE_PREVIEW_SCALE_X = FACE_PREVIEW_WIDTH / FACESET_FACE_WIDTH;
const FACE_PREVIEW_SCALE_Y = FACE_PREVIEW_HEIGHT / FACESET_FACE_HEIGHT;

export type FacesetPreviewOptions = {
  readonly faceIndex: number;
  readonly flipHorizontally: boolean;
  readonly position: "left" | "right";
  readonly resourceId: string;
};

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

  const crop = faceCrop(url, normalizedIndex, name);
  preview.append(
    crop,
    el("div", {
      class: "event-command-face-preview-copy",
      children: [
        el("strong", { text: resourceId || name }),
        el("span", { text: `얼굴 ${normalizedIndex + 1} / ${positionLabel(options.position)}${options.flipHorizontally ? " / 좌우 반전" : ""}` }),
      ],
    })
  );
  return preview;
}

function faceCrop(url: string, faceIndex: number, name: string): HTMLElement {
  const col = faceIndex % FACESET_COLUMNS;
  const row = Math.floor(faceIndex / FACESET_COLUMNS);
  const crop = el("div", {
    class: "event-command-face-crop",
    attrs: { "aria-label": `${name} 얼굴 ${faceIndex + 1} 미리보기`, role: "img" },
    dataset: { testid: "event-command-face-crop" },
  });
  crop.style.setProperty("--face-url", `url("${url}")`);
  crop.style.setProperty("--face-x", `-${col * FACESET_FACE_WIDTH}px`);
  crop.style.setProperty("--face-y", `-${row * FACESET_FACE_HEIGHT}px`);
  crop.style.setProperty("--face-sheet-size", `${FACESET_SHEET_WIDTH}px`);
  crop.style.setProperty("--face-display-width", `${FACE_PREVIEW_WIDTH}px`);
  crop.style.setProperty("--face-display-height", `${FACE_PREVIEW_HEIGHT}px`);
  crop.style.setProperty("--face-scaled-x", `-${col * FACESET_FACE_WIDTH * FACE_PREVIEW_SCALE_X}px`);
  crop.style.setProperty("--face-scaled-y", `-${row * FACESET_FACE_HEIGHT * FACE_PREVIEW_SCALE_Y}px`);
  crop.style.setProperty("--face-scaled-sheet-width", `${FACESET_SHEET_WIDTH * FACE_PREVIEW_SCALE_X}px`);
  crop.style.setProperty("--face-scaled-sheet-height", `${FACESET_SHEET_HEIGHT * FACE_PREVIEW_SCALE_Y}px`);
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
