import { createEmptyRoomMap, applyInteriorRoomLayer, interiorVocabTiles, type InteriorRoomPlan } from '@/editor/interiorRoomPipeline';
import { INTERIOR_OBJECT_CATALOG } from '@/editor/interiorObjectCatalog';
import { charsetGraphic } from '@/editor/tools/eventCompile';
import type { GameMap, Project, GameEvent, Command } from '@/project/types';
import { NIGHT_MONSTER_MAP_IDS as ids } from './nightMonster';

/** Re-author only this game's maps; retain the current remote database, skin, assets and story flags. */
export function reviseNightMonster(project: Project): Project {
  if (project.maps[ids.finale]?.events.some(e => e.id === "ev_night_basement_hiding")) return project;
  const v = interiorVocabTiles();
  function room(id: string, plan: Omit<InteriorRoomPlan, 'mapId' | 'name'>): GameMap {
    const old = project.maps[id]; if (!old) throw Error(`Missing map: ${id}`);
    const full = { ...plan, mapId: id, name: old.name };
    let built = createEmptyRoomMap(full);
    for (const layer of ['floor', 'walls', 'entrance'] as const) built = applyInteriorRoomLayer(built, full, layer).map;
    const map = { ...old, lowerTiles: built.lowerTiles, upperTiles: built.upperTiles,
      roomHarnessPlan: { kitId: 'villager-room-v1', plan: full }, events: old.events.filter(e => !e.id.startsWith('ev_night_movable_')) };
    project.maps[id] = map; return map;
  }
  function stamp(map: GameMap, objectId: string, x: number, y: number) {
    const object = INTERIOR_OBJECT_CATALOG.find(o => o.id === objectId); if (!object) throw Error(objectId);
    for (const cell of object.cells) {
      const index = (y+cell.dy)*map.width+x+cell.dx;
      (cell.layer === 'upper' ? map.upperTiles : map.lowerTiles)[index] = cell.tile;
    }
  }
  function named(map: GameMap, name: string): GameEvent {
    const e = map.events.find(e => e.pages?.some(p=>p.name===name)); if (!e) throw Error(name); return e;
  }
  function bind(map: GameMap, name: string, x: number, y: number, objectId?: string) {
    const e = named(map,name); e.x=x;e.y=y;
    for (const p of e.pages ?? []) p.graphic = { transparent: true };
    if (objectId) stamp(map,objectId,x,y);
    return e;
  }
  function chair(map: GameMap, x: number, y: number) {
    const id=`ev_night_movable_${map.id}`;
    map.events.push({id,x,y,trigger:{kind:'action'},commands:[],pages:[{id:`${id}_page`,name:'밀 수 있는 의자',conditions:[],graphic:charsetGraphic('tex_easyrpg_charset_object2',7),trigger:{kind:'action'},priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},interaction:{kind:'pushable'},commands:[]}]});
  }
  const foyer=room(ids.foyer,{width:22,height:18,wings:[{x:2,y:4,w:18,h:10}],door:{x:11,y:13},theme:'corridor'});
  stamp(foyer,'rug',9,8); stamp(foyer,'clock',5,3); stamp(foyer,'cabinet',3,4); stamp(foyer,'bust',18,7);
  const front=named(foyer,'잠긴 현관문'); front.x=11;front.y=4;for(const p of front.pages!) p.graphic=charsetGraphic('tex_easyrpg_charset_object1',0);
  const phone=bind(foyer,'꺼진 전화',16,4,'piano');
  for(const p of phone.pages!) {p.name='끊긴 피아노 선';p.commands=p.commands.map(c=>c.kind==='text'?{...c,body:'피아노의 현이 모두 끊어졌다. 그런데 안쪽 방에서 민서가 치던 선율이 들린다.'}:c);}
  // A small writing table carries the opening note.
  bind(foyer,'현관의 쪽지',7,10); stamp(foyer,'table_chairs',6,10); chair(foyer,14,10);

  const study=room(ids.gallery,{width:26,height:18,wings:[{x:2,y:4,w:22,h:10}],door:{x:13,y:13},theme:'study'});
  stamp(study,'bookshelf',3,4);stamp(study,'bookshelf',19,4);stamp(study,'rug',9,6);
  bind(study,'찢긴 악보',4,8,'piano');
  bind(study,'웃지 않는 가족사진',10,4);study.upperTiles[4*26+10]=v.PICTURE_L;
  bind(study,'저택 주인의 일기',18,8);stamp(study,'table_chairs',17,8);
  bind(study,'깨진 거울',7,5);stamp(study,'mirror',7,4);
  bind(study,'움푹 팬 초상',13,4);study.upperTiles[4*26+13]=v.PICTURE_R;
  const scratches=bind(study,'바닥의 긁힌 자국',18,11);scratches.pages!.forEach(p=>p.graphic=charsetGraphic('tex_easyrpg_charset_object2',4));
  const lock=named(study,'황동 문고리');for(const p of lock.pages!)p.name=p.name.replace('황동 문고리','황동 잠금 레버');
  // The three pressure controls remain readable, with open approaches from below.
  chair(study,20,10);

  const bedroom=room(ids.bedroom,{width:20,height:16,wings:[{x:4,y:4,w:12,h:8}],door:{x:10,y:11},theme:'bedroom'});
  stamp(bedroom,'bed_v',5,4);stamp(bedroom,'rug',7,6);stamp(bedroom,'clock',11,3);
  const bag=named(bedroom,'민서의 가방'); bag.x=6;bag.y=6;
  for(const p of bag.pages!) {p.graphic=charsetGraphic('tex_easyrpg_charset_object1',7);p.name=p.name.replace('가방','보관함');p.commands=p.commands.map(c=>c.kind==='text'?{...c,body:c.body.replaceAll('가방','보관함')}:c);}
  const closet=named(bedroom,'닫힌 옷장');closet.x=14;closet.y=5;
  for(const p of closet.pages!) {p.name='몸을 숨길 옷장';p.graphic=charsetGraphic('tex_easyrpg_charset_object1',1);p.interaction={kind:'hiding'};p.commands=[];p.priority='same';p.overlapForbidden=true;p.trigger={kind:'action'};}
  const note=named(bedroom,'침대 밑 쪽지');note.x=5;note.y=5;for(const p of note.pages!){p.graphic={transparent:true};p.commands=[{kind:'text',body:'괴물은 문을 넘어 따라온다. 보이지 않는 곳에서 옷장에 숨자. 조사 키를 다시 누르면 나온다. 숨는 모습을 들켰다면 계속 도망쳐야 한다.'}];}

  const corridor=room(ids.chase,{width:28,height:14,wings:[{x:2,y:8,w:24,h:3},{x:22,y:4,w:4,h:7},{x:2,y:4,w:24,h:2},{x:2,y:4,w:4,h:7}],door:{x:3,y:10},theme:'corridor'});
  corridor.events=corridor.events.filter(e=>!e.id.startsWith('ev_horror_trap_'));
  corridor.safeZones=[];
  const monster=corridor.events.find(e=>e.pages?.some(p=>p.movement.type==='chase'))!;
  for(const p of monster.pages!) if(p.movement.type==='chase') p.movement={...p.movement,speed:4,frequency:6,sightRange:9,giveUpRange:18,moveIntervalMs:100,pursuit:{scope:'connected',doorDelayMs:4000,searchMs:4500,onLost:'return'}};
  stamp(corridor,'armor',3,3);chair(corridor,20,9);

  const basement=room(ids.finale,{width:20,height:16,wings:[{x:2,y:4,w:16,h:8}],door:{x:10,y:11},theme:'storage',wallMaterial:'stone-brick'});
  for(let y=5;y<=9;y++) stamp(basement,'crate',5,y);stamp(basement,'barrel',17,8);stamp(basement,'crate',16,9);stamp(basement,'table_chairs',9,6);
  const rescue=basement.events.find(e=>e.id==='ev_restore_truth_ending')!;rescue.x=6;rescue.y=4;
  const escape=basement.events.find(e=>e.id==='ev_leave_blue_ending')!;escape.x=14;escape.y=4;
  const record=bind(basement,'낡은 카세트 녹음기',10,6);
  for(const p of record.pages!) p.name=p.name.replace('낡은 카세트 녹음기','책상 위 녹음 기록');
  bind(basement,'낡은 실험 기록',4,7,'cabinet');bind(basement,'찢어진 교복',16,5,'cabinet');
  // An actual hiding place near the entrance supports escaping pursuit into this room.
  basement.events.push({id:'ev_night_basement_hiding',x:3,y:4,trigger:{kind:'action'},commands:[],pages:[{id:'ev_night_basement_hiding_page',name:'빈 보관장',conditions:[],graphic:charsetGraphic('tex_easyrpg_charset_object1',1),trigger:{kind:'action'},priority:'same',overlapForbidden:true,movement:{type:'fixed',speed:3,frequency:3},interaction:{kind:'hiding'},commands:[]}]});
  // Keep every authored transfer endpoint open, including doors created outside the room shell.
  for(const map of Object.values(project.maps)) for(const e of map.events) {
    if(e.pages?.some(p=>p.commands.some(c=>c.kind==='transfer'))) {map.lowerTiles[e.y*map.width+e.x]=v.FLOOR;map.upperTiles[e.y*map.width+e.x]=-1;}
    const walk=(commands:Command[])=>{for(const c of commands){if(c.kind==='transfer'){const target=project.maps[c.mapId];if(target){target.lowerTiles[c.y*target.width+c.x]=v.FLOOR;target.upperTiles[c.y*target.width+c.x]=-1;}}if(c.kind==='text'){c.body=c.body.replaceAll('붉은 압력판','괴물').replaceAll('복도 왼쪽 입구 구역은 안전하다.','문을 넘어도 추격이 이어진다. 가구를 밀거나 시야 밖에서 숨어야 한다.').replaceAll('황동 문고리','황동 잠금 레버');}}};
    for(const p of e.pages??[])walk(p.commands);
  }
  return project;
}
