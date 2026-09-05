// Read-only experiential QA against the prepared or reloaded Supabase revision.
// This probe never rebuilds the source snapshot or writes to the remote project.
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
const label = process.argv.includes('--baseline') ? 'before' : 'after';
const directionInput = process.argv.includes('--direction');
const out = `verify-shots/runtime-qa/furniture-push-${label}${directionInput ? '-direction' : ''}`;
const projectFlag = process.argv.indexOf('--project');
const projectPath = projectFlag < 0 ? 'output/evidence/night-monster-upgrade/project.json' : process.argv[projectFlag+1];
const project = JSON.parse(await fs.readFile(projectPath, 'utf8'));
const chaser = project.maps.map_night_corridor.events.find(e => e.pages?.some(p => p.movement.type === 'chase')).id;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu', '--disable-features=LocalNetworkAccessChecks'] });
const server = await startPlayerQaServer();
const report = { source: 'night-monster-upgrade snapshot', execution: 'pending', visualReview: 'pending', captures: [], probes: {}, errors: [] };
let page;
async function state() {
  return page.evaluate(id => {
    const s = window.__oprnDebug.readState();
    const sprites = window.__oprnCharacterSprites();
    return { map: s.currentMapId, x: s.x, y: s.y, switches: s.switches,
      horror: s.horror, eventLocations: s.eventLocations, player: sprites.player, chaser: sprites.events[id] ?? null,
      visibleEventIds: Object.keys(sprites.events),
      dialogue: document.querySelector('[data-testid="dialogue-box"]')?.textContent ?? '',
      gameOver: !!document.querySelector('[data-testid="game-over-screen"]') };
  }, chaser);
}
async function dismiss() {
  for (let i = 0; i < 30; i++) {
    if (!await page.locator('[data-testid="dialogue-box"]').count()) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(160);
  }
  throw new Error('dialogue did not dismiss');
}
async function position(map, x, y) {
  await page.waitForFunction(([map, x, y]) => { const s = window.__oprnDebug.readState(); return s.currentMapId === map && s.x === x && s.y === y; }, [map, x, y], { timeout: 15000 });
}
async function setup(map, x, y) {
  await page.evaluate(() => window.__oprnInput.dir(null));
  await dismiss();
  // Same-map sprite relocation is not a reliable fixture setup. Cross a different map first.
  if ((await state()).map === map) await page.evaluate(m => window.__oprnDebug.teleport(m, 10, 10), map === 'map_night_basement' ? 'map_night_bedroom' : 'map_night_basement');
  await page.evaluate(([map, x, y]) => window.__oprnDebug.teleport(map, x, y), [map, x, y]);
  await position(map, x, y);
  // The QA teleport hook updates logical coordinates but leaves the sprite at its old position.
  // Use real movement out and back, then require the rendered feet to agree with the tile state.
  const nudge = map === 'map_night_study' ? ['left',x-1,y,'right']
    : (map === 'map_night_foyer' || (map === 'map_night_bedroom' && x === 14)) ? ['down',x,y+1,'up']
    : ['right',x+1,y,'left'];
  await step(nudge[0],map,nudge[1],nudge[2]);
  await step(nudge[3],map,x,y);
  await page.waitForFunction(([x,y])=>{const p=window.__oprnCharacterSprites().player;return Math.abs(p.x-(x+.5)*16)<.1 && Math.abs(p.y-(y+1)*16)<.1;},[x,y],{timeout:5000});
  await page.waitForTimeout(300); // Let the real map fade settle before inspecting colors.
}
async function step(dir, map, x, y) {
  await page.evaluate(d => window.__oprnDebug.playerRoute([{kind:'move',dir:d}]),dir);
  await position(map,x,y);
  await page.waitForFunction(([x,y])=>{const p=window.__oprnCharacterSprites().player;return Math.abs(p.x-(x+.5)*16)<.1 && Math.abs(p.y-(y+1)*16)<.1;},[x,y],{timeout:5000});

}
try {
  page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.setViewportSize({width:1024,height:768});
  await page.addInitScript(() => { localStorage.clear(); window.__OPENRPG_BOOT__ = {projectUrl:'/__runtime-review/project.json',saveNamespace:'night-monster-review',qaInstrumentation:true}; });
  // Host netlink churn cancels Chromium loopback HTTP (ERR_NETWORK_CHANGED).
  // Serve this same owned Vite server through Node fetch; no project or engine responses are mocked.
  await page.route(`${server.url}/**`, async route => {
    const response = await fetch(route.request().url());
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
  });
  await page.route('**/__runtime-review/project.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(project)}));
  await fs.mkdir(out,{recursive:true});
  await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-testid="title-screen"]',{timeout:90000});
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="dialogue-box"]',{timeout:60000});
  await dismiss();
  await setup('map_night_foyer', 14, 11);
  const beforePng = await page.locator('canvas').screenshot();
  report.probes.frames = await page.evaluate(async directionInput => {
    const frames = [];
    const canvas = document.querySelector('canvas');
    const start = performance.now();
    window.__oprnInput.face('up');
    const sample = () => {
      const sprites = window.__oprnCharacterSprites();
      frames.push({ms: performance.now()-start, player:sprites.player,
        chair:sprites.events.ev_night_movable_map_night_foyer,
        png:canvas.toDataURL('image/png')});
    };
    sample();
    if(directionInput) { window.__oprnInput.dir('up'); window.__oprnInput.dir(null); }
    else window.__oprnInput.action();
    while(performance.now()-start < 900) {
      await new Promise(requestAnimationFrame); sample();
    }
    return frames;
  },directionInput);
  const frames = report.probes.frames;
  frames[0].png = `data:image/png;base64,${beforePng.toString('base64')}`;
  const selected = [frames[0]];
  for(const f of frames.slice(1)) {
    if(Math.abs(f.chair.y-selected.at(-1).chair.y) >= 2) selected.push(f);
  }
  if(selected.at(-1)!==frames.at(-1)) selected.push(frames.at(-1));
  const sheet = await page.evaluate(async frames => {
    const canvas=document.createElement('canvas');
    canvas.width=1920;canvas.height=Math.ceil(frames.length/3)*510;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#171923';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.imageSmoothingEnabled=false;ctx.font='18px sans-serif';ctx.fillStyle='white';
    for(const [i,f] of frames.entries()) {
      const img=new Image();img.src=f.png;await img.decode();
      const x=i%3*640,y=Math.floor(i/3)*510;
      ctx.drawImage(img,x,y+30,640,480);
      ctx.fillText(`${Math.round(f.ms)}ms / chair y=${f.chair.y.toFixed(2)} / player y=${f.player.y.toFixed(2)}`,x+12,y+22);
    }
    return canvas.toDataURL('image/png');
  },selected);
  await fs.writeFile(`${out}/motion-sheet.png`,Buffer.from(sheet.split(',')[1],'base64'));
  for(const [i,f] of selected.entries()) await fs.writeFile(`${out}/frame-${i}.png`,Buffer.from(f.png.split(',')[1],'base64'));
  await fs.mkdir(`${out}/samples`,{recursive:true});
  for(const [i,f] of frames.entries()) await fs.writeFile(`${out}/samples/${String(i).padStart(3,'0')}.png`,Buffer.from(f.png.split(',')[1],'base64'));
  // Keep all sampled coordinates, without duplicating bitmap payloads in JSON.
  for(const f of frames) delete f.png;
  report.captures.push({id:'motion-sheet',reason:'즉시 확인 — 실제 연속 렌더 프레임, 시간과 두 물체의 발 위치'});
  report.probes.after = await state();
  if(label==='after') {
    const moving=frames.filter(f=>f.chair.y<176 && f.chair.y>160);
    if(moving.length<3) throw Error('too few intermediate rendered frames');
    if(frames.some(f=>Math.abs(f.player.y-f.chair.y-16)>.01)) throw Error('contact spacing drift');
    if(frames.at(-1).player.y!==176 || frames.at(-1).chair.y!==160) throw Error('push endpoints incorrect');
    if(new Set(frames.map(f=>f.chair.frame)).size!==1) throw Error('furniture frame changed');
  }
  report.execution='passed';
 } catch (error) {
  report.execution="failed";
  report.errors.push(String(error));
  report.failureState = await state().catch(() => null);
  await fs.mkdir(out,{recursive:true});
  await page.screenshot({path:`${out}/00-probe-failure.png`});
  report.captures.push({id:'00-probe-failure',reason:'즉시 확인 — QA 실행 실패 화면',body:await page.locator('body').innerText()});
}
finally {
  await fs.mkdir(out, {recursive:true});
  await fs.writeFile(`${out}/review.json`, JSON.stringify(report,null,2));
  const lines=['# 밤의 괴물 — 체험/시각 QA','', '이 목록은 합격표가 아니다. 각 PNG를 실제로 열어 품질을 판정한다.', '', ...report.captures.map(c=>`- ${c.id}.png — ${c.reason}`), '', '실행 오류: '+JSON.stringify(report.errors)];
  await fs.writeFile(`${out}/SUMMARY.md`,lines.join('\n'));
  await browser.close(); await server.close();
}
console.log(JSON.stringify({out,execution:report.execution,captures:report.captures.length,errors:report.errors},null,2));
process.exitCode=report.errors.length?1:0;
