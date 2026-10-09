// Mount the actual database preview with a recording fixture; no project writes.
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { startPlayerQaServer } from '../../../scripts/lib/runtimeQaRun.mjs';

process.env.VITE_CACHE_DIR = new URL('../../../.vite-cache/snes-editor-preview', import.meta.url).pathname;
const out = 'verify-shots/snes-study-redraw-20261005/editor';
await mkdir(out, {recursive:true});
const fixtures = await Promise.all([0,1,2].map(i => readFile('verify-shots/snes-study-redraw-20261005/runtime-confirmed/recording-project-'+i+'.json','utf8').then(JSON.parse)));
const server = await startPlayerQaServer({logLevel:'error'});
const browser = await chromium.launch({args:['--no-sandbox']});
const page = await browser.newPage({viewport:{width:620,height:690},reducedMotion:'reduce'});
const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
try {
  await page.route('**/__editor-preview', r=>r.fulfill({contentType:'text/html',body:'<html><head><link rel="stylesheet" href="/src/styles/database/skill-item-visuals.css"></head><body style="padding:20px;background:#202838;color:#e4e8f0;--db-studio-well:#131923;--db-studio-border-default:#58647b;--db-studio-text-1:#d7e1f4;--db-studio-surface:#ffffff"><main></main></body></html>'}));
  await page.goto(server.url+'/__editor-preview');
  const rows=[];
  for (const [group,id] of [[0,'mage_fireball'],[0,'mage_blizzard'],[0,'mage_chain_lightning'],[1,'cleric_holy_smite'],[2,'monk_dragon_fist']]) {
    const info = await page.evaluate(async ({project,id})=>{
      window.__preview?.stop();
      const m=await import('/src/editor/panels/databaseSkillRetroStage.ts');
      const record=project.database.skills.find(s=>s.id==='skill_'+id);
      window.__preview=m.renderSkillRetroStage(record,project);
      document.querySelector('main').replaceChildren(window.__preview.element);
      return {id,found:!!record};
    },{project:fixtures[group],id});
    await page.waitForFunction(()=>document.querySelector('.db-skill-retro-world')?.getBoundingClientRect().width>0);
    await page.evaluate(async ()=>{await Promise.all([...document.images].map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r})));});
    const metrics=await page.evaluate(()=>({
      time:document.querySelector('.db-skill-retro-stage').dataset.retroTime,
      effects:[...document.querySelectorAll('.db-skill-retro-fx')].filter(n=>!n.hidden).map(n=>({key:n.style.backgroundImage,position:n.style.backgroundPosition,size:n.style.backgroundSize,z:n.style.zIndex,parent:n.parentElement.className,width:n.style.width})),
      width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
    }));
    await page.locator('main').screenshot({path:out+'/'+id+'.png'});
    rows.push({...info,...metrics});
  }
  if(errors.length) throw new Error(JSON.stringify(errors));
  await writeFile(out+'/observations.json',JSON.stringify({rows,errors},null,2));
  console.log(JSON.stringify({rows,errors}));
} finally {await browser.close();await server.close();}
