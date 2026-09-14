import { describe, expect, it } from 'vitest';
import { composeConceptRoom } from '@/editor/interiorConceptCompose';
import { interiorObjectById } from '@/editor/interiorObjectCatalog';
import { INTERIOR_ROOM_DEMO_PLANS, runInteriorRoomPipeline, createEmptyRoomMap } from '@/editor/interiorRoomPipeline';
import { deserialize, serialize } from '@/project/io';
import { createBlankProject } from '@/project/defaults';

function fixture() {
  const map=createEmptyRoomMap({mapId:'support',name:'support',width:12,height:12,theme:'dining'});
  map.lowerTiles.fill(72);map.upperTiles.fill(-1);
  const floor=map.lowerTiles.map((_,i)=>i%12>=2&&i%12<10&&Math.floor(i/12)>=4&&Math.floor(i/12)<10);
  return {map,floor};
}
function compose(map:ReturnType<typeof fixture>['map'],floor:boolean[],ids:string[]) {
 return composeConceptRoom({map,floor,fullFloor:floor,room:{x:2,y:4,w:8,h:6},roomId:'room',role:'room',door:{x:5,y:9},placeLabel:'test',
 things:ids.map((id,i)=>({thingId:String(i),objectId:`opaque-${id}`,label:id,chips:['block'],required:true})),
 furnishingObjectIds:new Map(ids.map(id=>[`opaque-${id}`,id])),resolveObject:id=>interiorObjectById(id.replace('opaque-','')),isFloorTile:t=>t===72||t===12});
}
describe('small interior props require furniture supports',()=>{
 it('keeps small bottle groups off the floor in legacy theme generation too',()=>{
  for(const plan of INTERIOR_ROOM_DEMO_PLANS){const {map}=runInteriorRoomPipeline(plan);expect(map.upperTiles).not.toContain(350);}
 });
 it.each(['plant','plant_small','jars','vase_flowers','bottle_set'])('does not place %s on empty floor, even if required',id=>{
  const {map,floor}=fixture(),r=compose(map,floor,[id]);expect(r.placements).toHaveLength(0);expect(r.warnings).toHaveLength(1);
 });
 it('places supports before props and preserves occupied tabletop art',()=>{
  const {map,floor}=fixture(),r=compose(map,floor,['jars','vase_flowers','table_wood']);
  expect(r.warnings).toEqual([]);expect(r.placements).toHaveLength(3);
  for(const p of r.placements.filter(p=>p.objectId!=='table_wood'))for(const cell of p.cells)expect([156,157,158,186,187,188]).toContain(map.lowerTiles[cell.y*12+cell.x]);
  const before=map.upperTiles.slice();compose(map,floor,['vase_flowers']);for(let i=0;i<before.length;i++)if(before[i]>=0)expect(map.upperTiles[i]).toBe(before[i]);
  const project=createBlankProject();project.maps[map.id]=map;expect(deserialize(serialize(project)).maps[map.id]).toEqual(map);
 });
 it('places a pot on a stove, never on a dining tabletop',()=>{
  const {map,floor}=fixture();map.lowerTiles[4*12+3]=156;
  expect(compose(map,floor,['cauldron']).placements).toHaveLength(0);
  map.lowerTiles[3*12+3]=21;
  const r=compose(map,floor,['cauldron']);expect(r.placements[0]!.cells[0]).toMatchObject({x:3,y:3,tile:323});
 });
 it('does not mistake table legs or ordinary floors for a support',()=>{
  const {map,floor}=fixture();map.lowerTiles[5*12+3]=198;expect(compose(map,floor,['jars']).placements).toHaveLength(0);
 });
 it('puts a short step only on an authored floor seam with two clear landings',()=>{
  const {map}=fixture();for(let y=4;y<8;y++)for(let x=2;x<6;x++)map.lowerTiles[y*12+x]=12;
  const full=map.lowerTiles.map((_,i)=>i%12>=2&&i%12<6&&Math.floor(i/12)>=4&&Math.floor(i/12)<=8),floor=full.map((v,i)=>v&&Math.floor(i/12)<8);
  const input={map,floor,fullFloor:full,room:{x:2,y:4,w:4,h:4},roomId:'bath',role:'room' as const,door:{x:3,y:8},placeLabel:'bath',things:[{thingId:'steps',objectId:'bathroom_steps',label:'steps',chips:[] as never[],required:true}],resolveObject:interiorObjectById,isFloorTile:(t:number)=>t===12||t===72};
  const r=composeConceptRoom(input);expect(r.warnings).toEqual([]);expect(r.placements[0]!.cells.map(c=>[c.y,c.tile])).toEqual([[7,141],[7,111],[7,171]]);
  map.lowerTiles.fill(72);expect(composeConceptRoom(input).placements).toHaveLength(0);
 });
});
