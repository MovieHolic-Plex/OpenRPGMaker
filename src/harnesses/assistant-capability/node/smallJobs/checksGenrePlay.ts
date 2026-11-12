// 셋째 묶음의 판정 — 말을 걸어 길마다 따라가야 아는 장치: 증거 내밀기, 범인 지목·엔딩 갈래, 다 모아야 열리는 말, 쌓이는 호감, 선물, 고백 엔딩,
// 기한 엔딩, 체력 게이지, 시간대마다 다른 말, 자면 다음 날, 처음 고르는 몬스터, 암호, 잠긴 문, 제한 시간, 통행료, 얘기한 사람 수로 갈리는 엔딩.
// 값을 어디에 쌓는지(변수·호감도)는 묻지 않는다 — 말을 걸 때마다 무엇이든 하나가 그만큼 움직이면 된다.
import { entryRuns } from './checksData';
import { approachable, label, startSession } from './checksGenre';
import { activePage, cellFree, eventOf, eventsOf, freshSession, includesPhrase, interact, itemIdsByName, newEvents, no, ok, passable, playPaths, squash, visibleAt, where,
  type CheckSpec, type Doc, type Ev, type Play, type Result } from './checkSupport';

const said = (play: Play, phrase: string): boolean => play.texts.some(body => includesPhrase(body, phrase));
const sameSpot = (was: Ev | undefined, now: Ev): boolean => !was || (was.x === now.x && was.y === now.y);
const heard = (play: Play): string => play.texts.join(' | ').slice(0, 110) || '(말 없음)';
/** 쌓이는 값이 있을 수 있는 자리 전부(변수 + 호감도)를 한 표로. */
const stores = (session: any): Record<string, number> => ({ ...Object.fromEntries(Object.entries<any>(session.variables ?? {}).map(([key, value]) => [`var:${key}`, Number(value) || 0])), ...Object.fromEntries(Object.entries<any>(session.friendship ?? {}).map(([key, value]) => [`friend:${key}`, Number(value) || 0])) });
/** 두 상태 사이에 값이 바뀐 자리와 그 차이. */
function gains(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) { const delta = (after[key] ?? 0) - (before[key] ?? 0); if (delta) out[key] = delta; }
  return out;
}
const endingOf = (doc: Doc, play: Play): any | undefined => (play.ended?.kind === 'ending' ? (doc.endings ?? []).find((ending: any) => ending.id === play.ended!.endingId) : undefined);
const endingNamed = (doc: Doc, play: Play, title: string): boolean => includesPhrase(endingOf(doc, play)?.name, title);
const endNote = (doc: Doc, play: Play): string => (play.ended ? (play.ended.kind === 'gameOver' ? '게임 오버' : `엔딩 「${endingOf(doc, play)?.name ?? play.ended.endingId ?? '없는 엔딩'}」`) : '엔딩 없음');
const count = (session: any, ids: string[]): number => ids.reduce((sum, id) => sum + (session.inventory[id] ?? 0), 0);

export const GENRE_PLAY_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  /** 증거 내밀기: 가진 물건 가운데 골라 내민다 — item 을 내밀면 say, other 를 내밀면 otherSay(say 는 안 나온다). 내밀 것이 없으면 keep(옛 대사). */
  presentReacts(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const itemIds = itemIdsByName(after, spec.item), otherIds = itemIdsByName(after, spec.other);
    if (!itemIds.length || !otherIds.length) return no(`자료집에 「${!itemIds.length ? spec.item : spec.other}」 아이템이 없다`);
    const both = playPaths(now, () => freshSession({ [itemIds[0]!]: 1, [otherIds[0]!]: 1 }), after);
    if (!both.some(path => path.presented.length)) return no(`${label(now)}: 가진 물건을 골라 내밀 수 없다(presentItem 없음)`);
    const right = both.filter(path => path.presented.some(id => itemIds.includes(id)));
    if (!right.some(path => said(path, spec.say))) return no(`${label(now)}: 「${spec.item}」을 내밀어도 「${spec.say}」가 나오지 않는다 — 지금: ${heard(right[0] ?? both[0]!)}`);
    const wrong = both.filter(path => path.presented.length && path.presented.every(id => otherIds.includes(id)));
    if (wrong.some(path => said(path, spec.say))) return no(`${label(now)}: 「${spec.other}」을 내밀어도 「${spec.say}」가 나온다`);
    if (!wrong.some(path => said(path, spec.otherSay))) return no(`${label(now)}: 「${spec.other}」을 내밀면 「${spec.otherSay}」가 나와야 한다 — 지금: ${heard(wrong[0] ?? both[0]!)}`);
    const none = playPaths(now, freshSession, after);
    if (none.some(path => said(path, spec.say))) return no(`${label(now)}: 아무것도 없는데 「${spec.say}」가 나온다`);
    if (spec.keep && !none.some(path => said(path, spec.keep))) return no(`${label(now)}: 원래 대사 「${spec.keep}」가 사라졌다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 「${spec.item}」→「${spec.say}」 · 「${spec.other}」→「${spec.otherSay}」`);
  },
  /** 선택지마다 다른 끝: options 의 label 을 고르면 ending(그 이름의 엔딩이 열린다) 또는 say(그 글만 나오고 엔딩은 없다). 엔딩은 서로 달라야 한다. */
  choiceEndings(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const wanted: Array<{ label: string; ending?: string; say?: string }> = spec.options;
    const paths = playPaths(now, freshSession, after, { halt: true });
    if (!paths.some(path => path.picked.length)) return no(`${label(now)}: 말을 걸어도 선택지가 나오지 않는다`);
    if (spec.ask && !paths.some(path => [...path.texts, ...path.prompts].some(body => includesPhrase(body, spec.ask)))) return no(`${label(now)}: 「${spec.ask}」라고 묻지 않는다`);
    const labelOf = (text: string): string | undefined => wanted.map(option => option.label).filter(name => squash(text).includes(squash(name))).sort((a, b) => squash(b).length - squash(a).length)[0];
    const seen = new Set<string>();
    for (const option of wanted) {
      const mine = paths.filter(path => path.picked.some(text => labelOf(text) === option.label));
      if (!mine.length) return no(`${label(now)}: 「${option.label}」 선택지가 없다 — 지금: ${[...new Set(paths.flatMap(path => path.picked))].join(' / ').slice(0, 100)}`);
      if (option.ending) {
        const good = mine.find(path => endingNamed(after, path, option.ending!));
        if (!good) return no(`${label(now)}: 「${option.label}」를 고르면 엔딩 「${option.ending}」이 나와야 한다 — 지금: ${endNote(after, mine[0]!)}`);
        if (seen.has(good.ended!.endingId!)) return no(`${label(now)}: 서로 다른 선택이 같은 엔딩으로 간다`);
        seen.add(good.ended!.endingId!);
      } else {
        if (mine.some(path => path.ended)) return no(`${label(now)}: 「${option.label}」를 골랐는데 ${endNote(after, mine.find(path => path.ended)!)} 이(가) 나온다`);
        if (option.say && !mine.some(path => said(path, option.say!))) return no(`${label(now)}: 「${option.label}」를 고르면 「${option.say}」가 나와야 한다 — 지금: ${heard(mine[0]!)}`);
      }
    }
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: ${wanted.map(option => `「${option.label}」→${option.ending ? `엔딩 「${option.ending}」` : `「${option.say}」`}`).join(' · ')}`);
  },
  /** 다 모아야 열리는 말: items 를 전부 가졌을 때만 say, 하나라도 없으면 keep(옛 대사). */
  itemsGatedText(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const ids = (spec.items as string[]).map(name => ({ name, id: itemIdsByName(after, name)[0] }));
    const missing = ids.filter(item => !item.id).map(item => item.name);
    if (missing.length) return no(`자료집에 아이템 「${missing.join('」「')}」이 없다`);
    const talk = (held: string[]): Play => interact(now, freshSession(Object.fromEntries(held.map(id => [id, 1]))), after);
    const all = talk(ids.map(item => item.id!));
    if (!said(all, spec.say)) return no(`${label(now)}: 셋을 다 가져도 「${spec.say}」가 나오지 않는다 — 지금: ${heard(all)}`);
    for (const lacking of ids) {
      const play = talk(ids.filter(item => item !== lacking).map(item => item.id!));
      if (said(play, spec.say)) return no(`${label(now)}: 「${lacking.name}」이 없는데도 「${spec.say}」가 나온다`);
      if (spec.keep && !said(play, spec.keep)) return no(`${label(now)}: 다 모으기 전의 옛 대사 「${spec.keep}」가 사라졌다`);
    }
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: ${ids.map(item => item.name).join('·')} 를 다 가지면 「${spec.say}」`);
  },
  /** 쌓이는 호감: 말을 걸 때마다 값 하나가 1씩 오르고, threshold 에 닿기 전에는 say 가 안 나오며 넘은 뒤에는 나온다. */
  affectionLine(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const session = startSession(after), threshold: number = spec.threshold;
    let rising = null as Set<string> | null;
    for (let talk = 1; talk <= threshold + 1; talk++) {
      const held = stores(session), play = interact(now, session, after), up = gains(held, stores(session));
      const plus = new Set(Object.keys(up).filter(key => up[key] === 1));
      if (talk <= threshold) rising = rising ? new Set([...rising].filter(key => plus.has(key))) : plus;
      const says = said(play, spec.say);
      if (talk < threshold && says) return no(`${label(now)}: ${talk}번째 말 걸기에 벌써 「${spec.say}」가 나온다(호감 ${threshold} 이상이어야 한다)`);
      if (talk === 1 && spec.keep && !said(play, spec.keep)) return no(`${label(now)}: 원래 대사 「${spec.keep}」가 사라졌다`);
      if (talk === threshold + 1 && !says) return no(`${label(now)}: ${threshold}번 말을 건 뒤에도 「${spec.say}」가 나오지 않는다 — 지금: ${heard(play)}`);
    }
    if (!rising?.size) return no(`${label(now)}: 말을 걸 때마다 1씩 오르는 값(변수·호감도)이 없다 — 횟수 스위치로 흉내 낸 것은 호감도가 아니다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 말을 걸 때마다 ${[...rising][0]} +1 · ${threshold} 이상이면 「${spec.say}」`);
  },
  /** 선물: 그 아이템을 건네는 길이 있고(하나 줄고 gain 만큼 값이 오르며 say), 건네지 않는 길도 있다. 아이템이 없으면 아무 일도 없다. */
  giftReacts(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const ids = itemIdsByName(after, spec.item);
    if (!ids.length) return no(`자료집에 「${spec.item}」 아이템이 없다`);
    const start = (inventory: Record<string, number>) => () => startSession(after, { inventory: { ...inventory } });
    const base = stores(startSession(after));
    const rose = (path: Play): boolean => Object.values(gains(base, stores(path.session))).includes(spec.gain);
    const paths = playPaths(now, start({ [ids[0]!]: 2 }), after);
    const gave = paths.filter(path => count(path.session, ids) === 1);
    if (!gave.length) return no(`${label(now)}: 「${spec.item}」을 하나 건네는 길이 없다`);
    if (!gave.some(path => said(path, spec.say))) return no(`${label(now)}: 건네도 「${spec.say}」가 나오지 않는다 — 지금: ${heard(gave[0]!)}`);
    if (!gave.some(path => said(path, spec.say) && rose(path))) return no(`${label(now)}: 건네도 호감이 ${spec.gain} 오르지 않는다`);
    if (!paths.some(path => count(path.session, ids) === 2 && !said(path, spec.say))) return no(`${label(now)}: 건네지 않는 길이 없다(말을 걸면 무조건 가져간다)`);
    const none = playPaths(now, start({}), after);
    if (none.some(path => said(path, spec.say) || Object.keys(gains(base, stores(path.session))).length)) return no(`${label(now)}: 「${spec.item}」이 없는데도 선물한 것처럼 된다`);
    if (spec.keep && !none.some(path => said(path, spec.keep))) return no(`${label(now)}: 원래 대사 「${spec.keep}」가 사라졌다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 「${spec.item}」을 건네면 −1 · 호감 +${spec.gain} · 「${spec.say}」`);
  },
  /** 호감이 차야 되는 고백: 처음에 confess 를 고르면 refuse 만 나오고, 말을 threshold 번 건 뒤에 고르면 그 이름의 엔딩. */
  affectionEnding(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const confesses = (path: Play): boolean => path.picked.some(text => squash(text).includes(squash(spec.confess)));
    const session = startSession(after);
    const tries = (): Play[] => playPaths(now, () => structuredClone(session), after, { halt: true });
    const early = tries().filter(confesses);
    if (!early.length) return no(`${label(now)}: 「${spec.confess}」 선택지가 없다`);
    if (early.some(path => path.ended)) return no(`${label(now)}: 호감을 쌓기 전에 「${spec.confess}」를 골랐는데 ${endNote(after, early.find(path => path.ended)!)} 이(가) 나온다`);
    if (!early.some(path => said(path, spec.refuse))) return no(`${label(now)}: 일찍 고백하면 「${spec.refuse}」가 나와야 한다 — 지금: ${heard(early[0]!)}`);
    // 고백이 아닌 길 가운데 값이 가장 많이 오르는 길로 threshold 번 말을 건다.
    for (let talk = 0; talk < spec.threshold; talk++) {
      const held = stores(session);
      const quiet = tries().filter(path => !confesses(path) && !path.ended);
      const best = quiet.sort((a, b) => Math.max(0, ...Object.values(gains(held, stores(b.session)))) - Math.max(0, ...Object.values(gains(held, stores(a.session)))))[0];
      if (!best) return no(`${label(now)}: 고백하지 않고 말만 거는 길이 없다`);
      interact(now, session, after, { picks: best.picks });
    }
    const late = tries().filter(confesses);
    if (!late.some(path => endingNamed(after, path, spec.ending))) return no(`${label(now)}: ${spec.threshold}번 말을 건 뒤 「${spec.confess}」를 골라도 엔딩 「${spec.ending}」이 나오지 않는다 — 지금: ${endNote(after, late[0] ?? early[0]!)}`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 일찍 고백하면 「${spec.refuse}」, ${spec.threshold}번 얘기한 뒤에는 엔딩 「${spec.ending}」`);
  },
  /** 기한 엔딩: 시간이 흐르고, 하루가 끝날 때 도는 공통 이벤트가 days 번째 날에(그 전에는 아니고) 그 이름의 엔딩을 연다. */
  deadlineEnding(spec, _before, after) {
    const time = after.system?.timeSystem;
    if (!time?.enabled) return no('시간 시스템이 꺼져 있다 — 날이 지나가지 않는다');
    const common = (after.commonEvents ?? []).find((entry: any) => entry.id === time.onDayEnd);
    if (!common) return no(`하루가 끝날 때 도는 공통 이벤트(timeSystem.onDayEnd)가 없다(${time.onDayEnd ?? '비었음'})`);
    const session = startSession(after), host: Ev = { id: `__day_end_${common.id}`, x: 0, y: 0, commands: common.commands ?? [] };
    for (let day = 1; day <= spec.days; day++) {
      const play = interact(host, session, after, { halt: true });
      if (day < spec.days && play.ended) return no(`${day}일째 끝에 벌써 ${endNote(after, play)} 이(가) 나온다 — ${spec.days}일째여야 한다`);
      if (day === spec.days && !endingNamed(after, play, spec.ending)) return no(`${spec.days}일째 끝에 엔딩 「${spec.ending}」이 나오지 않는다 — 지금: ${endNote(after, play)}`);
    }
    return ok(`${spec.days}일째 하루가 끝나면 엔딩 「${spec.ending}」`);
  },
  /** 체력 게이지: 새로 놓은 보이는 것을 건드릴 때마다 변수 하나가 max 에서 1씩 줄고, 0 이 되는 순간 게임이 끝난다. 그 변수가 화면(HUD)에 보인다. */
  lifeGauge(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const widgets: any[] = (after.system?.fieldHud?.widgets ?? []).filter((widget: any) => widget.enabled !== false && widget.variableId);
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const session = startSession(after), full = { ...session.variables };
      const life = Object.keys(full).filter(id => full[id] === spec.max);
      let alive = new Set(life), early: string | null = null, last: Play | null = null;
      for (let hit = 1; hit <= spec.max; hit++) {
        last = interact(event, session, after, { halt: true });
        alive = new Set([...alive].filter(id => session.variables[id] === spec.max - hit));
        if (hit < spec.max && last.ended) { early = `${hit}번째에 벌써 ${endNote(after, last)}`; break; }
      }
      if (early) { notes.push(`${label(event)}: ${early}`); continue; }
      if (!alive.size) { notes.push(`${label(event)}: 건드릴 때마다 ${spec.max} 에서 1씩 줄어드는 변수가 없다`); continue; }
      if (!last?.ended) { notes.push(`${label(event)}: ${spec.max}번째(0장)에도 게임이 끝나지 않는다`); continue; }
      if (!widgets.some(widget => alive.has(widget.variableId))) { notes.push(`${label(event)}: 그 변수(${[...alive][0]})가 화면(HUD)에 보이지 않는다`); continue; }
      if (!['action', 'playerTouch', 'touch'].includes(activePage(event, freshSession())?.trigger ?? '')) { notes.push(`${label(event)}: 조사·접촉으로 발동하지 않는다`); continue; }
      if (!visibleAt(after, mapId, event) || !approachable(after, mapId, event)) { notes.push(`${label(event)}: 보이지 않거나 다가갈 수 없다`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — ${[...alive][0]} ${spec.max}→0, 0 이면 ${endNote(after, last)}`);
    }
    return no(notes.join(' / '));
  },
  /** 시간대마다 다른 말: 시간이 흐르고, 그 시간대(phase)에만 say 가 나오며 다른 시간대에는 keep(옛 대사)이 나온다. */
  timePhaseLine(spec, before, after) {
    if (!after.system?.timeSystem?.enabled) return no('시간 시스템이 꺼져 있다 — 밤낮이 없다');
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const hours: Record<string, number> = { morning: 7, day: 12, evening: 18, night: 23 };
    const at = (phase: string): Play => interact(now, Object.assign(freshSession(), { gameTime: { minute: 0, hour: hours[phase]!, day: 1, season: 'spring', year: 1 } }), after);
    if (!said(at(spec.phase), spec.say)) return no(`${label(now)}: ${spec.phase} 에 「${spec.say}」가 나오지 않는다 — 지금: ${heard(at(spec.phase))}`);
    for (const phase of Object.keys(hours).filter(key => key !== spec.phase)) {
      const play = at(phase);
      if (said(play, spec.say)) return no(`${label(now)}: ${phase} 에도 「${spec.say}」가 나온다`);
      if (spec.keep && !said(play, spec.keep)) return no(`${label(now)}: ${phase} 의 원래 대사 「${spec.keep}」가 사라졌다`);
    }
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: ${spec.phase} 에만 「${spec.say}」`);
  },
  /** 자면 다음 날: 시간이 흐르고, 그 사람에게 말을 걸어 묵는 길이 아침으로 넘긴다. */
  sleepNextDay(spec, before, after) {
    if (!after.system?.timeSystem?.enabled) return no('시간 시스템이 꺼져 있다 — 다음 날이 없다');
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const paths = playPaths(now, () => Object.assign(freshSession(), { gold: 1000 }), after);
    const sleeps = (path: Play): boolean => path.ran.some(command => command.kind === 'sleepUntilMorning' || (command.kind === 'advanceTime' && (Number(command.days ?? 0) >= 1 || Number(command.hours ?? 0) >= 6)))
      || (path.picked.includes('(여관) 묵는다') && path.ran.some(command => command.kind === 'inn' && command.advanceToMorning === true));
    if (!paths.some(sleeps)) return no(`${label(now)}: 묵어도 아침으로 넘어가지 않는다(sleepUntilMorning·inn advanceToMorning 없음)`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: 묵으면 다음 날 아침`);
  },
  /** 처음 고르는 몬스터: 새로 세운 사람에게 말을 걸면 count 종 가운데 하나를 골라 정확히 한 마리 받는다 — 다시 말을 걸면 더 주지 않는다. */
  starterPick(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const known = new Set((after.database?.monsterSpecies ?? []).map((species: any) => species.id));
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const paths = playPaths(event, freshSession, after, {}, 240);
      const gave = paths.filter(path => path.monsters.length);
      if (paths.some(path => path.monsters.length > 1)) { notes.push(`${label(event)}: 한 번에 두 마리 이상 준다`); continue; }
      const kinds = new Set(gave.map(path => path.monsters[0]!));
      if (kinds.size < spec.count) { notes.push(`${label(event)}: 고를 수 있는 몬스터가 ${kinds.size}종 — ${spec.count}종이어야 한다`); continue; }
      if ([...kinds].some(id => !known.has(id))) { notes.push(`${label(event)}: 자료집에 없는 종을 준다`); continue; }
      const session = freshSession();
      interact(event, session, after, { picks: gave[0]!.picks });
      if (playPaths(event, () => structuredClone(session), after, {}, 240).some(path => path.monsters.length)) { notes.push(`${label(event)}: 받은 뒤에 다시 말을 걸면 또 준다`); continue; }
      if (!visibleAt(after, mapId, event) || !passable(after, mapId, event.x, event.y) || !cellFree(after, mapId, event)) { notes.push(`${label(event)}: 보이지 않거나 선 칸이 막혔다`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — ${kinds.size}종 가운데 하나, 한 번만`);
    }
    return no(notes.join(' / '));
  },
  /** 암호: 새로 놓은 보이는 것에 answer 를 넣으면 그 아이템을 한 번 얻고, 틀린 암호(wrongAnswers)로는 얻지 못한다. 숫자 입력창·숫자 선택지 둘 다 된다. */
  passwordLock(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const ids = itemIdsByName(after, spec.item);
    if (!ids.length) return no(`자료집에 「${spec.item}」 아이템이 없다`);
    const tryCode = (event: Ev, session: any, code: string): Play => {
      let at = 0;
      return interact(event, session, after, {
        picks: [],
        enter: command => (Number(command.digits) === 1 ? Number(code[at++] ?? 0) : Number(code)),
        choose: texts => {
          const whole = texts.findIndex(text => squash(text) === code);
          if (whole >= 0) return whole;
          const digit = texts.findIndex(text => squash(text) === code[at]);
          if (digit >= 0 && texts.every(text => /^\d$/u.test(squash(text)))) { at++; return digit; }
          const go = texts.findIndex(text => !/그만|취소|아니|닫|나중|돌아/u.test(text));
          return go >= 0 ? go : 0;
        },
      });
    };
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const asks = (play: Play): boolean => play.ran.some(command => command.kind === 'inputNumber' || command.kind === 'choices');
      const session = freshSession(), right = tryCode(event, session, spec.answer);
      if (!asks(right)) { notes.push(`${label(event)}: 암호를 묻지 않는다`); continue; }
      if (count(session, ids) !== 1) { notes.push(`${label(event)}: 「${spec.answer}」를 넣었는데 「${spec.item}」 ${count(session, ids)}개 — 기대 1개`); continue; }
      tryCode(event, session, spec.answer);
      if (count(session, ids) !== 1) { notes.push(`${label(event)}: 연 뒤에 다시 넣으면 또 준다`); continue; }
      if (right.ran.some(command => command.kind === 'inputNumber')) {
        const leak = (spec.wrongAnswers as string[]).find(code => { const other = freshSession(); tryCode(event, other, code); return count(other, ids) > 0; });
        if (leak) { notes.push(`${label(event)}: 틀린 암호 「${leak}」로도 열린다`); continue; }
        if (count(startOpen(event, after), ids) > 0) { notes.push(`${label(event)}: 암호 없이 그냥 조사해도 준다`); continue; }
      } else {
        // 숫자를 선택지로 고르는 자물쇠는 모든 길을 밟아 본다: 여는 길은 하나뿐이어야 한다(틀린 길이 셋 이상).
        const paths = playPaths(event, freshSession, after, {}, 400), opens = paths.filter(path => count(path.session, ids) > 0);
        if (opens.length !== 1 || paths.length < 4) { notes.push(`${label(event)}: 고르는 길 ${paths.length}개 가운데 ${opens.length}개가 열린다 — 맞는 암호 하나만 열려야 한다`); continue; }
      }
      if (!visibleAt(after, mapId, event) || !approachable(after, mapId, event)) { notes.push(`${label(event)}: 보이지 않거나 다가갈 수 없다`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — 「${spec.answer}」로 「${spec.item}」, 한 번만`);
    }
    return no(notes.join(' / '));
  },
  /** 잠긴 문: 그 이동 칸들이 item 없이는 안 보내고 lockedSay 를 내며, 가지면 toMap 으로 보낸다. 문의 모든 칸이 잠겨야 한다. */
  lockedTransfer(spec, before, after) {
    const ids = itemIdsByName(after, spec.item);
    if (!ids.length) return no(`자료집에 「${spec.item}」 아이템이 없다`);
    const goes = (play: Play): boolean => play.ran.some(command => command.kind === 'transfer' && command.mapId === spec.toMap);
    for (const eventId of spec.eventIds as string[]) {
      const was = eventOf(before, spec.mapId, eventId), now = eventOf(after, spec.mapId, eventId);
      if (!was || !now) return no(`${eventId} 가 없다`);
      const at = `문 칸 (${now.x},${now.y})`, without = interact(now, freshSession(), after), held = interact(now, freshSession({ [ids[0]!]: 1 }), after);
      if (goes(without)) return no(`${at}: 「${spec.item}」 없이도 들어간다`);
      if (!said(without, spec.lockedSay)) return no(`${at}: 잠겨 있을 때 「${spec.lockedSay}」가 나오지 않는다 — 지금: ${heard(without)}`);
      if (!goes(held)) return no(`${at}: 「${spec.item}」을 가져도 들어가지 못한다`);
      if (!sameSpot(was, now)) return no('문의 자리가 바뀌었다');
    }
    return ok(`문 ${spec.eventIds.length}칸: 「${spec.item}」이 있어야 들어간다, 없으면 「${spec.lockedSay}」`);
  },
  /** 제한 시간: 그 맵에 들어서면 seconds 초 타이머가 돌기 시작하고, 시간이 다 되면(남은 시간 0) 저절로 도는 이벤트가 게임을 끝낸다 — 그 전에는 아니다. */
  timeLimit(spec, _before, after) {
    const session = freshSession();
    if (entryRuns(after, spec.mapId, session).some(({ play }) => play.ended)) return no('맵에 들어서자마자 게임이 끝난다');
    const timerId = Object.keys(session.timers).find(id => session.timers[id] === spec.seconds && session.timerRunning?.[id]);
    if (!timerId) return no(`맵에 들어서도 ${spec.seconds}초 타이머가 시작되지 않는다(타이머 ${JSON.stringify(session.timers)})`);
    const ends = (state: any): Play | undefined => eventsOf(after, spec.mapId).map(event => ({ event, active: activePage(event, state) }))
      .filter(({ active }) => active && ['auto', 'parallel'].includes(active.trigger)).map(({ event }) => interact(event, structuredClone(state), after, { halt: true })).find(play => play.ended);
    const early = ends(session);
    if (early) return no(`시간이 남았는데 ${endNote(after, early)} 이(가) 나온다`);
    session.timers[timerId] = 0;
    const late = ends(session);
    if (!late) return no(`${timerId} 이 0 이 되어도 게임이 끝나지 않는다(남은 시간 0 조건의 자동·병렬 페이지 없음)`);
    if (spec.gameOver && late.ended?.kind !== 'gameOver') return no(`시간이 다 되면 게임 오버여야 한다 — 지금: ${endNote(after, late)}`);
    return ok(`들어서면 ${timerId} ${spec.seconds}초 · 다 되면 ${endNote(after, late)}`);
  },
  /** 통행료: 돈이 넉넉하면 price 를 내고 say(안 내는 길도 있다), 모자라면 한 푼도 안 나가고 refuse. 한 번 낸 뒤에는 다시 받지 않는다. */
  paidGate(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const rich = playPaths(now, () => Object.assign(freshSession(), { gold: spec.price * 2 }), after);
    const paid = rich.find(path => path.gold === -spec.price && said(path, spec.say));
    if (!paid) return no(`${label(now)}: ${spec.price}G 를 내고 「${spec.say}」가 나오는 길이 없다 — 지금: ${rich.map(path => `${path.gold}G ${heard(path)}`).join(' // ').slice(0, 160)}`);
    if (rich.some(path => path.gold !== 0 && path.gold !== -spec.price)) return no(`${label(now)}: ${spec.price}G 가 아닌 돈이 오간다`);
    if (rich.some(path => path.gold === 0 && said(path, spec.say))) return no(`${label(now)}: 돈을 안 내도 「${spec.say}」가 나온다`);
    if (!rich.some(path => path.gold === 0)) return no(`${label(now)}: 내지 않는 길이 없다(말을 걸면 무조건 돈을 낸다)`);
    const poor = playPaths(now, () => Object.assign(freshSession(), { gold: spec.price - 1 }), after);
    if (poor.some(path => path.gold !== 0 || said(path, spec.say))) return no(`${label(now)}: 돈이 모자란데도 받거나 통과시킨다`);
    if (!poor.some(path => said(path, spec.refuse))) return no(`${label(now)}: 돈이 모자라면 「${spec.refuse}」가 나와야 한다 — 지금: ${heard(poor[0]!)}`);
    const session = Object.assign(freshSession(), { gold: spec.price * 2 });
    interact(now, session, after, { picks: paid.picks });
    if (playPaths(now, () => structuredClone(session), after).some(path => path.gold !== 0)) return no(`${label(now)}: 한 번 낸 뒤에도 또 받는다`);
    if (!sameSpot(was, now)) return no('자리가 바뀌었다');
    return ok(`${label(now)}: ${spec.price}G 를 내면 「${spec.say}」, 모자라면 「${spec.refuse}」, 한 번만 받는다`);
  },
  /** 얘기한 사람 수로 갈리는 엔딩: 새로 놓은 보이는 것을 조사하면, talkTo 의 모두와 얘기한 뒤에는 endingAll, 한 명이라도 빠지면 endingElse. */
  flagsEnding(spec, before, after) {
    const people = (spec.talkTo as Array<{ mapId: string; eventId: string }>).map(ref => eventOf(after, ref.mapId, ref.eventId));
    if (people.some(person => !person)) return no('얘기할 사람 가운데 없는 이벤트가 있다');
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const after2 = (event: Ev, skip: number): Play => {
      const session = freshSession();
      people.forEach((person, index) => { if (index !== skip) interact(person!, session, after); });
      return interact(event, session, after, { halt: true });
    };
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const all = after2(event, -1);
      if (!endingNamed(after, all, spec.endingAll)) { notes.push(`${label(event)}: 모두와 얘기한 뒤 조사해도 엔딩 「${spec.endingAll}」이 아니다 — 지금: ${endNote(after, all)}`); continue; }
      const short = people.map((_, index) => after2(event, index)).find(play => !endingNamed(after, play, spec.endingElse));
      if (short) { notes.push(`${label(event)}: 한 명과 얘기하지 않았는데 엔딩 「${spec.endingElse}」이 아니다 — 지금: ${endNote(after, short)}`); continue; }
      if (!visibleAt(after, mapId, event) || !approachable(after, mapId, event)) { notes.push(`${label(event)}: 보이지 않거나 다가갈 수 없다`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — 모두와 얘기하면 「${spec.endingAll}」, 아니면 「${spec.endingElse}」`);
    }
    return no(notes.join(' / '));
  },
};
/** 숫자 입력창에 맞지 않는 값을 넣고(선택지는 그만두는 쪽) 한 번 조사한 뒤의 상태. */
function startOpen(event: Ev, doc: Doc): any {
  const session = freshSession();
  interact(event, session, doc, { picks: [], enter: () => -1, choose: texts => { const stop = texts.findIndex(text => /그만|취소|아니|닫|나중|돌아/u.test(text)); return stop >= 0 ? stop : undefined; } });
  return session;
}

/** 요청 자체가 건드리는 맵 밖 칸(부수 변경으로 세지 않는다). */
export const GENRE_PLAY_SIDE: Record<string, RegExp> = {
  presentReacts: /^switches$/u,
  choiceEndings: /^(endings|switches)$/u,
  itemsGatedText: /^(switches|database\.items)$/u,
  affectionLine: /^(switches|variables)$/u,
  giftReacts: /^(switches|variables)$/u,
  affectionEnding: /^(endings|switches|variables)$/u,
  deadlineEnding: /^(endings|commonEvents|switches|variables|system\.timeSystem)$/u,
  lifeGauge: /^(commonEvents|switches|variables|system\.fieldHud)$/u,
  sleepNextDay: /^system\.timeSystem$/u,
  timePhaseLine: /^system\.timeSystem$/u,
  starterPick: /^(switches|system\.(peopleChipLock|genre|monsterCollection)|database\.characterAppearances)$/u,
  passwordLock: /^(switches|variables)$/u,
  lockedTransfer: /^switches$/u,
  timeLimit: /^(switches|commonEvents)$/u,
  paidGate: /^switches$/u,
  flagsEnding: /^(endings|switches|variables)$/u,
};
