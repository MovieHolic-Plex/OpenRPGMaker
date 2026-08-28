import { applySystemWindowSkinVariable } from "@/player/systemGraphics";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";
import { store } from "@/project/store";
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

/** 장비 슬롯을 가진 아이템 종류 — '장비' 줄은 이 종류에만 뜬다(잡화에 항상 0 은 잡음). */
const EQUIPPABLE_ITEM_TYPES: ReadonlySet<string> = new Set([
  "weapon",
  "shield",
  "body",
  "head",
  "accessory",
]);

export function createShopOverlay(): HTMLElement {
  const overlay = document.createElement("section");
  overlay.className = "runtime-overlay runtime-shop-overlay";
  overlay.dataset.testid = "shop-scene";
  // 모달 대화창 시맨틱 — 보조기술이 "가게 창이 떴고 그 안에 갇혀 있다"를 알 수 있어야 한다.
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "상점");
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
  // 상단 창은 RM2003의 도움말 창이다 — 커서가 얹힌 물건의 설명을 보여준다.
  shell.append(shopWindow("runtime-shop-message-panel", [shopHelpLine(request.step, request.items[0])]));
  const main = document.createElement("div");
  main.className = "runtime-shop-main";
  main.append(shopWindow("runtime-shop-list-panel", [shopItemList(request)]));
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
  shell.append(
    main,
    shopWindow("runtime-shop-prompt-panel", [
      shopPrompt(request.prompt, request.terms, request.showMenu, request.step, request.items[0], request.mode),
    ])
  );
  return shell;
}

/** 빈 상점 안내 — 예전에는 아무것도 안 띄우고 이벤트가 조용히 지나갔다(유령 상점). */
export function renderShopNotice(message: string, terms: ResolvedTerms, close: () => void): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "runtime-shop-shell runtime-shop-menu-shell";
  const menu = document.createElement("div");
  menu.className = "runtime-shop-menu";
  menu.append(shopMenuMessage(message));
  const choices = document.createElement("div");
  choices.className = "runtime-shop-menu-choices";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-menu-choice";
  button.dataset.testid = "shop-notice-close";
  button.textContent = terms.shopCancel;
  button.addEventListener("click", close);
  choices.append(button);
  menu.append(choices);
  shell.append(shopWindow("runtime-shop-greeting-panel", [menu]));
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

/** 도움말 창을 커서가 얹힌 물건의 설명으로 갱신. 설명이 비면 목록 안내문으로 되돌린다. */
export function updateShopHelpLine(overlay: HTMLElement, step: ShopStep, item: ItemRecord | undefined): void {
  const node = overlay.querySelector<HTMLElement>("[data-testid='shop-help-line']");
  if (!node) return;
  node.textContent = helpLineText(step, item);
}

/** 프롬프트 문구만 제자리에서 바꾼다 — 오버레이 전체를 다시 그리면 커서·포커스가 날아가고
 *  live region 이 새로 생겨 낭독도 안 된다. */
export function updateShopStatus(overlay: HTMLElement, text: string): void {
  const node = overlay.querySelector<HTMLElement>("[data-testid='shop-status-text']");
  if (!node) return;
  node.textContent = text;
}

/** 거래 후 소지금·상인 소지금 패널을 제자리 갱신. */
export function updateShopGoldPanel(
  overlay: HTMLElement,
  scene: PlaySceneContext,
  terms: ResolvedTerms,
  merchantGold: number,
  mode: ShopMode
): void {
  const panel = overlay.querySelector(".runtime-shop-gold-panel");
  if (!panel) return;
  while (panel.firstChild) panel.firstChild.remove();
  panel.append(goldPanel(scene, terms, merchantGold, mode));
}

/** 거래 후 한 행의 보유 수량과 '살 수 있는지' 표시를 제자리 갱신. */
export function refreshShopItemRow(
  overlay: HTMLElement,
  scene: PlaySceneContext,
  item: ItemRecord,
  mode: ShopMode,
  terms: ResolvedTerms,
  merchantGold: number
): void {
  const row = overlay.querySelector<HTMLElement>(`[data-testid='shop-${mode}-${item.id}']`);
  if (!row) return;
  const owned = scene.session.inventory[item.id] ?? 0;
  const ownedNode = row.querySelector<HTMLElement>(".runtime-shop-item-owned");
  if (ownedNode) ownedNode.textContent = `x${owned}`;
  applyAffordability(row, item, mode, terms, scene.session.gold, merchantGold, owned);
}

/** 다 팔아서 0개가 된 행은 목록에서 뺀다 — 판매 목록은 소지품 목록이다. */
export function removeShopItemRow(overlay: HTMLElement, itemId: string, mode: ShopMode): void {
  overlay.querySelector(`[data-testid='shop-${mode}-${itemId}']`)?.remove();
}

// 수량 select 모드에서 ←(-1)/→(+1) 로 수량 입력을 1~99 범위로 조절. 항상 소비(true).
export function adjustShopQuantity(overlay: HTMLElement, dir: -1 | 1): boolean {
  const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  if (!input) return true;
  const current = Math.max(1, Number.parseInt(input.value, 10) || 1);
  input.value = String(Math.min(99, Math.max(1, current + dir)));
  updateShopQuantityTotal(overlay);
  return true;
}

/** 수량 × 단가 합계. 커서 이동·수량 변경마다 다시 계산한다(합계가 없으면 얼마 나갈지 모른다). */
export function updateShopQuantityTotal(overlay: HTMLElement): void {
  const total = overlay.querySelector<HTMLElement>("[data-testid='shop-quantity-total']");
  if (!total) return;
  const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  const qty = Math.min(99, Math.max(1, Number.parseInt(input?.value ?? "1", 10) || 1));
  const row = overlay.querySelector<HTMLElement>(".runtime-shop-item-row.selected")
    ?? overlay.querySelector<HTMLElement>(".runtime-shop-item-row");
  const unit = Math.max(0, Number.parseInt(row?.dataset.unitPrice ?? "0", 10) || 0);
  total.textContent = `합계 ${unit * qty}${total.dataset.goldUnit ?? ""}`;
}

function shopItemList(request: ShopItemsRenderRequest): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-item-list";
  wrap.setAttribute("role", "list");
  if (request.items.length === 0) {
    wrap.append(
      el("div", {
        class: "runtime-shop-empty",
        dataset: { testid: "shop-item-list-empty" },
        text: request.mode === "sell" ? "팔 물건이 없습니다." : "파는 물건이 없습니다.",
      })
    );
    return wrap;
  }
  for (const [index, item] of request.items.entries()) wrap.append(shopItemButton(request, item, index));
  return wrap;
}

function shopItemButton(request: ShopItemsRenderRequest, item: ItemRecord, index: number): HTMLButtonElement {
  const { scene, step, mode, terms, merchantGold } = request;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "runtime-shop-item-row";
  button.dataset.testid = `shop-${mode}-${item.id}`;
  button.setAttribute("role", "listitem");
  const price = mode === "sell" ? sellPrice(item) : item.price;
  const owned = scene.session.inventory[item.id] ?? 0;
  // 합계 계산이 선택 행의 단가를 읽어간다.
  button.dataset.unitPrice = String(price);
  button.append(
    shopItemIcon(item),
    el("span", { class: "runtime-shop-item-name", text: item.name }),
    el("span", {
      class: "runtime-shop-item-owned",
      text: `x${owned}`,
      dataset: { testid: `shop-owned-${item.id}` },
      attrs: { title: "파티 소지 수" },
    }),
    el("span", {
      class: "runtime-shop-item-price",
      // 값만 있으면 단위를 알 수 없다 — 소지금 패널과 같은 단위를 붙인다.
      text: `${price}${terms.gold}`,
      dataset: { testid: `shop-price-${item.id}` },
    })
  );
  applyAffordability(button, item, mode, terms, scene.session.gold, merchantGold, owned);
  if (index === 0) button.classList.add("selected");
  button.addEventListener("click", () => request.onItem(item, mode, currentQuantity(step)));
  return button;
}

/** 살 수 있는지/팔 수 있는지를 행에 표시한다. disabled 로 막지 않는 이유: 커서가 못 얹히면
 *  비싼 물건의 설명조차 볼 수 없다(RM2003 도 커서는 얹히고 결정만 거절한다). */
function applyAffordability(
  row: HTMLElement,
  item: ItemRecord,
  mode: ShopMode,
  terms: ResolvedTerms,
  gold: number,
  merchantGold: number,
  owned: number
): void {
  const price = mode === "sell" ? sellPrice(item) : item.price;
  const blocked = mode === "sell" ? merchantGold < price : gold < price;
  const reason = mode === "sell" ? "상인 소지금 부족" : "소지금 부족";
  row.classList.toggle("is-unaffordable", blocked);
  if (blocked) row.dataset.unaffordable = "1";
  else delete row.dataset.unaffordable;
  const label = `${item.name} · ${price}${terms.gold} · 보유 ${owned}개`;
  row.setAttribute("aria-label", blocked ? `${label} · ${reason}` : label);
  row.title = blocked ? reason : "";
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

/** 수량 입력 + 합계. 예전에는 18행 목록의 마지막 자식이라 화면 밖에 있었다(1280x800 실측:
 *  입력칸 y=760, 목록 접힘선 밖). 프롬프트 줄로 올려 항상 보이게 한다. */
function quantityControl(terms: ResolvedTerms, item: ItemRecord | undefined, mode: ShopMode): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-commerce-quantity-wrap runtime-shop-quantity-wrap";
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "99";
  input.value = "1";
  input.className = "runtime-commerce-quantity-input";
  input.dataset.testid = "shop-quantity-input";
  input.title = "←/→ 로 1~99 수량 조절";
  input.setAttribute("aria-label", "수량");
  const clamp = () => {
    const raw = Number.parseInt(input.value, 10);
    const clamped = Math.min(99, Math.max(1, Number.isFinite(raw) ? raw : 1));
    if (String(clamped) !== input.value.trim()) input.value = String(clamped);
  };
  input.addEventListener("input", () => {
    clamp();
    bubbleTotal(input);
  });
  input.addEventListener("change", () => {
    const raw = Number.parseInt(input.value, 10);
    input.value = String(Math.min(99, Math.max(1, Number.isFinite(raw) ? raw : 1)));
    bubbleTotal(input);
  });
  const hint = el("span", { class: "runtime-commerce-quantity-hint", text: "←/→ 1~99" });
  const unitPrice = item ? (mode === "sell" ? sellPrice(item) : item.price) : 0;
  const total = el("span", {
    class: "runtime-shop-quantity-total",
    dataset: { testid: "shop-quantity-total", goldUnit: terms.gold },
    text: `합계 ${unitPrice}${terms.gold}`,
  });
  wrap.append(el("span", { class: "runtime-shop-quantity-label", text: "수량" }), input, hint, total);
  return wrap;
}

function bubbleTotal(node: HTMLElement): void {
  const overlay = node.closest<HTMLElement>(".runtime-shop-overlay");
  if (overlay) updateShopQuantityTotal(overlay);
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

/** 도움말 창 — 커서가 얹힌 물건의 설명. 예전 welcome 분기는 "모든 캐릭터를 회복합니다…"
 *  라는 아이템 효과 문장이 머리글에 박혀 있었다. */
function shopHelpLine(step: ShopStep, item: ItemRecord | undefined): HTMLElement {
  return el("div", {
    class: "runtime-shop-message runtime-shop-help-line",
    dataset: { testid: "shop-help-line" },
    text: helpLineText(step, item),
  });
}

function helpLineText(step: ShopStep, item: ItemRecord | undefined): string {
  const description = item?.description?.trim();
  return description && description.length > 0 ? description : itemHeaderText(step);
}

function shopPrompt(
  text: string,
  terms: ResolvedTerms,
  showMenu: () => void,
  step: ShopStep,
  firstItem: ItemRecord | undefined,
  mode: ShopMode
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-prompt";
  // live region — 거래 결과가 제자리 갱신되므로 보조기술이 낭독할 수 있다.
  wrap.append(
    el("span", {
      class: "runtime-shop-status",
      dataset: { testid: "shop-status-text" },
      attrs: { role: "status", "aria-live": "polite" },
      text,
    })
  );
  if ((step.quantityMode ?? "single") === "select") wrap.append(quantityControl(terms, firstItem, mode));
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
    button.title = "대상 없음 — 서비스 불가";
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
      return "목록에서 물건을 고르세요.";
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

/** 파티 얼굴. 예전에는 스프라이트를 넣는 코드가 없어 --bg-inset(에디터 밝은 회색) 로 칠한
 *  빈 사각형이 갈색 창틀 위에 흰 박스로 떠 있었다. */
function partyPreview(scene: PlaySceneContext): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "runtime-shop-party";
  const project = store.getCurrent();
  const actorIds = scene.session.partyActorIds.length
    ? scene.session.partyActorIds
    : ["actor_1", "actor_2", "actor_3", "actor_4"];
  for (const [index, actorId] of actorIds.slice(0, 4).entries()) {
    const record = project.database.actors.find((entry) => entry.id === actorId);
    const name = record?.name ?? actorId;
    const sprite = el("span", {
      class: "runtime-shop-party-sprite",
      dataset: { testid: `shop-party-sprite-${actorId}` },
      attrs: { role: "img", "aria-label": name, title: name },
    });
    sprite.dataset.actorSlot = String(index);
    const resourceId = scene.session.actorFaceResourceIds?.[actorId]
      ?? record?.faceResourceId
      ?? (record ? defaultActorFaceResourceId(record) : undefined);
    const url = resourceId ? resolveAssetResourceUrl(resourceId, { project }) : undefined;
    if (url) {
      sprite.style.backgroundImage = `url("${url}")`;
      sprite.dataset.faceResourceId = resourceId ?? "";
    } else {
      // 얼굴이 없으면 이름 첫 글자 — 빈 흰 박스보다 읽힌다.
      sprite.classList.add("runtime-shop-party-sprite-fallback");
      sprite.textContent = name.trim().slice(0, 1) || "?";
    }
    wrap.append(sprite);
  }
  return wrap;
}

function ownedPanel(scene: PlaySceneContext, item: ItemRecord | undefined): HTMLElement {
  const owned = item ? scene.session.inventory[item.id] ?? 0 : 0;
  const children: HTMLElement[] = [
    el("div", { class: "runtime-shop-panel-title", text: item?.name ?? "보유" }),
    statLine("보유", owned),
  ];
  // '장비' 는 장비 종류에만 붙인다 — 예전에는 종류와 무관하게 상수 0 이었다.
  if (item && EQUIPPABLE_ITEM_TYPES.has(item.type)) children.push(statLine("장비", equippedCount(scene, item.id)));
  return el("div", {
    class: "runtime-shop-owned",
    dataset: { testid: "shop-owned-panel" },
    children,
  });
}

/** 파티가 지금 차고 있는 개수. */
function equippedCount(scene: PlaySceneContext, itemId: string): number {
  const equipment = scene.session.actorEquipment;
  if (!equipment) return 0;
  let count = 0;
  for (const actorId of scene.session.partyActorIds) {
    const slots = equipment[actorId];
    if (!slots) continue;
    for (const value of Object.values(slots)) if (value === itemId) count += 1;
  }
  return count;
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
  // 예전에는 플레이어 금액만 라벨 없이 "300G", 상인 쪽만 "상인 100G" 로 비대칭이었다.
  wrap.append(
    goldLine("소지금", `${scene.session.gold}${terms.gold}`, "shop-player-gold"),
    goldLine("상인", `${merchantGold}${terms.gold}`, "shop-merchant-gold", {
      className: "runtime-shop-merchant-gold",
      title:
        mode === "sell"
          ? "상인이 플레이어 물품을 살 때 남은 소지금"
          : "상인 소지금(플레이어 구매 시 증가)",
    })
  );
  return wrap;
}

function goldLine(
  label: string,
  value: string,
  testid: string,
  options?: { readonly className?: string; readonly title?: string }
): HTMLElement {
  return el("div", {
    class: `runtime-shop-gold-line${options?.className ? ` ${options.className}` : ""}`,
    dataset: { testid },
    attrs: options?.title ? { title: options.title } : undefined,
    children: [
      el("span", { class: "runtime-shop-gold-label", text: label }),
      el("span", { class: "runtime-shop-gold-value", text: value }),
    ],
  });
}
