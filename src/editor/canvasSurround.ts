// Phaser 카메라 바탕은 CSS 변수를 모르므로 tokens.css 의 --bg-canvas 를 직접 읽어 넘긴다.

const FALLBACK_CANVAS_SURROUND = "#E9E9E7";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readCanvasSurroundColor(): string {
  const root = globalThis.document?.documentElement;
  if (!root || typeof getComputedStyle !== "function") return FALLBACK_CANVAS_SURROUND;
  const value = getComputedStyle(root).getPropertyValue("--bg-canvas").trim();
  return value || FALLBACK_CANVAS_SURROUND;
}

export function watchCanvasSurroundColor(apply: (color: string) => void): () => void {
  const media = globalThis.matchMedia?.(DARK_QUERY);
  if (!media) return () => {};
  const onChange = (): void => apply(readCanvasSurroundColor());
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
