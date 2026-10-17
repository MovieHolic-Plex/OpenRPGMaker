// editor/tools/badgeGateTools.ts
// place_badge_gate — 「배지 N개 이상이어야 지나갈 수 있는」 길막이(포켓몬 챔피언로드 문지기).
// 새 런타임 개념이 아니다: 이벤트 조건 badgeCount(캠페인 badges[].switchId 가 켜진 개수 ≥ N) + 막힘/열림 페이지의 조립이다.
// 배지 스위치 규칙: 배지 N 의 스위치는 mx_badge_N, 정본은 system.monsterCampaign.badges[i].switchId (openwiki/monster-campaign-menu.md).
//   — 이 도구는 스위치 id 를 지어내지 않는다. 조건이 캠페인 정의를 직접 센다.
// 페이지: 막힘(문지기 그림·통행 불가·말을 걸면 「배지가 N개 필요하다」) → 열림 가능(배지 ≥ N: 말을 걸면 비켜 준다 + 셀프 스위치) → 열림(투명·통행 가능).
// HM(필드 기술)으로 막는 장애물은 place_field_obstacle 이 맡는다 — 둘은 서로 다른 게이트다.
import type { Command, Dir, EventPage, EventPageGraphic, GameEvent, Project } from '@/project/types';
import { charsetFrameIndex, decodeCharsetFrameIndex } from '@/assets/easyrpgRtp';
import { genId } from '@/util/id';
import { ToolError, type ToolDefinition, type ToolExecResult, type JsonSchema } from './types';
import { inMapBounds, requireMap } from './mapHelpers';
import { resolveGraphic, usedCharsetGraphicKeysOnMap, type GraphicSpec } from './eventCompile';
import { assertEventShape, placementAdjustedWarning, resolveEventPlacement, upsertEventIntoMap } from './eventTools';
import { GRAPHIC_SPEC_SCHEMA } from './schemaShapes';

const KEYS = ['mapId', 'x', 'y', 'badges', 'name', 'lockedLine', 'openLine', 'graphic', 'facing', 'cells', 'id'] as const;
const FACINGS = ['up', 'down', 'left', 'right'] as const;
const MAX_CELLS = 12;
const BASE = { movement: { type: 'fixed', speed: 3, frequency: 3 } } as const;
const SOLID = { ...BASE, priority: 'same', overlapForbidden: true, trigger: { kind: 'action' } } as const;
const PASS = { ...BASE, priority: 'below', overlapForbidden: false, trigger: { kind: 'action' } } as const;

const text = (body: string, speaker?: string): Command => ({ kind: 'text', body, ...(speaker ? { speaker } : {}) });
const schema = (properties: Record<string, JsonSchema>, required: string[]): JsonSchema => ({ type: 'object', additionalProperties: false, properties, required });
const isDir = (value: unknown): value is Dir => typeof value === 'string' && (FACINGS as readonly string[]).includes(value);

/** 이 칸 하나의 이벤트(세 페이지). 열림 가능 페이지는 막힘 페이지 뒤에 둔다 — 조건이 모두 맞는 마지막 페이지가 쓰인다. */
function gateEvent(id: string, name: string, x: number, y: number, graphic: EventPageGraphic, badges: number, lockedLine: string, openLine: string): GameEvent {
  const enough = { kind: 'badgeCount', op: '>=', value: badges } as const;
  const pages: EventPage[] = [
    { id: `${id}_locked`, name: `배지 ${badges}개 필요`, conditions: [], graphic: structuredClone(graphic), ...SOLID, commands: [text(lockedLine, name)] },
    {
      id: `${id}_check`, name: '배지 확인', conditions: [enough], graphic: structuredClone(graphic), ...SOLID,
      commands: [text(openLine, name), { kind: 'setSelfSwitch', key: 'A', value: true }],
    },
    { id: `${id}_open`, name: '열림', conditions: [enough, { kind: 'selfSwitch', key: 'A', value: true }], graphic: { transparent: true }, ...PASS, commands: [] },
  ];
  return { id, name, x, y, trigger: { kind: 'action' }, commands: [], pages, placementRole: 'npc' };
}

export const BADGE_GATE_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'place_badge_gate',
    description: '「배지 N개 이상이어야 지나갈 수 있는」 길막이 문지기를 한 번에 놓는다(포켓몬 챔피언로드식). 배지 수가 모자라면 말을 걸어도 「배지가 N개 필요하다」며 막고, 배지가 N개가 되면 말을 걸 때 비켜 주고 길이 열린다(조건 badgeCount). 길 폭이 넓으면 cells 로 같은 문지기를 나란히 더 세운다(한 칸만 막으면 옆으로 돌아간다). 필드 기술(HM)로 막는 장애물은 place_field_obstacle.',
    mode: 'write',
    parameters: schema({
      mapId: { type: 'string' },
      x: { type: 'integer', description: '문지기가 서는 칸(길 가운데)' },
      y: { type: 'integer' },
      badges: { type: 'integer', minimum: 1, maximum: 64, description: '필요한 배지 수(캠페인 배지 수 이하). 켜진 캠페인 배지 스위치 개수가 이 수 이상이면 열린다' },
      name: { type: 'string', description: '문지기 이름(생략=「문지기」)' },
      lockedLine: { type: 'string', description: '배지가 모자랄 때 대사(생략=「이 앞은 배지를 N개 이상 가진 트레이너만 지나갈 수 있다.」)' },
      openLine: { type: 'string', description: '배지가 충분할 때 비켜 주는 대사(생략=「배지를 확인했다. 지나가라!」)' },
      graphic: { ...GRAPHIC_SPEC_SCHEMA, description: '생략=경비·주민 사람 도트 자동 선택. 새 그림·생성 인물은 만들지 않는다' },
      facing: { type: 'string', enum: [...FACINGS], description: '문지기가 보는 방향(생략=down)' },
      cells: { type: 'array', maxItems: MAX_CELLS, description: '같은 문지기를 더 세울 칸 [{x,y}] — 넓은 길 전체를 막을 때. 모두 같은 배지 수·같은 대사', items: { type: 'object', additionalProperties: false, properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'] } },
      id: { type: 'string' },
    }, ['mapId', 'x', 'y', 'badges']),
    invalidArgsHint: '필수는 mapId·x·y·badges(필요한 배지 수). 대사는 lockedLine·openLine, 넓은 길은 cells[{x,y}]. 그 밖의 칸은 받지 않습니다.',
    invalidArgsExample: { mapId: 'map_route_4', x: 12, y: 8, badges: 3, name: '문지기', lockedLine: '배지가 3개는 있어야 이 길을 지날 수 있다.' },
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      for (const key of Object.keys(args)) {
        if ((KEYS as readonly string[]).includes(key)) continue;
        const hint: Record<string, string> = { count: 'badges', badgeCount: 'badges', required: 'badges', message: 'lockedLine', text: 'lockedLine', dialogue: 'lockedLine / openLine', direction: 'facing', width: 'cells[{x,y}]', span: 'cells[{x,y}]' };
        throw new ToolError(`place_badge_gate 는 '${key}' 칸을 받지 않습니다(조용히 버리면 문지기가 틀리게 놓이므로 거절합니다).${hint[key] ? ` ${hint[key]} 를 쓰세요.` : ''}`, { code: 'unknown-badge-gate-field' });
      }
      const map = requireMap(draft, args.mapId as string);
      const badges = Number(args.badges);
      if (!Number.isInteger(badges) || badges < 1 || badges > 64) throw new ToolError('badges 는 1..64 정수입니다(필요한 배지 수).', { code: 'invalid-args' });
      const campaign = draft.system.monsterCampaign;
      if (campaign && badges > campaign.badges.length) throw new ToolError(`배지 ${badges}개는 캠페인에 있는 배지 수(${campaign.badges.length}개)보다 많아 영영 열리지 않는 문입니다. badges 를 ${campaign.badges.length} 이하로 하거나 configure_monster_campaign 으로 배지를 먼저 등록하세요.`, { code: 'badge-gate-unreachable' });
      const points: { x: number; y: number }[] = [{ x: Number(args.x), y: Number(args.y) }];
      if (args.cells !== undefined) {
        if (!Array.isArray(args.cells) || args.cells.length > MAX_CELLS) throw new ToolError(`cells 는 {x,y} 최대 ${MAX_CELLS}개 배열입니다.`, { code: 'invalid-args' });
        for (const cell of args.cells as { x?: unknown; y?: unknown }[]) points.push({ x: Number(cell?.x), y: Number(cell?.y) });
      }
      for (const point of points) {
        if (!Number.isInteger(point.x) || !Number.isInteger(point.y) || !inMapBounds(map, point.x, point.y)) throw new ToolError(`문지기 위치가 맵 밖입니다: (${String(point.x)}, ${String(point.y)})`, { code: 'badge-gate-out-of-bounds', mapId: map.id });
      }
      if (args.facing !== undefined && !isDir(args.facing)) throw new ToolError(`facing 은 ${FACINGS.join('|')} 입니다.`, { code: 'invalid-args' });
      const facing: Dir = (args.facing as Dir | undefined) ?? 'down';
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : '문지기';
      const lockedLine = typeof args.lockedLine === 'string' && args.lockedLine.trim() ? args.lockedLine.trim() : `이 앞은 배지를 ${badges}개 이상 가진 트레이너만 지나갈 수 있다.`;
      const openLine = typeof args.openLine === 'string' && args.openLine.trim() ? args.openLine.trim() : '배지를 확인했다. 지나가라!';
      const baseId = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : genId('ev_badge_gate');
      const warnings: string[] = [];

      let base: EventPageGraphic | undefined;
      if (args.graphic !== undefined) base = resolveGraphic(args.graphic as GraphicSpec, { overrides: draft.charsetLabels });
      else {
        // 몬스터 수집 게임 문지기: 몬스터 테이밍 팩 트레이너 도트를 먼저(place_trainer 와 같은 후보), 그다음 경비·주민. 다른 계열 도트(마법 학교 등)를 끌어오지 않는다.
        for (const query of ['조련사', 'trainer', '경비', 'guard', 'villager']) {
          try { base = resolveGraphic({ query }, { overrides: draft.charsetLabels, avoidKeys: usedCharsetGraphicKeysOnMap(map), seed: `${map.id}:${name}:${points[0]!.x},${points[0]!.y}` }); if (query === 'villager') warnings.push('트레이너·경비 도트를 못 찾아 주민 도트를 썼습니다 — graphic 으로 직접 고르세요(list_npc_graphics).'); break; } catch { /* 다음 후보 */ }
        }
        if (!base) throw new ToolError('사람 도트를 찾지 못했습니다 — graphic:{query|textureKey,characterIndex} 로 직접 고르세요(list_npc_graphics).', { code: 'graphic-not-found' });
      }
      const look = decodeCharsetFrameIndex(typeof base.pattern === 'number' ? base.pattern : 0);
      const graphic: EventPageGraphic = { ...base, direction: facing, pattern: charsetFrameIndex({ characterIndex: look.characterIndex, direction: facing, pattern: 1 }) };

      const eventIds: string[] = [];
      const placed: { x: number; y: number }[] = [];
      points.forEach((point, index) => {
        const id = index === 0 ? baseId : `${baseId}_c${index + 1}`;
        const placement = resolveEventPlacement(draft, map, point.x, point.y, { kind: 'character', ignoreEventId: id, label: `배지 문지기 '${name}'`, code: 'badge-gate-impassable' });
        const event = gateEvent(id, index === 0 ? name : `${name} ${index + 1}`, placement.x, placement.y, graphic, badges, lockedLine, openLine);
        assertEventShape(event, warnings, event, draft);
        upsertEventIntoMap(map, event);
        eventIds.push(id);
        placed.push({ x: placement.x, y: placement.y });
        if (placement.adjusted) warnings.push(placementAdjustedWarning(`배지 문지기 '${name}'`, point, { x: placement.x, y: placement.y }));
      });
      if (!campaign) warnings.push('이 프로젝트에는 몬스터 캠페인 정의가 없어 mx_badge_N 규약 스위치(mx_badge_1, mx_badge_2 …)가 켜진 개수를 셉니다. 캠페인 정의가 있으면 그 배지 스위치(badges[].switchId)를 셉니다.');
      if (points.length === 1) warnings.push('한 칸만 막습니다 — 길 폭이 넓으면 옆으로 돌아갈 수 있습니다. 길 폭 전체를 막으려면 cells 로 나란히 더 세우세요(get_map_region 으로 폭 확인).');
      return {
        summary: `${map.name} ${placed.map((p) => `(${p.x}, ${p.y})`).join(' ')} 에 배지 ${badges}개 이상이어야 열리는 문지기 '${name}' ${placed.length}칸 — 조건 badgeCount >= ${badges}`,
        data: { eventIds, badges, cells: placed },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
];
