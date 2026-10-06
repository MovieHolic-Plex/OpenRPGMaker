// Pristine shipping BOOT; real keys/media. No debug ops, session injection or clock override.
const {chromium}=require('@playwright/test');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
const [base,out]=process.argv.slice(2);if(!base||!out)throw Error('Usage: export base / evidence dir');
(async()=>{await fs.mkdir(out,{recursive:true});const browser=await chromium.launch({args:['--no-sandbox','--use-gl=swiftshader']});const page=await browser.newPage({viewport:{width:960,height:720}}),record={scope:'Pristine shipping player, fresh storage, native Enter/WASD/Esc, passive DOM/media observations',errors:[],pages:[]};page.on('pageerror',e=>record.errors.push(String(e)));
 const key=async k=>{await page.keyboard.press(k);await page.waitForTimeout(180)};
 try{
  await page.goto(base+'/player.html');await page.getByTestId('title-screen').waitFor({timeout:90000});await key('Enter');
  const book=page.getByTestId('cinematic-sequence');await book.waitFor({timeout:90000});assert.equal(await book.getAttribute('data-presentation'),'storybook');
  await page.waitForFunction(()=>document.querySelector('.cinematic-image')?.complete&&document.querySelector('.cinematic-image')?.naturalWidth>0);
  const first=await book.getAttribute('data-scene-id');await page.screenshot({path:out+'/01-first-page.png'});await page.waitForTimeout(9000);assert.equal(await book.getAttribute('data-scene-id'),first);record.waited9000msWithoutAdvance=true;
  const music=await page.getByTestId('cinematic-music').elementHandle();assert(music);await page.waitForFunction(()=>document.querySelector('[data-testid=cinematic-music]').currentTime>0);
  const before=await music.evaluate(a=>a.currentTime);for(const k of ['w','a','s','d'])await key(k);
  record.wasd=await page.evaluate(({music,before})=>({sameElement:music===document.querySelector('[data-testid=cinematic-music]'),before,after:music.currentTime}),{music,before});assert(record.wasd.sameElement&&record.wasd.after>before);assert.equal(await book.getAttribute('data-scene-id'),first);
  const firstImage=await page.locator('.cinematic-image').elementHandle();
  record.pages.push({id:first,narration:await page.locator('.cinematic-narration').innerText(),musicTime:await music.evaluate(a=>a.currentTime)});
  await page.keyboard.down('Enter');await page.waitForTimeout(100);const second=await book.getAttribute('data-scene-id');assert.notEqual(second,first);
  await page.waitForTimeout(900);await page.keyboard.down('Enter');await page.waitForTimeout(100);assert.equal(await book.getAttribute('data-scene-id'),second);await page.keyboard.up('Enter');record.heldRepeatIgnored=true;
  let previousImage=firstImage,previousUrl=await firstImage.getAttribute('src'),previousMusicTime=record.pages[0].musicTime;
  while(await book.count()){
   const narration=await page.locator('.cinematic-narration').innerText(),id=await book.getAttribute('data-scene-id');assert(narration.length>0);
   const img=await page.locator('.cinematic-image').elementHandle();const url=await img.getAttribute('src');
   await page.waitForFunction(()=>document.querySelector('.cinematic-image').complete&&document.querySelector('.cinematic-image').naturalWidth>0);
   const currentMusic=await page.getByTestId('cinematic-music').evaluate(a=>a.currentTime);
   const sameImage=previousUrl===url?await page.evaluate(old=>old===document.querySelector('.cinematic-image'),previousImage):undefined;
   if(sameImage!==undefined)assert(sameImage);assert(currentMusic>=previousMusicTime);previousMusicTime=currentMusic;
   const animations=await img.evaluate(e=>e.getAnimations().map(a=>a.playState));assert.equal(animations.length,0);
   record.pages.push({id,narration,sameImage,animations,musicTime:currentMusic});await page.screenshot({path:out+`/page-${record.pages.length}.png`});
   previousImage=img;previousUrl=url;await key('Enter');if(record.pages.length>8)throw Error('Unexpected extra pages');
  }
  assert.equal(record.pages.length,8);await page.getByTestId('dialogue-box').waitFor({timeout:90000});for(let i=0;i<24&&await page.getByTestId('dialogue-box').count();i++)await key('Enter');
  assert.equal(await page.getByTestId('cinematic-music').count(),0);await page.screenshot({path:out+'/09-native-handoff.png'});assert.equal(record.errors.length,0);record.completed=true;
 }catch(e){record.failure=String(e);await page.screenshot({path:out+'/failure.png'});throw e}finally{await fs.writeFile(out+'/native-opening.json',JSON.stringify(record,null,2));await browser.close()}console.log(JSON.stringify({completed:record.completed,pages:record.pages.length,waited9000msWithoutAdvance:record.waited9000msWithoutAdvance,wasd:record.wasd}));})().catch(e=>{console.error(e);process.exitCode=1});
