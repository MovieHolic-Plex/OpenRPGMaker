import { changeGold, changeItemsAtomically, GOLD_MAX } from "@/project/session";
import {
  isSafeEconomyRecord,
  isSafeEconomyValue,
  isSafeShopTradeCountsRecord,
} from "@/project/economyValues";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { store } from "@/project/store";
import { resolveTerms, type ResolvedTerms } from "@/project/terms";
import { resolveShopMerchantBudget } from "@/project/shopStock";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import {
  adjustShopQuantity,
  createShopOverlay,
  defaultShopMode,
  flashGoldDelta,
  refreshShopItemRow,
  removeShopItemRow,
  renderShopItems,
  renderShopMenu,
  renderShopNotice,
  sellPrice,
  shopPromptText,
  updateShopGoldPanel,
  updateShopHelpLine,
  updateShopOwnedPanel,
  updateShopQuantityTotal,
  updateShopStatus,
  type ShopMode,
  type ShopView,
} from "@/player/playSceneShopDom";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { goodsIndex, type ShopCategory, type ShopGoods } from "@/player/playSceneShopGoods";

export type ShopStep = Extract<StepResult, { kind: "shop" }>;

export function playShop(scene: PlaySceneContext, step: ShopStep): Promise<boolean | "failed"> {
  const stockItems = shopItems(step);
  const terms = resolveTerms(store.getCurrent());
  const failedResult = () => (step.branchOnFailedTransaction ? ("failed" as const) : false);
  // 수리/감정: 빈 풀은 “거래 불가”로 간주 (빈 풀에 수리비 청구 방지)
  const svc = step.shopServiceKind;
  const appraisalPool = step.appraisalUnidentifiedPool;
  if ((svc === "appraisal" && (!appraisalPool || appraisalPool.length === 0)) || (svc === "repair" && stockItems.length === 0)) {
    // 실패로 간주 — 골드 환불 전제(수리비는 handleShopTransaction 이전이므로 차감 없음)
    return showShopNotice(scene, terms, "지금은 해 드릴 일이 없습니다.").then(failedResult);
  }
  // 빈 상점도 안내는 띄운다 — 예전에는 아무것도 안 보여줘서 이벤트가 조용히 지나갔다(유령 상점).
  if (stockItems.length === 0) {
    return showShopNotice(scene, terms, "지금은 팔 물건이 없습니다.").then(failedResult);
  }
  // 방문마다 상인 소지금을 명령값(기본 100G) × 투자 레벨 배수로 초기화. 방문 중 매입/매도로 증감.
  let merchantGold = resolveShopMerchantBudget(step.merchantGold, step.investmentLevel);
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    let view: ShopView = "menu";
    let mode: ShopMode = defaultShopMode(step);
    // 판매는 소지품 목록이다 — 진열품을 그대로 보여주면 보유 0 인 행을 눌러 실패만 한다.
    let viewItems: ShopGoods[] = stockItems;
    let statusText = shopPromptText(step, mode, terms);
    let transactionCompleted = false;
    // 카테고리 칩 상태. 진열이 30줄쯤 되면 "약만 보기"가 없으면 못 찾는다.
    // 필터는 저작 순서를 흐트러뜨리지 않는다(itemIds 순서 유지).
    let category: ShopCategory | "all" = "all";
    // 커서 메뉴는 매 렌더마다 재부착한다(뷰/상태 변경 시 overlay 전체 재빌드).
    // 커서 위치는 뷰별 인덱스로 보존해 상태 메시지 갱신에도 자리를 유지한다.
    let detachCursor: (() => void) | null = null;
    let menuCursor = 0;
    let itemCursor = 0;
    const teardownCursor = (): void => {
      detachCursor?.();
      detachCursor = null;
    };
    const finish = () => {
      teardownCursor();
      // 한 번도 거래하지 않고 나갔으면 '거래 없음'이다 — 예전에는 늘 false 로 resolve 해서
      // branchOnFailedTransaction 을 켜도 실패 분기가 도달 불가능한 죽은 코드였다.
      finishCommerce(scene, overlay, resolve, transactionCompleted ? true : failedResult());
    };
    const attachShopCursor = (): (() => void) => {
      if (view === "menu") {
        // 구입/판매/취소 — ←→ 또는 ↑↓ 로 이동(1D), Z/Enter 결정, X/Esc(=취소).
        return attachCursorMenu(overlay, {
          items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice")),
          cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-menu-cancel']"),
          initialIndex: menuCursor,
          onSelect: (index) => {
            menuCursor = index;
          },
        });
      }
      // 아이템 목록 — ↑↓ 이동, 선택 시 보유·도움말·합계 갱신, select 수량모드면 ←→ 로 수량 ±1.
      const selectMode = (step.quantityMode ?? "single") === "select";
      return attachCursorMenu(overlay, {
        items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-item-row")),
        cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-item-cancel']"),
        initialIndex: itemCursor,
        onSelect: (index) => {
          itemCursor = index;
          updateShopOwnedPanel(overlay, scene, viewItems[index]);
          updateShopHelpLine(overlay, step, viewItems[index]);
          updateShopQuantityTotal(overlay);
        },
        onHorizontal: selectMode ? (dir) => adjustShopQuantity(overlay, dir) : undefined,
      });
    };
    const renderShop = () => {
      teardownCursor();
      clearElement(overlay);
      if (view === "items") viewItems = listForMode(mode);
      overlay.append(
        view === "menu"
          ? renderShopMenu(step, terms, showItems, finish, scene)
          : renderShopItems({
              scene,
              step,
              items: viewItems,
              mode,
              prompt: statusText,
              terms,
              merchantGold,
              setStatus,
              showMenu,
              category,
              categorySource: baseForMode(mode),
              onCategory: (next) => {
                category = next;
                itemCursor = 0;
                renderShop();
              },
              // 입구 메뉴로 되돌아가지 않고 그 자리에서 구매/판매를 바꾼다.
              onMode: (next) => {
                if (next !== mode) showItems(next);
              },
              onItem: (item, nextMode, count) => {
                const result = handleShopTransaction(scene, item, nextMode, count, merchantGold);
                if (!result.ok) {
                  setStatus(result.status);
                  return;
                }
                // 상태 메시지 갱신 전에 상인 소지금을 반영해야 패널 숫자가 맞다.
                merchantGold = result.merchantGold;
                if (nextMode === "buy") {
                  accrueShopLoyalty(scene, step, item.price * clampQuantity(count));
                }
                transactionCompleted = true;
                // 소지금 변화를 눈에 보이게 띄운다 — 숫자만 조용히 바뀌면 놓친다.
                const qty = clampQuantity(count);
                const delta = nextMode === "buy" ? -item.price * qty : sellPrice(item) * qty;
                flashGoldDelta(overlay, delta, terms.gold);
                // 구매 후에도 가게에 머문다 — 예전에는 여기서 finish() 를 불러 한 개 사면
                // 창이 닫히고, 만들어 둔 확인 메시지(result.status)는 버려졌다.
                applyTransactionResult(item, nextMode, result.status);
              },
            })
      );
      detachCursor = attachShopCursor();
    };
    const showMenu = () => {
      view = "menu";
      renderShop();
    };
    const showItems = (nextMode: ShopMode) => {
      mode = nextMode;
      view = "items";
      itemCursor = 0;
      // 구매 목록과 판매 목록의 구성이 다르므로 필터는 모드 전환 때 초기화한다.
      category = "all";
      viewItems = listForMode(nextMode);
      statusText = viewItems.length === 0 ? emptyListText(nextMode) : shopPromptText(step, mode, terms);
      renderShop();
    };
    /** 실패 메시지는 제자리에서만 바꾼다 — 전체 재렌더는 커서·포커스를 날리고 낭독도 끊는다. */
    const setStatus = (text: string) => {
      statusText = text;
      updateShopStatus(overlay, statusText);
    };
    /** 거래 성공 후 화면 반영. 판매로 0개가 된 행은 목록에서 빼고 커서를 다시 잡는다. */
    const applyTransactionResult = (item: ShopGoods, txMode: ShopMode, status: string) => {
      statusText = status;
      if (txMode === "sell" && (scene.session.inventory[item.id] ?? 0) <= 0) {
        viewItems = viewItems.filter((entry) => entry.id !== item.id);
        removeShopItemRow(overlay, item.id, txMode);
        if (viewItems.length === 0) {
          renderShop();
          return;
        }
        teardownCursor();
        detachCursor = attachShopCursor();
      }
      updateShopStatus(overlay, statusText);
      updateShopGoldPanel(overlay, scene, terms, merchantGold, mode);
      for (const entry of viewItems) refreshShopItemRow(overlay, scene, entry, mode, terms, merchantGold);
      updateShopOwnedPanel(overlay, scene, viewItems[itemCursor]);
      updateShopQuantityTotal(overlay);
    };
    /** 필터를 걸지 않은 이 모드의 전체 진열. 카테고리 칩은 늘 이 목록으로 만든다. */
    const baseForMode = (nextMode: ShopMode): ShopGoods[] =>
      nextMode === "sell" ? sellableItems(scene, stockItems) : stockItems;
    const listForMode = (nextMode: ShopMode): ShopGoods[] => {
      const base = baseForMode(nextMode);
      return category === "all" ? base : base.filter((goods) => goods.category === category);
    };
    // 먼저 마운트한 뒤 렌더해야 첫 커서 focus/scrollIntoView 가 연결된 노드에서 동작한다.
    mountCommerceOverlay(scene, overlay);
    renderShop();
  });
}

function emptyListText(mode: ShopMode): string {
  return mode === "sell" ? "팔 물건이 없습니다." : "파는 물건이 없습니다.";
}

export function clampQuantity(count: number): number {
  return Math.min(99, Math.max(1, Math.floor(count) || 1));
}

/**
 * 마일리지·누적 지출 적립. 예전에는 `pause` 가 mileageRate/loyaltyTierId 를 넘기지 않아
 * 이 계산이 늘 0 이었고(적립 null), 티어 키도 항상 "global" 로만 쌓였다.
 */
function accrueShopLoyalty(scene: PlaySceneContext, step: ShopStep, cost: number): void {
  const session = scene.session as typeof scene.session & {
    shopLoyaltySpend?: Record<string, number>;
    shopMileagePoints?: number;
  };
  const tierKey = step.loyaltyTierId ?? "global";
  const spend = session.shopLoyaltySpend ?? {};
  session.shopLoyaltySpend = spend;
  spend[tierKey] = (spend[tierKey] ?? 0) + cost;
  const rate = step.mileageRate;
  if (typeof rate === "number" && rate > 0) {
    const earned = cost * Math.min(0.1, Math.max(0, rate));
    session.shopMileagePoints = Math.floor((session.shopMileagePoints ?? 0) + earned);
  }
  scene.syncRuntimeState();
}

/**
 * 판매 목록 = 지금 가진 물건. 진열품이면 상점이 매긴 가격을 그대로 써서 되팔기 값을 낸다.
 *
 * 아이템과 장비를 함께 훑는다(장비도 같은 `session.inventory` 에 담긴다). id 중복 프로젝트에서
 * 같은 물건이 두 줄로 나오던 문제를 goodsIndex 가 id 유일성으로 막는다.
 */
function sellableItems(scene: PlaySceneContext, stockItems: readonly ShopGoods[]): ShopGoods[] {
  const priced = new Map(stockItems.map((item) => [item.id, item]));
  const owned: ShopGoods[] = [];
  for (const goods of goodsIndex(store.getCurrent()).values()) {
    if ((scene.session.inventory[goods.id] ?? 0) <= 0) continue;
    owned.push(priced.get(goods.id) ?? goods);
  }
  return owned;
}

/** 거래할 게 없는 상점도 창은 띄운다 — 안내를 읽고 닫는 것까지가 한 흐름이다. */
function showShopNotice(scene: PlaySceneContext, terms: ResolvedTerms, message: string): Promise<void> {
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    let detach: (() => void) | null = null;
    const close = () => {
      detach?.();
      detach = null;
      overlay.remove();
      scene.syncRuntimeState();
      resolve();
    };
    mountCommerceOverlay(scene, overlay);
    overlay.append(renderShopNotice(message, terms, close));
    detach = attachCursorMenu(overlay, {
      items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-menu-choice")),
      cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-notice-close']"),
    });
  });
}

/**
 * 진열 목록을 해석한다. 아이템 탭과 장비 탭을 함께 본다 —
 * 예전에는 `database.items` 만 봐서 장비 id 는 조용히 사라졌고(무기점 불가),
 * 아이템 탭에 무기 타입 레코드를 새로 만들어 우회해도 장비 메뉴가 못 찾아 장착이 안 됐다.
 */
function shopItems(step: ShopStep): ShopGoods[] {
  const index = goodsIndex(store.getCurrent());
  const rows: readonly { readonly itemId: string; readonly price?: number }[] =
    step.items ?? step.itemIds.map((itemId) => ({ itemId }));
  const resolved: ShopGoods[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.itemId)) continue;
    const goods = index.get(row.itemId);
    if (!goods) continue;
    seen.add(row.itemId);
    resolved.push(row.price === undefined ? goods : { ...goods, price: row.price });
  }
  return resolved;
}

type ShopTransactionResult =
  | { readonly ok: false; readonly status: string }
  | { readonly ok: true; readonly status: string; readonly merchantGold: number };

/**
 * 거래에 필요한 최소 정보. ItemRecord·EquipmentRecord·ShopGoods 가 모두 이 모양을 만족하므로
 * 아이템만 다루던 기존 호출부와 단위 테스트를 그대로 두고 장비까지 거래할 수 있다.
 */
export type ShopTradeable = { readonly id: string; readonly name: string; readonly price: number };

/** 구매 환불(마일리지 차감) — 성공 시에만 적립했으므로 환불 시 차감한다. */
export function refundShopMileage(session: PlaySessionLike, cost: number, mileageRate: number | undefined): void {
  if (typeof mileageRate !== "number" || mileageRate <= 0 || cost <= 0) return;
  const s = session as unknown as { shopMileagePoints?: number };
  const delta = Math.floor(cost * Math.min(0.1, Math.max(0, mileageRate)));
  s.shopMileagePoints = Math.max(0, (s.shopMileagePoints ?? 0) - delta);
}

/** 거래 메시지에 붙는 통화 단위. 자료집 용어를 따라간다(소지금 패널과 같은 단위). */
function goldUnit(): string {
  return resolveTerms(store.getCurrent()).gold;
}

/** 순수 거래 규칙 — 상인 소지금 한도를 포함. 단위 테스트용 export. */
export function handleShopTransaction(
  scene: PlaySceneContext,
  item: ShopTradeable,
  mode: ShopMode,
  count: number,
  merchantGold: number
): ShopTransactionResult {
  const qty = clampQuantity(count);
  if (mode === "sell") {
    const owned = scene.session.inventory[item.id] ?? 0;
    if (owned < qty) {
      scene.syncRuntimeState();
      return { ok: false, status: "가진 개수가 부족합니다." };
    }
    const payout = sellPrice(item) * qty;
    const economy = scene.session as typeof scene.session & {
      shopLoyaltySpend?: Record<string, number>;
      shopTradeCounts?: Record<string, { sold: number; bought: number }>;
      shopMileagePoints?: number;
    };
    const tc = economy.shopTradeCounts ?? {};
    const currentTrade = tc[item.id] ?? { sold: 0, bought: 0 };
    if (!isSafeEconomyValue(payout)
      || !isSafeEconomyValue(scene.session.gold)
      || scene.session.gold + payout > GOLD_MAX
      || !isSafeEconomyValue(merchantGold)
      || (economy.shopLoyaltySpend !== undefined && !isSafeEconomyRecord(economy.shopLoyaltySpend))
      || (economy.shopTradeCounts !== undefined && !isSafeShopTradeCountsRecord(economy.shopTradeCounts))
      || (economy.shopMileagePoints !== undefined && !isSafeEconomyValue(economy.shopMileagePoints))
      || currentTrade.sold + qty > GOLD_MAX) {
      scene.syncRuntimeState();
      return { ok: false, status: "거래를 처리할 수 없습니다." };
    }
    if (merchantGold < payout) {
      scene.syncRuntimeState();
      return { ok: false, status: "상인의 돈이 부족합니다." };
    }
    if (!changeItemsAtomically(scene.session, [{ itemId: item.id, op: "-=", amount: qty }])) {
      scene.syncRuntimeState();
      return { ok: false, status: "거래를 처리할 수 없습니다." };
    }
    changeGold(scene.session, "+=", payout);
    {
      economy.shopTradeCounts = tc;
      tc[item.id] = { sold: currentTrade.sold + qty, bought: currentTrade.bought };
      // 환불 시 마일리지 차감(성공 시에만 적립했으므로 판매 시 차감 대상 아님 — 구매 환불 경로에서만 차감)
      // 판매(sell)는 “되팔기”이므로 마일리지 차감 없음. 구매 환불은 handleShopTransaction 밖에서 처리.
    }
    scene.syncRuntimeState();
    return { ok: true, status: `${item.name} 판매 — +${payout}${goldUnit()}`, merchantGold: merchantGold - payout };
  }
  const cost = item.price * qty;
  if (!isSafeEconomyValue(cost) || !isSafeEconomyValue(scene.session.gold) || !isSafeEconomyValue(merchantGold) || merchantGold + cost > GOLD_MAX) {
    scene.syncRuntimeState();
    return { ok: false, status: "거래를 처리할 수 없습니다." };
  }
  if (scene.session.gold < cost) {
    scene.syncRuntimeState();
    return { ok: false, status: "소지금이 부족합니다." };
  }
  const tc = ((scene.session as unknown as { shopTradeCounts?: Record<string, { sold: number; bought: number }> }).shopTradeCounts ?? {}) as Record<string, { sold: number; bought: number }>;
  const currentTrade = tc[item.id] ?? { sold: 0, bought: 0 };
  if (!isSafeEconomyValue(currentTrade.sold) || !isSafeEconomyValue(currentTrade.bought) || currentTrade.bought + qty > GOLD_MAX) {
    scene.syncRuntimeState();
    return { ok: false, status: "거래를 처리할 수 없습니다." };
  }
  if (!changeItemsAtomically(scene.session, [{ itemId: item.id, op: "+=", amount: qty }])) {
    scene.syncRuntimeState();
    return { ok: false, status: "가방이 꽉 찼습니다." };
  }
  changeGold(scene.session, "-=", cost);
  {
    (scene.session as unknown as { shopTradeCounts?: Record<string, { sold: number; bought: number }> }).shopTradeCounts = tc;
    tc[item.id] = { sold: currentTrade.sold, bought: currentTrade.bought + qty };
  }
  scene.syncRuntimeState();
  // 플레이어 구매금은 상인 소지금으로 들어간다(이후 매입 여력 증가).
  return { ok: true, status: `${item.name} 구매 — -${cost}${goldUnit()}`, merchantGold: merchantGold + cost };
}

function mountCommerceOverlay(scene: PlaySceneContext, overlay: HTMLElement): void {
  const host = dialogueHost(scene);
  if (!host) return;
  // dialogueHost(.play-stage)는 transform: scale 이라 절대배치 자식이 보이는 영역 밖(위쪽)으로 튄다.
  // 스케일 밖의 .play-viewport 레이어에 올려 보이는 게임 영역 기준으로 상점 창을 배치한다.
  const layer = host.closest(".play-viewport") ?? host;
  layer.querySelector(`[data-testid='${overlay.dataset.testid ?? ""}']`)?.remove();
  layer.append(overlay);
}

function finishCommerce(
  scene: PlaySceneContext,
  overlay: HTMLElement,
  resolve: (result: boolean | "failed") => void,
  result: boolean | "failed"
): void {
  overlay.remove();
  scene.syncRuntimeState();
  resolve(result);
}

function clearElement(node: HTMLElement): void {
  while (node.firstChild) node.firstChild.remove();
}
