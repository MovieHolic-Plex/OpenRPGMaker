// 셋째 묶음(JRPG 가 아닌 게임의 장치)의 판정 — 자료·설정·맵에 놓는 것: 밭·작물·낚시터·제작대·시간표·판매가·보관 상자·은신처·밀 수 있는 물건·
// 추격자·즉사 함정·액션 전투·HUD 게이지·시야 전투. 말 걸기를 길마다 따라가야 아는 것(증거 내밀기·호감·엔딩 갈래·암호…)은 checksGenrePlay.ts 에 있다.
// 앞 묶음과 같은 규칙: 저장 문서 전/후만 본다. 어느 도구로 했는지는 보지 않는다.
import { entryRuns } from './checksData';
import { activePage, cellFree, cheb, eventOf, eventsOf, freshSession, hasSprite, inBounds, interact, itemIdsByName, newEvents, no, ok, pagesOf, passable, playPaths, squash, visibleAt, where,
  type CheckSpec, type Doc, type Ev, type Play, type Result } from './checkSupport';

export const label = (event: Ev): string => event.name ?? event.id;
/** 그 칸이나 네 이웃 칸 중 하나는 걸을 수 있다(조사하러 다가갈 수 있다). */
export const approachable = (doc: Doc, mapId: string, event: Ev): boolean => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => passable(doc, mapId, event.x + dx!, event.y + dy!));
/** 게임을 시작할 때의 변수 값을 든 새 상태(시작 상태에 적힌 값은 장치의 일부다 — 꽃잎 5장, 배고픔 100). */
export const startSession = (doc: Doc, more: Record<string, unknown> = {}): any => Object.assign(freshSession(), { variables: { ...(doc.session?.variables ?? {}) }, ...more });
const itemName = (doc: Doc, id: unknown): string => String((doc.database?.items ?? []).find((item: any) => item.id === id)?.name ?? '');
const sameName = (a: unknown, b: unknown): boolean => squash(a) === squash(b);
const troopMembers = (troop: any): string[] => (troop?.members?.length ? troop.members.map((member: any) => member.enemyId) : troop?.enemyIds) ?? [];
const kills = (play: Play): boolean => play.ended?.kind === 'gameOver';
const touchKinds = ['playerTouch', 'eventTouch', 'touch'];
/** 새로 놓은 것 가운데 조건에 맞는 첫 이벤트 — 안 맞는 까닭을 모아 돌려준다. */
function firstNew(before: Doc, after: Doc, mapId: string | undefined, test: (mapId: string, event: Ev) => string | null): Result & { hit?: { mapId: string; event: Ev } } {
  const fresh = newEvents(before, after, mapId);
  if (!fresh.length) return no('새 이벤트가 없다');
  const notes: string[] = [];
  for (const entry of fresh) {
    const bad = test(entry.mapId, entry.event);
    if (!bad) return { ...ok(`${label(entry.event)} @ ${where(after, entry.mapId, entry.event)}`), hit: entry };
    notes.push(`${label(entry.event)}: ${bad}`);
  }
  return no(notes.join(' / '));
}
const standNote = (doc: Doc, mapId: string, event: Ev): string | null => (!visibleAt(doc, mapId, event) ? '그 칸에 보이는 것이 없다' : !approachable(doc, mapId, event) ? `(${event.x},${event.y})에 다가갈 수 없다` : !cellFree(doc, mapId, event) ? `(${event.x},${event.y})에 다른 이벤트` : null);

export const GENRE_KINDS: Record<string, (spec: CheckSpec, before: Doc, after: Doc) => Result> = {
  /** 밭: 그 맵의 경작 가능 칸이 minCells~maxCells, 모두 걸을 수 있는 빈 칸. */
  farmPlot(spec, before, after) {
    const map = after.maps?.[spec.mapId];
    if (!map) return no(`맵 ${spec.mapId} 가 없다`);
    const cells = new Set<string>();
    for (const rect of (map.farmableArea ?? []) as Array<{ x: number; y: number; w: number; h: number }>) for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) cells.add(`${x},${y}`);
    if (!cells.size) return no(`${map.name}에 경작 가능 영역(farmableArea)이 없다`);
    if (cells.size < spec.minCells || cells.size > spec.maxCells) return no(`밭 ${cells.size}칸 — ${spec.minCells}~${spec.maxCells}칸이어야 한다`);
    const bad = [...cells].map(key => key.split(',').map(Number) as [number, number]).filter(([x, y]) => !inBounds(after, spec.mapId, x, y) || !passable(after, spec.mapId, x, y) || eventsOf(after, spec.mapId).some(event => event.x === x && event.y === y && hasSprite(event)));
    if (bad.length) return no(`밭 칸 ${bad.slice(0, 4).map(([x, y]) => `(${x},${y})`).join(' ')} 이(가) 맵 밖·막힌 칸·사람이 선 칸이다`);
    if (after.startMapId === spec.mapId && cells.has(`${after.startPos?.x},${after.startPos?.y}`)) return no('시작 칸이 밭 안이다');
    return ok(`${map.name} 밭 ${cells.size}칸`);
  },
  /** 작물: 새 작물 기록 — 씨앗·수확 아이템의 이름과 자라는 날 수(단계 합). */
  cropDefined(spec, before, after) {
    const had = new Set((before.database?.crops ?? []).map((crop: any) => crop.id));
    const crops: any[] = (after.database?.crops ?? []).filter((crop: any) => !had.has(crop.id));
    if (!crops.length) return no('자료집에 새 작물이 없다');
    const notes: string[] = [];
    for (const crop of crops) {
      const seed = itemName(after, crop.seedItemId), harvest = itemName(after, crop.harvestItemId);
      const days = (crop.stages ?? []).reduce((sum: number, stage: any) => sum + Number(stage?.days ?? 0), 0);
      if (!sameName(crop.name, spec.name)) { notes.push(`작물 이름 「${crop.name}」 — 기대 「${spec.name}」`); continue; }
      if (!sameName(seed, spec.seed)) { notes.push(`씨앗 아이템 「${seed || crop.seedItemId}」 — 기대 「${spec.seed}」`); continue; }
      if (!sameName(harvest, spec.harvest)) { notes.push(`수확 아이템 「${harvest || crop.harvestItemId}」 — 기대 「${spec.harvest}」`); continue; }
      if (crop.seedItemId === crop.harvestItemId) { notes.push('씨앗과 수확물이 같은 아이템이다'); continue; }
      if (days !== spec.days) { notes.push(`자라는 날 ${days}일 — 기대 ${spec.days}일`); continue; }
      return ok(`작물 「${crop.name}」: ${seed} → ${days}일 → ${harvest}`);
    }
    return no(notes.join(' / '));
  },
  /** 낚시터: 낚시가 켜져 있고 그 맵에 낚시터가 있으며, 그 이름의 물고기(아이템)가 낚인다. */
  fishingSpot(spec, _before, after) {
    const fishing = after.system?.fishing;
    if (!fishing?.enabled) return no('낚시 시스템(system.fishing)이 꺼져 있다');
    const spots: any[] = (fishing.spots ?? []).filter((spot: any) => spot.mapId === spec.mapId);
    if (!spots.length) return no(`${after.maps?.[spec.mapId]?.name ?? spec.mapId}에 낚시터가 없다`);
    const species = new Map<string, any>((after.database?.fishSpecies ?? []).map((fish: any) => [fish.id, fish]));
    const notes: string[] = [];
    for (const spot of spots) {
      const area = spot.area ?? {};
      if (!(area.w >= 1 && area.h >= 1) || !inBounds(after, spec.mapId, area.x, area.y) || !inBounds(after, spec.mapId, area.x + area.w - 1, area.y + area.h - 1)) { notes.push(`낚시터 ${spot.id}: 영역이 맵 밖이다`); continue; }
      const names = (spot.catches ?? []).map((entry: any) => species.get(entry.fishId)).filter(Boolean).map((fish: any) => itemName(after, fish.itemId));
      if (!names.some((name: string) => name && squash(name).includes(squash(spec.fish)))) { notes.push(`낚시터 ${spot.id}: 「${spec.fish}」이(가) 낚이지 않는다(낚이는 것: ${names.join(', ') || '없음'})`); continue; }
      return ok(`낚시터 ${spot.id} (${area.x},${area.y} ${area.w}×${area.h}) — ${names.join(', ')}`);
    }
    return no(notes.join(' / '));
  },
  /** 제작대: 그 재료 → 그 산출의 제작법이 있고, 새로 세운(또는 가리킨) 이벤트에 말을 걸면 제작 창이 열리거나 그 제작이 돈다. */
  craftStation(spec, before, after) {
    const ids = (name: string): string[] => itemIdsByName(after, name);
    const recipe = ((after.system?.craftRecipes ?? []) as any[]).find(entry => {
      const inputs: any[] = entry.ingredients ?? [];
      return ids(spec.output.name).includes(entry.outputItemId) && (entry.outputCount ?? 1) === (spec.output.count ?? 1) && inputs.length === spec.inputs.length
        && (spec.inputs as Array<{ name: string; count: number }>).every(want => inputs.some(input => ids(want.name).includes(input.itemId) && input.count === want.count));
    });
    if (!recipe) return no(`제작법이 없다: ${(spec.inputs as any[]).map(input => `${input.name}×${input.count}`).join(' + ')} → ${spec.output.name}×${spec.output.count ?? 1} (지금 ${(after.system?.craftRecipes ?? []).length}건)`);
    const opens = (event: Ev): boolean => playPaths(event, freshSession, after).some(path => path.ran.some(command => (command.kind === 'openCraftShop' && (!command.recipeIds?.length || command.recipeIds.includes(recipe.id))) || (command.kind === 'craftRecipe' && command.recipeId === recipe.id)));
    if (spec.eventId) {
      const now = eventOf(after, spec.mapId, spec.eventId);
      return !now ? no(`${spec.eventId} 가 없다`) : opens(now) ? ok(`${label(now)} — 제작법 ${recipe.id}`) : no(`${label(now)}: 말을 걸어도 제작 창이 열리지 않는다`);
    }
    const found = firstNew(before, after, spec.mapId, (mapId, event) => (!opens(event) ? '말을 걸어도 제작 창이 열리지 않는다' : standNote(after, mapId, event)));
    return found.ok ? ok(`${found.note} — 제작법 ${recipe.id}`) : found;
  },
  /** 시간표: 시간 시스템이 켜져 있고, 그 사람이 그 시간대에 기준 이벤트 곁(max 칸 안)의 걸을 수 있는 칸으로 간다. */
  npcSchedule(spec, before, after) {
    if (!after.system?.timeSystem?.enabled) return no('시간 시스템이 꺼져 있다 — 시간표가 돌지 않는다');
    const now = eventOf(after, spec.mapId, spec.eventId), anchor = eventOf(after, spec.mapId, spec.near.eventId);
    if (!now || !anchor) return no(`${!now ? spec.eventId : spec.near.eventId} 가 없다`);
    const hour = spec.phase === 'night' ? 23 : spec.phase === 'morning' ? 7 : spec.phase === 'evening' ? 18 : 12;
    const entries: any[] = (now.schedule ?? []).filter((entry: any) => entry?.when?.timePhase === spec.phase || (Array.isArray(entry?.when?.hourRange) && entry.when.hourRange[0] <= hour && hour < entry.when.hourRange[1]));
    if (!entries.length) return no(`${label(now)}: ${spec.phase} 시간표가 없다(지금 ${(now.schedule ?? []).length}줄)`);
    const notes: string[] = [];
    for (const entry of entries) {
      const at = entry.at ?? {}, mapId = at.mapId ?? spec.mapId;
      if (mapId !== spec.mapId) { notes.push('다른 맵으로 간다'); continue; }
      const d = cheb(anchor, at);
      if (d < 1 || d > (spec.near.max ?? 2)) { notes.push(`(${at.x},${at.y})는 ${label(anchor)}(${anchor.x},${anchor.y})에서 ${d}칸 — ${spec.near.max ?? 2}칸 안이어야 한다`); continue; }
      if (!passable(after, mapId, at.x, at.y)) { notes.push(`(${at.x},${at.y})는 막힌 칸이다`); continue; }
      const was = eventOf(before, spec.mapId, spec.eventId);
      if (was && (was.x !== now.x || was.y !== now.y)) { notes.push('낮의 자리까지 옮겼다'); continue; }
      return ok(`${label(now)}: ${spec.phase} → (${at.x},${at.y}), ${label(anchor)} 곁`);
    }
    return no(notes.join(' / '));
  },
  /** 판매가: 그 아이템을 팔 때 받는 값. */
  sellPrice(spec, before, after) {
    const ids = itemIdsByName(after, spec.item);
    if (!ids.length) return no(`자료집에 「${spec.item}」 아이템이 없다`);
    const row = ((after.system?.sellPrices ?? []) as any[]).find(entry => ids.includes(entry.itemId));
    if (!row) return no(`판매가 표에 「${spec.item}」이 없다`);
    if (row.price !== spec.price) return no(`「${spec.item}」 판매가 ${row.price} — 기대 ${spec.price}`);
    if (((before.system?.sellPrices ?? []) as any[]).some(entry => ids.includes(entry.itemId) && entry.price === spec.price)) return no('판매가가 그대로다');
    return ok(`「${spec.item}」 판매가 ${row.price}G`);
  },
  /** 보관 상자: 새로 놓은 보이는 이벤트를 조사하면 넣고 꺼내는 창이 열린다 — 두 번째에도. */
  storageChest(spec, before, after) {
    return firstNew(before, after, spec.mapId, (mapId, event) => {
      const session = freshSession();
      const opens = (): boolean => interact(event, session, after).ran.some(command => command.kind === 'openChest');
      return !opens() ? '조사해도 보관 창(openChest)이 열리지 않는다' : !opens() ? '두 번째로 조사하면 열리지 않는다' : standNote(after, mapId, event);
    });
  },
  /** 은신처: 새로 놓은 보이는 이벤트의 처음 상태가 「숨는 곳」이다(대사로 흉내 낸 것은 아니다). */
  hidingSpot(spec, before, after) {
    return firstNew(before, after, spec.mapId, (mapId, event) => {
      const page = activePage(event, freshSession())?.page;
      return page?.interaction?.kind !== 'hiding' ? `숨는 곳이 아니다(interaction ${page?.interaction?.kind ?? '없음'})` : standNote(after, mapId, event);
    });
  },
  /** 밀 수 있는 물건: 새로 놓은 보이는 이벤트가 밀리고, 밀 방향이 하나는 트여 있다(선 칸·맞은편 칸이 걸을 수 있다). */
  pushable(spec, before, after) {
    return firstNew(before, after, spec.mapId, (mapId, event) => {
      const page = activePage(event, freshSession())?.page;
      if (page?.interaction?.kind !== 'pushable') return `밀 수 없다(interaction ${page?.interaction?.kind ?? '없음'})`;
      if (!hasSprite(event)) return '물건 그림이 없다(투명)';
      if (!passable(after, mapId, event.x, event.y) || !cellFree(after, mapId, event)) return `선 칸 (${event.x},${event.y})이 막혔거나 겹친다`;
      const open = [[1, 0], [0, 1]].some(([dx, dy]) => passable(after, mapId, event.x + dx!, event.y + dy!) && passable(after, mapId, event.x - dx!, event.y - dy!));
      return open ? null : '어느 쪽으로도 밀 수 없는 자리다';
    });
  },
  /**
   * 쫓아오는 것: 새로 놓은 보이는 이벤트가 주인공을 쫓고(movement chase) 닿으면 게임 오버.
   * armedBy{item} 면 처음에는 쫓지 않고, 새로 놓인 그 아이템을 주운 뒤부터 쫓는다(줍기는 한 번만).
   */
  chaser(spec, before, after) {
    const fresh = newEvents(before, after, spec.mapId);
    const chasers = fresh.filter(({ event }) => pagesOf(event).some(page => page.movement?.type === 'chase'));
    if (!chasers.length) return no(fresh.length ? '새 이벤트 가운데 쫓아오는 것(movement chase)이 없다' : '새 이벤트가 없다');
    const hunting = (event: Ev, session: any): string | null => {
      const active = activePage(event, session);
      if (active?.page.movement?.type !== 'chase') return '쫓지 않는다';
      if (!touchKinds.includes(active.trigger)) return `닿아서 발동하지 않는다(${active.trigger})`;
      return kills(interact(event, structuredClone(session), after, { halt: true })) ? null : '닿아도 게임 오버가 되지 않는다';
    };
    const itemIds = spec.armedBy ? itemIdsByName(after, spec.armedBy.item) : [];
    if (spec.armedBy && !itemIds.length) return no(`자료집에 「${spec.armedBy.item}」 아이템이 없다`);
    const notes: string[] = [];
    for (const { mapId, event } of chasers) {
      if (!hasSprite(event)) { notes.push(`${label(event)}: 그림이 없다(투명)`); continue; }
      if (!passable(after, mapId, event.x, event.y)) { notes.push(`${label(event)}: 선 칸 (${event.x},${event.y})이 막힌 칸`); continue; }
      if (after.startMapId === mapId && cheb(after.startPos, event) < 3) { notes.push(`${label(event)}: 시작 칸 바로 곁이다`); continue; }
      if (!spec.armedBy) {
        const bad = hunting(event, freshSession());
        if (bad) { notes.push(`${label(event)}: ${bad}`); continue; }
        return ok(`${label(event)} @ ${where(after, mapId, event)} — 쫓아와 닿으면 게임 오버`);
      }
      if (!hunting(event, freshSession())) { notes.push(`${label(event)}: 「${spec.armedBy.item}」을 줍기 전부터 쫓아온다`); continue; }
      const gain = (play: Play): number => itemIds.reduce((sum, id) => sum + (play.items[id] ?? 0), 0);
      const pickup = fresh.find(({ event: other }) => other.id !== event.id && gain(interact(other, freshSession(), after)) === 1);
      if (!pickup) { notes.push(`「${spec.armedBy.item}」을 하나 주는 새 이벤트가 없다`); continue; }
      const session = freshSession();
      interact(pickup.event, session, after);
      if (gain(interact(pickup.event, session, after)) !== 0) { notes.push(`${label(pickup.event)}: 다시 조사하면 또 준다`); continue; }
      if (!visibleAt(after, pickup.mapId, pickup.event)) { notes.push(`${label(pickup.event)}: 그 칸에 보이는 것이 없다`); continue; }
      const bad = hunting(event, session);
      if (bad) { notes.push(`${label(event)}: 「${spec.armedBy.item}」을 주운 뒤에도 ${bad}`); continue; }
      return ok(`${label(event)} @ ${where(after, mapId, event)} — ${label(pickup.event)}에서 「${spec.armedBy.item}」을 주운 뒤부터 쫓아온다`);
    }
    return no(notes.join(' / '));
  },
  /** 즉사 함정: 새로 놓은 이벤트를 밟으면 게임 오버. checkpoint 면 그 맵에 들어설 때 체크포인트가 남는다(죽으면 거기서 다시). */
  deathTrap(spec, before, after) {
    const found = firstNew(before, after, spec.mapId, (mapId, event) => {
      const active = activePage(event, freshSession());
      if (!active || !['playerTouch', 'touch'].includes(active.trigger)) return `밟아서 발동하지 않는다(${active?.trigger ?? '페이지 없음'})`;
      if (!kills(interact(event, freshSession(), after, { halt: true }))) return '밟아도 게임 오버가 되지 않는다';
      if (!passable(after, mapId, event.x, event.y)) return `(${event.x},${event.y})는 밟을 수 없는 칸이다`;
      return after.startMapId === mapId && after.startPos?.x === event.x && after.startPos?.y === event.y ? '시작 칸에 놓였다' : null;
    });
    if (!found.ok || !spec.checkpoint) return found;
    const saves = entryRuns(after, spec.mapId, freshSession()).some(({ play }) => play.ran.some(command => command.kind === 'checkpointSave'));
    return saves ? ok(`${found.note} · 들어설 때 체크포인트`) : no(`함정은 있다(${found.note}) — 그런데 맵에 들어설 때 체크포인트(checkpointSave)가 남지 않는다`);
  },
  /** 그 맵은 실시간 액션 전투다: 액션 전투가 켜져 있고 그 맵이 옵트인이다. */
  actionMap(spec, _before, after) {
    if (!after.system?.actionCombat?.enabled) return no('액션 전투(system.actionCombat)가 꺼져 있다');
    return after.maps?.[spec.mapId]?.actionCombat === true ? ok(`${after.maps[spec.mapId].name}: 액션 전투`) : no(`${after.maps?.[spec.mapId]?.name ?? spec.mapId} 맵이 액션 전투로 바뀌지 않았다`);
  },
  /** 실시간으로 덤비는 적: 액션 전투 맵 + 그 이름의 적이 든 부대의 필드 스폰(동시에 count 마리 이상), 그 적에 액션 프로필. */
  actionSpawn(spec, before, after) {
    const map = after.maps?.[spec.mapId];
    if (!after.system?.actionCombat?.enabled || map?.actionCombat !== true) return no('그 맵이 액션 전투가 아니다');
    const had = new Set(((before.maps?.[spec.mapId]?.fieldSpawns ?? []) as any[]).map(spawn => spawn.id));
    const troops = new Map<string, any>((after.database?.troops ?? []).map((troop: any) => [troop.id, troop]));
    const enemies = new Map<string, any>((after.database?.enemies ?? []).map((enemy: any) => [enemy.id, enemy]));
    const spawns = ((map.fieldSpawns ?? []) as any[]).filter(spawn => !had.has(spawn.id));
    if (!spawns.length) return no('새 필드 스폰이 없다');
    let alive = 0;
    for (const spawn of spawns) {
      const lead = enemies.get(troopMembers(troops.get(spawn.troopId))[0] ?? '');
      if (!lead || !String(lead.name).includes(spec.enemyName)) return no(`스폰 ${spawn.id}: 부대 ${spawn.troopId} 의 첫 적이 「${spec.enemyName}」이 아니다(${lead?.name ?? '없음'})`);
      if (!lead.actionProfile) return no(`「${lead.name}」에 액션 프로필(actionProfile)이 없다 — 실시간으로 덤비지 않는다`);
      const area = spawn.area ?? {};
      if (!inBounds(after, spec.mapId, area.x, area.y) || !inBounds(after, spec.mapId, area.x + area.w - 1, area.y + area.h - 1)) return no(`스폰 ${spawn.id}: 영역이 맵 밖이다`);
      alive += spawn.maxAlive ?? 1;
    }
    return alive >= spec.count ? ok(`${map.name}: 「${spec.enemyName}」 스폰 ${spawns.length}곳 · 동시에 ${alive}마리`) : no(`동시에 ${alive}마리 — ${spec.count}마리 이상이어야 한다`);
  },
  /** 눈이 마주치면 싸움: 새로 세운 보이는 이벤트가 시야에 든 주인공에게 다가와(시야 조우 또는 추격) 전투를 건다. */
  sightBattle(spec, before, after) {
    const troops = new Map<string, any>((after.database?.troops ?? []).map((troop: any) => [troop.id, troop]));
    return firstNew(before, after, spec.mapId, (mapId, event) => {
      const active = activePage(event, freshSession());
      const sees = Number(active?.page.detectionEncounter?.sight?.range ?? 0) >= 2 || (active?.page.movement?.type === 'chase' && touchKinds.includes(active.trigger));
      if (!sees) return '주인공을 보고 다가오지 않는다(시야 조우·추격 없음)';
      const fight = interact(event, freshSession(), after).battles[0];
      if (!fight) return '전투가 시작되지 않는다';
      if (!troopMembers(troops.get(fight.troopId)).length) return `부대 ${fight.troopId} 가 자료집에 없거나 적이 없다`;
      if (!hasSprite(event)) return '그림이 없다(투명)';
      return !passable(after, mapId, event.x, event.y) || !cellFree(after, mapId, event) ? `선 칸 (${event.x},${event.y})이 막혔거나 겹친다` : null;
    });
  },
  /** 화면의 수치 게이지: 변수에 묶인 HUD 위젯이 있고, 그 변수가 게임을 시작할 때 initial 이다. */
  hudGauge(spec, before, after) {
    const widgets: any[] = (after.system?.fieldHud?.widgets ?? []).filter((widget: any) => widget.enabled !== false && widget.source === 'variable' && widget.variableId);
    if (!widgets.length) return no('변수에 묶인 HUD 위젯이 없다');
    const had = new Set(((before.system?.fieldHud?.widgets ?? []) as any[]).map(widget => widget.id));
    const notes: string[] = [];
    for (const widget of widgets) {
      if (had.has(widget.id)) continue;
      const name = String((after.variables ?? []).find((variable: any) => variable.id === widget.variableId)?.name ?? '');
      if (spec.label && !squash(`${widget.label} ${name}`).includes(squash(spec.label))) { notes.push(`위젯 ${widget.id}: 이름표·변수 이름에 「${spec.label}」이 없다`); continue; }
      const session = startSession(after);
      entryRuns(after, after.startMapId, session);
      const value = session.variables[widget.variableId] ?? 0;
      if (value !== spec.initial) { notes.push(`위젯 ${widget.id}: 시작 값 ${value} — 기대 ${spec.initial}`); continue; }
      return ok(`HUD ${widget.kind} 「${widget.label || name}」 = ${value}`);
    }
    return no(notes.join(' / ') || '새 HUD 위젯이 없다');
  },
};

/** 요청 자체가 건드리는 맵 밖 칸(부수 변경으로 세지 않는다). */
export const GENRE_SIDE: Record<string, RegExp> = {
  cropDefined: /^(database\.(crops|items)|system\.timeSystem)$/u,
  fishingSpot: /^(database\.(fishSpecies|items)|system\.fishing)$/u,
  craftStation: /^(system\.(craftRecipes|peopleChipLock)|database\.characterAppearances)$/u,
  npcSchedule: /^system\.timeSystem$/u,
  sellPrice: /^system\.sellPrices$/u,
  chaser: /^(switches|database\.items|system\.fieldHud)$/u,
  deathTrap: /^switches$/u,
  actionMap: /^system\.(actionCombat|fieldHud)$/u,
  actionSpawn: /^(system\.(actionCombat|fieldHud)|database\.(enemies|troops))$/u,
  sightBattle: /^(switches|database\.(enemies|troops)|system\.(genre|peopleChipLock))$/u,
  hudGauge: /^(system\.fieldHud|variables|switches)$/u,
};
