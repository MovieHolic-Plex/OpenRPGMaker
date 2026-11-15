// project/jpCitySceneCtx.ts
// 거리 장면 구성기의 작업대 — 칸 쓰임표(무엇이 어디를 차지했나), 단계 묶음, 소품 놓기, «같은 건물 두 번 안 세우기» 고르기.
// 계획은 순수하다(지도·칩셋 없이 jpCityStreetCatalog.json 의 크기만 본다) — 조수 빌더가 씨앗을 미리 본다.
import type { JpStreetStep } from "@/project/jpCityStreetComposer";
import { SCENE_BUILDINGS, SCENE_LOWER, SCENE_SIZES, type CatBuilding, type SceneKind, type SceneTone } from "@/project/jpCitySceneKinds";
import { STREET_ATTACHED, GROUND_FAMILIES, groundFamilyOf, runFamilyOf, streetAlias, streetKitId, STREET_PIECES, type GroundFamily } from "@/project/jpCityStreetPieces";
import { lookHash } from "@/project/kitLook";

/** 칸 쓰임: 0 빈 대지 · 1 걷는 자리(비워 둔다) · 2 차도 · 3 물·둑 · 4 소품 · 5 처마 틈(건물 옆 1px 윤곽 칸 — 4층 덧그림만) · 6 건물 · 7 담·난간 */
export const Occ = { Lot: 0, Walk: 1, Road: 2, Water: 3, Prop: 4, Slit: 5, Bldg: 6, Wall: 7 } as const;
export type Occ = (typeof Occ)[keyof typeof Occ];

/** 큰길(가로): kerb 연석 차도 · lane 보도 없는 생활도로 · path 차가 못 다니는 골목(2줄) · mall 보행자 시장 길 · river 하천 · edge 지도 아래 끝 길 */
export interface SceneStreet {
  readonly type: "kerb" | "lane" | "path" | "mall" | "river" | "edge";
  readonly y0: number; readonly end: number;
  /** 건물 발 바로 아래 줄(가게 앞 내놓는 줄) */ readonly nA: number;
  /** 북쪽 보도의 연석 줄(낮은 가로 시설) */ readonly nK?: number;
  readonly road0: number; readonly road1: number;
  /** 남쪽 보도: 연석 쪽 줄(걷는 줄) */ readonly sA?: number;
  /** 남쪽 보도: 담 쪽 줄(키 큰 가로 시설) */ readonly sB: number;
  readonly river?: { readonly wall: number; readonly water0: number; readonly water1: number; readonly bank0: number; readonly bank1: number };
}
export interface SceneBand { readonly index: number; top: number; readonly foot: number; readonly front: SceneStreet }
export interface SceneVStreet { readonly x: number; readonly lane: number; readonly sw: number; readonly w: number; readonly from: number; readonly to: number; readonly arcade: boolean; readonly main: boolean; readonly y0: number; readonly y1: number }
export interface SceneBlock { readonly band: SceneBand; sx: number; ex: number; use: string; noRear?: boolean; readonly edgeW: boolean; readonly edgeE: boolean }
export interface SceneLayout { readonly bands: SceneBand[]; readonly vstreets: SceneVStreet[]; readonly blocks: SceneBlock[] }

const NEW_BUILDINGS: readonly CatBuilding[] = SCENE_BUILDINGS.filter((b) => b.id.startsWith("jp-bldg-f-"));

export function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface ScenePlaced { readonly kit?: CatBuilding; readonly role: string; readonly ko: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly foot: number; readonly doors: readonly number[] }

export interface PutOpts {
  /** 맨 아래 몇 줄이 «선 자리»인가(기본 1). 그 줄은 base 에 든 쓰임이어야 한다 */
  readonly baseRows?: number;
  /** 선 자리로 허락하는 쓰임(기본 빈 대지) */
  readonly base?: readonly Occ[];
  /** 윗줄(사람 위로 그려지는 부분)이 덮어도 되는 쓰임(기본 대지·걷는 자리·차도·물) */
  readonly over?: readonly Occ[];
  /** 4층 덧그림으로 찍는다(가게 정면 앞 진열 · 처마 틈 · 담 앞 기둥) */
  readonly layer4?: boolean;
  /** 둘레 한 칸에 다른 소품이 없어야 한다 */
  readonly gap?: boolean;
  readonly note?: string;
  /** 2층(바닥 장식)으로 찍는다 — 주차 칸 선·벽돌 */
  readonly floor?: boolean;
  /** 건물보다 먼저 찍는다(건물이 아랫부분을 덮는 뒤뜰 나무) */
  readonly early?: boolean;
  readonly late?: boolean;
  /** 이미 그려진 소품 위에 겹쳐 그린다(차 위 카포트) */
  readonly stack?: boolean;
}

/** 집 필지 앞줄의 담·대문 키트 한 조각. lot = 필지(집) 번호, door = 그 대문이 마주 보는 현관 칸. */
export interface SceneKaki { readonly id: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly gate: boolean; readonly lot: number; readonly door?: { readonly x: number; readonly y: number } }

export class SceneCtx {
  readonly occ: Uint8Array;
  /** 소품 그림이 덮은 칸(층 무관) — 두 소품이 같은 칸에 그려지지 않게 */
  readonly drawn: Uint8Array;
  readonly ground: JpStreetStep[] = [];
  readonly marks: JpStreetStep[] = [];
  readonly early: JpStreetStep[] = [];
  readonly bldgs: JpStreetStep[] = [];
  readonly walls: JpStreetStep[] = [];
  readonly props: JpStreetStep[] = [];
  readonly late: JpStreetStep[] = [];
  readonly placed: ScenePlaced[] = [];
  readonly usedProps = new Map<string, number>();
  readonly usedLooks = new Map<string, { x: number; y: number; w: number; h: number }[]>();
  readonly scenesUsed = new Set<string>();
  readonly piecesUsed: string[] = [];
  private readonly order = new Map<string, number>();
  /** 초대형·랜드마크 건물은 한 지도에 하나 */
  private bigPlaced = false;
  // ── 새 거리(fable_street 조각) ── 칸마다 바닥 가족, 모아 둔 경계 줄 칸, 놓인 새 조각.
  /** 칸의 바닥 가족(GROUND_FAMILIES 번호) */ readonly gfam: Uint8Array;
  readonly runCells: { family: string; cells: { x: number; y: number }[] }[] = [];
  readonly stPlaced: { name: string; look: string; x: number; y: number; w: number; h: number; anchor: string; repeat: boolean }[] = [];
  /** 두 띠를 합친 깊은 필지 안의 띠 경계 줄 — 띠 뒤 담을 여기에는 세우지 않는다 */ readonly deepRows: { sx: number; ex: number; y: number }[] = [];
  /** 집 필지 앞줄의 담·대문 키트(jp-bldg-f-kaki-*)가 놓인 자리 — 검사가 «허공에서 끝나지 않는다 · 필지에 대문 하나»를 본다 */ readonly kaki: SceneKaki[] = [];
  /** 대문 자리(집 필지의 길 선에서 문 앞 칸) — 경계 줄 짓기가 여기에 대문 조각을 놓는다 */ readonly gates: { x: number; y: number }[] = [];
  /** 고리 담의 트인 자리(공원·신사·주차장 입구) — 경계 줄 짓기가 메우지 않고, 그 양옆은 끝 조각으로 맺는다 */ readonly openings = new Set<string>();

  constructor(readonly mapId: string, readonly W: number, readonly H: number, readonly kind: SceneKind, readonly tone: SceneTone, readonly key: string, readonly seed: number, readonly rng: () => number, /** 새 조각으로 짓는다 */ readonly fable = false) {
    this.occ = new Uint8Array(W * H);
    this.gfam = new Uint8Array(W * H);
    this.drawn = new Uint8Array(W * H);
    // 게임마다 다른 건물 순서: 열쇠 + 키트 id 해시. 한 게임 안에서는 맵(씨앗)마다 출발점만 돈다.
    const ids = [...(fable && NEW_BUILDINGS.length ? NEW_BUILDINGS : SCENE_BUILDINGS)].sort((a, b) => lookHash(`${key}|${a.id}`) - lookHash(`${key}|${b.id}`));
    ids.forEach((b, i) => this.order.set(b.id, (i + seed * 7) % ids.length));
  }

  inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  at(x: number, y: number): Occ { return this.inside(x, y) ? this.occ[y * this.W + x]! as Occ : Occ.Wall; }
  mark(x: number, y: number, w: number, h: number, v: Occ, only?: readonly Occ[]): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.W, x + w); xx++) {
      const i = yy * this.W + xx;
      if (!only || only.includes(this.occ[i]! as Occ)) this.occ[i] = v;
    }
  }
  all(x: number, y: number, w: number, h: number, ok: readonly Occ[]): boolean {
    if (x < 0 || y < 0 || x + w > this.W || y + h > this.H) return false;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!ok.includes(this.occ[yy * this.W + xx]! as Occ)) return false;
    return true;
  }
  fill(x: number, y: number, w: number, h: number, material: string): void {
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.W, x + w), y1 = Math.min(this.H, y + h);
    if (this.fable) { this.fillFamily(x, y, w, h, groundFamilyOf(material)); return; }
    if (x1 > x0 && y1 > y0) this.ground.push({ tool: "fill_region", args: { mapId: this.mapId, rect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, material }, optional: true, note: "ground" });
  }
  /** 새 거리: 칸의 바닥 가족을 적는다(바닥 그림은 맨 끝에 가족 표에서 한 번에 찍는다 — fableGround). */
  fillFamily(x: number, y: number, w: number, h: number, f: GroundFamily): void {
    const v = GROUND_FAMILIES.indexOf(f);
    for (let yy = Math.max(0, y); yy < Math.min(this.H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(this.W, x + w); xx++) this.gfam[yy * this.W + xx] = v;
  }
  famAt(x: number, y: number): GroundFamily { return this.inside(x, y) ? GROUND_FAMILIES[this.gfam[y * this.W + x]!]! : "none"; }
  /** 담·생울타리·철망·가드레일 — 칸 목록을 한 덩이로(이웃 모양을 맞춰) 3층에 찍는다. */
  edge(cells: readonly { x: number; y: number }[], material: string): void {
    const ok = cells.filter((c) => this.inside(c.x, c.y) && !this.drawn[c.y * this.W + c.x] && (this.at(c.x, c.y) === Occ.Lot || this.at(c.x, c.y) === Occ.Walk));
    if (!ok.length) return;
    for (const c of ok) this.occ[c.y * this.W + c.x] = Occ.Wall;
    if (this.fable) {
      const family = runFamilyOf(material);
      if (!family) { for (const c of ok) this.occ[c.y * this.W + c.x] = Occ.Lot; return; }
      this.runCells.push({ family, cells: ok.map((c) => ({ x: c.x, y: c.y })) });
      // 가로 줄 조각은 두 칸 높이다 — 윗칸(갓돌이 그려지는 칸)에 다른 소품이 서지 않게 잡아 둔다. 세로 줄의 칸은 제 윗칸이 같은 줄이다.
      const mine = new Set(ok.map((c) => `${c.x},${c.y}`));
      for (const c of ok) if (c.y > 0 && !mine.has(`${c.x},${c.y - 1}`) && this.occ[(c.y - 1) * this.W + c.x] !== Occ.Wall) this.drawn[(c.y - 1) * this.W + c.x] = 1;
      return;
    }
    this.walls.push({ tool: "edge_cells", args: { mapId: this.mapId, cells: ok, material }, optional: true, note: "edge" });
  }
  hline(x: number, y: number, w: number): { x: number; y: number }[] { return Array.from({ length: Math.max(0, w) }, (_, k) => ({ x: x + k, y })); }
  vline(x: number, y: number, h: number): { x: number; y: number }[] { return Array.from({ length: Math.max(0, h) }, (_, k) => ({ x, y: y + k })); }

  size(id: string): readonly [number, number] | undefined {
    if (!this.fable) return SCENE_SIZES[id];
    const p = STREET_PIECES[streetAlias(id)[0] ?? ""];
    return p ? [p.w, p.h] : SCENE_SIZES[id];                                // 대응 조각이 없는 옛 id 는 놓이지 않는다(크기만 답한다 — 부르는 쪽의 칸 셈이 그대로 돈다)
  }

  // ── 새 거리의 소품 놓기: 조각마다 앵커 등급이 있고 그 자리에만 선다 ──
  private near(x: number, y: number, w: number, h: number, ok: (v: Occ, xx: number, yy: number) => boolean): boolean {
    for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) {
      if (xx >= x && xx < x + w && yy >= y && yy < y + h) continue;
      if (!this.inside(xx, yy)) continue;
      if (ok(this.occ[yy * this.W + xx]! as Occ, xx, yy)) return true;
    }
    return false;
  }
  /** 이 조각이 발 줄 (x..x+w-1, foot) 에 설 수 있는가 — 지도 안 · 겹침 없음 · 차도 칸을 덮지 않음 · 앵커 자리 · 같은 그림이 20×15 창 안에 없음. */
  private doorFrontN = -1;
  private readonly doorFrontSet = new Set<string>();
  /** 건물 문 바로 앞 칸(접근칸)인가 — 서 있는 조각도 담도 여기를 막지 않는다. */
  doorFront(x: number, y: number): boolean {
    if (this.doorFrontN !== this.placed.length) { this.doorFrontSet.clear(); for (const b of this.placed) { for (const d of b.doors) this.doorFrontSet.add(`${b.x + d},${b.foot + 1}`); const bay = b.kit?.bay; if (bay) for (let k = 0; k < bay[1]; k++) this.doorFrontSet.add(`${b.x + bay[0] + k},${b.foot + 1}`); } this.doorFrontN = this.placed.length; }
    return this.doorFrontSet.has(`${x},${y}`);
  }
  stFits(name: string, x: number, foot: number, o: { stack?: boolean; lax?: boolean; /** 짝으로 놓는 것(참배길 석등): 같은 그림이 곁에 있어도 선다 */ pair?: boolean } = {}): boolean {
    const p = STREET_PIECES[name];
    if (!p) return false;
    if (p.layer !== "floor" && p.layer !== "ground" && p.anchor !== "facade" && p.anchor !== "road" && p.anchor !== "water") for (let k = 0; k < p.w; k++) if (this.doorFront(x + k, foot) || this.doorFront(x + k, foot - 1)) return false;   // 문 앞 두 칸은 비운다
    const y = foot - p.h + 1;
    if (x < 0 || y < 0 || x + p.w > this.W || foot >= this.H) return false;
    const road = p.anchor === "road", floor = p.layer === "floor";
    for (let yy = y; yy <= foot; yy++) for (let xx = x; xx < x + p.w; xx++) {
      const i = yy * this.W + xx, v = this.occ[i]! as Occ;
      if (this.drawn[i] && !o.stack) return false;
      if (v === Occ.Road && !road && !(floor && (p.tags.includes("road") || p.tags.includes("border")))) return false;       // 차도 칸에는 차와 노면 조각만
      if (yy === foot && !floor && !road && p.anchor !== "facade" && p.anchor !== "water" && v !== Occ.Lot && !(o.lax && v === Occ.Walk)) return false;
    }
    const fam = (xx: number) => this.famAt(xx, foot);
    const cols = Array.from({ length: p.w }, (_, k) => x + k);
    const solid = (v: Occ) => v === Occ.Bldg || v === Occ.Wall || v === Occ.Slit;
    switch (p.anchor) {
      case "wall": if (cols.filter((xx) => solid(this.at(xx, foot - 1))).length * 2 < p.w && !cols.every((xx) => this.at(xx, foot + 1) === Occ.Bldg)) return false; break;   // 벽 앞, 또는 건물 뒷벽에 붙어(건물 바로 뒤 줄)
      case "kerb": if (!cols.every((xx) => fam(xx) === "pave" || fam(xx) === "laneside") || !cols.some((xx) => this.at(xx, foot + 1) === Occ.Road || this.at(xx, foot - 1) === Occ.Road)) return false; break;
      case "lot": if (STREET_ATTACHED.has(name) && !this.near(x, foot, p.w, 1, (v) => solid(v) || v === Occ.Walk)) return false;   // 혼자 서지 않는 것: 벽·건물 옆이거나 길(디딤돌·통로) 곁
        if (!cols.every((xx) => ["forecourt", "earth", "lawn", "alley", "pave"].includes(fam(xx))) || !this.near(x, foot, p.w, 1, (v, xx, yy) => solid(v) || (this.gfam[yy * this.W + xx] !== this.gfam[foot * this.W + x] && v !== Occ.Road))) return false; break;
      case "open": if (!cols.every((xx) => ["forecourt", "earth", "lawn", "alley", "pave"].includes(fam(xx)))) return false; break;
      case "facade": if (!cols.every((xx) => this.at(xx, foot) === Occ.Bldg)) return false; break;
      case "road": if (!cols.every((xx) => this.at(xx, foot) === Occ.Road && (fam(xx) === "tarmac" || fam(xx) === "lane"))) return false; break;
      case "water": if (!cols.every((xx) => fam(xx) === "water")) return false; break;
      case "floor": { const need = p.tags.find((t) => t.startsWith("on:"))?.slice(3).split("+"); if (need && !cols.every((xx) => need.includes(fam(xx)))) return false; break; }
      default: return false;                                                                    // run 조각은 줄 짓기만 놓는다
    }
    if (!p.repeat && !o.pair) { const look = p.look ?? name; for (const q of this.stPlaced) if (q.look === look && Math.abs(q.x - x) < 20 && Math.abs(q.y - y) < 15) return false; }
    return true;
  }
  /** 조각 하나를 놓는다(검사 없이 — stFits 를 통과한 자리 또는 줄 짓기가 정한 자리). */
  stStamp(name: string, x: number, foot: number, o: { stack?: boolean; early?: boolean; late?: boolean; ground?: GroundFamily; pair?: boolean } = {}): void {
    const p = STREET_PIECES[name]!;
    const y = foot - p.h + 1;
    for (let yy = Math.max(0, y); yy <= foot; yy++) for (let xx = x; xx < x + p.w; xx++) {
      const i = yy * this.W + xx;
      this.drawn[i] = 1;
      if (yy === foot && p.layer !== "floor" && p.layer !== "ground" && p.anchor !== "road" && p.anchor !== "facade" && p.anchor !== "water") this.occ[i] = p.anchor === "run" ? Occ.Wall : Occ.Prop;
    }
    const g0 = o.ground ?? this.famAt(x, Math.min(this.H - 1, foot + (p.anchor === "run" ? 1 : 0)));
    const ground = g0 === "laneside" ? "lane" : g0;                          // 길가 띠 위에 서는 것은 생활도로 포장의 그림자 변형
    const step: JpStreetStep = { tool: "stamp_object", args: { objectId: `kit:jp_city/${streetKitId(name, ground)}`, mapId: this.mapId, x, y }, optional: true, note: p.layer === "floor" ? "floor2" : p.layer === "ground" ? "bank" : "prop4" };
    (p.layer === "floor" || p.layer === "ground" ? this.marks : o.early ? this.early : o.late ? this.late : p.anchor === "run" ? this.walls : this.props).push(step);
    this.stPlaced.push({ name, look: p.look ?? name, x, y, w: p.w, h: p.h, anchor: p.anchor, repeat: p.repeat === true || o.pair === true });
    this.usedProps.set(name, (this.usedProps.get(name) ?? 0) + 1);
  }
  /** 놓은 조각 하나를 거둔다(단계와 칸 쓰임을 되돌린다). */
  stRemove(index: number): void {
    const p = this.stPlaced[index];
    if (!p) return;
    const match = (s: JpStreetStep) => s.tool === "stamp_object" && s.args.x === p.x && s.args.y === p.y && String(s.args.objectId).replace("kit:jp_city/jp-st-", "").split("--")[0] === p.name;
    for (const list of [this.props, this.late, this.early, this.walls, this.marks]) { const k = list.findIndex(match); if (k >= 0) { list.splice(k, 1); break; } }
    for (let yy = p.y; yy < p.y + p.h; yy++) for (let xx = p.x; xx < p.x + p.w; xx++) { const i = yy * this.W + xx; this.drawn[i] = 0; if (yy === p.y + p.h - 1 && this.occ[i] === Occ.Prop) this.occ[i] = Occ.Lot; }
    this.stPlaced.splice(index, 1);
    this.usedProps.set(p.name, Math.max(0, (this.usedProps.get(p.name) ?? 1) - 1));
  }
  /** 후보 조각들 가운데 덜 쓴 것부터 이 발 줄에 서는 첫 조각을 놓는다. */
  stPut(names: readonly string[], x: number, foot: number, o: { stack?: boolean; early?: boolean; late?: boolean; lax?: boolean; maxW?: number } = {}): string | undefined {
    const order = names.filter((n) => STREET_PIECES[n] && (o.maxW === undefined || STREET_PIECES[n]!.w <= o.maxW)).map((n) => ({ n, u: this.usedProps.get(n) ?? 0, r: this.rng() })).sort((a, b) => a.u - b.u || a.r - b.r);
    for (const c of order) if (this.stFits(c.n, x, foot, o)) { this.stStamp(c.n, x, foot, o); return c.n; }
    return undefined;
  }

  can(id: string, x: number, y: number, o: PutOpts = {}): boolean {
    if (this.fable) { const sz0 = this.size(id); return !!sz0 && streetAlias(id).some((n) => this.stFits(n, x, y + sz0[1] - 1, o)); }
    const sz = this.size(id);
    if (!sz || (o.layer4 && SCENE_LOWER.has(id))) return false;
    const [w, h] = sz;
    if (x < 0 || y < 0 || x + w > this.W || y + h > this.H) return false;
    const baseRows = Math.min(h, o.baseRows ?? 1);
    const base = o.base ?? [Occ.Lot], over = o.over ?? [Occ.Lot, Occ.Walk, Occ.Road, Occ.Water];
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = yy * this.W + xx;
      if (this.drawn[i] && !o.stack) return false;
      const v = this.occ[i]! as Occ;
      if (yy >= y + h - baseRows ? !base.includes(v) : !(over.includes(v) || base.includes(v))) return false;
    }
    if (o.gap) for (let yy = y - 1; yy <= y + h; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (this.inside(xx, yy) && this.occ[yy * this.W + xx] === Occ.Prop) return false;
    return true;
  }

  /** 소품 하나(왼쪽 위 x,y). 자리가 안 되면 false. */
  put(id: string, x: number, y: number, o: PutOpts = {}): boolean {
    if (this.fable) { const sz0 = this.size(id); return !!sz0 && this.stPut(streetAlias(id), x, y + sz0[1] - 1, o) !== undefined; }
    if (!this.can(id, x, y, o)) return false;
    const [w, h] = this.size(id)!;
    const baseRows = Math.min(h, o.baseRows ?? 1);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const i = yy * this.W + xx;
      this.drawn[i] = 1;
      if (yy >= y + h - baseRows && !o.floor) this.occ[i] = Occ.Prop;
    }
    const step: JpStreetStep = { tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: this.mapId, x, y }, optional: true, note: o.note ?? (o.floor ? "floor2" : o.layer4 ? "prop4" : "prop") };
    (o.early ? this.early : o.late ? this.late : o.floor ? this.marks : this.props).push(step);
    this.usedProps.set(id, (this.usedProps.get(id) ?? 0) + 1);
    return true;
  }
  /** 발 줄(맨 아래 줄 y)에 맞춰 놓는다. */
  putFoot(id: string, x: number, footY: number, o: PutOpts = {}): boolean {
    if (this.fable) return this.stPut(streetAlias(id), x, footY, o) !== undefined;
    const sz = this.size(id);
    return !!sz && this.put(id, x, footY - sz[1] + 1, o);
  }
  /** 길 위 표시·차(칸 쓰임을 바꾸지 않는다). */
  decal(id: string, x: number, y: number, note = "road"): boolean {
    if (this.fable) { const sz0 = this.size(id); return note === "prop" && !!sz0 && this.stPut(streetAlias(id), x, y + sz0[1] - 1) !== undefined; }
    const sz = this.size(id);
    if (!sz || x < 0 || y < 0 || x + sz[0] > this.W || y + sz[1] > this.H) return false;
    for (let yy = y; yy < y + sz[1]; yy++) for (let xx = x; xx < x + sz[0]; xx++) if (this.drawn[yy * this.W + xx]) return false;
    for (let yy = y; yy < y + sz[1]; yy++) for (let xx = x; xx < x + sz[0]; xx++) this.drawn[yy * this.W + xx] = 1;
    this.marks.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: this.mapId, x, y }, optional: true, note });
    if (note === "prop") this.usedProps.set(id, (this.usedProps.get(id) ?? 0) + 1);
    return true;
  }
  /** 1칸 덧그림을 조건 없이(둑·다리·물 반짝임 같은 길·물의 일부). */
  raw(id: string, x: number, y: number, note = "bank"): void {
    if (this.fable) return;                                                 // 옛 길·물 조각 — 새 거리는 제 조각으로 짓는다(fableStreets)
    if (this.inside(x, y)) this.marks.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: this.mapId, x, y }, optional: true, note });
  }

  /** 목록에서 이 지도에 가장 덜 쓴 것(같으면 난수). */
  least(pool: readonly string[]): string | undefined {
    if (this.fable) { const names = [...new Set(pool.flatMap((id) => streetAlias(id)))]; if (!names.length) return undefined; const m = Math.min(...names.map((n) => this.usedProps.get(n) ?? 0)); const b = names.filter((n) => (this.usedProps.get(n) ?? 0) === m); return b[Math.floor(this.rng() * b.length)]; }
    const ok = pool.filter((id) => this.size(id));
    if (!ok.length) return undefined;
    const min = Math.min(...ok.map((id) => this.usedProps.get(id) ?? 0));
    const best = ok.filter((id) => (this.usedProps.get(id) ?? 0) === min);
    return best[Math.floor(this.rng() * best.length)];
  }
  /** 목록을 덜 쓴 것부터 돌며 처음 놓이는 것 하나. */
  putAny(pool: readonly string[], x: number, footY: number, o: PutOpts = {}): string | undefined {
    if (this.fable) return this.stPut([...new Set(pool.flatMap((id) => streetAlias(id)))], x, footY, o);
    const ok = pool.filter((id) => this.size(id)).map((id) => ({ id, n: this.usedProps.get(id) ?? 0, r: this.rng() })).sort((a, b) => a.n - b.n || a.r - b.r);
    for (const c of ok) if (this.putFoot(c.id, x, footY, o)) return c.id;
    return undefined;
  }

  // ── 건물 ──
  /** 새 거리는 새로 그린 건물(jp-bldg-f-*)만 세운다 — 옛 납작한 키트는 고르지 않는다(칩셋에는 남아 옛 지도가 그대로 돈다). */
  /** 건물 표: 새 거리는 새 건물(jp-bldg-f-*)만 — 사전에 하나라도 구워져 있으면. 문 열·폭은 키트에서 읽은 사전(jpCityStreetCatalog.json) 그대로다. */
  get buildingPool(): readonly CatBuilding[] { return this.fable && NEW_BUILDINGS.length ? NEW_BUILDINGS : SCENE_BUILDINGS; }
  private lookOf(b: CatBuilding): string { return b.look ?? b.id; }
  private dist(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): number {
    return Math.max(Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w)), Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h)));
  }
  /**
   * 다음 건물 키트: cats(앞이 먼저) 가운데 폭·높이에 들고, 이 지도에 아직 안 세운 그림을 게임 순서대로. 다 썼으면 가장 덜 쓴 것 가운데
   * 앞서 세운 같은 그림과 20칸 이상 떨어진 것만 — 없으면 세우지 않는다(빈 자리는 쓰임이 채운다). 이웃과 키가 같지 않은 쪽을 먼저 본다.
   */
  nextKit(cats: readonly string[], at: { x: number; foot: number }, maxW: number, maxH: number, o: { minH?: number; notH?: number; role?: string; minW?: number; /** 아직 안 세운 그림만 */ fresh?: boolean; /** 초대형·랜드마크를 세워도 되는 자리(맨 뒤 띠의 앞줄) */ big?: boolean } = {}): CatBuilding | undefined {
    const pick = (cat: string | undefined, fresh: boolean): CatBuilding | undefined => {
      const cands = this.buildingPool.filter((b) => (o.role ? b.role === o.role : b.cat === cat) && b.w <= maxW && b.h <= maxH && b.h >= (o.minH ?? 0) && b.w >= (o.minW ?? 0)
        && (!(b.tier === "xlarge" || b.tier === "landmark") || (o.big === true && !this.bigPlaced)));
      const scored = cands.map((b) => {
        const prev = this.usedLooks.get(this.lookOf(b)) ?? [];
        const rect = { x: at.x, y: at.foot - b.h + 1, w: b.w, h: b.h };
        return { b, n: prev.length, near: prev.some((p) => this.dist(p, rect) < 20), ord: this.order.get(b.id) ?? 0 };
      }).filter((c) => (fresh ? c.n === 0 : !c.near));
      if (!scored.length) return undefined;
      const min = Math.min(...scored.map((c) => c.n));
      return scored.filter((c) => c.n === min).sort((a, b) => Number(a.b.h === o.notH) - Number(b.b.h === o.notH) || a.ord - b.ord)[0]!.b;
    };
    if (o.role) return pick(undefined, true) ?? (this.fable ? undefined : pick(undefined, false));                // 요청한 가게는 되풀이여도 세운다
    // 먼저 모든 분류에서 아직 안 세운 그림을 찾고, 다 썼을 때만 멀리 떨어진 되풀이를 허락한다.
    // 되풀이는 이 분류들의 그림을 지도에 다 세웠을 때만(맞는 크기가 없어 남은 것은 되풀이의 이유가 아니다 — 그 자리는 틈·빈터 쓰임이 채운다).
    const allUsed = this.buildingPool.filter((b) => cats.includes(b.cat) && b.tier !== "xlarge" && b.tier !== "landmark").every((b) => this.usedLooks.has(this.lookOf(b)));
    // 새 거리: 같은 건물 그림은 한 지도에 한 번뿐이다 — 다 썼으면 세우지 않는다(남는 자리는 빈터 쓰임·마당이 채운다).
    for (const fresh of o.fresh || !allUsed || this.fable ? [true] : [true, false]) for (const cat of cats) { const hit = pick(cat, fresh); if (hit) return hit; }
    return undefined;
  }

  /** 건물 키트를 세운다(왼쪽 위 x, 발 줄 foot). 벽 칸은 건물, 양옆 처마 칸은 틈. 문 앞 칸은 걷는 자리로 비운다. */
  placeKit(b: CatBuilding, x: number, foot: number): ScenePlaced {
    const y = foot - b.h + 1;
    for (let yy = Math.max(0, y); yy <= foot; yy++) for (let xx = x; xx < x + b.w; xx++) {
      if (!this.inside(xx, yy)) continue;
      const eave = xx < x + b.ml || xx >= x + b.w - b.mr;
      const i = yy * this.W + xx;
      if (!eave) this.occ[i] = Occ.Bldg; else if (this.occ[i] === Occ.Lot) this.occ[i] = Occ.Slit;
    }
    for (const dx of b.doors) for (const dy of [1, 2]) if (this.inside(x + dx, foot + dy) && this.at(x + dx, foot + dy) === Occ.Lot) this.occ[(foot + dy) * this.W + x + dx] = Occ.Walk;
    if (b.tier === "xlarge" || b.tier === "landmark") this.bigPlaced = true;
    const p: ScenePlaced = { kit: b, role: b.role, ko: b.ko, x, y, w: b.w, h: b.h, foot, doors: b.doors };
    this.placed.push(p);
    const look = this.lookOf(b);
    this.usedLooks.set(look, [...(this.usedLooks.get(look) ?? []), { x, y, w: b.w, h: b.h }]);
    this.bldgs.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${b.id}`, mapId: this.mapId, x, y }, optional: true, note: `bldg:${this.placed.length - 1}` });
    return p;
  }
  /** 경계 줄의 모서리 한 칸을 적는다(길가 소품의 윗칸이 겹쳐 있어도 — 담이 그 뒤에 선다). */
  cornerCell(x: number, y: number, material: string): void {
    const family = runFamilyOf(material), v = this.at(x, y);
    if (!family || !this.inside(x, y) || (v !== Occ.Lot && v !== Occ.Walk)) return;
    this.occ[y * this.W + x] = Occ.Wall;
    this.runCells.push({ family, cells: [{ x, y }] });
  }
  /** 담·대문 키트(건물 일꾼의 jp-bldg-f-kaki-*)를 발 줄 foot 에 찍는다. 담은 두 줄 다 막힌 칸으로 적고(윗줄은 갓 — 소품이 서지 않는다), 대문은 가운데 열이 걷는 칸이다. */
  stampKaki(id: string, x: number, foot: number, lot: number, door?: { x: number; y: number }): boolean {
    const sz = SCENE_SIZES[id];
    if (!sz) return false;
    const [w, h] = sz, y = foot - h + 1, gate = id.includes("-gate-");
    if (x < 0 || y < 0 || x + w > this.W || foot >= this.H) return false;
    for (let yy = y; yy <= foot; yy++) for (let xx = x; xx < x + w; xx++) { const v = this.at(xx, yy); if (v !== Occ.Lot && v !== Occ.Walk) return false; }   // 길가에 선 키 큰 소품의 윗칸이 겹치는 것은 괜찮다(소품이 담 앞에 선다)
    for (let yy = y; yy <= foot; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * this.W + xx; this.drawn[i] = 1; this.occ[i] = gate && xx === x + 1 ? Occ.Walk : Occ.Wall; }
    this.walls.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: this.mapId, x, y }, optional: true, note: "kaki" });
    this.kaki.push({ id, x, y, w, h, gate, lot, ...(door ? { door } : {}) });
    return true;
  }
  /** 지나가는 문 키트(산몬 따위)를 발 줄 foot 에 찍는다 — pass 열은 걷는 칸, 나머지는 막힌 칸. */
  stampPassage(id: string, x: number, foot: number, pass: readonly number[]): boolean {
    const sz = SCENE_SIZES[id];
    if (!sz) return false;
    const [w, h] = sz, y = foot - h + 1;
    if (x < 0 || y < 0 || x + w > this.W || foot >= this.H) return false;
    for (let yy = y; yy <= foot; yy++) for (let xx = x; xx < x + w; xx++) { const v = this.at(xx, yy); if (this.drawn[yy * this.W + xx] || (v !== Occ.Lot && v !== Occ.Walk)) return false; }
    for (let yy = y; yy <= foot; yy++) for (let xx = x; xx < x + w; xx++) { const i = yy * this.W + xx; this.drawn[i] = 1; this.occ[i] = pass.includes(xx - x) ? Occ.Walk : Occ.Wall; }
    this.walls.push({ tool: "stamp_object", args: { objectId: `kit:jp_city/${id}`, mapId: this.mapId, x, y }, optional: true, note: "kaki" });
    return true;
  }
  /** 앞 건물의 오른쪽 처마 칸을 다음 건물이 덮었을 때 그 한 열을 4층에 되살린다. */
  restoreCol(p: ScenePlaced): void {
    if (p.kit) this.bldgs.push({ tool: "restore_col", args: { mapId: this.mapId, kit: p.kit.id, x: p.x + p.w - 1, y: p.y, col: p.w - 1 }, optional: true, note: "restore" });
  }

  steps(): JpStreetStep[] { return [...this.ground, ...this.marks, ...this.early, ...this.bldgs, ...this.walls, ...this.props, ...this.late]; }
}
