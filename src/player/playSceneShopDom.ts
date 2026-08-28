import { applySystemWindowSkinVariable } from "@/player/systemGraphics";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { el } from "@/util/dom";
import type { ShopStep } from "@/player/playSceneShop";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ItemRecord } from "@/project/types/database";
import type { ResolvedTerms } from "@/project/terms";

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
  readonly terms: ResolvedTerms;
  /** 방문 중 남은 상인 소지금(매입 예산). */
  readonly merchantGold: number;
  readonly setStatus: (text: string) => void;
  readonly showMenu: () => void;
  readonly onItem: ShopItemAction;
};

export function createShopOverlay(): HTMLElement {
  const overlay = document.createElement("section");
  overlay.className = "runtime-overlay runtime-shop-overlay";
  overlay.dataset.testid = "shop-scene";
  // 오버레이는 스크림이다 — 윈도스킨 변수만 심고(border-image 없이) 표면은
  // 개별 창(.runtime-shop-panel)이 그린다. 이 노드에 fill 을 걸면 가게가 아니라
  // 플레이 영역 전제를 덮는 한 장의 파란 상자가 된다.
  applySystemWindowSkinVariable(overlay);
  return overlay;
}

export function renderShopMenu(
  step: ShopStep,
  terms: ResolvedTerms,
  showItems: (mode: ShopMode) => void,
  finish: () => void
): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "runtime-shop-shell runtime-shop-menu-shell";
  // 2003 클론 삼단 껍질(빈 상단/중단 패널 2개)을 덜어냈다 — 입구는 인사말 + 세 선택이다.
  const menu = document.createElement("div");
  menu.className = "runtime-shop-menu";
  menu.append(shopMenuMessage(messageLine(step, terms)));
  const choices = document.createElement("div");
  choices.className = "runtime-shop-menu-choices";
  for (const action of shopMenuActions(step)) choices.append(shopMenuButton(action, terms, showItems, finish, step));
  menu.append(choices);
  shell.append(shopWindow("runtime-shop-greeting-panel", [menu]));
  return shell;
}

export function renderShopItems(request: ShopItemsRenderRequest): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "runtime-shop-shell runtime-shop-items-shell";
  shell.append(
    shopWindow("runtime-shop-message-panel", [
      shopMenuMessage(request.mode === "sell" ? request.terms.shopSellPrompt : itemHeaderText(request.step)),
    ])
  );
  const main = document.createElement("div");
  main.className = "runtime-shop-main";
  main.append(
    shopWindow("runtime-shop-list-panel", [
      shopItemList(request.scene, request.step, request.items, request.mode, request.onItem),
    ])
  );
  const side = document.createElement("div");
  side.className = "runtime-shop-side";
  side.append(shopWindow("runtime-shop-party-panel", [partyPreview(request.scene)]));
  side.append(shopWindow("runtime-shop-owned-panel", [ownedPanel(request.scene, request.items[0])]));
  side.append(
    shopWindow("runtime-shop-gold-panel", [
      goldPanel(request.scene, request.terms, request.merchantGold, request.mode),
    ])
  );
  main.append(side);
  shell.append(main, shopWindow("runtime-shop-prompt-panel", [shopPrompt(request.prompt, request.terms, request.showMenu)]));
  return shell;
}

export function defaultShopMode(step: ShopStep): ShopMode {
  return shopType(step) === "sellOnly" ? "sell" : "buy";
}

export function shopPromptText(step: ShopStep, mode: ShopMode, terms: ResolvedTerms): string {
  if (mode === "sell") return terms.shopSellPrompt;
  return messageType(step) === "welcome" ? "무엇을 구매하시겠습니까?" : "구매할 물건을 고르세요.";
}

export function sellPrice(item: ItemRecord): number {
  // price 0/1이면 floor/2==0 → 팔아도 0G, UX 혼란. 최소 1G는 보장하되 price 0은 판매 자체를 에디터에서 막는 게 정답. 런타임은 0이면 0 유지(에디터 경고).
  if (item.price <= 0) return 0;
  return Math.max(1, Math.floor(item.price / 2));
}

// 커서가 아이템을 옮길 때 우측 '보유' 패널을 선택 아이템 기준으로 갱신(RM2003 감각).
export function updateShopOwnedPanel(
  overlay: HTMLElement,
  scene: PlaySceneContext,
  item: ItemRecord | undefined
): void {
  const panel = overlay.querySelector(".runtime-shop-owned-panel");
  if (!panel) return;
  while (panel.firstChild) panel.firstChild.remove();
  panel.append(ownedPanel(scene, item));
}

// 수량 select 모드에서 ←(-1)/→(+1) 로 수량 입력을 1~99 범위로 조절. 항상 소비(true).
export function adjustShopQuantity(overlay: HTMLElement, dir: -1 | 1): boolean {
  const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  if (!input) return true;
  const current = Math.max(1, Number.parseInt(input.value, 10) || 1);
  input.value = String(Math.min(99, Math.max(1, current + dir)));
  return true;
}

function shopItemList(
  scene: PlaySceneContext,
  step: ShopStep,
  items: readonly ItemRecord[],
  mode: ShopMode,
  onItem: ShopItemAction
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-item-list";
  if (items.length === 0) {
    wrap.append(el("div", { class: "runtime-shop-empty", text: "No goods." }));
    return wrap;
  }
  for (const [index, item] of items.entries()) wrap.append(shopItemButton(scene, step, item, mode, index, onItem));
  if ((step.quantityMode ?? "single") === "select") wrap.append(quantityControl());
  return wrap;
}

function shopItemButton(
  scene: PlaySceneContext,
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
  const price = mode === "sell" ? sellPrice(item) : item.price;
  const owned = scene.session.inventory[item.id] ?? 0;
  button.append(
    shopItemIcon(item),
    el("span", { class: "runtime-shop-item-name", text: item.name }),
    el("span", {
      class: "runtime-shop-item-owned",
      text: `x${owned}`,
      dataset: { testid: `shop-owned-${item.id}` },
      attrs: { "aria-label": "파티 소지 수" },
    }),
    el("span", {
      class: "runtime-shop-item-price",
      text: String(price),
      dataset: { testid: `shop-price-${item.id}` },
    })
  );
  if (index === 0) button.classList.add("selected");
  button.addEventListener("click", () => onItem(item, mode, currentQuantity(step)));
  return button;
}

/** 자료집이 이미 저작해 둔 아이콘을 가게 목록에 그린다(상태 메뉴와 같은 우선순위:
 *  iconResourceId → imageResourceId). 글자만 있는 목록은 '무엇을 파는 가게'인지 안 보인다. */
function shopItemIcon(item: ItemRecord): HTMLElement {
  const icon = el("span", {
    class: "runtime-shop-item-icon",
    dataset: { testid: `shop-item-icon-${item.id}` },
  });
  const resourceId = item.iconResourceId ?? item.imageResourceId;
  const url = resourceId ? resolveAssetResourceUrl(resourceId) : undefined;
  if (url) {
    icon.style.backgroundImage = `url("${url}")`;
    icon.dataset.itemIconResource = resourceId ?? "";
  } else {
    // 아이콘이 없는 아이템은 이름 첫 글자 칩 — 빈 칸보다 읽힌다.
    icon.classList.add("runtime-shop-item-icon-fallback");
    icon.textContent = item.name.trim().slice(0, 1) || "?";
  }
  return icon;
}

function quantityControl(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-commerce-quantity-wrap";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "99";
  input.value = "1";
  input.className = "runtime-commerce-quantity-input";
  input.dataset.testid = "shop-quantity-input";
  input.setAttribute("aria-label", "수량: 좌우 방향키로 1에서 99까지 조절");
  input.addEventListener("input", () => {
    const raw = Number.parseInt(input.value, 10);
    const clamped = Math.min(99, Math.max(1, Number.isFinite(raw) ? raw : 1));
    if (String(clamped) !== input.value.trim()) input.value = String(clamped);
  });
  input.addEventListener("change", () => {
    const raw = Number.parseInt(input.value, 10);
    input.value = String(Math.min(99, Math.max(1, Number.isFinite(raw) ? raw : 1)));
  });
  const hint = document.createElement("span");
  hint.className = "runtime-commerce-quantity-hint";
  hint.textContent = "←/→ 1~99";
  wrap.append(input, hint);
  return wrap;
}

function currentQuantity(step: ShopStep): number {
  if ((step.quantityMode ?? "single") !== "select") return 1;
  // overlay 스코프 고정: 전역 document 조회가 다른 상점/오버레이 값을 읽는 간섭 방지 + 1..99 하드 클램프
  const overlay = document.querySelector<HTMLElement>(".runtime-shop-overlay");
  const input = overlay?.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']")
    ?? document.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  const raw = input ? Number.parseInt(input.value, 10) : 1;
  return Math.min(99, Math.max(1, Number.isFinite(raw) ? raw : 1));
}

/** 가게 창 한 칸. 과거 이름은 `shopBluePanel` 이었고 색까지 2003 클론 파랑 고정이었다 —
 *  이제 표면은 commerce.css 가 자료집 System 윈도스킨 변수로 그린다. */
function shopWindow(className: string, children: readonly Node[]): HTMLElement {
  const panel = document.createElement("div");
  panel.className = `runtime-shop-panel ${className}`;
  panel.append(...children);
  return panel;
}

function shopMenuMessage(text: string): HTMLElement {
  return el("div", { class: "runtime-shop-message", text });
}

function shopPrompt(text: string, terms: ResolvedTerms, showMenu: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-prompt";
  wrap.append(el("span", { text }));
  const back = document.createElement("button");
  back.type = "button";
  back.className = "runtime-shop-cancel";
  back.dataset.testid = "shop-item-cancel";
  back.textContent = terms.shopCancel;
  back.addEventListener("click", showMenu);
  wrap.append(back);
  return wrap;
}

function shopMenuButton(
  action: ShopMenuAction,
  terms: ResolvedTerms,
  showItems: (mode: ShopMode) => void,
  finish: () => void,
  stepForPoolCheck?: ShopStep
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-menu-choice";
  button.textContent = menuActionLabel(action, terms);
  button.dataset.testid = action === "cancel" ? "shop-menu-cancel" : `shop-mode-${action}`;
  const emptyPool = stepForPoolCheck ? isServicePoolEmpty(stepForPoolCheck) : false;
  if (emptyPool && action !== "cancel") {
    button.disabled = true;
    button.setAttribute("aria-label", `${button.textContent ?? "서비스"}: 대상 없음 — 서비스 불가`);
    (button as unknown as { dataset: Record<string,string> }).dataset["disabledReason"] = "empty-pool";
  }
  button.addEventListener("click", () => {
    if ((button as HTMLButtonElement).disabled) return;
    if (action === "cancel") finish();
    else showItems(action);
  });
  return button;
}

function isServicePoolEmpty(step: ShopStep): boolean {
  const svc = (step as unknown as { shopServiceKind?: string }).shopServiceKind;
  const pool = (step as unknown as { appraisalUnidentifiedPool?: string[] }).appraisalUnidentifiedPool;
  if (svc === "appraisal") return !pool || pool.length === 0;
  return false;
}
function shopMenuActions(step: ShopStep): ShopMenuAction[] {
  switch (shopType(step)) {
    case "normal":
      return ["buy", "sell", "cancel"];
    case "buyOnly":
      return ["buy", "cancel"];
    case "sellOnly":
      return ["sell", "cancel"];
    case "repair":
    case "appraisal":
    case "pawn":
    case "blackMarket":
    case "consignment":
      return ["buy", "sell", "cancel"];
    default:
      return ["buy", "sell", "cancel"];
  }
}

function menuActionLabel(action: ShopMenuAction, terms: ResolvedTerms): string {
  switch (action) {
    case "buy":
      return terms.shopBuy;
    case "sell":
      return terms.shopSell;
    case "cancel":
      return terms.shopCancel;
  }
}

function shopType(step: ShopStep): ShopType {
  if (step.shopType) return step.shopType;
  return step.allowSell ? "normal" : "buyOnly";
}

function messageType(step: ShopStep): ShopMessageType {
  return (step.messageType as ShopMessageType | undefined) ?? "welcome";
}

function messageLine(step: ShopStep, terms: ResolvedTerms): string {
  switch (messageType(step)) {
    case "welcome":
      return terms.shopGreeting;
    case "business":
      return "무엇이 필요하신가요?";
    case "direct":
      return "물건을 고르세요.";
    case "festival":
      return "축제 특가! 오늘만 이 가격!";
    case "closingSale":
      return "마감 세일 중! 어서 고르세요!";
    case "vip":
      return "VIP 고객님, 어서 오세요.";
    default:
      return terms.shopGreeting;
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
    case "festival":
      return "축제 한정 특가 목록입니다.";
    case "closingSale":
      return "마감 세일 목록 — 서두르세요!";
    case "vip":
      return "VIP 전용 혜택 목록입니다.";
    default:
      return "목록에서 물건을 고르세요.";
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
    dataset: { testid: "shop-owned-panel" },
    children: [
      el("div", { class: "runtime-shop-panel-title", text: item?.name ?? "보유" }),
      statLine("보유", owned),
      statLine("장비", 0),
    ],
  });
}

function statLine(label: string, value: number): HTMLElement {
  return el("div", {
    class: "runtime-shop-stat-line",
    children: [el("span", { text: label }), el("span", { text: String(value) })],
  });
}

function goldPanel(
  scene: PlaySceneContext,
  terms: ResolvedTerms,
  merchantGold: number,
  mode: ShopMode
): HTMLElement {
  const wrap = el("div", {
    class: "runtime-shop-gold",
    dataset: { testid: "shop-gold-panel" },
  });
  wrap.append(
    el("div", {
      class: "runtime-shop-gold-line",
      dataset: { testid: "shop-player-gold" },
      text: `${scene.session.gold}${terms.gold}`,
    }),
    el("div", {
      class: "runtime-shop-gold-line runtime-shop-merchant-gold",
      dataset: { testid: "shop-merchant-gold" },
      text: `상인 ${merchantGold}${terms.gold}`,
      attrs: {
        title:
          mode === "sell"
            ? "상인이 플레이어 물품을 살 때 남은 소지금"
            : "상인 소지금(플레이어 구매 시 증가)",
      },
    })
  );
  return wrap;
}

/** S/A/B: 장바구니·서비스 힌트 — append-only, 기존 플로우 무파괴. */
export function renderShopCartSummary(lines: readonly { itemId: string; qty: number; unitPrice: number }[], terms: ResolvedTerms): HTMLElement {
  const wrap = el("div", { class: "runtime-shop-cart-summary" });
  if (!lines.length) { wrap.append(el("div", { class: "runtime-shop-cart-empty", text: "장바구니 비어 있음" })); return wrap; }
  let total = 0; for (const l of lines) total += Math.max(1, l.qty|0) * Math.max(0, l.unitPrice|0);
  wrap.append(el("div", { class: "runtime-shop-cart-total", text: "합계 " + String(total) + terms.gold }));
  return wrap;
}
export function renderShopServiceHint(serviceKind: string|undefined, _terms: ResolvedTerms): HTMLElement|null {
  if(!serviceKind) return null;
  const label = serviceKind==="repair"?"수리":serviceKind==="appraisal"?"감정":serviceKind==="pawn"?"전당포":serviceKind;
  return el("div", { class: "runtime-shop-service-hint", text: String(label)+" 서비스" });
}
