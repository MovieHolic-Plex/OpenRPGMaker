// 기본 도트 창 — 여관과 전투 결과. 출하 플레이어 경로.
// node scripts/runtime-qa.mjs --scenario inn-battle-pixel
import { writeInnBattlePixelFixture } from './inn-battle-pixel-fixture.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
export default {
  id: 'inn-battle-pixel',
  projectFixture: await writeInnBattlePixelFixture(),
  query: { e2eVitals: '1' },
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }, { kind: 'seed', seed: 1 }, { kind: 'setVitals', hp: 60, mp: 3, actorIds: ['actor_hero', 'actor_guardian', 'actor_mage', 'actor_scout'] }], expect: { testidAbsent: ['title-screen'] } },
    {
      id: 'inn',
      note: '여관 → 파티 네 명 HP·MP 현재 → 묵은 뒤, 소지금 1,200 → 1,120 G, 회복 합계.',
      ops: [{ kind: 'face', dir: 'right' }, { kind: 'action' }, { kind: 'waitForVisible', testid: 'inn-party' }],
      expect: {
        testidPresent: ['inn-stay', 'inn-cancel', 'inn-party-row-actor_hero'],
        visibleText: { 'inn-summary-gold': '1,200 → 1,120', 'inn-party-hp-0': '60 → 514', 'inn-summary-hp': 'HP +' },
      },
      shot: true,
    },
    {
      id: 'inn-rest',
      ops: [key('Enter'), { kind: 'waitFor', testid: 'inn-scene', state: 'absent', timeoutMs: 20000 }],
      expect: { testidAbsent: ['inn-scene'] },
    },
    {
      id: 'battle-open',
      ops: [{ kind: 'face', dir: 'left' }, { kind: 'action' }, { kind: 'waitFor', testid: 'actor-command-attack', state: 'present', timeoutMs: 30000 }],
      expect: { testidPresent: ['battle-scene'] },
    },
    {
      id: 'battle-result',
      note: '승리 → 파티 창(걷는 그림 · Lv 전후 · EXP 막대 · 다음 Lv까지) · 레벨 업 창(현재 → 오른 뒤 ▲) · 전리품.',
      ops: [
        { kind: 'pressUntil', key: 'z', testid: 'battle-result-panel', state: 'present', maxPresses: 60, timeoutMs: 2500 },
        { kind: 'waitForVisible', testid: 'battle-result-exp-bar', minAlpha: 0.9, timeoutMs: 15000 },
      ],
      expect: {
        testidPresent: ['battle-result-party', 'battle-result-levelups', 'battle-result-confirm', 'battle-result-party-actor_hero'],
        visibleText: { 'battle-result-party-actor_hero': 'EXP +9,500', 'battle-result-levelups': '▲' },
      },
      shot: true,
    },
  ],
};

