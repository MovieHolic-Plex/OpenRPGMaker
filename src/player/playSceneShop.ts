import { changeGold, changeItem } from "@/project/session";
import { store } from "@/project/store";
import { resolveTerms } from "@/project/terms";
import { resolveShopMerchantGold } from "@/project/shopStock";
import { dialogueHost } from "@/player/playSceneDom";
import { attachCursorMenu } from "@/player/runtimeCursorMenu";
import {
  adjustShopQuantity,
  createShopOverlay,
  defaultShopMode,
  renderShopItems,
  renderShopMenu,
  sellPrice,
  shopPromptText,
  updateShopOwnedPanel,
  type ShopMode,
  type ShopView,
} from "@/player/playSceneShopDom";
import type { StepResult } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { ItemRecord } from "@/project/types/database";

export type ShopStep = Extract<StepResult, { kind: "shop" }>;

export function playShop(scene: PlaySceneContext, step: ShopStep): Promise<boolean | "failed"> {
  const items = shopItems(step);
  const terms = resolveTerms(store.getCurrent());
  // 빈 상점: 메뉴 노출 대신 안내만 하고 바로 닫음 → 유령 상점(F-07) 방지
  if (items.length === 0) {
    return Promise.resolve(step.branchOnFailedTransaction ? "failed" as const : false);
  }
  // 방문마다 상인 소지금을 명령값(기본 100G)으로 초기화. 방문 중 매입/매도로 증감.
  let merchantGold = resolveShopMerchantGold(step.merchantGold);
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    let view: ShopView = "menu";
    let mode: ShopMode = defaultShopMode(step);
    let statusText = items.length ? shopPromptText(step, mode, terms) : "There are no goods here.";
    let transactionCompleted = false;
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
      finishCommerce(scene, overlay, resolve, transactionCompleted);
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
      // 아이템 목록 — ↑↓ 이동, 선택 시 보유 패널 갱신, select 수량모드면 ←→ 로 수량 ±1.
      const selectMode = (step.quantityMode ?? "single") === "select";
      return attachCursorMenu(overlay, {
        items: Array.from(overlay.querySelectorAll<HTMLElement>(".runtime-shop-item-row")),
        cancelEl: overlay.querySelector<HTMLElement>("[data-testid='shop-item-cancel']"),
        initialIndex: itemCursor,
        onSelect: (index) => {
          itemCursor = index;
          updateShopOwnedPanel(overlay, scene, items[index]);
        },
        onHorizontal: selectMode ? (dir) => adjustShopQuantity(overlay, dir) : undefined,
      });
    };
    const renderShop = () => {
      teardownCursor();
      clearElement(overlay);
      overlay.append(
        view === "menu"
          ? renderShopMenu(step, terms, showItems, finish)
          : renderShopItems({
              scene,
              step,
              items,
              mode,
              prompt: statusText,
              terms,
              merchantGold,
              setStatus,
              showMenu,
              onItem: (item, nextMode, count) => {
                const result = handleShopTransaction(scene, item, nextMode, count, merchantGold);
                if (!result.ok) {
                  setStatus(result.status);
                  return;
                }
                // 상태 메시지 리렌더 전에 상인 소지금을 반영해야 패널 숫자가 맞다.
                merchantGold = result.merchantGold;
                { const _cost2 = (item.price * Math.min(99, Math.max(1, Math.floor(count)||1))); const _k = ((step as unknown as { loyaltyTierId?: string }).loyaltyTierId ?? "global"); const _sm2 = ((scene.session as unknown as { shopLoyaltySpend?: Record<string,number> }).shopLoyaltySpend ?? {}); (scene.session as unknown as { shopLoyaltySpend?: Record<string,number> }).shopLoyaltySpend = _sm2; _sm2[_k] = (_sm2[_k] ?? 0) + _cost2; const _rate2 = (step as unknown as { mileageRate?: number }).mileageRate; if(typeof _rate2==="number" && _rate2>0){ (scene.session as unknown as { shopMileagePoints?: number }).shopMileagePoints = Math.floor(((scene.session as unknown as { shopMileagePoints?: number }).shopMileagePoints ?? 0) + _cost2 * Math.min(0.1, Math.max(0, _rate2))); } }
                transactionCompleted = true;
                if (nextMode === "buy") {
                  finish();
                  return;
                }
                setStatus(result.status);
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
      statusText = shopPromptText(step, mode, terms);
      renderShop();
    };
    const setStatus = (text: string) => {
      statusText = text;
      renderShop();
    };
    // 먼저 마운트한 뒤 렌더해야 첫 커서 focus/scrollIntoView 가 연결된 노드에서 동작한다.
    mountCommerceOverlay(scene, overlay);
    renderShop();
  });
}

function shopItems(step: ShopStep): ItemRecord[] {
  const items = store.getCurrent().database.items;
  const rows: readonly { readonly itemId: string; readonly price?: number }[] = step.items ?? step.itemIds.map((itemId) => ({ itemId }));
  return rows
    .map((row) => {
      const item = items.find((entry) => entry.id === row.itemId);
      if (!item) return undefined;
      return row.price === undefined ? item : { ...item, price: row.price };
    })
    .filter((item): item is ItemRecord => Boolean(item));
}

type ShopTransactionResult =
  | { readonly ok: false; readonly status: string }
  | { readonly ok: true; readonly status: string; readonly merchantGold: number };

/** 순수 거래 규칙 — 상인 소지금 한도를 포함. 단위 테스트용 export. */
export function handleShopTransaction(
  scene: PlaySceneContext,
  item: ItemRecord,
  mode: ShopMode,
  count: number,
  merchantGold: number
): ShopTransactionResult {
  const qty = Math.min(99, Math.max(1, Math.floor(count) || 1));
  if (mode === "sell") {
    const owned = scene.session.inventory[item.id] ?? 0;
    if (owned < qty) {
      scene.syncRuntimeState();
      return { ok: false, status: "You do not have enough." };
    }
    const payout = sellPrice(item) * qty;
    if (merchantGold < payout) {
      scene.syncRuntimeState();
      return { ok: false, status: "상인의 돈이 부족합니다." };
    }
    changeItem(scene.session, item.id, "-=", qty);
    changeGold(scene.session, "+=", payout);
    { const tc = ((scene.session as unknown as { shopTradeCounts?: Record<string, { sold:number; bought:number }> }).shopTradeCounts ?? {}); (scene.session as unknown as { shopTradeCounts?: Record<string, { sold:number; bought:number }> }).shopTradeCounts = tc; tc[item.id] = { sold: (tc[item.id]?.sold ?? 0) + qty, bought: tc[item.id]?.bought ?? 0 }; }
    scene.syncRuntimeState();
    return { ok: true, status: `${item.name} sold.`, merchantGold: merchantGold - payout };
  }
  const cost = item.price * qty;
  if (scene.session.gold < cost) {
    scene.syncRuntimeState();
    return { ok: false, status: "Not enough money." };
  }
  changeGold(scene.session, "-=", cost);
  changeItem(scene.session, item.id, "+=", qty);
  { const tc = ((scene.session as unknown as { shopTradeCounts?: Record<string, { sold:number; bought:number }> }).shopTradeCounts ?? {}); (scene.session as unknown as { shopTradeCounts?: Record<string, { sold:number; bought:number }> }).shopTradeCounts = tc; tc[item.id] = { sold: tc[item.id]?.sold ?? 0, bought: (tc[item.id]?.bought ?? 0) + qty }; }
  scene.syncRuntimeState();
  // 플레이어 구매금은 상인 소지금으로 들어간다(이후 매입 여력 증가).
  return { ok: true, status: `${item.name} purchased.`, merchantGold: merchantGold + cost };
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
  resolve: (transactionCompleted: boolean) => void,
  transactionCompleted: boolean
): void {
  overlay.remove();
  scene.syncRuntimeState();
  resolve(transactionCompleted);
}

function clearElement(node: HTMLElement): void {
  while (node.firstChild) node.firstChild.remove();
}
