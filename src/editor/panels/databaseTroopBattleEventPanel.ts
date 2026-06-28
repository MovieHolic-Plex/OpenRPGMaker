import { emptyToUndefined, numberField, selectField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { BattleEventCondition, BattleEventPageRecord, Command, TroopRecord } from "@/project/types";
import { el } from "@/util/dom";

type ConditionKind = "none" | "switch" | "variable" | "turn" | "enemyHp" | "actorHp" | "actorCommand";

const CONDITION_KINDS = ["none", "switch", "variable", "turn", "enemyHp", "actorHp", "actorCommand"] as const;
const EVENT_SPANS = ["battle", "turn", "moment"] as const;
const ACTOR_COMMANDS = ["attack", "skill", "defend", "item", "escape", "event"] as const;
const ENEMY_ENCOUNTER_ID = "m2-101-enemy-encounter";
const CHANGE_BATTLEBACK_ID = "m2-102-change-battleback";

export function renderTroopBattleEventPanel(record: TroopRecord, rerender: () => void = () => undefined): HTMLElement {
  const page = record.battleEventPages[0];
  return el("section", {
    class: "db-troop-event-panel",
    children: [
      el("h3", { text: "전투 이벤트" }),
      eventToolbar(record, page, rerender),
      pageTabs(record, page),
      conditionStrip(record, page, rerender),
      commandArea(page),
      el("div", { class: "db-troop-event-details", children: page ? pageControls(record, page, rerender) : emptyPageControls() }),
    ],
  });
}

function emptyPageControls(): HTMLElement[] {
  return [
    el("div", { class: "db-preview", text: "페이지: 0 / 조건: 없음" }),
  ];
}

function pageControls(record: TroopRecord, page: BattleEventPageRecord, rerender: () => void): HTMLElement[] {
  const condition = page.conditions[0];
  const conditionKind = kindOfCondition(condition);
  return [
    selectLiteral("스팬", "db-field-troop-event-span", page.span, EVENT_SPANS, (span) => updatePage(record, page, { span })),
    ...conditionControls(record, page, conditionKind, condition),
    commandControls(record, page, rerender),
  ];
}

function eventToolbar(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-troop-event-toolbar",
    children: [
      button("새로 만들기", "db-troop-event-add-page", () => addPage(record, rerender), "new"),
      inertButton("복사", "copy"),
      inertButton("붙여넣기", "paste"),
      button("삭제", "db-troop-event-delete-page", () => {
        if (page) removePage(record, page.id, rerender);
      }, "delete"),
    ],
  });
}

function pageTabs(record: TroopRecord, page: BattleEventPageRecord | undefined): HTMLElement {
  return el("div", {
    class: "db-troop-event-page-tabs",
    children: record.battleEventPages.length > 0
      ? record.battleEventPages.map((entry, index) =>
          el("button", {
            class: `db-troop-event-page-tab${entry.id === page?.id ? " active" : ""}`,
            attrs: { type: "button" },
            text: String(index + 1),
          })
        )
      : [el("button", { class: "db-troop-event-page-tab active", attrs: { type: "button" }, text: "1" })],
  });
}

function conditionStrip(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  if (!page) {
    return el("div", {
      class: "db-troop-event-condition-strip",
      children: [el("span", { text: "조건" }), el("strong", { text: "(없음)" }), inertButton("...", "condition")],
    });
  }
  const conditionKind = kindOfCondition(page.conditions[0]);
  return el("div", {
    class: "db-troop-event-condition-strip",
    children: [
      el("span", { text: "조건" }),
      selectLiteral("", "db-field-troop-event-condition-kind", conditionKind, CONDITION_KINDS, (kind) =>
        updateStructuralPage(record, page, { conditions: initialConditions(kind) }, rerender)
      ),
      inertButton("...", "condition"),
    ],
  });
}

function commandArea(page: BattleEventPageRecord | undefined): HTMLElement {
  return el("div", {
    class: "db-troop-event-command-area",
    dataset: { testid: "db-troop-event-command-area" },
    children: [
      el("div", { class: "db-troop-command-line", text: "@>" }),
      ...(page?.commands ?? []).map((command) => el("div", { class: "db-troop-command-line", text: commandSummary(command) })),
    ],
  });
}

function conditionControls(
  record: TroopRecord,
  page: BattleEventPageRecord,
  kind: ConditionKind,
  condition: BattleEventCondition | undefined
): HTMLElement[] {
  switch (kind) {
    case "switch": {
      const current = condition?.kind === "switch" ? condition : { kind: "switch" as const, switchId: "", value: true };
      return [textField("스위치", "db-field-troop-event-condition-switch", current.switchId, (switchId) => setCondition(record, page, { ...current, switchId }))];
    }
    case "variable": {
      const current = condition?.kind === "variable" ? condition : { kind: "variable" as const, variableId: "", op: ">=" as const, value: 0 };
      return [
        textField("변수", "db-field-troop-event-condition-variable", current.variableId, (variableId) =>
          setCondition(record, page, { ...current, variableId })
        ),
        numberField("값", "db-field-troop-event-condition-variable-value", current.value, (value) => setCondition(record, page, { ...current, value })),
      ];
    }
    case "turn": {
      const current = condition?.kind === "turn" ? condition : { kind: "turn" as const, start: 1, interval: 1 };
      return [
        numberField("시작", "db-field-troop-event-condition-turn-start", current.start, (start) => setCondition(record, page, { ...current, start })),
        numberField("간격", "db-field-troop-event-condition-turn-interval", current.interval, (interval) =>
          setCondition(record, page, { ...current, interval })
        ),
      ];
    }
    case "enemyHp": {
      const current = condition?.kind === "enemyHp"
        ? condition
        : { kind: "enemyHp" as const, enemyId: record.enemyIds[0] ?? "", minPercent: 0, maxPercent: 100 };
      return [
        selectField("적 HP", "db-field-troop-event-condition-enemy-hp-target", current.enemyId, store.getCurrent().database.enemies, (enemyId) =>
          setCondition(record, page, { ...current, enemyId })
        ),
        numberField("최소 %", "db-field-troop-event-condition-enemy-hp-min", current.minPercent, (minPercent) =>
          setCondition(record, page, { ...current, minPercent })
        ),
        numberField("최대 %", "db-field-troop-event-condition-enemy-hp-max", current.maxPercent, (maxPercent) =>
          setCondition(record, page, { ...current, maxPercent })
        ),
      ];
    }
    case "actorHp": {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const current = condition?.kind === "actorHp" ? condition : { kind: "actorHp" as const, actorId, minPercent: 0, maxPercent: 100 };
      return [
        selectField("배우 HP", "db-field-troop-event-condition-actor-hp-target", current.actorId, store.getCurrent().database.actors, (nextActorId) =>
          setCondition(record, page, { ...current, actorId: nextActorId })
        ),
        numberField("최소 %", "db-field-troop-event-condition-actor-hp-min", current.minPercent, (minPercent) =>
          setCondition(record, page, { ...current, minPercent })
        ),
        numberField("최대 %", "db-field-troop-event-condition-actor-hp-max", current.maxPercent, (maxPercent) =>
          setCondition(record, page, { ...current, maxPercent })
        ),
      ];
    }
    case "actorCommand": {
      const actorId = store.getCurrent().database.actors[0]?.id ?? "";
      const current = condition?.kind === "actorCommand" ? condition : { kind: "actorCommand" as const, actorId, commandId: "defend" };
      return [
        selectField("배우", "db-field-troop-event-condition-actor-command-actor", current.actorId, store.getCurrent().database.actors, (nextActorId) =>
          setCondition(record, page, { ...current, actorId: nextActorId })
        ),
        selectLiteral("명령", "db-field-troop-event-condition-actor-command-command", current.commandId, ACTOR_COMMANDS, (commandId) =>
          setCondition(record, page, { ...current, commandId })
        ),
      ];
    }
    case "none":
      return [];
  }
}

function commandControls(record: TroopRecord, page: BattleEventPageRecord, rerender: () => void): HTMLElement {
  const encounter = findM2Command(page, ENEMY_ENCOUNTER_ID);
  const battleback = findM2Command(page, CHANGE_BATTLEBACK_ID);
  return fieldset("실행 내용", [
    encounter
      ? textField("적 출현", "db-field-troop-event-enemy-encounter-target", stringField(encounter, "target"), (target) =>
          updateM2Command(record, page, ENEMY_ENCOUNTER_ID, { target })
        )
      : button("적 출현 추가", "db-troop-event-add-enemy-encounter", () => addM2Command(record, page, ENEMY_ENCOUNTER_ID, { target: "enemy-2" }, rerender)),
    battleback
      ? textField("전투 배경 변경", "db-field-troop-event-change-battleback-resource", stringField(battleback, "resourceId"), (resourceId) =>
          updateM2Command(record, page, CHANGE_BATTLEBACK_ID, { resourceId: emptyToUndefined(resourceId) ?? "" })
        )
      : button("전투 배경 변경 추가", "db-troop-event-add-change-battleback", () =>
          addM2Command(record, page, CHANGE_BATTLEBACK_ID, { resourceId: "easyrpg-backdrop-dawn1" }, rerender)
        ),
  ]);
}

function addPage(record: TroopRecord, rerender: () => void): void {
  updateDatabaseRecord("troops", record.id, {
    battleEventPages: [
      ...record.battleEventPages,
      {
        id: `${record.id}_battle_event_${record.battleEventPages.length + 1}`,
        name: `전투 이벤트 ${record.battleEventPages.length + 1}`,
        conditions: [],
        span: "battle",
        commands: [],
      },
    ],
  });
  rerender();
}

function removePage(record: TroopRecord, pageId: string, rerender: () => void): void {
  updateDatabaseRecord("troops", record.id, {
    battleEventPages: record.battleEventPages.filter((page) => page.id !== pageId),
  });
  rerender();
}

function updatePage(record: TroopRecord, page: BattleEventPageRecord, patch: Partial<BattleEventPageRecord>): void {
  updateDatabaseRecord("troops", record.id, {
    battleEventPages: record.battleEventPages.map((entry) => entry.id === page.id ? { ...entry, ...patch } : entry),
  });
}

function updateStructuralPage(record: TroopRecord, page: BattleEventPageRecord, patch: Partial<BattleEventPageRecord>, rerender: () => void): void {
  updatePage(record, page, patch);
  rerender();
}

function setCondition(record: TroopRecord, page: BattleEventPageRecord, condition: BattleEventCondition): void {
  updatePage(record, page, { conditions: [condition] });
}

function addM2Command(record: TroopRecord, page: BattleEventPageRecord, commandId: string, fields: Record<string, string>, rerender: () => void): void {
  updatePage(record, page, {
    commands: [...page.commands, { kind: "m2Command", commandId, fields }],
  });
  rerender();
}

function updateM2Command(record: TroopRecord, page: BattleEventPageRecord, commandId: string, fields: Record<string, string>): void {
  updatePage(record, page, {
    commands: page.commands.map((command) =>
      command.kind === "m2Command" && command.commandId === commandId ? { ...command, fields: { ...command.fields, ...fields } } : command
    ),
  });
}

function initialConditions(kind: ConditionKind): BattleEventCondition[] {
  const project = store.getCurrent();
  switch (kind) {
    case "switch":
      return [{ kind: "switch", switchId: "0001", value: true }];
    case "variable":
      return [{ kind: "variable", variableId: "0001", op: ">=", value: 0 }];
    case "turn":
      return [{ kind: "turn", start: 1, interval: 1 }];
    case "enemyHp":
      return [{ kind: "enemyHp", enemyId: project.database.enemies[0]?.id ?? "", minPercent: 0, maxPercent: 100 }];
    case "actorHp":
      return [{ kind: "actorHp", actorId: project.database.actors[0]?.id ?? "", minPercent: 0, maxPercent: 100 }];
    case "actorCommand":
      return [{ kind: "actorCommand", actorId: project.database.actors[0]?.id ?? "", commandId: "defend" }];
    case "none":
      return [];
  }
}

function kindOfCondition(condition: BattleEventCondition | undefined): ConditionKind {
  if (!condition) return "none";
  if (condition.kind === "actorTurn" || condition.kind === "enemyTurn") return "turn";
  return condition.kind;
}

function findM2Command(page: BattleEventPageRecord, commandId: string): Extract<Command, { kind: "m2Command" }> | undefined {
  return page.commands.find((command): command is Extract<Command, { kind: "m2Command" }> =>
    command.kind === "m2Command" && command.commandId === commandId
  );
}

function stringField(command: Extract<Command, { kind: "m2Command" }>, key: string): string {
  const value = command.fields[key];
  return typeof value === "string" ? value : "";
}

function commandSummary(command: Command): string {
  if (command.kind === "m2Command" && command.commandId === ENEMY_ENCOUNTER_ID) return `@> 적 출현: ${stringField(command, "target")}`;
  if (command.kind === "m2Command" && command.commandId === CHANGE_BATTLEBACK_ID) return `@> 전투 배경 변경: ${stringField(command, "resourceId")}`;
  return "@> 이벤트 명령";
}

function button(label: string, testid: string, onClick: () => void, icon?: string): HTMLButtonElement {
  const node = el("button", {
    class: icon ? `db-troop-event-tool ${icon}` : "",
    text: label,
    attrs: { type: "button" },
    dataset: { testid },
  }) as HTMLButtonElement;
  node.addEventListener("click", onClick);
  return node;
}

function inertButton(label: string, icon: string): HTMLButtonElement {
  const node = el("button", { class: `db-troop-event-tool ${icon}`, text: label, attrs: { type: "button", disabled: "true" } }) as HTMLButtonElement;
  node.disabled = true;
  return node;
}

function fieldset(title: string, children: HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}
