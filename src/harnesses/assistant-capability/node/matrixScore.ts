import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { PNG } from 'pngjs';
import { argsFor } from './matrixLive';
import { richProject } from './matrixTools';
import { runTool } from '../../../editor/tools/toolRunner';
import { renderMapPng } from '../../../../scripts/qa-game/render.mts';
import type { Project } from '../../../project/types';
import { CAPABILITY_MAP_ID } from './capabilityFixture';

type MatrixCommand = { id:string; n:number; prompt:string; mode:string; scope:string; oracle:string; visual:string; toolNames:string[] };
type ModelRow = { id:string; tool?:string; action?:string; targetKind?:string; parameterIntent?:string[]; destructive?:boolean; preserveUnmentioned?:boolean; needsClarification?:boolean; confidence?:number; reason?:string };
const matrix = JSON.parse(readFileSync(resolve('harness-data/assistant-capability/command-matrix.json'),'utf8')) as { commands: MatrixCommand[] };
const MAP = CAPABILITY_MAP_ID;
const clone = <T>(value:T):T => structuredClone(value);
const hash = (value:Buffer|string) => createHash('sha256').update(value).digest('hex');
const uniqueTools = [...new Set(matrix.commands.flatMap(command => argsFor(command.id).map(call => call.tool)))].sort();

function targetKind(command: MatrixCommand): string {
  const call = argsFor(command.id)[0]!;
  if (['upsert_item','upsert_equipment','set_shop_stock'].includes(call.tool)) return 'database';
  if (['get_project_summary','list_edit_history','revert_last_edit'].includes(call.tool)) return 'project';
  if (['plan_world','lint_world','link_maps'].includes(call.tool)) return 'world';
  if (call.tool === 'set_scene_mood') return 'scene';
  if (typeof call.args.eventId === 'string') return 'event';
  if (typeof call.args.mapId === 'string' || call.tool.includes('region') || call.tool.includes('tiles') || call.tool.includes('road') || call.tool.includes('reachability')) return 'map';
  return command.mode === 'read' ? 'project' : 'map';
}
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object') return prefix ? [prefix] : [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}
function destructive(command: MatrixCommand): boolean {
  return ['clear-region','remove-barrels','remove-final-fade','rewind-turn'].includes(command.id);
}
function parseJson(text: string): any {
  const cleaned = text.replace(/```json\s*/giu,'').replace(/```/gu,'').trim();
  for (const start of [cleaned.indexOf('['), cleaned.indexOf('{')].filter(index => index >= 0).sort((a,b)=>a-b)) {
    try { return JSON.parse(cleaned.slice(start)); } catch { /* try the next JSON-looking segment */ }
  }
  return null;
}
function asRows(value: any): ModelRow[] {
  const rows = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : value?.id ? [value] : [];
  return rows.filter((row:any) => row && typeof row.id === 'string').map((row:any) => ({
    id: row.id, tool: typeof row.tool === 'string' ? row.tool : undefined, action: typeof row.action === 'string' ? row.action : undefined,
    targetKind: typeof row.targetKind === 'string' ? row.targetKind : undefined,
    parameterIntent: Array.isArray(row.parameterIntent) ? row.parameterIntent.filter((x:any)=>typeof x==='string') : undefined,
    destructive: typeof row.destructive === 'boolean' ? row.destructive : undefined,
    preserveUnmentioned: typeof row.preserveUnmentioned === 'boolean' ? row.preserveUnmentioned : undefined,
    needsClarification: typeof row.needsClarification === 'boolean' ? row.needsClarification : undefined,
    confidence: typeof row.confidence === 'number' ? row.confidence : undefined, reason: typeof row.reason === 'string' ? row.reason : undefined,
  }));
}
function scoreUnderstanding(command: MatrixCommand, row: ModelRow|undefined): { score:number; breakdown:Record<string,number> } {
  const expected = argsFor(command.id)[0]!;
  const params = flattenKeys(expected.args).map(key => key.split('.').at(-1)!);
  const predictedParams = row?.parameterIntent ?? [];
  const overlap = params.length === 0 ? 1 : params.filter(key => predictedParams.some(predicted => predicted.toLowerCase().includes(key.toLowerCase()))).length / params.length;
  const breakdown = {
    tool: row?.tool === expected.tool ? 40 : 0,
    action: (command.mode === 'read' ? ['inspect','answer','read'].includes(row?.action ?? '') : ['edit','execute','write'].includes(row?.action ?? '')) ? 20 : 0,
    target: row?.targetKind === targetKind(command) ? 20 : 0,
    parameters: Math.round(overlap * 20),
  };
  return {score:Object.values(breakdown).reduce((sum,value)=>sum+value,0),breakdown};
}
function scoreDecision(command: MatrixCommand, row: ModelRow|undefined): { score:number; breakdown:Record<string,number> } {
  const safeAction = command.mode === 'read' ? ['inspect','answer','read'].includes(row?.action ?? '') : ['edit','execute','write'].includes(row?.action ?? '');
  const risk = destructive(command);
  const breakdown = {
    action: safeAction ? 35 : 0,
    preservation: row?.preserveUnmentioned === true ? 25 : 0,
    riskAwareness: risk ? (row?.destructive === true ? 20 : 0) : (row?.destructive === false ? 20 : 0),
    clarification: row?.needsClarification === false ? 20 : 0,
  };
  return {score:Object.values(breakdown).reduce((sum,value)=>sum+value,0),breakdown};
}

async function modelConfig(): Promise<{baseUrl:string;apiKey:string;model:string}> {
  const config = Bun.YAML.parse(await Bun.file(`${process.env.HOME}/.omp/agent/models.yml`).text()) as any;
  const provider = config.providers.opencodex;
  if (!provider?.baseUrl || !provider.apiKey) throw new Error('opencodex provider credentials are unavailable');
  return {baseUrl:provider.baseUrl,apiKey:provider.apiKey,model:provider.models.find((model:any)=>model.id==='gpt-6-astra')?.id ?? provider.models[0].id};
}
async function callModel(config:{baseUrl:string;apiKey:string;model:string}, content:any, maxTokens:number): Promise<{text:string;usage:any}> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, { method:'POST', signal:AbortSignal.timeout(180_000), headers:{'content-type':'application/json','authorization':`Bearer ${config.apiKey}`}, body:JSON.stringify({model:config.model,temperature:0,max_tokens:maxTokens,messages:[
    {role:'system',content:'너는 RPG 에디터 조수 품질 평가용 실제 모델이다. 제공된 명령을 도구 이름과 범위로 정확히 해석하고 JSON만 반환한다. 없는 사실을 만들지 말고, 지정되지 않은 맵·이벤트·데이터를 건드리지 않는다고 명시한다.'},
    {role:'user',content},
  ]})});
  const raw=await response.text();
  if (!response.ok) throw new Error(`model ${response.status}: ${raw.slice(0,300)}`);
  const body=JSON.parse(raw); return {text:String(body.choices?.[0]?.message?.content ?? ''),usage:body.usage ?? null};
}

function pngDelta(before:Buffer, after:Buffer): {changedPixels:number; bbox:[number,number,number,number]|null} {
  const a=PNG.sync.read(before), b=PNG.sync.read(after); if(a.width!==b.width||a.height!==b.height) return {changedPixels:a.width*a.height,bbox:[0,0,b.width,b.height]};
  let count=0,x0=a.width,y0=a.height,x1=-1,y1=-1;
  for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4;let same=true;for(let c=0;c<4;c++)if(a.data[i+c]!==b.data[i+c])same=false;if(!same){count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
  return {changedPixels:count,bbox:x1<0?null:[x0,y0,x1+1,y1+1]};
}
function visualFallback(command:MatrixCommand, delta:{changedPixels:number}): number {
  if (command.mode === 'read') return delta.changedPixels === 0 ? 5 : 1;
  return delta.changedPixels > 0 ? 3 : 1;
}

export async function runMatrixScore(root:string): Promise<number> {
  mkdirSync(root,{recursive:true}); mkdirSync(resolve(root,'images'),{recursive:true});
  const config=await modelConfig();
  const cases:any[]=[];
  for(const command of matrix.commands){
    const beforeProject=richProject(); const afterProject=clone(beforeProject); const call=argsFor(command.id)[0]!;
    const beforeImage=renderMapPng(beforeProject,beforeProject.maps[MAP]!,1).png;
    const context:any={project:afterProject,currentMapId:MAP,assistantRun:false};
    let toolResult:any;
    if(command.id==='rewind-turn') toolResult={ok:true,summary:'직전 assistant turn 복원(모델 평가용 witness)'};
    else toolResult=runTool(context,call.tool,call.args);
    const afterImage=renderMapPng(context.project,context.project.maps[MAP]!,1).png;
    const delta=pngDelta(beforeImage,afterImage);
    const imageName=`${String(command.n).padStart(2,'0')}-${command.id}`;
    writeFileSync(resolve(root,'images',`${imageName}-before.png`),beforeImage); writeFileSync(resolve(root,'images',`${imageName}-after.png`),afterImage);
    cases.push({command,expectedTool:call.tool,expectedArgs:call.args,expectedTargetKind:targetKind(command),expectedParameters:flattenKeys(call.args),expectedDestructive:destructive(command),toolResult:{ok:toolResult.ok,summary:toolResult.summary},beforeSha:hash(beforeImage),afterSha:hash(afterImage),pixelDelta:delta});
  }
  const rawText:any[]=[]; const modelRows=new Map<string,ModelRow>(); const modelFailures:any[]=[];
  for(let i=0;i<cases.length;i+=5){
    const batch=cases.slice(i,i+5).map(item=>({id:item.command.id,n:item.command.n,prompt:item.command.prompt,mode:item.command.mode,scope:item.command.scope,oracle:item.command.oracle,availableTools:uniqueTools}));
    try {
      const response=await callModel(config,`다음 ${batch.length}개 명령 각각에 대해 JSON 배열을 반환하세요. 각 항목은 id, tool(availableTools 중 하나), action(inspect|answer|edit|execute), targetKind(map|event|database|world|scene|project), parameterIntent(핵심 인자명 배열), destructive(boolean), preserveUnmentioned(boolean), needsClarification(boolean), confidence(0~1), reason을 포함해야 합니다.\n\n${JSON.stringify(batch)}`,1200);
      rawText.push({batch:i/5+1,usage:response.usage,response:response.text}); for(const row of asRows(parseJson(response.text))) modelRows.set(row.id,row);
    } catch (error) { const failure={batch:i/5+1,error:String(error)}; rawText.push(failure); modelFailures.push({kind:'text',...failure}); }
    writeFileSync(resolve(root,'text-batches.json'),JSON.stringify(rawText,null,2));
  }
  const textScored=cases.map(item=>{const row=modelRows.get(item.command.id); const understanding=scoreUnderstanding(item.command,row); const decision=scoreDecision(item.command,row); return {...item,model:row ?? null,understanding,decision};});
  const rawVisual:any[]=[]; const visualRows=new Map<string,any>();
  for(let i=0;i<cases.length;i+=5){
    const batch=cases.slice(i,i+5); const content:any[]=[{type:'text',text:`아래는 RPG 에디터 명령 전후 화면이다. 각 id별로 JSON 배열을 반환하세요. visualScore(0~5), scopeMatch(0~1), artifactFree(0~1), legibility(0~1), notes를 평가하세요. 읽기/DB/프로젝트 명령은 맵이 불필요하게 변하지 않았는지도 평가합니다. 이미지에서 확인할 수 없는 DB 내부 값은 추측하지 마세요.`}];
    for(const item of batch){content.push({type:'text',text:`id=${item.command.id}; prompt=${item.command.prompt}; mode=${item.command.mode}; expected visual scope=${item.command.visual}; changedPixels=${item.pixelDelta.changedPixels}`});
      for(const suffix of ['before','after']){const bytes=readFileSync(resolve(root,'images',`${String(item.command.n).padStart(2,'0')}-${item.command.id}-${suffix}.png`));content.push({type:'image_url',image_url:{url:`data:image/png;base64,${bytes.toString('base64')}`}});}}
    try {
      const response=await callModel(config,content,1400); rawVisual.push({batch:i/5+1,usage:response.usage,response:response.text}); const parsed=parseJson(response.text); const rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.items)?parsed.items:[]; for(const row of rows)if(row?.id)visualRows.set(row.id,row);
    } catch (error) { const failure={batch:i/5+1,error:String(error)}; rawVisual.push(failure); modelFailures.push({kind:'visual',...failure}); }
    writeFileSync(resolve(root,'visual-batches.json'),JSON.stringify(rawVisual,null,2));
  }
  const scored=textScored.map(item=>{const visual=visualRows.get(item.command.id); const modelVisual=typeof visual?.visualScore==='number'?Math.max(0,Math.min(5,visual.visualScore)):null; const staticScore=visualFallback(item.command,item.pixelDelta); return {...item,visual:{model:visual ?? null,score:modelVisual,staticScore,staticCheck:item.command.mode==='read'?item.pixelDelta.changedPixels===0:item.pixelDelta.changedPixels>0}};});
  const rows=scored.map(item=>({id:item.command.id,n:item.command.n,naturalLanguageScore:item.understanding.score,decisionQualityScore:item.decision.score,visualQualityScore:item.visual.score,understanding:item.understanding,decision:item.decision,visual:item.visual,expectedTool:item.expectedTool,modelTool:item.model?.tool ?? null,toolResult:item.toolResult,pixelDelta:item.pixelDelta}));
  const visualScores=rows.map(row=>row.visualQualityScore).filter((score):score is number=>typeof score==='number');
  const qualityGate=rows.length===50&&modelFailures.length===0&&rows.every(row=>row.modelTool&&row.naturalLanguageScore>=60&&row.decisionQualityScore>=60&&row.visualQualityScore!==null&&row.visualQualityScore>=2);
  const result={schemaVersion:1,kind:'assistant-small-command-model-score',status:rows.length===50&&modelFailures.length===0&&rows.every(row=>row.modelTool&&row.visualQualityScore!==null)?'scored':'incomplete',qualityGate:qualityGate?'pass':'fail',model:{provider:'opencodex',model:config.model,realModelCalls:rawText.filter(item=>item.response).length+rawVisual.filter(item=>item.response).length,textCalls:rawText.filter(item=>item.response).length,visualCalls:rawVisual.filter(item=>item.response).length,expectedCalls:20,failures:modelFailures},aggregate:{naturalLanguage:{average:rows.reduce((s,row)=>s+row.naturalLanguageScore,0)/rows.length,pass:rows.filter(row=>row.naturalLanguageScore>=60).length},decisionQuality:{average:rows.reduce((s,row)=>s+row.decisionQualityScore,0)/rows.length,pass:rows.filter(row=>row.decisionQualityScore>=60).length},visualQuality:{average:visualScores.length?visualScores.reduce((s,row)=>s+row,0)/visualScores.length:null,scored:visualScores.length,pass:rows.filter(row=>typeof row.visualQualityScore==='number'&&row.visualQualityScore>=2).length}},rows,raw:{text:rawText,visual:rawVisual},limitations:['모델 기반 시각 점수는 사람 검수자를 대체하지 않는다.','모델의 실제 도구 호출이 아니라 50개 명령에 대한 모델 판단을 별도로 평가한다.','정적 픽셀 변화 점수는 보조 신호이며 모델 시각 점수와 별도다.']};
  const visualSummary=result.aggregate.visualQuality.average===null?'미완료':`${result.aggregate.visualQuality.average.toFixed(1)}/5 (${result.aggregate.visualQuality.scored}/50 채점)`;
  writeFileSync(resolve(root,'matrix-score.json'),JSON.stringify(result,null,2)); writeFileSync(resolve(root,'SUMMARY.md'),`# 50개 명령 실제 모델 품질 점수\n\n상태: **${result.status}** · 품질 기준선: **${result.qualityGate}**\n\n자연어 이해력 평균 ${result.aggregate.naturalLanguage.average.toFixed(1)}/100 (${result.aggregate.naturalLanguage.pass}/50 ≥60) · 판단 품질 평균 ${result.aggregate.decisionQuality.average.toFixed(1)}/100 (${result.aggregate.decisionQuality.pass}/50 ≥60) · 시각 품질 평균 ${visualSummary}\n\n실제 모델 호출 ${result.model.realModelCalls}/${result.model.expectedCalls}회 (${result.model.textCalls} 텍스트, ${result.model.visualCalls} 시각). 모델 응답 원문과 전후 PNG 해시는 matrix-score.json에 남겼다.\n`); console.log(JSON.stringify({status:result.status,qualityGate:result.qualityGate,model:result.model,aggregate:result.aggregate},null,2)); return result.status==='scored'?0:1;
}
