// Original Joseon folklore pilot records. Run from repository root with vite-node.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeSkillRecord, normalizeStateRecord } from '@/project/databaseRecordModel';
import { normalizeElementRecords } from '@/project/databaseUtilityRecordModel';
import { resolveSkillChoreography } from '@/assets/retroSkillCatalog';
import type { SkillRecord, StateRecord } from '@/project/types';

const root = 'content-packs/joseon-folklore/skills';
const steering = '/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/steering.md';
console.log(readFileSync(steering, 'utf8').trim());
const ids = JSON.parse(readFileSync('content-packs/joseon-folklore/ids.json', 'utf8'));
const out = (name: string, value: unknown) => writeFileSync(`${root}/${name}`, JSON.stringify(value, null, 2) + '\n');
// Regeneration invalidates readiness until PNG review and scoped smoke are saved.
out('status.json', { phase: 'pilot', ready: false, counts: {}, reviewFiles: [], reason: 'regeneration-in-progress', userApproved: false });
type Seed = Partial<SkillRecord> & Pick<SkillRecord, 'id' | 'name'>;
const add = (stateId: string, chance = 100) => ({ stateId, chance, operation: 'add' as const });
const remove = (stateId: string) => ({ stateId, chance: 100, operation: 'remove' as const });
const damage = (statistic: 'attack' | 'mind') => ({ kind: 'damage' as const, statistic, affects: 'hp' as const });
const physical = ids.elements.physical;
const seeds: Seed[] = [
  { id: ids.classSkills.warrior[0], name: '장작가름', scope: 'enemy', power: 20, mpCost: { flat: 4, percentMax: 0 }, effect: damage('attack'), elementId: physical, hitRate: 95, retroChoreographyId: 'skill_hero_rising_blade', description: '기력 4. 적 하나를 물리 위력 20으로 한 번 벤다. 기본 명중률 95%.' },
  { id: ids.classSkills.warrior[1], name: '쇠숨', scope: 'self', power: 0, mpCost: { flat: 5, percentMax: 0 }, effect: { kind: 'support' }, stateEffects: [add(ids.states['iron-breath'])], retroChoreographyId: 'skill_monk_iron_body', description: '기력 5. 자신의 물리 방어 계산 배율을 1.6배로 만든다. 세 번째 자기 차례 시작에 해제되며 전투가 끝나면 풀린다.' },
  { id: ids.classSkills.rogue[0], name: '쌍바늘', scope: 'enemy', power: 10, mpCost: { flat: 4, percentMax: 0 }, effect: damage('attack'), elementId: physical, hitRate: 95, hitSequence: [0.65, 0.65], retroChoreographyId: 'skill_scout_twin_strike', description: '기력 4. 적 하나를 두 번 찌른다. 각 타격은 물리 위력 10 계산값의 65%이며 기본 명중률은 타격마다 95%.' },
  { id: ids.classSkills.rogue[1], name: '독묻힌 날', scope: 'enemy', power: 14, mpCost: { flat: 5, percentMax: 0 }, effect: damage('attack'), elementId: physical, hitRate: 95, stateEffects: [add('state_poison', 60)], retroChoreographyId: 'skill_scout_venom_blade', description: '기력 5. 적 하나를 물리 위력 14로 찌른다. 명중하면 기본 확률 60%로 독을 건다(상태 저항 적용). 독은 차례 시작마다 최대 HP의 6% 피해를 주며 HP 1 아래로 깎지 않는다.' },
  { id: ids.classSkills.shaman[0], name: '잿불부', scope: 'enemy', power: 28, mpCost: { flat: 6, percentMax: 0 }, effect: damage('mind'), elementId: ids.elements.fire, retroChoreographyId: 'skill_mage_fireball', description: '기력 6. 적 하나에게 불 속성 정신력 계열 위력 28의 피해를 준다. 화상 상태를 걸지는 않는다.' },
  { id: ids.classSkills.shaman[1], name: '서리부', scope: 'enemy', power: 30, mpCost: { flat: 7, percentMax: 0 }, effect: damage('mind'), elementId: ids.elements.ice, retroChoreographyId: 'skill_sprite_ice_ice_shard', description: '기력 7. 적 하나에게 얼음 속성 정신력 계열 위력 30의 피해를 준다. 행동 봉쇄나 민첩 감소 효과는 없다.' },
  { id: ids.classSkills.taoist[0], name: '생명수', scope: 'ally', power: 45, damageFormula: '45', mpCost: { flat: 6, percentMax: 0 }, effect: { kind: 'healing', statistic: 'mind', affects: 'hp' }, retroChoreographyId: 'skill_cleric_heal_light', description: '기력 6. 살아 있는 아군 하나의 HP를 45 회복한다. 최대 HP를 넘지 않는다.' },
  { id: ids.classSkills.taoist[1], name: '맑힘부', scope: 'ally', power: 0, mpCost: { flat: 5, percentMax: 0 }, effect: { kind: 'support' }, stateEffects: ['state_poison', 'state_deep_poison', 'state_silence', ids.states['ghost-seal'], ids.states['fox-charm']].map(remove), retroChoreographyId: 'skill_cleric_purify', description: '기력 5. 아군 하나의 독·맹독·침묵·귀봉·여우홀림을 해제한다. HP 회복과 부활 효과는 없다.' },
  { id: ids.enemySkills['tusk-charge'], name: '엄니들이받기', scope: 'enemy', power: 20, mpCost: { flat: 3, percentMax: 0 }, effect: damage('attack'), elementId: physical, hitRate: 90, retroChoreographyId: 'skill_mon_tusk_charge', description: '기력 3. 상대 하나에게 물리 위력 20의 피해를 준다. 기본 명중률 90%.' },
  { id: ids.enemySkills['straw-club'], name: '짚방망이', scope: 'enemy', power: 18, mpCost: { flat: 3, percentMax: 0 }, effect: damage('attack'), elementId: physical, hitRate: 95, retroChoreographyId: 'skill_mon_body_slam', description: '기력 3. 상대 하나를 방망이로 내려친다. 물리 위력 18, 기본 명중률 95%. 기절 효과는 없다.' },
  { id: ids.enemySkills['sorrow-cry'], name: '한맺힌 울음', scope: 'allEnemies', power: 0, mpCost: { flat: 5, percentMax: 0 }, effect: { kind: 'support' }, stateEffects: [add(ids.states['ghost-seal'], 50)], retroChoreographyId: 'skill_mon_banshee_wail', description: '기력 5. 상대 전체에게 각각 기본 확률 50%로 귀봉을 건다(상태 저항 적용). 귀봉은 기술 사용을 막고 기본 공격·아이템은 허용하며 두 번째 자기 차례 시작에 풀린다.' },
  { id: ids.enemySkills['bronze-smash'], name: '청동내리울림', scope: 'allEnemies', power: 32, mpCost: { flat: 0, percentMax: 0 }, effect: damage('attack'), elementId: physical, hitRate: 95, chargeTurns: 1, retroChoreographyId: 'skill_mon_quake_stomp', description: '기력 소모 없음. 준비를 예고하고 다음 자기 차례에 상대 전체를 내려친다. 물리 위력 32, 기본 명중률 95%. 예고를 보고 방어·회복으로 대비할 수 있다.' },
];
const skills = seeds.map(s => normalizeSkillRecord({ successRate: 100, variance: 0, hitRate: 100, criticalRate: 0, ...s }));
const state = (slug: string, name: string, turns: number, runtimeEffects: StateRecord['runtimeEffects'], battleAura: string): StateRecord => normalizeStateRecord({
  id: ids.states[slug], name, removalCondition: '전투 종료 시 해제', restriction: runtimeEffects?.blocksSkillUse ? '스킬 사용 불가' : '없음',
  recoverNaturallyFromTurn: turns, recoverNaturallyChance: 100, recoverWhenHitChance: 0,
  runtimeEffects: { restrictsAction: false, blocksSkillUse: false, hpDamagePercentPerTurn: 0, hpHealPercentPerTurn: 0, attackMultiplier: 1, defenseMultiplier: 1, agilityMultiplier: 1, removeOnBattleEnd: true, ...runtimeEffects }, battleAura,
});
const states = [
  state('iron-breath', '쇠숨', 3, { physicalDefenseMultiplier: 1.6 }, 'shield-shimmer'),
  state('shadow-step', '그림자걸음', 3, { evasionChance: 30 }, 'none'),
  state('protective-talisman', '호신부', 3, { physicalDefenseMultiplier: 1.4, magicDefenseMultiplier: 1.4 }, 'shield-shimmer'),
  state('ghost-seal', '귀봉', 2, { blocksSkillUse: true }, 'silence-mute'),
  state('fox-charm', '여우홀림', 3, { attackMultiplier: 0.75 }, 'none'),
  state('heaven-blessing', '하늘복', 3, { attackMultiplier: 1.2, defenseMultiplier: 1.2, hpHealPercentPerTurn: 5 }, 'regen-sparkle'),
];
const elements = normalizeElementRecords(Object.entries(ids.elements).map(([key, id]) => ({ id: id as string, name: ({ physical: '물리', fire: '불', ice: '얼음', lightning: '번개', spirit: '영혼' } as Record<string, string>)[key], kind: key === 'physical' ? 'physical' : 'magical', rateLabels: ['A', 'B', 'C', 'D', 'E'], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } })));
out('data.json', { skills, states, elements });
const choreographies = skills.map(skill => {
  const c = resolveSkillChoreography(skill);
  if (!c) throw new Error(`Missing choreography ${skill.id}`);
  return { skillId: skill.id, retroChoreographyId: c.id, motion: c.motion, kind: c.kind, layers: c.skill.layers.map(layer => {
    const path = `public/assets/generated/pixel-fx/${layer.key}.png`;
    return { ...layer, path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
  }) };
});
out('choreography-sources.json', choreographies);
const slugs = skills.map(s => s.id.replace(/^skill_jf_(enemy_)?/, '').replaceAll('_', '-'));
out('art.json', skills.map((s, i) => ({ skillId: s.id, resourceId: `jf-icon-${slugs[i]}`, path: `assets/joseon-folklore/skills/${slugs[i]}.png`, sourcePath: `${root}/icons/${slugs[i]}.png`, size: [32, 32], usage: 'review-and-supervisor-resource-registration', runtimeSkillIconField: null })));
out('design.json', {
  packId: ids.packId, phase: 'pilot', engine: 'rm2k3', skin: 'retro2003', resource: { field: 'mpCost', displayName: '기력', resource2: false },
  learnedSkills: Object.entries(ids.classSkills).map(([role, values]) => ({ classId: ids.classes[role], skills: (values as string[]).slice(0, 2).map((skillId, i) => ({ skillId, level: i ? 3 : 1, acquisition: '해당 직업 레벨 도달', region: '초반 마을·들판·폐사당' })) })),
  enemySkills: ['wild-boar', 'straw-dokkaebi', 'maiden-ghost', 'bronze-dokkaebi'].map((slug, i) => ({ enemyId: ids.enemies[slug], skillId: skills[i + 8].id, region: ['들판', '폐사당 앞', '폐사당', '폐사당 보스방'][i], suggestedLevel: [1, 2, 3, 4][i] })),
  stateDefinitions: [
    { id: states[0].id, effect: '물리 방어 계산 배율 1.6. 피해 40% 감소 보장은 아님.', source: skills[1].id },
    { id: states[1].id, effect: '물리 피해 기술과 기본 공격의 명중률에서 30%p 차감. 마법 회피는 아님.', source: '후속 레벨5 기술용 정본 상태 정의; 파일럿 부여 기술 없음' },
    { id: states[2].id, effect: '물리·마법 방어 계산 배율 각각 1.4. 피해 40% 감소 보장은 아님.', source: '후속 레벨5 기술용 정본 상태 정의; 파일럿 부여 기술 없음' },
    { id: states[3].id, effect: '모든 기술 사용 봉쇄. 행동불가·마법만 봉쇄는 아님.', source: skills[10].id },
    { id: states[4].id, effect: '공격 계산 능력치 0.75배. 조종·혼란·아군 공격 없음.', source: '적 후속 기술용 정본 상태 정의; 파일럿 부여 기술 없음' },
    { id: states[5].id, effect: '공격·방어 1.2배, 자기 차례 시작 최대 HP 5% 회복. 재생은 해제 차례에도 먼저 적용.', source: '후속 레벨16 기술용 정본 상태 정의; 파일럿 부여 기술 없음' },
  ],
  integrationNotes: [
    '기술 12개만 저작. 전체판 직업24+적12 확장은 감독자 후속 지시 이후.',
    '아이템 효과 ownskill_jf_item_*는 consumables 소유. 이 폴더에는 해당 기술을 정의하지 않는다.',
    'state_poison/state_deep_poison/state_silence는 prototype-database.json의 기존 상태 참조. 기존 상태를 덮어쓰지 않는다.',
    '부활 기술은 레벨8 후속판. 현재 엔진은 healing + state_death remove로 죽은 아군 선택을 허용한다. state_death add는 지원하지 않는다.',
    '회복량45는 damageFormula=45, variance=0, criticalRate=0. 상한 HP에서는 실제 증가량이 줄어든다.',
    '확률은 stateEffects.chance와 대상 stateRates의 곱. damage hitRate는 물리 회피 상태에 따라 낮아진다.',
    '고정 지속 턴은 전역 라운드가 아니라 대상 자신의 upkeep 횟수. 두 번째/세 번째 차례 시작에 해제.',
    '속성 상성은 대상 elementRates가 있어야 달라진다. 미지정은 등급C 100%.',
    '수치는 신규 레코드 소유. 빌린 연출 원본 mechanic/설명/타수를 가져오지 않는다.',
    'SkillRecord에 iconResourceId/choreographySkillId는 없다. 아이콘은 art.json에 보관하고 감독자가 별도 리소스 등록한다.',
    '시각 검토는 원본 FX PNG와 새 아이콘 증거. 실제 출하 플레이어 녹화·프로젝트 통합·정본 저장은 감독자 소유.',
  ],
});
console.log('Saved pilot: skills=12 states=6 elements=5, resolved every original FX layer.');
