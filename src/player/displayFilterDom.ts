/**
 * 화면 표시 필터(system.displayFilter)를 플레이 무대(.play-stage) 맨 위에 깐다 — project/displayFilter.ts.
 * 무대는 논리 해상도 상자를 정수 배율로 키우므로 논리 2px 가로줄이 화면에서도 고르게 선다.
 * 전투·대화·메뉴도 같은 무대 안에 붙으므로 한 층이 전부를 덮는다.
 */
import { normalizeDisplayFilter } from "@/project/displayFilter";

export const DISPLAY_FILTER_TESTID = "display-filter";

const SCANLINES = "repeating-linear-gradient(to bottom, transparent 0 1px, rgb(0 0 0 / 26%) 1px 2px)";
const SHADOW_MASK = "repeating-linear-gradient(to right, rgb(255 60 60 / 7%) 0 1px, rgb(60 255 90 / 7%) 1px 2px, rgb(70 110 255 / 7%) 2px 3px)";
const VIGNETTE = "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 62%, rgb(0 0 0 / 42%) 100%)";

export function syncDisplayFilter(stage: HTMLElement, value: unknown): void {
  const filter = normalizeDisplayFilter(value);
  let layer = stage.querySelector<HTMLElement>(`:scope > [data-testid='${DISPLAY_FILTER_TESTID}']`);
  if (!filter) {
    layer?.remove();
    return;
  }
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "display-filter";
    layer.dataset.testid = DISPLAY_FILTER_TESTID;
    layer.setAttribute("aria-hidden", "true");
    Object.assign(layer.style, { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "2147483000" });
  }
  // 무대에 나중에 붙는 층(전투·메뉴)보다 늘 위 — z 가 같아도 이기도록 매번 맨 끝으로 옮긴다.
  stage.append(layer);
  layer.dataset.filter = filter;
  layer.style.backgroundImage = filter === "crt" ? [SCANLINES, SHADOW_MASK, VIGNETTE].join(", ") : SCANLINES;
  layer.style.boxShadow = filter === "crt" ? "inset 0 0 40px 8px rgb(0 0 0 / 55%)" : "";
  layer.style.borderRadius = filter === "crt" ? "18px" : "";
}
