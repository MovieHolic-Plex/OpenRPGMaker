import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { firefox } from 'playwright';
import { startHost, newEditor, stored } from './editorDriver.mjs';

// Fault-injected UI controls. Never counted as real assistant trials.
export async function checkErrorUi(root) {
  const dir=resolve(root,'map-rename'),projectDir=resolve(dir,'project');
  if(!existsSync(resolve(dir,'fixture.json')))throw Error('별도 controls 폴더에 prepare --case map-rename 먼저 실행');
  const host=await startHost(projectDir,dir);let browser,context;
  const checks=[],record=(id,ok,detail)=>checks.push({id,ok,detail});
  try {
    for(const changed of [false,true]) {
      browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
      const editor=await newEditor(browser,host.url,projectDir,{piApply:'yolo'});
      const page=editor.page;context=editor.context;
      await page.getByTestId('toolbar-save').click();
      await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind),null,{timeout:120000});
      const before=stored(projectDir),incoming=structuredClone(before.project);
      if(changed)incoming.maps.map_ember_village.name='오류 뒤 반영 확인';
      const unchangedKeys=['tilesets','database','assets'];
      for(const key of unchangedKeys)delete incoming[key];
      let nativeRequests=0,unexpectedModelRequests=0;
      await page.route('**/v1/chat/completions**',route=>{unexpectedModelRequests++;return route.abort();});
      await page.route('**/v1/agent/run**',async route=>{
        nativeRequests++;
        const events=[
          {type:'start',mode:'single',mapIds:['map_ember_village']},
          {type:'assistant',text:'답변이 중간에서'},
          {type:'error',message:'Generation failed with finish reason: PROHIBITED_CONTENT'},
          {type:'done',project:incoming,unchangedKeys,changedKeys:changed?['maps.map_ember_village']:[],stats:{turns:1,toolCalls:0,toolErrors:0,durationMs:1}},
        ];
        await route.fulfill({status:200,contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
      });
      await page.getByTestId('ai-input').fill('/pi map_ember_village '+(changed?'현재 맵 이름만 오류 뒤 반영 확인으로 바꿔줘.':'현재 맵을 읽기만 하고 요약해줘. 수정하지 마.'));
      await page.getByTestId('ai-send').click();
      await page.waitForFunction(()=>window.__capEvents.some(e=>e.type==='stream_closed')&&!window.__oprnAiBridge.status().turnBusy,null,{timeout:120000});
      await page.getByTestId('toolbar-save').click();
      await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind),null,{timeout:120000});
      const outcome=page.getByTestId('ai-run-outcome').last();
      const execution=await outcome.getAttribute('data-execution'),delivery=await outcome.getAttribute('data-delivery');
      const text=await page.locator('body').innerText(),after=stored(projectDir);
      record(`${changed}:controlled-route`,nativeRequests===1&&unexpectedModelRequests===0,{nativeRequests,unexpectedModelRequests});
      record(`${changed}:execution-failed`,execution==='failed',{execution,delivery});
      record(`${changed}:applied-fact`,after.project.maps.map_ember_village.name===(changed?'오류 뒤 반영 확인':before.project.maps.map_ember_village.name));
      record(`${changed}:delivery-fact`,changed?delivery==='applied':delivery==='no-change',delivery);
      record(`${changed}:visible-error`,text.includes(changed?'이미 반영한 변경은 남아':'작업 중 일부 문제가 있었어요'));
      record(`${changed}:no-success-status`,!text.includes('적용 완료'));
      await page.screenshot({path:resolve(root,`error-${changed?'applied':'unchanged'}.png`)});
      writeFileSync(resolve(root,'error-controls-partial.json'),JSON.stringify({kind:'fault-injected-ui-controls',modelCalls:0,checks},null,2));
      await context.close();context=null;
      await browser.close();browser=null;
    }
  }finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host.close();}
  const result={schemaVersion:1,kind:'fault-injected-ui-controls',modelCalls:0,pass:checks.every(c=>c.ok),checks};
  mkdirSync(root,{recursive:true});writeFileSync(resolve(root,'error-controls.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));return result.pass?0:1;
}
