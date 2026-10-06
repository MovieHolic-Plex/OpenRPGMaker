// Browser image inspection only: no test framework, no engine/server mutations.
const { chromium } = require('/home/main/z-project/rpg-zzu/node_modules/playwright');
const path = require('path');
const fs = require('fs');
(async () => {
 const profile = path.join(__dirname,'browser-profile');
 const context = await chromium.launchPersistentContext(profile, {
  executablePath:'/home/main/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell', headless:true, viewport:{width:1050,height:950},
  args:['--no-sandbox','--disable-dev-shm-usage','--disable-crash-reporter','--no-zygote','--single-process'],
 });
 const page=await context.newPage();
 await page.goto('file://'+path.join(__dirname,'preview.html'));
 await page.waitForFunction(()=>Array.from(document.images).every(im=>im.complete&&im.naturalWidth>0));
 const started=Date.now();
 for(const t of [0,130,310,480,680,940,1240,1580]){
  const left=t-(Date.now()-started);if(left>0)await page.waitForTimeout(left);
  await page.locator('#motions').screenshot({path:path.join(__dirname,'previews',`gif-playback-${t}.png`)});
 }
 await context.close();
 fs.rmSync(profile,{recursive:true,force:true});
 console.log('Opened all eight GIFs in Chromium and saved eight playback moments.');
})().catch(e=>{console.error(e.message);process.exitCode=1});
