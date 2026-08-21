import {
  resizeMap, renameMap, setMapEncounterRate, setMapEncounterTable, setMapFieldSpawns, setMapTileset,
  setMapTroopIds, setStartMap, setStartPos, setMapBackground, setMapBgm, setMapBattleBackground, setMapFlags, setMapMinimap,
} from "@/editor/actions";
import { appendGroupedTilesetOptions } from "@/editor/tilesetSelectOptions";
import { resourcePickerControl } from "@/editor/panels/databaseResourcePickerDialog";
import { editorState } from "@/editor/editorState";
import { SEASONS, TIME_PHASES, type Season, type TimePhase } from "@/project/gameTime";
import { store } from "@/project/store";
import type { EncounterTableEntry, FieldSpawnDef, MapBgmSetting } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

type MapPropsTab = "general" | "background" | "bgm" | "battle" | "restrictions" | "encounter" | "spawns" | "minimap";

const TAB_LABELS: Record<MapPropsTab, string> = {
  general: "일반",
  background: "배경",
  bgm: "BGM",
  battle: "전투",
  restrictions: "제한",
  encounter: "인카운터",
  spawns: "필드 스폰",
  minimap: "미니맵",
};

let activeTab: MapPropsTab = "general";

export function resetMapPropsTabForTests(): void {
  activeTab = "general";
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

  // 탭 바
  const tabBar = el("div", { class: "map-props-tabs", dataset: { testid: "map-props-tabs" } });
  for (const [tab, label] of Object.entries(TAB_LABELS)) {
    const btn = el("button", {
      class: `map-props-tab${activeTab === tab ? " active" : ""}`,
      text: label,
      attrs: { type: "button" },
      dataset: { testid: `map-props-tab-${tab}` },
      on: {
        click: () => {
          activeTab = tab as MapPropsTab;
          renderMapProps(container);
        },
      },
    });
    tabBar.append(btn);
  }
  wrapper.append(tabBar);

  // 탭 내용
  const body = el("div", { class: "map-props-body" });
  switch (activeTab) {
    case "general": renderGeneralTab(body, map); break;
    case "background": renderBackgroundTab(body, map); break;
    case "bgm": renderBgmTab(body, map); break;
    case "battle": renderBattleTab(body, map); break;
    case "restrictions": renderRestrictionsTab(body, map); break;
    case "encounter": renderEncounterTab(body, map); break;
    case "spawns": renderSpawnsTab(body, map); break;
    case "minimap": renderMinimapTab(body, map); break;
  }
  wrapper.append(body);
  container.append(wrapper);
}

// ── 일반 탭 ──
function renderGeneralTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });

  // 이름
  section.append(fieldRow("이름", el("input", {
    attrs: { type: "text", placeholder: "맵 이름" },
    value: map.name,
    dataset: { testid: "map-name-input" },
    on: { change: (e: Event) => renameMap(map.id, (e.target as HTMLInputElement).value) },
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
    attrs: { type: "number", min: "4", max: "128" },
    value: String(map.width),
    dataset: { testid: "map-width-input" },
  });
  const hInput = el("input", {
    attrs: { type: "number", min: "4", max: "128" },
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
      click: () => {
        const w = Math.max(4, Math.min(128, parseInt(wInput.value, 10) || map.width));
        const h = Math.max(4, Math.min(128, parseInt(hInput.value, 10) || map.height));
        resizeMap(map.id, w, h);
      },
    },
  }));
  section.append(fieldRow("크기 (가로 × 세로)", sizeLine));

  // 시작 위치
  section.append(el("button", {
    class: "btn",
    text: "선택 칸을 시작 위치로",
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
    renderMapProps(host.closest(".map-props-dialog")?.parentElement ?? host);
  });
  section.append(fieldRow("배경 사용", enableCheck));

  if (bg) {
    section.append(fieldRow("이미지 ID", el("input", {
      attrs: { type: "text", placeholder: "배경 리소스 ID" },
      value: bg.imageId,
      dataset: { testid: "map-bg-image" },
      on: {
        change: (e: Event) => {
          setMapBackground(map.id, { ...bg, imageId: (e.target as HTMLInputElement).value });
        },
      },
    })));

    const scrollLine = el("div", { class: "map-props-size-row" });
    const sxInput = el("input", {
      attrs: { type: "number", min: "-10", max: "10", step: "0.5" },
      value: String(bg.scrollX ?? 0),
      dataset: { testid: "map-bg-scroll-x" },
    });
    const syInput = el("input", {
      attrs: { type: "number", min: "-10", max: "10", step: "0.5" },
      value: String(bg.scrollY ?? 0),
      dataset: { testid: "map-bg-scroll-y" },
    });
    scrollLine.append(el("span", { text: "X" }), sxInput, el("span", { text: "Y" }), syInput);
    scrollLine.append(el("button", {
      class: "btn btn-sm",
      text: "적용",
      on: {
        click: () => {
          setMapBackground(map.id, {
            ...bg,
            scrollX: parseFloat(sxInput.value) || 0,
            scrollY: parseFloat(syInput.value) || 0,
          });
        },
      },
    }));
    section.append(fieldRow("스크롤 속도", scrollLine));
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
        renderMapProps(host.closest(".map-props-dialog")?.parentElement ?? host);
      },
    },
  }) as HTMLSelectElement;
  for (const [val, label] of [["parent", "상위 맵/기본 BGM"], ["none", "무음"], ["custom", "지정 곡"]] as const) {
    modeSelect.append(el("option", { text: label, attrs: { value: val } }));
  }
  modeSelect.value = mode;
  section.append(fieldRow("BGM 모드", modeSelect));

  if (mode === "custom") {
    // 생 텍스트 입력에서 리소스 피커로 바꿨다. 기본 BGM 카탈로그가 281곡이라
    // 리소스 id 를 외워 타이핑하는 건 실질적으로 불가능하다 — 피커에서 검색·미리듣기로 고른다.
    // resourcePickerControl 은 같은 testid 의 숨은 텍스트 입력을 유지하므로 기존 e2e 는 그대로 통한다.
    const rerender = (): void => {
      renderMapProps(host.closest(".map-props-dialog")?.parentElement ?? host);
    };
    section.append(resourcePickerControl({
      label: "BGM",
      resourceId: bgm?.resourceId,
      kind: "music",
      testid: "map-bgm-resource",
      dialogTitle: "맵 BGM",
      allowClear: true,
      onChange: (result) => {
        setMapBgm(map.id, { mode: "custom", resourceId: result.resourceId, fadeInMs: bgm?.fadeInMs });
      },
      rerender,
    }));
    section.append(fieldRow("페이드인 (ms)", el("input", {
      attrs: { type: "number", min: "0", max: "10000", step: "100" },
      value: String(bgm?.fadeInMs ?? 0),
      dataset: { testid: "map-bgm-fadein" },
      on: {
        change: (e: Event) => {
          setMapBgm(map.id, { mode: "custom", resourceId: bgm?.resourceId, fadeInMs: parseInt((e.target as HTMLInputElement).value, 10) || 0 });
        },
      },
    })));
  }

  host.append(section);
}

// ── 전투 탭 ──
function renderBattleTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  section.append(fieldRow("전투 배경", el("input", {
    attrs: { type: "text", placeholder: "전투 배경 리소스 ID (비우면 기본)" },
    value: map.battleBackground ?? "",
    dataset: { testid: "map-battle-bg" },
    on: {
      change: (e: Event) => {
        const val = (e.target as HTMLInputElement).value.trim();
        setMapBattleBackground(map.id, val || null);
      },
    },
  })));
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

  section.append(makeCheck("세이브 금지", "map-disable-save", Boolean(map.disableSave), (v) => {
    setMapFlags(map.id, { disableSave: v, disableTeleport: map.disableTeleport, disableEscape: map.disableEscape });
  }));
  section.append(makeCheck("텔레포트 금지", "map-disable-teleport", Boolean(map.disableTeleport), (v) => {
    setMapFlags(map.id, { disableSave: map.disableSave, disableTeleport: v, disableEscape: map.disableEscape });
  }));
  section.append(makeCheck("도주 금지", "map-disable-escape", Boolean(map.disableEscape), (v) => {
    setMapFlags(map.id, { disableSave: map.disableSave, disableTeleport: map.disableTeleport, disableEscape: v });
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
    attrs: { type: "number", min: "0", max: "100", step: "1" },
    value: String(rate),
    dataset: { testid: "map-encounter-rate-input" },
  }) as HTMLInputElement;
  const rateSlider = el("input", {
    class: "map-encounter-slider",
    attrs: { type: "range", min: "0", max: "40", step: "1", "aria-label": "인카운트율" },
    value: String(Math.min(40, rate)),
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
    rateSlider.value = String(Math.min(40, clamped));
    rateHint.textContent = describeRate(clamped);
    setMapEncounterRate(map.id, clamped);
  };
  rateSlider.addEventListener("input", () => applyRate(parseInt(rateSlider.value, 10) || 0));
  rateNumber.addEventListener("change", () => applyRate(parseInt(rateNumber.value, 10) || 0));

  const rateRow = el("div", { class: "map-encounter-rate-row" });
  rateRow.append(rateSlider, rateNumber);
  rateSection.append(fieldRow("인카운트율", rateRow));
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
  heading.append(el("label", { class: "map-encounter-heading", text: "인카운터 테이블 (확률·조건)" }));
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

// 탭 본문(host)은 renderMapProps가 만든 .map-props-body 이므로 전체 다이얼로그를 다시 그린다.
function rerender(host: HTMLElement): void {
  const container = host.parentElement?.parentElement;
  if (container) renderMapProps(container);
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

  // 구역 제한
  const region = conditions?.region;
  const regionToggle = el("input", { attrs: { type: "checkbox" }, dataset: { testid: `map-encounter-region-toggle-${index}` } }) as HTMLInputElement;
  regionToggle.checked = Boolean(region);
  regionToggle.addEventListener("change", () => {
    patchConditions({ region: regionToggle.checked ? (region ?? { x: 0, y: 0, w: map.width, h: map.height }) : undefined });
  });
  const regionRow = el("label", { class: "map-props-check-row" });
  regionRow.append(regionToggle, el("span", { text: "구역 제한 (이 사각형 안에서만 출현)" }));
  details.append(regionRow);

  if (region) {
    const rectRow = el("div", { class: "map-encounter-rect-row" });
    const rectField = (key: "x" | "y" | "w" | "h", label: string, max: number): void => {
      const input = el("input", {
        attrs: { type: "number", min: key === "w" || key === "h" ? "1" : "0", max: String(max), "aria-label": label },
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
      cell.append(el("label", { text: label }), input);
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
    attrs: { "aria-label": label },
    dataset: { testid },
    on: { change: (e: Event) => onChange((e.target as HTMLSelectElement).value) },
  }) as HTMLSelectElement;
  for (const option of options) {
    select.append(el("option", { text: option.label, attrs: { value: option.value } }));
  }
  select.value = value;
  const cell = el("div", { class: "map-encounter-cond-cell" });
  cell.append(el("label", { text: label }), select);
  return cell;
}

function numberField(
  label: string,
  testid: string,
  value: number | undefined,
  onChange: (value: number | undefined) => void
): HTMLElement {
  const input = el("input", {
    attrs: { type: "number", min: "0", step: "1", placeholder: "—", "aria-label": label },
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
  cell.append(el("label", { text: label }), input);
  return cell;
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
  section.append(el("p", { class: "map-props-hint", text: enabled ? "플레이 중 이 맵에 진입하면 미니맵이 뜹니다. M 키로 켜고 끌 수 있습니다." : "체크하면 플레이 중 이 맵에서 미니맵이 뜹니다. (기존 맵은 기본 off)" }));

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
      attrs: { type: "number", min: "8", max: "35", step: "1" },
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

    section.append(el("p", { class: "map-props-hint", text: "안개(fog)는 v1에서 자리만 두고, 추후 탐험형 미니맵으로 확장합니다." }));

    // 미리보기 — drawTransferMapPreview를 그대로 재사용 (96px 박스).
    const previewWrap = el("div", { class: "map-minimap-preview", dataset: { testid: "map-minimap-preview" } });
    previewWrap.append(el("div", { class: "map-minimap-preview-label", text: "미리보기" }));
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
        void drawTransferMapPreview({ canvas, project, mapId: map.id, selection, isCurrent: () => canvas.isConnected }).catch(() => {
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
function renderSpawnsTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  section.append(jsonArrayField(
    "필드 스폰",
    "map-field-spawns-input",
    map.fieldSpawns ?? [],
    (entries) => setMapFieldSpawns(map.id, entries as FieldSpawnDef[]),
  ));
  host.append(section);
}

// ── 헬퍼 ──

function fieldRow(label: string, control: HTMLElement): HTMLElement {
  const row = el("div", { class: "field map-props-field" });
  row.append(el("label", { text: label }));
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
    attrs: { rows: "6", spellcheck: "false" },
    dataset: { testid },
  }) as HTMLTextAreaElement;
  const button = el("button", {
    class: "btn btn-sm",
    text: "적용",
    dataset: { testid: `${testid}-apply` },
    on: {
      click: () => {
        try {
          const parsed = JSON.parse(textarea.value) as unknown;
          if (!Array.isArray(parsed)) throw new Error("배열 JSON이 필요합니다.");
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
