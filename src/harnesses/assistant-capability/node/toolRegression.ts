import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { createEmberQuestProject } from '../../../project/defaults/emberQuestGame';
import { createBlankMap } from '../../../project/defaults/defaultMaps';
import { COMBINED_TOWN_TILESET_ID, TILE } from '../../../project/defaults/constants';
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
    const project = createEmberQuestProject();
    const original = project.maps[project.startMapId]!;
    const map = createBlankMap('control', 24, 18, COMBINED_TOWN_TILESET_ID);
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
    record(`paint:${dryRun}:repair-or-dryrun`, dryRun ? isDeepStrictEqual(before, ctx.project) : ctx.project.maps[before.startMapId]!.upperTiles[4 * 24 + 5] === 260);
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
