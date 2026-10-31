// 방 구성 아이디어 그림 — 사용자가 실내 기준으로 고른 assistant-rooms-2 그림(조수 스위트 mapvqa 기준 그림 anchors.json 의 room-*).
//
// 왜(2026-10-30 사용자 지시): 옛 room_parts 는 사람 견본(authored-study 등)을 예시 그림으로 보여 줬고, 모델이 그 서재를 그대로 옮겨 방탈출 방이
// 다 같은 나무 서재가 됐다(map-sameness-1029). 예시는 «구성 아이디어»로만 보여 주고 베끼지 말라고 함께 적는다.
// 2026-10-30 2회차(mapvqa ③ 0/52 → 0/52): 판정자가 이긴 쪽으로 꼽은 것은 «여러 방·계단·곁방·큰 랜드마크»의 공간 구조였다.
// 그래서 그림마다 구조 요약(방·연결·랜드마크)을 영어로 싣고(모델이 받는 글은 영어), 대략의 방 사각형(plan)을 지문으로 둔다 —
// 모델의 방 그래프가 어느 기준 방과 방 수·크기·자리까지 거의 같으면 베낀 것으로 보고 돌려보낸다(planFingerprint).
// 그림은 public/assets/room-ideas/ 의 96색 축소 사본(1배, 원본은 suite/mapvqa/refs/anchors/). 실행기가 env.readPublicAsset 으로 읽는다.

export type RoomIdeaKind = "hall" | "bed" | "study" | "other";

/** 기준 방의 대략 평면(칸, 벽면 두 줄 포함 방 사각형) — 지문용. 그림을 눈으로 재서 적었다(16px 한 칸). */
export interface RoomIdeaPlan { readonly w: number; readonly h: number; readonly rooms: readonly { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[] }

export interface RoomIdea {
  readonly id: string;
  readonly kind: RoomIdeaKind;
  readonly file: string;
  /** 구조 요약(영어, 모델이 받는다) — 방·연결·랜드마크·오갈 이유. 크기·자리·기물을 그대로 옮기라는 뜻이 아니다. */
  readonly idea: string;
  readonly plan: RoomIdeaPlan;
}

export const ROOM_IDEAS: readonly RoomIdea[] = [
  { id: "rooms2-28", kind: "hall", file: "assets/room-ideas/rooms2-28.png",
    idea: "Inn ground floor, about 19×13. One big hall with distinct zones: bar counter with stools (west), a fireplace landmark on the north wall with a rug runner from it to the south door, two blocks of dining tables, small tables (east). A staircase up sits in the north-east corner behind a wall stub — the reason to go deeper.",
    plan: { w: 19, h: 13, rooms: [{ name: "hall", x: 1, y: 1, w: 17, h: 11 }] } },
  { id: "rooms2-29", kind: "hall", file: "assets/room-ideas/rooms2-29.png",
    idea: "Inn ground floor, about 23×16, three rooms. Main hall (west, the entrance): stairs up in the north-west corner, a fireplace with armchairs on the north wall, a bar counter in the middle, two dining areas on rugs of different colours. Kitchen (north-east, through a door): stove, counters, tiled floor. Storeroom (east, below the kitchen, through a door): barrels and crates.",
    plan: { w: 23, h: 16, rooms: [{ name: "hall", x: 1, y: 1, w: 14, h: 14 }, { name: "kitchen", x: 16, y: 1, w: 6, h: 6 }, { name: "storeroom", x: 16, y: 9, w: 6, h: 5 }] } },
  { id: "rooms2-26", kind: "bed", file: "assets/room-ideas/rooms2-26.png",
    idea: "Inn upper floor, about 19×13: a long corridor with a runner and the stairs down at its east end; three guest rooms open off its north side through doorways (each with two beds, a rug in its own colour and luggage to inspect).",
    plan: { w: 19, h: 13, rooms: [{ name: "corridor", x: 1, y: 7, w: 17, h: 5 }, { name: "room-a", x: 1, y: 1, w: 5, h: 5 }, { name: "room-b", x: 7, y: 1, w: 5, h: 5 }, { name: "room-c", x: 13, y: 1, w: 5, h: 5 }] } },
  { id: "rooms2-31", kind: "study", file: "assets/room-ideas/rooms2-31.png",
    idea: "Magic library, about 20×16, three rooms. North reading room: a tall bookshelf wall, a summoning-circle landmark between two candelabras, two writing desks. South-west locked stacks behind an iron gate (bookshelves both sides — a locked place to open). South-east study hall: four tables with chairs around a rug. The exit corridor runs between the two south rooms.",
    plan: { w: 20, h: 16, rooms: [{ name: "reading", x: 1, y: 1, w: 18, h: 7 }, { name: "stacks", x: 1, y: 9, w: 6, h: 6 }, { name: "study", x: 8, y: 9, w: 11, h: 6 }] } },
  { id: "rooms2-30", kind: "study", file: "assets/room-ideas/rooms2-30.png",
    idea: "Grand library, about 30×22, one huge hall: a north wall of bookshelves with ladders, aisles of bookshelf rows, a row of reading tables, four summoning circles with candelabras in the south, and a fenced forbidden vault (iron gate) in the south-east.",
    plan: { w: 30, h: 22, rooms: [{ name: "hall", x: 1, y: 1, w: 28, h: 20 }] } },
  { id: "rooms2-33", kind: "study", file: "assets/room-ideas/rooms2-33.png",
    idea: "Forbidden archive, about 20×17: a railed gallery of bookshelves behind a gate along the north wall (how do I get past it?), shelf blocks with a ladder (west), reading tables, a summoning circle (south-east), a desk on a rug by the south door.",
    plan: { w: 20, h: 17, rooms: [{ name: "hall", x: 1, y: 1, w: 18, h: 15 }] } },
  { id: "rooms2-00", kind: "other", file: "assets/room-ideas/rooms2-00.png",
    idea: "Observatory, about 32×23, four rooms. A dome hall across the north with a huge telescope landmark on a round dais, rugs, bookshelves, globes. A runner corridor goes from the south door straight to the telescope. Three south rooms off it: a study (bookshelves, star portal), a statue gallery with pillars, a sitting room (fireplace, rug, desk).",
    plan: { w: 32, h: 23, rooms: [{ name: "dome", x: 1, y: 1, w: 30, h: 13 }, { name: "study", x: 1, y: 15, w: 8, h: 7 }, { name: "gallery", x: 10, y: 15, w: 12, h: 7 }, { name: "sitting", x: 23, y: 15, w: 8, h: 7 }] } },
  { id: "rooms2-13", kind: "other", file: "assets/room-ideas/rooms2-13.png",
    idea: "Brazier sanctum, about 32×19, many rooms around a centre: a ritual hall with four braziers around a pentagram on a checkered floor, an altar on a red carpet under a gate in the north wall, a staircase up (north-east) between statues, side rooms east and west (scrying table, shelves), small flame shrines and an altar room to the south.",
    plan: { w: 32, h: 19, rooms: [{ name: "altar", x: 4, y: 1, w: 21, h: 6 }, { name: "stairs", x: 25, y: 1, w: 5, h: 5 }, { name: "west", x: 3, y: 8, w: 7, h: 5 }, { name: "ritual", x: 10, y: 6, w: 12, h: 8 }, { name: "east", x: 22, y: 8, w: 8, h: 5 }, { name: "south-west", x: 1, y: 13, w: 8, h: 5 }, { name: "shrine", x: 10, y: 14, w: 12, h: 4 }, { name: "south-east", x: 23, y: 13, w: 8, h: 5 }] } },
  { id: "rooms2-19", kind: "other", file: "assets/room-ideas/rooms2-19.png",
    idea: "Star-keeper hall, about 32×27, three tiers: a north hall with a giant armillary-sphere landmark on a dais and pillars, flanked by small nooks; a middle tier (tomb room, brazier hall with benches, library-workshop); a south tier (alchemy room, kitchen with an oven). One long runner from the south door up to the sphere ties the tiers together.",
    plan: { w: 32, h: 27, rooms: [{ name: "north", x: 6, y: 1, w: 20, h: 9 }, { name: "nw", x: 1, y: 2, w: 6, h: 8 }, { name: "ne", x: 25, y: 2, w: 6, h: 8 }, { name: "mid-west", x: 1, y: 11, w: 8, h: 7 }, { name: "mid", x: 9, y: 11, w: 14, h: 8 }, { name: "mid-east", x: 23, y: 11, w: 8, h: 7 }, { name: "south-west", x: 5, y: 19, w: 8, h: 6 }, { name: "corridor", x: 14, y: 19, w: 3, h: 7 }, { name: "south-east", x: 18, y: 19, w: 9, h: 6 }] } },
  { id: "rooms2-37", kind: "other", file: "assets/room-ideas/rooms2-37.png",
    idea: "Smithy, about 13×9, two rooms: an armory shop (counter, shields on the walls, armour stands, rug — the entrance) and the forge room through a door (forge on the north wall, anvil, workbench).",
    plan: { w: 13, h: 9, rooms: [{ name: "shop", x: 1, y: 2, w: 5, h: 6 }, { name: "forge", x: 7, y: 1, w: 5, h: 6 }] } },
];

/** 방 용도 낱말 → 아이디어 그림 n 개(같은 갈래 먼저, 모자라면 «other»). */
export function roomIdeasFor(purpose: string, n = 2): RoomIdea[] {
  const p = purpose.toLowerCase();
  const kind: RoomIdeaKind = /침실|객실|숙소|위층 방|inn_room|guest|bed|dorm/u.test(p) && !/서재|study/u.test(p) ? "bed"
    : /여관|선술|주점|홀|식당|inn|tavern|hall|bar|pub/u.test(p) ? "hall"
    : /서재|도서|서고|책|연구|study|library|archive/u.test(p) ? "study"
    : "other";
  const same = ROOM_IDEAS.filter((r) => r.kind === kind);
  const rest = ROOM_IDEAS.filter((r) => r.kind !== kind && r.kind === "other");
  return [...same, ...rest].slice(0, n);
}

export const ROOM_IDEA_RULE = "Reference rooms (the ones players liked): look at their structure — how many rooms, how they connect (doors, open arches, a corridor), the stairs and side rooms, the one big landmark each room is built around, and why a player walks from one room to the next. Borrow structure, not the plan: do not reproduce a reference's room count, sizes and positions — a plan that matches one is sent back. Build your own plan from this request and story.";

/** 우리 평면(방 사각형)과 기준 평면이 얼마나 같은가 — 방 수가 같고 평면 크기가 ±3 안일 때만, 정규화 사각형의 짝 IoU 평균. */
export function planSimilarity(ours: RoomIdeaPlan, ref: RoomIdeaPlan): number {
  if (ours.rooms.length !== ref.rooms.length) return 0;
  if (Math.abs(ours.w - ref.w) > 3 || Math.abs(ours.h - ref.h) > 3) return 0;
  const norm = (p: RoomIdeaPlan) => p.rooms.map((r) => ({ x0: r.x / p.w, y0: r.y / p.h, x1: (r.x + r.w) / p.w, y1: (r.y + r.h) / p.h }));
  const a = norm(ours), b = norm(ref);
  const iou = (p: typeof a[number], q: typeof a[number]) => {
    const w = Math.min(p.x1, q.x1) - Math.max(p.x0, q.x0), h = Math.min(p.y1, q.y1) - Math.max(p.y0, q.y0);
    if (w <= 0 || h <= 0) return 0;
    const i = w * h;
    return i / ((p.x1 - p.x0) * (p.y1 - p.y0) + (q.x1 - q.x0) * (q.y1 - q.y0) - i);
  };
  // 욕심 짝짓기 — 가장 큰 IoU 부터.
  const pairs: [number, number, number][] = [];
  a.forEach((p, i) => b.forEach((q, j) => pairs.push([iou(p, q), i, j])));
  pairs.sort((x, y) => y[0] - x[0]);
  const ui = new Set<number>(), uj = new Set<number>();
  let sum = 0;
  for (const [v, i, j] of pairs) { if (ui.has(i) || uj.has(j)) continue; ui.add(i); uj.add(j); sum += v; }
  return sum / a.length;
}

/** 우리 평면이 베낀 것으로 볼 만큼 같은 기준 방(없으면 undefined). 한 방짜리 평면은 지문으로 보지 않는다(그건 구조가 아니다). */
export function copiedReference(ours: RoomIdeaPlan, limit = 0.72): { id: string; similarity: number } | undefined {
  if (ours.rooms.length < 2) return undefined;
  let best: { id: string; similarity: number } | undefined;
  for (const r of ROOM_IDEAS) {
    const s = planSimilarity(ours, r.plan);
    if (s >= limit && (!best || s > best.similarity)) best = { id: r.id, similarity: Math.round(s * 100) / 100 };
  }
  return best;
}
