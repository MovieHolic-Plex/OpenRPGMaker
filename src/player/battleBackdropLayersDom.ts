/**
 * 전투 배경 겹(TroopRecord.backdropLayers)을 그린다 — project/battleBackdropLayers.ts 가 어휘·기본값을 갖는다.
 *
 * - 뒤 겹(front 아님): 배경 노드(`.battle-backdrop`) 안 맨 위(z 1). 겹 배경 스킨의 지형 카메라가 나중에 붙어도 그 위다.
 *   섞기는 배경 노드의 스태킹 컨텍스트 안에서 배경 그림·지형과 섞인다.
 * - 앞 겹(front): 필드(`.battle-field`) 안 z 25 — 배틀러·이펙트 앞, 화면 색조 층(z 30) 아래.
 *
 * 흐름은 rAF 하나가 background-position 을 민다. 노드가 문서에서 빠지면 루프가 스스로 멈춘다.
 * 움직임 줄이기 선호면 정지 그림으로 둔다.
 */
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { BATTLE_BACKDROP_LAYER_LIMIT, resolvedBattleBackdropLayer, type BattleBackdropLayerPreset } from "@/project/battleBackdropLayers";
import { cssMixBlendMode } from "@/project/blendMode";
import type { BattleBackdropLayer, Project } from "@/project/types";

export const BATTLE_BACKDROP_LAYER_TESTID = "battle-backdrop-layer";

/** 프리셋 그림: 배경 층 목록 + 한 칸 크기(px). 칸이 바둑판으로 반복되므로 흐름이 이어진다. */
const PRESET_PAINT: Record<BattleBackdropLayerPreset, { readonly image: string; readonly size: string; readonly repeat?: string; readonly position?: string }> = {
  fog: {
    image: [
      "radial-gradient(ellipse 42% 26% at 22% 40%, rgb(255 255 255 / 85%), transparent 72%)",
      "radial-gradient(ellipse 34% 22% at 70% 62%, rgb(240 244 255 / 80%), transparent 72%)",
      "radial-gradient(ellipse 30% 16% at 48% 16%, rgb(255 255 255 / 60%), transparent 72%)",
      "linear-gradient(rgb(235 240 250 / 22%), rgb(235 240 250 / 22%))",
    ].join(", "),
    size: "640px 300px",
  },
  clouds: {
    image: [
      "radial-gradient(ellipse 16% 12% at 18% 30%, rgb(255 255 255 / 85%) 40%, transparent 72%)",
      "radial-gradient(ellipse 12% 10% at 26% 26%, rgb(255 255 255 / 80%) 40%, transparent 72%)",
      "radial-gradient(ellipse 20% 13% at 64% 52%, rgb(236 240 255 / 80%) 40%, transparent 72%)",
      "radial-gradient(ellipse 13% 10% at 74% 46%, rgb(255 255 255 / 75%) 40%, transparent 72%)",
    ].join(", "),
    size: "720px 380px",
    repeat: "repeat-x",
    position: "0 0",
  },
  mist: {
    image: [
      "linear-gradient(to top, rgb(235 240 255 / 60%), rgb(235 240 255 / 18%) 22%, transparent 42%)",
      "radial-gradient(ellipse 30% 10% at 30% 88%, rgb(255 255 255 / 55%), transparent 70%)",
      "radial-gradient(ellipse 34% 9% at 76% 92%, rgb(255 255 255 / 50%), transparent 70%)",
    ].join(", "),
    size: "640px 100%",
    repeat: "repeat-x",
  },
  rain: {
    image: "repeating-linear-gradient(104deg, transparent 0 22px, rgb(210 225 255 / 70%) 22px 23px, transparent 23px 47px)",
    size: "96px 128px",
  },
  snow: {
    image: [
      "radial-gradient(circle at 12% 18%, #fff 0 2px, transparent 2.5px)",
      "radial-gradient(circle at 46% 62%, #fff 0 1.5px, transparent 2px)",
      "radial-gradient(circle at 78% 30%, #fff 0 2.5px, transparent 3px)",
      "radial-gradient(circle at 64% 88%, #f0f4ff 0 1.5px, transparent 2px)",
      "radial-gradient(circle at 28% 80%, #fff 0 2px, transparent 2.5px)",
    ].join(", "),
    size: "180px 180px",
  },
  embers: {
    image: [
      "radial-gradient(circle at 20% 30%, #ffd34a 0 2px, transparent 3px)",
      "radial-gradient(circle at 60% 70%, #ff8a2a 0 2.5px, transparent 3.5px)",
      "radial-gradient(circle at 84% 22%, #ff6a1a 0 1.5px, transparent 2.5px)",
      "radial-gradient(circle at 40% 90%, #ffb03a 0 2px, transparent 3px)",
    ].join(", "),
    size: "220px 220px",
  },
  stars: {
    image: [
      "radial-gradient(circle at 10% 20%, #fff 0 1px, transparent 1.5px)",
      "radial-gradient(circle at 34% 64%, #dfe8ff 0 1px, transparent 1.5px)",
      "radial-gradient(circle at 58% 12%, #fff 0 1.5px, transparent 2px)",
      "radial-gradient(circle at 82% 46%, #fff6d8 0 1px, transparent 1.5px)",
      "radial-gradient(circle at 70% 84%, #fff 0 1px, transparent 1.5px)",
    ].join(", "),
    size: "240px 170px",
  },
  lightRays: {
    image: [
      "linear-gradient(112deg, transparent 18%, rgb(255 244 210 / 40%) 24%, transparent 32%)",
      "linear-gradient(112deg, transparent 52%, rgb(255 244 210 / 28%) 56%, transparent 62%)",
      "linear-gradient(112deg, transparent 76%, rgb(255 244 210 / 34%) 81%, transparent 88%)",
    ].join(", "),
    size: "420px 100%",
    repeat: "repeat-x",
  },
};

type Running = { readonly node: HTMLElement; readonly scrollX: number; readonly scrollY: number; x: number; y: number };

/** 이 트룹의 겹을 필드에 깐다(이미 있던 겹은 걷는다). 겹이 없으면 걷기만 한다. */
export function syncBattleBackdropLayers(field: HTMLElement, layers: readonly BattleBackdropLayer[] | undefined, project: Project): void {
  for (const old of field.querySelectorAll(`[data-testid='${BATTLE_BACKDROP_LAYER_TESTID}']`)) old.remove();
  if (!layers?.length) return;
  const backdrop = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']");
  const running: Running[] = [];
  layers.slice(0, BATTLE_BACKDROP_LAYER_LIMIT).forEach((layer, index) => {
    const node = layerNode(layer, index, project);
    if (!node) return;
    if (layer.front) field.append(node);
    else (backdrop ?? field).append(node);
    const resolved = resolvedBattleBackdropLayer(layer);
    if (resolved.scrollX || resolved.scrollY) running.push({ node, scrollX: resolved.scrollX, scrollY: resolved.scrollY, x: 0, y: 0 });
  });
  if (running.length && !prefersReducedMotion()) runScroll(running);
}

function layerNode(layer: BattleBackdropLayer, index: number, project: Project): HTMLElement | null {
  const resolved = resolvedBattleBackdropLayer(layer);
  const node = document.createElement("div");
  node.className = "battle-backdrop-layer";
  node.dataset.testid = BATTLE_BACKDROP_LAYER_TESTID;
  node.dataset.layerIndex = String(index);
  node.dataset.front = String(layer.front === true);
  node.setAttribute("aria-hidden", "true");
  Object.assign(node.style, {
    position: "absolute",
    inset: "0",
    pointerEvents: "none",
    zIndex: layer.front ? "25" : "1",
    opacity: String(resolved.opacity / 100),
    mixBlendMode: cssMixBlendMode(resolved.blendMode),
  });
  const url = layer.resourceId ? resolveAssetResourceUrl(layer.resourceId, { project }) : null;
  if (url) {
    node.dataset.resourceId = layer.resourceId;
    node.style.backgroundImage = `url("${url}")`;
    node.style.backgroundRepeat = "repeat";
    node.style.imageRendering = "pixelated";
    return node;
  }
  if (!layer.preset) return null;
  const paint = PRESET_PAINT[layer.preset];
  node.dataset.preset = layer.preset;
  node.style.backgroundImage = paint.image;
  node.style.backgroundSize = paint.size;
  node.style.backgroundRepeat = paint.repeat ?? "repeat";
  if (paint.position) node.style.backgroundPosition = paint.position;
  return node;
}

function runScroll(running: Running[]): void {
  let previous = 0;
  const frame = (now: number): void => {
    const alive = running.filter((entry) => entry.node.isConnected);
    if (alive.length === 0) return;
    const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    // 탭이 숨으면 rAF 가 멈춘다 — dt 상한(50ms)으로 돌아왔을 때 튀지 않는다. 칸 크기로 접지 않는다 — 접는 값이
    // 칸의 배수가 아니면 그 순간 그림이 튄다. 전투 한 판 동안 쌓이는 값은 부동소수로 충분하다.
    for (const entry of alive) {
      entry.x += entry.scrollX * dt;
      entry.y += entry.scrollY * dt;
      entry.node.style.backgroundPosition = `${entry.x.toFixed(1)}px ${entry.y.toFixed(1)}px`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
