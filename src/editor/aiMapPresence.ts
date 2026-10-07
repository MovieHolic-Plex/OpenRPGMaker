// editor/aiMapPresence.ts
// 지도 위의 AI 존재감 — 일하는 영역에 이름표가 붙는 DOM 오버레이.
//
// 문제: 조수가 「실행 중」이어도 지도(개발자의 눈이 있는 곳)에는 아무 흔적이 없어 시선이 갈 이유가 없었다.
// 영역은 두 곳에서 온다 — 드래그로 시킨 일은 그 영역 그대로, 대화창 일은 이번 실행이 만진 칸(고스트 초안)의 바운딩 박스.
// 맵당 조수 한 명 규칙 덕에 「이 맵의 초안 영역 = 그 맵을 소유한 조수」로 읽어도 틀리지 않는다.
// 좌표는 카메라 해석기(resolveRegionClientRect)로 바꾸고, 팬·줌 때는 EditScene 이 repositionAiMapPresence() 로 좌표만 고친다
// (mapLocationLayer 와 같은 계약 — 노드를 다시 만들지 않는다).

import { agentGhostPreviewsForMap, getAgentGhostPreviewState, subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import { isActive, PRESENCE_LABEL, subscribeAiPresence, type Presence, type PresenceRegion } from "@/editor/panels/aiPresence";
import { el } from "@/util/dom";

interface Placed {
  readonly presence: Presence;
  readonly region: PresenceRegion | null;
}

let layer: HTMLElement | null = null;
let placed: readonly Placed[] = [];
let teardown: (() => void) | null = null;

function host(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".phaser-container");
}

function ensureLayer(): HTMLElement | null {
  if (layer?.isConnected) return layer;
  const parent = host();
  if (!parent) return null;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  layer = el("div", { class: "ai-map-presence", dataset: { testid: "ai-map-presence" }, attrs: { "aria-hidden": "true" } });
  parent.appendChild(layer);
  return layer;
}

function ghostBounds(mapId: string): PresenceRegion | null {
  const previews = agentGhostPreviewsForMap(getAgentGhostPreviewState(), mapId);
  if (previews.length === 0) return null;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const preview of previews) {
    x0 = Math.min(x0, preview.bounds.x); y0 = Math.min(y0, preview.bounds.y);
    x1 = Math.max(x1, preview.bounds.x + preview.bounds.width); y1 = Math.max(y1, preview.bounds.y + preview.bounds.height);
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
}

function collect(presences: readonly Presence[]): readonly Placed[] {
  const mapId = editorState.get().currentMapId;
  if (!mapId) return [];
  // 초안 영역은 맵당 조수 한 명 규칙에 따라 그 맵에 쓰는 조수(검수 제외) 한 명에게만 붙인다. 나머지는 이름표만.
  const here = presences.filter(p => p.mapId === mapId && p.state !== "applied");
  const writer = here.find(p => !p.region && !p.readsOnly);
  const draft = writer ? ghostBounds(mapId) : null;
  return here.map(presence => ({ presence, region: presence.region ?? (presence === writer ? draft : null) }));
}

function render(): void {
  const root = ensureLayer();
  if (!root) return;
  root.replaceChildren(...placed.map(({ presence, region }, index) => el("div", {
    class: `ai-map-region${region ? "" : " is-cornered"}${isActive(presence) ? " is-pulse" : ""}`,
    dataset: { testid: "ai-map-region", presenceId: presence.id, tone: String(presence.tone), state: presence.state, slot: String(index) },
    children: [el("span", { class: "ai-map-region-tag", children: [
      el("span", { class: "ai-map-region-dot" }),
      el("b", { text: presence.name }),
      el("span", { text: ` · ${presence.state === "working" ? presence.action : PRESENCE_LABEL[presence.state]}` }),
    ] })],
  })));
  reposition();
  watch();
}

/** 팬·줌·창 크기 변화마다 EditScene 이 부른다. 노드는 두고 좌표만 고쳐 쓴다. */
export function repositionAiMapPresence(): void {
  reposition();
}

/**
 * 도크가 열리고 닫히거나 카메라가 부드럽게 도는 동안에는 EditScene 의 재배치 훅이 닿지 않는 틈이 있다
 * (실측: 도크를 열자 초안 그림은 따라갔는데 상자는 옛 자리에 남았다). 이름표가 떠 있는 동안만 프레임마다 좌표를 대조한다.
 */
let watchFrame = 0;
function watch(): void {
  if (watchFrame || placed.length === 0) return;
  const step = (): void => {
    watchFrame = 0;
    if (placed.length === 0 || !layer?.isConnected) return;
    reposition();
    watchFrame = requestAnimationFrame(step);
  };
  watchFrame = requestAnimationFrame(step);
}

function writeIfChanged(node: HTMLElement, rect: { left: number; top: number; width: number; height: number }): void {
  const next = `${rect.left}|${rect.top}|${rect.width}|${rect.height}`;
  if (node.dataset.rect === next) return;
  node.dataset.rect = next;
  node.style.left = `${rect.left}px`;
  node.style.top = `${rect.top}px`;
  node.style.width = `${rect.width}px`;
  node.style.height = `${rect.height}px`;
}

function reposition(): void {
  if (!layer?.isConnected) return;
  const layerRect = layer.getBoundingClientRect();
  for (const node of layer.querySelectorAll<HTMLElement>(".ai-map-region")) {
    const entry = placed.find(item => item.presence.id === node.dataset.presenceId);
    const region = entry?.region;
    if (!region) { node.style.cssText = ""; delete node.dataset.rect; continue; }
    const client = resolveRegionClientRect({ x: region.x, y: region.y, width: region.width, height: region.height });
    if (!client) { node.hidden = true; continue; }
    node.hidden = false;
    writeIfChanged(node, {
      left: Math.round(client.x - layerRect.left), top: Math.round(client.y - layerRect.top),
      width: Math.max(8, Math.round(client.width)), height: Math.max(8, Math.round(client.height)),
    });
  }
}

/** 편집기 부팅 때 한 번. 해제 함수를 돌려준다(두 번 부르면 앞의 것을 먼저 거둔다). */
export function mountAiMapPresence(): () => void {
  teardown?.();
  let latest: readonly Presence[] = [];
  const refresh = (): void => { placed = collect(latest); render(); };
  const offPresence = subscribeAiPresence(next => { latest = next; refresh(); });
  const offGhost = subscribeAgentGhostPreview(refresh);
  let lastMapId = editorState.get().currentMapId;
  const offEditor = editorState.subscribe(() => {
    // 맵을 바꿨을 때만 다시 고른다 — 붓질마다 DOM 을 갈아엎지 않는다.
    const mapId = editorState.get().currentMapId;
    if (mapId !== lastMapId) { lastMapId = mapId; refresh(); }
  });
  teardown = () => {
    offPresence(); offGhost(); offEditor();
    if (watchFrame) cancelAnimationFrame(watchFrame);
    watchFrame = 0;
    layer?.remove(); layer = null; placed = []; teardown = null;
  };
  return teardown;
}
