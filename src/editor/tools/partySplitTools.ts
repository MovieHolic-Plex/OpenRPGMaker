// editor/tools/partySplitTools.ts
// author_party_split — FF6 식 파티 나누기를 한 호출로: 두 묶음으로 갈라 각자 다른 길을 걷고, 전환 지점에서 조작 묶음을
// 바꾸고, 한쪽의 레버가 다른 쪽의 문을 열고, 다시 만나는 칸에서 하나로 합친다.
//
// 새 런타임 개념이 아니다 — 엔진 명령 storeParty(묶음 미리 만들기: actorIds·mapId·x·y)·recallParty·changeParty,
// 이름 붙은 스위치, 2페이지 레버·문 이벤트의 조립이다. 쓰기 전에 「끝까지 풀리는가」를 칸 단위로 검사한다:
// 두 묶음이 각자 출발 칸에서 걸어(타일 통행 + 이동 이벤트 + 늘 막는 이벤트) 닿는 레버를 당기면 그 문이 열리고,
// 더 열 문이 없을 때까지 되풀이해 두 묶음이 모두 합류 칸에 닿아야 한다. 안 풀리면 쓰지 않고 거절한다.
import { canMove } from '@/project/collision';
import { eventAlwaysBlocks } from '@/project/eventPassageBlock';
import type { Command, EventPage, GameEvent, GameMap, Project } from '@/project/types';
import { withJosa } from '@/util/josa';
import { assertEventShape, upsertEventIntoMap } from './eventTools';
import { ensureNamedSwitch } from './flagHelpers';
import { inMapBounds, requireMap } from './mapHelpers';
import { choices, ifSw, makePage, objGraphic, setSw, sfx, shake, textCmd, TRANSPARENT } from './puzzleKit';
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from './types';

interface Spot { readonly mapId: string; readonly x: number; readonly y: number }
interface Group { readonly key: 'a' | 'b'; readonly name: string; readonly actorIds: string[]; readonly start: Spot; readonly switchAt: Spot }
interface LeverPair { readonly index: number; readonly lever: Spot; readonly door: Spot; readonly name: string }

const KEYS = ['id', 'mapId', 'splitAt', 'groups', 'levers', 'rejoin', 'splitText', 'rejoinText'] as const;
const GROUP_KEYS = ['name', 'actorIds', 'mapId', 'x', 'y', 'switchAt'] as const;
const LEVER_KEYS = ['lever', 'door', 'name'] as const;
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** 이 도구가 짓는 이벤트 id 꼬리 — 같은 id 로 다시 부르면 이것들만 치우고 새로 짓는다. */
const OWN_EVENT = /^(?:split|switch_[ab]|rejoin|lever_\d+|door_\d+)$/u;

const cellSchema = (description: string): JsonSchema => ({
  type: 'object', additionalProperties: false, description,
  properties: { mapId: { type: 'string', description: '생략 = 위 mapId' }, x: { type: 'integer' }, y: { type: 'integer' } },
  required: ['x', 'y'],
});

function rejectUnknown(where: string, value: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new ToolError(`author_party_split ${where} 는 '${key}' 칸을 받지 않습니다. 받는 칸: ${keys.join(', ')}`, { code: 'unknown-party-split-field' });
  }
}

function spotOf(project: Project, raw: unknown, fallbackMapId: string, label: string): Spot {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ToolError(`${label} 는 {x,y[,mapId]} 입니다.`, { code: 'invalid-args' });
  const value = raw as Record<string, unknown>;
  rejectUnknown(label, value, ['mapId', 'x', 'y']);
  const mapId = typeof value.mapId === 'string' && value.mapId.trim() ? value.mapId.trim() : fallbackMapId;
  const map = requireMap(project, mapId);
  const x = Number(value.x), y = Number(value.y);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map, x, y)) throw new ToolError(`${label} (${String(value.x)}, ${String(value.y)}) 가 맵 ${mapId} 밖입니다.`, { code: 'party-split-out-of-bounds', mapId });
  return { mapId, x, y };
}

const keyOf = (spot: Spot): string => `${spot.mapId}:${spot.x},${spot.y}`;
const sameSpot = (a: Spot, b: Spot): boolean => a.mapId === b.mapId && a.x === b.x && a.y === b.y;

/** 걸어서 닿는 칸 — 타일 통행(canMove), 늘 막는 이벤트·닫힌 문·이 도구의 기물은 못 지나고, 이동(transfer) 이벤트는 건너편으로 잇는다. */
function walk(project: Project, start: Spot, blocked: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>([keyOf(start)]);
  const queue: Spot[] = [start];
  const transfers = new Map<string, { at: Spot; to: Spot; solid: boolean }[]>();
  const transfersOf = (mapId: string): { at: Spot; to: Spot; solid: boolean }[] => {
    const cached = transfers.get(mapId);
    if (cached) return cached;
    const out: { at: Spot; to: Spot; solid: boolean }[] = [];
    for (const event of project.maps[mapId]?.events ?? []) {
      const solid = eventAlwaysBlocks(event);
      const lists: (readonly Command[])[] = [event.commands ?? [], ...(event.pages ?? []).map((page) => page.commands)];
      for (const list of lists) for (const command of list) {
        if (command.kind === 'transfer' && project.maps[command.mapId]) out.push({ at: { mapId, x: event.x, y: event.y }, to: { mapId: command.mapId, x: command.x, y: command.y }, solid });
      }
    }
    transfers.set(mapId, out);
    return out;
  };
  const push = (spot: Spot): void => {
    const key = keyOf(spot);
    if (seen.has(key) || blocked.has(key)) return;
    seen.add(key);
    queue.push(spot);
  };
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head]!;
    const map = project.maps[at.mapId];
    if (!map) continue;
    for (const [dx, dy] of STEPS) {
      const nx = at.x + dx, ny = at.y + dy;
      if (inMapBounds(map, nx, ny) && canMove(project, map, at.x, at.y, nx, ny)) push({ mapId: at.mapId, x: nx, y: ny });
    }
    for (const link of transfersOf(at.mapId)) {
      const dist = Math.abs(link.at.x - at.x) + Math.abs(link.at.y - at.y);
      if (dist === 0 || (dist === 1 && link.solid)) push(link.to);
    }
  }
  return seen;
}

/** 칸 자체 또는 곁 칸에 서 있을 수 있는가(조사·당기기는 곁에서 한다). */
function touches(reach: ReadonlySet<string>, spot: Spot): boolean {
  if (reach.has(keyOf(spot))) return true;
  return STEPS.some(([dx, dy]) => reach.has(`${spot.mapId}:${spot.x + dx},${spot.y + dy}`));
}

interface SolveResult {
  readonly solvable: boolean;
  readonly opened: number[];
  readonly order: { readonly lever: number; readonly by: 'a' | 'b' | 'both' }[];
  readonly reachesRejoin: { readonly a: boolean; readonly b: boolean };
  readonly switchReachable: { readonly a: boolean; readonly b: boolean };
}

function solve(project: Project, groups: readonly Group[], levers: readonly LeverPair[], rejoin: Spot, staticBlocked: ReadonlySet<string>, forceOpen: ReadonlySet<number> = new Set()): SolveResult {
  const open = new Set<number>(forceOpen);
  const order: { lever: number; by: 'a' | 'b' | 'both' }[] = [];
  for (;;) {
    const blocked = new Set(staticBlocked);
    levers.forEach((pair) => { if (!open.has(pair.index)) blocked.add(keyOf(pair.door)); });
    const [ra, rb] = groups.map((group) => walk(project, group.start, blocked)) as [Set<string>, Set<string>];
    let progressed = false;
    for (const pair of levers) {
      if (open.has(pair.index)) continue;
      const byA = touches(ra, pair.lever), byB = touches(rb, pair.lever);
      if (!byA && !byB) continue;
      open.add(pair.index);
      order.push({ lever: pair.index, by: byA && byB ? 'both' : byA ? 'a' : 'b' });
      progressed = true;
    }
    if (progressed) continue;
    const reachesRejoin = { a: ra.has(keyOf(rejoin)), b: rb.has(keyOf(rejoin)) };
    return {
      solvable: reachesRejoin.a && reachesRejoin.b,
      opened: [...open].filter((index) => !forceOpen.has(index)),
      order,
      reachesRejoin,
      switchReachable: { a: touches(ra, groups[0]!.switchAt), b: touches(rb, groups[1]!.switchAt) },
    };
  }
}

function freeNeighbour(project: Project, map: GameMap, spot: Spot, taken: ReadonlySet<string>): Spot | null {
  for (const [dx, dy] of STEPS) {
    const nx = spot.x + dx, ny = spot.y + dy;
    const candidate = { mapId: spot.mapId, x: nx, y: ny };
    if (!inMapBounds(map, nx, ny) || taken.has(keyOf(candidate))) continue;
    if (map.events.some((event) => event.x === nx && event.y === ny)) continue;
    if (!canMove(project, map, spot.x, spot.y, nx, ny)) continue;
    return candidate;
  }
  return null;
}

const HIDDEN = (id: string): EventPage => makePage({ id, name: '대기', graphic: TRANSPARENT, priority: 'below', overlapForbidden: false, commands: [] });

export const PARTY_SPLIT_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'author_party_split',
    mode: 'write',
    description:
      'FF6 식 파티 나누기를 한 호출로 짓는다: splitAt 칸을 밟으면 파티가 groups 두 묶음으로 갈라져(엔진 storeParty·recallParty) 첫 묶음을 조작하게 되고, ' +
      '각 묶음 곁의 「전환」 조사 지점(빛나는 구슬)에서 다른 묶음으로 조작을 바꾼다. levers 의 레버를 당기면 짝 문이 열린다(보통 한쪽 레버가 다른 쪽 문을 연다). ' +
      'rejoin 칸에 먼저 닿은 묶음은 그 자리에서 기다리고 조작이 자동으로 다른 묶음으로 넘어가며, 둘 다 닿으면 하나로 합쳐진다. 묶음은 한 맵이든 두 맵이든 된다(그룹마다 mapId). ' +
      '쓰기 전에 끝까지 풀리는지 칸 단위로 검사한다(타일 통행·이동 이벤트·늘 막는 이벤트를 보고, 닿는 레버를 당겨 문을 여는 것을 되풀이) — 안 풀리면 거절하고 어느 묶음이 어디서 막혔는지 돌려준다. ' +
      '결과 data.solve 에 레버를 당기는 순서와 묶음, data.warnings 에 쓸모없는 문(없어도 풀림)·레버 없이도 만나는 길을 알린다. 같은 id 로 다시 부르면 앞서 지은 이벤트를 치우고 다시 짓는다. ' +
      '두 묶음이 지나갈 길·벽은 먼저 맵에 있어야 한다(이 도구는 지형을 칠하지 않는다). 문 칸은 걸을 수 있는 길 칸(문 이벤트가 막는다), 레버·전환 지점은 곁에 설 수 있는 칸에 둔다.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        id: { type: 'string', description: '이 나누기의 짧은 id(영문·숫자·_ 24자 이하, 생략 = split). 이벤트·스위치·파티 묶음 이름의 머리가 된다' },
        mapId: { type: 'string', description: '나뉘는 맵(splitAt·rejoin·그룹·레버의 기본 맵)' },
        splitAt: cellSchema('밟으면 갈라지는 칸(나뉘기 직전 길목)'),
        groups: {
          type: 'array', minItems: 2, maxItems: 2,
          description: '정확히 두 묶음. 첫 묶음이 먼저 조작된다. 같은 배우가 두 묶음에 들어갈 수 없다',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              name: { type: 'string', description: '묶음 이름(대사용, 생략 = 배우 이름을 ·로 이음)' },
              actorIds: { type: 'array', items: { type: 'string' }, description: '이 묶음의 배우 id(1명 이상)' },
              mapId: { type: 'string', description: '출발 맵(생략 = 위 mapId)' },
              x: { type: 'integer', description: '출발 칸 x' },
              y: { type: 'integer', description: '출발 칸 y' },
              switchAt: cellSchema('이 묶음의 전환 지점(조사하면 다른 묶음으로 바꿈). 생략 = 출발 칸 곁 빈 칸'),
            },
            required: ['actorIds', 'x', 'y'],
          },
        },
        levers: {
          type: 'array', maxItems: 8,
          description: '레버→문 짝. 레버(조사해서 당김)가 짝 문(닫힌 철문 이벤트)을 연다. 보통 묶음 A 쪽 레버가 묶음 B 쪽 문을, B 쪽 레버가 A 쪽 문을 연다',
          items: {
            type: 'object', additionalProperties: false,
            properties: { lever: cellSchema('레버 칸'), door: cellSchema('문 칸(걸을 수 있는 길 칸)'), name: { type: 'string', description: '문 이름(생략 = 철문 n)' } },
            required: ['lever', 'door'],
          },
        },
        rejoin: cellSchema('두 묶음이 다시 만나는 칸(예: 위층 계단 앞). 둘 다 밟으면 합쳐진다'),
        splitText: { type: 'string', description: '갈라질 때 대사(생략 = 기본)' },
        rejoinText: { type: 'string', description: '합쳐질 때 대사(생략 = 기본)' },
      },
      required: ['mapId', 'splitAt', 'groups', 'rejoin'],
    },
    invalidArgsHint: 'groups 는 정확히 두 묶음 [{actorIds,x,y[,mapId,name,switchAt]}], levers 는 [{lever:{x,y},door:{x,y}}], splitAt·rejoin 은 {x,y[,mapId]} 입니다.',
    invalidArgsExample: {
      mapId: 'map_tower_2', splitAt: { x: 10, y: 18 },
      groups: [{ actorIds: ['actor_kael', 'actor_sera'], x: 3, y: 15 }, { actorIds: ['actor_elena'], x: 17, y: 15 }],
      levers: [{ lever: { x: 3, y: 6 }, door: { x: 17, y: 9 } }, { lever: { x: 17, y: 4 }, door: { x: 3, y: 9 } }],
      rejoin: { x: 10, y: 2 },
    },
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      rejectUnknown('', args, KEYS);
      const baseMap = requireMap(draft, String(args.mapId ?? ''));
      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : 'split';
      if (!/^[A-Za-z0-9_]{1,24}$/u.test(id)) throw new ToolError('id 는 영문·숫자·_ 24자 이하입니다(파티 묶음 이름 32자 상한).', { code: 'invalid-args' });
      const warnings: string[] = [];

      // 그룹
      if (!Array.isArray(args.groups) || args.groups.length !== 2) throw new ToolError('groups 는 정확히 두 묶음입니다.', { code: 'invalid-args' });
      const actorName = (actorId: string): string => draft.database.actors.find((actor) => actor.id === actorId)?.name ?? actorId;
      const used = new Set<string>();
      const rawGroups = args.groups.map((raw, index) => {
        if (!raw || typeof raw !== 'object') throw new ToolError(`groups[${index}] 는 객체입니다.`, { code: 'invalid-args' });
        const value = raw as Record<string, unknown>;
        rejectUnknown(`groups[${index}]`, value, GROUP_KEYS);
        const actorIds = Array.isArray(value.actorIds) ? value.actorIds.map((entry) => String(entry).trim()).filter(Boolean) : [];
        if (actorIds.length === 0) throw new ToolError(`groups[${index}].actorIds 에 배우가 한 명 이상 있어야 합니다.`, { code: 'invalid-args' });
        for (const actorId of actorIds) {
          if (!draft.database.actors.some((actor) => actor.id === actorId)) throw new ToolError(`배우 '${actorId}' 가 없습니다 — get_database_records 로 배우 id 를 확인하세요.`, { code: 'actor-not-found' });
          if (used.has(actorId)) throw new ToolError(`배우 '${actorId}' 가 두 묶음에 모두 들어 있습니다 — 한 배우는 한 묶음에만.`, { code: 'invalid-args' });
          used.add(actorId);
        }
        const start = spotOf(draft, { mapId: value.mapId, x: value.x, y: value.y }, baseMap.id, `groups[${index}] 출발 칸`);
        const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : actorIds.map(actorName).join('·');
        return { index, value, actorIds, start, name };
      });

      const splitAt = spotOf(draft, args.splitAt, baseMap.id, 'splitAt');
      const rejoin = spotOf(draft, args.rejoin, baseMap.id, 'rejoin');
      if (!Array.isArray(args.levers ?? [])) throw new ToolError('levers 는 배열입니다.', { code: 'invalid-args' });
      const levers: LeverPair[] = ((args.levers ?? []) as unknown[]).map((raw, index) => {
        if (!raw || typeof raw !== 'object') throw new ToolError(`levers[${index}] 는 {lever,door} 입니다.`, { code: 'invalid-args' });
        const value = raw as Record<string, unknown>;
        rejectUnknown(`levers[${index}]`, value, LEVER_KEYS);
        return {
          index: index + 1,
          lever: spotOf(draft, value.lever, baseMap.id, `levers[${index}].lever`),
          door: spotOf(draft, value.door, baseMap.id, `levers[${index}].door`),
          name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : `철문 ${index + 1}`,
        };
      });
      if (levers.length > 8) throw new ToolError('levers 는 8짝까지입니다.', { code: 'invalid-args' });

      // 같은 id 로 다시 부르면 앞서 지은 이벤트를 치운다(모든 맵).
      let removed = 0;
      for (const map of Object.values(draft.maps)) {
        const before = map.events.length;
        map.events = map.events.filter((event) => !(event.id.startsWith(`${id}_`) && OWN_EVENT.test(event.id.slice(id.length + 1))));
        removed += before - map.events.length;
      }

      // 칸 겹침 — 이 도구가 놓는 칸끼리, 그리고 남의 이벤트와.
      const taken = new Set<string>();
      const claim = (spot: Spot, label: string): void => {
        const key = keyOf(spot);
        if (taken.has(key)) throw new ToolError(`${label} (${spot.x}, ${spot.y}) 가 이 나누기의 다른 칸과 겹칩니다.`, { code: 'party-split-overlap', mapId: spot.mapId });
        const other = draft.maps[spot.mapId]!.events.find((event) => event.x === spot.x && event.y === spot.y);
        if (other) throw new ToolError(`${label} (${spot.x}, ${spot.y}) 에 이미 이벤트 '${other.id}' 가 있습니다 — 다른 칸을 고르거나 remove_event 로 치우세요.`, { code: 'party-split-occupied', mapId: spot.mapId });
        taken.add(key);
      };
      claim(splitAt, 'splitAt');
      claim(rejoin, 'rejoin');
      for (const pair of levers) { claim(pair.lever, `레버 ${pair.index}`); claim(pair.door, `문 ${pair.index}`); }
      const groups: Group[] = rawGroups.map((entry) => {
        const map = draft.maps[entry.start.mapId]!;
        let switchAt: Spot | null = entry.value.switchAt === undefined ? null : spotOf(draft, entry.value.switchAt, entry.start.mapId, `groups[${entry.index}].switchAt`);
        if (!switchAt) {
          switchAt = freeNeighbour(draft, map, entry.start, taken);
          if (!switchAt) throw new ToolError(`groups[${entry.index}] 출발 칸 (${entry.start.x}, ${entry.start.y}) 곁에 전환 지점을 둘 빈 칸이 없습니다 — switchAt 을 주세요.`, { code: 'party-split-no-switch-cell', mapId: map.id });
        }
        claim(switchAt, `groups[${entry.index}].switchAt`);
        return { key: entry.index === 0 ? 'a' : 'b', name: entry.name, actorIds: entry.actorIds, start: entry.start, switchAt };
      });
      const [groupA, groupB] = groups as [Group, Group];
      for (const group of groups) {
        if (taken.has(keyOf(group.start))) throw new ToolError(`${group.name}의 출발 칸 (${group.start.x}, ${group.start.y}) 에 이 나누기의 이벤트가 겹칩니다.`, { code: 'party-split-overlap' });
      }
      if (sameSpot(groupA.start, groupB.start)) throw new ToolError('두 묶음의 출발 칸이 같습니다.', { code: 'invalid-args' });

      // 풀리는가 — 남의 늘 막는 이벤트와 이 도구의 레버·전환 지점(막는 기물)은 지나갈 수 없다.
      const staticBlocked = new Set<string>();
      for (const map of Object.values(draft.maps)) for (const event of map.events) if (eventAlwaysBlocks(event)) staticBlocked.add(`${map.id}:${event.x},${event.y}`);
      for (const pair of levers) staticBlocked.add(keyOf(pair.lever));
      for (const group of groups) staticBlocked.add(keyOf(group.switchAt));
      for (const group of groups) {
        if (staticBlocked.has(keyOf(group.start))) throw new ToolError(`${group.name}의 출발 칸 (${group.start.x}, ${group.start.y}) 에 막는 이벤트가 있습니다.`, { code: 'party-split-start-blocked' });
      }
      for (const pair of levers) {
        const map = draft.maps[pair.door.mapId]!;
        const walkable = STEPS.some(([dx, dy]) => inMapBounds(map, pair.door.x + dx, pair.door.y + dy) && canMove(draft, map, pair.door.x + dx, pair.door.y + dy, pair.door.x, pair.door.y));
        if (!walkable) throw new ToolError(`문 ${pair.index} (${pair.door.x}, ${pair.door.y}) 는 타일이 막힌 칸이라 열어도 지나갈 수 없습니다 — 걸을 수 있는 길목 칸에 두세요(get_map_region).`, { code: 'party-split-door-on-wall', mapId: pair.door.mapId });
      }
      const result = solve(draft, groups, levers, rejoin, staticBlocked);
      if (!result.solvable) {
        const stuck = [result.reachesRejoin.a ? null : groupA.name, result.reachesRejoin.b ? null : groupB.name].filter(Boolean).join('·');
        const closed = levers.filter((pair) => !result.opened.includes(pair.index)).map((pair) => `문 ${pair.index}(${pair.door.mapId} ${pair.door.x},${pair.door.y} — 레버 ${pair.lever.x},${pair.lever.y} 에 아무도 못 닿음)`);
        throw new ToolError(`끝까지 풀리지 않습니다 — ${withJosa(stuck, '이/가')} 합류 칸 (${rejoin.x}, ${rejoin.y}) 에 닿지 못합니다.${closed.length ? ` 끝내 안 열린 문: ${closed.join(', ')}.` : ''} 길·벽(get_map_region)이나 레버·문 자리를 고치세요. 열린 순서: ${result.order.map((step) => `레버 ${step.lever}(${step.by})`).join(' → ') || '없음'}.`, { code: 'party-split-unsolvable', mapId: rejoin.mapId });
      }
      // 퍼즐다운가 — 문 없이도 풀리면 레버가 쓸모없다. 문 하나만 닫아 두고(나머지 열고) 풀리면 그 문은 길을 막지 않는다.
      const noDoors = solve(draft, groups, [], rejoin, new Set([...staticBlocked, ...levers.map((pair) => keyOf(pair.door))]));
      if (levers.length && noDoors.solvable) warnings.push('레버를 하나도 안 당겨도 두 묶음이 합류 칸에 닿습니다 — 문이 길목을 막지 못합니다(문 곁으로 돌아가는 길이 있음). 문을 폭 1칸 길목에 두세요.');
      else for (const pair of levers) {
        // 이 문만 영영 닫혀 있고 나머지 문은 다 열렸다고 쳐도 풀리면, 이 문은 아무 길도 막지 않는다.
        if (solve(draft, groups, [], rejoin, new Set([...staticBlocked, keyOf(pair.door)])).solvable) warnings.push(`문 ${pair.index}(${pair.door.x}, ${pair.door.y}) 는 열지 않아도 풀립니다 — 길을 막지 않습니다(곁으로 돌아가는 길이 있음).`);
      }
      if (!result.switchReachable.a) warnings.push(`${groupA.name}의 전환 지점 (${groupA.switchAt.x}, ${groupA.switchAt.y}) 곁에 설 수 없습니다 — 조작을 바꿀 수 없습니다.`);
      if (!result.switchReachable.b) warnings.push(`${groupB.name}의 전환 지점 (${groupB.switchAt.x}, ${groupB.switchAt.y}) 곁에 설 수 없습니다 — 조작을 바꿀 수 없습니다.`);
      const allClosed = new Set([...staticBlocked, ...levers.map((pair) => keyOf(pair.door))]);
      const crossing = walk(draft, groupA.start, allClosed);
      const closedReachB = walk(draft, groupB.start, allClosed);
      // 짝인가 — 레버를 당긴 묶음과, 그 문 앞에 (문이 다 닫힌 채로) 서는 묶음이 다르면 서로 열어 주는 짝이다.
      const selfOpened = result.order.filter((step) => {
        const door = levers.find((pair) => pair.index === step.lever)!.door;
        const owner = touches(crossing, door) && !touches(closedReachB, door) ? 'a' : touches(closedReachB, door) && !touches(crossing, door) ? 'b' : null;
        return owner !== null && owner === step.by;
      });
      if (selfOpened.length && selfOpened.length === result.order.length) warnings.push(`모든 레버를 그 문 앞의 묶음이 스스로 당깁니다(${selfOpened.map((step) => `레버 ${step.lever}`).join(', ')}) — 서로 열어 주는 짝이 아닙니다. 한쪽 레버가 다른 쪽 문을 열게 레버·문 자리를 바꾸세요.`);
      if (crossing.has(keyOf(groupB.start))) warnings.push(`문이 모두 닫혀 있어도 ${withJosa(groupA.name, '이/가')} ${groupB.name}의 출발 칸까지 걸어갈 수 있습니다 — 두 길이 갈라져 있지 않습니다.`);

      // 스위치·파티 묶음 이름
      const sw = (tail: string): string => `${id}_${tail}`;
      const SPLIT = sw('split'), CTRL_B = sw('ctrl_b'), ARRIVED_A = sw('arrived_a'), ARRIVED_B = sw('arrived_b'), DONE = sw('done');
      ensureNamedSwitch(draft, SPLIT, `파티 나누기 ${id}: 갈라짐`);
      ensureNamedSwitch(draft, CTRL_B, `파티 나누기 ${id}: ${groupB.name} 조작 중`);
      ensureNamedSwitch(draft, ARRIVED_A, `파티 나누기 ${id}: ${groupA.name} 합류 칸 도착`);
      ensureNamedSwitch(draft, ARRIVED_B, `파티 나누기 ${id}: ${groupB.name} 합류 칸 도착`);
      ensureNamedSwitch(draft, DONE, `파티 나누기 ${id}: 다시 합침`);
      for (const pair of levers) ensureNamedSwitch(draft, sw(`lever_${pair.index}`), `파티 나누기 ${id}: ${pair.name} 열림`);
      const setA = `${id}_a`, setB = `${id}_b`;
      const preset = (group: Group): Command => ({ kind: 'storeParty', partySetId: group.key === 'a' ? setA : setB, actorIds: [...group.actorIds], mapId: group.start.mapId, x: group.start.x, y: group.start.y });
      const recall = (group: Group): Command[] => [setSw(CTRL_B, group.key === 'b'), { kind: 'recallParty', partySetId: group.key === 'a' ? setA : setB }];

      const written: { id: string; mapId: string; x: number; y: number; role: string }[] = [];
      const put = (spot: Spot, event: GameEvent, role: string): void => {
        assertEventShape(event, warnings, event, draft);
        upsertEventIntoMap(draft.maps[spot.mapId]!, event);
        written.push({ id: event.id, mapId: spot.mapId, x: spot.x, y: spot.y, role });
      };
      const at = (spot: Spot, eventId: string, name: string, pages: EventPage[]): GameEvent => ({ id: eventId, name, x: spot.x, y: spot.y, trigger: { kind: 'action' }, commands: [], pages });

      // 1) 갈라지는 칸
      const splitText = typeof args.splitText === 'string' && args.splitText.trim() ? args.splitText.trim() : `여기서 둘로 나뉘자. ${groupA.name}, 그리고 ${groupB.name}.`;
      put(splitAt, at(splitAt, sw('split'), '파티 나누기', [
        makePage({ id: `${id}_split_p1`, name: '갈라지기', graphic: TRANSPARENT, trigger: 'playerTouch', priority: 'below', overlapForbidden: false, commands: [
          textCmd(splitText),
          preset(groupA), preset(groupB),
          setSw(ARRIVED_A, false), setSw(ARRIVED_B, false), setSw(DONE, false),
          ...levers.map((pair) => setSw(sw(`lever_${pair.index}`), false)),
          setSw(SPLIT, true),
          ...recall(groupA),
        ] }),
        { ...HIDDEN(`${id}_split_p2`), conditions: [{ kind: 'switch', switchId: SPLIT, value: true }] },
      ]), '갈라지는 칸');

      // 2) 전환 지점 — 자기 묶음을 조작할 때만 다른 묶음으로 바꾼다.
      for (const group of groups) {
        const other = group.key === 'a' ? groupB : groupA;
        const mine = ifSw(CTRL_B, group.key === 'b', [
          choices(`${other.name} 쪽으로 바꿀까?`, [
            { text: `${other.name}(으)로 바꾼다`, branch: [sfx('switch-clack'), ...recall(other)] },
            { text: '그대로 간다', branch: [] },
          ]),
        ], [textCmd('희미하게 빛나는 구슬이다.')]);
        put(group.switchAt, at(group.switchAt, sw(`switch_${group.key}`), `전환 지점 (${group.name})`, [
          HIDDEN(`${id}_switch_${group.key}_p0`),
          makePage({ id: `${id}_switch_${group.key}_p1`, name: '조작 바꾸기', conditions: [{ kind: 'switch', switchId: SPLIT, value: true }], graphic: objGraphic('object2', 6), commands: [mine] }),
          { ...HIDDEN(`${id}_switch_${group.key}_p2`), conditions: [{ kind: 'switch', switchId: DONE, value: true }] },
        ]), `전환 지점 ${group.key.toUpperCase()}`);
      }

      // 3) 레버 → 문
      for (const pair of levers) {
        const open = sw(`lever_${pair.index}`);
        put(pair.lever, at(pair.lever, sw(`lever_${pair.index}`), `레버 → ${pair.name}`, [
          makePage({ id: `${id}_lever_${pair.index}_p1`, name: '레버 (당기기 전)', graphic: objGraphic('object2', 0, 'down'), commands: [
            textCmd('묵직한 레버다. 어딘가의 문과 이어져 있는 것 같다.'),
            choices('레버를 당길까?', [
              { text: '당긴다', branch: [sfx('switch-clack'), shake(3, 400), setSw(open, true), textCmd(`철컥— 어딘가에서 ${withJosa(pair.name, '이/가')} 열리는 소리가 났다.`)] },
              { text: '그만둔다', branch: [] },
            ]),
          ] }),
          makePage({ id: `${id}_lever_${pair.index}_p2`, name: '레버 (당김)', conditions: [{ kind: 'switch', switchId: open, value: true }], graphic: objGraphic('object2', 0, 'up'), commands: [textCmd('레버가 당겨져 있다.')] }),
        ]), `레버 ${pair.index}`);
        put(pair.door, at(pair.door, sw(`door_${pair.index}`), pair.name, [
          makePage({ id: `${id}_door_${pair.index}_p1`, name: '닫힘', graphic: objGraphic('object1', 3, 'down'), commands: [textCmd('굳게 닫혀 있다. 어딘가의 레버로 열리는 것 같다.')] }),
          makePage({ id: `${id}_door_${pair.index}_p2`, name: '열림', conditions: [{ kind: 'switch', switchId: open, value: true }], graphic: objGraphic('object1', 3, 'up'), priority: 'below', overlapForbidden: false, commands: [] }),
        ]), `문 ${pair.index}`);
      }

      // 4) 합류 칸 — 먼저 온 묶음은 기다리고 조작이 다른 묶음으로 넘어간다. 둘 다 오면 합친다(첫 묶음 → 둘째 묶음 순서).
      const rejoinText = typeof args.rejoinText === 'string' && args.rejoinText.trim() ? args.rejoinText.trim() : '다시 모였다. 함께 가자.';
      const merged = [...groupA.actorIds, ...groupB.actorIds];
      const merge: Command[] = [
        ...merged.map((actorId): Command => ({ kind: 'changeParty', actorId, action: 'add' })),
        ...[...merged].reverse().map((actorId): Command => ({ kind: 'changeParty', actorId, action: 'lead' })),
        setSw(DONE, true), setSw(CTRL_B, false),
        textCmd(rejoinText),
      ];
      const arrive = (self: Group, other: Group): Command[] => [
        setSw(self.key === 'a' ? ARRIVED_A : ARRIVED_B, true),
        ifSw(other.key === 'a' ? ARRIVED_A : ARRIVED_B, true, merge, [textCmd(`${withJosa(self.name, '은/는')} 여기서 ${withJosa(other.name, '을/를')} 기다린다.`), ...recall(other)]),
      ];
      put(rejoin, at(rejoin, sw('rejoin'), '파티 합류', [
        HIDDEN(`${id}_rejoin_p0`),
        makePage({ id: `${id}_rejoin_p1`, name: '합류', conditions: [{ kind: 'switch', switchId: SPLIT, value: true }], graphic: TRANSPARENT, trigger: 'playerTouch', priority: 'below', overlapForbidden: false, commands: [
          ifSw(CTRL_B, false, arrive(groupA, groupB), arrive(groupB, groupA)),
        ] }),
        { ...HIDDEN(`${id}_rejoin_p2`), conditions: [{ kind: 'switch', switchId: DONE, value: true }] },
      ]), '합류 칸');

      if (removed > written.length) warnings.push(`같은 id '${id}' 로 앞서 지은 이벤트 ${removed}개를 치우고 ${written.length}개를 다시 지었습니다.`);
      return {
        summary: `${baseMap.name}: 파티 나누기 '${id}' — ${groupA.name} / ${groupB.name}, 레버 ${levers.length}짝, 합류 (${rejoin.x}, ${rejoin.y}). 풀이 검사 통과(레버 순서 ${result.order.map((step) => `${step.lever}:${step.by}`).join(' → ') || '없음'}).`,
        data: {
          id, partySetIds: [setA, setB], switches: { split: SPLIT, controllingB: CTRL_B, arrivedA: ARRIVED_A, arrivedB: ARRIVED_B, done: DONE, levers: levers.map((pair) => sw(`lever_${pair.index}`)) },
          events: written,
          groups: groups.map((group) => ({ key: group.key, name: group.name, actorIds: group.actorIds, start: group.start, switchAt: group.switchAt })),
          solve: { solvable: true, leverOrder: result.order, doorlessSolvable: noDoors.solvable },
        },
        ...(warnings.length ? { warnings } : {}),
      };
    },
  },
];
