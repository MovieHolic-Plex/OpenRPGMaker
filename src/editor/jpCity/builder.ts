// 일본 도시(jp_city) 건물 조립기 — 가변 폭·층수 상가 건물을 부품 사전(src/assets/jpCityBuildingSpec.json)으로 조립한다.
// 순수 함수: 맵·타일셋·DOM 을 읽지 않는다. 맵에 대한 검사(문 앞 접근칸)는 선택 인자 world 로만 받는다.
//
// 조립 규칙의 정본은 scripts/content/jp-city/lib/jpstreet.py 의 Kit(band_cells · pieces · with_door · assemble · assemble_L)이다.
// 이 파일은 그것을 그대로 옮겼고, 같은 입력에서 칸 배열이 일치함을 scripts/content/jp-city/diff_builder.{py,mjs} 가 증명한다.
// 부품 사전은 scripts/content/jp-city/bake_spec.py 가 만든다(손 편집 금지).
//
//  입력   JpCityBuildingInput — x,y = 건물 발(왼쪽 아래 칸, 키트 앵커와 같다), w = 폭, floors = 윗층(위에서 아래 순), ground = 1층 종류 …
//  출력   JpCityBuildResult — assembled(Python Kit 과 같은 모양) · placements(칸마다 아래층/위층/덧층) · solid 격자 · 문·접근칸 · issues
//  층 규칙  에디터 위층은 3층(upperTiles)·4층(upperOverlayTiles) 둘뿐이라 한 칸에 [띠 + 부착물 하나]까지만 얹는다.
//          위 칸이 온전히 불투명이면 그 밑 칸은 안 보이므로 버린다(렌더 동일). 그래도 셋이 넘으면 DECO_CLASH.
//  통행   칸 번호가 통행을 정한다(막힘 칸 = spec.solid). 이 조립기는 칸마다 통행을 새로 정하지 않는다.
import spec from "@/assets/jpCityBuildingSpec.json";

type Tid = number | null;

export interface JpCityBand {
  readonly ko: string; readonly kind: "floor" | "roof" | "roofsign" | "terrace" | "ground" | "eave";
  readonly rows: number; readonly modw: number;
  readonly L: readonly Tid[]; readonly R: readonly (readonly Tid[])[];
  readonly mods: Readonly<Record<string, readonly (readonly Tid[])[]>>;
  readonly F: readonly Tid[] | null;
}
export interface JpCityDeco {
  readonly ko: string; readonly group: string; readonly groupKo: string; readonly w: number; readonly h: number;
  readonly cells: readonly (readonly Tid[])[]; readonly avoidsWindows: boolean;
}
export interface JpCityBuildingSpec {
  readonly version: number; readonly tileset: string; readonly tileSize: number; readonly tilesPerRow: number; readonly count: number;
  readonly limits: { readonly minWidth: number; readonly floorRows: number; readonly maxLayersOverBase: number };
  readonly walls: Readonly<Record<string, string>>;
  readonly floorKinds: Readonly<Record<string, { readonly ko: string; readonly walls: readonly string[]; readonly variants: readonly number[]; readonly modw: number }>>;
  readonly grounds: Readonly<Record<string, { readonly ko: string; readonly door: string; readonly modw: number; readonly variants: readonly number[] }>>;
  readonly roofs: Readonly<Record<string, { readonly ko: string; readonly pitched: boolean }>>;
  readonly heads: Readonly<Record<string, { readonly ko: string }>>;
  readonly eaves: Readonly<Record<string, { readonly ko: string }>>;
  readonly bands: Readonly<Record<string, JpCityBand>>;
  readonly decos: Readonly<Record<string, JpCityDeco>>;
  readonly doors: Readonly<Record<string, { readonly ko: string; readonly w: number; readonly h: number }>>;
  readonly doorDefault: Readonly<Record<string, string>>;
  readonly street: Readonly<Record<string, number>>;
  readonly yards: readonly string[];
  readonly lower: readonly number[]; readonly solid: readonly number[]; readonly opaque: readonly number[];
  readonly examples: Readonly<Record<string, { readonly ko: string; readonly input: unknown }>>;
}
export const JP_CITY_BUILDING_SPEC = spec as unknown as JpCityBuildingSpec;
export const JP_CITY_TILESET_ID = "jp_city";

const LOWER = new Set<number>(JP_CITY_BUILDING_SPEC.lower);
const SOLID = new Set<number>(JP_CITY_BUILDING_SPEC.solid);
const OPAQUE = new Set<number>(JP_CITY_BUILDING_SPEC.opaque);

// ───────────────────────────── 입력
export interface JpCityFloorInput {
  /** 층 띠 종류(slide·veranda·koushi·pairs·ribbon·curtain·balcony·tile·blank). band 를 주면 무시. */
  readonly kind?: string;
  /** 벽 재질(kinari·shiro·conc·hodo). 생략하면 건물 wall → kinari. curtain·tile 은 kinari 만 있다. */
  readonly wall?: string;
  /** 몸통 변형 번호 목록(칸 모듈마다 돌려 쓴다). 생략하면 [0]. */
  readonly variants?: readonly number[];
  /** 띠 id 를 직접 지정(예: fl.pairs.shiro). 층 띠가 아니면 FLOOR_PAIR / UNKNOWN_PART. */
  readonly band?: string;
}
export interface JpCityDecoInput {
  readonly deco: string;
  /** 건물 왼쪽 끝 기준 열(0부터). */
  readonly col: number;
  /** 윗층 번호(0 = 맨 위 윗층), "ground" = 1층, "head" = 맨 위 지붕 띠. */
  readonly floor: number | "ground" | "head";
  /** 그 띠 안에서 아래로 몇 줄 내릴지. */
  readonly row?: number;
  /** deco 가 `vstack.{c}` 처럼 {c} 를 쓸 때의 색 목록(층마다 돌려 쓴다). */
  readonly cols?: readonly string[];
}
export interface JpCityDoorInput { readonly type?: string; readonly col?: number }
export interface JpCitySetbackInput { readonly upper: number; readonly ins: number }
export interface JpCityWingInput {
  readonly w: number; readonly floors?: number | readonly JpCityFloorInput[]; readonly floorKind?: string; readonly wall?: string;
  readonly ground?: string; readonly shop?: string; readonly groundVariants?: readonly number[]; readonly door?: JpCityDoorInput | null;
  readonly roof?: string; readonly head?: string | null; readonly eave?: string | null; readonly setback?: JpCitySetbackInput;
  readonly decos?: readonly JpCityDecoInput[];
  /** 별채가 본채의 왼쪽(L)·오른쪽(R) 앞에 선다. 기본 L. */
  readonly side?: "L" | "R";
  /** 별채가 본채보다 앞(아래)으로 튀어나온 칸 수. 기본 2. */
  readonly depth?: number;
  /** 본채 앞 남는 땅: "lot"(주차장) 또는 거리 칸 이름(sw …, spec.yards). 기본 lot. */
  readonly yard?: string;
}
export interface JpCityBuildingInput {
  /** 건물 발(왼쪽 아래 칸)의 맵 좌표. 생략하면 (0, 높이-1) 즉 사각형이 (0,0)에서 시작. */
  readonly x?: number; readonly y?: number;
  readonly w: number;
  /** 윗층 수(숫자) 또는 층 목록(위에서 아래 순서). 기본 0. */
  readonly floors?: number | readonly JpCityFloorInput[];
  /** floors 가 숫자일 때 모든 층의 띠 종류. 기본 pairs. */
  readonly floorKind?: string;
  /** 모든 층의 기본 벽 재질. 기본 kinari. */
  readonly wall?: string;
  /** 1층 종류(gr.izakaya · gr.konbini.0|1 · gr.garage · gr.shutter.aka|sora|kii · gr.glass.aka|sora|kii · gr.machiya; `gr.` 생략 가능). */
  readonly ground?: string;
  /** ground 의 다른 이름(가게 종류). ground 가 있으면 무시. */
  readonly shop?: string;
  readonly groundVariants?: readonly number[];
  /** 문. 생략하면 1층 종류의 기본 문을 오른쪽 끝에. type:"none" 또는 null 이면 문 없음(오류 NO_DOOR). */
  readonly door?: JpCityDoorInput | null;
  /** 지붕 띠(roof.plain.tank … 또는 `roof.` 생략). head 가 있으면 head 가 지붕 자리를 대신한다. */
  readonly roof?: string;
  readonly head?: string | null;
  readonly eave?: string | null;
  readonly setback?: JpCitySetbackInput;
  readonly decos?: readonly JpCityDecoInput[];
  /** 있으면 L자(ㄱ) 건물: 이 입력이 본채, wing 이 앞으로 튀어나온 별채. */
  readonly wing?: JpCityWingInput;
}
export interface JpCityWorld {
  readonly width: number; readonly height: number;
  /** 이 건물을 찍기 전 맵에서 (x,y) 를 걸을 수 있는가. */
  readonly passable: (x: number, y: number) => boolean;
}
export interface JpCityBuildOptions { readonly world?: JpCityWorld; /** 문 앞에서 닿아야 하는 걸을 수 있는 칸 수(기본 6). */ readonly minReach?: number }

// ───────────────────────────── 출력
export type JpCityIssueCode =
  | "TOO_NARROW" | "ROOF_ORDER" | "FLOOR_PAIR" | "NO_DOOR" | "DOOR_NOT_BOTTOM" | "DOOR_BLOCKED" | "DECO_CLASH" | "UNKNOWN_PART"
  | "DOOR_OUT_OF_RANGE" | "DECO_OUT_OF_RANGE" | "OUT_OF_MAP" | "BAD_INPUT" | "SHADOW_OMITTED";
export interface JpCityIssue {
  readonly severity: "error" | "warning"; readonly code: JpCityIssueCode; readonly message: string;
  /** 맵 좌표(발 좌표가 정해져 있으면 그 기준). 건물 안 어느 칸 때문이면 그 칸, 아니면 발 칸. */
  readonly x?: number; readonly y?: number;
  /** 기계가 읽는 세부(DECO_CLASH: "window:<층>:<부착물>" · "overlap" · "layers"). */
  readonly detail?: string;
}
/** Python jpstreet.Kit.assemble / assemble_L 결과와 같은 모양(칸 번호만 이름 대신). 좌표는 건물 사각형 안(행, 열). */
export interface JpCityAssembled {
  readonly n: number; readonly rows: number;
  readonly cells: Tid[][];
  readonly deco: [number, number, number][];
  readonly walk: string[][];
  readonly layer: string[][];
  /** 단일 건물: 문 열 목록. L자: 빈 배열(doors 를 쓴다). */
  readonly doorCols: number[];
  /** 문 칸 (행, 열) — 막힘 칸이고, 바로 아래 한 줄이 접근 칸. */
  readonly doors: [number, number][];
  /** L자일 때 본채·별채가 이 사각형 안에서 시작하는 (행, 열). */
  readonly parts?: { readonly main: [number, number]; readonly wing: [number, number] };
  /** L자 별채 그림자(정본은 별채 오른쪽 5px 띠). 칸 번호로는 그릴 수 없어 생략한다. */
  readonly shadowCells: [number, number][];
}
export interface JpCityPlacement { readonly x: number; readonly y: number; readonly lower?: number; readonly upper?: number; readonly overlay?: number }
export interface JpCityBuildResult {
  readonly ok: boolean;
  readonly issues: JpCityIssue[];
  readonly rect: { readonly x0: number; readonly y0: number; readonly w: number; readonly h: number };
  readonly foot: { readonly x: number; readonly y: number };
  readonly assembled: JpCityAssembled | null;
  /** 칸마다 맵에 쓸 값(오류가 있어도 계산은 한다 — 도구는 ok 가 아니면 쓰지 않는다). */
  readonly placements: JpCityPlacement[];
  /** solid[행][열] = 이 칸 위의 칸 번호가 막힘인가(위층 중 막힘 칸이 하나라도 있으면). 칸이 비면 false. */
  readonly solid: boolean[][];
  /** 문 칸(맵 좌표)과 접근 칸(문 바로 아래 한 줄). */
  readonly doors: { readonly x: number; readonly y: number }[];
  readonly access: { readonly x: number; readonly y: number }[];
}

// ───────────────────────────── 이름 풀이
const first = (xs: readonly string[], n = 12): string => (xs.length > n ? `${xs.slice(0, n).join(", ")} … (${xs.length}종)` : xs.join(", "));

function findBand(prefix: string, id: string | null | undefined): { bid: string; band: JpCityBand } | null {
  if (!id) return null;
  for (const cand of [id, prefix + id]) {
    const band = JP_CITY_BUILDING_SPEC.bands[cand];
    if (band) return { bid: cand, band };
  }
  return null;
}
const bandIds = (kind: JpCityBand["kind"]): string[] => Object.entries(JP_CITY_BUILDING_SPEC.bands).filter(([, b]) => b.kind === kind).map(([id]) => id);

// ───────────────────────────── 정규화된 입력(한 채)
interface NormFloor { bid: string; vs: number[]; kind: string; wall: string; explicit: boolean }
interface NormDeco { name: string; col: number; floor: number | "ground" | "head"; row: number; src: string }
interface NormPiece { bid: string; nb: number; off: number; vs: number[]; kind: JpCityBand["kind"] }
interface Norm {
  n: number; pieces: NormPiece[]; floors: NormFloor[]; decos: NormDeco[]; door: { type: string; col: number; w: number } | null;
  setback: JpCitySetbackInput | null;
}
/** 조립 중 오류는 건물 안 좌표(열 lx, 행 ly)로 쌓았다가, 사각형 위치가 정해지면 맵 좌표로 바꾼다(finalizeIssues). */
interface RawIssue { severity: "error" | "warning"; code: JpCityIssueCode; message: string; lx?: number; ly?: number; part?: "main" | "wing"; detail?: string }
interface Ctx { issues: RawIssue[]; fx: number; fy: number; part?: "main" | "wing" }
const err = (c: Ctx, code: JpCityIssueCode, message: string, col?: number, row?: number, detail?: string): void => {
  c.issues.push({ severity: "error", code, message, lx: col, ly: row, part: c.part, ...(detail ? { detail } : {}) });
};
function finalizeIssues(raw: readonly RawIssue[], x0: number, y0: number, fx: number, fy: number, parts?: { main: [number, number]; wing: [number, number] }): JpCityIssue[] {
  return raw.map((i) => {
    const o = (i.part && parts ? parts[i.part] : [0, 0]) as [number, number];
    const x = i.lx !== undefined ? x0 + o[1] + i.lx : fx;
    const y = i.ly !== undefined ? y0 + o[0] + i.ly : fy;
    return { severity: i.severity, code: i.code, message: i.message, x, y, ...(i.detail ? { detail: i.detail } : {}) };
  });
}

function normalize(input: JpCityWingInput | JpCityBuildingInput, c: Ctx, label: string): Norm | null {
  const S = JP_CITY_BUILDING_SPEC;
  const before = c.issues.length;
  const n = input.w;
  if (!Number.isInteger(n) || n < 1 || n > 60) { err(c, "BAD_INPUT", `${label}폭 w 는 1~60 정수여야 한다(받은 값 ${String(n)})`); return null; }
  const minW = S.limits.minWidth;
  if (n < minW) err(c, "TOO_NARROW", `${label}폭 ${n}칸은 너무 좁다 — 띠는 왼쪽 끝 1 + 오른쪽 끝 2 = 최소 ${minW}칸`);

  // 층
  if (typeof input.floors === "number" && (!Number.isInteger(input.floors) || input.floors < 0 || input.floors > 30)) { err(c, "BAD_INPUT", `${label}floors 는 0~30 정수(받은 값 ${input.floors})`); return null; }
  const floorsRaw: readonly JpCityFloorInput[] = typeof input.floors === "number"
    ? Array.from({ length: input.floors }, () => ({ kind: input.floorKind ?? "pairs" }))
    : (input.floors ?? []);
  const floors: NormFloor[] = [];
  floorsRaw.forEach((f, i) => {
    let bid: string; let kind: string; let wall: string;
    if (f.band) {
      const hit = findBand("", f.band);
      if (!hit) { err(c, "UNKNOWN_PART", `${label}${i}번 층 띠 "${f.band}" 가 없다 — 층 띠: ${first(bandIds("floor"))}`); return; }
      bid = hit.bid; const p = bid.split("."); kind = p[0] === "fl" ? p[1]! : bid; wall = p[2] ?? "";
      if (hit.band.kind !== "floor" || hit.band.rows !== S.limits.floorRows) {
        err(c, "FLOOR_PAIR", `${label}${i}번 층 자리에 ${hit.bid}(${hit.band.kind}, ${hit.band.rows}줄) 가 왔다 — 한 층은 위·아래 ${S.limits.floorRows}줄 한 쌍인 층 띠(fl.*)여야 한다`);
        return;
      }
    } else {
      kind = f.kind ?? input.floorKind ?? "pairs";
      const fk = S.floorKinds[kind];
      if (!fk) { err(c, "UNKNOWN_PART", `${label}${i}번 층 종류 "${kind}" 가 없다 — 종류: ${Object.keys(S.floorKinds).join(", ")}`); return; }
      // 벽: 층에 적은 것 → (그 종류가 허용하면) 건물 wall → kinari. curtain·tile 은 kinari 한 가지뿐이라 건물 wall 이 shiro 여도 kinari.
      wall = f.wall ?? (input.wall && fk.walls.includes(input.wall) ? input.wall : "kinari");
      if (!fk.walls.includes(wall)) { err(c, "UNKNOWN_PART", `${label}${i}번 층: ${kind} 띠에는 벽 "${wall}" 가 없다 — 허용: ${fk.walls.join(", ")}`); return; }
      bid = `fl.${kind}.${wall}`;
    }
    const vs = f.variants && f.variants.length ? [...f.variants] : [0];
    floors.push({ bid, vs, kind, wall, explicit: !!f.band });
  });

  // 지붕·옥상 간판·처마·1층
  let roofBid: string | null = null; let roofKind: JpCityBand["kind"] = "roof";
  if (input.head) {
    const h = findBand("roofsign.", input.head);
    if (!h) err(c, "UNKNOWN_PART", `${label}옥상 간판 "${input.head}" 가 없다 — ${Object.keys(S.heads).join(", ")}`);
    else if (h.band.kind !== "roofsign") err(c, "ROOF_ORDER", `${label}head "${h.bid}" 는 옥상 간판 띠가 아니다 — 맨 위는 roofsign.* 또는 roof.* 여야 한다`);
    else { roofBid = h.bid; roofKind = "roofsign"; }
  } else if (input.roof) {
    const r = findBand("roof.", input.roof);
    if (!r) err(c, "UNKNOWN_PART", `${label}지붕 "${input.roof}" 가 없다 — ${first(Object.keys(S.roofs))}`);
    else if (r.band.kind !== "roof") err(c, "ROOF_ORDER", `${label}지붕 자리에 "${r.bid}"(${r.band.kind}) 가 왔다 — 건물 맨 위는 지붕 띠(roof.*)여야 한다`);
    else roofBid = r.bid;
  } else err(c, "ROOF_ORDER", `${label}지붕이 없다 — 건물 맨 위에 roof(또는 head) 가 있어야 한다: ${first(Object.keys(S.roofs))}`);
  let eaveBid: string | null = null;
  if (input.eave) {
    const e = findBand("eave.", input.eave) ?? findBand("", input.eave);
    if (!e) err(c, "UNKNOWN_PART", `${label}처마 "${input.eave}" 가 없다 — ${Object.keys(S.eaves).join(", ")}`);
    else if (e.band.kind !== "eave") err(c, "ROOF_ORDER", `${label}처마 자리에 "${e.bid}"(${e.band.kind}) 가 왔다 — eave 는 1층 바로 위 처마 띠여야 한다`);
    else eaveBid = e.bid;
  }
  const gIn = input.ground ?? input.shop;
  const g = gIn ? findBand("gr.", gIn) : null;
  if (!gIn) err(c, "UNKNOWN_PART", `${label}1층 종류(ground)가 없다 — ${Object.keys(S.grounds).join(", ")}`);
  else if (!g || g.band.kind !== "ground") err(c, "UNKNOWN_PART", `${label}1층 종류 "${gIn}" 가 없다 — ${Object.keys(S.grounds).join(", ")}`);
  const gvs = input.groundVariants && input.groundVariants.length ? [...input.groundVariants] : [0];

  // 셋백
  let setback: JpCitySetbackInput | null = null;
  if (input.setback) {
    const { upper, ins } = input.setback;
    if (!Number.isInteger(upper) || !Number.isInteger(ins) || upper < 0 || ins < 1) err(c, "BAD_INPUT", `${label}setback 은 upper≥0, ins≥1 정수`);
    else if (n - 2 * ins < minW) err(c, "TOO_NARROW", `${label}셋백 ins=${ins} 이면 윗층 폭이 ${n - 2 * ins}칸 — 최소 ${minW}칸이어야 한다`);
    else setback = { upper, ins };
  }
  if (c.issues.length > before) return null;

  // 문
  let door: Norm["door"] = null;
  const dIn = input.door;
  if (dIn === null || dIn?.type === "none") { err(c, "NO_DOOR", `${label}문이 없다 — 건물은 1층에 문이 하나 있어야 한다(door.type 은 ${first(Object.keys(S.doors))} 중 하나)`); return null; }
  else {
    const dt = (dIn?.type ?? S.doorDefault[g!.bid]!).replace(/^door\./, "");
    const dd = S.doors[dt];
    if (!dd) { err(c, "UNKNOWN_PART", `${label}문 "${dt}" 가 없다 — ${Object.keys(S.doors).join(", ")}`); return null; }
    if (n < dd.w) { err(c, "TOO_NARROW", `${label}문 ${dt} 는 폭 ${dd.w}칸 — 건물 폭 ${n}칸에 들어가지 않는다`); return null; }
    const col = dIn?.col ?? n - dd.w;
    if (!Number.isInteger(col) || col < 0 || col > n - dd.w) { err(c, "DOOR_OUT_OF_RANGE", `${label}문 열 ${String(col)} 이 건물 밖 — 0~${n - dd.w} (문 폭 ${dd.w})`); return null; }
    door = { type: dt, col, w: dd.w };
  }

  // 부착물(문 포함) 이름 풀이
  const nf = floors.filter((f) => f.bid.startsWith("fl.")).length;
  const decos: NormDeco[] = [];
  (input.decos ?? []).forEach((d, k) => {
    let dn = d.deco;
    if (dn === "fe") dn = d.floor === nf - 1 ? "fe_end" : "fe";
    if (dn.includes("{c}")) {
      if (!d.cols || !d.cols.length || typeof d.floor !== "number") { err(c, "BAD_INPUT", `${label}부착물 ${k} "${d.deco}" 는 cols(색 목록)와 정수 floor 가 필요하다`); return; }
      dn = dn.replace("{c}", d.cols[d.floor % d.cols.length]!);
    }
    if (!S.decos[dn]) { err(c, "UNKNOWN_PART", `${label}부착물 "${dn}" 가 없다 — list_jp_city_building_parts 로 id 를 찾는다`, d.col); return; }
    decos.push({ name: dn, col: d.col, floor: d.floor, row: d.row ?? 0, src: d.deco });
  });
  if (c.issues.length > before) return null;

  // 띠 순서(Python Kit.pieces)
  const pieces: NormPiece[] = [];
  const ub = setback ? n - 2 * setback.ins : n;
  const ins = setback ? setback.ins : 0;
  pieces.push({ bid: roofBid!, nb: setback ? ub : n, off: setback ? ins : 0, vs: [0], kind: roofKind });
  floors.forEach((f, i) => {
    if (setback && i === setback.upper) pieces.push({ bid: "terrace", nb: n, off: 0, vs: [0], kind: "terrace" });
    const up = !!setback && i < setback.upper;
    pieces.push({ bid: f.bid, nb: up ? ub : n, off: up ? ins : 0, vs: f.vs, kind: S.bands[f.bid]!.kind });
  });
  if (eaveBid) pieces.push({ bid: eaveBid, nb: n, off: 0, vs: [0], kind: "eave" });
  pieces.push({ bid: g!.bid, nb: n, off: 0, vs: gvs, kind: "ground" });
  // 몸통 변형은 실제로 쓰이는 칸 모듈 몫만 본다(Python Kit 은 안 쓰이는 변형 번호를 읽지 않는다 — 카탈로그 예제 izakaya_tower 가 그렇다).
  for (const p of pieces) {
    const band = S.bands[p.bid]!;
    const used = Math.floor((p.nb - 3) / band.modw);
    for (let k = 0; k < used; k++) {
      const v = p.vs[k % p.vs.length]!;
      if (!(String(v) in band.mods)) { err(c, "UNKNOWN_PART", `${label}${p.bid} 에 몸통 변형 ${v} 가 없다 — 허용: ${Object.keys(band.mods).join(", ")}`); return null; }
    }
  }
  return { n, pieces, floors, decos, door, setback };
}

// ───────────────────────────── Kit.band_cells
function bandCells(band: JpCityBand, nb: number, vs: readonly number[]): Tid[][] {
  const { rows, modw } = band;
  const g: Tid[][] = Array.from({ length: rows }, () => new Array<Tid>(nb).fill(null));
  const m = nb - 3, cnt = Math.floor(m / modw);
  for (let r = 0; r < rows; r++) { g[r]![0] = band.L[r]!; g[r]![nb - 2] = band.R[0]![r]!; g[r]![nb - 1] = band.R[1]![r]!; }
  for (let k = 0; k < cnt; k++) {
    const mods = band.mods[String(vs[k % vs.length]!)]!;
    for (let j = 0; j < modw; j++) for (let r = 0; r < rows; r++) g[r]![1 + k * modw + j] = mods[j]![r]!;
  }
  for (let col = 1 + cnt * modw; col < nb - 2; col++) for (let r = 0; r < rows; r++) g[r]![col] = band.F![r]!;
  return g;
}

interface Meta { r0: number; rows: number; bid: string; off: number; nb: number; kind: JpCityBand["kind"] }

// ───────────────────────────── Kit.assemble (+ 검사)
function assembleOne(nm: Norm, c: Ctx, label: string): JpCityAssembled | null {
  const S = JP_CITY_BUILDING_SPEC;
  const { n } = nm;
  const decoReq: NormDeco[] = [...nm.decos, { name: `door.${nm.door!.type}`, col: nm.door!.col, floor: "ground", row: 0, src: "door" }];
  const grid: Tid[][] = []; const meta: Meta[] = [];
  for (const p of nm.pieces) {
    const band = S.bands[p.bid]!;
    const g = bandCells(band, p.nb, p.vs); const r0 = grid.length;
    for (const row of g) grid.push([...new Array<Tid>(p.off).fill(null), ...row, ...new Array<Tid>(n - p.off - p.nb).fill(null)]);
    meta.push({ r0, rows: g.length, bid: p.bid, off: p.off, nb: p.nb, kind: band.kind });
  }
  const R = grid.length;
  const floorMeta = meta.filter((m) => m.bid.startsWith("fl."));
  const nf = floorMeta.length;
  const deco: [number, number, number][] = [];
  const decoOwner: string[] = [];

  decoReq.forEach((d, k) => {
    const D = S.decos[d.name]!;
    let r0: number;
    if (d.floor === "head") r0 = meta[0]!.r0;
    else if (d.floor === "ground") r0 = meta[meta.length - 1]!.r0;
    else if (Number.isInteger(d.floor) && d.floor >= 0 && d.floor < nf) r0 = floorMeta[d.floor]!.r0;
    else { err(c, "DECO_OUT_OF_RANGE", `${label}부착물 ${d.name}: ${String(d.floor)}번 층이 없다(윗층 ${nf}개, "ground"·"head" 도 쓸 수 있다)`, d.col); return; }
    const top = r0 + d.row;
    if (d.col < 0 || d.col + D.w > n || top < 0 || top + D.h > R) { err(c, "DECO_OUT_OF_RANGE", `${label}부착물 ${d.name}(${D.w}×${D.h}) 가 건물 사각형(${n}×${R}) 밖 — 열 ${d.col}, 줄 ${top}`, d.col); return; }
    for (let rr = 0; rr < D.h; rr++) for (let cc = 0; cc < D.w; cc++) {
      const t = D.cells[rr]![cc]!;
      if (t !== null) { deco.push([top + rr, d.col + cc, t]); decoOwner.push(`${k}:${d.name}`); }
    }
  });

  const walk: string[][] = Array.from({ length: R }, () => new Array<string>(n).fill("C"));
  const layer: string[][] = Array.from({ length: R }, () => new Array<string>(n).fill("up"));
  const gr = meta[meta.length - 1]!.r0;
  for (const r of [gr + 1, gr + 2]) for (let col = 0; col < n; col++) { walk[r]![col] = "S"; layer[r]![col] = "lo"; }
  const { col: dc0, w: dw } = nm.door!;
  const dcols = Array.from({ length: dw }, (_, i) => dc0 + i);
  for (const col of dcols) walk[gr + 2]![col] = "F";
  const asm: JpCityAssembled = { n, rows: R, cells: grid, deco, walk, layer, doorCols: dcols, doors: dcols.map((col) => [R - 1, col] as [number, number]), shadowCells: [] };

  checkStructure(asm, meta, c, label);
  checkDecoWindows(nm, floorMeta, c, label);
  checkDecoOverlap(deco, decoOwner, c, label);
  return asm;
}

/** 구조 검사 — atlas-modern bldg.check 의 ROOF_ORDER·FLOOR_PAIR·NO_DOOR·DOOR_NOT_BOTTOM 에 해당(띠 문법으로 옮김). 맵 좌표가 아니라 건물 안 좌표. */
function checkStructure(asm: JpCityAssembled, meta: readonly Meta[], c: Ctx, label: string): void {
  const S = JP_CITY_BUILDING_SPEC;
  const head = meta[0]!, last = meta[meta.length - 1]!;
  if (head.kind !== "roof" && head.kind !== "roofsign") err(c, "ROOF_ORDER", `${label}맨 위 띠가 지붕이 아니다(${head.bid})`);
  if (last.kind !== "ground") err(c, "ROOF_ORDER", `${label}맨 아래 띠가 1층이 아니다(${last.bid})`);
  meta.forEach((m, i) => {
    if (m.kind === "eave" && i !== meta.length - 2) err(c, "ROOF_ORDER", `${label}처마 ${m.bid} 는 1층 바로 위에만 온다`);
    if (m.kind === "roof" && i !== 0) err(c, "ROOF_ORDER", `${label}지붕 ${m.bid} 는 맨 위에만 온다`);
    if (m.kind === "floor") {
      const band = S.bands[m.bid]!;
      if (band.rows !== S.limits.floorRows) err(c, "FLOOR_PAIR", `${label}층 띠 ${m.bid} 가 ${band.rows}줄 — 한 층은 위·아래 ${S.limits.floorRows}줄 한 쌍이어야 한다`);
      for (let r = 0; r < m.rows; r++) for (let col = m.off; col < m.off + m.nb; col++) {
        if (asm.cells[m.r0 + r]![col] === null) { err(c, "FLOOR_PAIR", `${label}층 띠 ${m.bid} 의 ${r + 1}번째 줄 ${col}열이 비었다 — 한 층의 위·아래 줄이 다 차야 한다`, col, m.r0 + r); r = m.rows; break; }
      }
    }
  });
}

/** gen.lint_specs 와 같은 규칙: 창 위에 얹으면 안 되는 부착물(간판·차양·실외기·빨래·광고·무시코)이 창 칸에 걸리는가. */
function checkDecoWindows(nm: Norm, floorMeta: readonly Meta[], c: Ctx, label: string): void {
  const S = JP_CITY_BUILDING_SPEC;
  const st = nm.setback;
  for (const d of nm.decos) {
    if (typeof d.floor !== "number") continue;
    const D = S.decos[d.name]!;
    if (!D.avoidsWindows) continue;
    const f = nm.floors[d.floor];
    if (!f) continue;
    if (f.explicit) continue;                                           // 띠를 직접 고른 층은 종류를 모른다(Python 도 kind 로만 본다)
    const mw = S.bands[f.bid]!.modw;
    const off = st && d.floor < st.upper ? st.ins : 0;
    for (let cc = 0; cc < D.w; cc++) {
      const col = d.col + cc - off - 1;
      if (col < 0 || col >= nm.n - 2 * off - 3) continue;
      const v = f.vs[Math.floor(col / mw) % f.vs.length]!;
      if (f.kind === "blank" || (f.kind === "pairs" && (v & 2))) continue;
      err(c, "DECO_CLASH", `${label}부착물 ${d.name} 이(가) ${d.floor}번 층 창 위에 얹힌다(열 ${d.col + cc}) — 간판·차양·실외기·빨래·광고는 민벽(blank)이나 창이 없는 칸에만 붙는다`, d.col + cc, floorMeta[d.floor]!.r0 + d.row, `window:${d.floor}:${d.name}`);
      break;
    }
  }
}

/** 부착물끼리 같은 칸을 덮는가 — 에디터 위층이 2장이라 [띠 + 부착물 하나]까지만 된다. */
function checkDecoOverlap(deco: readonly [number, number, number][], owner: readonly string[], c: Ctx, label: string): void {
  const seen = new Map<string, string>();
  deco.forEach(([r, col], i) => {
    const key = `${r},${col}`; const had = seen.get(key); const me = owner[i]!;
    if (had !== undefined && had !== me) err(c, "DECO_CLASH", `${label}부착물 ${had.split(":")[1]} 와 ${me.split(":")[1]} 가 같은 칸(열 ${col}, 줄 ${r})을 덮는다 — 위층이 둘뿐이라 한 칸에 부착물은 하나만`, col, r, "overlap");
    seen.set(key, me);
  });
}

// ───────────────────────────── Kit.assemble_L
function assembleL(main: JpCityAssembled, wing: JpCityAssembled, wi: JpCityWingInput, c: Ctx): JpCityAssembled | null {
  const S = JP_CITY_BUILDING_SPEC;
  const side = wi.side ?? "L"; const d = wi.depth ?? 2; const yard = wi.yard ?? "lot";
  const n = main.n, k = wing.n;
  if (side !== "L" && side !== "R") { err(c, "BAD_INPUT", `wing.side 는 L 또는 R(받은 값 ${String(side)})`); return null; }
  if (!Number.isInteger(d) || d < 1 || d > 12) { err(c, "BAD_INPUT", `wing.depth 는 1~12 정수(받은 값 ${String(d)})`); return null; }
  if (k > n - 2) { err(c, "TOO_NARROW", `별채 폭 ${k}칸이 본채 폭 ${n}칸 - 2 보다 넓다 — 본채 문·벽이 가려진다`); return null; }
  if (yard !== "lot" && !S.yards.includes(yard)) { err(c, "UNKNOWN_PART", `마당 "${yard}" 는 쓸 수 없다 — lot 또는 ${first(S.yards)}`); return null; }
  const off = side === "L" ? 0 : n - k;
  const R = Math.max(main.rows + d, wing.rows), rM = R - d - main.rows, rW = R - wing.rows;
  const grid: Tid[][] = Array.from({ length: R }, () => new Array<Tid>(n).fill(null));
  const walk: string[][] = Array.from({ length: R }, () => new Array<string>(n).fill("C"));
  const layer: string[][] = Array.from({ length: R }, () => new Array<string>(n).fill("up"));
  for (let r = 0; r < main.rows; r++) for (let col = 0; col < n; col++) { grid[rM + r]![col] = main.cells[r]![col]!; walk[rM + r]![col] = main.walk[r]![col]!; layer[rM + r]![col] = main.layer[r]![col]!; }
  const over: [number, number, number][] = main.deco.map(([r, col, t]) => [rM + r, col, t]);
  for (let r = 0; r < wing.rows; r++) for (let col = 0; col < k; col++) {
    const t = wing.cells[r]![col]!;
    if (t !== null) over.push([rW + r, off + col, t]);
    walk[rW + r]![off + col] = wing.walk[r]![col]!; layer[rW + r]![off + col] = wing.layer[r]![col]!;
  }
  for (const [r, col, t] of wing.deco) over.push([rW + r, off + col, t]);
  for (let r = R - d; r < R; r++) for (let col = 0; col < n; col++) {
    if (col >= off && col < off + k) continue;
    let tid: number;
    if (yard === "lot") {
      const base = side === "L" ? off + k : 0;
      const nmk = (((col - base) % 3) + 3) % 3 === 0 ? (r === R - d ? "lot_stop" : "lot_line") : "lot";
      tid = S.street[nmk]!;
    } else tid = S.street[yard]!;
    grid[r]![col] = tid; walk[r]![col] = "F"; layer[r]![col] = "lo";
  }
  const doors: [number, number][] = [...main.doorCols.map((col) => [rM + main.rows - 1, col] as [number, number]), ...wing.doorCols.map((col) => [rW + wing.rows - 1, off + col] as [number, number])];
  // 본채 문이 별채에 가려지면 안 된다(Python 은 assert 로 막는다)
  for (const col of main.doorCols) {
    if (col >= off && col < off + k && rW <= rM + main.rows - 1) { err(c, "DOOR_BLOCKED", `본채 문(열 ${col})이 별채(열 ${off}~${off + k - 1})에 가려진다 — 문을 별채 반대쪽으로 옮기거나 별채를 좁힌다`, col, rM + main.rows - 1); break; }
  }
  const shadowCells: [number, number][] = [];
  if (side === "L") for (let r = rW; r < rM + main.rows; r++) shadowCells.push([r, k]);
  return { n, rows: R, cells: grid, deco: over, walk, layer, doorCols: [], doors, shadowCells, parts: { main: [rM, 0], wing: [rW, off] } };
}

// ───────────────────────────── 칸 층 배정(렌더 동일 축소)
interface CellLayers { lower: number | null; up: number[]; overflow: boolean }
function cellLayers(a: JpCityAssembled): CellLayers[][] {
  const chains: number[][][] = Array.from({ length: a.rows }, (_, r) => Array.from({ length: a.n }, (_, col) => { const t = a.cells[r]![col]!; return t === null ? [] : [t]; }));
  for (const [r, col, t] of a.deco) chains[r]![col]!.push(t);
  return chains.map((row) => row.map((chain) => {
    let lower: number | null = null; let up: number[] = [];
    for (const t of chain) { if (LOWER.has(t)) { lower = t; up = []; } else up.push(t); }
    let cut = 0;
    up.forEach((t, i) => { if (OPAQUE.has(t)) cut = i; });
    up = up.slice(cut);
    return { lower, up, overflow: up.length > JP_CITY_BUILDING_SPEC.limits.maxLayersOverBase + 1 };
  }));
}

// ───────────────────────────── 맵 검사: 문 앞 접근칸
function reachCount(start: { x: number; y: number }, passable: (x: number, y: number) => boolean, limit: number): number {
  const seen = new Set<number>([start.y * 100000 + start.x]); const q = [start];
  while (q.length && seen.size < limit) {
    const p = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx, y = p.y + dy; const key = y * 100000 + x;
      if (seen.has(key) || !passable(x, y)) continue;
      seen.add(key); q.push({ x, y });
    }
  }
  return seen.size;
}

// ───────────────────────────── 공개 진입점
export function buildJpCityBuilding(input: JpCityBuildingInput, options: JpCityBuildOptions = {}): JpCityBuildResult {
  const raw: RawIssue[] = [];
  const fx0 = input.x ?? 0, fy0 = input.y ?? 0;
  const c: Ctx = { issues: raw, fx: fx0, fy: fy0 };
  const fail = (): JpCityBuildResult => ({
    ok: false, issues: finalizeIssues(raw, fx0, fy0, fx0, fy0), rect: { x0: fx0, y0: fy0, w: Math.max(0, Math.trunc(Number(input.w)) || 0), h: 0 },
    foot: { x: fx0, y: fy0 }, assembled: null, placements: [], solid: [], doors: [], access: [],
  });
  if ((input.x !== undefined && !Number.isInteger(input.x)) || (input.y !== undefined && !Number.isInteger(input.y))) { err(c, "BAD_INPUT", "x·y 는 정수"); return fail(); }

  const lShape = !!input.wing;
  c.part = lShape ? "main" : undefined;
  const mainN = normalize(input, c, lShape ? "본채: " : "");
  c.part = lShape ? "wing" : undefined;
  const wingN = input.wing ? normalize(input.wing, c, "별채: ") : null;
  if (!mainN || (lShape && !wingN)) return fail();
  c.part = lShape ? "main" : undefined;
  let asm = assembleOne(mainN, c, lShape ? "본채: " : "");
  if (asm && wingN) {
    c.part = "wing";
    const wasm = assembleOne(wingN, c, "별채: ");
    c.part = undefined;
    asm = wasm ? assembleL(asm, wasm, input.wing!, c) : null;
  }
  if (!asm) return fail();

  const R = asm.rows, n = asm.n;
  const fx = input.x ?? 0, fy = input.y ?? R - 1;
  const x0 = fx, y0 = fy - (R - 1);
  const rect = { x0, y0, w: n, h: R };
  const issues = finalizeIssues(raw, x0, y0, fx, fy, asm.parts);
  if (asm.shadowCells.length) issues.push({ severity: "warning", code: "SHADOW_OMITTED", message: `L자 별채의 그림자(별채 오른쪽 5px 띠)는 칸 번호로 그릴 수 없어 생략한다 — 그림자 칸 ${asm.shadowCells.length}개`, x: fx, y: fy });
  const overlapAt = new Set(issues.filter((i) => i.detail === "overlap").map((i) => `${i.x},${i.y}`));

  // 칸 층 배정 + 겹침 한계
  const layers = cellLayers(asm);
  const placements: JpCityPlacement[] = []; const solid: boolean[][] = [];
  for (let r = 0; r < R; r++) {
    const srow: boolean[] = [];
    for (let col = 0; col < n; col++) {
      const L = layers[r]![col]!;
      srow.push(L.up.some((t) => SOLID.has(t)));
      if (L.overflow && !overlapAt.has(`${x0 + col},${y0 + r}`)) issues.push({ severity: "error", code: "DECO_CLASH", message: `(${x0 + col},${y0 + r}) 에 위층 칸이 ${L.up.length}장 겹친다(${L.up.join("+")}) — 에디터 위층은 2장(띠 + 부착물 하나)뿐이다`, x: x0 + col, y: y0 + r, detail: "layers" });
      if (L.lower === null && L.up.length === 0) continue;
      const p: { x: number; y: number; lower?: number; upper?: number; overlay?: number } = { x: x0 + col, y: y0 + r };
      if (L.lower !== null) p.lower = L.lower;
      if (L.up[0] !== undefined) p.upper = L.up[0];
      if (L.up[1] !== undefined) p.overlay = L.up[1];
      placements.push(p);
    }
    solid.push(srow);
  }
  const doors = asm.doors.map(([r, col]) => ({ x: x0 + col, y: y0 + r }));
  const access = asm.doors.map(([r, col]) => ({ x: x0 + col, y: y0 + r + 1 }));

  const world = options.world;
  if (world) {
    if (x0 < 0 || y0 < 0 || x0 + n > world.width || y0 + R > world.height) {
      issues.push({ severity: "error", code: "OUT_OF_MAP", message: `건물 사각형 (${x0},${y0})~(${x0 + n - 1},${y0 + R - 1}) 이 맵(${world.width}×${world.height}) 밖으로 나간다`, x: fx, y: fy });
    }
    const minReach = options.minReach ?? 6;
    const own = (x: number, y: number): boolean | null => {
      const r = y - y0, col = x - x0;
      if (r < 0 || col < 0 || r >= R || col >= n) return null;
      const L = layers[r]![col]!;
      if (L.lower === null && L.up.length === 0) return null;
      return !L.up.some((t) => SOLID.has(t));
    };
    const pass = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= world.width || y >= world.height) return false;
      return own(x, y) ?? world.passable(x, y);
    };
    for (const a of access) {
      if (a.x < 0 || a.y < 0 || a.x >= world.width || a.y >= world.height) { issues.push({ severity: "error", code: "DOOR_BLOCKED", message: `문 앞 접근칸 (${a.x},${a.y}) 이 맵 밖 — 건물 아래에 한 줄 이상 남겨야 한다`, x: a.x, y: a.y }); continue; }
      if (!pass(a.x, a.y)) { issues.push({ severity: "error", code: "DOOR_BLOCKED", message: `문 앞 접근칸 (${a.x},${a.y}) 을 걸을 수 없다 — 문 앞에 보도·도로 같은 바닥을 먼저 깐다`, x: a.x, y: a.y }); continue; }
      const got = reachCount(a, pass, minReach);
      if (got < minReach) issues.push({ severity: "error", code: "DOOR_BLOCKED", message: `문 앞 접근칸 (${a.x},${a.y}) 에서 걸어갈 수 있는 칸이 ${got}개뿐(최소 ${minReach}) — 문 앞이 막혀 고립됐다`, x: a.x, y: a.y });
    }
  }
  return { ok: !issues.some((i) => i.severity === "error"), issues, rect, foot: { x: fx, y: fy }, assembled: asm, placements, solid, doors, access };
}

/** 이미 조립된 건물 배열(Python Kit 과 같은 모양)에 구조 검사만 다시 돌린다 — 변조 시험용. 좌표는 건물 안 (열, 행). */
export function checkJpCityStructure(asm: JpCityAssembled, meta: readonly { r0: number; rows: number; bid: string; off: number; nb: number }[]): JpCityIssue[] {
  const S = JP_CITY_BUILDING_SPEC;
  const raw: RawIssue[] = []; const c: Ctx = { issues: raw, fx: 0, fy: 0 };
  const metas: Meta[] = meta.map((m) => ({ ...m, kind: S.bands[m.bid]!.kind }));
  checkStructure(asm, metas, c, "");
  if (!asm.doors.length) err(c, "NO_DOOR", "건물에 문 칸이 없다");
  for (const [r, col] of asm.doors) if (r !== asm.rows - 1) err(c, "DOOR_NOT_BOTTOM", `문 칸(${col},${r}) 이 건물 맨 아래 줄이 아니다 — 길에서 닿을 수 없다`, col, r);
  return finalizeIssues(raw, 0, 0, 0, 0);
}

/** 띠 메타(Python Kit.assemble 의 meta)를 입력에서 다시 계산한다 — checkJpCityStructure 와 짝. */
export function jpCityBandMeta(input: JpCityBuildingInput): { r0: number; rows: number; bid: string; off: number; nb: number }[] | null {
  const c: Ctx = { issues: [], fx: 0, fy: 0 };
  const nm = normalize(input, c, "");
  if (!nm) return null;
  const out: { r0: number; rows: number; bid: string; off: number; nb: number }[] = []; let r0 = 0;
  for (const p of nm.pieces) { const rows = JP_CITY_BUILDING_SPEC.bands[p.bid]!.rows; out.push({ r0, rows, bid: p.bid, off: p.off, nb: p.nb }); r0 += rows; }
  return out;
}

/** 오류 코드 → 뜻(도구 설명·문서용). */
export const JP_CITY_ISSUE_CODES: Readonly<Record<JpCityIssueCode, string>> = {
  TOO_NARROW: "폭이 최소(3칸)·문 폭·셋백·별채보다 좁다",
  ROOF_ORDER: "맨 위가 지붕 띠가 아니거나, 처마가 1층 바로 위가 아니다(지붕·처마 자리에 엉뚱한 띠)",
  FLOOR_PAIR: "한 층이 위·아래 2줄 한 쌍으로 채워지지 않았다",
  NO_DOOR: "문이 없다(door.type none/null 포함)",
  DOOR_NOT_BOTTOM: "문이 건물 맨 아래 줄에 있지 않다(길에서 닿을 수 없다)",
  DOOR_BLOCKED: "문 앞 접근칸(문 바로 아래 한 줄)이 맵 밖이거나 걸을 수 없거나 고립됐다 / 본채 문이 별채에 가려졌다",
  DECO_CLASH: "부착물이 창 위에 얹히거나, 부착물끼리 같은 칸을 덮거나, 한 칸에 위층 칸이 3장 이상 겹친다",
  UNKNOWN_PART: "사전에 없는 부품 id(층 종류·벽·변형·지붕·처마·1층·문·부착물·마당)",
  DOOR_OUT_OF_RANGE: "문 열이 건물 밖이다",
  DECO_OUT_OF_RANGE: "부착물이 건물 사각형 밖이거나 없는 층을 가리킨다",
  OUT_OF_MAP: "건물 사각형이 맵 밖으로 나간다",
  BAD_INPUT: "숫자·필드 형식이 틀렸다",
  SHADOW_OMITTED: "(경고) L자 별채 그림자는 칸 번호로 그릴 수 없어 생략",
};
