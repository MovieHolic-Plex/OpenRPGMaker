import { applySystemGraphic } from "@/player/systemGraphics";
import { el } from "@/util/dom";
import type { ShopStep } from "@/player/playSceneShop";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ItemRecord } from "@/project/types/database";

export type ShopMode = "buy" | "sell";
export type ShopView = "menu" | "items";

type ShopType = NonNullable<ShopStep["shopType"]>;
type ShopMessageType = NonNullable<ShopStep["messageType"]>;
type ShopMenuAction = ShopMode | "cancel";
type ShopItemAction = (item: ItemRecord, mode: ShopMode, count: number) => void;

type ShopItemsRenderRequest = {
  readonly scene: PlaySceneContext;
  readonly step: ShopStep;
  readonly items: readonly ItemRecord[];
  readonly mode: ShopMode;
  readonly prompt: string;
  readonly setStatus: (text: string) => void;
  readonly showMenu: () => void;
  readonly onItem: ShopItemAction;
};

export function createShopOverlay(): HTMLElement {
  const overlay = document.createElement("section");
  overlay.className = "runtime-overlay runtime-shop-overlay";
  overlay.dataset.testid = "shop-scene";
  applySystemGraphic(overlay);
  return overlay;
}

export function renderShopMenu(step: ShopStep, showItems: (mode: ShopMode) => void, finish: () => void): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "runtime-shop-shell runtime-shop-menu-shell";
  shell.append(shopBluePanel("runtime-shop-top-panel", []), shopBluePanel("runtime-shop-middle-panel", []));
  const menu = document.createElement("div");
  menu.className = "runtime-shop-menu";
  menu.append(shopMenuMessage(messageLine(step)));
  const choices = document.createElement("div");
  choices.className = "runtime-shop-menu-choices";
  for (const action of shopMenuActions(step)) choices.append(shopMenuButton(action, showItems, finish));
  menu.append(choices);
  shell.append(shopBluePanel("runtime-shop-bottom-panel", [menu]));
  return shell;
}

export function renderShopItems(request: ShopItemsRenderRequest): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "runtime-shop-shell runtime-shop-items-shell";
  shell.append(
    shopBluePanel("runtime-shop-message-panel", [
      shopMenuMessage(request.mode === "sell" ? "무엇을 판매하시겠습니까?" : itemHeaderText(request.step)),
    ])
  );
  const main = document.createElement("div");
  main.className = "runtime-shop-main";
  main.append(
    shopBluePanel("runtime-shop-list-panel", [
      shopItemList(request.step, request.items, request.mode, request.onItem),
    ])
  );
  const side = document.createElement("div");
  side.className = "runtime-shop-side";
  side.append(shopBluePanel("runtime-shop-party-panel", [partyPreview(request.scene)]));
  side.append(shopBluePanel("runtime-shop-owned-panel", [ownedPanel(request.scene, request.items[0])]));
  side.append(shopBluePanel("runtime-shop-gold-panel", [goldPanel(request.scene)]));
  main.append(side);
  shell.append(main, shopBluePanel("runtime-shop-prompt-panel", [shopPrompt(request.prompt, request.showMenu)]));
  return shell;
}

export function defaultShopMode(step: ShopStep): ShopMode {
  return shopType(step) === "sellOnly" ? "sell" : "buy";
}

export function shopPromptText(step: ShopStep, mode: ShopMode): string {
  if (mode === "sell") return "무엇을 판매하시겠습니까?";
  return messageType(step) === "welcome" ? "무엇을 구매하시겠습니까?" : "구매할 물건을 고르세요.";
}

export function sellPrice(item: ItemRecord): number {
  return Math.max(0, Math.floor(item.price / 2));
}

function shopItemList(step: ShopStep, items: readonly ItemRecord[], mode: ShopMode, onItem: ShopItemAction): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-item-list";
  if (items.length === 0) {
    wrap.append(el("div", { class: "runtime-shop-empty", text: "No goods." }));
    return wrap;
  }
  for (const [index, item] of items.entries()) wrap.append(shopItemButton(step, item, mode, index, onItem));
  if ((step.quantityMode ?? "single") === "select") wrap.append(quantityControl());
  return wrap;
}

function shopItemButton(
  step: ShopStep,
  item: ItemRecord,
  mode: ShopMode,
  index: number,
  onItem: ShopItemAction
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-item-row";
  button.dataset.testid = `shop-${mode}-${item.id}`;
  button.append(
    el("span", { class: "runtime-shop-item-name", text: item.name }),
    el("span", { class: "runtime-shop-item-price", text: String(mode === "sell" ? sellPrice(item) : item.price) })
  );
  if (index === 0) button.classList.add("selected");
  button.addEventListener("click", () => onItem(item, mode, currentQuantity(step)));
  return button;
}

function quantityControl(): HTMLElement {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "99";
  input.value = "1";
  input.className = "runtime-commerce-quantity-input";
  input.dataset.testid = "shop-quantity-input";
  return input;
}

function currentQuantity(step: ShopStep): number {
  if ((step.quantityMode ?? "single") !== "select") return 1;
  const input = document.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  return input ? Math.max(1, Number.parseInt(input.value, 10) || 1) : 1;
}

function shopBluePanel(className: string, children: readonly Node[]): HTMLElement {
  const panel = document.createElement("div");
  panel.className = `runtime-shop-panel ${className}`;
  panel.append(...children);
  return panel;
}

function shopMenuMessage(text: string): HTMLElement {
  return el("div", { class: "runtime-shop-message", text });
}

function shopPrompt(text: string, showMenu: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-prompt";
  wrap.append(el("span", { text }));
  const back = document.createElement("button");
  back.type = "button";
  back.className = "runtime-shop-cancel";
  back.dataset.testid = "shop-item-cancel";
  back.textContent = "취소";
  back.addEventListener("click", showMenu);
  wrap.append(back);
  return wrap;
}

function shopMenuButton(action: ShopMenuAction, showItems: (mode: ShopMode) => void, finish: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-menu-choice";
  button.textContent = menuActionLabel(action);
  button.dataset.testid = action === "cancel" ? "shop-menu-cancel" : `shop-mode-${action}`;
  button.addEventListener("click", () => {
    if (action === "cancel") finish();
    else showItems(action);
  });
  return button;
}

function shopMenuActions(step: ShopStep): ShopMenuAction[] {
  switch (shopType(step)) {
    case "normal":
      return ["buy", "sell", "cancel"];
    case "buyOnly":
      return ["buy", "cancel"];
    case "sellOnly":
      return ["sell", "cancel"];
  }
}

function menuActionLabel(action: ShopMenuAction): string {
  switch (action) {
    case "buy":
      return "구입";
    case "sell":
      return "판매";
    case "cancel":
      return "취소";
  }
}

function shopType(step: ShopStep): ShopType {
  if (step.shopType) return step.shopType;
  return step.allowSell ? "normal" : "buyOnly";
}

function messageType(step: ShopStep): ShopMessageType {
  return step.messageType ?? "welcome";
}

function messageLine(step: ShopStep): string {
  switch (messageType(step)) {
    case "welcome":
      return "어서 오세요.";
    case "business":
      return "무엇이 필요하신가요?";
    case "direct":
      return "물건을 고르세요.";
  }
}

function itemHeaderText(step: ShopStep): string {
  switch (messageType(step)) {
    case "welcome":
      return "모든 캐릭터를 회복합니다. 전투 중에는 사용할 수 없습니다.";
    case "business":
      return "목록에서 물건을 고르세요.";
    case "direct":
      return "물건 하나를 고르세요.";
  }
}

function partyPreview(scene: PlaySceneContext): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-party";
  const actorIds = scene.session.partyActorIds.length ? scene.session.partyActorIds : ["actor_1", "actor_2", "actor_3", "actor_4"];
  for (const [index] of actorIds.slice(0, 4).entries()) {
    const sprite = el("span", { class: "runtime-shop-party-sprite" });
    sprite.dataset.actorSlot = String(index);
    wrap.append(sprite);
  }
  return wrap;
}

function ownedPanel(scene: PlaySceneContext, item: ItemRecord | undefined): HTMLElement {
  const owned = item ? scene.session.inventory[item.id] ?? 0 : 0;
  return el("div", {
    class: "runtime-shop-owned",
    children: [statLine("보유", owned), statLine("장비", 0)],
  });
}

function statLine(label: string, value: number): HTMLElement {
  return el("div", {
    class: "runtime-shop-stat-line",
    children: [el("span", { text: label }), el("span", { text: String(value) })],
  });
}

function goldPanel(scene: PlaySceneContext): HTMLElement {
  return el("div", { class: "runtime-shop-gold", text: `${scene.session.gold}G` });
}
