// 캔버스 위 청크 도형 레이어 + 검토 액션 바 — 검토를 판단 대상 위에서 한다.
// 스펙 docs/superpowers/specs/2026-09-10-region-task-uiux-redesign-design.md §4.
//
// 왜 DOM 인가: mapLocationLayer 와 같은 이유다. 라벨(한글)과 접근성(포커스·키보드·
// role=checkbox)을 Phaser 텍스처로 다시 만들 이유가 없다. `.phaser-container` 자식으로
// 붙되 **히트 영역만** pointer-events 를 받는다 — 청크는 사각형이 아니라서 경계 상자에
// 이벤트를 걸면 구멍 난 자리의 클릭이 엉뚱한 청크로 간다.
//
// 좌표는 반드시 `resolveRegionClientRect` (=카메라)로 변환한다. `x * TILE * zoom` 만 쓰면
// 스크롤·중앙정렬·worldView 만큼 어긋난다 — mapLocationLayer.ts:86 에 남은 실측 기록
// (드래그 미리보기가 커서에서 500px 떨어졌다). 해석기가 없으면(테스트·헤드리스) 그 단순
// 기하로 떨어지고, 그때는 오버레이가 곧 맵 원점이라 결과가 같다.
//
// 브라우저 실측으로 고친 것(2026-09-11, 호수 마을 12×10, forest 오퍼레이터):
//   · 청크 22개 중 18개가 1칸 = 16×16px → 히트 영역을 MIN_CHUNK_HIT_PX 까지 넓힌다.
//   · 라벨 22개가 서로를 덮고 같은 이름이 중복됐다("Tree(1칸)·우상단" ×2) → 기본은 감추고
//     지목(hover/focus)된 것만 보인다.
import { editorMapTileSize } from "@/editor/mapGeometry";
import { editorState } from "@/editor/editorState";
import { resolveRegionClientRect } from "@/editor/regionClientRect";
import { el } from "@/util/dom";
import type { RegionRect } from "./clipToRegion";
import type { RegionChunk, RegionLayer } from "./regionChangeGroups";
import {
  buildChunkOverlayShapes,
  hitRectFor,
  nextChunkInDirection,
  type ChunkOverlayShape,
  type OverlayRect,
} from "./regionChunkOverlay";
import type { RegionSelectionProjection } from "./regionSelectionProjection";

export interface RegionChunkOverlayConfig {
  readonly region: RegionRect;
  /** 두 레이어의 청크를 전부 준다. 활성 레이어만 만질 수 있고 나머지는 흐리게 깔린다. */
  readonly chunks: readonly RegionChunk[];
  readonly projection: RegionSelectionProjection;
  /** 선택이 바뀐 뒤 불린다 — 호출부가 고스트·라벨을 갱신한다. */
  readonly onSelectionChanged: () => void;
  readonly initialLayer: RegionLayer;
  /**
   * 화면에 보여줄 총 변경 칸 수. ⚠ 반드시 `pending.changedCells` 를 준다 —
   * 청크 셀 합산은 레이어별로 따로 세서 한 칸이 양쪽에서 바뀌면 2가 된다
   * (코드 주석의 실측: 버튼 18칸 vs 요약 12칸).
   */
  readonly changedCells: number;
  readonly onApply: () => void;
  readonly onRetry: () => void;
  readonly onDiscard: () => void;
  /** 어느 경로로 만들어졌는지 — "생성기 · 숲 (시드 62902…)" 같은 한 줄. */
  readonly routeLabel?: string;
}

interface ChunkNode {
  readonly root: HTMLElement;
  readonly cells: readonly HTMLElement[];
  readonly hits: readonly HTMLElement[];
  readonly edges: readonly HTMLElement[];
  shape: ChunkOverlayShape;
}

let config: RegionChunkOverlayConfig | null = null;
let layerEl: HTMLElement | null = null;
let barEl: HTMLElement | null = null;
let applyButton: HTMLElement | null = null;
let layerButtons = new Map<RegionLayer, HTMLElement>();
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
  return { originX: region.x * editorMapTileSize() * zoom, originY: region.y * editorMapTileSize() * zoom, tileSize: editorMapTileSize() * zoom };
}

function styleRect(node: HTMLElement, rect: OverlayRect): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${Math.max(1, rect.width)}px`;
  node.style.height = `${Math.max(1, rect.height)}px`;
}

/** 외곽선 한 변을 얇은 사각형으로. 가로변/세로변 중 하나는 두께만 남는다. */
function styleEdge(node: HTMLElement, edge: { x1: number; y1: number; x2: number; y2: number }, ox: number, oy: number): void {
  node.style.left = `${Math.min(edge.x1, edge.x2) - ox}px`;
  node.style.top = `${Math.min(edge.y1, edge.y2) - oy}px`;
  node.style.width = `${Math.max(2, Math.abs(edge.x2 - edge.x1))}px`;
  node.style.height = `${Math.max(2, Math.abs(edge.y2 - edge.y1))}px`;
}

function local(rect: OverlayRect, bounds: OverlayRect): OverlayRect {
  return { x: rect.x - bounds.x, y: rect.y - bounds.y, width: rect.width, height: rect.height };
}

function layerCounts(layer: RegionLayer): { included: number; total: number } {
  if (!config) return { included: 0, total: 0 };
  const selected = config.projection.selected();
  let included = 0;
  let total = 0;
  for (const chunk of config.chunks) {
    if (chunk.layer !== layer) continue;
    total += 1;
    if (selected.has(chunk.id)) included += 1;
  }
  return { included, total };
}

function layerLabel(layer: RegionLayer): string {
  const { included, total } = layerCounts(layer);
  return `${layer === "lower" ? "바닥" : "위"} ${included}/${total}`;
}

function refreshBar(): void {
  if (!config) return;
  for (const [layer, button] of layerButtons) {
    button.textContent = layerLabel(layer);
    const active = layer === activeLayer;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("hidden", layerCounts(layer).total === 0);
  }
  if (!applyButton) return;
  const partial = config.projection.isPartial();
  const cells = config.projection.selectedCellCount();
  if (partial) {
    applyButton.textContent = cells === 0 ? "되돌릴 구역을 남겨두세요" : `선택한 ${cells}칸만 적용`;
  } else {
    // 전량일 때는 pending.changedCells 를 쓴다 — 청크 합산과 값이 다르다(레이어 이중계산).
    applyButton.textContent = `적용 · ${config.changedCells}칸`;
  }
  if (cells === 0) applyButton.setAttribute("disabled", "");
  else applyButton.removeAttribute("disabled");
  // 라벨이 바뀌면 바 너비가 바뀐다 — 다시 재지 않으면 캔버스 오른쪽으로 삐져나간다
  // (실측 2026-09-11: "적용 · 51칸" → "선택한 52칸만 적용" 로 늘어나며 「버리기」가 잘렸다).
  positionBar();
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
  refreshBar();
}

function applyLayerClasses(): void {
  for (const node of nodes.values()) {
    const active = node.shape.layer === activeLayer;
    node.root.classList.toggle("is-dim", !active);
    // 흐린 레이어는 존재만 알린다 — 클릭도 포커스도 활성 레이어의 것이다.
    node.root.tabIndex = active ? 0 : -1;
    node.root.setAttribute("aria-disabled", String(!active));
  }
  refreshBar();
}

function activeShapes(): ChunkOverlayShape[] {
  return [...nodes.values()].filter((node) => node.shape.layer === activeLayer).map((node) => node.shape);
}

function focusChunk(id: string): void {
  const node = nodes.get(id);
  if (!node || node.shape.layer !== activeLayer) return;
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

function buildBar(): void {
  if (!config || !barEl) return;
  layerButtons = new Map();
  const layers: RegionLayer[] = ["lower", "upper"];
  const layerHost = el("div", { class: "region-review-layers" });
  for (const layer of layers) {
    const button = el("button", {
      class: "region-review-layer",
      text: layerLabel(layer),
      attrs: { type: "button", "aria-pressed": String(layer === activeLayer) },
      dataset: { testid: `region-review-layer-${layer}` },
    });
    button.addEventListener("click", () => setRegionChunkOverlayLayer(layer));
    layerButtons.set(layer, button);
    layerHost.append(button);
  }

  applyButton = el("button", {
    class: "region-review-action is-primary",
    attrs: { type: "button", title: "이 결과를 맵에 적용 (Enter)" },
    dataset: { testid: "region-review-apply" },
  });
  applyButton.addEventListener("click", () => config?.onApply());

  const retry = el("button", {
    class: "region-review-action",
    text: "다시",
    attrs: { type: "button", title: "같은 지시로 다시 생성 (R)" },
    dataset: { testid: "region-review-retry" },
  });
  retry.addEventListener("click", () => config?.onRetry());

  const discard = el("button", {
    class: "region-review-action is-ghost",
    text: "버리기",
    attrs: { type: "button", title: "제안을 버린다 (Esc)" },
    dataset: { testid: "region-review-discard" },
  });
  discard.addEventListener("click", () => config?.onDiscard());

  barEl.replaceChildren(
    ...(config.routeLabel
      ? [el("span", { class: "region-review-route", text: config.routeLabel, dataset: { testid: "region-review-route" } })]
      : []),
    layerHost,
    el("div", { class: "region-review-actions", children: [applyButton, retry, discard] }),
  );
  refreshBar();
}

/**
 * 액션 바를 **대상 영역 옆**에 세운다.
 *
 * 처음엔 캔버스 하단 중앙 고정이었는데, 실측(2026-09-11)에서 플로팅 AI 조수 패널이
 * 우하단을 차지해 바의 오른쪽 절반이 가렸다. 결정은 판단 대상과 같은 자리에 있어야 하고,
 * 대상에 붙이면 고정 패널과 부딪힐 일이 구조적으로 없다.
 * 아래에 자리가 없으면 위로, 좌우로 넘치면 캔버스 안으로 끌어당긴다.
 */
function positionBar(): void {
  if (!config || !barEl || !layerEl) return;
  const layerRect = layerEl.getBoundingClientRect?.();
  const barRect = barEl.getBoundingClientRect?.();
  if (!layerRect || !barRect || layerRect.width === 0) return;
  const { originX, originY, tileSize } = geometry(config.region);
  const regionW = config.region.width * tileSize;
  const regionH = config.region.height * tileSize;
  const gap = 12;
  const barW = barRect.width || 320;
  const barH = barRect.height || 44;

  // 플로팅 AI 조수 패널은 캔버스 위에 떠 있고 우하단을 차지한다. 실측(2026-09-11)에서
  // 대상 영역이 그 아래에 있으면 바가 통째로 가렸다(적용 버튼 중심의 최상단 엘리먼트가
  // `TEXTAREA.ai-assistant-input` 이었다).
  //
  // ⚠ 잡을 것은 `.ai-deck` 이다. 실측(2026-09-11):
  //   - (삭제된 coachMarks 가 쓰던) `.ai-chat-panel.chat-dock-glass:not(.is-collapsed)` → 0개.
  //     도크가 하나(float)로 정리된 뒤 mountAssistantOverlay 는 `chat-dock-float` 만 붙인다.
  //   - `.ai-chat-panel` → 캔버스 전체(288,49,992,751). 통과용 껍데기라서 이걸 피하면
  //     후보가 전멸하고 바가 그대로 가려진다.
  //   - `.ai-deck` → (784,589,480,195). 실제로 보이는 카드다.
  const dock = typeof document !== "undefined"
    ? document.querySelector<HTMLElement>(".ai-chat-panel .ai-deck")
    : null;
  const dockRect = dock?.getBoundingClientRect?.();
  const blocked = (l: number, t: number): boolean => {
    if (!dockRect || dockRect.width === 0) return false;
    const x = layerRect.left + l;
    const y = layerRect.top + t;
    return x < dockRect.right && x + barW > dockRect.left && y < dockRect.bottom && y + barH > dockRect.top;
  };

  const clampTop = (t: number): number =>
    Math.max(gap, Math.min(t, Math.max(gap, layerRect.height - barH - gap)));
  const clampLeft = (l: number): number =>
    Math.max(gap, Math.min(l, Math.max(gap, layerRect.width - barW - gap)));

  const centered = clampLeft(originX + regionW / 2 - barW / 2);
  const below = clampTop(originY + regionH + gap);
  const above = clampTop(originY - barH - gap);
  // 아래 → 위 → (둘 다 가리면) 패널 왼쪽으로 밀기.
  const candidates: readonly (readonly [number, number])[] = [
    [centered, below],
    [centered, above],
    [clampLeft(dockRect ? dockRect.left - layerRect.left - barW - gap : centered), below],
    [clampLeft(gap), above],
  ];
  const pick = candidates.find(([l, t]) => !blocked(l, t)) ?? candidates[0]!;

  barEl.style.left = `${pick[0]}px`;
  barEl.style.top = `${pick[1]}px`;
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
    const hits: HTMLElement[] = [];
    const edges: HTMLElement[] = [];
    const root = el("div", {
      class: "region-chunk",
      dataset: { testid: `region-chunk-shape-${shape.id}`, chunkId: shape.id },
      attrs: { role: "checkbox", "aria-label": shape.ariaLabel, tabindex: "0" },
    });
    for (const rect of shape.cellRects) {
      const cell = el("div", { class: "region-chunk-cell" });
      styleRect(cell, local(rect, shape.bounds));
      cells.push(cell);
      root.append(cell);
      // 히트 영역은 그림과 분리한다 — 1칸 청크(16px)를 누를 수 있게 넓히되 그림은 타일 그대로.
      const hit = el("div", { class: "region-chunk-hit" });
      styleRect(hit, local(hitRectFor(rect), shape.bounds));
      hits.push(hit);
      root.append(hit);
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

    nodes.set(shape.id, { root, cells, hits, edges, shape });
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
      if (cell) styleRect(cell, local(rect, shape.bounds));
      const hit = node.hits[index];
      if (hit) styleRect(hit, local(hitRectFor(rect), shape.bounds));
    });
    shape.outline.forEach((edge, index) => {
      const line = node.edges[index];
      if (line) styleEdge(line, edge, shape.bounds.x, shape.bounds.y);
    });
  }
  positionBar();
}

export function openRegionChunkOverlay(next: RegionChunkOverlayConfig): void {
  closeRegionChunkOverlay();
  const parent = host();
  if (!parent) return;
  config = next;
  activeLayer = next.initialLayer;
  layerEl = el("div", { class: "region-chunk-layer", dataset: { testid: "region-chunk-layer" } });
  barEl = el("div", { class: "region-review-bar", dataset: { testid: "region-review-bar" } });
  parent.append(layerEl);
  parent.append(barEl);
  buildNodes();
  buildBar();
  positionBar();
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

/**
 * 대상 영역이 캔버스 위쪽 절반에 있나. 검토 창이 대상을 덮지 않게 반대쪽으로 비키는
 * 판단에 쓴다 — 중앙 모달에는 팝오버의 `avoid` 협상이 없다(실측 2026-09-11: 맵 y=0 영역을
 * 상단 창이 덮어 도형 클릭이 아예 안 됐다).
 */
export function regionIsInTopHalf(): boolean {
  if (!config || !layerEl) return false;
  const layerRect = layerEl.getBoundingClientRect?.();
  if (!layerRect || layerRect.height === 0) return false;
  const { originY, tileSize } = geometry(config.region);
  const center = originY + (config.region.height * tileSize) / 2;
  return center < layerRect.height / 2;
}

export function regionChunkOverlayLayer(): RegionLayer {
  return activeLayer;
}

export function isRegionChunkOverlayOpen(): boolean {
  return Boolean(layerEl?.isConnected);
}

/**
 * 열기 **전에** "캔버스가 검토를 맡을 수 있나" 를 묻는다.
 *
 * 호출부는 이걸로 창 안의 before/after 썸네일 렌더를 건너뛴다 — 캔버스가 검토를 맡으면
 * 그 두 장은 화면에 뜨지 않고(`is-canvas-review` 가 접는다) 480px 스냅샷 두 번만 태운다.
 * 헤드리스·테스트에는 `.phaser-container` 가 없어 false 이므로 기존 경로가 그대로 남는다.
 */
export function canOpenRegionChunkOverlay(): boolean {
  return Boolean(host());
}

/** 호출부가 선택을 바꿨을 때(창의 체크박스 등) 도형·바를 그 상태로 맞춘다. */
export function syncRegionChunkOverlay(): void {
  if (!config) return;
  applySelectionClasses();
}

export function closeRegionChunkOverlay(): void {
  if (!layerEl && !config) return;
  if (typeof window !== "undefined") window.removeEventListener("keydown", onKeyDown, true);
  layerEl?.remove();
  barEl?.remove();
  layerEl = null;
  barEl = null;
  applyButton = null;
  layerButtons = new Map();
  nodes = new Map();
  focusedId = null;
  config = null;
}
