// Live model transport is never replaced. Record the real native composer and
// canonical host; retain unsuccessful attempts, raw video and public tool events.
import { firefox } from 'playwright';
import { resolve } from 'node:path';
import { mkdirSync,writeFileSync,openSync,closeSync,unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { startHost,newEditor,stored,writeRuntimeProject } from './editorDriver.mjs';

const root=resolve(process.argv[2]);
const selected=(process.argv[3]??'default,pokemon').split(',');
const mapNamed=(project,text)=>Object.values(project.maps).find(m=>String(m.name??'').includes(text))?.id;
const cases=[
  {id:'default',label:'기본 대륙 월드맵',prompt:'일반 판타지 RPG용 세계지도를 하나 만들어줘. 이름은 「서녘 대륙」으로 해줘. 현재 있는 맵과 게임 시작 위치는 보존하고, 만든 지도는 실제 프로젝트에 저장해줘.'},
  // 빈 프로젝트 → 조수 혼자 전체 몬스터 게임. 고유명은 기획서처럼 문장으로만 준다(조수가 build_monster_game names 로 넘겨야 한다).
  {id:'monster',label:'포켓몬풍 전체 게임',deadlineMs:1800000,names:{startTown:'솔바람 마을',professor:'바람박사',firstGym:'바위 체육관',firstLeader:'단단'},
    prompt:'포켓몬스터 같은 몬스터 수집 게임을 처음부터 끝까지 만들어줘. 제목은 「바람개비 섬의 수호수」야. 지방은 바람개비 섬, 시작 마을은 솔바람 마을, 첫 동료를 주는 박사는 바람박사, 첫 도로는 1번 도로, 첫 체육관은 바위 체육관, 관장은 단단, 배지는 바위 배지로 해줘. 실제 프로젝트에 저장해줘.'},
  {id:'pokemon',label:'포켓몬풍 마을과 도로',prompt:'포켓몬스터처럼 마을과 도로를 따라 여행하는 지역 월드맵을 만들어줘. 이름은 「솔바람 지방」으로 해줘. 마을·도로·능력 관문을 실제 맵과 이동 이벤트로 만들어줘. 현재 있는 맵과 게임 시작 위치는 보존하고, 실제 프로젝트에 저장해줘.'},
].filter(entry=>selected.includes(entry.id));
const save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n');
async function saveUi(page){
  await page.getByTestId('toolbar-save').click();
  await page.waitForFunction(()=>['idle','saved','error','unsaved-session'].includes(document.querySelector('[data-testid="toolbar-save"]')?.dataset.autosaveKind),null,{timeout:120000});
  const kind=await page.getByTestId('toolbar-save').getAttribute('data-autosave-kind');
  if(!['idle','saved'].includes(kind))throw Error(`SQLite save failed: ${kind}`);
}
async function showMap(page,id){
  await page.getByTestId('sidebar-map-switcher').click();
  await page.getByTestId(`map-tree-node-${id}`).click();
  const close=page.getByTestId('sidebar-maps-close');if(await close.isVisible().catch(()=>false))await close.click();
  await page.getByTestId('layer-upper').click();
  await page.getByTestId('editor-zoom-stepper').click();
  await page.getByTestId('editor-zoom-0.5').click();
  await page.waitForTimeout(2000);
}
let successful=0;
for(const entry of cases){
  const dir=resolve(root,entry.id),projectDir=resolve(dir,'project');mkdirSync(resolve(dir,'raw-video'),{recursive:true});
  const lock=resolve(dir,'run.lock'),fd=openSync(lock,'wx');writeFileSync(fd,JSON.stringify({pid:process.pid}));closeSync(fd);
  const proof={case:entry.id,prompt:entry.prompt,modelTransport:'product companion',nativeComposer:true,projectDir,requests:[],errors:[],startedAt:new Date().toISOString()};
  const persist=()=>save(resolve(dir,'proof.json'),proof);
  let host,browser,context,page,video,videoOrigin,trimStart,videoEnd,bootObserver;
  try{
    host=await startHost(projectDir,dir);
    browser=await firefox.launch({firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false}});
    videoOrigin=Date.now();
    let editor=await newEditor(browser,host.url,projectDir,{}, {bootTimeoutMs:360000,recordVideo:{dir:resolve(dir,'raw-video'),size:{width:1440,height:960}},async onPage(p,c){
      page=p;context=c;video=p.video();const pending=new Set();
      await p.addInitScript(()=>{localStorage.setItem('oprn:editor-ui-mode','standard');localStorage.setItem('oprn:first-edit-guide:seen','1');window.__capBootErrors=[];window.addEventListener('vite:preloadError',e=>window.__capBootErrors.push(String(e.payload?.stack??e.payload)));});
      p.on('pageerror',error=>{proof.errors.push(error.message);persist();});
      p.on('crash',()=>{proof.errors.push('Browser page crashed');persist();void p.close();});
      p.on('request',r=>{if(r.method()==='GET')pending.add(new URL(r.url()).pathname);});
      p.on('requestfinished',r=>pending.delete(new URL(r.url()).pathname));
      p.on('requestfailed',r=>pending.delete(new URL(r.url()).pathname));
      bootObserver=setInterval(()=>{void p.evaluate(()=>({loader:document.querySelector('[data-testid="boot-loader"]')?.textContent?.trim().slice(0,100),mainChildren:document.querySelector('.main')?.childElementCount,ready:window.__oprnAiBridge?.status?.().ready,preloads:window.__capBootErrors})).then(state=>{proof.boot={...state,pending:[...pending].slice(-12)};persist();console.log(JSON.stringify({case:entry.id,boot:proof.boot}));}).catch(()=>{});},30000);
    }});
    page=editor.page;context=editor.context;video=page.video();clearInterval(bootObserver);
    page.on('request',request=>{
      if(request.method()!=='POST'||!/\/v1\/(agent\/run|chat\/completions)/.test(request.url()))return;
      try{const raw=request.postDataBuffer(),body=JSON.parse(raw?.[0]===31?gunzipSync(raw):raw);
        proof.requests.push({endpoint:new URL(request.url()).pathname,model:body.model,provider:request.headers()['x-oprn-provider'],runId:body.runId,at:Date.now()});persist();
      }catch{proof.requests.push({endpoint:new URL(request.url()).pathname,observationError:true});}
    });
    await saveUi(page);const before=stored(projectDir);proof.before={projectId:before.projectId,revision:before.revision,sha256:before.sha256,mapIds:Object.keys(before.project.maps)};
    save(resolve(dir,'before.json'),before.project);
    await page.getByTestId('ai-composer-settings').click();await page.getByTestId('ai-composer-autonomy').selectOption('balanced');await page.getByTestId('ai-composer-settings').click();
    await page.screenshot({path:resolve(dir,'before.png')});
    trimStart=(Date.now()-videoOrigin)/1000;
    console.log(`${entry.id}: submitting native prompt`);
    await page.getByTestId('ai-input').fill(entry.prompt);await page.waitForTimeout(1500);await page.getByTestId('ai-send').click();
    proof.sentAt=Date.now();persist();
    const deadline=Date.now()+(entry.deadlineMs??900000);let seen=0;
    for(;;){
      await page.waitForTimeout(2000);
      proof.events=await page.evaluate(()=>window.__capEvents??[]);proof.status=await page.evaluate(()=>window.__oprnAiBridge.status());persist();
      for(const event of proof.events.slice(seen))if(['tool_start','tool_end','error','assistant'].includes(event.type))console.log(JSON.stringify({case:entry.id,type:event.type,name:event.name,ok:event.ok,text:(event.summary??event.text??event.message??'').slice(0,260)}));
      seen=proof.events.length;
      if(!proof.status.turnBusy&&proof.events.some(e=>['stream_closed','error'].includes(e.type)))break;
      if(Date.now()>deadline){await page.evaluate(()=>window.__oprnAiBridge.abort());throw Error('Actual assistant deadline');}
    }
    await saveUi(page);const applied=stored(projectDir);save(resolve(dir,'after.json'),applied.project);
    proof.newMaps=Object.keys(applied.project.maps).filter(id=>!before.project.maps[id]);
    proof.atlases=applied.project.worldAtlases??[];
    proof.tools=proof.events.filter(e=>e.type==='tool_end').map(e=>({name:e.name,ok:e.ok,summary:e.summary,args:proof.events.find(s=>s.type==='tool_start'&&s.id===e.id)?.args}));
    const monster=entry.id==='monster';
    // 빈 프로젝트 교체 생성은 시작 맵을 바꾸는 것이 정상이다 — 보존 검사는 기존 게임이 있는 녹화에만.
    proof.existingMapsPreserved=monster||Object.entries(before.project.maps).every(([id,map])=>isDeepStrictEqual(map,applied.project.maps[id]));
    proof.startPreserved=monster||before.project.startMapId===applied.project.startMapId&&isDeepStrictEqual(before.project.startPos,applied.project.startPos);
    if(monster){
      const text=JSON.stringify(applied.project);
      proof.monster={campaign:applied.project.system.monsterCampaign?.id,maps:Object.keys(applied.project.maps).length,
        startMap:applied.project.maps[applied.project.startMapId]?.name,title:applied.project.meta?.title,
        namesFound:Object.fromEntries(Object.entries(entry.names).map(([k,v])=>[k,text.includes(v)]))};
    }
    proof.correctMode=monster?Boolean(proof.monster.campaign)&&proof.monster.maps>=72&&String(proof.monster.startMap).includes(entry.names.startTown)&&Object.values(proof.monster.namesFound).every(Boolean)
      :entry.id==='default'?proof.newMaps.some(id=>applied.project.maps[id].worldmapSource?.theme==='fantasy')&&proof.atlases.length===0:proof.atlases.some(a=>a.structure==='region-routes');
    const resultMap=monster?applied.project.startMapId:entry.id==='default'?proof.newMaps.find(id=>applied.project.maps[id].worldmapSource):proof.atlases[0]?.nodes.find(n=>n.id===proof.atlases[0].startNodeId)?.mapId;
    if(resultMap)await showMap(page,resultMap);
    await page.screenshot({path:resolve(dir,'after.png')});await page.waitForTimeout(4500);
    if(monster)for(const [kind,id] of [['route',mapNamed(applied.project,'1번 도로')],['gym',mapNamed(applied.project,entry.names.firstGym)]])if(id){await showMap(page,id);await page.screenshot({path:resolve(dir,`${kind}.png`)});await page.waitForTimeout(3000);}
    if(entry.id==='pokemon')for(const node of proof.atlases[0]?.nodes.slice(1,3)??[]){await showMap(page,node.mapId);await page.screenshot({path:resolve(dir,`${node.kind}.png`)});await page.waitForTimeout(3000);}
    await page.reload({waitUntil:'domcontentloaded',timeout:120000});
    await page.getByTestId('boot-loader').waitFor({state:'hidden',timeout:180000});await page.waitForFunction(()=>window.__oprnEditReliefStats?.().residentTileCells>0,null,{timeout:120000});
    if(resultMap)await showMap(page,resultMap);
    await page.screenshot({path:resolve(dir,'same-context-reloaded.png')});await page.waitForTimeout(3500);
    videoEnd=(Date.now()-videoOrigin)/1000;await context.close();context=null;
    editor=await newEditor(browser,host.url,projectDir,{});page=editor.page;context=editor.context;
    const reloaded=stored(projectDir),loaded=editor.loads.find(l=>l.sha256===applied.sha256);
    if(resultMap)await showMap(page,resultMap);await page.screenshot({path:resolve(dir,'reloaded.png')});
    proof.persistence={projectId:before.projectId,afterRevision:applied.revision,reloadedRevision:reloaded.revision,afterSha256:applied.sha256,reloadedSha256:reloaded.sha256,
      sameTarget:before.projectId===reloaded.projectId,sameStoredDocument:applied.sha256===reloaded.sha256,
      newContextLoadedSameMaps:Boolean(loaded)&&isDeepStrictEqual(applied.project.maps,loaded.maps),newContextLoadedSameDatabase:Boolean(loaded)&&isDeepStrictEqual(applied.project.database,loaded.database)};
    proof.passed=proof.correctMode&&proof.existingMapsPreserved&&proof.startPreserved&&proof.persistence.sameStoredDocument&&proof.persistence.newContextLoadedSameMaps&&proof.persistence.newContextLoadedSameDatabase&&proof.events.some(e=>e.type==='done')&&!/마치지 못했/.test(proof.status?.lastStatus??'')&&!proof.events.some(e=>['error','stream_error'].includes(e.type))&&!proof.errors.length;
    writeRuntimeProject(projectDir,resolve(dir,'live.json'));
    if(proof.passed)successful++;
    console.log(JSON.stringify({case:entry.id,passed:proof.passed,newMaps:proof.newMaps,tools:proof.tools.map(t=>t.name),persistence:proof.persistence}));
  }catch(error){proof.failure=error.message;await page?.screenshot({path:resolve(dir,'failure.png'),timeout:10000}).catch(()=>{});console.error(`${entry.id}: ${error.message}`);}
  finally{
    clearInterval(bootObserver);videoEnd??=(Date.now()-videoOrigin)/1000;persist();await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await host?.close();unlinkSync(lock);
    if(video&&trimStart!==undefined){const raw=await video.path();
      execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(trimStart),'-i',raw,'-t',String(videoEnd-trimStart),'-vf','fps=20','-c:v','libx264','-threads','2','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',resolve(dir,'assistant.mp4')],{stdio:'inherit'});
      proof.recording={source:raw,mp4:resolve(dir,'assistant.mp4'),speed:1,sourceSeconds:videoEnd-trimStart,trimmedBeforeNativeInput:true};persist();
    }
  }
}

process.exitCode=successful===cases.length?0:1;
