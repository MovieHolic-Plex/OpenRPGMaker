import { TILE } from "@/project/defaults/constants";

export const CONCEPT_FACILITY_CHECK_IDS = [
  "reach-all-rooms",
  "bedroom-has-sleep-bed",
  "entrance-has-counter",
  "stairs-iff-multilevel",
  "required-unplaced",
  "footprint-aspect",
  "template-copy",
] as const;

export type ConceptFacilityCheckId = (typeof CONCEPT_FACILITY_CHECK_IDS)[number];

export type ConceptFacilityCheck = {
  readonly id: ConceptFacilityCheckId;
  readonly pass: boolean;
  readonly detail: string;
};

export type ConceptFacilityReview = {
  readonly score: number;
  readonly copiedTemplate: boolean;
  readonly checks: readonly ConceptFacilityCheck[];
};

export type ConceptScorePlace = {
  readonly id: string;
  readonly count?: number;
  readonly size?: string;
  readonly role?: string;
  readonly level?: number;
};

export type ConceptScoreThing = { readonly objectId: string };

export type ConceptFacilityScoreInput = {
  readonly map: {
    readonly width: number;
    readonly height: number;
    readonly lowerTiles: readonly number[];
    readonly upperTiles: readonly number[];
    readonly events?: readonly {
      readonly x: number;
      readonly y: number;
      readonly pages?: readonly { readonly commands?: readonly { readonly kind?: string }[] }[];
    }[];
  };
  readonly rooms: readonly {
    readonly roomId: string;
    readonly placeId: string;
    readonly role: string;
    readonly x: number;
    readonly y: number;
    readonly w: number;
    readonly h: number;
  }[];
  readonly door: { readonly x: number; readonly y: number };
  readonly warnings: readonly string[];
  readonly levels?: readonly number[];
  readonly overlay?: {
    readonly rooms: Readonly<Record<string, {
      readonly placeLabel: string;
      readonly things: readonly { readonly objectId: string; readonly chips: readonly string[]; readonly required: boolean }[];
    }>>;
  };
  readonly template?: { readonly places: readonly ConceptScorePlace[]; readonly things: readonly ConceptScoreThing[] };
  readonly planned?: { readonly places: readonly ConceptScorePlace[]; readonly things: readonly ConceptScoreThing[] };
};

const FLOOR_TILES = new Set<number>([12, 13, 42, 43, 72, 73, 102, 103, 139]);
const BEDROOM_NAME = /침실|객실|bedroom/i;
const SOUTH_ASPECT_MAX = 1.8;

export function plansStructurallyEqual(
  left: { readonly places: readonly ConceptScorePlace[]; readonly things: readonly ConceptScoreThing[] },
  right: { readonly places: readonly ConceptScorePlace[]; readonly things: readonly ConceptScoreThing[] },
): boolean {
  const placeKey = (place: ConceptScorePlace): string =>
    `${place.id}|${place.role ?? ""}|${place.size ?? ""}|${place.count ?? 1}|${place.level ?? 1}`;
  const placesLeft = left.places.map(placeKey).sort().join(";");
  const placesRight = right.places.map(placeKey).sort().join(";");
  const thingsLeft = left.things.map((thing) => thing.objectId).sort().join(";");
  const thingsRight = right.things.map((thing) => thing.objectId).sort().join(";");
  return placesLeft === placesRight && thingsLeft === thingsRight;
}

function upperEmpty(tile: number): boolean {
  return tile < 0 || tile === TILE.EMPTY;
}

function reachableKeys(input: ConceptFacilityScoreInput): Set<number> {
  const { map, door } = input;
  const width = map.width;
  const height = map.height;
  const passable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const index = y * width + x;
    if (!FLOOR_TILES.has(map.lowerTiles[index] ?? -1)) return false;
    return upperEmpty(map.upperTiles[index] ?? TILE.EMPTY);
  };
  const starts = [door, { x: door.x, y: door.y - 1 }, { x: door.x, y: door.y + 1 }];
  const seen = new Set<number>();
  const queue: Array<{ x: number; y: number }> = [];
  for (const start of starts) {
    if (!passable(start.x, start.y)) continue;
    const key = start.y * width + start.x;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(start);
  }
  while (queue.length > 0) {
    const cell = queue.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      const key = y * width + x;
      if (seen.has(key) || !passable(x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
}

function roomHasInn(input: ConceptFacilityScoreInput, room: ConceptFacilityScoreInput["rooms"][number]): boolean {
  return (input.map.events ?? []).some((event) => {
    if (event.x < room.x || event.x >= room.x + room.w || event.y < room.y || event.y >= room.y + room.h) return false;
    return (event.pages ?? []).some((page) => (page.commands ?? []).some((command) => command.kind === "inn"));
  });
}

function overlayRoom(input: ConceptFacilityScoreInput, roomId: string) {
  return input.overlay?.rooms[roomId];
}

function isBedroom(input: ConceptFacilityScoreInput, room: ConceptFacilityScoreInput["rooms"][number]): boolean {
  const overlay = overlayRoom(input, room.roomId);
  if (overlay?.things.some((thing) => thing.chips.includes("sleep") || thing.objectId.startsWith("bed"))) return true;
  return BEDROOM_NAME.test(room.placeId) || BEDROOM_NAME.test(overlay?.placeLabel ?? "");
}

function unplaced(warnings: readonly string[]): string[] {
  return warnings.filter((line) => line.includes("자리 없음"));
}

export function scoreConceptFacility(input: ConceptFacilityScoreInput): ConceptFacilityReview {
  const reach = reachableKeys(input);
  const missing = input.rooms.filter((room) => {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) {
        if (reach.has(y * input.map.width + x)) return false;
      }
    }
    return true;
  });
  const bedrooms = input.rooms.filter((room) => isBedroom(input, room));
  const bedroomsMissingBed = bedrooms.filter((room) => {
    const overlay = overlayRoom(input, room.roomId);
    const hasSleepThing = overlay?.things.some((thing) => thing.chips.includes("sleep") || thing.objectId.startsWith("bed")) ?? false;
    return !hasSleepThing && !roomHasInn(input, room);
  });
  const entrances = input.rooms.filter((room) => room.role === "entrance");
  const entrancesMissingCounter = entrances.filter((room) => {
    const overlay = overlayRoom(input, room.roomId);
    return !roomHasInn(input, room) && !(overlay?.things.some((thing) => thing.objectId.includes("counter")) ?? false);
  });
  const maxLevel = Math.max(1, ...(input.levels ?? [1]));
  const hasStairs = Object.values(input.overlay?.rooms ?? {}).some((room) =>
    room.things.some((thing) => thing.objectId === "stairs" || thing.chips.includes("transfer")),
  );
  const missingRequired = unplaced(input.warnings);
  const aspect = Math.max(input.map.width / Math.max(1, input.map.height), input.map.height / Math.max(1, input.map.width));
  const copiedTemplate = input.planned === undefined
    || (input.template !== undefined && plansStructurallyEqual(input.template, input.planned));

  const checks: ConceptFacilityCheck[] = [
    {
      id: "reach-all-rooms",
      pass: missing.length === 0,
      detail: missing.length === 0 ? "문에서 모든 방" : `미도달 ${missing.map((room) => room.roomId).join(",")}`,
    },
    {
      id: "bedroom-has-sleep-bed",
      pass: bedrooms.length === 0 || bedroomsMissingBed.length === 0,
      detail: bedrooms.length === 0
        ? "침실 장소 없음"
        : bedroomsMissingBed.length === 0
          ? `침실 ${bedrooms.length} 침대`
          : `침대 없는 침실 ${bedroomsMissingBed.map((room) => room.roomId).join(",")}`,
    },
    {
      id: "entrance-has-counter",
      pass: entrances.length === 0 || entrancesMissingCounter.length === 0,
      detail: entrances.length === 0
        ? "홀 없음"
        : entrancesMissingCounter.length === 0
          ? "홀 카운터"
          : "홀에 카운터 없음",
    },
    {
      id: "stairs-iff-multilevel",
      pass: maxLevel <= 1 || hasStairs,
      detail: maxLevel <= 1 ? "단층" : hasStairs ? `${maxLevel}층 계단` : `${maxLevel}층인데 계단 없음`,
    },
    {
      id: "required-unplaced",
      pass: missingRequired.length === 0,
      detail: missingRequired.length === 0 ? "자리 없음 0" : missingRequired.join(" / "),
    },
    {
      id: "footprint-aspect",
      pass: aspect <= SOUTH_ASPECT_MAX,
      detail: `종횡비 ${aspect.toFixed(2)} (≤${SOUTH_ASPECT_MAX})`,
    },
    {
      id: "template-copy",
      pass: !copiedTemplate,
      detail: copiedTemplate ? "템플릿 복사" : "설계가 템플릿과 다름",
    },
  ];
  const passed = checks.filter((check) => check.pass).length;
  return { score: passed / checks.length, copiedTemplate, checks };
}
