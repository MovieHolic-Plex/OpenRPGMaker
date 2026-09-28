// Run from this checkout: npx tsx --tsconfig tsconfig.app.json scripts/qa/probe-npc-command-moves.ts
// Reproduction of the command/schedule review; no project persistence.
import { Window } from 'happy-dom';
const win = new Window();
Object.assign(globalThis, { window: win, document: win.document, localStorage: win.localStorage });
const { createBlankProject, createBlankMap } = await import('@/project/defaults');
const { startSession } = await import('@/project/session');
const { store } = await import('@/project/store');
const { registerAutonomousMover, updateParallelEvents } = await import('@/player/playSceneSchedulers');
const { updateAutonomousNPCs } = await import('@/player/playSceneAutonomous');
const { playPathfindMove, planPathfindMove } = await import('@/player/playScenePathfinding');
const { canNpcMove } = await import('@/player/playSceneAutonomousMapActions');
const { registerPageMoveRoutes } = await import('@/player/playScenePageMoveRoutes');
const { updateNpcSchedules } = await import('@/player/npcSchedules');
const { playerPassageRect, resolvePlayerBody } = await import('@/project/playerFootprint');
const { initialRuntimeEventPositions } = await import('@/project/runtimeEventState');
function ev(id: string, x: number, y: number) { return { id, x, y, trigger: { kind: 'action' }, commands: [], pages: [{ id: 'p', conditions: [], graphic: {}, trigger: { kind: 'action' }, priority: 'same', movement: { type: 'fixed', speed: 4, frequency: 8 }, commands: [] }] }; }
let frames = new Map<number, Function>(), fid = 0;
globalThis.requestAnimationFrame = cb => { frames.set(++fid, cb); return fid; };
globalThis.cancelAnimationFrame = id => { frames.delete(id); };
function fixture(w = 7, h = 5, events: any[] = [ev('a', 1, 1)]) {
    frames.clear();
    const p: any = createBlankProject();
    const base: any = Object.values(p.tilesets)[0];
    p.tilesets.t = { ...base, id: 't', count: 2, passability: [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }], priority: ['lower', 'lower'], ledgeDirections: undefined };
    const m: any = { ...createBlankMap('m', w, h, 't'), id: 'm', lowerTiles: Array(w * h).fill(0), upperTiles: Array(w * h).fill(-1), events };
    p.maps = { m };
    p.startMapId = 'm';
    store.replace(p);
    const s: any = { map: m, session: startSession(p), eventPositions: initialRuntimeEventPositions(events), autonomousNPCs: new Map(), commandMoveRouteEventIds: new Set(), eventSprites: new Map(), runtimeDom: { upsertEventMarker() { } }, runEvent: async () => { }, tileX: w - 1, tileY: h - 1, moving: false, movingTo: { x: w - 1, y: h - 1 }, refreshRuntimeSurfaces() { }, syncRuntimeState() { } };
    s.registerAutonomousMover = (id: string, moves: any[], repeat: boolean) => registerAutonomousMover(s, id, moves, repeat);
    return { p, m, s };
}
function tick(s: any, n = 100, dt = 100) { for (let i = 0; i < n; i++) {
    updateAutonomousNPCs(s, dt);
    const q = [...frames.values()];
    frames.clear();
    q.forEach(cb => cb(0));
} }
const step = (target: string, x: number, y: number, extra = {}) => ({ kind: 'pathfindMove', target, x, y, speed: 4, wait: true, ...extra }) as any;
function log(name: string, value: any) { console.log(name, JSON.stringify(value)); }
{
    const { s } = fixture(7, 5, [ev('a', 1, 1), ev('b', 1, 3)]);
    const a = playPathfindMove(s, step('a', 3, 1, { resultVariableId: 'a' }));
    const b = playPathfindMove(s, step('b', 3, 3, { resultVariableId: 'b' }));
    tick(s);
    log('concurrent', { results: await Promise.all([a, b]), positions: s.eventPositions, vars: s.session.variables });
}
{
    const { s, m } = fixture(5, 5);
    m.lowerTiles.fill(1);
    m.lowerTiles[1 * 5 + 1] = 0;
    log('isolated-blocked', await playPathfindMove(s, step('a', 3, 3)));
}
{
    const { s, p } = fixture(7, 5, [ev('a', 4, 2)]);
    s.tileX = 2;
    s.tileY = 2;
    s.session.playerFootprint = { width: 2, height: 1 };
    s.session.playerPassRows = 1;
    s.registerAutonomousMover('a', [{ kind: 'move', dir: 'left' }], false);
    s.commandMoveRouteEventIds.add('a');
    const planned = planPathfindMove(s, step('a', 3, 2));
    tick(s);
    log('player-body', { player: playerPassageRect(resolvePlayerBody(p, s.session), 2, 2), planned, actual: s.eventPositions.a });
}
{
    const { s, p, m } = fixture(7, 5, [ev('a', 1, 1)]);
    p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    m.events[0].schedule = [{ when: {}, at: { mapId: 'm', x: 3, y: 1 } }];
    store.replace(p);
    updateNpcSchedules(s);
    tick(s, 30);
    log('schedule-arrival', s.session.eventLocations.a);
    s.tileX = 2;
    s.tileY = 1;
    s.registerAutonomousMover('a', [{ kind: 'moveTowardPlayer' }], false);
    s.commandMoveRouteEventIds.add('a');
    tick(s, 10);
    log('toward-after-schedule', { player: [2, 1], stale: s.eventPositions.a, actual: s.session.eventLocations.a });
}
{
    const { s, p, m } = fixture(7, 5, [ev('a', 1, 1)]);
    p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    m.events[0].schedule = [{ when: { hourRange: [6, 7] }, at: { mapId: 'm', x: 5, y: 1 } }, { when: {}, at: { mapId: 'm', x: 1, y: 3 } }];
    store.replace(p);
    const sprite: any = { x: 0, y: 0, texture: { key: 'none' }, setPosition(x: number, y: number) { this.x = x; this.y = y; }, setDepth() { }, setAlpha() { }, setFrame() { } };
    s.eventSprites.set('a', sprite);
    updateNpcSchedules(s);
    tick(s, 2, 80);
    const spriteBefore = { x: sprite.x, y: sprite.y };
    const before = structuredClone(s.autonomousNPCs.get('a').activeMove);
    s.session.gameTime.hour = 7;
    updateNpcSchedules(s);
    const after = s.autonomousNPCs.get('a').activeMove;
    tick(s, 1, 80);
    log('schedule-retarget-midstep', { before, after, spriteBefore, spriteAfter: { x: sprite.x, y: sprite.y }, location: s.session.eventLocations.a });
}
{
    const { s, p, m } = fixture(7, 5, [ev('a', 1, 1)]);
    p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
    m.events[0].schedule = [{ when: { hourRange: [6, 7] }, at: { mapId: 'm', x: 5, y: 1 } }, { when: {}, at: { mapId: 'm', x: 2, y: 1 } }];
    store.replace(p);
    updateNpcSchedules(s);
    tick(s, 2, 80);
    s.session.gameTime.hour = 7;
    updateNpcSchedules(s);
    const routeAtTarget = structuredClone(s.autonomousNPCs.get('a').moves);
    const trace = [];
    for (let i = 0; i < 25; i++) {
        tick(s, 1, 80);
        updateNpcSchedules(s);
        trace.push(s.session.eventLocations.a.x);
    }
    log('schedule-retarget-current', { routeAtTarget, trace });
}
{
    const { s, p, m } = fixture(7, 5, [ev('a', 1, 1)]);
    m.events[0].pages[0].movement.type = 'random';
    store.replace(p);
    s.pageMoveRouteKeys = new Set();
    s.pageMoveRouteEventIds = new Set();
    s.registerAutonomousMover('a', [{ kind: 'npcTransfer', mapId: 'm', x: 3, y: 2 }], false);
    s.commandMoveRouteEventIds.add('a');
    tick(s, 3);
    registerPageMoveRoutes(s);
    tick(s, 20);
    log('same-map-transfer-freeze', { location: s.session.eventLocations.a, commandFlag: s.commandMoveRouteEventIds.has('a'), mover: s.autonomousNPCs.has('a') });
}
// Randomized command simulation; independent targets must retain independent outcomes.
{
    const { s, m } = fixture(12, 5, [ev('a', 1, 1), ev('b', 1, 3)]);
    let seed = 0x5eed, failures = 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const warn = console.warn;
    console.warn = () => { };
    for (let trial = 0; trial < 100; trial++) {
        s.eventPositions = initialRuntimeEventPositions(m.events);
        s.autonomousNPCs.clear();
        s.commandMoveRouteEventIds.clear();
        const x = 2 + Math.floor(random() * 8), y = 2 + Math.floor(random() * 8);
        const a = playPathfindMove(s, step('a', x, 1));
        tick(s, Math.floor(random() * 3), 16);
        const b = playPathfindMove(s, step('b', y, 3));
        tick(s, 150, 80);
        const results = await Promise.all([a, b]);
        if (results.some(r => r !== 'arrived'))
            failures++;
    }
    console.warn = warn;
    log('concurrent-fuzz', { seed: '0x5eed', trials: 100, wrongResults: failures });
}
{
    (globalThis as any).HTMLElement = win.HTMLElement;
    const { s, p } = fixture(7, 5, [ev('a', 1, 1), ev('b', 1, 3)]);
    p.commonEvents = ['a', 'b'].map((id, i) => ({ id, name: id, trigger: 'parallel', commands: [{ kind: 'm2Command', commandId: 'm2-205-pathfind-move', fields: { target: id, x: 3, y: 1 + i * 2, speed: 4, wait: true, onFailure: 'stop', resultVariableId: id } }, { kind: 'setSwitch', switchId: 'after_' + id, value: true }] }));
    store.replace(p);
    s.game = { registry: { get: () => undefined } };
    s.parallelProcesses = new Map();
    s.activeRuntimeEvents = () => [];
    updateParallelEvents(s, 0);
    const waits = [...s.parallelProcesses.values()].map((p: any) => p.pendingTimeTransition);
    tick(s);
    await Promise.all(waits);
    await Promise.resolve();
    log('real-parallel', { positions: s.eventPositions, results: [s.session.variables.a, s.session.variables.b], afterSwitches: [s.session.switches.after_a ?? false, s.session.switches.after_b ?? false] });
}
{
    const { s } = fixture(9, 5, [ev('a', 1, 2)]);
    s.tileX = 5;
    s.tileY = 2;
    s.session.playerFootprint = { width: 3, height: 1 };
    s.registerAutonomousMover('a', [{ kind: 'moveTowardPlayer' }], true);
    tick(s, 100);
    log('widePlayerOverlap', { position: s.eventPositions.a, playerPassRect: playerPassageRect(resolvePlayerBody(store.getCurrent(), s.session), 5, 2) });
}
await win.happyDOM.close();
