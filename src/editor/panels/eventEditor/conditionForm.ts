import { el } from "@/util/dom";
import { store } from "@/project/store";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { BOOLEAN_OPTIONS, CONDITION_OP_OPTIONS } from "./options";
import { databasePicker } from "./switchVariablePicker";
import { actorPickerControl, itemPickerControl } from "./sharedPickers";
import type { ActorId, Condition, ItemId, Season, TimePhase } from "@/project/types";

export { databasePicker, switchPicker, switchVariablePicker, variablePicker } from "./switchVariablePicker";

const CONDITION_MODE_OPTIONS = [
  { value: "switch", label: "스위치" },
  { value: "variable", label: "변수" },
  { value: "selfSwitch", label: "이 이벤트 기억" },
  { value: "actor", label: "주인공" },
  { value: "item", label: "아이템" },
  { value: "gold", label: "소지금" },
  { value: "timer", label: "타이머" },
  { value: "timePhase", label: "시간대" },
  { value: "season", label: "계절" },
  { value: "npcActivity", label: "활동" },
  { value: "friendshipAtLeast", label: "호감도" },
  { value: "battleResult", label: "전투 결과" },
  { value: "run", label: "탐험" },
  { value: "all", label: "모두(AND)" },
  { value: "any", label: "하나(OR)" },
  { value: "not", label: "아님(NOT)" },
] as const;

const SWITCH_STATE_OPTIONS = [
  { value: "true", label: "켜기" },
  { value: "false", label: "끄기" },
] as const;

export const TIME_PHASE_OPTIONS = [
  { value: "morning", label: "아침" },
  { value: "day", label: "낮" },
  { value: "evening", label: "저녁" },
  { value: "night", label: "밤" },
] as const satisfies readonly { readonly value: TimePhase; readonly label: string }[];

export const SEASON_OPTIONS = [
  { value: "spring", label: "봄" },
  { value: "summer", label: "여름" },
  { value: "fall", label: "가을" },
  { value: "winter", label: "겨울" },
] as const satisfies readonly { readonly value: Season; readonly label: string }[];

/**
 * 조건 분기 / 조건 편집용 폼.
 * bare select 스택이 아니라 라벨 붙은 세로 필드로 구성한다.
 */
const conditionModeCache = new Map<string, Condition>();

export function conditionForm(cond: Condition, onChange: (condition: Condition) => void): HTMLElement {
  const wrap = el("div", {
    class: "event-condition-form",
    dataset: { testid: "event-condition-form" },
  });

  const mode = selectWithOptions(CONDITION_MODE_OPTIONS, cond.kind, "event-condition-mode");
  mode.addEventListener("change", () => {
    conditionModeCache.set(cond.kind, structuredClone(cond));
    const cached = conditionModeCache.get(mode.value as Condition["kind"]);
    if (cached) { onChange(structuredClone(cached)); return; }
    switch (mode.value) {
      case "switch":
        onChange({ kind: "switch", switchId: "", value: true });
        return;
      case "variable":
        onChange({ kind: "variable", variableId: "", op: ">=", value: 0 });
        return;
      case "selfSwitch":
        onChange({ kind: "selfSwitch", key: "A", value: true });
        return;
      case "actor":
        onChange({ kind: "actor", actorId: firstActorId(), present: true });
        return;
      case "item":
        onChange({ kind: "item", itemId: firstItemId(), present: true });
        return;
      case "gold":
        onChange({ kind: "gold", op: ">=", amount: 100 });
        return;
      case "timer":
        onChange({ kind: "timer", timerId: "timer1", seconds: 60 });
        return;
      case "timePhase":
        onChange({ kind: "timePhase", phase: "day" });
        return;
      case "season":
        onChange({ kind: "season", season: "spring" });
        return;
      case "npcActivity":
        onChange({ kind: "npcActivity", activity: "work" });
        return;
      case "friendshipAtLeast":
        onChange({ kind: "friendshipAtLeast", value: 100 });
        return;
      case "battleResult":
        onChange({ kind: "battleResult", result: "victory" });
        return;
      case "run":
        onChange({ kind: "run", query: "active", value: true });
        return;
      case "all":
        onChange({ kind: "all", conditions: [{ kind: "switch", switchId: "", value: true }] });
        return;
      case "any":
        onChange({ kind: "any", conditions: [{ kind: "switch", switchId: "", value: true }] });
        return;
      case "not":
        onChange({ kind: "not", condition: { kind: "switch", switchId: "", value: true } });
        return;
    }
  });

  wrap.append(field("조건 종류", mode));

  switch (cond.kind) {
    case "switch":
      wrap.append(labeledSwitch(cond, onChange));
      break;
    case "variable":
      wrap.append(labeledVariable(cond, onChange));
      break;
    case "selfSwitch":
      wrap.append(labeledSelfSwitch(cond, onChange));
      break;
    case "actor":
      wrap.append(labeledActor(cond, onChange));
      break;
    case "item":
      wrap.append(labeledItem(cond, onChange));
      break;
    case "gold":
      wrap.append(labeledGold(cond, onChange));
      break;
    case "timer":
      wrap.append(labeledTimer(cond, onChange));
      break;
    case "timePhase":
      wrap.append(field("시간대", renderTimePhaseCondition(cond, onChange)));
      break;
    case "season":
      wrap.append(field("계절", renderSeasonCondition(cond, onChange)));
      break;
    case "npcActivity":
      wrap.append(field("활동 ID", renderNpcActivityCondition(cond, onChange)));
      break;
    case "friendshipAtLeast":
      wrap.append(labeledFriendship(cond, onChange));
      break;
    case "battleResult":
      wrap.append(labeledBattleResult(cond, onChange));
      break;
    case "run":
      wrap.append(labeledRun(cond, onChange));
      break;
    case "all":
    case "any":
      wrap.append(labeledGroup(cond, onChange));
      break;
    case "not":
      wrap.append(labeledNot(cond, onChange));
      break;
  }

  wrap.append(
    el("p", {
      class: "event-condition-hint",
      text: conditionHint(cond.kind),
      dataset: { testid: "event-condition-hint" },
    })
  );
  return wrap;
}

function labeledSwitch(
  cond: Extract<Condition, { kind: "switch" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentSwitchId = cond.switchId;
  const sw = databasePicker("switch", cond.switchId, (switchId) => {
    currentSwitchId = switchId;
    onChange({ kind: "switch", switchId, value: cond.value });
    syncError();
  }, "event-condition-switch-target");
  const val = selectWithOptions(SWITCH_STATE_OPTIONS, String(cond.value), "event-condition-switch-value");
  val.addEventListener("change", () => {
    onChange({ kind: "switch", switchId: currentSwitchId, value: val.value === "true" });
  });
  const error = el("p", {
    class: "event-condition-error",
    text: "대상 스위치를 선택하세요.",
    dataset: { testid: "event-condition-switch-error" },
  });
  const syncError = (): void => { error.hidden = Boolean(currentSwitchId.trim()); };
  syncError();
  box.append(field("대상 스위치", sw), error, field("상태", val));
  return box;
}

function labeledVariable(
  cond: Extract<Condition, { kind: "variable" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentVariableId = cond.variableId;
  const variable = databasePicker("variable", cond.variableId, (variableId) => {
    currentVariableId = variableId;
    syncError();
    onChange({ kind: "variable", variableId, op: cond.op, value: cond.value });
  }, "event-condition-variable-target");
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, "event-condition-variable-op");
  const value = el("input", {
    attrs: { type: "number", step: "1" },
    value: String(cond.value),
    dataset: { testid: "event-condition-variable-value" },
  }) as HTMLInputElement;
  const error = el("p", {
    class: "event-condition-error",
    text: "대상 변수를 선택하세요.",
    dataset: { testid: "event-condition-variable-error" },
  });
  const syncError = (): void => { error.hidden = Boolean(currentVariableId.trim()); };
  syncError();
  const apply = (): void => {
    onChange({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      value: Number.isFinite(Number(value.value)) ? Math.trunc(Number(value.value)) : 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  value.addEventListener("blur", apply);
  box.append(field("대상 변수", variable), error, field("비교", op), field("비교 값", value));
  return box;
}

function labeledSelfSwitch(
  cond: Extract<Condition, { kind: "selfSwitch" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  box.append(
    selfSwitchControl(cond.key, cond.value, (key, value) => onChange({ kind: "selfSwitch", key, value }))
  );
  return box;
}

function labeledActor(
  cond: Extract<Condition, { kind: "actor" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentActorId = cond.actorId;
  const error = el("p", { class: "event-condition-error", text: "주인공을 선택하세요.", dataset: { testid: "event-condition-actor-error" } });
  const syncError = (): void => { error.hidden = Boolean(currentActorId.trim()); };
  const sel = actorPicker(cond.actorId, (actorId) => {
    currentActorId = actorId;
    syncError();
    onChange({ kind: "actor", actorId, present: cond.present });
  });
  syncError();
  const present = el("select", { dataset: { testid: "event-condition-actor-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "파티에 있음", attrs: { value: "true" } }),
    el("option", { text: "파티에 없음", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "actor", actorId: currentActorId, present: present.value === "true" });
  });
  box.append(field("주인공", sel), error, field("파티 상태", present));
  return box;
}

function labeledItem(
  cond: Extract<Condition, { kind: "item" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  let currentItemId = cond.itemId;
  const error = el("p", { class: "event-condition-error", text: "아이템을 선택하세요.", dataset: { testid: "event-condition-item-error" } });
  const syncError = (): void => { error.hidden = Boolean(currentItemId.trim()); };
  const sel = itemPicker(cond.itemId, (itemId) => {
    currentItemId = itemId;
    syncError();
    onChange({ kind: "item", itemId, present: cond.present });
  });
  syncError();
  const present = el("select", { dataset: { testid: "event-condition-item-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "소지함", attrs: { value: "true" } }),
    el("option", { text: "소지 안 함", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "item", itemId: currentItemId, present: present.value === "true" });
  });
  box.append(field("아이템", sel), error, field("소지 여부", present));
  return box;
}

function labeledGold(
  cond: Extract<Condition, { kind: "gold" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, "event-condition-gold-op");
  const amount = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.amount),
    dataset: { testid: "event-condition-gold-amount" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "gold",
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  box.append(field("비교", op), field("금액", amount));
  return box;
}

function labeledTimer(
  cond: Extract<Condition, { kind: "timer" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const timerId = el("select", { dataset: { testid: "event-condition-timer-id" } }) as HTMLSelectElement;
  timerId.append(
    el("option", { text: "타이머 1", attrs: { value: "timer1" } }),
    el("option", { text: "타이머 2", attrs: { value: "timer2" } })
  );
  timerId.value = cond.timerId;
  const seconds = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.seconds),
    dataset: { testid: "event-condition-timer-seconds" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "timer",
      timerId: timerId.value === "timer2" ? "timer2" : "timer1",
      seconds: parseInt(seconds.value, 10) || 0,
    });
  };
  timerId.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  box.append(field("타이머", timerId), field("남은 초 ≤", seconds));
  return box;
}

function labeledFriendship(
  cond: Extract<Condition, { kind: "friendshipAtLeast" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cond.npcKey ?? "",
    dataset: { testid: "event-condition-friendship-npc-key" },
  }) as HTMLInputElement;
  const value = el("input", {
    attrs: { type: "number", min: "0", max: "1000" },
    value: String(cond.value),
    dataset: { testid: "event-condition-friendship-value" },
  }) as HTMLInputElement;
  const apply = (): void => {
    onChange({
      kind: "friendshipAtLeast",
      npcKey: npcKey.value.trim() || undefined,
      value: parseInt(value.value, 10) || 0,
    });
  };
  npcKey.addEventListener("change", apply);
  value.addEventListener("change", apply);
  box.append(field("누구", npcKey), field("최소 호감도", value));
  return box;
}

function labeledBattleResult(
  cond: Extract<Condition, { kind: "battleResult" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const select = selectWithOptions(
    [
      { value: "victory", label: "승리" },
      { value: "defeat", label: "패배" },
      { value: "escape", label: "도망" },
    ] as const,
    cond.result,
    "event-condition-battle-result",
  );
  select.addEventListener("change", () => {
    const result = selectedOptionValue(select, [
      { value: "victory", label: "승리" },
      { value: "defeat", label: "패배" },
      { value: "escape", label: "도망" },
    ] as const, cond.result);
    onChange({ kind: "battleResult", result });
  });
  box.append(field("결과", select));
  return box;
}

function labeledRun(
  cond: Extract<Condition, { kind: "run" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", { class: "event-condition-detail" });
  const queryOptions = [
    { value: "active", label: "탐험 중인지" },
    { value: "floor", label: "현재 층" },
    { value: "flag", label: "탐험 기억" },
    { value: "result", label: "탐험 결과" },
  ] as const;
  const query = selectWithOptions(queryOptions, cond.query, "event-condition-run-query");
  query.addEventListener("change", () => {
    switch (selectedOptionValue(query, queryOptions, cond.query)) {
      case "active": onChange({ kind: "run", query: "active", value: true }); return;
      case "floor": onChange({ kind: "run", query: "floor", op: ">=", value: 1 }); return;
      case "flag": onChange({ kind: "run", query: "flag", flag: "flag1", value: true }); return;
      case "result": onChange({ kind: "run", query: "result", result: "completed" }); return;
    }
  });
  box.append(field("조회", query));

  switch (cond.query) {
    case "active": {
      const select = selectWithOptions(BOOLEAN_OPTIONS, String(cond.value ?? true), "event-condition-run-active-value");
      select.addEventListener("change", () => onChange({ kind: "run", query: "active", value: select.value === "true" }));
      box.append(field("상태", select));
      break;
    }
    case "floor": {
      let opValue = cond.op;
      let floorValue = cond.value;
      const op = selectWithOptions(CONDITION_OP_OPTIONS, opValue, "event-condition-run-floor-op");
      const value = el("input", {
        attrs: { type: "number", min: "1", max: "9999", step: "1" },
        value: String(floorValue),
        dataset: { testid: "event-condition-run-floor-value" },
      }) as HTMLInputElement;
      const apply = (): void => onChange({ kind: "run", query: "floor", op: opValue, value: floorValue });
      op.addEventListener("change", () => { opValue = selectedOptionValue(op, CONDITION_OP_OPTIONS, opValue); apply(); });
      value.addEventListener("change", () => {
        floorValue = Math.max(1, Math.min(9_999, Math.trunc(Number(value.value) || 1)));
        apply();
      });
      box.append(field("비교", op), field("층", value));
      break;
    }
    case "flag": {
      let flagValue = cond.flag;
      let boolValue = cond.value;
      const flag = el("input", {
        attrs: { type: "text", placeholder: "플래그 이름" },
        value: flagValue,
        dataset: { testid: "event-condition-run-flag" },
      }) as HTMLInputElement;
      const value = selectWithOptions(BOOLEAN_OPTIONS, String(boolValue), "event-condition-run-flag-value");
      const apply = (): void => onChange({ kind: "run", query: "flag", flag: flagValue, value: boolValue });
      flag.addEventListener("change", () => { flagValue = flag.value.trim(); apply(); });
      value.addEventListener("change", () => { boolValue = value.value === "true"; apply(); });
      box.append(field("플래그", flag), field("값", value));
      break;
    }
    case "result": {
      const options = [
        { value: "completed", label: "완료" },
        { value: "failed", label: "실패" },
        { value: "abandoned", label: "포기" },
      ] as const;
      const result = selectWithOptions(options, cond.result, "event-condition-run-result");
      result.addEventListener("change", () => onChange({
        kind: "run",
        query: "result",
        result: selectedOptionValue(result, options, cond.result),
      }));
      box.append(field("결과", result));
      break;
    }
  }
  return box;
}

export function renderRunCondition(
  cond: Extract<Condition, { kind: "run" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  return labeledRun(cond, onChange);
}

function labeledGroup(
  cond: Extract<Condition, { kind: "all" | "any" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", {
    class: "event-condition-group",
    dataset: { testid: `event-condition-group-${cond.kind}` },
  });
  const emptyWarning = el("p", {
    class: "event-condition-warning",
    text: cond.kind === "all" ? "하위 조건이 없습니다 — 빈 AND는 항상 참입니다." : "하위 조건이 없습니다 — 빈 OR는 항상 거짓입니다.",
    dataset: { testid: `event-condition-group-empty-${cond.kind}` },
  });
  emptyWarning.hidden = cond.conditions.length > 0;
  const list = el("div", { class: "event-condition-group-list" });
  let currentChildren: Condition[] = structuredClone(
    cond.conditions.length > 0 ? cond.conditions : [{ kind: "switch" as const, switchId: "", value: true }]
  );
  const publish = (next: Condition[], rerender = false) => {
    currentChildren = next;
    onChange({ kind: cond.kind, conditions: structuredClone(currentChildren) });
    if (rerender) renderChildren();
  };
  const renderChildren = () => {
    list.replaceChildren();
    currentChildren.forEach((child, index) => {
      const card = el("div", {
        class: "event-condition-group-item",
        dataset: { testid: `event-condition-group-item-${index}` },
      });
      card.append(
        el("div", { class: "event-condition-group-item-title", text: `조건 ${index + 1}` }),
        conditionForm(child, (nextChild) => {
          publish(
            currentChildren.map((entry, i) => (i === index ? nextChild : entry)),
            nextChild.kind !== child.kind
          );
        }),
        el("button", {
          class: "btn danger",
          text: "제거",
          attrs: { type: "button" },
          dataset: { testid: `event-condition-group-remove-${index}` },
          on: {
            click: () => {
              const next = currentChildren.filter((_, i) => i !== index);
              publish(next.length ? next : [{ kind: "switch", switchId: "", value: true }], true);
            },
          },
        })
      );
      list.append(card);
    });
  };
  renderChildren();
  box.append(
    emptyWarning,
    list,
    el("button", {
      class: "btn",
      text: "+ 하위 조건",
      attrs: { type: "button" },
      dataset: { testid: "event-condition-group-add" },
      on: {
        click: () => {
          publish([...currentChildren, { kind: "switch", switchId: "", value: true }], true);
        },
      },
    })
  );
  return box;
}

function labeledNot(
  cond: Extract<Condition, { kind: "not" }>,
  onChange: (condition: Condition) => void
): HTMLElement {
  const box = el("div", {
    class: "event-condition-group event-condition-not",
    dataset: { testid: "event-condition-not" },
  });
  box.append(
    el("div", { class: "event-condition-group-item-title", text: "반대 조건" }),
    conditionForm(cond.condition, (nextChild) => onChange({ kind: "not", condition: nextChild }))
  );
  return box;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", {
    class: "inline-field event-condition-field",
    children: [el("span", { class: "event-condition-field-label", text: label }), control],
  });
}

function conditionHint(kind: Condition["kind"]): string {
  switch (kind) {
    case "switch":
      return "선택한 스위치가 ON/OFF 인 경우 참 분기로 들어갑니다.";
    case "variable":
      return "변수 값과 비교 값의 관계가 맞으면 참 분기로 들어갑니다.";
    case "selfSwitch":
      return "이 이벤트만의 기억(A~D) 상태를 검사합니다.";
    case "actor":
      return "파티에 해당 주인공이 있는지 검사합니다.";
    case "item":
      return "인벤토리 소지 여부를 검사합니다.";
    case "gold":
      return "현재 소지금을 비교합니다.";
    case "timer":
      return "타이머 남은 시간이 지정 초 이하인지 검사합니다.";
    case "timePhase":
      return "현재 시간대(아침/낮/저녁/밤)를 검사합니다.";
    case "season":
      return "현재 계절을 검사합니다.";
    case "npcActivity":
      return "NPC 스케줄 활동 ID가 일치하는지 검사합니다.";
    case "friendshipAtLeast":
      return "호감도가 지정 값 이상인지 검사합니다. 누구를 비우면 이 이벤트 기준입니다.";
    case "battleResult":
      return "직전 전투 결과에 따라 분기합니다. 필드 몬스터 처치 후 이벤트 소거에 씁니다.";
    case "run":
      return "지금 탐험 중인지, 몇 층인지, 기억과 결과를 검사합니다.";
    case "all":
      return "하위 조건을 모두 만족해야 참입니다 (AND).";
    case "any":
      return "하위 조건 중 하나라도 만족하면 참입니다 (OR).";
    case "not":
      return "하위 조건의 반대입니다 (NOT).";
    default:
      return "조건을 설정하면 우측 미리보기에 요약이 표시됩니다.";
  }
}

// --- Page condition / shared renderers (bare controls for existing page UI) ---

export function renderSwitchCondition(
  cond: Extract<Condition, { kind: "switch" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: string, onChange: (id: string) => void) => HTMLElement;
    readonly showValue?: boolean;
    readonly forceTrueOnSwitchChange?: boolean;
    readonly className?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentSwitchId = cond.switchId;
  const sw = (options.picker ?? ((switchId, onPick) => databasePicker("switch", switchId, onPick)))(cond.switchId, (switchId) => {
    currentSwitchId = switchId;
    onChange({ kind: "switch", switchId, value: options.forceTrueOnSwitchChange ? true : cond.value });
  });
  if (options.showValue === false) {
    row.append(sw);
    return row;
  }
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cond.value));
  val.addEventListener("change", () => {
    onChange({ kind: "switch", switchId: currentSwitchId, value: val.value === "true" });
  });
  row.append(sw, val);
  return row;
}

export function renderVariableCondition(
  cond: Extract<Condition, { kind: "variable" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: string, onChange: (id: string) => void) => HTMLElement;
    readonly className?: string;
    readonly opTestId?: string;
    readonly valueTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentVariableId = cond.variableId;
  const variable = (options.picker ?? ((variableId, onPick) => databasePicker("variable", variableId, onPick)))(cond.variableId, (variableId) => {
    currentVariableId = variableId;
    onChange({ kind: "variable", variableId, op: cond.op, value: cond.value });
  });
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, options.opTestId);
  const value = el("input", {
    attrs: { type: "number" },
    value: String(cond.value),
    dataset: options.valueTestId ? { testid: options.valueTestId } : undefined,
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "variable",
      variableId: currentVariableId,
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      value: parseInt(value.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  row.append(variable, op, value);
  return row;
}

const SELF_SWITCH_KEYS = ["A", "B", "C", "D"] as const;

/**
 * 세그먼트 버튼(A/B/C/D) + ON/OFF 토글로 구성된 셀프 스위치 컨트롤.
 * 드롭다운 2개짜리 구형 UI를 대체한다.
 */
export function selfSwitchControl(
  key: "A" | "B" | "C" | "D",
  value: boolean,
  onChange: (key: "A" | "B" | "C" | "D", value: boolean) => void,
  options: {
    readonly keyTestId?: string;
    readonly valueTestId?: string;
  } = {}
): HTMLElement {
  const wrap = el("span", {
    class: "self-switch-control",
    dataset: { testid: "self-switch-control" },
  });
  let currentKey = key;
  let currentValue = value;

  const keysWrap = el("span", {
    class: "self-switch-keys",
    attrs: { role: "group", "aria-label": "이 이벤트 기억 칸" },
  });
  const keyButtons: HTMLButtonElement[] = [];
  for (const k of SELF_SWITCH_KEYS) {
    const btn = el("button", {
      class: `self-switch-key${k === key ? " active" : ""}`,
      attrs: { type: "button", "aria-pressed": String(k === key) },
      text: k,
      dataset: { key: k, testid: `${options.keyTestId ?? "self-switch-key"}-${k}` },
    }) as HTMLButtonElement;
    btn.addEventListener("click", () => {
      if (currentKey === k) return;
      currentKey = k;
      keyButtons.forEach((b) => {
        const active = b.dataset.key === k;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      onChange(currentKey, currentValue);
    });
    keyButtons.push(btn);
    keysWrap.append(btn);
  }

  const valueBtn = el("button", {
    class: `self-switch-value ${value ? "on" : "off"}`,
    attrs: { type: "button", "aria-pressed": String(value) },
    text: value ? "켜짐" : "꺼짐",
    dataset: { testid: options.valueTestId ?? "self-switch-value" },
  }) as HTMLButtonElement;
  valueBtn.addEventListener("click", () => {
    currentValue = !currentValue;
    valueBtn.classList.toggle("on", currentValue);
    valueBtn.classList.toggle("off", !currentValue);
    valueBtn.textContent = currentValue ? "켜짐" : "꺼짐";
    valueBtn.setAttribute("aria-pressed", String(currentValue));
    onChange(currentKey, currentValue);
  });

  wrap.append(keysWrap, valueBtn);
  return wrap;
}

export function renderSelfSwitchCondition(
  cond: Extract<Condition, { kind: "selfSwitch" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly className?: string;
    readonly keyTestId?: string;
    readonly valueTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  row.append(
    selfSwitchControl(cond.key, cond.value, (key, value) => onChange({ kind: "selfSwitch", key, value }), {
      keyTestId: options.keyTestId,
      valueTestId: options.valueTestId,
    })
  );
  return row;
}

function actorPicker(currentId: ActorId, onChange: (id: ActorId) => void): HTMLElement {
  return actorPickerControl(currentId, onChange, "event-condition-actor");
}

function itemPicker(currentId: ItemId, onChange: (id: ItemId) => void): HTMLElement {
  return itemPickerControl(currentId, onChange, "event-condition-item");
}

export function renderActorCondition(
  cond: Extract<Condition, { kind: "actor" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: ActorId, onChange: (id: ActorId) => void) => HTMLElement;
    readonly showPresent?: boolean;
    readonly forcePresentOnActorChange?: boolean;
    readonly className?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentActorId = cond.actorId;
  const sel = (options.picker ?? actorPicker)(cond.actorId, (actorId) => {
    currentActorId = actorId;
    onChange({ kind: "actor", actorId, present: options.forcePresentOnActorChange ? true : cond.present });
  });
  if (options.showPresent === false) {
    row.append(sel);
    return row;
  }
  const present = el("select", { dataset: { testid: "event-condition-actor-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "파티에 있음", attrs: { value: "true" } }),
    el("option", { text: "파티에 없음", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "actor", actorId: currentActorId, present: present.value === "true" });
  });
  row.append(sel, present);
  return row;
}

export function renderItemCondition(
  cond: Extract<Condition, { kind: "item" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly picker?: (currentId: ItemId, onChange: (id: ItemId) => void) => HTMLElement;
    readonly showPresent?: boolean;
    readonly forcePresentOnItemChange?: boolean;
    readonly className?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  let currentItemId = cond.itemId;
  const sel = (options.picker ?? itemPicker)(cond.itemId, (itemId) => {
    currentItemId = itemId;
    onChange({ kind: "item", itemId, present: options.forcePresentOnItemChange ? true : cond.present });
  });
  if (options.showPresent === false) {
    row.append(sel);
    return row;
  }
  const present = el("select", { dataset: { testid: "event-condition-item-present" } }) as HTMLSelectElement;
  present.append(
    el("option", { text: "소지함", attrs: { value: "true" } }),
    el("option", { text: "소지 안 함", attrs: { value: "false" } })
  );
  present.value = String(cond.present);
  present.addEventListener("change", () => {
    onChange({ kind: "item", itemId: currentItemId, present: present.value === "true" });
  });
  row.append(sel, present);
  return row;
}

export function renderGoldCondition(
  cond: Extract<Condition, { kind: "gold" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly className?: string;
    readonly opTestId?: string;
    readonly amountTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const op = selectWithOptions(CONDITION_OP_OPTIONS, cond.op, options.opTestId ?? "event-condition-gold-op");
  const amount = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.amount),
    dataset: { testid: options.amountTestId ?? "event-condition-gold-amount" },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "gold",
      op: selectedOptionValue(op, CONDITION_OP_OPTIONS, cond.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  row.append(op, amount);
  return row;
}

export function renderTimerCondition(
  cond: Extract<Condition, { kind: "timer" }>,
  onChange: (condition: Condition) => void,
  options: {
    readonly className?: string;
    readonly timerIdTestId?: string;
    readonly secondsTestId?: string;
    readonly minutesSeconds?: boolean;
    readonly minutesTestId?: string;
  } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const timerId = el("select", { dataset: { testid: options.timerIdTestId ?? "event-condition-timer-id" } }) as HTMLSelectElement;
  timerId.append(
    el("option", { text: "타이머 1", attrs: { value: "timer1" } }),
    el("option", { text: "타이머 2", attrs: { value: "timer2" } })
  );
  timerId.value = cond.timerId;
  if (options.minutesSeconds) {
    const minutes = el("input", {
      attrs: { type: "number", min: "0" },
      value: String(Math.floor(cond.seconds / 60)),
      dataset: { testid: options.minutesTestId ?? "event-condition-timer-minutes" },
    }) as HTMLInputElement;
    const seconds = el("input", {
      attrs: { type: "number", min: "0", max: "59" },
      value: String(cond.seconds % 60),
      dataset: { testid: options.secondsTestId ?? "event-condition-timer-seconds" },
    }) as HTMLInputElement;
    const apply = () => {
      onChange({
        kind: "timer",
        timerId: timerId.value === "timer2" ? "timer2" : "timer1",
        seconds: (parseInt(minutes.value, 10) || 0) * 60 + (parseInt(seconds.value, 10) || 0),
      });
    };
    timerId.addEventListener("change", apply);
    minutes.addEventListener("change", apply);
    seconds.addEventListener("change", apply);
    row.append(timerId, minutes, el("span", { text: "분" }), seconds, el("span", { text: "초 이하" }));
    return row;
  }
  const seconds = el("input", {
    attrs: { type: "number", min: "0" },
    value: String(cond.seconds),
    dataset: { testid: options.secondsTestId ?? "event-condition-timer-seconds" },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "timer",
      timerId: timerId.value === "timer2" ? "timer2" : "timer1",
      seconds: parseInt(seconds.value, 10) || 0,
    });
  };
  timerId.addEventListener("change", apply);
  seconds.addEventListener("change", apply);
  row.append(timerId, seconds);
  return row;
}

export function renderTimePhaseCondition(
  cond: Extract<Condition, { kind: "timePhase" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly phaseTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const phase = selectWithOptions(TIME_PHASE_OPTIONS, cond.phase, options.phaseTestId ?? "event-condition-time-phase");
  phase.addEventListener("change", () => {
    onChange({ kind: "timePhase", phase: selectedOptionValue(phase, TIME_PHASE_OPTIONS, cond.phase) });
  });
  row.append(phase);
  return row;
}

export function renderSeasonCondition(
  cond: Extract<Condition, { kind: "season" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly seasonTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const season = selectWithOptions(SEASON_OPTIONS, cond.season, options.seasonTestId ?? "event-condition-season");
  season.addEventListener("change", () => {
    onChange({ kind: "season", season: selectedOptionValue(season, SEASON_OPTIONS, cond.season) });
  });
  row.append(season);
  return row;
}

export function renderNpcActivityCondition(
  cond: Extract<Condition, { kind: "npcActivity" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly activityTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const activity = el("input", {
    attrs: { type: "text", placeholder: "일" },
    value: cond.activity,
    dataset: { testid: options.activityTestId ?? "event-condition-npc-activity" },
  }) as HTMLInputElement;
  activity.addEventListener("change", () => {
    onChange({ kind: "npcActivity", activity: activity.value.trim() || cond.activity });
  });
  row.append(activity);
  return row;
}

export function renderFriendshipAtLeastCondition(
  cond: Extract<Condition, { kind: "friendshipAtLeast" }>,
  onChange: (condition: Condition) => void,
  options: { readonly className?: string; readonly npcKeyTestId?: string; readonly valueTestId?: string } = {}
): HTMLElement {
  const row = el(options.className ? "div" : "span", options.className ? { class: options.className } : {});
  const npcKey = el("input", {
    attrs: { type: "text", placeholder: "비우면 이 이벤트" },
    value: cond.npcKey ?? "",
    dataset: { testid: options.npcKeyTestId ?? "event-condition-friendship-npc-key" },
  }) as HTMLInputElement;
  const value = el("input", {
    attrs: { type: "number", min: "0", max: "1000" },
    value: String(cond.value),
    dataset: { testid: options.valueTestId ?? "event-condition-friendship-value" },
  }) as HTMLInputElement;
  const apply = () => {
    onChange({
      kind: "friendshipAtLeast",
      npcKey: npcKey.value.trim() || undefined,
      value: parseInt(value.value, 10) || 0,
    });
  };
  npcKey.addEventListener("change", apply);
  value.addEventListener("change", apply);
  row.append(npcKey, value);
  return row;
}


function firstActorId(): ActorId {
  return store.getCurrent().database.actors[0]?.id ?? "";
}

function firstItemId(): ItemId {
  return store.getCurrent().database.items[0]?.id ?? "";
}
