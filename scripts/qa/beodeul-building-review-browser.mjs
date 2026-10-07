// Focused art admission/UI QA. All decisions and corruptions use a physical copy.
import { firefox } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const dir='verify-shots/beodeul-building-review', data=path.resolve('output/beodeul-building-review/qa-data');
const prod=process.env.BEODEUL_BUILDING_REVIEW_DATA||path.join(process.env.HOME,'.local/share/oprn/beodeul-building-review');
assert.notEqual(data,path.resolve(prod));fs.mkdirSync(path.dirname(data),{recursive:true});
const setup=spawnSync('python3',['-c',`import shutil,sqlite3,pathlib
source=pathlib.Path(${JSON.stringify(prod)});target=pathlib.Path(${JSON.stringify(data)})
if target.exists():shutil.rmtree(target)
shutil.copytree(source,target,ignore=shutil.ignore_patterns('review.sqlite*','vision-work'))
with sqlite3.connect(source/'review.sqlite') as s,sqlite3.connect(target/'review.sqlite') as d:s.backup(d)
with sqlite3.connect(target/'review.sqlite') as d:d.execute('delete from decisions');d.execute('delete from candidates');d.commit()
`],{encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);
const queue='src/harnesses/beodeul-building-review/node/queue.py',env={...process.env,BEODEUL_BUILDING_REVIEW_DATA:data};
const server=spawn('python3',[queue,'serve','--host','127.0.0.1','--port','18318'],{env,stdio:'ignore'});
const isolated='http://127.0.0.1:18318',live='http://127.0.0.1:18317';
const browser=await firefox.launch({headless:true});
try{
 for(let n=0;n<40;n++){try{if((await fetch(isolated+'/api/state')).ok)break}catch{}await new Promise(r=>setTimeout(r,250));}
 const context=await browser.newContext({viewport:{width:1380,height:980}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const actual=await(await fetch(live+'/api/state')).json();assert.equal(actual.items.length,10);assert(actual.items.every(i=>i.qaPassed));
 const item=actual.items[0],receipt=path.join(data,'gate-receipts',item.id,item.sha+'.json'),backup=fs.readFileSync(receipt);
 await page.goto(isolated);await page.locator('#loading').waitFor({state:'visible'});assert.equal((await(await fetch(isolated+'/api/state')).json()).items.length,0);
 assert.equal((await fetch(isolated+item.image)).status,404);assert.equal((await fetch(isolated+'/images/building-01/old.png')).status,404);
 fs.unlinkSync(receipt);let result=spawnSync('python3',[queue,'publish'],{env,encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/PUBLICATION_BLOCKED/);
 fs.writeFileSync(receipt,backup);result=spawnSync('python3',[queue,'publish'],{env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 // The empty page must update by polling without navigation/reload.
 await page.locator('#review').waitFor({state:'visible',timeout:15000});await page.locator('#note').fill('모의 검수: 지붕 연결 수정');
 await page.locator('#allow').click();await page.waitForFunction(()=>document.querySelector('#position').textContent.startsWith('02'));
 await page.reload();await page.locator('#review').waitFor({state:'visible'});
 let state=await (await page.request.get(isolated+'/api/state')).json();assert.equal(state.items[0].decision,'allow');assert.equal(state.items[0].note,'모의 검수: 지붕 연결 수정');
 await page.locator('#deny').click();await page.waitForFunction(()=>document.querySelector('#position').textContent.startsWith('03'));
 await page.reload();await page.locator('#review').waitFor({state:'visible'});state=await(await page.request.get(isolated+'/api/state')).json();assert.equal(state.items[1].decision,'deny');
 await page.locator('#list .card').nth(0).click();await page.locator('#reset').click();await page.waitForFunction(()=>document.querySelector('#decision').textContent==='미선택');state=await(await page.request.get(isolated+'/api/state')).json();assert.equal(state.items[0].decision,'pending');
 await page.locator('#allow').click();await page.waitForFunction(()=>document.querySelector('#position').textContent.startsWith('02'));
 const pack=await page.request.get(isolated+'/api/export');assert.equal(pack.status(),200);fs.writeFileSync('output/beodeul-building-review/qa-allowed.zip',await pack.body());
 const z=spawnSync('python3',['-c',"import zipfile,json; z=zipfile.ZipFile('output/beodeul-building-review/qa-allowed.zip'); d=json.loads(z.read('manifest.json')); assert len(d['candidates'])==1 and d['candidates'][0]['id']=='r2-building-01'; assert not any('r2-building-02' in n for n in z.namelist())"],{encoding:'utf8'});assert.equal(z.status,0,z.stderr);
 state=await(await page.request.get(isolated+'/api/state')).json();const stale=await page.request.post(isolated+'/api/decision',{headers:{'X-Review-Token':state.token},data:{id:item.id,sha:'stale',decision:'deny',note:''}});assert.equal(stale.status(),409);
 const denied=await page.request.post(isolated+'/api/decision',{data:{id:item.id,sha:item.sha,decision:'deny'}});assert.equal(denied.status(),403);
 const imagePath=path.join(data,'items',item.id,item.sha+'.png'),original=fs.readFileSync(imagePath);fs.writeFileSync(imagePath,Buffer.concat([original,Buffer.from('corrupted')]));
 assert.equal((await(await fetch(isolated+'/api/state')).json()).items.length,9);assert.equal((await fetch(isolated+item.image)).status,404);
 const changed=await page.request.post(isolated+'/api/decision',{headers:{'X-Review-Token':state.token},data:{id:item.id,sha:item.sha,decision:'allow',note:''}});assert.equal(changed.status(),409);
 assert.equal((await fetch(isolated+'/api/export')).status,409);const staged=path.join(data,'staging',item.id,item.sha+'.png'),stagedOriginal=fs.readFileSync(staged);fs.writeFileSync(staged,Buffer.concat([stagedOriginal,Buffer.from('corrupted')]));result=spawnSync('python3',[queue,'publish'],{env,encoding:'utf8'});assert.notEqual(result.status,0);
 fs.writeFileSync(staged,stagedOriginal);fs.writeFileSync(imagePath,original);
 for(const suffix of ['-scene.png','.pixels.json']){const asset=path.join(data,'items',item.id,item.sha+suffix),raw=fs.readFileSync(asset);fs.writeFileSync(asset,Buffer.concat([raw,Buffer.from('corrupted')]));assert.equal((await(await fetch(isolated+'/api/state')).json()).items.length,9);fs.writeFileSync(asset,raw);}
 fs.writeFileSync(receipt,JSON.stringify({...JSON.parse(backup),signature:'tampered'}));assert.equal((await(await fetch(isolated+'/api/state')).json()).items.length,9);fs.writeFileSync(receipt,backup);
 const invalid=JSON.parse(backup);invalid.recipe='obsolete';fs.writeFileSync(receipt,JSON.stringify(invalid));assert.equal((await(await fetch(isolated+'/api/state')).json()).items.length,9);fs.writeFileSync(receipt,backup);
 await page.goto(live);await page.locator('#review').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#canvas').width>0);await page.screenshot({path:dir+'/review-screen.png',fullPage:true});
 const spriteWidth=await page.locator('#canvas').evaluate(c=>c.width);await page.locator('[data-mode=scene]').click();await page.waitForFunction(w=>document.querySelector('#canvas').width>w,spriteWidth);await page.screenshot({path:dir+'/review-context.png',fullPage:true});
 await page.locator('[data-zoom="2"]').click();await page.locator('#grid').check();await page.locator('#list .card').nth(4).click();await page.waitForFunction(()=>document.querySelector('#title').textContent.includes('대장간'));
 await page.setViewportSize({width:760,height:1000});await page.screenshot({path:dir+'/review-mobile.png',fullPage:true});
 const final=await(await page.request.get(live+'/api/state')).json();assert.equal(final.items.length,10);assert(final.items.every(i=>i.qaPassed));assert.equal(errors.length,0,errors.join('\n'));
 const proof={isolatedOnly:true,draftsInvisible:true,missingReceiptBlocksPublication:true,pollingRevealsPassedCandidates:true,corruptPngBlocksStateImageDecisionExportAndPublish:true,tamperedReceiptBlocksState:true,corruptSceneAndPixelGridBlockState:true,allowPersistedAfterReload:true,denyPersistedAfterReload:true,undoPersisted:true,exportOnlyAllowed:true,staleHashRejected:true,missingTokenRejected:true,actualQueue:final.counts,pageErrors:errors};
 fs.writeFileSync(dir+'/browser-proof.json',JSON.stringify(proof,null,2));console.log(proof);
}finally{await browser.close();server.kill('SIGTERM')}
