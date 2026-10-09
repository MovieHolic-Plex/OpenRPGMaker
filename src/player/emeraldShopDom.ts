import { el } from '@/util/dom';
import { shopItemIcon } from '@/player/playSceneShopParts';
import type { ShopGoods } from '@/player/playSceneShopGoods';
import type { ShopMode } from '@/player/playSceneShopParts';
import type { ResolvedTerms } from '@/project/terms';

export type EmeraldShopPhase = 'menu' | 'items' | 'quantity' | 'confirm' | 'receipt';
export type EmeraldShopAction = ShopMode | 'quit';
export type EmeraldShopModel = {
  readonly phase: EmeraldShopPhase;
  readonly mode: ShopMode;
  readonly actions: readonly EmeraldShopAction[];
  readonly menuCursor: number;
  readonly goods: readonly ShopGoods[];
  readonly itemCursor: number;
  readonly count: number;
  readonly maxCount: number;
  readonly yes: boolean;
  readonly message: string;
  readonly gold: number;
  readonly unitPrice: (goods: ShopGoods) => number;
  readonly owned: (goods: ShopGoods) => number;
  readonly terms: ResolvedTerms;
  readonly mapView: HTMLElement;
};

function panel(className: string, testid: string, text?: string): HTMLElement {
  return el('div', { class: `emerald-shop-window ${className}`, dataset: { testid }, ...(text === undefined ? {} : { text }) });
}
function action(testid: string, label: string, selected: boolean, activate: () => void): HTMLButtonElement {
  const button = el('button', { class: `emerald-shop-action${selected ? ' selected' : ''}`, text: label,
    dataset: { testid }, attrs: { type: 'button', tabindex: selected ? '0' : '-1', 'aria-selected': String(selected) },
    on: { click: activate } }) as HTMLButtonElement;
  return button;
}

/** Geometry follows pret/pokeemerald src/shop.c window templates, scaled 2× to 480×320. */
export function renderEmeraldShop(model: EmeraldShopModel, callbacks: {
  readonly onMenu: (index: number) => void;
  readonly onItem: (index: number) => void;
  readonly onConfirm: (yes: boolean) => void;
  readonly onBack: () => void;
}): HTMLElement {
  const shell = el('div', { class: 'emerald-shop-shell', dataset: { shopPhase: model.phase, shopMode: model.mode } });
  if (model.phase === 'menu') {
    const choices = panel('emerald-shop-entry', 'shop-menu');
    model.actions.forEach((entry, index) => choices.append(action(entry === 'quit' ? 'shop-menu-cancel' : `shop-mode-${entry}`,
      entry === 'buy' ? model.terms.shopBuy : entry === 'sell' ? model.terms.shopSell : '그만두기',
      index === model.menuCursor, () => callbacks.onMenu(index))));
    shell.append(choices, panel('emerald-shop-message', 'shop-status', model.message));
    return shell;
  }
  const selected = model.goods[model.itemCursor];
  if (model.mode === 'buy') shell.append(model.mapView);
  else {
    const bag = panel('emerald-shop-bag', 'shop-selling-bag');
    bag.append(el('strong', { text: '가방' }), el('span', { text: selected?.typeLabel ?? '소지품' }));
    if (selected) bag.append(shopItemIcon(selected, 'emerald-shop-bag-icon'));
    bag.append(el('span', { text: selected ? `보유 ${model.owned(selected)}개` : '팔 물건이 없습니다.' }));
    shell.append(bag);
  }
  const money = panel('emerald-shop-money', 'shop-player-gold');
  money.append(el('span', { text: '소지금' }), el('strong', { text: `${model.gold}${model.terms.gold}` }));
  shell.append(money);
  const list = panel('emerald-shop-goods', 'shop-goods-list');
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', model.mode === 'buy' ? '진열 상품' : '판매할 소지품');
  model.goods.forEach((goods, index) => {
    const row = action(`shop-${model.mode}-${goods.id}`, '', index === model.itemCursor, () => callbacks.onItem(index));
    row.setAttribute('role', 'option');
    row.dataset.itemId = goods.id;
    row.append(el('span', { class: 'emerald-shop-item-name', text: goods.name }),
      el('span', { class: 'emerald-shop-item-price', text: model.mode === 'buy'
        ? `${model.unitPrice(goods)}${model.terms.gold}` : `×${model.owned(goods)}` }));
    if (model.phase !== 'items') { row.tabIndex = -1; row.setAttribute('aria-disabled', 'true'); }
    list.append(row);
  });
  const back = action('shop-item-cancel', '그만두기', model.itemCursor === model.goods.length, callbacks.onBack);
  back.setAttribute('role', 'option');
  if (model.phase !== 'items') { back.tabIndex = -1; back.setAttribute('aria-disabled', 'true'); }
  list.append(back);
  shell.append(list);
  if (model.phase === 'items') {
    const description = panel('emerald-shop-description', 'shop-desc-text');
    description.tabIndex = -1;
    description.append(el('div', { class: 'emerald-shop-description-copy', text: selected?.description
      || (selected ? selected.name : model.goods.length ? '상점 메뉴로 돌아갑니다.' : model.mode === 'sell' ? '팔 물건이 없습니다.' : '파는 물건이 없습니다.') }));
    if (selected) description.append(el('div', { class: 'emerald-shop-owned', text: `보유 ${model.owned(selected)}개`, dataset: { testid: 'shop-owned-panel' } }));
    description.append(el('span', { class: 'emerald-shop-description-more', text: '▼', attrs: { 'aria-hidden': 'true' } }));
    shell.append(description);
  } else {
    shell.append(panel('emerald-shop-message', 'shop-status', model.message));
    if (model.phase === 'quantity') {
      const owned = panel('emerald-shop-count-owned', 'shop-owned-panel', `보유 ${selected ? model.owned(selected) : 0}개`);
      const quantity = panel('emerald-shop-quantity', 'shop-quantity-panel');
      quantity.setAttribute('role', 'spinbutton'); quantity.tabIndex = 0;
      quantity.setAttribute('aria-label', '수량: 위아래 1개, 좌우 10개');
      quantity.setAttribute('aria-valuemin', '1'); quantity.setAttribute('aria-valuemax', String(model.maxCount));
      quantity.setAttribute('aria-valuenow', String(model.count));
      quantity.append(el('span', { class: 'emerald-shop-quantity-count', text: `×${String(model.count).padStart(2, '0')}`, dataset: { testid: 'shop-quantity-value' } }),
        el('span', { text: `${(selected ? model.unitPrice(selected) : 0) * model.count}${model.terms.gold}`, dataset: { testid: 'shop-quantity-total' } }));
      shell.append(owned, quantity);
    } else if (model.phase === 'confirm') {
      const choices = panel('emerald-shop-confirmation', 'shop-confirmation');
      choices.append(action('shop-confirm-yes', '예', model.yes, () => callbacks.onConfirm(true)),
        action('shop-confirm-no', '아니오', !model.yes, () => callbacks.onConfirm(false)));
      shell.append(choices);
    } else shell.append(el('span', { class: 'emerald-shop-advance', text: '▼', attrs: { 'aria-hidden': 'true' } }));
  }
  return shell;
}
