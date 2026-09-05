/** Repair the existing remote project without rebuilding or replacing user-authored maps. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {loadProjectFromSupabase,saveProjectToSupabase} from '../src/project/supabaseProjectSync.ts';
import {DEFAULT_MESSAGE_WINDOW_SETTINGS} from '../src/project/session.ts';
import {projectLint} from '../src/project/lint/projectLint.ts';
import {serializePretty} from '../src/project/io.ts';
import {loadSupabaseEnvironment} from './lib/supabase-database-ops.mjs';
const env=loadSupabaseEnvironment();
const config={url:env.VITE_SUPABASE_URL,anonKey:env.VITE_SUPABASE_ANON_KEY,projectId:'rpg-zzu-cheolsu-memory-20260905-df12'};
const p=await loadProjectFromSupabase(config);assert(p);
const original=structuredClone(p);
const page=p.maps.memory_summer?.events.find(e=>e.id==='summer_scene')?.pages?.[0];assert(page);
const at=page.commands.findIndex(c=>c.kind==='moveEvent'&&c.eventId==='father');assert(at>=0);
const previous=page.commands[at-1];
if(previous?.kind!=='displayTextSettings'||!previous.allowEventMovementDuringWait){
 page.commands.splice(at+1,0,{kind:'displayTextSettings',...DEFAULT_MESSAGE_WINDOW_SETTINGS});
 page.commands.splice(at,0,{kind:'displayTextSettings',...DEFAULT_MESSAGE_WINDOW_SETTINGS,allowEventMovementDuringWait:true});
}
assert(!projectLint(p).some(i=>i.severity==='error'));
const out='.omo/evidence/cheolsu-memory';
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(`${out}/repair-candidate.json`,JSON.stringify(p));
if(!process.argv.includes('--save')) {console.log('Local candidate prepared from current remote project; remote unchanged.');process.exit(0);}
const latest=await loadProjectFromSupabase(config);assert.deepEqual(latest,original,'Remote changed while preparing repair');
const saved=await saveProjectToSupabase(p,config);assert.equal(saved.kind,'saved');
const reloaded=await loadProjectFromSupabase(config);assert(reloaded);assert.deepEqual(reloaded.maps,p.maps);
fs.writeFileSync(`${out}/project.json`,JSON.stringify(reloaded));
fs.writeFileSync(`${out}/철수의 기억.oprn`,serializePretty(reloaded));
fs.writeFileSync(`${out}/repair-persistence.json`,JSON.stringify({projectId:config.projectId,saveKind:saved.kind,sha256:saved.sha256,reloaded:true,changedEvent:'memory_summer/summer_scene',reason:'Enable NPC route updates while waiting for the father to turn; restore dialogue defaults immediately after.',verifiedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({projectId:config.projectId,saved:saved.kind,reloaded:true}));
