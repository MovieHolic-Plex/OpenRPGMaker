// Original Joseon folklore full records. Rebuild with the README esbuild commands.
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
out('status.json', { phase: 'full', ready: false, counts: {}, reviewFiles: [], reason: 'regeneration-in-progress', userApproved: false });
type Seed = Partial<SkillRecord> & Pick<SkillRecord, 'id' | 'name'>;
const add = (stateId: string, chance = 100) => ({ stateId, chance, operation: 'add' as const });
const remove = (stateId: string) => ({ stateId, chance: 100, operation: 'remove' as const });
const damage = (statistic: 'attack' | 'mind') => ({ kind: 'damage' as const, statistic, affects: 'hp' as const });
const physical = ids.elements.physical;
const healing = { kind: 'healing' as const, statistic: 'mind' as const, affects: 'hp' as const };
const support = { kind: 'support' as const };
const mk = (id: string, name: string, scope: SkillRecord['scope'], power: number, mp: number, effect: SkillRecord['effect'], fx: string, detail: string, extra: Partial<SkillRecord> = {}): Seed => ({
  id, name, scope, power, mpCost: { flat: mp, percentMax: 0 }, effect, retroChoreographyId: fx, description: `기력 ${mp}. ${detail}`, ...extra,
});
const warrior=ids.classSkills.warrior, rogue=ids.classSkills.rogue, shaman=ids.classSkills.shaman, taoist=ids.classSkills.taoist;
const S=ids.states, E=ids.elements, N=ids.enemySkills;
const seeds: Seed[] = [
  mk(warrior[0], '장작가름', 'enemy', 20, 4, damage('attack'), 'skill_hero_rising_blade', '적1 물리 위력20·1타. 명중95%.', {elementId:physical,hitRate:95}),
  mk(warrior[1], '쇠숨', 'self', 0, 5, support, 'skill_monk_iron_body', '자기 쇠숨100%: 물리 방어 계산1.6배. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['iron-breath'])]}),
  mk(warrior[2], '돌개베기', 'allEnemies', 18, 8, damage('attack'), 'skill_hero_whirlwind', '적전체 물리 위력18·각1타. 명중95%.', {elementId:physical,hitRate:95}),
  mk(warrior[3], '땅가르기', 'allEnemies', 32, 12, damage('attack'), 'skill_minotaur_pal_split_earth', '예고 후 다음 자기 차례 적전체 물리 위력32·각1타. 명중95%.', {elementId:physical,hitRate:95,chargeTurns:1}),
  mk(warrior[4], '피의서약', 'self', 0, 12, support, 'skill_dark_knight_blood_price', '최대HP12% 대가(HP1하한). 자기 하늘복100%: 공격·방어1.2배, 차례당 HP5% 재생. 3번째 자기 차례 시작 해제.', {hpCostPercent:12,stateEffects:[add(S['heaven-blessing'])]}),
  mk(warrior[5], '산의수호', 'allAllies', 0, 16, support, 'skill_guard_iron_wall', '아군전체 쇠숨·호신부100%: 물리 방어 계산2.24배·마법1.4배. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['iron-breath']),add(S['protective-talisman'])]}),
  mk(rogue[0], '쌍바늘', 'enemy', 10, 4, damage('attack'), 'skill_scout_twin_strike', '적1 물리 위력10 계산의65%씩2타. 타마다 명중95%.', {elementId:physical,hitRate:95,hitSequence:[0.65,0.65]}),
  mk(rogue[1], '독묻힌날', 'enemy', 14, 5, damage('attack'), 'skill_scout_venom_blade', '적1 물리14·1타/명중95%. 명중 후 독60%: 자기 차례 최대HP6% 피해, HP1하한.', {elementId:physical,hitRate:95,stateEffects:[add('state_poison',60)]}),
  mk(rogue[2], '그림자걸음', 'self', 0, 7, support, 'skill_butler_bow', '자기 그림자걸음100%: 물리 명중률30%p 차감. 마법 회피 없음. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['shadow-step'])]}),
  mk(rogue[3], '급소찌르기', 'enemy', 36, 10, damage('attack'), 'skill_scout_shadow_step', '적1 물리1타. 위력36+공격/2 수식으로 방어 계산 생략. 명중95%.', {elementId:physical,hitRate:95,damageFormula:'power + a.atk / 2'}),
  mk(rogue[4], '연막장막', 'allAllies', 0, 13, support, 'skill_hermit_mist', '아군전체 그림자걸음100%: 물리 명중률30%p 차감. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['shadow-step'])]}),
  mk(rogue[5], '달빛쌍참', 'enemy', 44, 16, damage('attack'), 'skill_samurai_twin_moon', '예고 후 다음 자기 차례 적1 물리44 계산의75%씩2타. 타마다 명중95%.', {elementId:physical,hitRate:95,hitSequence:[0.75,0.75],chargeTurns:1}),
  mk(shaman[0], '잿불부', 'enemy', 28, 6, damage('mind'), 'skill_mage_fireball', '적1 불 속성 정신력 위력28·1타. 명중100%.', {elementId:E.fire}),
  mk(shaman[1], '서리부', 'enemy', 30, 7, damage('mind'), 'skill_sprite_ice_ice_shard', '적1 얼음 속성 정신력 위력30·1타. 명중100%. 행동 봉쇄 없음.', {elementId:E.ice}),
  mk(shaman[2], '벼락부', 'allEnemies', 24, 9, damage('mind'), 'skill_mage_chain_lightning', '적전체 번개 속성 정신력 위력24·각1타. 명중100%.', {elementId:E.lightning}),
  mk(shaman[3], '혼빨기', 'enemy', 34, 10, damage('mind'), 'skill_wraith_mage_drain', '적1 영성 정신력 위력34·1타. 명중100%. 준 HP피해40%를 자기HP로 흡수(최소1).', {elementId:E.spirit,drainPercent:40}),
  mk(shaman[4], '귀봉부', 'enemy', 0, 12, support, 'skill_shrine_maiden_seal', '적1 귀봉70%: 모든 기술 봉쇄, 기본 공격·아이템 허용. 2번째 자기 차례 시작 해제.', {stateEffects:[add(S['ghost-seal'],70)]}),
  mk(shaman[5], '하늘불', 'allEnemies', 62, 22, damage('mind'), 'skill_mage_meteor', '예고 후 다음 자기 차례 적전체 불 속성 정신력 위력62·각1타. 명중100%.', {elementId:E.fire,chargeTurns:1}),
  mk(taoist[0], '생명수', 'ally', 45, 6, healing, 'skill_cleric_heal_light', '살아 있는 아군1 HP45 회복(최대HP 상한).', {damageFormula:'45'}),
  mk(taoist[1], '맑힘부', 'ally', 0, 5, support, 'skill_cleric_purify', '아군1 독·맹독·침묵·귀봉·여우홀림 해제100%.', {stateEffects:['state_poison','state_deep_poison','state_silence',S['ghost-seal'],S['fox-charm']].map(remove)}),
  mk(taoist[2], '호신부', 'allAllies', 0, 8, support, 'skill_shrine_maiden_barrier', '아군전체 호신부100%: 물리·마법 방어 계산1.4배. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['protective-talisman'])]}),
  mk(taoist[3], '되살림', 'ally', 60, 12, healing, 'skill_cleric_revive', '쓰러진 아군1 HP60 회복·전투불능 해제100%(최대HP 상한).', {damageFormula:'60',stateEffects:[remove('state_death')]}),
  mk(taoist[4], '봄비', 'allAllies', 40, 16, healing, 'skill_cleric_mass_heal', '살아 있는 아군전체 각각 HP40 회복·독 해제100%(최대HP 상한).', {damageFormula:'40',stateEffects:[remove('state_poison')]}),
  mk(taoist[5], '하늘복', 'allAllies', 0, 18, support, 'skill_cleric_blessing', '아군전체 하늘복100%: 공격·방어1.2배, 자기 차례 최대HP5% 재생. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['heaven-blessing'])]}),
  mk(N['tusk-charge'], '엄니돌진', 'enemy', 20, 3, damage('attack'), 'skill_mon_tusk_charge', '예고 후 다음 자기 차례 상대1 물리 위력20·1타. 명중90%.', {elementId:physical,hitRate:90,chargeTurns:1}),
  mk(N['straw-club'], '짚방망이', 'enemy', 18, 3, damage('attack'), 'skill_mon_body_slam', '상대1 물리 위력18·1타. 명중95%.', {elementId:physical,hitRate:95}),
  mk(N['sorrow-cry'], '한의울음', 'allEnemies', 0, 5, support, 'skill_mon_banshee_wail', '예고 후 다음 자기 차례 상대전체 각각 귀봉50%. 기술 봉쇄, 2번째 자기 차례 시작 해제.', {chargeTurns:1,stateEffects:[add(S['ghost-seal'],50)]}),
  mk(N['bronze-smash'], '청동강타', 'allEnemies', 32, 0, damage('attack'), 'skill_mon_quake_stomp', '예고 후 다음 자기 차례 상대전체 물리 위력32·각1타. 명중95%.', {elementId:physical,hitRate:95,chargeTurns:1}),
  mk(N['poison-bite'], '독이빨', 'enemy', 12, 3, damage('attack'), 'skill_mon_venom_fang', '상대1 물리12·1타/명중95%. 명중 후 독45%: 차례당 최대HP6%, HP1하한.', {elementId:physical,hitRate:95,stateEffects:[add('state_poison',45)]}),
  mk(N['wing-flurry'], '날개쌍격', 'allEnemies', 14, 4, damage('attack'), 'skill_mon_gale_wing', '상대전체 물리14 계산의60%씩각2타. 타마다 명중95%.', {elementId:physical,hitRate:95,hitSequence:[0.6,0.6]}),
  mk(N['ghost-fire'], '혼불', 'allEnemies', 22, 5, damage('mind'), 'skill_mon_hex_fire', '상대전체 불 속성 정신력 위력22·각1타. 명중100%.', {elementId:E.fire}),
  mk(N['drowning-hand'], '물귀손', 'enemy', 26, 4, damage('mind'), 'skill_mon_bandage_bind', '상대1 영성 정신력 위력26·1타/명중100%. 명중 후 귀봉35%, 2번째 자기 차례 시작 해제.', {elementId:E.spirit,stateEffects:[add(S['ghost-seal'],35)]}),
  mk(N['grave-grasp'], '무덤저주', 'enemy', 0, 4, support, 'skill_mon_bone_curse', '상대1 여우홀림55%: 공격 계산0.75배. 조종 없음. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['fox-charm'],55)]}),
  mk(N['fox-charm'], '여우홀림', 'allEnemies', 0, 6, support, 'skill_mon_evil_eye', '상대전체 각각 여우홀림45%: 공격 계산0.75배. 조종 없음. 3번째 자기 차례 시작 해제.', {stateEffects:[add(S['fox-charm'],45)]}),
  mk(N['stone-crush'], '돌내리치기', 'enemy', 36, 5, damage('attack'), 'skill_mon_boulder_throw', '예고 후 다음 자기 차례 상대1 물리 위력36·1타. 명중90%.', {elementId:physical,hitRate:90,chargeTurns:1}),
  mk(N['bamboo-whip'], '대채찍', 'enemy', 20, 4, damage('attack'), 'skill_mon_vine_whip', '상대1 물리 위력20·1타. 명중95%.', {elementId:physical,hitRate:95}),
];
const skills = seeds.map(s => normalizeSkillRecord({ successRate: 100, variance: 0, hitRate: 100, criticalRate: 0, ...s,
  description:s.description+((s.stateEffects??[]).some(e=>e.operation==='add')?' (부여확률은 저항 적용)':''),
}));
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
const prototypePath = '/home/main/z-project/rpg-zzu-codex-joseon-dialogue-codex-jf-content/output/jf-workers/prototype-database.json';
const prototype = JSON.parse(readFileSync(prototypePath, 'utf8'));
const baseIds = ['state_poison','state_deep_poison','state_silence'];
const snapshotStates = baseIds.map(id => {
  const record = prototype.states.find((s: StateRecord) => s.id === id);
  if (!record) throw new Error(`Required snapshot state missing: ${id}`);
  return normalizeStateRecord(record);
});
const death = normalizeStateRecord({id:'state_death',name:'전투불능',removalCondition:'부활 기술로 해제',restriction:'행동 불가',recoverNaturallyFromTurn:1,recoverNaturallyChance:0,recoverWhenHitChance:0,
  runtimeEffects:{restrictsAction:true,blocksSkillUse:true,incapacitates:true,removeOnBattleEnd:false,hpDamagePercentPerTurn:0,hpHealPercentPerTurn:0},battleAura:'none'});
states.push(death,...snapshotStates);
const elements = normalizeElementRecords(Object.entries(ids.elements).map(([key, id]) => ({ id: id as string, name: ({ physical: '물리', fire: '불', ice: '얼음', lightning: '번개', spirit: '영성' } as Record<string, string>)[key], kind: key === 'physical' ? 'physical' : 'magical', rateLabels: ['A', 'B', 'C', 'D', 'E'], damageMultipliers: { A: 200, B: 150, C: 100, D: 50, E: 0 } })));
out('data.json', { skills, states, elements });
const choreographies = skills.map(skill => {
  const c = resolveSkillChoreography(skill);
  if (!c) throw new Error(`Missing choreography ${skill.id}: ${skill.retroChoreographyId}`);
  return { skillId: skill.id, retroChoreographyId: c.id, motion: c.motion, kind: c.kind, layers: c.skill.layers.map(layer => {
    const path = `public/assets/generated/pixel-fx/${layer.key}.png`;
    return { ...layer, path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
  }) };
});
out('choreography-sources.json', choreographies);
const slugs = skills.map(s => s.id.replace(/^skill_jf_(enemy_)?/, '').replaceAll('_', '-'));
out('art.json', skills.map((s, i) => ({ skillId: s.id, resourceId: `jf-icon-${slugs[i]}`, path: `assets/joseon-folklore/skills/${slugs[i]}.png`, sourcePath: `${root}/icons/${slugs[i]}.png`, size: [32, 32], usage: 'review-and-supervisor-resource-registration', runtimeSkillIconField: null })));
const levels=[1,3,5,8,12,16];
const speciesSkills:Record<string,string[]> = {
 'field-rat':[N['poison-bite']], 'wild-boar':[N['tusk-charge']], 'cave-bat':[N['wing-flurry']], 'straw-dokkaebi':[N['straw-club']],
 'lantern-wisp':[N['ghost-fire']], 'maiden-ghost':[N['sorrow-cry']], 'drowned-ghost':[N['drowning-hand']], 'grave-ghoul':[N['grave-grasp']],
 'fox-spirit':[N['fox-charm']], 'stone-dokkaebi':[N['stone-crush']], 'bamboo-specter':[N['bamboo-whip']], 'masked-bandit':[N['poison-bite'],N['straw-club']],
 'bronze-dokkaebi':[N['bronze-smash'],N['straw-club']], 'bride-wraith':[N['sorrow-cry'],N['drowning-hand']], 'mountain-tiger':[N['tusk-charge'],N['wing-flurry']],
};
const bosses=['bronze-dokkaebi','bride-wraith','mountain-tiger'];
out('design.json', {
  packId: ids.packId, phase: 'full', engine: 'rm2k3', skin: 'retro2003', resource: { field: 'mpCost', displayName: '기력', resource2: false },
  learnedSkills: Object.entries(ids.classSkills).map(([role, values]) => ({ classId: ids.classes[role], skills: (values as string[]).map((skillId, i) => ({ skillId, level:levels[i], acquisition:'해당 직업 레벨 도달', region:i<2?'마을·들판·폐사당':i<4?'산길·무덤·수몰지':'산신당·대숲·깊은사당' })) })),
  enemySkills: Object.entries(speciesSkills).map(([slug,skillIds])=>({enemyId:ids.enemies[slug],skillIds,boss:bosses.includes(slug),integration:'감독자/behavior 담당 연결용; 이 폴더는 적 행동 레코드를 수정하지 않음'})),
  bossTelegraphs: bosses.map((slug,i)=>({enemyId:ids.enemies[slug],skillId:[N['bronze-smash'],N['sorrow-cry'],N['tusk-charge']][i],chargeTurns:1,sampleStats:{maxHp:650,maxMp:30,attack:48,defense:24,mind:28,agility:30},counterplay:i===1?'발동 후 맑힘부로 귀봉 해제':'예고 중 방어 또는 HP 회복',note:'공유 기술이므로 일반 멧돼지·처녀귀신도 동일하게 1차례 예고함; 시전자별 다른 수치를 발명하지 않음'})),
  stateDefinitions: states.map(s=>({id:s.id,name:s.name,runtimeEffects:s.runtimeEffects,expiresAtOwnUpkeep:s.recoverNaturallyChance===100?s.recoverNaturallyFromTurn:null,sourceSkills:skills.filter(k=>k.stateEffects?.some(e=>e.stateId===s.id)).map(k=>k.id)})),
  effectSamples:skills.map(s=>({skillId:s.id,name:s.name,mp:s.mpCost.flat,power:s.power,scope:s.scope,effect:s.effect,hitSequence:s.hitSequence??[1],hitRate:s.hitRate,stateEffects:s.stateEffects??[],chargeTurns:s.chargeTurns??0,description:s.description})),
  baseStateDefaults:{policy:'missing-only; preserve every existing authored state record and order',helper:'merge-state-defaults.mts',snapshotSha256:createHash('sha256').update(readFileSync(prototypePath)).digest('hex'),snapshotPresence:Object.fromEntries(['state_death',...baseIds].map(id=>[id,prototype.states.some((s:StateRecord)=>s.id===id)])),addedDeathDefault:death.id,existingFallbackSources:baseIds},
  integrationNotes:[
   '전체 직업24·적12. 예약 상태6과 속성5 유지. 상태 총10 = 예약6 + 기본 전투불능/독/맹독/침묵4.',
   '도사 되살림은 레벨8 실제 healing + state_death remove, HP60 고정 회복. 죽은 아군 선택·MP12 소모·상태 해제를 실제 엔진으로 검사.',
   '기본 상태는 빈 대상에서 누락 시 추가할 정의이며, 기존 대상의 같은 ID 상태를 덮어쓰지 않는다.',
   '확률은 stateEffects.chance × 상태 저항. 표기 명중률은 회피 적용 전이며, 물리 회피는 명중률30%p 차감.',
   '귀봉은 기술 전체 봉쇄. 여우홀림은 공격0.75배이며 조종/혼란 없음. 방어 버프는 계산 배율이며 고정 피해감소율 아님.',
   '3번째 자기 차례 시작에 해제되는 재생은 해제 직전에도 tick 적용. HP 대가는 최대HP 비율이며 HP1 하한.',
   '소모품 ownskill_jf_item_*는 다른 담당 소유. 아이템 기술을 이 팩에 넣지 않는다.',
   '원본 연출의 mechanic을 복사하지 않으며 타수·위력은 신규 레코드 소유. skill iconResourceId/choreographySkillId는 존재하지 않아 쓰지 않는다.',
   'public 등록·실제 직업/적 통합·정본 저장/재로드·출하 플레이어 시각 QA는 감독자 소유. 스모크 저장은 로컬 fixture 파일만 사용.',
  ],
});
console.log('Saved full: skills=36 states=10 elements=5.');
