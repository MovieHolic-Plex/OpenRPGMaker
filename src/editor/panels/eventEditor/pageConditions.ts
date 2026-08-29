// 「언제 보이나요」 조건 편집 — 켠 조건 목록 + 상시 노출 칩 팔레트.
//
// 예전 구조: 체크박스 12행을 항상 그리고, 그 아래 「고급 조건」 details 가 같은
// `page.conditions` 배열을 두 번째 UI 로 편집했다. 문제가 다섯 겹이었다.
//
//  1. 실사용은 조건 1~2개인데 화면은 늘 12행 만재 — 신호/잡음 1:12.
//  2. 소지금·전투 결과·탐험은 12행에 없어 「고급 조건」에만 있었다. 저작자는 종류마다
//     "위에 있나 아래에 있나"를 외워야 했다.
//  3. 「고급 조건」의 스위치는 `showValue:false`, 아이템·주인공은 `showPresent:false` 라
//     «꺼짐»·«보유 안 함»·«파티에 없음» 을 그 경로에서는 만들 수 없었다.
//  4. 체크가 꺼진 상태에서 시간대/계절 셀렉트를 만지면 조건이 몰래 추가됐다(체크는 계속 꺼져 보임).
//  5. 스위치가 3개 이상이면 `switchConditionAt(page, slot)`(kind 기준 n번째)과
//     `withoutNthCondition` 의 셈이 어긋나 엉뚱한 조건을 지웠다.
//
// 이제 조건 = 배열 원소 하나 = 행 하나다. 행은 자기 **배열 인덱스**로 자신을 교체·삭제하므로
// 슬롯 개념도, "몇 번째 kind 인가" 계산도 없다. 켜는 행위는 칩 클릭(추가)뿐이고 끄는 행위는
// ✕(삭제)뿐이라 체크 상태와 배열이 어긋날 여지가 사라진다.
import { el } from "@/util/dom";
import { hasCharacterId } from "@/project/socialKey";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { CONDITION_OP_OPTIONS } from "./options";
import { commandSummary } from "./commandSummary";
import {
  renderBattleResultCondition,
  renderFriendshipAtLeastCondition,
  renderGoldCondition,
  renderRunCondition,
  renderSelfSwitchCondition,
  SEASON_OPTIONS,
  TIME_PHASE_OPTIONS,
} from "./conditionForm";
import { databaseRecordSelect, switchVariableIdPicker } from "./pageConditionControls";
import {
  defaultPageCondition,
  PAGE_CONDITION_CATEGORIES,
  type PageConditionChipKind,
  pageConditionLabel,
} from "./pageConditionCatalog";
import {
  appendCondition,
  type PageConditionContext,
  pageConditionEntries,
  removeConditionAt,
  replaceConditionAt,
} from "./pageConditionModel";
import type { EventPage, EventPageCondition, MapId } from "@/project/types";

const SWITCH_VALUE_OPTIONS = [
  { value: "on", label: "켜짐" },
  { value: "off", label: "꺼짐" },
] as const;

const ITEM_PRESENT_OPTIONS = [
  { value: "present", label: "보유 중" },
  { value: "absent", label: "보유 안 함" },
] as const;

const ACTOR_PRESENT_OPTIONS = [
  { value: "present", label: "파티에 있음" },
  { value: "absent", label: "파티에 없음" },
] as const;

export function renderPageConditions(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  event?: { characterId?: string },
): HTMLElement[] {
  // 호감도 조건은 이 이벤트의 NPC 관계 연결 여부에 따라 살아있는지가 갈린다 — 컨트롤에 그 사실을 준다.
  const context: PageConditionContext = { mapId, eventId, page, hostHasCharacterId: hasCharacterId(event) };
  return [renderConditionList(context), renderConditionPalette(context)];
}

// --- 켠 조건 목록 -------------------------------------------------------------

type ConditionRow = {
  readonly index: number;
  readonly condition: EventPageCondition;
  /** 사람이 읽는 종류 이름. 행의 첫 칸. */
  readonly label: string;
  /** 행 자체의 testid 조각. 같은 종류가 둘이면 `-2`, `-3` 이 붙는다. */
  readonly key: string;
  /** 이 행 안 컨트롤들의 testid 접두어. 첫 행은 예전 슬롯 testid 를 그대로 승계한다. */
  readonly prefix: string;
};

/**
 * testid 접두어의 종류 조각.
 *
 * 첫 등장은 예전 12행 testid 를 그대로 쓴다(`event-page-switch-condition-input` 등) —
 * e2e·유닛 셀렉터를 깨지 않기 위해서다.
 */
const PREFIX_SLUG: Record<PageConditionChipKind, string> = {
  switch: "switch",
  variable: "variable",
  selfSwitch: "self-switch",
  item: "item",
  actor: "actor",
  gold: "gold",
  timer: "timer",
  timePhase: "time-phase",
  season: "season",
  npcActivity: "npc-activity",
  friendshipAtLeast: "friendship",
  battleResult: "battle-result",
  run: "run",
};

function isChipKind(kind: EventPageCondition["kind"]): kind is PageConditionChipKind {
  return kind !== "all" && kind !== "any" && kind !== "not";
}

function conditionRows(page: EventPage): ConditionRow[] {
  const seen = new Map<string, number>();
  const usedPrefix = new Set<string>();
  return pageConditionEntries(page).map(({ index, condition }) => {
    const label = rowLabel(condition);
    const nth = seen.get(condition.kind) ?? 0;
    seen.set(condition.kind, nth + 1);
    return {
      index,
      condition,
      label,
      key: nth === 0 ? label : `${label}-${nth + 1}`,
      prefix: uniquePrefix(condition, nth, usedPrefix),
    };
  });
}

/**
 * 행 첫 칸에 찍히는 이름.
 *
 * 타이머만 종류 이름으로 부족하다 — 두 타이머를 함께 걸면 라벨이 「타이머」 두 줄이 되어
 * 어느 타이머를 재는 행인지 화면에서 알 수 없다. 컨트롤 쪽에도 timerId 표시가 없으므로
 * 라벨이 유일한 단서다.
 */
function rowLabel(condition: EventPageCondition): string {
  if (condition.kind === "timer") {
    return `${pageConditionLabel("timer")} ${condition.timerId === "timer2" ? "2" : "1"}`;
  }
  return pageConditionLabel(condition.kind);
}

function uniquePrefix(condition: EventPageCondition, nth: number, used: Set<string>): string {
  const ordinal = nth === 0 ? "" : String(nth + 1);
  // 타이머는 슬롯이 아니라 «어느 타이머인가»가 정체성이다 — timer1/timer2 를 그대로 쓴다.
  const base = condition.kind === "timer"
    ? `event-page-${condition.timerId}-condition`
    : `event-page-${isChipKind(condition.kind) ? PREFIX_SLUG[condition.kind] : condition.kind}${ordinal}-condition`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  // 같은 타이머를 두 번 걸어 둔 데이터에서도 testid 가 겹치지 않게 한다.
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const unique = `${base}-${suffix}`;
  used.add(unique);
  return unique;
}

function renderConditionList(context: PageConditionContext): HTMLElement {
  const rows = conditionRows(context.page);
  return el("div", {
    class: "event-condition-list",
    dataset: { testid: "event-page-condition-list" },
    children: rows.length > 0
      ? rows.map((row) => conditionRow(context, row))
      : [el("p", {
          class: "event-condition-list-empty",
          text: "켠 조건이 없습니다 — 이 페이지는 항상 보입니다.",
          dataset: { testid: "event-page-condition-list-empty" },
        })],
  });
}

function conditionRow(context: PageConditionContext, row: ConditionRow): HTMLElement {
  // 행이 존재한다는 사실이 곧 «켜짐» 이다. `conditionActive` 는 이 계약을 읽는 쪽을 위해 남긴다.
  return el("div", {
    class: "event-condition-row",
    dataset: {
      conditionActive: "true",
      conditionKind: row.condition.kind,
      testid: `event-condition-row-${row.key}`,
    },
    children: [
      el("span", { class: "event-condition-label", text: row.label }),
      conditionControl(context, row),
      el("button", {
        class: "event-condition-remove",
        text: "✕",
        attrs: { type: "button", "aria-label": `${row.label} 조건 삭제`, title: "이 조건 삭제" },
        dataset: { testid: `event-condition-remove-${row.key}` },
        on: { click: () => removeConditionAt(context, row.index) },
      }),
    ],
  });
}

function conditionControl(context: PageConditionContext, row: ConditionRow): HTMLElement {
  const { condition, index, prefix } = row;
  const onChange = (next: EventPageCondition) => replaceConditionAt(context, index, next);
  switch (condition.kind) {
    case "switch":
      return switchControl(condition, prefix, onChange);
    case "variable":
      return variableControl(condition, prefix, onChange);
    case "item":
      return itemControl(condition, prefix, onChange);
    case "actor":
      return actorControl(condition, prefix, onChange);
    case "timer":
      return timerControl(condition, prefix, onChange);
    case "timePhase":
      return timePhaseControl(condition, prefix, onChange);
    case "season":
      return seasonControl(condition, prefix, onChange);
    case "npcActivity":
      return npcActivityControl(condition, prefix, onChange);
    case "selfSwitch":
      return renderSelfSwitchCondition(condition, onChange, {
        className: "event-condition-control self-switch",
        keyTestId: `${prefix}-key`,
        valueTestId: `${prefix}-value`,
      });
    case "gold":
      return renderGoldCondition(condition, onChange, {
        className: "event-condition-control gold",
        opTestId: `${prefix}-op`,
        amountTestId: `${prefix}-amount`,
      });
    case "friendshipAtLeast":
      return renderFriendshipAtLeastCondition(condition, onChange, {
        className: "event-condition-control friendship",
        npcKeyTestId: `${prefix}-npc-key`,
        valueTestId: `${prefix}-value`,
        hostHasCharacterId: context.hostHasCharacterId === true,
      });
    case "battleResult":
      return renderBattleResultCondition(condition, onChange, {
        className: "event-condition-control battle-result",
        resultTestId: `${prefix}-input`,
      });
    case "run":
      return renderRunCondition(condition, onChange);
    default:
      // all/any/not — 중첩 편집기가 없다. 사람이 읽는 요약만 보이고 삭제는 행의 ✕ 가 맡는다.
      return el("span", {
        class: "event-condition-control group-summary",
        text: groupConditionSummary(condition),
        dataset: { testid: `${prefix}-summary` },
      });
  }
}

// --- 종류별 컨트롤 ------------------------------------------------------------
//
// 스위치·변수·아이템·주인공·타이머·시간대·계절·활동은 페이지 조건 전용 어휘를 쓴다
// («켜짐/꺼짐», «보유 중/보유 안 함», «파티에 있음/없음»). conditionForm 의 공용 렌더러는
// «true/false», «소지함/소지 안 함» 이라 셀렉트 값 문자열이 달라 여기서 따로 그린다.

function switchControl(
  condition: Extract<EventPageCondition, { kind: "switch" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  let currentSwitchId = condition.switchId;
  const value = selectWithOptions(SWITCH_VALUE_OPTIONS, condition.value === false ? "off" : "on", `${prefix}-value`);
  const apply = () => {
    onChange({
      kind: "switch",
      switchId: currentSwitchId,
      value: selectedOptionValue(value, SWITCH_VALUE_OPTIONS, "on") === "on",
    });
  };
  value.addEventListener("change", apply);
  const picker = switchVariableIdPicker({
    kind: "switch",
    currentId: currentSwitchId,
    inputTestId: `${prefix}-input`,
    pickerTestId: `${prefix}-picker-open`,
    onChange: (switchId) => {
      currentSwitchId = switchId;
      apply();
    },
  });
  return el("div", { class: "event-condition-control switch", children: [picker, value] });
}

function variableControl(
  condition: Extract<EventPageCondition, { kind: "variable" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  let currentVariableId = condition.variableId;
  const op = selectWithOptions(CONDITION_OP_OPTIONS, condition.op, `${prefix}-op`);
  const value = el("input", {
    attrs: { type: "number" },
    value: String(condition.value),
    dataset: { testid: `${prefix}-value` },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, condition.op),
      value: parseInt(value.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  // 변수 픽커 트리거는 `-condition` 이 없는 예전 testid 를 승계한다(event-page-variable-picker-open).
  const picker = switchVariableIdPicker({
    kind: "variable",
    currentId: currentVariableId,
    inputTestId: `${prefix}-input`,
    pickerTestId: `${prefix.replace(/-condition$/, "")}-picker-open`,
    onChange: (variableId) => {
      currentVariableId = variableId;
      apply();
    },
  });
  return el("div", {
    class: "event-condition-control variable",
    children: [
      el("div", { class: "event-condition-main", children: [picker] }),
      el("div", { class: "event-condition-threshold", children: [op, value] }),
    ],
  });
}

function itemControl(
  condition: Extract<EventPageCondition, { kind: "item" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  let currentItemId = condition.itemId;
  const present = selectWithOptions(
    ITEM_PRESENT_OPTIONS,
    condition.present === false ? "absent" : "present",
    `${prefix}-present`,
  );
  const apply = () => {
    onChange({
      kind: "item",
      itemId: currentItemId,
      present: selectedOptionValue(present, ITEM_PRESENT_OPTIONS, "present") === "present",
    });
  };
  present.addEventListener("change", apply);
  const item = databaseRecordSelect({
    kind: "item",
    currentId: currentItemId,
    testId: `${prefix}-input`,
    onChange: (itemId) => {
      currentItemId = itemId;
      apply();
    },
  });
  return el("div", { class: "event-condition-control record", children: [item, present] });
}

function actorControl(
  condition: Extract<EventPageCondition, { kind: "actor" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  let currentActorId = condition.actorId;
  const present = selectWithOptions(
    ACTOR_PRESENT_OPTIONS,
    condition.present === false ? "absent" : "present",
    `${prefix}-present`,
  );
  const apply = () => {
    onChange({
      kind: "actor",
      actorId: currentActorId,
      present: selectedOptionValue(present, ACTOR_PRESENT_OPTIONS, "present") === "present",
    });
  };
  present.addEventListener("change", apply);
  const actor = databaseRecordSelect({
    kind: "actor",
    currentId: currentActorId,
    testId: `${prefix}-input`,
    onChange: (actorId) => {
      currentActorId = actorId;
      apply();
    },
  });
  return el("div", { class: "event-condition-control record", children: [actor, present] });
}

function timerControl(
  condition: Extract<EventPageCondition, { kind: "timer" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  const minutes = el("input", {
    attrs: { type: "number", min: "0", placeholder: "0", "aria-label": "분" },
    value: String(Math.floor(condition.seconds / 60)),
    dataset: { testid: `${prefix}-minutes` },
  }) as HTMLInputElement;
  const seconds = el("input", {
    attrs: { type: "number", min: "0", max: "59", placeholder: "0", "aria-label": "초" },
    value: String(condition.seconds % 60),
    dataset: { testid: `${prefix}-seconds` },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "timer",
      timerId: condition.timerId,
      seconds: (parseInt(minutes.value, 10) || 0) * 60 + (parseInt(seconds.value, 10) || 0),
    });
  };
  minutes.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  return el("div", {
    class: "event-condition-control timer",
    children: [
      minutes,
      el("span", { class: "event-condition-time-unit", text: "분" }),
      seconds,
      el("span", { class: "event-condition-time-unit", text: "초 이하" }),
    ],
  });
}

function timePhaseControl(
  condition: Extract<EventPageCondition, { kind: "timePhase" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  const phase = selectWithOptions(TIME_PHASE_OPTIONS, condition.phase, `${prefix}-input`);
  phase.addEventListener("change", () => {
    onChange({ kind: "timePhase", phase: selectedOptionValue(phase, TIME_PHASE_OPTIONS, condition.phase) });
  });
  return el("div", { class: "event-condition-control time-phase", children: [phase] });
}

function seasonControl(
  condition: Extract<EventPageCondition, { kind: "season" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  const season = selectWithOptions(SEASON_OPTIONS, condition.season, `${prefix}-input`);
  season.addEventListener("change", () => {
    onChange({ kind: "season", season: selectedOptionValue(season, SEASON_OPTIONS, condition.season) });
  });
  return el("div", { class: "event-condition-control season", children: [season] });
}

function npcActivityControl(
  condition: Extract<EventPageCondition, { kind: "npcActivity" }>,
  prefix: string,
  onChange: (next: EventPageCondition) => void,
): HTMLElement {
  const activity = el("input", {
    attrs: { type: "text", placeholder: "일" },
    value: condition.activity,
    dataset: { testid: `${prefix}-input` },
  }) as HTMLInputElement;
  // 예전에는 빈 값으로 지우면 조건이 조용히 사라졌다. 이제 행이 남으므로 앞 값을 되살린다.
  activity.addEventListener("change", () => {
    onChange({ kind: "npcActivity", activity: activity.value.trim() || condition.activity });
  });
  return el("div", { class: "event-condition-control npc-activity", children: [activity] });
}

// --- 칩 팔레트 ---------------------------------------------------------------

/**
 * 13종을 4줄로 상시 노출한다.
 *
 * 접어 두면 «어떤 조건을 걸 수 있는지» 자체가 클릭 뒤로 숨는다. 칩 4줄은 예전 12행 그리드
 * (6행 × 2컬럼 + 컨트롤)보다 훨씬 얇으므로, 상시 노출이 밀도를 되살리지 않는다.
 */
function renderConditionPalette(context: PageConditionContext): HTMLElement {
  const counts = new Map<string, number>();
  for (const condition of context.page.conditions) {
    counts.set(condition.kind, (counts.get(condition.kind) ?? 0) + 1);
  }
  return el("div", {
    class: "event-condition-palette",
    dataset: { testid: "event-page-condition-palette" },
    children: PAGE_CONDITION_CATEGORIES.map((category) =>
      el("div", {
        class: "event-condition-palette-row",
        dataset: { testid: `event-page-condition-palette-${category.slug}` },
        children: [
          el("span", { class: "event-condition-palette-title", text: category.title }),
          el("div", {
            class: "event-condition-palette-chips",
            children: category.kinds.map((kind) => paletteChip(context, kind, counts.get(kind) ?? 0)),
          }),
        ],
      }),
    ),
  });
}

function paletteChip(context: PageConditionContext, kind: PageConditionChipKind, count: number): HTMLElement {
  const label = pageConditionLabel(kind);
  return el("button", {
    class: `event-condition-chip${count > 0 ? " is-used" : ""}`,
    attrs: {
      type: "button",
      title: count > 0 ? `${label} 조건 하나 더 추가 (지금 ${count}개)` : `${label} 조건 추가`,
      "aria-label": `${label} 조건 추가`,
    },
    dataset: { testid: `event-condition-chip-${kind}`, conditionKind: kind },
    children: [
      el("span", { class: "event-condition-chip-plus", text: "＋", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "event-condition-chip-label", text: label }),
      ...(count > 0
        ? [el("span", {
            class: "event-condition-chip-count",
            text: String(count),
            attrs: { "aria-hidden": "true" },
            dataset: { testid: `event-condition-chip-count-${kind}` },
          })]
        : []),
    ],
    on: { click: () => appendCondition(context, defaultPageCondition(kind, count)) },
  });
}

// --- all/any/not 요약 --------------------------------------------------------

type GroupCondition = Extract<EventPageCondition, { kind: "all" | "any" | "not" }>;

function groupConditionSummary(condition: GroupCondition): string {
  if (condition.kind === "not") return `아닐 때: ${describeCondition(condition.condition)}`;
  const label = condition.kind === "all" ? "모두 만족" : "하나 이상 만족";
  const children = condition.conditions;
  const head = children[0];
  if (!head) return `${label}: 하위 조건 없음`;
  const rest = children.length - 1;
  return rest > 0
    ? `${label}: ${describeCondition(head)} 외 ${rest}개`
    : `${label}: ${describeCondition(head)}`;
}

function describeCondition(condition: EventPageCondition): string {
  const full = commandSummary({ kind: "fork", condition, then: [] });
  const separator = full.indexOf(": ");
  return separator >= 0 ? full.slice(separator + 2) : full;
}
