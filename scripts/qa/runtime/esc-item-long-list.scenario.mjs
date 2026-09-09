import { writeEscItemLongListFixture } from './esc-item-empty-fixture.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
const present = (testid) => ({ kind: 'waitFor', testid, state: 'present' });
export default {
  id: 'esc-item-long-list',
  projectFixture: await writeEscItemLongListFixture(),
  query: { e2eVitals: '1' },
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }], expect: { testidAbsent: ['title-screen'] } },
    {
      id: 'long-list',
      note: 'Long inventory keeps compact rows, icons, and a selected-item showcase.',
      ops: [key('Escape'), present('main-menu'), key('ArrowRight')],
      expect: { testidPresent: ['status-menu-detail-showcase', 'status-menu-item-item_potion', 'status-menu-item-facts'], visibleText: { 'status-menu-item-fact-type': '약', 'status-menu-item-fact-effects': 'HP', 'status-menu-item-fact-eligibility': '가능', 'status-menu-item-fact-target': '아군', 'status-menu-item-fact-consumption': '소모' } },
      shot: true,
    },
    {
      id: 'scroll-down',
      note: 'ArrowDown keeps list DOM and moves the showcase to the next item.',
      ops: [key('ArrowDown', 8)],
      expect: { testidPresent: ['status-menu-detail-showcase', 'status-menu-item-facts'], visibleText: { 'status-menu-item-fact-type': '일반', 'status-menu-item-fact-effects': '없음', 'status-menu-item-fact-eligibility': '불가', 'status-menu-item-fact-target': '아군', 'status-menu-item-fact-consumption': '소모' } },
      shot: true,
    },
  ],
};
