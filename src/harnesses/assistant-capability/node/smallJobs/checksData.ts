// 둘째 묶음의 판정 — 자료집 기록 · 프로젝트/맵 설정 · 시작 상태 · 지우기 · 글 일괄 바꾸기.
// 첫 묶음과 같은 규칙: 저장 문서 전/후만 본다. 어느 도구로 했는지는 보지 않는다.
import { isDeepStrictEqual } from 'node:util';
import { listAudioResources } from '../../../../assets/audioResourceCatalog';
import { activePage, cheb, eventOf, eventsOf, freshSession, includesPhrase, inBounds, interact, itemIdsByName, mapName, no, ok, pagesOf, passable, squash, valueAt,
  type CheckSpec, type Doc, type Ev, type Play, type Result } from './checkSupport';

/** 맵에 들어서면 저절로 도는 이벤트(자동·병렬)를 그 상태에서 한 번씩 돌려 본다. */
export function entryRuns(doc: Doc, mapId: string, session: any): Array<{ event: Ev; play: Play }> {
  const out: Array<{ event: Ev; play: Play }> = [];
  for (const event of eventsOf(doc, mapId)) {
    const active = activePage(event, session);
    if (active && ['auto', 'parallel'].includes(active.trigger)) out.push({ event, play: interact(event, session, doc) });
  }
  return out;
}
/** 눈에 보이는 글(이벤트 이름·대사·선택지·안내, 퀘스트, 공통 이벤트) 안에서 그 낱말이 나오는 횟수. id 같은 키 값은 세지 않는다. */
function occurrences(doc: Doc, word: string): number {
  let count = 0;
  const walk = (node: unknown, key: string): void => {
    if (typeof node === 'string') { if (!/(^id$|Id$|Ids$|^kind$|^key$)/u.test(key)) count += node.split(word).length - 1; return; }
    if (Array.isArray(node)) { for (const child of node) walk(child, key); return; }
    if (node && typeof node === 'object') for (const [childKey, child] of Object.entries(node)) walk(child, childKey);
  };
  for (const map of Object.values<any>(doc.maps ?? {})) { walk(map.name, 'name'); walk(map.events ?? [], 'events'); }
  walk(doc.quests ?? [], 'quests'); walk(doc.commonEvents ?? [], 'commonEvents');
  return count;
}
/** 값 비교(저장 문서 기준) — 메모리 안 문서에만 있는 undefined 칸은 없는 칸으로 본다. */
const same = (a: unknown, b: unknown): boolean => isDeepStrictEqual(JSON.parse(JSON.stringify(a ?? null)), JSON.parse(JSON.stringify(b ?? null)));
const troopMembers = (troop: any): string[] => (troop?.members?.length ? troop.members.map((member: any) => member.enemyId) : troop?.enemyIds) ?? [];

export const DATA_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  /**
   * 자료집 기록 하나의 칸: 있던 기록(name 또는 lead=시작 파티의 첫 배우)이나 새 기록(isNew + name)이 expect 의 값을 갖는다.
   * scale{path,factor} = 전 값의 배수, keep = 그대로여야 하는 칸.
   */
  recordFields(spec, before, after) {
    const table: any[] = after.database?.[spec.table] ?? [], old: any[] = before.database?.[spec.table] ?? [];
    let record: any, was: any;
    if (spec.isNew) {
      const had = new Set(old.map(row => row.id));
      // 새 기록의 이름은 띄어쓰기·따옴표를 무시하고 견준다(「눈꽃차」도 그 이름이다).
      record = table.find(row => !had.has(row.id) && squash(row.name) === squash(spec.name));
      if (!record) return no(`자료집 ${spec.table} 에 새 「${spec.name}」 기록이 없다${old.some(row => row.name === spec.name) ? '' : table.some(row => String(row.name).includes(spec.name)) ? '(이름이 정확히 같지 않다)' : ''}`);
    } else {
      const matches = spec.lead ? old.filter(row => row.id === before.system?.startActorIds?.[0]) : old.filter(row => row.name === spec.name);
      if (matches.length !== 1) return no(`픽스처의 ${spec.table} 에 「${spec.lead ? '주인공' : spec.name}」 기록이 ${matches.length}개다`);
      was = matches[0];
      record = table.find(row => row.id === was.id);
      if (!record) return no(`「${was.name}」 기록(${was.id})이 사라졌다`);
    }
    const label = `${spec.table} 「${was?.name ?? record.name}」`;
    for (const [path, want] of Object.entries<unknown>(spec.expect ?? {})) {
      const got = valueAt(record, path);
      if (!same(got, want)) return no(`${label}의 ${path} = ${JSON.stringify(got)} — 기대 ${JSON.stringify(want)}`);
    }
    if (spec.scale) {
      const from = Number(valueAt(was, spec.scale.path)), got = valueAt(record, spec.scale.path);
      if (got !== from * spec.scale.factor) return no(`${label}의 ${spec.scale.path} = ${JSON.stringify(got)} — 기대 ${from * spec.scale.factor}(전 값 ${from}의 ${spec.scale.factor}배)`);
    }
    for (const path of (was ? spec.keep ?? [] : []) as string[]) if (!same(valueAt(record, path), valueAt(was, path))) return no(`${label}의 ${path} 가 바뀌었다(${JSON.stringify(valueAt(was, path))} → ${JSON.stringify(valueAt(record, path))}) — 요청하지 않은 칸`);
    return ok(`${label}: ${[...Object.keys(spec.expect ?? {}), ...(spec.scale ? [spec.scale.path] : [])].map(path => `${path}=${JSON.stringify(valueAt(record, path))}`).join(', ')}`);
  },
  /** 프로젝트 설정 한 칸(타이틀·게임 오버 글자, 타이틀 음악): 값이 전과 다르고 equals / includes(여러 칸 중 하나) / validMusic 을 만족한다. */
  projectField(spec, before, after) {
    const paths: string[] = spec.paths ?? [spec.path];
    const notes: string[] = [];
    for (const path of paths) {
      const got = valueAt(after, path);
      if (isDeepStrictEqual(got, valueAt(before, path))) { notes.push(`${path} 가 그대로다(${JSON.stringify(got) ?? '없음'})`); continue; }
      if ('equals' in spec && !isDeepStrictEqual(got, spec.equals)) { notes.push(`${path} = ${JSON.stringify(got)} — 기대 ${JSON.stringify(spec.equals)}`); continue; }
      if (spec.includes && !includesPhrase(got, spec.includes)) { notes.push(`${path} = ${JSON.stringify(got)} — 「${spec.includes}」가 없다`); continue; }
      if (spec.validMusic && !listAudioResources('music', after as never).some(track => track.id === got)) { notes.push(`${path} = ${JSON.stringify(got)} 는 곡 목록에 없는 id 다`); continue; }
      return ok(`${path} = ${JSON.stringify(got)}`);
    }
    return no(notes.join(' / '));
  },
  /** 맵 속성 한 칸(저장 금지 등). */
  mapField(spec, _before, after) {
    const map = after.maps?.[spec.mapId];
    if (!map) return no(`맵 ${spec.mapId} 가 없다`);
    return isDeepStrictEqual(map[spec.field], spec.equals) ? ok(`${map.name}.${spec.field} = ${JSON.stringify(spec.equals)}`) : no(`${map.name}.${spec.field} = ${JSON.stringify(map[spec.field])} — 기대 ${JSON.stringify(spec.equals)}`);
  },
  /** 그 맵에 그 날씨: 맵 기후가 그 날씨로 고정됐거나, 들어서면 저절로 도는 이벤트가 그 날씨를 켠다. */
  mapWeather(spec, _before, after) {
    const map = after.maps?.[spec.mapId];
    if (!map) return no(`맵 ${spec.mapId} 가 없다`);
    if (map.climate?.mode === 'fixed' && map.climate.weather === spec.weather && (map.climate.intensity ?? 0) > 0) return ok(`${map.name} 기후 고정 ${spec.weather}(${map.climate.intensity})`);
    const set = entryRuns(after, spec.mapId, freshSession()).flatMap(({ event, play }) => play.ran.filter(command => command.kind === 'setWeather').map(command => ({ event, command })));
    const hit = set.find(({ command }) => command.weather === spec.weather && (command.intensity ?? 1) > 0);
    if (hit) return ok(`${map.name}에 들어서면 ${hit.event.name ?? hit.event.id} 이(가) 날씨 ${spec.weather} 를 켠다`);
    return no(`${map.name}의 날씨가 ${spec.weather} 가 아니다 — 기후 ${JSON.stringify(map.climate ?? null)}, 들어설 때 켜는 날씨 ${set.map(({ command }) => command.weather).join(',') || '없음'}`);
  },
  /** 그 맵이 어둡다: 맵 기본 조명의 어둠(ambient)이 minAmbient 이상이거나, 들어서면 저절로 도는 이벤트가 그만큼 어둡게 한다. */
  mapDark(spec, before, after) {
    const map = after.maps?.[spec.mapId];
    if (!map) return no(`맵 ${spec.mapId} 가 없다`);
    const base = Number(map.defaultLighting?.ambient ?? 0);
    const set = entryRuns(after, spec.mapId, freshSession()).flatMap(({ play }) => play.ran.filter(command => command.kind === 'setLighting').map(command => Number(command.ambient ?? 0)));
    const darkest = Math.max(base, ...set);
    if (darkest < spec.minAmbient) return no(`${map.name}의 어둠 ${darkest} — ${spec.minAmbient} 이상이어야 한다(기본 조명 ${JSON.stringify(map.defaultLighting ?? null)})`);
    if (isDeepStrictEqual(before.maps?.[spec.mapId]?.defaultLighting, map.defaultLighting) && !set.length) return no('조명이 그대로다');
    return ok(`${map.name} 어둠 ${darkest}`);
  },
  /** 걸어 다니면 나오는 적: 조우율이 0보다 크고, 나올 부대가 자료집에 있고 적이 든 부대다. enemyName 이면 모든 적 이름에 그 낱말. */
  randomEncounter(spec, _before, after) {
    const map = after.maps?.[spec.mapId];
    if (!map) return no(`맵 ${spec.mapId} 가 없다`);
    if (!(Number(map.encounterRate) > 0)) return no(`${map.name}의 조우율이 ${map.encounterRate ?? 0} 이다`);
    const ids: string[] = map.encounterTable?.length ? map.encounterTable.map((entry: any) => entry.troopId) : map.troopIds ?? [];
    if (!ids.length) return no(`${map.name}에 나올 부대가 없다`);
    const troops = new Map<string, any>((after.database?.troops ?? []).map((troop: any) => [troop.id, troop]));
    const enemies = new Map<string, any>((after.database?.enemies ?? []).map((enemy: any) => [enemy.id, enemy]));
    for (const id of ids) {
      const members = troopMembers(troops.get(id));
      if (!troops.has(id) || !members.length || members.some(member => !enemies.has(member))) return no(`부대 ${id} 가 자료집에 없거나 적이 없다`);
      if (spec.enemyName && !members.every(member => String(enemies.get(member).name).includes(spec.enemyName))) return no(`부대 「${troops.get(id).name}」의 적 ${members.map(member => enemies.get(member).name).join(',')} — 모두 「${spec.enemyName}」여야 한다`);
    }
    return ok(`${map.name} 조우율 ${map.encounterRate} · 부대 ${ids.map(id => troops.get(id).name).join(', ')}`);
  },
  /** 시작 위치: 그 맵의 걸을 수 있는 칸. nearEvent 면 그 이벤트에서 max 칸 안(같은 칸 아님). */
  startAt(spec, before, after) {
    const pos = after.startPos ?? {};
    if (after.startMapId === before.startMapId && isDeepStrictEqual(pos, before.startPos)) return no(`시작 위치가 그대로다(${mapName(after, after.startMapId)} ${pos.x},${pos.y})`);
    if (after.startMapId !== spec.mapId) return no(`시작 맵이 「${mapName(after, after.startMapId)}」 — 기대 「${mapName(after, spec.mapId)}」`);
    if (!inBounds(after, spec.mapId, pos.x, pos.y) || !passable(after, spec.mapId, pos.x, pos.y)) return no(`시작 칸 (${pos.x},${pos.y})이 맵 밖이거나 막힌 칸이다`);
    if (eventsOf(after, spec.mapId).some(event => event.x === pos.x && event.y === pos.y && pagesOf(event).some(page => (page.priority ?? 'same') === 'same'))) return no(`시작 칸 (${pos.x},${pos.y})에 이벤트가 서 있다`);
    if (spec.nearEvent) {
      const anchor = eventOf(after, spec.mapId, spec.nearEvent.eventId);
      if (!anchor) return no(`기준 이벤트 ${spec.nearEvent.eventId} 가 없다`);
      const d = cheb(anchor, pos);
      if (d < 1 || d > (spec.nearEvent.max ?? 1)) return no(`시작 칸 (${pos.x},${pos.y})은 ${anchor.name ?? anchor.id}(${anchor.x},${anchor.y})에서 ${d}칸 — ${spec.nearEvent.max ?? 1}칸 안이어야 한다`);
    }
    return ok(`시작 ${mapName(after, spec.mapId)} (${pos.x},${pos.y})`);
  },
  /** 새 게임을 시작할 때 가진 것: 시작 상태(session)에 들었거나, 시작 맵에 들어서면 저절로 도는 이벤트가 한 번만 준다. 합쳐서 정확히 그만큼. */
  startState(spec, before, after) {
    const itemIds = spec.item ? itemIdsByName(after, spec.item.name) : [];
    if (spec.item && !itemIds.length) return no(`자료집에 「${spec.item.name}」 아이템이 없다`);
    const held = (doc: Doc): number => (spec.item ? itemIds.reduce((sum, id) => sum + Number(doc.session?.inventory?.[id] ?? 0), 0) : Number(doc.session?.gold ?? 0));
    const session = freshSession();
    const gained = (): number => entryRuns(after, after.startMapId, session).reduce((sum, { play }) => sum + (spec.item ? itemIds.reduce((n, id) => n + (play.items[id] ?? 0), 0) : play.gold), 0);
    const first = gained(), again = gained();
    const total = held(after) + first, want = spec.item ? spec.item.amount : spec.gold;
    const what = spec.item ? spec.item.name : '소지금';
    if (total !== want) return no(`시작할 때 ${what} ${total} — 기대 ${want}(시작 상태 ${held(after)}, 시작 맵의 자동 이벤트 ${first})`);
    if (again !== 0) return no(`시작 맵에 다시 들어올 때마다 ${what} ${again} 을(를) 또 준다`);
    if (held(before) === want) return no('시작 상태가 그대로다');
    return ok(`시작할 때 ${what} ${total}(시작 상태 ${held(after)} + 자동 이벤트 ${first})`);
  },
  /** 있던 이벤트를 지운다(시키지 않은 다른 삭제는 damage 가 잡는다). */
  eventRemoved(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId);
    if (!was) return no(`픽스처에 ${spec.eventId} 가 없다`);
    return eventOf(after, spec.mapId, spec.eventId) ? no(`${was.name ?? was.id} 이(가) 아직 (${was.x},${was.y})에 있다`) : ok(`${was.name ?? was.id} 삭제`);
  },
  /** 이름·낱말 일괄 바꾸기: 눈에 보이는 글에 옛 낱말이 남지 않고, 새 낱말이 옛 낱말이 있던 만큼 늘었다. */
  textReplaced(spec, before, after) {
    const had = occurrences(before, spec.find), left = occurrences(after, spec.find);
    if (!had) return no(`픽스처에 「${spec.find}」가 없다`);
    if (left) return no(`「${spec.find}」가 아직 ${left}곳에 남았다(전 ${had}곳)`);
    const added = occurrences(after, spec.replace) - occurrences(before, spec.replace);
    if (added < had) return no(`「${spec.replace}」가 ${added}곳 늘었다 — 「${spec.find}」가 있던 ${had}곳이 모두 바뀌어야 한다(글이 지워졌다)`);
    return ok(`「${spec.find}」 ${had}곳 → 「${spec.replace}」`);
  },
};

/** 요청 자체가 건드리는 맵 밖 칸(부수 변경으로 세지 않는다) — 판정 인자에서 만든다. */
export const DATA_SIDE: Record<string, (spec: CheckSpec) => RegExp> = {
  recordFields: spec => new RegExp(`^database\\.${spec.table}$`, 'u'),
  projectField: spec => new RegExp(`^(${[...new Set((spec.paths ?? [spec.path]).map((path: string) => path.split('.').slice(0, 2).join('\\.')))].join('|')})$`, 'u'),
  startState: () => /^switches$/u,
  textReplaced: () => /^(quests|commonEvents)$/u,
};
