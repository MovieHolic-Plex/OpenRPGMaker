import { el } from "@/util/dom";
import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Command } from "@/project/types";
import { pictureSlotCaption } from "./options";
import { resolvePlayResolution } from "@/project/playResolution";

// 그림 좌표는 프로젝트 플레이 해상도 기준(기본 320x240, 작가가 바꾸면 그 화면비).

// showPicture 프리뷰: 4:3 화면 목업 위에 그림 썸네일을 좌표에 배치.
// 리소스가 해석되면 이미지, 아니면 x/y 위치 플레이스홀더 프레임.
export function previewPicture(cmd: Extract<Command, { kind: "showPicture" }>): HTMLElement {
  const play = resolvePlayResolution(store.getCurrent().system);
  const screenW = play.width;
  const screenH = play.height;
  const root = el("div", { class: "ecp-picture", dataset: { testid: "ecp-picture-preview" } });
  const screen = el("div", { class: "ecp-picture-screen" });
  screen.style.aspectRatio = `${screenW} / ${screenH}`;
  const url = resolveAssetResourceUrl(cmd.resourceId, { project: store.getCurrent() });
  const marker = el("div", {
    class: `ecp-picture-marker${url ? "" : " missing"}`,
  });
  marker.style.left = `${clampPct((cmd.x / screenW) * 100)}%`;
  marker.style.top = `${clampPct((cmd.y / screenH) * 100)}%`;
  if (url) {
    marker.append(
      el("img", {
        class: "ecp-picture-img",
        attrs: { src: url, alt: "", draggable: "false" },
      })
    );
  } else {
    const frame = el("div", { class: "ecp-picture-placeholder-frame" });
    frame.append(
      el("span", {
        class: "ecp-picture-missing-label",
        text: cmd.resourceId?.trim() ? humanizePictureCaption(cmd.resourceId) : pictureSlotCaption(cmd.pictureId),
      })
    );
    frame.append(
      el("span", {
        class: "ecp-picture-placeholder-xy",
        text: `(${cmd.x}, ${cmd.y})`,
      })
    );
    marker.append(frame);
  }
  screen.append(marker);
  root.append(screen);
  const bits = [pictureSlotCaption(cmd.pictureId), `(${cmd.x}, ${cmd.y})`];
  if (cmd.resourceId?.trim()) bits.push(humanizePictureCaption(cmd.resourceId));
  if (cmd.scale !== undefined) bits.push(`×${cmd.scale}`);
  if (cmd.opacity !== undefined) bits.push(`α${cmd.opacity}`);
  root.append(el("div", { class: "ecp-picture-caption", text: bits.join(" · ") }));
  return root;
}

function humanizePictureCaption(id: string): string {
  const slug = id.trim().replace(/^easyrpg-picture-/, "").replace(/^easyrpg-/, "").replace(/[-_]+/g, " ");
  const named: Record<string, string> = { cloud: "구름" };
  return named[slug.toLowerCase()] ?? ( /[가-힣]/.test(slug) ? slug : slug );
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}
