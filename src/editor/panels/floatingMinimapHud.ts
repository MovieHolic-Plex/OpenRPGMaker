// editor/panels/floatingMinimapHud.ts
// Phase 1 (B × C 하이브리드 · SCMDraft 2 감성) + 안 2 (☀ 분위기 · 광원 원클릭 HUD 팝오버):
// 고정 왼쪽 열 없이 캔버스 좌상단에 떠 있는 플로팅 미니맵 + 1클릭 맵 스위처 + 분위기/광원/후처리 팝오버.
// - 미니맵 클릭·드래그로 즉시 카메라 점프(requestEditorCameraFocus)
// - 현재 모드(유닛/지형/타일)에 맞춰 미니맵 오버레이 자동 전환
// - 맵 이름 클릭 시 연결된 맵 우선 + 전체 맵 트리 스위처 팝오버 열기
// - ☀ 버튼 클릭 시 7종 시네마틱 콤보 · 10종 HD-2D 필름 톤 · 30종 장르 환경 씬 · 19종 입자 · 그림자/시야 빠른 제어

import {
  addMap,
  applyCinematicCombo,
  setMapAtmosphereEffects,
  setMapCloudShadows,
  setMapPostFx,
  setMapSunlight,
  setMapVisionBlocking,
} from "@/editor/actions";
import {
  isEditorMoodPreviewEnabled,
  mapHasActiveMood,
  setEditorMoodPreviewEnabled,
  subscribeEditorMoodPreview,
} from "@/editor/editorMoodPreview";
import { editorState, type EditorState } from "@/editor/editorState";
import { requestEditorCameraFocus } from "@/editor/editorCameraFocus";
import { getEditorCameraViewport, subscribeEditorCameraViewport } from "@/editor/editorCameraViewport";
import { toggleLeftColumn } from "@/editor/panels/leftColumnDrawer";
import { openMapPropertiesDialog } from "@/editor/panels/mapPropertiesDialog";
import { toggleWorldBoard } from "@/editor/panels/worldBoardModal";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { createMapThumbnail } from "@/editor/panels/mapThumbnail";
import { selectMapModeTool } from "@/editor/panels/tileToolbarActions";
import { resolveCurrentMapId, selectEditorMap } from "@/editor/mapSelection";
import {
  ATMOSPHERE_GENRES,
  ATMOSPHERE_PRESETS,
  ATMOSPHERE_SCENES,
  normalizeAtmosphereEffects,
  type AtmosphereKind,
  type AtmosphereScenePreset,
} from "@/project/atmosphere";
import { normalizeMapClimate } from "@/project/mapClimate";
import { collectMapLinkGraph } from "@/project/mapLinkStats";
import { isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import {
  CINEMATIC_COMBO_PRESETS,
  POST_FX_PRESETS,
  type CinematicComboId,
  type PostFxPresetId,
} from "@/project/postFx";
import { isTileCellChange, store } from "@/project/store";
import type { Command, GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export const FLOATING_MINIMAP_TOGGLE_EVENT = "oprn:floating-minimap-toggle";
export const FLOATING_MAP_SWITCHER_OPEN_EVENT = "oprn:floating-map-switcher-open";
export const FLOATING_MOOD_POPOVER_OPEN_EVENT = "oprn:floating-mood-popover-open";

const MINIMAP_COLLAPSED_KEY = "oprn:floating-minimap-collapsed";
const MINIMAP_STAGE_W = 196;
const MINIMAP_STAGE_H = 112;
const THUMB_SETTLE_MS = 400;

type MinimapMode = "unit" | "terrain" | "tile";
type MoodTabId = "combo" | "postfx" | "scene";
type GenreFilter = (typeof ATMOSPHERE_GENRES)[number];

type StageRect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

type EventCategory = "portal" | "enemy" | "npc";

const COMBO_CARD_META: ReadonlyArray<{
  readonly id: Exclude<CinematicComboId, "classic-clean">;
  readonly icon: string;
  readonly shortLabel: string;
  readonly badge: string;
}> = [
  { id: "octopath-dusk", icon: "🌅", shortLabel: "HD-2D 황혼", badge: "긴그림자·먼지" },
  { id: "blossom-dawn", icon: "🌸", shortLabel: "봄바람 벚꽃 여명", badge: "꽃잎·아침햇살" },
  { id: "rainy-noir", icon: "🌧", shortLabel: "사이버 네오누아르", badge: "네온·폭우·블룸" },
  { id: "flashlight-horror", icon: "🔦", shortLabel: "칠흑 손전등 호러", badge: "어둠·손전등·안개" },
  { id: "arctic-camp", icon: "❄", shortLabel: "눈보라 설원 야영", badge: "빙청·서리·대설" },
  { id: "cataclysm-boss", icon: "🔥", shortLabel: "불타는 보스전", badge: "화염·불씨·재" },
];

const POSTFX_CARD_ORDER: ReadonlyArray<{
  readonly id: PostFxPresetId;
  readonly icon: string;
  readonly shortLabel: string;
}> = [
  { id: "ghibli-day", icon: "🏞", shortLabel: "맑은 낮 (화사함)" },
  { id: "hd2d-warm", icon: "🌅", shortLabel: "황혼 필름 (옥토패스)" },
  { id: "dawn-mist", icon: "🌷", shortLabel: "새벽 여명 (라벤더)" },
  { id: "eastern-ink", icon: "📜", shortLabel: "동양 한지 · 노을" },
  { id: "dungeon-torch", icon: "🕯", shortLabel: "던전 횃불" },
  { id: "gothic-horror", icon: "🕸", shortLabel: "고딕 공포 (그레인)" },
  { id: "cyber-neon", icon: "⚡", shortLabel: "사이버 네온" },
  { id: "arctic-blizzard", icon: "🧊", shortLabel: "설원 빙청" },
  { id: "cataclysm-fire", icon: "🌋", shortLabel: "화염 재앙" },
  { id: "none", icon: "◻", shortLabel: "원본 (후처리 없음)" },
];

function detectMinimapMode(state: Pick<EditorState, "layer" | "tool">): MinimapMode {
  if (state.tool === "relief") return "terrain";
  if (state.layer === "event") return "unit";
  return "tile";
}

function minimapModeMeta(mode: MinimapMode): { readonly label: string; readonly next: () => void; readonly title: string } {
  if (mode === "unit") {
    return {
      label: "유닛 뷰",
      title: "현재 유닛(이벤트) 뷰 — 누르면 지형 붓 모드로 전환",
      next: () => {
        selectMapModeTool("relief");
        editorState.set({ layer: "lower" });
      },
    };
  }
  if (mode === "terrain") {
    return {
      label: "지형 뷰",
      title: "현재 지형(높이) 뷰 — 누르면 기본 타일 뷰로 전환",
      next: () => selectSidebarLayer("lower"),
    };
  }
  return {
    label: "타일 뷰",
    title: "현재 타일 뷰 — 누르면 유닛(이벤트) 뷰로 전환",
    next: () => selectSidebarLayer("event"),
  };
}

function computeFittedRect(mapWidth: number, mapHeight: number, boxW: number, boxH: number): StageRect {
  const safeW = Math.max(1, mapWidth);
  const safeH = Math.max(1, mapHeight);
  const scale = Math.min(boxW / safeW, boxH / safeH);
  const w = Math.max(12, Math.round(safeW * scale));
  const h = Math.max(12, Math.round(safeH * scale));
  return {
    x: Math.floor((boxW - w) / 2),
    y: Math.floor((boxH - h) / 2),
    w,
    h,
  };
}

function hasCommandKind(commands: readonly Command[] | undefined, kind: Command["kind"]): boolean {
  if (!commands) return false;
  for (const cmd of commands) {
    if (cmd.kind === kind) return true;
    if (cmd.kind === "fork") {
      if (hasCommandKind(cmd.then, kind) || hasCommandKind(cmd.else, kind)) return true;
    } else if (cmd.kind === "choices") {
      for (const opt of cmd.options) {
        if (hasCommandKind(opt.branch, kind)) return true;
      }
      if (hasCommandKind(cmd.cancelBranch, kind)) return true;
    } else if (cmd.kind === "loop") {
      if (hasCommandKind(cmd.body, kind)) return true;
    }
  }
  return false;
}

function classifyEvent(event: GameEvent): EventCategory {
  const pages = event.pages?.length ? event.pages : [{ commands: event.commands }];
  for (const page of pages) {
    if (hasCommandKind(page.commands, "transfer")) return "portal";
  }
  for (const page of pages) {
    if (hasCommandKind(page.commands, "battleProcessing")) return "enemy";
  }
  if (/적|몬스터|보스|산적|슬라임|전투|enemy|boss|monster/iu.test(event.name ?? "")) return "enemy";
  return "npc";
}

function flattenTree(node: MapTreeNode, depth: number, out: { readonly node: MapTreeNode; readonly depth: number }[]): void {
  out.push({ node, depth });
  for (const child of node.children) flattenTree(child, depth + 1, out);
}

function detectActiveCombo(map: GameMap | undefined): CinematicComboId | null {
  if (!map) return null;
  const curPreset = map.postFx?.preset ?? "none";
  const curEffects = normalizeAtmosphereEffects(map.atmosphereEffects).map((e) => e.kind);
  const climate = normalizeMapClimate(map.climate);
  const curWeather = climate?.mode === "fixed" ? climate.weather : "none";

  for (const meta of COMBO_CARD_META) {
    const combo = CINEMATIC_COMBO_PRESETS[meta.id];
    const expectedPreset = combo.postFx?.preset ?? "none";
    if (curPreset !== expectedPreset) continue;
    const expectedKinds = combo.atmosphereEffects.map((e) => e.kind);
    if (expectedKinds.length !== curEffects.length) continue;
    if (!expectedKinds.every((k) => curEffects.includes(k))) continue;
    const expectedWeather = combo.weather?.kind ?? "none";
    if (expectedWeather !== curWeather) continue;
    return meta.id;
  }
  return null;
}

function matchesAtmosphereScene(map: GameMap | undefined, scene: AtmosphereScenePreset): boolean {
  if (!map) return false;
  const cur = normalizeAtmosphereEffects(map.atmosphereEffects);
  if (cur.length !== scene.effects.length) return false;
  const curKinds = new Set(cur.map((e) => e.kind));
  return scene.effects.every((e) => curKinds.has(e.kind));
}

function summarizeActiveMood(map: GameMap | undefined): string {
  if (!map || !mapHasActiveMood(map)) return "원본 도트 (적용된 분위기 없음)";
  const parts: string[] = [];
  if (map.postFx?.preset && map.postFx.preset !== "none") {
    const label = POST_FX_PRESETS[map.postFx.preset]?.label.split(" (")[0] ?? map.postFx.preset;
    parts.push(label);
  }
  if (map.sunlight?.enabled) {
    parts.push((map.sunlight.altitude ?? 45) <= 30 ? "긴그림자" : "태양그림자");
  }
  if (map.cloudShadows?.enabled) {
    parts.push("구름그림자");
  }
  const effects = normalizeAtmosphereEffects(map.atmosphereEffects);
  if (effects.length > 0) {
    const names = effects
      .slice(0, 2)
      .map((ef) => ATMOSPHERE_PRESETS.find((p) => p.id === ef.kind)?.label.split(" ·")[0] ?? ef.kind);
    parts.push(effects.length > 2 ? `${names.join("·")}+${effects.length - 2}` : names.join("·"));
  }
  const climate = normalizeMapClimate(map.climate);
  if (climate?.mode === "fixed" && climate.weather !== "none") {
    const wLabel: Record<string, string> = { rain: "비", storm: "폭풍", snow: "눈", fog: "안개" };
    parts.push(wLabel[climate.weather] ?? climate.weather);
  }
  if (map.defaultLighting && map.defaultLighting.ambient > 0.02) {
    parts.push("야간조명");
  }
  if (map.terrainDesign?.gameplay?.visionBlocking) {
    parts.push("시야차단");
  }
  return parts.join(" · ");
}

export function mountFloatingMinimapHud(canvasArea: HTMLElement): () => void {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(MINIMAP_COLLAPSED_KEY) === "1";
  } catch { /* ignore restricted storage */ }

  let switcherOpen = false;
  let moodOpen = false;
  let activeMoodTab: MoodTabId = "combo";
  let activeGenre: GenreFilter = "무협";
  let searchQuery = "";
  let dragging = false;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastThumbKey = "";
  let currentFit: StageRect = { x: 0, y: 0, w: MINIMAP_STAGE_W, h: MINIMAP_STAGE_H };

  // ── Header ──
  const mapNameLabel = el("span", { class: "fmh-map-name", dataset: { testid: "floating-minimap-map-name" }, text: "맵" });
  const mapNameBtn = el("button", {
    class: "fmh-map-trigger",
    attrs: { type: "button", title: "맵 전환 목록 열기", "aria-expanded": "false", "aria-haspopup": "dialog" },
    dataset: { testid: "floating-minimap-map-trigger" },
    children: [el("span", { class: "fmh-caret", attrs: { "aria-hidden": "true" }, text: "▾" }), mapNameLabel],
    on: { click: () => setSwitcherOpen(!switcherOpen) },
  }) as HTMLButtonElement;

  const worldBoardBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "월드 보드 열기 (M)", "aria-label": "월드 보드 열기 (M)" },
    dataset: { testid: "floating-minimap-world-board" },
    text: "◈",
    on: { click: () => toggleWorldBoard() },
  }) as HTMLButtonElement;

  const moodBtn = el("button", {
    class: "fmh-icon-btn fmh-mood-btn",
    attrs: {
      type: "button",
      title: "맵 분위기 · 광원 · HD-2D 필름 · 장르 환경 입자",
      "aria-label": "맵 분위기 및 광원 열기",
      "aria-expanded": "false",
      "aria-haspopup": "dialog",
    },
    dataset: { testid: "floating-minimap-mood-btn" },
    text: "☀",
    on: { click: () => setMoodOpen(!moodOpen) },
  }) as HTMLButtonElement;

  const mapSettingsBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "맵 설정 (이름 · 타일셋 · 크기 · BGM · 적 출현)", "aria-label": "맵 설정 열기" },
    dataset: { testid: "floating-minimap-map-settings" },
    text: "⚙",
    on: {
      click: () => {
        setMoodOpen(false);
        setSwitcherOpen(false);
        const { mapId, map } = currentContext();
        if (mapId && map) openMapPropertiesDialog(mapId, map.name);
      },
    },
  }) as HTMLButtonElement;

  const sidebarBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "왼쪽 도구 열 접기/펴기", "aria-label": "왼쪽 도구 열 접기/펴기" },
    dataset: { testid: "floating-minimap-toggle-sidebar" },
    text: "◧",
    on: { click: () => toggleLeftColumn() },
  }) as HTMLButtonElement;

  const collapseBtn = el("button", {
    class: "fmh-icon-btn",
    attrs: { type: "button", title: "미니맵 접기/펴기", "aria-label": "미니맵 접기/펴기", "aria-expanded": String(!collapsed) },
    dataset: { testid: "floating-minimap-collapse" },
    text: collapsed ? "+" : "−",
    on: { click: () => setCollapsed(!collapsed) },
  }) as HTMLButtonElement;

  const head = el("div", {
    class: "fmh-head",
    children: [
      mapNameBtn,
      el("div", { class: "fmh-head-actions", children: [worldBoardBtn, moodBtn, mapSettingsBtn, sidebarBtn, collapseBtn] }),
    ],
  });

  // ── Minimap Stage (Thumbnail + 2× Overlay Canvas) ──
  const thumbSlot = el("div", { class: "fmh-thumb-slot", attrs: { "aria-hidden": "true" } });
  const overlayCanvas = el("canvas", {
    class: "fmh-overlay-canvas",
    attrs: { width: String(MINIMAP_STAGE_W * 2), height: String(MINIMAP_STAGE_H * 2), "aria-hidden": "true" },
  }) as HTMLCanvasElement;
  const stage = el("div", {
    class: "fmh-stage",
    attrs: { role: "slider", tabindex: "0", "aria-label": "미니맵 — 클릭하거나 끌어 카메라 이동" },
    dataset: { testid: "floating-minimap-stage" },
    children: [thumbSlot, overlayCanvas],
  });

  // ── Footer ──
  const modeDot = el("span", { class: "fmh-mode-dot", attrs: { "aria-hidden": "true" } });
  const modeText = el("span", { class: "fmh-mode-text", text: "타일 뷰" });
  const modeBtn = el("button", {
    class: "fmh-mode-btn",
    attrs: { type: "button" },
    dataset: { testid: "floating-minimap-mode" },
    children: [modeDot, modeText],
    on: {
      click: () => {
        const mode = detectMinimapMode(editorState.get());
        minimapModeMeta(mode).next();
      },
    },
  }) as HTMLButtonElement;
  const metaText = el("span", { class: "fmh-meta", dataset: { testid: "floating-minimap-meta" }, text: "" });
  const foot = el("div", { class: "fmh-foot", children: [modeBtn, metaText] });

  // ── Map Switcher Popover ──
  const searchInput = el("input", {
    class: "fmh-search-input",
    attrs: { type: "search", placeholder: "맵 이름으로 빠르게 이동…", "aria-label": "맵 찾기", autocomplete: "off", spellcheck: "false" },
    dataset: { testid: "floating-map-switcher-search" },
  }) as HTMLInputElement;
  const switcherList = el("div", { class: "fmh-switcher-list", dataset: { testid: "floating-map-switcher-list" } });
  const newMapBtn = el("button", {
    class: "fmh-switcher-action",
    attrs: { type: "button" },
    dataset: { testid: "floating-map-switcher-new" },
    text: "+ 새 맵",
    on: {
      click: () => {
        const project = store.getCurrent();
        const curId = resolveCurrentMapId();
        const curMap = curId ? project.maps[curId] : undefined;
        const count = Object.keys(project.maps).length + 1;
        const id = addMap(`새 맵 ${count}`, curMap?.width ?? 24, curMap?.height ?? 18, curMap?.tilesetId);
        selectEditorMap(id);
        setSwitcherOpen(false);
      },
    },
  });
  const openSidebarAction = el("button", {
    class: "fmh-switcher-action",
    attrs: { type: "button" },
    text: "왼쪽 열 ◧",
    on: {
      click: () => {
        setSwitcherOpen(false);
        toggleLeftColumn();
      },
    },
  });
  const switcherFoot = el("div", { class: "fmh-switcher-foot", children: [newMapBtn, openSidebarAction] });
  const popover = el("div", {
    class: "fmh-switcher-popover",
    attrs: { role: "dialog", "aria-label": "맵 빠른 전환" },
    dataset: { testid: "floating-map-switcher-popover" },
    children: [el("div", { class: "fmh-search-wrap", children: [searchInput] }), switcherList, switcherFoot],
  });
  popover.hidden = true;

  // ── Mood & Lighting Quick Popover (☀ 분위기 · 광원) ──
  const moodBody = el("div", { class: "fmh-mood-body", dataset: { testid: "floating-mood-body" } });
  const moodSummaryText = el("span", { class: "fmh-mood-summary", dataset: { testid: "floating-mood-summary" }, text: "" });
  const previewToggleBtn = el("button", {
    class: "fmh-mood-chip",
    attrs: { type: "button", title: "에디터 캔버스 위 실시간 분위기·입자 미리보기 켜기/끄기", "aria-pressed": "true" },
    dataset: { testid: "fmh-mood-preview-toggle" },
    text: "👁 미리보기",
    on: {
      click: () => {
        setEditorMoodPreviewEnabled(!isEditorMoodPreviewEnabled());
        renderMoodPopover();
      },
    },
  }) as HTMLButtonElement;

  const resetMoodBtn = el("button", {
    class: "fmh-mood-chip",
    attrs: { type: "button", title: "후처리·그림자·환경 입자·조명·시야 차단을 모두 원본으로 되돌립니다" },
    dataset: { testid: "fmh-mood-reset" },
    text: "초기화",
    on: {
      click: () => {
        const { mapId } = currentContext();
        if (!mapId) return;
        applyCinematicCombo(mapId, "classic-clean");
        setMapVisionBlocking(mapId, false);
      },
    },
  }) as HTMLButtonElement;

  const moodTabButtons = new Map<MoodTabId, HTMLButtonElement>();
  const makeMoodTab = (id: MoodTabId, label: string): HTMLButtonElement => {
    const btn = el("button", {
      class: "fmh-mood-tab",
      attrs: { type: "button", role: "tab", "aria-selected": String(activeMoodTab === id) },
      dataset: { testid: `fmh-mood-tab-${id}` },
      text: label,
      on: {
        click: () => {
          activeMoodTab = id;
          renderMoodPopover();
        },
      },
    }) as HTMLButtonElement;
    moodTabButtons.set(id, btn);
    return btn;
  };

  const moodTabsBar = el("div", {
    class: "fmh-mood-tabs",
    attrs: { role: "tablist", "aria-label": "분위기 카테고리" },
    children: [
      makeMoodTab("combo", "✨ 시네마틱 (7)"),
      makeMoodTab("postfx", "🎬 필름 톤 (10)"),
      makeMoodTab("scene", "🍃 장르·입자 (30+)"),
    ],
  });

  const openSunlightDetailBtn = el("button", {
    class: "fmh-switcher-action",
    attrs: { type: "button", title: "맵 설정 → 태양·그림자·시야 세부 조정 열기" },
    dataset: { testid: "fmh-mood-open-sunlight" },
    text: "태양·시야 ⚙",
    on: {
      click: () => {
        const { mapId, map } = currentContext();
        setMoodOpen(false);
        if (mapId && map) openMapPropertiesDialog(mapId, map.name, { section: "sunlight" });
      },
    },
  });

  const openAtmoDetailBtn = el("button", {
    class: "fmh-switcher-action",
    attrs: { type: "button", title: "맵 설정 → 환경 효과·HD-2D 후처리 세부 슬라이더 열기" },
    dataset: { testid: "fmh-mood-open-detail" },
    text: "세부 수치 ⚙",
    on: {
      click: () => {
        const { mapId, map } = currentContext();
        setMoodOpen(false);
        if (mapId && map) openMapPropertiesDialog(mapId, map.name, { section: "atmosphere" });
      },
    },
  });

  const moodPopover = el("div", {
    class: "fmh-mood-popover",
    attrs: { role: "dialog", "aria-label": "맵 분위기 및 광원 설정" },
    dataset: { testid: "floating-mood-popover" },
    children: [
      el("div", {
        class: "fmh-mood-head",
        children: [
          el("span", { class: "fmh-mood-title", text: "☀ 분위기 · 광원" }),
          el("div", { class: "fmh-mood-head-actions", children: [previewToggleBtn, resetMoodBtn] }),
        ],
      }),
      moodTabsBar,
      moodBody,
      el("div", {
        class: "fmh-mood-foot",
        children: [
          moodSummaryText,
          el("div", { class: "fmh-mood-foot-actions", children: [openSunlightDetailBtn, openAtmoDetailBtn] }),
        ],
      }),
    ],
  });
  moodPopover.hidden = true;

  const card = el("section", {
    class: "floating-minimap-hud" + (collapsed ? " is-collapsed" : ""),
    attrs: { "aria-label": "플로팅 미니맵" },
    dataset: { testid: "floating-minimap-hud", mode: "tile" },
    children: [head, stage, foot, popover, moodPopover],
  });

  function currentContext(): { readonly project: Project; readonly mapId: MapId | null; readonly map: GameMap | undefined } {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    return { project, mapId, map: mapId ? project.maps[mapId] : undefined };
  }

  function jumpCameraToPointer(clientX: number, clientY: number): void {
    const { mapId, map } = currentContext();
    if (!mapId || !map) return;
    const bounds = stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const localX = ((clientX - bounds.left) / bounds.width) * MINIMAP_STAGE_W;
    const localY = ((clientY - bounds.top) / bounds.height) * MINIMAP_STAGE_H;
    const normX = Math.max(0, Math.min(1, (localX - currentFit.x) / Math.max(1, currentFit.w)));
    const normY = Math.max(0, Math.min(1, (localY - currentFit.y) / Math.max(1, currentFit.h)));
    const tileX = Math.max(0, Math.min(map.width - 0.01, normX * map.width));
    const tileY = Math.max(0, Math.min(map.height - 0.01, normY * map.height));
    requestEditorCameraFocus({ mapId, tileX, tileY, immediate: true });
  }

  stage.addEventListener("pointerdown", (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    try { stage.setPointerCapture(event.pointerId); } catch { /* happy-dom / unsupported */ }
    jumpCameraToPointer(event.clientX, event.clientY);
  });
  stage.addEventListener("pointermove", (event: PointerEvent) => {
    if (!dragging) return;
    event.preventDefault();
    jumpCameraToPointer(event.clientX, event.clientY);
  });
  const endDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    try {
      if (stage.hasPointerCapture?.(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    } catch { /* ignore */ }
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  function syncThumbnail(force = false): void {
    const { mapId, map } = currentContext();
    if (!mapId || !map) {
      clearChildren(thumbSlot);
      lastThumbKey = "";
      return;
    }
    const fit = computeFittedRect(map.width, map.height, MINIMAP_STAGE_W, MINIMAP_STAGE_H);
    currentFit = fit;
    const tileSig = `${map.lowerTiles.length}:${map.upperTiles.length}:${map.lowerTiles[0] ?? 0}:${map.lowerTiles[Math.floor(map.lowerTiles.length / 2)] ?? 0}`;
    const key = `${mapId}|${map.tilesetId}|${map.width}x${map.height}|${fit.w}x${fit.h}|${tileSig}`;
    if (!force && key === lastThumbKey && thumbSlot.childElementCount > 0) return;
    lastThumbKey = key;
    const thumb = createMapThumbnail(mapId, {
      width: fit.w,
      height: fit.h,
      className: "fmh-thumb-canvas",
      testId: "floating-minimap-thumb",
    });
    thumb.style.left = `${fit.x}px`;
    thumb.style.top = `${fit.y}px`;
    thumb.style.width = `${fit.w}px`;
    thumb.style.height = `${fit.h}px`;
    thumbSlot.replaceChildren(thumb);
  }

  function drawOverlay(): void {
    if (collapsed) return;
    const ctx = overlayCanvas.getContext("2d");
    if (!ctx) return;
    const scale = 2;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_STAGE_W, MINIMAP_STAGE_H);

    const { project, mapId, map } = currentContext();
    if (!mapId || !map) return;

    const state = editorState.get();
    const mode = detectMinimapMode(state);
    const fit = computeFittedRect(map.width, map.height, MINIMAP_STAGE_W, MINIMAP_STAGE_H);
    currentFit = fit;

    // 1. Subtle border around active fitted map area
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.strokeRect(fit.x + 0.5, fit.y + 0.5, Math.max(1, fit.w - 1), Math.max(1, fit.h - 1));

    const toX = (tx: number) => fit.x + (tx / Math.max(1, map.width)) * fit.w;
    const toY = (ty: number) => fit.y + (ty / Math.max(1, map.height)) * fit.h;

    // 2. Terrain mode: elevation contour tinting from map.relief.levels
    if (mode === "terrain" && map.relief?.levels?.length) {
      const levels = map.relief.levels;
      const cellW = fit.w / Math.max(1, map.width);
      const cellH = fit.h / Math.max(1, map.height);
      const step = Math.max(1, Math.floor(Math.max(map.width, map.height) / 64));
      for (let y = 0; y < map.height; y += step) {
        for (let x = 0; x < map.width; x += step) {
          const level = levels[y * map.width + x] ?? 0;
          if (level <= 0) continue;
          const alpha = Math.min(0.62, 0.16 + level * 0.11);
          ctx.fillStyle = level >= 3 ? `rgba(251, 191, 36, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
          ctx.fillRect(fit.x + x * cellW, fit.y + y * cellH, Math.max(1.5, cellW * step), Math.max(1.5, cellH * step));
        }
      }
    }

    // 3. Unit / Event / Portal markers
    const dotRadius = mode === "unit" ? 2.6 : 1.9;
    const dotAlpha = mode === "unit" ? 0.98 : 0.72;
    ctx.save();
    ctx.globalAlpha = dotAlpha;
    for (const ev of map.events) {
      const cx = toX(ev.x + 0.5);
      const cy = toY(ev.y + 0.5);
      const cat = classifyEvent(ev);
      ctx.fillStyle = cat === "portal" ? "#38bdf8" : cat === "enemy" ? "#ef4444" : "#facc15";
      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      if (state.selectedEventId === ev.id) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius + 2.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Start position marker ★ (green diamond)
    if (project.startMapId === mapId && project.startPos) {
      const sx = toX(project.startPos.x + 0.5);
      const sy = toY(project.startPos.y + 0.5);
      const r = mode === "unit" ? 3.5 : 2.6;
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(sx, sy - r);
      ctx.lineTo(sx + r, sy);
      ctx.lineTo(sx, sy + r);
      ctx.lineTo(sx - r, sy);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#052e16";
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    ctx.restore();

    // 4. Live StarCraft white camera viewport rectangle
    const vp = getEditorCameraViewport();
    if (vp && vp.mapWidthPx > 0 && vp.mapHeightPx > 0) {
      const rx = fit.x + (vp.viewX / vp.mapWidthPx) * fit.w;
      const ry = fit.y + (vp.viewY / vp.mapHeightPx) * fit.h;
      const rw = (vp.viewWidthPx / vp.mapWidthPx) * fit.w;
      const rh = (vp.viewHeightPx / vp.mapHeightPx) * fit.h;
      const clippedX = Math.max(fit.x, Math.min(fit.x + fit.w - 4, rx));
      const clippedY = Math.max(fit.y, Math.min(fit.y + fit.h - 4, ry));
      const clippedW = Math.max(6, Math.min(fit.x + fit.w - clippedX, rx + rw - clippedX));
      const clippedH = Math.max(6, Math.min(fit.y + fit.h - clippedY, ry + rh - clippedY));
      ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
      ctx.lineWidth = 2.6;
      ctx.strokeRect(clippedX, clippedY, clippedW, clippedH);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(clippedX, clippedY, clippedW, clippedH);
    }
  }

  function renderSwitcherList(): void {
    if (!switcherOpen) return;
    const { project, mapId: currentId } = currentContext();
    const query = searchQuery.trim().toLowerCase();
    clearChildren(switcherList);

    const graph = collectMapLinkGraph(project);
    const currentNode = currentId ? graph.find((node) => node.mapId === currentId) : undefined;
    const linkedIds = new Map<MapId, "both" | "out" | "in">();
    if (currentNode) {
      const inSet = new Set(currentNode.incoming.map((e) => e.from));
      for (const edge of currentNode.outgoing) {
        if (edge.to === currentId) continue;
        linkedIds.set(edge.to, inSet.has(edge.to) ? "both" : "out");
      }
      for (const edge of currentNode.incoming) {
        if (edge.from === currentId || linkedIds.has(edge.from)) continue;
        linkedIds.set(edge.from, "in");
      }
    }

    const makeRow = (id: MapId, depth: number, linkDir?: "both" | "out" | "in"): HTMLElement | null => {
      const map = project.maps[id];
      if (!map) return null;
      const label = map.name?.trim() || id;
      if (query && !label.toLowerCase().includes(query) && !id.toLowerCase().includes(query)) return null;
      const thumb = createMapThumbnail(id, {
        width: 28,
        height: 20,
        className: "fmh-switcher-thumb",
        testId: `fmh-switch-thumb-${id}`,
      });
      const badges: HTMLElement[] = [];
      if (linkDir) {
        badges.push(el("span", {
          class: "fmh-switcher-badge is-link",
          text: linkDir === "both" ? "↔ 연결" : linkDir === "out" ? "→ 이동" : "← 진입",
        }));
      }
      if (project.startMapId === id) {
        badges.push(el("span", { class: "fmh-switcher-badge is-start", text: "시작" }));
      }
      const row = el("button", {
        class: "fmh-switcher-row" + (id === currentId ? " is-active" : ""),
        attrs: { type: "button" },
        dataset: { testid: `floating-map-row-${id}`, mapId: id },
        children: [
          thumb,
          el("span", { class: "fmh-switcher-name", text: label }),
          ...badges,
          el("span", { class: "fmh-switcher-dim", text: `${map.width}×${map.height}` }),
        ],
        on: {
          click: () => {
            selectEditorMap(id);
            setSwitcherOpen(false);
          },
        },
      });
      if (depth > 0 && !query) row.style.paddingLeft = `${8 + Math.min(depth, 4) * 12}px`;
      return row;
    };

    if (!query && linkedIds.size > 0) {
      const linkedRows: HTMLElement[] = [];
      for (const [id, dir] of linkedIds.entries()) {
        const row = makeRow(id, 0, dir);
        if (row) linkedRows.push(row);
      }
      if (linkedRows.length > 0) {
        switcherList.append(el("div", { class: "fmh-switcher-group", text: "연결된 맵" }), ...linkedRows);
      }
    }

    const flat: { readonly node: MapTreeNode; readonly depth: number }[] = [];
    flattenTree(project.mapTree, 0, flat);
    const seen = new Set<MapId>();
    const allRows: HTMLElement[] = [];
    for (const { node, depth } of flat) {
      if (isMapTreeFolder(node)) {
        if (!query) {
          allRows.push(el("div", {
            class: "fmh-switcher-folder",
            text: `▸ ${mapTreeNodeLabel(node, project.maps)}`,
          }));
        }
        continue;
      }
      if (seen.has(node.mapId)) continue;
      seen.add(node.mapId);
      const row = makeRow(node.mapId, depth);
      if (row) allRows.push(row);
    }
    for (const id of Object.keys(project.maps)) {
      if (seen.has(id)) continue;
      const row = makeRow(id, 0);
      if (row) allRows.push(row);
    }

    if (allRows.length > 0) {
      if (!query && linkedIds.size > 0) {
        switcherList.append(el("div", { class: "fmh-switcher-group", text: "전체 맵" }));
      }
      switcherList.append(...allRows);
    } else {
      switcherList.append(el("div", { class: "fmh-switcher-empty", text: "일치하는 맵이 없습니다." }));
    }
  }

  function renderMoodPopover(): void {
    if (!moodOpen) return;
    const { mapId, map } = currentContext();
    clearChildren(moodBody);

    const previewOn = isEditorMoodPreviewEnabled();
    previewToggleBtn.classList.toggle("is-active", previewOn);
    previewToggleBtn.setAttribute("aria-pressed", String(previewOn));

    for (const [id, btn] of moodTabButtons.entries()) {
      const selected = id === activeMoodTab;
      btn.classList.toggle("is-active", selected);
      btn.setAttribute("aria-selected", String(selected));
    }

    moodSummaryText.textContent = summarizeActiveMood(map);

    if (!mapId || !map) {
      moodBody.append(el("div", { class: "fmh-switcher-empty", text: "선택된 맵이 없습니다." }));
      return;
    }

    if (activeMoodTab === "combo") {
      const activeCombo = detectActiveCombo(map);
      moodBody.append(el("div", { class: "fmh-mood-section-label", text: "원클릭 시네마틱 콤보 (색감 + 그림자 + 입자 + 날씨)" }));
      const comboGrid = el("div", { class: "fmh-mood-grid" });
      for (const meta of COMBO_CARD_META) {
        const spec = CINEMATIC_COMBO_PRESETS[meta.id];
        const isCurrent = activeCombo === meta.id;
        comboGrid.append(el("button", {
          class: "fmh-mood-card" + (isCurrent ? " is-active" : ""),
          attrs: { type: "button", title: spec.summary, "aria-pressed": String(isCurrent) },
          dataset: { testid: `fmh-combo-${meta.id}` },
          children: [
            el("div", {
              class: "fmh-mood-card-top",
              children: [
                el("span", { class: "fmh-mood-card-icon", attrs: { "aria-hidden": "true" }, text: meta.icon }),
                el("span", { class: "fmh-mood-card-title", text: meta.shortLabel }),
              ],
            }),
            el("span", { class: "fmh-mood-card-sub", text: meta.badge }),
          ],
          on: {
            click: () => {
              if (isCurrent) applyCinematicCombo(mapId, "classic-clean");
              else applyCinematicCombo(mapId, meta.id);
            },
          },
        }));
      }
      moodBody.append(comboGrid);

      // Quick Direct Lighting / Shadow / Fog Toggles
      moodBody.append(el("div", { class: "fmh-mood-section-label", text: "광원 · 그림자 · 시야 스위치" }));
      const sunEnabled = Boolean(map.sunlight?.enabled);
      const sunAlt = map.sunlight?.altitude ?? 45;
      const isDaySun = sunEnabled && sunAlt > 38;
      const isDuskSun = sunEnabled && sunAlt <= 38;
      const isCloudOn = Boolean(map.cloudShadows?.enabled);
      const isVisionOn = Boolean(map.terrainDesign?.gameplay?.visionBlocking);

      const quickGrid = el("div", { class: "fmh-mood-quick-grid" });
      quickGrid.append(
        el("button", {
          class: "fmh-mood-toggle" + (isDaySun ? " is-active" : ""),
          attrs: { type: "button", "aria-pressed": String(isDaySun), title: "맑은 한낮 방향의 짧은 지형·나무 그림자" },
          dataset: { testid: "fmh-quick-sun-day" },
          text: "☀ 한낮 그림자",
          on: {
            click: () => {
              if (isDaySun) setMapSunlight(mapId, null);
              else setMapSunlight(mapId, { enabled: true, azimuth: 315, altitude: 62, opacity: 0.30, softness: 1, heightScale: 0.7 });
            },
          },
        }),
        el("button", {
          class: "fmh-mood-toggle" + (isDuskSun ? " is-active" : ""),
          attrs: { type: "button", "aria-pressed": String(isDuskSun), title: "석양 방향으로 길게 드리우는 드라마틱 그림자" },
          dataset: { testid: "fmh-quick-sun-dusk" },
          text: "🌇 노을 긴그림자",
          on: {
            click: () => {
              if (isDuskSun) setMapSunlight(mapId, null);
              else setMapSunlight(mapId, { enabled: true, azimuth: 262, altitude: 22, opacity: 0.42, softness: 2, heightScale: 0.85 });
            },
          },
        }),
        el("button", {
          class: "fmh-mood-toggle" + (isCloudOn ? " is-active" : ""),
          attrs: { type: "button", "aria-pressed": String(isCloudOn), title: "지표면 위로 흘러가는 구름 그림자" },
          dataset: { testid: "fmh-quick-clouds" },
          text: "☁ 구름 그림자",
          on: {
            click: () => {
              if (isCloudOn) setMapCloudShadows(mapId, null);
              else setMapCloudShadows(mapId, { enabled: true, amount: 4, opacity: 0.28, speed: 1 });
            },
          },
        }),
        el("button", {
          class: "fmh-mood-toggle" + (isVisionOn ? " is-active" : ""),
          attrs: { type: "button", "aria-pressed": String(isVisionOn), title: "플레이 시 벽·절벽·숲 뒤편 시야를 가리는 전장의 안개" },
          dataset: { testid: "fmh-quick-vision" },
          text: "🌫 전장의 안개",
          on: {
            click: () => setMapVisionBlocking(mapId, !isVisionOn),
          },
        }),
      );
      moodBody.append(quickGrid);
      return;
    }

    if (activeMoodTab === "postfx") {
      const currentPreset: PostFxPresetId = map.postFx?.preset ?? "none";
      moodBody.append(el("div", { class: "fmh-mood-section-label", text: "HD-2D 카메라 필름 후처리 (10종 LUT · 비네트 · 햇살)" }));
      const grid = el("div", { class: "fmh-mood-grid" });
      for (const item of POSTFX_CARD_ORDER) {
        const spec = POST_FX_PRESETS[item.id];
        const isCurrent = currentPreset === item.id;
        grid.append(el("button", {
          class: "fmh-mood-card" + (isCurrent ? " is-active" : ""),
          attrs: { type: "button", title: spec.summary, "aria-pressed": String(isCurrent) },
          dataset: { testid: `fmh-postfx-${item.id}` },
          children: [
            el("div", {
              class: "fmh-mood-card-top",
              children: [
                el("span", { class: "fmh-mood-card-icon", attrs: { "aria-hidden": "true" }, text: item.icon }),
                el("span", { class: "fmh-mood-card-title", text: item.shortLabel }),
              ],
            }),
            el("span", { class: "fmh-mood-card-sub", text: spec.summary }),
          ],
          on: {
            click: () => {
              if (item.id === "none" || isCurrent) setMapPostFx(mapId, null);
              else setMapPostFx(mapId, { preset: item.id });
            },
          },
        }));
      }
      moodBody.append(grid);
      return;
    }

    // activeMoodTab === "scene"
    moodBody.append(el("div", { class: "fmh-mood-section-label", text: "장르별 공간 분위기 프리셋 (6장르 · 30종)" }));
    const genreBar = el("div", { class: "fmh-genre-pills" });
    for (const genre of ATMOSPHERE_GENRES) {
      const selected = genre === activeGenre;
      genreBar.append(el("button", {
        class: "fmh-genre-pill" + (selected ? " is-active" : ""),
        attrs: { type: "button", "aria-pressed": String(selected) },
        dataset: { testid: `fmh-genre-${genre}` },
        text: genre,
        on: {
          click: () => {
            activeGenre = genre;
            renderMoodPopover();
          },
        },
      }));
    }
    moodBody.append(genreBar);

    const scenes = ATMOSPHERE_SCENES.filter((s) => s.genre === activeGenre);
    const sceneList = el("div", { class: "fmh-scene-list" });
    for (const scene of scenes) {
      const isCurrent = matchesAtmosphereScene(map, scene);
      sceneList.append(el("button", {
        class: "fmh-scene-row" + (isCurrent ? " is-active" : ""),
        attrs: { type: "button", "aria-pressed": String(isCurrent), title: scene.description },
        dataset: { testid: `fmh-scene-${scene.id}` },
        children: [
          el("span", { class: "fmh-scene-name", text: scene.label }),
          el("span", { class: "fmh-scene-desc", text: scene.description.split(" / ")[0] ?? scene.description }),
        ],
        on: {
          click: () => {
            if (isCurrent) setMapAtmosphereEffects(mapId, []);
            else setMapAtmosphereEffects(mapId, scene.effects);
          },
        },
      }));
    }
    moodBody.append(sceneList);

    // Individual 19 Particle Multi-Toggles
    const currentEffects = normalizeAtmosphereEffects(map.atmosphereEffects);
    const activeKinds = new Set<AtmosphereKind>(currentEffects.map((e) => e.kind));
    moodBody.append(el("div", { class: "fmh-mood-section-label", text: "개별 입자 · 광선 조합 (중복 선택)" }));
    const particleWrap = el("div", { class: "fmh-particle-chips" });
    for (const preset of ATMOSPHERE_PRESETS) {
      const isOn = activeKinds.has(preset.id);
      const shortLabel = preset.label.split(" ·")[0] ?? preset.label;
      particleWrap.append(el("button", {
        class: "fmh-particle-chip" + (isOn ? " is-active" : ""),
        attrs: { type: "button", "aria-pressed": String(isOn), title: `${preset.group} · ${preset.label}` },
        dataset: { testid: `fmh-particle-${preset.id}` },
        text: shortLabel,
        on: {
          click: () => {
            const latestMap = store.getCurrent().maps[mapId];
            const list = normalizeAtmosphereEffects(latestMap?.atmosphereEffects);
            const next = list.some((e) => e.kind === preset.id)
              ? list.filter((e) => e.kind !== preset.id)
              : [...list, { kind: preset.id, amount: 0.6, speed: 1, size: 1, opacity: 0.75 }];
            setMapAtmosphereEffects(mapId, next);
          },
        },
      }));
    }
    moodBody.append(particleWrap);
  }

  function syncChrome(): void {
    const { map } = currentContext();
    const state = editorState.get();
    const mode = detectMinimapMode(state);
    const meta = minimapModeMeta(mode);
    card.dataset.mode = mode;
    mapNameLabel.textContent = map?.name?.trim() || map?.id || "맵 없음";
    modeText.textContent = meta.label;
    modeBtn.title = meta.title;
    const zoomPct = Math.round((state.zoom || 1) * 100);
    metaText.textContent = map ? `${map.width}×${map.height} · ${zoomPct}%` : "";
    const hasMood = mapHasActiveMood(map);
    moodBtn.classList.toggle("has-mood", hasMood);
    moodBtn.classList.toggle("is-active", moodOpen);
  }

  function setCollapsed(next: boolean): void {
    if (collapsed === next) return;
    collapsed = next;
    card.classList.toggle("is-collapsed", collapsed);
    collapseBtn.textContent = collapsed ? "+" : "−";
    collapseBtn.setAttribute("aria-expanded", String(!collapsed));
    try { localStorage.setItem(MINIMAP_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch { /* ignore */ }
    if (!collapsed) {
      syncThumbnail();
      drawOverlay();
    }
  }

  function setSwitcherOpen(next: boolean): void {
    if (switcherOpen === next) return;
    if (next && moodOpen) setMoodOpen(false);
    switcherOpen = next;
    popover.hidden = !switcherOpen;
    mapNameBtn.setAttribute("aria-expanded", String(switcherOpen));
    if (switcherOpen) {
      searchQuery = "";
      searchInput.value = "";
      renderSwitcherList();
      queueMicrotask(() => searchInput.focus());
    }
  }

  function setMoodOpen(next: boolean): void {
    if (moodOpen === next) return;
    if (next && switcherOpen) setSwitcherOpen(false);
    moodOpen = next;
    moodPopover.hidden = !moodOpen;
    moodBtn.setAttribute("aria-expanded", String(moodOpen));
    moodBtn.classList.toggle("is-active", moodOpen);
    if (moodOpen) {
      renderMoodPopover();
    }
  }

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderSwitcherList();
  });
  searchInput.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSwitcherOpen(false);
      mapNameBtn.focus();
    } else if (event.key === "Enter") {
      const first = switcherList.querySelector<HTMLButtonElement>(".fmh-switcher-row");
      if (first) {
        event.preventDefault();
        first.click();
      }
    }
  });

  const onDocPointerDown = (event: PointerEvent): void => {
    if (!switcherOpen && !moodOpen) return;
    const target = event.target;
    if (target instanceof Node && !card.contains(target)) {
      setSwitcherOpen(false);
      setMoodOpen(false);
    }
  };
  const onDocKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    if (switcherOpen) setSwitcherOpen(false);
    if (moodOpen) setMoodOpen(false);
  };
  const onToggleEvent = (): void => setCollapsed(!collapsed);
  const onSwitcherEvent = (): void => setSwitcherOpen(true);
  const onMoodEvent = (): void => setMoodOpen(!moodOpen);

  document.addEventListener("pointerdown", onDocPointerDown, true);
  document.addEventListener("keydown", onDocKeyDown);
  window.addEventListener(FLOATING_MINIMAP_TOGGLE_EVENT, onToggleEvent);
  window.addEventListener(FLOATING_MAP_SWITCHER_OPEN_EVENT, onSwitcherEvent);
  window.addEventListener(FLOATING_MOOD_POPOVER_OPEN_EVENT, onMoodEvent);

  const unsubViewport = subscribeEditorCameraViewport(() => drawOverlay());
  const unsubMoodPreview = subscribeEditorMoodPreview(() => {
    if (moodOpen) renderMoodPopover();
  });
  const unsubEditor = editorState.subscribe(() => {
    syncChrome();
    if (!collapsed) {
      syncThumbnail();
      drawOverlay();
    }
    if (switcherOpen) renderSwitcherList();
    if (moodOpen) renderMoodPopover();
  });
  const unsubStore = store.subscribe((_project, change) => {
    syncChrome();
    if (moodOpen) renderMoodPopover();
    if (isTileCellChange(change)) {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        settleTimer = null;
        if (!collapsed) {
          syncThumbnail(true);
          drawOverlay();
        }
      }, THUMB_SETTLE_MS);
      return;
    }
    if (!collapsed) {
      syncThumbnail(true);
      drawOverlay();
    }
    if (switcherOpen) renderSwitcherList();
  });

  canvasArea.append(card);
  syncChrome();
  if (!collapsed) {
    syncThumbnail(true);
    drawOverlay();
  }

  return () => {
    if (settleTimer !== null) clearTimeout(settleTimer);
    unsubViewport();
    unsubMoodPreview();
    unsubEditor();
    unsubStore();
    document.removeEventListener("pointerdown", onDocPointerDown, true);
    document.removeEventListener("keydown", onDocKeyDown);
    window.removeEventListener(FLOATING_MINIMAP_TOGGLE_EVENT, onToggleEvent);
    window.removeEventListener(FLOATING_MAP_SWITCHER_OPEN_EVENT, onSwitcherEvent);
    window.removeEventListener(FLOATING_MOOD_POPOVER_OPEN_EVENT, onMoodEvent);
    card.remove();
  };
}
