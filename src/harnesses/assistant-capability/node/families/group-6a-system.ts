import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, eventOf, fail, keepsInOrder, mapOf, pass, runOn, sameExcept, withoutEvent, type JudgeInput, type Verdict } from '../matrixNativeSpec';
import { attempt, distinct, newEventOn } from './group-4-shared';
import type { Family, FamilyOutcome } from './types';

const PLAZA = 'map_plaza';

const walk = (list: any[] | undefined): any[] => (list ?? []).flatMap((command: any) => {
  if (!command || typeof command !== 'object') return [command];
  const nested: any[] = [];
  if (command.kind === 'choices') for (const option of command.options ?? []) nested.push(...walk(option.branch));
  if (command.kind === 'fork') nested.push(...walk(command.then), ...walk(command.else));
  return [command, ...nested];
});
const commandsOf = (event: any): any[] => (event?.pages ?? []).flatMap((page: any) => walk(page.commands));

const system = (project: Project): any => (project as any).system;
const without = (doc: any, ...keys: string[]) => { for (const key of keys) delete doc[key]; return doc; };

const titleScreen: Family = {
  id: 'title-screen-set',
  area: 'system',
  mode: 'write',
  title: '타이틀 화면의 제목·메뉴 문구 설정',
  variants: [
    { key: 'title-and-start', prompt: '타이틀 화면 제목을 「재의 마을」로 하고, 새 게임 버튼 문구는 「모험 시작」으로 바꿔줘.', args: { title: '재의 마을', labels: { newGame: '모험 시작' } } },
    { key: 'title-only-polite', prompt: '게임 제목을 「별빛 항구」로 설정해 주세요. 메뉴 문구는 그대로 두세요.', args: { title: '별빛 항구' } },
    { key: 'labels-only', prompt: '타이틀 메뉴에서 새 게임은 「새 여정」, 종료는 「그만하기」로 보이게 해줘. 제목은 건드리지 마.', args: { labels: { newGame: '새 여정', quit: '그만하기' } } },
    { key: 'hide-continue', prompt: '「달빛 연대기」라는 제목으로 하고, 이 게임 타이틀에서는 불러오기 메뉴를 숨겨줘.', args: { title: '달빛 연대기', hideContinue: true } },
    { key: 'terse-load', prompt: '타이틀 제목 「용사의 귀환」, 불러오기 문구 「기억 불러오기」.', args: { title: '용사의 귀환', labels: { continueGame: '기억 불러오기' } } },
  ],
  judge(input, args) {
    const before = system(input.before).titleScreen ?? {}, after = system(input.after).titleScreen;
    if (!after) return fail('타이틀 화면 설정이 없다');
    const labels = (args.labels ?? {}) as Record<string, string>;
    if (typeof args.title === 'string' && after.title !== args.title) return fail(`제목이 「${after.title}」 — 「${args.title}」 여야 한다`);
    for (const [key, value] of Object.entries(labels)) if (after.menuLabels?.[key] !== value) return fail(`메뉴 ${key} 문구가 「${after.menuLabels?.[key]}」 — 「${value}」 여야 한다`);
    if (args.hideContinue === true && after.menuVisibility?.continueGame !== false) return fail('불러오기 메뉴가 숨겨지지 않았다');
    const strip = (screen: any) => {
      const copy = clone(screen);
      if (typeof args.title === 'string') delete copy.title;
      for (const key of Object.keys(labels)) delete copy.menuLabels?.[key];
      if (args.hideContinue === true && copy.menuVisibility) delete copy.menuVisibility.continueGame;
      return copy;
    };
    if (!isDeepStrictEqual(strip(before), strip(after))) return fail('요청하지 않은 타이틀 설정(메뉴 표시·배치·그림 등)이 바뀌었다');
    const blank = (doc: any) => { delete doc.system.titleScreen; };
    if (!sameExcept(input.before, input.after, blank)) return fail('타이틀 설정 밖의 내용이 바뀌었다');
    return pass('타이틀 제목·메뉴 문구 일치');
  },
  reference(project, args) {
    return runOn(clone(project), 'set_title_screen', {
      ...(typeof args.title === 'string' ? { title: args.title } : {}),
      ...(args.labels ? { menuLabels: args.labels } : {}),
      ...(args.hideContinue ? { menuVisibility: { continueGame: false } } : {}),
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const reference = titleScreen.reference!(clone(project), args) as Project;
    const labels = (args.labels ?? {}) as Record<string, string>;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'set_title_screen', extra));
    return distinct(reference, [
      typeof args.title === 'string' ? run({ title: `${args.title} 2`, ...(args.labels ? { menuLabels: args.labels } : {}), ...(args.hideContinue ? { menuVisibility: { continueGame: false } } : {}) }) : run({ title: '새 프로젝트 X', menuLabels: labels }),
      Object.keys(labels).length ? run({ ...(typeof args.title === 'string' ? { title: args.title } : {}), menuLabels: Object.fromEntries(Object.keys(labels).map(key => [key, '다른 문구'])) }) : run({ title: args.title, menuVisibility: { quit: false } }),
      run({ ...(typeof args.title === 'string' ? { title: args.title } : {}), ...(args.labels ? { menuLabels: args.labels } : {}), ...(args.hideContinue ? { menuVisibility: { continueGame: false } } : {}), layout: { titleX: 10, titleY: 10 } }),
    ]);
  },
};

type Start = { gold?: number; inventory?: Record<string, number>; party?: string[] };
const startState: Family = {
  id: 'start-state',
  area: 'party',
  mode: 'write',
  title: '게임 시작 소지금·소지품·파티 설정',
  variants: [
    { key: 'gold', prompt: '게임을 시작할 때 소지금이 500골드가 되게 해줘.', args: { gold: 500 } },
    { key: 'items', prompt: '시작할 때 회복약 3개와 해독초 2개를 들고 시작하게 해줘.', args: { inventory: { item_potion: 3, item_antidote: 2 } } },
    { key: 'party', prompt: '시작 파티를 주인공과 마도사 둘로 해 주세요.', args: { party: ['actor_hero', 'actor_mage'] } },
    { key: 'gold-and-potion', prompt: '시작 소지금 1000골드, 거기에 엘릭서 1개를 가지고 시작하도록 설정해 줘.', args: { gold: 1000, inventory: { item_elixir: 1 } } },
    { key: 'terse-key', prompt: '시작 소지금 0, 낡은 열쇠 하나만 들고 시작.', args: { gold: 0, inventory: { item_old_key: 1 } } },
  ],
  judge(input, args) {
    const want = args as Start;
    const before = system(input.before) && (input.before as any).session, after = (input.after as any).session;
    const gold = (after.gold ?? 0), goldBefore = (before.gold ?? 0);
    if (want.gold !== undefined ? gold !== want.gold : gold !== goldBefore) return fail(`시작 소지금 ${gold} — ${want.gold ?? goldBefore} 여야 한다`);
    if (want.inventory) {
      if (!isDeepStrictEqual(after.inventory ?? {}, want.inventory)) return fail(`시작 소지품 ${JSON.stringify(after.inventory)} — ${JSON.stringify(want.inventory)} 여야 한다`);
    } else if (!isDeepStrictEqual(after.inventory ?? {}, before.inventory ?? {})) return fail('요청하지 않은 소지품이 바뀌었다');
    const startActors = system(input.after).startActorIds ?? [];
    if (want.party) {
      const ok = isDeepStrictEqual(after.partyActorIds, want.party) || isDeepStrictEqual([...after.partyActorIds].sort(), [...want.party].sort());
      if (!ok) return fail(`시작 파티 ${JSON.stringify(after.partyActorIds)} — ${JSON.stringify(want.party)} 여야 한다`);
    } else if (!isDeepStrictEqual(after.partyActorIds, before.partyActorIds) || !isDeepStrictEqual(startActors, system(input.before).startActorIds)) return fail('요청하지 않은 파티가 바뀌었다');
    const blank = (doc: any) => { without(doc.session, 'gold', 'inventory', 'partyActorIds'); delete doc.system.startActorIds; };
    return sameExcept(input.before, input.after, blank) ? pass('시작 상태 일치') : fail('시작 상태 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as Start;
    return runOn(clone(project), 'set_session_start', {
      ...(want.gold !== undefined ? { gold: want.gold } : {}),
      ...(want.inventory ? { inventory: want.inventory } : {}),
      ...(want.party ? { partyActorIds: want.party } : {}),
    });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as Start;
    const reference = startState.reference!(clone(project), args) as Project;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'set_session_start', extra));
    const wrongInventory = want.inventory ? Object.fromEntries(Object.entries(want.inventory).map(([id, count]) => [id, count + 1])) : { item_potion: 1 };
    return distinct(reference, [
      want.gold !== undefined ? run({ ...pick(want), gold: want.gold + 100 }) : run({ ...pick(want), gold: 100 }),
      run({ ...pick(want), inventory: wrongInventory }),
      want.party ? run({ ...pick(want), partyActorIds: ['actor_hero'] }) : run({ ...pick(want), partyActorIds: ['actor_hero', 'actor_mage'] }),
    ]);
  },
};
const pick = (want: Start): Record<string, unknown> => ({
  ...(want.gold !== undefined ? { gold: want.gold } : {}),
  ...(want.inventory ? { inventory: want.inventory } : {}),
  ...(want.party ? { partyActorIds: want.party } : {}),
});

type Over = { presentation?: string; goldLossPercent?: number; recovery?: { mapId: string; x: number; y: number }; title?: string; message?: string; retryLabel?: string; titleLabel?: string };
const gameOverSetting: Family = {
  id: 'game-over-setting',
  area: 'system',
  mode: 'write',
  title: '패배(게임오버) 방식·문구 설정',
  variants: [
    { key: 'blackout-half', prompt: '전투에서 지면 포켓몬처럼 소지금 절반을 잃고 마을 (8,8)로 돌아오게 해줘.', args: { presentation: 'blackout', goldLossPercent: 50, recovery: { mapId: MAP, x: 8, y: 8 } } },
    { key: 'text', prompt: '게임오버 화면 제목은 「여기서 끝인가」, 본문은 「영웅은 아직 쓰러지지 않았다.」로 해줘.', args: { title: '여기서 끝인가', message: '영웅은 아직 쓰러지지 않았다.' } },
    { key: 'buttons-polite', prompt: '게임오버 화면의 다시 하기 버튼은 「다시 도전」, 타이틀 버튼은 「처음으로」로 바꿔 주세요.', args: { retryLabel: '다시 도전', titleLabel: '처음으로' } },
    { key: 'horror', prompt: '패배 연출을 호러 스타일로 바꿔줘.', args: { presentation: 'horror' } },
    { key: 'blackout-plaza', prompt: '쓰러지면 광장 (2,2)에서 되살아나게 하고, 돈은 잃지 않게 해 줘. 진행은 유지하는 방식으로.', args: { presentation: 'blackout', recovery: { mapId: PLAZA, x: 2, y: 2 } } },
  ],
  judge(input, args) {
    const want = args as Over;
    const before = system(input.before).gameOver ?? {}, after = system(input.after).gameOver;
    if (!after) return fail('게임오버 설정이 없다');
    for (const key of ['presentation', 'title', 'message', 'retryLabel', 'titleLabel'] as const) {
      if (want[key] !== undefined && after[key] !== want[key]) return fail(`${key} 가 「${after[key]}」 — 「${want[key]}」 여야 한다`);
    }
    if (want.goldLossPercent !== undefined && after.goldLossPercent !== want.goldLossPercent) return fail(`소지금 손실 ${after.goldLossPercent} — ${want.goldLossPercent} 여야 한다`);
    if (want.goldLossPercent === undefined && args.presentation === 'blackout' && (after.goldLossPercent ?? 0) !== 0) return fail('돈을 잃지 않게 해 달라고 했는데 소지금 손실이 있다');
    if (want.recovery && !isDeepStrictEqual(after.recovery, want.recovery)) return fail(`귀환 좌표 ${JSON.stringify(after.recovery)} — ${JSON.stringify(want.recovery)} 여야 한다`);
    const strip = (settings: any) => {
      const copy = clone(settings);
      for (const key of ['presentation', 'title', 'message', 'retryLabel', 'titleLabel', 'goldLossPercent', 'recovery']) if ((want as any)[key] !== undefined) delete copy[key];
      if (want.goldLossPercent === undefined) delete copy.goldLossPercent;
      return copy;
    };
    if (!isDeepStrictEqual(strip(before), strip(after))) return fail('요청하지 않은 게임오버 설정이 바뀌었다');
    const blank = (doc: any) => { delete doc.system.gameOver; };
    return sameExcept(input.before, input.after, blank) ? pass('게임오버 설정 일치') : fail('게임오버 설정 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(clone(project), 'set_game_over', args);
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as Over;
    const reference = gameOverSetting.reference!(clone(project), args) as Project;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'set_game_over', extra));
    return distinct(reference, [
      run({ ...args, presentation: want.presentation === 'horror' ? 'classic' : want.presentation === undefined ? 'horror' : 'classic' }),
      want.title ? run({ ...args, title: `${want.title}!` }) : want.retryLabel ? run({ ...args, retryLabel: '그만' }) : want.recovery ? run({ ...args, recovery: { mapId: MAP, x: 3, y: 3 } }) : run({ presentation: 'blackout', recovery: { mapId: MAP, x: 8, y: 8 } }),
      run({ ...args, backgroundResourceId: '' , message: '엉뚱한 본문' }),
    ]);
  },
};

type Save = { mapId: string; x: number; y: number; mode?: string; heal?: boolean; name?: string; prompt?: string };
const savepointPlace: Family = {
  id: 'savepoint-place',
  area: 'system',
  mode: 'write',
  title: '지정한 칸에 세이브 포인트 설치',
  variants: [
    { key: 'default', prompt: '마을 (14,10) 칸에 세이브 포인트를 하나 놓아줘.', args: { mapId: MAP, x: 14, y: 10 } },
    { key: 'slot-only', prompt: '광장 (10,8) 칸에 저장 칸 메뉴만 열리는 세이브 포인트를 만들어 줘. 체크포인트는 필요 없어.', args: { mapId: PLAZA, x: 10, y: 8, mode: 'slot' } },
    { key: 'checkpoint-polite', prompt: '마을 (16,10)에 사망 재시도용 체크포인트 크리스탈을 놓아 주세요. 저장 메뉴는 열리지 않아도 돼요.', args: { mapId: MAP, x: 16, y: 10, mode: 'checkpoint' } },
    { key: 'heal', prompt: '마을 (18,10)에 세이브 포인트를 놓고, 조사하면 파티가 전원 회복되게 해줘.', args: { mapId: MAP, x: 18, y: 10, heal: true } },
    { key: 'named-prompt', prompt: '광장 (12,10)에 「여행자의 쉼터」라는 이름의 세이브 포인트를 두고, 조사하면 「기록하시겠습니까?」라고 먼저 물어보게 해 줘.', args: { mapId: PLAZA, x: 12, y: 10, name: '여행자의 쉼터', prompt: '기록하시겠습니까?' } },
  ],
  judge(input, args) {
    const want = args as unknown as Save;
    const added = newEventOn(input.before, input.after, want.mapId);
    if (added.length !== 1) return fail(`새 이벤트가 ${added.length}개다(하나여야 한다)`);
    const event = added[0];
    if (event.x !== want.x || event.y !== want.y) return fail(`세이브 포인트가 (${event.x},${event.y}) 에 있다 — (${want.x},${want.y}) 여야 한다`);
    const commands = commandsOf(event);
    const has = (kind: string) => commands.some((command: any) => command.kind === kind);
    const mode = want.mode ?? 'both';
    if (mode !== 'slot' && !has('checkpointSave')) return fail('체크포인트 저장 명령이 없다');
    if (mode === 'slot' && has('checkpointSave')) return fail('저장 칸 메뉴만 요청했는데 체크포인트가 들어갔다');
    if (mode !== 'checkpoint' && !has('openSaveMenu')) return fail('저장 칸 메뉴 명령이 없다');
    if (mode === 'checkpoint' && has('openSaveMenu')) return fail('체크포인트만 요청했는데 저장 칸 메뉴가 열린다');
    if (want.heal === true && !has('recoverAll')) return fail('전원 회복 명령이 없다');
    if (want.heal !== true && has('recoverAll')) return fail('회복을 요청하지 않았는데 전원 회복이 들어갔다');
    if (want.name && !(String(event.name ?? '').includes(want.name) || (event.pages ?? []).some((page: any) => String(page.name ?? '').includes(want.name!)))) return fail(`이름에 「${want.name}」 가 없다`);
    if (want.prompt) {
      const asked = commands.some((command: any) => command.kind === 'choices' && String(command.prompt ?? '').includes(want.prompt!));
      if (!asked) return fail(`저장 전에 「${want.prompt}」 를 묻는 선택지가 없다`);
    }
    return sameExcept(input.before, input.after, withoutEvent(event.id)) ? pass(`(${event.x},${event.y}) 세이브 포인트 ${mode}`) : fail('세이브 포인트 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as Save;
    return runOn(clone(project), 'place_savepoint', { ...want });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as Save;
    const reference = savepointPlace.reference!(clone(project), args) as Project;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'place_savepoint', { ...want, ...extra }));
    return distinct(reference, [
      run({ x: want.x + 2 }),
      run({ mapId: want.mapId === MAP ? PLAZA : MAP }),
      run({ mode: want.mode === 'slot' ? 'checkpoint' : 'slot' }),
      run({ heal: want.heal !== true }),
    ]);
  },
};

type Flag = { id: string; kind: 'switch' | 'variable'; keyword: string };
const storyFlagDeclare: Family = {
  id: 'story-flag-declare',
  area: 'story',
  mode: 'write',
  title: '이야기 플래그(스위치·변수) 선언',
  variants: [
    { key: 'met-mayor', prompt: '「met-mayor」라는 스위치형 이야기 플래그를 만들어줘. 설명은 「촌장을 처음 만났다」.', args: { id: 'met-mayor', kind: 'switch', keyword: '촌장' } },
    { key: 'herbs-count', prompt: '약초를 몇 개 모았는지 세는 변수형 플래그 「herbs-collected」를 등록해 줘. 설명은 「모은 약초 수」로.', args: { id: 'herbs-collected', kind: 'variable', keyword: '약초' } },
    { key: 'gate-open-polite', prompt: '「gate-opened」 스위치 플래그를 선언해 주세요. 설명은 「마을 북문이 열렸다」입니다.', args: { id: 'gate-opened', kind: 'switch', keyword: '북문' } },
    { key: 'trust-terse', prompt: '신뢰도 변수 플래그 「villager-trust」 추가. 설명: 「마을 사람들의 신뢰도」.', args: { id: 'villager-trust', kind: 'variable', keyword: '신뢰' } },
    { key: 'boss-defeated', prompt: '보스를 쓰러뜨렸는지 기록하는 「boss-defeated」 스위치 플래그를 이야기 플래그로 등록해 줘. 설명에는 보스 처치라고 적어 줘.', args: { id: 'boss-defeated', kind: 'switch', keyword: '보스' } },
  ],
  judge(input, args) {
    const want = args as unknown as Flag;
    const was = ((input.before as any).storyFlags ?? []) as any[];
    const now = ((input.after as any).storyFlags ?? []) as any[];
    const added = now.filter(flag => !was.some(old => old.id === flag.id));
    if (added.length !== 1) return fail(`새 이야기 플래그가 ${added.length}개다(하나여야 한다)`);
    const flag = added[0];
    if (flag.id !== want.id) return fail(`id 가 ${flag.id} — ${want.id} 여야 한다`);
    if (flag.kind !== want.kind) return fail(`종류가 ${flag.kind} — ${want.kind} 여야 한다`);
    if (!String(flag.description ?? '').includes(want.keyword)) return fail(`설명에 「${want.keyword}」 가 없다`);
    for (const old of was) if (!isDeepStrictEqual(old, now.find(entry => entry.id === old.id))) return fail(`기존 플래그 ${old.id} 가 바뀌었다`);
    const blank = (doc: any) => { delete doc.storyFlags; delete doc.switches; delete doc.variables; };
    return sameExcept(input.before, input.after, blank) ? pass(`${flag.id} (${flag.kind}) 선언`) : fail('플래그 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as Flag;
    return runOn(clone(project), 'declare_story_flag', { action: 'declare', id: want.id, kind: want.kind, description: DESCRIPTIONS[want.id] });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as Flag;
    const reference = storyFlagDeclare.reference!(clone(project), args) as Project;
    const run = (extra: Record<string, unknown>) => attempt(() => runOn(clone(project), 'declare_story_flag', { action: 'declare', id: want.id, kind: want.kind, description: DESCRIPTIONS[want.id], ...extra }));
    return distinct(reference, [
      run({ kind: want.kind === 'switch' ? 'variable' : 'switch' }),
      run({ id: `${want.id}-x` }),
      run({ description: '내용 없음' }),
      attempt(() => { const other = runOn(clone(project), 'declare_story_flag', { action: 'declare', id: want.id, kind: want.kind, description: DESCRIPTIONS[want.id] }); (other as any).database.items[0].name = '변조'; return other; }),
    ]);
  },
};
const DESCRIPTIONS: Record<string, string> = {
  'met-mayor': '촌장을 처음 만났다',
  'herbs-collected': '모은 약초 수',
  'gate-opened': '마을 북문이 열렸다',
  'villager-trust': '마을 사람들의 신뢰도',
  'boss-defeated': '보스 처치 여부',
};

type EndingArgs = { name: string; eventId: string };
const endingDefine: Family = {
  id: 'ending-define',
  area: 'story',
  mode: 'write',
  title: '엔딩을 정의하고 이벤트에서 실제로 발동되게 연결',
  variants: [
    { key: 'resident', prompt: '「마을의 평화」라는 엔딩을 만들고, 마을 주민에게 말을 걸면 그 엔딩이 나오게 해줘.', args: { name: '마을의 평화', eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'shop', prompt: '잡화점 주인에게 말을 걸면 「상인의 은퇴」 엔딩이 발동되도록 엔딩을 정의하고 연결해 주세요.', args: { name: '상인의 은퇴', eventId: 'ev_test_shop' }, setup: { event: 'ev_test_shop' } },
    { key: 'cutscene', prompt: '장면 연출 이벤트의 끝에서 「새로운 아침」 엔딩이 시작되게 해 줘.', args: { name: '새로운 아침', eventId: 'ev_test_cutscene' }, setup: { event: 'ev_test_cutscene' } },
    { key: 'door-terse', prompt: '마을 문 이벤트를 조사하면 「여정의 끝」 엔딩. 엔딩 정의부터 해.', args: { name: '여정의 끝', eventId: 'ev_test_door' }, setup: { event: 'ev_test_door' } },
    { key: 'guard-explained', prompt: '경비병과 이야기를 마치면 게임이 「수호자의 맹세」 엔딩으로 끝나게 하고 싶어. 엔딩을 정의하고 경비병 이벤트에서 실제로 불러 줘.', args: { name: '수호자의 맹세', eventId: 'ev_ember_guard' }, setup: { event: 'ev_ember_guard' } },
  ],
  judge(input, args) {
    const want = args as unknown as EndingArgs;
    const was = ((input.before as any).endings ?? []) as any[];
    const now = ((input.after as any).endings ?? []) as any[];
    const added = now.filter(ending => !was.some(old => old.id === ending.id));
    if (added.length !== 1) return fail(`새 엔딩이 ${added.length}개다(하나여야 한다)`);
    const ending = added[0];
    if (!String(ending.name ?? '').includes(want.name)) return fail(`엔딩 이름이 「${ending.name}」 — 「${want.name}」 여야 한다`);
    for (const old of was) if (!isDeepStrictEqual(old, now.find(entry => entry.id === old.id))) return fail(`기존 엔딩 ${old.id} 가 바뀌었다`);
    const before = eventOf(input.before, want.eventId), after = eventOf(input.after, want.eventId);
    if (!before || !after) return fail(`${want.eventId} 이벤트가 사라졌다`);
    const triggers = commandsOf(after).filter((command: any) => command.kind === 'triggerEnding');
    if (!triggers.some((command: any) => command.endingId === ending.id)) return fail(`${want.eventId} 에 ${ending.id} 를 부르는 triggerEnding 이 없다`);
    if (triggers.some((command: any) => command.endingId && command.endingId !== ending.id)) return fail('다른 엔딩을 부르는 명령이 있다');
    const was0 = (before.pages ?? []).flatMap((page: any) => page.commands ?? []);
    const now0 = (after.pages ?? []).flatMap((page: any) => page.commands ?? []);
    if (!keepsInOrder(was0, now0)) return fail(`${want.eventId} 의 기존 명령이 사라졌거나 순서가 바뀌었다`);
    const blank = (doc: any) => { withoutEvent(want.eventId)(doc); delete doc.endings; };
    return sameExcept(input.before, input.after, blank) ? pass(`${ending.id} 정의 + ${want.eventId} 에서 발동`) : fail('엔딩·그 이벤트 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const want = args as unknown as EndingArgs;
    const defined = runOn(clone(project), 'define_ending', { id: 'ending_ds', name: want.name, conditions: [] });
    const event = eventOf(defined, want.eventId);
    const commands = [...(event.pages[0].commands as any[]), { kind: 'triggerEnding', endingId: 'ending_ds' }];
    return runOn(defined, 'patch_event_page', { mapId: MAP, eventId: want.eventId, pageIndex: 0, set: { commands } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const want = args as unknown as EndingArgs;
    const reference = endingDefine.reference!(clone(project), args) as Project;
    const defineOnly = attempt(() => runOn(clone(project), 'define_ending', { id: 'ending_ds', name: want.name, conditions: [] }));
    const otherEvent = want.eventId === 'ev_utility_npc' ? 'ev_test_shop' : 'ev_utility_npc';
    const wired = (eventId: string, name: string) => attempt(() => {
      const defined = runOn(clone(project), 'define_ending', { id: 'ending_ds', name, conditions: [] });
      const event = eventOf(defined, eventId);
      return runOn(defined, 'patch_event_page', { mapId: MAP, eventId, pageIndex: 0, set: { commands: [...(event.pages[0].commands as any[]), { kind: 'triggerEnding', endingId: 'ending_ds' }] } });
    });
    const replaced = attempt(() => {
      const defined = runOn(clone(project), 'define_ending', { id: 'ending_ds', name: want.name, conditions: [] });
      return runOn(defined, 'patch_event_page', { mapId: MAP, eventId: want.eventId, pageIndex: 0, set: { commands: [{ kind: 'triggerEnding', endingId: 'ending_ds' }] } });
    });
    return distinct(reference, [defineOnly, wired(otherEvent, want.name), wired(want.eventId, `${want.name} 아님`), replaced]);
  },
};

export const SYSTEM_FAMILIES: readonly Family[] = [titleScreen, startState, gameOverSetting, savepointPlace, storyFlagDeclare, endingDefine];
void mapOf;
export type { JudgeInput, Verdict };
