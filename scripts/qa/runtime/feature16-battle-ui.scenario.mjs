import { writeFeature16Fixture } from '../../../test/fixtures/feature16-battle-ui/runtime.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
const present = testid => ({ kind: 'waitForVisible', testid });
export default {
  id: 'feature16-battle-ui',
  projectFixture: await writeFeature16Fixture(),
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }, { kind: 'seed', seed: 1 }], expect: { testidAbsent: ['title-screen'] } },
    { id: 'formation', note: 'Real player menu: party → formation; active/reserve positions.',
      ops: [key('Escape'), present('main-menu'), key('ArrowDown', 3), key('ArrowRight'), key('ArrowDown', 2), key('Enter'), present('status-menu-formation-actor-actor_hero')],
      expect: { visibleText: { 'status-menu-formation-actor-actor_hero': '참전', 'status-menu-formation-actor-actor_mage': '대기' } }, shot: true },
    { id: 'back-row', ops: [key('Enter'), key('ArrowDown', 4), key('Enter')],
      expect: { visibleText: { 'status-menu-formation-actor-actor_hero': '후열', 'status-menu-formation-toggle-row': '후열 → 전열' } }, shot: true },
    { id: 'active-selection', note: 'Move reserve scout to first position using the visible formation list.',
      ops: [key('Escape'), key('ArrowDown', 3), key('Enter'), key('ArrowUp', 3), key('Enter')],
      expect: { visibleText: { 'status-menu-formation-actor-actor_scout': '참전', 'status-menu-formation-actor-actor_guardian': '대기' } }, shot: true },
    { id: 'field-again', ops: [key('Escape'), key('Escape'), key('Escape'), key('Escape'), { kind: 'waitFor', testid: 'main-menu', state: 'absent' }], expect: { testidAbsent: ['main-menu'] } },
    { id: 'real-battle', note: 'Actual action event launches battle; no report data injected.',
      ops: [{ kind: 'teleport', mapId: 'map_moonwell_forest', x: 14, y: 3 }, { kind: 'waitForPosition', mapId: 'map_moonwell_forest', x: 14, y: 3 }, { kind: 'face', dir: 'up' }, { kind: 'action' }, present('battle-scene'), { kind: 'waitFor', testid: 'actor-command-attack', state: 'present', timeoutMs: 20000 }],
      expect: { testidPresent: ['battle-scene'] }, shot: true },
    { id: 'battle-complete', ops: [{ kind: 'pressUntil', key: 'z', testid: 'battle-scene', state: 'absent', maxPresses: 160, timeoutMs: 300 }, { kind: "waitFor", testid: "battle-transition-overlay", state: "absent" }],
      expect: { battleResult: 'victory', testidAbsent: ['battle-scene'] }, shot: true },
    // Last rail was party; move once to record. Group cursor starts at first command: battle reports.
    { id: 'report-list', ops: [key('Escape'), present('main-menu'), key('ArrowDown'), key('ArrowRight'), key('Enter'), present('status-menu-battle-report-0')],
      expect: { visibleText: { 'status-menu-battle-report-0': '승리' } }, shot: true },
    { id: 'report-detail', ops: [key('Enter'), present('status-menu-battle-report-summary'), key('ArrowDown', 2)],
      expect: { testidPresent: ['status-menu-battle-report-summary'], visibleText: { 'status-menu-showcase-description': '' } }, shot: true },
    { id: 'report-back', ops: [key('Escape')], expect: { testidPresent: ['status-menu-battle-report-0'], testidAbsent: ['status-menu-battle-report-summary'] }, shot: true },
  ],
};
