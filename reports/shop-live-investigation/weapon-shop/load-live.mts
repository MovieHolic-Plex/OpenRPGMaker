import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadProjectFromSupabase } from '/home/main/z-project/rpg-zzu/src/project/supabaseProjectSync.ts';
const out='/home/main/.herdr/worktrees/rpg-zzu/worktree-clear-harbor-3da2/reports/shop-live-investigation/weapon-shop';
const env=Object.fromEntries((await readFile('/home/main/z-project/rpg-zzu/.env.local','utf8')).split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const config={url:env.VITE_SUPABASE_URL,anonKey:env.VITE_SUPABASE_ANON_KEY,projectId:"oprn-e98456e1d8"};
const project=await loadProjectFromSupabase(config);
if(!project) throw new Error('Configured project missing');
const text=JSON.stringify(project); await writeFile(out+'/canonical-project.json',text);
const shops=[];
for(const map of Object.values(project.maps)) for(const event of map.events??[]) for(const [pageIndex,page] of (event.pages??[]).entries()) {
 const walk=(v,path)=>{if(!v||typeof v!=='object')return;if(v.kind==='shopProcessing'||/shop/i.test(v.kind??''))shops.push({mapId:map.id,mapName:map.name,eventId:event.id,eventName:event.name,x:event.x,y:event.y,pageIndex,trigger:page.trigger,path,command:v}); for(const [k,e]of Object.entries(v)) if(typeof e==='object')walk(e,path+'.'+k)}; walk(page.commands,'commands');
}
const info={projectId:config.projectId,loadedAt:new Date().toISOString(),snapshotSha256:createHash('sha256').update(text).digest('hex'),title:project.meta.title,startMapId:project.startMapId,startPos:project.startPos,system:project.system,session:project.session,maps:Object.values(project.maps).map(m=>({id:m.id,name:m.name,width:m.width,height:m.height,eventCount:m.events?.length})),shops,items:project.database.items,equipment:project.database.equipment,actors:project.database.actors};
await writeFile(out+'/canonical-data-evidence.json',JSON.stringify(info,null,2));
console.log(JSON.stringify({projectId:info.projectId,startMapId:info.startMapId,startPos:info.startPos,shops,itemCount:info.items?.length,equipmentCount:info.equipment?.length,maps:info.maps},null,2));
