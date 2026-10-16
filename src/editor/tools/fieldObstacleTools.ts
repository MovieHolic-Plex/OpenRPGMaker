// editor/tools/fieldObstacleTools.ts
// place_field_obstacle — 포켓몬식 비전머신(HM) 필드 기술 게이트를 한 호출로: 길을 막는 바위·덩굴·물길·폭포·어둠.
//
// 새 런타임 개념이 아니다. 이미 있는 부품의 조립이다 — partyKnowsSkill 조건(FF6-C #2602), 스킬의 fieldCommonEventId(메뉴에서 쓰면 공통 이벤트),
// changeTile(맵 오버라이드가 세이브에 남는다), 이벤트 셀프 스위치. 이 도구가 아래를 전부 자동으로 맞춘다.
//   1) 막는 지형: 칩셋의 실제 타일(자르기 나무·깨지는 바위)을 그 칸에 깔아 통행을 막고, 물길·폭포는 건널 칸 목록을 잡는다.
//   2) 투명 이벤트 한 개(조사 가능): 모르면 안내 대사, 아는 파티가 있으면 「기술을 쓰자」 안내, 기술을 쓰면 열린다.
//   3) 필드 스킬(없으면 독자 이름으로 생성: 잊을 수 없는 기술) + 그 스킬의 공통 이벤트(대상 이벤트 id 로 이 장애물만 연다).
//   4) 기술머신·비전머신 아이템(몬스터 파티 게임에서는 파티 몬스터에게 가르친다). 누가 주는지는 호출자가 이벤트로 연결한다.
// 자동 플레이(qa:game check)는 같은 partyKnowsSkill 게이트와 changeTile 을 읽어 「기술을 익히는 이벤트 → 장애물 앞에서 쓰기」를 알아서 밟는다.
import { canMove, isPassable } from '@/project/collision';
import { normalizeItemRecord, normalizeSkillRecord } from '@/project/databaseRecordModel';
import { entryCells } from '@/project/eventPassageBlock';
import type { ChangeTileLayer, Command, Dir, EventPage, GameEvent, GameMap, ItemRecord, Project, SkillRecord } from '@/project/types';
import { genId } from '@/util/id';
import { inMapBounds, requireMap } from './mapHelpers';
import { ensureNamedSwitch } from './flagHelpers';
import { assertEventShape, upsertEventIntoMap } from './eventTools';
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from './types';

export const FIELD_OBSTACLE_KINDS = ['rock', 'tree', 'water', 'dark', 'waterfall'] as const;
type ObstacleKind = (typeof FIELD_OBSTACLE_KINDS)[number];

const DIRS: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const KEYS = ['mapId', 'x', 'y', 'kind', 'requiresSkillId', 'skillName', 'name', 'tile', 'passTile', 'direction', 'length', 'span', 'fullWidth', 'machine', 'hint', 'blockedText', 'id'] as const;

/** 종류별 기본: 독자 기술 이름(원작 이름을 쓰지 않는다), 안내 대사, 칩셋 타일 라벨 패턴. */
const DEFAULTS: Record<ObstacleKind, { skillId: string; skillName: string; skillText: string; blocked: string; event: string; tile?: RegExp; pass?: RegExp; hmName: string }> = {
  tree: { skillId: 'skill_field_cut', skillName: '덩굴 가르기', skillText: '길을 막은 질긴 덩굴을 베어 낸다.', blocked: '질긴 덩굴이 길을 막고 있다.', event: '덩굴 장애물', tile: /자르기 이벤트|작은 나무\(자르기/, hmName: '비전서 「덩굴 가르기」' },
  rock: { skillId: 'skill_field_shove', skillName: '바위 밀치기', skillText: '길을 막은 큰 바위를 힘껏 옆으로 밀어낸다.', blocked: '커다란 바위가 길을 막고 있다.', event: '바위 장애물', tile: /깨지는 바위|바위 깨기|바위\(밀기/, hmName: '비전서 「바위 밀치기」' },
  water: { skillId: 'skill_field_ford', skillName: '물길 열기', skillText: '물 위에 잠시 건널 길을 낸다.', blocked: '깊은 물이 길을 가로막고 있다.', event: '물길 장애물', pass: /나무다리/, hmName: '비전서 「물길 열기」' },
  waterfall: { skillId: 'skill_field_ascend', skillName: '폭포 오르기', skillText: '거센 폭포를 거슬러 오를 발판을 만든다.', blocked: '거센 폭포가 앞을 막고 있다.', event: '폭포 장애물', pass: /디딤돌/, hmName: '비전서 「폭포 오르기」' },
  dark: { skillId: 'skill_field_glow', skillName: '반딧불 소환', skillText: '반딧불 떼가 주위를 환하게 비춘다.', blocked: '너무 어두워서 앞이 보이지 않는다.', event: '어둠 구역', hmName: '비전서 「반딧불 소환」' },
};

const text = (body: string): Command => ({ kind: 'text', body });
const isDir = (value: unknown): value is Dir => typeof value === 'string' && Object.hasOwn(DIRS, value);
const schema = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({ type: 'object', additionalProperties: false, properties, required });

function rejectUnknownKeys(args: Record<string, unknown>): void {
  const hints: Record<string, string> = {
    skillId: 'requiresSkillId', skill: 'requiresSkillId', requires: 'requiresSkillId', hm: 'machine', item: 'machine', text: 'hint / blockedText', dialogue: 'hint / blockedText',
    dir: 'direction', width: 'rock·tree 는 span(칸 수) 또는 fullWidth:true(도로 폭 전체), water·waterfall 은 length', cells: '이 도구는 (x,y)에서 direction 으로 rock·tree 는 span 칸을 막고 water·waterfall 은 length 칸을 건넙니다', tileId: 'tile', type: 'kind', obstacle: 'kind',
  };
  for (const key of Object.keys(args)) {
    if ((KEYS as readonly string[]).includes(key)) continue;
    throw new ToolError(`place_field_obstacle 는 '${key}' 칸을 받지 않습니다(조용히 버리면 막는 지형·열쇠 기술이 사라지므로 거절합니다).${hints[key] ? ` ${hints[key]} 를 쓰세요.` : ''} 받는 칸: ${KEYS.join(', ')}`, { code: 'unknown-obstacle-field' });
  }
}

/** 이 칩셋에서 라벨이 패턴에 맞는 칸 번호들(번호순). */
function tilesByLabel(project: Project, map: GameMap, pattern: RegExp): number[] {
  const meta = project.tilesets[map.tilesetId]?.tileMeta ?? [];
  const out: number[] = [];
  meta.forEach((entry, index) => { if (entry && pattern.test(entry.label ?? '')) out.push(index); });
  return out;
}

function tileLayerOf(project: Project, map: GameMap, tile: number): ChangeTileLayer {
  return project.tilesets[map.tilesetId]?.tileMeta?.[tile]?.defaultLayer === 'lower' ? 'lower' : 'upper';
}

function readLayer(map: GameMap, layer: ChangeTileLayer, index: number): number {
  return layer === 'lower' ? map.lowerTiles[index] ?? -1 : map.upperTiles[index] ?? -1;
}

function writeLayer(map: GameMap, layer: ChangeTileLayer, index: number, tile: number): void {
  if (layer === 'lower') map.lowerTiles[index] = tile; else map.upperTiles[index] = tile;
}

function chosenTile(raw: unknown, name: string, count?: number): number | undefined {
  if (raw === undefined) return undefined;
  const tile = Number(raw);
  if (!Number.isInteger(tile) || tile < 0) throw new ToolError(`${name} 은 0 이상의 칸 번호입니다. tile_query 로 번호를 확인하세요.`, { code: 'invalid-args' });
  if (count !== undefined && tile >= count) throw new ToolError(`${name} ${tile} 은 이 칩셋의 칸 범위(0~${count - 1}) 밖입니다. tile_query 로 번호를 확인하세요.`, { code: 'invalid-args' });
  return tile;
}

/** 도로 폭 상한 — 이보다 넓은 열린 땅은 한 줄 장애물로 닫을 수 없는 광장이다. */
export const FIELD_OBSTACLE_MAX_SPAN = 16;

/** (x,y) 를 지나는 가로·세로 걸을 수 있는 칸의 연속 구간. 도로는 긴 쪽으로 달리고 폭은 짧은 쪽이다. */
function walkableRun(project: Project, map: GameMap, x: number, y: number, horizontal: boolean): { x: number; y: number }[] {
  const [dx, dy] = horizontal ? [1, 0] : [0, 1];
  let sx = x, sy = y;
  while (inMapBounds(map, sx - dx, sy - dy) && isPassable(project, map, sx - dx, sy - dy) && (x - sx) + (y - sy) < 64) { sx -= dx; sy -= dy; }
  const run: { x: number; y: number }[] = [];
  let cx = sx, cy = sy;
  while (inMapBounds(map, cx, cy) && isPassable(project, map, cx, cy) && run.length < 64) { run.push({ x: cx, y: cy }); cx += dx; cy += dy; }
  return run;
}

/** 칸 하나에서 걸어 닿는 칸 전체(타일 통행만 본다 — 이벤트는 보지 않는다). */
function reachableFrom(project: Project, map: GameMap, sx: number, sy: number): Set<number> {
  const seen = new Set<number>([sy * map.width + sx]);
  const queue: number[] = [sy * map.width + sx];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head]!;
    const cx = at % map.width, cy = Math.floor(at / map.width);
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx, ny = cy + dy;
      if (!inMapBounds(map, nx, ny)) continue;
      const key = ny * map.width + nx;
      if (seen.has(key) || !canMove(project, map, cx, cy, nx, ny)) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return seen;
}

/** 필드 스킬 레코드 — 있으면 필드 공통 이벤트가 이어졌는지만 맞추고, 없으면 독자 이름의 「잊을 수 없는」 스킬을 만든다. */
function ensureFieldSkill(draft: Project, kind: ObstacleKind, skillId: string, skillName: string | undefined, commonEventId: string, warnings: string[]): SkillRecord {
  const base = DEFAULTS[kind];
  const found = draft.database.skills.find((entry) => entry.id === skillId);
  if (found) {
    if (skillName && skillName !== found.name) warnings.push(`스킬 '${skillId}' 는 이미 있어 이름(${found.name})을 바꾸지 않았습니다 — 이름을 바꾸려면 upsert_skill.`);
    const updated = { ...found, fieldCommonEventId: found.fieldCommonEventId || commonEventId, unforgettable: true };
    if (!found.fieldCommonEventId) warnings.push(`스킬 '${found.name}' 에 필드 공통 이벤트가 없어 ${commonEventId} 를 연결했습니다.`);
    const at = draft.database.skills.findIndex((entry) => entry.id === skillId);
    draft.database.skills[at] = normalizeSkillRecord(updated);
    return draft.database.skills[at]!;
  }
  const record = normalizeSkillRecord({
    id: skillId, name: skillName?.trim() || base.skillName, scope: 'self', power: 0, type: 'normal',
    description: `필드 기술 — ${base.skillText}`, mpCost: { flat: 0, percentMax: 0 }, successRate: 100, variance: 0, hitRate: 100,
    effect: { kind: 'support' }, fieldCommonEventId: commonEventId, unforgettable: true,
  } as Partial<SkillRecord> & Pick<SkillRecord, 'id' | 'name'>);
  draft.database.skills.push(record);
  return record;
}

/**
 * 공통 이벤트 한 개를 스킬마다 둔다. 장애물이 늘면 「대상 이벤트 id == 이 장애물」 분기를 하나씩 안쪽 else 로 덧붙인다
 * (공통 이벤트에는 소유 이벤트가 없어 셀프 스위치를 쓸 수 없다 — 열림은 changeTile 과 이름 붙은 스위치로 한다).
 * 같은 장애물을 다시 부르면 그 분기를 갱신한다. 어느 장애물도 아니면 맨 안쪽 「여기에는 쓸 수 없다」 대사가 나온다.
 */
function ensureFieldCommonEvent(draft: Project, commonEventId: string, skillName: string, targetEventId: string, then: Command[]): void {
  let event = draft.commonEvents.find((entry) => entry.id === commonEventId);
  if (!event) {
    event = { id: commonEventId, name: `필드 기술: ${skillName}`, trigger: 'none', commands: [] };
    draft.commonEvents.push(event);
  }
  const branchFor = (): Extract<Command, { kind: 'fork' }> => ({
    kind: 'fork', condition: { kind: 'stringVariable', stringVariableId: 'fieldAbilityTarget', op: '==', value: targetEventId },
    then, else: [],
  });
  const append = (commands: Command[]): Command[] => {
    const last = commands[commands.length - 1];
    if (last && last.kind === 'fork' && last.condition.kind === 'stringVariable' && last.condition.stringVariableId === 'fieldAbilityTarget') {
      if (last.condition.value === targetEventId) return [...commands.slice(0, -1), { ...last, then }];
      return [...commands.slice(0, -1), { ...last, else: append(last.else ?? []) }];
    }
    return [...commands, { ...branchFor(), else: commands.length > 0 ? [] : [text('여기에는 쓸 수 없다.')] }];
  };
  const next = append(event.commands);
  // 맨 안쪽 else 가 비어 있으면(첫 분기가 아닌 경우) 기본 대사를 채운다.
  const fillTail = (commands: Command[]): Command[] => {
    const last = commands[commands.length - 1];
    if (last && last.kind === 'fork') return [...commands.slice(0, -1), { ...last, else: (last.else ?? []).length === 0 ? [text('여기에는 쓸 수 없다.')] : fillTail(last.else!) }];
    return commands;
  };
  event.commands = fillTail(next);
}

function ensureMachineItem(draft: Project, skill: SkillRecord, kind: ObstacleKind, machine: 'hm' | 'tm'): ItemRecord {
  const id = `item_${machine}_${skill.id.replace(/^skill_(field_)?/, '')}`;
  const found = draft.database.items.find((entry) => entry.id === id);
  if (found) return found;
  const record = normalizeItemRecord({
    id, name: DEFAULTS[kind].hmName.replace('비전서', machine === 'hm' ? '비전서' : '기술서'), type: 'book', learnedSkillId: skill.id, skillId: skill.id,
    description: `${skill.name}을(를) 가르친다. ${machine === 'hm' ? '아무리 써도 없어지지 않고, 배운 기술은 잊을 수 없다.' : '한 번 쓰면 없어진다.'}`,
    consumable: machine === 'tm', price: 0, occasion: 'always',
  } as Partial<ItemRecord> & Pick<ItemRecord, 'id' | 'name'>);
  draft.database.items.push(record);
  return record;
}

const BASE_PAGE = { movement: { type: 'fixed', speed: 3, frequency: 3 } } as const;
const SOLID = { ...BASE_PAGE, priority: 'same', overlapForbidden: true, trigger: { kind: 'action' } } as const;
const PASS = { ...BASE_PAGE, priority: 'below', overlapForbidden: false } as const;

export const FIELD_OBSTACLE_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'place_field_obstacle',
    mode: 'write',
    description:
      '포켓몬식 필드 기술 게이트(비전머신 HM)를 한 호출로 만든다: 길을 막는 바위(rock)·덩굴 나무(tree)·물길(water)·폭포(waterfall)·어둠(dark). ' +
      '이 도구가 막는 지형(칩셋의 실제 타일), 조사하는 투명 이벤트(모르면 안내·아는 파티면 「쓰자」 안내), 필드 스킬(없으면 독자 이름으로 생성·잊을 수 없는 기술) + 그 스킬의 공통 이벤트(이 장애물만 연다), ' +
      '기술머신 아이템(몬스터 파티 게임에서는 파티 몬스터에게 가르친다)을 전부 만든다. 어떤 파티원(배우·몬스터)이 requiresSkillId 를 알아야 열린다(partyKnowsSkill). ' +
      '길이 막혀 있는 칸(x,y)을 주면 된다 — rock·tree 는 걸어갈 수 있는 길 칸(바위·덩굴 타일을 깔아 막음; 기본 한 칸, 도로가 넓으면 span 칸 수나 fullWidth:true 로 폭 전체를 닫는다 — 한 칸만 놓으면 응답이 우회 가능(data.bypass:true)과 필요한 span 을 경고한다), water·waterfall 은 막힌 물·폭포 칸에서 시작해 direction 으로 length 칸(기술을 쓰면 다리·발판이 놓임), dark 는 걸을 수 있는 길목 칸(맵 전체를 어둡게 하고 그 칸에서 길을 막는다. 기술을 쓰거나 아는 파티가 입장하면 밝아지고 열림). ' +
      '**기술을 가르칠 방법은 호출자가 잇는다**: data.itemId(기술머신)를 NPC·상자가 changeItem 으로 주게 하라(place_chest 나 upsert_event) — 자동 플레이(qa:game check)는 그 줄을 따라가 기술을 익힌 뒤 장애물 앞에서 쓴다. 몬스터마다 가르칠 수 있는 종을 제한하려면 define_monster_species.machineSkillIds. ' +
      '쓰지 말 것: 퍼즐 문·열쇠 문(compile_puzzle), 밀어서 움직이는 바위(place_pushable), 전투로 지키는 길목(place_battle_blocker).',
    parameters: schema({
      mapId: { type: 'string' },
      x: { type: 'integer' },
      y: { type: 'integer' },
      kind: { type: 'string', enum: [...FIELD_OBSTACLE_KINDS], description: 'rock 바위 밀치기형 · tree 덩굴 가르기형 · water 물길 열기형 · waterfall 폭포 오르기형 · dark 어둠 밝히기형' },
      requiresSkillId: { type: 'string', description: '이 장애물을 여는 필드 스킬 id. 생략=종류별 기본(skill_field_shove·cut·ford·ascend·glow). 같은 id 를 쓰면 여러 장애물이 한 기술을 공유한다' },
      skillName: { type: 'string', description: '새로 만들 때 기술 이름(독자 이름 — 원작 이름은 쓰지 않는다). 이미 있는 스킬이면 무시' },
      name: { type: 'string', description: '이벤트 이름(생략=종류별 기본)' },
      tile: { type: 'integer', description: 'rock·tree 에 깔 막는 칸 번호(생략=칩셋에서 자동). 칩셋에 없으면 필요 — tile_query' },
      passTile: { type: 'integer', description: 'water·waterfall 에서 기술을 쓰면 놓이는 다리·발판 칸 번호(생략=칩셋에서 나무다리·디딤돌 자동)' },
      direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], description: 'water·waterfall: (x,y)에서 건너갈 방향(기본 right=물, up=폭포). rock·tree 의 span: 막는 줄이 뻗는 방향(생략=도로 폭이 좁은 쪽 축)' },
      length: { type: 'integer', description: 'water·waterfall: 건널 칸 수 1..12(기본 water 3, waterfall 2)' },
      span: { type: 'integer', description: `rock·tree: (x,y)에서 direction 방향으로 막는 칸 수 1..${FIELD_OBSTACLE_MAX_SPAN}(기본 1). 도로가 한 칸보다 넓으면 한 칸만 막은 장애물은 옆으로 우회된다 — 응답의 data.bypass 와 경고를 보라` },
      fullWidth: { type: 'boolean', description: `rock·tree: true 면 (x,y)를 지나는 도로를 가로로(또는 direction 이 가리키는 축으로) 걸을 수 있는 칸 전체에 놓아 길을 완전히 닫는다(폭이 ${FIELD_OBSTACLE_MAX_SPAN}칸을 넘으면 광장이라 거절). span 과 함께 쓰지 않는다` },
      machine: { type: 'string', enum: ['hm', 'tm', 'none'], description: 'hm=사라지지 않는 비전서(기본) · tm=한 번 쓰면 없어지는 기술서 · none=아이템 안 만듦(NPC 가 learnSkill 로 줌)' },
      hint: { type: 'string', description: '파티가 기술을 알 때 조사하면 나오는 안내 대사(생략=기본)' },
      blockedText: { type: 'string', description: '파티가 기술을 모를 때 조사하면 나오는 대사(생략=종류별 기본)' },
      id: { type: 'string' },
    }, ['mapId', 'x', 'y', 'kind']),
    invalidArgsHint: '종류는 kind(rock|tree|water|dark|waterfall), 여는 기술은 requiresSkillId, 대사는 hint(알 때)·blockedText(모를 때), 바위·덩굴은 span·fullWidth, 물길·폭포는 direction·length. 그 밖의 칸은 받지 않습니다.',
    invalidArgsExample: { mapId: 'map_route_3', x: 12, y: 9, kind: 'tree', skillName: '덩굴 가르기' },
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      rejectUnknownKeys(args);
      const map = requireMap(draft, args.mapId as string);
      const x = Number(args.x), y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map, x, y)) throw new ToolError(`장애물 위치가 맵 밖입니다: (${String(args.x)}, ${String(args.y)})`, { code: 'obstacle-out-of-bounds', mapId: map.id });
      const kind = args.kind;
      if (typeof kind !== 'string' || !(FIELD_OBSTACLE_KINDS as readonly string[]).includes(kind)) throw new ToolError(`kind 는 ${FIELD_OBSTACLE_KINDS.join('|')} 중 하나입니다(받은 값: ${JSON.stringify(args.kind)}).`, { code: 'invalid-args' });
      const k = kind as ObstacleKind;
      const base = DEFAULTS[k];
      const skillId = typeof args.requiresSkillId === 'string' && args.requiresSkillId.trim() ? args.requiresSkillId.trim() : base.skillId;
      const machine = args.machine === undefined ? 'hm' : args.machine;
      if (machine !== 'hm' && machine !== 'tm' && machine !== 'none') throw new ToolError("machine 은 'hm'|'tm'|'none' 입니다.", { code: 'invalid-args' });
      const direction: Dir = args.direction === undefined ? (k === 'waterfall' ? 'up' : 'right') : (isDir(args.direction) ? args.direction : (() => { throw new ToolError('direction 은 up|down|left|right 입니다.', { code: 'invalid-args' }); })());
      const length = args.length === undefined ? (k === 'waterfall' ? 2 : 3) : Number(args.length);
      if (!Number.isInteger(length) || length < 1 || length > 12) throw new ToolError('length 는 1..12 칸입니다.', { code: 'invalid-args' });
      const span = args.span === undefined ? undefined : Number(args.span);
      if (span !== undefined && (!Number.isInteger(span) || span < 1 || span > FIELD_OBSTACLE_MAX_SPAN)) throw new ToolError(`span 은 1..${FIELD_OBSTACLE_MAX_SPAN} 칸입니다.`, { code: 'invalid-args' });
      if (args.fullWidth !== undefined && typeof args.fullWidth !== 'boolean') throw new ToolError('fullWidth 는 true/false 입니다.', { code: 'invalid-args' });
      const fullWidth = args.fullWidth === true;
      if (fullWidth && span !== undefined) throw new ToolError('span 과 fullWidth 는 함께 쓰지 않습니다 — 칸 수를 직접 정하려면 span, 도로 폭 전체면 fullWidth:true.', { code: 'invalid-args' });
      if ((span !== undefined || fullWidth) && k !== 'rock' && k !== 'tree') throw new ToolError(`span·fullWidth 는 rock·tree 장애물에만 씁니다 — ${k} 는 ${k === 'dark' ? '한 칸 길목' : 'direction·length 로 건널 칸 수'}를 정합니다.`, { code: 'invalid-args' });
      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : genId('ev_obstacle');
      const eventName = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : base.event;
      const warnings: string[] = [];
      const near = entryCells(draft, map).filter((cell) => Math.abs(cell.x - x) + Math.abs(cell.y - y) <= 1);
      if (near.length) warnings.push(`장애물이 출입구·시작점 바로 옆입니다(${near.slice(0, 2).map((cell) => `(${cell.x},${cell.y})`).join(', ')}) — 들어서자마자 길이 막힙니다. 더 안쪽 길목에 두는 편이 좋습니다.`);
      // 같은 id 로 다시 부르면(위치·종류를 바꿔 다시 놓기) 앞서 깐 막는 타일을 원래대로 되돌린다 — 안 그러면 옛 칸에 바위가 영영 남아 길을 막는다.
      const previous = map.events.find((entry) => entry.id === id);
      if (previous) {
        for (const page of previous.pages ?? []) {
          for (const command of page.commands) {
            if (command.kind === 'changeTile' && command.mapId === map.id && command.x === previous.x && command.y === previous.y) {
              writeLayer(map, command.layer, command.y * map.width + command.x, command.tile);
              warnings.push(`같은 id '${id}' 의 앞선 장애물 칸 (${previous.x}, ${previous.y}) 의 막는 타일을 원래대로 되돌렸습니다.`);
            }
          }
        }
      }
      // span·fullWidth 로 늘린 칸의 보조 이벤트(`${id}_c<n>`)도 같은 방식으로 되돌리고 치운다.
      const extraPrefix = `${id}_c`;
      for (const extra of map.events.filter((entry) => entry.id.startsWith(extraPrefix) && /^\d+$/u.test(entry.id.slice(extraPrefix.length)))) {
        for (const page of extra.pages ?? []) for (const command of page.commands) {
          if (command.kind === 'changeTile' && command.mapId === map.id && command.x === extra.x && command.y === extra.y) writeLayer(map, command.layer, command.y * map.width + command.x, command.tile);
        }
      }
      map.events = map.events.filter((entry) => !(entry.id.startsWith(extraPrefix) && /^\d+$/u.test(entry.id.slice(extraPrefix.length))));
      const occupied = map.events.find((entry) => entry.id !== id && entry.x === x && entry.y === y);
      if (occupied) throw new ToolError(`(${x}, ${y}) 에는 이미 이벤트 '${occupied.id}' 가 있습니다 — 다른 칸을 고르거나 remove_event 로 치우세요.`, { code: 'obstacle-occupied', mapId: map.id, x, y });

      const hint = typeof args.hint === 'string' && args.hint.trim() ? args.hint.trim() : undefined;
      const blocked = typeof args.blockedText === 'string' && args.blockedText.trim() ? args.blockedText.trim() : base.blocked;
      const scratch = structuredClone(map);
      const probe: Project = { ...draft, maps: { ...draft.maps, [map.id]: scratch } };
      const pages: EventPage[] = [];
      const clearCommands: Command[] = [];
      let usedTile: number | undefined;
      let cells: { x: number; y: number }[] = [{ x, y }];

      // rock·tree 는 칸마다 막는 타일 + 보조 이벤트를 둔다(칸마다 서서 바라보며 기술을 쓸 수 있어야 하므로). water·waterfall·dark 는 이벤트 하나.
      const perCell: { x: number; y: number; clear: Command[] }[] = [];
      let roadWidth: number | undefined;
      let bypass: boolean | undefined;
      if (k === 'rock' || k === 'tree') {
        if (!isPassable(draft, map, x, y)) throw new ToolError(`(${x}, ${y}) 는 이미 막힌 칸입니다 — 바위·덩굴은 걸어갈 수 있는 길 칸에 놓아 길을 막습니다. get_map_region 으로 길 칸을 확인하세요.`, { code: 'obstacle-not-on-path', mapId: map.id, x, y });
        usedTile = chosenTile(args.tile, 'tile', draft.tilesets[map.tilesetId]?.count) ?? tilesByLabel(draft, map, base.tile!)[0];
        if (usedTile === undefined) throw new ToolError(`칩셋 '${map.tilesetId}' 에 ${k === 'tree' ? '자르기 나무' : '깨지는 바위'} 칸이 없습니다 — tile 로 막는 칸 번호를 직접 주세요(tile_query 로 '${k === 'tree' ? '나무·덤불' : '바위'}' 검색). 이 장애물은 monster_wild 칩셋 맵에서 그림까지 자동으로 깔립니다.`, { code: 'obstacle-tile-missing', mapId: map.id });
        // 막는 줄의 축: direction 이 있으면 그 축, 없으면 도로 폭이 좁은 쪽(도로는 긴 쪽으로 달린다).
        const horizontalRun = walkableRun(draft, map, x, y, true);
        const verticalRun = walkableRun(draft, map, x, y, false);
        const horizontal = isDir(args.direction) ? (args.direction === 'left' || args.direction === 'right') : horizontalRun.length <= verticalRun.length;
        roadWidth = (horizontal ? horizontalRun : verticalRun).length;
        let lineCells: { x: number; y: number }[] = [{ x, y }];
        if (fullWidth) {
          lineCells = horizontal ? horizontalRun : verticalRun;
          if (lineCells.length > FIELD_OBSTACLE_MAX_SPAN) throw new ToolError(`(${x}, ${y}) 를 지나는 열린 땅이 ${lineCells.length} 칸 폭이라 fullWidth 로 닫을 수 없습니다(상한 ${FIELD_OBSTACLE_MAX_SPAN}) — 광장·들판입니다. 폭이 좁은 길목(get_map_region 으로 길이 좁아지는 곳)에 놓거나 span 으로 일부만 막으세요.`, { code: 'obstacle-too-wide', mapId: map.id, x, y });
        } else if (span !== undefined && span > 1) {
          const step = isDir(args.direction) ? DIRS[args.direction] : (horizontal ? DIRS.right : DIRS.down);
          lineCells = Array.from({ length: span }, (_, i) => ({ x: x + step[0] * i, y: y + step[1] * i }));
          const outside = lineCells.find((cell) => !inMapBounds(map, cell.x, cell.y));
          if (outside) throw new ToolError(`(${x}, ${y}) 에서 ${span} 칸이면 맵 밖(${outside.x}, ${outside.y})입니다 — span 을 줄이거나 시작 칸·direction 을 바꾸세요.`, { code: 'obstacle-out-of-bounds', mapId: map.id });
          const closed = lineCells.filter((cell) => !isPassable(draft, map, cell.x, cell.y));
          if (closed.length) warnings.push(`span 줄의 ${closed.length} 칸은 이미 막혀 있어 타일을 깔지 않았습니다: ${closed.slice(0, 3).map((cell) => `(${cell.x},${cell.y})`).join(', ')}.`);
          lineCells = lineCells.filter((cell) => isPassable(draft, map, cell.x, cell.y));
        }
        for (const cell of lineCells) {
          const other = map.events.find((entry) => entry.id !== id && entry.x === cell.x && entry.y === cell.y);
          if (other) throw new ToolError(`(${cell.x}, ${cell.y}) 에는 이미 이벤트 '${other.id}' 가 있습니다 — span·fullWidth 줄이 그 칸을 지납니다. 다른 위치를 고르거나 remove_event 로 치우세요.`, { code: 'obstacle-occupied', mapId: map.id, x: cell.x, y: cell.y });
        }
        for (const cell of lineCells) {
          const layer = tileLayerOf(draft, map, usedTile);
          const index = cell.y * map.width + cell.x;
          const original = readLayer(map, layer, index);
          writeLayer(scratch, layer, index, usedTile);
          if (isPassable(probe, scratch, cell.x, cell.y)) throw new ToolError(`타일 ${usedTile} 은 통행 가능이라 길을 막지 못합니다 — 막히는 칸(바위·나무)을 tile 로 고르세요(tile_query).`, { code: 'obstacle-tile-passable', mapId: map.id });
          writeLayer(map, layer, index, usedTile);
          perCell.push({ x: cell.x, y: cell.y, clear: [{ kind: 'changeTile', mapId: map.id, layer, x: cell.x, y: cell.y, tile: original }] });
        }
        perCell.sort((a, b) => Number(b.x === x && b.y === y) - Number(a.x === x && a.y === y)); // 기본 이벤트(id)가 (x,y) 칸
        cells = perCell.map((entry) => ({ x: entry.x, y: entry.y }));
        // 우회로 판정 — 막은 칸 곁의 걸을 수 있는 칸들이 장애물을 둔 채로도 서로 이어지는가. 이어지면(큰 덩이가 하나뿐이면) 그냥 돌아 지나간다.
        const sides = new Map<number, { x: number; y: number }>();
        for (const cell of cells) {
          for (const [dx, dy] of Object.values(DIRS)) {
            const nx = cell.x + dx, ny = cell.y + dy;
            if (inMapBounds(map, nx, ny) && isPassable(probe, scratch, nx, ny) && !cells.some((c) => c.x === nx && c.y === ny)) sides.set(ny * map.width + nx, { x: nx, y: ny });
          }
        }
        if (sides.size >= 2) {
          const blocks: Set<number>[] = [];
          for (const [key, cell] of sides) {
            if (blocks.some((block) => block.has(key))) continue;
            blocks.push(reachableFrom(probe, scratch, cell.x, cell.y));
          }
          // 장애물 너머에 3칸도 안 되는 구석(막다른 한두 칸)만 떨어져 나오면 길을 닫은 것이 아니다.
          const gated = blocks.filter((block) => block.size >= 3).length >= 2;
          bypass = !gated;
          if (bypass) {
            const need = Math.min(roadWidth, FIELD_OBSTACLE_MAX_SPAN);
            warnings.push(`우회로가 있습니다 — 도로 폭 ${roadWidth}칸 중 ${cells.length}칸만 막아 옆으로 돌아 지나갈 수 있어 게이트가 닫히지 않습니다(플레이어는 기술 없이 통과). ${roadWidth <= FIELD_OBSTACLE_MAX_SPAN ? `같은 id 로 다시 부르며 fullWidth:true(또는 span:${need})를 주어 폭 전체를 막으세요` : `폭이 ${roadWidth}칸으로 넓은 열린 땅입니다 — 폭이 좁은 길목으로 옮기세요`}; 숲·절벽·물이 길을 좁히는 곳이 좋습니다. check_reachability 로 장애물 너머가 막혀 있는지 확인하세요.`);
          }
        }
      } else if (k === 'water' || k === 'waterfall') {
        const [dx, dy] = DIRS[direction];
        cells = Array.from({ length }, (_, i) => ({ x: x + dx * i, y: y + dy * i }));
        const outside = cells.find((cell) => !inMapBounds(map, cell.x, cell.y));
        if (outside) throw new ToolError(`(${x}, ${y}) 에서 ${direction} 로 ${length} 칸이면 맵 밖(${outside.x}, ${outside.y})입니다 — length 를 줄이세요.`, { code: 'obstacle-out-of-bounds', mapId: map.id });
        const open = cells.filter((cell) => isPassable(draft, map, cell.x, cell.y));
        if (open.length === cells.length) throw new ToolError(`(${x}, ${y}) 부터 ${length} 칸은 이미 걸어갈 수 있습니다 — 물·폭포로 막힌 칸에서 시작하세요(paint_tiles 로 물·폭포를 먼저 칠하거나 get_map_region 으로 확인).`, { code: 'obstacle-not-blocked', mapId: map.id, x, y });
        if (open.length) warnings.push(`건널 칸 중 ${open.length} 칸은 이미 걸을 수 있습니다: ${open.slice(0, 3).map((cell) => `(${cell.x},${cell.y})`).join(', ')}.`);
        const bridges = tilesByLabel(draft, map, base.pass!);
        usedTile = chosenTile(args.passTile, 'passTile', draft.tilesets[map.tilesetId]?.count) ?? (k === 'water' && (direction === 'up' || direction === 'down') && bridges.length > 1 ? bridges[1] : bridges[0]);
        if (usedTile === undefined) throw new ToolError(`칩셋 '${map.tilesetId}' 에 ${k === 'water' ? '나무다리' : '디딤돌'} 칸이 없습니다 — passTile 로 놓을 통행 가능한 칸 번호를 주세요(tile_query).`, { code: 'obstacle-tile-missing', mapId: map.id });
        const layer: ChangeTileLayer = 'upper';
        for (const cell of cells) {
          const index = cell.y * map.width + cell.x;
          if (isPassable(draft, map, cell.x, cell.y)) continue;
          scratch.upperTiles[index] = usedTile;
          if (!isPassable(probe, scratch, cell.x, cell.y)) throw new ToolError(`칸 ${usedTile} 을 (${cell.x}, ${cell.y}) 위에 놓아도 통행이 열리지 않습니다 — passTile 로 통행 가능한 다리·발판 칸을 고르세요(tile_query).`, { code: 'obstacle-tile-blocked', mapId: map.id, x: cell.x, y: cell.y });
          clearCommands.push({ kind: 'changeTile', mapId: map.id, layer, x: cell.x, y: cell.y, tile: usedTile });
        }
      } else {
        // dark — 맵을 어둡게 하고 기술을 아는 파티가 들어서면 밝힌다.
        const current = map.defaultLighting;
        map.defaultLighting = { ambient: Math.max(0.82, current?.ambient ?? 0), ...(current?.color ? { color: current.color } : {}), sources: current?.sources ?? [] };
        if (!isPassable(draft, map, x, y)) warnings.push(`(${x}, ${y}) 가 막힌 칸입니다 — 어둠 이벤트는 걸을 수 있는 칸에 두세요.`);
      }

      // 플레이어가 바라볼 칸이 있는가 — 곁 칸이 턱·벽이라 거기로 걸어 들어갈 수 없으면 기술을 쓸 자리가 없다(게이트가 영영 안 열린다).
      if (k !== 'dark') {
        const standable = cells.length ? [cells[0]!] : [];  // rock·tree 는 cells[0] 이 (x,y)
        const faceable = standable.some((cell) => (['up', 'down', 'left', 'right'] as const).some((d) => {
          const nx = cell.x + DIRS[d][0], ny = cell.y + DIRS[d][1];
          if (cells.some((c) => c.x === nx && c.y === ny) || !inMapBounds(map, nx, ny) || !isPassable(draft, map, nx, ny)) return false;
          return (['up', 'down', 'left', 'right'] as const).some((e) => {
            const fx = nx + DIRS[e][0], fy = ny + DIRS[e][1];
            return !(fx === cell.x && fy === cell.y) && inMapBounds(map, fx, fy) && canMove(draft, map, fx, fy, nx, ny);
          });
        }));
        if (!faceable) {
          const message = `(${x}, ${y}) 곁에 걸어 들어와 서서 바라볼 수 있는 칸이 없습니다(곁 칸이 턱·벽이거나 막다른 칸) — 플레이어가 기술을 쓸 자리가 없어 게이트가 영영 안 열립니다. get_map_region 으로 길 칸(턱·벽 제외)을 확인해 다른 칸에 놓으세요.`;
          if (k === 'rock' || k === 'tree') throw new ToolError(message, { code: 'obstacle-unfaceable', mapId: map.id, x, y });
          warnings.push(message);
        }
      }

      // 스킬·공통 이벤트·아이템
      const skillPreview = draft.database.skills.find((entry) => entry.id === skillId);
      const skillName = skillPreview?.name ?? (typeof args.skillName === 'string' && args.skillName.trim() ? args.skillName.trim() : base.skillName);
      const defaultCe = `ce_${skillId}`;
      const skill = ensureFieldSkill(draft, k, skillId, typeof args.skillName === 'string' ? args.skillName : undefined, defaultCe, warnings);
      const commonEventId = skill.fieldCommonEventId ?? defaultCe;
      const doneSwitchId = `sw_${id}_open`;
      if (k === 'dark') {
        const lit: Command[] = [text(`${skillName}!`), { kind: 'setLighting', ambient: 0, transitionMs: 600 }, text('주위가 환하게 밝아졌다.')];
        const found = draft.commonEvents.find((entry) => entry.id === commonEventId);
        if (found) found.commands = lit; else draft.commonEvents.push({ id: commonEventId, name: `필드 기술: ${skillName}`, trigger: 'none', commands: lit });
      } else {
        ensureNamedSwitch(draft, doneSwitchId, `필드 장애물 열림: ${eventName}`);
        ensureFieldCommonEvent(draft, commonEventId, skillName, id, [text(`${skillName}!`), { kind: 'setSwitch', switchId: doneSwitchId, value: true }]);
      }
      const item = machine === 'none' ? undefined : ensureMachineItem(draft, skill, k, machine);

      // 이벤트 페이지: 모름(막힘) → 앎(안내) → 열림 신호(스위치) 자동 처리 → 열린 뒤
      const knowsText = hint ?? (k === 'dark' ? `${skill.name}의 빛이 어둠을 몰아낸다.` : `${skill.name}(으)로 치울 수 있을 것 같다. 메뉴의 기술에서 ${skill.name}을(를) 쓰자.`);
      const knows = { kind: 'partyKnowsSkill', skillId: skill.id } as const;
      const gatePages = (eventId: string, clear: Command[]): EventPage[] => [
        { id: `${eventId}_blocked`, name: '막힘', conditions: [], graphic: { transparent: true }, ...SOLID, commands: [text(`${blocked} ${skill.name}을(를) 쓸 수 있는 동료가 있다면…`)] },
        { id: `${eventId}_know`, name: '기술을 앎', conditions: [knows], graphic: { transparent: true }, ...SOLID, commands: [text(knowsText)] },
        {
          id: `${eventId}_opening`, name: '열리는 중', conditions: [{ kind: 'switch', switchId: doneSwitchId, value: true }], graphic: { transparent: true }, ...PASS, trigger: { kind: 'auto' },
          commands: [...clear, { kind: 'setSelfSwitch', key: 'B', value: true }],
        },
        { id: `${eventId}_open`, name: '열림', conditions: [{ kind: 'selfSwitch', key: 'B', value: true }], graphic: { transparent: true }, ...PASS, trigger: { kind: 'action' }, commands: [] },
      ];
      const eventIds: string[] = [];
      if (k === 'dark') {
        pages.push({
          id: `${id}_dark`, name: '어둠 밝히기', conditions: [], graphic: { transparent: true }, ...PASS, trigger: { kind: 'auto' },
          commands: [{ kind: 'fork', condition: knows, then: [{ kind: 'setLighting', ambient: 0, transitionMs: 600 }, text(knowsText)], else: [text(`${blocked} ${skill.name}을(를) 쓸 수 있는 동료가 있다면 밝힐 수 있을 것이다.`)] }],
        });
        const event: GameEvent = { id, name: eventName, x, y, trigger: { kind: 'auto' }, commands: [], pages };
        assertEventShape(event, warnings, event, draft);
        upsertEventIntoMap(map, event);
        eventIds.push(id);
      } else if (k === 'water' || k === 'waterfall') {
        const event: GameEvent = { id, name: eventName, x, y, trigger: { kind: 'action' }, commands: [], pages: gatePages(id, clearCommands) };
        assertEventShape(event, warnings, event, draft);
        upsertEventIntoMap(map, event);
        eventIds.push(id);
      } else {
        // rock·tree: 막은 칸마다 이벤트 하나(첫 칸 = id, 나머지 = `${id}_c2`…). 어느 칸 앞에서 기술을 써도 같은 스위치로 줄 전체가 열린다.
        perCell.forEach((entry, index) => {
          const eventId = index === 0 ? id : `${id}_c${index + 1}`;
          if (index > 0) ensureFieldCommonEvent(draft, commonEventId, skillName, eventId, [text(`${skillName}!`), { kind: 'setSwitch', switchId: doneSwitchId, value: true }]);
          const event: GameEvent = { id: eventId, name: index === 0 ? eventName : `${eventName} ${index + 1}`, x: entry.x, y: entry.y, trigger: { kind: 'action' }, commands: [], pages: gatePages(eventId, entry.clear) };
          assertEventShape(event, warnings, event, draft);
          upsertEventIntoMap(map, event);
          eventIds.push(eventId);
        });
      }

      const sameSkill = draft.database.skills.filter((entry) => entry.unforgettable && entry.fieldCommonEventId).length;
      if (sameSkill > 8) warnings.push(`잊을 수 없는 필드 기술이 ${sameSkill}개입니다 — 몬스터는 기술이 넷뿐이라 비전머신이 많으면 전투 기술을 넣을 칸이 없습니다(보통 4~5개 이하).`);
      if (item) warnings.push(`아이템 ${item.id}(${item.name})을 만들었습니다 — 누가 주는지 이어야 합니다: NPC·상자 이벤트의 changeItem {itemId:'${item.id}', op:'+=', amount:1}. 파티 몬스터 하나가 가방에서 이 아이템을 써 기술을 익혀야 열립니다.`);
      return {
        summary: `${map.name} (${x}, ${y}) 에 필드 장애물(${k}) '${eventName}' — 여는 기술 ${skill.name}(${skill.id})${item ? `, 기술 아이템 ${item.id}` : ''}${cells.length > 1 ? (k === 'water' || k === 'waterfall' ? `, 건널 칸 ${cells.length}` : `, 막은 칸 ${cells.length}`) : ''}${bypass === true ? ' — 우회로 있음(길이 닫히지 않음)' : bypass === false ? ' — 길이 닫힘' : ''}`,
        data: { eventId: id, eventIds, kind: k, skillId: skill.id, commonEventId, itemId: item?.id, tile: usedTile, cells, x, y, ...(roadWidth !== undefined ? { roadWidth } : {}), ...(bypass !== undefined ? { bypass } : {}) },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
];
