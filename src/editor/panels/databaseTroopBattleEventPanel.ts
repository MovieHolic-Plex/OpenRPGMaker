import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { battleEventCommandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { selectField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { checkboxField } from "@/editor/panels/databaseEnemyRecordSupport";
import { battleEventCommandControls } from "@/editor/panels/databaseTroopBattleEventCommands";
import {
  battleEventConditionControls,
  initialBattleEventConditions,
  kindOfBattleEventCondition,
  TROOP_EVENT_CONDITION_KINDS,
} from "@/editor/panels/databaseTroopBattleEventConditions";
import { updateTroopBattleEventPage } from "@/editor/panels/databaseTroopBattleEventActions";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { BattleEventPageRecord, TroopRecord } from "@/project/types/database";
import { el } from "@/util/dom";

const EVENT_SPANS = ["battle", "turn", "moment"] as const;
const ENEMY_ENCOUNTER_ID = "m2-101-enemy-encounter";
const CHANGE_BATTLEBACK_ID = "m2-102-change-battleback";
const RESULT_SUMMARY_ID = "m2-109-result-summary";
const activeBattleEventPageIds = new Map<string, string>();

export function renderTroopBattleEventPanel(record: TroopRecord, rerender: () => void = () => undefined): HTMLElement {
  const page = selectedBattleEventPage(record);
  return el("section", {
    class: "db-troop-event-panel",
    children: [
      el("h3", { text: "전투 이벤트" }),
      eventToolbar(record, page, rerender),
      qualityStrip(page),
      pageTabs(record, page, rerender),
      commandArea(record, page, rerender),
      conditionStrip(record, page, rerender),
      el("div", { class: "db-troop-event-details", children: page ? pageControls(record, page, rerender) : emptyPageControls() }),
    ],
  });
}

function selectedBattleEventPage(record: TroopRecord): BattleEventPageRecord | undefined {
  const selectedId = activeBattleEventPageIds.get(record.id);
  const selected = record.battleEventPages.find((page) => page.id === selectedId);
  if (selected) return selected;
  const first = record.battleEventPages[0];
  if (!first) {
    activeBattleEventPageIds.delete(record.id);
    return undefined;
  }
  activeBattleEventPageIds.set(record.id, first.id);
  return first;
}

function emptyPageControls(): HTMLElement[] {
  return [el("div", { class: "db-preview", text: "페이지: 0 / 조건: 없음" })];
}

const EVENT_SPAN_OPTIONS = [
  { id: "battle", name: "전투 중 1회" },
  { id: "turn", name: "매 라운드" },
  { id: "moment", name: "매 라운드(구 moment)" },
] as const;

function pageControls(record: TroopRecord, page: BattleEventPageRecord, rerender: () => void): HTMLElement[] {
  const conditionKind = kindOfBattleEventCondition(page.conditions[0]);
  const runOnce = checkboxField("1회만 발동", "db-field-troop-event-run-once", page.runOnce ?? page.span === "battle", (value) => {
    // 해제는 undefined 로 되돌려 런타임 기본값(runOnce ?? span === "battle")을 유지한다.
    updateTroopBattleEventPage(record, page, { runOnce: value ? true : undefined });
    rerender();
  });
  runOnce.title = '스팬이 "전투 중 1회"면 기본으로 1회만 발동합니다.';
  return [
    textField("페이지 이름", "db-field-troop-event-page-name", page.name ?? "", (name) => {
      updateTroopBattleEventPage(record, page, { name });
    }),
    selectField("스팬", "db-field-troop-event-span", page.span, EVENT_SPAN_OPTIONS, (span) => {
      const next = EVENT_SPANS.find((entry) => entry === span);
      if (next) updateTroopBattleEventPage(record, page, { span: next });
      rerender();
    }),
    runOnce,
    ...(conditionKind ? battleEventConditionControls(record, page, conditionKind) : []),
    battleEventCommandControls(record, page, rerender),
  ];
}

function eventToolbar(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-troop-event-toolbar",
    children: [
      button("새로 만들기", "db-troop-event-add-page", () => addPage(record, rerender), "new"),
      button("보상 흐름 템플릿", "db-troop-event-apply-payoff-template", () => applyPayoffTemplate(record, page, rerender), "new"),
      inertButton("복사", "copy"),
      inertButton("붙여넣기", "paste"),
      button("삭제", "db-troop-event-delete-page", () => {
        if (page) removePage(record, page.id, rerender);
      }, "delete"),
    ],
  });
}

function qualityStrip(page: BattleEventPageRecord | undefined): HTMLElement {
  // 후속 연출 판정은 결과 요약 템플릿에 한정하지 않는다 — 텍스트/아이템/골드 지급도
  // 전투 후 연출이므로 "없음" 경고를 내면 오탐이 된다.
  const hasPayoff =
    page?.commands.some(
      (command) =>
        (command.kind === "m2Command" && command.commandId === RESULT_SUMMARY_ID) ||
        command.kind === "text" ||
        command.kind === "changeItem" ||
        command.kind === "changeGold"
    ) ?? false;
  return el("div", {
    class: "db-troop-event-quality",
    text: hasPayoff ? "후속 연출 있음" : "전투 후 보상/후속 연출 없음",
    dataset: { testid: "db-troop-event-quality" },
  });
}

function pageTabs(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-troop-event-page-tabs",
    children: record.battleEventPages.length > 0
      ? record.battleEventPages.map((entry, index) => pageTab(record, entry, index, entry.id === page?.id, rerender))
      : [el("button", { class: "db-troop-event-page-tab active", attrs: { type: "button", disabled: "true" }, text: "1" })],
  });
}

function pageTab(record: TroopRecord, entry: BattleEventPageRecord, index: number, active: boolean, rerender: () => void): HTMLButtonElement {
  return el("button", {
    class: `db-troop-event-page-tab${active ? " active" : ""}`,
    attrs: { type: "button", "aria-pressed": String(active) },
    dataset: { testid: `db-troop-event-page-tab-${index + 1}` },
    text: entry.name || String(index + 1),
    on: {
      click: () => {
        activeBattleEventPageIds.set(record.id, entry.id);
        rerender();
      },
    },
  }) as HTMLButtonElement;
}

function conditionStrip(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  if (!page) {
    return el("div", {
      class: "db-troop-event-condition-strip",
      children: [el("span", { text: "조건" }), el("strong", { text: "(없음)" }), inertButton("...", "condition")],
    });
  }
  const conditionKind = kindOfBattleEventCondition(page.conditions[0]);
  const extras =
    page.conditions.length > 1
      ? [
          el("span", {
            class: "db-troop-event-condition-note",
            dataset: { testid: "db-troop-event-extra-conditions" },
            text: `추가 조건 ${page.conditions.length - 1}개는 이 화면에서 편집할 수 없습니다(런타임은 모두 AND).`,
          }),
        ]
      : [];
  if (!conditionKind) {
    const kind = page.conditions[0]?.kind ?? "unknown";
    return el("div", {
      class: "db-troop-event-condition-strip",
      children: [
        el("span", { text: "조건" }),
        el("span", {
          class: "db-troop-event-condition-note",
          dataset: { testid: "db-troop-event-condition-unsupported" },
          text: `이 조건 종류(${kind})는 여기서 편집할 수 없습니다 — 값이 지워지지 않도록 잠갔습니다.`,
        }),
        button("조건 교체", "db-troop-event-condition-replace", () => {
          updateTroopBattleEventPage(record, page, { conditions: initialBattleEventConditions("turn") });
          rerender();
        }),
        ...extras,
      ],
    });
  }
  return el("div", {
    class: "db-troop-event-condition-strip",
    children: [
      el("span", { text: "조건" }),
      selectLiteral("", "db-field-troop-event-condition-kind", conditionKind, TROOP_EVENT_CONDITION_KINDS, (kind) => {
        updateTroopBattleEventPage(record, page, { conditions: initialBattleEventConditions(kind) });
        rerender();
      }),
      inertButton("...", "condition"),
      ...extras,
    ],
  });
}

function commandArea(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  if (!page) {
    return el("div", {
      class: "db-troop-event-command-area",
      dataset: { testid: "db-troop-event-command-area" },
      children: [el("div", { class: "db-troop-command-line", text: "◆" })],
    });
  }
  const host = el("div", { class: "cmd-list", dataset: { testid: "db-troop-event-command-list" } });
  renderDatabaseCommandListEditor(host, {
    commands: page.commands,
    rerender,
    runtimeSupport: battleEventCommandRuntimeSupport,
    replaceCommands: (commands: Command[]) => updateTroopBattleEventPage(record, page, { commands }),
  });
  return el("div", {
    class: "db-troop-event-command-area event-contents-fieldset",
    dataset: { testid: "db-troop-event-command-area" },
    children: [host],
  });
}

function addPage(record: TroopRecord, rerender: () => void): void {
  const currentRecord = currentTroop(record);
  const page: BattleEventPageRecord = {
    id: `${record.id}_battle_event_${currentRecord.battleEventPages.length + 1}`,
    name: `전투 이벤트 ${currentRecord.battleEventPages.length + 1}`,
    conditions: [],
    span: "battle",
    commands: [],
  };
  activeBattleEventPageIds.set(record.id, page.id);
  updateDatabaseRecord("troops", record.id, { battleEventPages: [...currentRecord.battleEventPages, page] });
  rerender();
}

function applyPayoffTemplate(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): void {
  const currentRecord = currentTroop(record);
  const targetPage = page ?? {
    id: `${record.id}_battle_event_${currentRecord.battleEventPages.length + 1}`,
    name: "전투 보상 흐름",
    conditions: [],
    span: "battle" as const,
    commands: [],
  };
  const commands = withTemplateCommands(targetPage.commands);
  activeBattleEventPageIds.set(record.id, targetPage.id);
  if (!page) {
    updateDatabaseRecord("troops", record.id, { battleEventPages: [...currentRecord.battleEventPages, { ...targetPage, commands }] });
    rerender();
    return;
  }
  updateTroopBattleEventPage(record, page, { commands });
  rerender();
}

function withTemplateCommands(commands: BattleEventPageRecord["commands"]): BattleEventPageRecord["commands"] {
  const hasCommand = (commandId: string): boolean => commands.some((command) => command.kind === "m2Command" && command.commandId === commandId);
  return [
    ...commands,
    ...(hasCommand(ENEMY_ENCOUNTER_ID) ? [] : [{ kind: "m2Command" as const, commandId: ENEMY_ENCOUNTER_ID, fields: { target: "enemy-1" } }]),
    ...(hasCommand(CHANGE_BATTLEBACK_ID) ? [] : [{ kind: "m2Command" as const, commandId: CHANGE_BATTLEBACK_ID, fields: { resourceId: "easyrpg-backdrop-dawn1" } }]),
    ...(hasCommand(RESULT_SUMMARY_ID) ? [] : [{ kind: "m2Command" as const, commandId: RESULT_SUMMARY_ID, fields: { label: "결과 요약" } }]),
  ];
}

function removePage(record: TroopRecord, pageId: string, rerender: () => void): void {
  const currentRecord = currentTroop(record);
  const removedIndex = currentRecord.battleEventPages.findIndex((page) => page.id === pageId);
  const remaining = currentRecord.battleEventPages.filter((page) => page.id !== pageId);
  const nextPage = remaining[Math.max(0, Math.min(removedIndex, remaining.length - 1))];
  if (nextPage) activeBattleEventPageIds.set(record.id, nextPage.id);
  else activeBattleEventPageIds.delete(record.id);
  updateDatabaseRecord("troops", record.id, { battleEventPages: remaining });
  rerender();
}

function currentTroop(record: TroopRecord): TroopRecord {
  return store.getCurrent().database.troops.find((entry) => entry.id === record.id) ?? record;
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
