// 메뉴에서 고른 갤러리 그림을 게임 화면 크기로 연다.
// 좌우로 넘기고, 결정·취소로 닫는다.
//
// 창은 모달인데 이름이 없었고, 좌우로 넘기면 캡션 노드를 통째로 갈아끼워
// 보조기술이 새 그림을 읽지 못했다. 보이는 캡션이 창 이름이고, 넘긴 뒤의
// 문장만 상태 알림으로 보낸다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { galleryMenuLabel } from "@/project/gallery";
import { vnGalleryLabel, vnUiText } from "@/player/vnExtrasStrings";
import { resolveVnExtras, vnExtrasLanguage } from "@/project/vnExtras";
import { resourceDisplayName } from "@/player/resourceDisplay";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

const CAPTION_ID = "gallery-viewer-caption";
const MISSING_ID = "gallery-viewer-missing";

type ViewerState = {
  readonly resourceIds: readonly string[];
  index: number;
  readonly project: Project;
  readonly root: HTMLElement;
  readonly caption: HTMLElement;
  readonly announcement: HTMLElement;
  figure?: HTMLElement;
  /** 첫 그림은 포커스된 창 이름으로 읽힌다. 그 다음 넘김부터 알린다. */
  seen: boolean;
};

let viewer: ViewerState | undefined;
let returnFocus: HTMLElement | null = null;

export function galleryViewerIsOpen(): boolean {
  return viewer !== undefined;
}

export function closeGalleryViewer(): void {
  const restore = returnFocus;
  returnFocus = null;
  const root = viewer?.root;
  viewer = undefined;
  root?.remove();
  if (restore?.isConnected) restore.focus({ preventScroll: true });
}

export function openGalleryViewer(options: {
  readonly project: Project;
  readonly resourceIds: readonly string[];
  readonly index: number;
}): void {
  closeGalleryViewer();
  if (options.resourceIds.length === 0) return;
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const parent = document.querySelector(".play-stage") ?? document.body;
  const vn = galleryLanguage(options.project);
  const caption = el("p", {
    class: "gallery-viewer-caption",
    attrs: { id: CAPTION_ID },
    dataset: { testid: "gallery-viewer-caption" },
  });
  const announcement = el("p", {
    class: "gallery-viewer-announcement",
    dataset: { testid: "gallery-viewer-announcement" },
    attrs: { role: "status", "aria-live": "polite", "aria-atomic": "true" },
  });
  const closeButton = el("button", {
    class: "gallery-viewer-close",
    text: vn ? vnUiText(vn, "gallery.close") : "닫기",
    attrs: { type: "button" },
    dataset: { testid: "gallery-viewer-close" },
    on: { click: () => closeGalleryViewer() },
  });
  const root = el("div", {
    class: "gallery-viewer",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": CAPTION_ID,
      tabindex: "-1",
    },
    dataset: { testid: "gallery-viewer" },
    children: [caption, closeButton, announcement],
  });
  parent.append(root);
  viewer = {
    resourceIds: options.resourceIds,
    index: clampIndex(options.index, options.resourceIds.length),
    project: options.project,
    root,
    caption,
    announcement,
    seen: false,
  };
  paint();
  root.focus({ preventScroll: true });
}

export function stepGalleryViewer(delta: number): void {
  if (!viewer) return;
  const count = viewer.resourceIds.length;
  if (count === 0) return;
  viewer.index = (viewer.index + delta + count) % count;
  paint();
}

function galleryLanguage(project: Project): ReturnType<typeof vnExtrasLanguage> | undefined {
  // 연애 기본 구성/저작의 갤러리는 저작 언어로 글자를 보인다. 그 밖은 예전 한국어 그대로.
  return resolveVnExtras(project)?.gallery.enabled === true ? vnExtrasLanguage(project) : undefined;
}

function paint(): void {
  const state = viewer;
  if (!state) return;
  const resourceId = state.resourceIds[state.index] ?? "";
  const vn = galleryLanguage(state.project);
  const label = vn ? vnGalleryLabel(state.project) : galleryMenuLabel(state.project);
  const name = resourceDisplayName(resourceId, vn ? vnUiText(vn, "gallery.item", state.index + 1) : "그림");
  const url = resolveAssetResourceUrl(resourceId, { project: state.project });
  const missingText = vn ? vnUiText(vn, "gallery.missing") : "그림을 찾을 수 없습니다.";
  const figure = url
    ? el("img", {
        class: "gallery-viewer-image",
        attrs: { src: url, alt: name },
        dataset: { testid: "gallery-viewer-image" },
      })
    : el("p", {
        class: "gallery-viewer-missing",
        text: missingText,
        attrs: { id: MISSING_ID },
        dataset: { testid: "gallery-viewer-missing" },
      });
  if (url) state.root.removeAttribute("aria-describedby");
  else state.root.setAttribute("aria-describedby", MISSING_ID);
  if (state.figure) state.figure.replaceWith(figure);
  else state.root.insertBefore(figure, state.caption);
  state.figure = figure;
  const captionText = `${label} ${state.index + 1}/${state.resourceIds.length} · ${name}`;
  state.caption.textContent = captionText;
  // 같은 알림 노드의 글만 바꾼다. 노드를 다시 만들면 라이브 영역이 읽히지 않는다.
  if (state.seen) state.announcement.textContent = url ? captionText : `${captionText}. ${missingText}`;
  else state.seen = true;
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), count - 1);
}
