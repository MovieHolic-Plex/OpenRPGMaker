// Actual shipped-player path, consuming the documents reloaded from Supabase.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {startPlayerQaServer} from '../lib/runtimeQaRun.mjs';
import {spawnSync} from 'node:child_process';
const out='verify-shots/opening-examples';
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--autoplay-policy=no-user-gesture-required']});
const records=[];
try {
 for(const theme of ['winter','ocean']){
  const json=await readFile(out+'/'+theme+'.json','utf8');
  const project=JSON.parse(json);
  const dir=out+'/'+theme+'-frames';await mkdir(dir,{recursive:true});
  const context=await browser.newContext({viewport:{width:960,height:540},deviceScaleFactor:1,recordVideo:{dir:out+'/'+theme+'-video',size:{width:960,height:540}}});
  const page=await context.newPage();
  const errors=[];const loaded=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/assets/stills/pack/'))loaded.push({path:new URL(r.url()).pathname,status:r.status()});});
  await page.addInitScript(()=>{window.__OPENRPG_BOOT__={projectUrl:'/__opening-example.json',saveNamespace:'opening-proof',qaInstrumentation:true};});
  await page.route('**/__opening-example.json',r=>r.fulfill({status:200,contentType:'application/json',body:json}));
  await page.goto(server.url+'/player.html',{waitUntil:'domcontentloaded'});
  await page.getByTestId('title-screen').waitFor({timeout:120000});
  // Exercise the attribution button through the real runtime pointer handler.
  await page.getByTestId('title-license-notice').click();
  await page.locator('dialog.rm-license-dialog').waitFor();
  assert.match(await page.locator('.rm-license-dialog-body').innerText(),/Opening mood stills/);
  await page.getByRole('button',{name:'닫기',exact:true}).click();
  await page.keyboard.press('Enter');
  await page.getByTestId('cinematic-sequence').waitFor({timeout:20000});
  const seen=new Set();let frames=0;
  const clip=await page.locator(".play-stage").boundingBox();
  assert.ok(clip);
  const start=Date.now();
  while(Date.now()-start<26000){
   const overlay=page.getByTestId('cinematic-sequence');
   if(!await overlay.count())break;
   const scene=await overlay.getAttribute('data-scene-id');
   if(scene)seen.add(scene);
   await page.screenshot({path:dir+'/'+String(frames++).padStart(4,'0')+'.png',clip});
   await page.waitForTimeout(100);
  }
  const captureDuration=Date.now()-start;
  await page.getByTestId('runtime-state-json').waitFor({timeout:60000});
  assert.equal(seen.size,5,'All four pictures and title must be shown');
  for(let i=1;i<=4;i++)assert.ok(loaded.some(r=>r.path.endsWith(theme+'-0'+i+'.jpg')&&r.status===200),'Missing image '+i);
  assert.deepEqual(errors,[]);
  const poster=out+'/'+theme+'.png';
  // A representative in-sequence screenshot is kept beside the GIF.
  const files=await import('node:fs/promises');await files.copyFile(dir+'/0010.png',poster);
  const video=page.video();await context.close();
  const videoPath=await video.path();
  // Encode the screenshot sequence at its measured capture rate, preserving actual ordering.
  const duration=captureDuration;
  const fps=frames/Math.min(duration/1000,26);
  const gif=out+'/'+theme+'.gif';
  const encode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-framerate',String(fps),'-i',dir+'/%04d.png','-vf','fps=8,scale=768:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer','-loop','0',gif],{encoding:'utf8'});
  assert.equal(encode.status,0,encode.stderr);
  records.push({theme,title:project.meta.title,scenes:[...seen],frames,loaded,errors,gif,videoPath});
  console.log('GIF_READY',gif);
 }
 await writeFile(out+'/SUMMARY.md','# Opening playback proof\n\nBoth remotely reloaded projects played four pack images and the title card, then entered the map. Attribution opened and closed through the real player. No page errors.\n\nImmediate inspection: winter.png, ocean.png, winter.gif, ocean.gif.\n');
 await writeFile(out+'/playback.json',JSON.stringify(records,null,2)+'\n');
}finally{await browser.close();await server.close();}
