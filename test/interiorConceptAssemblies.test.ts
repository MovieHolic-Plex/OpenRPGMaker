import { describe, it, expect } from 'vitest';
import { createBlankProject } from '@/project/defaults';
import { cloneConceptFacilityTemplates } from '@/project/defaults/conceptFacilityTemplates';
import { runTool } from '@/editor/tools/toolRunner';
import { interiorObjectById, interiorTableCells } from '@/editor/interiorObjectCatalog';
import { interiorRoomRects } from '@/project/interiorRoomFootprint';
import { validateTileset } from '@/project/io/shapeResourceFields';
import { serialize, deserialize } from '@/project/io';
import { mergeReviewedInterior } from '../scripts/lib/merge-reviewed-interior.mts';

const ID = 'easyrpg_chipset_interior';
describe('reviewed interior assemblies', () => {
  it('expands the table body and apron without duplicating corners', () => {
    const cells = interiorTableCells(5,3);
    expect(cells.filter(c=>c.dy===3).map(c=>c.tile)).toEqual([198,199,199,199,200]);
    expect(cells.filter(c=>c.dy===0).map(c=>c.tile)).toEqual([156,157,157,157,158]);
    expect(interiorTableCells(3,2,true).filter(c=>c.dy===2).map(c=>c.tile)).toEqual([228,229,230]);
    expect(interiorObjectById('table_chairs')!.cells.map(c=>c.tile)).toEqual([297,328,298]);
  });
  it('preserves room shape through project save/load and rejects unknown shapes', () => {
    const project = createBlankProject();
    project.tilesets[ID]!.scratchConceptBundles = cloneConceptFacilityTemplates();
    const loaded = deserialize(serialize(project));
    const places = loaded.tilesets[ID]!.scratchConceptBundles!.flatMap(b=>b.places);
    expect(places.some(p=>p.shape==='l')).toBe(true);
    expect(places.some(p=>p.shape==='alcove')).toBe(true);
    const box = {x:2,y:3,w:11,h:8,shape:'l' as const};
    expect(interiorRoomRects(box).reduce((n,r)=>n+r.w*r.h,0)).toBeLessThan(box.w*box.h);
    (places[0] as any).shape = 'circle';
    expect(()=>validateTileset(ID,loaded.tilesets[ID]!)).toThrow(/shape/);
  });
  it('keeps user metadata, runtime overrides and edited furniture during migration', () => {
    const before = createBlankProject().tilesets[ID]!;
    const current = structuredClone(before);
    const next = structuredClone(before);
    current.tileMeta![141] = {...current.tileMeta![141], label:'사용자 계단',source:'user'};
    next.tileMeta![141] = {...next.tileMeta![141], label:'새 기본값'};
    current.priority[156] = 99;
    next.priority[156] = 2;
    next.tileMeta![156] = {...next.tileMeta![156],label:'검토한 상판'};
    const result = mergeReviewedInterior(current,before,next);
    expect(result.tileMeta![141]!.label).toBe('사용자 계단');
    expect(result.priority[156]).toBe(99);
    expect(result.tileMeta![156]!.label).toBe('검토한 상판');
    const empty = mergeReviewedInterior({...current,structureKits:[]},before,{...next,structureKits:[{id:'custom'} as any]});
    expect(empty.structureKits).toEqual([]);
  });
  for (const seed of [7,19,42]) for (const bundle of cloneConceptFacilityTemplates()) {
    it(`${bundle.id} seed ${seed}: complete supported tables, wall clocks and no placement warnings`, () => {
      const ctx = {project:createBlankProject()};
      const result = runTool(ctx,'place_concept',{query:bundle.id,mapId:`assembly_${bundle.id}`,seed},{dryRun:false});
      expect(result.ok,result.summary).toBe(true);
      expect([...(result.warnings??[]),...(result.diff?.warnings??[])]).toEqual([]);
      const map = ctx.project.maps[`assembly_${bundle.id}`]!;
      const rooms = (result.data as any).rooms;
      for (const room of rooms) for (const thing of bundle.things.filter(t=>t.placeIds.includes(room.placeId))) {
        const roomMap = room.mapId ? ctx.project.maps[room.mapId]! : map;
        const def = interiorObjectById(thing.objectId)!;
        if (!['tea_table','reading_table','dining_table','consultation_table','altar_table','work_table','teacher_desk','table_white'].includes(def.id)) continue;
        let matches = 0;
        for (let y=room.y;y<room.y+room.h;y++) for (let x=room.x;x<room.x+room.w;x++) {
          if(def.cells.every(c=>(c.layer==='upper'?roomMap.upperTiles:roomMap.lowerTiles)[(y+c.dy)*roomMap.width+x+c.dx]===c.tile)) matches++;
        }
        expect(matches,`${room.roomId}: ${thing.label}`).toBeGreaterThan(0);
      }
      const clock=interiorObjectById('clock')!;
      for(let i=0;i<map.upperTiles.length;i++) if(map.upperTiles[i]===clock.cells[0]!.tile) {
        expect(map.upperTiles[i+map.width]).toBe(clock.cells[1]!.tile);
        expect([72,102,12,139]).not.toContain(map.lowerTiles[i]);
        expect([72,102,12,139]).not.toContain(map.lowerTiles[i+map.width]);
      }
    });
  }
});
