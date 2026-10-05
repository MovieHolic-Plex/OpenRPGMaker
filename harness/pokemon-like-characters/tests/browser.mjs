// Browser mutations use ONLY a temporary QA copy of the supplied store.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {serve} from '../lib/server.mjs';import {DEFAULT_DATA} from '../lib/store.mjs';
const args=process.argv.slice(2),flags={};for(let i=0;i<args.length;i+=2){assert(['--data','--out'].includes(args[i])&&args[i+1]);flags[args[i].slice(2)]=args[i+1];}
const original=path.resolve(flags.data??DEFAULT_DATA),out=path.resolve(flags.out??'.data/browser-verification');fs.mkdirSync(out,{recursive:true});
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'character-browser-')),data=path.join(temp,'store'),checks=[];let browser,server;
function check(name,ok){checks.push({name,pass:!!ok});assert(ok,name);}
try{
 // Backup via SQLite instead of copying a possibly active WAL database.
 const {DatabaseSync}=await import('node:sqlite');fs.mkdirSync(data,{recursive:true});const db=new DatabaseSync(path.join(original,'casting.sqlite'),{readOnly:true});db.prepare('VACUUM INTO ?').run(path.join(data,'casting.sqlite'));db.close();
 for(const dir of ['candidates','waves','receipts'])if(fs.existsSync(path.join(original,dir)))fs.cpSync(path.join(original,dir),path.join(data,dir),{recursive:true});
 server=await serve({data,host:'127.0.0.1',port:0});const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
 await page.goto(base+'/?wave=full-cast-v1');await page.waitForSelector('#overview button');
 check('portable collection displays 16 roles',await page.locator('#overview button').count()===16);
 const items=(await (await page.request.get(base+'/api/candidates')).json()).items;
 for(const item of items){
  await page.locator('#overview button[data-id="'+item.id+'"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('#detail img')].every(i=>i.complete&&i.naturalWidth>0));
  check(item.role+' source/edit/change images and GIF load',await page.locator('.template-triptych img').count()===3&&await page.locator('.gif').first().evaluate(i=>i.naturalWidth===68&&i.naturalHeight===32));
  check(item.role+' requires five observations',await page.locator('.checks input').count()===5&&await page.locator('#allow').isDisabled());
  await page.locator('#phase').fill('2');check(item.role+' opposite step preview',await page.locator('#paused-large').isVisible());
 }
 await page.locator('#role').selectOption('explorer');check('role filter selects explorer',await page.locator('.pick').count()===1);
 await page.locator('#role').selectOption('all');await page.screenshot({path:path.join(out,'desktop.png'),fullPage:true});
 // Synthetic Allow through actual UI; no writes to original store.
 for(const cb of await page.locator('.checks input').all())await cb.check();
 check('Allow enabled after observations',await page.locator('#allow').isEnabled());
 await page.locator('#note').fill('SYNTHETIC QA in disposable copy — not human art approval');
 await page.locator('#allow').click();await page.waitForSelector('#download');check('browser Allow enables export',await page.locator('#download').count()===1);
 await page.reload();await page.waitForSelector('#download');check('browser approval survives reload',await page.locator('#download').count()===1);
 const downloaded=await page.request.get(new URL(await page.locator('#download').getAttribute('href'),base).href);check('browser approved ZIP contains output',downloaded.ok()&&(await downloaded.body()).length>1000);
 await page.locator('#note').fill('SYNTHETIC QA denial in disposable copy');await page.locator('#deny').click();await page.waitForFunction(()=>document.querySelector('#detail .badge')?.textContent==='Deny');check('Deny revokes download',await page.locator('#download').count()===0);
 await page.setViewportSize({width:320,height:900});await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});check('320px no horizontal overflow',await page.evaluate(()=>innerWidth===document.documentElement.scrollWidth));
 check('zero browser/resource errors',errors.length===0);
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({pass:true,checks,errors,syntheticDecisionsOnly:true,liveStoreWrites:0},null,2)+'\n');console.log(JSON.stringify({pass:true,checks:checks.length,out}));
}catch(e){fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({pass:false,checks,error:e.stack},null,2)+'\n');throw e;}
finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});}
