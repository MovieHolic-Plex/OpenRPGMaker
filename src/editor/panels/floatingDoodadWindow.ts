// editor/panels/floatingDoodadWindow.ts
// Phase 2 (SCMDraft 2 감성): 드래그 가능한 독립 플로팅 「두댓 팔레트」 창.
// - D 키 또는 좌하단 독 「두댓」으로 토글
// - propsForTileset(건물·나무·소품 스탬프) + reliefDoodadCatalog(경사로·계단·다리·벽면) 통합 카탈로그
// - SCMDraft 2 그리드 뷰(기본) ↔ StarEdit 분할 프리뷰 뷰 전환 가능

import { editorState } from "@/editor/editorState";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { paletteCatalogFor } from "@/editor/panels/tilePaletteCatalog";
import { selectMapModeTool, selectPaletteStamp } from "@/editor/panels/tileToolbarActions";
import { propsForTileset, type PropCategoryId, type PropChoice } from "@/editor/propRecommendations";
import { reliefTopGrassTile } from "@/editor/reliefActions";
import { reliefDoodadCatalog, type ReliefDoodad } from "@/editor/reliefDoodads";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export const FLOATING_DOODAD_PALETTE_TOGGLE_EVENT = "oprn:floating-doodad-palette-toggle";

type DoodadTabId = "all" | "nature" | "structure" | "prop" | "relief";
type DoodadViewMode = "grid" | "split";

type UnifiedDoodad =
  | {
      readonly key: string;
      readonly source: "stamp";
      readonly tab: Exclude<DoodadTabId, "all" | "relief">;
      readonly name: string;
      readonly sizeLabel: string;
      readonly choice: PropChoice;
    }
  | {
      readonly key: string;
      readonly source: "relief";
      readonly tab: "relief";
      readonly name: string;
      readonly sizeLabel: string;
      readonly doodad: ReliefDoodad;
    };

const TABS: readonly { readonly id: DoodadTabId; readonly label: string }[] = [
  { id: "all", label: "전체" },
  { id: "nature", label: "자연" },
  { id: "structure", label: "건물" },
  { id: "prop", label: "소품" },
  { id: "relief", label: "경사로·다리" },
];

const INITIAL_PAGE_SIZE = 36;
const PAGE_INCREMENT = 36;

function tabForPropCategory(category: PropCategoryId | undefined): Exclude<DoodadTabId, "all" | "relief"> {
  if (category === "plants") return "nature";
  if (category === "structures") return "structure";
  return "prop";
}

function cleanDoodadName(raw: string, w: number, h: number): string {
  const tail = raw.includes("·") ? raw.slice(raw.lastIndexOf("·") + 1).trim() : raw;
  const trimmed = tail.replace(new RegExp(`\\s*${w}\\s*[×x]\\s*${h}$`, "i"), "").trim();
  return trimmed || raw;
}

const catalogCache = new WeakMap<TilesetDef, readonly UnifiedDoodad[]>();

function unifiedDoodadsFor(tileset: TilesetDef | undefined): readonly UnifiedDoodad[] {
  if (!tileset) return [];
  const cached = catalogCache.get(tileset);
  if (cached) return cached;

  const out: UnifiedDoodad[] = [];
  const seenKeys = new Set<string>();
  const seenKitIds = new Set<string>();

  for (const choice of propsForTileset(tileset)) {
    const w = choice.stamp.width;
    const h = choice.stamp.height;
    const key = `stamp:${choice.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    if (choice.stamp.kitId) seenKitIds.add(choice.stamp.kitId);
    out.push({
      key,
      source: "stamp",
      tab: tabForPropCategory(choice.category),
      name: cleanDoodadName(choice.name, w, h),
      sizeLabel: `${w}×${h}`,
      choice,
    });
  }

  // Fallback / supplement: prefabs from tileset structureKits (paletteCatalogFor)
  for (const prefab of paletteCatalogFor(tileset).prefabs) {
    if (seenKitIds.has(prefab.id)) continue;
    const stamp = paletteStampFromKit(prefab.kit);
    if (!stamp.cells.length) continue;
    seenKitIds.add(prefab.id);
    const key = `prefab:${prefab.id}`;
    const tab: Exclude<DoodadTabId, "all" | "relief"> = /나무|풀|꽃|바위|숲|tree|plant|bush|rock/i.test(prefab.searchBlob)
      ? "nature"
      : ["building", "castle", "roof", "wall", "fence"].includes(prefab.role)
        ? "structure"
        : "prop";
    out.push({
      key,
      source: "stamp",
      tab,
      name: cleanDoodadName(prefab.name, stamp.width, stamp.height),
      sizeLabel: `${stamp.width}×${stamp.height}`,
      choice: {
        id: prefab.id,
        name: prefab.name,
        stamp,
        description: prefab.roleLabel,
        terms: [prefab.name, prefab.roleLabel, ...prefab.tags],
        preference: 1,
        family: tileset.id,
      },
    });
  }

  // Fallback for compact custom tilesets without kits (e.g. demo chipsets): upper-layer tileGroups or labeled upper tiles
  if (out.length === 0) {
    for (const group of tileset.tileGroups ?? []) {
      if (out.length >= 36) break;
      const tileIds = group.tileIds.filter((t) => t >= 0 && t < tileset.count);
      if (tileIds.length === 0) continue;
      const isUpper = tileIds.some((t) => tileLayerHome(tileset, t) === "upper");
      if (!isUpper && (group.role === "terrain" || group.role === "water")) continue;
      const cols = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(tileIds.length))));
      const rows = Math.max(1, Math.ceil(tileIds.length / cols));
      const repTile = tileIds[0]!;
      const label = group.name?.trim() || group.id;
      const tab: Exclude<DoodadTabId, "all" | "relief"> = /나무|풀|꽃|바위|tree|rock|bush|flower/i.test(label)
        ? "nature"
        : /집|지붕|벽|문|건물|울타리|house|roof|wall|door|fence|building/i.test(label)
          ? "structure"
          : "prop";
      out.push({
        key: `group:${group.id}`,
        source: "stamp",
        tab,
        name: cleanDoodadName(label, cols, rows),
        sizeLabel: tileIds.length === 1 ? "1×1" : `${cols}×${rows}`,
        choice: {
          id: group.id,
          name: label,
          stamp: {
            source: { tilesetId: tileset.id, tileSize: tileset.tileSize, startTile: repTile, endTile: repTile },
            label,
            width: 1,
            height: 1,
            cells: [{ dx: 0, dy: 0, layer: "upper", tile: repTile }],
          },
          description: label,
          terms: [label],
          preference: 1,
          family: tileset.id,
        },
      });
    }
  }
  if (out.length === 0) {
    for (let t = 0; t < tileset.count && out.length < 30; t += 1) {
      if (tileLayerHome(tileset, t) !== "upper") continue;
      const meta = tileset.tileMeta?.[t];
      const label = meta?.label?.trim() || `소품 #${t}`;
      const tab: Exclude<DoodadTabId, "all" | "relief"> = /나무|풀|꽃|바위|tree|rock|bush/i.test(label)
        ? "nature"
        : /집|지붕|벽|문|건물|house|roof|wall|door/i.test(label)
          ? "structure"
          : "prop";
      out.push({
        key: `tile:${t}`,
        source: "stamp",
        tab,
        name: label,
        sizeLabel: "1×1",
        choice: {
          id: `tile-${t}`,
          name: label,
          stamp: {
            source: { tilesetId: tileset.id, tileSize: tileset.tileSize, startTile: t, endTile: t },
            label,
            width: 1,
            height: 1,
            cells: [{ dx: 0, dy: 0, layer: "upper", tile: t }],
          },
          description: label,
          terms: [label],
          preference: 0,
          family: tileset.id,
        },
      });
    }
  }

  for (const doodad of reliefDoodadCatalog(tileset)) {
    const sizeLabel = doodad.kind === "ramp"
      ? (doodad.stairs ? "2×N" : "4×N")
      : doodad.kind === "bridge"
        ? "2×N"
        : `${doodad.kit.width}×${doodad.kit.height}`;
    out.push({
      key: `relief:${doodad.id}`,
      source: "relief",
      tab: "relief",
      name: doodad.label,
      sizeLabel,
      doodad,
    });
  }
  catalogCache.set(tileset, out);
  return out;
}

function drawRampIcon(stairs: boolean, bridgeAxis?: "horizontal" | "vertical"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 36;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.fillStyle = "#5a8e3d";
  g.fillRect(0, 0, 48, 36);
  g.fillStyle = "#77b051";
  g.fillRect(0, 0, 48, 12);
  g.fillStyle = "#7a5230";
  g.fillRect(0, 12, 48, 12);
  if (bridgeAxis) {
    g.fillStyle = "#614024";
    g.fillRect(0, 12, 48, 24);
    g.fillStyle = "#b99260";
    if (bridgeAxis === "horizontal") {
      g.fillRect(0, 16, 48, 12);
      g.fillStyle = "#755132";
      for (let x = 4; x < 48; x += 6) g.fillRect(x, 16, 1, 12);
    } else {
      g.fillRect(14, 0, 20, 36);
      g.fillStyle = "#755132";
      for (let y = 4; y < 36; y += 6) g.fillRect(14, y, 20, 1);
    }
    return canvas;
  }
  g.fillStyle = stairs ? "#b7b4aa" : "#c79d65";
  g.fillRect(14, 10, 20, 26);
  g.fillStyle = stairs ? "#78756c" : "#9d7441";
  if (stairs) {
    for (let i = 1; i < 5; i += 1) g.fillRect(14, 10 + i * 5, 20, 2);
  } else {
    for (let i = 0; i < 4; i += 1) {
      g.fillRect(17 + i, 14 + i * 5, 2, 1);
      g.fillRect(29 - i, 16 + i * 5, 2, 1);
    }
  }
  return canvas;
}

function renderDoodadPreview(item: UnifiedDoodad, tileset: TilesetDef | undefined, scale = 1): HTMLCanvasElement {
  if (item.source === "relief") {
    const d = item.doodad;
    if (d.kind === "ramp") return drawRampIcon(d.stairs);
    if (d.kind === "bridge") return drawRampIcon(false, d.axis);
    if (!tileset) return drawRampIcon(false);
    const cells = [];
    for (let dy = 0; dy < d.kit.height; dy += 1) {
      for (let dx = 0; dx < d.kit.width; dx += 1) {
        const tile = d.kit.rows[dy]?.upperTiles?.[dx] ?? -1;
        if (tile >= 0) cells.push({ dx, dy, layer: "upper" as const, tile });
      }
    }
    return renderTileCellsToCanvas({
      tileset,
      widthTiles: d.kit.width,
      heightTiles: d.kit.height,
      cells,
      scale,
      transparentBackground: true,
      backgroundTile: d.kind === "wall" ? null : reliefTopGrassTile(tileset) ?? null,
    });
  }
  if (!tileset) return drawRampIcon(false);
  return renderTileCellsToCanvas({
    tileset,
    widthTiles: item.choice.stamp.width,
    heightTiles: item.choice.stamp.height,
    cells: item.choice.stamp.cells,
    scale,
    transparentBackground: true,
  });
}

export interface FloatingDoodadWindowMount {
  readonly isOpen: () => boolean;
  readonly setOpen: (next: boolean) => void;
  readonly toggle: () => void;
  readonly dispose: () => void;
}

const DOODAD_SIZE_STORAGE_KEY = "oprn:floating-doodad-size";
const DOODAD_RECENT_STORAGE_KEY = "oprn:floating-doodad-recent";
const MAX_RECENT_DOODADS = 6;

function loadSavedWindowSize(): { width: number; bodyHeight: number } | null {
  try {
    const raw = localStorage.getItem(DOODAD_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { width?: unknown; bodyHeight?: unknown };
    if (typeof parsed.width === "number" && typeof parsed.bodyHeight === "number") {
      return {
        width: Math.max(360, Math.min(860, Math.round(parsed.width))),
        bodyHeight: Math.max(220, Math.min(620, Math.round(parsed.bodyHeight))),
      };
    }
  } catch { /* ignore */ }
  return null;
}

function saveWindowSize(size: { width: number; bodyHeight: number }): void {
  try { localStorage.setItem(DOODAD_SIZE_STORAGE_KEY, JSON.stringify(size)); } catch { /* ignore */ }
}

function loadRecentKeys(): string[] {
  try {
    const raw = localStorage.getItem(DOODAD_RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT_DOODADS) : [];
  } catch { return []; }
}

function saveRecentKeys(keys: readonly string[]): void {
  try { localStorage.setItem(DOODAD_RECENT_STORAGE_KEY, JSON.stringify(keys.slice(0, MAX_RECENT_DOODADS))); } catch { /* ignore */ }
}

export function mountFloatingDoodadWindow(
  canvasArea: HTMLElement,
  onOpenChange: (open: boolean) => void = () => {},
): FloatingDoodadWindowMount {
  let open = false;
  let activeTab: DoodadTabId = "all";
  let viewMode: DoodadViewMode = "grid";
  let searchQuery = "";
  let visibleLimit = INITIAL_PAGE_SIZE;
  let selectedKey: string | null = null;
  let customPos: { x: number; y: number } | null = null;
  let customSize = loadSavedWindowSize();
  let recentKeys: string[] = loadRecentKeys();

  const viewToggleBtn = el("button", {
    class: "fdw-head-btn",
    attrs: { type: "button", title: "SCMDraft 그리드 ↔ StarEdit 분할 프리뷰 전환" },
    dataset: { testid: "floating-doodad-view-toggle" },
    text: "분할",
    on: {
      click: () => {
        viewMode = viewMode === "grid" ? "split" : "grid";
        viewToggleBtn.textContent = viewMode === "grid" ? "분할" : "그리드";
        win.dataset.view = viewMode;
        renderBody();
      },
    },
  }) as HTMLButtonElement;

  const closeBtn = el("button", {
    class: "fdw-head-btn",
    attrs: { type: "button", title: "두댓 팔레트 닫기 (Esc)", "aria-label": "두댓 팔레트 닫기" },
    dataset: { testid: "floating-doodad-close" },
    text: "✕",
    on: { click: () => setOpen(false) },
  }) as HTMLButtonElement;

  const titleBar = el("div", {
    class: "fdw-titlebar",
    dataset: { testid: "floating-doodad-titlebar" },
    children: [
      el("div", {
        class: "fdw-title",
        children: [
          el("span", { text: "두댓 팔레트" }),
          el("kbd", { class: "fdw-kbd", text: "D" }),
        ],
      }),
      el("div", { class: "fdw-title-actions", children: [viewToggleBtn, closeBtn] }),
    ],
  });

  const searchInput = el("input", {
    class: "fdw-search",
    attrs: { type: "search", placeholder: "나무·집·다리·소품 찾기…", "aria-label": "두댓 찾기", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: "floating-doodad-search" },
  }) as HTMLInputElement;

  const tabBar = el("div", { class: "fdw-tabs", attrs: { role: "tablist", "aria-label": "두댓 분류" } });
  const tabButtons = new Map<DoodadTabId, HTMLButtonElement>();
  for (const tab of TABS) {
    const btn = el("button", {
      class: "fdw-tab" + (tab.id === activeTab ? " is-active" : ""),
      attrs: { type: "button", role: "tab", "aria-selected": String(tab.id === activeTab) },
      dataset: { testid: `floating-doodad-tab-${tab.id}` },
      text: tab.label,
      on: {
        click: () => {
          activeTab = tab.id;
          visibleLimit = INITIAL_PAGE_SIZE;
          syncTabButtons();
          renderBody();
        },
      },
    }) as HTMLButtonElement;
    tabButtons.set(tab.id, btn);
    tabBar.append(btn);
  }

  const body = el("div", { class: "fdw-body", dataset: { testid: "floating-doodad-body" } });
  const recentBar = el("div", { class: "fdw-recent-bar", dataset: { testid: "floating-doodad-recent" } });
  recentBar.hidden = true;
  const statusName = el("span", { class: "fdw-status-name", dataset: { testid: "floating-doodad-status" }, text: "두댓을 골라 맵에 클릭하세요" });
  const clearPickBtn = el("button", {
    class: "fdw-clear-btn",
    attrs: { type: "button", title: "선택 해제" },
    text: "해제",
    on: {
      click: () => {
        selectedKey = null;
        editorState.set({ activePaletteStamp: null, reliefDoodad: null, reliefBridgeStart: null });
        renderBody();
      },
    },
  }) as HTMLButtonElement;
  const resizeGrip = el("div", {
    class: "fdw-resize-grip",
    attrs: { title: "드래그해 두댓 창 크기 조절", "aria-label": "창 크기 조절" },
    dataset: { testid: "floating-doodad-resize" },
    text: "◿",
  });
  const foot = el("div", { class: "fdw-foot", children: [statusName, clearPickBtn, resizeGrip] });

  const win = el("section", {
    class: "floating-doodad-window",
    attrs: { role: "dialog", "aria-label": "두댓 팔레트" },
    dataset: { testid: "floating-doodad-window", view: viewMode },
    children: [titleBar, el("div", { class: "fdw-controls", children: [searchInput, tabBar] }), body, recentBar, foot],
  });
  win.hidden = true;

  function currentTileset(): TilesetDef | undefined {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    const map = mapId ? project.maps[mapId] : undefined;
    return map ? project.tilesets[map.tilesetId] : undefined;
  }

  function syncTabButtons(): void {
    for (const [id, btn] of tabButtons.entries()) {
      const active = id === activeTab;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
    }
  }

  function isItemSelected(item: UnifiedDoodad): boolean {
    const state = editorState.get();
    if (item.source === "relief") {
      return state.tool === "relief" && state.reliefDoodad === item.doodad.id;
    }
    const stamp = state.activePaletteStamp;
    if (!stamp) return false;
    if (item.choice.stamp.kitId && stamp.kitId === item.choice.stamp.kitId) return true;
    return stamp.label === item.choice.stamp.label && stamp.width === item.choice.stamp.width && stamp.height === item.choice.stamp.height;
  }

  function recordRecent(key: string): void {
    recentKeys = [key, ...recentKeys.filter((k) => k !== key)].slice(0, MAX_RECENT_DOODADS);
    saveRecentKeys(recentKeys);
  }

  function renderRecentBar(allItems: readonly UnifiedDoodad[], tileset: TilesetDef | undefined): void {
    const byKey = new Map(allItems.map((it) => [it.key, it]));
    const resolved = recentKeys.map((k) => byKey.get(k)).filter((it): it is UnifiedDoodad => Boolean(it));
    clearChildren(recentBar);
    if (resolved.length === 0) {
      recentBar.hidden = true;
      return;
    }
    recentBar.hidden = false;
    recentBar.append(el("span", { class: "fdw-recent-label", text: "최근" }));
    resolved.forEach((item, idx) => {
      const slotNum = idx + 1;
      const active = isItemSelected(item);
      const thumb = renderDoodadPreview(item, tileset, 1);
      thumb.className = "fdw-recent-thumb";
      recentBar.append(el("button", {
        class: "fdw-recent-slot" + (active ? " is-active" : ""),
        attrs: { type: "button", title: `[${slotNum}] ${item.name} (${item.sizeLabel})` },
        dataset: { testid: `floating-doodad-recent-${slotNum}` },
        children: [
          el("kbd", { class: "fdw-recent-kbd", text: String(slotNum) }),
          thumb,
          el("span", { class: "fdw-recent-name", text: item.name }),
        ],
        on: { click: () => activateItem(item) },
      }));
    });
  }

  function activateItem(item: UnifiedDoodad): void {
    selectedKey = item.key;
    recordRecent(item.key);
    if (item.source === "relief") {
      selectMapModeTool("relief");
      editorState.set({
        layer: "lower",
        activePaletteStamp: null,
        reliefDoodad: item.doodad.id,
        reliefDoodadOpen: false,
        reliefBridgeStart: null,
        terrainDesignOpen: false,
      });
    } else {
      editorState.set({ reliefDoodad: null, reliefBridgeStart: null });
      selectPaletteStamp(item.choice.stamp);
    }
    renderBody();
  }

  function filteredItems(tileset: TilesetDef | undefined): readonly UnifiedDoodad[] {
    const all = unifiedDoodadsFor(tileset);
    const q = searchQuery.trim().toLowerCase();
    return all.filter((item) => {
      if (activeTab !== "all" && item.tab !== activeTab) return false;
      if (!q) return true;
      if (item.name.toLowerCase().includes(q)) return true;
      if (item.source === "stamp") {
        return item.choice.terms.some((term) => term.toLowerCase().includes(q));
      }
      return item.doodad.id.toLowerCase().includes(q);
    });
  }

  function renderBody(): void {
    if (!open) return;
    const tileset = currentTileset();
    renderRecentBar(unifiedDoodadsFor(tileset), tileset);
    const items = filteredItems(tileset);
    clearChildren(body);

    const activeItem = items.find(isItemSelected) ?? (selectedKey ? items.find((it) => it.key === selectedKey) : undefined);
    statusName.textContent = activeItem
      ? `${activeItem.name} (${activeItem.sizeLabel}) · 맵 클릭으로 배치`
      : `총 ${items.length}개 · 클릭 후 맵에 배치`;
    clearPickBtn.hidden = !activeItem;

    if (items.length === 0) {
      body.append(el("div", { class: "fdw-empty", text: "이 분류에 해당하는 두댓이 없습니다." }));
      return;
    }

    if (viewMode === "split") {
      const listCol = el("div", { class: "fdw-split-list" });
      const previewCol = el("div", { class: "fdw-split-preview" });
      const shown = items.slice(0, visibleLimit);
      for (const item of shown) {
        const active = isItemSelected(item) || item.key === activeItem?.key;
        listCol.append(el("button", {
          class: "fdw-split-row" + (active ? " is-active" : ""),
          attrs: { type: "button", title: `${item.name} (${item.sizeLabel})` },
          dataset: { testid: `floating-doodad-item-${item.key}` },
          children: [
            el("span", { class: "fdw-split-name", text: item.name }),
            el("span", { class: "fdw-split-size", text: item.sizeLabel }),
          ],
          on: { click: () => activateItem(item) },
        }));
      }
      if (items.length > visibleLimit) {
        listCol.append(el("button", {
          class: "fdw-more-btn",
          attrs: { type: "button" },
          text: `+ ${items.length - visibleLimit}개 더 보기`,
          on: { click: () => { visibleLimit += PAGE_INCREMENT; renderBody(); } },
        }));
      }
      const focus = activeItem ?? shown[0]!;
      const previewCanvas = renderDoodadPreview(focus, tileset, 2);
      previewCanvas.className = "fdw-big-canvas";
      previewCol.append(
        el("div", {
          class: "fdw-big-stage",
          children: [
            el("span", { class: "fdw-big-meta", text: focus.sizeLabel }),
            previewCanvas,
          ],
        }),
        el("div", { class: "fdw-big-caption", text: focus.name }),
      );
      body.append(el("div", { class: "fdw-split", children: [listCol, previewCol] }));
      return;
    }

    // Default: SCMDraft 2 Visual Grid
    const grid = el("div", { class: "fdw-grid" });
    const shown = items.slice(0, visibleLimit);
    for (const item of shown) {
      const active = isItemSelected(item);
      const canvas = renderDoodadPreview(item, tileset, 1);
      canvas.className = "fdw-cell-canvas";
      grid.append(el("button", {
        class: "fdw-cell" + (active ? " is-active" : ""),
        attrs: { type: "button", title: `${item.name} (${item.sizeLabel})`, "aria-pressed": String(active) },
        dataset: { testid: `floating-doodad-item-${item.key}` },
        children: [
          el("span", { class: "fdw-cell-size", text: item.sizeLabel }),
          el("div", { class: "fdw-cell-stage", children: [canvas] }),
          el("span", { class: "fdw-cell-label", text: item.name }),
        ],
        on: { click: () => activateItem(item) },
      }));
    }
    body.append(grid);
    if (items.length > visibleLimit) {
      body.append(el("button", {
        class: "fdw-more-btn",
        attrs: { type: "button" },
        text: `+ ${items.length - visibleLimit}개 더 보기`,
        on: { click: () => { visibleLimit += PAGE_INCREMENT; renderBody(); } },
      }));
    }
  }

  function applySize(): void {
    if (!customSize) return;
    win.style.width = `${customSize.width}px`;
    body.style.height = `${customSize.bodyHeight}px`;
    body.style.maxHeight = "calc(100vh - 240px)";
  }

  function applyPosition(): void {
    if (!customPos) return;
    win.style.left = `${customPos.x}px`;
    win.style.top = `${customPos.y}px`;
    win.style.bottom = "auto";
  }

  function setOpen(next: boolean): void {
    if (open === next) return;
    open = next;
    win.hidden = !open;
    if (open) {
      applySize();
      applyPosition();
      renderBody();
    }
    onOpenChange(open);
  }

  // Smooth corner resize handle (persisted to localStorage)
  let resizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let startWidth = 512;
  let startBodyH = 384;
  resizeGrip.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    resizing = true;
    resizeStartX = event.clientX;
    resizeStartY = event.clientY;
    startWidth = Math.round(win.getBoundingClientRect().width);
    startBodyH = Math.round(body.getBoundingClientRect().height);
    try { resizeGrip.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });
  resizeGrip.addEventListener("pointermove", (event: PointerEvent) => {
    if (!resizing) return;
    const hostRect = canvasArea.getBoundingClientRect();
    const maxW = Math.min(860, Math.max(380, Math.round(hostRect.width - 36)));
    const nextW = Math.max(360, Math.min(maxW, startWidth + Math.round(event.clientX - resizeStartX)));
    const nextH = Math.max(220, Math.min(620, startBodyH + Math.round(event.clientY - resizeStartY)));
    customSize = { width: nextW, bodyHeight: nextH };
    applySize();
  });
  const endResize = (event: PointerEvent): void => {
    if (!resizing) return;
    resizing = false;
    if (customSize) saveWindowSize(customSize);
    try {
      if (resizeGrip.hasPointerCapture?.(event.pointerId)) resizeGrip.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  };
  resizeGrip.addEventListener("pointerup", endResize);
  resizeGrip.addEventListener("pointercancel", endResize);

  // Smooth drag-to-move title bar inside canvasArea
  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  titleBar.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button"))) return;
    dragging = true;
    const rect = win.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    try { titleBar.setPointerCapture(event.pointerId); } catch { /* ignore */ }
  });
  titleBar.addEventListener("pointermove", (event: PointerEvent) => {
    if (!dragging) return;
    const hostRect = canvasArea.getBoundingClientRect();
    const maxX = Math.max(8, hostRect.width - win.offsetWidth - 8);
    const maxY = Math.max(8, hostRect.height - win.offsetHeight - 8);
    const x = Math.max(8, Math.min(maxX, Math.round(event.clientX - hostRect.left - offsetX)));
    const y = Math.max(8, Math.min(maxY, Math.round(event.clientY - hostRect.top - offsetY)));
    customPos = { x, y };
    applyPosition();
  });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    try {
      if (titleBar.hasPointerCapture?.(event.pointerId)) titleBar.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  };
  titleBar.addEventListener("pointerup", endDrag);
  titleBar.addEventListener("pointercancel", endDrag);

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    visibleLimit = INITIAL_PAGE_SIZE;
    renderBody();
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (hasOpenModalLayer() || shouldIgnoreEditorShortcut(event)) return;
    if (event.key.toLowerCase() === "d") {
      event.preventDefault();
      setOpen(!open);
      return;
    }
    if (open && event.key >= "1" && event.key <= String(MAX_RECENT_DOODADS)) {
      const idx = Number(event.key) - 1;
      const targetKey = recentKeys[idx];
      if (!targetKey) return;
      const match = unifiedDoodadsFor(currentTileset()).find((it) => it.key === targetKey);
      if (match) {
        event.preventDefault();
        activateItem(match);
      }
    }
  };
  const onToggleEvent = (): void => setOpen(!open);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener(FLOATING_DOODAD_PALETTE_TOGGLE_EVENT, onToggleEvent);

  const unsubEditor = editorState.subscribe(() => {
    if (open) renderBody();
  });
  const unsubStore = store.subscribe(() => {
    if (open) renderBody();
  });

  canvasArea.append(win);

  return {
    isOpen: () => open,
    setOpen,
    toggle: () => setOpen(!open),
    dispose: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(FLOATING_DOODAD_PALETTE_TOGGLE_EVENT, onToggleEvent);
      unsubEditor();
      unsubStore();
      win.remove();
    },
  };
}
