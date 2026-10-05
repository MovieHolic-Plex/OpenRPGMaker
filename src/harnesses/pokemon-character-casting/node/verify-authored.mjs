import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../../../..');
const {chromium}=await import('playwright');
const {openStore,DEFAULT_DATA,list,activateWave,stateFor}=await import(root+'/src/harnesses/pokemon-character-casting/node/store.mjs');
const args=process.argv.slice(2);assert(args.length===2&&args[0]==='--out','--out /absolute/evidence required');const out=path.resolve(args[1]);fs.mkdirSync(out,{recursive:true});const id='explorer-1c9395185ff2b26e';const checks=[];
function check(name,value){checks.push({name,pass:!!value});assert(value,name);}
const store=openStore();const before=store.db.prepare('SELECT count(*) n FROM decisions').get().n;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'naru-preservation-'));const fixture=openStore(dir);
for(const r of store.db.prepare('SELECT * FROM candidates').all()){fs.cpSync(path.join(DEFAULT_DATA,'candidates',r.id),path.join(dir,'candidates',r.id),{recursive:true});fixture.db.prepare('INSERT INTO candidates VALUES(?,?,?,?)').run(r.id,r.role,r.package_sha,r.created_at);}
for(const r of store.db.prepare('SELECT * FROM candidate_lifecycle').all())fixture.db.prepare('INSERT INTO candidate_lifecycle VALUES(?,?,?,?)').run(r.candidate_id,r.withdrawn,r.reason,r.at);
const originals=list(fixture).filter(i=>i.collection==='distinct-v2').map(i=>i.id);
activateWave(fixture,originals,'fixture producer withdrawal',{replaceCollections:[null]});
check('repreparing reference collection preserves new authored candidate',stateFor(fixture,id).state==='pending');
check('reference preparation keeps old variants withdrawn',list(fixture).filter(i=>i.state==='withdrawn').length===6);
check('producer activation records no user decisions',fixture.db.prepare('SELECT count(*) n FROM decisions').get().n===0);fixture.db.close();
const browser=await chromium.launch({args:['--no-sandbox']});
try {
const page=await browser.newPage({viewport:{width:1100,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));
await page.goto('http://mdc-server:18316/?candidate='+id);await page.waitForSelector('#detail h2');
check('direct link selects Naru',await page.locator('#detail h2').innerText().then(t=>t.includes('나루')));
check('seven current candidates displayed',await page.locator('#overview button').count()===7);
await page.waitForFunction(()=>[...document.querySelectorAll('#detail img')].every(i=>i.complete&&i.naturalWidth>0));
check('actual GIF dimensions are native',await page.locator('.gif').first().evaluate(i=>i.naturalWidth===68&&i.naturalHeight===32));
check('authored provenance visible',await page.locator('#detail').innerText().then(t=>t.includes('픽셀 행을 직접 작성')));
check('five review observations retained',await page.locator('.checks input').count()===5);
check('Allow disabled without human review',await page.locator('#allow').isDisabled());
for(const n of [0,1,2,3]){await page.locator('#phase').fill(String(n));check('phase '+n+' displays current atlas frame',await page.locator('#paused-large').isVisible());}
await page.locator('#pause').click();await page.screenshot({path:out+'/review-1100.png',fullPage:true});
await page.reload();await page.waitForSelector('#detail h2');check('reload preserves selected candidate',await page.locator('#detail h2').innerText().then(t=>t.includes('나루')));
const download=await page.request.get('http://mdc-server:18316/download/'+id+'.zip');check('unapproved download blocked',download.status()===409);
await page.setViewportSize({width:320,height:900});await page.screenshot({path:out+'/review-320.png',fullPage:true});
check('mobile page does not overflow',await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth));
check('no browser or resource errors',errors.length===0);
check('production decisions untouched',store.db.prepare('SELECT count(*) n FROM decisions').get().n===before);
check('new candidate still pending after readback',stateFor(store,id).state==='pending');
fs.writeFileSync(out+'/browser-record.json',JSON.stringify({candidateId:id,pass:true,checks,productionDecisionsBefore:before,productionDecisionsAfter:before,productionVotesWritten:0},null,2)+'\n');
console.log(JSON.stringify({pass:true,checks:checks.length,candidateId:id,productionVotesWritten:0}));
}finally{await browser.close();store.db.close();}
