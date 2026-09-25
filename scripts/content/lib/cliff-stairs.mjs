// Cliff stairs on the forest village sheets (forest_harmony and its climate repaints, combined_town): the stone
// flight 111 (left cheek) | 112 (body) | 113 (right cheek), one row per face row. The old single tread 2689 (the
// sheet's bindings[374]) has no cheeks, so two side by side read as a grey slab pasted on the cliff.
export const STAIR_LEFT = 111, STAIR_BODY = 112, STAIR_RIGHT = 113;
export const stairTile = (x, x0, width = 2) => x === x0 ? STAIR_LEFT : x === x0 + width - 1 ? STAIR_RIGHT : STAIR_BODY;
/** A stair cell: the cheeked flight, or the old tread (`legacy`, bindings[374]) still found in older maps. */
export const isStairTile = (t, legacy) => t === STAIR_LEFT || t === STAIR_BODY || t === STAIR_RIGHT || (legacy !== undefined && t === legacy);
