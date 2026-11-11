// 맵 한 장의 «사실»(판정 아님): 걸을 수 있는 칸, 출구(이동 이벤트), 사람, 보이는·안 보이는 이벤트, 걸어서 닿는지, 가장자리의 열린 칸.
// 검수자에게 그림 옆에 주는 것이고, 표시 그림(pictures.ts)이 같은 번호를 쓴다. 저장 문서만 읽는다 — 조수의 말·도구 이름은 보지 않는다.
import { resolveEventPage } from '../../../../project/io';
import type { Project } from '../../../../project/types';
import { blockedOn } from '../matrixNativeSpec';
import { allCommands, cloneDoc, freshSession } from '../smallJobs/checkSupport';

export type FactEvent = {
  /** 표시 그림의 번호표: E 출구 · P 사람 · O 보이는 물건 · F 적 · V 안 보이는 것(글·조사·닿기). */
  tag: string; kind: 'exit' | 'person' | 'object' | 'foe' | 'invisible';
  x: number; y: number; name: string; trigger: string; visible: boolean;
  /** 출구: 도착 맵 이름과 칸. */
  to?: { map: string; x: number; y: number };
  /** 처음 나오는 글 한 줄(있으면). */
  text?: string;
  /** 그 칸(또는 옆 칸)에 걸어서 닿는가 — 가장 큰 걷는 덩어리 기준. */
  reachable: boolean;
  /** 그 칸이 막힌 칸인가(벽·지붕·물 위). */
  onBlocked: boolean;
  edge?: 'north' | 'south' | 'west' | 'east';
};
export type MapFacts = {
  mapId: string; name: string; width: number; height: number; tile: number; tilesetId: string; role: string;
  /** 다른 맵과 이어지지 않은 한 장짜리(견본·한 장 요청)인가 — 그러면 출구가 없는 것은 결함이 아니다. */
  standalone: boolean;
  blocked: Set<string>;
  walkableShare: number;
  /** 가장 큰 걷는 덩어리가 걷는 칸에서 차지하는 몫. */
  mainAreaShare: number;
  /** 가장 큰 덩어리에 속하지 않는, 6칸 이상의 걷는 섬. */
  pockets: Array<{ x: number; y: number; cells: number }>;
  /** 가장자리에서 걸을 수 있는 칸이 이어진 구간. hasExit = 그 구간에 출구가 있다. */
  openEdges: Array<{ edge: 'north' | 'south' | 'west' | 'east'; from: number; to: number; hasExit: boolean }>;
  events: FactEvent[];
  start?: { x: number; y: number };
  /** 빌더가 적어 둔 장소 이름표(주장이지 사실이 아니다). */
  labels: Array<{ name: string; x: number; y: number; w: number; h: number }>;
};

const key = (x: number, y: number) => `${x},${y}`;
function edgeOf(x: number, y: number, width: number, height: number): FactEvent['edge'] {
  return x === 0 ? 'west' : x === width - 1 ? 'east' : y === 0 ? 'north' : y === height - 1 ? 'south' : undefined;
}

export function mapFacts(project: Project, mapId: string, standalone: boolean): MapFacts {
  const map: any = (project as any).maps[mapId];
  const { width, height } = map;
  const blocked = blockedOn(cloneDoc(project), mapId);
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && !blocked.has(key(x, y));
  // 걷는 덩어리(4방향).
  const component = new Map<string, number>(), sizes: number[] = [], seeds: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (!open(x, y) || component.has(key(x, y))) continue;
    const id = sizes.length, queue = [{ x, y }];
    component.set(key(x, y), id); let count = 0;
    for (let cell = queue.pop(); cell; cell = queue.pop()) {
      count += 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cell.x + dx, ny = cell.y + dy;
        if (open(nx, ny) && !component.has(key(nx, ny))) { component.set(key(nx, ny), id); queue.push({ x: nx, y: ny }); }
      }
    }
    sizes.push(count); seeds.push({ x, y });
  }
  const walkable = sizes.reduce((total, size) => total + size, 0);
  const main = sizes.indexOf(Math.max(0, ...sizes));
  const inMain = (x: number, y: number) => component.get(key(x, y)) === main;
  const nearMain = (x: number, y: number) => inMain(x, y) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inMain(x + dx!, y + dy!));

  const session = freshSession(), counters: Record<string, number> = {}, events: FactEvent[] = [];
  const mapNames = new Map(Object.values<any>((project as any).maps).map(other => [other.id, other.name ?? other.id]));
  for (const event of (map.events ?? []) as any[]) {
    let page: any = null;
    try { page = event.pages?.length ? resolveEventPage(event as never, session) : null; } catch { page = null; }
    const commands = allCommands(event);
    const transfer = commands.find(command => command.kind === 'transfer' && command.mapId);
    const graphic = page?.graphic, sprite: string = graphic && !graphic.transparent ? String(graphic.sprite?.id ?? '') : '';
    const trigger = String(page?.trigger?.kind ?? event.trigger?.kind ?? 'action');
    const text = commands.find(command => command.kind === 'text' && String(command.body ?? '').trim())?.body;
    const battle = commands.some(command => command.kind === 'battleProcessing');
    let kind: FactEvent['kind'];
    if (transfer) kind = 'exit';
    else if (sprite && (battle || /monster|enemy|foe/iu.test(sprite))) kind = 'foe';
    else if (sprite && /object|cc0-|chest|icon/iu.test(sprite)) kind = 'object';
    else if (sprite) kind = 'person';
    else if ((trigger === 'auto' || trigger === 'parallel') || !text) continue; // 글 없는 조용한 장치(퀘스트 도달 표시·자동 실행)는 화면에도 걸음에도 안 드러난다
    else kind = 'invisible';
    const letter = { exit: 'E', person: 'P', object: 'O', foe: 'F', invisible: 'V' }[kind];
    counters[letter] = (counters[letter] ?? 0) + 1;
    events.push({ tag: `${letter}${counters[letter]}`, kind, x: event.x, y: event.y, name: String(event.name ?? page?.name ?? '').slice(0, 30), trigger, visible: !!sprite,
      ...(transfer ? { to: { map: String(mapNames.get(transfer.mapId) ?? transfer.mapId), x: transfer.x, y: transfer.y } } : {}),
      ...(text ? { text: String(text).replace(/\s+/gu, ' ').slice(0, 60) } : {}),
      reachable: nearMain(event.x, event.y), onBlocked: blocked.has(key(event.x, event.y)), ...(edgeOf(event.x, event.y, width, height) ? { edge: edgeOf(event.x, event.y, width, height) } : {}) });
  }
  const exitCells = new Set(events.filter(event => event.kind === 'exit').map(event => key(event.x, event.y)));
  const openEdges: MapFacts['openEdges'] = [];
  const scan = (edge: 'north' | 'south' | 'west' | 'east', length: number, cell: (i: number) => [number, number]) => {
    let from = -1, hasExit = false;
    for (let i = 0; i <= length; i += 1) {
      const [x, y] = i < length ? cell(i) : [-1, -1];
      // 출구 칸은 막힌 칸이어도(문 그림 위) 열린 가장자리로 친다.
      const free = i < length && (open(x, y) || exitCells.has(key(x, y)));
      if (free) { if (from < 0) { from = i; hasExit = false; } if (exitCells.has(key(x, y))) hasExit = true; }
      else if (from >= 0) { openEdges.push({ edge, from, to: i - 1, hasExit }); from = -1; }
    }
  };
  scan('north', width, i => [i, 0]); scan('south', width, i => [i, height - 1]); scan('west', height, i => [0, i]); scan('east', height, i => [width - 1, i]);
  const isStart = (project as any).startMapId === mapId;
  return { mapId, name: map.name ?? mapId, width, height, tile: (project as any).tilesets?.[map.tilesetId]?.tileSize ?? 16, tilesetId: map.tilesetId, role: String(map.mapRole ?? ''), standalone, blocked,
    walkableShare: walkable / (width * height), mainAreaShare: walkable ? (sizes[main] ?? 0) / walkable : 0,
    pockets: sizes.map((cells, id) => ({ ...seeds[id]!, cells, id })).filter(pocket => pocket.id !== main && pocket.cells >= 6).map(({ x, y, cells }) => ({ x, y, cells })).slice(0, 8),
    openEdges, events, ...(isStart ? { start: { ...(project as any).startPos } } : {}),
    labels: ((map.locations ?? []) as any[]).filter(location => Number.isFinite(location?.x) && location?.name).slice(0, 30).map(location => ({ name: String(location.name), x: location.x, y: location.y, w: location.w ?? 1, h: location.h ?? 1 })) };
}

/** 검수자에게 주는 사실 글(영어 — 모델이 읽는다). */
export function factsText(facts: MapFacts): string {
  const pct = (share: number) => `${Math.round(share * 100)}%`;
  const list = (kind: FactEvent['kind']) => facts.events.filter(event => event.kind === kind);
  const where = (event: FactEvent) => `(${event.x},${event.y})${event.edge ? ` ${event.edge} edge` : ''}`;
  const flags = (event: FactEvent) => `${event.onBlocked ? ' · ON A BLOCKED CELL' : ''}${event.reachable ? '' : ' · NOT REACHABLE on foot from the main walkable area'}`;
  const lines = [
    `MAP "${facts.name}" — ${facts.width}x${facts.height} tiles, chipset ${facts.tilesetId}${facts.role ? `, role ${facts.role}` : ''}.`,
    facts.standalone ? 'This is a STAND-ALONE single map (not linked into a game): it has no map transfers by design, and that is not a defect. Doorways, gates and roads drawn on the map are still judged, and so are any exits that do exist.' : 'This map is part of a linked game: the player arrives and leaves through the exits listed below.',
    `Walkable: ${pct(facts.walkableShare)} of cells. The largest connected walkable area holds ${pct(facts.mainAreaShare)} of the walkable cells.`,
    ...(facts.pockets.length ? [`Walkable pockets cut off from the main area: ${facts.pockets.map(pocket => `${pocket.cells} cells near (${pocket.x},${pocket.y})`).join('; ')}.`] : []),
    `Open (walkable) stretches on the map edge: ${facts.openEdges.map(run => `${run.edge} ${run.edge === 'north' || run.edge === 'south' ? 'x' : 'y'}=${run.from}${run.to !== run.from ? `..${run.to}` : ''} ${run.hasExit ? '[has exit]' : '[NO exit]'}`).join('; ') || 'none (the edge is closed all round)'}.`,
    ...(facts.start ? [`The game starts on this map at (${facts.start.x},${facts.start.y}) [S].`] : []),
    `EXITS (map transfers; invisible unless marked visible): ${list('exit').map(event => `${event.tag} ${where(event)} -> "${event.to?.map}" (${event.to?.x},${event.to?.y}), ${event.trigger}${event.visible ? ', visible' : ''}${flags(event)}`).join('; ') || 'none'}.`,
    `PEOPLE: ${list('person').map(event => `${event.tag} ${where(event)} "${event.name}"${flags(event)}`).join('; ') || 'none'}.`,
    `VISIBLE OBJECT EVENTS: ${list('object').map(event => `${event.tag} ${where(event)} "${event.name}"${flags(event)}`).join('; ') || 'none'}.`,
    `ROAMING FOES: ${list('foe').map(event => `${event.tag} ${where(event)}${flags(event)}`).join('; ') || 'none'}.`,
    `INVISIBLE EVENTS THAT SHOW TEXT (the player sees nothing on that cell; walking into it or pressing the action key shows the text): ${list('invisible').map(event => `${event.tag} ${where(event)} ${event.trigger} "${event.name}": «${event.text}»${event.onBlocked ? ' · on a blocked cell' : ' · on a WALKABLE cell'}`).join('; ') || 'none'}.`,
    ...(facts.labels.length ? [`Builder's own area labels (claims by the map builder, not verified): ${facts.labels.map(label => `"${label.name}" x${label.x}..${label.x + label.w - 1} y${label.y}..${label.y + label.h - 1}`).join('; ')}.`] : []),
  ];
  return lines.join('\n');
}
