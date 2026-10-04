// Shipping player renderer. These edge cases are labelled fixtures; canonical walkthrough is separate.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve,sep,extname } from 'node:path';
const out=resolve('verify-shots/opening-typography'),root=resolve('output/qa/opening-typography/game-web');
const original=JSON.parse(await readFile(resolve(root,'project.json'),'utf8'));
const sample='한글 👨‍👩‍👧‍👦 é <b>기억</b>\n다시 시작하는 이야기';
const specs=[
 ['letters','prologue','typewriter','fade',0],['chapter','chapter','rise','iris',0],
 ['memory','memory','blur','dissolve',0],['credits','credits','scroll','wipe',2000],
 ['caption','subtitle','fade','flash',0],['plain','subtitle','none','cut',0],
 ['exit','prologue','fade','fade',1400],
];
const fixture=structuredClone(original);
fixture.system.titleScreen.effects=[];delete fixture.system.titleScreen.sequence;
fixture.system.opening={enabled:true,skippable:true,scenes:specs.map(([id,preset,animation,enter,durationMs])=>({id,kind:'text',narration:id==='credits'?'기억의 기록\n\n이야기 · 서린\n\n세계 · 멈춘 시계\n\n새로운 시작':sample,durationMs,presentation:{preset,text:{animation,delayMs:0,revealMs:1000,exitMs:200},transition:{enter,enterMs:300,exitMs:id==='exit'?500:0}}}))};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ogg':'audio/ogg','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{const url=new URL(req.url,'http://local');if(url.pathname==='/project.json'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify(fixture));return;}const path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}try{res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream'}).end(await readFile(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
await mkdir(out+'/features',{recursive:true});
const result={mode:'explicit feature fixtures through shipping player.html and export shim',cases:[],errors:[]};
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const shot=async(page,name)=>page.screenshot({path:out+'/features/'+name+'.png',animations:'allow'});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'no-preference'});
page.on('pageerror',e=>result.errors.push(e.message));
const scene=async(p,id)=>p.waitForFunction(id=>document.querySelector('[data-testid="cinematic-sequence"]')?.dataset.sceneId===id,id,{polling:25,timeout:20000});
try{
 await page.goto(base+'/player.html',{waitUntil:'domcontentloaded'});await page.getByTestId('title-screen').waitFor();await page.keyboard.press('Enter');await scene(page,'letters');
 await page.waitForFunction(()=>{const letters=[...document.querySelectorAll('[data-letter]')],n=letters.filter(e=>e.style.opacity==='1').length;return n>0&&n<letters.length},null,{polling:20});
 const glyphs=await page.locator('.cinematic-narration').evaluate(n=>({text:n.textContent,letters:[...n.querySelectorAll('[data-letter]')].map(s=>s.textContent),state:n.dataset.textState}));
 assert.equal(glyphs.text,sample);assert(glyphs.letters.includes('👨‍👩‍👧‍👦'));assert(glyphs.letters.includes('é'));assert.equal(await page.locator('.cinematic-narration b').count(),0);
 await shot(page,'01-typewriter');await page.keyboard.press('Enter');await scene(page,'letters');assert.equal(await page.locator('.cinematic-narration').getAttribute('data-text-state'),'shown');
 assert.equal(await page.locator('[data-letter]').evaluateAll(a=>a.filter(n=>n.style.opacity!=='1').length),0);
 result.cases.push({name:'unicode-safe typewriter; first confirm reveals, second advances',passed:true,glyphs});
 await page.keyboard.press('Enter');await scene(page,'chapter');await page.waitForTimeout(350);await shot(page,'02-chapter-iris');
 assert.equal(await page.locator('.cinematic-narration').getAttribute('data-font'),'serif');
 await page.waitForTimeout(800);await page.keyboard.press('Enter');await scene(page,'memory');await page.waitForTimeout(500);await shot(page,'03-memory-blur');
 await page.waitForTimeout(700);await page.keyboard.press('Enter');await scene(page,'credits');
 const first=await page.locator('.cinematic-narration').evaluate(n=>getComputedStyle(n).transform);await page.waitForTimeout(500);const second=await page.locator('.cinematic-narration').evaluate(n=>getComputedStyle(n).transform);assert.notEqual(first,second);await shot(page,'04-credits-scroll');
 await scene(page,'caption');await page.waitForTimeout(1200);await shot(page,'05-subtitle-flash');await page.keyboard.press('Enter');await scene(page,'plain');assert.equal(await page.locator('.cinematic-narration').getAttribute('data-animation'),'none');
 await page.keyboard.press('Enter');await scene(page,'exit');await page.waitForFunction(()=>document.querySelector('[data-testid="cinematic-sequence"]')?.dataset.transitionState==='exiting',null,{polling:20});
 await page.waitForTimeout(220);const fade=await page.locator('.cinematic-frame:not([data-previous-frame])').evaluate(n=>Number(getComputedStyle(n).opacity));assert(fade<0.9&&fade>0);await shot(page,'06-independent-fade-out');
 await page.getByTestId('cinematic-sequence').waitFor({state:'hidden'});await page.getByTestId('play-loading-overlay').waitFor({state:'hidden',timeout:40000});
 result.cases.push({name:'all text layouts and six entrances; animated credits and independent scene exit',passed:true,exitOpacity:fade});
 // Reduced motion shows full credits at a stable position; Escape returns to gameplay.
 const reduced=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});reduced.on('pageerror',e=>result.errors.push(e.message));
 await reduced.goto(base+'/player.html',{waitUntil:'domcontentloaded'});await reduced.getByTestId('title-screen').waitFor();await reduced.keyboard.press('Enter');await scene(reduced,'letters');assert.equal(await reduced.locator('[data-letter]').count(),0);assert.equal(await reduced.locator('.cinematic-narration').innerText(),sample);
 await reduced.keyboard.press('Enter');await scene(reduced,'chapter');await reduced.keyboard.press('Enter');await scene(reduced,'memory');await reduced.keyboard.press('Enter');await scene(reduced,'credits');
 assert.equal(await reduced.locator('.cinematic-narration').getAttribute('data-layout'),'center');assert.equal(await reduced.locator('.cinematic-narration').getAttribute('data-animation'),'none');await shot(reduced,'07-reduced-credits');
 await reduced.keyboard.press('Escape');await reduced.getByTestId('cinematic-sequence').waitFor({state:'hidden'});await reduced.getByTestId('play-loading-overlay').waitFor({state:'hidden',timeout:40000});await reduced.waitForTimeout(1500);assert.equal(await reduced.getByTestId('cinematic-sequence').count(),0);
 result.cases.push({name:'reduced motion keeps credits readable; skip cancels text/scene timers',passed:true});await reduced.close();
 assert.deepEqual(result.errors,[]);result.passed=true;
}catch(e){result.failure=e.message;await shot(page,'failure').catch(()=>{});}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(out+'/features.json',JSON.stringify(result,null,2)+'\n');await writeFile(out+'/features/SUMMARY.md',`# 글자 연출 출하 플레이어 QA\n\n${result.passed?'PASS':'FAIL'} · 기능 전용 fixture. 저장된 실제 게임 확인은 keep/release와 gameplay.json.\n\n${result.cases.map(c=>'- '+c.name+': PASS').join('\n')}\n\n즉시 확인: 01-typewriter.png, 02-chapter-iris.png, 04-credits-scroll.png, 06-independent-fade-out.png, 07-reduced-credits.png${result.passed?'':', failure.png'}\n\n${result.failure??''}`.trimEnd()+'\n');}
console.log(JSON.stringify(result));process.exitCode=result.passed?0:1;
