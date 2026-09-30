// 단계 B 증거 f: 상태 8종(각 오라)을 적 전체에 거는 스킬 묶음 + 한 명에 5종을 몰아 걸어 3개 상한을 보는 스킬. 사용: node ... <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
const base = JSON.parse(readFileSync('.omo/retro-assistant/custom-project.json', 'utf8'));
const clone = base.skills.find((s) => s.id === 'skill_ember_slash');
const rows = [
  ['freeze', ['state_stop']], ['berserk', ['state_berserk']], ['shield', ['state_protect']], ['wet', ['state_wet']],
  ['poison', ['state_deep_poison']], ['dark', ['state_blind']], ['petrify', ['state_petrify']], ['regen', ['state_regen']],
  ['cap5', ['state_deep_poison', 'state_protect', 'state_berserk', 'state_wet', 'state_blind']],
];
const skills = rows.map(([k, ids]) => {
  const s = { ...clone, id: 'skill_aura_' + k, name: '오라 ' + k, scope: 'allEnemies', power: 1, effect: { kind: 'support' }, stateEffects: ids.map((stateId) => ({ stateId, chance: 100, operation: 'add' })) };
  delete s.retroChoreographyId; delete s.elementId; return s;
});
const classes = base.classes.map((c) => ({ ...c, skillIds: skills.map((s) => s.id), learnedSkills: skills.map((s) => ({ level: 1, skillId: s.id })) }));
writeFileSync(process.argv[2], JSON.stringify({ ...base, skills, classes, choreographies: [], contract: skills.map((s) => ({ id: s.id, actorId: 'actor_flame_gladiator', motion: 'auto', layers: [], label: s.name })), log: ['retro-choreo-b evidence f'] }, null, 1));
