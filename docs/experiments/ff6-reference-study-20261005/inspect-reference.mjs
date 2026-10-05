// Inspect publicly accessible original gameplay in the browser. No media file is
// downloaded or extracted, and these screenshots are review evidence, not assets.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve('docs/experiments/ff6-reference-study-20261005');
const mode = process.argv[2] ?? 'magic';
const plans = {
  magic: { id: 'XSoHSGRyNPo', start: 90, end: 420, step: 3 },
  summons: { id: 'Shu1GcI9FIw', start: 58, end: 352, step: 3 },
  skills: { id: 'XSoHSGRyNPo', start: 654, end: 1030, step: 4 },
  holy: { id: 'XSoHSGRyNPo', start: 219, end: 227, step: 0.25 },
  bahamut: { id: 'Shu1GcI9FIw', start: 336, end: 352, step: 0.5 },
  elemental: { id: 'XSoHSGRyNPo', start: 171, end: 207, step: 0.5 },
};
const plan = plans[mode];
if (!plan) throw new Error('Unknown reference range');
if (process.argv[3]) plan.start=Number(process.argv[3]);
if (process.argv[4]) plan.end=Number(process.argv[4]);
if (process.argv[5]) plan.step=Number(process.argv[5]);
mkdirSync(`${output}/${mode}`, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--disable-background-networking', '--disable-features=NetworkChangeNotifier'] });
try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 780 } });
  await page.goto(`https://www.youtube.com/watch?v=${plan.id}&t=${plan.start}s`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('video').waitFor({ timeout: 20000 });
  await page.evaluate(async () => { const v=document.querySelector('video'); v.muted=true; await v.play(); });
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.querySelector('video').pause());
  await page.mouse.move(1090, 770);
  const observations=[];
  for (let at=plan.start; at<=plan.end; at+=plan.step) {
    if(observations.length>0&&observations.length%120===0){
      await page.goto(`https://www.youtube.com/watch?v=${plan.id}&t=${at}s`,{waitUntil:'domcontentloaded',timeout:45000});
      await page.locator('video').waitFor({timeout:20000});
      await page.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;await v.play();});
      await page.waitForTimeout(1200);
      await page.evaluate(()=>document.querySelector('video').pause());
      await page.mouse.move(1090,770);
    }
    await page.evaluate(async time => {
      const v=document.querySelector('video');
      if(Math.abs(v.currentTime-time)>0.1||v.seeking) await new Promise((ok,bad) => {
        const timer=setTimeout(()=>bad(new Error('Seek timeout')),20000);
        v.addEventListener('seeked',()=>{clearTimeout(timer);ok();},{once:true});
        v.currentTime=time;
        v.play().catch(()=>{});
      });
      await new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok)));
      if(v.requestVideoFrameCallback) await new Promise(ok=>{const t=setTimeout(ok,1000);v.requestVideoFrameCallback(()=>{clearTimeout(t);ok();});});
      v.pause();
    }, at);
    await page.locator('video').screenshot({ path:`${output}/${mode}/${at.toFixed(2)}.png` });
    observations.push({ at, ...(await page.evaluate(()=>{const v=document.querySelector('video');return {currentTime:v.currentTime,readyState:v.readyState,videoWidth:v.videoWidth,videoHeight:v.videoHeight};})) });
    writeFileSync(`${output}/${mode}/observations.json`,JSON.stringify({source:`https://www.youtube.com/watch?v=${plan.id}`,title:await page.title(),sampling:plan,observations},null,2)+'\n');
    if (observations.length%15===0) console.log(mode,observations.length,at);
  }
  writeFileSync(`${output}/${mode}/observations.json`,JSON.stringify({source:`https://www.youtube.com/watch?v=${plan.id}`,title:await page.title(),sampling:plan,observations},null,2)+'\n');
  console.log(mode,'captured',observations.length);
} finally { await browser.close(); }
