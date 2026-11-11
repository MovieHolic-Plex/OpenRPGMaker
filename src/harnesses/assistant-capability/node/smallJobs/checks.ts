// 작은 일의 기계 판정. 저장 문서 전/후만 본다 — 모델 판정자 없음, 도구 이름도 안 본다.
// 판정은 두 겹이다: outcome(요청이 말한 결과가 저장 문서에 있나) + damage(시키지 않은 파괴: 맵·이벤트 삭제, 다른 이벤트 이동,
// 맵·게임 이름 바뀜, 시작 위치 바뀜, 허락 없는 새 맵). 둘 다 깨끗해야 통과다. 다른 이벤트의 내용 변경은 sideEdits 로 세기만 한다.
// 이 파일 = 첫 묶음(작은 일 30가지)의 판정 종류 + damage + runCheck. 둘째 묶음의 종류는 checksData.ts · checksPlay.ts 에 있다.
import { isDeepStrictEqual } from 'node:util';
import { listAudioResources } from '../../../../assets/audioResourceCatalog';
import type { Project } from '../../../../project/types';
import { walkableFrom } from '../matrixNativeSpec';
import { DATA_KINDS, DATA_SIDE } from './checksData';
import { PLAY_KINDS, PLAY_SIDE } from './checksPlay';
import { allCommands, cellFree, commandsDeep, eventOf, eventsOf, freshSession, hasSprite, includesPhrase, inRect, interact, itemIdsByName, mapName, newEvents, no, ok, pagesOf, passable, placeNote, saysFirst, squash, triggerKinds, visibleAt, where,
  type Allow, type CheckSpec, type Doc, type Ev, type Play, type Result, type Verdict } from './checkSupport';

export type { Allow, CheckSpec, Verdict } from './checkSupport';

// ── 판정 종류 ───────────────────────────────────────────────────────────────
const KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  /** 있던 이벤트를 옮긴다: 상대 칸(dx,dy) / 다른 이벤트 옆(nearEvent) / 자리 사각형(inRect). 선 칸은 걸을 수 있고 비어 있어야 한다. */
  eventMoved(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was) return no(`픽스처에 ${spec.eventId} 가 없다`);
    if (!now) return no(`${was.name ?? spec.eventId} 이(가) 사라졌다(같은 이벤트를 옮겨야 한다)`);
    if (now.x === was.x && now.y === was.y) return no(`${was.name ?? spec.eventId} 이(가) 그대로 (${was.x},${was.y})에 있다`);
    if (typeof spec.dx === 'number' && (now.x !== was.x + spec.dx || now.y !== was.y + (spec.dy ?? 0))) return no(`(${was.x},${was.y}) → (${now.x},${now.y}) — 기대 (${was.x + spec.dx},${was.y + (spec.dy ?? 0)})`);
    const bad = placeNote(spec, after, spec.mapId, now);
    if (bad) return no(bad);
    if (!passable(after, spec.mapId, now.x, now.y)) return no(`옮긴 칸 (${now.x},${now.y})이 막힌 칸이다`);
    if (!cellFree(after, spec.mapId, now)) return no(`옮긴 칸 (${now.x},${now.y})에 다른 이벤트가 있다`);
    if (!isDeepStrictEqual(was.pages, now.pages)) return no('옮기면서 이벤트 내용(페이지)이 바뀌었다');
    return ok(`(${was.x},${was.y}) → (${now.x},${now.y})`);
  },
  /** 말을 걸면 대사를 하는 새 사람. */
  newNpc(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      if (!saysFirst(after, event, spec.say)) { notes.push(`${event.name ?? event.id}: 처음 말을 걸면 「${spec.say}」가 나오지 않는다`); continue; }
      if (!hasSprite(event)) { notes.push(`${event.name ?? event.id}: 사람 그림이 없다(투명)`); continue; }
      if (!triggerKinds(event).includes('action')) { notes.push(`${event.name ?? event.id}: 말 걸기(action)로 열리지 않는다`); continue; }
      const bad = placeNote(spec, after, mapId, event) ?? (!passable(after, mapId, event.x, event.y) ? `선 칸 (${event.x},${event.y})이 막힌 칸` : !cellFree(after, mapId, event) ? `선 칸 (${event.x},${event.y})에 다른 이벤트` : null);
      if (bad) { notes.push(`${event.name ?? event.id}: ${bad}`); continue; }
      return ok(`${event.name ?? event.id} @ ${where(after, mapId, event)}`);
    }
    return no(notes.join(' / '));
  },
  /** 실제로 열리는 상점: 새 사람(target 없음) 또는 있던 이벤트(eventId)에 shop 명령 + 팔 물건. */
  shop(spec, before, after) {
    const candidates = spec.eventId
      ? [{ mapId: spec.mapId as string, event: eventOf(after, spec.mapId, spec.eventId) }].filter((entry): entry is { mapId: string; event: Ev } => !!entry.event)
      : newEvents(before, after, spec.mapId);
    if (!candidates.length) return no(spec.eventId ? `${spec.eventId} 가 없다` : '새 이벤트가 없다');
    const wanted: Array<{ name: string; ids: string[] }> = (spec.items ?? []).map((name: string) => ({ name, ids: itemIdsByName(after, name) }));
    const known = new Set([...(after.database?.items ?? []), ...(after.database?.equipment ?? [])].map((row: any) => row.id));
    const notes: string[] = [];
    for (const { mapId, event } of candidates) {
      const session = freshSession();
      const shops = interact(event, session, after).shops;
      if (shops.length && !interact(event, session, after).shops.length) { notes.push(`${event.name ?? event.id}: 두 번째로 말을 걸면 상점이 열리지 않는다`); continue; }
      if (!shops.length) { notes.push(`${event.name ?? event.id}: ${allCommands(event).some(command => command.kind === 'shop') ? '처음 말을 걸어서는 상점이 열리지 않는다' : 'shop 명령 없음'}`); continue; }
      const sold = new Set<string>(shops.flatMap(shop => [...(shop.itemIds ?? []), ...(shop.equipmentIds ?? []), ...(shop.stock ?? []).map((entry: any) => entry?.itemId)]).filter(Boolean));
      const real = [...sold].filter(id => known.has(id));
      if (real.length < Math.max(1, spec.minItems ?? 1)) { notes.push(`${event.name ?? event.id}: 팔 물건이 ${real.length}개`); continue; }
      const lacking = wanted.filter(item => !item.ids.some(id => sold.has(id))).map(item => item.name);
      if (lacking.length) { notes.push(`${event.name ?? event.id}: 빠진 물건 ${lacking.join(',')}`); continue; }
      if (!hasSprite(event)) { notes.push(`${event.name ?? event.id}: 사람 그림이 없다`); continue; }
      if (!triggerKinds(event).includes('action')) { notes.push(`${event.name ?? event.id}: 말 걸기로 열리지 않는다`); continue; }
      if (spec.eventId) {
        const was = eventOf(before, mapId, spec.eventId);
        if (was && (was.x !== event.x || was.y !== event.y)) { notes.push('상점을 달면서 자리가 바뀌었다'); continue; }
        if (was && allCommands(was).some(command => command.kind === 'shop') && isDeepStrictEqual(was.pages, event.pages)) { notes.push('바뀐 것이 없다'); continue; }
      } else if (!passable(after, mapId, event.x, event.y) || !cellFree(after, mapId, event)) { notes.push(`${event.name ?? event.id}: 선 칸 (${event.x},${event.y})이 막혔거나 겹친다`); continue; }
      return ok(`${event.name ?? event.id} @ ${where(after, mapId, event)} — 파는 물건 ${real.length}개`);
    }
    return no(notes.join(' / '));
  },
  /** 한 번만 주는 상자·줍기·보상: 새 이벤트(eventId 없음) 또는 있던 이벤트가 아이템/돈을 정확히 그만큼 준다. */
  giveOnce(spec, before, after) {
    const candidates = spec.eventId
      ? [{ mapId: spec.mapId as string, event: eventOf(after, spec.mapId, spec.eventId) }].filter((entry): entry is { mapId: string; event: Ev } => !!entry.event)
      : newEvents(before, after, spec.mapId);
    if (!candidates.length) return no(spec.eventId ? `${spec.eventId} 가 없다` : '새 이벤트가 없다');
    const itemIds = spec.item ? itemIdsByName(after, spec.item.name) : [];
    if (spec.item && !itemIds.length) return no(`자료집에 「${spec.item.name}」 아이템이 없다`);
    const notes: string[] = [];
    for (const { mapId, event } of candidates) {
      const label = event.name ?? event.id;
      // 두 번 말을 걸어 본다: 처음에 정확히 그만큼 주고, 다시 걸면 더 주지 않아야 한다.
      const session = freshSession();
      const gained = (play: Play): number => (spec.item ? itemIds.reduce((sum, id) => sum + (play.items[id] ?? 0), 0) : play.gold);
      const first = gained(interact(event, session, after)), second = gained(interact(event, session, after));
      const want = spec.item ? (spec.item.amount ?? 1) : spec.gold;
      if (first !== want) { notes.push(`${label}: 처음에 ${spec.item ? spec.item.name : '돈'} ${first} — 기대 ${want}`); continue; }
      if (second !== 0) { notes.push(`${label}: 다시 말을 걸면 또 ${second} 준다(한 번만이어야 한다)`); continue; }
      if (!triggerKinds(event).some(kind => ['action', 'playerTouch'].includes(kind))) { notes.push(`${label}: 조사·접촉으로 열리지 않는다`); continue; }
      if (!spec.eventId) {
        if (!visibleAt(after, mapId, event)) { notes.push(`${label}: 그 칸에 보이는 것이 없다`); continue; }
        const bad = placeNote(spec, after, mapId, event) ?? (!cellFree(after, mapId, event) ? `(${event.x},${event.y})에 다른 이벤트` : null);
        if (bad) { notes.push(`${label}: ${bad}`); continue; }
      }
      return ok(`${label} @ ${where(after, mapId, event)} — ${spec.item ? `${spec.item.name} ${first}` : `${first}G`}, 한 번만`);
    }
    return no(notes.join(' / '));
  },
  /** 읽으면/조사하면 글이 나오는 새 이벤트(표지판·조사 지점). */
  textSpot(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const label = event.name ?? event.id;
      if (!saysFirst(after, event, spec.say)) { notes.push(`${label}: 조사하면 「${spec.say}」가 나오지 않는다`); continue; }
      if (!triggerKinds(event).includes('action')) { notes.push(`${label}: 조사(action)로 열리지 않는다`); continue; }
      if (spec.visible !== false && !visibleAt(after, mapId, event)) { notes.push(`${label}: 그 칸에 보이는 것이 없다`); continue; }
      const bad = placeNote(spec, after, mapId, event);
      if (bad) { notes.push(`${label}: ${bad}`); continue; }
      return ok(`${label} @ ${where(after, mapId, event)}`);
    }
    return no(notes.join(' / '));
  },
  /** 두 맵을 잇는 문: from 맵에서 걸어서 닿는 이벤트가 to 맵의 걸을 수 있는 칸으로 보낸다. roundTrip 이면 돌아오는 문도. */
  transferLink(spec, before, after) {
    const oneWay = (fromMap: string, toMap: string, startFrom?: { x: number; y: number }): Result => {
      const doors = eventsOf(after, fromMap).flatMap(event => allCommands(event).filter(command => command.kind === 'transfer' && command.mapId === toMap).map(command => ({ event, command })));
      const added = doors.filter(({ event }) => {
        const was = eventOf(before, fromMap, event.id);
        return !was || !allCommands(was).some(command => command.kind === 'transfer' && command.mapId === toMap);
      });
      if (!added.length) return no(`${mapName(after, fromMap)} → ${mapName(after, toMap)} 이동이 새로 생기지 않았다`);
      const notes: string[] = [];
      for (const { event, command } of added) {
        if (!passable(after, toMap, command.x, command.y)) { notes.push(`${event.name ?? event.id}: 도착 칸 (${command.x},${command.y})이 맵 밖이거나 막혔다`); continue; }
        if (startFrom) {
          const walk = walkableFrom(structuredClone(after) as unknown as Project, fromMap, startFrom);
          const reach = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => walk.has(`${event.x + dx!},${event.y + dy!}`));
          if (!reach) { notes.push(`${event.name ?? event.id}: 시작 칸에서 걸어서 닿지 않는다`); continue; }
        }
        return ok(`${event.name ?? event.id} @ ${where(after, fromMap, event)} → ${mapName(after, toMap)} (${command.x},${command.y})`);
      }
      return no(notes.join(' / '));
    };
    const start = spec.reachFrom ?? (after.startMapId === spec.fromMap ? after.startPos : undefined);
    const there = oneWay(spec.fromMap, spec.toMap, start);
    if (!there.ok || !spec.roundTrip) return there;
    const back = oneWay(spec.toMap, spec.fromMap);
    return back.ok ? ok(`${there.note} · 돌아오기 ${back.note}`) : no(`가는 문은 있다 — ${back.note}`);
  },
  /** 있던 사람의 첫 페이지 대사를 바꾼다(다른 페이지·자리는 그대로). */
  lineChanged(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    const firstText = (event: Ev) => commandsDeep(pagesOf(event)[0]?.commands).filter(command => command.kind === 'text');
    const lines = firstText(now);
    if (!lines.some(command => squash(command.body).includes(squash(spec.say)))) return no(`첫 페이지에 「${spec.say}」 대사가 없다 — 지금: ${lines.map(command => command.body).join(' | ').slice(0, 120)}`);
    for (const gone of spec.gone ?? []) if (lines.some(command => squash(command.body).includes(squash(gone)))) return no(`옛 대사 「${gone}」가 남아 있다`);
    if (spec.firstOnly && squash(lines[0]?.body) !== squash(spec.say) && !squash(lines[0]?.body).includes(squash(spec.say))) return no('새 대사가 첫 줄이 아니다');
    if (now.x !== was.x || now.y !== was.y) return no('대사를 바꾸면서 자리가 바뀌었다');
    if (!isDeepStrictEqual(pagesOf(was).slice(1), pagesOf(now).slice(1))) return no('다른 페이지가 바뀌었다');
    return ok(`${now.name ?? now.id}: ${lines.map(command => command.body).join(' | ').slice(0, 100)}`);
  },
  /** 여관 요금과 안내 대사를 함께 바꾼다. */
  innPrice(spec, _before, after) {
    const now = eventOf(after, spec.mapId, spec.eventId);
    if (!now) return no(`${spec.eventId} 가 없다`);
    const commands = allCommands(now), inns = commands.filter(command => command.kind === 'inn');
    if (!inns.length || inns.some(command => command.price !== spec.price)) return no(`여관 요금 ${inns.map(command => command.price).join(',') || '없음'} — 기대 ${spec.price}`);
    const texts = commands.filter(command => command.kind === 'text').map(command => String(command.body));
    if (!texts.some(body => squash(body).includes(squash(spec.say)))) return no(`대사에 「${spec.say}」가 없다`);
    if (texts.some(body => squash(body).includes(squash(spec.notSay)))) return no(`대사에 옛 요금 「${spec.notSay}」가 남아 있다`);
    return ok(`요금 ${spec.price} · 대사 ${texts[0]?.slice(0, 60)}`);
  },
  gameTitle(spec, _before, after) {
    if (after.meta?.title !== spec.title) return no(`제목 「${after.meta?.title}」 — 기대 「${spec.title}」`);
    const screen = after.system?.titleScreen?.title;
    if (typeof screen === 'string' && screen && screen !== spec.title) return no(`타이틀 화면 글자는 아직 「${screen}」`);
    return ok(`제목 「${spec.title}」`);
  },
  mapRenamed(spec, _before, after) {
    return after.maps?.[spec.mapId]?.name === spec.name ? ok(`맵 이름 「${spec.name}」`) : no(`맵 이름 「${after.maps?.[spec.mapId]?.name}」 — 기대 「${spec.name}」`);
  },
  /** 사람 이름: 이벤트 이름이 바뀌고, 그 사람 대사의 화자 칸에 옛 이름이 남지 않는다. */
  eventRenamed(spec, before, after) {
    const was = eventOf(before, spec.mapId, spec.eventId), now = eventOf(after, spec.mapId, spec.eventId);
    if (!was || !now) return no(`${spec.eventId} 가 없다`);
    if (now.name !== spec.name) return no(`이름 「${now.name}」 — 기대 「${spec.name}」`);
    const stale = allCommands(now).filter(command => command.kind === 'text' && command.speaker === was.name);
    if (stale.length) return no(`대사 화자 칸에 옛 이름 「${was.name}」이 ${stale.length}줄 남았다`);
    if (now.x !== was.x || now.y !== was.y) return no('이름을 바꾸면서 자리가 바뀌었다');
    return ok(`「${was.name}」 → 「${now.name}」`);
  },
  /** 맵 배경 음악: 다른 맵과 같은 곡(sameAsMap) 또는 실제로 있는 곡이 새로 걸린다. */
  mapBgm(spec, before, after) {
    const was = before.maps?.[spec.mapId]?.bgm?.resourceId, now = after.maps?.[spec.mapId]?.bgm?.resourceId;
    if (typeof now !== 'string' || !now) return no('맵에 배경 음악이 없다');
    if (now === was) return no(`배경 음악이 그대로다(${now})`);
    if (spec.sameAsMap) {
      const want = before.maps?.[spec.sameAsMap]?.bgm?.resourceId;
      return now === want ? ok(`${now}`) : no(`${now} — 기대 ${want}(${mapName(before, spec.sameAsMap)}의 곡)`);
    }
    return listAudioResources('music', after as never).some(track => track.id === now) ? ok(`${now}`) : no(`${now} 는 곡 목록에 없는 id 다`);
  },
  /** 부딪히거나 말을 걸면 전투가 시작되는 새 이벤트. troop 은 실제로 있고 구성이 맞아야 한다. */
  battleEvent(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    if (!fresh.length) return no('새 이벤트가 없다');
    const troops = new Map<string, any>((after.database?.troops ?? []).map((troop: any) => [troop.id, troop]));
    const enemies = new Map<string, any>((after.database?.enemies ?? []).map((enemy: any) => [enemy.id, enemy]));
    const notes: string[] = [];
    for (const { mapId, event } of fresh) {
      const label = event.name ?? event.id;
      const fights = interact(event, freshSession(), after).battles;
      if (!fights.length) { notes.push(`${label}: 부딪히거나 말을 걸어도 전투가 시작되지 않는다`); continue; }
      if (!triggerKinds(event).some(kind => ['action', 'playerTouch', 'eventTouch'].includes(kind))) { notes.push(`${label}: 접촉·조사로 열리지 않는다`); continue; }
      const troop = troops.get(fights[0].troopId);
      if (!troop) { notes.push(`${label}: troop ${fights[0].troopId} 가 자료집에 없다`); continue; }
      const members: string[] = (troop.members?.length ? troop.members.map((member: any) => member.enemyId) : troop.enemyIds) ?? [];
      if (!members.length || members.some(id => !enemies.has(id))) { notes.push(`${label}: troop 「${troop.name}」에 적이 없거나 없는 적을 가리킨다`); continue; }
      if (spec.members && members.length !== spec.members) { notes.push(`${label}: 적 ${members.length}마리 — 기대 ${spec.members}`); continue; }
      if (spec.enemyName && !members.every(id => String(enemies.get(id).name).includes(spec.enemyName))) { notes.push(`${label}: 적 ${members.map(id => enemies.get(id).name).join(',')} — 모두 「${spec.enemyName}」여야 한다`); continue; }
      if (spec.visible !== false && !hasSprite(event)) { notes.push(`${label}: 적 그림이 없다`); continue; }
      if (!passable(after, mapId, event.x, event.y)) { notes.push(`${label}: 선 칸 (${event.x},${event.y})이 막힌 칸`); continue; }
      return ok(`${label} @ ${where(after, mapId, event)} — ${troop.name} (${members.length})`);
    }
    return no(notes.join(' / '));
  },
  /** 조건이 맞을 때만 다른 글: 후보 이벤트 중 하나가, 그 아이템을 갖고 있으면 새 글을 내고 없으면 옛 글을 낸다. */
  itemGatedText(spec, before, after) {
    const itemIds = itemIdsByName(after, spec.itemName);
    if (!itemIds.length) return no(`자료집에 「${spec.itemName}」 아이템이 없다`);
    const notes: string[] = [];
    for (const eventId of spec.eventIds as string[]) {
      const now = eventOf(after, spec.mapId, eventId), was = eventOf(before, spec.mapId, eventId);
      if (!now) { notes.push(`${eventId} 없음`); continue; }
      const label = `${now.name ?? eventId}(${now.x},${now.y})`;
      const withItem = itemIds.some(id => interact(now, freshSession({ [id]: 1 }), after).texts.some(body => includesPhrase(body, spec.say)));
      if (!withItem) { notes.push(`${label}: 「${spec.itemName}」을 갖고 있어도 「${spec.say}」가 나오지 않는다`); continue; }
      const without = interact(now, freshSession(), after).texts;
      if (without.some(body => includesPhrase(body, spec.say))) { notes.push(`${label}: 열쇠가 없어도 「${spec.say}」가 나온다`); continue; }
      if (spec.keep && !without.some(body => includesPhrase(body, spec.keep))) { notes.push(`${label}: 열쇠가 없을 때의 옛 글 「${spec.keep}」이 사라졌다`); continue; }
      if (was && (was.x !== now.x || was.y !== now.y)) { notes.push(`${label}: 문의 자리가 바뀌었다`); continue; }
      return ok(`${label} — 열쇠 있으면 「${spec.say}」, 없으면 「${spec.keep ?? '-'}」`);
    }
    return no(notes.join(' / '));
  },
  /** 빈 곳 꾸미기: 타일이 바뀐 칸이 minCells 이상이고, rect 를 주면 대부분(insideShare) 그 안이다. 사람·시작 칸을 막지 않는다. */
  dressed(spec, before, after) {
    const a = before.maps?.[spec.mapId], b = after.maps?.[spec.mapId];
    if (!a || !b) return no(`맵 ${spec.mapId} 가 없다`);
    if (a.width !== b.width || a.height !== b.height) return no(`맵 크기가 바뀌었다 ${a.width}x${a.height} → ${b.width}x${b.height}`);
    const changed = new Set<number>();
    for (const key of ['lowerTiles', 'upperTiles', 'lowerOverlayTiles', 'upperOverlayTiles', 'lowerTileStacks', 'upperTileStacks']) {
      const left: unknown[] = a[key] ?? [], right: unknown[] = b[key] ?? [];
      for (let i = 0; i < a.width * a.height; i++) if (JSON.stringify(left[i] ?? -1) !== JSON.stringify(right[i] ?? -1)) changed.add(i);
    }
    const cells = [...changed].map(i => ({ x: i % a.width, y: Math.floor(i / a.width) }));
    // 이벤트로 놓은 소품도 꾸미기로 센다(보이는 새 이벤트).
    const props = newEvents(before, after, spec.mapId).filter(({ event }) => hasSprite(event)).map(({ event }) => ({ x: event.x, y: event.y }));
    const all = [...cells, ...props];
    if (all.length < spec.minCells) return no(`바뀐 칸 ${all.length} — ${spec.minCells}칸 이상이어야 한다`);
    if (spec.maxCells && all.length > spec.maxCells) return no(`바뀐 칸 ${all.length} — 맵을 통째로 다시 깐 수준이다(상한 ${spec.maxCells})`);
    if (spec.rect) {
      const inside = all.filter(cell => inRect(spec.rect, cell)).length;
      if (inside < spec.minCells) return no(`기대 구역 안에서 바뀐 칸 ${inside} — ${spec.minCells}칸 이상이어야 한다`);
      if (inside / all.length < (spec.insideShare ?? 0.8)) return no(`바뀐 칸 ${all.length} 중 구역 안 ${inside} — 다른 곳을 너무 많이 건드렸다`);
    }
    const stand = [...eventsOf(before, spec.mapId).filter(event => hasSprite(event) && passable(before, spec.mapId, event.x, event.y)).map(event => ({ x: event.x, y: event.y, label: event.name ?? event.id })),
      ...(before.startMapId === spec.mapId ? [{ ...before.startPos, label: '시작 칸' }] : [])];
    const buried = stand.filter(cell => !passable(after, spec.mapId, cell.x, cell.y));
    if (buried.length) return no(`막힌 칸이 된 자리: ${buried.map(cell => `${cell.label}(${cell.x},${cell.y})`).join(', ')}`);
    return ok(`바뀐 칸 ${cells.length} · 새 소품 이벤트 ${props.length}`);
  },
};
/** 모든 판정 종류: 첫 묶음(이 파일) + 둘째 묶음(자료·설정, 말 걸기·장면). 이름이 겹치면 안 된다. */
const ALL_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = { ...KINDS, ...DATA_KINDS, ...PLAY_KINDS };
if (Object.keys(ALL_KINDS).length !== Object.keys(KINDS).length + Object.keys(DATA_KINDS).length + Object.keys(PLAY_KINDS).length) throw Error('판정 종류 이름이 겹친다');
export const CHECK_KINDS = Object.keys(ALL_KINDS);

// ── 시키지 않은 파괴 ────────────────────────────────────────────────────────
/** 맵 밖에서 바뀐 것(타이틀·오프닝·엔딩·퀘스트·청사진·자료집·그림)을 칸 이름으로 적는다 — 요청이 스스로 요구하는 칸(expected)은 뺀다. */
function projectSideEdits(before: Doc, after: Doc, expected: RegExp | undefined): string[] {
  const out: string[] = [];
  const note = (label: string) => { if (!expected?.test(label)) out.push(`${label} 바뀜`); };
  for (const key of ['endings', 'quests', 'gameBlueprint', 'storyFlags', 'commonEvents', 'worldGraph', 'mapConnections', 'mapTree']) if (!isDeepStrictEqual(before[key], after[key])) note(key);
  for (const key of new Set([...Object.keys(before.system ?? {}), ...Object.keys(after.system ?? {})])) if (!isDeepStrictEqual(before.system?.[key], after.system?.[key])) note(`system.${key}`);
  for (const key of ['switches', 'variables']) {
    const delta = (after[key]?.length ?? 0) - (before[key]?.length ?? 0);
    if (delta !== 0 && !expected?.test(key)) out.push(`${key} ${delta > 0 ? '+' : ''}${delta}`);
  }
  for (const table of new Set([...Object.keys(before.database ?? {}), ...Object.keys(after.database ?? {})])) {
    const a = before.database?.[table], b = after.database?.[table];
    if (isDeepStrictEqual(a, b) || expected?.test(`database.${table}`)) continue;
    const delta = (Array.isArray(b) ? b.length : 0) - (Array.isArray(a) ? a.length : 0);
    out.push(`자료집 ${table} ${delta ? `${delta > 0 ? '+' : ''}${delta}` : '내용 바뀜'}`);
  }
  // 공용 라이브러리 그림(shared_*)은 편집기가 첫 저장 뒤에 설치한다 — 조수가 만든 것이 아니다.
  // 새 사람의 얼굴 그림(appearance-*)은 사람을 세우는 일의 일부다.
  const images = Object.keys(after.assets?.uploaded ?? {}).filter(id => !id.startsWith('shared_') && !id.startsWith('appearance-') && !before.assets?.uploaded?.[id]);
  if (images.length) out.push(`새 그림·소리 ${images.length}개(${images.slice(0, 3).join(', ').slice(0, 90)})`);
  return out;
}
/** 요청 자체가 건드리는 맵 밖 칸 — 그 종류의 일에서는 부수 변경으로 세지 않는다. */
const EXPECTED_SIDE: Record<string, RegExp> = {
  gameTitle: /^system\.titleScreen$/u,
  battleEvent: /^(switches|database\.(troops|enemies))$/u,
  giveOnce: /^(switches|commonEvents|database\.items)$/u,
  transferLink: /^(mapConnections|worldGraph|mapTree)$/u,
  itemGatedText: /^switches$/u,
  shop: /^(switches|system\.peopleChipLock|database\.characterAppearances)$/u,
  newNpc: /^(system\.peopleChipLock|database\.characterAppearances)$/u,
};

/** 둘째 묶음의 종류는 요청마다 건드리는 칸이 달라서(자료집 표·설정 칸) 판정 인자에서 만든다. */
function expectedSide(spec: CheckSpec): RegExp | undefined {
  return EXPECTED_SIDE[spec.kind] ?? DATA_SIDE[spec.kind]?.(spec) ?? PLAY_SIDE[spec.kind];
}

function damageOf(before: Doc, after: Doc, allow: Allow, spec: CheckSpec, targets: ReadonlySet<string>): { damage: string[]; sideEdits: string[] } {
  const kind = spec.kind;
  const damage: string[] = [], sideEdits: string[] = [];
  const beforeMaps = Object.keys(before.maps ?? {}), afterMaps = Object.keys(after.maps ?? {});
  for (const id of beforeMaps) if (!after.maps?.[id]) damage.push(`맵 「${mapName(before, id)}」 삭제`);
  const added = afterMaps.filter(id => !before.maps?.[id]);
  if (added.length > (allow.newMaps ?? 0)) damage.push(`새 맵 ${added.length}장(${added.map(id => mapName(after, id)).join(', ').slice(0, 80)}) — 허용 ${allow.newMaps ?? 0}`);
  for (const id of beforeMaps) {
    if (!after.maps?.[id]) continue;
    if (mapName(before, id) !== mapName(after, id) && !(allow.renamedMaps ?? []).includes(id)) damage.push(`맵 이름 「${mapName(before, id)}」 → 「${mapName(after, id)}」`);
    for (const was of eventsOf(before, id)) {
      const now = eventOf(after, id, was.id), label = `${mapName(before, id)}의 ${was.name ?? was.id}`;
      if (!now) { if (!(allow.removedEvents ?? []).includes(was.id)) damage.push(`${label} 삭제`); continue; }
      if ((now.x !== was.x || now.y !== was.y) && !(allow.movedEvents ?? []).includes(was.id)) damage.push(`${label} 이동 (${was.x},${was.y})→(${now.x},${now.y})`);
      // 요청이 가리킨 이벤트 자신의 내용 변경은 부수 변경이 아니다.
      // 프로젝트 전체의 글을 바꾸는 일(anyEvent)은 모든 이벤트가 대상이다.
      else if (spec.anyEvent !== true && !targets.has(was.id) && (!isDeepStrictEqual(was.pages, now.pages) || was.name !== now.name)) sideEdits.push(`${label} 내용 바뀜`);
    }
  }
  if ((before.meta?.title ?? '') !== (after.meta?.title ?? '') && !allow.title) damage.push(`게임 제목 「${before.meta?.title}」 → 「${after.meta?.title}」`);
  if (!allow.startPos && (before.startMapId !== after.startMapId || !isDeepStrictEqual(before.startPos, after.startPos))) damage.push(`시작 위치 ${before.startMapId}(${before.startPos?.x},${before.startPos?.y}) → ${after.startMapId}(${after.startPos?.x},${after.startPos?.y})`);
  // 새로 생긴 이벤트 수(요청이 만든 것 포함)와 맵 밖 변경.
  const fresh = newEvents(before, after).length;
  // 두 맵을 잇는 일은 이동 이벤트 한 쌍이 정상이다.
  if (fresh > (kind === 'transferLink' ? 2 : 1)) sideEdits.push(`새 이벤트 ${fresh}개`);
  sideEdits.push(...projectSideEdits(before, after, expectedSide(spec)));
  return { damage, sideEdits };
}

export function runCheck(spec: CheckSpec, allow: Allow | undefined, before: Project, after: Project): Verdict {
  const kind = ALL_KINDS[spec.kind];
  if (!kind) throw Error(`없는 판정 종류: ${spec.kind}`);
  let outcome: Result;
  try { outcome = kind(spec, before as unknown as Doc, after as unknown as Doc); }
  catch (error) { outcome = no(`판정 실행 오류: ${error instanceof Error ? error.message : String(error)}`); }
  const targets = new Set([spec.eventId, ...(spec.eventIds ?? [])].filter((id): id is string => !!id));
  const { damage, sideEdits } = damageOf(before as unknown as Doc, after as unknown as Doc, allow ?? {}, spec, targets);
  const pass = outcome.ok && damage.length === 0;
  const reason = pass ? outcome.note : !outcome.ok ? outcome.note : `요청한 결과는 있다(${outcome.note}) — 그런데 ${damage.join(' · ')}`;
  return { pass, reason: !outcome.ok && damage.length ? `${reason} · 게다가 ${damage.join(' · ')}` : reason, outcome, damage, sideEdits };
}
