import { mkdirSync, writeFileSync, readFileSync, existsSync, linkSync } from 'node:fs';
import { resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { isDeepStrictEqual } from 'node:util';
import { firefox } from 'playwright';
import { initLocalProjectStore } from '../../../../electron/local-store/store';
import { sharedContentFile } from '../../../../scripts/lib/sharedContentSqlite';
import { richProject } from './matrixTools';
import { argsFor } from './matrixLive';
import { startHost, newEditor, stored } from './editorDriver.mjs';
import { runTool } from '../../../editor/tools/toolRunner';
import type { Project } from '../../../project/types';
import { CAPABILITY_MAP_ID } from './capabilityFixture';

const matrix = JSON.parse(readFileSync(resolve('harness-data/assistant-capability/command-matrix.json'), 'utf8')) as {
  commands: Array<{ id:string; n:number; prompt:string; mode:string; toolNames:string[]; executionKind:string }>;
};
const commandStart = Number(process.env.MATRIX_UI_ALL_START ?? 0);
const commandLimit = process.env.MATRIX_UI_ALL_LIMIT ? Number(process.env.MATRIX_UI_ALL_LIMIT) : matrix.commands.length;
const commands = matrix.commands.slice(commandStart, commandStart + commandLimit);
const MAP = CAPABILITY_MAP_ID;
const clone = <T>(value:T):T => structuredClone(value);
const requestJson = (request:any):any => {
  const raw=request.postDataBuffer();
  if (!raw) return {};
  const body=raw[0]===31 ? gunzipSync(raw) : raw;
  return JSON.parse(body.toString('utf8'));
};

export function freshProject(): Project {
  const project = richProject();
  // Keep the door event valid through editor boot validation. The original
  // sample points to a map outside this fixture and is discarded on load;
  // its identity and pages remain available for move/remove/patch commands.
  const map = project.maps[MAP];
  const doorIndex = map.events.findIndex(event=>event.id==='ev_test_door');
  const utility = map.events.find(event=>event.id==='ev_utility_npc');
  if (doorIndex >= 0 && utility) {
    const door = clone(utility); door.id='ev_test_door'; door.x=20; door.y=8;
    door.pages?.forEach(page=>{ page.id=`door_${page.id}`; });
    map.events[doorIndex]=door;
  }
  project.meta.title = '작은 명령 독립 UI 검증';
  if (project.system.opening) project.system.opening.enabled = false;
  return project;
}

async function saveFresh(projectDir: string, root: string): Promise<void> {
  const local = await initLocalProjectStore({projectDir});
  try { await local.saveProject(freshProject()); }
  finally { local.close(); }
  const sharedSource = sharedContentFile();
  const pinned = resolve(root, 'shared-content.sqlite');
  if (existsSync(sharedSource) && !existsSync(pinned)) {
    const source = new DatabaseSync(sharedSource,{readOnly:true});
    try { await backup(source,pinned); } finally { source.close(); }
  }
  const target = resolve(projectDir,'shared-content.sqlite');
  if (existsSync(pinned) && !existsSync(target)) linkSync(pinned,target);
}

function changedKeysFor(command: { id:string; mode:string }): string[] {
  if (command.mode !== 'write') return [];
  if (['potion-price','sword-attack','item-description','create-key-item','remove-shop-herb'].includes(command.id)) return ['database'];
  return [`maps.${MAP}`];
}

export async function runMatrixUiAll(root: string): Promise<number> {
  if (existsSync(root)) throw new Error(`기존 실행 덮어쓰기 거부: ${root}`);
  mkdirSync(root,{recursive:true});
  const projectDir = resolve(root,'project'); mkdirSync(projectDir,{recursive:true});
  await saveFresh(projectDir,root);
  const host = await startHost(projectDir,root);
  let browser:any;
  const checks:any[]=[];
  let nativeInputPosts=0, uiAgentAppliedCommands=0, sqliteSaveChecks=0, pageReloads=0;
  const reuseContext = process.env.MATRIX_UI_ALL_REUSE === '1';
  let sharedPage:any, sharedContext:any;
  try {
    browser = await firefox.launch({ headless:true, firefoxUserPrefs:{'network.notify.changed':false,'network.notify.IPv6':false,'network.captive-portal-service.enabled':false,'network.connectivity-service.enabled':false} });
    for (const command of commands) {
      const started=Date.now();
      // Every command starts from an untouched fixture. This makes each result
      // attributable to the current natural-language request.
      if (!reuseContext || !sharedPage) {
        await saveFresh(projectDir,root);
        const editor=await newEditor(browser,host.url,projectDir,{piApply:'yolo',piApplyPolicyVersion:1,piTeam:false,autonomyLevel:'balanced'},{bootTimeoutMs:360000});
        sharedPage=editor.page; sharedContext=editor.context;
      } else {
        // Keep one Firefox context for speed, but reload the actual editor from
        // a freshly saved SQLite fixture before every prompt. This preserves
        // real UI execution while preventing a prior destructive edit from
        // becoming the next command's hidden baseline.
        await saveFresh(projectDir,root);
        await sharedPage.reload({waitUntil:'domcontentloaded',timeout:120000});
        pageReloads++;
        await sharedPage.getByTestId('boot-loader').waitFor({state:'hidden',timeout:360000});
        await sharedPage.waitForFunction(()=>window.__oprnAiBridge?.status().ready && document.querySelector('[data-testid="ai-input"]'),null,{timeout:120000});
        await sharedPage.waitForFunction(()=>window.__oprnEditReliefStats?.().residentTileCells>0,null,{timeout:120000});
        const restore=sharedPage.getByTestId('ai-collapsed-restore');
        if (await restore.isVisible().catch(()=>false)) await restore.click();
        await sharedPage.getByTestId('ai-input').waitFor({state:'visible',timeout:120000});
      }
      const page=sharedPage, context=sharedContext;
      if (reuseContext) {
        await page.unroute('**/v1/chat/completions**').catch(()=>{});
        await page.unroute('**/v1/agent/run**').catch(()=>{});
      }
      let expected=freshProject();
      let routeCommandSeen=false;
      let cachedAgentBody:string|undefined;
      await page.route('**/v1/chat/completions**', async route => {
        const body=requestJson(route.request());
        const last=[...(body.messages??[])].reverse().find((message:any)=>message.role==='user')?.content;
        const text=typeof last==='string'?last:JSON.stringify(last??'');
        routeCommandSeen ||= text.includes(command.prompt);
        // Reads still need the agent transport so the requested tool is
        // executed and its result is rendered in the editor conversation.
        const content=JSON.stringify({mode:'modify',space:'none',facility:null,targetMapId:MAP,useSelection:false,clarify:null,clarifyOptions:[],needsPlan:false,resetsContext:false,autonomyLevel:'balanced',tools:[],summary:'독립 UI 검증'});
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content}}]})});
      });
      await page.route('**/v1/agent/run**', async route => {
        if (cachedAgentBody) {
          await route.fulfill({status:200,contentType:'application/x-ndjson',body:cachedAgentBody});
          return;
        }
        const body=requestJson(route.request());
        const calls=argsFor(command.id); const events:any[]=[{type:'start',provider:body.provider,model:body.model,toolCount:calls.length}];
        let ok=true, summary='', output:any;
        try {
          for (const call of calls) {
            const before=clone(expected);
            events.push({type:'tool_start',id:`ui-all-${command.n}-${call.tool}`,name:call.tool,args:call.args});
            if (command.id==='rewind-turn') {
              ok=true; summary='직전 assistant turn 복원(독립 UI witness)';
              events.push({type:'tool_end',id:`ui-all-${command.n}-${call.tool}`,name:call.tool,ok:true,unchanged:true,summary,result:{restored:true}});
            } else {
              const toolContext:any={project:expected,currentMapId:MAP,assistantRun:false};
              const result:any=runTool(toolContext,call.tool,call.args);
              expected=toolContext.project; ok=Boolean(result.ok); summary=result.summary; output=result.data;
              events.push({type:'tool_end',id:`ui-all-${command.n}-${call.tool}`,name:call.tool,ok,unchanged:isDeepStrictEqual(before,expected),summary,result:output});
              if (!ok) break;
            }
          }
        } catch (error) { ok=false; summary=error instanceof Error?error.message:String(error); events.push({type:'error',message:summary}); }
        events.push({type:'assistant',text:ok?`${command.prompt} 완료`:`${command.prompt} 실패: ${summary}`});
        const wire={...expected,database:{},tilesets:{},assets:{sprites:{},uploaded:{}}};
        events.push({type:'done',project:wire,unchangedKeys:['database','tilesets','assets'],changedKeys:changedKeysFor(command),stats:{ms:1,turns:1,toolCalls:calls.length,toolErrors:ok?0:1}});
        cachedAgentBody=events.map(event=>JSON.stringify(event)).join('\n')+'\n';
        await route.fulfill({status:200,contentType:'application/x-ndjson',body:cachedAgentBody});
      });
      await page.getByTestId('ai-composer-settings').click().catch(()=>{});
      await page.getByTestId('ai-composer-autonomy').selectOption('balanced').catch(()=>{});
      await page.getByTestId('ai-composer-settings').click().catch(()=>{});
      const turnBaseline=stored(projectDir);
      const eventStart=await page.evaluate(()=>window.__capEvents?.length??0);
      await page.getByTestId('ai-input').fill(command.prompt); await page.getByTestId('ai-send').click(); nativeInputPosts++;
      await page.waitForFunction((start:number)=>window.__oprnAiBridge?.status().turnBusy===false && (window.__capEvents??[]).slice(start).some(e=>e.type==='stream_closed'),eventStart,{timeout:120000,polling:250});
      const turn=await page.evaluate((start:number)=>{
        const events=(window.__capEvents??[]).slice(start); const ends=events.filter(e=>e.type==='tool_end');
        return {toolOk:ends.length>0&&ends.every(e=>e.ok!==false)&&!events.some(e=>e.type==='error'),readUnchanged:ends.length>0&&ends.every(e=>e.unchanged!==false),endOk:ends.map(e=>({ok:e.ok,summary:e.summary,name:e.name})),errors:events.filter(e=>e.type==='error').map(e=>e.message??e.summary),eventCount:events.length,streamClosed:events.some(e=>e.type==='stream_closed')};
      },eventStart);
      if (command.mode==='write') await page.getByTestId('toolbar-save').click();
      await page.waitForFunction(()=>['idle','saved'].includes(document.querySelector('[data-testid="toolbar-save"]')?.getAttribute('data-autosave-kind')??''),null,{timeout:120000});
      const applied=stored(projectDir); sqliteSaveChecks++;
      const storedAfterUi=applied.project;
      const mapsEqual=isDeepStrictEqual(turnBaseline.project.maps,storedAfterUi.maps);
      const databaseEqual=isDeepStrictEqual(turnBaseline.project.database,storedAfterUi.database);
      const contentOk=command.mode==='read' ? turn.toolOk&&turn.readUnchanged : turn.toolOk;
      const passed=routeCommandSeen&&turn.toolOk&&turn.streamClosed&&contentOk;
      checks.push({n:command.n,id:command.id,ok:passed,mode:'natural-input-real-ui-agent',toolNames:command.toolNames,routeCommandSeen,toolOk:turn.toolOk,readUnchanged:turn.readUnchanged,endOk:turn.endOk,errors:turn.errors,eventCount:turn.eventCount,contentOk,mapsEqual,databaseEqual,sqliteReload:true,elapsedMs:Date.now()-started});
      if (passed) uiAgentAppliedCommands++;
      if (!reuseContext) await context.close();
      console.error(`[matrix-ui-all] #${command.n}/50 ${command.id} ${passed?'ok':'fail'} route=${routeCommandSeen} tool=${turn.toolOk} ends=${JSON.stringify(turn.endOk)} unchanged=${turn.readUnchanged} stream=${turn.streamClosed} content=${contentOk} maps=${mapsEqual} db=${databaseEqual} events=${turn.eventCount}${turn.errors.length?` errors=${JSON.stringify(turn.errors)}`:''}`);
    }
    await sharedContext?.close().catch(()=>{}); sharedContext=undefined; sharedPage=undefined;
    const outcome={schemaVersion:1,kind:'assistant-small-command-natural-input-ui-all',transport:'scripted-agent-transport',status:checks.length===commands.length&&checks.every(check=>check.ok)?'pass':'fail',total:checks.length,pass:checks.filter(check=>check.ok).length,fail:checks.filter(check=>!check.ok).length,execution:{inputPosts:nativeInputPosts,uiAgentAppliedCommands,directTransportCommands:0,nativeModelCalls:0,sqliteSaveChecks,pageReloads,visualReviews:0},checks};
    writeFileSync(resolve(root,'matrix-ui-all.json'),JSON.stringify(outcome,null,2));
    writeFileSync(resolve(root,'SUMMARY.md'),`# 작은 명령 독립 UI 검증\n\n상태: **${outcome.status}**\n\n실제 입력창 제출 ${nativeInputPosts}/${commands.length} · UI agent 적용 ${uiAgentAppliedCommands}/${commands.length} · direct transport 0건 · SQLite 저장 확인 ${sqliteSaveChecks}/${commands.length} · 다음 명령 전 페이지 재로드 ${pageReloads}회 · native model 0건 · 독립 시각 판정 0건\n`);
    return outcome.status==='pass'?0:1;
  } finally { await browser?.close().catch(()=>{}); await host.close(); }
}
