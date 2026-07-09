import { el } from "@/util/dom";
import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Command } from "@/project/types";

// RM2003 그림 표시 좌표계(320x240 기준). 그림은 중심 앵커.
const SCREEN_W = 320;
const SCREEN_H = 240;

// showPicture 프리뷰: 4:3 화면 목업 위에 그림 썸네일을 좌표에 배치. 리소스가 없으면 위치 마커만.
export function previewPicture(cmd: Extract<Command, { kind: "showPicture" }>): HTMLElement {
  const root = el("div", { class: "ecp-picture", dataset: { testid: "ecp-picture-preview" } });
  const screen = el("div", { class: "ecp-picture-screen" });
  const url = resolveAssetResourceUrl(cmd.resourceId, { project: store.getCurrent() });
  const marker = el("div", { class: `ecp-picture-marker${url ? "" : " missing"}` });
  marker.style.left = `${clampPct((cmd.x / SCREEN_W) * 100)}%`;
  marker.style.top = `${clampPct((cmd.y / SCREEN_H) * 100)}%`;
  if (url) {
    marker.append(el("img", { class: "ecp-picture-img", attrs: { src: url, alt: "", draggable: "false" } }));
  } else {
    marker.append(el("span", { class: "ecp-picture-missing-label", text: `#${cmd.pictureId}` }));
  }
  screen.append(marker);
  root.append(screen);
  root.append(el("div", { class: "ecp-picture-caption", text: `그림 ${cmd.pictureId} · (${cmd.x}, ${cmd.y})` }));
  return root;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}
