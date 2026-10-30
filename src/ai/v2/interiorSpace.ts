// 실내 칸 배치(벽 우선 형식)의 공간 검사 — 방마다 빈 바닥·큰 빈 사각형·복도 폭·큰 방 채움·깔개 상한·방 크기 위계.
// 함수는 재고 이름만 붙인다: 가구를 옮기거나 더하지 않는다. 고칠 말(영어)에는 실패한 수와 두 길(줄이기 · 채우기)과 가능하면 Fixed call 을 준다.
//
// 왜(2026-10-31): 5회차 측정에서 terra-high 실내는 기물 12~24개(opus 49~85)로 판정자가 «빈 바닥»을 들었다. bbox 실험 두 줄기가 이미
// 고치는 검사를 찾았다 — agent/bbox-walls (scripts/experiments/bbox-walls-3..5/lay.mts: 문과 문을 잇는 통로 3칸 폭은 빈 칸에서 뺀다,
// 깔개 상한, 방 크기 위계) · agent/bbox-chipsets (scripts/experiments/bbox-chipsets/space.mts: 기준 방 실측 — 기준 방은 전체 7~20%,
// 방 ≤27% 빈 칸, 가장 큰 빈 사각형 ≤3x4 · 1회차 모델 방은 25~64%, 18x4 까지). 문턱은 기준 방 값 바로 위에 둔다.
// 빈 칸 = 바닥 칸인데 자기와 8 이웃 모두에 벽·벽면·가구·난간·단이 없다(가구 옆 통로는 쓰이는 칸, 가구에서 먼 맨바닥은 아니다).

export interface SpaceRoom {
  readonly id: string;
  /** 방 칸(벽으로 닫힌 칸 전부 — 벽면 줄 포함). */
  readonly cells: readonly number[];
  readonly purpose?: string;
  readonly role?: string;
  readonly repeat?: boolean;
  /** 방을 두른 벽 id(줄이기 길에 이름을 댄다). */
  readonly walls: readonly string[];
}
export interface SpaceInput {
  readonly W: number; readonly H: number;
  readonly isFloor: (x: number, y: number) => boolean;
  /** 서서 막는 칸(가구·탁자·난간 — 걸이·바닥 무늬·문짝 제외). */
  readonly block: Uint8Array;
  /** 단(밟는 높은 바닥) 칸 — 채운 칸으로 친다. */
  readonly dais: ReadonlySet<number>;
  readonly rooms: readonly SpaceRoom[];
  /** 문·입구·계단 앞 칸 — 통로의 끝점. */
  readonly portals: readonly number[];
  /** 방마다 깔개 수(carpets + 둥근 깔개·러너 무늬). */
  readonly rugs: ReadonlyMap<string, number>;
  /** 방마다 서는 기물 수. */
  readonly pieces: ReadonlyMap<string, number>;
}
export interface SpaceRoomStat { floor: number; empty: number; emptyPct: number; rect: [number, number, number, number] | null; rugs: number; fillPct: number; farPct: number; pieces: number }
export interface SpaceResult { readonly problems: string[]; readonly notes: string[]; readonly rooms: Record<string, SpaceRoomStat>; readonly emptyPct: number; readonly roomCV: number }

/** 문턱 — 기준 방 실측 바로 위(위 주석). */
export const SPACE = { minDensity: 0.18, densityMinFloor: 30, roomEmptyPct: 25, roomEmptyMinFloor: 30, rectMinSide: 3, rectArea: 12, corridorEmptyPct: 30, bigHall: 80, hallFillPct: 20, hallFarPct: 10, rugBigRoom: 150 } as const;

const N4: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const IDEAS: readonly [RegExp, string][] = [
  [/stair/u, "a centrepiece (statue, plant stand or side table), benches along the walls, a coat rack, a notice board"],
  [/book|stack|librar|archive/u, "rows of bookshelves back to back with 1-2 cell aisles, a library ladder, catalog drawers, a reading desk"],
  [/reading|study|office/u, "reading tables with chairs and lamps, a lectern, a desk with its chair, a globe"],
  [/common|tavern|taproom|hall|bar|dining|mess/u, "dining tables in rows with benches or chairs, a bar counter with stools, a hearth corner with armchairs"],
  [/entrance|foyer|lobby|reception/u, "a centrepiece (fountain or statue) flanked by columns, benches, plants and vases along the walls, a reception counter"],
  [/drawing|parlou?r|lounge|sitting/u, "a seating group (sofa, armchairs, tea table), a piano, display cabinets"],
  [/kitchen|pantry|larder/u, "work counters, a prep table, a range, barrels and sacks, shelves with pots"],
  [/guard|watch|barrack/u, "a table with stools, weapon racks, a brazier, a notice board"],
  [/cell|prison|jail|dungeon/u, "a cot, a straw pile, a slop bucket, shackles"],
  [/bed|guest|sleep|chamber/u, "a bed with a nightstand, a wardrobe, a chest at the foot, a washbasin"],
  [/stor|cellar|ware/u, "stacks of crates, barrels, sacks, shelves"],
  [/chapel|church|shrine|temple/u, "rows of pews facing an altar, candle stands, a lectern"],
  [/forge|smith|workshop/u, "an anvil by the forge, a quench tub, tool racks, a workbench"],
];
const ideasFor = (text: string): string => IDEAS.find(([re]) => re.test(text))?.[1] ?? "groups of furniture that belong together (a table with its chairs, a work counter with shelves, a seating corner)";
const isCorridor = (r: SpaceRoom) => r.role === "corridor" || /corridor|hallway|passage/u.test(`${r.id} ${r.purpose ?? ""}`.toLowerCase());

/** 가장 큰 참 사각형(막대 그래프 방법) — [x, y, w, h]. */
function largestRect(W: number, H: number, ok: (i: number) => boolean): { area: number; rect: [number, number, number, number] | null } {
  const hh = new Array<number>(W).fill(0); let best = 0, rect: [number, number, number, number] | null = null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) hh[x] = ok(y * W + x) ? hh[x]! + 1 : 0;
    const st: [number, number][] = [];
    for (let x = 0; x <= W; x++) {
      const cur = x < W ? hh[x]! : 0; let s0 = x;
      while (st.length && st[st.length - 1]![1] >= cur) { const [s1, h1] = st.pop()!; s0 = s1; const a = h1 * (x - s1); if (a > best) { best = a; rect = [s1, y - h1 + 1, x - s1, h1]; } }
      st.push([s0, cur]);
    }
  }
  return { area: best, rect };
}

export function spaceChecks(inp: SpaceInput): SpaceResult {
  const { W, H, isFloor, block, dais } = inp;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const idx = (x: number, y: number) => y * W + x;
  const solidAt = (x: number, y: number) => !inMap(x, y) || !isFloor(x, y) || block[idx(x, y)] === 1 || dais.has(idx(x, y));
  const problems: string[] = [], notes: string[] = [];
  const stats: Record<string, SpaceRoomStat> = {};
  let floorAll = 0, emptyAll = 0;
  for (const r of inp.rooms) {
    const fl = r.cells.filter((i) => isFloor(i % W, Math.floor(i / W)));
    const inRoom = new Set(fl);
    // 통로: 이 방의 문(입구·문 틈·계단 앞) 사이 최단 빈 바닥 길, 3칸 폭 — 빈 칸으로 치지 않는다.
    const ends = new Set<number>();
    for (const i of inp.portals) { const x = i % W, y = (i - x) / W; if (inRoom.has(i) && !block[i]) ends.add(i);
      for (const [dx, dy] of N4) { const j = idx(x + dx, y + dy); if (inMap(x + dx, y + dy) && inRoom.has(j) && !block[j]) ends.add(j); } }
    const circ = new Uint8Array(W * H);
    const E = [...ends];
    for (let a = 0; a < E.length; a++) {
      const prev = new Int32Array(W * H).fill(-2); prev[E[a]!] = -1; const q = [E[a]!]; let h = 0;
      while (h < q.length) { const i = q[h++]!; const x = i % W, y = (i - x) / W;
        for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; const j = idx(X, Y); if (inMap(X, Y) && inRoom.has(j) && !block[j] && prev[j] === -2) { prev[j] = i; q.push(j); } } }
      for (let b = a + 1; b < E.length; b++) { let i = E[b]!; if (prev[i] === -2) continue;
        while (i >= 0) { const x = i % W, y = (i - x) / W; circ[i] = 1; for (const [dx, dy] of N4) if (inMap(x + dx, y + dy)) circ[idx(x + dx, y + dy)] = 1; i = prev[i]!; } }
    }
    const dead = new Uint8Array(W * H); let nd = 0;
    for (const i of fl) { if (block[i]) continue; const x = i % W, y = (i - x) / W; let ok = true;
      for (let b = -1; b <= 1 && ok; b++) for (let a = -1; a <= 1; a++) if (solidAt(x + a, y + b)) { ok = false; break; }
      if (ok && !circ[i]) { dead[i] = 1; nd++; } }
    const big = largestRect(W, H, (i) => dead[i] === 1);
    // 큰 방 채움(통로 밖): 그 바닥 중 가구가 선 몫 · 2칸 안에 가구가 없는 몫
    let off = 0, blocked = 0, far = 0;
    const pieceNear = (x: number, y: number) => { for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const X = x + a, Y = y + b; if (inMap(X, Y) && (block[idx(X, Y)] || dais.has(idx(X, Y))) && inRoom.has(idx(X, Y))) return true; } return false; };
    for (const i of fl) { if (block[i]) { blocked++; continue; } if (circ[i]) continue; off++; const x = i % W, y = (i - x) / W; if (!pieceNear(x, y)) far++; }
    const fillPct = Math.round((100 * blocked) / Math.max(1, off + blocked)), farPct = Math.round((100 * far) / Math.max(1, off + blocked));
    const pct = Math.round((100 * nd) / Math.max(1, fl.length));
    const rugs = inp.rugs.get(r.id) ?? 0, pieces = inp.pieces.get(r.id) ?? 0;
    stats[r.id] = { floor: fl.length, empty: nd, emptyPct: pct, rect: big.rect, rugs, fillPct, farPct, pieces };
    floorAll += fl.length; emptyAll += nd;
    const br = big.rect;
    const raw = br ? [Math.max(0, br[0] - 1), Math.max(0, br[1] - 1), br[0] + br[2], br[1] + br[3]] : null;
    const rawTxt = raw ? `x=${raw[0]}..${raw[2]}, y=${raw[1]}..${raw[3]} (${raw[2]! - raw[0]! + 1}x${raw[3]! - raw[1]! + 1} cells)` : "";
    const wallsTxt = r.walls.length ? r.walls.map((w) => `"${w}"`).join(" or ") : "its walls";
    const need = Math.max(1, nd - Math.floor((SPACE.roomEmptyPct / 100) * fl.length));
    const what = r.purpose ? `${r.id} — ${r.purpose.split(/[.;]/u)[0]!.slice(0, 60)}` : r.id;
    const rectCase = !!br && Math.min(br[2], br[3]) >= SPACE.rectMinSide && big.area >= SPACE.rectArea;
    const target = rectCase ? `inside the empty area ${rawTxt} so that no empty patch of 3x4 or more is left` : `on or next to at least ${need} of the empty cells`;
    const choices = `Choose one: (a) shrink — move ${wallsTxt} in so this empty space disappears (shrink the map with it), or (b) fill — add a group of standing pieces that serves the room (${what}) ${target}, e.g. ${ideasFor(`${r.id} ${r.purpose ?? ""}`.toLowerCase())}. Rugs, carpets, decals and wall-mounted pieces do not count; moving the same pieces around will not pass.`;
    if (isCorridor(r)) { if (pct > SPACE.corridorEmptyPct && br && Math.min(br[2], br[3]) >= 2) problems.push(`corridor "${r.id}" is too wide: ${pct}% of its floor is empty (empty area ${rawTxt}). Make it 2-3 cells wide (move ${wallsTxt}) or line it with benches, racks, crates or torches.`); }
    else if (rectCase) problems.push(`room "${r.id}" has an empty floor area ${rawTxt} — nothing stands in it or next to it and no walkway between its doors crosses it (${pct}% of the room's floor is empty; walkways up to 3 cells wide between doors are not counted). ${choices}`);
    else if (pct > SPACE.roomEmptyPct && fl.length >= SPACE.roomEmptyMinFloor) problems.push(`room "${r.id}": ${pct}% of its floor is empty (limit ${SPACE.roomEmptyPct}%; cells with nothing in or next to them; largest empty area ${rawTxt}). ${choices}`);
    else if (fl.length >= SPACE.bigHall && !isCorridor(r) && (fillPct < SPACE.hallFillPct || farPct > SPACE.hallFarPct))
      problems.push(`room "${r.id}" (${fl.length} floor cells) is too sparse away from its walkways: only ${fillPct}% of that floor is furnished (need ${SPACE.hallFillPct}%) and ${farPct}% has no furniture within 2 cells (limit ${SPACE.hallFarPct}%). The walkways between doors may stay open; fill the rest with purpose — ${ideasFor(`${r.id} ${r.purpose ?? ""}`.toLowerCase())} — or make the room smaller (move ${wallsTxt}).`);
    // 기물 밀도: 서는 기물 수 / 바닥 칸. 흩어 놓은 기물 하나하나가 둘레 8칸을 «쓰는 칸»으로 만들어 빈 칸 검사는 성긴 방도 통과시켰다
    // (6회차 terra-high 여관 홀 15개/121칸 = 0.12 — 빈 칸 5%). 6회차 opus 방(Opus 판정에서 기준 방을 11/13 이긴 쪽)은 방마다 0.19~0.35.
    const dens = pieces / Math.max(1, fl.length);
    if (!isCorridor(r) && fl.length >= SPACE.densityMinFloor && dens < SPACE.minDensity) {
      const more = Math.ceil(SPACE.minDensity * fl.length) - pieces;
      problems.push(`room "${r.id}" is under-furnished: ${pieces} standing pieces on ${fl.length} floor cells (${dens.toFixed(2)} per cell; furnished rooms here have at least ${SPACE.minDensity}). Add at least ${more} more standing pieces that serve the room (${what}) — not scattered one by one but as groups that belong together, e.g. ${ideasFor(`${r.id} ${r.purpose ?? ""}`.toLowerCase())}; find_pieces(category) lists every piece of a category. Or make the room smaller (move ${wallsTxt}) so its pieces fill it. Rugs, decals and wall-mounted pieces do not count.`);
    }
    const cap = fl.length >= SPACE.rugBigRoom ? 2 : 1;
    if (rugs > cap) problems.push(`room "${r.id}" has ${rugs} rugs (carpets + round rug/runner) — at most ${cap} in a room of ${fl.length} floor cells. Remove ${rugs - cap}; vary the look with the room's floor instead (give rooms different floor ids). Rugs never count as furnishing.`);
  }
  // 방 크기 위계(알림만): 크기가 거의 같은 방 셋 이상이 나란히, 쓰임이 다르면 격자처럼 읽힌다.
  const areas = inp.rooms.map((r) => r.cells.length);
  const mean = areas.reduce((a, b) => a + b, 0) / Math.max(1, areas.length);
  const cv = areas.length > 1 ? Math.sqrt(areas.reduce((a, b) => a + (b - mean) ** 2, 0) / areas.length) / Math.max(1, mean) : 0;
  const sameSize = inp.rooms.filter((r, i) => !r.repeat && !isCorridor(r) && inp.rooms.filter((o, j) => j !== i && !o.repeat && !isCorridor(o) && Math.abs(o.cells.length - r.cells.length) <= 0.12 * Math.max(o.cells.length, r.cells.length)).length >= 2);
  const kinds = new Set(sameSize.map((r) => (r.purpose ?? r.id).toLowerCase().split(/\s+/u)[0]));
  if (sameSize.length >= 3 && kinds.size >= 2) notes.push(`Rooms ${sameSize.map((r) => `"${r.id}" (${r.cells.length} cells)`).join(", ")} are about the same size but serve different purposes. Real buildings size rooms by importance and use — main hall > dining or drawing room > bedrooms > closets and storage — so equal boxes read as a grid. Resize them so their sizes follow their roles (move the walls between them); if they really are repeated rooms (guest rooms, cells), add "repeat": true to those rooms.`);
  return { problems, notes, rooms: stats, emptyPct: Math.round((100 * emptyAll) / Math.max(1, floorAll)), roomCV: Math.round(cv * 100) / 100 };
}
