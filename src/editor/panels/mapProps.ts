import {
  resizeMap, renameMap, setMapEncounterRate, setMapEncounterTable, setMapFieldSpawns, setMapTileset,
  setMapTroopIds, setStartMap, setStartPos, setMapBackground, setMapBgm, setMapBattleBackground, setMapFlags, setMapMinimap,
  setMapCloudShadows,
} from "@/editor/actions";
import { appendGroupedTilesetOptions } from "@/editor/tilesetSelectOptions";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { MAP_BACKGROUND_SCROLL_LIMIT, normalizeMapBackgroundScroll } from "@/project/mapBackground";
import { openDatabaseResourcePickerDialog, listDatabaseResourceOptions, type DatabaseResourcePickerKind } from "@/editor/panels/databaseResourcePickerDialog";
import { editorState } from "@/editor/editorState";
import { DEFAULT_ENEMY_FACTION_ID, factionName, resolveFactionTable } from "@/project/factions";
import { SEASONS, TIME_PHASES, type Season, type TimePhase } from "@/project/gameTime";
import { store } from "@/project/store";
import { mapLocations } from "@/project/mapNamedLocations";
import { renderLocationDrawCta } from "@/editor/locationDrawCta";
import {
  CLOUD_SHADOW_OPACITY_RANGE,
  CLOUD_SHADOW_SCALE_RANGE,
  CLOUD_SHADOW_SPEED_RANGE,
  CLOUD_SHADOW_AMOUNT_RANGE,
  normalizeCloudShadowParams,
} from "@/player/cloudShadows";
import type { EncounterTableEntry, FieldSpawnDef, MapBgmSetting } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { showConfirm } from "@/editor/ui/modal";
import { toast } from "@/util/toast";

type MapPropsTab = "general" | "background" | "clouds" | "bgm" | "battle" | "restrictions" | "encounter" | "spawns" | "minimap";

const TAB_LABELS: Record<MapPropsTab, string> = {
  general: "기본 설정",
  background: "맵 배경",
  clouds: "구름 그림자",
  bgm: "배경 음악",
  battle: "전투 배경",
  restrictions: "행동 제한",
  encounter: "랜덤 전투",
  spawns: "필드 스폰",
  minimap: "미니맵",
};

const SECTION_ORDER: readonly MapPropsTab[] = [
  "general", "background", "clouds", "bgm", "battle", "restrictions", "encounter", "spawns", "minimap",
];

const SECTION_DESCRIPTIONS: Record<MapPropsTab, string> = {
  general: "맵의 이름, 타일 그림판과 크기를 설정합니다.",
  background: "투명한 타일 뒤에 표시할 그림과 움직임을 설정합니다.",
  clouds: "맵 위를 흘러가는 구름 그림자를 설정합니다.",
  bgm: "이 맵에 들어왔을 때 재생할 음악을 고릅니다.",
  battle: "이 맵에서 전투가 시작되면 표시할 배경입니다.",
  restrictions: "체크한 행동을 이 맵에서 제한합니다.",
  encounter: "걸어 다닐 때 만나는 적 그룹과 출현 조건을 설정합니다.",
  spawns: "맵 위에 배치된 적의 소속 진영을 설정합니다.",
  minimap: "플레이 화면에 표시할 작은 지도를 설정합니다.",
};

const SECTION_RENDERERS: Record<MapPropsTab, (host: HTMLElement, map: import("@/project/types").GameMap) => void> = {
  general: renderGeneralTab, background: renderBackgroundTab, clouds: renderCloudShadowTab, bgm: renderBgmTab,
  battle: renderBattleTab, restrictions: renderRestrictionsTab, encounter: renderEncounterTab,
  spawns: renderSpawnsTab, minimap: renderMinimapTab,
};
const lastChangedControl = new WeakMap<HTMLElement, string>();

/** Current navigation location, reset when opening a map settings window. */
let currentSection: MapPropsTab | null = null;

export function resetMapPropsTabForTests(): void {
  // 단일 화면 전환 뒤에는 탭 상태가 없다 — 구 테스트의 호출 자리와 맞추기 위한 no-op.
  // 바로가기 표시 상태만 초기화한다.
  currentSection = null;
}

/** 창을 새로 열 때 바로가기 표시를 비운다 — rerender 유지용 상태가 재오픈까지 남으면
 *  스크롤은 맨 위인데 하이라이트만 이전 섹션이라 어긋나 보인다. */
export function resetMapPropsSectionForOpen(): void {
  currentSection = null;
}

export function renderMapProps(container: HTMLElement): void {
  clearChildren(container);
  const state = editorState.get();
  const mapId = state.currentMapId ?? store.getCurrent().startMapId;
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    container.append(el("div", { class: "empty-hint", text: "맵을 선택하세요." }));
    return;
  }

  const wrapper = el("div", { class: "map-props-dialog" });

  // 섹션 바로가기 줄 — 구 탭 버튼과 같은 testid 를 유지하므로 기존 테스트·e2e 가 그대로 통한다.
  // 클릭은 다시 그리지 않고 해당 섹션으로 스크롤만 한다(입력 포커스·스크롤 위치 보존).
  // 내비는 독립 열이라 스크롤해도 자리에 남는다(본문 스크롤러는 .map-props-body).
  const nav = el("nav", {
    class: "map-props-tabs",
    attrs: { "aria-label": "맵 설정 섹션 바로가기" },
    dataset: { testid: "map-props-tabs" },
  });
  const navButtons = new Map<MapPropsTab, HTMLElement>();
  for (const tab of SECTION_ORDER) {
    const sectionId = `map-props-section-${tab}`;
    const btn = el("button", {
      class: "map-props-tab",
      text: TAB_LABELS[tab],
      attrs: currentSection === tab
        ? { type: "button", "aria-controls": sectionId, "aria-current": "location" }
        : { type: "button", "aria-controls": sectionId },
      dataset: { testid: `map-props-tab-${tab}` },
      on: {
        click: () => {
          currentSection = tab;
          for (const [key, other] of navButtons) {
            if (key === tab) other.setAttribute("aria-current", "location");
            else other.removeAttribute("aria-current");
          }
          const target = wrapper.querySelector<HTMLElement>(`[data-testid="${sectionId}"]`);
          if (!target) return;
          body.scrollTop += target.getBoundingClientRect().top - body.getBoundingClientRect().top - 20;
          target.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
        },
      },
    });
    navButtons.set(tab, btn);
    nav.append(btn);
  }
  wrapper.append(nav);

  // One scroll surface; navigation remains reachable at every section.
  const body = el("div", { class: "map-props-body is-single-view" });
  for (const tab of SECTION_ORDER) {
    const block = el("section", {
      class: "map-props-section-block",
      attrs: { id: `map-props-section-${tab}`, "aria-labelledby": `map-props-heading-${tab}` },
      dataset: { testid: `map-props-section-${tab}`, section: tab, mapId },
    });
    block.addEventListener("change", (event) => {
      const id = (event.target as HTMLElement).dataset?.testid;
      if (id) lastChangedControl.set(block, id);
    }, true);
    renderSection(block, tab, map);
    body.append(block);
  }
  body.addEventListener("scroll", () => {
    const top = body.getBoundingClientRect().top + 24;
    let active: MapPropsTab = "general";
    for (const tab of SECTION_ORDER) {
      const section = body.querySelector<HTMLElement>(`#map-props-section-${tab}`);
      if (section && section.getBoundingClientRect().top <= top) active = tab;
    }
    if (body.scrollTop + body.clientHeight >= body.scrollHeight - 2) active = "minimap";
    currentSection = active;
    for (const [key, button] of navButtons) {
      if (key === active) button.setAttribute("aria-current", "location");
      else button.removeAttribute("aria-current");
    }
  });
  if (currentSection === null) navButtons.get("general")?.setAttribute("aria-current", "location");
  wrapper.append(body);
  const footer = el("p", {
    class: "map-props-save-hint",
    text: "설정은 변경 즉시 반영됩니다. 크기와 JSON 편집은 적용 버튼을 눌러 주세요.",
  });
  wrapper.append(footer);
  container.append(wrapper);
}

function renderSection(host: HTMLElement, tab: MapPropsTab, map: import("@/project/types").GameMap): void {
  clearChildren(host);
  host.append(el("h2", {
    class: "map-props-section-title", text: TAB_LABELS[tab],
    attrs: { id: `map-props-heading-${tab}`, tabindex: "-1" },
  }), el("p", { class: "map-props-hint", text: SECTION_DESCRIPTIONS[tab] }));
  SECTION_RENDERERS[tab](host, map);
}

// ── 일반 탭 ──
function renderGeneralTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });

  // 이름
  section.append(fieldRow("이름", el("input", {
    attrs: { type: "text", placeholder: "맵 이름" },
    value: map.name,
    dataset: { testid: "map-name-input" },
    on: { change: (e: Event) => {
      renameMap(map.id, (e.target as HTMLInputElement).value);
      const subtitle = host.closest(".event-subdialog-window")?.querySelector(".event-subdialog-header p");
      if (subtitle) subtitle.textContent = store.getCurrent().maps[map.id]?.name ?? map.name;
    } },
  })));

  // 타일 그림판
  const tilesetSelect = el("select", {
    attrs: { "aria-label": `${map.name} 타일 그림판` },
    dataset: { testid: "map-props-tileset-select" },
    on: {
      change: (e: Event) => {
        setMapTileset(map.id, (e.target as HTMLSelectElement).value);
      },
    },
  }) as HTMLSelectElement;
  appendGroupedTilesetOptions(tilesetSelect, Object.values(store.getCurrent().tilesets));
  tilesetSelect.value = map.tilesetId;
  section.append(fieldRow("타일 그림판", tilesetSelect));

  // 크기
  const wInput = el("input", {
    attrs: { type: "number", min: "4", max: "128", "aria-label": "가로 (칸)" },
    value: String(map.width),
    dataset: { testid: "map-width-input" },
  });
  const hInput = el("input", {
    attrs: { type: "number", min: "4", max: "128", "aria-label": "세로 (칸)" },
    value: String(map.height),
    dataset: { testid: "map-height-input" },
  });
  const sizeLine = el("div", { class: "map-props-size-row" });
  sizeLine.append(wInput, el("span", { text: "×" }), hInput);
  sizeLine.append(el("button", {
    class: "btn btn-sm",
    text: "크기 적용",
    dataset: { testid: "map-resize-apply" },
    on: {
      click: async () => {
        const w = Number(wInput.value);
        const h = Number(hInput.value);
        if (![w, h].every((value) => Number.isInteger(value) && value >= 4 && value <= 128)) {
          toast("가로와 세로는 4~128칸 사이의 정수로 입력하세요.", "error");
          return;
        }
        const fresh = store.getCurrent().maps[map.id];
        if (!fresh || (fresh.width === w && fresh.height === h)) return;
        if ((w < fresh.width || h < fresh.height) && !await showConfirm({
          title: "맵 크기 줄이기",
          message: `${fresh.width} × ${fresh.height} → ${w} × ${h}칸으로 줄입니다. 범위 밖 타일은 삭제되고 이벤트와 시작 위치는 안쪽으로 이동합니다.`,
          confirmLabel: "크기 줄이기", danger: true,
        })) return;
        resizeMap(map.id, w, h);
        const resized = store.getCurrent().maps[map.id];
        if (resized?.width !== w || resized.height !== h) return;
        toast(`맵 크기를 ${w} × ${h}칸으로 변경했습니다.`, "ok");
      },
    },
  }));
  section.append(fieldRow("크기 (가로 × 세로)", sizeLine));

  section.append(el("p", { class: "map-props-hint", text: "가로·세로 각각 4~128칸. 크기를 줄이면 범위 밖 타일이 삭제됩니다." }));

  // 시작 위치
  const selection = editorState.get().selection;
  const canSetStart = selection?.mapId === map.id;
  section.append(el("p", { class: "map-props-hint", text: canSetStart
    ? `선택한 칸: (${selection.x}, ${selection.y}) — 이 맵을 게임 시작 맵으로 지정합니다.`
    : "시작 위치를 바꾸려면 창을 닫고 맵에서 칸을 먼저 선택하세요." }));
  section.append(el("button", {
    class: "btn",
    text: "선택 칸을 시작 위치로",
    attrs: { type: "button", ...(canSetStart ? {} : { disabled: "" }) },
    dataset: { testid: "map-start-pos-button" },
    on: {
      click: () => {
        const selection = editorState.get().selection;
        if (!selection || selection.mapId !== map.id) {
          toast("먼저 맵에서 칸을 선택하세요.", "error");
          return;
        }
        setStartMap(map.id);
        setStartPos(selection.x, selection.y);
        toast(`시작 위치: (${selection.x}, ${selection.y})`, "ok");
      },
    },
  }));

  host.append(section);
}

// ── 배경 탭 (RM2003 Background) ──
function renderBackgroundTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  const bg = map.background;

  const enabled = Boolean(bg);
  const enableCheck = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "map-bg-enable" },
  }) as HTMLInputElement;
  enableCheck.checked = enabled;
  enableCheck.addEventListener("change", () => {
    if (enableCheck.checked) {
      setMapBackground(map.id, { imageId: "", scrollX: 0, scrollY: 0 });
    } else {
      setMapBackground(map.id, null);
    }
    rerender(host);
  });
  const enableRow = el("label", { class: "map-props-check-row" });
  enableRow.append(enableCheck, el("span", { text: "맵 배경 사용" }));
  section.append(enableRow);

  if (bg) {
    section.append(mapResourceField({
      label: "배경 그림", resourceId: bg.imageId, kind: "backdrop", testid: "map-bg-image",
      dialogTitle: "맵 배경 그림", allowClear: true,
      onChange: ({ resourceId }) => setMapBackground(map.id, {
        ...store.getCurrent().maps[map.id]!.background!, imageId: resourceId,
      }),
      rerender: () => rerender(host, "map-bg-image-set"),
    }));

    // 캔버스는 배경을 그리지 않는다(빈 칸 체커가 의도된 신호라 덮지 않는다 — 편집기 라우팅 문서).
    // 그래서 고른 그림을 확인할 자리는 여기 하나뿐이다.
    const previewUrl = resolveAssetResourceUrl(bg.imageId, { project: store.getCurrent() });
    if (previewUrl) {
      section.append(el("img", {
        class: "map-bg-preview",
        attrs: { src: previewUrl, alt: "맵 배경 미리보기", loading: "lazy" },
        dataset: { testid: "map-bg-preview" },
      }));
    }

    const scrollLine = el("div", { class: "map-props-size-row" });
    const sxInput = el("input", {
      attrs: { type: "number", min: String(-MAP_BACKGROUND_SCROLL_LIMIT), max: String(MAP_BACKGROUND_SCROLL_LIMIT), step: "0.5", "aria-label": "가로 스크롤 속도" },
      value: String(bg.scrollX ?? 0),
      dataset: { testid: "map-bg-scroll-x" },
    });
    const syInput = el("input", {
      attrs: { type: "number", min: String(-MAP_BACKGROUND_SCROLL_LIMIT), max: String(MAP_BACKGROUND_SCROLL_LIMIT), step: "0.5", "aria-label": "세로 스크롤 속도" },
      value: String(bg.scrollY ?? 0),
      dataset: { testid: "map-bg-scroll-y" },
    });
    scrollLine.append(el("span", { text: "X" }), sxInput, el("span", { text: "Y" }), syInput);
    // 범위 밖 입력은 **조용히 클램프**한다 — 타이틀 배경 레이어(`databaseSystemView`)와 같은 규칙이고,
    // 상한은 로드 정규화·AI 툴 스키마와 같은 상수(`@/project/mapBackground`)를 본다.
    const updateScroll = (key: "scrollX" | "scrollY", input: HTMLInputElement): void => {
      const value = Number(input.value);
      const normalized = normalizeMapBackgroundScroll(value);
      if (normalized === undefined) {
        input.value = String(store.getCurrent().maps[map.id]!.background?.[key] ?? 0);
        return;
      }
      setMapBackground(map.id, { ...store.getCurrent().maps[map.id]!.background!, [key]: normalized });
      if (normalized !== value) input.value = String(normalized);
    };
    sxInput.addEventListener("change", () => updateScroll("scrollX", sxInput));
    syInput.addEventListener("change", () => updateScroll("scrollY", syInput));
    section.append(fieldRow("스크롤 속도", scrollLine));

    // 반복은 기본값이라 «끈 것» 만 저장한다(normalize 와 같은 규칙 — 옛 JSON 바이트 유지).
    const loopRow = el("div", { class: "map-props-check-row" });
    const loopBox = (key: "loopX" | "loopY", label: string): HTMLElement => {
      const box = el("input", {
        attrs: { type: "checkbox" },
        dataset: { testid: `map-bg-loop-${key === "loopX" ? "x" : "y"}` },
      }) as HTMLInputElement;
      box.checked = bg[key] !== false;
      box.addEventListener("change", () => {
        const next = { ...store.getCurrent().maps[map.id]!.background! };
        if (box.checked) delete next[key];
        else next[key] = false;
        setMapBackground(map.id, next);
      });
      const wrapper = el("label", { class: "map-props-check-row" });
      wrapper.append(box, el("span", { text: label }));
      return wrapper;
    };
    loopRow.append(loopBox("loopX", "가로 반복"), loopBox("loopY", "세로 반복"));
    section.append(loopRow);
  }

  host.append(section);
}

// ── BGM 탭 (RM2003 BGM) ──
function renderBgmTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  const bgm = map.bgm;
  const mode = bgm?.mode ?? "parent";

  const modeSelect = el("select", {
    dataset: { testid: "map-bgm-mode" },
    on: {
      change: (e: Event) => {
        const val = (e.target as HTMLSelectElement).value as MapBgmSetting["mode"];
        if (val === "parent") setMapBgm(map.id, null);
        else setMapBgm(map.id, { mode: val, resourceId: bgm?.resourceId });
        rerender(host);
      },
    },
  }) as HTMLSelectElement;
  for (const [val, label] of [["parent", "상위 맵/기본 BGM"], ["none", "무음"], ["custom", "지정 곡"]] as const) {
    modeSelect.append(el("option", { text: label, attrs: { value: val } }));
  }
  modeSelect.value = mode;
  section.append(fieldRow("BGM 모드", modeSelect));

  if (mode === "custom") {
    // Shared catalog dialog provides search and audio preview.
    const rerenderBgm = (): void => {
      rerender(host, "map-bgm-resource-set");
    };
    section.append(mapResourceField({
      label: "BGM",
      resourceId: bgm?.resourceId,
      kind: "music",
      testid: "map-bgm-resource",
      dialogTitle: "맵 BGM",
      allowClear: true,
      onChange: (result) => {
        setMapBgm(map.id, { mode: "custom", resourceId: result.resourceId, fadeInMs: store.getCurrent().maps[map.id]?.bgm?.fadeInMs });
      },
      rerender: rerenderBgm,
    }));
    section.append(fieldRow("페이드인 (ms)", el("input", {
      attrs: { type: "number", min: "0", max: "10000", step: "100" },
      value: String(bgm?.fadeInMs ?? 0),
      dataset: { testid: "map-bgm-fadein" },
      on: {
        change: (e: Event) => {
          setMapBgm(map.id, { mode: "custom", resourceId: store.getCurrent().maps[map.id]?.bgm?.resourceId, fadeInMs: parseInt((e.target as HTMLInputElement).value, 10) || 0 });
        },
      },
    })));
  }

  host.append(section);
}

// ── 전투 탭 ──
function renderBattleTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  section.append(mapResourceField({
    label: "전투 배경", resourceId: map.battleBackground, kind: "backdrop", testid: "map-battle-bg",
    dialogTitle: "전투 배경", allowClear: true,
    onChange: ({ resourceId }) => setMapBattleBackground(map.id, resourceId || null),
    rerender: () => rerender(host, "map-battle-bg-set"),
  }));
  section.append(el("p", { class: "map-props-hint", text: "비워두면 타일셋 기본 전투 배경을 사용합니다." }));
  host.append(section);
}

// ── 제한 탭 (RM2003 Save/Teleport/Escape) ──
function renderRestrictionsTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });

  const makeCheck = (label: string, testid: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement => {
    const check = el("input", {
      attrs: { type: "checkbox" },
      dataset: { testid },
    }) as HTMLInputElement;
    check.checked = checked;
    check.addEventListener("change", () => onChange(check.checked));
    const row = el("label", { class: "map-props-check-row" });
    row.append(check, el("span", { text: label }));
    return row;
  };

  section.append(makeCheck("저장 금지", "map-disable-save", Boolean(map.disableSave), (v) => {
    setMapFlags(map.id, { disableSave: v, disableTeleport: store.getCurrent().maps[map.id]?.disableTeleport, disableEscape: store.getCurrent().maps[map.id]?.disableEscape });
  }));
  section.append(makeCheck("순간 이동 금지", "map-disable-teleport", Boolean(map.disableTeleport), (v) => {
    setMapFlags(map.id, { disableSave: store.getCurrent().maps[map.id]?.disableSave, disableTeleport: v, disableEscape: store.getCurrent().maps[map.id]?.disableEscape });
  }));
  section.append(makeCheck("도주 금지", "map-disable-escape", Boolean(map.disableEscape), (v) => {
    setMapFlags(map.id, { disableSave: store.getCurrent().maps[map.id]?.disableSave, disableTeleport: store.getCurrent().maps[map.id]?.disableTeleport, disableEscape: v });
  }));

  host.append(section);
}

// ── 인카운터 탭 ──
const TIME_PHASE_LABELS: Record<TimePhase, string> = {
  morning: "아침", day: "낮", evening: "저녁", night: "밤",
};
const SEASON_LABELS: Record<Season, string> = {
  spring: "봄", summer: "여름", fall: "가을", winter: "겨울",
};

function renderEncounterTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const project = store.getCurrent();
  const troops = project.database.troops;
  const table = map.encounterTable ?? [];
  const rate = map.encounterRate ?? 0;

  // ── 인카운트율 ──
  const rateSection = el("div", { class: "panel-section map-props-section" });
  const rateNumber = el("input", {
    attrs: { type: "number", min: "0", max: "100", step: "1", "aria-label": "출현 빈도" },
    value: String(rate),
    dataset: { testid: "map-encounter-rate-input" },
  }) as HTMLInputElement;
  const rateSlider = el("input", {
    class: "map-encounter-slider",
    attrs: { type: "range", min: "0", max: "100", step: "1", "aria-label": "출현 빈도" },
    value: String(rate),
    dataset: { testid: "map-encounter-rate-slider" },
  }) as HTMLInputElement;
  const rateHint = el("p", { class: "map-props-hint" });
  const describeRate = (value: number): string => {
    if (value <= 0) return "0 — 랜덤 인카운터가 발생하지 않습니다.";
    const steps = Math.max(1, Math.round(1000 / value));
    return `${value} — 평균 약 ${steps}걸음마다 한 번 조우 (걸을 때마다 ${value}/1000씩 누적).`;
  };
  rateHint.textContent = describeRate(rate);
  const applyRate = (value: number): void => {
    const clamped = Math.max(0, Math.min(100, Math.trunc(value)));
    rateNumber.value = String(clamped);
    rateSlider.value = String(clamped);
    rateHint.textContent = describeRate(clamped);
    setMapEncounterRate(map.id, clamped);
  };
  rateSlider.addEventListener("input", () => applyRate(parseInt(rateSlider.value, 10) || 0));
  rateNumber.addEventListener("change", () => applyRate(parseInt(rateNumber.value, 10) || 0));

  const rateRow = el("div", { class: "map-encounter-rate-row" });
  rateRow.append(rateSlider, rateNumber);
  rateSection.append(fieldRow("출현 빈도", rateRow));
  rateSection.append(rateHint);
  host.append(rateSection);

  if (troops.length === 0) {
    host.append(el("p", { class: "map-props-hint", text: "데이터베이스에 트룹(적 그룹)이 없습니다. 먼저 트룹을 만들어 주세요." }));
    return;
  }

  // ── 기본 트룹 (encounterTable 없을 때) ──
  const troopSection = el("div", { class: "panel-section map-props-section" });
  troopSection.append(el("label", { class: "map-encounter-heading", text: "기본 출현 그룹" }));
  const selected = new Set(map.troopIds ?? []);
  const troopList = el("div", { class: "map-encounter-troop-list", dataset: { testid: "map-encounter-troops" } });
  for (const troop of troops) {
    const check = el("input", {
      attrs: { type: "checkbox" },
      dataset: { testid: `map-encounter-troop-${troop.id}` },
    }) as HTMLInputElement;
    check.checked = selected.has(troop.id);
    check.addEventListener("change", () => {
      if (check.checked) selected.add(troop.id);
      else selected.delete(troop.id);
      setMapTroopIds(map.id, troops.filter((t) => selected.has(t.id)).map((t) => t.id));
    });
    const row = el("label", { class: "map-props-check-row" });
    row.append(check, el("span", { text: troop.name || troop.id }));
    troopList.append(row);
  }
  troopSection.append(troopList);
  troopSection.append(el("p", {
    class: "map-props-hint",
    text: table.length > 0
      ? "아래 인카운터 테이블이 비어 있지 않으므로, 지금은 테이블이 우선 적용됩니다."
      : "체크한 그룹이 균등 확률로 출현합니다. 확률·조건을 나누려면 아래 테이블을 사용하세요.",
  }));
  host.append(troopSection);

  // ── 인카운터 테이블 ──
  const tableSection = el("div", { class: "panel-section map-props-section" });
  const heading = el("div", { class: "map-encounter-table-head" });
  heading.append(el("label", { class: "map-encounter-heading", text: "출현 규칙 (가중치·조건)" }));
  heading.append(el("button", {
    class: "btn btn-sm",
    text: "+ 행 추가",
    attrs: { type: "button" },
    dataset: { testid: "map-encounter-row-add" },
    on: {
      click: () => {
        const next: EncounterTableEntry[] = [...table, { troopId: troops[0]!.id, weight: 1 }];
        commitTable(map.id, next, host);
      },
    },
  }));
  tableSection.append(heading);

  if (table.length === 0) {
    tableSection.append(el("p", { class: "map-props-hint", text: "행이 없습니다. 위의 기본 출현 그룹이 사용됩니다." }));
  } else {
    const totalWeight = table.reduce((sum, entry) => sum + (entry.weight > 0 ? entry.weight : 0), 0);
    for (const [index, entry] of table.entries()) {
      tableSection.append(encounterRow(map, table, index, entry, totalWeight, troops, host));
    }
  }

  // JSON 탈출구 — 대량 편집·복붙용
  const advanced = el("details", { class: "map-encounter-advanced" });
  advanced.append(el("summary", { text: "JSON으로 직접 편집" }));
  advanced.append(jsonArrayField(
    "인카운터 테이블",
    "map-encounter-table-input",
    table,
    (entries) => { setMapEncounterTable(map.id, entries as EncounterTableEntry[]); rerender(host); },
  ));
  tableSection.append(advanced);
  host.append(tableSection);
}

function commitTable(mapId: string, entries: EncounterTableEntry[], host: HTMLElement): void {
  setMapEncounterTable(mapId, entries);
  rerender(host);
}

// Refresh only the changed section: unrelated size/JSON drafts and focus stay intact.
function rerender(host: HTMLElement, preferredFocusId?: string): void {
  const tab = host.dataset.section as MapPropsTab;
  const map = store.getCurrent().maps[host.dataset.mapId ?? ""];
  const dialog = host.closest(".map-props-dialog");
  const scroller = dialog?.querySelector(".map-props-body");
  if (!map || !scroller || !SECTION_RENDERERS[tab]) return;
  const scrollTop = scroller.scrollTop;
  const active = typeof document !== "undefined" ? document.activeElement as HTMLElement | null : null;
  const focusId = preferredFocusId ?? active?.dataset?.customSelectFor ?? active?.dataset?.testid ?? lastChangedControl.get(host);
  const drafts = Array.from(host.querySelectorAll("textarea"))
    .filter((input) => input.value !== input.defaultValue)
    .map((input) => ({ id: input.dataset.testid, value: input.value }));
  const detailsKey = (details: HTMLDetailsElement): string =>
    details.querySelector<HTMLElement>("summary")?.dataset.testid ?? details.className;
  const openDetails = new Map(Array.from(host.querySelectorAll("details"))
    .map((details) => [detailsKey(details), details.open]));
  renderSection(host, tab, map);
  Array.from(host.querySelectorAll("details")).forEach((details) => {
    const wasOpen = openDetails.get(detailsKey(details));
    if (wasOpen !== undefined) details.open = wasOpen;
  });
  for (const input of Array.from(host.querySelectorAll("textarea"))) {
    const draft = drafts.find((item) => item.id === input.dataset.testid);
    if (draft) input.value = draft.value;
  }
  scroller.scrollTop = scrollTop;
  // Custom selects are enhanced by the subdialog's MutationObserver after rendering.
  queueMicrotask(() => {
    if (!host.isConnected) return;
    const controls = Array.from(host.querySelectorAll<HTMLElement>("[data-testid], [data-custom-select-for]"));
    const target = controls.find((node) => focusId && node.dataset.customSelectFor === focusId)
      ?? controls.find((node) => focusId && node.dataset.testid === focusId)
      ?? host.querySelector<HTMLElement>("h2");
    target?.focus?.({ preventScroll: true });
    scroller.scrollTop = scrollTop;
  });
}

function encounterRow(
  map: import("@/project/types").GameMap,
  table: readonly EncounterTableEntry[],
  index: number,
  entry: EncounterTableEntry,
  totalWeight: number,
  troops: readonly import("@/project/types").TroopRecord[],
  host: HTMLElement
): HTMLElement {
  const project = store.getCurrent();
  const update = (patch: Partial<EncounterTableEntry>): void => {
    const next = table.map((item, i) => (i === index ? { ...item, ...patch } : item));
    commitTable(map.id, next as EncounterTableEntry[], host);
  };
  const patchConditions = (patch: Partial<NonNullable<EncounterTableEntry["conditions"]>>): void => {
    const merged = { ...(entry.conditions ?? {}), ...patch };
    for (const [key, value] of Object.entries(merged)) {
      if (value === undefined || value === "") delete (merged as Record<string, unknown>)[key];
    }
    const next = table.map((item, i) => (
      i === index
        ? (Object.keys(merged).length > 0 ? { ...item, conditions: merged } : stripConditions(item))
        : item
    ));
    commitTable(map.id, next as EncounterTableEntry[], host);
  };

  const row = el("div", { class: "map-encounter-row", dataset: { testid: `map-encounter-row-${index}` } });

  // 1행: 트룹 / 가중치 / 확률 / 삭제
  const main = el("div", { class: "map-encounter-row-main" });
  const troopSelect = el("select", {
    attrs: { "aria-label": "트룹" },
    dataset: { testid: `map-encounter-troop-select-${index}` },
    on: { change: (e: Event) => update({ troopId: (e.target as HTMLSelectElement).value }) },
  }) as HTMLSelectElement;
  for (const troop of troops) {
    troopSelect.append(el("option", { text: troop.name || troop.id, attrs: { value: troop.id } }));
  }
  if (!troops.some((t) => t.id === entry.troopId)) {
    troopSelect.append(el("option", { text: `${entry.troopId} (없는 트룹)`, attrs: { value: entry.troopId } }));
  }
  troopSelect.value = entry.troopId;

  const weightInput = el("input", {
    class: "map-encounter-weight",
    attrs: { type: "number", min: "1", max: "999", step: "1", "aria-label": "가중치" },
    value: String(entry.weight),
    dataset: { testid: `map-encounter-weight-${index}` },
    on: {
      change: (e: Event) => {
        const raw = parseInt((e.target as HTMLInputElement).value, 10);
        update({ weight: Math.max(1, Math.min(999, Number.isFinite(raw) ? raw : 1)) });
      },
    },
  });

  const percent = totalWeight > 0 && entry.weight > 0 ? Math.round((entry.weight / totalWeight) * 1000) / 10 : 0;
  const share = el("span", { class: "map-encounter-share", text: `${percent}%` });

  const remove = el("button", {
    class: "btn btn-sm map-encounter-remove",
    text: "삭제",
    attrs: { type: "button", title: "이 행 삭제" },
    dataset: { testid: `map-encounter-remove-${index}` },
    on: { click: () => commitTable(map.id, table.filter((_, i) => i !== index) as EncounterTableEntry[], host) },
  });

  main.append(troopSelect, weightInput, share, remove);
  row.append(main);

  // 2행: 조건 (접힘)
  const conditions = entry.conditions;
  const activeCount = conditions ? Object.keys(conditions).length : 0;
  const details = el("details", { class: "map-encounter-conditions" });
  if (activeCount > 0) details.setAttribute("open", "");
  details.append(el("summary", {
    text: activeCount > 0 ? `조건 ${activeCount}개` : "조건 없음 (항상 출현)",
    dataset: { testid: `map-encounter-conditions-${index}` },
  }));

  const grid = el("div", { class: "map-encounter-cond-grid" });

  // 스위치
  const switchSelect = selectField("스위치 ON", `map-encounter-switch-${index}`, [
    { value: "", label: "— 없음 —" },
    ...project.switches.map((sw) => ({ value: sw.id, label: `${sw.id} ${sw.name}` })),
  ], conditions?.switchId ?? "", (value) => patchConditions({ switchId: value || undefined }));
  grid.append(switchSelect);

  // 변수 ≥
  const variableSelect = selectField("변수", `map-encounter-variable-${index}`, [
    { value: "", label: "— 없음 —" },
    ...project.variables.map((v) => ({ value: v.id, label: `${v.id} ${v.name}` })),
  ], conditions?.variableId ?? "", (value) => patchConditions({ variableId: value || undefined }));
  grid.append(variableSelect);
  grid.append(numberField("변수 값 ≥", `map-encounter-atleast-${index}`, conditions?.atLeast, (value) => patchConditions({ atLeast: value })));

  // 파티 레벨
  grid.append(numberField("파티 레벨 ≥", `map-encounter-minlevel-${index}`, conditions?.minPartyLevel, (value) => patchConditions({ minPartyLevel: value })));
  grid.append(numberField("파티 레벨 ≤", `map-encounter-maxlevel-${index}`, conditions?.maxPartyLevel, (value) => patchConditions({ maxPartyLevel: value })));

  // 시간대 / 계절
  grid.append(selectField("시간대", `map-encounter-timephase-${index}`, [
    { value: "", label: "— 항상 —" },
    ...TIME_PHASES.map((phase) => ({ value: phase, label: TIME_PHASE_LABELS[phase] })),
  ], conditions?.timePhase ?? "", (value) => patchConditions({ timePhase: (value || undefined) as TimePhase | undefined })));
  grid.append(selectField("계절", `map-encounter-season-${index}`, [
    { value: "", label: "— 항상 —" },
    ...SEASONS.map((season) => ({ value: season, label: SEASON_LABELS[season] })),
  ], conditions?.season ?? "", (value) => patchConditions({ season: (value || undefined) as Season | undefined })));

  details.append(grid);

  // 이름 붙은 구역 참조 — 사각형을 복사하지 않고 로케이션 하나를 가리킨다.
  // 로케이션을 옮기거나 넓히면 이 인카운터도 함께 따라간다(사본이 없으므로 어긋날 수 없다).
  const locations = mapLocations(map);
  const brokenLocationId =
    conditions?.locationId && !locations.some((entry) => entry.id === conditions.locationId)
      ? conditions.locationId
      : undefined;
  // 0개 맵에서도 **필드를 숨기지 않는다** — 숨기면 이 기능이 존재한다는 사실을 배울 기회 자체가
  // 사라진다(어포던스 감사 2026-09-11: 새 사용자가 «구역이 존재하는 화면» 을 볼 경로가 없었다).
  details.append(
    selectField(
      "이름 붙은 구역",
      `map-encounter-location-${index}`,
      [
        { value: "", label: "— 사용 안 함 —" },
        ...(brokenLocationId ? [{ value: brokenLocationId, label: `(삭제된 로케이션 ${brokenLocationId})` }] : []),
        ...locations.map((entry) => ({ value: entry.id, label: `${entry.name} (${entry.x},${entry.y}) ${entry.w}×${entry.h}` })),
      ],
      conditions?.locationId ?? "",
      (value) => patchConditions({ locationId: value || undefined }),
    ),
  );
  if (brokenLocationId) {
    details.append(
      el("p", {
        class: "map-encounter-location-broken",
        text: `이 인카운터가 가리키는 로케이션 '${brokenLocationId}' 이 삭제됐습니다. 다른 구역을 고르거나 「사용 안 함」으로 되돌리세요 — 지금은 이 항목이 절대 뽑히지 않습니다.`,
        dataset: { testid: `map-encounter-location-broken-${index}` },
      }),
    );
  } else if (locations.length === 0) {
    details.append(
      el("p", {
        class: "map-props-hint",
        text: "이 맵에는 아직 이름 붙은 구역이 없습니다 — 구역을 만들면 이 인카운터가 사각형을 복사하지 않고 그 구역을 가리킬 수 있습니다.",
        dataset: { testid: `map-encounter-location-empty-${index}` },
      }),
    );
    const drawCta = renderLocationDrawCta({ testId: `map-encounter-location-draw-${index}` });
    if (drawCta) details.append(drawCta);
  }

  // 구역 제한(레거시 raw 사각형). 이름 붙은 구역을 지정하면 그쪽이 이긴다.
  const region = conditions?.region;
  const regionToggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `map-encounter-region-toggle-${index}` } }) as HTMLInputElement;
  regionToggle.checked = Boolean(region);
  regionToggle.addEventListener("change", () => {
    patchConditions({ region: regionToggle.checked ? (region ?? { x: 0, y: 0, w: map.width, h: map.height }) : undefined });
  });
  const regionRow = el("label", { class: "map-props-check-row" });
  regionToggle.disabled = Boolean(conditions?.locationId);
  regionRow.append(
    regionToggle,
    el("span", {
      text: conditions?.locationId
        ? "구역 제한 (이름 붙은 구역을 쓰는 동안에는 사각형이 무시됩니다)"
        : "구역 제한 (이 사각형 안에서만 출현)",
    }),
  );
  details.append(regionRow);

  if (region) {
    const rectRow = el("div", { class: "map-encounter-rect-row" });
    const rectField = (key: "x" | "y" | "w" | "h", label: string, max: number): void => {
      const input = el("input", {
        attrs: { type: "number", min: key === "w" || key === "h" ? "1" : "0", max: String(max), "aria-label": label, id: `map-encounter-region-${key}-${index}` },
        value: String(region[key]),
        dataset: { testid: `map-encounter-region-${key}-${index}` },
        on: {
          change: (e: Event) => {
            const raw = parseInt((e.target as HTMLInputElement).value, 10);
            const value = Math.max(key === "w" || key === "h" ? 1 : 0, Math.min(max, Number.isFinite(raw) ? raw : 0));
            patchConditions({ region: { ...region, [key]: value } });
          },
        },
      });
      const cell = el("div", { class: "map-encounter-rect-cell" });
      cell.append(el("label", { text: label, attrs: { for: input.dataset.testid ?? "" } }), input);
      rectRow.append(cell);
    };
    rectField("x", "X", map.width - 1);
    rectField("y", "Y", map.height - 1);
    rectField("w", "너비", map.width);
    rectField("h", "높이", map.height);
    details.append(rectRow);
  }

  row.append(details);
  return row;
}

function stripConditions(entry: EncounterTableEntry): EncounterTableEntry {
  const { conditions: _dropped, ...rest } = entry;
  return rest;
}

function selectField(
  label: string,
  testid: string,
  options: readonly { value: string; label: string }[],
  value: string,
  onChange: (value: string) => void
): HTMLElement {
  const select = el("select", {
    attrs: { "aria-label": label, id: testid },
    dataset: { testid },
    on: { change: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
  }) as HTMLSelectElement;
  for (const option of options) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = value;
  const cell = el("div", { class: "map-encounter-cond-cell" });
  cell.append(el("label", { text: label, attrs: { for: testid } }), select);
  return cell;
}

function numberField(
  label: string,
  testid: string,
  value: number | undefined,
  onChange: (value: number | undefined) => void
): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: "0", step: "1", placeholder: "—", "aria-label": label, id: testid },
    value: value === undefined ? "" : String(value),
    dataset: { testid },
    on: {
      change: (e: Event) => {
        const raw = (e.target as HTMLInputElement).value.trim();
        if (raw === "") { onChange(undefined); return; }
        const parsed = parseInt(raw, 10);
        onChange(Number.isFinite(parsed) ? Math.max(0, parsed) : undefined);
      },
    },
  });
  const cell = el("div", { class: "map-encounter-cond-cell" });
  cell.append(el("label", { text: label, attrs: { for: input.dataset.testid ?? "" } }), input);
  return cell;
}

// ── 구름 그림자 섹션 ──
//
// 슬라이더의 범위·기본값은 런타임과 같은 순수 모델(`@/player/cloudShadows`)에서 읽는다.
// 여기서 숫자를 따로 적으면 플레이 화면의 계산과 어긋날 수 있다.
function renderCloudShadowTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  const enabled = map.cloudShadows?.enabled === true;
  const params = normalizeCloudShadowParams(map.cloudShadows);

  const enableCheck = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "map-cloud-shadows-enable" },
  }) as HTMLInputElement;
  enableCheck.checked = enabled;
  enableCheck.addEventListener("change", () => {
    if (enableCheck.checked) setMapCloudShadows(map.id, { enabled: true });
    else setMapCloudShadows(map.id, null);
    rerender(host);
  });
  const enableRow = el("label", { class: "map-props-check-row" });
  enableRow.append(enableCheck, el("span", { text: "이 맵에 구름 그림자" }));
  section.append(enableRow);
  section.append(el("p", {
    class: "map-props-hint",
    text: enabled
      ? "하늘 구름이 만드는 그늘이 맵 위를 흘러갑니다. 실제 모습은 플레이 화면에서 확인하세요."
      : "체크하면 이 맵 위로 구름 그림자가 흘러갑니다.",
  }));

  if (enabled) {
    appendSliderRow(section, {
      label: "구름량",
      testid: "map-cloud-shadows-amount",
      min: CLOUD_SHADOW_AMOUNT_RANGE.min,
      max: CLOUD_SHADOW_AMOUNT_RANGE.max,
      step: 1,
      value: params.amount,
      normalize: (value) => clampSlider(value, CLOUD_SHADOW_AMOUNT_RANGE.min, CLOUD_SHADOW_AMOUNT_RANGE.max),
      describe: (value) => value === 0 ? "0 — 구름 없음" : `${value}단계 — 1은 적게, 3은 보통, 6은 많이. 크기와 진하기는 유지됩니다.`,
      apply: (value) => setMapCloudShadows(map.id, { amount: value }),
    });
    const opacityPercent = { min: Math.round(CLOUD_SHADOW_OPACITY_RANGE.min * 100), max: Math.round(CLOUD_SHADOW_OPACITY_RANGE.max * 100) };
    const scalePercent = { min: Math.round(CLOUD_SHADOW_SCALE_RANGE.min * 100), max: Math.round(CLOUD_SHADOW_SCALE_RANGE.max * 100) };
    appendSliderRow(section, {
      label: "그림자 진하기 (%)",
      testid: "map-cloud-shadows-opacity",
      min: opacityPercent.min,
      max: opacityPercent.max,
      step: 1,
      value: Math.round(params.opacity * 100),
      normalize: (value) => clampSlider(value, opacityPercent.min, opacityPercent.max),
      describe: (value) => `${value}% — 높을수록 그늘이 짙습니다.`,
      apply: (value) => setMapCloudShadows(map.id, { opacity: value / 100 }),
    });
    appendSliderRow(section, {
      label: "흘러가는 속도 (px/초)",
      testid: "map-cloud-shadows-speed",
      min: CLOUD_SHADOW_SPEED_RANGE.min,
      max: CLOUD_SHADOW_SPEED_RANGE.max,
      step: 1,
      value: Math.round(params.speed),
      normalize: (value) => clampSlider(value, CLOUD_SHADOW_SPEED_RANGE.min, CLOUD_SHADOW_SPEED_RANGE.max),
      describe: (value) => value <= 0 ? "0 — 제자리에 머물러 있습니다." : `${value}px/초 — 클수록 빨리 지나갑니다.`,
      apply: (value) => setMapCloudShadows(map.id, { speed: value }),
    });
    appendSliderRow(section, {
      label: "흘러가는 방향 (도)",
      testid: "map-cloud-shadows-angle",
      min: 0,
      max: 359,
      step: 1,
      value: Math.round(params.angleDeg),
      normalize: (value) => wrapDegrees(value, params.angleDeg),
      describe: (value) => `${value}° — 0°는 오른쪽, 90°는 아래쪽으로 흐릅니다.`,
      apply: (value) => setMapCloudShadows(map.id, { angleDeg: value }),
    });
    appendSliderRow(section, {
      label: "구름 크기 (%)",
      testid: "map-cloud-shadows-scale",
      min: scalePercent.min,
      max: scalePercent.max,
      step: 5,
      value: Math.round(params.scale * 100),
      normalize: (value) => clampSlider(value, scalePercent.min, scalePercent.max),
      describe: (value) => `${value}% — 클수록 덩어리가 크고 드문드문 지나갑니다.`,
      apply: (value) => setMapCloudShadows(map.id, { scale: value / 100 }),
    });
  }

  host.append(section);
}

type SliderRowOptions = {
  readonly label: string;
  readonly testid: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly normalize: (value: number) => number;
  readonly describe: (value: number) => string;
  readonly apply: (value: number) => void;
};

/** 슬라이더 + 숫자 입력 한 줄. 둘은 같은 값을 쓰고, 힌트 문장이 그 값을 사람 말로 다시 말한다. */
function appendSliderRow(host: HTMLElement, options: SliderRowOptions): void {
  const bounds = {
    min: String(options.min),
    max: String(options.max),
    step: String(options.step),
    "aria-label": options.label,
  };
  const slider = el("input", {
    class: "map-encounter-slider",
    attrs: { type: "range", ...bounds },
    value: String(options.value),
    dataset: { testid: options.testid },
  }) as HTMLInputElement;
  const number = el("input", {
    attrs: { type: "number", ...bounds },
    value: String(options.value),
    dataset: { testid: `${options.testid}-number` },
  }) as HTMLInputElement;
  const hint = el("p", { class: "map-props-hint", text: options.describe(options.value) });
  const commit = (raw: number): void => {
    const value = options.normalize(raw);
    slider.value = String(value);
    number.value = String(value);
    hint.textContent = options.describe(value);
    options.apply(value);
  };
  slider.addEventListener("input", () => commit(Number.parseInt(slider.value, 10)));
  number.addEventListener("change", () => commit(Number.parseInt(number.value, 10)));
  const row = el("div", { class: "map-encounter-rate-row" });
  row.append(slider, number);
  host.append(fieldRow(options.label, row));
  host.append(hint);
}

function clampSlider(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

/** 각도는 «같은 방향» 을 여러 바퀴 표현할 수 있다 — 400° 는 40° 로 접어 저장한다. */
function wrapDegrees(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return Math.round(fallback);
  return ((Math.round(value) % 360) + 360) % 360;
}

// ── 미니맵 탭 ──
function renderMinimapTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  const cfg = map.minimap;

  const enabled = Boolean(cfg?.enabled);
  const enableCheck = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: "map-minimap-enable" },
  }) as HTMLInputElement;
  enableCheck.checked = enabled;
  enableCheck.addEventListener("change", () => {
    if (enableCheck.checked) {
      setMapMinimap(map.id, { enabled: true, showEvents: true });
    } else {
      setMapMinimap(map.id, null);
    }
    rerender(host);
  });
  const enableRow = el("label", { class: "map-props-check-row" });
  enableRow.append(enableCheck, el("span", { text: "이 맵에서 미니맵 사용" }));
  section.append(enableRow);
  section.append(el("p", { class: "map-props-hint", text: enabled ? "플레이 중 이 맵에 진입하면 미니맵이 뜹니다. M 키로 켜고 끌 수 있습니다." : "체크하면 플레이 중 이 맵에서 미니맵이 표시됩니다." }));

  if (cfg?.enabled) {
    const corner = (cfg.corner ?? "topRight") as NonNullable<import("@/project/types").MapMinimapSetting["corner"]>;
    const cornerSelect = el("select", {
      dataset: { testid: "map-minimap-corner" },
      on: {
        change: (e: Event) => {
          const v = (e.target as HTMLSelectElement).value as NonNullable<import("@/project/types").MapMinimapSetting["corner"]>;
          setMapMinimap(map.id, { corner: v });
        },
      },
    }) as HTMLSelectElement;
    for (const [v, label] of [["topRight", "오른쪽 위"], ["topLeft", "왼쪽 위"], ["bottomRight", "오른쪽 아래"], ["bottomLeft", "왼쪽 아래"]] as const) {
      cornerSelect.append(el("option", { text: label, attrs: { value: v } }));
    }
    cornerSelect.value = corner;
    section.append(fieldRow("위치", cornerSelect));

    const scaleVal = cfg.scale;
    const autoScale = Math.min(0.35, Math.max(0.08, 96 / Math.max(map.width * map.tileSize, map.height * map.tileSize, 1)));
    const effective = scaleVal ?? autoScale;
    const scaleRow = el("div", { class: "map-encounter-rate-row" });
    const slider = el("input", {
      class: "map-encounter-slider",
      attrs: { type: "range", min: "8", max: "35", step: "1", "aria-label": "미니맵 크기" },
      value: String(Math.round(effective * 100)),
      dataset: { testid: "map-minimap-scale" },
    }) as HTMLInputElement;
    const num = el("input", {
      attrs: { type: "number", min: "8", max: "35", step: "1", "aria-label": "미니맵 크기 (%)" },
      value: String(Math.round(effective * 100)),
      dataset: { testid: "map-minimap-scale-number" },
    }) as HTMLInputElement;
    const hint = el("p", { class: "map-props-hint", text: scaleVal === undefined ? `자동(${Math.round(autoScale * 100)}%) — 맵 크기에 맞춰 조절됩니다.` : `${Math.round(effective * 100)}% — 8~35% 사이.` });
    const applyScale = (pct: number): void => {
      const clamped = Math.max(8, Math.min(35, Math.round(pct)));
      slider.value = String(clamped);
      num.value = String(clamped);
      hint.textContent = `${clamped}%`;
      setMapMinimap(map.id, { scale: clamped / 100 });
    };
    slider.addEventListener("input", () => applyScale(parseInt(slider.value, 10) || 8));
    num.addEventListener("change", () => applyScale(parseInt(num.value, 10) || 8));
    const resetBtn = el("button", {
      class: "btn btn-sm",
      text: "자동",
      attrs: { type: "button", title: "자동 배율로 되돌리기" },
      dataset: { testid: "map-minimap-scale-auto" },
      on: {
        click: () => {
          // undefined로 돌리면 auto로 복귀 — 키를 지운 뒤 enabled만 남긴다.
          setMapMinimap(map.id, { scale: undefined as unknown as number });
          // 수동으로 키를 지우기: 실제로는 현재 minimap 객체에서 scale 삭제.
          const fresh = store.getCurrent().maps[map.id];
          if (fresh?.minimap) {
            const copy = { ...fresh.minimap };
            delete (copy as { scale?: unknown }).scale;
            // store 직접 패치 없이 setMapMinimap(null) 후 enabled 재설정은 번거로우므로, 직접 store 조작.
            store.update((p) => {
              const m = p.maps[map.id];
              if (m?.minimap) delete (m.minimap as { scale?: unknown }).scale;
            }, { scope: "map", mapId: map.id });
          }
          rerender(host);
        },
      },
    });
    scaleRow.append(slider, num, resetBtn);
    section.append(fieldRow("크기 (%)", scaleRow));
    section.append(hint);

    const showEvents = cfg.showEvents ?? true;
    const evCheck = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "map-minimap-show-events" } }) as HTMLInputElement;
    evCheck.checked = showEvents;
    evCheck.addEventListener("change", () => setMapMinimap(map.id, { showEvents: evCheck.checked }));
    const evRow = el("label", { class: "map-props-check-row" });
    evRow.append(evCheck, el("span", { text: "이벤트 마커 표시" }));
    section.append(evRow);

    // 참고 이미지도 제한된 상자에 맞춰 그린다. 원본 맵 크기의 CSS 높이를 그대로 쓰지 않는다.
    const previewWrap = el("div", { class: "map-minimap-preview", dataset: { testid: "map-minimap-preview" } });
    previewWrap.append(el("div", { class: "map-minimap-preview-label", text: "맵 참고 이미지 · 실제 미니맵 크기와 마커는 플레이에서 확인하세요" }));
    const canvas = document.createElement("canvas");
    canvas.dataset.testid = "map-minimap-preview-canvas";
    canvas.className = "map-minimap-preview-canvas";
    previewWrap.append(canvas);
    // 비동기로 타일 썸네일을 그린다 — 실패해도 폴백은 배경색만.
    void (async (): Promise<void> => {
      try {
        const { drawTransferMapPreview } = await import("@/editor/panels/eventEditor/transferMapPreview");
        const project = store.getCurrent();
        const freshMap = project.maps[map.id];
        if (!freshMap) return;
        const showEv = freshMap.minimap?.showEvents ?? true;
        // selection은 더미 — 마커 위치만 있으면 됨. showEvents=false면 이벤트 마커를 안 그리는 대신 drawTransferFallback처럼 배경만.
        const zoom = 1;
        const selection = { x: -1, y: -1, zoom };
        // transferMapPreview가 이벤트를 항상 그리므로, showEvents=false일 땐 잠시 필터하려면
        // 별도 분기 없이 그대로 두되 문구로만 구분 — v1 스코프에선 썸네일이니 허용.
        void drawTransferMapPreview({ canvas, project, mapId: map.id, selection, fitDisplay: { maxWidth: 240, maxHeight: 180 }, isCurrent: () => canvas.isConnected }).catch(() => {
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.fillStyle = "#0f1217";
          ctx.fillRect(0, 0, canvas.width || 96, canvas.height || 96);
        });
        void showEv;
      } catch {
        // ignore
      }
    })();
    section.append(previewWrap);
  }

  host.append(section);
}

// ── 필드 스폰 탭 ──
// 같은 적 레코드를 한쪽에서는 산적, 다른 쪽에서는 경비대로 배치하려면 스폰별 진영이 필요하다.
// 그 한 필드만 구조화 컨트롤로 올리고, 나머지 필드(영역·트룹·그래픽 등)는 JSON 해치에 남긴다.
function renderSpawnsTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const project = store.getCurrent();
  const spawns = map.fieldSpawns ?? [];
  const troops = project.database.troops;
  const table = resolveFactionTable(project.factions);

  const section = el("div", { class: "panel-section map-props-section" });
  section.append(el("label", { class: "map-encounter-heading", text: "스폰별 진영 덮어쓰기" }));

  if (spawns.length === 0) {
    section.append(el("p", {
      class: "map-props-hint",
      text: "아직 배치된 적이 없습니다. 적을 배치하면 이곳에서 진영을 바꿀 수 있습니다.",
      dataset: { testid: "map-spawn-empty" },
    }));
  } else {
    for (const [index, spawn] of spawns.entries()) {
      section.append(spawnFactionRow(map, spawns, index, spawn, table, troops, host));
    }
    section.append(el("p", {
      class: "map-props-hint",
      text: "상속(기본값)은 몬스터의 소속 진영을 따릅니다. 몬스터에도 진영이 없으면 적 진영으로 적용됩니다.",
      dataset: { testid: "map-spawn-inherit-hint" },
    }));
  }

  // JSON 탈출구 — 영역·트룹·그래픽 등 나머지 필드의 대량 편집용
  const advanced = el("details", { class: "map-encounter-advanced" });
  advanced.append(el("summary", { text: "JSON으로 직접 편집 (영역·트룹·그래픽 등 전체 필드)" }));
  advanced.append(jsonArrayField(
    "필드 스폰",
    "map-field-spawns-input",
    spawns,
    (entries) => { setMapFieldSpawns(map.id, entries as FieldSpawnDef[]); rerender(host); },
  ));
  section.append(advanced);

  host.append(section);
}

function spawnFactionRow(
  map: import("@/project/types").GameMap,
  spawns: readonly FieldSpawnDef[],
  index: number,
  spawn: FieldSpawnDef,
  table: ReturnType<typeof resolveFactionTable>,
  troops: readonly import("@/project/types").TroopRecord[],
  host: HTMLElement
): HTMLElement {
  const storedId = spawn.factionId;
  const dangling = Boolean(storedId && !table.ids.includes(storedId));

  const select = el("select", {
    attrs: { "aria-label": `${spawn.id} 진영` },
    dataset: { testid: `map-spawn-faction-${index}` },
  }) as HTMLSelectElement;
  // 빈 값은 "진영 없음"이 아니라 "스폰에 저장값 없음(상속)"이다. 첫 옵션으로 두어 기본값임을 드러낸다.
  select.append(el("option", { attrs: { value: "" }, text: "상속 — 몬스터 레코드의 진영 (없으면 적 enemy)" }));
  if (dangling && storedId) {
    // 삭제된 ID를 렌더만으로 조용히 고치지 않는다. 결손 상태를 그대로 보여주고, 다른 진영을 고르면 명시적으로 복구된다.
    select.append(el("option", {
      attrs: { value: storedId, disabled: "" },
      text: `${storedId} · 존재하지 않는 진영 (enemy로 전투)`,
    }));
  }
  for (const id of table.ids) {
    select.append(el("option", {
      attrs: { value: id },
      text: `${factionName(table, id)} (${id})${id === DEFAULT_ENEMY_FACTION_ID ? " · 예약" : ""}`,
    }));
  }
  select.value = storedId ?? "";
  select.addEventListener("change", () => {
    const chosen = select.value;
    const next = spawns.map((item, i) => {
      if (i !== index) return item;
      // 상속으로 되돌리면 기본값을 저장하는 대신 키를 지워 저작 데이터를 희소하게 유지한다.
      if (chosen === "") {
        const { factionId: _dropped, ...rest } = item;
        return rest;
      }
      return { ...item, factionId: chosen };
    });
    setMapFieldSpawns(map.id, next as FieldSpawnDef[]);
    rerender(host);
  });

  const row = el("div", { class: "map-encounter-row map-spawn-row", dataset: { testid: `map-spawn-row-${index}` } });
  const troopName = troops.find((troop) => troop.id === spawn.troopId)?.name;
  const title = el("div", { class: "map-spawn-row-title" });
  title.append(el("span", { class: "map-spawn-row-id", text: spawn.id }));
  title.append(el("span", {
    class: "map-spawn-row-meta",
    text: `${troopName ?? `${spawn.troopId} (없는 트룹)`} · ${spawn.area.w}×${spawn.area.h} @ ${spawn.area.x},${spawn.area.y}`,
  }));
  row.append(title);

  const main = el("div", { class: "map-encounter-row-main" });
  main.append(select);
  row.append(main);

  row.append(el("p", {
    class: `map-props-hint map-spawn-row-effect${dangling ? " map-spawn-row-warning" : ""}`,
    dataset: { testid: `map-spawn-faction-effective-${index}` },
    text: dangling && storedId
      ? `저장된 진영 ID '${storedId}'가 존재하지 않습니다. 런타임에서는 적(enemy)으로 싸웁니다.`
      : storedId
        ? `이 스폰은 ${factionName(table, storedId)} 진영으로 싸웁니다.`
        : "몬스터 레코드의 진영을 따릅니다.",
  }));

  return row;
}

// ── 헬퍼 ──

function mapResourceField(input: {
  label: string; resourceId: string | undefined; kind: DatabaseResourcePickerKind;
  testid: string; dialogTitle: string; allowClear: boolean;
  onChange: (result: { resourceId: string }) => void; rerender: () => void;
}): HTMLElement {
  const resource = listDatabaseResourceOptions(input.kind, store.getCurrent()).find((item) => item.id === input.resourceId);
  const row = el("div", { class: "map-props-resource" });
  row.append(el("span", {
    class: "map-props-resource-name",
    text: resource?.name ?? (input.resourceId ? `현재 리소스: ${input.resourceId}` : "선택한 리소스 없음"),
    dataset: { testid: input.testid },
  }), el("button", {
    class: "btn", text: input.kind === "music" ? "곡 선택" : "그림 선택",
    attrs: { type: "button", "aria-label": `${input.label} 선택` },
    dataset: { testid: `${input.testid}-set` },
    on: { click: () => openDatabaseResourcePickerDialog({
      kind: input.kind, title: input.dialogTitle, currentId: input.resourceId,
      allowClear: input.allowClear, testidPrefix: `${input.testid}-dialog`,
      onConfirm: (result) => { input.onChange(result); input.rerender(); },
    }) },
  }));
  return fieldRow(input.label, row);
}

function fieldRow(label: string, control: HTMLElement): HTMLElement {
  const row = el("div", { class: "field map-props-field" });
  const id = control.dataset.testid;
  const isInput = ["INPUT", "SELECT", "TEXTAREA"].includes(control.tagName.toUpperCase());
  if (isInput && id) {
    control.setAttribute("id", id);
    row.append(el("label", { text: label, attrs: { for: id } }));
  } else {
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", label);
    row.append(el("span", { class: "map-props-field-label", text: label }));
  }
  row.append(control);
  return row;
}

function jsonArrayField(
  label: string,
  testid: string,
  value: readonly unknown[],
  onApply: (entries: unknown[]) => void
): HTMLElement {
  const row = el("div", { class: "field" });
  row.append(el("label", { text: label }));
  const textarea = el("textarea", {
    value: JSON.stringify(value, null, 2),
    attrs: { rows: "6", spellcheck: "false", "aria-label": label },
    dataset: { testid },
  }) as HTMLTextAreaElement;
  textarea.defaultValue = JSON.stringify(value, null, 2);
  const button = el("button", {
    class: "btn btn-sm",
    text: "적용",
    dataset: { testid: `${testid}-apply` },
    on: {
      click: () => {
        try {
          const parsed = JSON.parse(textarea.value) as unknown;
          if (!Array.isArray(parsed)) throw new Error("배열 JSON이 필요합니다.");
          textarea.defaultValue = textarea.value;
          onApply(parsed);
          toast("적용되었습니다.", "ok");
        } catch (error) {
          toast(error instanceof Error ? error.message : "JSON을 해석할 수 없습니다.", "error");
        }
      },
    },
  });
  const stack = el("div", { class: "map-json-field" });
  stack.append(textarea, button);
  row.append(stack);
  return row;
}
