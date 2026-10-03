// Focused browser inspection of the final review fragment, not a test suite.
import {chromium} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=resolve('verify-shots/monster-redraw-all');
const manifest=JSON.parse(await readFile(resolve('scripts/asset-gen/pixel-enemy/redraw/manifest.json'),'utf8'));
const browser=await chromium.launch({args:['--no-sandbox']});
const report={scope:'Final interactive gallery: all140 selections and two responsive layouts.',species:[],layouts:[],errors:[]};
try {
  for(const width of [736,320]){
    const page=await browser.newPage({viewport:{width,height:920}});
    page.on('pageerror',e=>report.errors.push(String(e)));
    await page.goto(pathToFileURL(resolve(out,'gallery-preview.html')).href);
    await page.waitForFunction(()=>document.querySelector('iframe')?.contentWindow!==null);
    const frame=page.frameLocator('iframe');
    await frame.locator('[data-monster] option').last().waitFor({state:'attached'});
    if(await frame.locator('[data-monster] option').count()!==140)throw new Error('Wrong species count');
    if(width===736){
      for(let i=0;i<manifest.length;i++){
        await frame.locator('[data-monster]').selectOption(String(i));
        await frame.locator('[data-sprite]').evaluate(async(c,{slug,cell})=>{
          const deadline=performance.now()+3000;
          while(c.dataset.spriteSlug!==slug||c.getAttribute('aria-label')?.indexOf('대기 A')===-1||c.width!==cell*3){
            if(performance.now()>deadline)throw new Error('Gallery paint timeout: '+slug);
            await new Promise(r=>requestAnimationFrame(r));
          }
        },manifest[i]);
        const row=await frame.locator('#monster-battle-redraw-gallery').evaluate(root=>({
          label:root.querySelector('[data-sprite]').getAttribute('aria-label'),
          width:root.querySelector('[data-sprite]').width,
          poseCount:root.querySelectorAll('[data-sheet] canvas').length
        }));
        if(row.poseCount!==9)throw new Error('Missing poses '+manifest[i].slug);
        report.species.push({slug:manifest[i].slug,...row});
      }
    }
    await frame.locator('[data-monster]').selectOption(String(manifest.findIndex(e=>e.slug==='dragon-blue')));
    await frame.getByRole('button',{name:'공격',exact:true}).click();
    await page.waitForTimeout(100);
    const layout=await frame.locator('#monster-battle-redraw-gallery').evaluate(root=>({
      viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
      mainWidth:root.querySelector('[data-sprite]').width,
      pose:root.querySelector('[data-pose]').textContent,
      columns:getComputedStyle(root.querySelector('[data-sheet]')).gridTemplateColumns.split(' ').length,
      poseWidths:[...root.querySelectorAll('[data-sheet] canvas')].map(c=>c.width)
    }));
    if(layout.scrollWidth>layout.viewport||layout.pose!=='공격')throw new Error('Layout or pose failure: '+JSON.stringify(layout));
    await page.screenshot({path:resolve(out,`gallery-${width}.png`),fullPage:true});
    await frame.locator('[data-play]').click();
    await page.waitForTimeout(300);
    if(await frame.locator('[data-play]').getAttribute('aria-pressed')!=='true')throw new Error('Playback did not start');
    await frame.locator('[data-play]').click();
    if(await frame.locator('[data-play]').getAttribute('aria-pressed')!=='false')throw new Error('Playback did not stop');
    report.layouts.push({width,...layout,playbackControls:true});
    await page.close();
  }
}catch(e){report.errors.push(String(e.stack??e));}
finally{await browser.close();}
await writeFile(resolve(out,'gallery-inspection.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({species:report.species.length,layouts:report.layouts,errors:report.errors}));
if(report.errors.length)process.exitCode=1;
