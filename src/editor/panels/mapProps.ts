import {
  resizeMap, renameMap, setMapEncounterTable, setMapFieldSpawns, setMapTileset,
  setStartMap, setStartPos, setMapBackground, setMapBgm, setMapBattleBackground, setMapFlags,
} from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { EncounterTableEntry, FieldSpawnDef, MapBgmSetting } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

type MapPropsTab = "general" | "background" | "bgm" | "battle" | "restrictions" | "encounter" | "spawns";

const TAB_LABELS: Record<MapPropsTab, string> = {
  general: "일반",
  background: "배경",
  bgm: "BGM",
  battle: "전투",
  restrictions: "제한",
  encounter: "인카운터",
  spawns: "필드 스폰",
};

let activeTab: MapPropsTab = "general";

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

  // 칩셋
  const tilesetSelect = el("select", {
    attrs: { "aria-label": `${map.name} 칩셋` },
    dataset: { testid: "map-props-tileset-select" },
    on: {
      change: (e: Event) => {
        setMapTileset(map.id, (e.target as HTMLSelectElement).value);
      },
    },
  }) as HTMLSelectElement;
  for (const tileset of Object.values(store.getCurrent().tilesets)) {
    tilesetSelect.append(el("option", { text: tileset.name, attrs: { value: tileset.id } }));
  }
  tilesetSelect.value = map.tilesetId;
  section.append(fieldRow("칩셋", tilesetSelect));

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
    section.append(fieldRow("리소스 ID", el("input", {
      attrs: { type: "text", placeholder: "BGM 리소스 ID" },
      value: bgm?.resourceId ?? "",
      dataset: { testid: "map-bgm-resource" },
      on: {
        change: (e: Event) => {
          setMapBgm(map.id, { mode: "custom", resourceId: (e.target as HTMLInputElement).value, fadeInMs: bgm?.fadeInMs });
        },
      },
    })));
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
function renderEncounterTab(host: HTMLElement, map: import("@/project/types").GameMap): void {
  const section = el("div", { class: "panel-section map-props-section" });
  section.append(jsonArrayField(
    "인카운터 테이블",
    "map-encounter-table-input",
    map.encounterTable ?? [],
    (entries) => setMapEncounterTable(map.id, entries as EncounterTableEntry[]),
  ));
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
