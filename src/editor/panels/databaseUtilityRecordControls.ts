import {
  databaseWorkbenchStatusText,
  type DatabaseWorkbenchSummary,
} from "@/editor/panels/databaseWorkbench";
import { store } from "@/project/store";
import type {
  ActorRateGrade,
  ClassBattleCommandKind,
  DatabaseElementKind,
  DatabaseTerrainCharacterDisplay,
  DatabaseTerrainRecord,
} from "@/project/types";
import { el } from "@/util/dom";

type UtilityTabId = "battleCommands" | "elements" | "terrain" | "battlerAnimations";

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

export function utilityNumberRow(options: UtilityRowBase<number>): HTMLElement {
  const input = el("input", { attrs: { type: "number", min: "0" }, dataset: { testid: options.testid }, value: options.value });
  input.addEventListener("focus", options.onFocus);
  input.addEventListener("input", () => options.onInput(Number(input.value)));
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
      return "스킬";
    case "skillSubset":
      return "스킬 계열";
    case "defend":
      return "방어";
    case "item":
      return "아이템";
    case "escape":
      return "도주";
    case "event":
      return "이벤트";
    default:
      return value;
  }
}

export function utilityCheckboxRow(options: UtilityRowBase<boolean>): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" }, dataset: { testid: options.testid } });
  input.checked = options.value;
  input.addEventListener("focus", options.onFocus);
  input.addEventListener("change", () => options.onInput(input.checked));
  return el("label", { class: "db-readonly-row", children: [el("span", { text: options.label }), input] });
}

export function selectedTerrain(terrains: readonly DatabaseTerrainRecord[]): DatabaseTerrainRecord | undefined {
  return terrains[selectedUtilityRecordIndex("terrain")] ?? terrains[0];
}

export function rm2k3Fieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "rm2k3-db-fieldset", children: [el("legend", { text: title }), ...children] });
}

export function readonlyValue(label: string, value: string): HTMLElement {
  return el("div", {
    class: "db-readonly-row",
    children: [el("span", { text: label }), el("code", { text: value })],
  });
}

export function terrainVehicleText(terrain: DatabaseTerrainRecord | undefined): string {
  if (!terrain) return "(미설정)";
  const passage = terrain.vehiclePassage;
  return `보트 ${passage.boat ? "가능" : "불가"} / 선박 ${passage.ship ? "가능" : "불가"} / 비공정 ${passage.airshipLand ? "착륙" : "불가"}`;
}

export function countText(count: number): string {
  return `${count}개`;
}

export function normalizeRateLabelInput(value: string): ActorRateGrade[] {
  const labels = value.split(/[,\s/]+/).filter(Boolean);
  const valid = labels.filter((label): label is ActorRateGrade =>
    label === "A" || label === "B" || label === "C" || label === "D" || label === "E"
  );
  return valid.length === 5 ? valid : ["A", "B", "C", "D", "E"];
}

export function normalizeDamageMultiplierInput(value: string): Record<ActorRateGrade, number> {
  const values = value.split(/[,\s/]+/).filter(Boolean).map(Number);
  if (values.length !== 5 || values.some((entry) => !Number.isFinite(entry))) {
    return { A: 200, B: 150, C: 100, D: 50, E: 0 };
  }
  return {
    A: clampDamageMultiplier(values[0] ?? 200),
    B: clampDamageMultiplier(values[1] ?? 150),
    C: clampDamageMultiplier(values[2] ?? 100),
    D: clampDamageMultiplier(values[3] ?? 50),
    E: clampDamageMultiplier(values[4] ?? 0),
  };
}

function clampDamageMultiplier(value: number): number {
  return Math.min(99999, Math.max(-9999, Math.trunc(value)));
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
  if (tab === "battlerAnimations") {
    const record = database.battlerAnimations?.[index] ?? database.battlerAnimations?.[0];
    return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: "battlerAnimations", tabLabel: "애니메이션 2", totalCount: database.battlerAnimations?.length };
  }
  const record = database.battleCommands?.[index] ?? database.battleCommands?.[0];
  return { recordId: record?.id, recordName: record?.name, selectedIndex: record ? index + 1 : undefined, tabId: "battleCommands", tabLabel: "전투 명령", totalCount: database.battleCommands?.length };
}
