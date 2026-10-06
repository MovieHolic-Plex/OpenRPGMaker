// Standalone player proof on an existing portable campaign, no canonical writes or suites.
import { chromium } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const url = process.env.OPRN_QA_URL;
const input = process.env.OPRN_QA_PROJECT;
if (!url || !input) throw new Error('Set OPRN_QA_URL and OPRN_QA_PROJECT');
const out = resolve(process.env.OPRN_QA_OUT ?? 'verify-shots/slide-tiles');
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(input, 'utf8'));
delete project.system.opening;
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [], httpErrors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) httpErrors.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => { window.__OPENRPG_BOOT__ = { projectUrl: '/__slide_project.json', saveNamespace: `slide-proof-${Date.now()}`, qaInstrumentation: true }; });
await page.route('**/__slide_project.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify(project) }));
const report = { input, scope: 'Existing 72-map campaign copy; standalone exportEntry/store shim; QA positioning then one physical key tap and released-input automatic steps. No authored tile/map changes, no canonical writes, not built export/full campaign.' };
try {
 await page.goto(`${url.replace(/\/$/u, '')}/player.html`);
 await page.getByTestId('title-screen').waitFor({ timeout: 120000 }); await page.keyboard.press('Enter');
 await page.waitForFunction(() => window.__oprnDebug?.readLive().currentMapId, undefined, { timeout: 120000 });
 await page.getByTestId('play-loading-overlay').waitFor({ state: 'detached', timeout: 120000 });
 for (let n = 0; n < 150; n++) {
  if (await page.getByTestId('runtime-choices').count()) throw new Error('Unexpected opening choice');
  if (!await page.getByTestId('dialogue-box').count() && !await page.evaluate(() => window.__oprnHooksScene.running)) break;
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
 }
 const plans = await page.evaluate(async () => {
  const { deserialize, serialize, serializePretty } = await import('/src/project/io.ts');
  const { slideAfterStep, slideRuleAt } = await import('/src/project/slideTiles.ts');
  const { canMove, isPassable } = await import('/src/project/collision.ts');
  const { prepareWebExport } = await import('/src/project/webExport.ts');
  const p = deserialize(JSON.stringify(await (await fetch('/__slide_project.json')).json()));
  const q = deserialize(serialize(p)), pretty = deserialize(serializePretty(p));
  const tables = p => Object.fromEntries(Object.entries(p.tilesets).filter(([, t]) => t.slideTiles).map(([id, t]) => [id, t.slideTiles]));
  const exported = deserialize(prepareWebExport(p).projectJson);
  if (JSON.stringify(tables(p)) !== JSON.stringify(tables(exported))) throw new Error('Web exporter changed authored slide tables');
  if (JSON.stringify(tables(p)) !== JSON.stringify(tables(q)) || JSON.stringify(tables(p)) !== JSON.stringify(tables(pretty))) throw new Error('Slide table wire roundtrip changed');
  let invalidRejected = false;
  const bad = JSON.parse(serialize(p)); const firstId = Object.keys(tables(p))[0]; bad.tilesets[firstId].slideTiles['0'] = 'teleport';
  try { deserialize(JSON.stringify(bad)); } catch { invalidRejected = true; }
  if (!invalidRejected) throw new Error('Invalid slide rule accepted');
  const directions = [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']];
  const candidates = [];
  for (const [mapId, m] of Object.entries(q.maps)) {
   const t = q.tilesets[m.tilesetId]; if (!t.slideTiles) continue;
   const onEvent = (x,y) => m.events.some(e => e.x === x && e.y === y);
   for (let y = 1; y < m.height - 1; y++) for (let x = 1; x < m.width - 1; x++) {
    if (!isPassable(q,m,x,y) || onEvent(x,y) || slideRuleAt(t,m,x,y)) continue;
    for (const [dx,dy,key] of directions) {
     if (!canMove(q,m,x,y,x+dx,y+dy) || onEvent(x+dx,y+dy)) continue;
     const rule = slideRuleAt(t,m,x+dx,y+dy); if (!rule || rule === 'stop') continue;
     let cx=x+dx, cy=y+dy, sx=dx, sy=dy, kind=null, reason=''; const path=[{x,y},{x:cx,y:cy}], seen = new Set();
     for (let n=0;n<100;n++) {
      const next=slideAfterStep(t,m,cx,cy,sx,sy,kind);
      if (!next) { reason=slideRuleAt(t,m,cx,cy)==='stop'?'stop':'ice-exit'; break; }
      if (!canMove(q,m,cx,cy,cx+next.dx,cy+next.dy)) {reason='wall';break;}
      if(onEvent(cx+next.dx,cy+next.dy)) break;
      const sig=`${cx},${cy},${next.dx},${next.dy}`; if(seen.has(sig))break; seen.add(sig);
      sx=next.dx; sy=next.dy; kind=next.kind; cx+=sx; cy+=sy; path.push({x:cx,y:cy});
     }
     if(reason && path.length>=5 && path.length<=18 && (!m.encounterRate || mapId.includes('gym') || mapId.includes('hideout'))) candidates.push({mapId, key, rule, reason, path});
    }
   }
  }
  const find = (kind, reason) => candidates.find(c => (kind==='ice'?c.rule==='ice':c.rule!=='ice') && c.reason===reason);
  const chosen=[find('ice','wall'),find('arrow','stop'),find('arrow','wall')].filter(Boolean);
  if(chosen.length<2)throw new Error('Existing campaign lacks safe ice and arrow proof paths');
  return { tables: tables(p), maps:Object.keys(q.maps).length, species:q.database.monsterSpecies.length, invalidRejected, chosen };
 });
 Object.assign(report,{roundtripTables:plans.tables,maps:plans.maps,species:plans.species,invalidRejected:plans.invalidRejected,cases:[]});
 for(const [index, plan] of plans.chosen.entries()) {
  const start=plan.path[0], end=plan.path.at(-1);
  await page.evaluate(({plan,start})=>window.__oprnDebug.teleport(plan.mapId,start.x,start.y),{plan,start}); await page.waitForTimeout(500);
  const actualStart=await page.evaluate(()=>window.__oprnDebug.readLive());
  if(actualStart.x!==start.x||actualStart.y!==start.y)throw new Error('QA landing differed from original floor');
  await page.screenshot({path:`${out}/${index+1}-before.png`});
  await page.keyboard.down(plan.key); await page.waitForTimeout(35); await page.keyboard.up(plan.key);
  const samples=[]; let arrived=false;
  for(let n=0;n<80;n++) {
   const state=await page.evaluate(()=>{const s=window.__oprnHooksScene;return {x:s.tileX,y:s.tileY,moving:s.moving,slide:s.playerSlide,steps:s.session.stepCount};});
   samples.push(state);
   if(state.x===end.x&&state.y===end.y&&!state.moving&&!state.slide){arrived=true;break;}
   await page.waitForTimeout(100);
  }
  if(!arrived)throw new Error(`Native ${plan.rule}/${plan.reason} did not reach ${JSON.stringify(end)}; ${JSON.stringify(samples.at(-1))}`);
  await page.waitForTimeout(400);
  const settled=await page.evaluate(()=>window.__oprnDebug.readLive());
  if(settled.x!==end.x||settled.y!==end.y)throw new Error('Slide did not stop');
  await page.screenshot({path:`${out}/${index+1}-after.png`});
  report.cases.push({plan,samples,settled});
 }
 report.errors=errors;report.httpErrors=httpErrors;
 await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
 await writeFile(`${out}/SUMMARY.md`, `# Native slide tile proof\n\n${report.scope}\n\n- ${report.maps} maps / ${report.species} species. Compact and pretty serializer/deserializer and prepareWebExport retained all authored slide tables. Invalid rule rejected.\n- Physical35ms direction tap, then released input: ${report.cases.map(c=>`${c.plan.mapId} ${c.plan.rule}→${c.plan.reason}, ${c.plan.path.length-1} completed tiles`).join('; ')}. Endpoints stayed still400ms.\n- Page errors${errors.length}; HTTP errors${httpErrors.length}.\n- Teleport, route replacement and movement cancellation clear transient slide state. Dialogue/cutscene pauses the queued step; vehicles/sideview ignore authored slides.\n- Route/cancel/vehicle/dialogue boundaries inspected in source; native cases prove released-input ice/arrow travel and wall/stop termination only.\n\n## 즉시 확인\n\n${report.cases.map((_,i)=>`- ${i+1}-before.png\n- ${i+1}-after.png`).join('\n')}\n`);
 console.log(JSON.stringify({out,cases:report.cases.map(c=>({map:c.plan.mapId,rule:c.plan.rule,reason:c.plan.reason,tiles:c.plan.path.length-1})),errors,httpErrors}));
} catch(error){await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify({error:String(error),errors,httpErrors,text:await page.locator('body').innerText()},null,2));throw error;}
finally {await browser.close();}
