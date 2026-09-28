// 기본 도트 창 — 여관과 전투 결과, 그리고 적 그룹 「전투 뒤」 이벤트. 출하 플레이어 경로.
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
      note: '승리 → 머리 창(승리 · EXP · 돈 · 전리품) · 파티 창(걷는 그림 · Lv 전후 · EXP 막대 · LEVEL UP) · 전리품 창(소지금 · 보유 현재 → 받은 뒤).',
      ops: [
        { kind: 'pressUntil', key: 'z', testid: 'battle-result-panel', state: 'present', maxPresses: 60, timeoutMs: 2500 },
        { kind: 'waitForVisible', testid: 'battle-result-party', minAlpha: 0.9, timeoutMs: 15000 },
      ],
      expect: {
        testidPresent: ['battle-result-party', 'battle-result-summary', 'battle-result-confirm', 'battle-result-party-actor_hero'],
        visibleText: { 'battle-result-party-actor_hero': 'LEVEL UP', 'battle-result-summary': 'EXP +9,500', 'battle-result-cards': '소지금 1,120 → 1,144' },
      },
      shot: true,
    },
    {
      id: 'battle-levelup',
      note: '첫 확인 = 보상 전부 공개, 둘째 확인 = 레벨 업한 첫 사람 창(능력치 현재 → 오른 뒤 ▲).',
      ops: [
        // 레벨 업 창은 처음부터 DOM 에 있고 data-active 로 한 장씩 켜진다 — 속성으로 기다린다.
        { kind: 'pressUntil', key: 'z', testid: 'battle-result-levelup-actor_hero', state: 'present', attr: 'data-active', value: 'true', maxPresses: 3, timeoutMs: 1500 },
      ],
      expect: {
        visibleText: { 'battle-result-levelup-actor_hero': '▲' },
      },
      shot: true,
    },
    {
      id: 'after-battle',
      note: '레벨 업 창을 다 넘기면 결과가 닫히고, 필드에서 적 그룹의 「전투 뒤 · 이겼을 때」 대사가 뜬다.',
      ops: [
        { kind: 'pressUntil', key: 'z', testid: 'battle-scene', state: 'absent', maxPresses: 8, timeoutMs: 2500 },
        { kind: 'waitFor', testid: 'dialogue-box', state: 'present', timeoutMs: 15000 },
        // 대사창은 들어오는 연출과 한 글자씩 찍기가 있다 — 다 뜬 뒤에 찍는다.
        { kind: 'waitForAttr', testid: 'dialogue-box', attr: 'data-dialogue-phase', value: 'shown', timeoutMs: 5000 },
        // 한 글자씩 찍는 중에 확인키 한 번 = 끝까지 보이기(창은 닫히지 않는다 — 한 쪽짜리 대사).
        { kind: 'key', key: 'z', times: 1 },
      ],
      expect: {
        testidAbsent: ['battle-scene'],
        visibleText: { 'dialogue-box': '길이 열렸다' },
      },
      shot: true,
    },
    {
      id: 'after-battle-done',
      note: '대사를 넘기면 같은 목록의 스위치가 켜진다(한 번만 실행).',
      ops: [{ kind: 'pressUntil', key: 'Enter', testid: 'dialogue-box', state: 'absent', maxPresses: 4 }],
      expect: {
        testidAbsent: ['dialogue-box'],
        switches: { sw_0001: true },
      },
      shot: true,
    },
  ],
};

