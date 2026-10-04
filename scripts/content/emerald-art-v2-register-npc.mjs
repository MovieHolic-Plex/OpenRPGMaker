// Publish generated NPC pixels to the shared campaign pack, never to a remote DB.
import fs from 'node:fs';
import path from 'node:path';
const [packed,manifestFile]=process.argv.slice(2);
if(!manifestFile)throw Error('Usage: node emerald-art-v2-register-npc.mjs <packed-dir> <generation-manifest>');
const dest='public/assets/emerald-monster/cast',source='assets/emerald-monster-v2/source';
fs.mkdirSync(dest,{recursive:true});fs.mkdirSync(source,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const durable=manifest.map(e=>{const file=path.join(source,e.id+'.png');fs.copyFileSync(e.path,file);return {...e,path:file};});
fs.writeFileSync('assets/emerald-monster-v2/npc-generation.json',JSON.stringify(durable,null,2));
const roles=['hero','rival','professor','nurse','merchant','mother','resident','gym_leader','company_agent','captain','worker','explorer','student','ranger','moon_leader','hiker','hero_back'];
const names=['여행자','라이벌','박사','치유사','상점 주인','어머니','마을 주민','체육관 관장','회사 요원','선장','정비공','탐험가','학생','숲 관리인','달빛 관장','등산객','여행자 뒤모습'];
const uploaded={};
function asset(id,kind,name,file,meta) {
  const bytes=fs.readFileSync(path.join(packed,file));fs.copyFileSync(path.join(packed,file),path.join(dest,file));
  return {id,kind,name,dataUrl:'data:image/png;base64,'+bytes.toString('base64'),meta};
}
for(let i=1;i<=2;i++){const id='oprn_emerald_field_cast_'+i;uploaded[id]=asset(id,'charset','비취섬 필드 인물 '+i,'cast-'+i+'.png',{width:288,height:256,frameWidth:24,frameHeight:32,frames:96});}
uploaded.oprn_emerald_signpost=asset('oprn_emerald_signpost','charset','비취섬 나무 길 표지판','sign.png',{width:288,height:256,frameWidth:24,frameHeight:32,frames:96});
for(const [i,role] of roles.entries()){const id='oprn_emerald_trainer_'+role;uploaded[id]=asset(id,'picture','비취섬 전투 인물 · '+names[i],'trainer-'+role+'.png',{mime:'image/png',width:64,height:96});}
fs.writeFileSync(path.join(dest,'uploaded-cast.json'),JSON.stringify(uploaded));
const professor={...uploaded.oprn_emerald_trainer_professor,id:'oprn_emerald_professor',name:'비취섬 천문박사 · GBA 픽셀 오프닝'};
fs.writeFileSync('public/assets/emerald-monster/professor-asset.json',JSON.stringify(professor));
console.log(JSON.stringify({sharedAssets:Object.keys(uploaded).length,roles:16,walkingFrames:192,trainerViews:17}));
