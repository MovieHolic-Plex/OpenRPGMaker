// Read-only snapshot for Slates authoring. Never write credentials to the snapshot.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {parseEnv} from '../lib/supabase-database-ops.mjs';
const out=process.argv[2];if(!out)throw Error('Usage: node scripts/content/read-slates-project.mjs <new snapshot directory>');
try{await access(`${out}/source-row.json`);throw Error('Snapshot already exists. Preserve it; choose a new directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
const env=parseEnv(await readFile('.env.local','utf8')),id='rpg-zzu-slates32-38e6';
if(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_ANON_KEY)throw Error('Supabase connection is required');
const r=await fetch(env.VITE_SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/projects?project_id=eq.'+id+'&select=project_id,current_json,current_sha256',{headers:{apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.VITE_SUPABASE_ANON_KEY,'Accept-Profile':'rpg_zzu'}});
if(!r.ok)throw Error('Supabase read failed: '+r.status);const rows=await r.json();if(rows.length!==1)throw Error('Expected exactly one Slates project');
await mkdir(out,{recursive:true});await writeFile(`${out}/source-row.json`,JSON.stringify(rows[0]));await writeFile(`${out}/source-project.json`,JSON.stringify(rows[0].current_json));
console.log({projectId:id,maps:Object.keys(rows[0].current_json.maps),sha256:rows[0].current_sha256,out});
