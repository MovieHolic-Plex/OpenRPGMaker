import { writeEscItemEmptyFixture } from './esc-item-empty-fixture.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
const present = (testid) => ({ kind: 'waitFor', testid, state: 'present' });
export default {
  id: 'esc-item-empty',
  // 옛 ESC 메뉴(menuUiStyle 스킨) 화면을 검사한다 — 기본이 허브 메뉴가 된 뒤에도 같은 화면을 본다.
  systemPatch: { menuLayout: "legacy" },
  projectFixture: await writeEscItemEmptyFixture(),
  query: { e2eVitals: '1' },
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }], expect: { testidAbsent: ['title-screen'] } },
    {
      id: 'empty-items',
      note: 'Empty inventory shows the empty label in the work panel, with no showcase.',
      ops: [key('Escape'), present('main-menu')],
      expect: { testidPresent: ['status-menu-detail'], testidAbsent: ['status-menu-detail-showcase'] },
      shot: true,
    },
    {
      id: 'empty-function',
      note: 'Right enters the empty items body; keyboard still owns the panel.',
      ops: [key('ArrowRight')],
      expect: { testidPresent: ['status-menu-detail'] },
      shot: true,
    },
  ],
};
