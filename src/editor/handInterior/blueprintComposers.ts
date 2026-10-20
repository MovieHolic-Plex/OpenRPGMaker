// editor/handInterior/blueprintComposers.ts
// AI 참고 청사진(spacePresetCatalog)이 고른 실내 공간을 요청 뉘앙스·씨앗에 맞춰 매번 새로 짜는 구성기.
//
// 왜 (2026-10-18 사용자 반려: 「프리셋을 사용자가 골라 그대로 깔지 말고 AI 가 참고해서, 똑같이 깔지 말고」 + 적대적 VQA):
//   옛 20종 갤러리는 견본 방 한 벌을 그대로 찍었다 — 오피스 로비는 바닥 70% 가 빈 베이지 타일, 안내 데스크가 구석,
//   강의실은 책상 사이가 휑했고 왕좌 기둥은 융단에서 멀었다. 여기서는 청사진의 규칙(구역 비율·중심 초점·필수 가구 무리·
//   융단 동선·벽 리듬)만 고정하고, 방 비율·좌우 반전·문 자리·가구 무리 수·팔레트는 씨앗과 요청으로 정한다.
//
// 결과는 build_hand_interior_room 의 rooms·connect·exit·objects·tables·lines·zones·goods·daises 인자다(도구가 그대로 검증·시공).
// 배치는 도구와 같은 평면 분석(analyseHandInteriorPlan)으로 미리 검사해, 맞지 않는 장식은 버리고 막힌 바닥이 생기면 장식부터 걷는다.

import {
  analyseHandInteriorPlan,
  isFlushTravelPiece,
  type HandInteriorDais,
  type HandInteriorGoods,
  type HandInteriorLine,
  type HandInteriorObject,
  type HandInteriorSpec,
  type HandInteriorTable,
  type HandInteriorPlanAnalysis,
  type HandInteriorZone,
} from "./builder";
import { composeHandInteriorRooms, type ComposedRooms, type HandInteriorConnect, type HandInteriorExit, type HandInteriorRoom } from "./rooms";
import { composeJpHouseBlueprint } from "./jpHouseBlueprint";

/** 요청 문장에서 읽은 공간 뉘앙스. */
export interface SpaceNuance {
  readonly scale: "compact" | "standard" | "grand";
  readonly mood: "neutral" | "warm" | "cool" | "dark";
  /** 요청에 나온 기능 낱말(카페·회의·도서·무기·다리·테라스·벚꽃·야경 …) — 청사진이 선택 구역을 켜고 끈다. */
  readonly wants: ReadonlySet<string>;
}

export interface BlueprintInteriorArgs {
  readonly tileset: string;
  readonly floor: string;
  readonly wall: string;
  readonly ceiling?: string;
  /** 방 사각형·문·출구(도구가 칸막이를 계산). 위층처럼 바깥 출구가 없는 청사진은 대신 plan·start 를 준다(일본 집 2층). */
  readonly rooms?: readonly HandInteriorRoom[];
  readonly connect?: readonly HandInteriorConnect[];
  readonly exit?: HandInteriorExit;
  readonly plan?: readonly string[];
  readonly start?: readonly { readonly x: number; readonly y: number }[];
  readonly zones: readonly HandInteriorZone[];
  readonly objects: readonly HandInteriorObject[];
  readonly tables: readonly HandInteriorTable[];
  readonly lines: readonly HandInteriorLine[];
  readonly goods: readonly HandInteriorGoods[];
  readonly daises: readonly HandInteriorDais[];
  /** 짠 구역 이름과 사각형(맵 위치 이름표용). */
  readonly areas: readonly { readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  /** 무엇을 골랐는지 한 줄씩(반전·비율·팔레트·선택 구역). */
  readonly decisions: readonly string[];
}

/** mulberry32 — 같은 씨앗이면 같은 배치, 씨앗이 다르면 비율·반전·무리 수가 달라진다. */
export function blueprintRng(seed: number): () => number {
  let a = (Math.floor(seed) >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickInt = (rng: () => number, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
const pickOf = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

interface FloorRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly faceY: number }
interface Item {
  readonly kind: "object" | "table" | "line" | "goods";
  readonly core: boolean;
  readonly blocks: readonly number[];
  readonly surface: readonly number[];
  readonly flats: readonly number[];
  readonly hangs: readonly number[];
  readonly object?: HandInteriorObject;
  readonly table?: HandInteriorTable;
  readonly line?: HandInteriorLine;
  readonly goods?: HandInteriorGoods;
}

/**
 * 방 사각형 + 이음 + 출구로 평면을 먼저 짜고, 가구를 도구 규칙대로 미리 검사하며 쌓는 밑그림.
 * 문 틈·출구 앞 칸은 비워 두고, 끝에 출구에서 모든 바닥에 닿는지 확인해 막는 장식을 걷는다.
 */
export class InteriorSketch {
  readonly composed: ComposedRooms;
  readonly W: number;
  readonly H: number;
  private readonly A: HandInteriorPlanAnalysis;
  private readonly byId = new Map<string, HandInteriorRoom>();
  private readonly keep = new Set<number>();
  private readonly flushFace = new Set<number>();
  private items: Item[] = [];
  readonly zones: HandInteriorZone[] = [];
  readonly daises: HandInteriorDais[] = [];

  constructor(readonly spec: HandInteriorSpec, readonly rooms: readonly HandInteriorRoom[], readonly connect: readonly HandInteriorConnect[], readonly exit: HandInteriorExit) {
    this.composed = composeHandInteriorRooms(rooms, connect, exit, spec);
    this.A = analyseHandInteriorPlan(this.composed.plan);
    this.W = this.A.W; this.H = this.A.H;
    for (const r of rooms) this.byId.set(r.id, r);
    // 문 양쪽으로 곧게 두 칸은 비운다(furnish.ts doorwayCells 와 같은 규칙 - 2026-10-19 통행 감사).
    for (const o of this.composed.openings) {
      if (o.kind === "h") for (let y = o.y - 2; y <= o.y + 3; y++) this.keepCell(o.x, y);
      else for (let x = o.x - 2; x <= o.x + 2; x++) this.keepCell(x, o.y);
    }
    const ex = this.composed.exit;
    for (let x = ex.x; x < ex.x + ex.width; x++) for (let y = ex.y - 2; y <= ex.y; y++) this.keepCell(x, y);
  }

  /** 방의 걷는 바닥 사각형(맨 위 두 줄 벽면 제외)과 걸이를 거는 벽면 윗줄 y. */
  floorOf(id: string): FloorRect {
    const r = this.byId.get(id);
    if (!r) throw new Error(`blueprint sketch: room ${id} missing`);
    return { x0: r.x0, y0: r.y0 + 2, x1: r.x1, y1: r.y1, faceY: r.y0 };
  }

  opening(a: string, b: string): { x: number; y: number } | undefined {
    return this.composed.openings.find((o) => (o.a === a && o.b === b) || (o.a === b && o.b === a));
  }

  keepCell(x: number, y: number): void { if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.keep.add(y * this.W + x); }
  keepRect(x0: number, y0: number, x1: number, y1: number): void { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.keepCell(x, y); }

  private taken(i: number): boolean { return this.items.some((it) => it.blocks.includes(i)); }
  private flatTaken(i: number): boolean { return this.items.some((it) => it.flats.includes(i)); }
  private hangTaken(i: number): boolean { return this.items.some((it) => it.hangs.includes(i)); }

  /** 가구 하나 — 도구 규칙(바닥·벽 가구 발밑, 벽 가구 북쪽 벽면, 걸이 벽면 윗줄, 엘리베이터 벽면)과 겹침·비울 칸을 검사한다. */
  put(id: string, x: number, y: number, core = false): boolean {
    const d = this.spec.objects[id];
    if (!d) return false;
    const { A, W } = this;
    if (d.kind === "floor" || d.kind === "wall") {
      const flush = isFlushTravelPiece(d);
      const cells: number[] = [];
      for (let dy = 0; dy < d.h; dy++) for (let dx = 0; dx < d.w; dx++) {
        const cx = x + dx, cy = y + dy;
        if (!A.isFloor(cx, cy)) return false;
        const i = cy * W + cx;
        if (this.taken(i) || (!flush && this.keep.has(i))) return false;
        cells.push(i);
      }
      if (d.kind === "wall") for (let dx = 0; dx < d.w; dx++) {
        if (A.face[y - 1]?.[x + dx] !== 2) return false;
        if (flush && A.face[y - 2]?.[x + dx] !== 1) return false;
        if (flush && (this.hangTaken((y - 2) * W + x + dx) || this.hangTaken((y - 1) * W + x + dx))) return false;
      }
      if (flush) for (let dx = 0; dx < d.w; dx++) { this.flushFace.add((y - 1) * W + x + dx); this.flushFace.add((y - 2) * W + x + dx); }
      const surface = d.surface ? cells.filter((_, k) => Math.floor(k / d.w) < Math.max(1, d.h)) : [];
      this.items.push({ kind: "object", core, blocks: flush ? [] : cells, surface, flats: [], hangs: [], object: { id, x, y } });
      if (flush) for (const i of cells) this.keep.add(i);
      return true;
    }
    if (d.kind === "hang") {
      const cells: number[] = [];
      for (let dx = 0; dx < Math.max(1, d.w); dx++) {
        if (A.face[y]?.[x + dx] !== 1) return false;
        const i = y * W + x + dx;
        if (this.flushFace.has(i) || this.flushFace.has((y + 1) * W + x + dx) || this.hangTaken(i)) return false;
        cells.push(i);
      }
      this.items.push({ kind: "object", core, blocks: [], surface: [], flats: [], hangs: cells, object: { id, x, y } });
      return true;
    }
    if (d.kind === "flat") {
      const cells: number[] = [];
      for (let dy = 0; dy < Math.max(1, d.h); dy++) for (let dx = 0; dx < d.w; dx++) {
        if (!A.isFloor(x + dx, y + dy)) return false;
        const i = (y + dy) * W + x + dx;
        if (this.flatTaken(i)) return false;
        cells.push(i);
      }
      this.items.push({ kind: "object", core, blocks: [], surface: [], flats: cells, hangs: [], object: { id, x, y } });
      return true;
    }
    return false;
  }

  /** 탁자 자동 타일(w×h) — 윗면이 탁상 물건 자리가 된다. */
  table(style: string, x: number, y: number, w: number, h: number, core = false): boolean {
    const d = this.spec.tables[style];
    if (!d || (d.oneRow && h !== 1)) return false;
    const cells: number[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!this.A.isFloor(x + i, y + j)) return false;
      const c = (y + j) * this.W + x + i;
      if (this.taken(c) || this.keep.has(c)) return false;
      cells.push(c);
    }
    this.items.push({ kind: "table", core, blocks: cells, surface: cells, flats: [], hangs: [], table: { style, x, y, w, h } });
    return true;
  }

  /** 깔개·융단 줄 자동 타일(밟는 무늬) — 사각형 전체가 바닥이어야 한다. */
  rug(id: string, x0: number, y0: number, x1: number, y1: number, core = false): boolean {
    const d = this.spec.lines[id];
    if (!d || d.kind !== "flat") return false;
    const cells: number[] = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.A.isFloor(x, y)) return false;
      const i = y * this.W + x;
      if (this.flatTaken(i)) return false;
      cells.push(i);
    }
    this.items.push({ kind: "line", core, blocks: [], surface: [], flats: cells, hangs: [], line: { id, rect: { x0, y0, x1, y1 } } });
    return true;
  }

  /** 탁상 물건 — 윗면 있는 가구 칸 위에만. */
  goods(id: string, x: number, y: number): boolean {
    if (this.spec.goods[id] === undefined) return false;
    const i = y * this.W + x;
    if (!this.items.some((it) => it.surface.includes(i))) return false;
    if (this.items.some((it) => it.kind === "goods" && it.goods!.x === x && it.goods!.y === y)) return false;
    this.items.push({ kind: "goods", core: false, blocks: [], surface: [], flats: [], hangs: [], goods: { id, x, y } });
    return true;
  }

  zone(x0: number, y0: number, x1: number, y1: number, floor: string): void {
    if (this.spec.floors[floor]) this.zones.push({ x0, y0, x1, y1, floor });
  }

  dais(id: string, x: number, y: number, w: number, h: number): void {
    if (this.spec.daises[id]) this.daises.push({ id, x, y, w, h });
  }

  /** 출구에서 걸어 닿지 못하는 빈 바닥 칸 수. */
  private unreached(items: readonly Item[]): number {
    const { A, W, H } = this;
    const blocked = new Set<number>();
    for (const it of items) for (const i of it.blocks) blocked.add(i);
    const ex = this.composed.exit;
    const seen = new Set<number>();
    const queue: number[] = [];
    for (let x = ex.x; x < ex.x + ex.width; x++) { const i = ex.y * W + x; if (!blocked.has(i)) { seen.add(i); queue.push(i); } }
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % W, y = Math.floor(i / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || !A.isFloor(nx, ny)) continue;
        const j = ny * W + nx;
        if (seen.has(j) || blocked.has(j)) continue;
        seen.add(j); queue.push(j);
      }
    }
    let n = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A.isFloor(x, y) && !blocked.has(y * W + x) && !seen.has(y * W + x)) n++;
    return n;
  }

  /** 막힌 바닥이 생기면 그 원인 장식(core 아님)을 뒤에서부터 걷는다. 걷힌 가구 위 탁상 물건도 함께 뺀다. */
  private settle(): number {
    let gaps = this.unreached(this.items);
    for (let k = this.items.length - 1; k >= 0 && gaps > 0; k--) {
      const it = this.items[k]!;
      if (it.core || !it.blocks.length) continue;
      const without = this.items.filter((_, j) => j !== k);
      const g = this.unreached(without);
      if (g < gaps) { this.items = without; gaps = g; }
    }
    const surfaces = new Set<number>();
    for (const it of this.items) for (const i of it.surface) surfaces.add(i);
    this.items = this.items.filter((it) => it.kind !== "goods" || surfaces.has(it.goods!.y * this.W + it.goods!.x));
    return gaps;
  }

  finish(base: { tileset: string; floor: string; wall: string; ceiling?: string }, areas: BlueprintInteriorArgs["areas"], decisions: readonly string[]): BlueprintInteriorArgs {
    const gaps = this.settle();
    const pick = <K extends keyof Item>(kind: Item["kind"], key: K) => this.items.filter((it) => it.kind === kind).map((it) => it[key]!) as NonNullable<Item[K]>[];
    return {
      ...base,
      rooms: this.rooms, connect: this.connect, exit: this.exit,
      zones: this.zones, daises: this.daises,
      objects: pick("object", "object") as HandInteriorObject[],
      tables: pick("table", "table") as HandInteriorTable[],
      lines: pick("line", "line") as HandInteriorLine[],
      goods: pick("goods", "goods") as HandInteriorGoods[],
      areas,
      decisions: gaps ? [...decisions, `닿지 않는 바닥 ${gaps}칸 남음`] : decisions,
    };
  }
}

const areaOf = (name: string, f: FloorRect) => ({ name, x: f.x0, y: f.faceY, w: f.x1 - f.x0 + 1, h: f.y1 - f.faceY + 1 });

/** 벽면 윗줄에 걸이를 리듬 있게 건다 — 시작 칸부터 step 칸마다, 조각 폭이 들어가는 자리만. */
function hangRhythm(s: InteriorSketch, f: FloorRect, ids: readonly string[], start: number, step: number): void {
  let k = 0;
  for (let x = f.x0 + start; x <= f.x1; x += step) {
    if (s.put(ids[k % ids.length]!, x, f.faceY)) k++;
  }
}

// ─────────────────────────────────────────────── 오피스 로비 (modern_city) ───────────────────────────────────────────────

const LOBBY_PALETTES = {
  neutral: { hall: ["mci-stone-lobby", "mci-wall-lobby"], runner: "mci-carpet-office", office: ["mci-carpet-office", "mci-wall-office"], meeting: ["mci-wood-oak", "mci-wall-lobby"], pantry: ["mci-tile-small", "mci-wall-tile"] },
  cool: { hall: ["mci-tile-concourse", "mci-wall-store"], runner: "mci-carpet-office", office: ["mci-vinyl-store", "mci-wall-office"], meeting: ["mci-carpet-office", "mci-wall-lobby"], pantry: ["mci-tile-small", "mci-wall-tile"] },
  warm: { hall: ["mci-wood-oak", "mci-wall-home"], runner: "mci-carpet-office", office: ["mci-wood-oak", "mci-wall-home"], meeting: ["mci-wood-dark", "mci-wall-brick"], pantry: ["mci-tile-small", "mci-wall-tile"] },
  dark: { hall: ["mci-wood-dark", "mci-wall-brick"], runner: "mci-carpet-office", office: ["mci-carpet-office", "mci-wall-office"], meeting: ["mci-stone-lobby", "mci-wall-lobby"], pantry: ["mci-concrete", "mci-wall-metal"] },
} as const;

/**
 * 오피스 로비 청사진 — 정문 → 중앙 융단 → 정면 안내 데스크(양옆 보안 게이트) → 엘리베이터 뱅크가 한 축에 선다.
 * 융단 양옆은 대기 라운지(소파·탁자·화분)와 카페 대기석, 북쪽 윙은 마주 보는 업무 섬·회의실(긴 탁자·발표 화면)·탕비실.
 */
export function composeOfficeLobby(spec: HandInteriorSpec, nuance: SpaceNuance, seed: number): BlueprintInteriorArgs {
  const rng = blueprintRng(seed);
  const grand = nuance.scale === "grand", compact = nuance.scale === "compact";
  const mood = nuance.mood === "neutral" ? pickOf(rng, ["neutral", "cool"] as const) : nuance.mood;
  const pal = LOBBY_PALETTES[mood];
  const withPantry = !compact || nuance.wants.has("cafe") || nuance.wants.has("pantry");
  const wOffice = pickInt(rng, 14, 16) + (grand ? 4 : 0) - (compact ? 2 : 0);
  const wMeeting = pickInt(rng, 9, 11) + (grand ? 2 : 0);
  const wPantry = withPantry ? pickInt(rng, 7, 8) : 0;
  const topH = pickInt(rng, 10, 11) + (grand ? 1 : 0);
  const hallH = pickInt(rng, 11, 12) + (grand ? 1 : 0) - (compact ? 1 : 0);
  const mirror = rng() < 0.5;
  const order = (withPantry ? ["office", "meeting", "pantry"] : ["office", "meeting"]) as ("office" | "meeting" | "pantry")[];
  if (mirror) order.reverse();
  const widths = { office: wOffice, meeting: wMeeting, pantry: wPantry };
  const rooms: HandInteriorRoom[] = [];
  let x = 1;
  for (const id of order) {
    const [floor, wall] = pal[id];
    rooms.push({ id, x0: x, y0: 1, x1: x + widths[id] - 1, y1: topH, floor, wall });
    x += widths[id] + 1;
  }
  const innerX1 = x - 2;
  const hall: HandInteriorRoom = { id: "hall", x0: 1, y0: topH + 2, x1: innerX1, y1: topH + 1 + hallH, floor: pal.hall[0], wall: pal.hall[1] };
  rooms.push(hall);
  const cx = Math.floor((hall.x0 + hall.x1) / 2);
  const office = rooms.find((r) => r.id === "office")!;

  // 업무 섬 열: 섬(책상 2개 = 4칸) + 통로 2칸. 문은 가운데 통로에 낸다.
  const islandCols: number[] = [];
  const officeInner = office.x1 - office.x0 + 1;
  const islandCount = Math.max(1, Math.floor((officeInner - 2) / 6));
  const islandSpan = islandCount * 4 + (islandCount - 1) * 2;
  const islandX0 = office.x0 + Math.floor((officeInner - islandSpan) / 2);
  for (let k = 0; k < islandCount; k++) islandCols.push(islandX0 + k * 6);
  const aisleCols = islandCols.slice(0, -1).map((c) => c + 4);
  const officeDoorX = aisleCols.length ? aisleCols[Math.floor(aisleCols.length / 2)]! : (mirror ? office.x0 + 1 : office.x1 - 1);
  const bank = grand ? 3 : 2;
  const bankX0 = cx - (bank === 3 ? 4 : 3);
  const bankX1 = bankX0 + bank * 3 - 2;
  const clearOfBank = (dx: number) => dx < bankX0 - 1 || dx > bankX1 + 1;
  // 칸막이 문은 틈만 열면 어디가 문인지 몰랐다(2026-10-18 사용자 반려 「문이 어디있는지도 모르겠고」) — 업무·회의실은 유리 자동문, 탕비실은 나무 문을 단다.
  const connect: HandInteriorConnect[] = [{ a: "office", b: "hall", at: clearOfBank(officeDoorX) ? officeDoorX : (mirror ? office.x0 + 1 : office.x1 - 1), door: "mci-door-glass" }];
  const sideRow = 1 + 2 + 1; // 윙 첫 통로 줄(바닥 둘째 줄)
  connect.push({ a: "office", b: "meeting", at: sideRow });
  const meeting = rooms.find((r) => r.id === "meeting")!;
  const meetingDoorX = [Math.floor((meeting.x0 + meeting.x1) / 2), meeting.x0 + 1, meeting.x1 - 1].find(clearOfBank);
  if (meetingDoorX !== undefined) connect.push({ a: "meeting", b: "hall", at: meetingDoorX, door: "mci-door-glass" });
  if (withPantry) {
    const pantry = rooms.find((r) => r.id === "pantry")!;
    const pdx = mirror ? pantry.x0 + 1 : pantry.x1 - 1;
    connect.push({ a: "pantry", b: "hall", at: pdx, door: "mci-door-wood" });
  }
  const exit: HandInteriorExit = { room: "hall", x: cx, width: 1 };
  const s = new InteriorSketch(spec, rooms, connect, exit);
  const decisions: string[] = [
    `${mirror ? "업무 윙 동쪽" : "업무 윙 서쪽"} · 업무 섬 ${islandCount * 2}쌍 · 엘리베이터 ${bank}기`,
    `팔레트 ${mood} · ${withPantry ? "탕비실 포함" : "탕비실 생략(소형)"} · 로비 ${hall.x1 - hall.x0 + 1}×${hallH - 2}`,
  ];

  // ── 로비 홀
  const h = s.floorOf("hall");
  const r = (k: number) => h.y0 + k;
  const last = h.y1;
  // 중앙 융단: 정문에서 안내 데스크 앞까지 3칸 폭.
  s.zone(cx - 1, r(3), cx + 1, h.y1 + 1, pal.runner);
  s.keepRect(cx - 1, r(3), cx + 1, last);
  s.keepRect(bankX0 - 1, r(1), bankX1 + 1, r(1));
  for (let k = 0; k < bank; k++) s.put("mci-elevator", bankX0 + k * 3, r(0), true);
  s.put("mci-wall-clock", bankX0 + 2, h.faceY);
  s.put("mci-plant-tall", bankX0 - 1, r(0));
  s.put("mci-plant-tall", bankX1 + 1, r(0));
  // 정면 안내 데스크 + 양옆 보안 게이트(사이 1칸 통로).
  s.put("mci-reception", cx - 1, r(2), true);
  s.put("mci-security-gate", cx - 4, r(2), true);
  s.put("mci-security-gate", cx + 3, r(2), true);
  s.put("mci-plant-tall", cx - 5, r(2));
  s.put("mci-plant-tall", cx + 5, r(2));
  s.put("mci-rug", cx - 1, last - 1);
  // 융단 따라 화분 기둥(3줄 간격).
  for (let y = r(5); y <= last - 2; y += 3) { s.put("mci-plant-tall", cx - 3, y); s.put("mci-plant-tall", cx + 3, y); }
  // 정문 바람막이: 출입 매트 양옆 화분 한 쌍, 안내 키오스크는 그 바깥 — 남쪽 정문 틈이 한눈에 보이도록(2026-10-18 사용자 반려 「문이 어디있는지도 모르겠고」).
  s.put("mci-plant-tall", cx - 2, last);
  s.put("mci-plant-tall", cx + 2, last);
  s.put("dept-directory-kiosk", cx + 4, last - 1);
  // 북쪽 벽 리듬: 창·액자·게시판, 벽 가구(우편함·자판기·잡지대).
  // 창밖은 낮 하늘(블라인드)이 기본, 밤·야경을 요청했을 때만 불 켜진 빌딩 야경 창(2026-10-18 사용자 반려 「창문 밖은 항상 어둡기만 한거냐」).
  const cityWindow = nuance.mood === "dark" ? "mci-window-city" : "mci-window-blind";
  hangRhythm(s, h, [cityWindow, "mci-art-frame", cityWindow, "mci-notice-board"], 1, 4);
  const westWall = [h.x0 + 1, h.x0 + 4], eastWall = [h.x1 - 2, h.x1 - 5];
  s.put(mirror ? "subway-vending-machine" : "mci-mailboxes", westWall[0]!, r(0));
  s.put("mci-magazine", westWall[1]!, r(0));
  s.put(mirror ? "mci-mailboxes" : "subway-vending-machine", eastWall[0]!, r(0));
  s.put("mci-coffee-station", eastWall[1]!, r(0));
  s.put("mci-plant-tall", h.x0, r(0));
  s.put("mci-plant-tall", h.x1, r(0));

  // 라운지(서쪽 또는 동쪽 반쪽) — 깔개 위 소파·탁자·안락의자 무리 + 카페 대기석.
  const lounge = (lx0: number, lx1: number, kind: "sofa" | "cafe") => {
    const mid = Math.floor((lx0 + lx1) / 2);
    if (kind === "sofa") {
      const sx = mid - 1;
      // 안락의자는 2칸 높이 그림이라 소파 끝 바로 아래(sx-1·sx+3)에 두면 윗칸이 소파 모서리에 붙어 ㄴ자로 겹쳐 보였다
      // (2026-10-18 사용자 반려 「소파 맞닿은 그러나 ㄴ하는거 다 어색하게 겹쳐있네」) — 소파 양끝에서 한 칸 띄운다.
      s.put("mci-plant-tall", sx - 3, r(4));
      s.put("mci-sofa", sx, r(4), true);
      s.put("mci-plant-tall", sx + 5, r(4));
      s.put("mci-rug", sx, r(5));
      s.put("mci-armchair", sx - 2, r(5));
      s.put("mci-coffee-table", sx, r(5), true);
      s.goods(pickOf(rng, ["mci-g-coffee", "mci-g-vase"]), sx, r(5));
      s.goods("mci-g-books", sx + 1, r(5));
      s.put("mci-armchair", sx + 4, r(5));
      if (r(8) <= last - 1) {
        s.put("mci-planter", sx - 2, r(8));
        s.put("lounge-sofa-cream", sx + 1, r(8));
        s.put("mci-planter", sx + 4, r(8));
      }
    } else {
      // 카페 대기석: 2줄은 세트 사이가 맨바닥으로 비었다(2026-10-18 VQA 4회차) — 3줄 엇갈림 + 세트 사이 화분.
      const cafeRows = ([[0, r(4)], [1, r(6)], [0, r(8)]] as const).filter(([, y]) => y <= last - 1);
      for (const [k, y] of cafeRows) {
        const tx = mid - 3 + k;
        for (const off of [0, 4]) {
          s.put("mci-cafe-chair-e", tx + off - 1, y);
          if (s.put("mci-cafe-table", tx + off, y)) s.goods(pickOf(rng, ["mci-g-coffee", "mci-g-laptop", "mci-g-papers"]), tx + off, y);
          s.put("mci-cafe-chair-w", tx + off + 1, y);
        }
        s.put("mci-planter", tx + 2 + (k ? -4 : 6), y);
      }
      // 대기 의자는 마지막 탁자 줄과 한 줄 이상 떨어질 때만 — 바로 밑에 붙으면 의자 2×3 덩어리로 뭉쳐 보였다(2026-10-18 사용자 반려).
      if (last - 1 - cafeRows[cafeRows.length - 1]![1] >= 2) s.put("mci-wait-bench", mid - 1, last - 1);
    }
  };
  const westKind = rng() < 0.5 ? "sofa" : "cafe";
  lounge(h.x0 + 1, cx - 5, westKind);
  lounge(cx + 5, h.x1 - 1, westKind === "sofa" ? "cafe" : "sofa");
  s.put("mci-plant-tall", h.x0, last);
  s.put("mci-plant-tall", h.x1, last);

  // ── 업무 윙: 마주 보는 책상 섬(북쪽 의자 + 북향 화면 / 남향 화면), 섬 끝 긴 화분 칸막이.
  const o = s.floorOf("office");
  s.keepRect(o.x0, o.y0 + 1, o.x1, o.y0 + 1);
  hangRhythm(s, o, ["mci-window-blind", "mci-whiteboard", "mci-window-blind", "mci-wall-clock"], 1, 4);
  for (let wx = o.x0; wx + 1 <= o.x1; wx += 4) s.put(pickOf(rng, ["mci-shelf-office", "mci-filing", "mci-shelf-office"]), wx, o.y0);
  const islandRows = [o.y0 + 2];
  if (o.y0 + 6 + 2 <= o.y1) islandRows.push(o.y0 + 6);
  for (const iy of islandRows) {
    for (const ix of islandCols) {
      for (const dx of [0, 2]) {
        s.put("mci-chair-office-s", ix + dx, iy);
        s.put("mci-chair-office-s", ix + dx + 1, iy);
        // PC 책상은 모니터가 4층을 쓴다 — 탁상 물건을 올리지 않는다(goods-no-layer).
        s.put("mci-desk-pc-back", ix + dx, iy + 1, true);
        s.put("mci-desk-pc", ix + dx, iy + 2, true);
        s.put("mci-chair-office-n", ix + dx, iy + 3);
        s.put("mci-chair-office-n", ix + dx + 1, iy + 3);
      }
    }
  }
  s.put("mci-plant-tall", o.x0, o.y1);
  s.put("mci-plant-tall", o.x1, o.y1);
  s.put("mci-cooler", o.x1 - 1, o.y0);

  // ── 회의실: 발표 화면·화이트보드, 긴 회의 탁자(북쪽 의자 줄 + 양끝 의자), 서류장.
  const m = s.floorOf("meeting");
  const mcx = Math.floor((m.x0 + m.x1) / 2);
  s.put("mci-tv-wall", mcx - 1, m.faceY, true);
  s.put("mci-whiteboard", mcx - 4, m.faceY);
  s.put("mci-window-blind", mcx + 2, m.faceY);
  s.put("mci-plant-tall", m.x0, m.y0);
  s.put("mci-plant-tall", m.x1, m.y0);
  s.put("mci-filing", m.x1 - 2, m.y0);
  const tw = Math.max(4, m.x1 - m.x0 + 1 - 4);
  const tx = m.x0 + 2, ty = m.y0 + 3;
  s.keepRect(m.x0, m.y0 + 1, m.x1, m.y0 + 1);
  if (s.table("mci-t-meeting", tx, ty, tw, 2, true)) {
    for (let k = 0; k < tw; k++) { s.put("mci-chair-office-s", tx + k, ty - 1); s.put("mci-chair-office-n", tx + k, ty + 2); }
    s.put("mci-cafe-chair-e", tx - 1, ty); s.put("mci-cafe-chair-e", tx - 1, ty + 1);
    s.put("mci-cafe-chair-w", tx + tw, ty); s.put("mci-cafe-chair-w", tx + tw, ty + 1);
    const g = ["mci-g-laptop", "mci-g-papers", "mci-g-coffee", "mci-g-laptop", "mci-g-papers", "mci-g-coffee", "mci-g-phone"];
    for (let k = 0; k < tw; k++) s.goods(g[(k + seed) % g.length]!, tx + k, ty + (k % 2));
  }
  if (ty + 4 <= m.y1) {
    s.put("lounge-sofa-cream", m.x0 + 1, m.y1);
    s.put("mci-plant-tall", m.x1, m.y1);
    s.put("mci-coffee-table", m.x1 - 3, m.y1);
  }

  // ── 탕비실: 조리대·커피 머신·냉장고 벽, 2인 식탁 두 벌, 자판기.
  if (withPantry) {
    const p = s.floorOf("pantry");
    s.put("mci-menu-board", p.x0 + 1, p.faceY);
    s.put("mci-ac-wall", p.x1 - 2, p.faceY);
    s.put("mci-kitchen", p.x0, p.y0, true);
    s.put("mci-coffee-station", p.x0 + 3, p.y0, true);
    s.put("mci-fridge", p.x1, p.y0);
    s.keepRect(p.x0, p.y0 + 1, p.x1, p.y0 + 1);
    const pcx = Math.floor((p.x0 + p.x1) / 2);
    for (const ty2 of [p.y0 + 3, p.y0 + 6]) {
      if (ty2 + 1 > p.y1 - 1) continue;
      if (s.table("mci-t-wood", pcx - 1, ty2, 2, 2)) {
        s.put("mci-cafe-chair-e", pcx - 2, ty2); s.put("mci-cafe-chair-e", pcx - 2, ty2 + 1);
        s.put("mci-cafe-chair-w", pcx + 1, ty2); s.put("mci-cafe-chair-w", pcx + 1, ty2 + 1);
        s.goods("mci-g-coffee", pcx - 1, ty2); s.goods(pickOf(rng, ["mci-g-vase", "mci-g-papers"]), pcx, ty2 + 1);
      }
    }
    s.put("mci-plant-tall", mirror ? p.x1 : p.x0, p.y1);
  }

  const areas = [areaOf("로비 홀", h), areaOf("업무 윙", o), areaOf("회의실", m), ...(withPantry ? [areaOf("탕비실", s.floorOf("pantry"))] : [])];
  return s.finish({ tileset: "modern_city", floor: pal.hall[0], wall: pal.hall[1] }, areas, decisions);
}

// ─────────────────────────────────────────────── 대학 강의동 (modern_campus) ───────────────────────────────────────────────

const LECTURE_PALETTES = {
  neutral: { lecture: ["mc-floor-lino", "mc-wall-class"], stage: "mc-floor-parquet", aisle: "mc-floor-corridor", seminar: ["mc-floor-parquet", "mc-wall-class"], corridor: ["mc-floor-corridor", "mc-wall-corridor"] },
  warm: { lecture: ["mc-floor-parquet", "mc-wall-class"], stage: "mc-floor-cafe", aisle: "mc-floor-lino", seminar: ["mc-floor-dorm", "mc-wall-dorm"], corridor: ["mc-floor-corridor", "mc-wall-corridor"] },
  cool: { lecture: ["mc-floor-lino", "mc-wall-corridor"], stage: "mc-floor-parquet", aisle: "mc-floor-corridor", seminar: ["mc-floor-cafe", "mc-wall-cafe"], corridor: ["mc-floor-corridor", "mc-wall-corridor"] },
  dark: { lecture: ["mc-floor-parquet", "mc-wall-dorm"], stage: "mc-floor-dorm", aisle: "mc-floor-corridor", seminar: ["mc-floor-dorm", "mc-wall-dorm"], corridor: ["mc-floor-lino", "mc-wall-corridor"] },
} as const;

/**
 * 대학 강의동 청사진 — 북쪽 벽 넓은 칠판·영사막 + 교단(연단 단)과 강의대, 중앙 통로를 사이에 둔 좌우 장책상 줄,
 * 세미나·동아리실(마주 앉는 토의 탁자·벽 서가·독서 소파), 사물함·게시판·음수대가 줄 선 복도.
 */
export function composeLectureWing(spec: HandInteriorSpec, nuance: SpaceNuance, seed: number): BlueprintInteriorArgs {
  const rng = blueprintRng(seed);
  const grand = nuance.scale === "grand", compact = nuance.scale === "compact";
  const mood = nuance.mood === "neutral" ? pickOf(rng, ["neutral", "neutral", "warm"] as const) : nuance.mood;
  const pal = LECTURE_PALETTES[mood];
  const benchesPerSide = pickInt(rng, 2, 3) + (grand ? 1 : 0) - (compact ? 1 : 0);
  const wLecture = Math.max(13, benchesPerSide * 3 * 2 + 3 + 2);
  const wSeminar = pickInt(rng, 10, 12) + (grand ? 2 : 0) - (compact ? 1 : 0);
  const topH = pickInt(rng, 12, 13) + (grand ? 2 : 0) - (compact ? 2 : 0);
  // 복도는 바닥 대여섯 줄로 건물 전폭을 지난다. 계단실은 강의실·세미나실 좌·우 양 끝에 맨 북쪽 바깥 벽까지 닿는 2칸 폭 세로 방 —
  // 복도 북벽은 강의실과 맞댄 칸막이라 거기 벽 속 계단을 두면 빌더가 「칸막이 속으로 이어진다」 경고를 낸다.
  const corH = pickInt(rng, 6, 7);
  const mirror = rng() < 0.5;
  const SX = 5; // 계단실 바깥 폭(바닥 3칸 + 칸막이 1 + 바깥 벽 1)
  const lecture: HandInteriorRoom = { id: "lecture", x0: SX, y0: 1, x1: SX - 1 + wLecture, y1: topH, floor: pal.lecture[0], wall: pal.lecture[1] };
  const seminar: HandInteriorRoom = { id: "seminar", x0: SX + wLecture + 1, y0: 1, x1: SX + wLecture + wSeminar, y1: topH, floor: pal.seminar[0], wall: pal.seminar[1] };
  const innerX1 = seminar.x1;
  const L: HandInteriorRoom = mirror ? { ...lecture, x0: innerX1 + SX - lecture.x1, x1: innerX1 + SX - lecture.x0 } : lecture;
  const S: HandInteriorRoom = mirror ? { ...seminar, x0: innerX1 + SX - seminar.x1, x1: innerX1 + SX - seminar.x0 } : seminar;
  const corridor: HandInteriorRoom = { id: "corridor", x0: 1, y0: topH + 2, x1: innerX1 + SX - 1, y1: topH + 1 + corH, floor: pal.corridor[0], wall: pal.corridor[1] };
  const stairW: HandInteriorRoom = { id: "stair-w", x0: 1, y0: 1, x1: SX - 2, y1: topH, floor: pal.corridor[0], wall: pal.corridor[1] };
  const stairE: HandInteriorRoom = { id: "stair-e", x0: innerX1 + 2, y0: 1, x1: innerX1 + SX - 1, y1: topH, floor: pal.corridor[0], wall: pal.corridor[1] };
  const rooms = [L, S, corridor, stairW, stairE];
  const lcx = Math.floor((L.x0 + L.x1) / 2);
  const scx = Math.floor((S.x0 + S.x1) / 2);
  const ccx = Math.floor((corridor.x0 + corridor.x1) / 2);
  const exitX = Math.abs(ccx - lcx) <= 1 || Math.abs(ccx - scx) <= 1 ? ccx + 2 : ccx;
  const connect: HandInteriorConnect[] = [
    { a: "lecture", b: "corridor", at: lcx },
    { a: "seminar", b: "corridor", at: scx },
    { a: "stair-w", b: "corridor", at: stairW.x1 },
    { a: "stair-e", b: "corridor", at: stairE.x0 },
  ];
  const s = new InteriorSketch(spec, rooms, connect, { room: "corridor", x: exitX, width: 1 });
  const decisions = [
    `${mirror ? "세미나실 서쪽" : "세미나실 동쪽"} · 좌우 장책상 ${benchesPerSide}개씩 · 팔레트 ${mood}`,
  ];

  // ── 대강의실
  const f = s.floorOf("lecture");
  const stageX0 = Math.max(f.x0 + 1, lcx - 5), stageX1 = Math.min(f.x1 - 1, lcx + 5);
  s.zone(stageX0, f.y0, stageX1, f.y0 + 1, pal.stage);
  for (let x = stageX0; x <= stageX1; x++) for (const y of [f.y0, f.y0 + 1]) s.put("sc-podium", x, y);
  s.put("mc-board-green", lcx - 2, f.faceY, true);
  s.put("mc-screen-proj", lcx + 3, f.faceY) || s.put("mc-screen-proj", lcx - 6, f.faceY);
  s.put("mc-wall-clock", lcx + 2, f.faceY);
  hangRhythm(s, f, ["mc-window-class"], 0, 3);
  s.put("mc-lectern", lcx, f.y0 + 1, true);
  s.put("sc-teacher-desk", lcx - 3, f.y0, true);
  s.put("sc-tv-stand", lcx + 3, f.y0);
  s.put("mc-pc-cart", lcx + 4, f.y0);
  // 중앙 통로(3칸) — 출입문에서 교단까지 다른 바닥.
  s.zone(lcx - 1, f.y0 + 2, lcx + 1, f.y1 + 1, pal.aisle);
  s.keepRect(lcx - 1, f.y0 + 2, lcx + 1, f.y1);
  s.keepRect(f.x0, f.y0 + 2, f.x1, f.y0 + 2);
  const rowsY: number[] = [];
  // 마지막 줄을 뒷벽 바로 앞까지 - 줄이 f.y1-2 에서 끊겨 뒤쪽 세 줄이 비었다(VQA 14회차).
  for (let y = f.y0 + 3; y <= f.y1 - 1; y += 2) rowsY.push(y);
  for (const y of rowsY) {
    for (let k = 0; k < benchesPerSide; k++) {
      s.put("mc-lecture-bench", lcx - 2 - (k + 1) * 3 + 1, y, true);
      s.put("mc-lecture-bench", lcx + 2 + k * 3, y, true);
    }
  }
  s.put("mc-cabinet-glass", f.x0, f.y1);
  s.put("mc-trash-bin", f.x1, f.y1);
  s.put("mc-chair-stack", f.x0, f.y0 + 2) || s.put("mc-chair-stack", f.x0, f.y1 - 1);
  s.put("mc-umbrella-stand", f.x1, f.y0 + 2);

  // ── 세미나·동아리실
  const m = s.floorOf("seminar");
  const mcx = Math.floor((m.x0 + m.x1) / 2);
  for (let x = m.x0; x + 1 <= m.x1; x += 2) {
    if (x >= mcx - 1 && x <= mcx) continue;
    s.put(x === m.x0 || x + 1 === m.x1 ? "sc-bookshelf" : pickOf(rng, ["sc-bookshelf", "mc-club-shelf", "mc-trophy-case"]), x, m.y0);
  }
  s.put("sc-whiteboard", mcx - 1, m.faceY, true);
  hangRhythm(s, m, ["mc-cork-board", "mc-window-class"], 0, 3);
  s.keepRect(m.x0, m.y0 + 1, m.x1, m.y0 + 1);
  // 토의 탁자: 동아리 긴 탁자 둘을 붙여 6×2, 위·아래 마주 보는 의자.
  const tx = mcx - 2, ty = m.y0 + 3;
  const t1 = s.put("mc-club-table", tx - 1, ty, true) && s.put("mc-club-table", tx + 2, ty, true);
  s.put("mc-club-table", tx - 1, ty + 1); s.put("mc-club-table", tx + 2, ty + 1);
  if (t1) for (let k = -1; k <= 4; k++) { s.put("sc-staff-chair-s", tx + k, ty - 1); s.put("sc-staff-chair-n", tx + k, ty + 2); }
  // 독서 구석: 소파 + 낮은 탁자 + 푸프, 양면 서가.
  const nookY = ty + 4;
  if (nookY + 1 <= m.y1) {
    s.put("mc-lounge-sofa", m.x0 + 1, nookY);
    s.put("mc-low-table", m.x0 + 1, nookY + 1);
    s.put("mc-bean-bag", m.x0 + 3, nookY + 1);
    s.put("sc-book-island", m.x1 - 2, nookY);
    s.put("mc-book-cart", m.x1, nookY + 1);
  }
  s.put("mc-mini-fridge", m.x1, m.y1);

  // ── 계단실 둘(1F↔2F): 강의실·세미나실 좌·우 끝. 북쪽 바깥 벽 속 오르는 계단, 그 아래 내려가는 계단통, 남쪽 문까지 계단참 융단.
  //    한쪽 끝 한 군데에 모아 복도에 두니 통행을 막았다(2026-10-18 사용자 반려 「계단은 '좌우'로 배치해야지 … 통행도 문제」).
  //    바닥 3칸 폭: 바깥 2칸에 계단·계단통, 안쪽 1칸은 복도 문까지 걷는 세로줄(2칸 폭이면 계단통이 오르는 계단 앞을 가둔다).
  for (const id of ["stair-w", "stair-e"] as const) {
    const st = s.floorOf(id);
    const outerX = id === "stair-w" ? st.x0 : st.x1 - 1, walkX = id === "stair-w" ? st.x1 : st.x0;
    s.zone(st.x0, st.y0, st.x1, st.y1, pal.stage);
    s.put("sc-stairs-up", outerX, st.y0, true);
    s.keepRect(st.x0, st.y0 + 1, st.x1, st.y0 + 1);
    s.keepRect(walkX, st.y0 + 1, walkX, st.y1);
    s.put("sc-stairwell-down", outerX, st.y0 + 2, true);
    s.keepRect(outerX, st.y0 + 4, outerX + 1, st.y0 + 4); // 계단통 남쪽 입구 앞
    let y = st.y0 + 5;
    for (const k of ["mc-vending-low", "mc-fire-cabinet", "mc-locker-bench", "mc-trash-bin"]) if (y <= st.y1 && s.put(k, outerX, y)) y += 2;
    hangRhythm(s, st, ["mc-window-class", "sc-notice-board"], 0, 4);
  }
  // ── 복도: 사물함 줄(문 앞은 비움), 게시판·소화기함, 음수대, 긴 의자·트로피장. 북쪽 걷는 줄 하나는 비운다.
  const c = s.floorOf("corridor");
  s.keepRect(c.x0, c.y0 + 1, c.x1, c.y0 + 1);
  s.put("mc-fire-cabinet", c.x0 + SX - 1, c.y0);
  hangRhythm(s, c, ["sc-notice-board", "mc-cork-board", "mc-window-class"], 1, 4);
  for (let x = c.x0 + SX; x + 1 <= c.x1 - SX; x += 2) s.put(pickOf(rng, ["mc-hall-locker", "mc-hall-locker", "mc-hall-locker", "mc-bulletin-stand"]), x, c.y0);
  s.put("mc-water-fountain", c.x1 - SX + 1, c.y0);
  for (let x = c.x0 + 3; x + 1 <= c.x1 - 3; x += 5) {
    s.put("mc-locker-bench", x, c.y1);
    if (c.y1 - 1 > c.y0 + 1) s.put(pickOf(rng, ["mc-trophy-case", "mc-vending-low", "mc-trophy-shelf"]), x + 2, c.y1);
  }
  s.put("mc-trash-bin", c.x0 + 1, c.y1);
  s.put("mc-vending-low", c.x1 - 2, c.y1) || s.put("mc-trash-bin", c.x1 - 1, c.y1);
  decisions.push("계단실(1F↔2F) 건물 좌·우 양 끝");

  const areas = [areaOf("대강의실", f), areaOf("세미나·동아리실", m), areaOf("복도", c)];
  return s.finish({ tileset: "modern_campus", floor: pal.corridor[0], wall: pal.corridor[1] }, areas, decisions);
}

// ─────────────────────────────────────────────── 왕성 알현실 (atlas_biome_interior) ───────────────────────────────────────────────

const THRONE_PALETTES = {
  neutral: { hall: ["marble", "marblewall"], council: ["parquet", "goldwood"], east: ["dplank", "marblewall"], ceiling: "gold", rug: "rug royal", councilRug: "rug purple", eastRug: "rug blue" },
  warm: { hall: ["marble", "goldwood"], council: ["parquet", "goldwood"], east: ["parquet", "velvet"], ceiling: "gold", rug: "rug red", councilRug: "rug royal", eastRug: "rug brown" },
  cool: { hall: ["marble", "marblewall"], council: ["check", "marblewall"], east: ["marble", "marblewall"], ceiling: "default", rug: "rug royal", councilRug: "rug blue", eastRug: "rug green" },
  dark: { hall: ["grey", "stone"], council: ["dplank", "velvet"], east: ["flag", "stone"], ceiling: "dark", rug: "rug red", councilRug: "rug purple", eastRug: "rug red" },
} as const;

/**
 * 왕성 알현실 청사진 — 정문에서 단상까지 붉은 융단, 융단 바로 옆(중심 ±3) 쌍기둥 회랑, 단상 위 왕좌·화로·근위 초소,
 * 한쪽 윙은 어전 회의실(긴 회의 탁자·의자·작전 지도), 다른 윙은 대칭 서가 도서관 또는 무기고(빽빽한 깔개).
 */
export function composeThroneHall(spec: HandInteriorSpec, nuance: SpaceNuance, seed: number): BlueprintInteriorArgs {
  const rng = blueprintRng(seed);
  const grand = nuance.scale === "grand", compact = nuance.scale === "compact";
  const mood = nuance.mood === "neutral" ? pickOf(rng, ["neutral", "neutral", "warm"] as const) : nuance.mood;
  const pal = THRONE_PALETTES[mood];
  const armory = nuance.wants.has("armory") || (!nuance.wants.has("library") && rng() < 0.35);
  // 알현실은 세로로 아주 길어야 위엄이 선다(2026-10-18 사용자 반려 「굉장히 커야 위엄이 살텐데. 알현하는 곳은 세로로 매우 길어야」):
  // 정문에서 왕좌까지 28~36줄 회랑, 양옆은 위·가운데·아래 세 방을 회랑 길이만큼 쌓는다.
  const hallW = grand ? 19 : compact ? 13 : pickOf(rng, [15, 17, 17]);
  const hallRows = pickInt(rng, 28, 32) + (grand ? 4 : 0) - (compact ? 8 : 0);
  const wingW = pickInt(rng, 11, 13) - (compact ? 1 : 0);
  const councilWest = rng() < 0.5;
  const hallY1 = hallRows + 2;
  const three = hallY1 >= 27;
  const avail = hallY1 - (three ? 2 : 1);
  const topY1 = three ? Math.round(avail * 0.4) : Math.ceil(avail / 2);
  const midY0 = topY1 + 2, midY1 = three ? midY0 + Math.round(avail * 0.28) - 1 : topY1;
  const lowY0 = three ? midY1 + 2 : topY1 + 2;
  const hall: HandInteriorRoom = { id: "hall", x0: wingW + 2, y0: 1, x1: wingW + 1 + hallW, y1: hallY1, floor: pal.hall[0], wall: pal.hall[1] };
  const westX = { x0: 1, x1: wingW }, eastX = { x0: hall.x1 + 2, x1: hall.x1 + 1 + wingW };
  const side = (west: boolean) => (west === councilWest ? westX : eastX);
  const other = (west: boolean) => (west === councilWest ? eastX : westX);
  const councilRoom: HandInteriorRoom = { id: "council", ...side(true), y0: 1, y1: topY1, floor: pal.council[0], wall: pal.council[1] };
  const eastRoom: HandInteriorRoom = { id: "east", ...other(true), y0: 1, y1: topY1, floor: pal.east[0], wall: pal.east[1] };
  const treasury: HandInteriorRoom = { id: "treasury", ...side(true), y0: midY0, y1: midY1, floor: pal.east[0], wall: pal.east[1] };
  const chapel: HandInteriorRoom = { id: "chapel", ...other(true), y0: midY0, y1: midY1, floor: pal.council[0], wall: pal.hall[1] };
  const guardRoom: HandInteriorRoom = { id: "guard", ...westX, y0: lowY0, y1: hallY1, floor: pal.east[0], wall: pal.east[1] };
  const anteRoom: HandInteriorRoom = { id: "ante", ...eastX, y0: lowY0, y1: hallY1, floor: pal.council[0], wall: pal.council[1] };
  const rooms = [councilRoom, eastRoom, hall, ...(three ? [treasury, chapel] : []), guardRoom, anteRoom];
  const doorAt = (r: HandInteriorRoom) => Math.max(r.y0 + 3, Math.min(r.y1 - 1, r.y0 + Math.floor((r.y1 - r.y0) * 0.6)));
  const connect: HandInteriorConnect[] = rooms.filter((r) => r.id !== "hall").map((r) => (r.x0 < hall.x0 ? { a: r.id, b: "hall", at: doorAt(r) } : { a: "hall", b: r.id, at: doorAt(r) }));
  const cx = Math.floor((hall.x0 + hall.x1) / 2);
  const s = new InteriorSketch(spec, rooms, connect, { room: "hall", x: cx, width: 1 });
  const decisions = [
    `어전 회의실 ${councilWest ? "서쪽" : "동쪽"} · 반대 윙 ${armory ? "무기고" : "왕실 도서관"}${three ? " · 가운데 보물고·예배당" : ""} · 회랑 ${hallRows}줄 × ${hallW}칸`,
    `팔레트 ${mood}`,
  ];

  // ── 알현실
  const f = s.floorOf("hall");
  s.dais("dais marble", cx - 3, f.y0, 7, 3);
  s.put("throne", cx - 1, f.y0, true);
  s.put("brazier", cx - 3, f.y0 + 1, true);
  s.put("brazier", cx + 3, f.y0 + 1, true);
  s.put("candelabra", cx - 2, f.y0);
  s.put("candelabra", cx + 2, f.y0);
  // 근위 초소: 단상 양옆 갑옷 기사.
  s.put("knight armor", cx - 5, f.y0 + 1, true);
  s.put("knight armor", cx + 5, f.y0 + 1, true);
  s.put("royal banner", cx - 2, f.faceY, true);
  s.put("tapestry", cx, f.faceY, true);
  s.put("royal banner", cx + 2, f.faceY, true);
  s.put("tall stained window", f.x0 + 1, f.faceY);
  s.put("tall stained window", f.x1 - 2, f.faceY);
  s.put("royal banner", cx - 4, f.faceY);
  s.put("royal banner", cx + 4, f.faceY);
  // 융단: 단상 앞부터 정문까지 3칸.
  s.rug(pal.rug, cx - 1, f.y0 + 3, cx + 1, f.y1, true);
  s.keepRect(cx - 2, f.y0 + 3, cx + 2, f.y1);
  // 쌍기둥 회랑(중심 ±3) — 3줄 간격, 기둥 사이 바깥쪽에 화로·갑옷 교대.
  let k = 0;
  for (let y = f.y0 + 4; y <= f.y1 - 2; y += 3, k++) {
    s.put("column marble", cx - 3, y, true);
    s.put("column marble", cx + 3, y, true);
    // 바깥 통로 신하석 - 기둥 줄마다 융단을 향한 긴 의자.
    s.put("bench 2", f.x0 + 1, y); s.put("bench 2", f.x1 - 2, y);
    const mid = y + 1;
    if (mid <= f.y1 - 2) {
      const id = k % 2 === 0 ? "brazier" : "armor stand";
      s.put(id, cx - 5, mid); s.put(id, cx + 5, mid);
    }
  }
  // 정문 양옆 사자상.
  s.put("lion statue", cx - 4, f.y1 - 1);
  s.put("lion statue", cx + 3, f.y1 - 1);
  // 바깥 벽 따라 석상·화분(문 줄 제외).
  for (let y = f.y0 + 3; y <= f.y1 - 3; y += 4) {
    s.put(y % 8 === 0 ? "statue" : "potted fern", f.x0, y);
    s.put(y % 8 === 0 ? "statue" : "potted fern", f.x1, y);
  }

  // ── 어전 회의실: 벽난로·태피스트리, 긴 회의 탁자(남·북향 의자 줄 + 양끝), 작전 지도·지구의.
  const c = s.floorOf("council");
  const ccx = Math.floor((c.x0 + c.x1) / 2);
  s.put("fireplace", ccx - 1, c.y0, true);
  s.put("bookshelf 2w", c.x0, c.y0);
  s.put("bookshelf 2w", c.x1 - 1, c.y0);
  s.put("tapestry", ccx - 3, c.faceY); s.put("tapestry", ccx + 2, c.faceY);
  s.put("heraldic shield", ccx - 1, c.faceY - 0) || s.put("royal banner", ccx - 1, c.faceY);
  hangRhythm(s, c, ["curtained window", "royal banner"], 0, 5);
  s.keepRect(c.x0, c.y0 + 1, c.x1, c.y0 + 1);
  const tw = Math.max(4, c.x1 - c.x0 + 1 - 6);
  const tx = c.x0 + 3, ty = c.y0 + 3;
  s.rug(pal.councilRug, tx - 2, ty - 1, tx + tw + 1, ty + 3);
  if (s.table("dining", tx, ty, tw, 2, true)) {
    for (let i = 0; i < tw; i++) { s.put("chair S", tx + i, ty - 1); s.put("chair N", tx + i, ty + 2); }
    s.put("chair E", tx - 1, ty); s.put("chair E", tx - 1, ty + 1);
    s.put("chair W", tx + tw, ty); s.put("chair W", tx + tw, ty + 1);
    const g = ["scroll", "candle", "wineglass", "openbook", "plate", "inkwell", "papers"];
    for (let i = 0; i < tw; i++) s.goods(g[(i + seed) % g.length]!, tx + i, ty + (i % 2));
  }
  const lowY = ty + 5;
  if (lowY + 1 <= c.y1) {
    s.put("war map table", c.x0 + 1, lowY);
    s.put("globe", c.x0 + 3, lowY);
    s.put("map case", c.x1 - 2, lowY);
    s.put("candelabra", c.x1, lowY + 1);
  }
  s.put("royal chest", c.x0, c.y1);
  s.put("potted fern", c.x1, c.y1);

  // ── 반대 윙: 왕실 도서관(대칭 서가 벽 + 빽빽한 깔개 + 열람 탁자) 또는 무기고.
  const e = s.floorOf("east");
  const ecx = Math.floor((e.x0 + e.x1) / 2);
  s.keepRect(e.x0, e.y0 + 1, e.x1, e.y0 + 1);
  s.rug(pal.eastRug, e.x0 + 1, e.y0 + 2, e.x1 - 1, e.y1 - 1);
  if (!armory) {
    for (let x = e.x0; x <= ecx - 2; x += 3) { s.put("bookshelf 3w", x, e.y0) || s.put("bookshelf 2w", x, e.y0); }
    for (let x = e.x1 - 2; x >= ecx + 2; x -= 3) { s.put("bookshelf 3w", x, e.y0) || s.put("bookshelf 2w", x + 1, e.y0); }
    s.put("tall stained window", ecx - 1, e.faceY, true);
    s.put("lectern", ecx, e.y0, true) || s.put("lectern", ecx - 1, e.y0);
    for (const dy of [3, 7]) {
      const y = e.y0 + dy;
      if (y + 1 > e.y1 - 1) continue;
      for (const side of [-1, 1]) {
        const x = side < 0 ? ecx - 4 : ecx + 2;
        if (s.table("desk", x, y, 3, 1)) {
          s.put("chair N", x, y + 1); s.put("chair N", x + 2, y + 1);
          s.goods("openbook", x, y); s.goods("bookstack", x + 1, y); s.goods("candle", x + 2, y);
        }
      }
    }
    // 열람 책상 줄 사이 가운데 독서 탁자, 동서 벽 따라 키 큰 화분·촛대 교대 - 빈 깔개 한가운데를 메운다.
    for (let y = e.y0 + 5; y <= e.y1 - 2; y += 4) s.put("table:book+scroll", ecx - 1, y);
    // 4줄 간격 - 2줄 간격은 좁은 윙에서 책상 옆 벽 칸을 가둬 닿지 못하는 바닥을 냈다(VQA 13회차).
    for (let y = e.y0 + 3; y <= e.y1 - 1; y += 4) {
      s.put(y % 8 === 3 ? "candelabra" : "tall vase blue", e.x0, y);
      s.put(y % 8 === 3 ? "tall vase blue" : "candelabra", e.x1, y);
    }
    s.put("globe", e.x0 + 1, e.y1); s.put("candelabra", e.x1 - 1, e.y1);
    s.put("table:book+scroll", ecx - 1, e.y1);
  } else {
    hangRhythm(s, e, ["weapon rack", "shield display", "bow rack", "heraldic shield"], 0, 2);
    for (let x = e.x0; x <= e.x1; x += 2) s.put(x % 4 === 0 ? "sword rack" : "staff rack", x, e.y0);
    for (const dy of [3, 6]) {
      const y = e.y0 + dy;
      if (y > e.y1 - 1) continue;
      for (const dx of [-4, -2, 2, 4]) s.put(dy === 3 ? "armor stand" : "knight armor", ecx + dx, y);
      s.put("spear rack", ecx, y);
    }
    s.put("weapon barrel", e.x0, e.y1); s.put("weapon barrel", e.x1, e.y1);
    s.put("treasure chest big", ecx - 1, e.y1);
  }

  // ── 가운데 두 방(회랑이 길 때): 회의실 쪽 보물고, 반대쪽 왕실 예배당.
  const midAreas: ReturnType<typeof areaOf>[] = [];
  if (three) {
    const t = s.floorOf("treasury");
    const tcx = Math.floor((t.x0 + t.x1) / 2);
    hangRhythm(s, t, ["shelf:coins", "heraldic shield", "royal banner"], 0, 2);
    for (let x = t.x0; x <= t.x1; x += 2) s.put(x % 4 === 0 ? "safe" : "treasure chest", x, t.y0);
    s.keepRect(t.x0, t.y0 + 1, t.x1, t.y0 + 1);
    const ty0 = t.y0 + 2;
    s.rug(pal.rug, tcx - 2, ty0, tcx + 2, t.y1 - 1);
    const pedY = Math.floor((ty0 + t.y1) / 2);
    s.put("crown pedestal", tcx, pedY, true);
    s.put("candelabra", tcx - 2, pedY); s.put("candelabra", tcx + 2, pedY);
    s.put("knight armor", tcx - 2, ty0); s.put("knight armor", tcx + 2, ty0);
    for (let y = ty0; y <= t.y1; y += 2) {
      s.put("treasure pile", t.x0, y); s.put("treasure pile", t.x1 - 1, y);
      s.put(y % 4 === 0 ? "coin pile" : "royal chest", t.x0 + 3, y + 1 <= t.y1 ? y + 1 : y);
      s.put(y % 4 === 0 ? "royal chest" : "coin pile", t.x1 - 3, y + 1 <= t.y1 ? y + 1 : y);
    }
    midAreas.push(areaOf("보물고", t));
    const p = s.floorOf("chapel");
    const pcx = Math.floor((p.x0 + p.x1) / 2);
    s.put("tall stained window", pcx - 1, p.faceY);
    hangRhythm(s, p, ["stained glass", "wall torch"], 0, 3);
    s.put("altar", pcx - 1, p.y0, true);
    s.put("candelabra", pcx - 2, p.y0); s.put("candelabra", pcx + 1, p.y0);
    s.put("pipe organ", p.x0, p.y0); s.put("statue", p.x1, p.y0);
    s.keepRect(p.x0, p.y0 + 1, p.x1, p.y0 + 1);
    s.rug(pal.rug, pcx - 1, p.y0 + 2, pcx, p.y1, true);
    s.keepRect(pcx - 1, p.y0 + 2, pcx, p.y1);
    for (let y = p.y0 + 2; y <= p.y1 - 1; y += 2) {
      for (const x of [pcx - 5, pcx - 3, pcx + 1, pcx + 3]) if (x >= p.x0 + 1 && x + 1 <= p.x1 - 1) s.put("pew", x, y);
    }
    s.put("holy water font", p.x0, p.y1); s.put("holy water font", p.x1, p.y1);
    midAreas.push(areaOf("왕실 예배당", p));
  }

  // ── 근위대 대기실(서쪽 아래): 북벽 침상 줄(벽 가구)·벽 무기 거치대, 가운데 깔개 위 원탁 + 의자, 남쪽 갑옷 줄.
  // 침상은 벽 가구, 무기 거치대는 걸이라 바닥 줄에 놓으면 조용히 빠졌다(2026-10-18 VQA 11회차 - 빈 대기실).
  const g = s.floorOf("guard");
  const gcx = Math.floor((g.x0 + g.x1) / 2);
  hangRhythm(s, g, ["weapon rack", "heraldic shield", "weapon rack", "royal banner"], 0, 2);
  for (let x = g.x0; x <= gcx - 2; x += 2) s.put("bed red", x, g.y0);
  for (let x = gcx + 2; x <= g.x1; x += 2) s.put(x % 4 === 0 ? "weapon barrel" : "armor stand", x, g.y0);
  s.keepRect(g.x0, g.y0 + 2, g.x1, g.y0 + 2);
  const gy = g.y0 + 3;
  s.rug(pal.eastRug, gcx - 2, gy, gcx + 2, Math.min(g.y1 - 1, gy + 3));
  if (s.put("war map table", gcx - 1, gy + 1, true)) {
    s.put("chair E", gcx - 2, gy + 1); s.put("chair E", gcx - 2, gy + 2);
    s.put("chair W", gcx + 1, gy + 1); s.put("chair W", gcx + 1, gy + 2);
  }
  for (let x = g.x0; x <= g.x1; x += 3) if (x < gcx - 2 || x > gcx + 2) s.put(x % 2 === 0 ? "armor stand" : "knight armor", x, g.y1);
  s.put("weapon barrel", g.x0, gy + 1); s.put("weapon barrel", g.x1, gy + 1);
  // ── 접견 대기실(동쪽 아래): 깔개 위 소파·안락의자 응접, 석상·화분 벽 리듬.
  const a = s.floorOf("ante");
  const acx = Math.floor((a.x0 + a.x1) / 2);
  hangRhythm(s, a, ["curtained window", "tapestry"], 0, 3);
  s.keepRect(a.x0, a.y0 + 1, a.x1, a.y0 + 1);
  s.rug(pal.councilRug, a.x0 + 1, a.y0 + 2, a.x1 - 1, a.y1 - 1);
  s.put("sofa", acx - 1, a.y0 + 2, true);
  s.put("table:plate+cup", acx - 1, a.y0 + 3) || s.put("roundtable", acx - 1, a.y0 + 3);
  s.put("armchair", acx - 3, a.y0 + 3); s.put("armchair", acx + 2, a.y0 + 3);
  // 아래쪽 다과 탁자 응접 - 소파 무리 아래 깔개 절반이 비어 보였다(VQA 13회차).
  if (a.y0 + 5 <= a.y1 - 1 && s.put("table:mug+bottle", acx - 1, a.y0 + 5)) {
    s.put("chair E", acx - 2, a.y0 + 5); s.put("chair W", acx + 1, a.y0 + 5);
  }
  for (let y = a.y0 + 7; y <= a.y1 - 1; y += 2) { s.put("bench 3", a.x0 + 1, y); s.put("bench 3", a.x1 - 3, y); }
  s.put("statue", a.x0, a.y0); s.put("statue", a.x1, a.y0);
  s.put("potted fern", a.x0, a.y1); s.put("potted fern", a.x1, a.y1);
  s.put("bench 3", acx - 1, a.y1);

  const areas = [areaOf("알현실", f), areaOf("어전 회의실", c), areaOf(armory ? "무기고" : "왕실 도서관", e), ...midAreas, areaOf("근위대 대기실", g), areaOf("접견 대기실", a)];
  return s.finish({ tileset: "atlas_biome_interior", floor: pal.hall[0], wall: pal.hall[1], ceiling: pal.ceiling }, areas, decisions);
}

// ─────────────────────────────────────────────── 백화점 (modern_city) ───────────────────────────────────────────────

const STORE_PALETTES = {
  neutral: { hall: ["mci-tile-concourse", "mci-wall-store"], ring: "mci-stone-lobby", runner: "mci-carpet-office", fashion: ["mci-wood-oak", "mci-wall-store"], boutique: "mci-wood-dark", beauty: ["mci-vinyl-store", "mci-wall-lobby"], cafe: ["mci-wood-dark", "mci-wall-brick"] },
  cool: { hall: ["mci-stone-lobby", "mci-wall-lobby"], ring: "mci-tile-concourse", runner: "mci-carpet-office", fashion: ["mci-vinyl-store", "mci-wall-store"], boutique: "mci-carpet-office", beauty: ["mci-tile-small", "mci-wall-lobby"], cafe: ["mci-wood-oak", "mci-wall-home"] },
  warm: { hall: ["mci-wood-oak", "mci-wall-home"], ring: "mci-stone-lobby", runner: "mci-carpet-office", fashion: ["mci-wood-dark", "mci-wall-brick"], boutique: "mci-carpet-office", beauty: ["mci-vinyl-store", "mci-wall-home"], cafe: ["mci-wood-dark", "mci-wall-brick"] },
  dark: { hall: ["mci-wood-dark", "mci-wall-brick"], ring: "mci-stone-lobby", runner: "mci-carpet-office", fashion: ["mci-carpet-office", "mci-wall-office"], boutique: "mci-wood-oak", beauty: ["mci-stone-lobby", "mci-wall-lobby"], cafe: ["mci-wood-oak", "mci-wall-brick"] },
} as const;

/**
 * 백화점 청사진 — 정문 → 융단 → 분수 원형 광장 → 북벽 측면 에스컬레이터·엘리베이터가 한 축(아트리움)에 선다.
 * 아트리움 양옆 열은 명품 아일랜드, 한쪽 윙은 탈의 부스 + 행거·마네킹 격자 패션관, 반대쪽은 쇼케이스 화장품관과 카페.
 * 견본 배치는 방을 늘이면 가구가 한쪽에 몰리고 바닥 70% 가 비었다(2026-10-18 VQA 4회차) — 여기서는 가구를 방 크기에 맞춰 격자로 채운다.
 */
export function composeDepartmentStore(spec: HandInteriorSpec, nuance: SpaceNuance, seed: number): BlueprintInteriorArgs {
  const rng = blueprintRng(seed);
  const grand = nuance.scale === "grand", compact = nuance.scale === "compact";
  const mood = nuance.mood === "neutral" ? pickOf(rng, ["neutral", "neutral", "cool", "warm"] as const) : nuance.mood;
  const pal = STORE_PALETTES[mood];
  // 규모 규격(venueScale.ts mc_department_store 48×38): 바깥벽·칸막이 넷 + 윙 둘 + 아트리움 = 48칸, 위아래 벽 둘 + 36줄 = 38줄.
  const baseHallW = pickOf(rng, [14, 16]);
  const hallW = baseHallW + (grand ? 2 : 0) - (compact ? 4 : 0);
  const wingW = (44 - baseHallW) / 2 + (grand ? 1 : 0) - (compact ? 3 : 0);
  const rowsY1 = 36 + (grand ? 4 : 0) - (compact ? 12 : 0);
  const topY1 = compact ? Math.floor(rowsY1 / 2) : pickInt(rng, 15, 18);
  const fashionWest = rng() < 0.5;
  const sideX0 = (west: boolean) => (west ? 1 : wingW + hallW + 3);
  const fashion: HandInteriorRoom = { id: "fashion", x0: sideX0(fashionWest), y0: 3, x1: sideX0(fashionWest) + wingW - 1, y1: rowsY1 - 2, floor: pal.fashion[0], wall: pal.fashion[1] };
  const hall: HandInteriorRoom = { id: "hall", x0: wingW + 2, y0: 1, x1: wingW + 1 + hallW, y1: rowsY1, floor: pal.hall[0], wall: pal.hall[1] };
  const beauty: HandInteriorRoom = { id: "beauty", x0: sideX0(!fashionWest), y0: 2, x1: sideX0(!fashionWest) + wingW - 1, y1: topY1, floor: pal.beauty[0], wall: pal.beauty[1] };
  const cafe: HandInteriorRoom = { id: "cafe", x0: beauty.x0, y0: topY1 + 2, x1: beauty.x1, y1: rowsY1 - 1, floor: pal.cafe[0], wall: pal.cafe[1] };
  const cx = Math.floor((hall.x0 + hall.x1) / 2);
  const fashionAisles = [11, 16, 26].filter((y) => y <= rowsY1 - 6);
  const fashionDoor = pickOf(rng, fashionAisles.length ? fashionAisles : [Math.max(7, rowsY1 - 6)]);
  const connect: HandInteriorConnect[] = [
    { a: "fashion", b: "hall", at: fashionDoor },
    { a: "beauty", b: "hall", at: topY1 - 1 },
    { a: "cafe", b: "hall", at: Math.min(rowsY1 - 2, topY1 + 5) },
  ];
  const s = new InteriorSketch(spec, [fashion, hall, beauty, cafe], connect, { room: "hall", x: cx, width: 1 });
  const decisions = [
    `패션관 ${fashionWest ? "서쪽" : "동쪽"} · 화장품관+카페 ${fashionWest ? "동쪽" : "서쪽"} · 아트리움 폭 ${hallW}`,
    `팔레트 ${mood} · 층고 ${rowsY1 - 2}줄`,
  ];

  // ── 아트리움: 북벽 한가운데(정문 융단 축) 에스컬레이터 ▲상행 · 안내판 · ▼하행 한 쌍 — 한쪽 구석에 붙은 6칸 덩어리는 한 대로 보였다
  //    (2026-10-18 사용자 반려 「올라가는 에스컬레이터 내려가는 에스컬레이터 다 있어야지」). 양 끝은 엘리베이터와 오르는 계단.
  //    가운데 분수 원형 광장, 정문 융단, 양옆 명품 아일랜드 열.
  const h = s.floorOf("hall");
  s.put("escalator-pair-up", cx - 4, h.y0, true);
  s.put("dept-sign-pillar", cx - 1, h.y0);
  s.put("escalator-pair-down", cx, h.y0, true);
  // 엘리베이터는 벽면을 쓰므로 걸이보다 먼저 세운다(걸이가 먼저 벽면을 잡으면 엘리베이터가 빠진다 — VQA 6회차).
  s.put("mci-elevator", fashionWest ? h.x1 - 1 : h.x0, h.y0, true);
  s.put("mci-stairs-up", fashionWest ? h.x0 : h.x1 - 1, h.y0, true);
  hangRhythm(s, h, ["mci-art-frame", "mci-route-map", "mci-art-frame", "mci-wall-clock"], 4, 3);
  s.keepRect(h.x0, h.y0 + 1, h.x1, h.y0 + 1);
  for (const op of s.composed.openings) {
    if (op.a !== "hall" && op.b !== "hall") continue;
    if (op.x <= h.x0) s.keepRect(h.x0, op.y, cx - 1, op.y);
    else if (op.x >= h.x1) s.keepRect(cx + 1, op.y, h.x1, op.y);
  }
  const fy = h.y0 + Math.max(4, Math.floor((h.y1 - h.y0) / 2) - 1);
  s.zone(cx - 1, h.y0 + 1, cx + 1, fy - 2, pal.runner);
  s.keepRect(cx - 1, h.y0 + 1, cx + 1, fy - 2);
  s.zone(cx - 3, fy - 1, cx + 3, fy + 2, pal.ring);
  s.put("jumbo-dept-fountain", cx - 1, fy, true);
  s.keepRect(cx - 2, fy - 1, cx - 2, fy + 2);
  s.keepRect(cx + 2, fy - 1, cx + 2, fy + 2);
  s.put("lounge-sofa-cream", cx - 4, fy); s.put("lounge-sofa-cream", cx + 3, fy);
  s.put("mci-plant-tall", cx - 3, fy - 1); s.put("mci-plant-tall", cx + 3, fy - 1);
  s.put("mci-plant-tall", cx - 3, fy + 2); s.put("mci-plant-tall", cx + 3, fy + 2);
  s.zone(cx - 1, fy + 3, cx + 1, h.y1 + 1, pal.runner);
  s.keepRect(cx - 1, fy + 3, cx + 1, h.y1);
  // 아트리움 상·하단 좌우 플랭크: 바깥벽 쇼케이스 열 + 중앙 러너 옆 프로모션 포디움·향수 카운터·휴게 라운지 열을 함께 배치한다(R16 VQA).
  const UPPER_OUT_L = ["dept-luxury-island", "dept-watch-case", "dept-glass-showcase", "dept-jewelry-island"] as const;
  const UPPER_IN_L = ["dept-perfume-island", "dept-mannequin-podium", "dept-jewelry-case", "dept-skincare-counter"] as const;
  const UPPER_IN_R = ["dept-mannequin-podium", "dept-perfume-island", "dept-cosmetic-island", "dept-watch-case"] as const;
  const UPPER_OUT_R = ["dept-glass-showcase", "dept-luxury-island", "dept-jewelry-island", "dept-watch-case"] as const;
  for (let y = h.y0 + 3, i = 0; y + 1 < fy - 1; y += 3, i++) {
    const outL = UPPER_OUT_L[i % UPPER_OUT_L.length]!;
    if (!s.put(outL, h.x0, y)) s.put("dept-watch-case", h.x0, y);
    s.put(UPPER_IN_L[i % UPPER_IN_L.length]!, cx - 3, y);
    s.put(UPPER_IN_R[i % UPPER_IN_R.length]!, cx + 2, y);
    const outR = UPPER_OUT_R[i % UPPER_OUT_R.length]!;
    const rx = spec.objects[outR]?.w === 3 ? h.x1 - 2 : h.x1 - 1;
    if (!s.put(outR, rx, y)) s.put("dept-jewelry-island", h.x1 - 1, y);
  }
  for (let y = fy + 3, j = 0; y <= h.y1 - 3; y += 3, j++) {
    if (j === 0) {
      s.put("dept-info-desk", h.x0, y);
      s.put("dept-mannequin-podium", cx - 3, y);
      s.put("dept-mannequin-podium", cx + 2, y);
      s.put("dept-glass-showcase", h.x1 - 2, y);
    } else if (j === 1) {
      s.put("mci-wait-bench", h.x0, y);
      s.put("lounge-sofa-cream", cx - 3, y);
      s.put("dept-vip-sofa", cx + 2, y);
      s.put("mci-wait-bench", h.x1 - 2, y);
      if (y + 1 <= h.y1 - 3) {
        s.put("mci-planter", h.x0, y + 1);
        s.put("mci-coffee-table", cx - 3, y + 1);
        s.put("mci-coffee-table", cx + 2, y + 1);
        s.put("mci-planter", h.x1 - 1, y + 1);
      }
    } else if (j === 2) {
      if (!s.put("dept-glass-showcase", h.x0, y)) s.put("dept-jewelry-case", h.x0, y);
      s.put("dept-perfume-island", cx - 3, y);
      s.put("dept-jewelry-case", cx + 2, y);
      if (!s.put("dept-glass-showcase", h.x1 - 2, y)) s.put("dept-perfume-island", h.x1 - 1, y);
    } else if (j === 3) {
      s.put("dept-watch-case", h.x0, y); s.put("dept-eyewear-tower", h.x0 + 2, y);
      s.put("dept-cosmetic-island", cx - 3, y);
      s.put("dept-skincare-counter", cx + 2, y);
      s.put("dept-bag-stand", h.x1 - 2, y); s.put("dept-jewelry-island", h.x1 - 1, y);
    } else {
      s.put("mci-wait-bench", h.x0, y);
      s.put("dept-mannequin-podium", cx - 3, y);
      s.put("dept-perfume-island", cx + 2, y);
      s.put("mci-wait-bench", h.x1 - 2, y);
    }
  }
  s.put("dept-directory-kiosk", cx - 2, h.y1 - 1); s.put("dept-directory-kiosk", cx + 2, h.y1 - 1);
  s.put("mci-plant-tall", h.x0, h.y1); s.put("mci-plant-tall", h.x1, h.y1);
  s.put("mci-security-gate", cx - 4, h.y1); s.put("mci-security-gate", cx + 3, h.y1);
  // ── 패션관: 북벽 탈의 부스 둘 + 커튼 탈의실 · 구두/스니커즈/잡화 월. 바닥은 R12b(Opus VQA)부터 가운데 융단 통로를 축으로
  //    양옆에 카펫 부티크 알코브를 5줄 간격으로 세운다 - 바깥벽 쪽 색상별 원형 행거 둘, 통로 쪽 마네킹 한 쌍(같은 브랜드 두 착장),
  //    그 아래 니트 평대·넥타이 쇼케이스·모자 진열대. 행거·마네킹을 3칸 격자로 흩어 놓던 배치는 바둑판으로 읽혀 폐기했다.
  //    정문 쪽 문 줄은 가로 통로로 비워 아트리움 → 패션관 → 가운데 통로가 바로 이어진다.
  const f = s.floorOf("fashion");
  hangRhythm(s, f, ["mci-window-curtain", "mci-art-frame"], 1, 3);
  const FASHION_WALL = ["dept-fitting-booth", "dept-fitting-booth", "dept-fitting-curtain", "dept-shoe-wall", "dept-sneaker-wall", "dept-accessory-wall"] as const;
  for (let x = f.x0, n = 0; x + 1 <= f.x1 - 1 && n < FASHION_WALL.length; x += 3) if (s.put(FASHION_WALL[n]!, x, f.y0)) n++;
  s.put("mci-plant-tall", f.x1, f.y0);
  s.keepRect(f.x0, f.y0 + 1, f.x1, f.y0 + 1);
  const ax = f.x0 + Math.floor((f.x1 - f.x0) / 2);
  if (fashionWest) s.keepRect(ax - 1, fashionDoor, f.x1, fashionDoor);
  else s.keepRect(f.x0, fashionDoor, ax + 1, fashionDoor);
  // 팔레트에 따라 융단과 부티크 카펫이 같은 바닥이면 통로가 사라지므로 통로는 돌 바닥으로 바꾼다.
  s.zone(ax - 1, f.y0 + 1, ax + 1, f.y1 - 1, pal.runner === pal.boutique ? "mci-stone-lobby" : pal.runner);
  // 중앙 3칸 통로 중 좌·우 보행 차선(ax-1, ax+1)은 끝까지 비우고, 정중앙(ax)에는 부티크 띠마다 안내판·전시 좌대·회전 진열대를 점진 배치한다.
  s.keepRect(ax - 1, f.y0 + 2, ax - 1, f.y1 - 1);
  s.keepRect(ax + 1, f.y0 + 2, ax + 1, f.y1 - 1);
  const AISLE_ACCENTS = ["dept-sign-pillar", "art-plinth", "dept-bag-stand", "dept-eyewear-tower", "dept-hat-stand"] as const;
  let y = f.y0 + 2;
  for (let band = 0; y + 3 <= f.y1 - 2; y += 5, band++) {
    s.zone(f.x0, y, ax - 2, y + 3, pal.boutique);
    s.zone(ax + 2, y, f.x1, y + 3, pal.boutique);
    if (Math.abs((y + 2) - fashionDoor) >= 2) s.put(AISLE_ACCENTS[band % AISLE_ACCENTS.length]!, ax, y + 2);
    if (band === 0) {
      // 1구역: 오트쿠튀르 런웨이 포디움 & 행거 부티크
      s.put("dept-rack-warm", f.x0, y + 1); s.put("dept-mannequin-podium", ax - 3, y + 1);
      s.put("dept-rack-pastel", f.x0, y + 3); s.put("dept-knit-table", ax - 3, y + 3);
      s.put("dept-mannequin-dress", ax + 2, y + 1); s.put("dept-mannequin-coat", ax + 3, y + 1); s.put("dept-clothing-rack", f.x1 - 1, y + 1);
      s.put("dept-glass-showcase", ax + 2, y + 3); s.put("dept-rack-mono", f.x1 - 1, y + 3);
    } else if (band === 1) {
      // 2구역: 명품 가방·시계·주얼리 유리 쇼케이스 부티크
      if (!s.put("dept-glass-showcase", f.x0, y + 1)) s.put("dept-jewelry-case", f.x0, y + 1);
      s.put("dept-watch-case", ax - 3, y + 1);
      s.put("dept-jewelry-case", f.x0, y + 3); s.put("dept-tie-case", ax - 3, y + 3);
      s.put("dept-glass-showcase", ax + 2, y + 1); s.put("dept-jewelry-island", f.x1 - 1, y + 1);
      s.put("dept-perfume-island", ax + 2, y + 3); s.put("dept-eyewear-tower", ax + 4, y + 3); s.put("dept-hat-stand", f.x1, y + 3);
    } else if (band === 2) {
      // 3구역: 디자이너 슈즈·아이웨어 피팅 살롱
      s.put("dept-shoe-bench", f.x0, y + 1); s.put("dept-mannequin-casual", ax - 3, y + 1); s.put("dept-bag-stand", ax - 2, y + 1);
      s.put("dept-shoe-bench", f.x0, y + 3); s.put("dept-knit-table", ax - 3, y + 3);
      s.put("dept-mannequin-podium", ax + 2, y + 1); s.put("dept-shoe-bench", f.x1 - 1, y + 1);
      s.put("dept-shoe-bench", ax + 2, y + 3); s.put("dept-eyewear-tower", ax + 4, y + 3); s.put("dept-rack-cool", f.x1 - 1, y + 3);
    } else if (band === 3) {
      // 4구역: 남성 비스포크 테일러링 & 라운지
      s.put("dept-rack-mono", f.x0, y + 1); s.put("dept-mannequin-suit", ax - 3, y + 1); s.put("dept-hat-stand", ax - 2, y + 1);
      s.put("dept-tie-case", f.x0, y + 3); s.put("dept-knit-table", ax - 3, y + 3);
      s.put("dept-tie-case", ax + 2, y + 1); s.put("dept-mannequin-suit", ax + 4, y + 1); s.put("dept-rack-cool", f.x1 - 1, y + 1);
      s.put("lounge-sofa-cream", ax + 2, y + 3); s.put("mci-coffee-table", ax + 4, y + 3); s.put("mci-plant-tall", f.x1, y + 3);
    } else {
      // 5구역: VIP 스타일링 라운지 & 캐주얼·선물 포장 코너
      s.put("dept-vip-sofa", f.x0, y + 1); s.put("mci-coffee-table", ax - 3, y + 1);
      s.put("lounge-sofa-cream", f.x0, y + 3); s.put("dept-gift-wrap", ax - 3, y + 3);
      s.put("dept-mannequin-kids", ax + 2, y + 1); s.put("dept-mannequin-casual", ax + 3, y + 1); s.put("dept-rack-pastel", f.x1 - 1, y + 1);
      s.put("dept-knit-table", ax + 2, y + 3); s.put("dept-shoe-bench", f.x1 - 1, y + 3);
    }
  }
  // 마지막 알코브 아래 남은 띠는 시착 라운지(VIP 소파 + 구두 시착 벤치)로 계산대 한 줄 위에 둔다.
  const ly = f.y1 - 2;
  if (y - 1 < ly) {
    s.zone(f.x0, y - 1, ax - 2, ly, pal.boutique); s.zone(ax + 2, y - 1, f.x1, ly, pal.boutique);
    s.put("dept-vip-sofa", f.x0, ly); s.put("dept-shoe-bench", ax - 4, ly);
    s.put("dept-shoe-bench", ax + 2, ly); s.put("dept-vip-sofa", f.x1 - 1, ly);
  }
  const fRegX = fashionWest ? f.x0 : f.x1 - 2;
  if (s.put("mci-counter-register", fRegX, f.y1, true)) s.goods("mci-g-register", fRegX + 1, f.y1);
  s.put("dept-gift-wrap", fashionWest ? fRegX + 4 : fRegX - 3, f.y1);
  s.put("dept-eyewear-tower", fashionWest ? f.x1 - 3 : f.x0 + 2, f.y1);
  s.put("mci-plant-tall", fashionWest ? f.x1 : f.x0, f.y1);

  // ── 화장품관: 북벽 유리 쇼케이스·향수 월·네일 바·핸드백 진열장, 화장품 테스트 섬·스킨케어 카운터·보석 섬 격자, 계산대.
  const b = s.floorOf("beauty");
  hangRhythm(s, b, ["mci-art-frame", nuance.mood === "dark" ? "mci-window-city" : "mci-window-curtain"], 1, 3);
  const BEAUTY_WALL = ["dept-glass-showcase", "dept-perfume-wall", "dept-handbag-vitrine", "dept-nail-bar", "dept-glass-showcase", "dept-perfume-wall"] as const;
  for (let x = b.x0, n = 0; x + 1 <= b.x1 && n < BEAUTY_WALL.length; n++) x += s.put(BEAUTY_WALL[n]!, x, b.y0) ? (BEAUTY_WALL[n] === "dept-glass-showcase" ? 4 : 3) : 1;
  s.keepRect(b.x0, b.y0 + 1, b.x1, b.y0 + 1);
  const BEAUTY_ISLANDS = ["dept-cosmetic-island", "dept-luxury-island", "dept-skincare-counter", "dept-jewelry-island", "dept-cosmetic-island", "dept-watch-case"] as const;
  // 화장품관 첫 자리는 금 테 원형 카운터·향수 탑(4×4) - 남은 섬 자리는 아래 격자가 메운다.
  s.put("jumbo-dept-perfume-rotunda", b.x0 + 1, b.y0 + 3);
  let islandY = b.y0 + 2, islands = 0;
  for (; islandY + 1 <= b.y1 - 1; islandY += 3) for (let x = b.x0 + 1; x + 2 <= b.x1 - 1; x += 4) s.put(BEAUTY_ISLANDS[islands++ % BEAUTY_ISLANDS.length]!, x, islandY);
  // 섬 줄 아래 남은 띠(계산대 앞 한 줄은 비운다)는 마네킹·안경 타워·화분으로 채운다 — 남쪽 빈 흰 바닥(VQA 6회차).
  if (islandY <= b.y1 - 2) for (let x = b.x0 + 1, k = 0; x + 1 <= b.x1 - 1; x += 3, k++) s.put(["dept-mannequin-dress", "dept-eyewear-tower", "mci-plant-tall"][k % 3]!, x, islandY);
  const bRegX = fashionWest ? b.x1 - 2 : b.x0;
  if (s.put("mci-counter-register", bRegX, b.y1)) s.goods("mci-g-register", bRegX + 1, b.y1);

  // ── 카페: 북벽 커피 스테이션·진열대·메뉴판, 카페 탁자 격자, 구석 화분.
  const k = s.floorOf("cafe");
  hangRhythm(s, k, ["mci-menu-board", nuance.mood === "dark" ? "mci-window-city" : "mci-window-blind"], 1, 3);
  s.put("mci-coffee-station", k.x0, k.y0);
  s.put("mci-pastry-case", k.x0 + 2, k.y0);
  s.put("mart-bakery-counter", k.x0 + 4, k.y0);
  s.put("mart-cake-showcase", k.x0 + 6, k.y0);
  if (s.put("mci-counter-register", k.x0 + 8, k.y0)) s.goods("mci-g-register", k.x0 + 9, k.y0);
  s.put("mci-plant-tall", k.x1, k.y0);
  s.keepRect(k.x0, k.y0 + 1, k.x1, k.y0 + 1);
  for (let y = k.y0 + 2; y <= k.y1 - 1; y += 2) {
    for (let x = k.x0 + 1; x + 2 <= k.x1; x += 4) {
      s.put("mci-cafe-chair-e", x, y);
      if (s.put("mci-cafe-table", x + 1, y)) s.goods(pickOf(rng, ["mci-g-coffee", "mci-g-vase", "mci-g-coffee"]), x + 1, y);
      s.put("mci-cafe-chair-w", x + 2, y);
    }
  }
  s.put("mci-plant-tall", k.x0, k.y1);

  const areas = [areaOf("아트리움", h), areaOf("패션관", f), areaOf("화장품관", b), areaOf("카페", k)];
  return s.finish({ tileset: "modern_city", floor: pal.hall[0], wall: pal.hall[1] }, areas, decisions);
}

// ─────────────────────────────────────────────── 요청 읽기 · 고르기 ───────────────────────────────────────────────

const WANT_WORDS: readonly (readonly [string, RegExp])[] = [
  ["cafe", /카페|커피|cafe|coffee/iu],
  ["pantry", /탕비|팬트리|휴게|pantry/iu],
  ["meeting", /회의|미팅|meeting/iu],
  ["library", /도서|서재|서고|서가|library/iu],
  ["armory", /무기고|병기|무구|armou?ry/iu],
  ["bridge", /다리|교량|bridge/iu],
  ["terrace", /테라스|노천|terrace/iu],
  ["blossom", /벚꽃|꽃길|blossom/iu],
];

/** 요청 문장(맵 이름·지시)에서 규모·분위기·선택 구역 낱말을 읽는다. */
export function readSpaceNuance(text: string): SpaceNuance {
  const scale = /작은|아담|소형|미니|좁은|compact|small/iu.test(text) ? "compact"
    : /대형|거대|웅장|넓은|큰|대규모|grand|large|huge/iu.test(text) ? "grand" : "standard";
  const mood = /어두|밤|야간|고딕|음침|다크|dark|night/iu.test(text) ? "dark"
    : /따뜻|아늑|원목|포근|warm|cozy/iu.test(text) ? "warm"
    : /차가|모던|미니멀|세련|쿨|유리|cool|modern|minimal/iu.test(text) ? "cool" : "neutral";
  const wants = new Set<string>();
  for (const [key, re] of WANT_WORDS) if (re.test(text)) wants.add(key);
  return { scale, mood, wants };
}

/**
 * build_hand_interior_room 의 layout.program 이 청사진 구성기가 있는 공간이면 그 구성기로 짠다(칩셋이 맞을 때만).
 * 호텔·백화점 「로비」는 오피스 로비 청사진이 아니므로 원래 견본 배치를 쓴다(백화점 전체는 department-store 구성기).
 */
export function composeInteriorBlueprint(tilesetId: string, program: string, spec: HandInteriorSpec, request: string, seed: number): BlueprintInteriorArgs | undefined {
  const nuance = readSpaceNuance(request);
  if (tilesetId === "modern_city" && program === "lobby" && !/호텔|백화점|hotel|department/iu.test(request)) return composeOfficeLobby(spec, nuance, seed);
  if (tilesetId === "modern_campus" && program === "university-lecture-wing") return composeLectureWing(spec, nuance, seed);
  if (tilesetId === "atlas_biome_interior" && program === "throne") return composeThroneHall(spec, nuance, seed);
  if (tilesetId === "modern_city" && (program === "department-store" || program === "mc_department_store")) return composeDepartmentStore(spec, nuance, seed);
  // 일본 2층 단독주택 1층·2층(jpHouseBlueprint.ts) — 참고 그림에서 읽은 구조(물 쓰는 곳 묶음·가운데 복도 계단·남쪽 현관)를 지킨다.
  if (tilesetId === "jp_city") { const jp = composeJpHouseBlueprint(program, spec, seed); if (jp) { const { stairs: _s, layoutRooms: _r, ...args } = jp; return args; } }
  return undefined;
}
