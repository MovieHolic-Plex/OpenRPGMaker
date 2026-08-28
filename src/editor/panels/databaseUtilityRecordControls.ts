import {
  databaseWorkbenchStatusText,
  type DatabaseWorkbenchSummary,
} from "@/editor/panels/databaseWorkbench";
import { store } from "@/project/store";
import type {
  ClassBattleCommandKind,
  DatabaseElementKind,
  DatabaseTerrainCharacterDisplay,
  DatabaseTerrainRecord,
} from "@/project/types";
import { el } from "@/util/dom";

type UtilityTabId = "battleCommands" | "elements" | "terrain";

const selectedUtilityRecords: Partial<Record<UtilityTabId, number>> = {};

type UtilityRowBase<T> = {
  readonly label: string;
  readonly onFocus: () => void;
  readonly onInput: (value: T) => void;
  readonly testid: string;
  readonly value: T;
};

type UtilitySelectRowOptions = UtilityRowBase<string> & {
  readonly options: readonly string[];
};

export function selectedUtilityRecordIndex(tab: UtilityTabId): number {
  return selectedUtilityRecords[tab] ?? 0;
}

export function selectUtilityRecord(tab: UtilityTabId, index: number): void {
  selectedUtilityRecords[tab] = index;
  updateUtilityStatus(tab, index);
}

export function utilityTextRow(options: UtilityRowBase<string>): HTMLElement {
  const input = el("input", { attrs: { type: "text" }, dataset: { testid: options.testid }, value: options.value });
  input.addEventListener("focus", options.onFocus);
  input.addEventListener("input", () => options.onInput(input.value));
  return el("label", { class: "db-readonly-row", children: [el("span", { text: options.label }), input] });
}

export function utilitySelectRow(options: UtilitySelectRowOptions): HTMLElement {
  const select = el("select", {
    dataset: { testid: options.testid },
    children: options.options.map((option) => el("option", { value: option, text: utilityOptionLabel(option) })),
  });
  select.value = options.value;
  select.addEventListener("focus", options.onFocus);
  select.addEventListener("change", () => options.onInput(select.value));
  return el("label", { class: "db-readonly-row", children: [el("span", { text: options.label }), select] });
}

function utilityOptionLabel(value: string): string {
  switch (value) {
    case "physical":
      return "물리";
    case "magical":
      return "마법";
    case "normal":
      return "일반";
    case "transparent":
      return "투명";
    case "attack":
      return "공격";
    case "skill":
      return "특수기능";
    case "skillSubset":
      return "특수계열";
    case "defend":
      return "방어";
    case "guard":
      return "방어(구형)";
    case "item":
      return "아이템";
    case "capture":
      return "포획";
    case "escape":
      return "도망";
    case "switch":
      return "교체";
    case "event":
      return "교체(구형)";
    default:
      return value;
  }
}

// utilityCheckboxRow 는 제거했다(감사 G 축 P0): `.db-readonly-row` 래퍼를 재사용하는
// 바람에 battle-studio.css 의 `.db-terrain-record :is(input, select) { min-height:30px;
// width:100%; border-radius:6px; padding:0 8px }` 가 input[type=checkbox] 에도 걸려,
// 꺼진 보트/선박이 "비활성 텍스트 필드" 처럼 생긴 커다란 빈 상자로 그려졌다.
// 지형 탈것 통행은 이제 databaseControls 의 toggleSwitch 를 쓴다.

export function selectedTerrain(terrains: readonly DatabaseTerrainRecord[]): DatabaseTerrainRecord | undefined {
  return terrains[selectedUtilityRecordIndex("terrain")] ?? terrains[0];
}

export function rm2k3Fieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "oprn-db-fieldset", children: [el("legend", { text: title }), ...children] });
}

export function terrainVehicleText(terrain: DatabaseTerrainRecord | undefined): string {
  if (!terrain) return "(미설정)";
  const passage = terrain.vehiclePassage;
  return `보트 ${passage.boat ? "가능" : "불가"} / 선박 ${passage.ship ? "가능" : "불가"} / 비공정 ${passage.airshipLand ? "착륙" : "불가"}`;
}

export function isElementKind(value: string): value is DatabaseElementKind {
  return value === "physical" || value === "magical";
}

export function isTerrainDisplay(value: string): value is DatabaseTerrainCharacterDisplay {
  return value === "normal" || value === "transparent";
}

export function isBattleCommandKind(value: string): value is ClassBattleCommandKind {
  return value === "attack" || value === "skill" || value === "skillSubset" || value === "defend" || value === "guard" || value === "item" || value === "escape" || value === "switch" || value === "event";
}

function updateUtilityStatus(tab: UtilityTabId, index: number): void {
  const status = document.querySelector<HTMLElement>("[data-testid='db-workbench-status']");
  if (!status) return;
  status.textContent = databaseWorkbenchStatusText(utilitySummary(tab, index));
}

function utilitySummary(tab: UtilityTabId, index: number): DatabaseWorkbenchSummary {
  const database = store.getCurrent().database;
  if (tab === "elements") {
    const record = database.elements?.[index] ?? database.elements?.[0];
    return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: "elements", tabLabel: "속성", totalCount: database.elements?.length };
  }
  if (tab === "terrain") {
    const record = database.terrains?.[index] ?? database.terrains?.[0];
    return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: "terrain", tabLabel: "지형", totalCount: database.terrains?.length };
  }
  const record = database.battleCommands?.[index] ?? database.battleCommands?.[0];
  return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: "battleCommands", tabLabel: "전투 명령", totalCount: database.battleCommands?.length };
}
