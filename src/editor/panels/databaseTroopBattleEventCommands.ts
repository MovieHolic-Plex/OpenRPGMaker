import { emptyToUndefined, numberField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { store } from "@/project/store";
import type { Command, M2CommandFields } from "@/project/types";
import type { BattleEventPageRecord, TroopRecord } from "@/project/types/database";
import { el } from "@/util/dom";

type M2Command = Extract<Command, { kind: "m2Command" }>;
type NumericOperation = "set" | "add" | "remove";
type M2CommandDraft = {
  readonly commandId: string;
  readonly fields: M2CommandFields;
};

const CHANGE_ENEMY_HP_ID = "m2-098-change-enemy-hp";
const ENEMY_ENCOUNTER_ID = "m2-101-enemy-encounter";
const CHANGE_BATTLEBACK_ID = "m2-102-change-battleback";
const FORCE_ESCAPE_ID = "m2-107-force-escape";
const ACTION_TIMES_ID = "m2-108-action-times";
const RESULT_SUMMARY_ID = "m2-109-result-summary";
const NUMERIC_OPERATIONS = ["set", "add", "remove"] as const;

export function battleEventCommandControls(record: TroopRecord, page: BattleEventPageRecord, rerender: () => void): HTMLElement {
  const enemyHp = findM2Command(page, CHANGE_ENEMY_HP_ID);
  const encounter = findM2Command(page, ENEMY_ENCOUNTER_ID);
  const battleback = findM2Command(page, CHANGE_BATTLEBACK_ID);
  const forceEscape = findM2Command(page, FORCE_ESCAPE_ID);
  const actionTimes = findM2Command(page, ACTION_TIMES_ID);
  return fieldset("실행 내용", [
    enemyHp ? enemyHpControls(record, page, enemyHp) : addButton("적 HP 변경 추가", "db-troop-event-add-change-enemy-hp", () => {
      addM2Command(record, page, { commandId: CHANGE_ENEMY_HP_ID, fields: { target: "enemy-1", operation: "remove", value: 50 } });
      rerender();
    }),
    encounter ? textField("적 출현", "db-field-troop-event-enemy-encounter-target", stringField(encounter, "target"), (target) =>
      updateM2Command(record, page, { commandId: ENEMY_ENCOUNTER_ID, fields: { target } })) : addButton("적 출현 추가", "db-troop-event-add-enemy-encounter", () => {
      addM2Command(record, page, { commandId: ENEMY_ENCOUNTER_ID, fields: { target: "enemy-2" } });
      rerender();
    }),
    battleback ? textField("전투 배경 변경", "db-field-troop-event-change-battleback-resource", stringField(battleback, "resourceId"), (resourceId) =>
      updateM2Command(record, page, { commandId: CHANGE_BATTLEBACK_ID, fields: { resourceId: emptyToUndefined(resourceId) ?? "" } })) : addButton(
      "전투 배경 변경 추가",
      "db-troop-event-add-change-battleback",
      () => {
        addM2Command(record, page, { commandId: CHANGE_BATTLEBACK_ID, fields: { resourceId: "battle-scenery-plains" } });
        rerender();
      }
    ),
    forceEscape ? textField("강제 도주", "db-field-troop-event-force-escape-summary", "실행", () => undefined) : addButton(
      "강제 도주 추가",
      "db-troop-event-add-force-escape",
      () => {
        addM2Command(record, page, { commandId: FORCE_ESCAPE_ID, fields: {} });
        rerender();
      }
    ),
    actionTimes ? actionTimesControls(record, page, actionTimes) : addButton("행동 횟수 추가", "db-troop-event-add-action-times", () => {
      addM2Command(record, page, { commandId: ACTION_TIMES_ID, fields: { target: "actor_hero", value: 1 } });
      rerender();
    }),
  ]);
}

export function battleEventCommandSummary(command: Command): string {
  if (command.kind === "m2Command" && command.commandId === CHANGE_ENEMY_HP_ID) {
    return `@> 적 HP 변경: ${stringField(command, "target")} ${stringField(command, "operation")} ${numberFieldValue(command, "value")}`;
  }
  if (command.kind === "m2Command" && command.commandId === ENEMY_ENCOUNTER_ID) return `@> 적 출현: ${stringField(command, "target")}`;
  if (command.kind === "m2Command" && command.commandId === CHANGE_BATTLEBACK_ID) return `@> 전투 배경 변경: ${stringField(command, "resourceId")}`;
  if (command.kind === "m2Command" && command.commandId === FORCE_ESCAPE_ID) return "@> 강제 도주";
  if (command.kind === "m2Command" && command.commandId === ACTION_TIMES_ID) {
    return `@> 행동 횟수: ${stringField(command, "target")} +${numberFieldValue(command, "value")}`;
  }
  if (command.kind === "m2Command" && command.commandId === RESULT_SUMMARY_ID) {
    return `@> 결과 요약: ${stringField(command, "label") || "결과 요약"}`;
  }
  return "@> 이벤트 명령";
}

function enemyHpControls(record: TroopRecord, page: BattleEventPageRecord, command: M2Command): HTMLElement {
  return fieldset("적 HP 변경", [
    textField("대상", "db-field-troop-event-change-enemy-hp-target", stringField(command, "target"), (target) =>
      updateM2Command(record, page, { commandId: CHANGE_ENEMY_HP_ID, fields: { target } })),
    selectLiteral("연산", "db-field-troop-event-change-enemy-hp-operation", numericOperation(command), NUMERIC_OPERATIONS, (operation) =>
      updateM2Command(record, page, { commandId: CHANGE_ENEMY_HP_ID, fields: { operation } })),
    numberField("값", "db-field-troop-event-change-enemy-hp-value", numberFieldValue(command, "value"), (value) =>
      updateM2Command(record, page, { commandId: CHANGE_ENEMY_HP_ID, fields: { value } })),
  ]);
}

function actionTimesControls(record: TroopRecord, page: BattleEventPageRecord, command: M2Command): HTMLElement {
  return fieldset("행동 횟수", [
    textField("대상", "db-field-troop-event-action-times-target", stringField(command, "target"), (target) =>
      updateM2Command(record, page, { commandId: ACTION_TIMES_ID, fields: { target } })),
    numberField("횟수", "db-field-troop-event-action-times-value", numberFieldValue(command, "value"), (value) =>
      updateM2Command(record, page, { commandId: ACTION_TIMES_ID, fields: { value } })),
  ]);
}

function addM2Command(record: TroopRecord, page: BattleEventPageRecord, draft: M2CommandDraft): void {
  const currentRecord = getCurrentTroop(record);
  const currentPage = getCurrentPage(currentRecord, page);
  updateTroopBattleEventPage(record, page, {
    commands: [...currentPage.commands, { kind: "m2Command", commandId: draft.commandId, fields: draft.fields }],
  });
}

function updateM2Command(record: TroopRecord, page: BattleEventPageRecord, draft: M2CommandDraft): void {
  const currentRecord = getCurrentTroop(record);
  const currentPage = getCurrentPage(currentRecord, page);
  updateTroopBattleEventPage(record, page, {
    commands: currentPage.commands.map((command) =>
      command.kind === "m2Command" && command.commandId === draft.commandId
        ? { ...command, fields: { ...command.fields, ...draft.fields } }
        : command
    ),
  });
}

function getCurrentTroop(record: TroopRecord): TroopRecord {
  return store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? record;
}

function getCurrentPage(record: TroopRecord, page: BattleEventPageRecord): BattleEventPageRecord {
  return record.battleEventPages.find((entry) => entry.id === page.id) ?? page;
}

function findM2Command(page: BattleEventPageRecord, commandId: string): M2Command | undefined {
  return page.commands.find((command): command is M2Command => command.kind === "m2Command" && command.commandId === commandId);
}

function numericOperation(command: M2Command): NumericOperation {
  const value = command.fields.operation;
  if (value === "add" || value === "remove" || value === "set") return value;
  return "set";
}

function stringField(command: M2Command, key: string): string {
  const value = command.fields[key];
  return typeof value === "string" ? value : "";
}

function numberFieldValue(command: M2Command, key: string): number {
  const value = command.fields[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function addButton(label: string, testid: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", { class: "db-troop-event-tool new", text: label, attrs: { type: "button" }, dataset: { testid } }) as HTMLButtonElement;
  node.addEventListener("click", onClick);
  return node;
}

function fieldset(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}
