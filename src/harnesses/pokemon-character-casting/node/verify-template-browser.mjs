import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../../../..');
const {chromium}=await import('playwright');
const {openStore,stateFor}=await import(root+'/src/harnesses/pokemon-character-casting/node/store.mjs');
const store=openStore(),before=store.db.prepare('SELECT count(*) n FROM decisions').get().n;
const args=process.argv.slice(2);assert(args.length===2&&args[0]==='--out','--out required');const id='explorer-2fe0ce80a94b963f',out=path.resolve(args[1]),checks=[];fs.mkdirSync(out,{recursive:true});
function check(name,value){checks.push({name,pass:!!value});assert(value,name);}
const browser=await chromium.launch({args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
await page.goto('http://mdc-server:18316/?candidate='+id);await page.waitForSelector('.template-review');
await page.waitForFunction(()=>[...document.querySelectorAll('#detail img')].every(i=>i.complete&&i.naturalWidth>0));
check('direct link opens template-derived Naru v2',await page.locator('#detail h2').innerText().then(t=>t.includes('나루 v2')));
check('original template, derivative and changed pixels visible',await page.locator('.template-triptych img').count()===3);
check('all comparison images retain 48x128 native atlas',await page.locator('.template-triptych img').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth===48&&i.naturalHeight===128)));
check('honest derivative provenance shown',await page.locator('#detail').innerText().then(t=>t.includes('원작을 판형으로 수정한 파생')));
check('identity observation asks about intentional edits',await page.locator('.checks').innerText().then(t=>t.includes('원작 판형과 비교해')));
check('five human review observations remain',await page.locator('.checks input').count()===5);
check('Allow disabled before observations',await page.locator('#allow').isDisabled());
for(const n of [0,1,2,3]){await page.locator('#phase').fill(String(n));check('phase '+n+' preview works',await page.locator('#paused-large').isVisible());}
await page.locator('#pause').click();await page.screenshot({path:out+'/review-1100.png',fullPage:true});
await page.setViewportSize({width:320,height:900});await page.screenshot({path:out+'/review-320.png',fullPage:true});
check('mobile no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
check('mobile comparison uses integer pixel scale',await page.locator('.template-triptych img').evaluateAll(imgs=>imgs.every(i=>i.clientWidth%i.naturalWidth===0)));
const download=await page.request.get('http://mdc-server:18316/download/'+id+'.zip');check('unapproved download blocked',download.status()===409);
check('no browser/resource errors',errors.length===0);
check('production decisions unchanged',store.db.prepare('SELECT count(*) n FROM decisions').get().n===before);
check('candidate still pending after reload',stateFor(store,id).state==='pending');
fs.writeFileSync(out+'/browser-checks.json',JSON.stringify({pass:true,candidateId:id,checks,productionDecisionsBefore:before,productionDecisionsAfter:before,productionVotesWritten:0},null,2)+'\n');console.log(JSON.stringify({pass:true,checks:checks.length,productionVotesWritten:0}));
}finally{await browser.close();store.db.close();}
