export type ConceptInnVariant = {
  readonly id: string;
  readonly label: string;
  readonly why: string;
  readonly plan: {
    readonly layout?: "row" | "double-row";
    readonly wall?: string;
    readonly places: readonly Record<string, unknown>[];
    readonly things: readonly Record<string, unknown>[];
  };
};

export function innDesignVariants(): readonly ConceptInnVariant[] {
  return [
    {
      id: "rural-onefloor",
      label: "시골 단층 여관",
      why: "객실 하나와 홀만 — 복도·피아노·계단 없음",
      plan: {
        layout: "row",
        wall: "cream",
        places: [
          { id: "bedroom", label: "객실", role: "room", size: "s", count: 1, floor: "wood" },
          { id: "hall", label: "홀", role: "entrance", size: "m", floor: "plank" },
        ],
        things: [
          { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
          { objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
          { objectId: "stove", placeIds: ["hall"], chips: ["block", "event"] },
          { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
          { objectId: "barrel", placeIds: ["hall"], chips: ["block"] },
        ],
      },
    },
    {
      id: "two-floor-rooms",
      label: "2층 객실 여관",
      why: "1층은 홀·주방, 객실은 2층",
      plan: {
        layout: "row",
        places: [
          { id: "hall", label: "홀", role: "entrance", size: "l" },
          { id: "kitchen", label: "주방", role: "room", size: "s", floor: "plank" },
          { id: "corridor", label: "복도", role: "walkway" },
          { id: "bedroom", label: "객실", role: "room", size: "s", count: 3, level: 2 },
          { id: "upper_hall", label: "2층 복도", role: "walkway", level: 2 },
        ],
        things: [
          { objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
          { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
          { objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
          { objectId: "stairs", placeIds: ["corridor", "upper_hall"], chips: ["pass", "transfer"], required: true },
          { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
        ],
      },
    },
    {
      id: "double-row-inn",
      label: "복도 양쪽 여관",
      why: "객실은 복도 북쪽, 주방·창고는 홀 옆(남쪽)",
      plan: {
        layout: "double-row",
        places: [
          { id: "bedroom", label: "객실", role: "room", size: "s", count: 2, zone: "north" },
          { id: "kitchen", label: "주방", role: "room", size: "s", zone: "south", floor: "plank" },
          { id: "storage", label: "창고", role: "room", size: "s", zone: "south" },
          { id: "corridor", label: "복도", role: "walkway" },
          { id: "hall", label: "홀", role: "entrance", size: "l" },
        ],
        things: [
          { objectId: "bed_h", placeIds: ["bedroom"], chips: ["block", "event", "sleep"], required: true },
          { objectId: "stove", placeIds: ["kitchen"], chips: ["block", "event"], required: true },
          { objectId: "barrel", placeIds: ["storage"], chips: ["block"] },
          { objectId: "counter", placeIds: ["hall"], chips: ["block", "event"], required: true },
          { objectId: "table_chairs", placeIds: ["hall"], chips: ["block"] },
          { objectId: "window", placeIds: ["bedroom", "hall"], chips: ["wall"] },
        ],
      },
    },
  ];
}
