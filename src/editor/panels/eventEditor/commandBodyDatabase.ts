import { store } from "@/project/store";
import { el } from "@/util/dom";
import { selectWithOptions, selectedOptionValue } from "./dom";
import type { ActorAmountOp, ActorEquipmentSlot, Command } from "@/project/types";
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

const EQUIPMENT_SLOT_OPTIONS = [
  { value: "weapon", label: "무기" },
  { value: "shield", label: "방패" },
  { value: "armor", label: "갑옷" },
  { value: "helmet", label: "투구" },
  { value: "accessory", label: "장식품" },
] as const satisfies readonly { readonly value: ActorEquipmentSlot; readonly label: string }[];

type ActorAmountCommand = Extract<Command, { kind: "changeExp" | "changeLevel" | "changeActorHp" | "changeActorMp" }>;

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

export function changeExpBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeExp" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeLevelBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeLevel" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeActorHpBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeActorHp" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeActorMpBody(context: CommandEditContext, cmd: Extract<Command, { kind: "changeActorMp" }>): HTMLElement {
  return actorAmountBody(context, cmd);
}

export function changeEquipmentBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "changeEquipment" }>
): HTMLElement {
  const project = store.getCurrent();
  const actor = recordSelect(project.database.actors, cmd.actorId, "주인공 선택", "change-equipment-actor-select");
  const slot = selectWithOptions(EQUIPMENT_SLOT_OPTIONS, cmd.slot, "change-equipment-slot-select");
  const equipment = recordSelect(project.database.equipment, cmd.equipmentId, "장비 해제", "change-equipment-equipment-select");
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "changeEquipment",
      actorId: actor.value,
      slot: selectedOptionValue(slot, EQUIPMENT_SLOT_OPTIONS, cmd.slot),
      equipmentId: equipment.value,
    });
  };
  actor.addEventListener("change", apply);
  slot.addEventListener("change", apply);
  equipment.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(actor, slot, equipment);
  return wrap;
}

export function recoverAllBody(context: CommandEditContext, cmd: Extract<Command, { kind: "recoverAll" }>): HTMLElement {
  const project = store.getCurrent();
  const actor = recordSelect(project.database.actors, cmd.actorId ?? "", "파티 전체", "recover-all-actor-select");
  actor.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "recoverAll",
      actorId: actor.value,
    });
  });
  return actor;
}

function actorAmountBody(context: CommandEditContext, cmd: ActorAmountCommand): HTMLElement {
  const project = store.getCurrent();
  const labels = actorAmountLabels(cmd.kind);
  const actor = recordSelect(project.database.actors, cmd.actorId, "주인공 선택", labels.actorTestId);
  const op = selectWithOptions(AMOUNT_OP_OPTIONS, cmd.op, labels.opTestId);
  const amount = numberInput(cmd.amount, labels.amountTitle, labels.amountTestId);
  const apply = () => {
    const next = actorAmountCommand(
      cmd.kind,
      actor.value,
      selectedOptionValue(op, AMOUNT_OP_OPTIONS, cmd.op),
      parseInt(amount.value, 10) || 0
    );
    context.actions.replaceCommand(context.path, next);
  };
  actor.addEventListener("change", apply);
  op.addEventListener("change", apply);
  amount.addEventListener("change", apply);
  const wrap = el("span", {});
  wrap.append(actor, op, amount);
  return wrap;
}

function actorAmountCommand(
  kind: ActorAmountCommand["kind"],
  actorId: string,
  op: ActorAmountOp,
  amount: number
): ActorAmountCommand {
  switch (kind) {
    case "changeExp":
      return { kind, actorId, op, amount };
    case "changeLevel":
      return { kind, actorId, op, amount };
    case "changeActorHp":
      return { kind, actorId, op, amount };
    case "changeActorMp":
      return { kind, actorId, op, amount };
  }
}

function actorAmountLabels(kind: ActorAmountCommand["kind"]): {
  readonly actorTestId: string;
  readonly opTestId: string;
  readonly amountTestId: string;
  readonly amountTitle: string;
} {
  switch (kind) {
    case "changeExp":
      return {
        actorTestId: "change-exp-actor-select",
        opTestId: "change-exp-op-select",
        amountTestId: "change-exp-amount-input",
        amountTitle: "경험치",
      };
    case "changeLevel":
      return {
        actorTestId: "change-level-actor-select",
        opTestId: "change-level-op-select",
        amountTestId: "change-level-amount-input",
        amountTitle: "레벨",
      };
    case "changeActorHp":
      return {
        actorTestId: "change-actor-hp-actor-select",
        opTestId: "change-actor-hp-op-select",
        amountTestId: "change-actor-hp-amount-input",
        amountTitle: "HP",
      };
    case "changeActorMp":
      return {
        actorTestId: "change-actor-mp-actor-select",
        opTestId: "change-actor-mp-op-select",
        amountTestId: "change-actor-mp-amount-input",
        amountTitle: "MP",
      };
  }
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
