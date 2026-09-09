import { applySystemWindowSkinVariable } from "@/player/systemGraphics";
import { shopBuyPromptText, shopGreetingText, shopListHeaderText } from "@/project/shopMessages";
import { el } from "@/util/dom";
import {
  goodsSellPrice,
  type ShopCategory,
  type ShopGoods,
} from "@/player/playSceneShopGoods";
import {
  applyAffordability,
  detailHero,
  detailStatGrid,
  entryPurse,
  goldPanel,
  keyHints,
  listingPrice,
  ownedPanel,
  partyPreview,
  quantityControl,
  shopBrandBlock,
  shopCategoryBar,
  shopItemRow,
  shopModeTabs,
  shopQuantityMaxIn,
  toGoods,
  updateShopQuantityTotalIn,
  type ShopListing,
  type ShopMode,
} from "@/player/playSceneShopParts";
import { emitRuntimeJuice, type RuntimeJuiceOptions } from "@/player/runtimeJuice";
import { SHOP_CONFIRM_KEY_LABEL, SHOP_FOCUS_GROUP_KEY_LABEL } from "@/player/keyBindings";
import type { ShopStep } from "@/player/playSceneShop";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ResolvedTerms } from "@/project/terms";

export type { ShopMode } from "@/player/playSceneShopParts";
export type ShopView = "menu" | "items" | "haggle";

type ShopType = NonNullable<ShopStep["shopType"]>;
type ShopMenuAction = ShopMode | "cancel";
type ShopItemAction = (item: ShopGoods, mode: ShopMode, count: number) => void;

type ShopItemsRenderRequest = {
  readonly scene: PlaySceneContext;
  readonly step: ShopStep;
  readonly items: readonly ShopListing[];
  readonly mode: ShopMode;
  readonly prompt: string;
  readonly terms: ResolvedTerms;
  /** 방문 중 남은 상인 소지금(매입 예산). */
  readonly merchantGold: number;
  readonly setStatus: (text: string) => void;
  readonly showMenu: () => void;
  readonly onItem: ShopItemAction;
  /** 카테고리 칩. 없으면 칩을 만들지 않는다(단위 테스트 등 최소 호출 경로). */
  readonly category?: ShopCategory | "all";
  readonly onCategory?: (next: ShopCategory | "all") => void;
  /**
   * 칩을 만드는 원본 목록 — 필터 걸기 전의 이 모드 전체 진열이다. `items` 로 칩을 만들면
   * 「장비」를 누른 순간 남는 종류가 하나뿐이라 칩줄이 사라지고 「전체」로 돌아올 길이 없어진다.
   */
  readonly categorySource?: readonly ShopListing[];
  /** 탭으로 구매/판매를 그 자리에서 바꾼다. 없으면 탭을 만들지 않는다. */
  readonly onMode?: (mode: ShopMode) => void;
  readonly onDetail?: () => void;
};

export { flashGoldDelta } from "@/player/playSceneShopParts";

export function createShopOverlay(): HTMLElement {
  const overlay = document.createElement("section");
  overlay.className = "runtime-overlay runtime-shop-overlay";
  overlay.dataset.testid = "shop-scene";
  // 모달 대화창 시맨틱 — 보조기술이 "가게 창이 떴고 그 안에 갇혀 있다"를 알 수 있어야 한다.
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "상점");
  // 오버레이는 스크림이다 — 윈도스킨 변수만 심고(border-image 없이) 표면은
  // 개별 창이 그린다. 이 노드에 fill 을 걸면 가게가 아니라 플레이 영역 전체를 덮는 한 장의 상자가 된다.
  applySystemWindowSkinVariable(overlay);
  return overlay;
}

/**
 * 입구 화면. 상인 얼굴 + 가게 정체성 + 인사말 + 소지금 + 큰 선택 카드.
 * 2003 클론 삼단 껍질(빈 상단/중단 패널 2개)은 예전에 덜어냈고, 이제 표면도 모던 카드다.
 *
 * `scene` 은 선택 인자다 — 단위 테스트는 4 인자로 부른다. 넘기면 상인 얼굴과 소지금이 실제
 * 세션 값으로 채워진다. 예전에는 항상 빈 스텁을 써서 입구에 얼굴도 지갑도 없었다.
 */
export function renderShopMenu(
  step: ShopStep,
  terms: ResolvedTerms,
  showItems: (mode: ShopMode) => void,
  finish: () => void,
  scene?: PlaySceneContext
): HTMLElement {
  const shell = el("div", { class: "runtime-shop-shell runtime-shop-menu-shell" });
  const context = scene ?? ({ session: { partyActorIds: [], gold: 0, inventory: {} } } as unknown as PlaySceneContext);
  const menu = el("div", { class: "runtime-shop-menu" });
  // 부제는 가게가 무엇을 하는 곳인지다. 인사말을 여기에도 넣으면 같은 문장이 두 줄로 겹친다.
  menu.append(
    shopBrandBlock(context, shopTitle(step), shopTagline(step)),
    shopMenuMessage(shopGreetingText(step.messageType, terms))
  );
  if (scene) menu.append(entryPurse(scene, terms));
  const choices = el("div", { class: "runtime-shop-menu-choices" });
  for (const action of shopMenuActions(step)) {
    choices.append(shopMenuButton(action, terms, showItems, finish, step));
  }
  menu.append(choices, keyHints([["↑↓", "선택"], ["Enter", "결정"], ["Esc", "나가기"]]));
  shell.append(shopWindow("runtime-shop-greeting-panel", [menu]));
  return shell;
}

/** 가게가 무엇을 하는 곳인지 한 줄. 서비스 종류마다 다르다. */
function shopTagline(step: ShopStep): string {
  if (step.shopServiceKind === "repair") return "장비를 손봐 드립니다.";
  if (step.shopServiceKind === "appraisal") return "물건의 값을 봐 드립니다.";
  if (step.shopServiceKind === "pawn") return "물건을 맡기고 돈을 받습니다.";
  if (step.shopType === "buyOnly") return "물건을 팝니다.";
  if (step.shopType === "sellOnly") return "물건을 사들입니다.";
  return "물건을 사고팝니다.";
}

export function renderShopItems(request: ShopItemsRenderRequest): HTMLElement {
  const goods = request.items.map(toGoods);
  const shell = el("div", {
    class: "runtime-shop-shell runtime-shop-items-shell",
    dataset: { shopMode: request.mode },
  });
  const first = goods[0];

  // ── 상단 바: 정체성(상인·가게) + 모드 탭 + 소지금. 한 줄에 "여기가 어디고 내가 얼마 있나"가 다 있다.
  const topbar = el("div", { class: "runtime-shop-topbar" });
  topbar.append(shopBrandBlock(
    request.scene,
    shopTitle(request.step),
    request.mode === "sell" ? "판매 · 내 소지품을 상인에게" : "구매 · 상인의 진열 상품"
  ));
  if (request.onMode) {
    const modes = shopMenuActions(request.step).filter((action): action is ShopMode => action !== "cancel");
    if (modes.length > 1) topbar.append(shopModeTabs(modes, request.mode, request.terms, request.onMode));
  }
  topbar.append(
    shopWindow("runtime-shop-gold-panel", [
      goldPanel(request.scene, request.terms, request.merchantGold, request.mode),
    ])
  );
  shell.append(topbar);

  // ── 본문: 목록 + 상세 카드.
  const body = el("div", { class: "runtime-shop-main" });
  const listChildren: HTMLElement[] = [];
  if (request.onCategory) {
    const source = request.categorySource ? request.categorySource.map(toGoods) : goods;
    const bar = shopCategoryBar(source, request.category ?? "all", request.onCategory);
    if (bar) listChildren.push(bar);
  }
  listChildren.push(shopItemList(request, goods));
  body.append(shopWindow("runtime-shop-list-panel", listChildren));

  const side = el("div", { class: "runtime-shop-side" });
  side.append(shopWindow("runtime-shop-detail-panel", [detailCard(request.scene, request.step, first)]));
  side.append(shopWindow("runtime-shop-party-panel", [partyPreview(request.scene)]));
  body.append(side);
  shell.append(body);

  // ── 하단: 상태 문구 + 수량 + 결정/취소 + 키 힌트.
  shell.append(
    shopWindow("runtime-shop-prompt-panel", [
      shopPrompt(request, first),
      keyHints(
        (request.step.quantityMode ?? "single") === "select"
          ? [[SHOP_FOCUS_GROUP_KEY_LABEL, "영역"], ["↑↓", "선택"], ["←→", "수량"], [SHOP_CONFIRM_KEY_LABEL, "결정"], ["Esc", "뒤로"]]
          : [[SHOP_FOCUS_GROUP_KEY_LABEL, "영역"], ["↑↓", "선택"], [SHOP_CONFIRM_KEY_LABEL, "결정"], ["Esc", "뒤로"]]
      ),
    ])
  );
  return shell;
}

/** 빈 상점 안내 — 예전에는 아무것도 안 띄우고 이벤트가 조용히 지나갔다(유령 상점). */
export function renderShopNotice(message: string, terms: ResolvedTerms, close: () => void): HTMLElement {
  const shell = el("div", { class: "runtime-shop-shell runtime-shop-menu-shell" });
  const menu = el("div", { class: "runtime-shop-menu runtime-shop-menu-notice" });
  menu.append(shopMenuMessage(message));
  const choices = el("div", { class: "runtime-shop-menu-choices" });
  const button = el("button", {
    class: "runtime-shop-menu-choice",
    text: terms.shopCancel,
    dataset: { testid: "shop-notice-close" },
    attrs: { type: "button" },
    on: { click: close },
  });
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
  return shopBuyPromptText(step.messageType);
}

/** 되팔기 값 — 정가의 절반, 최소 1G. 정가 0이면 0 유지(에디터에서 막는 게 정답). */
export function sellPrice(item: { readonly price: number }): number {
  return goodsSellPrice(item);
}

/** 커서가 아이템을 옮길 때 상세 카드의 보유 줄을 갱신. */
export function updateShopOwnedPanel(
  overlay: HTMLElement,
  scene: PlaySceneContext,
  item: ShopListing | undefined
): void {
  const host = overlay.querySelector<HTMLElement>("[data-testid='shop-owned-slot']");
  if (!host) return;
  clear(host);
  host.append(ownedPanel(scene, item ? toGoods(item) : undefined));
}

/**
 * 도움말을 커서가 얹힌 물건으로 갱신 — 설명 문장, 큰 아이콘, 장비 능력치까지 함께 바뀐다.
 * 설명이 비면 목록 안내문으로 되돌린다.
 */
export function updateShopHelpLine(overlay: HTMLElement, step: ShopStep, item: ShopListing | undefined): void {
  const goods = item ? toGoods(item) : undefined;
  const node = overlay.querySelector<HTMLElement>("[data-testid='shop-help-line']");
  if (node) node.textContent = helpLineText(step, goods);
  const heroSlot = overlay.querySelector<HTMLElement>("[data-testid='shop-hero-slot']");
  if (heroSlot) {
    clear(heroSlot);
    heroSlot.append(detailHero(goods));
  }
  const statSlot = overlay.querySelector<HTMLElement>("[data-testid='shop-stat-slot']");
  if (statSlot) {
    clear(statSlot);
    const grid = detailStatGrid(goods);
    if (grid) statSlot.append(grid);
  }
}

/**
 * 프롬프트 문구만 제자리에서 바꾼다 — 오버레이 전체를 다시 그리면 커서·포커스가 날아가고
 * live region 이 새로 생겨 낭독도 안 된다.
 */
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
  const panel = overlay.querySelector<HTMLElement>(".runtime-shop-gold-panel");
  if (!panel) return;
  clear(panel);
  panel.append(goldPanel(scene, terms, merchantGold, mode));
  const balance = overlay.querySelector<HTMLElement>("[data-testid='shop-balance-after']");
  if (balance) balance.dataset.gold = String(scene.session.gold);
}

/** 거래 후 한 행의 보유 수량과 '살 수 있는지' 표시를 제자리 갱신. */
export function refreshShopItemRow(
  overlay: HTMLElement,
  scene: PlaySceneContext,
  item: ShopListing,
  mode: ShopMode,
  terms: ResolvedTerms,
  merchantGold: number
): void {
  const goods = toGoods(item);
  const row = overlay.querySelector<HTMLElement>(`[data-testid='shop-${mode}-${goods.id}']`);
  if (!row) return;
  const owned = scene.session.inventory[goods.id] ?? 0;
  const ownedNode = row.querySelector<HTMLElement>(".runtime-shop-item-owned");
  if (ownedNode) ownedNode.textContent = `x${owned}`;
  applyAffordability(row, goods, mode, terms, scene.session.gold, merchantGold, owned);
}

/** 다 팔아서 0개가 된 행은 목록에서 뺀다 — 판매 목록은 소지품 목록이다. */
export function removeShopItemRow(overlay: HTMLElement, itemId: string, mode: ShopMode): void {
  overlay.querySelector(`[data-testid='shop-${mode}-${itemId}']`)?.remove();
}

/** 거절 피드백을 얹을 행. 없으면 null — 소리는 나고 흔들림만 생략된다. */
export function shopItemRowEl(overlay: HTMLElement, itemId: string, mode: ShopMode): HTMLElement | null {
  return overlay.querySelector<HTMLElement>(`[data-testid='shop-${mode}-${itemId}']`);
}

/**
 * 수량 select 모드에서 ←(-1)/→(+1) 로 수량 조절. 상한은 선택 행이 정한다(소지금 ÷ 단가,
 * 판매는 가진 개수와 상인 지갑). 상한에 부딪히면 버저를 울린다 — 조용히 안 움직이면
 * 키가 안 먹은 건지 상한인 건지 구분할 수 없다. 항상 소비(true).
 */
export function adjustShopQuantity(overlay: HTMLElement, dir: -1 | 1, audioContext?: Pick<RuntimeJuiceOptions, "project" | "session">): boolean {
  const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  if (!input) return true;
  const max = shopQuantityMaxIn(overlay);
  const current = Math.max(1, Number.parseInt(input.value, 10) || 1);
  const next = Math.min(max, Math.max(1, current + dir));
  if (next === current) {
    emitRuntimeJuice({ ...audioContext, event: "menu-invalid", target: input });
    return true;
  }
  input.value = String(next);
  updateShopQuantityTotal(overlay);
  return true;
}

export function updateShopQuantityTotal(overlay: HTMLElement): void {
  updateShopQuantityTotalIn(overlay);
}

/** 결정 버튼 라벨을 현재 모드에 맞춘다(구입/판매). */
export function updateShopConfirmLabel(overlay: HTMLElement, terms: ResolvedTerms, mode: ShopMode): void {
  const node = overlay.querySelector<HTMLElement>("[data-testid='shop-confirm']");
  if (node) node.textContent = mode === "sell" ? terms.shopSell : terms.shopBuy;
}

/* ────────────────────────── 내부 ────────────────────────── */

function shopItemList(request: ShopItemsRenderRequest, goods: readonly ShopGoods[]): HTMLElement {
  const wrap = el("div", { class: "runtime-shop-item-list", attrs: { role: "list" } });
  if (goods.length === 0) {
    wrap.append(
      el("div", {
        class: "runtime-shop-empty",
        dataset: { testid: "shop-item-list-empty" },
        text: request.mode === "sell" ? "팔 물건이 없습니다." : "파는 물건이 없습니다.",
      })
    );
    return wrap;
  }
  for (const [index, entry] of goods.entries()) {
    wrap.append(
      shopItemRow({
        goods: entry,
        scene: request.scene,
        mode: request.mode,
        terms: request.terms,
        merchantGold: request.merchantGold,
        selected: index === 0,
        onActivate: () => request.onItem(entry, request.mode, currentQuantity(request.step, wrapOverlay(wrap))),
      })
    );
  }
  return wrap;
}

/**
 * 상세 카드. 슬롯(hero/help/owned/stat)으로 쪼개 둔 이유는 커서가 움직일 때
 * 카드 전체가 아니라 바뀐 조각만 갈아끼우기 때문이다 — 전체 재렌더는 포커스와 낭독을 끊는다.
 */
function detailCard(scene: PlaySceneContext, step: ShopStep, goods: ShopGoods | undefined): HTMLElement {
  const card = el("div", { class: "runtime-shop-detail", dataset: { testid: "shop-detail-card" } });
  const heroSlot = el("div", { class: "runtime-shop-slot", dataset: { testid: "shop-hero-slot" } });
  heroSlot.append(detailHero(goods));
  const helpLine = el("div", {
    class: "runtime-shop-message runtime-shop-help-line",
    dataset: { testid: "shop-help-line" },
    text: helpLineText(step, goods),
  });
  const ownedSlot = el("div", { class: "runtime-shop-slot runtime-shop-owned-panel", dataset: { testid: "shop-owned-slot" } });
  ownedSlot.append(ownedPanel(scene, goods));
  const statSlot = el("div", { class: "runtime-shop-slot", dataset: { testid: "shop-stat-slot" } });
  const grid = detailStatGrid(goods);
  if (grid) statSlot.append(grid);
  card.append(heroSlot, helpLine, statSlot, ownedSlot);
  return card;
}

function helpLineText(step: ShopStep, goods: ShopGoods | undefined): string {
  const description = goods?.description?.trim();
  return description && description.length > 0 ? description : shopListHeaderText(step.messageType);
}

function shopPrompt(request: ShopItemsRenderRequest, first: ShopGoods | undefined): HTMLElement {
  const { terms, step, mode } = request;
  const wrap = el("div", { class: "runtime-shop-prompt" });
  // live region — 거래 결과가 제자리 갱신되므로 보조기술이 낭독할 수 있다.
  wrap.append(
    el("span", {
      class: "runtime-shop-status",
      dataset: { testid: "shop-status-text" },
      attrs: { role: "status", "aria-live": "polite" },
      text: request.prompt,
    })
  );
  if ((step.quantityMode ?? "single") === "select") {
    wrap.append(quantityControl(terms, first, mode, (dir) => adjustShopQuantity(wrapOverlay(wrap), dir)));
  }
  wrap.append(el("span", { class: "runtime-shop-balance-after", dataset: {
    testid: "shop-balance-after", gold: String(request.scene.session.gold), mode, goldUnit: terms.gold,
  } }));
  const actions = el("div", { class: "runtime-shop-prompt-actions" });
  if (request.onDetail) actions.append(el("button", {
    class: "runtime-shop-detail-open", text: "상세 / 장비 비교", dataset: { testid: "shop-detail-open" },
    attrs: { type: "button", ...(first ? {} : { disabled: "" }) }, on: { click: request.onDetail },
  }));
  actions.append(
    el("button", {
      class: "runtime-shop-confirm",
      text: mode === "sell" ? terms.shopSell : terms.shopBuy,
      dataset: { testid: "shop-confirm" },
      attrs: { type: "button", tabindex: "-1", ...(first ? {} : { disabled: "" }) },
      on: {
        click: () => {
          // 마우스로 결정 버튼을 눌렀을 때는 커서가 얹힌 행을 거래한다.
          const overlay = wrapOverlay(wrap);
          const row = overlay.querySelector<HTMLElement>(".runtime-shop-item-row.selected");
          row?.click();
        },
      },
    }),
    el("button", {
      class: "runtime-shop-cancel",
      text: terms.shopCancel,
      dataset: { testid: "shop-item-cancel" },
      attrs: { type: "button" },
      on: { click: request.showMenu },
    })
  );
  wrap.append(actions);
  if (!first) {
    const quantity = wrap.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
    if (quantity) quantity.disabled = true;
  }
  return wrap;
}

function wrapOverlay(node: HTMLElement): HTMLElement {
  return node.closest<HTMLElement>(".runtime-shop-overlay") ?? node;
}

function currentQuantity(step: ShopStep, overlay: HTMLElement): number {
  if ((step.quantityMode ?? "single") !== "select") return 1;
  const input = overlay.querySelector<HTMLInputElement>("[data-testid='shop-quantity-input']");
  const raw = input ? Number.parseInt(input.value, 10) : 1;
  return Math.min(99, Math.max(1, Number.isFinite(raw) ? raw : 1));
}

/**
 * 가게 창 한 칸. 과거 이름은 `shopBluePanel` 이었고 색까지 2003 클론 파랑 고정이었다 —
 * 표면은 commerce.css 가 그린다. 기본은 모던 글래스 카드고, backdrop-filter 를 못 쓰는
 * 환경에서는 자료집 System 윈도스킨 border-image 로 되돌아간다.
 */
function shopWindow(className: string, children: readonly Node[]): HTMLElement {
  const panel = el("div", { class: `runtime-shop-panel ${className}` });
  panel.append(...children);
  return panel;
}

function shopMenuMessage(text: string): HTMLElement {
  return el("div", { class: "runtime-shop-message", text });
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
  button.className = `runtime-shop-menu-choice runtime-shop-menu-choice-${action}`;
  // 라벨 + 한 줄 설명. 이름만 있는 버튼 세 개는 무엇이 다른지 읽히지 않는다.
  button.append(
    el("span", { class: "runtime-shop-menu-choice-label", text: menuActionLabel(action, terms) }),
    el("span", { class: "runtime-shop-menu-choice-hint", text: menuActionHint(action) })
  );
  button.dataset.testid = action === "cancel" ? "shop-menu-cancel" : `shop-mode-${action}`;
  const emptyPool = stepForPoolCheck ? isServicePoolEmpty(stepForPoolCheck) : false;
  if (emptyPool && action !== "cancel") {
    button.disabled = true;
    button.setAttribute("aria-label", `${button.textContent ?? ""} · 대상 없음 — 서비스 불가`.trim());
    button.dataset.disabledReason = "empty-pool";
  }
  button.addEventListener("click", () => {
    if (button.disabled) return;
    if (action === "cancel") finish();
    else showItems(action);
  });
  return button;
}

function menuActionHint(action: ShopMenuAction): string {
  if (action === "buy") return "진열된 물건을 산다";
  if (action === "sell") return "가진 물건을 넘긴다";
  return "가게에서 나간다";
}

function isServicePoolEmpty(step: ShopStep): boolean {
  if (step.shopServiceKind === "appraisal") {
    return !step.appraisalUnidentifiedPool || step.appraisalUnidentifiedPool.length === 0;
  }
  return false;
}

function shopMenuActions(step: ShopStep): ShopMenuAction[] {
  switch (shopType(step)) {
    case "buyOnly":
      return ["buy", "cancel"];
    case "sellOnly":
      return ["sell", "cancel"];
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

/**
 * 헤더에 걸리는 가게 이름. 「추가 서비스」를 고른 상점은 그 이름으로 불린다 —
 * 예전에는 서비스 설정이 런타임에 도달하지 않아 수리점도 감정소도 그냥 '상점'이었다.
 */
function shopTitle(step: ShopStep): string {
  switch (step.shopServiceKind) {
    case "repair":
      return "수리점";
    case "appraisal":
      return "감정소";
    case "pawn":
      return "전당포";
    default:
      return "상점";
  }
}

function clear(node: HTMLElement): void {
  while (node.firstChild) node.firstChild.remove();
}

/** 목록 행에서 현재 단가를 읽어야 하는 곳이 있어 재노출한다. */
export { listingPrice };


export type ShopHaggleRenderRequest = {
  readonly itemName: string;
  readonly reference: number;
  readonly offer: number;
  readonly patience: number;
  readonly merchantLine: string;
  readonly goldLabel: string;
  readonly onDelta: (dir: -1 | 1) => void;
  readonly onPropose: () => void;
  readonly onCancel: () => void;
};

export function renderShopHaggle(request: ShopHaggleRenderRequest): HTMLElement {
  const shell = el("div", { class: "runtime-shop-shell runtime-shop-haggle-shell" });
  const panel = el("div", { class: "runtime-shop-haggle", dataset: { testid: "shop-haggle-panel" } });
  panel.append(
    el("div", { class: "runtime-shop-message", text: request.merchantLine }),
    el("div", { text: `${request.itemName} · 기준가 ${request.reference} ${request.goldLabel}` }),
    el("div", {
      class: "runtime-shop-haggle-offer",
      dataset: { testid: "shop-haggle-offer" },
      text: String(request.offer),
    }),
    el("div", { text: `인내 ${request.patience}` }),
  );
  const actions = el("div", { class: "runtime-shop-prompt-actions" });
  actions.append(
    el("button", {
      class: "runtime-shop-menu-choice",
      text: "-",
      dataset: { testid: "shop-haggle-down" },
      attrs: { type: "button" },
      on: { click: () => request.onDelta(-1) },
    }),
    el("button", {
      class: "runtime-shop-confirm",
      text: "제시",
      dataset: { testid: "shop-haggle-propose" },
      attrs: { type: "button" },
      on: { click: request.onPropose },
    }),
    el("button", {
      class: "runtime-shop-menu-choice",
      text: "+",
      dataset: { testid: "shop-haggle-up" },
      attrs: { type: "button" },
      on: { click: () => request.onDelta(1) },
    }),
    el("button", {
      class: "runtime-shop-cancel",
      text: "포기",
      dataset: { testid: "shop-haggle-cancel" },
      attrs: { type: "button" },
      on: { click: request.onCancel },
    }),
  );
  panel.append(actions);
  shell.append(shopWindow("runtime-shop-prompt-panel", [panel]));
  return shell;
}
