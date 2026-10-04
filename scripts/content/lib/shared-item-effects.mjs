// Authored roles use only existing ItemRecord effects. IDs/names/art remain stable.
// Shipped actor HP grows 514 -> 5,140. Flat heals cover roughly 20–50% at their stage.
const tierHP = [100, 180, 280, 420, 650, 950, 1400, 2100];
const tierMP = [10, 16, 24, 36, 52, 74, 100, 140];
const tierPercent = [8, 12, 16, 20, 25, 32, 40, 50];
const add = stateId => ({ stateId, chance: 100, operation: 'add' });
const remove = stateId => ({ stateId, chance: 100, operation: 'remove' });
const recovery = (flat = 0, percentMax = 0) => ({ flat, percentMax });
const classes = { hero: 'class_hero', guard: 'class_guardian', mage: 'class_mage', scout: 'class_scout', samurai: 'class_samurai', priest_monk: 'class_priest_monk' };
const label = { attack: '공격', defense: '방어', mind: '정신', agility: '민첩' };

function describeMedicine(record, identity) {
  const target = record.scope === 'allAllies' ? '생존 중인 아군 전체' : record.onlyEffectiveOnDeadActors ? '전투 불능인 아군 하나' : '아군 하나';
  const effects = [];
  for (const [key, name] of [['hpRecovery', 'HP'], ['mpRecovery', 'MP']]) {
    const r = record[key];
    if (r?.flat || r?.percentMax) effects.push(`${name} ${r.percentMax ? `최대치의 ${r.percentMax}%` : ''}${r.percentMax && r.flat ? ' + ' : ''}${r.flat ? r.flat : ''} 회복`);
  }
  const stateNames = { state_poison: '독', state_deep_poison: '맹독', state_sleep: '수면', state_paralysis: '마비', state_silence: '침묵', state_blind: '암흑', state_stop: '스톱', state_petrify: '석화', state_attack_up: '공격 상승', state_defense_up: '방어 상승', state_agility_up: '민첩 상승', state_regen: '재생', state_attack_down: '공격 하락', state_defense_down: '방어 하락', state_agility_down: '민첩 하락', state_protect: '물리 방어막', state_shell: '마법 방어막', state_counter: '반격', state_cover: '감싸기', state_evade: '회피' };
  for (const effect of record.stateEffects ?? []) effects.push(`${stateNames[effect.stateId] ?? effect.stateId} ${effect.operation === 'remove' ? '해제' : '부여'}`);
  record.description = `${identity} ${record.name}을 사용하면 ${target}에게 ${effects.join(', ')} 효과를 줍니다.${record.occasion === 'field' ? ' 필드 전용입니다.' : record.occasion === 'battle' ? ' 전투 전용입니다.' : ''}${record.onlyEffectiveOnDeadActors ? ' 살아 있는 대상에게는 사용할 수 없습니다.' : ''}`;
}

export function authorSharedItemEffects(records) {
  for (const record of records) {
    const match = /^item_shared_([^_]+)_(.+)$/.exec(record.id);
    if (!match) continue;
    const [, group, slug] = match;
    const grade = /-(\d+)$/.exec(slug);
    const g = grade ? Number(grade[1]) - 1 : 0;
    const family = grade ? slug.slice(0, -grade[0].length) : slug;
    const hp = tierHP[g] ?? 35, mp = tierMP[g] ?? 8, percent = tierPercent[g] ?? 10;
    const medicine = (identity, changes) => {
      Object.assign(record, { type: 'medicine', scope: 'ally', occasion: 'always', consumable: true,
        hpRecovery: recovery(), mpRecovery: recovery(), healStateIds: [], stateEffects: [], onlyEffectiveOnDeadActors: false }, changes);
      describeMedicine(record, identity);
    };
    if (group === 'healing') {
      const profiles = {
        mugwort: ['무첨가 쑥 응급약입니다.', { hpRecovery: recovery(Math.round(hp * 1.15)) }],
        rose: ['체력이 높은 동료에게 맞춘 장미 약입니다.', { hpRecovery: recovery(5 + g * 3, percent) }],
        ginseng: ['전투용 인삼 강장 회복액입니다.', { occasion: 'battle', hpRecovery: recovery(Math.round(hp * .55)), stateEffects: [add('state_attack_up')] }],
        aloe: ['해독을 겸하는 알로에 약입니다.', { hpRecovery: recovery(Math.round(hp * .7)), stateEffects: [remove('state_poison')] }],
        hibiscus: ['파티용 히비스커스 회복액입니다.', { scope: 'allAllies', hpRecovery: recovery(Math.round(hp * .45)) }],
        camomile: ['수면을 깨우는 카모마일 약입니다.', { hpRecovery: recovery(Math.round(hp * .7)), stateEffects: [remove('state_sleep')] }],
        lotus: ['몸과 마력을 함께 보충하는 연꽃 약입니다.', { hpRecovery: recovery(Math.round(hp * .6)), mpRecovery: recovery(Math.round(mp * .7)) }],
        juniper: ['시야를 되찾는 향나무 약입니다.', { hpRecovery: recovery(Math.round(hp * .65)), stateEffects: [remove('state_blind')] }],
      };
      medicine(...profiles[family]);
    } else if (group === 'mana') {
      const profiles = {
        moon: ['큰 마력통에 맞춘 월석 마력액입니다.', { mpRecovery: recovery(2 + g, percent) }],
        azure: ['고정량을 보충하는 청금석 마력액입니다.', { mpRecovery: recovery(mp) }],
        violet: ['침묵을 씻는 자수정 마력액입니다.', { mpRecovery: recovery(Math.round(mp * .65)), stateEffects: [remove('state_silence')] }],
        dew: ['파티용 별이슬 마력액입니다.', { scope: 'allAllies', mpRecovery: recovery(Math.max(3, Math.round(mp * .4))) }],
        cobalt: ['마법 방어를 겸하는 코발트 마력액입니다.', { occasion: 'battle', mpRecovery: recovery(Math.round(mp * .55)), stateEffects: [add('state_shell')] }],
        lavender: ['전투 전에 마력을 비축하는 라벤더 차입니다.', { occasion: 'field', mpRecovery: recovery(Math.round(mp * 1.25)) }],
      };
      medicine(...profiles[family]);
    } else if (group === 'elixir') {
      const profiles = {
        dawn: ['균형형 새벽 영약입니다.', { hpRecovery: recovery(hp), mpRecovery: recovery(mp) }],
        forest: ['파티용 숲숨 영약입니다.', { scope: 'allAllies', hpRecovery: recovery(Math.round(hp * .4)), mpRecovery: recovery(Math.round(mp * .4)) }],
        twilight: ['재생을 겸하는 황혼 영약입니다.', { occasion: 'battle', hpRecovery: recovery(Math.round(hp * .5)), mpRecovery: recovery(Math.round(mp * .5)), stateEffects: [add('state_regen')] }],
        starlight: ['최대 체력과 마력에 비례하는 별빛 영약입니다.', { hpRecovery: recovery(0, percent), mpRecovery: recovery(0, percent) }],
      };
      medicine(...profiles[family]);
    } else if (group === 'remedy') {
      const state = { poison: 'state_poison', sleep: 'state_sleep', paralysis: 'state_paralysis', venom: 'state_deep_poison', silence: 'state_silence', blind: 'state_blind', stop: 'state_stop', petrify: 'state_petrify' }[family];
      const related = { poison: 'state_deep_poison', sleep: 'state_stop', paralysis: 'state_agility_down', venom: 'state_poison', silence: 'state_blind', blind: 'state_silence', stop: 'state_sleep', petrify: 'state_defense_down' }[family];
      medicine('등급별 응급 치료제입니다.', { scope: g === 3 ? 'allAllies' : 'ally',
        hpRecovery: recovery(g === 1 ? 35 : g === 3 ? 25 : 0), mpRecovery: recovery(g === 2 ? 8 : 0),
        stateEffects: [remove(state), ...(g >= 2 ? [remove(related)] : [])] });
    } else if (group === 'tonic') {
      const state = { valor: 'state_attack_up', bastion: 'state_defense_up', haste: 'state_agility_up', renewal: 'state_regen' }[family];
      const opposed = { valor: 'state_attack_down', bastion: 'state_defense_down', haste: 'state_agility_down', renewal: 'state_deep_poison' }[family];
      const barrier = { valor: 'state_protect', bastion: 'state_shell', haste: 'state_shell', renewal: 'state_protect' }[family];
      const reaction = { valor: 'state_counter', bastion: 'state_cover', haste: 'state_evade', renewal: 'state_shell' }[family];
      medicine('회복·방어막·반응 상태를 구분한 전투 강장제입니다.', { occasion: 'battle',
        scope: g === 3 || g === 7 ? 'allAllies' : 'ally',
        hpRecovery: recovery(g === 1 ? 35 : g === 7 ? 50 : 0), mpRecovery: recovery(g === 2 ? 10 : 0),
        stateEffects: [add(state), ...(g === 4 ? [remove(opposed)] : g === 5 ? [add(barrier)] : g === 6 ? [add(reaction)] : [])] });
    } else if (group === 'revival') {
      const pct = [10, 25, 45, 70][g];
      medicine('쓰러진 동료를 일으키는 소생 깃털입니다.', { occasion: 'field', onlyEffectiveOnDeadActors: true,
        hpRecovery: recovery(family === 'phoenix' ? 10 + g * 15 : 0, pct),
        mpRecovery: recovery(family === 'dove' ? 5 + g * 8 : 0),
        stateEffects: family === 'crane' ? [remove('state_poison'), remove('state_deep_poison')] : family === 'sunbird' ? [remove('state_paralysis'), remove('state_silence')] : [] });
    } else if (group === 'food') {
      const index = records.filter(r => r.id.startsWith('item_shared_food_') && /-1$/.test(r.id)).findIndex(r => r.id.endsWith(`${family}-1`));
      const mpFocus = ['tea', 'jam', 'cookie', 'cake'].includes(family);
      const party = ['stew', 'soup', 'porridge'].includes(family) && g >= 2;
      medicine('여행 중 나눠 먹는 음식입니다.', { occasion: 'field', scope: party ? 'allAllies' : 'ally',
        hpRecovery: recovery(Math.round((20 + index * 2 + g * 35) * (party ? .5 : mpFocus ? .4 : 1))),
        mpRecovery: recovery(mpFocus ? 5 + g * 9 + index % 4 : index % 3 + g * 2),
        stateEffects: family === 'tea' ? [remove('state_silence')] : family === 'salad' ? [remove('state_poison')] : [] });
    } else if (group === 'growth') {
      const amount = [1, 2, 3, 4, 5, 6, 8, 10][g];
      const key = { valor: 'attack', insight: 'mind', attack: 'attack', defense: 'defense', mind: 'mind', agility: 'agility' }[family];
      const bonuses = { [key]: amount };
      if (family === 'valor') bonuses.defense = Math.max(1, Math.ceil(amount / 2));
      if (family === 'insight') bonuses.agility = Math.max(1, Math.ceil(amount / 2));
      record.seedParameterBonuses = bonuses;
      record.description = `선택한 아군의 ${Object.entries(bonuses).map(([k, value]) => `${label[k]} ${value}`).join(', ')}을 영구적으로 올립니다. 필드에서 소모하는 희귀 성장품입니다.`;
    } else if (group === 'manual') {
      const owner = Object.keys(classes).find(key => slug.startsWith(key + '_'));
      record.usableClassIds = [classes[owner]];
      record.description += ' 해당 기술의 원래 직업만 사용할 수 있습니다.';
    } else if (group === 'battle') {
      const roles = ['저위력 단일 공격', '65% 확률의 상태 약화', '중위력 단일 공격', '저위력 적 전체 공격', '상태 부여를 겸한 단일 공격', '고위력 단일 공격', '적 전체 공격', '고위력 상태 복합 공격'];
      record.scope = 'none'; // Skill scope owns single vs all-enemy targeting.
      record.activateSkillId = `skill_shared_item_${family}_${g + 1}`;
      record.consumptionLimit = g === 4 || g === 6 ? 2 : 1;
      record.description = `${roles[g]}을 발동하는 ${record.name}입니다. ${record.consumptionLimit === 2 ? '한 물건으로 2회 사용한 뒤 소모됩니다.' : '한 번 사용하면 소모됩니다.'}`;
    } else if (group === 'capture') {
      const base = { field: 1, river: 1.12, peak: 1.28, forest: 1.2 }[family];
      const multiplier = Math.round((base + g * .2) * 100) / 100;
      const ballClass = multiplier >= 2 ? 'ultra' : multiplier >= 1.4 ? 'great' : 'poke';
      record.captureProfile = { multiplier, ballClass };
      record.description = `${record.name}은 약해진 몬스터의 기본 포획률에 ${multiplier}배 보정을 적용합니다. Gen1 규칙에서는 ${ballClass === 'ultra' ? '울트라' : ballClass === 'great' ? '슈퍼' : '기본'} 등급 포획구로 처리합니다. 성공·실패와 관계없이 소모됩니다.`;
    } else if (group === 'feed') {
      const nutrition = { oat: [4, 60], fish: [6, 48], beef: [3, 80], berry: [12, 20], milk: [8, 40], nut: [5, 56], herb: [14, 12], honey: [10, 28] }[family];
      const friendshipDelta = nutrition[0] + g * 6, expDelta = nutrition[1] * (g + 1);
      record.careProfile = { kind: 'feed', friendshipDelta, expDelta };
      record.description = `파티 몬스터의 친밀도를 ${friendshipDelta}, 경험치를 ${expDelta} 올립니다. 친밀도 중심 사료와 성장 중심 사료의 배합이 다릅니다. 먹이면 소모됩니다.`;
    } else if (group === 'toy') {
      const index = ['ball', 'rope', 'bell', 'disc', 'mouse', 'rattle', 'bone', 'feather'].indexOf(family);
      const friendshipDelta = 6 + index * 2 + g * 5;
      record.careProfile = { kind: 'toy', friendshipDelta };
      record.description = `파티 몬스터와 놀아 친밀도를 ${friendshipDelta} 올립니다. 경험치는 주지 않습니다. 놀이 후 소모됩니다.`;
    } else if (group === 'produce') {
      const index = records.filter(r => r.id.startsWith('item_shared_produce_') && /-1$/.test(r.id)).findIndex(r => r.id.endsWith(`${family}-1`));
      medicine('먹거나 판매할 수 있는 수확물입니다.', { occasion: 'field',
        hpRecovery: recovery(10 + index * 2 + g * 20), mpRecovery: recovery(index % 4 + g * 2) });
    }
  }
}
