// 단계 B 증거 e: 계약·기록·레시피가 없는 스킬 → 자동 추천 경로. 사용: node ... <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
const base = JSON.parse(readFileSync('.omo/retro-assistant/custom-project.json', 'utf8'));
const clone = base.skills.find((s) => s.id === 'skill_ember_slash');
const dmg = (st) => ({ kind: 'damage', statistic: st, affects: 'hp' });
const rows = [
  ['fire3', { name: '화염 연타', scope: 'enemy', effect: dmg('mind'), elementId: 'fire', hitSequence: [0.4, 0.3, 0.3] }],
  ['massheal', { name: '생명의 비', scope: 'allAllies', effect: { kind: 'healing' } }],
  ['heal', { name: '치유의 손길', scope: 'ally', effect: { kind: 'healing' } }],
  ['thunderall', { name: '뇌진', scope: 'allEnemies', effect: dmg('mind'), elementId: 'thunder' }],
  ['ice', { name: '서리 창', scope: 'enemy', effect: dmg('mind'), elementId: 'ice' }],
  ['sweep', { name: '휩쓸기', scope: 'allEnemies', effect: dmg('attack') }],
  ['fist5', { name: '난타', scope: 'enemy', effect: dmg('attack'), hitSequence: [0.2, 0.2, 0.2, 0.2, 0.2] }],
  ['poison', { name: '독칼', scope: 'enemy', effect: dmg('attack'), elementId: 'poison' }],
];
const skills = rows.map(([k, o]) => ({ ...clone, id: 'skill_auto_' + k, stateEffects: [], retroChoreographyId: undefined, elementId: undefined, ...o }));
skills.forEach((s) => { if (s.elementId === undefined) delete s.elementId; });
skills.forEach((s) => { if (s.retroChoreographyId === undefined) delete s.retroChoreographyId; if (s.effect.kind === 'healing') s.power = 60; });
const classes = base.classes.map((c) => ({ ...c, skillIds: skills.map((s) => s.id), learnedSkills: skills.map((s) => ({ level: 1, skillId: s.id })) }));
writeFileSync(process.argv[2], JSON.stringify({ ...base, skills, classes, choreographies: [], contract: skills.map((s) => ({ id: s.id, actorId: 'actor_flame_gladiator', motion: 'auto', layers: [], label: s.name })), log: ['retro-choreo-b evidence e'] }, null, 1));
console.log('skills', skills.length);
