import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {chromium} from 'playwright';
import {ROOT,openStore,list,stateFor,packageFor,ROLES} from './store.mjs';
const args=process.argv.slice(2);assert(args.length===2&&args[0]==='--out','--out /absolute/evidence required');const out=path.resolve(args[1]);fs.mkdirSync(out,{recursive:true});
const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'harness-data/pokemon-character-casting/templates/full-cast-v1/queued.json'))),store=openStore(),before=store.db.prepare('SELECT * FROM decisions ORDER BY seq').all();
const checks=[];function check(name,ok){checks.push({name,pass:!!ok});assert(ok,name);}
let browser;
try {
check('all sixteen requested roles present exactly once',manifest.items.length===16&&new Set(manifest.items.map(i=>i.role)).size===16&&ROLES.every(r=>manifest.items.some(i=>i.role===r)));
check('sixteen distinct templates',new Set(manifest.items.map(i=>i.template)).size===16);
for(const item of manifest.items){const p=packageFor(store,item.id);check(item.role+' current native/GIF/replay evidence valid',p.pack.structural.pass&&p.pack.media.sourcePixelsExact&&p.pack.media.templateId===item.template);}
for(const id of ['../outside','hero/../../secret','hero%2foutside']){let rejected=false;try{packageFor(store,id);}catch{rejected=true;}check('unsafe candidate id rejected '+id,rejected);}
browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
await page.goto('http://mdc-server:18316/?wave=full-cast-v1');await page.waitForSelector('#overview button');
check('wave link shows exactly sixteen candidates',await page.locator('#overview button').count()===16&&await page.locator('.pick').count()===16);
check('wave filter retains all sixteen role options',await page.locator('#role option').count()===17);
await page.waitForFunction(()=>[...document.querySelectorAll('#overview canvas.color')].every(c=>c.getContext('2d').getImageData(0,0,16,32).data.some((v,i)=>i%4===3&&v)));
await page.screenshot({path:out+'/wave-1100.png',fullPage:true});
for(const item of manifest.items){
 await page.locator('#overview button[data-id="'+item.id+'"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('#detail img')].every(i=>i.complete&&i.naturalWidth>0));
 check(item.role+' comparison and walk GIF load',await page.locator('.template-triptych img').count()===3&&await page.locator('.gif').first().evaluate(i=>i.naturalWidth===68&&i.naturalHeight===32));
 check(item.role+' five observations and disabled Allow',await page.locator('.checks input').count()===5&&await page.locator('#allow').isDisabled());
 await page.locator('#phase').fill('2');check(item.role+' manual opposite step visible',await page.locator('#paused-large').isVisible());
 if(item.role.includes('_')){const download=await page.request.get('http://mdc-server:18316/download/'+item.id+'.zip');check(item.role+' underscore id is routed and pending download blocked',download.status()===409);}
}
await page.reload();await page.waitForSelector('.template-review');check('selected character and wave survive reload',new URL(page.url()).searchParams.get('wave')==='full-cast-v1'&&await page.locator('#overview button').count()===16&&await page.locator('#detail h2').innerText().then(t=>t.includes('산호')));
await page.locator('#role').selectOption('nurse');check('role filter yields nurse only',await page.locator('.pick').count()===1&&await page.locator('#detail h2').innerText().then(t=>t.includes('간호사')));await page.locator('#role').selectOption('all');
await page.locator('#wave').selectOption('all');await page.waitForFunction(()=>document.querySelectorAll('#overview button').length>16);check('old review choices remain accessible',await page.locator('#overview button').count()>16);
await page.locator('#wave').selectOption('full-cast-v1');await page.waitForFunction(()=>document.querySelectorAll('#overview button').length===16);
await page.setViewportSize({width:320,height:900});await page.screenshot({path:out+'/wave-320.png',fullPage:true});check('mobile wave overview has no horizontal overflow',await page.evaluate(()=>innerWidth===document.documentElement.scrollWidth));
check('no browser/resource errors',errors.length===0);
check('no existing human decisions changed or appended',JSON.stringify(store.db.prepare('SELECT * FROM decisions ORDER BY seq').all())===JSON.stringify(before));
const states=manifest.items.map(i=>({role:i.role,id:i.id,state:stateFor(store,i.id).state}));check('no stale or withdrawn wave packages',states.every(i=>!['stale','withdrawn'].includes(i.state)));
fs.writeFileSync(out+'/browser-checks.json',JSON.stringify({pass:true,checks,states,productionVotesWritten:0,productionDecisionCount:before.length,errors},null,2)+'\n');console.log(JSON.stringify({pass:true,checks:checks.length,productionVotesWritten:0}));
}finally{if(browser)await browser.close();store.db.close();}
