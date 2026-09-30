// 단계 B 증거용 커스텀 스펙: 손잡이(tint·speed·weight·screen)만 다른 스킬 묶음.
// 사용: node scripts/qa/runtime/retro-choreo-b-spec.mjs <out.json> → retro2003-skills-gif.mjs --set custom --custom <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
const base = JSON.parse(readFileSync('.omo/retro-assistant/custom-project.json', 'utf8'));
const ACTOR = 'actor_flame_gladiator';
const clone = base.skills.find((s) => s.id === 'skill_ember_slash');
const layers = [{ sheet: 'hero_flame_aura', anchor: 'user' }, { sheet: 'hero_flame_slash', anchor: 'target' }];
const multi = [{ sheet: 'hero_flame_aura', anchor: 'user' }, { sheet: 'hero_flame_slash', anchor: 'target', onHit: 'each' }];
const rows = [
  ['tint_orig', {}], ['tint_ice', { tint: 'ice' }], ['tint_thunder', { tint: 'thunder' }], ['tint_poison', { tint: 'poison' }],
  ['spd_slow', { speed: 0.6 }], ['spd_base', {}], ['spd_fast', { speed: 1.6 }],
  ['wgt_light', { weight: 'light' }, 3], ['wgt_normal', {}, 3], ['wgt_heavy', { weight: 'heavy' }, 3],
  ['scr_shake', { screen: { shake: 8 } }], ['scr_flash', { screen: { flash: '#ffffff' } }], ['scr_dim', { screen: { dim: true } }], ['scr_cutin', { screen: { cutIn: true } }],
];
const skills = [], choreographies = [], contract = [];
for (const [key, handles, hits] of rows) {
  const id = 'skill_b_' + key, chor = 'chor_b_' + key;
  const skill = { ...clone, id, name: 'B ' + key, retroChoreographyId: chor, stateEffects: [] };
  if (hits) skill.hitSequence = [0.5, 0.5, 0.7];
  skills.push(skill);
  choreographies.push({ id: chor, name: 'B ' + key, motion: 'dash-strike', layers: hits ? multi : layers, tags: { family: 'base' }, ...handles });
  contract.push({ id, actorId: ACTOR, motion: 'dash-strike', layers: layers.map((l) => l.sheet), label: key });
}
const classes = base.classes.map((c) => ({ ...c, skillIds: skills.map((s) => s.id), learnedSkills: skills.map((s) => ({ level: 1, skillId: s.id })) }));
writeFileSync(process.argv[2], JSON.stringify({ ...base, skills, classes, choreographies, contract, states: base.states, log: ['retro-choreo-b evidence spec'] }, null, 1));
console.log('skills', skills.length);
