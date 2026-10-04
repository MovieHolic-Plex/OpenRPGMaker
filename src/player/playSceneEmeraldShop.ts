import '@/styles/runtime/emeraldShop.css';
import { el } from '@/util/dom';
import { store } from '@/project/store';
import { resolveShopSellUnitPrice } from '@/project/shopPrice';
import { shopGreetingText } from '@/project/shopMessages';
import type { ResolvedTerms } from '@/project/terms';
import { dialogueHost } from '@/player/playSceneDom';
import { goodsIndex, type ShopGoods } from '@/player/playSceneShopGoods';
import { affordableQuantityMax, type ShopMode } from '@/player/playSceneShopParts';
import { installPlayPointerBlocker } from '@/player/playInputBlocker';
import { emitRuntimeJuice } from '@/player/runtimeJuice';
import { renderEmeraldShop, type EmeraldShopAction, type EmeraldShopPhase } from '@/player/emeraldShopDom';
import { attachEmeraldShopInput } from '@/player/emeraldShopInput';
import type { ShopStep } from '@/player/playSceneShop';
import type { PlaySceneContext } from '@/player/playSceneTypes';

type TradeResult = { readonly ok: false; readonly status: string }
  | { readonly ok: true; readonly status: string; readonly merchantGold: number };

/** Presentation-only state. Inventory, price validation and branch receipts remain in playShop. */
export function playEmeraldShop(options: {
  readonly scene: PlaySceneContext;
  readonly step: ShopStep;
  readonly stockItems: readonly ShopGoods[];
  readonly terms: ResolvedTerms;
  readonly merchantGold: number;
  readonly transact: (item: ShopGoods, mode: ShopMode, count: number, budget: number) => TradeResult;
  readonly onFinish: (budget: number) => void;
}): Promise<boolean | 'failed'> {
  const { scene, step, stockItems, terms } = options;
  const session = scene.session;
  const host = dialogueHost(scene);
  if (!host) return Promise.resolve(step.branchOnFailedTransaction ? 'failed' : false);
  const layer = host.closest('.play-viewport') ?? host;
  const root = el('section', { class: 'runtime-overlay runtime-shop-overlay emerald-shop-overlay',
    dataset: { testid: 'shop-scene', monsterStyle: 'emerald', shopPhase: 'menu' },
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': '상점', tabindex: '-1' } });
  const type = step.shopType ?? (step.allowSell ? 'normal' : 'buyOnly');
  const actions: EmeraldShopAction[] = type === 'buyOnly' ? ['buy', 'quit'] : type === 'sellOnly' ? ['sell', 'quit'] : ['buy', 'sell', 'quit'];
  const previousFocus = root.ownerDocument.activeElement;
  const mapView = el('div', { class: 'emerald-shop-map-view', dataset: { testid: 'shop-map-view', mapSource: 'live-scene', mapId: scene.map.id }, attrs: { 'aria-label': '현재 상점 지도' } });
  let phase: EmeraldShopPhase = 'menu', mode: ShopMode = type === 'sellOnly' ? 'sell' : 'buy';
  let menuCursor = 0, itemCursor = 0, count = 1, yes = true;
  let merchantGold = options.merchantGold, completed = false, closed = false;
  let message = shopGreetingText(step.messageType, terms);
  let goods: ShopGoods[] = [];
  let pending: { item: ShopGoods; mode: ShopMode; count: number } | undefined;
  let detachInput: () => void = () => {};
  let detachPointer: () => void = () => {};
  let observer: MutationObserver | undefined;
  let resize: ResizeObserver | undefined;
  const owned = (item: ShopGoods) => Math.max(0, session.inventory[item.id] ?? 0);
  const price = (item: ShopGoods) => mode === 'buy' ? item.price : resolveShopSellUnitPrice(store.getCurrent(), item.id, item.price);
  const quantityMax = (item: ShopGoods) => Math.min(step.quantityMode === 'select' ? 99 : 1,
    affordableQuantityMax(item, mode, session.gold, merchantGold, owned(item)));
  const sound = (event: 'menu-select' | 'menu-confirm' | 'menu-back' | 'menu-invalid') =>
    emitRuntimeJuice({ event, project: store.getCurrent(), session });
  const refreshGoods = () => {
    const priced = new Map(stockItems.map(item => [item.id, item]));
    goods = mode === 'buy' ? [...stockItems] : [...goodsIndex(store.getCurrent()).values()]
      .filter(item => owned(item) > 0).map(item => priced.get(item.id) ?? item);
    itemCursor = Math.max(0, Math.min(itemCursor, goods.length));
  };
  return new Promise(resolve => {
    const finish = (abandoned = false) => {
      if (closed) return;
      closed = true;
      detachInput(); detachPointer(); observer?.disconnect(); resize?.disconnect();
      scene.events?.off('shutdown', abandon); scene.events?.off('destroy', abandon);
      root.remove();
      if (!abandoned && scene.session === session) {
        options.onFinish(merchantGold);
        scene.syncRuntimeState();
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      }
      resolve(completed ? true : step.branchOnFailedTransaction ? 'failed' : false);
    };
    const abandon = () => finish(true);
    const alive = () => {
      if (closed) return false;
      if (scene.session !== session || !root.isConnected) { abandon(); return false; }
      return true;
    };
    const render = () => {
      if (!alive()) return;
      root.dataset.shopPhase = phase; root.dataset.shopMode = mode;
      root.replaceChildren(renderEmeraldShop({ phase, mode, actions, menuCursor, goods, itemCursor, count,
        maxCount: Math.max(1, goods[itemCursor] ? quantityMax(goods[itemCursor]!) : 1), yes, message,
        gold: session.gold, unitPrice: price, owned, terms, mapView }, {
        onMenu: index => { if (phase === 'menu') { menuCursor = index; confirm(); } },
        onItem: index => { if (phase === 'items') { itemCursor = index; confirm(); } },
        onConfirm: value => { if (phase === 'confirm') { yes = value; confirm(); } },
        onBack: () => { if (phase === 'items') cancel(); },
      }));
      const target = phase === 'quantity' ? root.querySelector<HTMLElement>("[data-testid='shop-quantity-panel']")
        : phase === 'receipt' ? root : root.querySelector<HTMLElement>('.emerald-shop-action.selected');
      target?.focus({ preventScroll: true });
      const copy = root.querySelector<HTMLElement>('.emerald-shop-description-copy');
      if (copy) copy.parentElement!.dataset.overflow = String(copy.scrollHeight > copy.clientHeight);
      if (phase === 'items') target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      // During a modal phase retain the selected goods' previous position in the list.
      else root.querySelector<HTMLElement>('.emerald-shop-goods .selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    const returnToItems = () => {
      phase = 'items'; pending = undefined; refreshGoods(); render();
    };
    const confirm = () => {
      if (!alive()) return;
      if (phase === 'menu') {
        const selected = actions[menuCursor];
        sound('menu-confirm');
        if (selected === 'quit') { finish(); return; }
        mode = selected as ShopMode; itemCursor = 0; refreshGoods(); phase = 'items'; render();
      } else if (phase === 'items') {
        const item = goods[itemCursor];
        if (!item) { cancel(); return; }
        const max = quantityMax(item);
        if (max < 1) {
          sound('menu-invalid'); phase = 'receipt';
          message = mode === 'buy' ? '소지금이 부족합니다.' : '상인의 돈이 부족합니다.';
          render(); return;
        }
        sound('menu-confirm'); count = 1;
        pending = { item, mode, count }; phase = 'quantity';
        message = `${item.name}\n${mode === 'buy' ? '몇 개를 드릴까요?' : '몇 개를 파시겠습니까?'}`; render();
      } else if (phase === 'quantity' && pending) {
        pending.count = count; phase = 'confirm'; yes = true; sound('menu-confirm');
        message = `${pending.item.name} ${count}개, ${price(pending.item) * count}${terms.gold}.\n${mode === 'buy' ? '구매하시겠습니까?' : '판매하시겠습니까?'}`; render();
      } else if (phase === 'confirm' && pending) {
        if (!yes) { sound('menu-back'); returnToItems(); return; }
        // Consume pending BEFORE the sole atomic commit: re-entry cannot buy twice.
        const deal = pending; pending = undefined;
        const result = options.transact(deal.item, deal.mode, deal.count, merchantGold);
        if (result.ok) { merchantGold = result.merchantGold; completed = true; sound('menu-confirm'); }
        else sound('menu-invalid');
        phase = 'receipt'; message = result.status; render();
      } else if (phase === 'receipt') { sound('menu-confirm'); returnToItems(); }
    };
    const cancel = () => {
      if (!alive()) return;
      sound('menu-back');
      if (phase === 'menu') finish();
      else if (phase === 'items') { phase = 'menu'; message = shopGreetingText(step.messageType, terms); render(); }
      else if (phase === 'confirm' && pending) { phase = 'quantity'; message = `${pending.item.name}\n${mode === 'buy' ? '몇 개를 드릴까요?' : '몇 개를 파시겠습니까?'}`; render(); }
      else returnToItems();
    };
    layer.querySelector("[data-testid='shop-scene']")?.remove();
    layer.append(root);
    detachPointer = installPlayPointerBlocker(root);
    detachInput = attachEmeraldShopInput(root, {
      onConfirm: confirm, onCancel: cancel,
      onDirection: direction => {
        if (!alive()) return;
        const backwards = direction === 'up' || direction === 'left';
        if (phase === 'quantity' && pending) {
          const delta = direction === 'up' ? 1 : direction === 'down' ? -1 : direction === 'right' ? 10 : -10;
          const next = Math.max(1, Math.min(quantityMax(pending.item), count + delta));
          sound(next === count ? 'menu-invalid' : 'menu-select'); count = next;
        } else if (phase === 'menu') menuCursor = (menuCursor + (backwards ? -1 : 1) + actions.length) % actions.length;
        else if (phase === 'items') itemCursor = (itemCursor + (backwards ? -1 : 1) + goods.length + 1) % (goods.length + 1);
        else if (phase === 'confirm') yes = !yes;
        else return;
        if (phase !== 'quantity') sound('menu-select');
        render();
      },
      onScroll: key => {
        const description = root.querySelector<HTMLElement>('.emerald-shop-description-copy');
        if (!description || phase !== 'items') return;
        description.scrollTop = key === 'Home' ? 0 : key === 'End' ? description.scrollHeight
          : description.scrollTop + (key === 'PageUp' ? -1 : 1) * description.clientHeight;
      },
    });
    scene.events?.once('shutdown', abandon); scene.events?.once('destroy', abandon);
    observer = new MutationObserver(() => { if (!root.isConnected) abandon(); });
    observer.observe(layer, { childList: true });
    const fit = () => {
      const field = scene.game?.canvas?.getBoundingClientRect();
      const width = Math.min(layer.clientWidth, field?.width || layer.clientWidth);
      const height = Math.min(layer.clientHeight, field?.height || layer.clientHeight);
      const scale = Math.max(0.01, Math.min(width / 480, height / 320));
      root.style.width = `${480 * scale}px`; root.style.height = `${320 * scale}px`;
      root.style.setProperty('--emerald-shop-scale', String(scale));
    };
    fit();
    resize = new ResizeObserver(fit); resize.observe(layer);
    if (scene.game?.canvas) resize.observe(scene.game.canvas);
    render();
    captureShopMap(scene, mapView, () => !closed && scene.session === session);
  });
}

/** Phaser snapshots on its next rendered frame, avoiding empty WebGL drawing buffers. */
function captureShopMap(scene: PlaySceneContext, host: HTMLElement, alive: () => boolean): void {
  const source = scene.game?.canvas;
  if (!source) return; // The unobscured live map remains underneath the transparent left panel.
  const scaleX = source.width / 480, scaleY = source.height / 320;
  const x = Math.round(128 * scaleX), y = Math.round(64 * scaleY);
  const width = Math.round(224 * scaleX), height = Math.round(144 * scaleY);
  try {
    scene.game.renderer.snapshotArea(x, y, width, height, image => {
      if (!alive() || !(image instanceof HTMLImageElement)) return;
      const canvas = document.createElement('canvas'); canvas.width = 224; canvas.height = 144;
      const context = canvas.getContext('2d'); if (!context) return;
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, 224, 144);
      host.replaceChildren(canvas); host.dataset.mapSource = 'game-canvas-snapshot';
    });
  } catch { /* Live game canvas is still visible; never substitute an invented map. */ }
}
