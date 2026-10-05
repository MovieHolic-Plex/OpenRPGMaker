// Observe a real native assistant turn; never replace model transport or answers.
import fs from 'node:fs';import path from 'node:path';import {chromium} from 'playwright';import {gunzipSync} from 'node:zlib';import {isDeepStrictEqual} from 'node:util';
import {startHost,newEditor,stored,writeRuntimeProject} from '../../src/harnesses/assistant-capability/node/editorDriver.mjs';
process.env.OPRN_SHARED_CONTENT_SQLITE??=path.resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/shared-catalog-snapshot.sqlite');
process.env.OPRN_SHARED_CHARACTER_GRAPHICS_FILE??=path.resolve('qa-runs/harnesses/assistant-capability/worldmap-film-20261005-03/character-catalog-snapshot.json');
const dir=path.resolve(process.argv[2]),projectDir=path.join(dir,'project');fs.mkdirSync(path.join(dir,'video'),{recursive:true});
const prompt=process.argv[3]??'지금 여행 지도에 왼쪽 초원에서 오른쪽 설원까지, (4,18)부터 (55,18)까지 한 칸 폭의 길을 만들어줘. 초원·사막·설원 바탕은 유지하고 세 강을 건널 수 있게 다리를 이어줘. 초원 북쪽에는 둥근 숲, 사막 북쪽에는 산맥, 설원 북쪽에는 눈 덮인 숲을 조금 깔고, 길 가까이에 초원 마을과 설원 마을 하나씩 놓아줘. 실제 지도에 적용하고 그림을 확인해.';
fs.writeFileSync(path.join(dir,'prompt.txt'),prompt);
const proof={prompt,nativeComposer:true,requests:[],errors:[],events:[]};const persist=()=>fs.writeFileSync(path.join(dir,'proof.json'),JSON.stringify(proof,null,2));
const host=await startHost(projectDir,dir);let browser,context,video;
async function save(page){await page.getByTestId('toolbar-save').click();await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind));}
try{
 browser=await chromium.launch({args:['--no-sandbox','--disable-dev-shm-usage']});
 let editor=await newEditor(browser,host.url,projectDir,{}, {recordVideo:{dir:path.join(dir,'video'),size:{width:1440,height:960}},onPage(page){proof.videoOrigin=Date.now();page.on('pageerror',e=>{proof.errors.push(e.message);persist();});page.on('request',r=>{if(r.method()==='POST'&&/\/v1\/agent\/run/.test(r.url())){const raw=r.postDataBuffer(),b=JSON.parse(raw?.[0]===31?gunzipSync(raw):raw);proof.requests.push({endpoint:new URL(r.url()).pathname,model:b.model,provider:r.headers()['x-oprn-provider'],runId:b.runId});persist();}});}});
 context=editor.context;let page=editor.page;video=page.video();await save(page);proof.before=stored(projectDir);fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify(proof.before.project));delete proof.before.project;
 await page.getByTestId('ai-collapse').click();await page.getByTestId('editor-zoom-stepper').click();await page.getByTestId('editor-zoom-0.5').click();await page.getByTestId('ai-collapsed-restore').click();
 await page.screenshot({path:path.join(dir,'before.png')});
 await page.getByTestId('ai-composer-settings').click();await page.getByTestId('ai-composer-autonomy').selectOption('balanced');await page.getByTestId('ai-composer-settings').click();
 await page.getByTestId('ai-input').fill(prompt);await page.getByTestId('ai-send').click();proof.sentAt=Date.now();persist();console.log('native prompt submitted');
 const deadline=Date.now()+900000;let seen=0;
 for(;;){await page.waitForTimeout(2000);proof.events=await page.evaluate(()=>window.__capEvents);proof.status=await page.evaluate(()=>window.__oprnAiBridge.status());persist();for(const e of proof.events.slice(seen))if(['tool_start','tool_end','error','assistant'].includes(e.type))console.log(JSON.stringify({type:e.type,name:e.name,ok:e.ok,text:(e.summary??e.text??e.message??'').slice(0,280)}));seen=proof.events.length;if(!proof.status.turnBusy&&proof.events.some(e=>['stream_closed','error'].includes(e.type)))break;if(Date.now()>deadline){await page.evaluate(()=>window.__oprnAiBridge.abort());throw Error('Actual assistant deadline');}}
 await save(page);proof.after=stored(projectDir);fs.writeFileSync(path.join(dir,'after.json'),JSON.stringify(proof.after.project));await page.screenshot({path:path.join(dir,'after.png')});
 await context.close();context=null;await video.saveAs(path.join(dir,'assistant.webm'));
 editor=await newEditor(browser,host.url,projectDir,{});context=editor.context;await editor.page.getByTestId('ai-collapse').click();await editor.page.getByTestId('editor-zoom-stepper').click();await editor.page.getByTestId('editor-zoom-0.5').click();await editor.page.getByTestId('ai-collapsed-restore').click();
 const loaded=editor.loads.find(l=>l.sha256===proof.after.sha256);proof.reloadEqual=Boolean(loaded)&&isDeepStrictEqual(loaded.maps,proof.after.project.maps);proof.afterSha256=proof.after.sha256;proof.projectId=proof.after.projectId;proof.revision=proof.after.revision;proof.projectDir=projectDir;delete proof.after.project;
 await editor.page.screenshot({path:path.join(dir,'reloaded.png')});proof.realRun=proof.requests.length>0&&proof.events.some(e=>e.type==='done');proof.elapsedMs=Date.now()-proof.sentAt;persist();await context.close();context=null;writeRuntimeProject(projectDir,path.join(dir,'live.json'),stored(projectDir).project);console.log(JSON.stringify({realRun:proof.realRun,reloadEqual:proof.reloadEqual,projectId:proof.projectId,revision:proof.revision}));
}catch(e){await context?.pages()[0]?.screenshot({path:path.join(dir,'failure.png')}).catch(()=>{});proof.failure=e.message;persist();console.error(e);process.exitCode=1;}finally{await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host.close();}
