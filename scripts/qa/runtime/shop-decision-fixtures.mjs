// QA-only authored projects. Expected values live in the runner, not these builders.
import { readFile } from 'node:fs/promises';

export async function shopFixture(kind = 'economy', overrides = {}) {
  const project = JSON.parse(await readFile('test/fixtures/projects/item-runtime-qa-v3.json', 'utf8'));
  project.meta.title = `상점 구매 판단 QA · ${kind}`;
  project.session.gold = kind === 'economy' ? 100 : 200;
  project.session.inventory = {};
  let itemIds = ['equip_sword'];
  if (kind === 'economy') {
    project.database.equipment.find(e => e.id === 'equip_sword').price = 40;
  } else {
    const originals = structuredClone(project.database.actors);
    const ids = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    const curves = { maxHp: Array(99).fill(100), maxMp: Array(99).fill(30),
      attack: Array(99).fill(20), defense: Array(99).fill(10),
      mind: Array(99).fill(8), agility: Array(99).fill(6) };
    project.database.actors = ids.map((id, i) => ({
      ...structuredClone(originals[i % originals.length]), id,
      name: ['아린 · 검의 길', '보라 · 수호 기사', '다온 · 저주받은 검의 주인',
        '라온 · 북쪽 변경에서 온 방랑 검사', '마루 · 장비 고정', '서윤 · 여섯 번째 쌍검 검사'][i],
      classId: 'class_hero', initialLevel: i + 1,
      initialEquipment: { weapon: kind === 'twohand' ? 'oldhand' : i === 2 ? 'curse' : 'old',
        ...(kind === 'twohand' ? { shield: 'oldshield' } : {}) },
      parameterCurves: structuredClone(curves),
      options: { ...originals[0].options, fixedEquipment: i === 4, dualWield: i === 5 },
    }));
    // Explicit permissions, not permissive class defaults masking restricted goods.
    for (const c of project.database.classes) {
      c.options.fixedEquipment = false; c.options.dualWield = false;
      c.equipmentPermissions = { actorIds: [], classIds: [], equipmentIds: [] };
      c.parameterCurves = structuredClone(curves);
    }
    const base = project.database.equipment.find(e => e.id === 'equip_sword');
    const make = (id, name, statBonuses, extra = {}) => ({
      ...structuredClone(base), id, name, price: 40, slot: 'weapon',
      description: '구매 전에 동료와 교체 부위를 선택해 실제 능력치와 잃는 효과를 확인하세요.',
      equippableActorIds: ids, equippableClassIds: [], statBonuses,
      cursed: false, twoHanded: false, effectFlags: {}, accuracy: 100, criticalRate: 0,
      attackElementIds: [], elementalDefenseIds: [], stateDefenseIds: [], stateInflictIds: [], ...extra,
    });
    const oldEffects = { effectFlags: { doubleAttack: true }, elementalDefenseIds: ['fire'], accuracy: 90, criticalRate: 10 };
    const candidateEffects = { effectFlags: { attackAll: true }, accuracy: 80, criticalRate: 5,
      iconResourceId: 'cc0-jetrel-scout-dagger', imageResourceId: 'cc0-jetrel-scout-dagger' };
    project.database.equipment = [
      make('candidate', '가벼운 검 · 공격 보너스 +5', { attack: 5, defense: 0, mind: 0, agility: 0 }, candidateEffects),
      make('old', '숙련자의 검', { attack: 10, defense: 8, mind: 0, agility: 2 }, oldEffects),
      make('twohand', '양손 대검 · 방패까지 교체', { attack: 15, defense: 0, mind: 0, agility: 0 }, { ...candidateEffects, twoHanded: true }),
      make('restricted', '다른 직업 전용 의식검', { attack: 5, defense: 0, mind: 0, agility: 0 }, { equippableActorIds: [], equippableClassIds: ['class_mage'] }),
      make('charm', '별빛을 간직한 여행자의 부적', { attack: 0, defense: 0, mind: 3, agility: 0 },
        { slot: 'charm', iconResourceId: 'cc0-jetrel-focus-charm', imageResourceId: 'cc0-jetrel-focus-charm' }),
      make('curse', '해제할 수 없는 저주검', { attack: 10, defense: 8, mind: 0, agility: 2 }, { ...oldEffects, cursed: true }),
      make('oldhand', '기존 한손검', { attack: 10, defense: 0, mind: 0, agility: 0 }, { effectFlags: { doubleAttack: true }, accuracy: 90, criticalRate: 10 }),
      make('oldshield', '불꽃 방어 방패', { attack: 0, defense: 8, mind: 0, agility: 0 },
        { slot: 'shield', elementalDefenseIds: ['fire'], iconResourceId: 'cc0-jetrel-oak-shield', imageResourceId: 'cc0-jetrel-oak-shield' }),
    ];
    const potion = project.database.items.find(i => i.id === 'item_potion');
    project.database.items.push({ ...potion, id: 'potion', name: '회복약', price: 10, type: 'medicine' });
    project.database.elements.find(e => e.id === 'fire').name = '불꽃';
    project.database.equipmentSlots = [{ id: 'charm', label: '여행자의 특별한 별빛 부적 장착 부위' }];
    project.session.partyActorIds = ids;
    project.system.startActorIds = ids;
    project.session.inventory = { candidate: 1, old: 1, potion: 1 };
    itemIds = kind === 'twohand' ? ['twohand'] : ['candidate', 'old', 'twohand', 'restricted', 'charm', 'potion'];
    if (kind === 'non-equipment') itemIds = ['potion'];
    if (kind === 'empty') itemIds = [];
    if (kind === 'buyOnly') itemIds = ['candidate'];
    if (kind === 'sellOnly') project.session.inventory = {};
  }
  const command = { kind: 'shop', itemIds, allowSell: true, shopType: 'normal',
    quantityMode: 'select', merchantGold: 200, messageType: 'welcome', branchOnTransaction: false,
    transactionBranch: [], branchOnFailedTransaction: false, failedTransactionBranch: [],
    ...(kind === 'buyOnly' ? { shopType: 'buyOnly', quantityMode: 'single' } : {}),
    ...(kind === 'sellOnly' ? { shopType: 'sellOnly' } : {}), ...overrides };
  const map = project.maps[project.startMapId];
  const graphic = structuredClone(map.events[0].pages[0].graphic);
  map.events = [{ id: `qa_shop_${kind}`, x: 15, y: 18, trigger: { kind: 'action' }, commands: [], pages: [{
    id: 'qa_shop_page', name: 'QA', conditions: [], graphic, trigger: { kind: 'action' }, priority: 'same',
    movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [
      ...(kind === 'no-party' ? project.session.partyActorIds.map(actorId => ({ kind: 'changeParty', actorId, action: 'remove' })) : []),
      command,
    ],
  }] }];
  return { project, command };
}
