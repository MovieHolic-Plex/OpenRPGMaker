/** Reference-led editable field trilogy; additive canonical DB save with readback. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { configFromEnv } from './supabase-resource-root/supabaseRest.mjs';
import type { ProjectWriteAuthority } from '../src/project/supabaseProjectSync';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyLegacyEnvAliases } from './lib/oprnEnv.mjs';

applyLegacyEnvAliases();
const sourceRoot=process.env.OPRN_SOURCE_ROOT??process.cwd();
const source=(file:string)=>pathToFileURL(path.join(sourceRoot,'src',file)).href;
const {loadProjectFromSupabase,saveProjectToSupabase}=await import(source('project/supabaseProjectSync.ts'));
const {serialize,serializeForComparison,deserialize}=await import(source('project/io.ts'));
const {createBlankMap}=await import(source('project/defaults/defaultMaps.ts'));
const {computeReachableCells}=await import(source('project/lint/reachability.ts'));
import type { GameMap } from '../src/project/types';
const out='output/evidence/emerald-fields'; fs.mkdirSync(out,{recursive:true});
const config=await configFromEnv();
assert.equal(config.projectId,'rpg-zzu-house-template-gallery');
let authority: ProjectWriteAuthority | undefined;
const before=await loadProjectFromSupabase(config,a=>authority=a); assert.ok(before && authority,'DB connection and write authority required');
assert.ok(!before.tilesets.tileset_twinfalls_reference_20260914,'This project has the faithful reference field. Use scripts/refine-emerald-reference.mts; the old trilogy generator must not replace it.');
const project=structuredClone(before);
const ids=['map_field_twinfalls_20260913','map_field_fernwood_20260913','map_field_riverbend_20260913'];
if(process.argv.includes('--revise')){const receipt=deserialize(fs.readFileSync(`${out}/reloaded-project.json`,'utf8'));for(const id of ids){assert.deepEqual(project.maps[id],receipt.maps[id],`Field changed since receipt: ${id}`);delete project.maps[id];}assert.deepEqual(project.tilesets.tileset_emerald_fields_20260913,receipt.tilesets.tileset_emerald_fields_20260913);delete project.tilesets.tileset_emerald_fields_20260913;project.mapTree.children=project.mapTree.children.filter(n=>!ids.includes(n.mapId));}
for(const id of ids) assert.ok(!project.maps[id],`Existing field must not be overwritten: ${id}`);
const ts=structuredClone(project.tilesets.easyrpg_chipset_world); assert.ok(ts);
ts.id='tileset_emerald_fields_20260913'; ts.name='비취 들판 · 폭포와 나무다리'; ts.transparentColor='#ff678b';
assert.ok(!project.tilesets[ts.id]); project.tilesets[ts.id]=ts;
const flag=(tile:number,pass:boolean,star=false)=>{ts.passability[tile]={up:pass,down:pass,left:pass,right:pass};ts.priority[tile]=star?'upper':'lower';ts.tileMeta??=[];ts.tileMeta[tile]={...ts.tileMeta[tile],source:'user',userLocked:true,defaultLayer:star?'upper':'lower',passage:star?'star':pass?'passable':'solid'};};
for(const t of [72,102,240,241,242,270,271,272,300,301,302,330,331,332,109])flag(t,true);
for(const t of [139,171,172,173,201,202,203,123,153,183,213,57,59,318,319,348,349,380,410,381,411,89,119,209,239,116])flag(t,false);
for(const t of [288,117])flag(t,true,true);
const W=44,H=36;
const maps=ids.map((id,i)=>{const m=createBlankMap(['필드 01 · 쌍폭포 계곡','필드 02 · 고사리 숲길','필드 03 · 물굽이 유적'][i],W,H,ts.id,16);m.id=id;m.lowerTiles.fill(240);m.upperTiles.fill(-1);project.maps[id]=m;return m;});
const inside=(x:number,y:number)=>x>=0&&x<W&&y>=0&&y<H;
const lower=(m:GameMap,x:number,y:number,t:number)=>{if(inside(x,y))m.lowerTiles[y*W+x]=t;};
const upper=(m:GameMap,x:number,y:number,t:number)=>{if(inside(x,y))m.upperTiles[y*W+x]=t;};
const ellipse=(m:GameMap,cx:number,cy:number,rx:number,ry:number,t:number)=>{for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(((x-cx)/rx)**2+((y-cy)/ry)**2<1)lower(m,x,y,t);};
const reserved=new Map<string,Set<string>>(ids.map(id=>[id,new Set()]));
for(const [i,x,y] of [[0,31,25],[1,14,20],[2,9,12]])for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)reserved.get(ids[i])!.add(`${x+dx},${y+dy}`);
function road(m:GameMap,points:number[][],radius=1){for(let j=1;j<points.length;j++){const [ax,ay]=points[j-1],[bx,by]=points[j];const steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let k=0;k<=steps;k++){const x=Math.round(ax+(bx-ax)*k/steps),y=Math.round(ay+(by-ay)*k/steps);for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(!inside(xx,yy))continue;reserved.get(m.id)!.add(`${xx},${yy}`);if(m.lowerTiles[yy*W+xx]===240||m.lowerTiles[yy*W+xx]===304)lower(m,xx,yy,67);}}}}
function bridge(m:GameMap,x0:number,x1:number,y:number){for(let x=x0;x<=x1;x++)for(let dy=0;dy<3;dy++){upper(m,x,y+dy,102);reserved.get(m.id)!.add(`${x},${y+dy}`);}}
function tree(m:GameMap,x:number,y:number){if(!inside(x+1,y+1))return false;const cells=[[x,y],[x+1,y],[x,y+1],[x+1,y+1]];if(cells.some(([a,b])=>![240,304].includes(m.lowerTiles[b*W+a])||m.upperTiles[b*W+a]!==-1||reserved.get(m.id)!.has(`${a},${b}`)))return false;[[318,319],[348,349]].forEach((r,dy)=>r.forEach((t,dx)=>upper(m,x+dx,y+dy,t)));return true;}
function scatter(m:GameMap,seed:number,dense=false){let state=seed;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};for(let n=0;n<(dense?470:210);n++){const x=Math.floor(random()*(W-1)),y=Math.floor(random()*(H-1));if(!dense&&x>8&&x<31&&y>18&&random()<.65)continue;tree(m,x,y);}for(let n=0;n<100;n++){const x=Math.floor(random()*W),y=Math.floor(random()*H),i=y*W+x;if(m.lowerTiles[i]===240&&m.upperTiles[i]===-1&&!reserved.get(m.id)!.has(`${x},${y}`))upper(m,x,y,random()<.75?288:random()<.5?57:59);}}
const [falls,forest,bend]=maps;
// Uneven, tall rock face with two independent headwaters and a shared plunge pool.
for(let x=0;x<W;x++){const top=4+Math.round(1.5*Math.sin(x*.23)),bottom=14+Math.round(2*Math.sin(x*.25+.3));for(let y=top;y<=bottom;y++)lower(falls,x,y,y===top?139:y===bottom?202:172);}
for(let y=0;y<H;y++){
 const bands=y<16?[[10+(y<4?Math.round(Math.sin(y*.5)):0),13+(y<4?Math.round(Math.sin(y*.5)):0)],[20,22]]:y<23?[[10-Math.round(Math.sin((y-16)*.45)*2),24]]:[[13+Math.round((y-23)*.4),21+Math.round((y-23)*.4)]];
 for(const [a,b] of bands)for(let x=a;x<=b;x++){const old=falls.lowerTiles[y*W+x];lower(falls,x,y,120);if([139,172,202].includes(old))upper(falls,x,y,123);}
}
for(let x=30;x<=41;x++){const sy=10+Math.round(Math.sin((x-30)*.35)*2);for(let y=sy;y<sy+3;y++)lower(falls,x,y,240);lower(falls,x,sy+3,139);}
ellipse(falls,37,22,5,3,304);ellipse(falls,5,23,5,4,304);
road(falls,[[0,27],[6,25],[11,27],[25,27],[32,29],[37,25],[43,27]]);
road(falls,[[33,28],[34,22],[38,19]],0);
bridge(falls,13,24,26);
for(const [x,y] of [[12,24],[25,24],[12,30],[25,30]]){upper(falls,x,y,89);upper(falls,x,y+1,119);}
scatter(falls,20260913);
// Shaded approach: winding trail, a pond and deliberate openings among overlapping tree groups.
for(const [x,y,rx,ry] of [[8,8,8,6],[31,8,10,6],[12,29,9,6],[35,29,9,6]])ellipse(forest,x,y,rx,ry,304);
ellipse(forest,29,14,7,5,120);ellipse(forest,30,14,3,2,240);
road(forest,[[0,27],[7,27],[12,22],[17,22],[21,27],[30,28],[36,25],[43,27]]);
road(forest,[[17,22],[16,16],[20,12],[23,12]],0);
scatter(forest,78113,true);
// Downstream river makes a wide bend around an accessible ruined terrace.
for(let y=0;y<H;y++){const c=25+Math.round(4*Math.sin(y*.18));for(let x=c-3;x<=c+3;x++)lower(bend,x,y,120);}
ellipse(bend,34,8,7,5,304);ellipse(bend,8,8,7,6,304);ellipse(bend,12,30,8,4,304);
road(bend,[[0,27],[8,25],[15,27],[27,27],[34,28],[43,27]]);
road(bend,[[12,26],[13,19],[9,16],[9,12]]);
bridge(bend,17,28,26);
for(let y=9;y<=14;y++)for(let x=6;x<=13;x++)lower(bend,x,y,252);
flag(252,true);
for(const [x,y,t] of [[5,8,209],[14,8,89],[5,15,89],[14,15,209]]){upper(bend,x,y,t);upper(bend,x,y+1,t+30);}
scatter(bend,91631);
function transfer(m:GameMap,x:number,y:number,target:GameMap,tx:number,ty:number){const id=`${m.id}_exit_${x}_${y}`;m.events.push({id,name:`${target.name}으로`,x,y,trigger:{kind:'playerTouch'},commands:[],pages:[{id:`${id}_page`,name:'필드 이동',conditions:[],graphic:{transparent:true},trigger:{kind:'playerTouch'},priority:'below',movement:{type:'fixed',speed:3,frequency:3},commands:[{kind:'transfer',mapId:target.id,x:tx,y:ty,fade:'black'}]}]});}
for(let y=26;y<=28;y++){transfer(forest,43,y,falls,2,27);transfer(falls,0,y,forest,41,27);transfer(falls,43,y,bend,2,27);transfer(bend,0,y,falls,41,27);}
for(const [m,x,y,body] of [[forest,14,20,'고사리 숲길. 동쪽 길을 따라가면 쌍폭포 계곡에 닿는다.'],[falls,31,25,'서쪽: 고사리 숲길 / 동쪽: 물굽이 유적. 계곡은 나무다리로 건너세요.'],[bend,9,12,'물굽이 유적. 오래된 돌기둥 사이로 강물 소리만 남아 있다.']] as const){ const id=`${m.id}_sign`;upper(m,x,y,116);m.events.push({id,name:'길 안내',x,y,trigger:{kind:'action'},commands:[{kind:'text',body}]});}
for(const m of maps){project.mapTree.children.push({mapId:m.id,children:[]});m.layoutPlan={version:1,kind:'reference-authored-field',regions:[],notes:'사용자 쌍폭포 이미지 참고. 고사리 숲길 ↔ 쌍폭포 계곡 ↔ 물굽이 유적. 원본 World 타일, 편집 가능한 하위/상위 레이어와 실제 이동 이벤트.'};}
const normalized=deserialize(serialize(project));
const checks=maps.map(m=>{const n=normalized.maps[m.id];const seen=computeReachableCells(normalized,n,2,27);for(const e of n.events.filter(e=>e.trigger.kind==='playerTouch'))assert.ok(seen.has(`${e.x},${e.y}`),`Unreachable exit ${e.id}`);for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(n.upperTiles[y*W+x]===318)assert.deepEqual([n.upperTiles[y*W+x+1],n.upperTiles[(y+1)*W+x],n.upperTiles[(y+1)*W+x+1]],[319,348,349],'Tree cluster must remain complete');assert.ok(seen.has('41,27'),`Disconnected banks ${m.id}`);return {mapId:m.id,name:m.name,width:W,height:H,reachableCells:seen.size,transferEvents:m.events.filter(e=>e.trigger.kind==='playerTouch').length};});
for(const [id,m]of Object.entries(before.maps).filter(([id])=>!ids.includes(id)))assert.deepEqual(normalized.maps[id],m,`Existing map changed ${id}`);
assert.equal(normalized.startMapId,before.startMapId);assert.deepEqual(normalized.startPos,before.startPos);
fs.writeFileSync(`${out}/preview-project.json`,serialize(normalized));
fs.writeFileSync(`${out}/checks.json`,JSON.stringify(checks,null,2));
console.log(JSON.stringify(checks));
if(process.argv.includes('--apply')){
 fs.writeFileSync(`${out}/before.json`,serialize(before));
 const saved=await saveProjectToSupabase(normalized,config,authority);assert.equal(saved.kind,'saved',JSON.stringify(saved));
 const reloaded=await loadProjectFromSupabase(config);assert.ok(reloaded);assert.equal(serializeForComparison(reloaded),serializeForComparison(normalized));
 fs.writeFileSync(`${out}/reloaded-project.json`,serialize(reloaded));
 fs.writeFileSync(`${out}/supabase-proof.json`,JSON.stringify({projectId:config.projectId,saved:true,reloaded:true,sha256:saved.sha256,existingMapsPreserved:true,startPositionPreserved:true,maps:checks},null,2));
 console.log(JSON.stringify({saved:true,reloaded:true,projectId:config.projectId}));
}
