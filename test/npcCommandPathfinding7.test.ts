/** @vitest-environment happy-dom */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import * as chase from "@/player/chaseAi";
const { createBlankProject, createBlankMap } = await import('@/project/defaults');
const { startSession } = await import('@/project/session');
const { store } = await import('@/project/store');
const { registerAutonomousMover, updateParallelEvents } = await import('@/player/playSceneSchedulers');
const { updateAutonomousNPCs } = await import('@/player/playSceneAutonomous');
const { playPathfindMove } = await import('@/player/playScenePathfinding');
const { canNpcMove } = await import('@/player/playSceneAutonomousMapActions');
const { registerPageMoveRoutes } = await import('@/player/playScenePageMoveRoutes');
const { updateNpcSchedules } = await import('@/player/npcSchedules');
const { initialRuntimeEventPositions } = await import('@/project/runtimeEventState');
function ev(id: string, x: number, y: number) { return { id, x, y, trigger: { kind: 'action' }, commands: [], pages: [{ id: 'p', conditions: [], graphic: {}, trigger: { kind: 'action' }, priority: 'same', movement: { type: 'fixed', speed: 4, frequency: 8 }, commands: [] }] }; }
let frames = new Map<number, Function>(), fid = 0;
beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: Function) => { frames.set(++fid, cb); return fid; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});
afterEach(() => vi.unstubAllGlobals());
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
describe('7차 NPC 명령·시간표', () => {
    it('다른 NPC 실제 병렬 이동은 두 후속 명령까지 도착한다', async () => {
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
        expect([s.session.variables.a, s.session.variables.b]).toEqual([0, 0]);
        expect([s.session.switches.after_a, s.session.switches.after_b]).toEqual([true, true]);
    });
    it('같은 대상의 후속 경로만 앞 명령을 중단한다', async () => {
        const { s } = fixture();
        const first = playPathfindMove(s, step('a', 4, 1));
        const second = playPathfindMove(s, step('a', 3, 1));
        tick(s);
        expect(await Promise.all([first, second])).toEqual(['interrupted', 'arrived']);
    });
    it('전역 성공 플래그는 최신 요구만 소유한다', async () => {
        const { s } = fixture();
        const first = playPathfindMove(s, step('a', 3, 1));
        expect(await playPathfindMove(s, step('missing', 2, 2))).toBe('missingTarget');
        tick(s);
        expect(await first).toBe('arrived');
        expect(s.session.flags.pathfindSucceeded).toBe(false);
    });
    it.each(['moveTowardPlayer', 'moveAwayFromPlayer', 'turnTowardPlayer', 'turnAwayFromPlayer'])('%s 는 시간표 이동 후 실제 좌표를 쓴다', kind => {
        const { s, p, m } = fixture();
        p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
        m.events[0].schedule = [{ when: {}, at: { mapId: 'm', x: 3, y: 1 } }];
        store.replace(p);
        updateNpcSchedules(s);
        tick(s, 30);
        s.tileX = 1;
        s.tileY = 1;
        s.registerAutonomousMover('a', [{ kind }], false);
        s.commandMoveRouteEventIds.add('a');
        const mover = s.autonomousNPCs.get('a');
        tick(s, 10);
        const toward = kind.includes('Toward');
        if (kind.startsWith('move'))
            expect(s.session.eventLocations.a.x).toBe(toward ? 2 : 4);
        else
            expect(mover.facing).toBe(toward ? 'left' : 'right');
    });
    it('같은 맵 transfer 는 명령 소유권을 해제해 페이지 이동을 재개한다', () => {
        const { s, p, m } = fixture();
        m.events[0].pages[0].movement.type = 'random';
        store.replace(p);
        s.pageMoveRouteKeys = new Set();
        s.pageMoveRouteEventIds = new Set();
        s.registerAutonomousMover('a', [{ kind: 'npcTransfer', mapId: 'm', x: 3, y: 2 }], false);
        s.commandMoveRouteEventIds.add('a');
        tick(s, 3);
        expect(s.commandMoveRouteEventIds.has('a')).toBe(false);
        registerPageMoveRoutes(s);
        expect(s.autonomousNPCs.has('a')).toBe(true);
    });
    it.each([false, true])('큰 플레이어 통행 사각 예약 moving=%s', moving => {
        const { s, p } = fixture(9, 7, [ev('a', 7, 3)]);
        s.tileX = 2;
        s.tileY = 3;
        s.moving = moving;
        s.movingTo = { x: 5, y: 3 };
        s.session.playerFootprint = { width: 3, height: 3 };
        s.session.playerPassRows = 1;
        s.registerAutonomousMover('a', [{ kind: 'move', dir: 'left' }], false);
        const mover = s.autonomousNPCs.get('a');
        const can = (x: number, y: number) => canNpcMove({ project: p, scene: s, mover, eventId: 'a', from: { x: x + 1, y }, to: { x, y } }, { x: -1, y: 0, face: 'left' });
        expect(can(3, 3)).toBe(false);
        expect(can(6, 3)).toBe(!moving);
        expect(can(3, 2)).toBe(true);
    });
    it('widePlayerOverlap: 접근하는 NPC 는 몸 왼쪽에서 멈춘다', () => {
        const { s } = fixture(9, 5, [ev('a', 1, 2)]);
        s.tileX = 5;
        s.tileY = 2;
        s.session.playerFootprint = { width: 3, height: 1 };
        s.registerAutonomousMover('a', [{ kind: 'moveTowardPlayer' }], true);
        tick(s, 100);
        expect(s.eventPositions.a.x).toBe(3);
    });
    it('현재 위치가 시간표 새 목표이면 옛 남은 경로를 비운다', () => {
        const { s, p, m } = fixture();
        p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
        m.events[0].schedule = [{ when: { hourRange: [6, 7] }, at: { mapId: 'm', x: 5, y: 1 } }, { when: {}, at: { mapId: 'm', x: 2, y: 1 } }];
        store.replace(p);
        updateNpcSchedules(s);
        tick(s, 2, 80);
        const active = s.autonomousNPCs.get('a').activeMove;
        s.session.gameTime.hour = 7;
        updateNpcSchedules(s);
        expect(s.autonomousNPCs.get('a').moves).toEqual([]);
        expect(s.autonomousNPCs.get('a').activeMove).toBe(active);
        const trace = [];
        for (let i = 0; i < 40; i++) {
            tick(s, 1, 80);
            updateNpcSchedules(s);
            trace.push(s.session.eventLocations.a.x);
        }
        expect(new Set(trace)).toEqual(new Set([2]));
    });
    it('시간표 재지정은 무버와 보간·속도·타이머를 보존하고 새 목적지에 도착한다', () => {
        const { s, p, m } = fixture();
        p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
        m.events[0].schedule = [{ when: { hourRange: [6, 7] }, at: { mapId: 'm', x: 5, y: 1 } }, { when: {}, at: { mapId: 'm', x: 1, y: 3 } }];
        store.replace(p);
        updateNpcSchedules(s);
        tick(s, 2, 80);
        const mover = s.autonomousNPCs.get('a'), active = mover.activeMove;
        const before = { ...active };
        mover.timer = 17;
        s.session.gameTime.hour = 7;
        updateNpcSchedules(s);
        expect(s.autonomousNPCs.get('a')).toBe(mover);
        expect(mover.activeMove).toBe(active);
        expect(active).toEqual(before);
        expect(mover.timer).toBe(17);
        tick(s, 100, 80);
        expect(s.session.eventLocations.a).toMatchObject({ x: 1, y: 3 });
    });
    it('고립된 출발점에서도 벽 목적지는 blocked 이고 열린 고립 목적지는 unreachable 이다', async () => {
        const { s, m } = fixture(5, 5);
        m.lowerTiles.fill(1);
        m.lowerTiles[6] = 0;
        expect(await playPathfindMove(s, step('a', 3, 3))).toBe('blocked');
        m.lowerTiles[18] = 0;
        expect(await playPathfindMove(s, step('a', 3, 3))).toBe('unreachable');
    });
    it('300명 무막힘 시간표는 초기 탐색 이후 갱신·보행에서 A* 를 추가하지 않는다', () => {
        const { s, p, m } = fixture(8, 302, Array.from({ length: 300 }, (_, i) => ev('e' + i, 1, i + 1)));
        p.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26 };
        m.events.forEach((e: any) => e.schedule = [{ when: {}, at: { mapId: 'm', x: 5, y: e.y } }]);
        store.replace(p);
        const spy = vi.spyOn(chase, 'findChasePath');
        try {
            updateNpcSchedules(s);
            expect(spy).toHaveBeenCalledTimes(300);
            for (let i = 0; i < 40; i++) {
                tick(s, 1, 80);
                updateNpcSchedules(s);
            }
            expect(spy).toHaveBeenCalledTimes(300);
            expect(Object.values(s.session.eventLocations).filter((v: any) => v.x === 5)).toHaveLength(300);
        }
        finally {
            spy.mockRestore();
        }
    });
});
describe('7차 적대 리뷰: 명령 이동 소유권', () => {
    it('도착 직후 페이지 자율 이동이 다시 깔려도 도착으로 끝난다', async () => {
        const a = ev('a', 0, 0);
        (a.pages[0] as any).movement = { type: 'random', speed: 8, frequency: 8 };
        const { s } = fixture(5, 2, [a]);
        s.pageMoveRouteKeys = new Set();
        s.pageMoveRouteEventIds = new Set();
        const promise = playPathfindMove(s, step('a', 1, 0));
        for (let i = 0; i < 6; i++) updateAutonomousNPCs(s, 80);
        expect(s.eventPositions.a).toMatchObject({ x: 1, y: 0 });
        registerPageMoveRoutes(s);
        expect(s.autonomousNPCs.has('a')).toBe(true);
        const q = [...frames.values()];
        frames.clear();
        q.forEach(cb => cb(0));
        expect(await promise).toBe('arrived');
    });
});
describe('7차 적대 리뷰 2: 명령 루트 교체', () => {
    it('다른 이동 명령 루트가 덮으면 blocked 가 아니라 interrupted', async () => {
        const { s } = fixture();
        const first = playPathfindMove(s, step('a', 4, 1, { resultVariableId: 'result' }));
        s.registerAutonomousMover('a', [{ kind: 'move', dir: 'down' }], false);
        s.commandMoveRouteEventIds.add('a');
        const q = [...frames.values()];
        frames.clear();
        q.forEach(cb => cb(0));
        expect(await first).toBe('interrupted');
    });
});
