import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createCapabilityFixtureProject, CAPABILITY_MAP_ID, fixtureEvent } from './capabilityFixture';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { DEFAULT_TILESET_ID, TILE } from '../../../project/defaults/constants';
import { runTool } from '../../../editor/tools/toolRunner';
import { store } from '../../../project/store';
import { recordProjectSnapshot } from '../../../editor/mapEditHistory';
import type { Project, GameEvent, Command } from '../../../project/types';

const mapId = CAPABILITY_MAP_ID;
const childId = 'ev_ember_child';
const innId = 'ev_ember_inn';

function clone<T>(value: T): T { return structuredClone(value); }
function json(value: unknown): string { return JSON.stringify(value); }
function addMap(project: Project, id: string, name: string): void {
  const map = createBlankMap(name, 24, 18, DEFAULT_TILESET_ID); map.id = id;
  project.maps[id] = map;
  project.mapTree.children?.push({ mapId: id, children: [] });
}
function page(project: Project, eventId = childId, index = 0) {
  const event = project.maps[mapId]!.events.find(e => e.id === eventId)!;
  return event.pages![index]!;
}
function addUtilityEvents(project: Project): void {
  const map = project.maps[mapId]!;
  const base = clone(fixtureEvent(childId));
  base.id = 'ev_utility_npc'; base.x = 18; base.y = 8;
  base.pages = [clone(base.pages![0]!)]; base.pages[0]!.id = 'utility_page';
  base.pages[0]!.name = '테스트 NPC'; base.pages[0]!.commands = [
    { kind: 'text', speaker: '테스트 NPC', body: '첫 대사' } as Command,
    { kind: 'moveEvent', eventId: 'ev_utility_npc', route: { moves: [{ kind: 'move', dir: 'up' }], repeat: false } } as Command,
    { kind: 'choices', options: [{ text: '예', branch: [] }, { text: '아니오', branch: [] }], cancelBehavior: 'branch', cancelBranch: [] } as Command,
  ];
  map.events.push(base);
  const door = clone(fixtureEvent('ev_ember_gate_a')); door.id = 'ev_test_door'; door.x = 20; door.y = 8; map.events.push(door);
  const shop = clone(fixtureEvent(innId)); shop.id = 'ev_test_shop'; shop.x = 10; shop.y = 8; map.events.push(shop);
  const cut = clone(fixtureEvent(childId)); cut.id = 'ev_test_cutscene'; cut.x = 16; cut.y = 8;
  cut.pages = [clone(cut.pages![0]!)]; cut.pages[0]!.id='cut_page'; cut.pages[0]!.commands = [
    { kind: 'text', body: '장면' } as Command,
    { kind: 'm2Command', commandId: 'm2-044-hide-screen', fields: {} } as Command,
    { kind: 'wait', ms: 300 } as Command,
    { kind: 'm2Command', commandId: 'm2-045-show-screen', fields: {} } as Command,
  ]; map.events.push(cut);
  const shopPage = map.events.find(event => event.id === 'ev_test_shop')?.pages?.[0];
  shopPage?.commands.push({ kind:'shop', itemIds:['item_herb'], stock:[{itemId:'item_herb',seasons:['spring']}], allowSell:true, quantityMode:'select', shopType:'normal', messageType:'welcome' } as Command);
}
export function richProject(): Project {
  const project = createCapabilityFixtureProject();
  addMap(project, 'map_plaza', '광장'); addMap(project, 'map_field', '숲길'); addMap(project, 'map_interior', '집 안');
  addUtilityEvents(project);
  project.database.items.push({ id: 'item_herb', name: '약초', description: '회복 재료', price: 12, type: 'item' } as any);
  project.database.items.push({ id: 'item_key', name: '열쇠', description: '문을 여는 열쇠', price: 0, type: 'keyItem' } as any);
  const sword = project.database.equipment?.find((e:any)=>e.id==='equip_iron_sword');
  if (!sword) project.database.equipment.push({ id:'equip_iron_sword', name:'철검', type:'weapon', price:100, statBonuses:{attack:5} } as any);
  project.switches.push({id:'sw_unused',name:'미사용 스위치'});
  project.startPos = {x:8,y:8};
  const map = project.maps[mapId]!;
  map.lowerTiles[1 + map.width] = TILE.EMPTY;
  map.lowerTiles[2 + map.width] = TILE.GRASS;
  map.lowerTiles[2 + 2 * map.width] = TILE.EMPTY;
  return project;
}
function ctx(project: Project) { return { project, currentMapId: mapId, assistantRun: false } as any; }
function diff(before: Project, after: Project): boolean { return !isDeepStrictEqual(before, after); }
function writeRun(project: Project, tool: string, args: Record<string, unknown>): { ok: boolean; changed: boolean; result: any } {
  const before = clone(project); const context = ctx(project); const result = runTool(context, tool, args); return { ok: result.ok, changed: diff(before, context.project), result };
}
function readRun(project: Project, tool: string, args: Record<string, unknown>): { ok: boolean; unchanged: boolean; result: any } {
  const before = clone(project); const context = ctx(project); const result = runTool(context, tool, args); return { ok: result.ok, unchanged: isDeepStrictEqual(before, context.project), result };
}
function patchArgs(project: Project, set: Record<string, unknown>, eventId = 'ev_utility_npc', pageIndex = 0) {
  return { mapId, eventId, pageIndex, set };
}

export function runMatrixTools(root: string): number {
  const checks: Array<{n:number; id:string; tool:string; ok:boolean; detail?:string}> = [];
  const record = (n:number,id:string,tool:string,ok:boolean,detail?:string) => checks.push({n,id,tool,ok,detail});
  const run = (n:number,id:string,tool:string,args:Record<string,unknown>, kind:'read'|'write'='write') => {
    console.error(`[matrix-tools] #${n} ${id} -> ${tool}`);
    const project = richProject();
    const out = kind==='read' ? readRun(project,tool,args) : writeRun(project,tool,args);
    const ok = out.ok && (kind==='read' ? out.unchanged : out.changed);
    record(n,id,tool,ok,out.result?.summary ?? '');
  };
  run(1,'map-name-size','get_project_summary',{},'read');
  run(2,'find-entrances','find_events',{mapId,commandKind:'transfer'},'read');
  run(3,'blocked-cells','get_map_region',{mapId,x:0,y:0,w:5,h:5},'read');
  run(4,'event-list','find_events',{mapId},'read');
  run(5,'region-preview','show_map_region',{mapId,x:0,y:0,w:5,h:5},'read');
  run(6,'paint-dirt','paint_tiles',{mapId,layer:'lower',mode:'cells',tile:TILE.GRASS,cells:[{x:2,y:2},{x:3,y:2}]});
  run(7,'clear-region','clear_region',{mapId,x:2,y:2,w:3,h:2,layer:'both',fill:'empty'});
  run(8,'copy-region','copy_map_region',{from:{mapId,x:1,y:1,w:2,h:2},to:{mapId,x:5,y:5},layers:'all'});
  run(9,'mirror-region','mirror_region',{mapId,x:2,y:2,w:4,h:2,axis:'horizontal'});
  run(10,'move-start','set_start_position',{mapId,x:9,y:8});
  run(11,'place-trees','paint_tiles',{mapId,layer:'upper',mode:'cells',tile:TILE.FLOWERS,cells:[{x:3,y:3},{x:5,y:3},{x:7,y:3}]});
  run(12,'place-chest','place_chest',{mapId,x:4,y:4,contents:{itemId:'item_potion',gold:10},id:'ev_test_chest'});
  run(13,'move-door','move_event',{mapId,eventId:'ev_test_door',x:19,y:8});
  run(14,'remove-barrels','remove_event',{mapId,eventId:'ev_test_door'});
  run(15,'place-well','place_props',{mapId,area:{x:3,y:3,w:4,h:3},material:'버들항 장소 · 우물',count:1,seed:4});
  const moveCommand = {kind:'moveEvent',eventId:'ev_utility_npc',route:{moves:[{kind:'move',dir:'up'}],repeat:false}};
  run(16,'change-first-line','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',speaker:'테스트 NPC',body:'바뀐 대사'},moveCommand,{kind:'choices',options:[{text:'예',branch:[]},{text:'아니오',branch:[]}],cancelBehavior:'branch',cancelBranch:[]}]}));
  run(17,'add-switch-condition','patch_event_page',patchArgs(richProject(),{conditions:[{kind:'switch',switchId:'sw_ember_q1_started',value:true}],commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},moveCommand,{kind:'choices',options:[{text:'예',branch:[]},{text:'아니오',branch:[]}],cancelBehavior:'branch',cancelBranch:[]}]}));
  run(18,'remove-move-command','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},{kind:'choices',options:[{text:'예',branch:[]},{text:'아니오',branch:[]}],cancelBehavior:'branch',cancelBranch:[]}]}));
  run(19,'insert-se','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},{kind:'playAudio',resourceId:'cc0-se-osx-door-open',loop:false},{kind:'choices',options:[{text:'예',branch:[]},{text:'아니오',branch:[]}],cancelBehavior:'branch',cancelBranch:[]}]}));
  run(20,'touch-trigger','patch_event_page',patchArgs(richProject(),{trigger:{kind:'playerTouch'}}));
  run(21,'rename-npc','patch_event_page',patchArgs(richProject(),{name:'하린'}));
  run(22,'face-right','patch_event_page',patchArgs(richProject(),{graphic:{sprite:{type:'bundled',id:'tex_easyrpg_charset_people3'},direction:'right',pattern:31}}));
  run(23,'add-npc-line','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',speaker:'테스트 NPC',body:'첫 대사'},moveCommand,{kind:'choices',options:[{text:'예',branch:[]},{text:'아니오',branch:[]}],cancelBehavior:'branch',cancelBranch:[]},{kind:'text',speaker:'테스트 NPC',body:'추가 대사'}]}));
  run(24,'npc-schedule','set_npc_schedule',{mapId,eventId:'ev_utility_npc',schedule:[{when:{hourRange:[8,18]},at:{mapId,x:12,y:8},activity:'work'}]});
  run(25,'npc-shop','set_shop_stock',{mapId,eventId:'ev_test_shop',stock:[{itemId:'item_herb',seasons:['spring']},{itemId:'item_potion',seasons:['spring'],priceOverride:20}]});
  run(26,'potion-price','upsert_item',{item:{id:'item_potion',price:30}});
  run(27,'sword-attack','upsert_equipment',{equipment:{id:'equip_iron_sword',statBonuses:{attack:10}}});
  run(28,'item-description','upsert_item',{item:{id:'item_potion',description:'회복하는 물약'}});
  run(29,'create-key-item','upsert_item',{item:{id:'item_new_key',name:'새 열쇠',description:'잠긴 문을 연다',type:'keyItem',price:0}});
  run(30,'remove-shop-herb','set_shop_stock',{mapId,eventId:'ev_test_shop',stock:[{itemId:'item_potion',seasons:['spring'],priceOverride:20}]});
  run(31,'screen-shake','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',body:'장면'},{kind:'m2Command',commandId:'m2-048-shake-screen',fields:{intensity:'3',durationMs:300,direction:'both'}}]},'ev_test_cutscene'));
  run(32,'dialogue-position','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',body:'장면',position:'bottom'}]},'ev_test_cutscene'));
  run(33,'door-se','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',body:'문이 열립니다'},{kind:'playAudio',resourceId:'cc0-se-osx-door-open',loop:false}]},'ev_test_door'));
  run(34,'night-mood','set_scene_mood',{mapId,weather:{kind:'none'},lighting:{ambient:0.25,color:'#101522',sources:[]}});
  run(35,'remove-final-fade','patch_event_page',patchArgs(richProject(),{commands:[{kind:'text',body:'장면'},{kind:'m2Command',commandId:'m2-044-hide-screen',fields:{}},{kind:'wait',ms:300}]},'ev_test_cutscene'));
  run(36,'walkability-check','check_reachability',{mapId,from:{x:8,y:8},targets:[{x:9,y:8}]},'read');
  run(37,'event-playtest','run_scene_test',{mapId,start:{x:18,y:8},steps:[{kind:'interact',eventId:'ev_utility_npc'}]},'read');
  run(38,'blocked-entrance','find_events',{mapId,commandKind:'transfer'},'read');
  run(39,'unused-switches','find_switch_usage',{switchId:'sw_unused'},'read');
  run(40,'undo-preview','list_edit_history',{mapId,limit:5},'read');
  run(41,'door-to-plaza','link_maps',{from:{mapId,x:20,y:8},to:{mapId:'map_plaza',x:2,y:2},bidirectional:true});
  run(42,'align-portals','link_maps',{from:{mapId,x:18,y:8},to:{mapId:'map_field',x:2,y:2},bidirectional:true});
  run(43,'worldmap-north','plan_world',{nodes:[{mapId,role:'town',label:'마을'},{mapId:'map_plaza',role:'field',label:'광장'}],edges:[{from:{mapId,exit:'north'},to:{mapId:'map_plaza',entry:'south'},kind:'transfer'}]});
  run(44,'unreachable-links','lint_world',{},'read');
  run(45,'forest-path','paint_road',{mapId,style:'dirt',points:[{x:2,y:10},{x:8,y:10}],seed:2});
  run(46,'summarize-diff','list_edit_history',{mapId,limit:10},'read');
  run(47,'show-tool-log','list_edit_history',{mapId,limit:10},'read');
  { const project=richProject(); store.replace(project); recordProjectSnapshot('matrix baseline'); const changed=clone(project); changed.maps[mapId]!.name='임시 이름'; store.replace(changed); const context=ctx(store.getCurrent()); const out=runTool(context,'revert_last_edit',{}); record(48,'rewind-turn','revert_last_edit',out.ok,out.summary); }
  run(49,'plan-only','get_project_summary',{},'read');
  run(50,'suggest-selection-actions','find_empty_ground',{mapId,limit:4},'read');
  const pass = checks.filter(c=>c.ok).length;
  const outcome = { schemaVersion:1, kind:'assistant-small-command-tool-contract', coverage:'deterministic-tool-contract', execution:{performed:true,modelCalls:0,sqliteReloads:0,runtimeRuns:0,visualReviews:0}, total:checks.length, pass, fail:checks.length-pass, status:pass===50?'pass':'fail', checks };
  mkdirSync(resolve(root),{recursive:true}); writeFileSync(resolve(root,'SUMMARY.md'),`# 50개 작은 명령 도구 계약\n\n상태: **${outcome.status}**\n\n${pass}/50 통과. 실제 모델 호출·SQLite 재로드·플레이·독립 시각 검수는 이 단계의 범위 밖이며 0건으로 기록했습니다.\n`); writeFileSync(resolve(root,'matrix-tools.json'),JSON.stringify(outcome,null,2)); console.log(JSON.stringify(outcome,null,2)); return outcome.status==='pass'?0:1;
}
