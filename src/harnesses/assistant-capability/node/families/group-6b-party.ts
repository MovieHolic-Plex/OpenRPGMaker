import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, eventOf, fail, mapOf, pass, runOn, sameExcept, withoutEvent } from '../matrixNativeSpec';
import { numArg, strArg, type Family, type FamilyOutcome } from './types';
import {
  attempt, commandsOfKind, distinct, eventIn, growsOnly, keepsRows, newEventsOn, newRows, withoutFlags, withoutRows,
} from './group-6b-shared';

// ── companion-add ──────────────────────────────────────────────────────────

const companionAdd: Family = {
  id: 'companion-add',
  area: 'party',
  mode: 'write',
  title: '동료가 따라오게 하는 이벤트(합류)',
  variants: [
    { key: 'dog-talk', prompt: '(14,3) 칸에 충견이 서 있다가 말을 걸면 동료로 따라오게 해줘.', args: { actorId: 'actor_dog', x: 14, y: 3, trigger: 'talk' } },
    { key: 'hunter-auto-polite', prompt: '마을 (16,4) 칸에 사냥꾼이 이 맵에 들어오면 자동으로 일행에 합류하는 장면을 만들어 주세요.', args: { actorId: 'actor_hunter', x: 16, y: 4, trigger: 'autorun' } },
    { key: 'cat-existing-npc', prompt: '마을 주민에게 말을 걸면 고양이가 따라오게 해줘. 주민의 기존 대사는 그대로 두고.', args: { actorId: 'actor_cat', eventId: 'ev_utility_npc' }, setup: { event: 'ev_utility_npc' } },
    { key: 'scout-terse', prompt: '(17,5)에 정찰병 동료 합류 이벤트 추가.', args: { actorId: 'actor_scout', x: 17, y: 5, trigger: 'talk' } },
    { key: 'sheep-explained', prompt: '양을 동료로 삼고 싶어. (15,6) 칸에서 말을 걸면 양이 플레이어 뒤를 따라다니게 해 줘. 다른 이벤트는 건드리지 마.', args: { actorId: 'actor_sheep', x: 15, y: 6, trigger: 'talk' } },
  ],
  judge(input, args) {
    const actorId = strArg(args, 'actorId');
    const followers = (event: any) => commandsOfKind(event, 'addFollower');
    if (typeof args.eventId === 'string') {
      const id = args.eventId;
      if (!sameExcept(input.before, input.after, withoutEvent(id))) return fail(id + ' 밖의 내용이 바뀌었다');
      const was = eventIn(input.before, id), now = eventIn(input.after, id);
      if (!was || !now) return fail(id + ' 이벤트가 사라졌다');
      const added = followers(now).filter(command => !followers(was).some(old => isDeepStrictEqual(old, command)));
      if (added.length !== 1 || added[0].actorId !== actorId) return fail('addFollower(' + actorId + ') 가 정확히 하나 추가돼야 한다: ' + JSON.stringify(added));
      const texts = (event: any) => commandsOfKind(event, 'text').map(command => command.body);
      if (!isDeepStrictEqual(texts(now), texts(was))) return fail('기존 대사가 바뀌었다');
      return pass(id + ' 에 ' + actorId + ' 동료 합류 추가');
    }
    const fresh = newEventsOn(input.before, input.after);
    if (fresh.length !== 1) return fail('새 이벤트가 ' + fresh.length + '개다(하나여야 한다)');
    const event = fresh[0];
    const mine = followers(event);
    if (mine.length !== 1 || mine[0].actorId !== actorId) return fail('addFollower(' + actorId + ') 가 정확히 하나여야 한다: ' + JSON.stringify(mine));
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    if (event.x !== x || event.y !== y) return fail('이벤트 위치 (' + event.x + ',' + event.y + ') — (' + x + ',' + y + ') 여야 한다');
    const wantTrigger = args.trigger === 'autorun' ? 'auto' : 'action';
    const triggers = [event.trigger?.kind, ...(event.pages ?? []).map((page: any) => page.trigger?.kind)];
    if (!triggers.includes(wantTrigger)) return fail('트리거가 ' + args.trigger + ' 방식이 아니다(' + triggers.join(',') + ')');
    if (commandsOfKind(event, 'removeFollower').length) return fail('동료를 해제하는 명령이 들어갔다');
    if (!growsOnly(input.before, input.after, 'switches')) return fail('기존 스위치가 바뀌었다');
    const blank = (doc: any) => { withoutEvent(event.id)(doc); withoutFlags(doc); };
    return sameExcept(input.before, input.after, blank) ? pass('(' + x + ',' + y + ') 에 ' + actorId + ' 합류 이벤트') : fail('새 이벤트 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const who = { actorId: strArg(args, 'actorId') };
    if (typeof args.eventId === 'string') return runOn(project, 'add_companion', { who, target: { eventId: args.eventId, mapId: MAP } });
    return runOn(project, 'add_companion', { who, target: { mapId: MAP, x: numArg(args, 'x'), y: numArg(args, 'y') }, trigger: args.trigger });
  },
  wrongs(project, args): FamilyOutcome[] {
    const actorId = strArg(args, 'actorId');
    const other = actorId === 'actor_dog' ? 'actor_cat' : 'actor_dog';
    const reference = companionAdd.reference!(clone(project), args) as Project;
    if (typeof args.eventId === 'string') {
      return distinct(reference, [
        attempt(() => runOn(clone(project), 'add_companion', { who: { actorId: other }, target: { eventId: args.eventId, mapId: MAP } })),
        attempt(() => runOn(clone(project), 'add_companion', { who: { actorId }, target: { eventId: 'ev_test_shop', mapId: MAP } })),
        attempt(() => runOn(clone(project), 'add_companion', { who: { actorId }, target: { mapId: MAP, x: 16, y: 4 }, trigger: 'talk' })),
      ]);
    }
    const x = numArg(args, 'x'), y = numArg(args, 'y');
    const other2 = args.trigger === 'autorun' ? 'talk' : 'autorun';
    return distinct(reference, [
      attempt(() => runOn(clone(project), 'add_companion', { who: { actorId: other }, target: { mapId: MAP, x, y }, trigger: args.trigger })),
      attempt(() => runOn(clone(project), 'add_companion', { who: { actorId }, target: { mapId: MAP, x: x === 19 ? 18 : x + 1, y }, trigger: args.trigger })),
      attempt(() => runOn(clone(project), 'add_companion', { who: { actorId }, target: { mapId: MAP, x, y }, trigger: other2 })),
      attempt(() => runOn(clone(project), 'add_companion', { who: { actorId }, target: { eventId: 'ev_utility_npc', mapId: MAP } })),
    ]);
  },
};

// ── party-start ────────────────────────────────────────────────────────────

const NAMES: Record<string, string> = { actor_hero: '주인공', actor_mage: '마도사', actor_scout: '정찰병', actor_cleric: '성직자', actor_guardian: '수호자', actor_ranger: '궁수' };

const partyStart: Family = {
  id: 'party-start',
  area: 'party',
  mode: 'write',
  title: '새 게임 시작 파티 구성(순서 포함)',
  variants: [
    { key: 'hero-mage', prompt: '새 게임을 시작할 때 파티를 주인공과 마도사 둘로 해줘.', args: { actorIds: ['actor_hero', 'actor_mage'] } },
    { key: 'three-ordered', prompt: '시작 파티는 마도사, 성직자, 정찰병 순서로 세 명이야. 그렇게 맞춰 줘.', args: { actorIds: ['actor_mage', 'actor_cleric', 'actor_scout'] } },
    { key: 'solo-mage-terse', prompt: '시작 파티 마도사 혼자만.', args: { actorIds: ['actor_mage'] } },
    { key: 'four-polite', prompt: '처음 게임을 시작하면 주인공, 수호자, 마도사, 성직자 네 명이 함께 있도록 시작 파티를 설정해 주세요.', args: { actorIds: ['actor_hero', 'actor_guardian', 'actor_mage', 'actor_cleric'] } },
    { key: 'ranger-lead-explained', prompt: '시작할 때 맨 앞에 궁수가 서고 그 뒤에 주인공이 따라오는 두 명 파티로 바꿔 줘. 다른 설정은 그대로 두고.', args: { actorIds: ['actor_ranger', 'actor_hero'] } },
  ],
  judge(input, args) {
    const want = (args.actorIds as string[]).slice();
    const got = ((input.after as any).system.startActorIds ?? []) as string[];
    if (!isDeepStrictEqual(got, want)) return fail('시작 파티 [' + got.join(',') + '] — [' + want.join(',') + '] (순서 포함) 여야 한다');
    const blank = (doc: any) => { delete doc.system.startActorIds; delete doc.session.partyActorIds; };
    return sameExcept(input.before, input.after, blank) ? pass('시작 파티 ' + want.join(',')) : fail('시작 파티 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'set_party', { scope: 'start', actorIds: args.actorIds });
  },
  wrongs(project, args): FamilyOutcome[] {
    const ids = (args.actorIds as string[]).slice();
    const reference = partyStart.reference!(clone(project), args) as Project;
    const set = (actorIds: string[], scope: 'start' | 'session' = 'start') => attempt(() => runOn(clone(project), 'set_party', { scope, actorIds }));
    const extra = ['actor_monk', 'actor_bard'].find(id => !ids.includes(id))!;
    return distinct(reference, [
      ids.length > 1 ? set([...ids].reverse()) : set([...ids, extra]),
      ids.length > 1 ? set(ids.slice(0, -1)) : set([extra]),
      set([...ids, extra]),
      set(ids, 'session'),
    ]);
  },
};

// ── actor-create ───────────────────────────────────────────────────────────

const actorCreate: Family = {
  id: 'actor-create',
  area: 'party',
  mode: 'write',
  title: '새 아군 액터 등록(이름·직업·레벨)',
  variants: [
    { key: 'lina-mage', prompt: '마도사 직업의 아군 「리나」를 새로 등록해줘.', args: { refId: 'actor_lina', name: '리나', classId: 'class_mage' } },
    { key: 'kai-thief-lv5', prompt: '도적 직업 아군 「카이」를 만들어 주세요. 시작 레벨은 5입니다.', args: { refId: 'actor_kai', name: '카이', classId: 'class_thief', initialLevel: 5 } },
    { key: 'mari-terse', prompt: '성직자 아군 「마리」 추가.', args: { refId: 'actor_mari', name: '마리', classId: 'class_cleric' } },
    { key: 'walter-maxlevel', prompt: '견습 기사 직업으로 「발터」라는 새 동료를 등록하고, 최대 레벨은 50으로 제한해 줘. 기존 동료는 그대로 두고.', args: { refId: 'actor_walter', name: '발터', classId: 'class_squire', maxLevel: 50 } },
    { key: 'ren-nickname', prompt: '검객 직업의 새 아군 「렌」을 만들고 별명을 「붉은 칼」로 해줘.', args: { refId: 'actor_ren', name: '렌', classId: 'class_swordsman', nickname: '붉은 칼' } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name');
    const added = newRows(input.before, input.after, 'actors');
    if (added.length !== 1) return fail('새 액터가 ' + added.length + '명이다(한 명이어야 한다)');
    const actor = added[0];
    if (String(actor.name ?? '').trim() !== name) return fail('이름이 「' + actor.name + '」 — 「' + name + '」 여야 한다');
    if (actor.classId !== args.classId) return fail('직업 ' + actor.classId + ' — ' + args.classId + ' 여야 한다');
    if (typeof args.initialLevel === 'number' && actor.initialLevel !== args.initialLevel) return fail('시작 레벨 ' + actor.initialLevel + ' — ' + args.initialLevel);
    if (typeof args.initialLevel !== 'number' && (actor.initialLevel ?? 1) !== 1) return fail('요청하지 않은 시작 레벨 ' + actor.initialLevel);
    if (typeof args.maxLevel === 'number' && actor.maxLevel !== args.maxLevel) return fail('최대 레벨 ' + actor.maxLevel + ' — ' + args.maxLevel);
    if (typeof args.maxLevel !== 'number' && actor.maxLevel !== 99) return fail('요청하지 않은 최대 레벨 ' + actor.maxLevel);
    if (typeof args.nickname === 'string' && actor.nickname !== args.nickname) return fail('별명 ' + actor.nickname + ' — ' + args.nickname);
    const moved = keepsRows(input.before, input.after, 'actors');
    if (moved) return fail(moved);
    return sameExcept(input.before, input.after, withoutRows('actors', [actor.id])) ? pass(actor.id + ' (' + name + ') 추가, 기존 액터 보존') : fail('액터 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    const actor: Record<string, unknown> = { id: strArg(args, 'refId'), name: strArg(args, 'name'), classId: strArg(args, 'classId') };
    for (const key of ['initialLevel', 'maxLevel', 'nickname']) if (args[key] !== undefined) actor[key] = args[key];
    return runOn(project, 'upsert_actor', { actor });
  },
  wrongs(project, args): FamilyOutcome[] {
    const refId = strArg(args, 'refId'), name = strArg(args, 'name'), classId = strArg(args, 'classId');
    const reference = actorCreate.reference!(clone(project), args) as Project;
    const make = (patch: Record<string, unknown>) => attempt(() => runOn(clone(project), 'upsert_actor', { actor: { id: refId, name, classId, ...(typeof args.initialLevel === 'number' ? { initialLevel: args.initialLevel } : {}), ...(typeof args.maxLevel === 'number' ? { maxLevel: args.maxLevel } : {}), ...(typeof args.nickname === 'string' ? { nickname: args.nickname } : {}), ...patch } }));
    return distinct(reference, [
      make({ classId: classId === 'class_mage' ? 'class_cleric' : 'class_mage' }),
      make({ name: name + ' 2호' }),
      // 기존 액터를 덮어써 새 아군 대신 마도사를 개명하는 오답
      attempt(() => runOn(clone(project), 'upsert_actor', { actor: { id: 'actor_mage', name, classId } })),
      typeof args.initialLevel === 'number' ? make({ initialLevel: 1 }) : make({ initialLevel: 7 }),
      typeof args.maxLevel === 'number' ? make({ maxLevel: 99 }) : undefined,
    ]);
  },
};

// ── class-create ───────────────────────────────────────────────────────────

type Learn = { level: number; skillId: string; name: string };

const classCreate: Family = {
  id: 'class-create',
  area: 'party',
  mode: 'write',
  title: '새 직업 등록(습득 기술 레벨)',
  variants: [
    { key: 'guide-two-skills', prompt: '「길잡이」라는 직업을 새로 만들어줘. 3레벨에 화염, 8레벨에 물대포를 배우게.', args: { refId: 'class_guide', name: '길잡이', learns: [{ level: 3, skillId: 'skill_fire', name: '화염' }, { level: 8, skillId: 'skill_water', name: '물대포' }] } },
    { key: 'duelist-one', prompt: '검술가 직업 「결투가」를 추가해 주세요. 1레벨부터 검격을 쓸 수 있습니다.', args: { refId: 'class_duelist', name: '결투가', learns: [{ level: 1, skillId: 'skill_sword_slash', name: '검격' }] } },
    { key: 'frost-terse', prompt: '직업 「서리술사」 추가. 5레벨 빙결.', args: { refId: 'class_frost', name: '서리술사', learns: [{ level: 5, skillId: 'skill_ice', name: '빙결' }] } },
    { key: 'storm-three', prompt: '「폭풍 사제」 직업을 만들어 줘. 2레벨 낙뢰, 6레벨 질풍참, 12레벨 성광 순서로 배워. 기존 직업은 건드리지 말고.', args: { refId: 'class_storm', name: '폭풍 사제', learns: [{ level: 2, skillId: 'skill_thunder', name: '낙뢰' }, { level: 6, skillId: 'skill_wind', name: '질풍참' }, { level: 12, skillId: 'skill_holy', name: '성광' }] } },
    { key: 'earth-late', prompt: '「대지 수호자」 직업이 필요해. 10레벨에 암석 파쇄를 배우게 해줘.', args: { refId: 'class_earthward', name: '대지 수호자', learns: [{ level: 10, skillId: 'skill_earth', name: '암석 파쇄' }] } },
  ],
  judge(input, args) {
    const name = strArg(args, 'name');
    const learns = args.learns as Learn[];
    const added = newRows(input.before, input.after, 'classes');
    if (added.length !== 1) return fail('새 직업이 ' + added.length + '개다(하나여야 한다)');
    const klass = added[0];
    if (String(klass.name ?? '').trim() !== name) return fail('이름이 「' + klass.name + '」 — 「' + name + '」 여야 한다');
    const got = ((klass.learnedSkills ?? []) as Array<{ level: number; skillId: string }>).map(entry => entry.level + ':' + entry.skillId).sort();
    const want = learns.map(entry => entry.level + ':' + entry.skillId).sort();
    if (!isDeepStrictEqual(got, want)) return fail('습득 기술 [' + got.join(',') + '] — [' + want.join(',') + '] 여야 한다');
    const moved = keepsRows(input.before, input.after, 'classes');
    if (moved) return fail(moved);
    return sameExcept(input.before, input.after, withoutRows('classes', [klass.id])) ? pass(klass.id + ' (' + name + ') 추가') : fail('직업 밖의 내용이 바뀌었다');
  },
  reference(project, args) {
    return runOn(project, 'upsert_class', { class: { id: strArg(args, 'refId'), name: strArg(args, 'name'), learnedSkills: (args.learns as Learn[]).map(entry => ({ level: entry.level, skillId: entry.skillId })) } });
  },
  wrongs(project, args): FamilyOutcome[] {
    const refId = strArg(args, 'refId'), name = strArg(args, 'name');
    const learns = args.learns as Learn[];
    const reference = classCreate.reference!(clone(project), args) as Project;
    const make = (list: Array<{ level: number; skillId: string }>, label = name, id = refId) => attempt(() => runOn(clone(project), 'upsert_class', { class: { id, name: label, learnedSkills: list } }));
    const plain = learns.map(entry => ({ level: entry.level, skillId: entry.skillId }));
    const first = plain[0]!;
    return distinct(reference, [
      make([{ ...first, level: first.level + 4 }, ...plain.slice(1)]),
      make([{ ...first, skillId: first.skillId === 'skill_attack' ? 'skill_fire' : 'skill_attack' }, ...plain.slice(1)]),
      plain.length > 1 ? make(plain.slice(0, -1)) : make([...plain, { level: 20, skillId: 'skill_dark' }]),
      make(plain, name + ' 개'),
      // 기존 직업을 덮어쓰는 오답
      make(plain, name, 'class_mage'),
    ]);
  },
};

export const GROUP_6B_PARTY: readonly Family[] = [companionAdd, partyStart, actorCreate, classCreate];
