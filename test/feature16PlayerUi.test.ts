// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { startSession } from '@/project/session';
import { store } from '@/project/store';
import { createPlayerStatusMenuController } from '@/player/playerStatusMenuController';
import { MENU_SKINS } from '@/player/menuSkins/registry';
import type { MenuSkinId } from '@/player/menuSkins/types';
import type { PlayScene } from '@/player/PlayScene';
import type { PlaySceneContext } from '@/player/playSceneTypes';
import type { ShopStep } from '@/player/playSceneShop';
import { renderShopItems } from '@/player/playSceneShopDom';
import { resolveTerms } from '@/project/terms';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function mount(skin: MenuSkinId) {
  const project = createBlankProject();
  project.system.menuUiStyle = skin;
  const item = project.database.items[0]!;
  Object.assign(item, { type: 'medicine', occasion: 'field' });
  const session = startSession(project);
  session.inventory = { [item.id]: 2 };
  vi.spyOn(store, 'getCurrent').mockReturnValue(project);
  const layout = document.createElement('div'); document.body.append(layout);
  const scene = { session, getSession: () => session, syncRuntimeState() {} } as unknown as PlayScene;
  const controller = createPlayerStatusMenuController({ layout, getPlayStage: () => layout,
    getActiveScene: () => scene, getPlayStartedAt: () => 0, closeMenu() {}, closeMenuWithJuice() {},
    renderTitle() {}, emitMenuJuice() {}, menuCloseJuiceMs: 0, loadSlot() {},
  });
  const selected = () => layout.querySelector<HTMLElement>('.status-menu-detail-action.selected');
  return { project, session, layout, controller, selected };
}
describe('player controls share every menu skin keyboard path', () => {
  it.each(Object.keys(MENU_SKINS) as MenuSkinId[])('%s filters/sorts/clamps an empty result and restores all items', skin => {
    const f = mount(skin), before = structuredClone(f.session);
    f.controller.toggleMenu(); f.controller.handleKey('Enter');
    f.controller.handleKey('ArrowUp'); f.controller.handleKey('ArrowUp');
    expect(f.selected()?.dataset.testid).toBe('inventory-filter');
    expect(f.selected()?.tagName).toBe('BUTTON');
    f.controller.handleKey('Enter'); // usable
    f.controller.handleKey('Enter'); // equipment
    expect(f.selected()?.dataset.testid).toBe('inventory-filter');
    f.controller.handleKey('Enter'); // other: empty
    expect(f.layout.querySelector('[data-testid="inventory-filter-empty"]')).not.toBeNull();
    f.controller.handleKey('ArrowDown'); f.controller.handleKey('Enter');
    expect(f.selected()?.dataset.testid).toBe('inventory-sort');
    expect(f.selected()?.textContent).toContain('이름순');
    f.controller.handleKey('ArrowUp'); f.controller.handleKey('Enter'); // all
    expect(f.layout.querySelector(`[data-testid="status-menu-item-${Object.keys(f.session.inventory)[0]}"]`)).not.toBeNull();
    expect(f.session).toEqual(before);
  });
  it('opens settings from the system group and keeps Escape returning to its parent', () => {
    const f = mount('workbench');
    f.controller.toggleMenu(); f.controller.handleKey('ArrowUp'); f.controller.handleKey('Enter');
    for (let i = 0; i < 3; i++) f.controller.handleKey('ArrowDown');
    expect(f.selected()?.dataset.testid).toBe('status-menu-group-command-options');
    f.controller.handleKey('Enter');
    expect(f.selected()?.dataset.testid).toBe('player-option-bgm-down');
    expect(f.layout.querySelector('[data-testid="player-option-text-speed"]')?.tagName).toBe('BUTTON');
    f.controller.handleKey('Escape');
    expect(f.layout.querySelector('[data-testid="status-menu-group-command-options"]')).not.toBeNull();
  });
});
describe('split shop exposes supported transactions only', () => {
  it.each(['normal', 'buyOnly', 'sellOnly'] as const)('%s removes fake services and honors mode permissions', shopType => {
    const project = createBlankProject(), session = startSession(project);
    vi.spyOn(store, 'getCurrent').mockReturnValue(project);
    const onMode = vi.fn();
    const panel = renderShopItems({ scene: { session, syncRuntimeState() {} } as unknown as PlaySceneContext,
      step: { kind: 'shop', shopType, allowSell: true, shopUiPreset: 'split', quantityMode: 'single' } as ShopStep,
      items: [project.database.items[0]!], mode: shopType === 'sellOnly' ? 'sell' : 'buy',
      prompt: '', terms: resolveTerms(project), merchantGold: 100, setStatus() {}, showMenu() {}, onItem() {}, onMode,
    });
    expect(panel.querySelector('.runtime-shop-service-nav')).toBeNull();
    expect(Array.from(panel.querySelectorAll('button')).some(b => ['개조', '교환'].includes(b.textContent ?? ''))).toBe(false);
    const tabs = panel.querySelectorAll<HTMLButtonElement>('.runtime-shop-tab');
    if (shopType === 'normal') {
      expect(tabs.length).toBe(2); tabs[1]!.click(); expect(onMode).toHaveBeenCalledWith('sell');
    } else expect(tabs.length).toBe(0);
  });
});


describe('shop presets show real transaction data', () => {
  it.each(['compare', 'cart', 'split', 'stock', 'story'] as const)('%s has no fabricated comparison or checkout surface', preset => {
    const project = createBlankProject(), session = startSession(project);
    vi.spyOn(store, 'getCurrent').mockReturnValue(project);
    const onMode = vi.fn();
    const panel = renderShopItems({ scene: { session, syncRuntimeState() {} } as unknown as PlaySceneContext,
      step: { kind: 'shop', shopType: 'buyOnly', allowSell: false, shopUiPreset: preset, quantityMode: 'single' } as ShopStep,
      items: [project.database.items[0]!], mode: 'buy', prompt: '', terms: resolveTerms(project),
      merchantGold: 100, setStatus() {}, showMenu() {}, onItem() {}, onMode,
    });
    expect(panel.querySelector('.runtime-shop-stat-compare, .runtime-shop-cart-panel, .runtime-shop-cart-instruction, .runtime-shop-service-nav, .runtime-shop-split-heading')).toBeNull();
    const actions = Array.from(panel.querySelectorAll<HTMLButtonElement>('.runtime-shop-story-actions button'));
    expect(actions.some(button => button.textContent === '팔기')).toBe(false);
    actions.find(button => button.textContent === '사기')?.click();
    if (preset === 'story') expect(onMode).toHaveBeenCalledWith('buy');
  });
});
