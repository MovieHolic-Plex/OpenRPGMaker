// editor/tools/monsterCenterTools.ts
// place_monster_center — 몬스터 센터 직원(간호사) 한 명을 한 호출로 놓는다. 회복 연출은 새 엔진 기능이 아니라
// src/project/monsterCenterRecipe.ts 의 이벤트 레시피(맡기겠습니까 → 볼 줄 → 회복 음악·섬광 → 전원 회복 → 센터 기록)다.
// build_monster_game 의 캠페인 센터 직원과 같은 레시피를 쓴다 — 한 곳을 고치면 둘 다 바뀐다.
import type { Command, EventPage, EventPageGraphic, GameEvent, Project } from '@/project/types';
import { genId } from '@/util/id';
import { ToolError, type ToolDefinition, type ToolExecResult } from './types';
import { inMapBounds, requireMap } from './mapHelpers';
import { resolveGraphic, type GraphicSpec } from './eventCompile';
import { assertEventShape, placementAdjustedWarning, resolveEventPlacement, upsertEventIntoMap } from './eventTools';
import { GRAPHIC_SPEC_SCHEMA } from './schemaShapes';
import { monsterCenterCommands, MONSTER_CENTER_MAX_PARTY } from '@/project/monsterCenterRecipe';

const KEYS = ['mapId', 'x', 'y', 'name', 'greeting', 'speaker', 'checkpointLabel', 'machineCells', 'graphic', 'id'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function rejectUnknownKeys(args: Record<string, unknown>): void {
  for (const key of Object.keys(args)) {
    if ((KEYS as readonly string[]).includes(key)) continue;
    const hint: Record<string, string> = {
      heal: '회복은 항상 들어 있습니다(별도 인자 없음)', text: 'greeting(첫 인사)', dialogue: 'greeting', lines: 'greeting', label: 'checkpointLabel',
      save: 'checkpointLabel(마지막으로 들른 센터 이름 — 생략하면 기록하지 않음)', cells: 'machineCells', audio: '효과음은 레시피 기본(번들)을 씁니다',
    };
    throw new ToolError(`place_monster_center 는 '${key}' 칸을 받지 않습니다(조용히 버리면 연출이 사라지므로 거절합니다).${hint[key] ? ` ${hint[key]}.` : ` 받는 칸: ${KEYS.join(', ')}.`}`, { code: 'unknown-center-field' });
  }
}

/** machineCells: 볼이 놓이는 칸 [{x,y}] 최대 6. 맵 안 칸만. */
function parseMachineCells(map: { width: number; height: number }, raw: unknown): { x: number; y: number }[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MONSTER_CENTER_MAX_PARTY) throw new ToolError(`machineCells 는 {x,y} 1~${MONSTER_CENTER_MAX_PARTY}개 배열입니다. 예: [{"x":5,"y":3},{"x":6,"y":3}]`, { code: 'invalid-args' });
  return raw.map((entry, index) => {
    if (!isRecord(entry)) throw new ToolError(`machineCells[${index}] 는 {x,y} 객체입니다.`, { code: 'invalid-args' });
    const x = Number(entry.x), y = Number(entry.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map as never, x, y)) throw new ToolError(`machineCells[${index}] (${String(entry.x)}, ${String(entry.y)}) 가 맵 밖입니다.`, { code: 'invalid-args' });
    return { x, y };
  });
}

export const MONSTER_CENTER_TOOLS: readonly ToolDefinition[] = [
  {
    name: 'place_monster_center',
    mode: 'write',
    description:
      '몬스터 센터 직원(간호사) 한 명을 놓는다 — 조사하면 3세대 포켓몬 센터 문법의 회복 연출이 돈다: 「동료들을 맡길까요? 예/아니오」 → 간호사 인사 → 파티 마릿수만큼 볼이 기계에 줄지어 놓임(칸마다 소리·반짝임) '
      + '→ 회복 음악과 화면 섬광 3번 → 파티 전원 회복(체력·상태·기술 횟수) → 「건강해졌어요」 → 마지막 센터 기록(checkpointLabel, 야생 전투에서 지면 여기서 깨어남) → 「또 오세요」. 새 그림·새 소리는 없다(번들 효과음·파티클만). '
      + 'place_savepoint(heal:true) 는 크리스탈 세이브용 단순 회복이다 — 몬스터 수집 게임의 센터·병원·쉼터는 이 도구를 쓴다. '
      + 'x,y 는 간호사가 서는 칸(카운터 앞 한 줄 안쪽, 손님은 그 아래에서 조사). machineCells 는 볼이 놓이는 카운터·기계 칸 최대 6개(생략하면 간호사 자리에서 반짝임) — 센터 내부 지도에 카운터가 있으면 그 윗면 칸을 준다.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mapId: { type: 'string' },
        x: { type: 'integer', description: '간호사가 서는 칸 X' },
        y: { type: 'integer', description: '간호사가 서는 칸 Y' },
        name: { type: 'string', description: '직원 이름·직함(대사 화자). 생략=센터 직원' },
        greeting: { type: 'string', description: '첫 인사(생략=「몬스터 센터에 어서 오세요! 동료들을 건강하게 해 드릴까요?」)' },
        checkpointLabel: { type: 'string', description: '「마지막으로 들른 센터」 이름(예: 별빛 마을 회복 센터). 생략하면 체크포인트를 기록하지 않는다 — 센터라면 주는 편이 맞다' },
        machineCells: { type: 'array', description: '볼이 놓이는 칸 [{x,y}] 1~6(파티 1번 칸부터, 모자라면 마지막 칸에 이어서)', items: { type: 'object', additionalProperties: false, properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'] } },
        graphic: { ...GRAPHIC_SPEC_SCHEMA, description: '생략=간호사 도트 자동 선택. 새 그림·생성 인물은 만들지 않는다' },
        id: { type: 'string' },
      },
      required: ['mapId', 'x', 'y'],
    },
    invalidArgsHint: '받는 칸: mapId, x, y(간호사 칸), name, greeting, checkpointLabel, machineCells[{x,y}], graphic, id. 회복·음악·섬광은 레시피가 이미 넣습니다.',
    invalidArgsExample: { mapId: 'map_town_center', x: 7, y: 5, name: '센터 직원', checkpointLabel: '별빛 마을 회복 센터', machineCells: [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 7, y: 3 }] },
    run(draft: Project, args: Record<string, unknown>): ToolExecResult {
      rejectUnknownKeys(args);
      const map = requireMap(draft, args.mapId as string);
      const x = Number(args.x), y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !inMapBounds(map, x, y)) throw new ToolError(`센터 직원 위치가 맵 밖입니다: (${String(args.x)}, ${String(args.y)})`, { code: 'center-out-of-bounds', mapId: map.id });
      const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : '센터 직원';
      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : genId('ev_center');
      const warnings: string[] = [];
      const placement = resolveEventPlacement(draft, map, x, y, { kind: 'character', ignoreEventId: id, label: `센터 직원 '${name}'`, code: 'center-impassable' });
      const at = { x: placement.x, y: placement.y };

      let graphic: EventPageGraphic | undefined;
      if (args.graphic !== undefined) graphic = resolveGraphic(args.graphic as GraphicSpec, { overrides: draft.charsetLabels });
      else {
        for (const query of ['간호사', 'nurse', '주민', 'villager']) {
          try { graphic = resolveGraphic({ query }, { overrides: draft.charsetLabels, seed: `${map.id}:${name}:${at.x},${at.y}` }); if (query === '주민' || query === 'villager') warnings.push('간호사 도트를 못 찾아 주민 도트를 썼습니다 — graphic 으로 직접 고를 수 있습니다(list_npc_graphics).'); break; } catch { /* 다음 후보 */ }
        }
        if (!graphic) throw new ToolError('사람 도트를 찾지 못했습니다 — graphic:{query|textureKey,characterIndex} 로 직접 고르세요(list_npc_graphics).', { code: 'graphic-not-found' });
      }

      const checkpointLabel = typeof args.checkpointLabel === 'string' && args.checkpointLabel.trim() ? args.checkpointLabel.trim() : undefined;
      if (!checkpointLabel) warnings.push('checkpointLabel 이 없어 「마지막으로 들른 센터」를 기록하지 않습니다 — 야생 전투에서 져도 이 센터로 돌아오지 않습니다.');
      const greeting = typeof args.greeting === 'string' && args.greeting.trim() ? args.greeting.trim() : undefined;
      const commands: Command[] = monsterCenterCommands({
        speaker: name, ...(greeting ? { greeting } : {}), ...(checkpointLabel ? { checkpointLabel } : {}),
        ...(parseMachineCells(map, args.machineCells) ? { machineCells: parseMachineCells(map, args.machineCells)! } : {}),
      });
      const page: EventPage = {
        id: `${id}_page`, name, conditions: [], graphic, trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true,
        animationType: 'fixedGraphic', movement: { type: 'fixed', speed: 3, frequency: 3 }, commands,
      };
      const event: GameEvent = { id, name, x: at.x, y: at.y, trigger: { kind: 'action' }, commands: [], pages: [page], placementRole: 'npc' };
      assertEventShape(event, warnings, event, draft);
      upsertEventIntoMap(map, event);
      if (placement.adjusted) warnings.push(placementAdjustedWarning(`센터 직원 '${name}'`, { x, y }, at));
      return {
        summary: `${map.name} (${at.x}, ${at.y}) 에 센터 직원 '${name}' — 맡김 선택 → 볼 줄 → 회복 음악·섬광 → 전원 회복${checkpointLabel ? ` → 센터 기록 「${checkpointLabel}」` : ''}`,
        data: { eventId: id, x: at.x, y: at.y, adjusted: placement.adjusted, checkpointLabel: checkpointLabel ?? null },
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
];
