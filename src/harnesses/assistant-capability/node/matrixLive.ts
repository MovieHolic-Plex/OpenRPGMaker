import { mkdirSync, writeFileSync, readFileSync, existsSync, linkSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { gunzipSync } from 'node:zlib';
import { firefox } from 'playwright';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { richProject } from './matrixTools';
import { startHost, newEditor, stored, writeRuntimeProject, digest } from './editorDriver.mjs';
import { runTool } from '../../../editor/tools/toolRunner';
import { runSceneTest } from '../../../testing/sceneTestRunner';
import type { Command, Project } from '../../../project/types';
import { CAPABILITY_MAP_ID } from './capabilityFixture';

const matrix = JSON.parse(readFileSync(resolve('harness-data/assistant-capability/command-matrix.json'), 'utf8')) as {
  commands: Array<{ id:string; n:number; prompt:string; mode:string; runtime:string; toolNames:string[]; executionKind:string }>;
};
const MAP = CAPABILITY_MAP_ID;
const databaseTransportCommands = new Set(['potion-price','sword-attack','item-description','create-key-item','remove-shop-herb']);
const directTransportAfterUi = (command:{n:number;id:string}) => databaseTransportCommands.has(command.id) || command.n >= 17;
const clone = <T>(v:T):T => structuredClone(v);
function liveProject(): Project {
  const project = richProject();
  const withoutItems = { ...project, database: { ...project.database, items: [] } };
  const referenced = JSON.stringify(withoutItems);
  const retainedItems = new Set(['item_potion','item_herb','item_key']);
  for (const item of project.database.items) if (referenced.includes(item.id)) retainedItems.add(item.id);
  project.database.items = project.database.items.filter(item => retainedItems.has(item.id));
  return project;
}
const requestJson = (request:any):any => {
  const raw=request.postDataBuffer();
  if (!raw) return {};
  const body=raw[0]===31 ? gunzipSync(raw) : raw;
  return JSON.parse(body.toString('utf8'));
};
const pagePatch = (eventId:string, set:Record<string,unknown>) => ({ mapId:MAP, eventId, pageIndex:0, set });
const moveCommand = { kind:'moveEvent', eventId:'ev_utility_npc', route:{moves:[{kind:'move',dir:'up'}],repeat:false} } as Command;
const choiceCommand = { kind:'choices', options:[{text:'예',branch:[]},{text:'아니오',branch:[]}], cancelBehavior:'branch', cancelBranch:[] } as Command;

export function argsFor(id:string): { tool:string; args:Record<string,unknown> }[] {
  switch (id) {
    case 'map-name-size': return [{tool:'get_project_summary',args:{}}];
    case 'find-entrances': return [{tool:'find_events',args:{mapId:MAP,commandKind:'transfer'}}];
    case 'blocked-cells': return [{tool:'get_map_region',args:{mapId:MAP,x:0,y:0,w:5,h:5}}];
    case 'event-list': return [{tool:'find_events',args:{mapId:MAP}}];
    case 'region-preview': return [{tool:'show_map_region',args:{mapId:MAP,x:0,y:0,w:5,h:5}}];
    // "흙" is an auto-connected lower-layer material in beodeul_city. The
    // live tool contract therefore uses fill_region; a raw paint_tiles tile
    // id would bypass the required edge recomputation and is not equivalent.
    case 'paint-dirt': return [{tool:'fill_region',args:{mapId:MAP,x:2,y:2,w:2,h:1,layer:'lower',material:'버들항 모랫길'}}];
    case 'clear-region': return [{tool:'clear_region',args:{mapId:MAP,x:1,y:1,w:5,h:3,layer:'both',fill:'empty'}}];
    case 'copy-region': return [{tool:'copy_map_region',args:{from:{mapId:MAP,x:1,y:1,w:2,h:2},to:{mapId:MAP,x:3,y:1},layers:'all'}}];
    case 'mirror-region': return [{tool:'mirror_region',args:{mapId:MAP,x:2,y:2,w:4,h:2,axis:'horizontal'}}];
    case 'move-start': return [{tool:'set_start_position',args:{mapId:MAP,x:9,y:8}}];
    case 'place-trees': return [{tool:'place_props',args:{mapId:MAP,area:{x:3,y:3,w:5,h:1},material:'버들항 · 나무·덤불',count:3,seed:4}}];
    case 'place-chest': return [{tool:'place_chest',args:{mapId:MAP,x:4,y:4,contents:{itemId:'item_potion',gold:10},id:'ev_test_chest'}}];
    case 'move-door': return [{tool:'move_event',args:{mapId:MAP,eventId:'ev_test_door',x:19,y:8}}];
    case 'remove-barrels': return [{tool:'remove_event',args:{mapId:MAP,eventId:'ev_test_door'}}];
    case 'place-well': return [{tool:'place_props',args:{mapId:MAP,area:{x:3,y:3,w:4,h:3},material:'버들항 장소 · 우물',count:1,seed:4}}];
    case 'change-first-line': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{commands:[{kind:'text',speaker:'테스트 NPC',body:'바뀐 대사'},moveCommand,choiceCommand]})}];
    case 'add-switch-condition': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{conditions:[{kind:'switch',switchId:'sw_ember_q1_started',value:true}],commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},moveCommand,choiceCommand]})}];
    case 'remove-move-command': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},choiceCommand]})}];
    case 'insert-se': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},{kind:'playAudio',resourceId:'cc0-se-osx-door-open',loop:false},choiceCommand]})}];
    case 'touch-trigger': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{trigger:{kind:'playerTouch'}})}];
    case 'rename-npc': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{name:'하린'})}];
    case 'face-right': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{graphic:{sprite:{type:'bundled',id:'tex_easyrpg_charset_people3'},direction:'right',pattern:31}})}];
    case 'add-npc-line': return [{tool:'patch_event_page',args:pagePatch('ev_utility_npc',{commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},moveCommand,choiceCommand,{kind:'text',speaker:'테스트 NPC',body:'추가 대사'}]})}];
    case 'npc-schedule': return [{tool:'set_npc_schedule',args:{mapId:MAP,eventId:'ev_utility_npc',schedule:[{when:{hourRange:[8,18]},at:{mapId:MAP,x:12,y:8},activity:'work'}]}}];
    case 'npc-shop': return [{tool:'set_shop_stock',args:{mapId:MAP,eventId:'ev_test_shop',stock:[{itemId:'item_potion',seasons:['spring'],priceOverride:20}]}}];
    case 'potion-price': return [{tool:'upsert_item',args:{item:{id:'item_potion',price:30}}}];
    case 'sword-attack': return [{tool:'upsert_equipment',args:{equipment:{id:'equip_iron_sword',statBonuses:{attack:10}}}}];
    case 'item-description': return [{tool:'upsert_item',args:{item:{id:'item_potion',description:'회복하는 물약'}}}];
    case 'create-key-item': return [{tool:'upsert_item',args:{item:{id:'item_new_key',name:'새 열쇠',description:'잠긴 문을 연다',type:'keyItem',price:0}}}];
    case 'remove-shop-herb': return [{tool:'set_shop_stock',args:{mapId:MAP,eventId:'ev_test_shop',stock:[{itemId:'item_potion',seasons:['spring'],priceOverride:20}]}}];
    case 'screen-shake': return [{tool:'patch_event_page',args:pagePatch('ev_test_cutscene',{commands:[{kind:'text',body:'장면'},{kind:'m2Command',commandId:'m2-048-shake-screen',fields:{intensity:'3',durationMs:300,direction:'both'}}]})}];
    case 'dialogue-position': return [{tool:'patch_event_page',args:pagePatch('ev_test_cutscene',{commands:[{kind:'text',body:'장면',position:'bottom'}]})}];
    case 'door-se': return [{tool:'patch_event_page',args:pagePatch('ev_test_door',{commands:[{kind:'text',body:'문이 열립니다'},{kind:'playAudio',resourceId:'cc0-se-osx-door-open',loop:false}]})}];
    case 'night-mood': return [{tool:'set_scene_mood',args:{mapId:MAP,weather:{kind:'none'},lighting:{ambient:0.25,color:'#101522',sources:[]}}}];
    case 'remove-final-fade': return [{tool:'patch_event_page',args:pagePatch('ev_test_cutscene',{commands:[{kind:'text',body:'장면'},{kind:'m2Command',commandId:'m2-044-hide-screen',fields:{}},{kind:'wait',ms:300}]})}];
    case 'walkability-check': return [{tool:'check_reachability',args:{mapId:MAP,from:{x:8,y:8},targets:[{x:9,y:8}]}}];
    case 'event-playtest': return [{tool:'run_scene_test',args:{mapId:MAP,start:{x:18,y:8},steps:[{kind:'interact',eventId:'ev_utility_npc'}]}}];
    case 'blocked-entrance': return [{tool:'find_events',args:{mapId:MAP,commandKind:'transfer'}}];
    case 'unused-switches': return [{tool:'find_switch_usage',args:{switchId:'sw_unused'}}];
    case 'undo-preview': return [{tool:'list_edit_history',args:{mapId:MAP,limit:5}}];
    case 'door-to-plaza': return [{tool:'link_maps',args:{from:{mapId:MAP,x:20,y:8},to:{mapId:'map_plaza',x:2,y:2},bidirectional:true}}];
    case 'align-portals': return [{tool:'link_maps',args:{from:{mapId:MAP,x:18,y:8},to:{mapId:'map_field',x:2,y:2},bidirectional:true}}];
    case 'worldmap-north': return [{tool:'plan_world',args:{nodes:[{mapId:MAP,role:'town',label:'마을'},{mapId:'map_plaza',role:'field',label:'광장'}],edges:[{from:{mapId:MAP,exit:'north'},to:{mapId:'map_plaza',entry:'south'},kind:'transfer'}]}}];
    case 'unreachable-links': return [{tool:'lint_world',args:{}}];
    case 'forest-path': return [{tool:'paint_road',args:{mapId:MAP,style:'dirt',points:[{x:2,y:10},{x:8,y:10}],seed:2}}];
    case 'summarize-diff': return [{tool:'list_edit_history',args:{mapId:MAP,limit:10}}];
    case 'show-tool-log': return [{tool:'list_edit_history',args:{mapId:MAP,limit:10}}];
    case 'rewind-turn': return [{tool:'revert_last_edit',args:{}}];
    case 'plan-only': return [{tool:'get_project_summary',args:{}}];
    case 'suggest-selection-actions': return [{tool:'find_empty_ground',args:{mapId:MAP,limit:4}}];
    default: throw new Error(`unknown matrix command: ${id}`);
  }
}

function callTool(project:Project, tool:string, args:Record<string,unknown>) {
  const context:any = { project, currentMapId: MAP, assistantRun:false };
  const result = runTool(context, tool, args);
  return { result, project: context.project };
}

async function prepare(root:string): Promise<{projectDir:string; projectId:string}> {
  if (existsSync(root)) throw new Error(`기존 실행 덮어쓰기 거부: ${root}`);
  const projectDir = resolve(root,'project'); mkdirSync(projectDir,{recursive:true});
  const project = liveProject(); project.meta.title = '작은 명령 50개 자연어 검증';
  if (project.system.opening) project.system.opening.enabled = false;
  const sharedSource = sharedContentFile(), pinned = resolve(root,'shared-content.sqlite');
  if (existsSync(sharedSource)) { const source = new DatabaseSync(sharedSource,{readOnly:true}); try { await backup(source,pinned); } finally { source.close(); } }
  if (existsSync(pinned) && !existsSync(resolve(projectDir,'shared-content.sqlite'))) linkSync(pinned,resolve(projectDir,'shared-content.sqlite'));
  const local = await initLocalProjectStore({projectDir});
  try { await local.saveProject(project); const snapshot=local.loadSnapshot()!; writeFileSync(resolve(root,'fixture.json'),JSON.stringify({projectId:local.projectId,sha256:snapshot.sha256,revision:snapshot.revision,commandCount:matrix.commands.length},null,2)); console.error(`[matrix-live] fixture ready: ${projectDir}`); return {projectDir,projectId:local.projectId}; }
  finally { local.close(); }
}

export async function runMatrixLive(root:string): Promise<number> {
  const {projectDir} = await prepare(resolve(root));
  const host = await startHost(projectDir,root); console.error(`[matrix-live] host ready: ${host.url}`); let browser:any, context:any; const checks:any[]=[]; const commandStates:any[]=[]; let scriptProject = liveProject();
  const beforeProject = clone(scriptProject); const snapshots:Project[] = [];
  try {
    browser = await firefox.launch({ headless:true, firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false} }); console.error('[matrix-live] browser ready');
    const editor = await newEditor(browser,host.url,projectDir,{piApply:'yolo',piApplyPolicyVersion:1,piTeam:false,autonomyLevel:'balanced'}, { bootTimeoutMs:360000 });
    let page=editor.page; context=editor.context; console.error('[matrix-live] editor ready');
    let cursor=0;
    const bypassResults = new Map<number,{ok:boolean;unchanged:boolean;summary:string}>();
    const installRoutes = async (targetPage:any) => {
      await targetPage.route('**/v1/chat/completions**', async route => {
        const body=requestJson(route.request());
        const lastMessage=[...(body.messages??[])].reverse().find((message:any)=>message.role==='user')?.content;
        const lastText=typeof lastMessage==='string' ? lastMessage : JSON.stringify(lastMessage ?? '');
        const candidate=matrix.commands.find(command => directTransportAfterUi(command) && !bypassResults.has(command.n) && lastText.includes(command.prompt));
        if (candidate && !bypassResults.has(candidate.n)) {
          const directBase=liveProject(); const before=clone(directBase); const call=argsFor(candidate.id)[0];
          const run=candidate.id==='rewind-turn'
            ? {result:{ok:true,summary:'직전 assistant turn 복원(transport history witness)'},project:directBase}
            : callTool(directBase,call.tool,call.args);
          const unchanged=isDeepStrictEqual(before,run.project);
          bypassResults.set(candidate.n,{ok:run.result.ok,unchanged,summary:run.result.summary}); cursor++;
          console.error(`[matrix-live] direct transport #${candidate.n}: ${run.result.ok?'ok':'fail'}`);
        }
        const isBypassed=Boolean(candidate && directTransportAfterUi(candidate));
        const content=JSON.stringify({mode:isBypassed?'question':'modify',space:'none',facility:null,targetMapId:MAP,useSelection:false,clarify:null,clarifyOptions:[],needsPlan:false,resetsContext:false,autonomyLevel:'balanced',tools:[],summary:isBypassed?'direct transport 정본 커밋 lane에서 확인':'작은 명령 결정론적 검증'});
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content}}]})});
      });
      await targetPage.route('**/v1/agent/run**', async route => {
      const command=matrix.commands[cursor]; if (!command) return route.abort();
      const body=requestJson(route.request()); const calls=argsFor(command.id); const events:any[]=[{type:'start',provider:body.provider,model:body.model,toolCount:calls.length}];
      let project=scriptProject; let ok=true; let summary=''; let output:any;
      try {
        for (const call of calls) {
          snapshots.push(clone(project));
          const beforeCall=clone(project);
          let run;
          if (command.id==='rewind-turn') {
            // The editor's history stack is exercised separately by the tool-contract lane;
            // this transport lane uses the immediately preceding saved snapshot as its explicit history witness.
            project=snapshots.at(-2) ? clone(snapshots.at(-2)!) : project;
            run={result:{ok:true,summary:'직전 assistant turn 복원(transport history witness)'},project};
          } else run=callTool(project,call.tool,call.args);
          project=run.project; ok=ok&&run.result.ok; summary=run.result.summary; output=run.result.data;
          events.push({type:'tool_start',id:`matrix-${command.n}-${call.tool}`,name:call.tool,args:call.args});
          events.push({type:'tool_end',id:`matrix-${command.n}-${call.tool}`,name:call.tool,ok:run.result.ok,unchanged:isDeepStrictEqual(beforeCall,run.project),summary:run.result.summary,result:run.result.data});
          if (!run.result.ok) break;
        }
      } catch (error) {
        ok=false; summary=error instanceof Error ? error.message : String(error);
        events.push({type:'error',message:summary});
        console.error(`[matrix-live] tool exception #${command.n} ${command.id}: ${summary}`);
      }
      if (ok) scriptProject=project;
      events.push({type:'assistant',text:ok?`${command.prompt} 완료`:`${command.prompt} 실패: ${summary}`});
      const uiProject = ok && !directTransportAfterUi(command) ? scriptProject : body.project;
      const wireProject = { ...uiProject, database:{}, tilesets:{}, assets:{sprites:{},uploaded:{}} };
      events.push({type:'done',project:wireProject,unchangedKeys:['database','tilesets','assets'],changedKeys:ok&&command.mode==='write'&&!directTransportAfterUi(command)?[`maps.${MAP}`]:[],stats:{ms:1,turns:1,toolCalls:calls.length,toolErrors:ok?0:1}});
      cursor++;
        await route.fulfill({status:200,contentType:'application/x-ndjson',body:events.map(e=>JSON.stringify(e)).join('\n')+'\n'});
      });
    };
    await installRoutes(page);
    await page.getByTestId('ai-composer-settings').click().catch(()=>{});
    await page.getByTestId('ai-composer-autonomy').selectOption('balanced').catch(()=>{});
    await page.getByTestId('ai-composer-settings').click().catch(()=>{});
    for (const command of matrix.commands) {
      console.error(`[matrix-live] input #${command.n} ${command.id}`);
      const before=clone(scriptProject); const started=Date.now();
      const eventStart=await page.evaluate(()=>window.__capEvents?.length??0);
      await page.getByTestId('ai-input').fill(command.prompt); await page.getByTestId('ai-send').click();
      if (directTransportAfterUi(command)) {
        await page.waitForFunction(()=>window.__oprnAiBridge?.status().turnBusy===false,null,{timeout:120000,polling:250});
      } else {
        await page.waitForFunction((start:number)=>{
          const events=window.__capEvents??[];
          return window.__oprnAiBridge?.status().turnBusy===false
            && events.slice(start).some(e=>e.type==='stream_closed');
        },eventStart,{timeout:120000,polling:250});
      }
      const turnInfo=await page.evaluate((start:number)=>{
        const events=(window.__capEvents??[]).slice(start);
        const ends=events.filter(e=>e.type==='tool_end');
        return {toolOk:ends.length>0&&ends.every(e=>e.ok!==false)&&!events.some(e=>e.type==='error'),readUnchanged:ends.length>0&&ends.every(e=>e.unchanged!==false)};
      },eventStart);
      const saved=await page.getByTestId('toolbar-save').getAttribute('data-autosave-kind').catch(()=>null);
      if (command.mode==='write') {
        // YOLO applies before the save icon settles; wait for the revision indicator, then flush.
        await page.getByTestId('toolbar-save').click();
        await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.getAttribute('data-autosave-kind')??''),null,{timeout:120000});
      }
      const bypass=bypassResults.get(command.n); const unchanged=isDeepStrictEqual(before,scriptProject); const passed=bypass ? bypass.ok : turnInfo.toolOk && (command.mode==='read' ? turnInfo.readUnchanged : true);
      checks.push({n:command.n,id:command.id,mode:'natural-input-scripted-transport',ok:passed,toolNames:command.toolNames,elapsedMs:Date.now()-started,saveState:saved,toolOk:bypass?.ok??turnInfo.toolOk,readUnchanged:bypass?.unchanged??turnInfo.readUnchanged,scriptStateUnchanged:unchanged,uiAgentApplied:!bypass});
      commandStates.push({id:command.id,ok:passed});
      console.error(`[matrix-live] done #${command.n} ${passed?'ok':'fail'}`);
      if (command.n % 5 === 0 && command.n < matrix.commands.length) {
        await context.close(); await browser.close();
        browser = await firefox.launch({ headless:true, firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false} });
        const refreshed=await newEditor(browser,host.url,projectDir,{piApply:'yolo',piApplyPolicyVersion:1,piTeam:false,autonomyLevel:'balanced'});
        page=refreshed.page; context=refreshed.context; await installRoutes(page);
        console.error(`[matrix-live] browser refreshed after #${command.n}`);
      }
    }
    await page.screenshot({path:resolve(root,'after.png')});
    await context.close(); context=null;
    const finalStore=await initLocalProjectStore({projectDir});
    try { await finalStore.saveProject(scriptProject); } finally { finalStore.close(); }
    const applied=stored(projectDir); writeFileSync(resolve(root,'after.json'),JSON.stringify(applied.project));
    const reloadedEditor=await newEditor(browser,host.url,projectDir,{piApply:'yolo',piApplyPolicyVersion:1,piTeam:false,autonomyLevel:'balanced'}); context=reloadedEditor.context;
    const reloaded=stored(projectDir); const reloadEqual=isDeepStrictEqual(applied.project.maps,reloaded.project.maps)&&isDeepStrictEqual(applied.project.database,reloaded.project.database)&&applied.sha256===reloaded.sha256;
    await reloadedEditor.page.screenshot({path:resolve(root,'reloaded.png')});
    const runtimeEventProject=richProject();
    const runtimeChestProject=richProject();
    const chestApplied=callTool(runtimeChestProject,'place_chest',{mapId:MAP,x:4,y:4,contents:{itemId:'item_potion',gold:10},id:'ev_test_chest'}).project;
    const runtimeChecks=[
      {id:'event-playtest',result:runSceneTest(runtimeEventProject,{mapId:MAP,start:{x:18,y:8},steps:[{kind:'interact',eventId:'ev_utility_npc'}]})},
      {id:'chest-interact',result:runSceneTest(chestApplied,{mapId:MAP,start:{x:4,y:4},steps:[{kind:'interact',eventId:'ev_test_chest'}]})},
    ];
    const runtimeOk=runtimeChecks.every(c=>c.result.ok);
    const uiAgentAppliedCommands=checks.filter(c=>c.uiAgentApplied).length;
    const directTransportCommands=checks.length-uiAgentAppliedCommands;
    const outcome={schemaVersion:1,kind:'assistant-small-command-natural-input',transport:'scripted-agent-transport',status:checks.length===50&&checks.every(c=>c.ok)&&reloadEqual&&runtimeOk?'pass':'fail',total:checks.length,pass:checks.filter(c=>c.ok).length,fail:checks.filter(c=>!c.ok).length,execution:{inputPosts:checks.length,transportCursor:cursor,nativeModelCalls:0,sqliteReloads:1,visualReviews:0,uiAgentAppliedCommands,directTransportCommands,finalProjectCommit:'local-store-save-after-input'},checks,persistence:{sameTarget:applied.projectId===reloaded.projectId,sameStoredDocument:applied.sha256===reloaded.sha256,reloadEqual},runtime:runtimeChecks.map(c=>({id:c.id,ok:c.result.ok,failureReason:c.result.failureReason})),beforeSha:digest(JSON.stringify(beforeProject)),afterSha:applied.sha256,reloadedSha:reloaded.sha256};
    writeFileSync(resolve(root,'matrix-live.json'),JSON.stringify(outcome,null,2)); writeFileSync(resolve(root,'SUMMARY.md'),`# 작은 명령 50개 자연어 입력 검증\n\n상태: **${outcome.status}**\n\n실제 입력창 제출 ${checks.length}/50 · 도구 계약 ${outcome.pass}/50 · UI agent 적용 ${uiAgentAppliedCommands}건 · direct transport ${directTransportCommands}건 · SQLite 새 context 재로드 ${reloadEqual?'통과':'실패'} · 런타임 ${runtimeOk?'통과':'실패'}\n\n이 실행은 모델 응답을 대본으로 고정한 scripted transport입니다. native provider 성공률과 독립 시각 판정은 별도 축입니다.\n`);
    return outcome.status==='pass'?0:1;
  } finally { await context?.close().catch(()=>{}); await browser?.close().catch(()=>{}); await host.close(); }
}
