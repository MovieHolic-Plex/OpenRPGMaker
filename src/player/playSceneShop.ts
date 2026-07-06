import { changeGold, changeItem } from "@/project/session";
import { store } from "@/project/store";
import { dialogueHost } from "@/player/playSceneDom";
import {
  createShopOverlay,
  defaultShopMode,
  renderShopItems,
  renderShopMenu,
  sellPrice,
  shopPromptText,
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
    const finish = () => finishCommerce(scene, overlay, resolve, transactionCompleted);
    const renderShop = () => {
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
    renderShop();
    mountCommerceOverlay(scene, overlay);
  });
}

function shopItems(step: ShopStep): ItemRecord[] {
  const items = store.getCurrent().database.items;
  return step.itemIds
    .map((id) => items.find((item) => item.id === id))
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
