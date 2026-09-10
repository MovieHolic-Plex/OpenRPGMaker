// 캔버스 위 청크 도형 레이어 — 검토를 판단 대상 위에서 한다.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.
//
// 왜 DOM 인가: mapLocationLayer 와 같은 이유다. 라벨(한글)과 접근성(포커스·키보드·
// role=checkbox)을 Phaser 텍스처로 다시 만들 이유가 없다. `.phaser-container` 자식으로
// 붙되 **셀만** pointer-events 를 받는다 — 청크는 사각형이 아니라서 경계 상자에 이벤트를
// 걸면 구멍 난 자리의 클릭이 엉뚱한 청크로 간다.
//
// 좌표는 반드시 `resolveRegionClientRect` (=카메라)로 변환한다. `x * TILE * zoom` 만 쓰면
// 스크롤·중앙정렬·worldView 만큼 어긋난다 — mapLocationLayer.ts:86 에 남은 실측 기록
// (드래그 미리보기가 커서에서 500px 떨어졌다). 해석기가 없으면(테스트·헤드리스) 그 단순
// 기하로 떨어지고, 그때는 오버레이가 곧 맵 원점이라 결과가 같다.
import { TILE_SIZE } from "@/assets/bundled";
import { editorState } from "@/editor/editorState";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import { el } from "@/util/dom";
import type { RegionRect } from "./clipToRegion";
import type { RegionChunk, RegionLayer } from "./regionChangeGroups";
import { buildChunkOverlayShapes, nextChunkInDirection, type ChunkOverlayShape } from "./regionChunkOverlay";
import type { RegionSelectionProjection } from "./regionSelectionProjection";

export interface RegionChunkOverlayConfig {
  readonly region: RegionRect;
  /** 두 레이어의 청크를 전부 준다. 활성 레이어만 만질 수 있고 나머지는 흐리게 깔린다. */
  readonly chunks: readonly RegionChunk[];
  readonly projection: RegionSelectionProjection;
  /** 선택이 바뀐 뒤 불린다 — 호출부가 고스트·라벨을 갱신한다. */
  readonly onSelectionChanged: () => void;
  readonly initialLayer: RegionLayer;
}

interface ChunkNode {
  readonly root: HTMLElement;
  readonly cells: readonly HTMLElement[];
  readonly edges: readonly HTMLElement[];
  shape: ChunkOverlayShape;
}

let config: RegionChunkOverlayConfig | null = null;
let layerEl: HTMLElement | null = null;
let activeLayer: RegionLayer = "lower";
let nodes = new Map<string, ChunkNode>();
let focusedId: string | null = null;

function host(): HTMLElement | null {
  const found = document.querySelector<HTMLElement>(".phaser-container");
  if (!found) return null;
  if (typeof getComputedStyle === "function" && getComputedStyle(found).position === "static") {
    found.style.position = "relative";
  }
  return found;
}

/** 영역 원점의 오버레이 로컬 좌표 + 타일 한 칸의 화면 크기. */
function geometry(region: RegionRect): { originX: number; originY: number; tileSize: number } {
  const zoom = editorState.get().zoom ?? 1;
  const client = resolveRegionClientRect(region);
  const overlayRect = layerEl?.getBoundingClientRect?.();
  if (client && overlayRect && region.width > 0 && region.height > 0) {
    return {
      originX: client.x - overlayRect.left,
      originY: client.y - overlayRect.top,
      tileSize: client.width / region.width,
    };
  }
  return { originX: region.x * TILE_SIZE * zoom, originY: region.y * TILE_SIZE * zoom, tileSize: TILE_SIZE * zoom };
}

function styleRect(node: HTMLElement, rect: { x: number; y: number; width: number; height: number }): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${Math.max(1, rect.width)}px`;
  node.style.height = `${Math.max(1, rect.height)}px`;
}

/** 외곽선 한 변을 얇은 사각형으로. 가로변/세로변 중 하나는 두께만 남는다. */
function styleEdge(node: HTMLElement, edge: { x1: number; y1: number; x2: number; y2: number }, ox: number, oy: number): void {
  const left = Math.min(edge.x1, edge.x2) - ox;
  const top = Math.min(edge.y1, edge.y2) - oy;
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.style.width = `${Math.max(2, Math.abs(edge.x2 - edge.x1))}px`;
  node.style.height = `${Math.max(2, Math.abs(edge.y2 - edge.y1))}px`;
}

function applySelectionClasses(): void {
  if (!config) return;
  const selected = config.projection.selected();
  for (const [id, node] of nodes) {
    const included = selected.has(id);
    node.root.classList.toggle("is-included", included);
    node.root.classList.toggle("is-excluded", !included);
    node.root.setAttribute("aria-checked", String(included));
  }
}

function applyLayerClasses(): void {
  for (const node of nodes.values()) {
    const active = node.shape.layer === activeLayer;
    node.root.classList.toggle("is-dim", !active);
    // 흐린 레이어는 존재만 알린다 — 클릭도 포커스도 활성 레이어의 것이다.
    node.root.tabIndex = active ? 0 : -1;
    node.root.setAttribute("aria-disabled", String(!active));
  }
}

function activeShapes(): ChunkOverlayShape[] {
  return [...nodes.values()].filter((node) => node.shape.layer === activeLayer).map((node) => node.shape);
}

function focusChunk(id: string): void {
  const node = nodes.get(id);
  if (!node) return;
  focusedId = id;
  for (const [other, n] of nodes) n.root.classList.toggle("is-focus", other === id);
  layerEl?.classList.add("is-isolating");
  node.root.focus?.();
}

function blurChunk(): void {
  focusedId = null;
  for (const node of nodes.values()) node.root.classList.remove("is-focus");
  layerEl?.classList.remove("is-isolating");
}

function toggleChunk(id: string): void {
  if (!config) return;
  const node = nodes.get(id);
  if (!node || node.shape.layer !== activeLayer) return;
  config.projection.toggle(id);
  applySelectionClasses();
  config.onSelectionChanged();
}

function onKeyDown(event: KeyboardEvent): void {
  if (!config || !focusedId) return;
  const key = event.key;
  if (key === " " || key === "Enter") {
    // Enter 는 검토 단축키(적용)와 겹친다 — 도형에 포커스가 있을 때만 토글로 가로챈다.
    event.preventDefault();
    event.stopPropagation();
    toggleChunk(focusedId);
    return;
  }
  const direction = key === "ArrowUp" ? "up"
    : key === "ArrowDown" ? "down"
      : key === "ArrowLeft" ? "left"
        : key === "ArrowRight" ? "right"
          : null;
  if (!direction) return;
  const next = nextChunkInDirection(activeShapes(), focusedId, direction);
  if (!next) return;
  event.preventDefault();
  event.stopPropagation();
  focusChunk(next);
}

function buildNodes(): void {
  if (!config || !layerEl) return;
  layerEl.replaceChildren();
  nodes = new Map();

  const { originX, originY, tileSize } = geometry(config.region);
  const shapes = buildChunkOverlayShapes({
    chunks: config.chunks,
    region: config.region,
    tileSize,
    origin: { x: originX, y: originY },
  });

  for (const shape of shapes) {
    const cells: HTMLElement[] = [];
    const edges: HTMLElement[] = [];
    const root = el("div", {
      class: "region-chunk",
      dataset: { testid: `region-chunk-shape-${shape.id}`, chunkId: shape.id },
      attrs: { role: "checkbox", "aria-label": shape.ariaLabel, tabindex: "0" },
    });
    for (const rect of shape.cellRects) {
      const cell = el("div", { class: "region-chunk-cell" });
      styleRect(cell, { x: rect.x - shape.bounds.x, y: rect.y - shape.bounds.y, width: rect.width, height: rect.height });
      cells.push(cell);
      root.append(cell);
    }
    for (const edge of shape.outline) {
      const line = el("div", { class: "region-chunk-edge" });
      styleEdge(line, edge, shape.bounds.x, shape.bounds.y);
      edges.push(line);
      root.append(line);
    }
    root.append(el("span", { class: "region-chunk-label", text: shape.label }));
    styleRect(root, shape.bounds);

    root.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleChunk(shape.id);
    });
    root.addEventListener("pointerenter", () => focusChunk(shape.id));
    root.addEventListener("pointerleave", () => { if (focusedId === shape.id) blurChunk(); });
    root.addEventListener("focus", () => focusChunk(shape.id));
    root.addEventListener("blur", () => { if (focusedId === shape.id) blurChunk(); });

    nodes.set(shape.id, { root, cells, edges, shape });
    layerEl.append(root);
  }

  applySelectionClasses();
  applyLayerClasses();
}

/**
 * 카메라가 움직였을 때. 노드를 다시 만들지 않고 **좌표만** 고쳐 쓴다 — 매 프레임 DOM 을
 * 갈면 그 사이 pointerdown/up 이 다른 노드에 떨어진다(EditScene.ts:1886 의 기록과 같은 함정).
 */
export function repositionRegionChunkOverlay(): void {
  if (!config || !layerEl || nodes.size === 0) return;
  const { originX, originY, tileSize } = geometry(config.region);
  const shapes = buildChunkOverlayShapes({
    chunks: config.chunks,
    region: config.region,
    tileSize,
    origin: { x: originX, y: originY },
  });
  for (const shape of shapes) {
    const node = nodes.get(shape.id);
    if (!node) continue;
    node.shape = shape;
    styleRect(node.root, shape.bounds);
    shape.cellRects.forEach((rect, index) => {
      const cell = node.cells[index];
      if (cell) {
        styleRect(cell, { x: rect.x - shape.bounds.x, y: rect.y - shape.bounds.y, width: rect.width, height: rect.height });
      }
    });
    shape.outline.forEach((edge, index) => {
      const line = node.edges[index];
      if (line) styleEdge(line, edge, shape.bounds.x, shape.bounds.y);
    });
  }
}

export function openRegionChunkOverlay(next: RegionChunkOverlayConfig): void {
  closeRegionChunkOverlay();
  const parent = host();
  if (!parent) return;
  config = next;
  activeLayer = next.initialLayer;
  layerEl = el("div", { class: "region-chunk-layer", dataset: { testid: "region-chunk-layer" } });
  parent.append(layerEl);
  buildNodes();
  // 헤드리스(테스트·노드)에는 window 가 없다. 키보드 순회는 브라우저에서만 붙인다 —
  // 여기서 던지면 검토 UI 자체가 열리지 않는다.
  if (typeof window !== "undefined") window.addEventListener("keydown", onKeyDown, true);
}

export function setRegionChunkOverlayLayer(layer: RegionLayer): void {
  if (!config || activeLayer === layer) return;
  activeLayer = layer;
  blurChunk();
  applyLayerClasses();
}

export function regionChunkOverlayLayer(): RegionLayer {
  return activeLayer;
}

export function isRegionChunkOverlayOpen(): boolean {
  return Boolean(layerEl?.isConnected);
}

export function closeRegionChunkOverlay(): void {
  if (!layerEl && !config) return;
  if (typeof window !== "undefined") window.removeEventListener("keydown", onKeyDown, true);
  layerEl?.remove();
  layerEl = null;
  nodes = new Map();
  focusedId = null;
  config = null;
}
