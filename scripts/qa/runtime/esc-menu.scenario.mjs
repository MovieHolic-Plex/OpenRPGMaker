import { writeEscMenuFixture } from './esc-menu-fixture.mjs';
const key = (key, times = 1) => ({ kind: 'key', key, times });
const present = (testid) => ({ kind: 'waitFor', testid, state: 'present' });
export default {
  id: 'esc-menu',
  projectFixture: await writeEscMenuFixture(),
  query: { e2eVitals: '1' },
  beats: [
    { id: 'title', expect: { testidPresent: ['title-screen'] } },
    { id: 'field', ops: [key('Enter'), { kind: 'waitForRuntime' }, { kind: 'setVitals', hp: 100, mp: 5, actorIds: ['actor_hero','actor_guardian','actor_mage','actor_scout'] }], expect: { testidAbsent: ['title-screen'] } },
    { id: 'preview', note: 'Esc immediately shows the item preview and key hints, without a duplicate party panel.', ops: [key('Escape'), present('main-menu')], expect: { testidAbsent: ['status-menu-party'], testidPresent: ['status-menu-item-item_potion','status-menu-controls'] }, shot: true },
    { id: 'targets', note: 'Right enters the body; potion targets show current HP and expected recovery.', ops: [key('ArrowRight'), key('Enter'), present('status-menu-item-target-actor_hero')], expect: { visibleText: { 'status-menu-item-target-actor_hero': '100/514 → 150' }, testidAbsent: ['status-menu-party'] }, shot: true },
    { id: 'use-once', ops: [key('Enter')], expect: { visibleText: { 'status-menu-item-target-actor_hero': '150/514 → 200', 'status-menu-detail-title': '4개' } }, shot: true },
    { id: 'use-again', ops: [key('Enter')], expect: { visibleText: { 'status-menu-item-target-actor_hero': '200/514 → 250', 'status-menu-detail-title': '3개' } } },
    { id: 'next-target', ops: [key('ArrowDown'), key('Enter')], expect: { visibleText: { 'status-menu-item-target-actor_guardian': '150/514 → 200', 'status-menu-detail-title': '2개' } } },
    { id: 'back-to-list', ops: [key('Escape')], expect: { testidAbsent: ['status-menu-item-target-actor_hero'], testidPresent: ['status-menu-item-item_potion'] } },
    { id: 'skills', note: 'Skill row and showcase display one animation cell, not the entire sheet.', ops: [key('ArrowLeft'), key('ArrowDown'), key('ArrowRight'), key('Enter')], expect: { testidPresent: ['status-menu-entry-icon-skill-skill_attack', 'status-menu-showcase-art'] }, shot: true },
    { id: 'next-skill', ops: [key('ArrowDown')], expect: { visibleText: { 'status-menu-showcase-name': '검격' }, testidPresent: ['status-menu-entry-icon-skill-skill_sword_slash'] }, shot: true },
    { id: 'return-to-items', ops: [key('ArrowLeft'), key('ArrowUp'), key('ArrowRight')], expect: { testidPresent: ['status-menu-item-item_potion'] } },
    { id: 'equipment-slots', ops: [key('ArrowLeft'), key('ArrowDown',2), key('ArrowRight'), key('Enter')], expect: { testidPresent: ['status-menu-equipment-slot-weapon'] }, shot: true },
    { id: 'equipment-comparison', ops: [key('Enter')], expect: { testidPresent: ['status-menu-stat-delta'] }, shot: true },
    { id: 'party', ops: [key('ArrowLeft'), key('ArrowDown'), key('ArrowRight')], expect: { testidPresent: ['status-menu-party','status-menu-group-command-status'] }, shot: true },
    { id: 'system', ops: [key('ArrowLeft'), key('ArrowDown',2), key('ArrowRight')], expect: { testidPresent: ['status-menu-group-command-to-title','status-menu-group-command-save'] }, shot: true },
    { id: 'back-to-field', ops: [key('Escape'), key('Escape'), { kind: 'waitFor', testid: 'main-menu', state: 'absent' }], expect: { testidAbsent: ['main-menu'], mapId: 'map_lantern_village' } },
  ],
};
