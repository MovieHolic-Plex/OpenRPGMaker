// editor/panels/floatingDoodadWindow.ts
// Phase 2 & 5 (SCMDraft 2 감성): 드래그·리사이즈 가능한 독립 플로팅 「두댓(오브젝트) 팔레트」 창.
// - D 키 또는 좌하단 독 「두댓」으로 토글
// - 100% 오브젝트 단위 카탈로그:
//   1) propsForTileset(완성 건물·나무·소품 다중타일 스탬프) + paletteCatalogFor prefabs
//   2) Scarloxy 팩 매니페스트(scarloxyPackManifest.json) 완성 오브젝트(집 5×5 · 치료소 6×6 · 나무 2×3 · 유적 아치 3×3 등)
//   3) 상호작용 오브젝트(보물상자·옷장·항아리·문·횃불·책장 등 156종 멀티프레임 프롭)
//   4) 지형지물(경사로·계단·다리·벽면)
// - 우하단 자유 리사이즈 + 하단 최근 두댓 1~6 숫자키 즉시 전환

import scarloxyManifest from "@/assets/scarloxyPackManifest.json";
import { editorState } from "@/editor/editorState";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { createInteractivePropStripPreview } from "@/editor/panels/eventEditor/interactivePropPicker";
import { paletteCatalogFor } from "@/editor/panels/tilePaletteCatalog";
import { selectInteractivePropBrush, selectMapModeTool, selectPaletteStamp } from "@/editor/panels/tileToolbarActions";
import { propsForTileset, type PropCategoryId, type PropChoice } from "@/editor/propRecommendations";
import { quickHouseCatalog, quickHouseStyles, quickHouseStyleName } from "@/editor/quickHouse";
import { reliefTopGrassTile } from "@/editor/reliefActions";
import { reliefDoodadCatalog, type ReliefDoodad } from "@/editor/reliefDoodads";
import { selectTerrainDesignTool } from "@/editor/terrainDesignActions";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { allInteractiveProps, type InteractivePropEntry, type InteractivePropEra } from "@/project/interactiveProps";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export const FLOATING_DOODAD_PALETTE_TOGGLE_EVENT = "oprn:floating-doodad-palette-toggle";

type DoodadTabId = "all" | "structure" | "nature" | "prop" | "interactive";
type DoodadViewMode = "grid" | "split";

type UnifiedDoodad =
  | {
      readonly key: string;
      readonly source: "stamp";
      readonly tab: "nature" | "structure" | "prop";
      readonly name: string;
      readonly sizeLabel: string;
      readonly choice: PropChoice;
    }
  | {
      readonly key: string;
      readonly source: "interactive";
      readonly tab: "interactive";
      readonly name: string;
      readonly sizeLabel: string;
      readonly prop: InteractivePropEntry;
    }
  | {
      readonly key: string;
      readonly source: "relief";
      readonly tab: "nature";
      readonly name: string;
      readonly sizeLabel: string;
      readonly doodad: ReliefDoodad;
    };

const TABS: readonly { readonly id: DoodadTabId; readonly label: string }[] = [
  { id: "all", label: "전체" },
  { id: "structure", label: "건물·집" },
  { id: "nature", label: "자연" },
  { id: "prop", label: "소품" },
  { id: "interactive", label: "상호작용" },
];

const INITIAL_PAGE_SIZE = 36;
const PAGE_INCREMENT = 36;
const DOODAD_SIZE_STORAGE_KEY = "oprn:floating-doodad-size";
const DOODAD_RECENT_STORAGE_KEY = "oprn:floating-doodad-recent";
const MAX_RECENT_DOODADS = 6;

const SCARLOXY_BLOCK_LABELS: Readonly<Record<string, string>> = {
  "green-tree": "초록 나무",
  "green-tree-bushy": "풍성한 나무",
  "teal-tree": "침엽수",
  "teal-tree-bushy": "풍성한 침엽수",
  "green-tree-small": "작은 나무",
  "teal-tree-small": "작은 침엽수",
  "grass-tuft": "풀숲 장식",
  "grass-rock-1": "바위 A",
  "grass-rock-2": "바위 B",
  "gate-pillar": "문 기둥",
  "gate-top": "문 아치",
  "house-small": "초록 지붕 집",
  "house-small-alt": "보라 지붕 집",
  "house-large": "큰 민가 A",
  "house-large-alt": "큰 민가 B",
  "hospital": "마을 치료소",
  "palm": "야자수 A",
  "palm-alt": "야자수 B",
  "palm-small": "작은 야자수",
  "ice-tree": "설원 나무",
  "sand-rock-1": "사막 바위 A",
  "sand-rock-2": "사막 바위 B",
  "ice-rock-1": "얼음 바위 A",
  "ice-rock-2": "얼음 바위 B",
  "grass-ice-tuft": "설원 풀숲",
  "ruin-gate": "유적 아치문",
  "ruin-pillar": "유적 기둥",
  "ruin-pillar-broke": "부서진 기둥 A",
  "ruin-pillar-broke-alt": "부서진 기둥 B",
  "arena-plant": "풀 도장 건물",
  "arena-fire": "불 도장 건물",
  "arena-water": "물 도장 건물",
  "bed-mint": "민트 침대",
};

function tabForPropCategory(category: PropCategoryId | undefined): "nature" | "structure" | "prop" {
  if (category === "plants") return "nature";
  if (category === "structures") return "structure";
  return "prop";
}

function cleanDoodadName(raw: string, w: number, h: number): string {
  const tail = raw.includes("·") ? raw.slice(raw.lastIndexOf("·") + 1).trim() : raw;
  const trimmed = tail.replace(new RegExp(`\\s*${w}\\s*[×x]\\s*${h}$`, "i"), "").trim();
  return trimmed || raw;
}

function scarloxyObjectStampsFor(tileset: TilesetDef): readonly UnifiedDoodad[] {
  const idLower = tileset.id.toLowerCase();
  const match = scarloxyManifest.chipsets.find((cs) => {
    const stem = cs.file.replace(/\.png$/i, "");
    const underscore = stem.replace(/-/g, "_");
    return idLower.includes(stem) || idLower.includes(underscore);
  });
  if (!match) return [];

  const cols = 30;
  const results: UnifiedDoodad[] = [];

  for (const block of match.blocks) {
    if (block.kind === "terrain" || block.kind === "water") continue;
    const cells: { dx: number; dy: number; layer: "upper"; tile: number }[] = [];
    for (let dy = 0; dy < block.h; dy += 1) {
      for (let dx = 0; dx < block.w; dx += 1) {
        const tile = (block.row + dy) * cols + (block.col + dx);
        if (tile >= 0 && tile < tileset.count) {
          cells.push({ dx, dy, layer: "upper", tile });
        }
      }
    }
    if (cells.length === 0) continue;
    const label = SCARLOXY_BLOCK_LABELS[block.name] ?? block.name;
    const tab: "nature" | "structure" | "prop" =
      block.kind === "tree" || block.kind === "rock" || block.kind === "deco"
        ? "nature"
        : block.kind === "structure" || block.kind === "overhead"
          ? "structure"
          : "prop";
    const startTile = cells[0]!.tile;
    const endTile = cells[cells.length - 1]!.tile;
    results.push({
      key: `scarloxy:${match.file}:${block.name}`,
      source: "stamp",
      tab,
      name: label,
      sizeLabel: `${block.w}×${block.h}`,
      choice: {
        id: `scarloxy-${block.name}`,
        name: label,
        stamp: {
          source: { tilesetId: tileset.id, tileSize: tileset.tileSize, startTile, endTile },
          label,
          width: block.w,
          height: block.h,
          cells,
        },
        description: `${label} (${block.w}×${block.h})`,
        terms: [label, block.name, block.kind],
        preference: 3,
        family: tileset.id,
      },
    });
  }
  return results;
}

const catalogCache = new WeakMap<TilesetDef, readonly UnifiedDoodad[]>();

function tilesetDoodadsFor(tileset: TilesetDef): readonly UnifiedDoodad[] {
  const cached = catalogCache.get(tileset);
  if (cached) return cached;

  const out: UnifiedDoodad[] = [];
  const seenKeys = new Set<string>();
  const seenKitIds = new Set<string>();

  // 1) Curated multi-tile object stamps for this tileset
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

  // 2) Prefabs from tileset structureKits
  for (const prefab of paletteCatalogFor(tileset).prefabs) {
    if (seenKitIds.has(prefab.id)) continue;
    const stamp = paletteStampFromKit(prefab.kit);
    if (!stamp.cells.length) continue;
    seenKitIds.add(prefab.id);
    const key = `prefab:${prefab.id}`;
    const tab: "nature" | "structure" | "prop" = /나무|풀|꽃|바위|숲|tree|plant|bush|rock/i.test(prefab.searchBlob)
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

  // 3) Scarloxy manifest whole multi-tile object blocks (houses, hospital, trees, ruin gates, arenas)
  for (const entry of scarloxyObjectStampsFor(tileset)) {
    if (seenKeys.has(entry.key)) continue;
    seenKeys.add(entry.key);
    out.push(entry);
  }

  // 4) Relief doodads (ramps, stairs, bridges, walls)
  // Trees/rocks (kind === "prop") are already included above as single-object stamps in "nature".
  // Routing them through source:"relief" duplicated them under "경사로·다리"/"전체" and triggered
  // terrain cluster scattering (reliefClusterEnabled defaults to true), placing multiple trees per click.
  for (const doodad of reliefDoodadCatalog(tileset)) {
    if (doodad.kind === "prop") continue;
    const sizeLabel = doodad.kind === "ramp"
      ? (doodad.stairs ? "2×N" : "4×N")
      : doodad.kind === "bridge"
        ? "2×N"
        : `${doodad.kit.width}×${doodad.kit.height}`;
    out.push({
      key: `relief:${doodad.id}`,
      source: "relief",
      tab: "nature",
      name: doodad.label,
      sizeLabel,
      doodad,
    });
  }

  catalogCache.set(tileset, out);
  return out;
}

function unifiedDoodadsFor(tileset: TilesetDef | undefined): readonly UnifiedDoodad[] {
  if (!tileset) return [];
  const base = tilesetDoodadsFor(tileset);
  const props = allInteractiveProps(store.getCurrent());
  if (props.length === 0) return base;

  const out: UnifiedDoodad[] = [...base];
  const seenKeys = new Set(base.map((it) => it.key));
  // 5) Real multi-frame Interactive Props (chests, wardrobes, jars, torches, signs, doors...)
  for (const prop of props) {
    const key = `interactive:${prop.id}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const tw = Math.max(1, Math.round(prop.frameWidth / 16));
    const th = Math.max(1, Math.round(prop.frameHeight / 16));
    out.push({
      key,
      source: "interactive",
      tab: "interactive",
      name: prop.name,
      sizeLabel: `${tw}×${th}`,
      prop,
    });
  }
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

function renderDoodadPreview(item: UnifiedDoodad, tileset: TilesetDef | undefined, targetPx = 62): HTMLElement {
  if (item.source === "interactive") {
    const scale = Math.max(1, Math.min(3, Math.floor(targetPx / Math.max(item.prop.frameWidth, item.prop.frameHeight))));
    const elNode = createInteractivePropStripPreview(item.prop, { scale });
    elNode.classList.add("fdw-cell-canvas");
    return elNode;
  }
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
    const maxDim = Math.max(d.kit.width, d.kit.height) * tileset.tileSize;
    const scale = Math.max(0.5, Math.min(3, targetPx / Math.max(16, maxDim)));
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
  const maxDim = Math.max(item.choice.stamp.width, item.choice.stamp.height) * tileset.tileSize;
  const scale = Math.max(0.5, Math.min(3, targetPx / Math.max(16, maxDim)));
  return renderTileCellsToCanvas({
    tileset,
    widthTiles: item.choice.stamp.width,
    heightTiles: item.choice.stamp.height,
    cells: item.choice.stamp.cells,
    scale,
    transparentBackground: true,
  });
}

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

export interface FloatingDoodadWindowMount {
  readonly isOpen: () => boolean;
  readonly setOpen: (next: boolean) => void;
  readonly toggle: () => void;
  readonly dispose: () => void;
}

interface ArtStyleProfile {
  readonly id: string;
  readonly label: string;
  /** true 면 현재 칩셋 전용 오브젝트만 허용(이질적인 공용 32px 프롭 차단). */
  readonly nativeOnly: boolean;
  readonly allowedEras: readonly InteractivePropEra[];
}

function detectArtStyleProfile(tileset: TilesetDef | undefined): ArtStyleProfile {
  const raw = `${tileset?.id ?? ""} ${tileset?.name ?? ""}`.toLowerCase();
  if (/scarloxy|pokemon|emerald/i.test(raw)) {
    return { id: "scarloxy", label: "Scarloxy 16px", nativeOnly: true, allowedEras: [] };
  }
  if (/easyrpg|rtp|rm2k/i.test(raw)) {
    return { id: "rtp", label: "레트로 RTP", nativeOnly: true, allowedEras: [] };
  }
  if (/joseon|baram/i.test(raw)) {
    return { id: "joseon", label: "조선", nativeOnly: false, allowedEras: ["joseon"] };
  }
  if (/murim|wuxia/i.test(raw)) {
    return { id: "murim", label: "무림", nativeOnly: false, allowedEras: ["murim"] };
  }
  if (/modern|jp_city|jpcity|konbini|urban|city_modern/i.test(raw)) {
    return { id: "modern", label: "현대", nativeOnly: false, allowedEras: ["modern"] };
  }
  if (/scifi|sci_fi|cyber|space/i.test(raw)) {
    return { id: "scifi", label: "SF", nativeOnly: false, allowedEras: ["scifi"] };
  }
  if (/steampunk/i.test(raw)) {
    return { id: "steampunk", label: "스팀펑크", nativeOnly: false, allowedEras: ["steampunk"] };
  }
  if (/dungeon|cave|crypt|sewer/i.test(raw)) {
    return { id: "dungeon", label: "던전", nativeOnly: false, allowedEras: ["dungeon", "fantasy"] };
  }
  return { id: "fantasy", label: "판타지", nativeOnly: false, allowedEras: ["fantasy"] };
}

function matchesArtStyle(prop: InteractivePropEntry, profile: ArtStyleProfile): boolean {
  // 프로젝트에 사용자가 직접 업로드한 커스텀 프롭은 항상 허용
  if (prop.resourceId) return true;
  if (profile.nativeOnly) return false;
  return profile.allowedEras.includes(prop.era);
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
  let styleLocked = true;

  const styleLockBtn = el("button", {
    class: "fdw-style-lock is-locked",
    attrs: {
      type: "button",
      title: "현재 맵 화풍에 맞는 오브젝트만 표시 (클릭 시 전체 화풍 잠금 해제)",
      "aria-pressed": "true",
    },
    dataset: { testid: "floating-object-style-lock" },
    text: "🔒 화풍 고정",
    on: {
      click: () => {
        styleLocked = !styleLocked;
        visibleLimit = INITIAL_PAGE_SIZE;
        renderBody();
      },
    },
  }) as HTMLButtonElement;

  const viewToggleBtn = el("button", {
    class: "fdw-head-btn",
    attrs: { type: "button", title: "그리드 ↔ 분할 프리뷰 전환" },
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
    attrs: { type: "button", title: "오브젝트 팔레트 닫기 (Esc)", "aria-label": "오브젝트 팔레트 닫기" },
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
          el("span", { text: "오브젝트 팔레트" }),
          el("kbd", { class: "fdw-kbd", text: "O" }),
        ],
      }),
      el("div", { class: "fdw-title-actions", children: [styleLockBtn, viewToggleBtn, closeBtn] }),
    ],
  });

  const searchInput = el("input", {
    class: "fdw-search",
    attrs: { type: "search", placeholder: "집·나무·치료소·상자·계단 찾기…", "aria-label": "오브젝트 찾기", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: "floating-doodad-search" },
  }) as HTMLInputElement;

  const tabBar = el("div", { class: "fdw-tabs", attrs: { role: "tablist", "aria-label": "오브젝트 분류" } });
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
  const statusName = el("span", { class: "fdw-status-name", dataset: { testid: "floating-doodad-status" }, text: "오브젝트를 골라 맵에 클릭하세요" });
  const clearPickBtn = el("button", {
    class: "fdw-clear-btn",
    attrs: { type: "button", title: "선택 해제" },
    text: "해제",
    on: {
      click: () => {
        selectedKey = null;
        selectInteractivePropBrush(null);
        const st = editorState.get();
        if (st.tool === "relief" && st.terrainBrush === "house") {
          editorState.set({ tool: "paint", terrainBrush: "crayon", terrainHouseDrag: null });
        }
        editorState.set({ activePaletteStamp: null, reliefDoodad: null, reliefBridgeStart: null });
        renderBody();
      },
    },
  }) as HTMLButtonElement;
  const resizeGrip = el("div", {
    class: "fdw-resize-grip",
    attrs: {
      tabindex: "0",
      role: "slider",
      title: "드래그하거나 방향키로 오브젝트 창 크기 조절",
      "aria-label": "창 크기 조절",
    },
    dataset: { testid: "floating-doodad-resize" },
    text: "◿",
  });
  const foot = el("div", { class: "fdw-foot", children: [statusName, clearPickBtn, resizeGrip] });

  const win = el("section", {
    class: "floating-doodad-window",
    attrs: { role: "dialog", "aria-label": "오브젝트 팔레트" },
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
    if (item.source === "interactive") {
      return state.activeInteractivePropId === item.prop.id;
    }
    if (item.source === "relief") {
      return state.tool === "relief" && state.reliefDoodad === item.doodad.id;
    }
    const stamp = state.activePaletteStamp;
    if (!stamp) return false;
    if (item.choice.stamp.kitId) return stamp.kitId === item.choice.stamp.kitId;
    return stamp.label === item.choice.stamp.label && stamp.width === item.choice.stamp.width && stamp.height === item.choice.stamp.height;
  }

  function recordRecent(key: string): void {
    recentKeys = [key, ...recentKeys.filter((k) => k !== key)].slice(0, MAX_RECENT_DOODADS);
    saveRecentKeys(recentKeys);
  }

  function resolveRecentItems(allItems: readonly UnifiedDoodad[]): readonly UnifiedDoodad[] {
    const byKey = new Map(allItems.map((it) => [it.key, it]));
    return recentKeys.map((k) => byKey.get(k)).filter((it): it is UnifiedDoodad => Boolean(it));
  }

  function renderRecentBar(allItems: readonly UnifiedDoodad[], tileset: TilesetDef | undefined): void {
    const resolved = resolveRecentItems(allItems);
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
      const thumb = renderDoodadPreview(item, tileset, 18);
      thumb.classList.add("fdw-recent-thumb");
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
    if (item.source === "interactive") {
      editorState.set({ reliefDoodad: null, reliefBridgeStart: null });
      selectInteractivePropBrush(item.prop.id);
    } else if (item.source === "relief") {
      selectInteractivePropBrush(null);
      selectMapModeTool("relief");
      editorState.set({
        layer: "lower",
        activePaletteStamp: null,
        terrainBrush: "height",
        terrainPreset: null,
        terrainMoveGroup: false,
        terrainPoints: null,
        terrainHouseDrag: null,
        terrainVisionPreview: false,
        reliefClusterEnabled: false,
        reliefDoodad: item.doodad.id,
        reliefDoodadOpen: false,
        reliefBridgeStart: null,
        terrainDesignOpen: false,
      });
    } else {
      selectInteractivePropBrush(null);
      if (editorState.get().layer === "event") {
        editorState.set({ layer: item.choice.stamp.cells[0]?.layer ?? "upper" });
      }
      editorState.set({ reliefDoodad: null, reliefBridgeStart: null });
      selectPaletteStamp(item.choice.stamp);
    }
    renderBody();
  }

  function filteredItems(tileset: TilesetDef | undefined, profile: ArtStyleProfile): readonly UnifiedDoodad[] {
    const all = unifiedDoodadsFor(tileset);
    const q = searchQuery.trim().toLowerCase();
    return all.filter((item) => {
      if (item.source === "interactive" && styleLocked && !matchesArtStyle(item.prop, profile)) return false;
      // In "전체" tab without search, keep the map's own objects + relief first so external interactive props don't flood the top
      if (activeTab === "all" && !q && item.source === "interactive") return false;
      if (activeTab !== "all" && item.tab !== activeTab) return false;
      if (!q) return true;
      if (item.name.toLowerCase().includes(q)) return true;
      if (item.source === "stamp") {
        return item.choice.terms.some((term) => term.toLowerCase().includes(q));
      }
      if (item.source === "interactive") {
        return item.prop.id.toLowerCase().includes(q)
          || item.prop.tags.some((t) => t.toLowerCase().includes(q));
      }
      return item.doodad.id.toLowerCase().includes(q);
    });
  }

  function renderBody(): void {
    if (!open) return;
    const tileset = currentTileset();
    const profile = detectArtStyleProfile(tileset);
    styleLockBtn.classList.toggle("is-locked", styleLocked);
    styleLockBtn.setAttribute("aria-pressed", String(styleLocked));
    styleLockBtn.textContent = styleLocked ? `🔒 ${profile.label} 고정` : "🔓 전체 화풍";

    renderRecentBar(unifiedDoodadsFor(tileset), tileset);
    const items = filteredItems(tileset, profile);
    clearChildren(body);

    const state = editorState.get();
    const houseModeActive = state.tool === "relief" && state.terrainBrush === "house";
    const houseStyles = tileset ? quickHouseStyles(tileset) : [];
    const houseCatalog = tileset ? quickHouseCatalog(tileset) : [];

    if (activeTab === "structure" && (houseStyles.length > 0 || houseCatalog.length > 0)) {
      const styleOptions: { readonly id: string; readonly label: string; readonly apply: () => void }[] = [
        ...houseStyles.map((stId) => ({
          id: `style:${stId}`,
          label: quickHouseStyleName(stId),
          apply: () => editorState.set({ terrainHouseStyle: stId, terrainHouseKitId: null, terrainHouseResize: "house" }),
        })),
        ...houseCatalog.slice(0, 8).map((kit) => ({
          id: `kit:${kit.id}`,
          label: kit.name ?? kit.id,
          apply: () => editorState.set({ terrainHouseKitId: kit.id, terrainHouseResize: "house" }),
        })),
      ];
      const currentStyleId = state.terrainHouseKitId
        ? `kit:${state.terrainHouseKitId}`
        : `style:${state.terrainHouseStyle}`;
      const matchedIdx = Math.max(0, styleOptions.findIndex((o) => o.id === currentStyleId));
      const activeStyleObj = styleOptions[matchedIdx] ?? styleOptions[0]!;
      const activeLabel = state.terrainHouseKitId
        ? (houseCatalog.find((k) => k.id === state.terrainHouseKitId)?.name ?? activeStyleObj.label)
        : activeStyleObj.label;

      const styleCycleBtn = el("button", {
        class: "fdw-house-select",
        attrs: { type: "button", title: "클릭할 때마다 맞춤 집 양식을 전환합니다" },
        dataset: { testid: "fdw-house-style" },
        text: `양식: ${activeLabel} ▾`,
        on: {
          click: () => {
            const nextOpt = styleOptions[(matchedIdx + 1) % styleOptions.length]!;
            nextOpt.apply();
            if (!houseModeActive) selectTerrainDesignTool("house");
          },
        },
      });

      const storiesBtn = el("button", {
        class: "fdw-house-chip",
        attrs: { type: "button", title: "집 층수 전환 (1층 ↔ 2층)" },
        dataset: { testid: "fdw-house-stories" },
        text: `${state.terrainHouseStories}층`,
        on: {
          click: () => {
            editorState.set({ terrainHouseStories: state.terrainHouseStories === 1 ? 2 : 1, terrainHouseKitId: null });
            if (!houseModeActive) selectTerrainDesignTool("house");
          },
        },
      });

      const houseToggleBtn = el("button", {
        class: "fdw-house-toggle" + (houseModeActive ? " is-active" : ""),
        attrs: { type: "button", "aria-pressed": String(houseModeActive), title: "맵의 빈 땅에서 원하는 너비만큼 드래그해 맞춤 집을 바로 세웁니다" },
        dataset: { testid: "fdw-house-drag-toggle" },
        text: houseModeActive ? "🏠 드래그 집 짓는 중" : "🏠 드래그 집 짓기",
        on: {
          click: () => {
            if (houseModeActive) {
              editorState.set({ tool: "paint", terrainBrush: "crayon", terrainHouseDrag: null });
            } else {
              selectedKey = null;
              selectInteractivePropBrush(null);
              editorState.set({ activePaletteStamp: null, reliefDoodad: null, terrainDesignOpen: false });
              if (houseStyles.length > 0) {
                editorState.set({ terrainHouseStyle: houseStyles[0]!, terrainHouseKitId: null, terrainHouseResize: "house" });
              }
              selectTerrainDesignTool("house");
            }
          },
        },
      });

      body.append(el("div", {
        class: "fdw-house-bar" + (houseModeActive ? " is-active" : ""),
        dataset: { testid: "fdw-house-builder" },
        children: [
          houseToggleBtn,
          styleCycleBtn,
          ...(houseStyles.length > 0 && !state.terrainHouseKitId ? [storiesBtn] : []),
        ],
      }));
    }

    const activeItem = items.find(isItemSelected) ?? (selectedKey ? items.find((it) => it.key === selectedKey) : undefined);
    statusName.textContent = houseModeActive
      ? "🏠 드래그 집 짓기 활성 · 빈 땅을 끌어 원하는 크기로 집을 세우세요"
      : activeItem
        ? `${activeItem.name} (${activeItem.sizeLabel}) · 맵 클릭으로 배치`
        : `오브젝트 ${items.length}개 · 클릭 후 맵에 배치`;
    clearPickBtn.hidden = !activeItem && !houseModeActive;

    if (items.length === 0) {
      if (activeTab === "interactive" && styleLocked) {
        body.append(el("div", {
          class: "fdw-lock-empty",
          children: [
            el("div", { text: `🔒 현재 맵 화풍(${profile.label})에 맞는 상호작용 오브젝트가 아직 없습니다.` }),
            el("small", { text: "이질적인 다른 화풍의 프롭이 섞이지 않도록 자동으로 숨겼습니다." }),
            el("button", {
              class: "fdw-head-btn",
              attrs: { type: "button" },
              text: "🔓 다른 화풍 오브젝트도 보기",
              on: {
                click: () => {
                  styleLocked = false;
                  renderBody();
                },
              },
            }),
          ],
        }));
      } else {
        body.append(el("div", { class: "fdw-empty", text: "이 분류에 해당하는 오브젝트가 없습니다." }));
      }
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
      const previewEl = renderDoodadPreview(focus, tileset, 160);
      previewEl.classList.add("fdw-big-canvas");
      previewCol.append(
        el("div", {
          class: "fdw-big-stage",
          children: [
            el("span", { class: "fdw-big-meta", text: focus.sizeLabel }),
            previewEl,
          ],
        }),
        el("div", { class: "fdw-big-caption", text: focus.name }),
      );
      body.append(el("div", { class: "fdw-split", children: [listCol, previewCol] }));
      return;
    }

    const grid = el("div", { class: "fdw-grid" });
    const shown = items.slice(0, visibleLimit);
    for (const item of shown) {
      const active = isItemSelected(item);
      const previewEl = renderDoodadPreview(item, tileset, 62);
      previewEl.classList.add("fdw-cell-canvas");
      grid.append(el("button", {
        class: "fdw-cell" + (active ? " is-active" : ""),
        attrs: { type: "button", title: `${item.name} (${item.sizeLabel})`, "aria-pressed": String(active) },
        dataset: { testid: `floating-doodad-item-${item.key}` },
        children: [
          el("span", { class: "fdw-cell-size", text: item.sizeLabel }),
          el("div", { class: "fdw-cell-stage", children: [previewEl] }),
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
  resizeGrip.addEventListener("keydown", (event: KeyboardEvent) => {
    const step = event.shiftKey ? 48 : 24;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowDown") dy = step;
    else if (event.key === "ArrowUp") dy = -step;
    else return;
    event.preventDefault();
    const hostRect = canvasArea.getBoundingClientRect();
    const maxW = Math.min(860, Math.max(380, Math.round(hostRect.width - 36)));
    const curW = customSize?.width ?? Math.round(win.getBoundingClientRect().width || 512);
    const curH = customSize?.bodyHeight ?? Math.round(body.getBoundingClientRect().height || 384);
    customSize = {
      width: Math.max(360, Math.min(maxW, curW + dx)),
      bodyHeight: Math.max(220, Math.min(620, curH + dy)),
    };
    applySize();
    saveWindowSize(customSize);
  });

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
    const lower = event.key.toLowerCase();
    if (lower === "o" || lower === "d") {
      event.preventDefault();
      setOpen(!open);
      return;
    }
    if (open && event.key >= "1" && event.key <= String(MAX_RECENT_DOODADS)) {
      const idx = Number(event.key) - 1;
      const resolved = resolveRecentItems(unifiedDoodadsFor(currentTileset()));
      const match = resolved[idx];
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
