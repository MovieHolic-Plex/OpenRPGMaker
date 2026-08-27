// 얼굴 표면 공용 렌더러. 얼굴 한 칸 = 파일 한 장이므로 4×4 시트 크롭과 칸 번호는 없다.
// 남은 축은 표시 모드(chip 48px 낱장 / bust / full)와 위치·좌우 반전뿐이다.
import { LEGACY_FACESET_SHEET_ASSETS } from "@/assets/easyrpgRtp";
import { FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { FACE_IMAGE_SIZE } from "@/assets/resourceSlicing";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  listDatabaseResourceOptions,
  type DatabaseResourceOption,
} from "@/editor/panels/databaseResourcePickerDialog";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/** Form/editor chip size (한 장 얼굴은 48×48 — 가독성을 위해 확대한다). */
const FACE_PREVIEW_SIZE = 96;

export type FacesetPreviewOptions = {
  readonly flipHorizontally: boolean;
  readonly position: "left" | "right";
  readonly resourceId: string;
  /** 표시 픽셀 크기; 에디터 카드 기본값 96. */
  readonly displaySize?: number;
};

/** Full card with image + resource labels (left form / standalone dialogs). */
export function renderFacesetPreview(options: FacesetPreviewOptions): HTMLElement {
  const resourceId = options.resourceId.trim();
  const name = facesetName(resourceId);
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  const mode = faceDisplayModeOf(resourceId);
  const bust = mode !== "chip";
  const preview = el("div", {
    class: `event-command-face-preview${options.flipHorizontally ? " flipped" : ""}${bust ? " is-bust" : ""} face-mode-${mode}`,
    dataset: {
      testid: "event-command-face-preview",
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
    ? bustVisual(url, name, options.displaySize ?? FACE_PREVIEW_SIZE, mode)
    : faceImage(url, name, options.displaySize);
  preview.append(
    visual,
    el("div", {
      class: "event-command-face-preview-copy",
      children: [
        el("strong", { text: name }),
        el("span", {
          text: `${modeLabel(mode)} · ${positionLabel(options.position)}${options.flipHorizontally ? " · 좌우 반전" : ""}`,
        }),
        el("span", { class: "event-command-face-preview-id", text: resourceId }),
      ],
    })
  );
  return preview;
}

/**
 * 리소스 id 크롬 없는 얼굴 그림 — 게임 메시지 창 목업용.
 */
export function renderFacesetCrop(options: {
  readonly resourceId: string;
  readonly flipHorizontally?: boolean;
  readonly displaySize?: number;
  readonly position?: "left" | "right";
}): HTMLElement {
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
      ? bustVisual(url, name, options.displaySize ?? FACE_PREVIEW_SIZE, mode)
      : faceImage(url, name, options.displaySize)
  );
  return shell;
}

/** 표시 모드 — chip 은 48×48 낱장 얼굴, bust/full 은 통짜 초상. */
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

/**
 * 낱장 얼굴 그림 한 장을 요청한 표시 크기로 그린다.
 * 박스(faceset-crop-box) + 실제 <img>(faceset-crop-sheet) 구조는 유지한다 —
 * DOM 에 진짜 그림이 붙어 있는지로 "카피만 있는 미리보기"를 걸러내는 계약이다.
 */
function faceImage(url: string, name: string, displaySize?: number): HTMLElement {
  const size = Math.max(FACE_IMAGE_SIZE, Math.trunc(displaySize ?? FACE_PREVIEW_SIZE));
  const box = el("div", {
    class: "event-command-face-crop faceset-crop-box",
    attrs: { "aria-label": `${name} 얼굴 미리보기`, role: "img" },
    dataset: { testid: "event-command-face-crop", faceImage: "1" },
  });
  box.style.setProperty("--face-url", `url("${url}")`);
  box.style.setProperty("--face-display-width", `${size}px`);
  box.style.setProperty("--face-display-height", `${size}px`);
  const image = el("img", {
    class: "faceset-crop-sheet",
    attrs: { src: url, alt: "", draggable: "false", "aria-hidden": "true" },
    dataset: { testid: "faceset-crop-sheet" },
  });
  // 로드 실패는 그림만 떼어 CSS 배경 폴백에 맡긴다.
  image.addEventListener("error", () => image.remove());
  box.append(image);
  return box;
}

function facesetName(resourceId: string): string {
  if (!resourceId) return "얼굴 없음";
  const project = store.getCurrent();
  const uploaded = project.assets.uploaded[resourceId];
  if (uploaded) return uploaded.name;
  const profile = project.resourceProfiles.find((entry) => entry.assetId === resourceId);
  if (profile) return profile.name;
  const face = FACESET_FACE_ASSETS.find((asset) => asset.id === resourceId);
  if (face) return face.name;
  return LEGACY_FACESET_SHEET_ASSETS.find((asset) => asset.id === resourceId)?.name ?? resourceId;
}

function positionLabel(position: "left" | "right"): string {
  return position === "right" ? "오른쪽" : "왼쪽";
}

function modeLabel(mode: FaceDisplayMode): string {
  if (mode === "full") return "전신";
  if (mode === "bust") return "흉상";
  return "얼굴";
}

export type FaceGalleryHandle = {
  readonly root: HTMLElement;
  /** 선택 강조만 갱신한다 — 112장을 매 입력마다 다시 만들지 않는다. */
  readonly setSelected: (resourceId: string) => void;
};

/**
 * 낱장 얼굴 갤러리. 4×4 칸 번호 격자를 대신하는 작업 표면으로, 고른 결과는 리소스 id 하나다.
 * 목록 정본은 데이터베이스 피커와 같은 listDatabaseResourceOptions("faceset") 를 쓴다.
 */
export function renderFaceGallery(options: {
  readonly selectedId: string;
  readonly onSelect: (resourceId: string) => void;
  /** 셀 표시 크기(px); 기본 48(낱장 원본 크기). */
  readonly cellSize?: number;
}): FaceGalleryHandle {
  const project = store.getCurrent();
  const cellSize = Math.max(FACE_IMAGE_SIZE, Math.trunc(options.cellSize ?? FACE_IMAGE_SIZE));
  const faces: readonly DatabaseResourceOption[] = listDatabaseResourceOptions("faceset", project);
  const gallery = el("div", {
    class: "event-command-face-gallery",
    attrs: { role: "listbox", "aria-label": "얼굴 그림 선택" },
    dataset: { testid: "event-command-face-gallery" },
  });
  if (faces.length === 0) {
    gallery.dataset.empty = "true";
    gallery.append(
      el("div", { class: "event-command-face-gallery-empty", text: "쓸 수 있는 얼굴 그림이 없습니다." })
    );
    return { root: gallery, setSelected: () => {} };
  }
  const cells = new Map<string, HTMLElement>();
  for (const face of faces) {
    const url = resolveAssetResourceUrl(face.id, { project });
    const selected = face.id === options.selectedId;
    const cell = el("button", {
      class: selected ? "event-command-face-gallery-cell is-selected" : "event-command-face-gallery-cell",
      attrs: {
        type: "button",
        role: "option",
        "aria-selected": selected ? "true" : "false",
        title: face.name,
        "aria-label": face.name,
      },
      dataset: { testid: `event-command-face-option-${face.id}`, resourceId: face.id },
      on: { click: () => options.onSelect(face.id) },
    });
    cell.append(url === null ? el("span", { class: "event-command-face-gallery-missing", text: "?" }) : faceImage(url, face.name, cellSize));
    cells.set(face.id, cell);
    gallery.append(cell);
  }
  return {
    root: gallery,
    setSelected: (resourceId: string) => {
      for (const [id, cell] of cells) {
        const selected = id === resourceId;
        cell.classList.toggle("is-selected", selected);
        cell.setAttribute("aria-selected", selected ? "true" : "false");
      }
    },
  };
}
