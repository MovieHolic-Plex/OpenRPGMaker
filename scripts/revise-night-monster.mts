import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { loadSupabaseEnvironment } from './lib/supabase-database-ops.mjs';
import { loadProjectFromSupabase, saveProjectToSupabase } from '../src/project/supabaseProjectSync.ts';
const env = loadSupabaseEnvironment();
const config = { url: env.VITE_SUPABASE_URL, anonKey: env.VITE_SUPABASE_ANON_KEY, projectId: 'rpg-zzu-night-monster-20260905' };
if (!config.url || !config.anonKey) throw Error('Supabase configuration missing');
const project = await loadProjectFromSupabase(config);
if (!project) throw Error('Remote project missing');
const out = 'output/evidence/night-monster-upgrade'; fs.mkdirSync(out,{recursive:true});
const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])) : v;
const hash = (p: unknown): string => createHash('sha256').update(JSON.stringify(canonical(p))).digest('hex');
if (process.argv.includes('--read')) {
  fs.writeFileSync(`${out}/before.json`, JSON.stringify(project));
  console.log(JSON.stringify({ projectId: config.projectId, title: project.meta.title, loaded: true, sha: hash(project), maps: Object.values(project.maps).map(m=>({id:m.id,events:m.events.map(e=>({id:e.id,x:e.x,y:e.y,names:e.pages?.map(p=>p.name)}))})) },null,2));
} else {
  const { reviseNightMonster } = await import('../src/project/examples/nightMonsterRevision.ts');
  const revised = reviseNightMonster(structuredClone(project));
  if (process.argv.includes('--save') && fs.existsSync(`${out}/project.json`)) {
    const reviewed = JSON.parse(fs.readFileSync(`${out}/project.json`,'utf8'));
    if (hash(reviewed.maps) !== hash(revised.maps)) throw Error('Prepared maps differ from current revision; prepare and QA again before saving');
  }
  fs.writeFileSync(`${out}/project.json`, JSON.stringify(revised));
  if (process.argv.includes('--save')) {
    const current = await loadProjectFromSupabase(config);
    if (hash(current) !== hash(project)) throw Error('Remote project changed during revision; reload before saving');
    fs.writeFileSync(`${out}/before-save.json`, JSON.stringify(current));
    const saved = await saveProjectToSupabase(revised, config);
    if(saved.kind !== 'saved' && saved.kind !== 'created') throw Error('Remote save failed: '+saved.kind);
    const loaded = await loadProjectFromSupabase(config);
    if (!loaded || hash(loaded.maps) !== hash(revised.maps)) throw Error('Remote map reload mismatch');
    fs.writeFileSync(`${out}/persistence.json`, JSON.stringify({projectId:config.projectId,savedAndReloaded:true,loadedAt:new Date().toISOString(),mapsSha:hash(loaded.maps)},null,2));
    fs.writeFileSync(`${out}/project.json`, JSON.stringify(loaded));
    console.log('Saved and reloaded: '+config.projectId);
  } else console.log('Prepared revision from current Supabase project: '+config.projectId);
}
