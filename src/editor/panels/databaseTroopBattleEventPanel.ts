import { updateDatabaseRecord } from "@/editor/databaseActions";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
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
import { emptyState } from "@/editor/panels/databaseWorkspace";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { BattleEventPageRecord, TroopRecord } from "@/project/types/database";
import { el } from "@/util/dom";
import { genId } from "@/util/id";

const EVENT_SPANS = ["battle", "turn", "moment"] as const;
const ENEMY_ENCOUNTER_ID = "m2-101-enemy-encounter";
const CHANGE_BATTLEBACK_ID = "m2-102-change-battleback";
const RESULT_SUMMARY_ID = "m2-109-result-summary";
const activeBattleEventPageIds = new Map<string, string>();

export function renderTroopBattleEventPanel(record: TroopRecord, rerender: () => void = () => undefined): HTMLElement {
  const page = selectedBattleEventPage(record);
  return el("section", {
    class: "db-troop-event-panel",
    dataset: { testid: "db-troop-event-panel" },
    children: [
      el("header", {
        class: "db-troop-event-head",
        children: [
          el("h3", { text: "전투 이벤트" }),
          el("span", {
            class: "db-troop-event-head-hint",
            text: `페이지 ${record.battleEventPages.length}개 · 조건이 맞는 페이지가 전투 중 실행됩니다.`,
          }),
        ],
      }),
      eventToolbar(record, page, rerender),
      qualityStrip(page),
      // 페이지가 0 개면 탭 줄과 조건 줄은 **아예 만들지 않는다**. `hidden` 속성으로 숨기려던
      // 시도는 실패한다 — UA 의 `[hidden]{display:none}` 이 이 두 클래스의 author
      // `display:flex`(modern/troops.css:682,718)에 지고, 빈 5px 구분선과 16px 빈 알약이
      // 남는다(headless Chromium 실측). 이 저장소에 같은 함정 기록이 네 곳 있다.
      ...(page ? [pageTabs(record, page, rerender), conditionStrip(record, page, rerender)] : []),
      // 페이지가 0 개면 세부 칸을 만들지 않는다 — 예전에는 여기 빈 상태 카드 하나, 바로 아래
      // 명령 영역에 회색 빈 상자 하나로 같은 사실을 두 번 말했다. 빈 상태는 명령 영역 하나에만 둔다.
      ...(page
        ? [el("div", {
          class: "db-troop-event-details",
          dataset: { testid: "db-troop-event-details" },
          children: pageControls(record, page, rerender),
        })]
        : []),
      commandArea(record, page, rerender),
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

function emptyPageState(record: TroopRecord, rerender: () => void): HTMLElement {
  return emptyState({
    // ◆ 는 명령 목록의 행 표식이자 e2e 계약(oprn-database-battle-records.spec.ts)이다.
    icon: "◆",
    title: "전투 이벤트 페이지가 없습니다",
    body: "조건이 맞을 때 전투 중에 실행되는 명령 묶음입니다. 승리 대사·중간 등장·강제 도주 같은 연출을 여기에 넣습니다.",
    compact: true,
    testid: "db-troop-event-empty",
    action: {
      label: "첫 페이지 만들기",
      kind: "primary",
      testid: "db-troop-event-empty-add-page",
      onClick: () => addPage(record, rerender),
    },
    // 두 번째 액션은 두지 않는다 — 바로 위 툴바에 같은 「보상 흐름 템플릿」 버튼이 있어서
    // 페이지 0 개일 때 같은 버튼이 화면에 두 번 떴다(접근명 중복 2 건으로 실측).
  });
}

const EVENT_SPAN_OPTIONS = [
  { id: "battle", name: "전투 중 1회" },
  { id: "turn", name: "매 라운드" },
  { id: "moment", name: "조건이 맞을 때마다" },
] as const;

function pageControls(record: TroopRecord, page: BattleEventPageRecord, rerender: () => void): HTMLElement[] {
  const conditionKind = kindOfBattleEventCondition(page.conditions[0]);
  const runOnce = checkboxField("1회만 발동", "db-field-troop-event-run-once", page.runOnce ?? page.span === "battle", (value) => {
    updateTroopBattleEventPage(record, page, { runOnce: value });
    rerender();
  });
  runOnce.title = '스팬이 "전투 중 1회"면 기본으로 1회만 발동합니다.';
  return [
    textField("페이지 이름", "db-field-troop-event-page-name", page.name ?? "", (name) => {
      updateTroopBattleEventPage(record, page, { name });
    }),
    selectField("스팬", "db-field-troop-event-span", page.span, EVENT_SPAN_OPTIONS, (span) => {
      const next = EVENT_SPANS.find((entry) => entry === span);
      if (next) updateTroopBattleEventPage(record, page, { span: next, runOnce: undefined });
      rerender();
    }),
    runOnce,
    ...(conditionKind ? battleEventConditionControls(record, page, conditionKind) : []),
    battleEventCommandControls(record, page, rerender),
  ];
}

function eventToolbar(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  // 예전 툴바는 `1.2fr 1.4fr 1fr 1fr 1fr` 고정 5열 격자여서, 좁아지면 다섯 번째 버튼이
  // 패널 오른쪽 밖으로 81px 밀려나 잘렸다(게이트 clipped:1). 이제 줄바꿈되는 flex 툴바다.
  return el("div", {
    class: "db-toolbar db-ws-toolbar db-troop-event-toolbar",
    children: [
      button("＋ 새 페이지", "db-troop-event-add-page", () => addPage(record, rerender), "primary"),
      button("보상 흐름 템플릿", "db-troop-event-apply-payoff-template", () => applyPayoffTemplate(record, page, rerender), "ghost", "등장 → 배경 전환 → 결과 요약 명령을 한 번에 넣습니다"),
      // P9: 동작하지 않는 컨트롤을 말없이 두지 않는다 — 왜 잠겨 있는지 툴팁으로 알린다.
      inertButton("복사", "전투 이벤트 페이지 클립보드는 아직 없습니다 — 명령 목록에서 개별 명령을 복사하세요"),
      inertButton("붙여넣기", "전투 이벤트 페이지 클립보드는 아직 없습니다 — 명령 목록에서 개별 명령을 붙여넣으세요"),
      button("삭제", "db-troop-event-delete-page", () => {
        if (page) removePage(record, page.id, rerender);
      }, "danger", page ? "지금 보고 있는 페이지를 지웁니다 (Ctrl+Z 로 복구)" : "지울 페이지가 없습니다", !page,
      "전투 이벤트 페이지 삭제"),
    ],
  });
}

/** Additional event commands are separate from ordinary battle rewards. */
function qualityStrip(page: BattleEventPageRecord | undefined): HTMLElement {
  const hasTemplate = page?.commands.some((command) => command.kind === "m2Command" && command.commandId === RESULT_SUMMARY_ID) ?? false;
  const hasPayoff = (page?.commands.length ?? 0) > 0;
  const tone = hasPayoff ? "good" : "info";
  const text = hasTemplate
    ? "보상 흐름 템플릿 적용됨 — 결과 요약 명령이 들어 있습니다"
    : hasPayoff
      ? "추가 전투 이벤트 있음 — 실행 시점은 페이지 조건과 빈도를 따릅니다"
      : "추가 전투 이벤트 없음 — 기본 경험치·돈·드롭 보상은 별도로 적용됩니다";
  return el("div", {
    class: `db-troop-event-quality db-troop-event-quality-${tone}`,
    dataset: { testid: "db-troop-event-quality" },
    children: [
      el("span", { class: "db-troop-event-quality-dot", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "db-troop-event-quality-text", text }),
    ],
  });
}

/**
 * 페이지 탭 줄. 호출부가 페이지가 있을 때만 부른다.
 *
 * 예전에는 페이지 0 개일 때 비활성 "1" 칩을 그려서, 헤더가 "페이지 0개" 라고 말하는 옆에서
 * 1 번 페이지가 있는 것처럼 보였다(모순 실측 2026-09-01).
 */
function pageTabs(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-troop-event-page-tabs",
    children: record.battleEventPages.map((entry, index) =>
      pageTab(record, entry, index, entry.id === page?.id, rerender)
    ),
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

/**
 * 조건 줄. 호출부가 페이지가 있을 때만 부른다 — 값 없는 "조건 (없음)" 카드는 바로 아래
 * 빈 상태와 같은 사실을 한 번 더 말하면서 조작할 수 있는 것처럼 보였다.
 */
function conditionStrip(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  if (!page) {
    return el("div", { class: "db-troop-event-condition-strip" });
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
          updateTroopBattleEventPage(record, page, { conditions: [...initialBattleEventConditions("turn", record), ...page.conditions.slice(1)] });
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
        updateTroopBattleEventPage(record, page, { conditions: [...initialBattleEventConditions(kind, record), ...page.conditions.slice(1)] });
        rerender();
      }),
      ...extras,
    ],
  });
}

function commandArea(record: TroopRecord, page: BattleEventPageRecord | undefined, rerender: () => void): HTMLElement {
  if (!page) {
    return el("div", {
      class: "db-troop-event-command-area is-empty",
      dataset: { testid: "db-troop-event-command-area" },
      children: [emptyPageState(record, rerender)],
    });
  }
  const host = el("div", { class: "cmd-list", dataset: { testid: "db-troop-event-command-list" } });
  renderDatabaseCommandListEditor(host, {
    commands: page.commands,
    rerender,
    pickerContext: "troop",
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
    id: genId("battle_page"),
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
    id: genId("battle_page"),
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
    ...(hasCommand(CHANGE_BATTLEBACK_ID) ? [] : [{ kind: "m2Command" as const, commandId: CHANGE_BATTLEBACK_ID, fields: { resourceId: "battle-scenery-plains" } }]),
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

/**
 * 툴바 버튼. 예전에는 클래스가 `db-troop-event-tool <icon>` 뿐이라 위계가 없었고,
 * 다섯 개가 고정 격자에서 같은 회색 상자로 늘어섰다 — 공용 `db-ws-btn` 어휘를 쓴다.
 */
function button(
  label: string,
  testid: string,
  onClick: () => void,
  kind: "primary" | "ghost" | "danger" = "ghost",
  title?: string,
  disabled = false,
  /** 같은 탭에 동명 버튼이 여러 개일 때 보조기술용 이름만 구체화한다. */
  ariaLabel?: string
): HTMLButtonElement {
  const node = el("button", {
    class: `db-ws-btn db-ws-btn-${kind} db-troop-event-tool`,
    text: label,
    attrs: { type: "button", ...(title ? { title } : {}), ...(ariaLabel ? { "aria-label": ariaLabel } : {}) },
    dataset: { testid },
  }) as HTMLButtonElement;
  node.disabled = disabled;
  node.addEventListener("click", onClick);
  return node;
}

/**
 * 아직 동작하지 않는 컨트롤. qa-troops.spec.ts:269-272 가 복사/붙여넣기가 **존재하고
 * 비활성** 인 것을 계약으로 확인하므로 지우지 않고, 대신 왜 잠겨 있는지 툴팁으로
 * 설명한다(P9: 말없이 죽어 있는 버튼 금지).
 */
function inertButton(label: string, reason: string): HTMLButtonElement {
  const node = el("button", {
    class: "db-ws-btn db-ws-btn-ghost db-troop-event-tool is-inert",
    text: label,
    attrs: { type: "button", disabled: "true", title: reason, "aria-disabled": "true" },
  }) as HTMLButtonElement;
  node.disabled = true;
  return node;
}
