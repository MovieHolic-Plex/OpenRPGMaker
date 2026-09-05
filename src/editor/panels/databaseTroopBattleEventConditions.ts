import { numberField, selectField } from "@/editor/panels/databaseControls";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { store } from "@/project/store";
import type { BattleEventCondition, BattleEventPageRecord, TroopRecord } from "@/project/types/database";

export type TroopEventConditionKind =
  | "none"
  | "switch"
  | "variable"
  | "turn"
  | "onRound"
  | "everyRound"
  | "enemyHp"
  | "enemyHpBelow"
  | "actorHp"
  | "actorCommand";

export const TROOP_EVENT_CONDITION_KINDS = [
  "none",
  "switch",
  "variable",
  "turn",
  "onRound",
  "everyRound",
  "enemyHp",
  "enemyHpBelow",
  "actorHp",
  "actorCommand",
] as const;

export function battleEventConditionControls(
  record: TroopRecord,
  page: BattleEventPageRecord,
  kind: TroopEventConditionKind
): HTMLElement[] {
  const condition = page.conditions[0];
  switch (kind) {
    case "switch":
      return switchControls(record, page, condition);
    case "variable":
      return variableControls(record, page, condition);
    case "turn":
      return turnControls(record, page, condition);
    case "onRound":
      return onRoundControls(record, page, condition);
    case "everyRound":
      return everyRoundControls(record, page, condition);
    case "enemyHp":
      return enemyHpControls(record, page, condition);
    case "enemyHpBelow":
      return enemyHpBelowControls(record, page, condition);
    case "actorHp":
      return actorHpControls(record, page, condition);
    case "actorCommand":
      return actorCommandControls(record, page, condition);
    case "none":
      return [];
  }
}

export function initialBattleEventConditions(kind: TroopEventConditionKind, troop?: TroopRecord): BattleEventCondition[] {
  const project = store.getCurrent();
  switch (kind) {
    case "switch":
      return [{ kind: "switch", switchId: project.switches[0]?.id ?? "", value: true }];
    case "variable":
      return [{ kind: "variable", variableId: project.variables[0]?.id ?? "", op: ">=", value: 0 }];
    case "turn":
      return [{ kind: "turn", start: 1, interval: 1 }];
    case "onRound":
      return [{ kind: "onRound", round: 1 }];
    case "everyRound":
      return [{ kind: "everyRound", start: 1, interval: 1 }];
    case "enemyHp":
      return [{ kind: "enemyHp", enemyId: troop?.enemyIds.length ? "enemy-1" : project.database.enemies[0]?.id ?? "", minPercent: 0, maxPercent: 100 }];
    case "enemyHpBelow":
      return [{ kind: "enemyHpBelow", enemyId: troop?.enemyIds.length ? "enemy-1" : undefined, percent: 50 }];
    case "actorHp":
      return [{ kind: "actorHp", actorId: project.database.actors[0]?.id ?? "", minPercent: 0, maxPercent: 100 }];
    case "actorCommand":
      return [{ kind: "actorCommand", actorId: project.database.actors[0]?.id ?? "", commandId: "defend" }];
    case "none":
      return [];
  }
}

/**
 * 첫 조건의 편집 가능한 종류. 이 화면에 전용 폼이 없는 종류
 * (selfSwitch/gold/timer/item/actor/actorTurn/enemyTurn 등)는 undefined 를 반환해
 * 호출부가 값을 덮어쓰지 않고 잠그도록 한다.
 */
export function kindOfBattleEventCondition(condition: BattleEventCondition | undefined): TroopEventConditionKind | undefined {
  if (!condition) return "none";
  const supported = TROOP_EVENT_CONDITION_KINDS.find((kind) => kind === condition.kind);
  return supported;
}

function switchControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "switch" ? condition : { kind: "switch" as const, switchId: "", value: true };
  return [
    selectField("스위치", "db-field-troop-event-condition-switch", current.switchId, store.getCurrent().switches, (switchId) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "switch" ? stored : current), switchId }))),
    selectField("스위치 상태", "db-field-troop-event-condition-switch-value", String(current.value), [{ id: "true", name: "ON (켜짐)" }, { id: "false", name: "OFF (꺼짐)" }], (value) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "switch" ? stored : current), value: value === "true" }))),
  ];
}

function variableControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "variable" ? condition : { kind: "variable" as const, variableId: "", op: ">=" as const, value: 0 };
  return [
    selectField("변수", "db-field-troop-event-condition-variable", current.variableId, store.getCurrent().variables, (variableId) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "variable" ? stored : current), variableId }))),
    selectField("비교", "db-field-troop-event-condition-variable-op", current.op, ["==", "!=", ">", ">=", "<", "<="].map((op) => ({ id: op, name: op })), (op) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "variable" ? stored : current), op: op as typeof current.op }))),
    numberField("값", "db-field-troop-event-condition-variable-value", current.value, (value) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "variable" ? stored : current), value }))),
  ];
}

function turnControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "turn" ? condition : { kind: "turn" as const, start: 1, interval: 1 };
  return [
    numberField("시작", "db-field-troop-event-condition-turn-start", current.start, (start) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "turn" ? stored : current), start })), { min: 1, max: 999 }),
    numberField("간격", "db-field-troop-event-condition-turn-interval", current.interval, (interval) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "turn" ? stored : current), interval })), { min: 0, max: 999 }),
  ];
}

function onRoundControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "onRound" ? condition : { kind: "onRound" as const, round: 1 };
  return [numberField("라운드", "db-field-troop-event-condition-on-round", current.round, (round) =>
    setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "onRound" ? stored : current), round })), { min: 1, max: 999 })];
}

function everyRoundControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "everyRound" ? condition : { kind: "everyRound" as const, start: 1, interval: 1 };
  return [
    numberField("시작", "db-field-troop-event-condition-every-round-start", current.start ?? 1, (start) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "everyRound" ? stored : current), start })), { min: 1, max: 999 }),
    numberField("간격", "db-field-troop-event-condition-every-round-interval", current.interval ?? 1, (interval) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "everyRound" ? stored : current), interval })), { min: 0, max: 999 }),
  ];
}

function enemyHpControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "enemyHp"
    ? condition
    : { kind: "enemyHp" as const, enemyId: record.enemyIds[0] ?? "", minPercent: 0, maxPercent: 100 };
  return [
    selectField("적 HP", "db-field-troop-event-condition-enemy-hp-target", current.enemyId, enemySlotOptions(record, current.enemyId), (enemyId) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "enemyHp" ? stored : current), enemyId }))),
    ...hpRangeControls(record, page, current, "enemy"),
  ];
}

function enemyHpBelowControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const current = condition?.kind === "enemyHpBelow"
    ? condition
    : { kind: "enemyHpBelow" as const, enemyId: record.enemyIds[0], percent: 50 };
  return [
    selectField("적 슬롯 (없음=아무 적)", "db-field-troop-event-condition-enemy-hp-below-target", current.enemyId ?? "", enemySlotOptions(record, current.enemyId), (enemyId) =>
      setFreshCondition(record, page, (stored) => ({
        ...(stored?.kind === "enemyHpBelow" ? stored : current),
        enemyId: enemyId.trim() || undefined,
      }))),
    numberField("이하 %", "db-field-troop-event-condition-enemy-hp-below-percent", current.percent, (percent) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "enemyHpBelow" ? stored : current), percent })), { min: 0, max: 100 }),
  ];
}

function enemySlotOptions(record: TroopRecord, current?: string): { id: string; name: string }[] {
  const enemies = store.getCurrent().database.enemies;
  const options = record.enemyIds.map((enemyId, index) => ({
    id: `enemy-${index + 1}`,
    name: `슬롯 ${index + 1}: ${enemies.find((enemy) => enemy.id === enemyId)?.name ?? enemyId}`,
  }));
  if (current && !options.some((option) => option.id === current)) {
    const enemy = enemies.find((entry) => entry.id === current);
    options.push({ id: current, name: record.enemyIds.includes(current) ? `${enemy?.name ?? current} (기존 설정 · 첫 일치 슬롯)` : `${enemy?.name ?? current} (이 그룹에 없음 · 다시 선택)` });
  }
  return options;
}

function actorHpControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const actorId = store.getCurrent().database.actors[0]?.id ?? "";
  const current = condition?.kind === "actorHp" ? condition : { kind: "actorHp" as const, actorId, minPercent: 0, maxPercent: 100 };
  return [
    selectField("배우 HP", "db-field-troop-event-condition-actor-hp-target", current.actorId, store.getCurrent().database.actors, (nextActorId) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "actorHp" ? stored : current), actorId: nextActorId }))),
    ...hpRangeControls(record, page, current, "actor"),
  ];
}

function hpRangeControls(
  record: TroopRecord,
  page: BattleEventPageRecord,
  current: Extract<BattleEventCondition, { kind: "enemyHp" | "actorHp" }>,
  target: "enemy" | "actor",
): HTMLElement[] {
  const controls: HTMLElement[] = [];
  for (const key of ["minPercent", "maxPercent"] as const) {
    const isMin = key === "minPercent";
    controls.push(numberField(isMin ? "최소 HP %" : "최대 HP %", `db-field-troop-event-condition-${target}-hp-${isMin ? "min" : "max"}`, current[key], (value) => {
      setFreshCondition(record, page, (stored) => {
        const previous = stored?.kind === current.kind ? stored : current;
        const next = { ...previous, [key]: value };
        if (isMin) next.maxPercent = Math.max(value, previous.maxPercent);
        else next.minPercent = Math.min(value, previous.minPercent);
        const otherControl = controls[isMin ? 1 : 0];
        const other = otherControl?.querySelector("input");
        const pairedValue = isMin ? next.maxPercent : next.minPercent;
        if (other) other.value = String(pairedValue);
        const decrement = otherControl?.querySelector<HTMLButtonElement>(".db-number-stepper-dec");
        const increment = otherControl?.querySelector<HTMLButtonElement>(".db-number-stepper-inc");
        if (decrement) decrement.disabled = pairedValue <= 0;
        if (increment) increment.disabled = pairedValue >= 100;
        return next;
      });
    }, { min: 0, max: 100 }));
  }
  controls.forEach((control) => { control.title = "최소가 최대를 넘으면 반대쪽 값도 함께 조정됩니다."; });
  return controls;
}

function actorCommandControls(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition | undefined): HTMLElement[] {
  const actorId = store.getCurrent().database.actors[0]?.id ?? "";
  const current = condition?.kind === "actorCommand" ? condition : { kind: "actorCommand" as const, actorId, commandId: "defend" };
  return [
    selectField("배우", "db-field-troop-event-condition-actor-command-actor", current.actorId, store.getCurrent().database.actors, (nextActorId) =>
      setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "actorCommand" ? stored : current), actorId: nextActorId }))),
    actorCommandField(record, page, current),
  ];
}

function actorCommandField(record: TroopRecord, page: BattleEventPageRecord, current: Extract<BattleEventCondition, { kind: "actorCommand" }>): HTMLElement {
  const select = document.createElement("select");
  select.dataset.testid = "db-field-troop-event-condition-actor-command-command";
  for (const commandId of ["attack", "skill", "defend", "item", "escape", "switch", "event"] as const) {
    const option = document.createElement("option");
    option.value = commandId;
    option.textContent = commandId;
    select.append(option);
  }
  select.value = current.commandId;
  select.addEventListener("change", () =>
    setFreshCondition(record, page, (stored) => ({ ...(stored?.kind === "actorCommand" ? stored : current), commandId: select.value }))
  );
  return labelField("명령", select);
}

function setFreshCondition(
  record: TroopRecord,
  page: BattleEventPageRecord,
  update: (condition: BattleEventCondition | undefined) => BattleEventCondition
): void {
  // 런타임은 conditions 를 전부 AND 로 평가한다(battleEvents.ts). 첫 조건만 편집하고
  // 나머지는 그대로 보존해야 2번째 이후 조건이 무경고로 사라지지 않는다.
  const stored =
    store.getCurrent().database.troops
      .find((entry) => entry.id === record.id)
      ?.battleEventPages.find((entry) => entry.id === page.id)?.conditions ?? [];
  updateTroopBattleEventPage(record, page, { conditions: [update(stored[0]), ...stored.slice(1)] });
}

function labelField(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "db-field";
  const text = document.createElement("span");
  text.textContent = label;
  wrap.append(text, control);
  return wrap;
}
