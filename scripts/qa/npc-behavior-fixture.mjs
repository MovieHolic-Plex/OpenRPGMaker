// QA-only memory copies. No content-store or remote persistence calls.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_MAP = 'npc_qa_source';
export const ARRIVAL_MAP = 'npc_qa_arrival';
export const PURSUER = 'npc_qa_pursuer';
export const TRAINER = 'npc_qa_trainer';
export const PAGE = 'npc_qa_page';
export const VICTORY = 'sw_0001';
export const COMMANDS = 'var_0001';
export const FLOOR = 240;
export const WALL = 46;

function event(id, x, y, patch = {}) {
  return { id, x, y, trigger: { kind: 'action' }, commands: [], pages: [{
    id: PAGE, name: id, conditions: [],
    graphic: { sprite: { type: 'bundled', id: 'tex_easyrpg_charset_people2' }, direction: 'right', pattern: 25 },
    trigger: { kind: 'action' }, priority: 'same', overlapForbidden: true,
    movement: { type: 'fixed', speed: 3, frequency: 3 }, commands: [], ...patch,
  }] };
}

export async function makeFixture(kind, root = process.env.NPC_QA_ROOT ?? fileURLToPath(new URL('../../', import.meta.url))) {
  const p = JSON.parse(await readFile(resolve(root, 'test/fixtures/projects/editor-authored-demo-v3.json'), 'utf8'));
  p.meta.title = `NPC acceptance: ${kind}`;
  const tilesetId = p.maps[p.startMapId].tilesetId;
  const tileset = p.tilesets[tilesetId];
  tileset.passability[FLOOR] = { up: true, down: true, left: true, right: true };
  tileset.passability[WALL] = { up: false, down: false, left: false, right: false };
  tileset.priority[FLOOR] = 'lower'; tileset.priority[WALL] = 'lower';
  function map(id) {
    const m = { id, name: id, width: 16, height: 12, tilesetId, tileSize: 16,
      lowerTiles: Array(192).fill(FLOOR), upperTiles: Array(192).fill(-1), events: [],
      bgm: { mode: 'none' } };
    for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
      if (x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1) m.lowerTiles[y * m.width + x] = WALL;
    }
    return m;
  }
  const source = map(SOURCE_MAP), arrival = map(ARRIVAL_MAP);
  p.maps = { [SOURCE_MAP]: source, [ARRIVAL_MAP]: arrival };
  p.startMapId = SOURCE_MAP;
  p.mapTree = { mapId: SOURCE_MAP, children: [{ mapId: ARRIVAL_MAP, children: [] }] };
  p.mapConnections = [];
  p.commonEvents = [];
  p.villageInfoDocuments = [];
  p.system.startActorIds = ['actor_hero'];
  p.system.battleUiStyle = 'retro2003';
  // Explicit silence survives normalization; omission would restore the default streamed BGM.
  p.system.defaultBgmResourceId = '';
  p.system.battleBgmResourceId = '';
  p.session.partyActorIds = ['actor_hero'];
  p.session.switches[VICTORY] = false;
  p.session.variables[COMMANDS] = 0;
  const troop = p.database.troops.find(t => t.id === 'troop_slime');
  troop.trainerBattle = true;
  troop.members = [troop.members[0]];
  troop.enemyIds = [troop.members[0].enemyId];
  troop.battleEventPages = [];
  const enemy = p.database.enemies.find(e => e.id === troop.enemyIds[0]);
  enemy.stats = { ...enemy.stats, maxHp: 1, defense: 0, agility: 1 };
  enemy.rewards = { exp: 0, gold: 0, dropRatePercent: 0 };
  enemy.actions = [enemy.actions[0]];
  const battle = { kind: 'battleProcessing', troopId: troop.id, canEscape: false, canLose: false,
    battleFlow: 'strict', branchOnResult: true,
    victoryBranch: [{ kind: 'setSwitch', switchId: VICTORY, value: true }] };
  const commands = [{ kind: 'setVariable', variableId: COMMANDS, op: '+=', value: 1 }, battle];
  const detectionEncounter = { sight: { range: 8, lineOfSight: true, facing: 'forward' },
    emote: 'exclamation', emoteMs: 800, approachSpeed: 3 };
  const trainer = event(TRAINER, 3, 5, { detectionEncounter, commands });
  source.events = [trainer];
  p.startPos = { x: 7, y: 6 }; // Outside the forward ray; one real ArrowUp enters it.

  if (kind === 'behind') p.startPos = { x: 1, y: 6 };
  if (kind === 'manual-first') p.startPos = { x: 3, y: 6 };
  if (kind === 'editor') {
    delete trainer.pages[0].detectionEncounter;
    trainer.pages[0].commands = [];
  }
  if (kind === 'wall') source.lowerTiles[5 * source.width + 5] = WALL;
  if (kind === 'two-trainers') source.events.push(event('npc_qa_second', 11, 5, {
    // Both compete through approach/battle; the victory branch ends this encounter group.
    // A later independent second encounter is not the simultaneous-ownership contract.
    conditions: [{ kind: 'switch', switchId: VICTORY, value: false }],
    graphic: { ...trainer.pages[0].graphic, direction: 'left' }, detectionEncounter: structuredClone(detectionEncounter),
    commands: [{ kind: 'setVariable', variableId: 'var_0002', op: '+=', value: 1 }],
  }));
  if (kind === 'blocked-approach') {
    // Detection is intentionally through terrain; physical approach must still fail.
    trainer.pages[0].detectionEncounter.sight.lineOfSight = false;
    for (let y = 1; y < 11; y++) source.lowerTiles[y * source.width + 5] = WALL;
  }
  if (kind === 'external-map') {
    trainer.pages[0].commands = [
      { kind: 'text', body: 'Cancel this dialogue when the host replaces the map.' },
      { kind: 'setVariable', variableId: COMMANDS, op: '+=', value: 1 },
    ];
  }
  if (kind === 'inactive-paged-parallel') {
    delete trainer.pages[0].detectionEncounter;
    trainer.trigger = { kind: 'parallel' };
    trainer.commands = trainer.pages[0].commands;
    trainer.pages[0].trigger = { kind: 'parallel' };
    trainer.pages[0].conditions = [{ kind: 'switch', switchId: 'sw_0002', value: true }];
    p.session.switches.sw_0002 = false;
  }
  if (kind === 'authored-transfer') {
    trainer.pages[0].commands = [
      { kind: 'transfer', mapId: ARRIVAL_MAP, x: 2, y: 4, fade: 'none' },
      { kind: 'setVariable', variableId: COMMANDS, op: '+=', value: 1 },
    ];
  }
  if (kind === 'parallel-battle' || kind === 'legacy-parallel-battle') {
    delete trainer.pages[0].detectionEncounter;
    trainer.pages[0].trigger = { kind: 'parallel' };
    trainer.pages[0].conditions = [{ kind: 'switch', switchId: 'sw_0002', value: true }];
    trainer.pages[0].commands = [battle,
      { kind: 'setVariable', variableId: COMMANDS, op: '+=', value: 1 },
      { kind: 'setSwitch', switchId: 'sw_0002', value: false }];
    if (kind === 'legacy-parallel-battle') {
      trainer.trigger = { kind: 'parallel' };
      trainer.condition = { kind: 'switch', switchId: 'sw_0002', value: true };
      trainer.commands = trainer.pages[0].commands;
      trainer.sprite = trainer.pages[0].graphic.sprite;
      delete trainer.pages;
    }
    source.events.push(event('npc_qa_start', 7, 5, { commands: [{ kind: 'setSwitch', switchId: 'sw_0002', value: true }] }));
  }
  if (kind === 'pursuit') {
    p.startPos = { x: 7, y: 4 };
    source.events = [event(PURSUER, 3, 4, {
      movement: { type: 'chase', speed: 2, frequency: 6, moveIntervalMs: 250,
        sightRange: 12, sight: { range: 12, lineOfSight: true, facing: 'any' }, pathfind: true,
        pursuit: { scope: 'connected', tracking: 'lastSeen', doorDelayMs: 1200, searchMs: 6000, onLost: 'wait' } },
      trigger: { kind: 'eventTouch' }, commands: [{ kind: 'setSwitch', switchId: 'sw_0003', value: true }],
    }), event('npc_qa_door', 9, 7, { graphic: {}, priority: 'below', overlapForbidden: false,
      trigger: { kind: 'playerTouch' }, commands: [{ kind: 'transfer', mapId: ARRIVAL_MAP, x: 2, y: 4, direction: 'down', fade: 'none' }] })];
    // Walk east above this corner, then south behind it before taking the door.
    source.lowerTiles[5 * source.width + 8] = WALL;
    source.lowerTiles[6 * source.width + 8] = WALL;
    arrival.events = [event('npc_qa_hide', 2, 7, { interaction: { kind: 'hiding' } })];
  }
  return p;
}
