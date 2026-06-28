import { store } from "@/project/store";
import { el } from "@/util/dom";
import { selectWithOptions, selectedOptionValue } from "./dom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

const AMOUNT_OP_OPTIONS = [
  { value: "=", label: "대입" },
  { value: "+=", label: "증가" },
  { value: "-=", label: "감소" },
] as const;

const PARTY_ACTION_OPTIONS = [
  { value: "add", label: "파티에 추가" },
  { value: "remove", label: "파티에서 제거" },
] as const;

export function battleProcessingBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "battleProcessing" }>
): HTMLElement {
  const project = store.getCurrent();
  const troop = recordSelect(project.database.troops, cmd.troopId, "적 그룹 선택", "battle-processing-troop-select");
  const canEscape = checkbox("탈출 허용", cmd.canEscape, "battle-processing-escape-checkbox");
  const canLose = checkbox("패배 허용", cmd.canLose, "battle-processing-lose-checkbox");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "battleProcessing",
      troopId: troop.value,
      canEscape: canEscape.input.checked,
      canLose: canLose.input.checked,
    });
  };
  troop.addEventListener("change", apply);
  canEscape.input.addEventListener("change", apply);
  canLose.input.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(troop, canEscape.label, canLose.label);
  return wrap;
}

export function changeGoldBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeGold" }>): HTMLElement {
  const op = selectWithOptions(AMOUNT_OP_OPTIONS, cmd.op, "change-gold-op-select");
  const amount = numberInput(cmd.amount, "금액", "change-gold-amount-input");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeGold",
      op: selectedOptionValue(op, AMOUNT_OP_OPTIONS, cmd.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(op, amount);
  return wrap;
}

export function changeItemBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeItem" }>): HTMLElement {
  const project = store.getCurrent();
  const item = recordSelect(project.database.items, cmd.itemId, "아이템 선택", "change-item-select");
  const op = selectWithOptions(AMOUNT_OP_OPTIONS, cmd.op, "change-item-op-select");
  const amount = numberInput(cmd.amount, "개수", "change-item-amount-input");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeItem",
      itemId: item.value,
      op: selectedOptionValue(op, AMOUNT_OP_OPTIONS, cmd.op),
      amount: parseInt(amount.value, 10) || 0,
    });
  };
  item.addEventListener("change", apply);
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(item, op, amount);
  return wrap;
}

export function changePartyBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeParty" }>): HTMLElement {
  const project = store.getCurrent();
  const actor = recordSelect(project.database.actors, cmd.actorId, "주인공 선택", "change-party-actor-select");
  const action = selectWithOptions(PARTY_ACTION_OPTIONS, cmd.action, "change-party-action-select");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeParty",
      actorId: actor.value,
      action: selectedOptionValue(action, PARTY_ACTION_OPTIONS, cmd.action),
    });
  };
  actor.addEventListener("change", apply);
  action.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(actor, action);
  return wrap;
}

function recordSelect(
  records: readonly { readonly id: string; readonly name: string }[],
  currentId: string,
  placeholder: string,
  testId: string
): HTMLSelectElement {
  const select = el("select", { dataset: { testid: testId } }) as HTMLSelectElement;
  select.append(el("option", { text: `(${placeholder})`, attrs: { value: "" } }));
  for (const [index, record] of records.entries()) {
    select.append(el("option", { text: `${String(index + 1).padStart(4, "0")}: ${record.name}`, attrs: { value: record.id } }));
  }
  select.value = currentId;
  return select;
}

function numberInput(value: number, title: string, testId: string): HTMLInputElement {
  return el("input", {
    attrs: { type: "number", min: "0", title },
    value: String(value),
    dataset: { testid: testId },
  }) as HTMLInputElement;
}

function checkbox(text: string, checked: boolean, testId: string): { label: HTMLLabelElement; input: HTMLInputElement } {
  const input = el("input", {
    attrs: { type: "checkbox" },
    dataset: { testid: testId },
  }) as HTMLInputElement;
  input.checked = checked;
  const label = el("label", { text }) as HTMLLabelElement;
  label.prepend(input);
  return { label, input };
}
