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
  resetMapMood,
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
import { createMapThumbnail, mapThumbnailKey } from "@/editor/panels/mapThumbnail";
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
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { normalizeMapClimate } from "@/project/mapClimate";
import { collectMapLinkGraph } from "@/project/mapLinkStats";
import { isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import {
  CINEMATIC_COMBO_PRESETS,
  isComboOwnedLighting,
  POST_FX_PRESETS,
  type CinematicComboId,
  type PostFxPresetId,
} from "@/project/postFx";
import { isTileCellChange, store } from "@/project/store";
import type { Command, GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import type { MapSunlight } from "@/project/sunlight";
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

/** ☀ 빠른 스위치의 두 태양 — 켜짐 표시는 이 값과 같을 때만이다(직접 맞춘 태양을 「한낮」으로 오인해 지우지 않게). */
const QUICK_SUN_DAY: Partial<MapSunlight> = { enabled: true, azimuth: 315, altitude: 62, opacity: 0.30, softness: 1, heightScale: 0.7 };
const QUICK_SUN_DUSK: Partial<MapSunlight> = { enabled: true, azimuth: 262, altitude: 22, opacity: 0.42, softness: 2, heightScale: 0.85 };

/**
 * 이름으로 적을 짐작한다. 「적」 한 글자는 낱말일 때만 — 예전 /적/ 은 「목적지」「흔적」「기적」을 빨간 점으로 칠했다.
 */
const ENEMY_NAME_PATTERN = /(?:^|[\s_\-·(\[])적(?:$|[\s_\-·)\]\d])|적군|적병|몬스터|보스|산적|슬라임|마물|enemy|boss|monster/iu;

function sunMatches(sun: Partial<MapSunlight> | undefined, preset: Partial<MapSunlight>): boolean {
  return Boolean(sun?.enabled) && sun?.azimuth === preset.azimuth && sun?.altitude === preset.altitude;
}

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
      // selectMapModeTool 이 이벤트 레이어를 바닥으로 이미 바꾼다 — 두 번 set 하면 다시 그리기만 두 번 돈다.
      next: () => selectMapModeTool("relief"),
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
  // 하한을 크게 잡으면(예전 12px) 썸네일은 비율을 지켜 다시 레터박스를 넣고 오버레이는 늘어난 칸에 점을 찍어 어긋났다.
  const w = Math.max(2, Math.round(safeW * scale));
  const h = Math.max(2, Math.round(safeH * scale));
  return {
    x: Math.floor((boxW - w) / 2),
    y: Math.floor((boxH - h) / 2),
    w,
    h,
  };
}

function commandsContain(commands: readonly Command[] | undefined, kinds: ReadonlySet<Command["kind"]>): boolean {
  if (!commands) return false;
  for (const cmd of commands) {
    if (kinds.has(cmd.kind)) return true;
    for (const branch of nestedCommandLists(cmd)) {
      if (commandsContain(branch, kinds)) return true;
    }
  }
  return false;
}

const PORTAL_KINDS: ReadonlySet<Command["kind"]> = new Set<Command["kind"]>(["transfer"]);
const ENEMY_KINDS: ReadonlySet<Command["kind"]> = new Set<Command["kind"]>(["battleProcessing", "tacticsBattle"]);

/** 이벤트 객체는 바뀔 때 새 객체가 된다 — 같은 객체면 분류도 같다. 팬 중 매 프레임 명령 트리를 다시 훑지 않게. */
const eventCategoryCache = new WeakMap<GameEvent, EventCategory>();

export function classifyMinimapEvent(event: GameEvent): EventCategory {
  const cached = eventCategoryCache.get(event);
  if (cached) return cached;
  // 쪽(pages)과 바깥 명령을 둘 다 본다 — 둘 중 한쪽만 보면 쪽이 있는 이벤트의 바깥 이동을 놓친다.
  const lists = [event.commands, ...(event.pages ?? []).map((page) => page.commands)];
  let category: EventCategory = "npc";
  if (lists.some((commands) => commandsContain(commands, PORTAL_KINDS))) category = "portal";
  else if (lists.some((commands) => commandsContain(commands, ENEMY_KINDS))) category = "enemy";
  else if (ENEMY_NAME_PATTERN.test(event.name ?? "")) category = "enemy";
  eventCategoryCache.set(event, category);
  return category;
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
    // 태양·조명도 맞아야 그 콤보다 — 우연히 후처리·입자만 같은 맵을 「켜짐」으로 보여 끄기 한 번에 날리지 않게.
    if (combo.sunlight === null && map.sunlight?.enabled) continue;
    if (combo.sunlight && !sunMatches(map.sunlight, combo.sunlight)) continue;
    if (combo.lighting && (map.defaultLighting?.ambient !== combo.lighting.ambient || map.defaultLighting?.color !== combo.lighting.color)) continue;
    if (combo.lighting === null && isComboOwnedLighting(map.defaultLighting)) continue;
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
  let lastThumbMapId: MapId | null = null;
  let overlayFrame: number | null = null;
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
    // slider 역할은 aria-valuenow 가 필수인데 2차원 위치라 값이 없다 — 화살표로 움직이는 application 으로 둔다.
    attrs: {
      role: "application",
      tabindex: "0",
      "aria-roledescription": "미니맵",
      "aria-label": "미니맵 — 클릭하거나 끌어 카메라 이동, 화살표 키로 화면 이동",
    },
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
        const names = new Set(Object.values(project.maps).map((m) => m.name));
        let count = Object.keys(project.maps).length + 1;
        while (names.has(`새 맵 ${count}`)) count += 1;
        const id = addMap(`새 맵 ${count}`, curMap?.width ?? 24, curMap?.height ?? 18, curMap?.tilesetId);
        // 크기 상한 등으로 만들지 못하면 빈 id 가 온다 — 팝오버를 닫아 「됐다」고 보이지 않게 둔다.
        if (!id) return;
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
    attrs: { type: "button", title: "후처리·그림자·환경 입자·콤보 조명·시야 차단을 원본으로 되돌립니다 (직접 둔 광원·실내 기후는 남깁니다)" },
    dataset: { testid: "fmh-mood-reset" },
    text: "초기화",
    on: {
      click: () => {
        const { mapId } = currentContext();
        if (!mapId) return;
        resetMapMood(mapId);
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
          renderMoodPopover(true);
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
  stage.addEventListener("lostpointercapture", () => { dragging = false; });
  stage.addEventListener("keydown", (event: KeyboardEvent) => {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!step) return;
    const { mapId, map } = currentContext();
    const vp = getEditorCameraViewport();
    if (!mapId || !map || !vp || vp.mapWidthPx <= 0 || vp.mapHeightPx <= 0) return;
    if (vp.mapId && vp.mapId !== mapId) return;
    event.preventDefault();
    event.stopPropagation();
    const tilePxX = vp.mapWidthPx / Math.max(1, map.width);
    const tilePxY = vp.mapHeightPx / Math.max(1, map.height);
    // 화면 폭의 1/4 씩. 큰 맵에서도 몇 번이면 끝까지 간다.
    const centerX = (vp.viewX + vp.viewWidthPx / 2) / tilePxX + step[0]! * Math.max(1, vp.viewWidthPx / tilePxX / 4);
    const centerY = (vp.viewY + vp.viewHeightPx / 2) / tilePxY + step[1]! * Math.max(1, vp.viewHeightPx / tilePxY / 4);
    requestEditorCameraFocus({
      mapId,
      tileX: Math.max(0, Math.min(map.width - 0.01, centerX)),
      tileY: Math.max(0, Math.min(map.height - 0.01, centerY)),
      immediate: true,
    });
  });

  function syncThumbnail(force = false): void {
    const { mapId, map } = currentContext();
    if (!mapId || !map) {
      clearChildren(thumbSlot);
      lastThumbKey = "";
      lastThumbMapId = null;
      return;
    }
    const fit = computeFittedRect(map.width, map.height, MINIMAP_STAGE_W, MINIMAP_STAGE_H);
    currentFit = fit;
    // 썸네일 모듈의 내용 해시 키를 그대로 쓴다. 예전 자체 키는 타일 두 칸만 봐서, 접은 채 고친 뒤 펴면 옛 그림이 남았다.
    // 같은 키면 그림이 같으므로 이벤트 이동·분위기 토글처럼 타일이 아닌 변경은 캔버스를 갈지 않는다.
    const key = `${mapThumbnailKey(mapId, map, fit.w, fit.h)}|${fit.x},${fit.y}`;
    if (!force && key === lastThumbKey && thumbSlot.childElementCount > 0) return;
    const previous = lastThumbMapId === mapId ? thumbSlot.querySelector("canvas") : null;
    lastThumbKey = key;
    lastThumbMapId = mapId;
    const thumb = createMapThumbnail(mapId, {
      width: fit.w,
      height: fit.h,
      className: "fmh-thumb-canvas",
      testId: "floating-minimap-thumb",
      // 같은 맵을 다시 그릴 때는 렌더가 끝날 때까지 이전 그림을 둔다(편집마다 대체 무늬가 번쩍이지 않게).
      seedFrom: previous,
    });
    thumb.style.left = `${fit.x}px`;
    thumb.style.top = `${fit.y}px`;
    thumb.style.width = `${fit.w}px`;
    thumb.style.height = `${fit.h}px`;
    thumbSlot.replaceChildren(thumb);
  }

  /** 뷰포트 게시는 팬 중 매 프레임 온다 — 한 프레임에 한 번만 그린다. */
  function scheduleOverlay(): void {
    if (collapsed || overlayFrame !== null) return;
    if (typeof requestAnimationFrame !== "function") {
      drawOverlay();
      return;
    }
    overlayFrame = requestAnimationFrame(() => {
      overlayFrame = null;
      drawOverlay();
    });
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
      // 높이 격자는 자기 너비를 갖는다 — 맵 너비로 줄을 나누면 크기가 어긋난 격자에서 칸이 비뚤어진다.
      const reliefW = map.relief.width > 0 ? map.relief.width : map.width;
      const reliefH = map.relief.height > 0 ? map.relief.height : map.height;
      const cellW = fit.w / Math.max(1, map.width);
      const cellH = fit.h / Math.max(1, map.height);
      const step = Math.max(1, Math.floor(Math.max(map.width, map.height) / 64));
      for (let y = 0; y < map.height; y += step) {
        for (let x = 0; x < map.width; x += step) {
          if (x >= reliefW || y >= reliefH) continue;
          const level = levels[y * reliefW + x] ?? 0;
          if (level <= 0) continue;
          const alpha = Math.min(0.62, 0.16 + level * 0.11);
          ctx.fillStyle = level >= 3 ? `rgba(251, 191, 36, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
          const cw = Math.min(Math.max(1.5, cellW * step), fit.x + fit.w - (fit.x + x * cellW));
          const ch = Math.min(Math.max(1.5, cellH * step), fit.y + fit.h - (fit.y + y * cellH));
          ctx.fillRect(fit.x + x * cellW, fit.y + y * cellH, cw, ch);
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
      const cat = classifyMinimapEvent(ev);
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
    // 맵 전환 직후에는 새 맵의 기하가 아직 안 왔다 — 옛 맵의 px 를 새 맵에 대입하지 않는다.
    if (vp && vp.mapWidthPx > 0 && vp.mapHeightPx > 0 && (!vp.mapId || vp.mapId === mapId)) {
      const rx = fit.x + (vp.viewX / vp.mapWidthPx) * fit.w;
      const ry = fit.y + (vp.viewY / vp.mapHeightPx) * fit.h;
      const rw = (vp.viewWidthPx / vp.mapWidthPx) * fit.w;
      const rh = (vp.viewHeightPx / vp.mapHeightPx) * fit.h;
      // 맵과 겹치는 부분만 그린다. 화면이 맵 밖(검사 여백)에 있으면 가짜 상자를 만들지 않는다.
      const left = Math.max(fit.x, rx);
      const top = Math.max(fit.y, ry);
      const right = Math.min(fit.x + fit.w, rx + rw);
      const bottom = Math.min(fit.y + fit.h, ry + rh);
      if (right > left && bottom > top) {
        const minSide = 4;
        const w = Math.max(minSide, right - left);
        const h = Math.max(minSide, bottom - top);
        const x = Math.max(fit.x, Math.min(fit.x + fit.w - w, left));
        const y = Math.max(fit.y, Math.min(fit.y + fit.h - h, top));
        ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
        ctx.lineWidth = 2.6;
        ctx.strokeRect(x, y, w, h);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x, y, w, h);
      }
    }
  }

  /**
   * 목록을 다시 지어도 스크롤·키보드 포커스를 잃지 않게 한다. 예전엔 입자 칩 하나를 누를 때마다
   * 본문이 비워졌다 채워져 맨 위로 튀고 포커스가 body 로 빠졌다.
   */
  function rebuildKeepingPlace(container: HTMLElement, rebuild: () => void, resetScroll = false): void {
    const scrollTop = resetScroll ? 0 : container.scrollTop;
    const active = document.activeElement;
    const focusedId = active instanceof HTMLElement && container.contains(active) ? active.dataset.testid : undefined;
    rebuild();
    container.scrollTop = scrollTop;
    if (focusedId) {
      const again = Array.from(container.querySelectorAll<HTMLElement>("[data-testid]")).find((node) => node.dataset.testid === focusedId);
      again?.focus({ preventScroll: true });
    }
  }

  function renderSwitcherList(resetScroll = false): void {
    if (!switcherOpen) return;
    rebuildKeepingPlace(switcherList, buildSwitcherList, resetScroll);
  }

  function buildSwitcherList(): void {
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
      // 맵 트리 행과 같은 크기(40×30)로 주문해 캐시를 함께 쓴다 — 28×20 따로 주문하면 맵마다 한 번씩 더 렌더했다.
      const thumb = createMapThumbnail(id, {
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

  function renderMoodPopover(resetScroll = false): void {
    if (!moodOpen) return;
    rebuildKeepingPlace(moodBody, buildMoodPopover, resetScroll);
  }

  function buildMoodPopover(): void {
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
              // 끄기는 이 콤보가 켠 것만 걷는다 — 따로 켠 구름 그림자는 남긴다.
              if (isCurrent) applyCinematicCombo(mapId, "classic-clean", { preserveCloudShadows: true });
              else applyCinematicCombo(mapId, meta.id);
            },
          },
        }));
      }
      moodBody.append(comboGrid);

      // Quick Direct Lighting / Shadow / Fog Toggles
      moodBody.append(el("div", { class: "fmh-mood-section-label", text: "광원 · 그림자 · 시야 스위치" }));
      const isDaySun = sunMatches(map.sunlight, QUICK_SUN_DAY);
      const isDuskSun = sunMatches(map.sunlight, QUICK_SUN_DUSK);
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
              else setMapSunlight(mapId, QUICK_SUN_DAY);
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
              else setMapSunlight(mapId, QUICK_SUN_DUSK);
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
            renderMoodPopover(true);
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
    if (collapsed) {
      if (overlayFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(overlayFrame);
      overlayFrame = null;
    } else {
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
      renderSwitcherList(true);
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
      renderMoodPopover(true);
    }
  }

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderSwitcherList(true);
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

  const unsubViewport = subscribeEditorCameraViewport(() => scheduleOverlay());
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
          syncThumbnail();
          drawOverlay();
        }
      }, THUMB_SETTLE_MS);
      return;
    }
    if (!collapsed) {
      // 키가 같으면(타일 그림이 그대로면) 캔버스를 갈지 않는다.
      syncThumbnail();
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
    if (overlayFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(overlayFrame);
    overlayFrame = null;
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
