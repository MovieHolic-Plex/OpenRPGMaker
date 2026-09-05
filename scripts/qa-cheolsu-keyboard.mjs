import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {startPlayerQaServer,runRuntimeQa} from './lib/runtimeQaRun.mjs';
const fixture=process.argv[2]||'.omo/evidence/cheolsu-memory/project.json';
const variant=process.argv[3]||'fixed';
const id=`cheolsu-keyboard-${variant}`,out=`verify-shots/runtime-qa/${id}`;
const server=await startPlayerQaServer();
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=swiftshader','--disable-gpu','--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebRTC']});
const context=await browser.newContext({recordVideo:{dir:'.omo/evidence/cheolsu-memory/videos',size:{width:1024,height:768}}});
const page=await context.newPage();const lines=[];const errors=[];let lastAdvance=0;
const read=()=>page.evaluate(()=>({state:window.__oprnDebug?.readState(),runtime:JSON.parse(document.querySelector('[data-testid="runtime-state-json"]')?.textContent||'null'),text:document.querySelector('[data-testid="dialogue-box"] .body')?.textContent||'',speaker:document.querySelector('[data-testid="dialogue-speaker"]')?.textContent||'',ready:!!document.querySelector('[data-testid="dialogue-box"].page-ready')}));
try {
 await page.route(url=>url.origin===new URL(server.url).origin&&!url.pathname.startsWith('/api/'),async r=>{try{await r.fulfill({response:await r.fetch({maxRetries:3})});}catch(e){errors.push(String(e));await r.abort().catch(()=>{});}});
 await page.routeWebSocket(url=>url.host===new URL(server.url).host,()=>{});
 const boot=await runRuntimeQa(page,{id,projectFixture:fixture,beats:[{id:'title',expect:{visibleText:{'title-screen':'철수의 기억'}},shot:true}]},{serverUrl:server.url});
 assert.deepEqual(boot.errors,[]);assert.deepEqual(boot.beats[0].failures,[]);
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());console.error(m.text());}});
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>!!window.__oprnDebug?.readState().currentMapId,null,{timeout:120000});
 async function nextLine() {
  await page.waitForFunction(()=>!!document.querySelector('[data-testid="dialogue-box"] .body')?.textContent,null,{timeout:5500});
  await page.waitForFunction(()=>!!document.querySelector('[data-testid="dialogue-box"].page-ready'),null,{timeout:6000});
  const s=await read();const gap=lastAdvance?Date.now()-lastAdvance:null;
  lines.push({speaker:s.speaker,text:s.text,mapId:s.state.currentMapId,gapMs:gap});
  console.log(JSON.stringify(lines.at(-1)));
  await page.screenshot({path:`${out}/${String(lines.length).padStart(2,'0')}-dialogue.png`});
  return s;
 }
 async function advance() {
  const previous=await read();lastAdvance=Date.now();await page.keyboard.press('Enter');
  await page.waitForFunction(text=>document.querySelector('[data-testid="dialogue-box"] .body')?.textContent!==text,previous.text,{timeout:2000});
 }
 // Read complete lines and press a single confirm, as a person does. No input/state injection.
 for(let i=0;i<2;i++){await nextLine();await advance();}
 await page.waitForFunction(()=>!document.querySelector('[data-testid="dialogue-box"]'));
 await page.keyboard.press('ArrowUp');await page.keyboard.press('Enter');
 for(let i=0;i<30;i++) {
  const s=await nextLine();
  if(s.text.includes('끝.')){await advance();break;}
  await advance();
 }
 await page.waitForFunction(()=>window.__oprnDebug.readState().switches.memory_closed===true);
 let s=await read();assert.equal(s.state.currentMapId,'memory_present');
 await page.waitForFunction(()=>!document.querySelector('[data-testid="dialogue-box"]'));
 await page.keyboard.press('Enter');
 s=await nextLine();assert(s.text.includes('빈 종이 한 장'));await advance();
 await nextLine();await advance();
 await page.waitForFunction(()=>!document.querySelector('[data-testid="dialogue-box"]'));
 await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(()=>window.__oprnDebug.readState().x!==12);
 s=await read();assert(s.state.switches.memory_seen&&s.state.switches.memory_closed);assert.equal(s.state.currentMapId,'memory_present');
 assert(lines.some(l=>l.speaker==='아버지'&&l.text.includes('함께 접었다')));
 assert.deepEqual(errors,[]);
} catch(e) {errors.push(e.message);process.exitCode=1;await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});console.error(e.message,JSON.stringify(await read()));}
finally {
 const state=await read().catch(()=>null);
 await fs.mkdir(out,{recursive:true});
 await context.close();const video=await page.video()?.path();
 await fs.writeFile(`${out}/report.json`,JSON.stringify({fixture,lines,errors,state,video,keyboardOnly:true,maxDialogueGapMs:Math.max(...lines.map(l=>l.gapMs||0))},null,2));
 await fs.writeFile(`${out}/SUMMARY.md`, `# 철수의 기억 — 일반 키보드 플레이 (${variant})\n\n결과: ${errors.length?'실패':'통과'}\n\n- 입력: 방향키와 Enter만 사용. 디버그 조작·텔레포트·이동 루트 주입 없음.\n- 대사 ${lines.length}개 확인; 대사 없는 정지 5.5초 상한, 별도로 글자 출력 완료를 기다림.\n- 영상: ${video}\n- 즉시 확인: ${errors.length?'failure.png':'12-dialogue.png, 16-dialogue.png'}\n\n${errors.join('\n')}\n`);
 await browser.close();await server.close();
}
