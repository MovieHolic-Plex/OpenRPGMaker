import { TILE_SIZE } from "@/assets/bundled";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import { el } from "@/util/dom";

let overlayEl: HTMLElement | null = null;
let unsub: (() => void) | null = null;

function ensureOverlay(): HTMLElement {
  if (overlayEl && overlayEl.isConnected) return overlayEl;
  overlayEl = el("div", { class: "layout-bbox-overlay" });
  const host = document.querySelector<HTMLElement>(".phaser-container");
  if (host) {
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    host.appendChild(overlayEl);
  } else {
    document.body.appendChild(overlayEl);
  }
  return overlayEl;
}

function renderBboxes(): void {
  const state = editorState.get();
  if (!state.showLayoutBboxes) {
    if (overlayEl) overlayEl.replaceChildren();
    return;
  }
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const regions = map?.layoutPlan?.regions ?? [];
  const root = ensureOverlay();
  root.replaceChildren();
  const zoom = state.zoom ?? 1;
  for (const r of regions) {
    const color = roleColor(r.role);
    const box = el("div", { class: "layout-bbox-region" });
    box.style.left = `${r.x * TILE_SIZE * zoom}px`;
    box.style.top = `${r.y * TILE_SIZE * zoom}px`;
    box.style.width = `${r.w * TILE_SIZE * zoom}px`;
    box.style.height = `${r.h * TILE_SIZE * zoom}px`;
    box.style.setProperty("--layout-bbox-color", color);
    box.style.setProperty("--layout-bbox-fill", `${color}14`);
    const label = el("span", { class: "layout-bbox-label", text: `${roleShort(r.role)} ${r.label}` });
    label.style.setProperty("--layout-bbox-color", color);
    box.append(label);
    root.append(box);
  }
  if (regions.length === 0) {
    const hint = el("div", { class: "layout-bbox-empty", text: "layoutPlan 없음 — AI 빌드로 생성된 맵에서만 표시됩니다" });
    root.append(hint);
  }
}

function roleColor(role: string): string {
  switch (role) {
    case "plaza": return "#5ee1ff";
    case "market": return "#7af7b2";
    case "house": return "#ffcc57";
    case "lake": return "#74c0fc";
    case "river": return "#74c0fc";
    case "forest": return "#51cf66";
    default: return "#cfe6ff";
  }
}

function roleShort(role: string): string {
  switch (role) {
    case "plaza": return "P";
    case "market": return "M";
    case "house": return "H";
    default: return role.slice(0, 1).toUpperCase();
  }
}

export function installLayoutBboxOverlay(): () => void {
  renderBboxes();
  const offEditor = editorState.subscribe(() => renderBboxes());
  const offStore = store.subscribe(() => renderBboxes());
  unsub = () => {
    offEditor();
    offStore();
  };
  return () => {
    unsub?.();
    unsub = null;
    overlayEl?.remove();
    overlayEl = null;
  };
}

export function toggleLayoutBboxes(): void {
  editorState.set({ showLayoutBboxes: !editorState.get().showLayoutBboxes });
}
