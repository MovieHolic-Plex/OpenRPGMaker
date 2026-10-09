// 메뉴에서 고른 갤러리 그림을 게임 화면 크기로 연다.
// 좌우로 넘기고, 결정·취소로 닫는다.

import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { galleryMenuLabel } from "@/project/gallery";
import { resourceDisplayName } from "@/player/resourceDisplay";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

type ViewerState = {
  readonly resourceIds: readonly string[];
  index: number;
  readonly project: Project;
  readonly root: HTMLElement;
};

let viewer: ViewerState | undefined;

export function galleryViewerIsOpen(): boolean {
  return viewer !== undefined;
}

export function closeGalleryViewer(): void {
  viewer?.root.remove();
  viewer = undefined;
}

export function openGalleryViewer(options: {
  readonly project: Project;
  readonly resourceIds: readonly string[];
  readonly index: number;
}): void {
  closeGalleryViewer();
  if (options.resourceIds.length === 0) return;
  const parent = document.querySelector(".play-stage") ?? document.body;
  const root = el("div", {
    class: "gallery-viewer",
    attrs: { role: "dialog", "aria-modal": "true" },
    dataset: { testid: "gallery-viewer" },
  });
  parent.append(root);
  viewer = {
    resourceIds: options.resourceIds,
    index: clampIndex(options.index, options.resourceIds.length),
    project: options.project,
    root,
  };
  paint();
}

export function stepGalleryViewer(delta: number): void {
  if (!viewer) return;
  const count = viewer.resourceIds.length;
  if (count === 0) return;
  viewer.index = (viewer.index + delta + count) % count;
  paint();
}

function paint(): void {
  const state = viewer;
  if (!state) return;
  const resourceId = state.resourceIds[state.index] ?? "";
  const label = galleryMenuLabel(state.project);
  const name = resourceDisplayName(resourceId, "그림");
  const url = resolveAssetResourceUrl(resourceId, { project: state.project });
  const figure = url
    ? el("img", {
        class: "gallery-viewer-image",
        attrs: { src: url, alt: name },
        dataset: { testid: "gallery-viewer-image" },
      })
    : el("p", {
        class: "gallery-viewer-missing",
        text: "그림을 찾을 수 없습니다.",
        dataset: { testid: "gallery-viewer-missing" },
      });
  state.root.replaceChildren(
    figure,
    el("p", {
      class: "gallery-viewer-caption",
      text: `${label} ${state.index + 1}/${state.resourceIds.length} · ${name}`,
      dataset: { testid: "gallery-viewer-caption" },
    }),
    el("button", {
      class: "gallery-viewer-close",
      text: "닫기",
      attrs: { type: "button" },
      dataset: { testid: "gallery-viewer-close" },
      on: { click: () => closeGalleryViewer() },
    }),
  );
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.trunc(index), count - 1);
}
