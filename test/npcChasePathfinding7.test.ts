import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateAutonomousNPCs } from '@/player/playSceneAutonomous';
import { nextChaseDecision } from '@/player/chaseAi';
import * as collision from '@/project/collision';
import { store } from '@/project/store';
import { event, fixture, ticks, pos } from './fixtures/npcChasePathfinding';

const getCurrent = store.getCurrent;
afterEach(() => { store.getCurrent = getCurrent; vi.restoreAllMocks(); });
const fixed = { movement: { type: 'fixed', speed: 3, frequency: 3 } };
function swarm(n = 20) {
  const es = Array.from({ length: n }, (_, i) => event('s' + i, 1 + i, 1));
  for (const [x, y] of [[24, 25], [26, 25], [25, 24], [25, 26]]) es.push(event(`b${x}-${y}`, x, y, fixed));
  return fixture(50, 50, es, 25, 25);
}

describe('7차 추격 통행과 접촉', () => {
  it('faction: excludes only the target and approaches without stacking or firing eventTouch', () => {
    const f = fixture(7, 5, [event('a', 1, 2), event('b', 5, 2, fixed)], 0, 0);
    f.scene.autonomousNPCs.get('a').chaseTarget = { x: 5, y: 2 };
    ticks(f.scene);
    expect(pos(f.scene)).toMatchObject({ x: 4, y: 2 });
    expect(f.scene.touches).toBe(0);
  });
  it('faction: third-party blockers still require a detour', () => {
    const f = fixture(7, 5, [event('a', 1, 2), event('b', 5, 2, fixed), event('c', 3, 2, fixed)], 0, 0);
    f.scene.autonomousNPCs.get('a').chaseTarget = { x: 5, y: 2 };
    const visited = [];
    for (let i = 0; i < 50; i++) { ticks(f.scene, 1); visited.push({ ...pos(f.scene) }); }
    expect(visited.some(p => p.y !== 2)).toBe(true);
    expect(visited.some(p => p.x === 3 && p.y === 2)).toBe(false);
    expect(f.scene.touches).toBe(0);
  });
  it('passRows: lets the upper body pass an event above the feet corridor', () => {
    const f = fixture(7, 5, [event('a', 1, 2, { footprint: { width: 1, height: 3 }, passRows: 1 }), event('b', 3, 1, fixed)], 5, 2);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) if (y !== 2) f.map.lowerTiles[y * 7 + x] = 1;
    ticks(f.scene);
    expect(pos(f.scene)).toMatchObject({ x: 4, y: 2 });
    expect(f.scene.touches).toBeGreaterThan(0);
  });
  it('decoration: follows the available detour around placed furniture', () => {
    const f = fixture(7, 5, [event('a', 1, 2)], 5, 2);
    f.project.database.homeDecorationTypes = [{ id: 'box', blocksMovement: true, footprint: { width: 1, height: 1 } }];
    f.session.homeDecorationPlacements = { box: { instanceId: 'box', typeId: 'box', mapId: 'm', x: 3, y: 2, orientation: 'down' } };
    ticks(f.scene);
    expect(Math.abs(pos(f.scene).x - 5) + Math.abs(pos(f.scene).y - 2)).toBe(1);
    expect(f.scene.touches).toBeGreaterThan(0);
  });
  it.each([false, true])('wideTouch: touches with passage rectangles (moving player %s)', moving => {
    const f = fixture(8, 5, [event('a', 1, 2, { footprint: { width: 3, height: 1 }, passRows: 1 })], 5, 2);
    if (moving) { f.scene.tileX = 6; f.scene.moving = true; f.scene.movingTo = { x: 5, y: 2 }; }
    ticks(f.scene);
    expect(pos(f.scene)).toMatchObject({ x: 3, y: 2 });
    expect(f.scene.touches).toBeGreaterThan(0);
  });
  it('wide player: stops before overlapping the player feet', () => {
    const f = fixture(8, 5, [event('a', 1, 2)], 5, 2);
    f.session.playerFootprint = { width: 3, height: 3 }; f.session.playerPassRows = 1;
    ticks(f.scene);
    expect(pos(f.scene)).toMatchObject({ x: 3, y: 2 });
    expect(f.scene.touches).toBeGreaterThan(0);
  });
});

describe('7차 추격 재탐색 예산', () => {
  it('unreachableSwarm: limits initial and repeated A* to two per update and serves every waiter', () => {
    const f = swarm();
    const served = new Set<string>();
    for (let frame = 0; frame < 20; frame++) {
      updateAutonomousNPCs(f.scene, 500);
      const searched = [...f.scene.autonomousNPCs.entries()].filter(([, m]: any) => m.chaseRepathTimerMs === 0);
      expect(searched).toHaveLength(2);
      searched.forEach(([id]) => served.add(id));
      if (frame === 9) expect(served.size).toBe(20);
    }
    expect(served.size).toBe(20);
  });
  it('shares the budget across logical ticks in the same rendered frame', () => {
    const f = swarm(6); f.scene.game = { loop: { frame: 1 } };
    updateAutonomousNPCs(f.scene, 500); updateAutonomousNPCs(f.scene, 500);
    expect([...f.scene.autonomousNPCs.values()].filter((m: any) => m.chasePathBlocked)).toHaveLength(2);
    f.scene.game.loop.frame++;
    updateAutonomousNPCs(f.scene, 500);
    expect([...f.scene.autonomousNPCs.values()].filter((m: any) => m.chasePathBlocked)).toHaveLength(4);
  });
  it('does not let removed or frozen pending movers permanently starve remaining callers', () => {
    const f = swarm(6); updateAutonomousNPCs(f.scene, 500);
    f.scene.autonomousNPCs.delete('s2'); f.scene.autonomousNPCs.get('s3').actionFrozen = true;
    for (let i = 0; i < 3; i++) updateAutonomousNPCs(f.scene, 500);
    expect(f.scene.autonomousNPCs.get('s4').chasePathBlocked).toBe(true);
    expect(f.scene.autonomousNPCs.get('s5').chasePathBlocked).toBe(true);
  });
  it('keeps an existing path when periodic replanning is denied', () => {
    const f = fixture(8, 5, [], 6, 2);
    const mover = { timer: 0, moveIntervalMs: 80, chaseRepathTimerMs: 500, chasePath: [{ x: 2, y: 2 }, { x: 3, y: 2 }] };
    const blocked = vi.fn(() => false);
    const decision = nextChaseDecision({ ...f, from: { x: 1, y: 2 }, player: { x: 6, y: 2 }, mover, deltaMs: 80,
      requestRepath: () => false, pass: { footprint: { width: 1, height: 1 }, passRows: 1, blocked } });
    expect(decision).toMatchObject({ kind: 'move', x: 2, y: 2 });
    expect(mover.chasePath).toEqual([{ x: 3, y: 2 }]);
    expect(blocked).not.toHaveBeenCalled();
  });
  it('immediately replans exhausted reachable paths even when the budget is denied', () => {
    const f = fixture(8, 5, [], 6, 2);
    const requestRepath = vi.fn(() => false);
    const mover = { timer: 0, moveIntervalMs: 80, chaseRepathTimerMs: 0, chasePath: [], chasePathBlocked: false };
    expect(nextChaseDecision({ ...f, from: { x: 1, y: 2 }, player: { x: 6, y: 2 }, mover, deltaMs: 80, requestRepath }))
      .toMatchObject({ kind: 'move', x: 2, y: 2 });
    expect(requestRepath).not.toHaveBeenCalled();
  });
  it('300 unobstructed cached paths add no searches or terrain probes beyond actual steps', () => {
    const f = fixture(310, 5, Array.from({ length: 300 }, (_, i) => event('s' + i, i + 1, 1)), 305, 4);
    for (const [id, m] of f.scene.autonomousNPCs) {
      const p = pos(f.scene, id);
      m.chasePath = [{ x: p.x, y: 2 }, { x: p.x, y: 3 }]; m.chaseRepathTimerMs = 0;
    }
    const calls = vi.spyOn(collision, 'canMoveFootprint');
    updateAutonomousNPCs(f.scene, 80);
    expect(calls).toHaveBeenCalledTimes(300);
    expect([...f.scene.autonomousNPCs.values()].every((m: any) => m.chaseRepathTimerMs === 80 && m.activeMove)).toBe(true);
  });
});
