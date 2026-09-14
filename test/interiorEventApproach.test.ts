import { describe, expect, it } from 'vitest';
import { buildConceptEvents } from '@/editor/interiorConceptEvents';
import type { ConceptPlacement } from '@/editor/interiorConceptCompose';
import { createEmptyRoomMap } from '@/editor/interiorRoomPipeline';

describe('generated interior furniture interaction', () => {
  it('moves an inaccessible bottom-center event onto the reachable side of the same table', () => {
    const map=createEmptyRoomMap({mapId:'side-table',name:'side-table',width:8,height:8,seed:1,theme:'dining',door:{x:1,y:5}});
    const cells=Array.from({length:9},(_,i)=>({x:3+i%3,y:3+Math.floor(i/3),layer:'lower' as const,tile:156+i}));
    for(const c of cells)map.lowerTiles[c.y*8+c.x]=c.tile;
    const placement={objectId:'table_wood',thingId:'stock-display',label:'진열대',roomId:'shop',anchor:{x:4,y:5},cells,chips:['event'],required:true} as ConceptPlacement;
    const result=buildConceptEvents(map,[placement],{door:{x:1,y:5},reachableCells:new Set([5*8+2])});
    expect(result.warnings).toEqual([]);
    expect(result.events.map(e=>({x:e.x,y:e.y}))).toEqual([{x:3,y:5}]);
    expect(cells.some(c=>c.x===result.events[0]!.x&&c.y===result.events[0]!.y)).toBe(true);
    // Without a generated access mask, canonical fixed anchors are not relocated.
    expect(buildConceptEvents(map,[placement],{door:{x:1,y:5}}).events[0]!.x).toBe(4);
  });
  it('lets the stove base own interaction with a cauldron on its overlapping top', () => {
    const map=createEmptyRoomMap({mapId:'pot',name:'pot',width:8,height:8,seed:1,theme:'kitchen',door:{x:1,y:5}});
    map.lowerTiles[3*8+3]=21; map.lowerTiles[4*8+3]=51; map.upperTiles[3*8+3]=323;
    const placement={objectId:'cauldron',thingId:'pot',label:'솥',roomId:'kitchen',anchor:{x:3,y:3},cells:[{x:3,y:3,layer:'upper',tile:323}],chips:['event'],required:true} as ConceptPlacement;
    const built=buildConceptEvents(map,[placement],{door:{x:1,y:5},reachableCells:new Set([4*8+2])});
    expect(built.warnings).toEqual([]);
    expect(built.events.map(e=>({x:e.x,y:e.y}))).toEqual([{x:3,y:4}]);
    expect(map.upperTiles[3*8+3]).toBe(323);
  });

});
