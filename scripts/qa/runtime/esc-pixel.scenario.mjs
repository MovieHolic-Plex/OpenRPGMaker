// 기본 ESC 메뉴(스킨 pixel) — 상점 도트 창과 같은 창 체계. 출하 플레이어 경로.
// node scripts/runtime-qa.mjs --scenario esc-pixel
import { writeEscPixelFixture } from './esc-pixel-fixture.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
const present = (testid) => ({ kind: 'waitFor', testid, state: 'present' });
export default {
  id: 'esc-pixel',
  projectFixture: await writeEscPixelFixture(),
  query: { e2eVitals: '1' },
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }, { kind: 'setVitals', hp: 100, mp: 5, actorIds: ['actor_hero', 'actor_guardian', 'actor_mage', 'actor_scout'] }], expect: { testidAbsent: ['title-screen'] } },
    {
      id: 'landing',
      note: 'Esc → 파티 창: 걷는 캐릭터 4명, HP·MP·EX 숫자, 마도사 「독」. 오른쪽 명령·소지금·장소·시간 창.',
      ops: [key('Escape'), present('status-menu-party-overview'), { kind: 'waitForVisible', testid: 'status-menu-overview-character-3' }],
      expect: {
        testidPresent: ['status-menu-overview-exp-0', 'status-menu-gold', 'status-menu-time'],
        visibleText: { 'status-menu-overview-states-2': '독', 'status-menu-overview-states-0': '정상', 'status-menu-overview-hp-0': '' },
      },
      shot: true,
    },
    {
      id: 'items',
      ops: [key('Enter'), present('status-menu-item-item_antidote_plus')],
      expect: { testidPresent: ['status-menu-item-facts'] },
      shot: true,
    },
    {
      id: 'potion-targets',
      note: '회복약 → 대상 카드: 100/514 → 150 ▲50, 막대의 늘어날 구간.',
      ops: [key('Enter'), present('status-menu-item-target-actor_hero')],
      expect: { visibleText: { 'status-menu-item-target-actor_hero': '→ 150' } },
      shot: true,
    },
    {
      id: 'antidote-targets',
      note: '고급 해독제 → 마도사 카드 「독 → 정상」.',
      ops: [key('Escape'), { kind: 'pressUntil', key: 'ArrowDown', testid: 'status-menu-item-item_antidote_plus', attr: 'aria-current', value: 'true', state: 'present', maxPresses: 12 }, key('Enter'), present('status-menu-item-target-actor_mage-states')],
      expect: { visibleText: { 'status-menu-item-target-actor_mage-states': '→ 정상' } },
      shot: true,
    },
    {
      id: 'equipment-slots',
      note: '장비 → 주인공 → 부위 목록과 현재 능력치, 맨 아래 「최강 장비 합계 +N」.',
      ops: [key('Escape'), key('Escape'), key('ArrowDown', 2), key('Enter'), key('Enter'), present('status-menu-equipment-optimize')],
      expect: { visibleText: { 'status-menu-equipment-optimize': '합계 +' }, testidPresent: ['status-menu-stat-delta'] },
      shot: true,
    },
    {
      id: 'equipment-candidates',
      note: '무기 → 철 검 후보: 행에 「공격+N」, 비교 창에 현재 → 변경 후 ▲.',
      ops: [key('Enter'), present('status-menu-equipment-item-equip_iron_sword'), { kind: 'pressUntil', key: 'ArrowDown', testid: 'status-menu-equipment-item-equip_iron_sword', attr: 'aria-current', value: 'true', state: 'present', maxPresses: 6 }],
      expect: { visibleText: { 'status-menu-equipment-item-equip_iron_sword': '공격+', 'status-menu-stat-delta-공격': '▲' } },
      shot: true,
    },
    {
      id: 'optimize',
      note: '최강 장비 실행 → 다시 누르면 「이미 최강」.',
      ops: [key('Escape'), { kind: 'pressUntil', key: 'ArrowDown', testid: 'status-menu-equipment-optimize', attr: 'aria-current', value: 'true', state: 'present', maxPresses: 8 }, key('Enter'), present('status-menu-equipment-optimize')],
      expect: { visibleText: { 'status-menu-equipment-optimize': '이미 최강' } },
      shot: true,
    },
    { id: 'back-to-field', ops: [{ kind: 'pressUntil', key: 'Escape', testid: 'main-menu', state: 'absent', maxPresses: 8 }, { kind: 'waitFor', testid: 'main-menu', state: 'absent' }], expect: { testidAbsent: ['main-menu'] } },
  ],
};

