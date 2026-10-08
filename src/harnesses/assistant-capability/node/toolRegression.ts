import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createCapabilityFixtureProject } from './capabilityFixture';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { DEFAULT_TILESET_ID, TILE } from '../../../project/defaults/constants';
import { runTool } from '../../../editor/tools/toolRunner';
import { runSceneTest } from '../../../testing/sceneTestRunner';
import { buildPiAgentSystemPrompt } from '../../../ai/piAgent/systemPrompt';
import { COMMAND_SCHEMA } from '../../../editor/tools/schemaShapes';
import { friendlyExecutionError } from '../../../ai/piAgent/userFacingCopy';

/** Deterministic product controls, separate from native model success measurements. */
export function checkTools(root: string): number {
  const checks: { id: string; ok: boolean; detail?: string }[] = [];
  const record = (id: string, ok: boolean, detail?: string) => checks.push({ id, ok, detail });
  const make = () => {
    const project = createCapabilityFixtureProject();
    const original = project.maps[project.startMapId]!;
    const map = createBlankMap('control', 24, 18, DEFAULT_TILESET_ID);
    map.id = project.startMapId;
    map.events = [structuredClone(original.events.find(e => e.id === 'ev_ember_child')!)];
    map.events[0]!.x = 8; map.events[0]!.y = 7;
    map.lowerTiles[3 * map.width + 3] = 290;
    map.upperTiles[2 * map.width + 3] = TILE.EMPTY;
    project.maps[map.id] = map;
    project.startPos = { x: 8, y: 8 };
    return { project };
  };
  const trials = [
    { name: 'move_event', args: { mapId: 'map_ember_village', eventId: 'ev_ember_child', x: 9, y: 7 } },
    { name: 'set_map_properties', args: { mapId: 'map_ember_village', name: 'renamed' } },
    { name: 'upsert_event', args: { mapId: 'map_ember_village', event: { id: 'ev_ember_child', name: 'renamed' } } },
    { name: 'upsert_item', args: { item: { id: 'item_potion', price: 30 } } },
    { name: 'patch_event_page', args: { mapId: 'map_ember_village', eventId: 'ev_ember_child', pageIndex: 0, set: { name: 'renamed' } } },
  ];
  for (const { name, args } of trials) {
    const ctx = make(), before = structuredClone(ctx.project);
    const result = runTool(ctx, name, args);
    record(`${name}:executes`, result.ok, result.summary);
    for (const [id, map] of Object.entries(before.maps)) {
      const after = ctx.project.maps[id]!;
      record(`${name}:${id}:raster-preserved`, isDeepStrictEqual(map.lowerTiles, after.lowerTiles) && isDeepStrictEqual(map.upperTiles, after.upperTiles));
      if (id !== before.startMapId) record(`${name}:${id}:document-preserved`, isDeepStrictEqual(map, after));
    }
  }
  for (const dryRun of [false, true]) {
    const ctx = make(), before = structuredClone(ctx.project);
    const result = runTool(ctx, 'paint_tiles', { mapId: ctx.project.startMapId, layer: 'lower', mode: 'cells', tile: 290, cells: [{ x: 5, y: 5 }] }, { dryRun });
    record(`paint:${dryRun}:executes`, result.ok, result.summary);
    record(`paint:${dryRun}:other-maps-preserved`, Object.entries(before.maps).filter(([id]) => id !== before.startMapId).every(([id, map]) => isDeepStrictEqual(map, ctx.project.maps[id])));
    // 합본 마을 칩셋의 290→260 윗층 자동 보정 검사는 칩셋과 함께 지웠다(2026-10-07).
    if (dryRun) record(`paint:${dryRun}:dryrun-unchanged`, isDeepStrictEqual(before, ctx.project));
  }
  for (const cancelBehavior of ['branch', 'choice1', 'choice2', 'disallow', 'choice5', undefined] as const) {
    const ctx = make(), map = ctx.project.maps[ctx.project.startMapId]!;
    map.events[0]!.pages![0]!.commands = [{ kind: 'choices', cancelBehavior, cancelBranch: [], options: [
      { text: '동문', branch: [{ kind: 'changeGold', op: '+=', amount: 25 }] },
      { text: '여관', branch: [] },
    ] }];
    const beforeGold = ctx.project.session.gold;
    const result = runSceneTest(ctx.project, { mapId: map.id, start: { x: 8, y: 8 }, steps: [
      { kind: 'face', dir: 'up' }, { kind: 'interact', eventId: 'ev_ember_child' }, { kind: 'choose', index: -1 },
    ] });
    const allowed = cancelBehavior === 'branch' || cancelBehavior === 'choice1' || cancelBehavior === 'choice2';
    record(`cancel:${cancelBehavior}:semantics`, result.ok === allowed && result.finalState.gold === beforeGold + (cancelBehavior === 'choice1' ? 25 : 0), result.failureReason);
  }
  record('choice:writer-contract', buildPiAgentSystemPrompt(make().project, []).some(s => s.includes('cancelBehavior:"branch",cancelBranch:[]') && s.includes('index:-1')));
  record('choice:tool-contract', String(COMMAND_SCHEMA.properties?.cancelBehavior?.description).includes('choice1~choice5'));
  record('error:provider-message', friendlyExecutionError('Generation failed with finish reason: PROHIBITED_CONTENT').includes('답변을 끝까지 받지 못했어요'));
  const outcome = { schemaVersion: 1, kind: 'product-regression-controls', pass: checks.every(c => c.ok), checks };
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, 'tool-regression.json'), JSON.stringify(outcome, null, 2));
  console.log(JSON.stringify(outcome, null, 2));
  return outcome.pass ? 0 : 1;
}

/** A strict follow-up audit, not a success calibration or model trial. */
export function discoverTools(root: string): number {
  const project=createCapabilityFixtureProject(),map=createBlankMap('scope sentinel',24,18,DEFAULT_TILESET_ID);
  map.id=project.startMapId;project.maps[map.id]=map;
  map.lowerTiles[3*map.width+3]=290;
  map.upperTiles[2*map.width+3]=TILE.EMPTY;
  const before=structuredClone(project),ctx={project};
  const result=runTool(ctx,'paint_tiles',{mapId:map.id,layer:'upper',mode:'cells',tile:TILE.FLOWERS,cells:[{x:8,y:8}]});
  const changed=[];
  for(const [id,old] of Object.entries(before.maps))for(const layer of ['lowerTiles','upperTiles'] as const) {
    const next=ctx.project.maps[id]!;
    for(let i=0;i<old[layer].length;i++)if(old[layer][i]!==next[layer][i])changed.push({mapId:id,layer,x:i%old.width,y:Math.floor(i/old.width),before:old[layer][i],after:next[layer][i]});
  }
  const unexpected=changed.filter(c=>c.mapId!==map.id||c.x!==8||c.y!==8);
  const outcome={schemaVersion:1,kind:'post-merge-tool-discovery',modelCalls:0,tool:result.summary,toolOk:result.ok,
    requested:{mapId:map.id,x:8,y:8,tile:TILE.FLOWERS},changed,unexpected,
    status:!result.ok?'blocked':unexpected.length?'fail':'pass',
    interpretation:'도구 수준 검사. 다른 맵 보존 수정 이후에도 같은 맵의 요청하지 않은 기존 나무를 수선하는지 검사한다. 실모델 성공률에 넣지 않는다.'};
  mkdirSync(root,{recursive:true});writeFileSync(resolve(root,'post-merge-tool-audit.json'),JSON.stringify(outcome,null,2));
  console.log(JSON.stringify(outcome,null,2));return outcome.status==='pass'?0:1;
}
