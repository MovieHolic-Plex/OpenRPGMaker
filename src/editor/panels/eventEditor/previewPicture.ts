import { el } from "@/util/dom";
import { store } from "@/project/store";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Command } from "@/project/types";

// RM2003 그림 표시 좌표계(320x240 기준).
// 앵커는 런타임과 같은 좌상단이다(runtime/pictures.css 의 transform-origin: top left).
const SCREEN_W = 320;
const SCREEN_H = 240;

// showPicture 프리뷰: 4:3 화면 목업 위에 그림 썸네일을 좌표에 배치.
// 리소스가 해석되면 이미지, 아니면 x/y 위치 플레이스홀더 프레임.
export function previewPicture(cmd: Extract<Command, { kind: "showPicture" }>): HTMLElement {
  const root = el("div", { class: "ecp-picture", dataset: { testid: "ecp-picture-preview" } });
  const screen = el("div", { class: "ecp-picture-screen" });
  const url = resolveAssetResourceUrl(cmd.resourceId, { project: store.getCurrent() });
  const marker = el("div", {
    class: `ecp-picture-marker${url ? "" : " missing"}`,
  });
  marker.style.left = `${clampPct((cmd.x / SCREEN_W) * 100)}%`;
  marker.style.top = `${clampPct((cmd.y / SCREEN_H) * 100)}%`;
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
        text: cmd.resourceId?.trim() ? cmd.resourceId : `#${cmd.pictureId}`,
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
  const bits = [`그림 ${cmd.pictureId}`, `(${cmd.x}, ${cmd.y})`];
  if (cmd.resourceId?.trim()) bits.push(cmd.resourceId.trim());
  if (cmd.scale !== undefined) bits.push(`×${cmd.scale}`);
  if (cmd.opacity !== undefined) bits.push(`α${cmd.opacity}`);
  root.append(el("div", { class: "ecp-picture-caption", text: bits.join(" · ") }));
  return root;
}

function clampPct(value: number): number {
  return Math.max(0, Math.min(100, value));
}
