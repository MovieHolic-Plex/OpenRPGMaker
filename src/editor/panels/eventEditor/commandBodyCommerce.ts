import { newCommand } from "@/editor/eventActions";
import { SHOP_TRANSACTION_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import type { Command, ItemId, ShopMessageType, ShopType } from "@/project/types";
import type { ItemRecord } from "@/project/types/database";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS } from "./options";
import type { CommandEditContext } from "./types";

type ShopCommand = Extract<Command, { kind: "shop" }>;
type InnCommand = Extract<Command, { kind: "inn" }>;
type ShopTypeOption = { readonly value: ShopType; readonly label: string };
type ShopMessageOption = { readonly value: ShopMessageType; readonly label: string };

const SHOP_TYPE_OPTIONS: readonly ShopTypeOption[] = [
  { value: "normal", label: "구매/판매" },
  { value: "buyOnly", label: "구매 전용" },
  { value: "sellOnly", label: "판매 전용" },
];

const SHOP_MESSAGE_OPTIONS: readonly ShopMessageOption[] = [
  { value: "welcome", label: "A: 어서 오세요" },
  { value: "business", label: "B: 무엇이 필요하신가요?" },
  { value: "direct", label: "C: 아이템을 선택하세요" },
];
export function shopBody(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const project = store.getCurrent();
  const wrap = el("div", {
    class: "commerce-command-body shop-processing-command-body",
    dataset: { testid: "shop-command-body" },
  });
  wrap.append(
    shopTopOptions(context, command),
    shopMessageSelect(context, command),
    shopItemsPanel(context, command, project.database.items),
    shopTransactionBranchControls(context, command),
    selectedSummary(project.database.items, command.itemIds)
  );
  return wrap;
}

export function innBody(context: CommandEditContext, command: InnCommand): HTMLElement {
  const wrap = el("div", {
    class: "commerce-command-body commerce-command-body-inline",
    dataset: { testid: "inn-command-body" },
  });
  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.value = String(command.price);
  price.title = "여관 요금";
  price.dataset.testid = "inn-price-input";
  price.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      kind: "inn",
      price: Number.parseInt(price.value, 10) || 0,
    });
  });
  wrap.append(
    el("label", { class: "commerce-command-title", text: "여관 요금" }),
    price,
    el("span", { class: "commerce-command-hint", text: "숙박 시 차감할 금액입니다." })
  );
  return wrap;
}

function shopTopOptions(context: CommandEditContext, command: ShopCommand): HTMLElement {
  return el("div", {
    class: "shop-processing-top",
    children: [shopTypeGroup(context, command), shopBranchOption(context, command)],
  });
}

function shopTypeGroup(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const groupName = `shop-type-${context.path.join("-") || "root"}`;
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-type" });
  fieldset.append(el("legend", { text: "상점 종류" }));
  const current = shopTypeValue(command);
  for (const option of SHOP_TYPE_OPTIONS) {
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = groupName;
    radio.value = option.value;
    radio.checked = current === option.value;
    radio.dataset.testid = `shop-type-${option.value}`;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      context.actions.replaceCommand(context.path, withShopType(command, option.value));
    });
    fieldset.append(optionLabel(radio, option.label));
  }
  return fieldset;
}

function shopBranchOption(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = command.branchOnTransaction ?? false;
  checkbox.dataset.testid = "shop-branch-on-transaction";
  checkbox.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, {
      ...command,
      branchOnTransaction: checkbox.checked,
      transactionBranch: checkbox.checked ? command.transactionBranch ?? [] : command.transactionBranch,
    });
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-option" });
  fieldset.append(el("legend", { text: "분기" }), optionLabel(checkbox, "구매/판매했을 때 분기"));
  return fieldset;
}

function shopTransactionBranchControls(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const branchSel = commandKindSelect("text");
  const add = el("button", {
    class: "btn shop-processing-branch-add",
    text: "+",
    dataset: { testid: "shop-add-transaction-branch-command" },
    attrs: { type: "button" },
    on: {
      click: () => {
        const next = newCommand(selectedOptionValue(branchSel, COMMAND_KIND_OPTIONS, "text"));
        context.actions.addCommand([...context.path, SHOP_TRANSACTION_BRANCH_INDEX], next);
      },
    },
  });
  const hiddenClass = command.branchOnTransaction ? "" : " is-hidden";
  return el("div", {
    class: `shop-processing-branch-controls${hiddenClass}`,
    dataset: { testid: "shop-transaction-branch-controls" },
    children: [el("span", { text: "구매/판매 분기" }), branchSel, add],
  });
}

function shopMessageSelect(context: CommandEditContext, command: ShopCommand): HTMLElement {
  const select = document.createElement("select");
  select.dataset.testid = "shop-message-type";
  select.value = messageTypeValue(command);
  for (const option of SHOP_MESSAGE_OPTIONS) {
    const optionNode = document.createElement("option");
    optionNode.value = option.value;
    optionNode.textContent = option.label;
    select.append(optionNode);
  }
  select.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { ...command, messageType: selectedMessageType(select.value) });
  });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-message" });
  fieldset.append(el("legend", { text: "메시지 유형" }), select);
  return fieldset;
}

function shopItemsPanel(context: CommandEditContext, command: ShopCommand, items: readonly ItemRecord[]): HTMLElement {
  const selectedItems = command.itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is ItemRecord => Boolean(item));
  const availableItems = items.filter((item) => !command.itemIds.includes(item.id));
  const selectedList = itemSelect("shop-selected-items", selectedItems);
  const availableList = itemSelect("shop-available-items", availableItems);
  const add = itemMoveButton("추가", "shop-add-item", () => {
    if (!availableList.value) return;
    context.actions.replaceCommand(context.path, {
      ...command,
      itemIds: addItemId(command.itemIds, availableList.value),
    });
  });
  const remove = itemMoveButton("제거", "shop-remove-item", () => {
    if (!selectedList.value) return;
    context.actions.replaceCommand(context.path, {
      ...command,
      itemIds: command.itemIds.filter((id) => id !== selectedList.value),
    });
  });
  add.disabled = availableItems.length === 0;
  remove.disabled = selectedItems.length === 0;
  const controls = el("div", { class: "shop-processing-item-controls", children: [add, remove] });
  const fieldset = el("fieldset", { class: "shop-processing-fieldset shop-processing-items" });
  fieldset.append(el("legend", { text: "판매 아이템" }));
  if (items.length === 0) {
    fieldset.append(el("div", { class: "commerce-command-empty", text: "등록된 아이템이 없습니다." }));
    return fieldset;
  }
  fieldset.append(
    el("div", {
      class: "shop-processing-item-grid",
      children: [selectedList, controls, availableList],
    })
  );
  return fieldset;
}

function optionLabel(input: HTMLInputElement, text: string): HTMLElement {
  return el("label", { class: "commerce-command-option", children: [input, el("span", { text })] });
}

function itemMoveButton(text: string, testId: string, click: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn shop-processing-move-button";
  button.textContent = text;
  button.dataset.testid = testId;
  button.addEventListener("click", click);
  return button;
}

function itemSelect(testId: string, items: readonly ItemRecord[]): HTMLSelectElement {
  const select = document.createElement("select");
  select.size = 14;
  select.className = "shop-processing-item-select";
  select.dataset.testid = testId;
  for (const item of items) {
    select.append(itemOption(item));
  }
  if (select.options.length > 0) select.selectedIndex = 0;
  return select;
}

function itemOption(item: ItemRecord): HTMLOptionElement {
  const option = document.createElement("option");
  option.value = item.id;
  option.textContent = `${item.name}    ${item.price}`;
  option.dataset.testid = `shop-list-item-${item.id}`;
  return option;
}

function addItemId(current: readonly ItemId[], itemId: string): ItemId[] {
  return current.includes(itemId) ? [...current] : [...current, itemId];
}

function shopTypeValue(command: ShopCommand): ShopType {
  if (command.shopType) return command.shopType;
  return command.allowSell ? "normal" : "buyOnly";
}

function withShopType(command: ShopCommand, shopType: ShopType): ShopCommand {
  return {
    ...command,
    shopType,
    allowSell: shopType !== "buyOnly",
  };
}

function messageTypeValue(command: ShopCommand): ShopMessageType {
  return command.messageType ?? "welcome";
}

function selectedMessageType(value: string): ShopMessageType {
  const option = SHOP_MESSAGE_OPTIONS.find((entry) => entry.value === value);
  return option?.value ?? "welcome";
}

function selectedSummary(items: readonly ItemRecord[], itemIds: readonly string[]): HTMLElement {
  const selectedItems = itemIds
    .map((id) => items.find((item) => item.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  return el("div", {
    class: "commerce-command-summary",
    text: selectedItems.length ? `선택한 아이템: ${selectedItems.join(", ")}` : "선택한 아이템: 없음",
    dataset: { testid: "shop-selection-summary" },
  });
}
