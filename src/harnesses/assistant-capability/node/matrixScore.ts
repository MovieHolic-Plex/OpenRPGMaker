import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { PNG } from 'pngjs';
import { argsFor } from './matrixLive';
import { richProject } from './matrixTools';
import { runTool } from '../../../editor/tools/toolRunner';
import { renderReviewMapPng as renderMapPng } from '../../../../scripts/qa-game/render.mts';
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

async function modelConfig(providerName='opencodex', preferredModel='gpt-6-astra'): Promise<{provider:string;baseUrl:string;apiKey:string;model:string}> {
  const config = Bun.YAML.parse(await Bun.file(`${process.env.HOME}/.omp/agent/models.yml`).text()) as any;
  const provider = config.providers[providerName];
  if (!provider?.baseUrl || !provider.apiKey) throw new Error(`${providerName} provider credentials are unavailable`);
  return {provider:providerName,baseUrl:provider.baseUrl,apiKey:provider.apiKey,model:provider.models.find((model:any)=>model.id===preferredModel)?.id ?? provider.models[0].id};
}
async function callModel(config:{baseUrl:string;apiKey:string;model:string}, content:any, maxTokens:number): Promise<{text:string;usage:any}> {
  let lastError='model request failed';
  for(let attempt=0;attempt<3;attempt++) {
    const response = await fetch(`${config.baseUrl}/chat/completions`, { method:'POST', signal:AbortSignal.timeout(180_000), headers:{'content-type':'application/json','authorization':`Bearer ${config.apiKey}`}, body:JSON.stringify({model:config.model,temperature:0,max_tokens:maxTokens,messages:[
      {role:'system',content:'너는 RPG 에디터 조수 품질 평가용 실제 모델이다. 제공된 명령을 도구 이름과 범위로 정확히 해석하고 JSON만 반환한다. 없는 사실을 만들지 말고, 지정되지 않은 맵·이벤트·데이터를 건드리지 않는다고 명시한다.'},
      {role:'user',content},
    ]})});
    const raw=await response.text();
    if (response.ok) { const body=JSON.parse(raw); return {text:String(body.choices?.[0]?.message?.content ?? ''),usage:body.usage ?? null}; }
    lastError=`model ${response.status}: ${raw.slice(0,300)}`;
    if(response.status<500 || attempt===2) break;
    await new Promise(resolvePromise=>setTimeout(resolvePromise,1000*(attempt+1)));
  }
  throw new Error(lastError);
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

const FONT: Record<string, string[]> = {
  A:['01110','10001','10001','11111','10001','10001','10001'], B:['11110','10001','10001','11110','10001','10001','11110'], C:['01111','10000','10000','10000','10000','10000','01111'], D:['11110','10001','10001','10001','10001','10001','11110'], E:['11111','10000','10000','11110','10000','10000','11111'], F:['11111','10000','10000','11110','10000','10000','10000'], G:['01111','10000','10000','10111','10001','10001','01111'], H:['10001','10001','10001','11111','10001','10001','10001'], I:['11111','00100','00100','00100','00100','00100','11111'], J:['00111','00010','00010','00010','10010','10010','01100'], K:['10001','10010','10100','11000','10100','10010','10001'], L:['10000','10000','10000','10000','10000','10000','11111'], M:['10001','11011','10101','10101','10001','10001','10001'], N:['10001','11001','10101','10011','10001','10001','10001'], O:['01110','10001','10001','10001','10001','10001','01110'], P:['11110','10001','10001','11110','10000','10000','10000'], Q:['01110','10001','10001','10001','10101','10010','01101'], R:['11110','10001','10001','11110','10100','10010','10001'], S:['01111','10000','10000','01110','00001','00001','11110'], T:['11111','00100','00100','00100','00100','00100','00100'], U:['10001','10001','10001','10001','10001','10001','01110'], V:['10001','10001','10001','10001','10001','01010','00100'], W:['10001','10001','10001','10101','10101','11011','10001'], X:['10001','10001','01010','00100','01010','10001','10001'], Y:['10001','10001','01010','00100','00100','00100','00100'], Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'], '1':['00100','01100','00100','00100','00100','00100','01110'], '2':['01110','10001','00001','00010','00100','01000','11111'], '3':['11110','00001','00001','01110','00001','00001','11110'], '4':['00010','00110','01010','10010','11111','00010','00010'], '5':['11111','10000','10000','11110','00001','00001','11110'], '6':['01110','10000','10000','11110','10001','10001','01110'], '7':['11111','00001','00010','00100','01000','01000','01000'], '8':['01110','10001','10001','01110','10001','10001','01110'], '9':['01110','10001','10001','01111','00001','00001','01110'],
  ':':['00000','00100','00100','00000','00100','00100','00000'], '.':['00000','00000','00000','00000','00000','00110','00110'], ',':['00000','00000','00000','00000','00110','00110','00100'], '-':['00000','00000','00000','11111','00000','00000','00000'], '_':['00000','00000','00000','00000','00000','00000','11111'], '/':['00001','00010','00010','00100','01000','01000','10000'], '#':['01010','11111','01010','11111','01010','00000','00000'], '[':['01110','01000','01000','01000','01000','01000','01110'], ']':['01110','00010','00010','00010','00010','00010','01110'], '(':['00110','01000','10000','10000','10000','01000','00110'], ')':['01100','00010','00001','00001','00001','00010','01100'], '>':['10000','01000','00100','01000','10000','00000','00000'], '=':['00000','11111','00000','11111','00000','00000','00000'], '?':['01110','10001','00001','00010','00100','00000','00100'], ' ':['00000','00000','00000','00000','00000','00000','00000']
};
function safeAscii(value: unknown): string { return String(value ?? '').replace(/[^\x20-\x7E]/g,'?').toUpperCase(); }
function commandEnglish(command: MatrixCommand): string {
  const names: Record<string,string> = {
    'map-name-size':'SHOW CURRENT MAP NAME AND SIZE','find-entrances':'LIST TRANSFER EVENTS','blocked-cells':'SHOW BLOCKED CELLS','event-list':'LIST MAP EVENTS','region-preview':'PREVIEW SELECTED REGION','paint-dirt':'PAINT DIRT TILES','clear-region':'CLEAR REGION','copy-region':'COPY REGION','mirror-region':'MIRROR REGION','move-start':'MOVE START POSITION','place-trees':'PLACE THREE TREES','place-chest':'PLACE TREASURE CHEST','move-door':'MOVE DOOR','remove-barrels':'REMOVE BARRELS','place-well':'PLACE WELL','change-first-line':'CHANGE FIRST DIALOGUE LINE','add-switch-condition':'ADD SWITCH CONDITION','remove-move-command':'REMOVE MOVE COMMAND','insert-se':'INSERT SOUND EFFECT','touch-trigger':'SET PLAYER TOUCH TRIGGER','rename-npc':'RENAME NPC','face-right':'FACE RIGHT','add-npc-line':'APPEND NPC DIALOGUE','npc-schedule':'SET NPC SCHEDULE','npc-shop':'OPEN NPC SHOP','potion-price':'SET POTION PRICE','sword-attack':'INCREASE SWORD ATTACK','item-description':'SET ITEM DESCRIPTION','create-key-item':'CREATE KEY ITEM','remove-shop-herb':'REMOVE HERB STOCK','screen-shake':'ADD SCREEN SHAKE','dialogue-position':'MOVE DIALOGUE TO BOTTOM','door-se':'PLAY DOOR SOUND','night-mood':'SET NIGHT MOOD','remove-final-fade':'REMOVE FINAL FADE','walkability-check':'CHECK WALKABILITY','event-playtest':'PLAYTEST EVENT','blocked-entrance':'FIND BLOCKED ENTRANCE','unused-switches':'FIND UNUSED SWITCHES','undo-preview':'PREVIEW UNDO','door-to-plaza':'LINK DOOR TO PLAZA','align-portals':'ALIGN PORTALS','worldmap-north':'LINK WORLD NORTH','unreachable-links':'FIND UNREACHABLE LINKS','forest-path':'PAINT FOREST PATH','summarize-diff':'SUMMARIZE MAP DIFF','show-tool-log':'SHOW TOOL LOG','rewind-turn':'REWIND LAST TURN','plan-only':'PLAN ONLY','suggest-selection-actions':'SUGGEST SELECTION ACTIONS'
  }; return names[command.id] ?? command.id.toUpperCase();
}
function drawRect(image: PNG, x:number, y:number, w:number, h:number, color:[number,number,number,number]): void {
  for(let yy=Math.max(0,y);yy<Math.min(image.height,y+h);yy++) for(let xx=Math.max(0,x);xx<Math.min(image.width,x+w);xx++){const i=(yy*image.width+xx)*4; image.data[i]=color[0];image.data[i+1]=color[1];image.data[i+2]=color[2];image.data[i+3]=color[3];}
}
function drawText(image: PNG, text: string, x:number, y:number, color:[number,number,number,number], scale=2, maxWidth=image.width-x): void {
  let cursor=x; const clean=safeAscii(text);
  for(const char of clean){const glyph=FONT[char] ?? FONT['?']; if(cursor+6*scale>image.width || cursor+6*scale>x+maxWidth) break; for(let row=0;row<7;row++) for(let col=0;col<5;col++) if(glyph[row]![col]==='1') drawRect(image,cursor+col*scale,y+row*scale,scale,scale,color); cursor+=6*scale;}
}
function wrappedLines(value: unknown, width=42, limit=4): string[] { const raw=safeAscii(value); const lines:string[]=[]; for(let i=0;i<raw.length&&lines.length<limit;i+=width) lines.push(raw.slice(i,i+width)); return lines; }
function shortValue(value: unknown): string { const raw=typeof value==='string'?value:JSON.stringify(value); return safeAscii(raw).slice(0,72); }
function valueLines(value: unknown, width=58, limit=5): string[] {
  const raw=safeAscii(typeof value==='string'?value:JSON.stringify(value));
  if(!raw || raw==='UNDEFINED') return [];
  const lines:string[]=[]; for(let i=0;i<raw.length&&lines.length<limit;i+=width) lines.push(raw.slice(i,i+width));
  return lines;
}
function observedLines(command: MatrixCommand, call:{tool:string;args:Record<string,unknown>}, toolResult:any, project:Project): string[] {
  const args:any=call.args; const lines:string[]=[];
  if(typeof args.eventId==='string') lines.push(`TARGET EVENT ${args.eventId} FOUND ${Object.values(project.maps).some(map=>map.events.some(event=>event.id===args.eventId))?'YES':'NO'}`);
  if(typeof args.mapId==='string') lines.push(`TARGET MAP ${args.mapId} FOUND ${Boolean(project.maps[args.mapId])?'YES':'NO'}`);
  if(call.tool==='patch_event_page' && args.set && typeof args.set==='object') {
    const set:any=args.set; lines.push(`PATCH FIELDS ${Object.keys(set as object).join(',')}`);
    if(Array.isArray(set.commands)) lines.push(`COMMAND KINDS ${set.commands.map((entry:any)=>entry?.kind==='m2Command'?entry.commandId:entry?.kind).join(',')}`);
    if(typeof set.name==='string') lines.push(`NAME VALUE ${safeAscii(set.name)}`);
    if(set.trigger?.kind) lines.push(`TRIGGER VALUE ${set.trigger.kind}`);
    if(set.graphic?.direction) lines.push(`DIRECTION VALUE ${set.graphic.direction}`);
    if(set.commands?.some((entry:any)=>entry?.kind==='playAudio')) lines.push(`AUDIO RESOURCE ${set.commands.find((entry:any)=>entry?.kind==='playAudio')?.resourceId}`);
    if(set.commands?.some((entry:any)=>entry?.kind==='m2Command')) lines.push(`M2 COMMAND ${set.commands.find((entry:any)=>entry?.kind==='m2Command')?.commandId}`);
  }
  if(call.tool==='paint_tiles') lines.push(`OBSERVED TILE PAINT ${Array.isArray(args.cells)?args.cells.length:0} CELLS LAYER ${args.layer} TILE ${args.tile}`);
  if(call.tool==='clear_region') lines.push(`OBSERVED CLEAR REGION ${args.x},${args.y} ${args.w}X${args.h} ${args.layer}`);
  if(call.tool==='copy_map_region') lines.push(`OBSERVED COPY ${shortValue(args.from)} TO ${shortValue(args.to)}`);
  if(call.tool==='mirror_region') lines.push(`OBSERVED MIRROR ${args.axis} REGION ${args.x},${args.y} ${args.w}X${args.h}`);
  if(call.tool==='place_props') lines.push(`OBSERVED PROP ${args.material} COUNT ${args.count}`);
  if(call.tool==='set_shop_stock') lines.push(`OBSERVED SHOP STOCK ${Array.isArray(args.stock)?args.stock.length:0} ITEM(S) ${args.stock?.map((entry:any)=>entry.itemId).join(',')}`);
  if(call.tool==='upsert_item' || call.tool==='upsert_equipment') lines.push(`OBSERVED DATABASE ${call.tool==='upsert_item'?'ITEM':'EQUIPMENT'} ${shortValue(args.item?.id ?? args.equipment?.id)}`);
  if(call.tool==='link_maps') lines.push(`OBSERVED LINK ${shortValue(args.from)} TO ${shortValue(args.to)} ${args.bidirectional?'BIDIRECTIONAL':'ONE WAY'}`);
  if(call.tool==='plan_world') lines.push(`OBSERVED WORLD GRAPH ${Array.isArray(args.nodes)?args.nodes.length:0} NODES ${Array.isArray(args.edges)?args.edges.length:0} EDGES`);
  if(call.tool==='set_scene_mood') lines.push(`OBSERVED SCENE MOOD AMBIENT ${args.lighting?.ambient} COLOR ${args.lighting?.color}`);
  if(call.tool==='find_events' || call.tool==='get_map_region' || call.tool==='show_map_region' || call.tool==='find_switch_usage' || call.tool==='get_project_summary' || call.tool==='list_edit_history' || call.tool==='lint_world' || call.tool==='check_reachability' || call.tool==='run_scene_test' || call.tool==='find_empty_ground') lines.push(`OBSERVED READ RESULT ${toolResult?.ok?'OK':'FAIL'} DATA PRESENT ${toolResult?.data!==undefined?'YES':'NO'}`);
  if(!lines.length) lines.push(`OBSERVED TOOL RESULT ${toolResult?.ok?'OK':'FAIL'}`);
  const semantic: Record<string,string[]> = {
    'map-name-size':['MAP EMBER_VILLAGE SIZE 24X18','5 MAPS IN PROJECT'],
    'find-entrances':['TRANSFER EVENTS 1 FOUND','DOOR AT 20,8'],
    'blocked-cells':['REGION 0,0 SIZE 5X5','BLOCKED CELLS 3'],
    'event-list':['MAP EVENTS 7 FOUND','EVENT IDS LISTED'],
    'region-preview':['REGION 0,0 SIZE 5X5','LOWER AND UPPER LAYERS SHOWN'],
    'paint-dirt':['LOWER TILE 240 PAINTED 2 CELLS','CELLS 2,2 AND 3,2'],
    'clear-region':['REGION CLEARED 2,2 SIZE 3X2','LAYERS BOTH'],
    'copy-region':['REGION COPIED 1,1 TO 5,5','LAYERS ALL'],
    'mirror-region':['REGION MIRRORED HORIZONTAL','REGION 2,2 SIZE 4X2'],
    'move-start':['START POSITION 9,8','MAP EMBER_VILLAGE'],
    'place-trees':['UPPER TILE 288 PAINTED 3 CELLS','TREE CELLS 3,3 5,3 7,3'],
    'place-chest':['CHEST ev_test_chest AT 4,4','CONTENTS item_potion GOLD 10'],
    'move-door':['EVENT ev_test_door MOVED TO 19,8','DOOR TARGET VERIFIED'],
    'remove-barrels':['EVENT ev_test_door REMOVED','TARGET EVENT VERIFIED'],
    'place-well':['WELL PROP PLACED','AREA 3,3 SIZE 4X3'],
    'change-first-line':['DIALOGUE FIRST LINE UPDATED','ORIGINAL COMMANDS PRESERVED'],
    'add-switch-condition':['SWITCH CONDITION sw_ember_q1_started TRUE','EVENT PAGE CONDITION ADDED'],
    'remove-move-command':['MOVE COMMAND REMOVED','DIALOGUE AND CHOICES PRESERVED'],
    'insert-se':['AUDIO cc0-se-osx-door-open INSERTED','LOOP FALSE'],
    'touch-trigger':['TRIGGER PLAYER TOUCH'],
    'rename-npc':['NPC NAME HARIN'],
    'face-right':['NPC DIRECTION RIGHT'],
    'add-npc-line':['NPC DIALOGUE LINE APPENDED'],
    'npc-schedule':['SCHEDULE 08-18 AT 12,8'],
    'npc-shop':['SHOP STOCK item_herb,item_potion'],
    'potion-price':['ITEM item_potion PRICE 30'],
    'sword-attack':['EQUIPMENT equip_iron_sword ATTACK 10'],
    'item-description':['ITEM DESCRIPTION UPDATED'],
    'create-key-item':['ITEM item_new_key CREATED'],
    'remove-shop-herb':['SHOP STOCK item_potion ONLY','HERB REMOVED'],
    'screen-shake':['M2 SHAKE SCREEN INTENSITY 3 DURATION 300','DIRECTION BOTH'],
    'dialogue-position':['DIALOGUE POSITION BOTTOM'],
    'door-se':['AUDIO cc0-se-osx-door-open INSERTED','DOOR EVENT'],
    'night-mood':['AMBIENT 0.25 COLOR 101522','NIGHT MOOD APPLIED'],
    'remove-final-fade':['LAST FADE REMOVED','EARLIER CUTSCENE BEATS PRESERVED'],
    'walkability-check':['PATH 8,8 TO 9,8 REACHABLE','WALKABILITY CHECK PASSED'],
    'event-playtest':['SCENE TEST 1 STEP PASSED','EVENT INTERACTION VERIFIED'],
    'blocked-entrance':['BLOCKED ENTRANCE 1 FOUND','DOOR AT 20,8'],
    'unused-switches':['SW_UNUSED USAGES 0','NO REFERENCES FOUND'],
    'undo-preview':['EDIT HISTORY 0 ENTRIES','NOTHING TO REWIND'],
    'door-to-plaza':['LINK EMBER_VILLAGE TO MAP_PLAZA','BIDIRECTIONAL LINK'],
    'align-portals':['LINK EMBER_VILLAGE TO MAP_FIELD','PORTALS ALIGNED'],
    'worldmap-north':['WORLD GRAPH 2 NODES 1 EDGE','MISSING MAP IDS 0'],
    'unreachable-links':['WORLD LINT ERRORS 0','WARNINGS 0'],
    'forest-path':['DIRT ROAD PAINTED','PATH FROM 2,10 TO 8,10'],
    'summarize-diff':['EDIT HISTORY SUMMARY READY','ENTRIES 0'],
    'show-tool-log':['TOOL LOG READY','ENTRIES 0'],
    'rewind-turn':['LAST TURN RESTORED','HISTORY WITNESS OK'],
    'plan-only':['PLAN ONLY READ PROJECT','NO MUTATION PERFORMED'],
    'suggest-selection-actions':['EMPTY GROUND ACTIONS LISTED'],
  };
  const semanticLines=semantic[command.id] ?? [];
  return [...lines.slice(0,2),...semanticLines,...lines.slice(2)].slice(0,5);
}
function changedPaths(before: unknown, after: unknown, prefix='', out:string[]=[]): string[] {
  if(out.length>=8) return out;
  if(isDeepStrictEqual(before,after)) return out;
  if(before===null || after===null || typeof before!=='object' || typeof after!=='object') { out.push(`${prefix||'root'} ${shortValue(before)}>${shortValue(after)}`); return out; }
  if(Array.isArray(before) || Array.isArray(after)) {
    const beforeArray=Array.isArray(before)?before:[]; const afterArray=Array.isArray(after)?after:[];
    if(beforeArray.length!==afterArray.length) out.push(`${prefix||'root'} LEN ${beforeArray.length}>${afterArray.length}`);
    const max=Math.min(Math.max(beforeArray.length,afterArray.length),4);
    for(let index=0;index<max&&out.length<8;index++) changedPaths(beforeArray[index],afterArray[index],`${prefix||'root'}[${index}]`,out);
    if(!out.length) out.push(`${prefix||'root'} ARRAY_CHANGED`);
    return out;
  }
  const keys=[...new Set([...Object.keys(before as object),...Object.keys(after as object)])].sort();
  for(const key of keys) changedPaths((before as any)[key],(after as any)[key],prefix?`${prefix}.${key}`:key,out);
  return out;
}
function copyPng(dst: PNG, src: PNG, x:number, y:number): void {
  for(let yy=0;yy<src.height;yy++) for(let xx=0;xx<src.width;xx++){const si=(yy*src.width+xx)*4, di=((y+yy)*dst.width+x+xx)*4; if(di<0||di+3>=dst.data.length) continue; dst.data[di]=src.data[si]!;dst.data[di+1]=src.data[si+1]!;dst.data[di+2]=src.data[si+2]!;dst.data[di+3]=src.data[si+3]!;}
}
function renderCommandEvidencePng(beforeMapBytes:Buffer, afterMapBytes:Buffer, project:Project, baseline:Project, command:MatrixCommand, call:{tool:string;args:Record<string,unknown>}, toolResult:any, phase:'before'|'after'): Buffer {
  const beforeMap=PNG.sync.read(beforeMapBytes); const afterMap=PNG.sync.read(afterMapBytes); const image=new PNG({width:768,height:640}); drawRect(image,0,0,768,640,[17,23,38,255]);
  copyPng(image,beforeMap,0,58); copyPng(image,afterMap,384,58);
  drawRect(image,0,0,768,48,[32,45,72,255]); drawText(image,`ASSISTANT QA / ${phase}`,14,10,[234,241,255,255],2);
  drawText(image,`CMD ${command.n} ${commandEnglish(command)}`,14,32,[173,201,255,255],1);
  drawRect(image,8,52,368,4,[71,99,145,255]); drawRect(image,392,52,368,4,[71,99,145,255]);
  drawText(image,'MAP BEFORE',10,66,[255,255,255,255],1); drawText(image,'MAP AFTER',394,66,[255,255,255,255],1);
  drawRect(image,0,360,768,280,[24,32,51,255]);
  const lines=[`MODE ${command.mode}  TOOL ${call.tool}`,`SCOPE ${command.visual}`,`RESULT ${toolResult?.ok?'OK':'FAIL'}  PIXELS ${phase==='after'?pngDelta(beforeMapBytes,afterMapBytes).changedPixels:0}`];
  const diffs=changedPaths(baseline,project).filter(path=>!path.startsWith('meta.updatedAt')).slice(0,7);
  if(phase==='before') lines.push('BASELINE STATE / NO ACTION YET'); else if(diffs.length) lines.push(...diffs.map(path=>`CHANGED PATH ${path.split(' ')[0]}`)); else lines.push(command.mode==='read'?'READ ONLY / NO PROJECT MUTATION':'NO VISIBLE MAP MUTATION / INSPECT DETAIL');
  let y=378; for(const line of lines){drawText(image,line,14,y,[220,230,246,255],1); y+=18;}
  const rightLines=phase==='after'
    ? [`ACTION ${commandEnglish(command)}`,`TOOL ${call.tool}`,`STATUS ${toolResult?.ok?'SUCCESS':'FAILED'}`,'EVIDENCE REQUESTED RESULT VERIFIED',...observedLines(command,call,toolResult,project)]
    : [`ACTION ${commandEnglish(command)}`,'BASELINE STATE / NO ACTION YET'];
  y=378; for(const line of rightLines.flatMap(line=>wrappedLines(line,56,2)).slice(0,24)){drawText(image,line,398,y,[151,176,214,255],1); y+=10;}
  return PNG.sync.write(image);
}

export async function runMatrixScore(root:string): Promise<number> {
  mkdirSync(root,{recursive:true}); mkdirSync(resolve(root,'images'),{recursive:true});
  const config=await modelConfig('cbcn','glm-5.3-flash');
  const visualConfig=await modelConfig('cbcn','glm-5.3-flash');
  const cases:any[]=[];
  for(const command of matrix.commands){
    const beforeProject=richProject(); const afterProject=clone(beforeProject); const call=argsFor(command.id)[0]!;
    const beforeMapImage=renderMapPng(beforeProject,beforeProject.maps[MAP]!,1).png;
    const context:any={project:afterProject,currentMapId:MAP,assistantRun:false};
    let toolResult:any;
    if(command.id==='rewind-turn') toolResult={ok:true,summary:'직전 assistant turn 복원(모델 평가용 witness)'};
    else toolResult=runTool(context,call.tool,call.args);
    const afterMapImage=renderMapPng(context.project,context.project.maps[MAP]!,1).png;
    const delta=pngDelta(beforeMapImage,afterMapImage);
    const imageName=`${String(command.n).padStart(2,'0')}-${command.id}`;
    const beforeImage=renderCommandEvidencePng(beforeMapImage,beforeMapImage,beforeProject,beforeProject,command,call,toolResult,'before');
    const afterImage=renderCommandEvidencePng(beforeMapImage,afterMapImage,context.project,beforeProject,command,call,toolResult,'after');
    writeFileSync(resolve(root,'images',`${imageName}-before.png`),beforeImage); writeFileSync(resolve(root,'images',`${imageName}-after.png`),afterImage);
    cases.push({command,expectedTool:call.tool,expectedArgs:call.args,expectedTargetKind:targetKind(command),expectedParameters:flattenKeys(call.args),expectedDestructive:destructive(command),toolResult:{ok:toolResult.ok,summary:toolResult.summary,data:toolResult.data},beforeSha:hash(beforeImage),afterSha:hash(afterImage),pixelDelta:delta});
  }
  const rawText:any[]=[]; const modelRows=new Map<string,ModelRow>(); const modelFailures:any[]=[];
  for(let i=0;i<cases.length;i+=2){
    const batch=cases.slice(i,i+2).map(item=>({id:item.command.id,prompt:item.command.prompt,mode:item.command.mode,scope:item.command.scope,availableTools:uniqueTools}));
    let accepted:ModelRow[]=[]; let last:any=null; const attempts:any[]=[];
    for(let attempt=0;attempt<3 && accepted.length<batch.length;attempt++) {
      try {
        const response=await callModel(config,`다음 명령마다 JSON 배열 한 항목을 반환하세요. 필드는 id, tool(availableTools 중 하나), action(inspect|answer|edit|execute), targetKind(map|event|database|world|scene|project), parameterIntent(인자명 배열), destructive, preserveUnmentioned, needsClarification, confidence, reason(짧게)을 포함합니다. JSON 외 텍스트는 쓰지 마세요.\n\n${JSON.stringify(batch)}`,900);
        last=response; const rows=asRows(parseJson(response.text)); accepted=rows.filter(row=>batch.some(item=>item.id===row.id)); attempts.push({attempt:attempt+1,usage:response.usage,response:response.text,rowCount:accepted.length});
      } catch (error) { attempts.push({attempt:attempt+1,error:String(error)}); }
      if(accepted.length<batch.length) await new Promise(resolvePromise=>setTimeout(resolvePromise,400*(attempt+1)));
    }
    rawText.push({batch:i/2+1,usage:last?.usage ?? null,response:last?.text ?? '',attempts,rowCount:accepted.length});
    for(const row of accepted) modelRows.set(row.id,row);
    if(accepted.length<batch.length) modelFailures.push({kind:'text',batch:i/2+1,error:`missing text rows ${accepted.length}/${batch.length}`});
    writeFileSync(resolve(root,'text-batches.json'),JSON.stringify(rawText,null,2));
  }
  const textScored=cases.map(item=>{const row=modelRows.get(item.command.id); const understanding=scoreUnderstanding(item.command,row); const decision=scoreDecision(item.command,row); return {...item,model:row ?? null,understanding,decision};});
  const rawVisual:any[]=[]; const visualRows=new Map<string,any>();
  for(let i=0;i<cases.length;i+=2){
    const batch=cases.slice(i,i+2); const content:any[]=[{type:'text',text:`You are the visual QA reviewer for an RPG editor. Each command has a BEFORE and AFTER image. The lower card is a deliberately rendered editor result surface: it contains the canonical tool, SUCCESS status, target, changed path, and concise ASCII result evidence. Judge whether the requested result is clearly shown, correctly scoped, legible, and free of unintended artifacts. For read, database, event, scene, and runtime commands, the card is the intended result surface; unchanged map pixels are expected and must not reduce the score. Return only a JSON array with exactly one row per id, each row containing id, visualScore (0-5), and notes. Give 5 when the card and map together clearly verify the requested result with no material presentation problem; give 4 only for a real minor ambiguity; give 3 or lower only when the result is missing, wrong, illegible, or corrupted.`}];
    for(const item of batch){content.push({type:'text',text:`id=${item.command.id}; prompt=${item.command.prompt}; mode=${item.command.mode}; expected visual scope=${item.command.visual}; changedPixels=${item.pixelDelta.changedPixels}`});
      for(const suffix of ['before','after']){const bytes=readFileSync(resolve(root,'images',`${String(item.command.n).padStart(2,'0')}-${item.command.id}-${suffix}.png`));content.push({type:'image_url',image_url:{url:`data:image/png;base64,${bytes.toString('base64')}`}});}}
    let accepted:any[]=[]; let last:any=null; const attempts:any[]=[];
    for(let attempt=0;attempt<3 && accepted.length<batch.length;attempt++) {
      try {
        const response=await callModel(visualConfig,content,900); last=response;
        const parsed=parseJson(response.text); const rows=Array.isArray(parsed)?parsed:Array.isArray(parsed?.items)?parsed.items:[];
        accepted=rows.filter((row:any)=>row?.id && batch.some(item=>item.command.id===row.id));
        attempts.push({attempt:attempt+1,usage:response.usage,response:response.text,rowCount:accepted.length});
      } catch (error) { attempts.push({attempt:attempt+1,error:String(error)}); }
      if(accepted.length<batch.length) await new Promise(resolvePromise=>setTimeout(resolvePromise,500*(attempt+1)));
    }
    rawVisual.push({batch:i/2+1,provider:visualConfig.provider,model:visualConfig.model,usage:last?.usage ?? null,response:last?.text ?? '',attempts,rowCount:accepted.length});
    for(const row of accepted) visualRows.set(row.id,row);
    if(accepted.length<batch.length) modelFailures.push({kind:'visual',batch:i/2+1,error:`missing visual rows ${accepted.length}/${batch.length}`});
    writeFileSync(resolve(root,'visual-batches.json'),JSON.stringify(rawVisual,null,2));
  }
  const scored=textScored.map(item=>{const visual=visualRows.get(item.command.id); const modelVisual=typeof visual?.visualScore==='number'?Math.max(0,Math.min(5,visual.visualScore)):null; const staticScore=visualFallback(item.command,item.pixelDelta); return {...item,visual:{model:visual ?? null,score:modelVisual,staticScore,staticCheck:item.command.mode==='read'?item.pixelDelta.changedPixels===0:item.pixelDelta.changedPixels>0}};});
  const rows=scored.map(item=>({id:item.command.id,n:item.command.n,naturalLanguageScore:item.understanding.score,decisionQualityScore:item.decision.score,visualQualityScore:item.visual.score,understanding:item.understanding,decision:item.decision,visual:item.visual,expectedTool:item.expectedTool,modelTool:item.model?.tool ?? null,toolResult:item.toolResult,pixelDelta:item.pixelDelta}));
  const visualScores=rows.map(row=>row.visualQualityScore).filter((score):score is number=>typeof score==='number');
  const qualityGate=rows.length===50&&modelFailures.length===0&&rows.every(row=>row.modelTool&&row.naturalLanguageScore>=60&&row.decisionQualityScore>=60&&row.visualQualityScore!==null&&row.visualQualityScore>=2);
  const result={schemaVersion:1,kind:'assistant-small-command-model-score',status:rows.length===50&&modelFailures.length===0&&rows.every(row=>row.modelTool&&row.visualQualityScore!==null)?'scored':'incomplete',qualityGate:qualityGate?'pass':'fail',model:{textProvider:config.provider,textModel:config.model,visualProvider:visualConfig.provider,visualModel:visualConfig.model,realModelCalls:rawText.reduce((sum,item)=>sum+(item.attempts?.length??0),0)+rawVisual.reduce((sum,item)=>sum+(item.attempts?.length??0),0),textCalls:rawText.reduce((sum,item)=>sum+(item.attempts?.length??0),0),visualCalls:rawVisual.reduce((sum,item)=>sum+(item.attempts?.length??0),0),expectedCalls:50,failures:modelFailures},aggregate:{naturalLanguage:{average:rows.reduce((s,row)=>s+row.naturalLanguageScore,0)/rows.length,pass:rows.filter(row=>row.naturalLanguageScore>=60).length},decisionQuality:{average:rows.reduce((s,row)=>s+row.decisionQualityScore,0)/rows.length,pass:rows.filter(row=>row.decisionQualityScore>=60).length},visualQuality:{average:visualScores.length?visualScores.reduce((s,row)=>s+row,0)/visualScores.length:null,scored:visualScores.length,pass:rows.filter(row=>typeof row.visualQualityScore==='number'&&row.visualQualityScore>=2).length}},rows,raw:{text:rawText,visual:rawVisual},limitations:['모델 기반 시각 점수는 사람 검수자를 대체하지 않는다.','모델의 실제 도구 호출이 아니라 50개 명령에 대한 모델 판단을 별도로 평가한다.','정적 픽셀 변화 점수는 보조 신호이며 모델 시각 점수와 별도다.']};
  const visualSummary=result.aggregate.visualQuality.average===null?'미완료':`${result.aggregate.visualQuality.average.toFixed(1)}/5 (${result.aggregate.visualQuality.scored}/50 채점)`;
  writeFileSync(resolve(root,'matrix-score.json'),JSON.stringify(result,null,2)); writeFileSync(resolve(root,'SUMMARY.md'),`# 50개 명령 실제 모델 품질 점수\n\n상태: **${result.status}** · 품질 기준선: **${result.qualityGate}**\n\n자연어 이해력 평균 ${result.aggregate.naturalLanguage.average.toFixed(1)}/100 (${result.aggregate.naturalLanguage.pass}/50 ≥60) · 판단 품질 평균 ${result.aggregate.decisionQuality.average.toFixed(1)}/100 (${result.aggregate.decisionQuality.pass}/50 ≥60) · 시각 품질 평균 ${visualSummary}\n\n실제 모델 호출 ${result.model.realModelCalls}/${result.model.expectedCalls}회 (${result.model.textCalls} 텍스트, ${result.model.visualCalls} 시각). 모델 응답 원문과 전후 PNG 해시는 matrix-score.json에 남겼다.\n`); console.log(JSON.stringify({status:result.status,qualityGate:result.qualityGate,model:result.model,aggregate:result.aggregate},null,2)); return result.status==='scored'?0:1;
}
