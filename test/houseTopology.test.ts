import { describe, expect, it } from 'vitest';
import { buildHouseInteriorPlan } from '@/editor/houseInteriors';
import { bindSeedHouseInteriorPlan } from '@/editor/interiorConceptPlan';
import { createBlankProject } from '@/project/defaults';
import { runInteriorRoomPipeline, floorMaskFromPlan } from '@/editor/interiorRoomPipeline';

/** Treat rotations/reflections as the same silhouette, so mirroring cannot pass diversity QA. */
function outline(plan: ReturnType<typeof buildHouseInteriorPlan>) {
  const mask=floorMaskFromPlan(plan), points=mask.flatMap((v,i)=>v?[[i%plan.width,Math.floor(i/plan.width)]]:[]);
  const forms=[];
  for(const swap of [false,true])for(const sx of [-1,1])for(const sy of [-1,1]){
    const p=points.map(([x,y])=>swap?[y!*sx,x!*sy]:[x!*sx,y!*sy]),mx=Math.min(...p.map(p=>p[0]!)),my=Math.min(...p.map(p=>p[1]!));
    forms.push(p.map(([x,y])=>`${x!-mx},${y!-my}`).sort().join(';'));
  }
  return forms.sort()[0];
}
describe('functional house topology search',()=>{
  it('produces different compact silhouettes under the same program, beyond rotation and reflection',()=>{
    const project=createBlankProject(),signatures=new Set<string|undefined>();
    for(const seed of [3,7,11,17,23,31,43,59]){
      const plan=buildHouseInteriorPlan({mapId:'home',name:'home',seed,scale:'cottage3',program:'study',project});
      const built=runInteriorRoomPipeline(bindSeedHouseInteriorPlan(plan,project,'study'));
      expect(built.ok,JSON.stringify(built.warnings)).toBe(true);
      expect(built.warnings.filter(w=>/자리 없음|칩을 달지|walkability:|plan:/.test(w))).toEqual([]);
      expect(plan.rooms!.reduce((a,r)=>a+r.w*r.h,0)).toBeLessThanOrEqual(60);
      signatures.add(outline(plan));
    }
    expect(signatures.size).toBeGreaterThanOrEqual(5);
  },30000);
  it('is reproducible without modifying the caller or its project',()=>{
    const args={mapId:'home',name:'home',seed:23,scale:'cottage3' as const,program:'dwelling' as const};
    expect(buildHouseInteriorPlan(args)).toEqual(buildHouseInteriorPlan(args));
  });
});
