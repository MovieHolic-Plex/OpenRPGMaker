import { fail, pass, runOn } from '../matrixNativeSpec';
import type { Family } from './types';
import { FIELD_MAP, NPC_RESIDENT, NPC_SHOP, VILLAGE, giverDef, pickups, questFamily } from './group-6a-quest';

const kindsOf = (quest: any): string[] => (quest.steps ?? []).map((step: any) => step.kind);
const mayor = { name: '촌장' };
const resident = { eventId: NPC_RESIDENT };

const itemsOf = (list: any): Array<{ itemId: string; count: number }> =>
  [...(list ?? [])].map((entry: any) => ({ itemId: entry.itemId, count: entry.count })).sort((a, b) => a.itemId.localeCompare(b.itemId));

const questDeliver = questFamily({
  id: 'quest-deliver',
  title: '아이템을 대상 NPC에게 전달하는 배달 퀘스트',
  variants: [
    { key: 'potion-to-shop', prompt: '촌장이 회복약 2개를 잡화점 주인에게 전해 달라고 하는 배달 퀘스트를 만들어줘.', args: { giver: mayor, itemId: 'item_potion', count: 2, target: { eventId: NPC_SHOP } } },
    { key: 'key-to-resident', prompt: '「관리인」이 낡은 열쇠 1개를 이 마을 주민에게 건네 달라고 하는 퀘스트를 추가해 줘.', args: { giver: { name: '관리인' }, itemId: 'item_old_key', count: 1, target: resident }, setup: { event: NPC_RESIDENT } },
    { key: 'herb-new-npc-polite', prompt: '「약초꾼」에게 초록 약초 3개를 가져다주는 배달 퀘스트를 만들어 주세요. 약초꾼은 새로 만들어 주시고, 의뢰인은 「촌장」입니다.', args: { giver: mayor, itemId: 'item_herb_green', count: 3, target: { name: '약초꾼' } } },
    { key: 'terse', prompt: '빵 4개 배달 퀘스트. 의뢰인 「제빵사」, 받는 사람 「여관 주인」(새 NPC).', args: { giver: { name: '제빵사' }, itemId: 'item_bread', count: 4, target: { name: '여관 주인' } } },
    { key: 'shop-to-resident-explained', prompt: '잡화점 주인이 해독초 5개를 마을 주민에게 대신 전해 달라고 부탁하는 퀘스트가 필요해. 둘 다 기존 NPC를 써 줘.', args: { giver: { eventId: NPC_SHOP }, itemId: 'item_antidote', count: 5, target: resident } },
  ],
  build: args => ({
    key: 'ds_deliver', title: '배달', summary: '물건을 전해 준다.',
    giver: giverDef(args.giver as any),
    steps: [{ kind: 'deliver', itemId: args.itemId, count: args.count, lines: ['잘 받았소.'],
      target: (args.target as any).eventId ? { mapId: VILLAGE, eventId: (args.target as any).eventId } : { create: { mapId: VILLAGE, x: 14, y: 12, name: (args.target as any).name } } }],
  }),
  check(quest, args) {
    if (JSON.stringify(kindsOf(quest)) !== JSON.stringify(['deliver'])) return fail(`단계가 ${kindsOf(quest).join(',')} — deliver 하나여야 한다`);
    const step = quest.steps[0], want = args.target as any;
    if (step.itemId !== args.itemId) return fail(`배달 아이템 ${step.itemId} — ${args.itemId} 여야 한다`);
    if (step.count !== args.count) return fail(`배달 수량 ${step.count} — ${args.count} 여야 한다`);
    const ok = want.eventId ? step.target?.eventId === want.eventId : String(step.target?.create?.name ?? '').includes(want.name);
    if (!ok) return fail(`받는 사람이 ${JSON.stringify(step.target?.create?.name ?? step.target?.eventId)} — ${want.eventId ?? want.name} 여야 한다`);
    return pass(`${step.itemId} ×${step.count} 전달`);
  },
  mutations: args => [
    def => { def.steps[0].count = (args.count as number) + 1; },
    def => { def.steps[0].itemId = args.itemId === 'item_ether' ? 'item_potion' : 'item_ether'; },
    def => { def.steps[0].target = (args.target as any).eventId === NPC_SHOP ? { mapId: VILLAGE, eventId: NPC_RESIDENT } : { mapId: VILLAGE, eventId: NPC_SHOP }; },
    def => { def.steps[0] = { kind: 'collect', itemId: args.itemId, count: args.count, sources: pickups(args.count as number) }; },
  ],
});

const choiceArgs = (giver: any, target: any, prompt: string, options: string[]) => ({ giver, target, prompt, options });
const questChoice = questFamily({
  id: 'quest-choice',
  title: '선택지를 고르면 진행되는 선택 퀘스트',
  variants: [
    { key: 'bridge', prompt: '촌장이 「다리를 고칠까요, 부술까요?」라고 묻고 「고친다」, 「부순다」 중 고르게 하는 선택 퀘스트를 만들어줘.', args: choiceArgs(mayor, { name: '촌장' }, '다리를 고칠까요, 부술까요?', ['고친다', '부순다']) },
    { key: 'thief', prompt: '이 마을 주민이 의뢰하고, 「포졸」을 찾아가면 「도둑을 신고할까요?」라고 묻고 「신고한다」, 「눈감아 준다」 두 선택지를 주는 퀘스트를 추가해 줘. 포졸은 새로 만들어 줘.', args: choiceArgs(resident, { name: '포졸' }, '도둑을 신고할까요?', ['신고한다', '눈감아 준다']), setup: { event: NPC_RESIDENT } },
    { key: 'three-polite', prompt: '「심판관」이 「누구의 편을 들겠습니까?」라고 묻고 「왕」, 「백성」, 「중립」 세 가지 중에서 고르게 하는 퀘스트를 만들어 주세요.', args: choiceArgs({ name: '심판관' }, { name: '심판관' }, '누구의 편을 들겠습니까?', ['왕', '백성', '중립']) },
    { key: 'terse', prompt: '잡화점 주인 의뢰, 새 NPC 「단골」에게 가면 선택 퀘스트: 「거래할래?」 → 「한다」/「안 한다」.', args: choiceArgs({ eventId: NPC_SHOP }, { name: '단골' }, '거래할래?', ['한다', '안 한다']) },
    { key: 'dragon', prompt: '「노인」이 「용을 깨울까요?」라고 묻고 「깨운다」, 「그냥 둔다」 중 선택하게 해 줘. 노인은 새로 만들어 줘.', args: choiceArgs({ name: '노인' }, { name: '노인' }, '용을 깨울까요?', ['깨운다', '그냥 둔다']) },
  ],
  build: args => ({
    key: 'ds_choice', title: '선택', summary: '선택지를 고른다.', giver: giverDef(args.giver as any),
    steps: [{ kind: 'choice', prompt: args.prompt, options: (args.options as string[]).map(text => ({ text, lines: [`${text}…`] })),
      target: (args.target as any).eventId ? { mapId: VILLAGE, eventId: (args.target as any).eventId } : { create: { mapId: VILLAGE, x: 14, y: 12, name: (args.target as any).name } } }],
  }),
  check(quest, args) {
    if (JSON.stringify(kindsOf(quest)) !== JSON.stringify(['choice'])) return fail(`단계가 ${kindsOf(quest).join(',')} — choice 하나여야 한다`);
    const step = quest.steps[0];
    const wantTarget = args.target as { eventId?: string; name?: string };
    const targetMatches = wantTarget.eventId ? step.target?.eventId === wantTarget.eventId : String(step.target?.create?.name ?? '').includes(wantTarget.name ?? '');
    if (!targetMatches) return fail(`선택을 묻는 인물이 ${JSON.stringify(step.target?.create?.name ?? step.target?.eventId)} — ${wantTarget.eventId ?? wantTarget.name} 여야 한다`);
    if (!String(step.prompt ?? '').includes(args.prompt as string)) return fail(`질문이 「${step.prompt}」 — 「${args.prompt}」 여야 한다`);
    const texts = (step.options ?? []).map((option: any) => String(option.text));
    const want = args.options as string[];
    if (JSON.stringify([...texts].sort()) !== JSON.stringify([...want].sort())) return fail(`선택지 ${JSON.stringify(texts)} — ${JSON.stringify(want)} 여야 한다`);
    return pass(`선택지 ${want.length}개`);
  },
  mutations: args => [
    def => { def.steps[0].options.pop(); },
    def => { def.steps[0].options.push({ text: '모르겠다', lines: ['…'] }); },
    def => { def.steps[0].options[0].text = '다른 선택'; },
    def => { def.steps[0].prompt = '엉뚱한 질문입니까?'; },
  ],
});

const rewardArgs = (giver: any, gold: number | undefined, rewardItems: Array<{ itemId: string; count: number }> | undefined) => ({ giver, gold, rewardItems });
const questReward = questFamily({
  id: 'quest-reward',
  title: '완료 보상(골드·아이템) 지정',
  variants: [
    { key: 'gold300', prompt: '촌장이 약초 3개를 모아 오면 보상으로 300골드를 주는 퀘스트를 만들어줘.', args: { ...rewardArgs(mayor, 300, undefined), itemId: 'item_herb_green', count: 3 } },
    { key: 'items', prompt: '「경비대장」이 슬라임 정찰대를 처치하면 회복약 2개와 해독초 1개를 보상으로 주는 퀘스트를 추가해 줘.', args: { ...rewardArgs({ name: '경비대장' }, undefined, [{ itemId: 'item_potion', count: 2 }, { itemId: 'item_antidote', count: 1 }]), troopId: 'troop_slime' } },
    { key: 'both-polite', prompt: '이 마을 주민이 광장 (3,3)까지 다녀오면 150골드와 엘릭서 1개를 보상으로 주는 도착 퀘스트를 만들어 주세요.', args: { ...rewardArgs(resident, 150, [{ itemId: 'item_elixir', count: 1 }]), reach: { mapId: 'map_plaza', x: 3, y: 3 } }, setup: { event: NPC_RESIDENT } },
    { key: 'terse', prompt: '꿀 2개 수집 퀘스트, 의뢰인 「양봉가」, 보상 80골드.', args: { ...rewardArgs({ name: '양봉가' }, 80, undefined), itemId: 'item_honey', count: 2 } },
    { key: 'item-only', prompt: '잡화점 주인이 박쥐 떼를 쫓아 주면 상급 회복약 3개만 보상으로 주는 퀘스트가 필요해. 골드는 주지 마.', args: { ...rewardArgs({ eventId: NPC_SHOP }, undefined, [{ itemId: 'item_hi_potion', count: 3 }]), troopId: 'troop_bat_swarm', noGold: true } },
  ],
  build: args => ({
    key: 'ds_reward', title: '보상 퀘스트', summary: '일을 마치면 보상을 받는다.', giver: giverDef(args.giver as any),
    steps: [args.troopId ? { kind: 'kill', troopId: args.troopId, at: { mapId: VILLAGE, x: 15, y: 6 } }
      : args.reach ? { kind: 'reach', ...(args.reach as any) }
      : { kind: 'collect', itemId: args.itemId, count: args.count, sources: pickups(args.count as number) }],
    rewards: { ...(args.gold !== undefined ? { gold: args.gold } : {}), ...(args.rewardItems ? { items: args.rewardItems } : {}) },
  }),
  check(quest, args) {
    if (args.gold === undefined && (quest.rewards?.gold ?? 0) !== 0) return fail('골드 보상을 요청하지 않았는데 보상 골드가 있다');
    if (args.gold === undefined && !args.rewardItems) return fail('보상이 정의되지 않은 가족 인자');
    if (args.gold !== undefined && quest.rewards?.gold !== args.gold) return fail(`보상 골드 ${quest.rewards?.gold} — ${args.gold} 여야 한다`);
    if (args.rewardItems && JSON.stringify(itemsOf(quest.rewards?.items)) !== JSON.stringify(itemsOf(args.rewardItems))) return fail(`보상 아이템 ${JSON.stringify(itemsOf(quest.rewards?.items))} 가 다르다`);
    if (!args.rewardItems && (quest.rewards?.items ?? []).length) return fail('요청하지 않은 보상 아이템이 있다');
    const step = quest.steps?.[0];
    if (args.troopId && !(quest.steps.length === 1 && step.kind === 'kill' && step.troopId === args.troopId)) return fail(`처치 단계(${args.troopId})가 아니다`);
    if (args.itemId && !(quest.steps.length === 1 && step.kind === 'collect' && step.itemId === args.itemId && step.count === args.count)) return fail(`수집 단계(${args.itemId}×${args.count})가 아니다`);
    if (args.reach && !(quest.steps.length === 1 && step.kind === 'reach' && step.mapId === (args.reach as any).mapId && step.x === (args.reach as any).x && step.y === (args.reach as any).y)) return fail('도착 단계가 요청과 다르다');
    return pass('보상·목표 일치');
  },
  mutations: args => [
    def => { def.rewards = {}; },
    def => { if (def.rewards.gold !== undefined) def.rewards.gold += 100; else def.rewards.gold = 100; },
    def => { if (def.rewards.items) def.rewards.items[0].count += 1; else def.rewards.items = [{ itemId: 'item_potion', count: 1 }]; },
    def => { delete def.rewards.items; if (def.rewards.gold === undefined) def.rewards.gold = 10; },
  ],
});

const questPrereq = questFamily({
  id: 'quest-prereq',
  title: '선행 퀘스트를 끝내야 열리는 후속 퀘스트',
  variants: [
    { key: 'herb-then-mayor', prompt: '이미 「약초 심부름」(ds_herb_prelude) 퀘스트가 있어. 그걸 완료해야 받을 수 있는 후속 퀘스트를 만들어줘 — 촌장이 슬라임 정찰대를 처치해 달라고 하는 내용.', args: { giver: mayor, requires: ['ds_herb_prelude'], troopId: 'troop_slime' } },
    { key: 'resident-reach', prompt: '「ds_herb_prelude」를 끝낸 사람에게만 이 마을 주민이 광장 (3,3)으로 다녀오라는 퀘스트를 줘.', args: { giver: resident, requires: ['ds_herb_prelude'], reach: { mapId: 'map_plaza', x: 3, y: 3 } }, setup: { event: NPC_RESIDENT } },
    { key: 'two-prereqs', prompt: '선행으로 ds_herb_prelude 와 ds_scout_prelude 둘 다 완료해야 열리는 퀘스트: 「대장」이 동굴 박쥐 떼를 잡아 오라고 해.', args: { giver: { name: '대장' }, requires: ['ds_herb_prelude', 'ds_scout_prelude'], troopId: 'troop_bat_swarm' } },
    { key: 'terse', prompt: '선행 ds_scout_prelude. 후속: 잡화점 주인 → 꿀 2개 모아오기.', args: { giver: { eventId: NPC_SHOP }, requires: ['ds_scout_prelude'], itemId: 'item_honey', count: 2 } },
    { key: 'polite', prompt: 'ds_herb_prelude 퀘스트를 마친 뒤에만 시작되는 퀘스트를 만들어 주세요. 「장로」가 숲길 (12,8)에 다녀오라고 합니다.', args: { giver: { name: '장로' }, requires: ['ds_herb_prelude'], reach: { mapId: FIELD_MAP, x: 12, y: 8 } } },
  ],
  prepare(project) {
    const withHerb = runPrelude(project, 'ds_herb_prelude', 4, 3);
    return runPrelude(withHerb, 'ds_scout_prelude', 4, 5);
  },
  build: args => ({
    key: 'ds_prereq', title: '후속 의뢰', summary: '선행 의뢰를 마친 뒤에 받는다.', giver: giverDef(args.giver as any),
    requiresQuestKeys: args.requires,
    steps: [args.troopId ? { kind: 'kill', troopId: args.troopId, at: { mapId: VILLAGE, x: 15, y: 6 } }
      : args.reach ? { kind: 'reach', ...(args.reach as any) }
      : { kind: 'collect', itemId: args.itemId, count: args.count, sources: pickups(args.count as number, VILLAGE, 4, 9) }],
  }),
  check(quest, args) {
    const need = [...(args.requires as string[])].sort();
    const got = [...(quest.requiresQuestKeys ?? [])].sort();
    if (JSON.stringify(got) !== JSON.stringify(need)) return fail(`선행 퀘스트 ${JSON.stringify(got)} — ${JSON.stringify(need)} 여야 한다`);
    const step = quest.steps?.[0];
    if (quest.steps?.length !== 1) return fail(`단계가 ${quest.steps?.length}개 — 하나여야 한다`);
    if (args.troopId && !(step.kind === 'kill' && step.troopId === args.troopId)) return fail(`처치 단계(${args.troopId})가 아니다`);
    if (args.itemId && !(step.kind === 'collect' && step.itemId === args.itemId && step.count === args.count)) return fail(`수집 단계(${args.itemId}×${args.count})가 아니다`);
    if (args.reach && !(step.kind === 'reach' && step.mapId === (args.reach as any).mapId && step.x === (args.reach as any).x && step.y === (args.reach as any).y)) return fail('도착 단계가 요청과 다르다');
    return pass(`선행 ${got.join(',')}`);
  },
  mutations: args => [
    def => { delete def.requiresQuestKeys; },
    def => { def.requiresQuestKeys = (args.requires as string[]).length > 1 ? [(args.requires as string[])[0]] : ['ds_scout_prelude', 'ds_herb_prelude']; if ((args.requires as string[]).length === 1 && (args.requires as string[])[0] === 'ds_scout_prelude') def.requiresQuestKeys = ['ds_herb_prelude']; },
    def => { def.steps[0] = { kind: 'talk', target: { create: { mapId: VILLAGE, x: 14, y: 12, name: '아무개' } }, lines: ['…'] }; },
  ],
});

function runPrelude(project: any, key: string, x: number, y: number): any {
  return runOn(project, 'create_quest', { def: {
    key, title: `${key} 선행`, summary: '선행 의뢰', giver: { create: { mapId: VILLAGE, x: x + 6, y: y + 8, name: `${key} 의뢰인` } },
    steps: [{ kind: 'reach', mapId: 'map_plaza', x: 4, y: 4 }],
  } });
}

const repeatArgs = (giver: any, base: Record<string, unknown>) => ({ giver, ...base });
const questRepeatable = questFamily({
  id: 'quest-repeatable',
  title: '완료 후 다시 받을 수 있는 반복 퀘스트',
  variants: [
    { key: 'herb', prompt: '촌장이 약초 3개를 모아 오는 퀘스트인데, 끝낸 뒤에도 계속 다시 받을 수 있는 반복 퀘스트로 만들어줘.', args: repeatArgs(mayor, { itemId: 'item_herb_green', count: 3 }) },
    { key: 'slime-hunt', prompt: '「사냥꾼」이 슬라임 정찰대를 처치해 달라고 하는데, 매번 다시 의뢰할 수 있게 반복 가능한 퀘스트로 해 줘.', args: repeatArgs({ name: '사냥꾼' }, { troopId: 'troop_slime' }) },
    { key: 'shop-polite', prompt: '잡화점 주인이 꿀 4개를 모아 달라는 반복 의뢰를 만들어 주세요. 몇 번이든 다시 받을 수 있어야 해요.', args: repeatArgs({ eventId: NPC_SHOP }, { itemId: 'item_honey', count: 4 }) },
    { key: 'terse', prompt: '반복 퀘스트: 「배달부」, 광장 (3,3) 다녀오기.', args: repeatArgs({ name: '배달부' }, { reach: { mapId: 'map_plaza', x: 3, y: 3 } }) },
    { key: 'resident', prompt: '이 마을 주민이 빵 5개를 부탁하는 퀘스트를 만들어 줘. 한 번 끝내도 또 받을 수 있게(반복).', args: repeatArgs(resident, { itemId: 'item_bread', count: 5 }), setup: { event: NPC_RESIDENT } },
  ],
  build: args => ({
    key: 'ds_repeat', title: '반복 의뢰', summary: '몇 번이든 다시 받을 수 있다.', giver: giverDef(args.giver as any), repeatable: true,
    steps: [args.troopId ? { kind: 'kill', troopId: args.troopId, at: { mapId: VILLAGE, x: 15, y: 6 } }
      : args.reach ? { kind: 'reach', ...(args.reach as any) }
      : { kind: 'collect', itemId: args.itemId, count: args.count, sources: pickups(args.count as number) }],
  }),
  check(quest, args) {
    if (quest.repeatable !== true) return fail('repeatable 이 켜지지 않았다');
    const step = quest.steps?.[0];
    if (quest.steps?.length !== 1) return fail(`단계가 ${quest.steps?.length}개 — 하나여야 한다`);
    if (args.troopId && !(step.kind === 'kill' && step.troopId === args.troopId)) return fail(`처치 단계(${args.troopId})가 아니다`);
    if (args.itemId && !(step.kind === 'collect' && step.itemId === args.itemId && step.count === args.count)) return fail(`수집 단계(${args.itemId}×${args.count})가 아니다`);
    if (args.reach && !(step.kind === 'reach' && step.mapId === (args.reach as any).mapId && step.x === (args.reach as any).x && step.y === (args.reach as any).y)) return fail('도착 단계가 요청과 다르다');
    return pass('반복 가능 퀘스트');
  },
  mutations: args => [
    def => { delete def.repeatable; },
    def => { def.repeatable = false; },
    def => { if (def.steps[0].kind === 'collect') { def.steps[0].count += 1; def.steps[0].sources = pickups(def.steps[0].count); } else if (def.steps[0].kind === 'kill') def.steps[0].troopId = def.steps[0].troopId === 'troop_slime' ? 'troop_dragon' : 'troop_slime'; else def.steps[0].x += 2; },
  ],
});

export const QUEST_FAMILIES_2: readonly Family[] = [questDeliver, questChoice, questReward, questPrereq, questRepeatable];
