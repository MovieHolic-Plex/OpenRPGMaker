import { changeGold, changeItem } from "@/project/session";
import { store } from "@/project/store";
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

export function playShop(scene: PlaySceneContext, step: ShopStep): Promise<boolean> {
  const items = shopItems(step);
  return new Promise((resolve) => {
    const overlay = createShopOverlay();
    let view: ShopView = "menu";
    let mode: ShopMode = defaultShopMode(step);
    let statusText = items.length ? shopPromptText(step, mode) : "There are no goods here.";
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
          ? renderShopMenu(step, showItems, finish)
          : renderShopItems({
              scene,
              step,
              items,
              mode,
              prompt: statusText,
              setStatus,
              showMenu,
              onItem: (item, nextMode, count) => {
                const completed = handleShopTransaction(scene, item, nextMode, count, setStatus);
                if (!completed) return;
                transactionCompleted = true;
                if (nextMode === "buy") finish();
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
      statusText = shopPromptText(step, mode);
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

function handleShopTransaction(
  scene: PlaySceneContext,
  item: ItemRecord,
  mode: ShopMode,
  count: number,
  setStatus: (text: string) => void
): boolean {
  if (mode === "sell") {
    const owned = scene.session.inventory[item.id] ?? 0;
    if (owned < count) {
      setStatus("You do not have enough.");
      scene.syncRuntimeState();
      return false;
    }
    changeItem(scene.session, item.id, "-=", count);
    changeGold(scene.session, "+=", sellPrice(item) * count);
    scene.syncRuntimeState();
    setStatus(`${item.name} sold.`);
    return true;
  }
  if (scene.session.gold < item.price * count) {
    setStatus("Not enough money.");
    scene.syncRuntimeState();
    return false;
  }
  changeGold(scene.session, "-=", item.price * count);
  changeItem(scene.session, item.id, "+=", count);
  scene.syncRuntimeState();
  return true;
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
