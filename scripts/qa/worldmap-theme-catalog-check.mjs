import fs from 'node:fs';
import path from 'node:path';
import {buildWorldmap} from '../lib/worldmapBuild.mjs';
const root = path.resolve('tiledata/worldmap-kit');
const out = path.resolve('verify-shots/worldmap-theme-readiness');
fs.mkdirSync(out,{recursive:true});
const selected = JSON.parse(fs.readFileSync(path.join(root,'selected/selected.json'),'utf8')).icons;
const catalog = fs.readdirSync(path.join(root,'themes')).filter(n=>n.endsWith('.json')).sort().map(n=>{
 const theme=JSON.parse(fs.readFileSync(path.join(root,'themes',n),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'iconsets',theme.iconset,'manifest.json'),'utf8'));
 return {id:theme.id,name:theme.name,kind:theme.kind,terrain:theme.terrain??'shared-v9',journey:theme.journey??'fantasy-5act',
  candidateIcons:manifest.icons.length,selectedIcons:selected.filter(i=>i.theme===theme.iconset).length};
});
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(catalog,null,2));
const checks=[];
for(const theme of catalog){
 const built=await buildWorldmap({theme:theme.id,preview:true});
 const selection=built.ok?built.iconSelection:undefined;
 const record=built.ok?{theme:theme.id,ok:built.journeyCheck?.ok===true,seconds:built.seconds,
  layout:built.world.layout?Object.fromEntries(Object.entries(built.world.layout).filter(([key])=>key!=='regions')):null,
  locations:built.world.places.length,iconSelection:selection?{mode:selection.mode,rendered:selection.rendered.length,
    pending:selection.pending.length,pendingReasons:[...new Set(selection.pending.map(site=>site.reason))]}:null,warnings:built.warnings}:
  {theme:theme.id,ok:false,error:built.error};
 checks.push(record);fs.writeFileSync(path.join(out,'preview-checks.json'),JSON.stringify(checks,null,2));
 console.log(JSON.stringify({theme:theme.id,ok:record.ok,seconds:record.seconds,selected:record.iconSelection?.rendered,pending:record.iconSelection?.pending,error:record.error}));
}
if(checks.some(c=>!c.ok))process.exitCode=1;
