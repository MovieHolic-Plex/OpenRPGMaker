// Prepare a detached canonical patch from actual human-approved immutable bytes.
// Saving remains the official host store script's CAS/backup/fresh-reload operation.
import fs from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {withTsModule} from '../ontology-ts-loader.mjs';
const [canonicalDir,approvedDir,cachePath,out]=process.argv.slice(2);
if(!out)throw Error('Usage: prepare-approved-field-kit.mjs canonical-read-dir approved-pack portable-cache.json private-output');
const hash=b=>createHash('sha256').update(b).digest('hex');
await fs.mkdir(out,{recursive:true});
const manifest=JSON.parse(await fs.readFile(join(approvedDir,'manifest.json'),'utf8'));
const approval=JSON.parse(await fs.readFile(join(approvedDir,'approval.json'),'utf8'));
for(const [file,expected]of Object.entries(manifest.files))if(hash(await fs.readFile(join(approvedDir,file)))!==expected)throw Error('Approved bytes differ: '+file);
for(const group of ['monster','ui','music']){
 const vote=approval.decisions[group];
 if(vote?.decision!=='allow'||vote.source!=='human-browser'||vote.package!==manifest.packages[group]||!vote.checks.every(Boolean))throw Error('Current human Allow required: '+group);
}
const raw=await fs.readFile(join(canonicalDir,'canonical-reloaded.json'),'utf8'),receipt=JSON.parse(await fs.readFile(join(canonicalDir,'canonical-receipt.json'),'utf8'));
if(hash(raw)!==receipt.sha256)throw Error('Canonical read digest differs');
const before=JSON.parse(raw),project=structuredClone(before),cache=JSON.parse(await fs.readFile(cachePath,'utf8'));
if(project.meta.title!=='별빛섬 몬스터 원정'||!project.maps.mx_map_home||!project.database.monsterSpecies.some(s=>s.id==='mx_species_flurrykit'))throw Error('Wrong project');
const adapter=join(out,'flurrykit-runtime.png');
const packed=spawnSync('python3',[resolve('scripts/content/pack-reviewed-field-monster.py'),join(approvedDir,'site/assets/flurrykit.png'),adapter],{encoding:'utf8'});
if(packed.status!==0)throw Error(packed.stderr+packed.stdout);const packing=JSON.parse(packed.stdout);
const fieldId='mx_field_flurrykit_approved_v1',newAssets=[];
async function add(id,name,kind,file,mime,meta={}){
 if(project.assets.uploaded[id])throw Error('Asset already exists; do not overwrite an earlier adoption: '+id);
 const bytes=await fs.readFile(file),asset={id,name,kind,meta,dataUrl:`data:${mime};base64,${bytes.toString('base64')}`};
 project.assets.uploaded[id]=asset;cache.assets.uploaded[id]=asset;newAssets.push({id,sha256:hash(bytes),bytes:bytes.length});
}
await add(fieldId,'눈송냥 · 승인된 필드 보행','charset',adapter,'image/png',{width:288,height:256,frameWidth:24,frameHeight:32,frames:96,walkFrameMs:150});
// The same approved appearance also owns this species' train/follower sprite.
project.database.monsterSpecies.find(s=>s.id==='mx_species_flurrykit').graphic.fieldGraphic={sprite:{type:'uploaded',id:fieldId},direction:'down',pattern:25,transparent:false,scale:1,scaleMode:'manual'};
const replacements={mx_audio_town:'composed_music_fieldkit_town_v1',mx_audio_route:'composed_music_fieldkit_route_v1'};
const audio=JSON.parse(await fs.readFile(join(approvedDir,'site/assets/audio.json'),'utf8'));
for(const entry of audio.tracks){
 const id=replacements['mx_audio_'+entry.id],score=JSON.parse(await fs.readFile(join(approvedDir,`site/assets/${entry.id}-score.json`),'utf8'));
 await add(id,entry.name,'music',join(approvedDir,`site/assets/${entry.id}.wav`),'audio/wav');
 const {id:_,name,sha256,...measurements}=entry;
 project.meta.oprnMusicScores[id]={score,measurements,sha256};
}
for(const cue of ['cursor','confirm','cancel'])await add('mx_fieldkit_'+cue+'_v1','필드 키트 · '+cue,'sound',join(approvedDir,`site/assets/${cue}.wav`),'audio/wav');
const bindings=[];
function replaceMedia(value,path=[]){
 if(Array.isArray(value))value.forEach((v,i)=>replaceMedia(v,[...path,i]));
 else if(value&&typeof value==='object')for(const [key,child]of Object.entries(value)){
  if(['assets','oprnMusicScores','tilesets','resourceProfiles'].includes(key))continue;
  if(typeof child==='string'&&Object.hasOwn(replacements,child)){value[key]=replacements[child];bindings.push([...path,key].join('.'));}
  else replaceMedia(child,[...path,key]);
 }
}
replaceMedia(project);
project.meta.oprnMenuSounds={cursor:'mx_fieldkit_cursor_v1',confirm:'mx_fieldkit_confirm_v1',cancel:'mx_fieldkit_cancel_v1'};
project.system.titleScreen.sounds={...project.system.titleScreen.sounds,cursorSeResourceId:'mx_fieldkit_cursor_v1',confirmSeResourceId:'mx_fieldkit_confirm_v1',cancelSeResourceId:'mx_fieldkit_cancel_v1'};
for(const e of project.meta.oprnFieldMenu.entries)if(e.command==='monsters')e.label='파티';
const placements=[{mapId:'mx_map_home',x:11,y:10,body:'천문박사가 북쪽에서 데려온 눈송냥이다.\n차가운 코로 네 손을 살짝 건드렸다.'},{mapId:'mx_map_frost',x:6,y:9,body:'눈송냥이 눈 냄새를 맡으며 걷고 있다.\n작은 발자국이 뒤를 따라 이어진다.'}];
const dirs={up:[0,-1],right:[1,0],down:[0,1],left:[-1,0]};
await withTsModule(resolve('src/project/collision.ts'),'field-kit-passability.mjs',mod=>{
 for(const place of placements){
  const map=project.maps[place.mapId],occupied=new Set();
  for(const e of map.events){let x=e.x,y=e.y;occupied.add(`${x},${y}`);for(const move of e.pages[0]?.movement?.route?.moves??[]){if(move.kind==='move'){x+=dirs[move.dir][0];y+=dirs[move.dir][1];occupied.add(`${x},${y}`);}}}
  if(map.id===project.startMapId)occupied.add(`${project.startPos.x},${project.startPos.y}`);
  let x=place.x,y=place.y;
  for(const dir of ['right','down','left','up']){
   const [dx,dy]=dirs[dir],nx=x+dx,ny=y+dy;
   if(occupied.has(`${x},${y}`)||occupied.has(`${nx},${ny}`)||!mod.canMove(project,map,x,y,nx,ny))throw Error('Blocked/occupied authored monster route: '+map.id+` ${x},${y}→${nx},${ny}`);
   x=nx;y=ny;
  }
  const id=map.id+'_field_flurrykit';if(map.events.some(e=>e.id===id))throw Error('Field monster already exists');
  map.events.push({id,x:place.x,y:place.y,trigger:{kind:'action'},commands:[],pages:[{id:id+'_page',name:'눈송냥 · 산책',conditions:[],graphic:{sprite:{type:'uploaded',id:fieldId},direction:'down',pattern:25,transparent:false,scale:1,scaleMode:'manual'},trigger:{kind:'action'},priority:'same',overlapForbidden:true,animationType:'normal',movement:{type:'custom',speed:1,frequency:2,moveIntervalMs:1250,route:{repeat:true,skippable:false,moves:[...['right','down','left','up'].map(dir=>({kind:'move',dir})),{kind:'wait'}]}},commands:[{kind:'text',speaker:'눈송냥',body:place.body}]}]});
 }
});
if(!isDeepStrictEqual(before.session,project.session)||!isDeepStrictEqual(before.startPos,project.startPos)||before.startMapId!==project.startMapId||!isDeepStrictEqual(before.system.opening,project.system.opening))throw Error('Unexpected session/start/opening change');
await withTsModule(resolve('src/project/io.ts'),'field-kit-load.mjs',mod=>{
 const restored=mod.deserialize(JSON.stringify(project));
 if(restored.assets.uploaded[fieldId].meta.walkFrameMs!==150||restored.meta.oprnMenuSounds.confirm!=='mx_fieldkit_confirm_v1')throw Error('Load loses authored fields');
});
await fs.writeFile(join(out,'prepared-canonical.json'),JSON.stringify(project));
await fs.writeFile(join(out,'portable-cache.json'),JSON.stringify(cache));
await fs.copyFile(join(resolve(cachePath,'..'),'world-manifest.json'),join(out,'world-manifest.json'));
await fs.copyFile(join(canonicalDir,'canonical-identity.json'),join(out,'canonical-identity.json'));
const report={projectId:receipt.projectId,sourceSha256:receipt.sha256,approval:approval.decisions,newAssets,packing,bindings,placements,sessionUnchanged:true,openingUnchanged:true,status:'prepared-not-saved'};
await fs.writeFile(join(out,'adoption.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceSha256:receipt.sha256,newAssets:newAssets.map(x=>x.id),bindingCount:bindings.length,placements,packing},null,2));
