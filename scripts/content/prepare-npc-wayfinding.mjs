// An explicit integration request adopts pinned existing candidates. This adapter
// never changes harness votes or manufactures a human-browser Allow receipt.
import fs from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [sourceDir,harness,cachePath,out]=process.argv.slice(2);
if(!out)throw Error('Usage: prepare-npc-wayfinding.mjs canonical-read-dir character-harness portable-cache.json output');
const hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(out,{recursive:true});
const raw=await fs.readFile(join(sourceDir,'canonical-reloaded.json'),'utf8');
const receipt=JSON.parse(await fs.readFile(join(sourceDir,'canonical-receipt.json'),'utf8'));
if(hash(raw)!==receipt.sha256)throw Error('Canonical read digest differs');
const before=JSON.parse(raw),project=structuredClone(before),cache=JSON.parse(await fs.readFile(cachePath,'utf8'));
if(project.meta.title!=='별빛섬 몬스터 원정')throw Error('Wrong project');
if(project.assets.uploaded.oprn_emerald_field_cast_1?.meta?.templateCastAdoption)throw Error('NPC adoption already present; do not expand or relocate the same map twice');
const selection=JSON.parse(await fs.readFile(join(sourceDir,'selection.json'),'utf8'));
if(selection.source!=='explicit-user-message'||!selection.harnessBrowserDecisionsUnchanged)throw Error('Explicit integration instruction required');
for(const c of selection.candidates.filter(c=>c.role!=='hero')){
 for(const [file,sha]of Object.entries(c.files))if(hash(await fs.readFile(join(harness,'.data/candidates',c.id,file)))!==sha)throw Error('Candidate changed: '+c.id+'/'+file);
 for(const [file,sha]of Object.entries(c.nativeFiles))if(hash(await fs.readFile(join(harness,'.data/candidates',c.id,'native',file)))!==sha)throw Error('Native candidate changed: '+c.id+'/'+file);
 const verified=spawnSync('python3',[join(harness,'lib/verify_bundle.py'),'--bundle',join(harness,'.data/candidates',c.id)],{encoding:'utf8'});
 if(verified.status!==0)throw Error(verified.stderr+verified.stdout);
}
const pack=spawnSync('python3',[resolve('scripts/content/pack-template-npc-cast.py'),join(sourceDir,'selection.json'),harness,cachePath,out,resolve('public/assets/emerald-monster/tiles/overworld.png')],{encoding:'utf8'});
if(pack.status!==0)throw Error(pack.stderr+pack.stdout);
const packing=JSON.parse(pack.stdout),newAssets=[];
for(let n=1;n<=2;n++){
 const id='oprn_emerald_field_cast_'+n,bytes=await fs.readFile(join(out,`cast-${n}.png`));
 const asset={...project.assets.uploaded[id],dataUrl:'data:image/png;base64,'+bytes.toString('base64')};delete asset.ref;
 asset.name='판형 기반 비취섬 NPC '+n;
 asset.meta={...asset.meta,walkFrameMs:130,templateCastAdoption:{source:'explicit-user-message',date:selection.date,roles:packing.roles.filter(c=>selection.candidates.find(x=>x.id===c.candidate)?.role&&((n===1)===['rival','professor','nurse','merchant','mother','resident','gym_leader'].includes(c.role)))}};
 project.assets.uploaded[id]=asset;cache.assets.uploaded[id]=asset;newAssets.push({id,sha256:hash(bytes),bytes:bytes.length});
}
{
 const id='oprn_emerald_signpost',bytes=await fs.readFile(join(out,'notice-board.png'));
 const asset={...project.assets.uploaded[id],name:'비취섬 · 사각 나무 안내판',dataUrl:'data:image/png;base64,'+bytes.toString('base64')};delete asset.ref;
 asset.meta={...asset.meta,nativeTileSource:packing.noticeBoard};
 project.assets.uploaded[id]=asset;cache.assets.uploaded[id]=asset;newAssets.push({id,sha256:hash(bytes),bytes:bytes.length});
}
const report={projectId:receipt.projectId,sourceSha256:receipt.sha256,authorization:selection,newAssets,packing,npcPages:0,signPages:0,arrowsRemoved:0,relocations:[],terrain:[],status:'prepared-not-saved'};
const portals=[];
for(const map of Object.values(project.maps))for(const event of map.events)for(const page of event.pages){
 const id=page.graphic?.sprite?.id;
 if(/^oprn_emerald_field_cast_[12]$/.test(id??'')){
  if(event.id.includes('_trail_sign')){page.graphic={sprite:{type:'uploaded',id:'oprn_emerald_signpost'},pattern:0,direction:'down',transparent:false};report.signPages++;}
  else{page.graphic={...page.graphic,scale:1,scaleMode:'manual'};report.npcPages++;}
 }
 if(id==='mx_marker_exit'){
  // Same trigger, priority, requirements and command body. No blocking sprite.
  page.graphic={transparent:true};report.arrowsRemoved++;
  if(!portals.some(p=>p.event===event))portals.push({map,event});
 }
}
const manifest=JSON.parse(await fs.readFile(join(resolve(cachePath,'..'),'world-manifest.json'),'utf8'));
const changed=new Map();
const point=(map,x,y,lower,upper=-1)=>{
 if(x<0||y<0||x>=map.width||y>=map.height)throw Error('Out of bounds '+map.id);
 map.lowerTiles[y*map.width+x]=lower;map.upperTiles[y*map.width+x]=upper;
 if(!changed.has(map.id))changed.set(map.id,[]);changed.get(map.id).push({x,y});
};
const terrain=(map,name)=>{const group=project.tilesets[map.tilesetId].autotileGroups?.find(g=>g.id===name);if(!group)throw Error('Unknown terrain '+map.id+'/'+name);return group.variantMap['255']??group.variantMap['15'];};
const stamp=(map,name,x,y,base)=>{
 const kit=project.tilesets[map.tilesetId].structureKits.find(k=>k.name===name);if(!kit)throw Error('Unknown kit '+name);
 kit.rows.forEach((row,dy)=>row.tiles.forEach((tile,dx)=>point(map,x+dx,y+dy,tile<0?base:tile,row.upperTiles?.[dx]??-1)));
 report.terrain.push({map:map.id,kit:name,x,y});return kit;
};
const walkCommands=(items,visit)=>{for(const c of items??[]){visit(c);for(const key of ['then','else','commands'])if(Array.isArray(c[key]))walkCommands(c[key],visit);for(const choice of c.choices??[])walkCommands(choice.commands,visit);}};
function relocate(from,to,x,y,landing,label){
 const map=project.maps['mx_map_'+from],id=map.id+'_to_mx_map_'+to,event=map.events.find(e=>e.id===id);
 if(!event)throw Error('Missing portal '+id);
 const old={x:event.x,y:event.y};event.x=x;event.y=y;
 // Update the actual inverse transfer, not unrelated emergency teleports.
 const target=project.maps['mx_map_'+to],reverse=target.events.find(e=>e.id===target.id+'_to_'+map.id);
 if(!reverse)throw Error('Missing reverse portal '+id);
 for(const page of reverse.pages)walkCommands(page.commands,c=>{if(c.kind==='transfer'&&c.mapId===map.id){c.x=landing.x;c.y=landing.y;}});
 const link=manifest.links.find(l=>l.eventId===id);if(link)link.source={x,y};
 const back=manifest.links.find(l=>l.eventId===reverse.id);if(back)back.destination={...landing};
 const sign=map.events.find(e=>e.id===map.id+'_sign_'+target.id);
 if(sign){
  // A pier sign belongs beside the walking lane, never on the boarding trigger.
  if(x===landing.x+1&&y===landing.y){sign.x=landing.x-1;sign.y=landing.y+1;}
  else{sign.x=landing.x+1;sign.y=landing.y;}
  // Explicit names describe the visible door/dock instead of a false north road.
  for(const pg of sign.pages)walkCommands(pg.commands,c=>{if(c.kind==='text')c.body=label+' · '+target.name;});
 }
 report.relocations.push({map:map.id,target:target.id,old,source:{x,y},landing,label});
}
// The school/garden/tower used to hide behind another transfer on the same road.
for(const [town,destination,label]of [['home','school','몬스터 학교'],['grove','garden','생태 정원 입구'],['moon','ghost_tower','탑 관리소 입구']]){
 const map=project.maps['mx_map_'+town],base=terrain(map,'clearing');
 // Add a small eastern block instead of squeezing a door against the existing
 // center roof or obstructing the lab's approach. All old walkable coordinates,
 // existing building pieces and resident patrols stay where they were.
 const oldWidth=map.width,oldLower=map.lowerTiles,oldUpper=map.upperTiles;
 map.width=oldWidth+6;map.lowerTiles=[];map.upperTiles=[];
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  let sx=x;
  if(x>=map.width-2)sx=x-6;
  else if(x>=oldWidth-2){
   if(y<3||y>=map.height-3)sx=18+(x%2);
   else{map.lowerTiles.push(oldLower[8*oldWidth+19]);map.upperTiles.push(-1);continue;}
  }
  map.lowerTiles.push(oldLower[y*oldWidth+sx]);map.upperTiles.push(oldUpper[y*oldWidth+sx]);
 }
 stamp(map,'house_i',21,8,base);
 for(let x=17;x<=19;x++)point(map,x,7,base);
 for(let y=7;y<=12;y++)point(map,19,y,base);
 for(let x=19;x<=23;x++)point(map,x,12,base);
 relocate(town,destination,23,11,{x:23,y:12},label);
 report.terrain.push({map:map.id,kit:'eastern-block',oldWidth,width:map.width});
}
// Use existing architecture: actual northern forest opening, two wooden piers,
// the stone steps to the beach, and the lighthouse doorway down to the sea cave.
relocate('harbor','forest',11,2,{x:11,y:3},'숲길');
relocate('harbor','ship_deck',30,4,{x:29,y:4},'별바람호 승선 부두');
relocate('harbor','river',30,9,{x:29,y:9},'계곡행 배편');
relocate('harbor','beach',17,20,{x:17,y:19},'해변 돌계단');
relocate('harbor','sea_cave',28,18,{x:28,y:19},'등대 지하 · 조수 동굴');
// Existing city doors now own the corresponding interior instead of empty plaza.
relocate('prism','museum',19,9,{x:19,y:10},'별의 역사 박물관');
relocate('prism','hideout',26,9,{x:26,y:10},'밤막회사 연구소');
relocate('summit','observatory',19,9,{x:19,y:10},'천문 관측소');
relocate('summit','league_0',26,9,{x:26,y:10},'별빛 리그 회관');
const prism=project.maps.mx_map_prism;
for(let y=10;y<=11;y++)for(let x=0;x<=3;x++){
 // The west side of the plaza is clear; open the forest boundary into a road.
 point(prism,x,y,terrain(prism,'path'));
}
relocate('prism','desert',1,10,{x:2,y:10},'서쪽 사막길');
// A genuine stone stairwell makes the otherwise empty cave transit legible.
for(let dy=0;dy<2;dy++)for(let dx=0;dx<3;dx++)point(prism,27+dx,12+dy,1846+dy*3+dx);
relocate('prism','cave',28,13,{x:28,y:14},'메아리 동굴 지하 계단');
report.terrain.push({map:prism.id,kit:'seawall_steps',x:27,y:12});
// Separate northern road and cave entrance in the two climate towns.
for(const [town,cave,ox,oy,pathGroup,label]of [['frost','ice_cave',15,4,'snowpath','서리종 동굴 석문'],['ember','lava_cave',11,4,'ashpath','용암 동굴 석문']]){
 const map=project.maps['mx_map_'+town],groups=project.tilesets[map.tilesetId].autotileGroups;
 const actual=groups.some(g=>g.id===pathGroup)?pathGroup:groups.find(g=>g.id.includes('path'))?.id;
 const base=terrain(map,actual);stamp(map,'ruin_gate',ox,oy,base);
 for(let y=oy+3;y<=oy+4;y++)point(map,ox+1,y,base);
 relocate(town,cave,ox+1,oy+2,{x:ox+1,y:oy+3},label);
}
relocate('frost','marsh',16,2,{x:16,y:3},'북쪽 습지길');
// Existing native rugs show indoor southern thresholds; league doors show the
// next room. Outdoor routes continue through the boundary with their own terrain.
const roomMaps=new Set(Object.values(project.maps).filter(m=>/_(center|mart|house)$/.test(m.id)||m.tilesetId==='emerald_monster_rooms').map(m=>m.id));
for(const {map,event}of portals){
 const t=project.tilesets[map.tilesetId],i=event.y*map.width+event.x;
 if(roomMaps.has(map.id)){
  if(map.id.startsWith('mx_map_league_')&&event.y<=3)stamp(map,'lg_door',event.x-1,event.y-1,map.lowerTiles[i]);
  else if(event.y>=map.height-3){
   const rug=map.tilesetId==='emerald_monster_overworld'?1894:198;
   point(map,event.x,event.y,rug);
  }
 }else if(map.tilesetId==='emerald_monster_gyms'){
  // Three tile leader mats use the same visual language as the existing gym.
  point(map,event.x,event.y,102);point(map,event.x-1,event.y,101);point(map,event.x+1,event.y,103);
 }else if(map.tilesetId==='emerald_monster_dungeon'){
  const existing=map.upperTiles[i]>=0?map.upperTiles[i]:map.lowerTiles[i];
  if(!t.tileMeta[existing]?.label?.includes('입구')){
   const ladder=map.id.includes('lava')?946:map.id.includes('ghost')?1619:66;
   point(map,event.x,event.y,map.lowerTiles[i],ladder);
   report.terrain.push({map:map.id,kit:'native-exit-stairs',x:event.x,y:event.y});
  }
 }else if(!report.relocations.some(r=>r.map===map.id&&r.source.x===event.x&&r.source.y===event.y)){
  const top=map.upperTiles[i]>=0?map.upperTiles[i]:map.lowerTiles[i];
  if(t.tileMeta[top]?.label?.includes('입구'))continue;
  const nearNorth=event.y<=4,nearSouth=event.y>=map.height-4;
  if(nearNorth||nearSouth){
   const underfoot=map.lowerTiles[i];
   const group=t.autotileGroups.find(g=>g.memberTileIds.includes(underfoot))??t.autotileGroups.find(g=>g.id==='clearing'||g.id==='path'||g.id==='snowpath'||g.id==='ashpath'||g.id==='deepsand');
   if(group){
    const end=nearNorth?0:map.height-1;
    for(let y=Math.min(event.y,end);y<=Math.max(event.y,end);y++)for(let x=event.x-1;x<=event.x;x++)point(map,x,y,terrain(map,group.id));
    report.terrain.push({map:map.id,kit:'continuous-boundary-path',x:event.x,y:event.y});
   }
  }else if(map.id==='mx_map_cave')stamp(map,'rock_stairs2',event.x,event.y-1,map.lowerTiles[i]);
 }
}
await withTsModule(resolve('src/project/defaults/autotileEngine.ts'),'npc-path-autotile.mjs',m=>{
 for(const [id,points]of changed)m.shapeAllAutotileGroupsAround(project.maps[id],project.tilesets[project.maps[id].tilesetId].autotileGroups??[],points);
});
await withTsModule(resolve('src/project/collision.ts'),'npc-wayfinding-passability.mjs',m=>{
 report.portalChecks=[];
 for(const {map,event}of portals){
  if(!m.isPassableLanding(project,map,event.x,event.y))throw Error('Blocked portal '+event.id+` (${event.x},${event.y})`);
  const approaches=[[0,1],[0,-1],[1,0],[-1,0]].filter(([dx,dy])=>m.canMove(project,map,event.x+dx,event.y+dy,event.x,event.y));
  if(!approaches.length)throw Error('No approach '+event.id);
  for(const pg of event.pages)walkCommands(pg.commands,c=>{if(c.kind==='transfer'&&!m.isPassableLanding(project,project.maps[c.mapId],c.x,c.y))throw Error('Blocked landing '+event.id+' -> '+c.mapId+` ${c.x},${c.y}`);});
  report.portalChecks.push({id:event.id,approaches:approaches.length});
 }
 for(const r of report.relocations){const map=project.maps[r.map];if(!m.canMove(project,map,r.landing.x,r.landing.y,r.source.x,r.source.y))throw Error('New landing does not approach its entrance '+r.target);}
});
for(const key of ['session','startMapId','startPos','database'])if(!isDeepStrictEqual(before[key],project[key]))throw Error('Unexpected change '+key);
if(!isDeepStrictEqual(before.system,project.system))throw Error('System/opening/music changed');
await withTsModule(resolve('src/project/io.ts'),'npc-wayfinding-load.mjs',m=>{const loaded=m.deserialize(JSON.stringify(project));if(loaded.assets.uploaded.oprn_emerald_field_cast_2.meta.walkFrameMs!==130)throw Error('Load loses cadence');});
report.systemUnchanged=true;report.databaseUnchanged=true;report.sessionUnchanged=true;
await fs.writeFile(join(out,'prepared-canonical.json'),JSON.stringify(project));
await fs.writeFile(join(out,'portable-cache.json'),JSON.stringify(cache));
await fs.writeFile(join(out,'world-manifest.json'),JSON.stringify(manifest));
await fs.writeFile(join(out,'adoption.json'),JSON.stringify(report,null,2)+'\n');
await fs.copyFile(join(sourceDir,'canonical-identity.json'),join(out,'canonical-identity.json'));
console.log(JSON.stringify({npcPages:report.npcPages,signPages:report.signPages,arrowsRemoved:report.arrowsRemoved,relocations:report.relocations.length,portalChecks:report.portalChecks.length,packing:packing.lossless,sourceSha256:receipt.sha256}));
