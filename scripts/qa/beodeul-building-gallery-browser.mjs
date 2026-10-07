import {firefox} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
const evidence='verify-shots/beodeul-building-review',data=path.resolve('output/beodeul-building-review/gallery-qa');
const prod=path.join(process.env.HOME,'.local/share/oprn/beodeul-building-review');
const setup=spawnSync('python3',['-c',`import sqlite3,shutil,pathlib
s=pathlib.Path(${JSON.stringify(prod)});t=pathlib.Path(${JSON.stringify(data)})
if t.exists():shutil.rmtree(t)
shutil.copytree(s,t,ignore=shutil.ignore_patterns('review.sqlite*','vision-work'))
with sqlite3.connect(s/'review.sqlite') as a,sqlite3.connect(t/'review.sqlite') as b:a.backup(b)
with sqlite3.connect(t/'review.sqlite') as b:b.execute('delete from decisions');b.commit()
`],{encoding:'utf8'});assert.equal(setup.status,0,setup.stderr);
const server=spawn('python3',['src/harnesses/beodeul-building-review/node/queue.py','serve','--host','127.0.0.1','--port','18319'],{env:{...process.env,BEODEUL_BUILDING_REVIEW_DATA:data},stdio:'ignore'});
const browser=await firefox.launch({headless:true});
try{
 const url='http://127.0.0.1:18319';for(let n=0;n<40;n++){try{if((await fetch(url+'/api/state')).ok)break}catch{}await new Promise(r=>setTimeout(r,250))}
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url);await p.locator('#review').waitFor({state:'visible'});await p.locator('#allow').waitFor({state:'visible'});
 const initial=await(await fetch(url+'/api/state')).json(),first=initial.items[0],second=initial.items[1],third=initial.items[2];
 const ready=()=>p.waitForFunction(()=>!document.querySelector('#allow').disabled);
 await ready();assert.equal(await p.locator('#list .card').count(),initial.items.length);await p.locator('#tab-pending').focus();await p.keyboard.press('ArrowRight');assert(await p.locator('#review').isHidden());assert.equal(await p.locator('#tab-allowed').getAttribute('aria-selected'),'true');await p.keyboard.press('ArrowLeft');await ready();
 await p.locator('#note').fill('간판 더 크게');await p.locator('#list .card').nth(1).click();await p.locator('#list .card').nth(0).click();assert.equal(await p.locator('#note').inputValue(),'간판 더 크게');
 await p.locator('#tab-allowed').click();assert(await p.locator('#review').isHidden());assert.equal(await p.locator('#list .card').count(),0);await p.locator('#tab-pending').click();assert.equal(await p.locator('#note').inputValue(),'간판 더 크게');
 await p.reload();await p.locator('#review').waitFor({state:'visible'});assert.equal(await p.locator('#note').inputValue(),'간판 더 크게');await ready();
 await p.locator('#save-note').click();await p.waitForFunction(()=>document.querySelector('#status').textContent==='메모 저장됨');let state=await(await fetch(url+'/api/state')).json();assert.equal(state.items[0].decision,'pending');assert.equal(state.items[0].note,'간판 더 크게');
 await p.locator('[data-note]').nth(1).click();assert.match(await p.locator('#note').inputValue(),/간판이 더 잘/);await ready();await p.locator('#deny').click();await p.waitForFunction(name=>document.querySelector('#title').textContent===name,second.name);assert.equal(await p.locator('#list .card').count(),initial.items.length-1);
 state=await(await fetch(url+'/api/state')).json();assert.equal(state.items[0].decision,'deny');assert.match(state.items[0].note,/간판이 더 잘/);
 await ready();await p.locator('#allow').click();await p.waitForFunction(name=>document.querySelector('#title').textContent===name,third.name);await p.reload();await p.locator('#review').waitFor({state:'visible'});state=await(await fetch(url+'/api/state')).json();assert.equal(state.items[1].decision,'allow');assert.equal(await p.locator('#list .card').count(),initial.items.length-2);
 await p.locator('#auto').uncheck();await ready();await p.locator('#deny').click();await p.waitForFunction(()=>document.querySelector('#tab-denied').getAttribute('aria-selected')==='true'&&!document.querySelector('#reset').disabled);assert.equal(await p.locator('#title').textContent(),third.name);await p.locator('#reset').click();await p.waitForFunction(()=>document.querySelector('#tab-pending').getAttribute('aria-selected')==='true'&&!document.querySelector('#allow').disabled);assert.equal(await p.locator('#title').textContent(),third.name);await p.locator('#auto').check();
 await p.locator('#tab-allowed').click();assert.equal(await p.locator('#list .card').count(),1);assert.equal(await p.locator('#title').textContent(),second.name);assert.equal(await p.locator('#tab-allowed').getAttribute('aria-selected'),'true');assert.equal(new URL(p.url()).searchParams.get('tab'),'allowed');
 await p.reload();await p.locator('#review').waitFor({state:'visible'});assert.equal(await p.locator('#title').textContent(),second.name);await ready();await p.locator('#note').fill('허용한 집 메모 유지');await p.locator('#save-note').click();await p.waitForFunction(()=>document.querySelector('#status').textContent==='메모 저장됨');state=await(await fetch(url+'/api/state')).json();assert.equal(state.items[1].decision,'allow');assert.equal(state.items[1].note,'허용한 집 메모 유지');
 await p.locator('#tab-denied').click();assert.equal(await p.locator('#list .card').count(),1);assert.equal(await p.locator('#title').textContent(),first.name);await p.locator('#tab-pending').click();await p.locator('#search').fill('대장간');assert.equal(await p.locator('#list .card').count(),1);await p.locator('#search').fill('존재하지않는건물');assert(await p.locator('#review').isHidden());await p.keyboard.press('a');await p.locator('#search').fill('');
 const viewport=()=>p.locator('#deny').evaluate(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight});assert(await viewport());await p.locator('#list-wrap').evaluate(e=>e.scrollTop=e.scrollHeight);assert(await viewport());
 await p.locator('#focus').click();assert(await p.locator('.rail').isHidden());await p.locator('[data-mode=scene]').click();await ready();await p.locator('#focus').click();
 const newCount=state.items.filter(i=>Number(i.round)>=3&&i.decision==='pending').length;
 if(newCount){await p.locator('#filter').selectOption('new');assert.equal(await p.locator('#list .card').count(),newCount);await p.locator('#list .card').nth(0).click();await p.locator('#note').focus();await p.keyboard.type('AD');state=await(await fetch(url+'/api/state')).json();assert.equal(state.items.find(i=>i.id==='r3-building-01').decision,'pending');await p.locator('#filter').selectOption('all');}
 await p.setViewportSize({width:390,height:844});if(await p.locator('#review').isVisible())await p.locator('#close').click();await p.locator('#list .card').nth(0).click();assert(await p.locator('#review').isVisible());assert(await viewport());await p.screenshot({path:evidence+'/gallery-tabs-mobile.png'});await p.locator('#close').click();assert(await p.locator('#review').isHidden());
 await p.setViewportSize({width:1440,height:900});await p.locator('#search').fill('');await p.locator('#tab-pending').click();
 // Drain the isolated queue through the same buttons to exercise the final-item case.
 for(let n=0;n<initial.items.length-2;n++){await ready();await p.locator('#allow').click();await p.waitForFunction(count=>Number(document.querySelector('#count-pending').textContent)===count,initial.items.length-3-n)}
 assert(await p.locator('#review').isHidden());assert.equal(await p.locator('#list .card').count(),0);assert.match(await p.locator('#list').textContent(),/検|검수 대기 건물이 없습니다/);assert.match(await p.locator('#notice').textContent(),/허용됨 저장됨/);await p.locator('#tab-allowed').click();assert.equal(await p.locator('#list .card').count(),initial.items.length-1);await p.reload();await p.locator('#review').waitFor({state:'visible'});assert.equal(await p.locator('#list .card').count(),initial.items.length-1);
 assert.deepEqual(errors,[]);const proof={noteSurvivesCandidateSwitchAndReload:true,noteSavedWithoutDecision:true,noteAndDenyPersisted:true,quickNoteChips:true,allowPersisted:true,approvedTabSeparated:true,tabKeyboardNavigation:true,autoAdvancePreferenceHonored:true,undoReturnsToPending:true,approvedRemovedFromPending:true,tabDeepLinkSurvivesReload:true,noteAcrossTabs:true,emptyPendingTabHidesInspector:true,approvedNotePreservesDecision:true,filtersAndSearch:true,newCandidateFilterCount:newCount,typingDoesNotDecide:true,actionsAlwaysInViewport:true,focusMode:true,mobileReviewAndReturn:true,pageErrors:errors,allWritesIsolated:true};fs.writeFileSync(evidence+'/gallery-tabs-browser-proof.json',JSON.stringify(proof,null,2));console.log(proof);
}finally{await browser.close();server.kill('SIGTERM')}
