import { fail, pass } from '../matrixNativeSpec';
import type { Family } from './types';
import { QUEST_FAMILIES_2 } from './group-6a-quest2';
import { SYSTEM_FAMILIES } from './group-6a-system';
import { TOWN_FAMILIES } from './group-6a-town';
import { BOSS_FAMILIES } from './group-6a-boss';
import { FIELD_MAP, NPC_RESIDENT, NPC_SHOP, PLAZA_MAP, VILLAGE, giverDef, pickups, questFamily } from './group-6a-quest';

const kindsOf = (quest: any): string[] => (quest.steps ?? []).map((step: any) => step.kind);
const sameKinds = (quest: any, want: string[]) => JSON.stringify(kindsOf(quest)) === JSON.stringify(want);
const includesName = (ref: any, name: string) => Boolean(ref?.create && String(ref.create.name ?? '').includes(name));
const targetOk = (target: any, spec: { eventId?: string; name?: string }) =>
  spec.eventId ? target?.eventId === spec.eventId : includesName(target, spec.name ?? '');
const mayor = { name: '촌장' };
const resident = { eventId: NPC_RESIDENT };

const questFetch = questFamily({
  id: 'quest-fetch',
  title: '의뢰인이 아이템 N개를 모아 오라는 수집 퀘스트',
  variants: [
    { key: 'mayor-herb3', prompt: '촌장이 초록 약초 3개를 모아 오라고 부탁하는 퀘스트를 만들어줘.', args: { giver: mayor, itemId: 'item_herb_green', count: 3 } },
    { key: 'resident-antidote', prompt: '이 마을 주민이 해독초 2개를 구해 달라고 하는 수집 퀘스트를 추가해 줘.', args: { giver: resident, itemId: 'item_antidote', count: 2 }, setup: { event: NPC_RESIDENT } },
    { key: 'shop-honey-polite', prompt: '잡화점 주인이 꿀 4개를 가져다 달라고 부탁하는 퀘스트를 만들어 주세요. 의뢰인은 기존 잡화점 주인 NPC로 해 주세요.', args: { giver: { eventId: NPC_SHOP }, itemId: 'item_honey', count: 4 } },
    { key: 'terse-bread', prompt: '빵 5개 모아오기 퀘스트. 의뢰인은 「제빵사」.', args: { giver: { name: '제빵사' }, itemId: 'item_bread', count: 5 } },
    { key: 'explained-apple', prompt: '신입 모험가에게 시킬 첫 심부름이야. 「농부」가 사과를 6개 모아 오라고 하고, 모으면 보고하러 돌아오는 단계까지 이어지는 수집 퀘스트를 만들어 줘.', args: { giver: { name: '농부' }, itemId: 'item_apple', count: 6 } },
  ],
  build: args => ({
    key: 'ds_fetch', title: '모아 오기', summary: '필요한 물건을 모아 의뢰인에게 가져간다.',
    giver: giverDef(args.giver as any), steps: [{ kind: 'collect', itemId: args.itemId, count: args.count, sources: pickups(args.count as number) }],
  }),
  check(quest, args) {
    if (!sameKinds(quest, ['collect'])) return fail(`단계가 ${kindsOf(quest).join(',')} — collect 하나여야 한다`);
    const step = quest.steps[0];
    if (step.itemId !== args.itemId) return fail(`수집 아이템 ${step.itemId} — ${args.itemId} 여야 한다`);
    if (step.count !== args.count) return fail(`수집 수량 ${step.count} — ${args.count} 여야 한다`);
    if ((step.sources ?? []).length < 1) return fail('수집 위치가 없다');
    return pass(`${step.itemId} ×${step.count} 수집`);
  },
  mutations: args => [
    def => { def.steps[0].count = (args.count as number) + 1; def.steps[0].sources = pickups((args.count as number) + 1); },
    def => { def.steps[0].itemId = args.itemId === 'item_potion' ? 'item_ether' : 'item_potion'; },
    def => { def.giver = args.giver && (args.giver as any).eventId === NPC_RESIDENT ? giverDef({ name: '촌장' }) : giverDef({ eventId: NPC_RESIDENT }); },
    def => { def.steps[0] = { kind: 'reach', mapId: VILLAGE, x: 9, y: 4 }; },
  ],
});

const questTalkChain = questFamily({
  id: 'quest-talk-chain',
  title: '두 인물을 차례로 찾아가 말을 거는 대화 퀘스트',
  variants: [
    { key: 'smith-herbalist', prompt: '촌장이 먼저 대장장이에게, 그다음 약초꾼에게 말을 걸고 오라고 시키는 퀘스트를 만들어줘.', args: { giver: mayor, targets: [{ name: '대장장이' }, { name: '약초꾼' }] } },
    { key: 'resident-shop', prompt: '이 마을 주민이 잡화점 주인에게 안부를 전하고, 이어서 「여관 주인」에게도 인사하고 오라는 퀘스트를 추가해 줘. 여관 주인은 새로 만들어 줘.', args: { giver: resident, targets: [{ eventId: NPC_SHOP }, { name: '여관 주인' }] }, setup: { event: NPC_RESIDENT } },
    { key: 'terse', prompt: '「사서」 → 「학자」 순서로 말 걸기 퀘스트, 의뢰인은 「관리인」.', args: { giver: { name: '관리인' }, targets: [{ name: '사서' }, { name: '학자' }] } },
    { key: 'polite-fisher', prompt: '어부가 선원에게 편지 이야기를 전해 달라고 하고, 그 다음에는 등대지기에게도 들르라고 하는 퀘스트를 만들어 주세요. 인물은 모두 새로 만들어 주세요.', args: { giver: { name: '어부' }, targets: [{ name: '선원' }, { name: '등대지기' }] } },
    { key: 'shop-then-resident', prompt: '「노파」가 잡화점 주인과 마을 주민을 이 순서로 만나 보라는 퀘스트를 만들어 줘. 둘은 이미 있는 NPC를 써.', args: { giver: { name: '노파' }, targets: [{ eventId: NPC_SHOP }, { eventId: NPC_RESIDENT }] } },
  ],
  build: args => ({
    key: 'ds_talk_chain', title: '차례로 만나기', summary: '두 사람을 차례로 만나 이야기를 듣는다.', order: 'sequence',
    giver: giverDef(args.giver as any, VILLAGE, 9, 9),
    steps: (args.targets as any[]).map((target, index) => ({
      kind: 'talk', lines: ['말씀 전해 들었소.'],
      target: target.eventId ? { mapId: VILLAGE, eventId: target.eventId } : { create: { mapId: VILLAGE, x: 12 + index * 3, y: 12, name: target.name } },
    })),
  }),
  check(quest, args) {
    const targets = args.targets as any[];
    if (!sameKinds(quest, ['talk', 'talk'])) return fail(`단계가 ${kindsOf(quest).join(',')} — talk 둘이어야 한다`);
    for (let index = 0; index < targets.length; index++) {
      if (!targetOk(quest.steps[index].target, targets[index])) return fail(`${index + 1}번째 대화 상대가 ${JSON.stringify(quest.steps[index].target?.create?.name ?? quest.steps[index].target?.eventId)} — ${targets[index].eventId ?? targets[index].name} 여야 한다`);
    }
    if (quest.order === 'any') return fail('두 대화가 순서 없이(any) 저장됐다 — 차례대로(sequence)여야 한다');
    return pass('대화 2단계 순서 일치');
  },
  mutations: args => [
    def => { def.steps.reverse(); },
    def => { def.steps.pop(); },
    def => { def.steps[1] = { kind: 'reach', mapId: VILLAGE, x: 9, y: 5 }; },
    def => { def.order = 'any'; },
  ],
});

const killArgs = (troopId: string, giver: any, atMap = VILLAGE, x = 15, y = 6) => ({ troopId, giver, atMap, x, y });
const questKill = questFamily({
  id: 'quest-kill',
  title: '정해진 적 그룹을 처치하는 퀘스트',
  variants: [
    { key: 'mayor-slime', prompt: '촌장이 슬라임 정찰대를 처치해 달라고 부탁하는 퀘스트를 만들어줘.', args: killArgs('troop_slime', mayor) },
    { key: 'resident-bats', prompt: '이 마을 주민이 동굴 박쥐 떼를 쫓아내 달라고 하는 퀘스트를 추가해 줘.', args: killArgs('troop_bat_swarm', resident, VILLAGE, 17, 5), setup: { event: NPC_RESIDENT } },
    { key: 'guard-golem-polite', prompt: '「경비대장」이 석상 수호병을 쓰러뜨려 달라고 의뢰하는 퀘스트를 만들어 주세요.', args: killArgs('troop_golem_guard', { name: '경비대장' }, VILLAGE, 16, 14) },
    { key: 'terse-dragon', prompt: '붉은 드래곤 토벌 퀘스트. 의뢰인은 「왕실 기사」.', args: killArgs('troop_dragon', { name: '왕실 기사' }, VILLAGE, 20, 4) },
    { key: 'field-archers', prompt: '숲길에 나타난 광산 해골 궁수를 처치하는 퀘스트가 필요해. 의뢰인은 「사냥꾼」이고 적은 숲길 맵에 두어 줘.', args: killArgs('troop_mine_archers', { name: '사냥꾼' }, FIELD_MAP, 12, 8) },
  ],
  build: args => ({
    key: 'ds_kill', title: '토벌', summary: '적을 처치한다.', giver: giverDef(args.giver as any),
    steps: [{ kind: 'kill', troopId: args.troopId, at: { mapId: args.atMap, x: args.x, y: args.y } }],
  }),
  check(quest, args) {
    if (!sameKinds(quest, ['kill'])) return fail(`단계가 ${kindsOf(quest).join(',')} — kill 하나여야 한다`);
    const step = quest.steps[0];
    if (step.troopId !== args.troopId) return fail(`처치 대상 ${step.troopId} — ${args.troopId} 여야 한다`);
    if (args.atMap === FIELD_MAP && step.at?.mapId !== FIELD_MAP) return fail(`적 배치 맵이 ${step.at?.mapId} — ${FIELD_MAP} 여야 한다`);
    return pass(`${step.troopId} 처치`);
  },
  mutations: args => [
    def => { def.steps[0].troopId = args.troopId === 'troop_slime' ? 'troop_dragon' : 'troop_slime'; },
    def => {
      if (args.atMap === FIELD_MAP) { def.steps[0].at.mapId = VILLAGE; def.steps[0].at.x = 12; def.steps[0].at.y = 8; }
      else def.giver = (args.giver as any).eventId === NPC_SHOP ? giverDef({ name: '촌장' }) : giverDef({ eventId: NPC_SHOP });
    },
    def => { def.steps[0] = { kind: 'collect', itemId: 'item_potion', count: 1, sources: pickups(1) }; },
  ],
});

const reachArgs = (mapId: string, x: number, y: number, giver: any) => ({ mapId, x, y, giver });
const questReach = questFamily({
  id: 'quest-reach',
  title: '지정한 맵·좌표에 도착하면 완료되는 퀘스트',
  variants: [
    { key: 'plaza-3-3', prompt: '촌장이 광장의 (3,3) 칸까지 다녀오라고 하는 퀘스트를 만들어줘.', args: reachArgs(PLAZA_MAP, 3, 3, mayor) },
    { key: 'village-corner', prompt: '이 마을 주민이 마을 (4,14) 자리를 살펴보고 오라는 도착 퀘스트를 추가해 줘.', args: reachArgs(VILLAGE, 4, 14, resident), setup: { event: NPC_RESIDENT } },
    { key: 'field-polite', prompt: '「나그네」가 숲길 (12,8)에 도착하면 완료되는 퀘스트를 만들어 주세요.', args: reachArgs(FIELD_MAP, 12, 8, { name: '나그네' }) },
    { key: 'terse', prompt: '광장 (10,10) 도달 퀘스트. 의뢰인 「안내인」.', args: reachArgs(PLAZA_MAP, 10, 10, { name: '안내인' }) },
    { key: 'shop-explained', prompt: '잡화점 주인이 숲길 (6,5)까지 배달 길을 확인하고 오라고 부탁하는 퀘스트야. 도착만 하면 돼. 의뢰인은 기존 잡화점 주인으로.', args: reachArgs(FIELD_MAP, 6, 5, { eventId: NPC_SHOP }) },
  ],
  build: args => ({
    key: 'ds_reach', title: '다녀오기', summary: '정해진 곳에 도착한다.', giver: giverDef(args.giver as any),
    steps: [{ kind: 'reach', mapId: args.mapId, x: args.x, y: args.y }],
  }),
  check(quest, args) {
    if (!sameKinds(quest, ['reach'])) return fail(`단계가 ${kindsOf(quest).join(',')} — reach 하나여야 한다`);
    const step = quest.steps[0];
    if (step.mapId !== args.mapId) return fail(`도착 맵 ${step.mapId} — ${args.mapId} 여야 한다`);
    if (step.x !== args.x || step.y !== args.y) return fail(`도착 칸 (${step.x},${step.y}) — (${args.x},${args.y}) 여야 한다`);
    return pass(`${step.mapId} (${step.x},${step.y}) 도착`);
  },
  mutations: args => [
    def => { def.steps[0].x = (args.x as number) + 2; },
    def => { def.steps[0].mapId = args.mapId === FIELD_MAP ? VILLAGE : FIELD_MAP; def.steps[0].x = 12; def.steps[0].y = 8; },
    def => { def.steps[0] = { kind: 'kill', troopId: 'troop_slime', at: { mapId: VILLAGE, x: 15, y: 6 } }; },
  ],
});

export const GROUP_6A: readonly Family[] = [questFetch, questTalkChain, questKill, questReach, ...QUEST_FAMILIES_2, ...TOWN_FAMILIES, ...SYSTEM_FAMILIES, ...BOSS_FAMILIES];
