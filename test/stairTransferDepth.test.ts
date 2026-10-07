import { describe, expect, it } from 'vitest';
import { buildConceptEvents } from '@/editor/interiorConceptEvents';
import type { ConceptPlacement } from '@/editor/interiorConceptCompose';
import { createEmptyRoomMap } from '@/editor/interiorRoomPipeline';

describe('stair transfer coverage + single-tile stair depth', () => {
  it('creates a transfer event for every tile of a horizontal 3-wide stair', () => {
    const map = createEmptyRoomMap({mapId:'stair3',name:'stair3',width:10,height:10,wings:[{x:1,y:1,w:8,h:8}],door:{x:1,y:8},theme:'corridor',seed:1});
    // stairs_horizontal lower 141/111/171 row at y=4, x=3..5
    const cells = [
      { x: 3, y: 4, layer: 'lower' as const, tile: 141 },
      { x: 4, y: 4, layer: 'lower' as const, tile: 111 },
      { x: 5, y: 4, layer: 'lower' as const, tile: 171 },
    ];
    for (const c of cells) map.lowerTiles[c.y * 10 + c.x] = c.tile;
    const placement = { objectId: 'stairs_horizontal', thingId: 'main_stair', label: '돌계단', roomId: 'corridor', anchor: { x: 4, y: 4 }, cells, chips: ['pass', 'transfer'], required: true } as ConceptPlacement;
    const result = buildConceptEvents(map, [placement], { door: { x: 1, y: 8 }, transferTarget: { mapId: 'up', x: 2, y: 2 } });
    expect(result.events.length).toBe(3);
    // 중앙 앵커가 첫 번째 — 기존 호출부(listConceptConnections[0]를 계단 대표점으로 쓰는 곳)와 호환.
    expect(result.events.map((e) => ({ x: e.x, y: e.y }))).toEqual([{ x: 4, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 4 }]);
    for (const e of result.events) {
      expect(e.pages?.[0]?.commands.some((c) => c.kind === "transfer" && (c as { mapId: string }).mapId === "up")).toBe(true);
    }
  });

  it('single-tile stairs_down event does not float above character', () => {
    const map = createEmptyRoomMap({mapId:'stair1',name:'stair1',width:8,height:8,wings:[{x:1,y:1,w:6,h:6}],door:{x:1,y:5},theme:'corridor',seed:1});
    map.lowerTiles[3 * 8 + 3] = 72;
    map.upperTiles[3 * 8 + 3] = 474;
    const placement = { objectId: 'stairs_down', thingId: 'down_stair', label: '아래층 계단', roomId: 'corridor', anchor: { x: 3, y: 3 }, cells: [{ x: 3, y: 3, layer: 'upper', tile: 474 }], chips: ['pass', 'event'], required: true } as ConceptPlacement;
    const result = buildConceptEvents(map, [placement], { door: { x: 1, y: 5 } });
    expect(result.events[0]?.pages?.[0]?.priority).toBe('below');
  });
});
