import { chromium } from 'playwright';
import fs from 'node:fs';
const out='verify-shots/interview-scene-bank-v2';
const manifest=JSON.parse(fs.readFileSync('src/editor/interviewSceneBank.json','utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={scope:'Actual production dialog in isolated start-screen container; latest reviewed reverse-view mystery background; not full app boot or AI authoring',syntheticCatalog:false,published:Object.keys(manifest.scenes).length,generatedRequests:0,flows:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
await page.route('**/auth/status**',r=>r.fulfill({contentType:'application/json',body:'{"connected":false}'}));
await page.route('**/v1/images/generations',r=>{report.generatedRequests++;return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Native bank should not request generation"}'});});
const flows=[{genre:'mystery',choices:[['place',2],['inspect',0],['danger',2]]}];
try {
  for(const flow of flows){
    await page.goto('http://127.0.0.1:9812/start-screen.html');
    await page.evaluate(async()=>{
      document.querySelector('#start-app')?.remove();
      const host=document.createElement('div'); host.id='native-bank-proof'; host.className='start-app'; document.body.append(host);
      window.__nativeDecoded=new Set();
      const dialogSource=await (await fetch('/src/editor/ui/projectInterviewDialog.ts')).text();
      const actualBankModule=dialogSource.match(/from \"([^\"]*interviewSceneBank\.ts[^\"]*)\"/)[1];
      const {InterviewSceneCache}=await import(actualBankModule);
      const original=InterviewSceneCache.prototype.load;
      InterviewSceneCache.prototype.load=function(key){const result=original.call(this,key); result?.then(()=>window.__nativeDecoded.add(key),()=>{}); return result;};
      const {showProjectInterview}=await import('/src/editor/ui/projectInterviewDialog.ts');
      window.__nativeInterview=showProjectInterview('story-cutscene',{container:host,clickThrough:true});
    });
    await page.getByTestId('project-interview').waitFor();
    const steps=[]; let key=flow.genre;
    const click=async(testId,expected)=>{
      await page.waitForFunction(k=>window.__nativeDecoded.has(k),expected);
      const receipt=await page.getByTestId(testId).evaluate(button=>{const before=performance.now();button.click();const panel=document.querySelector('.cinematic-interview');return{key:panel.dataset.sceneKey,ms:performance.now()-before,src:panel.querySelector('.ci-backdrop img.is-visible')?.getAttribute('src')};});
      if(receipt.key!==expected||!receipt.src?.endsWith(manifest.scenes[expected].url))throw Error('Native bank click mismatch: '+JSON.stringify(receipt));
      steps.push(receipt);
    };
    await click('project-interview-genre-'+flow.genre,key);
    for(const [choice,index] of flow.choices){key+='--'+choice;await click('project-interview-option-'+index,key);}
    await page.waitForFunction(()=>document.querySelector('.ci-backdrop img.is-visible')?.complete);
    await page.screenshot({path:out+'/latest-reviewed-native-bank.png'});
    report.flows.push({genre:flow.genre,steps});
    await page.getByTestId('project-interview-cancel').click();
  }
  report.passed=report.generatedRequests===0&&report.errors.length===0;
  if(!report.passed)throw Error('Unexpected generation request or browser error');
} finally {fs.writeFileSync(out+'/latest-reviewed-click-proof.json',JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
