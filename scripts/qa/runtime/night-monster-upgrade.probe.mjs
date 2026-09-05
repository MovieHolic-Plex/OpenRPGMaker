// Read-only experiential QA against a freshly reloaded Supabase snapshot.
// The source snapshot is never rebuilt or saved back to the server.
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
const out = 'verify-shots/runtime-qa/night-monster-upgrade';
const project = JSON.parse(await fs.readFile('output/evidence/night-monster-upgrade/project.json', 'utf8'));
const chaser = project.maps.map_night_corridor.events.find(e => e.pages?.some(p => p.movement.type === 'chase')).id;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--disable-gpu'] });
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
async function shot(id, reason) {
  await page.screenshot({ path: `${out}/${id}.png` });
  report.captures.push({ id, reason, state: await state() });
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
  const before = (await state()).player;
  await page.evaluate(d => window.__oprnInput.dir(d), dir);
  try {
    await page.waitForFunction(([x,y]) => { const p=window.__oprnCharacterSprites().player; if(Math.abs(p.x-x)>.1 || Math.abs(p.y-y)>.1) { window.__oprnInput.dir(null); return true; } return false; },[before.x,before.y],{timeout:5000});
    await position(map,x,y);
    await page.waitForTimeout(100);
  } finally { await page.evaluate(() => window.__oprnInput.dir(null)); }
}
async function move(dir, map, x, y) {
  await page.evaluate(d => window.__oprnInput.dir(d), dir);
  try { await page.waitForFunction(([map,x,y]) => { const s=window.__oprnDebug.readState(); if(s.currentMapId===map && s.x===x && s.y===y) { window.__oprnInput.dir(null); return true; } return false; },[map,x,y],{timeout:15000}); }
  finally { await page.evaluate(() => window.__oprnInput.dir(null)); }
}
async function action(dir) {
  await page.evaluate(d => { window.__oprnInput.face(d); window.__oprnInput.action(); }, dir);
  await page.waitForTimeout(450);
}
try {
  page = await browser.newPage();
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  await page.setViewportSize({width:1024,height:768});
  await page.addInitScript(() => { localStorage.clear(); window.__OPENRPG_BOOT__ = {projectUrl:'/__runtime-review/project.json',saveNamespace:'night-monster-review',qaInstrumentation:true}; });
  await page.route('**/__runtime-review/project.json', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(project)}));
  await fs.mkdir(out,{recursive:true});
  await page.goto(`${server.url}/player.html`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-testid="title-screen"]',{timeout:45000});
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid="dialogue-box"]',{timeout:15000});
  await dismiss();
  await shot('01-foyer', '즉시 확인 — 현관으로 읽히는지, 가구 반복과 문 위치');
  await setup('map_night_foyer', 14, 11);
  await shot('02-chair-before', '즉시 확인 — 의자 밀기 전');
  const before = await state();
  await action('up');
  report.probes.chair = {before, after:await state()};
  if ((await state()).eventLocations['ev_night_movable_map_night_foyer']?.y !== 9) throw Error('chair did not move');
  await shot('03-chair-after', '즉시 확인 — 의자가 한 칸 위로 이동');
  await setup('map_night_study',12,11);
  await shot('04-study', '즉시 확인 — 서재 물체와 퍼즐 접근');
  await setup('map_night_bedroom',10,10);
  await shot('05-bedroom', '즉시 확인 — 침실 가구와 은신처');
  await setup('map_night_bedroom',14,6);
  await action('up');
  await page.waitForTimeout(200);
  report.probes.hiding=await state();
  if (!(await state()).horror?.hiding || (await state()).player.visible) throw Error('hiding must hide player sprite');
  await shot('06-hidden', '즉시 확인 — 실제 은신과 나오기 안내');
  await action('up');
  if ((await state()).horror?.hiding) throw Error('hiding did not exit');
  await setup('map_night_corridor',3,9);
  await shot('07-corridor', '즉시 확인 — 순환 동선과 가운데 벽');
  await page.keyboard.down('Shift');
  await move('down','map_night_corridor',3,10);
  await move('right','map_night_corridor',25,10);
  await move('up','map_night_basement',10,11);
  await shot('08-crossed-door', '즉시 확인 — 문 통과 뒤 추격 대기');
  const afterDoor=await state();
  await move('left','map_night_basement',3,11);
  await move('up','map_night_basement',3,5);
  await page.keyboard.up('Shift');
  await action('up');
  await shot('09-hide-from-pursuer', '즉시 확인 — 추격 중 지하실 보관장 은신');
  await page.waitForFunction(id=>!!window.__oprnCharacterSprites().events[id],chaser,{timeout:15000});
  await page.waitForTimeout(500);
  const followed=await state();
  if (!followed.horror?.hiding || followed.gameOver) throw Error('unseen hiding failed');
  report.probes.crossMap={afterDoor,followed};
  await shot('10-pursuer-entered', '즉시 확인 — 같은 괴물이 지하실에 들어와 수색');
  await page.waitForTimeout(5500);
  report.probes.afterSearch=await state();
  if ((await state()).gameOver) throw Error('hidden player detected without witnessing');
  await shot('11-search-ended', '즉시 확인 — 은신 유지와 수색 종료');
  await action('up');
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
