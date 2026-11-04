// editor/aiReferenceView.ts
// 실행에 참고 그림(사용자가 붙인 그림, 또는 「그림 도안 먼저」 도안 — assistant-ramps-imageplan)이 있으면 캔버스 옆에 작게 띄우고,
// 조수가 지금 짓는 자리를 그 그림 위 사각형으로 표시한다(오너 2026-11-04, 승인 4안 중 4번).
// 도안은 맵 전체를 한 장으로 그린 그림이라(src/ai/imagePlan.ts), 맵 칸 좌표를 그림 크기에 비례해 옮기면 같은 자리가 된다.
// 그림 생성·읽기는 하지 않는다 — 이미 실행에 실린 그림을 보여 줄 뿐이다.
import { applyMapDeltas } from "@/ai/piAgent/mapDelta";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { followRegionsFromDeltas, type FollowRegion } from "@/editor/aiFollowCamera";
import { isAiLiveCanvasEnabled, subscribeAiLiveCanvas } from "@/editor/aiLiveCanvas";
import type { GameMap, Project } from "@/project/types";
import { el } from "@/util/dom";

/** 맵 칸 사각형 → 그림 위 비율 사각형(0~1). 그림이 맵 전체를 그린다고 본다. */
export function referenceMarkerRect(region: Pick<FollowRegion, "x" | "y" | "w" | "h">, map: Pick<GameMap, "width" | "height">): { left: number; top: number; width: number; height: number } {
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  const left = clamp(region.x / map.width), top = clamp(region.y / map.height);
  return { left, top, width: clamp((region.x + region.w) / map.width) - left, height: clamp((region.y + region.h) / map.height) - top };
}

export interface AiReferenceView {
  event(event: PiAgentEvent): void;
  finish(): void;
}

export function createAiReferenceView(options: { readonly images: readonly string[]; readonly baseProject: Project }): AiReferenceView {
  const host = typeof document === "undefined" ? null : document.querySelector<HTMLElement>(".phaser-container");
  const image = options.images.find((src) => typeof src === "string" && src.startsWith("data:image/"));
  if (!host || !image) return { event() {}, finish() {} };
  let maps: Record<string, GameMap> = { ...(options.baseProject.maps ?? {}) };
  let builtMapId: string | null = null;

  const marker = el("span", { class: "canvas-ai-reference-marker", dataset: { testid: "ai-reference-marker" } });
  marker.hidden = true;
  const picture = el("img", { class: "canvas-ai-reference-image", attrs: { src: image, alt: "참고 그림" } });
  const caption = el("figcaption", { class: "canvas-ai-reference-caption", text: "참고 그림" });
  const toggle = el("button", { class: "canvas-ai-reference-toggle", text: "−", attrs: { type: "button", "aria-label": "참고 그림 접기", "aria-expanded": "true" } }) as HTMLButtonElement;
  const root = el("figure", {
    class: "canvas-ai-reference-view", dataset: { testid: "ai-reference-view" }, attrs: { "aria-label": "조수가 보는 참고 그림" },
    children: [el("div", { class: "canvas-ai-reference-frame", children: [picture, marker] }), el("div", { class: "canvas-ai-reference-bar", children: [caption, toggle] })],
  });
  toggle.addEventListener("click", () => {
    const folded = root.classList.toggle("is-folded");
    toggle.textContent = folded ? "+" : "−";
    toggle.setAttribute("aria-expanded", String(!folded));
    toggle.setAttribute("aria-label", folded ? "참고 그림 펼치기" : "참고 그림 접기");
  });
  const visibility = (): void => { root.hidden = !isAiLiveCanvasEnabled(); };
  visibility();
  const unsubscribe = subscribeAiLiveCanvas(visibility);
  host.append(root);

  return {
    event(raw) {
      let event = raw;
      while (event.type === "agent_event") event = event.event;
      if (event.type !== "map_delta" || !event.maps.length) return;
      maps = applyMapDeltas(maps, event.maps);
      const region = followRegionsFromDeltas(event.maps, (id) => maps[id]).at(-1);
      const map = region ? maps[region.mapId] : undefined;
      if (!region || !map) return;
      // 도안은 지을 맵 한 장의 그림이다 — 처음 쓰기 시작한 맵에만 사각형을 그린다. 다른 맵을 짓는 동안은 이름만 알린다.
      builtMapId ??= region.mapId;
      const name = map.name?.trim() || map.id;
      if (region.mapId !== builtMapId) {
        marker.hidden = true;
        caption.textContent = `참고 그림 · 지금 「${name}」 짓는 중`;
        return;
      }
      const rect = referenceMarkerRect(region, map);
      marker.style.left = `${rect.left * 100}%`;
      marker.style.top = `${rect.top * 100}%`;
      marker.style.width = `${Math.max(rect.width * 100, 3)}%`;
      marker.style.height = `${Math.max(rect.height * 100, 3)}%`;
      marker.hidden = false;
      caption.textContent = `참고 그림 · 「${name}」 지금 짓는 곳`;
    },
    finish() {
      unsubscribe();
      root.remove();
    },
  };
}
