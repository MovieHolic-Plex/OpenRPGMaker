// Scripted model + actual editor UI + real Pi worker. No live-model quality claim.
import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base=process.env.BASE??'http://127.0.0.1:9816';
const out=process.env.OUT??'.omo/evidence/ai-tool-exposure';
const worker=`http://127.0.0.1:${readFileSync(`${out}/worker-port.txt`,'utf8').trim()}`;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--disable-background-networking']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const requests=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  for(const key of ['oprn:editor-welcome-dismissed','oprn:standard-welcome-seen','oprn:coachmarks-basic-v1']) localStorage.setItem(key,'1');
  localStorage.setItem('oprn:editor-ui-mode','standard');
});
let currentText='';
await page.route('**/v1/chat/completions*',async route=>{
  const body=route.request().postDataJSON();
  const system=JSON.stringify(body.messages?.[0]);
  const isAudit=system.includes('requirements array')||system.includes('Extract every obligation');
  const content=isAudit?{requirements:[{text:currentText,criteria:[{kind:'functionalUnresolved',reason:'Scripted UI plumbing QA'}]}]}:
    {mode:'modify',space:'none',facility:null,targetMapId:null,useSelection:false,clarify:null,needsPlan:false,resetsContext:false,tools:['get_project_summary'],summary:currentText};
  await route.fulfill({json:{choices:[{message:{role:'assistant',content:JSON.stringify(content)},finish_reason:'stop'}]}});
});
await page.route('**/v1/agent/run*',async route=>{
  const body=route.request().postDataJSON();
  requests.push({task:body.task,initialToolNames:body.initialToolNames,readOnly:body.readOnly});
  const response=await fetch(worker,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  await route.fulfill({status:200,contentType:'application/x-ndjson',body:await response.text()});
});
await page.route('**/__oprn/ai-activity',r=>r.fulfill({json:{ok:true}}));
await page.route('**/rest/v1/**',r=>r.fulfill({json:[]}));
await page.route('**/auth/**',r=>r.fulfill({json:{ok:true,connected:true,authenticated:true,authKind:'oauth'}}));
try {
  await page.goto(`${base}/?blankProject=1`,{waitUntil:'domcontentloaded'});
  const guest=page.locator('[data-testid="login-guest"]');
  await guest.or(page.locator('[data-testid="ai-input"]')).first().waitFor({state:'visible',timeout:120000});
  if(await guest.isVisible()) await guest.click();
  await page.locator('[data-testid="ai-input"]').waitFor({state:'visible',timeout:120000});
  await page.evaluate(async()=>{
    const {defaultAiConfig,saveAiConfig}=await import('/src/ai/llmClient.ts');
    saveAiConfig({...defaultAiConfig(),autonomyLevel:'balanced',piTeam:false,piApply:'review'});
  });
  await page.screenshot({path:`${out}/01-before.png`});
  for(const [index,text] of ['시작 파티를 두 명으로 바꿔줘','프로젝트 이름을 바꿔줘','빈 검색 뒤 기능을 확인해줘'].entries()) {
    currentText=text;
    const n=requests.length;
    await page.locator('[data-testid="ai-input"]').fill(text);
    const response = page.waitForResponse(r=>r.url().includes("/v1/agent/run"),{timeout:120000});
    await page.locator('[data-testid="ai-send"]').click();
    await (await response).finished();
    await page.waitForFunction(()=>window.__oprnAiBridge?.status().turnBusy===false,undefined,{timeout:120000});
    assert.ok(requests.length>n,'UI must reach Pi companion');
    const actual=requests.at(-1);
    assert.ok(actual.initialToolNames?.includes('find_tools'),'intent candidates must reach worker');
    assert.ok(actual.initialToolNames.length<80,'first request must be bounded');
    const process = page.locator('summary').filter({hasText:"작업 과정"}).last();
    if (await process.count()) await process.click();
    await page.screenshot({path:`${out}/0${index+2}-result.png`});
    const discard=page.locator('[data-testid="ai-team-discard"]:visible').last();
    if(await discard.count()&&await discard.isVisible()) await discard.click();
  }
  await page.screenshot({path:`${out}/05-complete.png`});
  writeFileSync(`${out}/browser.json`,JSON.stringify({scriptedModel:true,requests,errors},null,2));
  console.log(JSON.stringify({requests:requests.length,errors,output:out}));
} catch(error) {
  await page.screenshot({path:`${out}/failure.png`});
  writeFileSync(`${out}/failure.json`,JSON.stringify({error:String(error),requests,errors,text:(await page.locator('body').innerText()).slice(-6000)},null,2));
  throw error;
} finally {await browser.close();}
