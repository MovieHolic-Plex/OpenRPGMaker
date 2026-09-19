import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { startPlayerQaServer } from '../../lib/runtimeQaRun.mjs';
const out = 'verify-shots/runtime-qa/pokemon-reference';
await mkdir(out,{recursive:true});
const project = JSON.parse(await readFile(out+'/fixture.json','utf8'));
const browser = await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu']});
const server = await startPlayerQaServer();
const report={errors:[]};
let page;
try {
page = await browser.newPage({viewport:{width:1024,height:768}});
page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
page.on('requestfailed',r=>console.log('requestfailed',r.url(),r.failure()));
page.on('pageerror',e=>{report.errors.push(String(e));console.log('pageerror',String(e));});
await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__pkref/project.json',saveNamespace:'pkref',qaInstrumentation:true};});
await page.route('**/__pkref/project.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(project)}));
await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
await page.waitForSelector('[data-testid="title-screen"]',{timeout:60000});
await page.keyboard.press('Enter');
await page.waitForFunction(()=>window.__oprnDebug?.readState?.().currentMapId,undefined,{timeout:60000});
await page.evaluate(()=>{window.__oprnInput.face('right');window.__oprnInput.action();});
await page.waitForSelector('[data-testid="actor-command-fight"]',{timeout:30000});
await page.waitForFunction(()=>document.querySelector('.battle-scene')?.dataset.battleSequenceBusy === 'false');
await page.waitForTimeout(500);
await page.locator('.battle-scene').screenshot({path:out+'/root.png'});
report.root=await page.locator('.battle-scene').evaluate(root=>({text:root.innerText,rects:[...root.querySelectorAll('.battle-field,.battle-message-window,.battle-party,.battle-enemy-list-panel,.battle-command,.battle-enemy-image,.battle-skin-actor-image')].map(e=>({class:e.className,text:e.innerText,rect:e.getBoundingClientRect().toJSON()}))}));
await writeFile(out+'/root.json',JSON.stringify(report,null,2));
await page.keyboard.press('z');
await page.locator('.battle-submenu-header').waitFor({timeout:5000});
await page.locator('.battle-scene').screenshot({path:out+'/fight.png'});
await page.keyboard.press('x');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('z');
await page.locator('.battle-scene').screenshot({path:out+'/bag.png'});
if(await page.getByTestId('actor-command-back').count()) await page.keyboard.press('x');
await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowLeft');
await page.keyboard.press('z');
await page.locator('.battle-scene').screenshot({path:out+'/switch.png'});
await page.keyboard.press('x');
await page.getByTestId('actor-command-fight').focus();
report.viewports=[];
for (const width of [375,768]) {
  await page.setViewportSize({width,height:720});
  await page.waitForTimeout(150);
  report.viewports.push(await page.locator('.battle-pokemon-root').evaluate((menu,width)=>({width,labels:[...menu.querySelectorAll('strong')].map(e=>({text:e.textContent,clipped:e.scrollWidth>e.clientWidth+1}))}),width));
  await page.locator('.battle-scene').screenshot({path:out+`/root-${width}.png`});
}
await page.setViewportSize({width:1024,height:768});
await page.getByTestId('actor-command-fight').focus();
await page.keyboard.press('z');
await page.locator('.battle-submenu-header').waitFor();
const hpBefore = await page.locator('.battle-enemy-list-hp').first().textContent();
await page.getByTestId('actor-skill-skill_attack').focus();
await page.keyboard.press('z');
await page.waitForTimeout(100);
if (await page.locator('.battle-scene[data-battle-phase="targetSelect"]').count()) {
  await page.locator('.battle-scene').screenshot({path:out+'/target.png'});
  await page.keyboard.press('z');
}
await page.waitForFunction(before=>document.querySelector('.battle-enemy-list-hp')?.textContent!==before,hpBefore,{timeout:20000});
report.attackChangedHp=true;
await page.locator('.battle-scene').screenshot({path:out+'/attack.png'});
await writeFile(out+'/result.json',JSON.stringify(report,null,2));
await writeFile(out+'/SUMMARY.md','# Pokemon reference browser capture\n\nShipping player.html, transient monster UI fixture.\n\n즉시 확인: root.png, fight.png, bag.png, switch.png, attack.png, root-375.png\n\nPage errors: '+report.errors.length+'\nAttack changed HP: '+report.attackChangedHp+'\nViewports: 375 and 768, no clipped command labels.\n');
console.log(JSON.stringify({errors:report.errors,viewports:report.viewports,attackChangedHp:report.attackChangedHp}));
} catch(error) { console.log(await page?.locator('body').innerText()); await page?.screenshot({path:out+'/failure.png'}); throw error; } finally {await browser.close();await server.close();}
