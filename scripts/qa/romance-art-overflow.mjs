// Explicit UI stress fixture, not canonical game content or AI generation evidence.
import fs from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {startPackagedPlayerQaServer} from '../lib/packagedPlayerQaServer.mjs';
import {runRuntimeQa,performObservedAction} from '../lib/runtimeQaRun.mjs';
const [input,packageDir,out]=process.argv.slice(2);
const p=JSON.parse(fs.readFileSync(input));
p.system.opening={...p.system.opening,enabled:false};p.startPos={x:11,y:8};
const npc=p.maps[p.startMapId].events.find(e=>e.id==='ev_romance_partner');
npc.pages=[{...npc.pages[0],commands:[
 {kind:'text',speaker:'나래',body:'짧은 대화창에서도 긴 이야기는 다음 페이지로 이어져야 해요. '.repeat(15)},
 {kind:'choices',prompt:'오래 생각한 답을 골라 주세요.',options:[
  {text:'반갑게 인사를 건넨 뒤 이 마을에서 함께 살아가는 이웃으로서 앞으로도 편하게 이야기를 나누고 싶다고 말한다.',branch:[{kind:'text',body:'첫 번째 긴 선택이 실행되었습니다.'}]},
  {text:'편지를 부치기까지 망설였던 마음을 조심스럽게 물어보며 이야기하고 싶을 때 언제든 기다리겠다고 말한다.',branch:[{kind:'text',body:'두 번째 긴 선택이 실행되었습니다.'}]},
 ]},
]}];
fs.mkdirSync(out,{recursive:true});const fixture=resolve(out,'stress-fixture.json');fs.writeFileSync(fixture,JSON.stringify(p));
const server=await startPackagedPlayerQaServer({packageDir,projectJson:JSON.stringify(p)});
const browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--use-gl=swiftshader','--js-flags=--max-old-space-size=16384']});
const proof={syntheticUiFixture:true,noStateInjection:true,cases:[]};
try{
 for(const width of [320,960]){
  const page=await browser.newPage({viewport:{width,height:width*3/4},reducedMotion:'reduce'});
  const boot=await runRuntimeQa(page,{id:'compact-dialogue-'+width,projectFixture:fixture,viewport:{width,height:width*3/4},beats:[{id:'field',ops:[{kind:'key',key:'Enter'},{kind:'waitFor',testid:'title-screen',state:'absent'},{kind:'waitForRuntime'}],expect:{mapId:p.startMapId}}]},{serverUrl:server.url,projectUrl:server.url+'/__runtime-qa/project.json',outDir:resolve(out,String(width))});
  assert(!boot.errors.length&&!boot.beats.some(b=>b.failures.length),JSON.stringify(boot));
  await page.evaluate(()=>window.__oprnInput.face('right'));
  const pending=performObservedAction(page,()=>page.evaluate(()=>window.__oprnInput.action()),90000);
  await page.getByTestId('dialogue-box').waitFor();
  let advances=0;
  for(;advances<90&&!await page.getByTestId('runtime-choices').count();advances++){await page.keyboard.press('Enter');await page.waitForTimeout(90);}
  await page.getByTestId('runtime-choices').waitFor();assert(advances>2,'Long text did not paginate');
  await page.keyboard.press('ArrowDown');
  const geometry=await page.getByTestId('runtime-choices').evaluate(list=>{const b=list.querySelector('.choice-btn.selected'),r=b.getBoundingClientRect(),l=list.getBoundingClientRect();return {scrollTop:list.scrollTop,selectedText:b.textContent,itemHeight:r.height,listHeight:l.height,visible:r.top>=l.top-1&&r.bottom<=l.bottom+1,pageOverflow:document.documentElement.scrollWidth>innerWidth};});
  assert(geometry.scrollTop>0&&geometry.visible&&!geometry.pageOverflow,JSON.stringify(geometry));
  await page.screenshot({path:resolve(out,'long-choices-'+width+'.png')});
  await page.keyboard.press('Enter');await page.getByTestId('runtime-choices').waitFor({state:'detached'});
  for(let i=0;i<12&&await page.getByTestId('dialogue-box').count();i++){await page.keyboard.press('Enter');await page.waitForTimeout(90);}
  await pending;proof.cases.push({width,advances,geometry,choiceExecuted:true});await page.close();
 }
 proof.ok=true;
}finally{fs.writeFileSync(resolve(out,'proof.json'),JSON.stringify(proof,null,2));fs.rmSync(fixture,{force:true});await browser.close();await server.close();}
console.log(proof);
