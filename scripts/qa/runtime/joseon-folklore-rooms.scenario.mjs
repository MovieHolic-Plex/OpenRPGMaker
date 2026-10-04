const ready = { kind: 'waitForFieldReady' };
const room = (id, mapId, townX, townY, entryX, entryY, returnX, returnY) => [
  { id: 'enter-' + id, ops: [ready, { kind: 'teleport', mapId: 'joseon_v20', x: townX, y: townY }, { kind: 'waitForPosition', mapId: 'joseon_v20', x: townX, y: townY }, ready, { kind: 'hold', dir: 'up', ms: 160 }, { kind: 'waitForPosition', mapId, x: entryX, y: entryY }, ready], expect: { mapId, x: entryX, y: entryY }, shot: true },
  { id: 'leave-' + id, ops: [{ kind: 'hold', dir: 'down', ms: 160 }, { kind: 'waitForPosition', mapId: 'joseon_v20', x: returnX, y: returnY }, ready], expect: { mapId: 'joseon_v20', x: returnX, y: returnY } },
];
export default { id: 'joseon-folklore-rooms', projectFixture: 'output/joseon-folklore/starter/game.oprn.json', viewport: { width: 1100, height: 760 }, beats: [
  { id: 'start', ops: [{ kind: 'key', key: 'Enter' }, { kind: 'waitForRuntime' }, ready], expect: { mapId: 'joseon_v20' } },
  ...room('inn', 'joseon_in_inn_b', 51, 38, 10, 12, 51, 38),
  ...room('school', 'joseon_in_school_b', 52, 29, 8, 10, 53, 29),
  ...room('pharmacy', 'joseon_in_pharmacy_b', 35, 17, 6, 6, 35, 17),
] };
