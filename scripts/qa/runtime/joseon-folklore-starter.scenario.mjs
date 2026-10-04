import game from './joseon-folklore.scenario.mjs';

/** Same authored journey through the independently saved new-project starter export. */
export default { ...game, id: 'joseon-folklore-starter', projectFixture: 'output/joseon-folklore/starter/game.oprn.json', beats: game.beats.map(beat => beat.id === 'village' ? { ...beat, ops: [...beat.ops, { kind: 'waitForFieldReady' }] } : beat) };
