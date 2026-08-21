// benchmark/interior/fixtures.ts
// Shared spatial fixtures for the interior benchmark.
//
// Both groundTruth.ts (which runs planInteriorHouseWalls over these to get the
// reference plan) and inputImages.ts (which renders the marked grid the model
// sees) read the layout from here. Keeping it in one owned module is what stops
// the rendered prompt image and the scored reference from drifting apart.

/** Grid layout handed to the model and to planInteriorHouseWalls(). */
export interface InteriorGridFixture {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** Room interiors the model must enclose, in grid coordinates. */
  readonly rooms: readonly { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  /** Entrance cell — on the floor mask, punched through the south wall. */
  readonly door: { readonly x: number; readonly y: number };
  /** Doors between rooms; empty for single-room fixtures. */
  readonly innerDoors: readonly { readonly x: number; readonly y: number }[];
}

/**
 * d-house — one 6x4 room inside a 12x10 grid, entrance at the south wall.
 * Margin on every side leaves the model room to place the shell ring outside
 * the floor mask, so a correct answer is not clipped by the grid border.
 */
export const HOUSE_FIXTURE: InteriorGridFixture = Object.freeze({
  id: "houseGrid",
  width: 12,
  height: 10,
  rooms: Object.freeze([Object.freeze({ id: "main", x: 3, y: 3, w: 6, h: 4 })]),
  door: Object.freeze({ x: 5, y: 6 }),
  innerDoors: Object.freeze([]),
});

/**
 * d-room — two rooms sharing a vertical edge inside a 14x10 grid, with an
 * inner door. Tests whether the model reserves a partition wall between rooms
 * instead of merging them into one hall.
 */
export const ROOM_FIXTURE: InteriorGridFixture = Object.freeze({
  id: "roomGrid",
  width: 14,
  height: 10,
  rooms: Object.freeze([
    Object.freeze({ id: "west", x: 3, y: 3, w: 4, h: 4 }),
    Object.freeze({ id: "east", x: 7, y: 3, w: 4, h: 4 }),
  ]),
  door: Object.freeze({ x: 5, y: 6 }),
  innerDoors: Object.freeze([Object.freeze({ x: 6, y: 5 })]),
});

export const INTERIOR_GRID_FIXTURES: readonly InteriorGridFixture[] = Object.freeze([
  HOUSE_FIXTURE,
  ROOM_FIXTURE,
]);

/** Row-major floor mask (length width*height) covering every room interior. */
export function fixtureFloorMask(fixture: InteriorGridFixture): boolean[] {
  const mask = new Array<boolean>(fixture.width * fixture.height).fill(false);
  for (const room of fixture.rooms) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        mask[y * fixture.width + x] = true;
      }
    }
  }
  return mask;
}

export function fixtureById(id: string): InteriorGridFixture {
  const found = INTERIOR_GRID_FIXTURES.find((fixture) => fixture.id === id);
  if (!found) {
    const known = INTERIOR_GRID_FIXTURES.map((fixture) => fixture.id).join(", ");
    throw new Error(`interior benchmark: unknown grid fixture "${id}" (known: ${known})`);
  }
  return found;
}
