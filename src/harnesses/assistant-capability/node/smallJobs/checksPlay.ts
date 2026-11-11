// 둘째 묶음의 판정 — 말을 걸거나 맵에 들어서 보아야 알 수 있는 것: 세이브·회복 지점, 보스전, 파티 합류, 조건(누구와 얘기한 뒤),
// 선택지, NPC 움직임, 한 번만 나오는 장면, 의뢰, 상점 물건. 엔진의 페이지 고르기·조건 평가로 따라간다(checkSupport.interact).
import { isDeepStrictEqual } from 'node:util';
import { listAudioResources } from '../../../../assets/audioResourceCatalog';
import { activePage, cellFree, eventOf, eventsOf, freshSession, hasSprite, includesPhrase, interact, itemIdsByName, newEvents, no, ok, pagesOf, passable, placeNote, playPaths, squash, triggerKinds, visibleAt, where,
  type CheckSpec, type Doc, type Ev, type Play, type Result } from './checkSupport';

const eventAt = (doc: Doc, ref: { mapId: string; eventId: string }): Ev | undefined => eventOf(doc, ref.mapId, ref.eventId);
const label = (event: Ev): string => event.name ?? event.id;
const sameSpot = (was: Ev | undefined, now: Ev): boolean => !was || (was.x === now.x && was.y === now.y);
/** 그 칸이나 네 이웃 칸 중 하나는 걸을 수 있다(조사하러 다가갈 수 있다). */
const approachable = (doc: Doc, mapId: string, event: Ev): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => passable(doc, mapId, event.x + dx!, event.y + dy!));
const startParty = (doc: Doc): string[] => [...(doc.session?.partyActorIds?.length ? doc.session.partyActorIds : doc.system?.startActorIds ?? [])];
/** 상점이 파는 물건 id(첫 말 걸기에서 열리는 상점들). */
function soldBy(doc: Doc, event: Ev): Set<string> {
  const shops = interact(event, freshSession(), doc).shops;
  return new Set<string>(shops.flatMap(shop => [...(shop.itemIds ?? []), ...(shop.equipmentIds ?? []), ...(shop.stock ?? []).map((entry: any) => entry?.itemId)]).filter(Boolean));
}
const troopMembers = (troop: any): string[] => (troop?.members?.length ? troop.members.map((member: any) => member.enemyId) : troop?.enemyIds) ?? [];
const BATTLE_BGM_COMMAND = 'm2-027-change-system-bgm';

export const PLAY_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  /** 세이브 포인트(service:'save') · 회복 지점(service:'heal'): 새로 놓은 보이는 이벤트를 조사하면 그 일이 일어난다 — 두 번째에도. */
  serviceSpot(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const does = (play: Play): boolean => (spec.service === 'save' ? play.ran.some(command => command.kind === 'openSaveMenu' || command.kind === 'checkpointSave') : play.recovered && play.gold === 0);
    const what = spec.service === 'save' ? '저장(저장 메뉴·체크포인트)' : '파티 전원 회복(공짜)';
    // 한 번 조사해서 그 일이 일어나는가 — 묻는 갈림(예/아니오·여관 질문)이 있으면 일어나는 길을 골라 실제로 밟는다.
    const happens = (event: Ev, session: any): boolean => {
      const path = playPaths(event, () => structuredClone(session), after).find(does);
      if (path) interact(event, session, after, { picks: path.picks });
      return !!path;
    };
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const session = Object.assign(freshSession(), { gold: 1000 });
      if (!happens(event, session)) { notes.push(`${label(event)}: 조사해도 ${what}이 일어나지 않는다`); continue; }
      if (!happens(event, session)) { notes.push(`${label(event)}: 두 번째로 조사하면 ${what}이 일어나지 않는다`); continue; }
      if (!triggerKinds(event).some(kind => ['action', 'playerTouch'].includes(kind))) { notes.push(`${label(event)}: 조사·접촉으로 열리지 않는다`); continue; }
      if (!visibleAt(after, mapId, event)) { notes.push(`${label(event)}: 그 칸에 보이는 것이 없다`); continue; }
      const bad = placeNote(spec, after, mapId, event) ?? (!approachable(after, mapId, event) ? `(${event.x},${event.y})에 다가갈 수 없다` : !cellFree(after, mapId, event) ? `(${event.x},${event.y})에 다른 이벤트` : null);
      if (bad) { notes.push(`${label(event)}: ${bad}`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — ${what}`);
    }
    return no(notes.join(' / '));
  },
  /** 대사 뒤에 시작되는 보스전: 새로 세운 보이는 이벤트에 말을 걸면 그 대사가 먼저 나오고 전투가 시작된다. 부대에 그 이름의 적이 있다. */
  bossFight(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const troops = new Map<string, any>((after.database?.troops ?? []).map((troop: any) => [troop.id, troop]));
    const enemies = new Map<string, any>((after.database?.enemies ?? []).map((enemy: any) => [enemy.id, enemy]));
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const ran = interact(event, freshSession(), after).ran;
      const fight = ran.findIndex(command => command.kind === 'battleProcessing');
      if (fight < 0) { notes.push(`${label(event)}: 말을 걸어도 전투가 시작되지 않는다`); continue; }
      const line = ran.findIndex(command => command.kind === 'text' && includesPhrase(command.body, spec.say));
      if (line < 0 || line > fight) { notes.push(`${label(event)}: 전투 전에 「${spec.say}」 대사가 나오지 않는다`); continue; }
      const troop = troops.get(ran[fight].troopId), members = troopMembers(troop);
      if (!troop || !members.length || members.some(id => !enemies.has(id))) { notes.push(`${label(event)}: 부대 ${ran[fight].troopId} 가 자료집에 없거나 적이 없다`); continue; }
      if (spec.enemyName && !members.some(id => String(enemies.get(id).name).includes(spec.enemyName))) { notes.push(`${label(event)}: 부대 「${troop.name}」(${members.map(id => enemies.get(id).name).join(',')})에 「${spec.enemyName}」가 없다`); continue; }
      if (!triggerKinds(event).some(kind => ['action', 'playerTouch', 'eventTouch'].includes(kind))) { notes.push(`${label(event)}: 말 걸기·접촉으로 열리지 않는다`); continue; }
      if (!hasSprite(event)) { notes.push(`${label(event)}: 보스 그림이 없다`); continue; }
      if (!passable(after, mapId, event.x, event.y) || !cellFree(after, mapId, event)) { notes.push(`${label(event)}: 선 칸 (${event.x},${event.y})이 막혔거나 겹친다`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — 「${spec.say}」 뒤 ${troop.name}`);
    }
    return no(notes.join(' / '));
  },
  /** 그 전투만 다른 곡: 있던 이벤트의 전투 바로 앞에서 전투 곡을 곡 목록의 다른 곡으로 바꾼다. 전투와 이긴 뒤 진행은 그대로. given.switches = 그 페이지가 열리는 상태. */
  battleMusic(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const given = (): any => Object.assign(freshSession(), { switches: { ...(spec.given?.switches ?? {}) } });
    const old = interact(was, given(), before).ran, ran = interact(now, given(), after).ran;
    const oldFight = old.find(command => command.kind === 'battleProcessing'), fight = ran.findIndex(command => command.kind === 'battleProcessing');
    if (!oldFight) return no('픽스처의 그 이벤트에 전투가 없다');
    if (fight < 0) return no(`${label(now)}: 전투가 사라졌다`);
    if (ran[fight].troopId !== oldFight.troopId || !isDeepStrictEqual(ran[fight].victoryBranch, oldFight.victoryBranch)) return no(`${label(now)}: 전투 상대나 이긴 뒤의 진행이 바뀌었다`);
    const music = new Set(listAudioResources('music', after as never).map(track => track.id));
    const usual = after.maps?.[spec.mapId]?.battleBgmResourceId ?? after.system?.battleBgmResourceId;
    const cue = ran.slice(0, fight).filter(command => command.kind === 'm2Command' && command.commandId === BATTLE_BGM_COMMAND && command.fields?.cue === 'battle' && command.fields?.operation !== 'reset').at(-1);
    if (!cue) return no(`${label(now)}: 전투 앞에 전투 곡을 바꾸는 명령이 없다`);
    const track = String(cue.fields?.resourceId ?? '');
    if (!music.has(track)) return no(`${label(now)}: 전투 곡 ${track || '(없음)'} 는 곡 목록에 없는 id 다`);
    if (track === usual) return no(`${label(now)}: 바꾼 곡이 보통 전투 곡(${usual})과 같다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 전투 앞에서 전투 곡 → ${track}`);
  },
  /** 말을 걸면 파티에 들어온다: 있던 사람에게 처음 말을 걸면 자료집에 있는(시작 파티가 아닌) 배우 하나가 파티에 더해진다. */
  joinsParty(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const party = startParty(after), session = Object.assign(freshSession(), { partyActorIds: [...party] });
    const play = interact(now, session, after);
    const joined = [...new Set(play.ran.filter(command => command.kind === 'changeParty' && command.action === 'add').map(command => String(command.actorId)))];
    if (!joined.length) return no(`${label(now)}: 말을 걸어도 파티에 아무도 들어오지 않는다${play.ran.some(command => command.kind === 'addFollower') ? '(뒤따르는 모습만 붙었다 — 파티원이 아니다)' : ''}`);
    if (joined.length > 1) return no(`${label(now)}: 한 번에 ${joined.length}명이 들어온다`);
    const actor = (after.database?.actors ?? []).find((row: any) => row.id === joined[0]);
    if (!actor) return no(`${label(now)}: 배우 ${joined[0]} 가 자료집에 없다`);
    if (party.includes(joined[0]!)) return no(`${label(now)}: ${actor.name} 은(는) 이미 시작 파티에 있다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    const after2 = activePage(now, session);
    const stays = !!after2 && !!after2.page.graphic && !after2.page.graphic.transparent;
    return ok(`${label(now)} → 파티에 ${actor.name}(${actor.id})${stays ? ' · 합류 뒤에도 그 자리에 서 있다' : ''}`);
  },
  /**
   * 누구와 먼저 얘기한 뒤에만: then 에게 먼저 말을 걸면 say 가 안 나오고(keep·sayBefore 는 나오고, noShopBefore 면 상점도 안 열리고),
   * first 와 얘기한 다음에는 say 가 나온다(shopAfter 면 상점이 열린다).
   */
  talkGated(spec, before, after) {
    const first = eventAt(after, spec.first), then = eventAt(after, spec.then);
    if (!first || !then) return no(`${!first ? spec.first.eventId : spec.then.eventId} 가 없다`);
    const session = freshSession();
    const early = interact(then, session, after);
    const said = (play: Play, phrase: string): boolean => play.texts.some(body => includesPhrase(body, phrase));
    if (spec.say && said(early, spec.say)) return no(`${label(first)}와 얘기하기 전인데 ${label(then)} 이(가) 「${spec.say}」라고 한다`);
    if (spec.keep && !said(early, spec.keep)) return no(`얘기하기 전의 옛 대사 「${spec.keep}」가 사라졌다`);
    if (spec.sayBefore && !said(early, spec.sayBefore)) return no(`얘기하기 전에 ${label(then)} 이(가) 「${spec.sayBefore}」라고 하지 않는다`);
    if (spec.noShopBefore && early.shops.length) return no(`${label(first)}와 얘기하기 전인데 ${label(then)}의 상점이 열린다`);
    const talk = interact(first, session, after);
    if (!talk.texts.length) return no(`${label(first)} 이(가) 아무 말도 하지 않는다`);
    if (spec.firstKeeps && !said(talk, spec.firstKeeps)) return no(`${label(first)}의 원래 대사 「${spec.firstKeeps}」가 사라졌다`);
    const late = interact(then, session, after);
    if (spec.say && !said(late, spec.say)) return no(`${label(first)}와 얘기한 뒤에도 ${label(then)} 이(가) 「${spec.say}」라고 하지 않는다 — 지금: ${late.texts.join(' | ').slice(0, 100)}`);
    if (spec.shopAfter && !late.shops.length) return no(`${label(first)}와 얘기한 뒤에도 ${label(then)}의 상점이 열리지 않는다`);
    if (spec.sayBefore && said(late, spec.sayBefore)) return no(`${label(first)}와 얘기한 뒤에도 ${label(then)} 이(가) 「${spec.sayBefore}」라고 한다`);
    if (!sameSpot(eventAt(before, spec.first), first) || !sameSpot(eventAt(before, spec.then), then)) return no('자리가 바뀌었다');
    return ok(`${label(first)}와 얘기한 뒤 ${label(then)}: ${spec.say ? `「${spec.say}」` : '상점이 열린다'}`);
  },
  /** 돈을 내고 회복: 새로 세운 사람에게 말을 걸면 갈림이 있고, 한 길은 정확히 price 를 내고 전원 회복, 다른 길은 아무 일도 없다. 공짜 회복·돈만 받는 길은 없어야 한다. */
  paidHeal(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const paths = playPaths(event, () => Object.assign(freshSession(), { gold: 1000 }), after);
      if (!paths.some(path => path.arity.length)) { notes.push(`${label(event)}: 고를 것(선택지·여관 질문)이 없다`); continue; }
      const pay = paths.filter(path => path.recovered && path.gold === -spec.price), skip = paths.filter(path => !path.recovered && path.gold === 0);
      const free = paths.filter(path => path.recovered && path.gold !== -spec.price), robbed = paths.filter(path => !path.recovered && path.gold !== 0);
      if (free.length) { notes.push(`${label(event)}: 「${free[0]!.picked.join(' → ')}」를 고르면 ${-free[0]!.gold}G 로 회복된다 — ${spec.price}G 여야 한다`); continue; }
      if (robbed.length) { notes.push(`${label(event)}: 「${robbed[0]!.picked.join(' → ')}」를 고르면 돈만 ${-robbed[0]!.gold}G 나가고 회복되지 않는다`); continue; }
      if (!pay.length) { notes.push(`${label(event)}: ${spec.price}G 를 내고 회복되는 길이 없다`); continue; }
      if (!skip.length) { notes.push(`${label(event)}: 거절하는 길이 없다(말을 걸면 무조건 돈을 낸다)`); continue; }
      if (!hasSprite(event)) { notes.push(`${label(event)}: 사람 그림이 없다`); continue; }
      if (!triggerKinds(event).includes('action')) { notes.push(`${label(event)}: 말 걸기로 열리지 않는다`); continue; }
      if (!passable(after, mapId, event.x, event.y) || !cellFree(after, mapId, event)) { notes.push(`${label(event)}: 선 칸 (${event.x},${event.y})이 막혔거나 겹친다`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — 「${pay[0]!.picked.join(' → ')}」 ${spec.price}G 회복 · 「${skip[0]!.picked.join(' → ')}」 그냥 끝`);
    }
    return no(notes.join(' / '));
  },
  /** 선택지와 갈래별 대답: 있던 사람에게 말을 걸면 ask 를 묻고, options 의 label 을 고르면 그 say 가 나온다(다른 갈래의 대답은 안 나온다). */
  choiceBranches(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const wanted: Array<{ label: string; say: string }> = spec.options;
    const paths = playPaths(now, freshSession, after);
    if (!paths.some(path => path.picked.length)) return no(`${label(now)}: 말을 걸어도 선택지가 나오지 않는다`);
    if (spec.ask && !paths.some(path => [...path.texts, ...path.prompts].some(body => includesPhrase(body, spec.ask)))) return no(`${label(now)}: 「${spec.ask}」라고 묻지 않는다`);
    // 고른 글이 어느 label 인가: 그 글에 든 label 중 가장 긴 것(「안 본다」는 「본다」가 아니다).
    const labelOf = (text: string): string | undefined => wanted.map(option => option.label).filter(name => squash(text).includes(squash(name))).sort((a, b) => squash(b).length - squash(a).length)[0];
    for (const option of wanted) {
      const mine = paths.filter(path => path.picked.some(text => labelOf(text) === option.label));
      if (!mine.length) return no(`${label(now)}: 「${option.label}」 선택지가 없다 — 지금: ${[...new Set(paths.flatMap(path => path.picked))].join(' / ').slice(0, 100)}`);
      const good = mine.find(path => path.texts.some(body => includesPhrase(body, option.say)) && !wanted.some(other => other !== option && path.texts.some(body => includesPhrase(body, other.say))));
      if (!good) return no(`${label(now)}: 「${option.label}」를 고르면 「${option.say}」만 나와야 한다 — 지금: ${mine[0]!.texts.join(' | ').slice(0, 120)}`);
    }
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: ${wanted.map(option => `「${option.label}」→「${option.say}」`).join(' · ')}`);
  },
  /** NPC 움직임: want 'moving' = 처음 상태의 페이지가 제자리가 아니다(돌아다닌다) · 'fixed' = 모든 페이지가 제자리. 대사는 그대로. */
  npcMovement(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const typeOf = (page: any): string => page?.movement?.type ?? 'fixed';
    const moves = (page: any): boolean => (typeOf(page) === 'custom' ? (page.movement.route?.moves?.length ?? 0) > 0 : typeOf(page) !== 'fixed');
    if (spec.want === 'moving') {
      const page = activePage(now, freshSession())?.page;
      if (!moves(page)) return no(`${label(now)}: 처음 상태의 움직임이 ${typeOf(page)} — 돌아다니지 않는다`);
    } else {
      const moving = pagesOf(now).map((page, index) => ({ index, type: typeOf(page) })).filter(entry => entry.type !== 'fixed');
      if (moving.length) return no(`${label(now)}: 페이지 ${moving.map(entry => `${entry.index}(${entry.type})`).join(', ')} 가 아직 돌아다닌다`);
    }
    if (!isDeepStrictEqual(pagesOf(was).map(page => page.commands), pagesOf(now).map(page => page.commands))) return no('움직임을 바꾸면서 대사·명령이 바뀌었다');
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 움직임 ${pagesOf(now).map(typeOf).join(',')}`);
  },
  /** 맵에 들어서면 한 번만 나오는 장면: 저절로 도는(자동·병렬) 이벤트가 처음에 say 를 내고(moves 면 그 이벤트를 움직이고), 다시 들어오면 내지 않는다. */
  onEnterOnce(spec, _before, after) {
    const notes: string[] = [];
    for (const event of eventsOf(after, spec.mapId)) {
      const session = freshSession(), active = activePage(event, session);
      if (!active || !['auto', 'parallel'].includes(active.trigger)) continue;
      const play = interact(event, session, after);
      if (!play.texts.some(body => includesPhrase(body, spec.say))) continue;
      if (spec.moves && !play.ran.some(command => command.kind === 'moveEvent' && command.eventId === spec.moves && (command.route?.moves?.length ?? 0) > 0)) { notes.push(`${label(event)}: 「${spec.say}」는 나오지만 ${spec.moves} 를 움직이지 않는다`); continue; }
      const again = activePage(event, session);
      if (again && ['auto', 'parallel'].includes(again.trigger) && interact(event, session, after).texts.some(body => includesPhrase(body, spec.say))) { notes.push(`${label(event)}: 맵에 다시 들어오면 「${spec.say}」가 또 나온다(한 번만이어야 한다)`); continue; }
      return ok(`${label(event)} @ ${where(after, spec.mapId, event)} — 들어서면 한 번 「${spec.say}」`);
    }
    return no(notes.join(' / ') || `맵에 들어서면 저절로 「${spec.say}」를 내는 이벤트가 없다`);
  },
  /** 의뢰: 퀘스트 목록에 그 제목이 새로 있고, 의뢰인 → 단계 대상들 → 의뢰인 순서로 말을 걸면 보상이 정확히 한 번 나온다. */
  questFlow(spec, before, after) {
    const had = new Set((before.quests ?? []).map((quest: any) => quest.key ?? quest.id));
    const listed = (after.quests ?? []).find((quest: any) => !had.has(quest.key ?? quest.id) && includesPhrase(quest.title, spec.title));
    if (!listed) return no(`퀘스트 목록에 「${spec.title}」가 없다 — 지금: ${(after.quests ?? []).map((quest: any) => quest.title).join(', ') || '없음'}`);
    const giver = eventAt(after, spec.giver);
    if (!giver) return no(`의뢰인 ${spec.giver.eventId} 가 없다`);
    const session = freshSession();
    const offer = interact(giver, session, after);
    if (offer.gold !== 0) return no(`${label(giver)}: 의뢰를 받기도 전에 ${offer.gold}G 를 준다`);
    for (const step of spec.steps as Array<{ mapId: string; eventId: string }>) {
      const target = eventAt(after, step);
      if (!target) return no(`단계 대상 ${step.eventId} 가 없다`);
      interact(target, session, after);
    }
    const report = interact(giver, session, after), again = interact(giver, session, after);
    if (report.gold !== spec.reward.gold) return no(`${label(giver)}에게 돌아가면 ${report.gold}G — 기대 ${spec.reward.gold}G(의뢰를 받고 단계를 마친 뒤)`);
    if (again.gold !== 0) return no(`${label(giver)}에게 다시 말을 걸면 보상을 또 준다(${again.gold}G)`);
    if (!sameSpot(eventAt(before, spec.giver), giver)) return no('의뢰인의 자리가 바뀌었다');
    return ok(`「${listed.title}」 — ${label(giver)}에게 받고 돌아가면 ${report.gold}G, 한 번만`);
  },
  /** 상점 물건 넣고 빼기: 있던 상점이 파는 물건 = 전에 팔던 것 + adds − removes(이름). */
  shopStock(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const old = soldBy(before, was), sold = soldBy(after, now);
    if (!old.size) return no('픽스처의 그 이벤트가 상점이 아니다');
    if (!sold.size) return no(`${label(now)}: 말을 걸어도 상점이 열리지 않는다`);
    const names = new Map<string, string>([...(after.database?.items ?? []), ...(after.database?.equipment ?? [])].map((row: any) => [row.id, row.name]));
    const expected = new Set(old);
    for (const name of (spec.adds ?? []) as string[]) {
      const ids = [...itemIdsByName(after, name), ...(after.database?.equipment ?? []).filter((row: any) => row.name === name).map((row: any) => row.id)].filter(id => sold.has(id));
      if (!ids.length) return no(`${label(now)}: 「${name}」을(를) 팔지 않는다`);
      for (const id of ids) expected.add(id);
    }
    for (const name of (spec.removes ?? []) as string[]) {
      const ids = itemIdsByName(before, name);
      if (ids.some(id => sold.has(id))) return no(`${label(now)}: 「${name}」을(를) 아직 판다`);
      for (const id of ids) expected.delete(id);
    }
    const lost = [...expected].filter(id => !sold.has(id)), extra = [...sold].filter(id => !expected.has(id));
    if (lost.length) return no(`${label(now)}: 전에 팔던 ${lost.map(id => names.get(id) ?? id).join(', ')} 이(가) 빠졌다`);
    if (extra.length) return no(`${label(now)}: 시키지 않은 ${extra.map(id => names.get(id) ?? id).join(', ')} 을(를) 더 판다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 파는 물건 ${[...sold].map(id => names.get(id) ?? id).join(', ')}`);
  },
};

/** 요청 자체가 건드리는 맵 밖 칸(부수 변경으로 세지 않는다). */
export const PLAY_SIDE: Record<string, RegExp> = {
  bossFight: /^(switches|database\.(troops|enemies))$/u,
  joinsParty: /^(switches|database\.(actors|characterAppearances)|system\.peopleChipLock)$/u,
  talkGated: /^switches$/u,
  paidHeal: /^(system\.peopleChipLock|database\.characterAppearances)$/u,
  onEnterOnce: /^switches$/u,
  questFlow: /^(quests|switches|variables|storyFlags)$/u,
};
