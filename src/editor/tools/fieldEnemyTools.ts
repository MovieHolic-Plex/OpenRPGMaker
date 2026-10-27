// editor/tools/fieldEnemyTools.ts
// place_field_enemy — 필드에 보이는 적(심볼 인카운터). 닿으면 전투, 이기면 사라진다.
// 새 런타임 개념이 아니라 이미 있는 조각의 조립이다: eventTouch 트리거 + movement(fixed/custom 순찰/chase 시야 추격)
// + showEmote + battleProcessing + 승리 스위치 페이지 + 도망 뒤 기절(self switch B) 페이지.
// 랜덤 인카운터(set_encounter_table)·구역 스폰(make_hunting_ground)·지키는 한 마리(place_battle_blocker)와 구분한다.
import { FIELD_APPROACH_STYLES, defaultFieldApproachStyle, isFieldApproachStyle, type FieldApproachStyle } from '@/project/fieldApproachStyle';
import type { Command, Dir, EventPage, EventPageGraphic, EventPageMovement, GameEvent, GameMap, Project } from '@/project/types';
import { npcMoveDurationMs, npcPageMoveIntervalMs } from '@/project/characterMotion';
import { canMove, isPassable } from '@/project/collision';
import { genId } from '@/util/id';
import { buildMapPlacementContext } from '@/ai/mapPlacementContext';
import { ToolError, type ToolDefinition, type ToolExecResult, type JsonSchema } from './types';
import { inMapBounds, requireMap } from './mapHelpers';
import { resolveGraphic, type GraphicSpec } from './eventCompile';
import { ensureNamedSwitch } from './flagHelpers';
import { assertEventShape, placementAdjustedWarning, resolveEventPlacement, upsertEventIntoMap } from './eventTools';
import { protectedCells } from './npcPatrolTools';
import { walkableFromAnchors } from './transferReachability';
import { entryCells } from '@/project/eventPassageBlock';
import { GRAPHIC_SPEC_SCHEMA } from './schemaShapes';
import { battlersForFieldGraphic, fieldGraphicForBattler, fieldReadyBattlerIds } from './fieldEnemyGraphics';
import { charsetGraphic } from './eventCompile';
import { decodeCharsetFrameIndex } from '@/assets/easyrpgRtp';
import { isGeneratedMonsterSprite } from '@/assets/generatedMonsterSprites';

const DIRS: Record<Dir, readonly [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const BEHAVIORS = ['stationary', 'patrol', 'chase'] as const;
const PACES = ['slow', 'normal', 'fast'] as const;
type Behavior = (typeof BEHAVIORS)[number];
type Pace = (typeof PACES)[number];
const ALERTS = ['exclamation', 'anger', 'question', 'none'] as const;

/** 추격 한 칸 = 걸음 트윈(speed) + 결정 간격(frequency). 주인공 걷기는 160ms/칸이라 셋 다 주인공보다 느리다. */
const CHASE_PACE: Record<Pace, { speed: number; frequency: number }> = {
  slow: { speed: 3, frequency: 4 },
  normal: { speed: 4, frequency: 5 },
  fast: { speed: 5, frequency: 6 },
};
const PATROL_INTERVAL_MS: Record<Pace, number> = { slow: 1000, normal: 700, fast: 450 };
const STUN_MS = 3000;
/** 시야에 든 순간 머리 위 말풍선을 띄우고 이만큼 서 있다가 쫓는다(플레이어가 돌아설 틈). */
const ALERT_HOLD_MS = 700;
/** 시야에서 놓친 뒤 마지막 목격 자리를 이만큼 뒤지다 원래 자리로 돌아간다. */
const SEARCH_BEFORE_RETURN_MS = 1500;
const DEFAULT_SIGHT = 4;

/** charset 그래픽의 시트·칸 키(textureKey#characterIndex). 필드 그림 비교용. */
function graphicCellKey(graphic: EventPageGraphic): string {
  const pattern = typeof graphic.pattern === 'number' ? graphic.pattern : 0;
  return `${graphic.sprite?.id ?? ''}#${decodeCharsetFrameIndex(pattern).characterIndex}`;
}

function isDir(value: unknown): value is Dir {
  return typeof value === 'string' && Object.hasOwn(DIRS, value);
}

function oneOf<T extends string>(value: unknown, list: readonly T[], fallback: T, label: string): T {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && (list as readonly string[]).includes(value)) return value as T;
  throw new ToolError(`${label} 은(는) ${list.join('|')} 중 하나입니다.`, { code: 'invalid-args' });
}

/** 다른 이벤트가 차지한 칸(자리 + 닫힌 순찰 경유 칸). 그 위로 적이 걸어 들어가지 않게 한다. */
function occupiedByOthers(map: GameMap, ignoreId: string): Set<string> {
  const occupied = new Set<string>();
  for (const other of map.events) {
    if (other.id === ignoreId) continue;
    occupied.add(`${other.x},${other.y}`);
    for (const page of other.pages ?? []) {
      if (page.movement.type !== 'custom' || !page.movement.route) continue;
      let at = { x: other.x, y: other.y };
      for (const move of page.movement.route.moves) {
        if (move.kind !== 'move' || !isDir(move.dir)) continue;
        at = { x: at.x + DIRS[move.dir][0], y: at.y + DIRS[move.dir][1] };
        occupied.add(`${at.x},${at.y}`);
      }
    }
  }
  return occupied;
}

/** 시작 칸에서 dirs 를 따라 걸어 본다 — 매 걸음이 양방향으로 통행 가능해야 한다. 막히면 null. */
function walkRoute(project: Project, map: GameMap, from: { x: number; y: number }, dirs: readonly Dir[]): { x: number; y: number }[] | null {
  const cells = [{ ...from }];
  let at = { ...from };
  for (const dir of dirs) {
    const next = { x: at.x + DIRS[dir][0], y: at.y + DIRS[dir][1] };
    if (!inMapBounds(map, next.x, next.y) || !isPassable(project, map, next.x, next.y)) return null;
    if (!canMove(project, map, at.x, at.y, next.x, next.y) || !canMove(project, map, next.x, next.y, at.x, at.y)) return null;
    cells.push(next);
    at = next;
  }
  return cells;
}

/** patrol.directions 가 있으면 그대로(닫힌 경로 확인), 없으면 length 칸 왕복 직선을 통행 가능한 방향으로 고른다. */
function resolvePatrol(project: Project, map: GameMap, from: { x: number; y: number }, raw: unknown, occupied: ReadonlySet<string>): { dirs: Dir[]; cells: { x: number; y: number }[] } {
  const spec = (raw && typeof raw === 'object' ? raw : {}) as { directions?: unknown; length?: unknown; axis?: unknown };
  const free = (cells: readonly { x: number; y: number }[]) => cells.every((cell) => !occupied.has(`${cell.x},${cell.y}`));
  if (Array.isArray(spec.directions)) {
    const dirs = spec.directions;
    if (dirs.length < 2 || dirs.length > 16 || !dirs.every(isDir)) throw new ToolError('patrol.directions 는 up|down|left|right 2..16개의 닫힌 경로입니다.', { code: 'invalid-args' });
    const cells = walkRoute(project, map, from, dirs);
    if (!cells) throw new ToolError('patrol.directions 가 벽·지형을 가로지릅니다 — get_map_region 으로 통행 가능한 칸을 확인하세요.', { code: 'unsafe-patrol' });
    const end = cells[cells.length - 1]!;
    if (end.x !== from.x || end.y !== from.y) throw new ToolError('patrol.directions 는 출발 칸으로 돌아오는 닫힌 경로여야 합니다(예: right,right,left,left).', { code: 'unsafe-patrol' });
    if (!free(cells)) throw new ToolError('순찰 경로가 다른 이벤트 칸과 겹칩니다.', { code: 'unsafe-patrol' });
    return { dirs, cells };
  }
  const length = spec.length === undefined ? 3 : Number(spec.length);
  if (!Number.isInteger(length) || length < 1 || length > 8) throw new ToolError('patrol.length 는 1..8 칸입니다(왕복 직선).', { code: 'invalid-args' });
  const axis = spec.axis === undefined ? 'any' : spec.axis;
  if (axis !== 'any' && axis !== 'horizontal' && axis !== 'vertical') throw new ToolError('patrol.axis 는 horizontal|vertical 입니다.', { code: 'invalid-args' });
  const candidates: Dir[] = axis === 'horizontal' ? ['right', 'left'] : axis === 'vertical' ? ['down', 'up'] : ['right', 'left', 'down', 'up'];
  for (const out of candidates) {
    const dirs: Dir[] = [...Array<Dir>(length).fill(out), ...Array<Dir>(length).fill(OPPOSITE[out])];
    const cells = walkRoute(project, map, from, dirs);
    if (cells && free(cells)) return { dirs, cells };
  }
  throw new ToolError(`(${from.x}, ${from.y}) 에서 ${length}칸 왕복할 직선 통로가 없습니다 — patrol.length 를 줄이거나 get_map_region 으로 넓은 바닥에 다시 놓으세요.`, { code: 'unsafe-patrol' });
}

function fieldEnemyPages(input: {
  id: string; troopId: string; graphic: EventPageGraphic;
  clearSwitchId: string; movement: EventPage['movement']; alert: (typeof ALERTS)[number]; canEscape: boolean; respawnSec: number;
}): EventPage[] {
  const { id } = input;
  // 추격 적은 시야에 든 순간(movement.sightAlert)에 이미 놀람을 냈다 — 닿을 때 또 띄우지 않는다.
  const alertedOnSight = input.movement.sightAlert !== undefined;
  const fight: Command[] = [
    ...(input.alert === 'none' || alertedOnSight ? [] : [
      { kind: 'showEmote', target: { eventId: id }, emote: input.alert, durationMs: 600 } as Command,
      { kind: 'wait', ms: 520 } as Command,
    ]),
    { kind: 'battleProcessing', troopId: input.troopId, canEscape: input.canEscape, canLose: false },
    { kind: 'fork', condition: { kind: 'battleResult', result: 'victory' }, then: [{ kind: 'setSwitch', switchId: input.clearSwitchId, value: true }] },
    // 도망쳐도 적이 바로 옆에 서 있다 — 기절 페이지(self switch B)가 몇 초 접촉을 끈다. 안 그러면 도망 직후 같은 전투가 다시 열린다.
    ...(input.canEscape ? [{ kind: 'fork', condition: { kind: 'battleResult', result: 'escape' }, then: [{ kind: 'setSelfSwitch', key: 'B', value: true }] } as Command] : []),
  ];
  return [
    {
      id: `${id}_fight`, name: '필드 적', conditions: [], graphic: structuredClone(input.graphic),
      trigger: { kind: 'eventTouch' }, priority: 'same', overlapForbidden: true, animationType: input.movement.type === 'fixed' ? 'fixedGraphic' : 'normal',
      movement: input.movement, commands: fight,
    },
    // 도망 불가 전투(보스·수호자)에는 숨 고르기 페이지를 켤 곳이 없다 — 남기면 「셀프 스위치 B 를 켜는 곳이 없다」 경고가 된다.
    ...(input.canEscape ? [{
      id: `${id}_stun`, name: '도망 뒤 숨 고르기', conditions: [{ kind: 'selfSwitch', key: 'B', value: true }], graphic: structuredClone(input.graphic),
      trigger: { kind: 'parallel' }, priority: 'same', overlapForbidden: true, animationType: 'fixedGraphic',
      movement: { type: 'fixed', speed: 3, frequency: 3 },
      commands: [{ kind: 'wait', ms: STUN_MS }, { kind: 'setSelfSwitch', key: 'B', value: false }],
    } satisfies EventPage] : []),
    {
      id: `${id}_cleared`, name: '쓰러진 자리', conditions: [{ kind: 'switch', switchId: input.clearSwitchId, value: true }], graphic: { transparent: true },
      // action 이면 쓰러진 자리 곁에 「Z 조사」 안내가 남는다(2026-10-14 런타임 QA) — 아무것도 안 하는 병렬 페이지로 둔다.
      trigger: { kind: 'parallel' }, priority: 'below', overlapForbidden: false, animationType: 'fixedGraphic',
      movement: { type: 'fixed', speed: 3, frequency: 3 },
      commands: input.respawnSec > 0 ? [{ kind: 'wait', ms: Math.round(input.respawnSec * 1000) }, { kind: 'setSwitch', switchId: input.clearSwitchId, value: false }] : [],
    },
  ];
}

/** 필드 적 이벤트의 종족 — 이벤트 이름·적 그룹 이름·선두 적 이름·그림으로 «다가오는 방식» 기본값을 고른다. */
export function inferFieldApproachStyle(project: Project, event: GameEvent): FieldApproachStyle {
  const troopIds = (event.pages ?? []).flatMap((page) => page.commands.flatMap((c) => c.kind === 'battleProcessing' ? [String((c as { troopId?: unknown }).troopId ?? '')] : []));
  const hints: string[] = [event.name ?? '', event.id];
  for (const troopId of troopIds) {
    const troop = project.database.troops.find((entry) => entry.id === troopId);
    if (!troop) continue;
    hints.push(troop.id, troop.name ?? '');
    for (const enemyId of troop.enemyIds) {
      const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
      if (enemy) hints.push(enemy.id, enemy.name ?? '', String((enemy as { monsterResourceId?: string }).monsterResourceId ?? ''));
    }
  }
  return defaultFieldApproachStyle(...hints);
}

/** 'auto' 면 종족으로, 아니면 그 값. 모르는 값은 오류. */
function resolveApproachArg(project: Project, event: GameEvent, raw: unknown): FieldApproachStyle | undefined {
  if (raw === undefined) return undefined;
  if (raw === 'auto') return inferFieldApproachStyle(project, event);
  if (!isFieldApproachStyle(raw)) throw new ToolError(`approachStyle 은 auto|${FIELD_APPROACH_STYLES.join('|')} 입니다.`, { code: 'invalid-args' });
  return raw;
}

const APPROACH_STYLE_SCHEMA = {
  type: 'string', enum: ['auto', ...FIELD_APPROACH_STYLES],
  description: '추격할 때 다가오는 방식 — dash 질주(늑대·짐승: 쉬지 않고, 덮치기는 훨씬 빠르게) · pounce 웅크렸다 두 칸 아치 도약(거미) · hop 통통 튀기(슬라임) · swoop 좌우로 흔들리며 들쭉날쭉 날아듦(박쥐·새) · lumber 느릿하지만 쉬지 않고 멀리까지 쫓음(골렘·거인) · float 둥실 부유(유령) · slither S자로 기어 옴(뱀) · walk 기본 걷기. auto = 적 이름·그룹으로 종족을 읽어 고른다',
} as const;

export interface FieldEnemyChaseOptions {
  /** 시야 칸(2..8, 기본 5). 입구가 시야+1 칸 안이면 그만큼 줄인다(들어서자마자 덮치지 않게). */
  readonly sightRange?: number;
  /** cone = 앞쪽 90° 부채꼴(이벤트 시선 조건 eventSeesPlayer 와 같은 판정, 기본) · any = 사방. */
  readonly vision?: 'any' | 'cone';
  /** 추격 걸음(기본 fast). 순찰은 걸음마다 두 박자 쉬어 추격보다 눈에 띄게 느리다. */
  readonly pace?: Pace;
  readonly alert?: Exclude<(typeof ALERTS)[number], 'none'>;
  /** 시야에서 놓친 뒤 마지막 목격 자리를 뒤지는 시간(기본 2500ms) — 그 뒤 출발 칸으로 돌아가 다시 순찰한다. */
  readonly searchMs?: number;
  /** 발견 직후 덮치기 칸 수(0 = 없음, 기본 0). 그 칸들은 lungeSpeed 랭크로 쉬지 않고 달려든다. */
  readonly lungeSteps?: number;
  /** 덮치기 걸음 랭크(1~6, 기본 6 = 주인공 걷기와 같은 160ms/칸 — 계속 걸으면 따라잡히지 않는다). */
  readonly lungeSpeed?: number;
  /** 다가오는 방식. 'auto' = 종족으로. 생략하면 이미 있던 방식을 그대로 둔다. */
  readonly approachStyle?: FieldApproachStyle | 'auto';
}

/**
 * 이미 놓인 보이는 적(place_field_enemy 의 「필드 적」 페이지)을 「보면 달려드는」 적으로 바꾼다 — 다시 쓸 수 있는 묶음.
 * 시야(부채꼴·벽 가림)에 들면 머리 위 느낌표 → 순찰보다 빠른 걸음으로 쫓아와 닿으면 전투, 놓치면 잠깐 뒤지다 돌아가 순찰을 잇는다.
 * 순찰 경로(custom route)는 그대로 살려 시야 밖 걸음으로 쓴다. 필드 적 페이지가 없거나 입구가 너무 가까우면 바꾸지 않는다.
 */
export function makeFieldEnemyChase(project: Project, map: GameMap, event: GameEvent, options: FieldEnemyChaseOptions = {}): { ok: boolean; reason?: string; sightRange?: number } {
  const fight = (event.pages ?? []).find((page) => page.trigger.kind === 'eventTouch' && page.commands.some((c) => c.kind === 'battleProcessing'));
  if (!fight) return { ok: false, reason: 'not-field-enemy' };
  const dirs = (fight.movement.route?.moves ?? []).flatMap((move) => {
    const rec = move as { kind?: string; dir?: unknown };
    return rec.kind === 'move' && isDir(rec.dir) ? [rec.dir] : [];
  });
  const cells = (dirs.length ? walkRoute(project, map, { x: event.x, y: event.y }, dirs) : null) ?? [{ x: event.x, y: event.y }];
  const entries = entryCells(project, map);
  const nearest = Math.min(Infinity, ...cells.flatMap((cell) => entries.map((entry) => Math.abs(entry.x - cell.x) + Math.abs(entry.y - cell.y))));
  let range = Math.max(2, Math.min(12, Math.round(options.sightRange ?? 5)));
  while (range >= 2 && nearest <= range + 1) range -= 1;
  if (range < 2) return { ok: false, reason: 'entry-too-close' };
  const pace = CHASE_PACE[options.pace ?? 'fast'];
  const approachStyle = options.approachStyle === undefined ? fight.movement.approachStyle
    : options.approachStyle === 'auto' ? inferFieldApproachStyle(project, event) : options.approachStyle;
  fight.movement = {
    type: 'chase', speed: pace.speed, frequency: pace.frequency, sightRange: range, giveUpRange: range + 4, pathfind: true,
    sight: { range, lineOfSight: true, facing: options.vision ?? 'cone' },
    pursuit: { scope: 'map', doorDelayMs: 0, searchMs: options.searchMs ?? 2500, onLost: 'return' },
    ...(dirs.length ? { route: { repeat: true, skippable: false, moves: dirs.flatMap((dir) => [{ kind: 'move' as const, dir }, { kind: 'wait' as const }, { kind: 'wait' as const }]) } } : {}),
    sightAlert: { emote: options.alert ?? 'exclamation', holdMs: ALERT_HOLD_MS },
    ...(options.lungeSteps && options.lungeSteps > 0
      ? { chaseLunge: { steps: Math.max(1, Math.min(8, Math.round(options.lungeSteps))), speed: Math.max(1, Math.min(6, Math.round(options.lungeSpeed ?? 6))) } }
      : {}),
    ...(approachStyle && approachStyle !== 'walk' ? { approachStyle } : {}),
  };
  fight.animationType = 'normal';
  // 시야에 든 순간 이미 놀람을 냈다 — 닿을 때 또 띄우지 않는다(fieldEnemyPages 와 같은 규칙).
  if (fight.commands[0]?.kind === 'showEmote' && fight.commands[1]?.kind === 'wait') fight.commands.splice(0, 2);
  return { ok: true, sightRange: range };
}


/** 시야·추격 조율 — place_field_enemy·tune_field_enemies·set_field_detection 이 같이 쓰는 일반 인자. */
export interface FieldDetectionTuning {
  /** 시야(칸, 2..12). */
  readonly sightRange?: number;
  /** 부채꼴 각(30..180°, 기본 90). 주면 시야 모양이 cone 이 된다. */
  readonly coneDegrees?: number;
  /** 쫓는 동안 한 칸에 드는 시간(160..3000ms). 주인공 걷기 = 160. */
  readonly chaseStepMs?: number;
  /** 알아챈 순간 말풍선을 띄우고 멈추는 시간(0..3000ms). 짧을수록 빨리 덤빈다. */
  readonly alertMs?: number;
  /** 놓친 뒤 마지막 목격 자리를 뒤지는 시간(0..20000ms) — 추격 기억. */
  readonly searchMs?: number;
  /** 이만큼(칸) 멀어지면 포기(시야+1..30). */
  readonly giveUpRange?: number;
}

export const FIELD_DETECTION_SCHEMA: Record<string, JsonSchema> = {
  sightRange: { type: 'integer', description: '시야(칸, 2..12). 넓을수록 멀리서 알아본다' },
  coneDegrees: { type: 'integer', description: '시야 부채꼴 각(30..180°, 기본 90). 주면 앞쪽 부채꼴 시야가 된다 — 120~150 이면 곁눈으로도 본다(경계병)' },
  chaseStepMs: { type: 'integer', description: '쫓는 동안 한 칸에 드는 시간(160..3000ms). 주인공 걷기 = 160, 보통 추격 ≈ 480. 작을수록 빨리 다가온다(다가오는 방식의 몸짓은 남는다)' },
  alertMs: { type: 'integer', description: '알아챈 순간 느낌표를 띄우고 멈추는 시간(0..3000ms, 기본 700). 짧을수록 빨리 덤빈다' },
  searchMs: { type: 'integer', description: '놓친 뒤 마지막으로 본 자리를 뒤지는 시간(0..20000ms, 기본 1500~2500) — 추격 기억' },
  giveUpRange: { type: 'integer', description: '이만큼(칸) 멀어지면 포기하고 돌아간다(시야+1..30)' },
};

const intIn = (value: unknown, lo: number, hi: number, name: string): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new ToolError(`${name} 는 ${lo}..${hi} 입니다.`, { code: 'invalid-args' });
  return Math.round(n);
};

/** 도구 인자에서 조율 값을 읽는다(범위 밖이면 거절). */
export function readFieldDetectionArgs(args: Record<string, unknown>): FieldDetectionTuning {
  const out: { -readonly [K in keyof FieldDetectionTuning]: FieldDetectionTuning[K] } = {};
  const sight = intIn(args.sightRange, 2, 12, 'sightRange'); if (sight !== undefined) out.sightRange = sight;
  const cone = intIn(args.coneDegrees, 30, 180, 'coneDegrees'); if (cone !== undefined) out.coneDegrees = cone;
  const step = intIn(args.chaseStepMs, 160, 3000, 'chaseStepMs'); if (step !== undefined) out.chaseStepMs = step;
  const alert = intIn(args.alertMs, 0, 3000, 'alertMs'); if (alert !== undefined) out.alertMs = alert;
  const search = intIn(args.searchMs, 0, 20000, 'searchMs'); if (search !== undefined) out.searchMs = search;
  const give = intIn(args.giveUpRange, 3, 30, 'giveUpRange'); if (give !== undefined) out.giveUpRange = give;
  return out;
}

/** 추격 박자(ms/칸) → 걸음 랭크(한 칸 미끄러지는 시간)와 칸 사이 쉼. 걸음은 박자에서 쉼 80ms 를 뺀 것 이하의 가장 느린 랭크. */
export function chaseStepTiming(stepMs: number): { speed: number; moveIntervalMs: number } {
  const ms = Math.max(160, Math.min(3000, Math.round(stepMs)));
  let speed = 7;
  for (let rank = 1; rank <= 7; rank += 1) if (npcMoveDurationMs(rank) <= ms - 80) { speed = rank; break; }
  return { speed, moveIntervalMs: Math.max(80, ms - npcMoveDurationMs(speed)) };
}

/**
 * 추격 페이지의 시야·박자·놀람·기억을 바꾼다(나머지는 그대로). 순찰 경로가 있으면 칸 사이 쉼을 늘려 순찰 걸음은 예전 빠르기를 지킨다
 * — 추격만 빨라지고 시야 밖 순찰이 같이 빨라지지 않게.
 */
export function applyFieldDetection(movement: EventPageMovement, tuning: FieldDetectionTuning): EventPageMovement {
  const next: EventPageMovement = { ...movement };
  if (tuning.sightRange !== undefined) {
    next.sightRange = tuning.sightRange;
    next.sight = { ...(next.sight ?? { range: tuning.sightRange, lineOfSight: true, facing: 'cone' }), range: tuning.sightRange };
    if (tuning.giveUpRange === undefined) next.giveUpRange = Math.max(next.giveUpRange ?? 0, tuning.sightRange + 4);
  }
  if (tuning.coneDegrees !== undefined) {
    const range = next.sight?.range ?? next.sightRange ?? 5;
    next.sight = { ...(next.sight ?? { range, lineOfSight: true, facing: 'cone' }), facing: 'cone', coneDegrees: tuning.coneDegrees };
  }
  if (tuning.chaseStepMs !== undefined) {
    const before = { duration: npcMoveDurationMs(next.speed), interval: npcPageMoveIntervalMs(next) };
    const timing = chaseStepTiming(tuning.chaseStepMs);
    next.speed = timing.speed;
    next.moveIntervalMs = timing.moveIntervalMs;
    next.chaseStepMs = Math.max(160, Math.min(3000, Math.round(tuning.chaseStepMs)));
    const moves = next.route?.moves ?? [];
    const steps = moves.filter((m) => (m as { kind?: string }).kind === 'move').length;
    const waits = moves.filter((m) => (m as { kind?: string }).kind === 'wait').length;
    if (next.route && steps > 0) {
      const patrolMs = before.duration + (waits / steps) * before.interval;
      const perStep = Math.max(1, Math.ceil((patrolMs - npcMoveDurationMs(timing.speed)) / timing.moveIntervalMs));
      const rebuilt: typeof moves = [];
      for (const m of moves) {
        if ((m as { kind?: string }).kind === 'wait') continue;
        rebuilt.push(m);
        if ((m as { kind?: string }).kind === 'move') for (let i = 0; i < perStep; i += 1) rebuilt.push({ kind: 'wait' } as (typeof moves)[number]);
      }
      next.route = { ...next.route, moves: rebuilt };
    }
  }
  if (tuning.alertMs !== undefined) {
    if (tuning.alertMs === 0 && next.sightAlert) next.sightAlert = { ...next.sightAlert, holdMs: 0 };
    else if (tuning.alertMs > 0) next.sightAlert = { emote: next.sightAlert?.emote ?? 'exclamation', holdMs: tuning.alertMs };
  }
  if (tuning.searchMs !== undefined) {
    next.pursuit = { ...(next.pursuit ?? { scope: 'map', doorDelayMs: 0, onLost: 'return' }), searchMs: tuning.searchMs } as NonNullable<EventPageMovement['pursuit']>;
  }
  if (tuning.giveUpRange !== undefined) next.giveUpRange = Math.max((next.sightRange ?? next.sight?.range ?? 2) + 1, tuning.giveUpRange);
  return next;
}

const schema = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({ type: 'object', additionalProperties: false, properties, required });

export const FIELD_ENEMY_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'place_field_enemy',
    mode: 'write',
    choosesOwnGraphic: (args) => args.graphic === undefined,
    description:
      '필드 맵에 「보이는 적」(심볼 인카운터, 크로노 트리거·FF 심볼식) 한 마리를 놓는다. 걸어 다니는 적에게 닿으면 그 자리에서 전투가 열리고, 이기면 사라지며 맵을 나갔다 들어와도 그대로 사라져 있다(승리 스위치). 패배는 기존 게임 오버 경로, 도망치면 몇 초 기절해 같은 전투가 바로 다시 열리지 않는다. 느낌표(alert)는 chase 는 시야에 든 순간, stationary·patrol 은 닿기 직전에 뜬다. ' +
      'behavior: stationary=제자리 보초(주인공이 닿거나 부딪히면 전투) · patrol=닫힌 왕복 순찰(patrol.length 칸 직선 또는 patrol.directions 닫힌 경로) · chase=시야(sightRange 칸, 벽 가림) 안에 들면 머리 위 느낌표(alert)와 짧은 멈춤 뒤 쫓아오고, 놓치면 마지막 목격 자리를 잠깐 뒤진 뒤 원래 자리로 돌아간다. chase 에 patrol 을 같이 주면 시야 밖에서는 순찰하다 시야에 들면 쫓고 놓치면 돌아와 다시 순찰한다. pace 는 주인공 걷기보다 항상 느려 피할 수 있다. ' +
      '던전 층·들판·길목에서 「몬스터가 돌아다닌다/눈에 보이는 적/피하거나 선제」 요청의 정본 — 한 마리씩 의도한 자리에 놓고 필요한 만큼 여러 번 호출한다(보통 한 맵 3~6마리, 서로 다른 troopId·behavior 로). ' +
      '필드 그림은 **전투 그림이 정본**: 적 그룹 선두 적의 monsterResourceId 와 같은 종류의 charset 을 자동으로 고른다(슬라임→슬라임 칩, 해골→해골 칩). 대응하는 걷기 칩이 없는 종(박쥐·늑대·거미 등)은 **전투에 서는 같은 도트 그림을 정지 심볼로 그대로** 쓴다(다른 그림으로 대체하지 않는다). 전투 그림(monsterResourceId)이 아예 없는 적만 거절한다. ' +
      '쓰지 말 것: 마을·실내 생활 공간(마을 맵은 거부됨), 보스방·이야기 전투(place_battle_blocker 로 조사 전투 + upsert_troop_battle_page), 걸을 때마다 무작위로 터지는 랜덤 인카운터(set_encounter_table), 구역 전체에 리스폰하는 사냥터(make_hunting_ground). 출입구·시작점 주변과 도달 불가 칸은 거부하며 chase 는 입구에서 시야 밖에 놓아야 한다. ' +
      '전투 방향 보정(적 등 뒤 접촉=선제, 등을 잡히면 기습)은 set_project_settings battle.formationRoll:true 를 켜야 적용된다. 그림은 생략하면 적 그룹 선두 몬스터 이름으로 기존 도트를 찾는다(새 그림·생성 인물 금지).',
    parameters: schema({
      mapId: { type: 'string' },
      x: { type: 'integer' },
      y: { type: 'integer' },
      troopId: { type: 'string', description: '데이터베이스 적 그룹 id(없으면 upsert_troop 으로 먼저 만든다). 생략하고 graphic 만 주면 그 그림과 같은 종류의 적 그룹을 고른다' },
      behavior: { type: 'string', enum: [...BEHAVIORS], description: '기본 stationary' },
      patrol: { type: 'object', description: 'behavior:patrol 또는 chase(순찰+추격) 일 때. {length?:1..8 칸 왕복(기본 3), axis?:horizontal|vertical} 또는 {directions:[up|down|left|right..]} 출발 칸으로 돌아오는 닫힌 경로', properties: { length: { type: 'integer' }, axis: { type: 'string', enum: ['horizontal', 'vertical'] }, directions: { type: 'array', items: { type: 'string', enum: ['up', 'down', 'left', 'right'] } } } },
      sightRange: { type: 'integer', description: 'behavior:chase 시야(칸, 2..12, 기본 4). 이 안에서 벽에 안 가리면 쫓는다' },
      coneDegrees: FIELD_DETECTION_SCHEMA.coneDegrees!, chaseStepMs: FIELD_DETECTION_SCHEMA.chaseStepMs!, alertMs: FIELD_DETECTION_SCHEMA.alertMs!, searchMs: FIELD_DETECTION_SCHEMA.searchMs!,
      vision: { type: 'string', enum: ['any', 'cone'], description: "behavior:chase 시야 모양. any(기본)=사방, cone=바라보는 방향 앞 부채꼴만(등 뒤로 몰래 지나가면 못 본다)" },
      giveUpRange: { type: 'integer', description: 'behavior:chase 이만큼(칸) 멀어지면 포기하고 출발 칸으로 돌아간다(기본 시야+4, 시야+1..20)' },
      pace: { type: 'string', enum: [...PACES], description: 'slow(기본)|normal|fast — 셋 다 주인공 걷기보다 느리다' },
      approachStyle: { ...APPROACH_STYLE_SCHEMA, description: 'behavior:chase 일 때 ' + APPROACH_STYLE_SCHEMA.description + '. 생략 = auto' },
      graphic: { ...GRAPHIC_SPEC_SCHEMA, description: '생략 시 적 그룹 선두 몬스터 이름으로 검색한 기존 도트' },
      alert: { type: 'string', enum: [...ALERTS], description: '머리 위 말풍선(chase=시야에 든 순간, 그 외=닿기 직전). 기본 exclamation, none 이면 말풍선 없이 바로' },
      canEscape: { type: 'boolean', description: '도망 가능 여부(기본 true). false 는 도망 불가 전투' },
      respawnSec: { type: 'integer', description: '0(기본)=한 번 이기면 영구 소멸. 양수면 그 맵에 머문 채 N초 뒤 같은 자리에 다시 나타난다' },
      clearSwitchId: { type: 'string', description: '승리 시 켜지는 스위치(생략 시 자동 생성). 퀘스트·문 조건으로 쓸 수 있다' },
      factionId: { type: 'string', description: '진영(set_factions 로 정의한 id). 적대(태도 -1 이하) 진영의 보이는 적과 2칸 안에서 마주치면 맵 위에서 짧게 부딪히고 전력이 약한 쪽이 사라진다(맵에 다시 들어오면 돌아온다). 플레이어는 두 진영 모두에게 덮쳐진다. 생략 = 선두 적 레코드의 factionId(있고 정의된 진영일 때), 그것도 없으면 진영 싸움 없음' },
      id: { type: 'string' },
    }, ['mapId', 'x', 'y']),
    invalidArgsExample: { mapId: 'map_dungeon_1', x: 12, y: 8, troopId: 'troop_bat', behavior: 'chase', sightRange: 4, pace: 'slow' },
    run(draft: Project, args): ToolExecResult {
      const map = requireMap(draft, args.mapId as string);
      const x = Number(args.x), y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map, x, y)) throw new ToolError(`필드 적 위치가 맵 밖입니다: (${String(args.x)}, ${String(args.y)})`, { code: 'field-enemy-out-of-bounds', mapId: map.id });
      // 필드 그림 ↔ 전투 적 일치(fieldEnemyGraphics.ts): 그림만 주고 troopId 를 생략하면 그 그림에 맞는 적 그룹을 고른다.
      const explicitGraphic = args.graphic as GraphicSpec | undefined;
      let troopId = typeof args.troopId === 'string' ? args.troopId.trim() : '';
      let troopFromGraphic = false;
      if (!troopId) {
        if (!explicitGraphic) throw new ToolError('troopId 또는 graphic 이 필요합니다.', { code: 'invalid-args' });
        const wanted = resolveGraphic(explicitGraphic, { overrides: draft.charsetLabels });
        const wantedKey = graphicCellKey(wanted);
        const match = draft.database.troops.find((entry) => {
          const leadEnemy = draft.database.enemies.find((enemy) => enemy.id === entry.enemyIds[0]);
          const cell = fieldGraphicForBattler(leadEnemy?.monsterResourceId);
          return cell !== undefined && `${cell.textureKey}#${cell.characterIndex}` === wantedKey;
        });
        if (!match) {
          const [textureKey, index] = wantedKey.split('#') as [string, string];
          const battlers = battlersForFieldGraphic(textureKey, Number(index));
          throw new ToolError(`graphic 「${wantedKey}」 과 같은 종류의 전투 적을 가진 적 그룹이 없습니다 — monsterResourceId 를 ${battlers.slice(0, 4).join(' | ') || '(이 그림에 대응하는 전투 시트 없음)'} 중 하나로 가진 적을 upsert_enemy·upsert_troop 한 뒤 다시 부르세요.`, { code: 'troop-not-found', mapId: map.id });
        }
        troopId = match.id;
        troopFromGraphic = true;
      }
      const troop = draft.database.troops.find((entry) => entry.id === troopId);
      if (!troop) throw new ToolError(`존재하지 않는 troopId: ${troopId} — ${draft.database.troops.slice(0, 8).map((entry) => entry.id).join(', ') || '(적 그룹 없음 — upsert_troop 먼저)'}`, { code: 'troop-not-found', mapId: map.id });
      const behavior: Behavior = oneOf(args.behavior, BEHAVIORS, 'stationary', 'behavior');
      const pace: Pace = oneOf(args.pace, PACES, 'slow', 'pace');
      const alert = oneOf(args.alert, ALERTS, 'exclamation', 'alert');
      const canEscape = args.canEscape !== false;
      const respawnSec = args.respawnSec === undefined ? 0 : Number(args.respawnSec);
      if (!Number.isFinite(respawnSec) || respawnSec < 0 || respawnSec > 3600) throw new ToolError('respawnSec 은 0..3600 입니다.', { code: 'invalid-args' });
      const sightRaw = args.sightRange === undefined ? DEFAULT_SIGHT : Number(args.sightRange);
      if (!Number.isInteger(sightRaw) || sightRaw < 2 || sightRaw > 12) throw new ToolError('sightRange 는 2..12 칸입니다.', { code: 'invalid-args' });
      const detection = readFieldDetectionArgs({ coneDegrees: args.coneDegrees, chaseStepMs: args.chaseStepMs, alertMs: args.alertMs, searchMs: args.searchMs });

      // 마을·실내는 안전한 곳이다 — 거기서 적이 돌아다니면 시나리오가 깨진다.
      const role = buildMapPlacementContext(draft, map.id)?.role;
      if (role && (role.role === 'town' || role.role === 'interior')) {
        throw new ToolError(`${map.name} 은(는) ${role.role === 'town' ? '마을' : '실내'}(${role.reason}) — 필드 적을 두지 않습니다. 들판·길·던전 맵에 놓으세요. 이야기 속 적은 place_battle_blocker.`, { code: 'field-enemy-safe-area', mapId: map.id });
      }

      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : genId('ev_field_enemy');
      const placement = resolveEventPlacement(draft, map, x, y, { kind: 'character', ignoreEventId: id, label: `필드 적 '${troopId}'`, code: 'field-enemy-impassable' });
      const start = { x: placement.x, y: placement.y };
      const occupied = occupiedByOthers(map, id);

      let patrol: { dirs: Dir[]; cells: { x: number; y: number }[] } | undefined;
      if (behavior === 'patrol' || (behavior === 'chase' && args.patrol !== undefined)) patrol = resolvePatrol(draft, map, start, args.patrol, occupied);
      else if (args.patrol !== undefined) throw new ToolError('patrol 은 behavior:"patrol" 또는 "chase"(순찰+추격) 에서만 씁니다.', { code: 'invalid-args' });
      const cells = patrol?.cells ?? [start];

      // 출입구·시작점·표지 곁과 도달 불가 칸은 안 된다 — 들어서자마자 싸우거나, 못 가는 곳에 적이 갇힌다.
      const protectedAt = protectedCells(draft, map);
      for (const cell of cells) {
        const near = protectedAt.filter((entry) => Math.abs(entry.x - cell.x) + Math.abs(entry.y - cell.y) <= 2);
        if (near.length) throw new ToolError(`출입구·시작점·안내 표지 2칸 안에는 필드 적을 둘 수 없습니다: (${cell.x}, ${cell.y}) 곁 ${JSON.stringify(near.slice(0, 3))}. 더 안쪽 칸으로 옮기세요.`, { code: 'field-enemy-unsafe-spot', mapId: map.id, x: cell.x, y: cell.y });
        if (occupied.has(`${cell.x},${cell.y}`)) throw new ToolError(`(${cell.x}, ${cell.y}) 은 다른 이벤트 칸입니다.`, { code: 'field-enemy-unsafe-spot', mapId: map.id });
      }
      if (behavior === 'chase') {
        const reach = sightRaw + 1;
        const entries = entryCells(draft, map);
        // 순찰+추격은 순찰 경로 어느 칸에서도 입구가 시야 안이면 안 된다.
        for (const cell of cells) {
          const arrivals = entries.filter((entry) => Math.abs(entry.x - cell.x) + Math.abs(entry.y - cell.y) <= reach);
          if (arrivals.length) throw new ToolError(`추격 적이 입구에서 시야(${sightRaw}칸) 안에 있어 맵에 들어서자마자 전투가 열립니다: (${cell.x}, ${cell.y}). 입구에서 ${reach}칸보다 먼 칸에 놓거나 sightRange 를 줄이세요.`, { code: 'field-enemy-ambush', mapId: map.id, x: cell.x, y: cell.y });
        }
      }
      const reach = walkableFromAnchors(draft, map);
      if (reach) {
        const cut = cells.find((cell) => !reach.has(cell.y * map.width + cell.x));
        if (cut) throw new ToolError(`(${cut.x}, ${cut.y}) 은 시작점·출입구에서 걸어 닿지 못하는 칸입니다 — 플레이어가 만날 수 없는 적입니다. 닿을 수 있는 바닥에 놓으세요.`, { code: 'field-enemy-unreachable', mapId: map.id, x: cut.x, y: cut.y });
      }

      // 필드 그림 = 전투 그림과 같은 종류. 정본은 선두 적의 monsterResourceId(전투에서 보이는 그림)이다.
      const lead = draft.database.enemies.find((entry) => entry.id === troop.enemyIds[0]);
      const expected = fieldGraphicForBattler(lead?.monsterResourceId);
      let graphic: EventPageGraphic | undefined;
      let graphicNote: string | undefined;
      if (explicitGraphic) {
        graphic = resolveGraphic(explicitGraphic, { overrides: draft.charsetLabels });
        if (expected && graphicCellKey(graphic) !== `${expected.textureKey}#${expected.characterIndex}`) {
          throw new ToolError(`graphic 이 전투 그림과 다릅니다: 적 그룹 '${troopId}' 선두 '${lead?.name ?? troop.enemyIds[0]}'(${lead?.monsterResourceId}) 은(는) 필드에서 「${expected.label}」(${expected.textureKey}:${expected.characterIndex}) 로 보여야 합니다. graphic 을 생략하면 자동으로 맞춥니다.`, { code: 'field-enemy-graphic-mismatch', mapId: map.id });
        }
        if (!expected) graphicNote = `graphic 지정 — 이 적(${lead?.monsterResourceId ?? lead?.name ?? '?'})의 전투 그림과 같은 종류인지 검사할 수 없습니다(대응표에 없는 종).`;
      } else if (expected) {
        graphic = charsetGraphic(expected.textureKey, expected.characterIndex);
        graphicNote = `필드 그림 「${expected.label}」 — 전투 그림(${lead?.monsterResourceId})과 같은 종류로 자동 선택`;
      } else if (lead?.monsterResourceId && isGeneratedMonsterSprite(lead.monsterResourceId)) {
        // 같은 종류의 걷기 칩이 없는 종(박쥐·늑대·거미 …): 전투에 서는 **같은 도트 그림**을 필드 심볼로 쓴다.
        // 다른 그림으로 대체하는 것이 아니라 전투 그림 그대로이므로 필드의 모습과 전투가 어긋나지 않는다. 플레이어가 이 그림에서
        // 약 2칸 크기의 걷기 칩(좌우 방향·걸음 통통·그림자·외곽선)을 런타임에 뽑는다(src/player/fieldFoeSprite.ts).
        graphic = { sprite: { type: 'bundled', id: lead.monsterResourceId }, direction: 'down', pattern: 0 };
        graphicNote = `걷기 칩이 없는 종 — 전투 도트 그림(${lead.monsterResourceId})에서 필드 걷기 칩을 자동으로 뽑아 씀(약 2칸, 좌우 방향·걸음·그림자)`;
      } else if (!lead?.monsterResourceId) {
        // 전투 그림이 아직 없는 적 — 이름으로 찾되 못 찾으면 다른 그림으로 대체하지 않고 거절한다.
        for (const name of [lead?.name?.trim(), troop.name?.trim()].filter((entry): entry is string => !!entry)) {
          try { graphic = resolveGraphic({ query: name }, { overrides: draft.charsetLabels }); graphicNote = `monsterResourceId 가 없어 이름 「${name}」 로 찾은 도트`; break; } catch (error) { if (!(error instanceof ToolError)) throw error; }
        }
      }
      if (!graphic) {
        throw new ToolError(`적 그룹 '${troopId}' 선두 '${lead?.name ?? troop.enemyIds[0]}'(${lead?.monsterResourceId ?? '그림 없음'}) 은(는) 필드에 둘 같은 종류의 그림이 없습니다 — 다른 그림(예: 슬라임)으로 대체하면 필드에는 슬라임이 서 있는데 박쥐와 싸우게 되므로 거절합니다. 필드에 둘 수 있는 전투 시트: ${fieldReadyBattlerIds().slice(0, 14).join(', ')} … 이 중 하나를 monsterResourceId 로 가진 적 그룹을 쓰세요.`, { code: 'field-enemy-no-field-graphic', mapId: map.id });
      }
      if (troopFromGraphic) graphicNote = `troopId 생략 → graphic 과 같은 종류의 적 그룹 '${troopId}' 선택`;
      const clearSwitchId = typeof args.clearSwitchId === 'string' && args.clearSwitchId.trim() ? args.clearSwitchId.trim() : `sw_${id}_clear`;
      ensureNamedSwitch(draft, clearSwitchId, `필드 적 처치: ${id}`);

      const chase = CHASE_PACE[pace];
      // 순찰 경로: 걸음마다 한 박자 쉰다 — 추격(CHASE_PACE)과 같은 결정 간격을 쓰므로 안 쉬면 순찰이 추격만큼 빠르다.
      const patrolRoute = (chaseSpeed: boolean) => patrol ? {
        repeat: true, skippable: false,
        moves: chaseSpeed
          ? patrol.dirs.flatMap((dir) => [{ kind: 'move' as const, dir }, { kind: 'wait' as const }])
          : [...patrol.dirs.map((dir) => ({ kind: 'move' as const, dir })), { kind: 'wait' as const }],
      } : undefined;
      const baseMovement: EventPage['movement'] = behavior === 'chase'
        ? {
          type: 'chase', speed: chase.speed, frequency: chase.frequency, sightRange: sightRaw,
          giveUpRange: Number.isFinite(Number(args.giveUpRange)) ? Math.max(sightRaw + 1, Math.min(20, Math.round(Number(args.giveUpRange)))) : sightRaw + 4, pathfind: true,
          // 시야·수색·복귀는 기존 추격 정책(sight+pursuit)을 쓴다: 시야(벽 가림) 안이면 쫓고, 놓치면 마지막 목격 자리를 뒤지다
          // 출발 칸으로 돌아간다(onLost:'return'). 순찰 경로가 있으면 돌아온 뒤 처음부터 다시 순찰한다.
          sight: { range: sightRaw, lineOfSight: true, facing: args.vision === 'cone' ? 'cone' : 'any' },
          pursuit: { scope: 'map', doorDelayMs: 0, searchMs: SEARCH_BEFORE_RETURN_MS, onLost: 'return' },
          ...(patrol ? { route: patrolRoute(true) } : {}),
          ...(alert === 'none' ? {} : { sightAlert: { emote: alert, holdMs: ALERT_HOLD_MS } }),
        }
        : behavior === 'patrol' && patrol
          ? { type: 'custom', speed: 3, frequency: 3, moveIntervalMs: PATROL_INTERVAL_MS[pace], route: patrolRoute(false) }
          : { type: 'fixed', speed: 3, frequency: 3 };
      const movement: EventPage['movement'] = behavior === 'chase' && Object.keys(detection).length ? applyFieldDetection(baseMovement, detection) : baseMovement;

      // 진영 싸움(project/fieldEnemyClash.ts): 명시 factionId → 선두 적의 factionId. 정의되지 않은 진영은 거절한다.
      const declaredFactions = new Set((draft.factions?.defs ?? []).map((def) => def.id));
      const explicitFaction = typeof args.factionId === 'string' && args.factionId.trim() ? args.factionId.trim() : undefined;
      if (explicitFaction && !declaredFactions.has(explicitFaction)) {
        throw new ToolError(`정의되지 않은 진영입니다: ${explicitFaction} — set_factions 로 먼저 진영과 태도(서로 -1 이하 = 싸움)를 정하세요. 있는 진영: ${[...declaredFactions].join(', ') || '없음'}`, { code: 'unknown-faction', mapId: map.id });
      }
      const fieldFactionId = explicitFaction ?? (lead?.factionId && declaredFactions.has(lead.factionId) ? lead.factionId : undefined);
      const event: GameEvent = {
        id, x: start.x, y: start.y, trigger: { kind: 'eventTouch' }, commands: [],
        pages: fieldEnemyPages({ id, troopId, graphic, clearSwitchId, movement, alert, canEscape, respawnSec }),
        ...(fieldFactionId ? { fieldFactionId } : {}),
      };
      if (behavior === 'chase') {
        // 종족마다 다른 몸짓으로 다가온다(질주·도약·통통·급강하·육중·부유·기기). 생략 = 종족으로.
        const style = resolveApproachArg(draft, event, args.approachStyle ?? 'auto');
        for (const page of event.pages ?? []) if (page.movement.type === 'chase' && style && style !== 'walk') page.movement.approachStyle = style;
      }
      const warnings: string[] = [];
      assertEventShape(event, warnings);
      upsertEventIntoMap(map, event);

      if (placement.adjusted) warnings.push(placementAdjustedWarning(`필드 적 '${troopId}'`, { x, y }, start));
      if (graphicNote) warnings.push(graphicNote);
      if (draft.system.battleFormationRoll !== true) warnings.push('선제·기습(등 뒤 접촉 보정)은 꺼져 있습니다 — 켜려면 set_project_settings battle.formationRoll:true.');
      const mapEnemies = map.events.filter((entry) => entry.pages?.some((page) => page.id.endsWith('_fight') && page.trigger.kind === 'eventTouch')).length;
      if (mapEnemies > 8) warnings.push(`이 맵의 필드 적이 ${mapEnemies}마리입니다 — 한 화면에 몰리면 피할 길이 없습니다. 보통 3~6마리.`);
      if (map.safeZones?.some((zone) => cells.some((cell) => cell.x >= zone.x && cell.x < zone.x + zone.w && cell.y >= zone.y && cell.y < zone.y + zone.h))) warnings.push('안전지대 안에 놓였습니다 — 추격은 안전지대 안의 주인공을 쫓지 않습니다.');
      if (respawnSec > 0) warnings.push(`처치 ${respawnSec}초 뒤 같은 자리에 다시 나타납니다(그 맵에 머무는 동안). 영구 소멸이 필요하면 respawnSec 를 빼세요.`);

      return {
        summary: `${map.name} (${start.x}, ${start.y}) 에 필드 적 '${troopId}' — ${behavior}${patrol ? ` ${patrol.dirs.length}걸음 왕복` : ''}${behavior === 'chase' ? ` 시야 ${sightRaw}칸${patrol ? '(시야 밖 순찰)' : ''}·놓치면 복귀` : ''}`,
        data: { eventId: id, clearSwitchId, behavior, x: start.x, y: start.y, cells: patrol ? cells : undefined, adjusted: placement.adjusted, ...(fieldFactionId ? { factionId: fieldFactionId } : {}) },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
  {
    name: 'tune_field_enemies',
    mode: 'write',
    domains: ['event'],
    description:
      '이미 놓인 「보이는 적」(place_field_enemy 의 필드 적 페이지)을 한꺼번에 「보면 달려드는」 적으로 맞춘다 — 시야(칸)·시야 모양·추격 걸음과 발견 직후 「덮치기」(lungeSteps 칸을 lungeSpeed 랭크로 쉬지 않고 달려듦). ' +
      '「적이 더 멀리서 알아보고 빠르게 덮치게」「추격을 세게」 요청의 정본. mapIds 를 주면 그 맵만, 생략하면 필드 적이 있는 모든 맵. 순찰 경로는 시야 밖 걸음으로 그대로 살리고, 입구에서 시야 안이면 그 맵의 시야를 줄인다(들어서자마자 덮치지 않게). ' +
      '덮치기 걸음은 주인공 걷기(랭크 6)보다 빠르게 할 수 없다 — 계속 걸으면 피할 수 있어야 한다. 보스·이야기 전투(조사 전투)는 건드리지 않는다.',
    parameters: schema({
      mapIds: { type: 'array', items: { type: 'string' }, description: '고칠 맵(생략 = 필드 적이 있는 모든 맵)' },
      sightRange: { type: 'integer', description: '시야(칸, 2..12, 기본 5)' },
      coneDegrees: FIELD_DETECTION_SCHEMA.coneDegrees!, chaseStepMs: FIELD_DETECTION_SCHEMA.chaseStepMs!, alertMs: FIELD_DETECTION_SCHEMA.alertMs!, searchMs: FIELD_DETECTION_SCHEMA.searchMs!,
      vision: { type: 'string', enum: ['any', 'cone'], description: 'cone(기본) = 앞쪽 부채꼴, any = 사방' },
      pace: { type: 'string', enum: [...PACES], description: '덮치기 뒤 평소 추격 걸음(기본 fast)' },
      lungeSteps: { type: 'integer', description: '발견 직후 덮치는 칸 수(0..8, 0 = 없음)' },
      lungeSpeed: { type: 'integer', description: '덮치기 걸음 랭크(1..6, 기본 6 = 주인공 걷기와 같은 빠르기)' },
      approachStyle: { ...APPROACH_STYLE_SCHEMA, description: APPROACH_STYLE_SCHEMA.description + '. 생략 = 지금 방식 그대로' },
    }, []),
    invalidArgsExample: { sightRange: 7, lungeSteps: 3, lungeSpeed: 6 },
    run(draft, args): ToolExecResult {
      const sight = args.sightRange === undefined ? undefined : Number(args.sightRange);
      if (sight !== undefined && (!Number.isInteger(sight) || sight < 2 || sight > 12)) throw new ToolError('sightRange 는 2..12 칸입니다.', { code: 'invalid-args' });
      const detection = readFieldDetectionArgs({ coneDegrees: args.coneDegrees, chaseStepMs: args.chaseStepMs, alertMs: args.alertMs, searchMs: args.searchMs });
      const steps = args.lungeSteps === undefined ? 0 : Number(args.lungeSteps);
      if (!Number.isInteger(steps) || steps < 0 || steps > 8) throw new ToolError('lungeSteps 는 0..8 입니다.', { code: 'invalid-args' });
      const speed = args.lungeSpeed === undefined ? 6 : Number(args.lungeSpeed);
      if (!Number.isInteger(speed) || speed < 1 || speed > 6) throw new ToolError('lungeSpeed 는 1..6 입니다(주인공 걷기 6 보다 빠르면 피할 수 없다).', { code: 'invalid-args' });
      if (args.pace !== undefined && !(PACES as readonly string[]).includes(String(args.pace))) throw new ToolError(`pace 는 ${PACES.join('|')} 입니다.`, { code: 'invalid-args' });
      const wanted = Array.isArray(args.mapIds) ? (args.mapIds as unknown[]).map(String) : undefined;
      for (const id of wanted ?? []) if (!draft.maps[id]) throw new ToolError(`맵을 찾을 수 없습니다: ${id}`, { code: 'map-not-found' });
      const maps = wanted ? wanted.map((id) => draft.maps[id]!) : Object.values(draft.maps);
      const tuned: string[] = []; const skipped: string[] = [];
      for (const map of maps) for (const event of map.events) {
        const result = makeFieldEnemyChase(draft, map, event, {
          ...(sight !== undefined ? { sightRange: sight } : {}),
          ...(args.vision === 'any' || args.vision === 'cone' ? { vision: args.vision } : {}),
          ...(args.pace !== undefined ? { pace: args.pace as Pace } : {}),
          ...(steps > 0 ? { lungeSteps: steps, lungeSpeed: speed } : {}),
          ...(args.approachStyle !== undefined ? { approachStyle: (args.approachStyle === 'auto' ? 'auto' : resolveApproachArg(draft, event, args.approachStyle)) as FieldApproachStyle | 'auto' } : {}),
        });
        if (result.ok && Object.keys(detection).length) for (const page of event.pages ?? []) if (page.movement.type === 'chase') page.movement = applyFieldDetection(page.movement, detection);
        if (result.ok) tuned.push(`${map.id}/${event.id}(시야 ${result.sightRange}${(event.pages ?? []).find((page) => page.movement.type === 'chase')?.movement.approachStyle ? `, ${(event.pages ?? []).find((page) => page.movement.type === 'chase')!.movement.approachStyle}` : ''})`);
        else if (result.reason !== 'not-field-enemy') skipped.push(`${map.id}/${event.id}: ${result.reason}`);
      }
      if (tuned.length === 0) throw new ToolError('고칠 필드 적이 없습니다 — place_field_enemy 로 먼저 놓으세요.', { code: 'field-enemy-none' });
      return {
        summary: `필드 적 ${tuned.length}마리를 추격형으로 맞췄다(시야 ${sight ?? 5}칸${steps > 0 ? `, 발견 뒤 ${steps}칸 덮치기 랭크 ${speed}` : ''}).`,
        data: { tuned, skipped },
        ...(skipped.length ? { warnings: skipped.slice(0, 12) } : {}),
      };
    },
  },
  {
    name: 'set_field_detection',
    mode: 'write',
    domains: ['event'],
    description:
      '추격하는 적(보면 쫓아오는 필드 적·순찰 경비병 — movement chase 페이지)의 「알아채기·다가오기」만 조율한다. 다른 것(그림·전투·순찰 길)은 그대로. ' +
      'sightRange 시야(칸) · coneDegrees 부채꼴 각(넓을수록 곁눈으로도 봄) · chaseStepMs 쫓는 동안 한 칸 시간(작을수록 빨리 다가옴, 주인공 걷기 160) · alertMs 알아챈 뒤 멈춤(짧을수록 빨리 덤빔) · searchMs 놓친 뒤 뒤지는 시간(추격 기억) · giveUpRange 포기 거리. ' +
      '「몬스터가 보면 훨씬 빨리 다가오게」「밤 순찰을 더 예민하게, 더 넓게 찾게」 요청의 정본. eventIds 를 주면 그 적만, 생략하면 mapIds(생략 = 모든 맵)의 추격 적 전부. ' +
      '순찰 경로가 있으면 칸 사이 쉼을 늘려 시야 밖 순찰 걸음은 예전 빠르기를 지킨다. 시야를 넓힐 때 입구가 시야+1 칸 안이면 그 적만 시야를 줄인다(들어서자마자 덮치지 않게).',
    parameters: schema({
      mapIds: { type: 'array', items: { type: 'string' }, description: '고칠 맵(생략 = 모든 맵)' },
      eventIds: { type: 'array', items: { type: 'string' }, description: '고칠 적 이벤트 id(생략 = 맵의 추격 적 전부)' },
      ...FIELD_DETECTION_SCHEMA,
    }, []),
    invalidArgsExample: { mapIds: ['map_field_1'], sightRange: 7, coneDegrees: 140, chaseStepMs: 200, alertMs: 300, searchMs: 6000 },
    run(draft, args): ToolExecResult {
      const tuning = readFieldDetectionArgs(args);
      if (Object.keys(tuning).length === 0) throw new ToolError('바꿀 값(sightRange·coneDegrees·chaseStepMs·alertMs·searchMs·giveUpRange)을 하나 이상 주세요.', { code: 'invalid-args' });
      const wantedMaps = Array.isArray(args.mapIds) ? (args.mapIds as unknown[]).map(String) : undefined;
      for (const id of wantedMaps ?? []) if (!draft.maps[id]) throw new ToolError(`맵을 찾을 수 없습니다: ${id}`, { code: 'map-not-found' });
      const wantedEvents = Array.isArray(args.eventIds) ? new Set((args.eventIds as unknown[]).map(String)) : undefined;
      const maps = wantedMaps ? wantedMaps.map((id) => draft.maps[id]!) : Object.values(draft.maps);
      const changed: string[] = []; const notes: string[] = [];
      for (const map of maps) {
        const entries = tuning.sightRange !== undefined ? entryCells(draft, map) : [];
        for (const event of map.events) {
          if (wantedEvents && !wantedEvents.has(event.id)) continue;
          let touched = false;
          for (const page of event.pages ?? []) {
            if (page.movement.type !== 'chase') continue;
            let local = tuning;
            if (tuning.sightRange !== undefined && entries.length) {
              const nearest = Math.min(...entries.map((e) => Math.abs(e.x - event.x) + Math.abs(e.y - event.y)));
              let range = tuning.sightRange;
              while (range > 2 && nearest <= range + 1) range -= 1;
              if (range !== tuning.sightRange) { local = { ...tuning, sightRange: range }; notes.push(`${map.id}/${event.id}: 입구가 가까워 시야 ${range}칸`); }
            }
            page.movement = applyFieldDetection(page.movement, local);
            touched = true;
          }
          if (touched) changed.push(`${map.id}/${event.id}`);
        }
      }
      if (changed.length === 0) throw new ToolError('추격하는 적이 없습니다 — place_field_enemy behavior:chase 나 tune_field_enemies 로 먼저 추격형으로 만드세요.', { code: 'field-enemy-none' });
      const parts = [tuning.sightRange !== undefined ? `시야 ${tuning.sightRange}칸` : '', tuning.coneDegrees !== undefined ? `부채꼴 ${tuning.coneDegrees}°` : '', tuning.chaseStepMs !== undefined ? `추격 ${tuning.chaseStepMs}ms/칸` : '', tuning.alertMs !== undefined ? `알아챔 ${tuning.alertMs}ms` : '', tuning.searchMs !== undefined ? `수색 ${tuning.searchMs}ms` : '', tuning.giveUpRange !== undefined ? `포기 ${tuning.giveUpRange}칸` : ''].filter(Boolean);
      return {
        summary: `추격 적 ${changed.length}마리 조율 — ${parts.join(' · ')}`,
        data: { changed, tuning },
        ...(notes.length ? { warnings: notes.slice(0, 12) } : {}),
      };
    },
  },
  {
    name: 'set_field_approach_style',
    mode: 'write',
    domains: ['event'],
    description:
      '추격하는 필드 적(보면 쫓아오는 적)의 「다가오는 방식」을 정한다 — 종족마다 몸짓이 다르게: 늑대는 질주(dash, 덮치기가 훨씬 빠름), 거미는 웅크렸다 아치로 뛰어듦(pounce), 슬라임은 통통(hop), ' +
      '박쥐는 좌우로 흔들리며 들쭉날쭉(swoop), 골렘은 느리지만 쉬지 않고 멀리까지 쫓음(lumber), 유령은 둥실(float), 뱀은 S자(slither). ' +
      'eventIds 를 주면 그 적만, 생략하면 mapIds(생략 = 모든 맵)의 추격 적 전부. style:auto 면 적마다 이름·적 그룹으로 종족을 읽어 고른다. 추격하지 않는 적(보초·순찰만)은 건너뛴다 — 먼저 tune_field_enemies 로 추격형으로.',
    parameters: schema({
      style: APPROACH_STYLE_SCHEMA as unknown as JsonSchema,
      eventIds: { type: 'array', items: { type: 'string' }, description: '고칠 적 이벤트 id(생략 = 맵의 추격 적 전부)' },
      mapIds: { type: 'array', items: { type: 'string' }, description: '찾을 맵(생략 = 모든 맵)' },
    }, ['style']),
    invalidArgsExample: { style: 'auto' },
    run(draft, args): ToolExecResult {
      const wantedMaps = Array.isArray(args.mapIds) ? (args.mapIds as unknown[]).map(String) : undefined;
      for (const id of wantedMaps ?? []) if (!draft.maps[id]) throw new ToolError(`맵을 찾을 수 없습니다: ${id}`, { code: 'map-not-found' });
      const wantedEvents = Array.isArray(args.eventIds) ? new Set((args.eventIds as unknown[]).map(String)) : undefined;
      const maps = wantedMaps ? wantedMaps.map((id) => draft.maps[id]!) : Object.values(draft.maps);
      const changed: string[] = [];
      const counts: Record<string, number> = {};
      for (const map of maps) for (const event of map.events) {
        if (wantedEvents && !wantedEvents.has(event.id)) continue;
        const pages = (event.pages ?? []).filter((page) => page.movement.type === 'chase' && page.trigger.kind === 'eventTouch');
        if (pages.length === 0) continue;
        const style = resolveApproachArg(draft, event, args.style)!;
        for (const page of pages) {
          if (style === 'walk') delete page.movement.approachStyle;
          else page.movement.approachStyle = style;
        }
        changed.push(`${map.id}/${event.id}=${style}`);
        counts[style] = (counts[style] ?? 0) + 1;
      }
      if (wantedEvents) for (const id of wantedEvents) if (!changed.some((entry) => entry.includes(`/${id}=`))) throw new ToolError(`추격 적 이벤트를 찾지 못했습니다: ${id}`, { code: 'field-enemy-none' });
      if (changed.length === 0) throw new ToolError('추격하는 필드 적이 없습니다 — place_field_enemy(behavior:chase) 나 tune_field_enemies 를 먼저.', { code: 'field-enemy-none' });
      return {
        summary: `필드 적 ${changed.length}마리의 다가오는 방식: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}.`,
        data: { changed, counts },
      };
    },
  },
];
