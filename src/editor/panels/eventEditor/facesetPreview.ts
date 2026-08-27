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
  const mode = faceDisplayModeOf(resourceId);
  const bust = mode !== "chip";
  const preview = el("div", {
    class: `event-command-face-preview${options.flipHorizontally ? " flipped" : ""}${bust ? " is-bust" : ""} face-mode-${mode}`,
    dataset: {
      testid: "event-command-face-preview",
      faceIndex: String(normalizedIndex),
      resourceId,
      faceMode: mode,
    },
  });

  if (url === null) {
    preview.dataset.empty = "true";
    preview.append(
      el("strong", { text: resourceId || "얼굴 없음" }),
      el("span", { text: resourceId ? "미리보기를 찾을 수 없습니다." : "얼굴을 고르면 여기에 보입니다." })
    );
    return preview;
  }

  const visual = bust
    ? bustVisual(url, name, options.displaySize ?? 96, mode)
    : faceCrop(url, normalizedIndex, name, options.displaySize);
  preview.append(
    visual,
    el("div", {
      class: "event-command-face-preview-copy",
      children: [
        el("strong", { text: name }),
        el("span", {
          text: bust
            ? `${mode === "full" ? "전신" : "흉상"} · ${positionLabel(options.position)}${options.flipHorizontally ? " · 좌우 반전" : ""}`
            : `얼굴 ${normalizedIndex + 1} · ${positionLabel(options.position)}${options.flipHorizontally ? " · 좌우 반전" : ""}`,
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
  readonly position?: "left" | "right";
}): HTMLElement {
  const normalizedIndex = normalizedFaceIndex(options.faceIndex);
  const resourceId = options.resourceId.trim();
  const name = facesetName(resourceId);
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const mode = faceDisplayModeOf(resourceId);
  const whole = mode !== "chip";
  const position = options.position === "right" ? "right" : "left";
  const shell = el("div", {
    class: [
      "event-command-face-crop-shell",
      options.flipHorizontally ? "flipped" : "",
      whole ? "is-bust" : "",
      `face-mode-${mode}`,
      `face-pos-${position}`,
    ]
      .filter(Boolean)
      .join(" "),
    dataset: {
      testid: "event-command-face-crop-shell",
      faceIndex: String(normalizedIndex),
      resourceId,
      faceMode: mode,
      position,
    },
  });
  if (url === null) {
    shell.dataset.empty = "true";
    shell.append(el("span", { class: "event-command-face-crop-missing", text: resourceId ? "?" : "—" }));
    return shell;
  }
  shell.append(
    whole
      ? bustVisual(url, name, options.displaySize ?? 96, mode)
      : faceCrop(url, normalizedIndex, name, options.displaySize)
  );
  return shell;
}

/** Whole-image face (not a 4×4 faceset cell). */
export type FaceDisplayMode = "chip" | "bust" | "full";

export function faceDisplayModeOf(resourceId: string): FaceDisplayMode {
  const id = resourceId.trim().toLowerCase();
  if (!id) return "chip";
  if (id.includes("-full") || id.includes("fullbody") || id.includes("-body") || id.endsWith("/full")) {
    return "full";
  }
  if (
    id.includes("-bust")
    || id.includes("-portrait")
    || id.startsWith("generated-face-")
    || id.endsWith("/bust")
  ) {
    return "bust";
  }
  return "chip";
}

/** @deprecated use faceDisplayModeOf */
export function isBustResourceId(resourceId: string): boolean {
  return faceDisplayModeOf(resourceId) !== "chip";
}

function bustVisual(url: string, name: string, displaySize: number, mode: FaceDisplayMode = "bust"): HTMLElement {
  const size = Math.max(64, Math.trunc(displaySize));
  const height = mode === "full" ? Math.round(size * 1.7) : Math.round(size * 1.2);
  const node = el("div", {
    class: `event-command-face-crop event-command-face-bust event-command-face-${mode}`,
    attrs: {
      "aria-label": `${name} ${mode === "full" ? "전신" : "흉상"} 미리보기`,
      role: "img",
    },
    dataset: { testid: "event-command-face-crop", faceMode: mode },
  });
  node.style.setProperty("background-image", `url("${url}")`);
  node.style.setProperty("background-position", "bottom center");
  node.style.setProperty("background-repeat", "no-repeat");
  node.style.setProperty("background-size", "contain");
  node.style.setProperty("--face-display-width", `${size}px`);
  node.style.setProperty("--face-display-height", `${height}px`);
  node.style.setProperty("width", `${size}px`);
  node.style.setProperty("height", `${height}px`);
  return node;
}

function faceCrop(url: string, faceIndex: number, name: string, displaySize?: number): HTMLElement {
  const col = faceIndex % FACESET_COLUMNS;
  const row = Math.floor(faceIndex / FACESET_COLUMNS);
  const width = Math.max(48, Math.trunc(displaySize ?? FACE_PREVIEW_WIDTH));
  const height = Math.max(48, Math.trunc(displaySize ?? FACE_PREVIEW_HEIGHT));
  const scaleX = width / FACESET_FACE_WIDTH;
  const scaleY = height / FACESET_FACE_HEIGHT;
  const crop = el("div", {
    // faceset-crop-box: 크롭 박스임을 DOM 으로 식별할 수 있게 한다(카피만 있는 미리보기 금지).
    class: "event-command-face-crop faceset-crop-box",
    attrs: { "aria-label": `${name} 얼굴 ${faceIndex + 1} 미리보기`, role: "img" },
    dataset: { testid: "event-command-face-crop", facesetCrop: "1" },
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
  // 배경 이미지는 DOM 에 아무 자연 크기도 남기지 않는다 — 시트를 실제 <img> 로 붙이고
  // 크롭 박스가 잘라 낸다. 로드 실패는 onerror 로 시트만 떼어 CSS 배경 폴백에 맡긴다.
  const sheet = el("img", {
    class: "faceset-crop-sheet",
    attrs: { src: url, alt: "", draggable: "false", "aria-hidden": "true" },
    dataset: { testid: "faceset-crop-sheet" },
  });
  sheet.addEventListener("error", () => sheet.remove());
  crop.append(sheet);
  return crop;
}

function normalizedFaceIndex(faceIndex: number): number {
  return Math.max(0, Math.min(FACESET_FACE_COUNT - 1, Math.trunc(faceIndex)));
}

function facesetName(resourceId: string): string {
  if (!resourceId) return "얼굴 없음";
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
/** Clickable 4×4 faceset index grid for the changeFace form. */
export function renderFacesetIndexGrid(options: {
  readonly resourceId: string;
  readonly faceIndex: number;
  readonly flipHorizontally?: boolean;
  readonly onSelect: (faceIndex: number) => void;
  /** Cell display size in px; default 56. */
  readonly cellSize?: number;
}): HTMLElement {
  const normalizedIndex = normalizedFaceIndex(options.faceIndex);
  const resourceId = options.resourceId.trim();
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const cellSize = Math.max(40, Math.trunc(options.cellSize ?? 56));
  const grid = el("div", {
    class: "event-command-face-index-grid",
    attrs: {
      role: "listbox",
      "aria-label": "얼굴 칸 선택",
    },
    dataset: { testid: "event-command-face-index-grid" },
  });

  if (!url) {
    grid.dataset.empty = "true";
    grid.append(
      el("div", {
        class: "event-command-face-index-grid-empty",
        text: resourceId
          ? "이 리소스의 얼굴 시트를 불러올 수 없습니다."
          : "위에서 얼굴을 먼저 고르세요.",
      })
    );
    return grid;
  }

  for (let index = 0; index < FACESET_FACE_COUNT; index += 1) {
    const selected = index === normalizedIndex;
    const button = el("button", {
      class: selected
        ? "event-command-face-index-cell is-selected"
        : "event-command-face-index-cell",
      attrs: {
        type: "button",
        role: "option",
        "aria-selected": selected ? "true" : "false",
        title: `얼굴 ${index + 1}`,
        "aria-label": `얼굴 ${index + 1}`,
      },
      dataset: {
        testid: `event-command-face-slot-${index}`,
        faceIndex: String(index),
      },
      on: {
        click: () => options.onSelect(index),
      },
    }) as HTMLButtonElement;

    if (options.flipHorizontally) button.classList.add("flipped");
    button.append(faceCrop(url, index, facesetName(resourceId), cellSize));
    grid.append(button);
  }

  return grid;
}
