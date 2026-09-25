import { inspectInteriorPlacement, type InteriorRequirements, type InteriorRoom } from '@/project/interiorPlacementAudit';
import { ToolError, type ToolDefinition } from './types';

export const INTERIOR_PLACEMENT_TOOLS: readonly ToolDefinition[] = [{
  name: 'inspect_interior_layout', mode: 'read', domains: ['map', 'tile'],
  description: 'direct-authoring 사전이 있는 실내를 읽기 전용 검사한다. 천장 아래 벽/가구 조립·접지/통행·조작면 오류를 반환한다. 독립방이 필요하면 rooms에 각 방의 바닥 seed와 문턱 전체 doorways를 선언한다. 문턱을 닫은 바닥 연결성으로 방 분리와 현관 공용 공간으로 직접 출입하는지 확인한다(문 너비1~2칸). 가구를 벽으로 인정하지 않는다. 문턱이 방 한 변 전체면 ROOM_SIDE_FULLY_OPEN, 천장 2×2 덩어리는 CEILING_MASS로 보고한다. 생성/자동 수정/완성 맵 복사 없음. paint_tiles로 직접 수정하고 재검사·show_map_region 확인. requirements로 필수 가구 수·방별 소속·동서 위치·면적·빈 바닥 정사각형 상한·넓은 빈 띠(maxEmptyStrip) 상한·남쪽 출구를 검사한다. 요구조건을 생략/완화해 통과시키지 마라. valid만으로 미적 품질을 승인하지 않는다.',
  parameters: { type: 'object', properties: {
    mapId: { type: 'string' }, wallMaterial: { type: 'string', enum: ['wall-wood', 'wall-clinic', 'wall-sento', 'wall-gym'] },
    entry: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false },
    requirements: { type: 'object', properties: {
      objects: { type: 'array', items: { type: 'object', properties: {
        ids: { type: 'array', items: { type: 'string' }, description: '대체 가능한 사전 가구 ID 목록. 합산 수량을 검사한다.' },
        min: { type: 'integer', minimum: 0 }, max: { type: 'integer', minimum: 0 }, roomId: { type: 'string' }, side: { type: 'string', enum: ['east', 'west'] },
      }, required: ['ids', 'min'], additionalProperties: false } },
      roomIds: { type: 'array', items: { type: 'string' } }, maxArea: { type: 'integer', minimum: 1 }, maxEmptySquare: { type: 'integer', minimum: 1 }, maxEmptyStrip: { type: 'object', description: '가구 없는 바닥 직사각형 중 짧은 변이 width 이상인 것의 긴 변 상한. 긴 넓은 복도/빈 거실을 잡는다.', properties: { width: { type: 'integer', minimum: 1 }, length: { type: 'integer', minimum: 1 } }, required: ['width', 'length'], additionalProperties: false }, southExit: { type: 'boolean' },
    }, additionalProperties: false },
    rooms: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' },
      seed: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false },
      doorways: { type: 'array', items: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false } },
    }, required: ['id', 'seed', 'doorways'], additionalProperties: false } },
  }, required: ['mapId', 'wallMaterial', 'entry'], additionalProperties: false },
  run(project, args) {
    try {
      const data = inspectInteriorPlacement(project, String(args.mapId), String(args.wallMaterial), args.entry as { x: number; y: number }, args.rooms as InteriorRoom[] | undefined, args.requirements as InteriorRequirements | undefined);
      return { summary: data.valid ? '검사 범위 내 구조 오류0. 요청 조건과 실제 그림은 별도 확인하세요.' : `실내 구조 오류 ${data.totalIssues}개. issues 좌표를 직접 수정하세요.`, data };
    } catch (error) { throw new ToolError(error instanceof Error ? error.message : String(error)); }
  },
}];
