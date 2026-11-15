import { writeFeature16PlayerFixture } from '../../../test/fixtures/feature16Player.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
const present = testid => ({ kind: 'waitForVisible', testid });
export default {
  id: 'feature16-player',
  projectFixture: await writeFeature16PlayerFixture(),
  viewport: { width: 960, height: 720 },
  beats: [
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }] },
    { id: 'filtered-inventory', note: 'Real keyboard: Esc → items → last controls → usable types. Equipment is hidden, never removed.',
      ops: [key('Escape'), present('main-menu'), key('Enter'), key('ArrowUp', 2), key('Enter')],
      expect: { testidPresent: ['inventory-filter', 'inventory-sort', 'status-menu-item-item_potion'],
        testidAbsent: ['status-menu-owned-equipment-equip_sword'], visibleText: { 'inventory-filter': '사용 가능 종류' } }, shot: true },
    { id: 'sorted-inventory', ops: [key('ArrowDown'), key('Enter')],
      expect: { visibleText: { 'inventory-sort': '이름순' } }, shot: true },
    { id: 'equipment-filter', ops: [key('ArrowUp'), key('Enter')],
      expect: { testidPresent: ['status-menu-owned-equipment-equip_sword'], testidAbsent: ['status-menu-item-item_potion'] }, shot: true },
    { id: 'restore-inventory', ops: [key('Enter', 2)],
      expect: { testidPresent: ['status-menu-item-item_potion', 'status-menu-owned-equipment-equip_sword'], visibleText: { 'inventory-filter': '전체' } } },
    { id: 'settings', note: 'Esc system group opens device options using visible semantic buttons.',
      ops: [key('ArrowLeft'), key('ArrowUp'), key('Enter'), key('ArrowDown', 3), key('Enter'), present('player-option-bgm')],
      expect: { testidPresent: ['player-option-bgm', 'player-option-se', 'player-option-text-speed', 'player-option-menu-motion'] }, shot: true },
    // 음량은 한 줄에 하나, ←→ 로 조절한다. 이 픽스처의 대사창은 목소리가 없어 「대사 목소리」 줄이 없다 — 배경 음악 · 효과음 · 대사 속도 순.
    { id: 'settings-changed', ops: [key('ArrowLeft'), key('ArrowDown', 2), key('Enter')],
      expect: { visibleText: { 'player-option-bgm': '60%', 'player-option-text-speed': '빠르게' } }, shot: true },
    { id: 'shop-entry', ops: [key('Escape', 3), { kind: 'waitFor', testid: 'main-menu', state: 'absent' },
      { kind: 'face', dir: 'right' }, { kind: 'action' }, present('shop-mode-buy')] },
    { id: 'shop', note: 'Split shop shows real buy/sell tabs; upgrade/exchange placeholders are removed.',
      ops: [key('Enter'), present('shop-buy-item_potion')],
      expect: { testidPresent: ['shop-tab-buy', 'shop-tab-sell', 'shop-gold-panel'] }, shot: true },
  ],
};
