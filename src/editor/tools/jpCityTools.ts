// 일본 도시(jp_city) 건물 조립 도구(M3) — 가변 폭·층수 상가 건물을 부품 사전으로 조립해 jp_city 맵에 찍는다.
//   list_jp_city_building_parts : 부품 사전(층 종류·벽·1층·지붕·문·부착물·완성 예제)과 조립 규칙
//   build_jp_city_building      : 건물 하나(또는 L자) → 맵의 3층(upperTiles)·4층(upperOverlayTiles)에 찍는다. 오류가 있으면 맵을 바꾸지 않는다.
// 조립 규칙은 src/editor/jpCity/builder.ts(순수 함수), 부품 사전은 src/assets/jpCityBuildingSpec.json(bake_spec.py 가 만든다).
// 칩셋 계열: oprn-jp 의 번들 jp_city 맵에서만 동작한다.
import {
  buildJpCityBuilding, JP_CITY_BUILDING_SPEC as SPEC, JP_CITY_ISSUE_CODES,
  type JpCityBuildingInput, type JpCityDecoInput, type JpCityFloorInput, type JpCityIssue, type JpCityWingInput,
} from "@/editor/jpCity/builder";
import { isPassable } from "@/project/collision";
import { LINK_JP_CITY_INTERIOR_TOOL } from "./jpCityInteriorLink";
import { isJpCityTileset, JP_CITY_FAMILY, JP_CITY_ID } from "@/project/defaults/jpCity";
import { setLayerTileAt } from "@/project/mapLayers";
import { clearTileStack } from "@/project/mapOverlayTiles";
import type { GameMap, Project } from "@/project/types";
import { inMapBounds, requireMap, setLower } from "./mapHelpers";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

const first = (xs: readonly string[], n = 14): string => (xs.length > n ? `${xs.slice(0, n).join(", ")} …(${xs.length}종)` : xs.join(", "));

/** 사전의 예제 입력(조립기 모양: floors 배열·floor 숫자) → 도구 인자 모양(floorPlan·floor 문자열). */
export function exampleToToolArgs(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "floors" && Array.isArray(v)) out.floorPlan = v;
    else if (k === "floors") out.floors = v;
    else if (k === "decos" && Array.isArray(v)) out.decos = (v as { floor: unknown }[]).map((d) => ({ ...d, floor: String(d.floor) }));
    else if (k === "wing" && v && typeof v === "object") out.wing = exampleToToolArgs(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

// ───────────────────────────── 읽기 도구
export const LIST_JP_CITY_BUILDING_PARTS_TOOL: ToolDefinition = {
  name: "list_jp_city_building_parts",
  mode: "read",
  domains: ["tile", "map"],
  description: "일본 도시(jp_city) 건물 부품 사전 — build_jp_city_building 에 넣는 id 를 찾는다. 인자 없이 → 층 종류·벽 재질·1층 종류·지붕·옥상 간판·처마·문 9종·부착물 분류·완성 예제 목록과 조립 규칙. "
    + "query(낱말, 한국어·영어 id) → 부착물(간판·차양·실외기·비상계단 등 73종) 검색. example(예제 이름) → 그 완성 예제의 입력(x,y 만 더해 build_jp_city_building 에 그대로 넣는다). "
    + "건물은 낱칸으로 칠하지 말고 build_jp_city_building 으로 짓는다.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "부착물 검색 낱말(예: 간판, sign_h, 차양, 비상계단, door)" },
      example: { type: "string", description: "완성 예제 이름(인자 없이 불러 목록을 본다). 예: konbini_block, izakaya_tower, L_office_cafe" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
    additionalProperties: false,
  },
  run(_project, args): ToolExecResult {
    const q = typeof args.query === "string" ? args.query.trim() : "";
    const ex = typeof args.example === "string" ? args.example.trim() : "";
    const limit = typeof args.limit === "number" ? args.limit : 40;
    if (ex) {
      const hit = SPEC.examples[ex];
      if (!hit) throw new ToolError(`완성 예제 '${ex}' 가 없다 — ${first(Object.keys(SPEC.examples), 40)}`, { code: "unknown-example" });
      return { summary: `예제 ${ex}(${hit.ko}) — args 에 mapId·x·y(발 = 왼쪽 아래 칸)를 더해 build_jp_city_building 에 그대로 넣는다. 일부 예제는 에디터 층 한계(DECO_CLASH)로 이 도구가 거부한다: machiya_izakaya · L_machiya_annex · L_flats_lot — 그 셋은 같은 모양의 완성 키트를 stamp_object({objectId:\"kit:jp_city/jp-recipe-machiya-izakaya\"(또는 jp-recipe-l-machiya-annex · jp-recipe-l-flats-lot), mapId, x, y(왼쪽 위 칸)}) 로 찍는다.`, data: { example: ex, ko: hit.ko, args: exampleToToolArgs(hit.input as Record<string, unknown>) } };
    }
    if (q) {
      const toks = q.toLowerCase().split(/\s+/u).filter(Boolean);
      const rows = Object.entries(SPEC.decos).filter(([id, d]) => toks.every((t) => id.toLowerCase().includes(t) || d.ko.includes(t) || d.groupKo.includes(t) || d.group.includes(t)))
        .slice(0, limit).map(([id, d]) => ({ id, ko: d.ko, group: d.group, w: d.w, h: d.h, avoidsWindows: d.avoidsWindows }));
      return { summary: `부착물 ${rows.length}종(낱말 "${q}")`, data: { decos: rows } };
    }
    const groups = new Map<string, { ko: string; count: number; examples: string[]; w: number; h: number; avoidsWindows: boolean }>();
    for (const [id, d] of Object.entries(SPEC.decos)) {
      const g = groups.get(d.group) ?? { ko: d.groupKo, count: 0, examples: [], w: d.w, h: d.h, avoidsWindows: d.avoidsWindows };
      g.count++; if (g.examples.length < 3) g.examples.push(id); groups.set(d.group, g);
    }
    return {
      summary: `건물 부품: 층 종류 ${Object.keys(SPEC.floorKinds).length} · 벽 ${Object.keys(SPEC.walls).length} · 1층 ${Object.keys(SPEC.grounds).length} · 지붕 ${Object.keys(SPEC.roofs).length} · 옥상 간판 ${Object.keys(SPEC.heads).length} · 문 ${Object.keys(SPEC.doors).length} · 부착물 ${Object.keys(SPEC.decos).length} · 완성 예제 ${Object.keys(SPEC.examples).length}`,
      data: {
        tilesetId: JP_CITY_ID,
        coordinate: "x,y = 건물 발(왼쪽 아래 칸). 사각형은 (x, y-높이+1)~(x+w-1, y). 문 앞 접근칸 = 문 바로 아래 한 줄(y+1) — 걸을 수 있는 보도·도로여야 한다.",
        floors: "floors 는 윗층 수(숫자) 또는 floorPlan(위에서 아래 순서 목록). 한 층 = 위·아래 2줄. 맨 위 층이 floorPlan[0].",
        walls: SPEC.walls,
        floorKinds: Object.entries(SPEC.floorKinds).map(([id, f]) => ({ id, ko: f.ko, walls: f.walls, variants: f.variants })),
        grounds: Object.entries(SPEC.grounds).map(([id, g]) => ({ id, ko: g.ko, defaultDoor: g.door, variants: g.variants })),
        roofs: Object.entries(SPEC.roofs).map(([id, r]) => ({ id, ko: r.ko, pitched: r.pitched })),
        heads: Object.entries(SPEC.heads).map(([id, h]) => ({ id, ko: h.ko })),
        eaves: Object.entries(SPEC.eaves).map(([id, e]) => ({ id, ko: e.ko })),
        doors: Object.entries(SPEC.doors).map(([id, d]) => ({ id, ko: d.ko, w: d.w, h: d.h })),
        decoGroups: [...groups].map(([id, g]) => ({ id, ko: g.ko, count: g.count, examples: g.examples, w: g.w, h: g.h, avoidsWindows: g.avoidsWindows })),
        yards: SPEC.yards,
        examples: Object.entries(SPEC.examples).map(([id, e]) => ({ id, ko: e.ko })),
        errorCodes: JP_CITY_ISSUE_CODES,
      },
    };
  },
};

// ───────────────────────────── 쓰기 도구: 인자 스키마(자유 키 객체 없음 — 모든 객체에 명시 필드 + additionalProperties:false)
const STR = (description: string): JsonSchema => ({ type: "string", description });
const INT = (description: string, minimum?: number, maximum?: number): JsonSchema => ({ type: "integer", description, ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) });
const FLOOR_ITEM: JsonSchema = {
  type: "object",
  properties: {
    kind: STR("층 띠 종류(slide·veranda·koushi·pairs·ribbon·curtain·balcony·tile·blank)"),
    wall: STR("벽 재질(kinari·shiro·conc·hodo). curtain·tile 은 kinari 만"),
    variants: { type: "array", items: { type: "integer", minimum: 0 }, description: "몸통 변형 번호 목록(모듈마다 돌려 쓴다). 생략하면 [0]" },
    band: STR("띠 id 를 직접 지정(예: fl.pairs.shiro). 보통 쓰지 않는다"),
  },
  additionalProperties: false,
};
const DECO_ITEM: JsonSchema = {
  type: "object",
  properties: {
    deco: STR("부착물 id(list_jp_city_building_parts query 로 찾는다). vstack.{c} 는 cols 와 함께"),
    col: INT("건물 왼쪽 끝 기준 열(0부터)", 0),
    floor: STR("붙일 띠: 윗층 번호 문자열(\"0\"=맨 위 윗층, \"1\" …) 또는 ground(1층) 또는 head(맨 위 지붕 띠)"),
    row: INT("그 띠 안에서 아래로 내릴 줄 수(기본 0)", 0),
    cols: { type: "array", items: { type: "string" }, description: "deco 의 {c} 에 들어갈 색 목록(층마다 돌려 쓴다)" },
  },
  required: ["deco", "col", "floor"],
  additionalProperties: false,
};
const DOOR_ITEM: JsonSchema = {
  type: "object",
  properties: { type: STR("문 종류(lattice·auto·lobby·steel·cafe·noren·rollup·machiya·house). 생략하면 1층 종류의 기본 문"), col: INT("문 왼쪽 열(0부터). 생략하면 오른쪽 끝", 0) },
  additionalProperties: false,
};
const SETBACK_ITEM: JsonSchema = {
  type: "object",
  properties: { upper: INT("이 층 번호(0=맨 위)보다 위는 안쪽으로 들인다", 0), ins: INT("양쪽으로 들이는 칸 수", 1) },
  required: ["upper", "ins"],
  additionalProperties: false,
};
/** 본채·별채가 같이 쓰는 건물 필드. */
function buildingProps(): Record<string, JsonSchema> {
  return {
    w: INT("폭(칸). 최소 3", 1, 60),
    floors: INT("윗층 수(0~30). floorPlan 이 있으면 무시. 한 층 = 위·아래 2줄", 0, 30),
    floorKind: STR("floors 가 숫자일 때 모든 층의 띠 종류(기본 pairs)"),
    wall: STR("기본 벽 재질 kinari·shiro·conc·hodo(기본 kinari)"),
    floorPlan: { type: "array", items: FLOOR_ITEM, description: "층별 지정(위에서 아래 순서). 주면 floors·floorKind·wall 대신 쓴다" },
    ground: STR("1층 종류: gr.izakaya · gr.konbini.0|1 · gr.garage · gr.shutter.aka|sora|kii · gr.glass.aka|sora|kii · gr.machiya (gr. 생략 가능)"),
    shop: STR("ground 의 다른 이름"),
    groundVariants: { type: "array", items: { type: "integer", minimum: 0 }, description: "1층 몸통 변형 번호 목록(gr.machiya 만 0~5)" },
    door: DOOR_ITEM,
    roof: STR("지붕 띠: roof.plain.tank · roof.ac.plain · roof.stair.cyl · roof.tile · roof.slate · roof.hip · roof.hip.slate … (roof. 생략 가능). head 가 있으면 head 가 대신한다"),
    head: STR("옥상 간판 띠 roofsign.aka|sora|kii (지붕 자리를 대신한다)"),
    eave: STR("처마 띠 eave 또는 eave.slate (1층 바로 위)"),
    setback: SETBACK_ITEM,
    decos: { type: "array", items: DECO_ITEM, description: "간판·차양·실외기·비상계단 등 부착물" },
  };
}
// 별채는 본채 스키마를 통째로 되풀이하면 도구 정의가 두 배가 된다(토큰). 완성 예제 L자 3종이 실제로 쓰는 필드만 노출한다 —
// floorPlan·shop·head·eave·setback 은 본채에서만 스키마에 있고, 실행기(toBuildingInput)는 별채에서도 받아들인다.
const WING_OMIT = new Set(["floorPlan", "shop", "head", "eave", "setback"]);
const WING_PROPS: Record<string, JsonSchema> = {
  ...Object.fromEntries(Object.entries(buildingProps()).filter(([k]) => !WING_OMIT.has(k))),
  side: { type: "string", enum: ["L", "R"], description: "별채가 본채의 왼쪽(L)·오른쪽(R) 앞에 선다(기본 L)" },
  depth: INT("별채가 본채보다 앞(아래)으로 튀어나온 칸 수(기본 2)", 1, 12),
  yard: STR("본채 앞 남는 땅: lot(주차장, 기본) 또는 거리 칸 이름(sw 등)"),
};

function parseFloor(v: unknown): number | "ground" | "head" {
  if (v === "ground" || v === "head") return v;
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\d+$/u.test(v.trim())) return Number(v.trim());
  throw new ToolError(`부착물 floor "${String(v)}" 는 윗층 번호("0","1"…) · ground · head 중 하나`, { code: "BAD_INPUT" });
}
function toBuildingInput(a: Record<string, unknown>): JpCityWingInput {
  const plan = Array.isArray(a.floorPlan) && a.floorPlan.length ? (a.floorPlan as JpCityFloorInput[]) : null;
  const decos = Array.isArray(a.decos) ? (a.decos as { deco: string; col: number; floor: unknown; row?: number; cols?: string[] }[]).map((d): JpCityDecoInput => ({
    deco: d.deco, col: d.col, floor: parseFloor(d.floor), ...(d.row !== undefined ? { row: d.row } : {}), ...(d.cols ? { cols: d.cols } : {}),
  })) : undefined;
  const o: Record<string, unknown> = { w: a.w };
  o.floors = plan ?? (typeof a.floors === "number" ? a.floors : 0);
  for (const k of ["floorKind", "wall", "ground", "shop", "groundVariants", "door", "roof", "head", "eave", "setback"] as const) if (a[k] !== undefined) o[k] = a[k];
  if (decos) o.decos = decos;
  return o as unknown as JpCityWingInput;
}

const MIN_REACH = 6;
function formatIssue(i: JpCityIssue): string { return `${i.code}${i.x !== undefined ? `(${i.x},${i.y})` : ""} ${i.message}`; }

/** 오류 코드별 «다음에 할 일» — 조수가 메시지만 읽고 바로 인자를 고치게 한다(DOOR_BLOCKED 는 문 앞 바닥 fill_region 인자까지 만들어 준다). */
const NEXT_ACTION: Partial<Record<JpCityIssue["code"], string>> = {
  TOO_NARROW: "w 를 늘린다(최소 3, 문 폭 이상, 별채는 본채 폭-2 이하, 셋백은 양쪽 ins 를 뺀 폭이 남게)",
  ROOF_ORDER: "roof(또는 head) 를 주고, eave 는 1층 바로 위에만 둔다",
  FLOOR_PAIR: "floorPlan 의 층 kind 를 2줄 한 쌍 종류(pairs·slide·veranda·koushi·ribbon…)로 바꾼다",
  NO_DOOR: "door 를 빼면 1층 기본 문이 오른쪽 끝에 붙는다 — door.type 을 문 종류로 준다",
  DECO_CLASH: "창 위에 얹은 부착물의 col·row 를 옮기거나 floor 를 바꾸거나 빼고, 한 칸에 위층 칸이 3장 겹치지 않게 한다",
  UNKNOWN_PART: "list_jp_city_building_parts(인자 없이, 또는 query) 로 실제 id 를 확인해 쓴다",
  OUT_OF_MAP: "x,y 는 건물 발(왼쪽 아래)이다 — 건물은 위로 자라므로 y 는 (층수×2+지붕·1층 줄 수)-1 이상, x+w 는 맵 폭 이하",
  DOOR_OUT_OF_RANGE: "door.col 이 0~w-1 안이고 문 폭이 건물 안에 들어가는지 확인한다",
  DECO_OUT_OF_RANGE: "decos[].col 이 0~w-1 안인지, floor 가 윗층 번호·ground·head 중 하나인지 확인한다",
  BAD_INPUT: "인자 이름과 타입을 스키마대로 고친다",
};

/** 문 앞 접근칸을 걸을 수 있게 만드는 fill_region 인자 — 접근칸 둘레(좌우 1칸, 아래 3줄)를 보도 연석으로. 접근칸이 맵 밖이면 건물을 위로 옮기라고 한다. */
function doorBlockedFix(mapId: string, map: GameMap, cells: readonly { x: number; y: number }[]): string {
  const inside = cells.filter((c) => inMapBounds(map, c.x, c.y));
  const moveUp = "접근칸이 맵 밖이면(건물 아래에 한 줄도 안 남음) 건물을 위로 옮긴다(y 를 줄인다)";
  if (!inside.length) return moveUp;
  const xs = inside.map((c) => c.x), ys = inside.map((c) => c.y);
  const x0 = Math.max(0, Math.min(...xs) - 1), x1 = Math.min(map.width - 1, Math.max(...xs) + 1);
  const y0 = Math.min(...ys), y1 = Math.min(map.height - 1, Math.max(...ys) + 2);
  return `문 앞 바닥을 깐다 — fill_region({mapId:"${mapId}", rect:{x:${x0},y:${y0},w:${x1 - x0 + 1},h:${y1 - y0 + 1}}, material:"보도 연석", referencePurpose:"jp-start"}) 후 같은 인자로 다시 부른다. ${moveUp}`;
}

/** 오류 목록 → 「→ 다음: …」 꼬리. 코드마다 한 번씩. */
function nextActions(mapId: string, map: GameMap, errors: readonly JpCityIssue[]): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const blocked = errors.filter((e) => e.code === "DOOR_BLOCKED" && e.x !== undefined && e.y !== undefined).map((e) => ({ x: e.x!, y: e.y! }));
  for (const e of errors) {
    if (seen.has(e.code)) continue;
    seen.add(e.code);
    const text = e.code === "DOOR_BLOCKED" ? (blocked.length ? doorBlockedFix(mapId, map, blocked) : "문 앞 접근칸을 걸을 수 있는 바닥에 이어 둔다(문 앞 보도·도로를 fill_region 으로 먼저 깐다)") : NEXT_ACTION[e.code];
    if (text) lines.push(`${e.code}: ${text}`);
  }
  return lines.length ? ` → 다음: ${lines.join(" / ")}` : "";
}

/** 찍은 뒤의 맵에서 문 앞 접근칸이 실제로 걸을 수 있는 바닥에 이어지는가(엔진 통행 규칙 isPassable). */
function accessReach(project: Project, map: GameMap, a: { x: number; y: number }, limit: number): number {
  if (!isPassable(project, map, a.x, a.y)) return 0;
  const seen = new Set<number>([a.y * map.width + a.x]); const q = [a];
  while (q.length && seen.size < limit) {
    const p = q.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx, y = p.y + dy;
      if (!inMapBounds(map, x, y) || seen.has(y * map.width + x) || !isPassable(project, map, x, y)) continue;
      seen.add(y * map.width + x); q.push({ x, y });
    }
  }
  return seen.size;
}

export const BUILD_JP_CITY_BUILDING_TOOL: ToolDefinition = {
  name: "build_jp_city_building",
  mode: "write",
  domains: ["tile", "map"],
  fillsCurrentMapId: true,
  description: "일본 도시(jp_city, 계열 oprn-jp) 맵에 상가·아파트·사무소·마치야 건물을 짓는다 — 폭·층수·벽 재질·1층 종류·지붕·문·간판 부착물을 정하면 부품 문법(왼쪽 끝 + 몸통 반복 + 오른쪽 끝 2칸)으로 칸을 계산해 위층에 찍는다. "
    + "건물을 낱칸으로 칠하지 말고 이 도구로 짓는다. x,y = 건물 발(왼쪽 아래 칸), 사각형은 위쪽으로 자란다. 한 층 = 위·아래 2줄, floorPlan[0] 이 맨 위 층. "
    + "먼저 list_jp_city_building_parts 로 id 를 확인한다(example 로 완성 예제 입력을 받을 수 있다). wing 을 주면 L자(본채 + 앞으로 튀어나온 별채·마당). "
    + "오류가 하나라도 있으면 맵을 바꾸지 않고 코드·좌표·고칠 방법을 돌려준다(TOO_NARROW·ROOF_ORDER·FLOOR_PAIR·NO_DOOR·DOOR_BLOCKED·DECO_CLASH·UNKNOWN_PART 등). "
    + "새 jp_city 맵은 비어 있다 — 땅(fill_region 보도 연석·생활도로)을 먼저 깔고 문 앞이 걸을 수 있어야 하며, 뒷줄 건물을 앞줄보다 먼저 찍는다. jp_city 맵에서만 동작한다.",
  parameters: {
    type: "object",
    properties: {
      mapId: STR("대상 맵 id(생략하면 지금 보는 맵). 칩셋이 jp_city 여야 한다"),
      x: INT("건물 발(왼쪽 아래 칸)의 열", 0),
      y: INT("건물 발(왼쪽 아래 칸)의 행 — 사각형은 위로 자란다", 0),
      ...buildingProps(),
      wing: { type: "object", description: "L자 별채(본채는 위 필드). 폭·층·1층·지붕·문과 side·depth·yard", properties: WING_PROPS, required: ["w", "ground"], additionalProperties: false },
    },
    required: ["x", "y", "w", "ground"],
    additionalProperties: false,
  },
  invalidArgsExample: { x: 4, y: 12, w: 6, floors: 3, floorKind: "pairs", wall: "shiro", ground: "gr.konbini.0", roof: "roof.ac.tank", door: { type: "auto", col: 2 } },
  run(draft, args): ToolExecResult {
    const mapId = typeof args.mapId === "string" && args.mapId.trim() ? args.mapId.trim() : "";
    if (!mapId) throw new ToolError("mapId 가 없고 지금 보는 맵도 없다 — 건물을 지을 jp_city 맵 id 를 준다", { code: "map-not-found" });
    const map = requireMap(draft, mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset || !isJpCityTileset(tileset)) {
      throw new ToolError(`맵 '${map.name}'(${mapId}) 의 칩셋 '${map.tilesetId}'(계열 ${tileset?.family ?? "없음"}) 은 일본 도시(${JP_CITY_ID}, 계열 ${JP_CITY_FAMILY})가 아니다 — 이 도구는 jp_city 맵에서만 동작한다. 일본 상가 거리가 목적이면 create_map({tilesetId:\"${JP_CITY_ID}\"}) 로 새 맵을 만든다(보는 맵이 다른 계열이면 ask_tileset_change 로 사용자에게 먼저 묻는다). 다른 칩셋 맵에는 그 칩셋의 참고문서·도구를 쓴다.`, { code: "tileset-family-mismatch", mapId });
    }
    if (tileset.count < SPEC.count) throw new ToolError(`이 프로젝트의 jp_city 사본(${tileset.count}칸)이 부품 사전(${SPEC.count}칸)보다 작다 — 프로젝트를 다시 열어 번들 타일셋을 갱신한다`, { code: "tileset-outdated", mapId });
    if (!Number.isInteger(args.x) || !Number.isInteger(args.y)) throw new ToolError("x·y 는 정수(건물 발 = 왼쪽 아래 칸)", { code: "BAD_INPUT", mapId });

    const wingArgs = args.wing && typeof args.wing === "object" ? (args.wing as Record<string, unknown>) : null;
    const input: JpCityBuildingInput = {
      ...(toBuildingInput(args) as unknown as JpCityBuildingInput), x: args.x as number, y: args.y as number,
      ...(wingArgs ? { wing: { ...toBuildingInput(wingArgs), ...(wingArgs.side !== undefined ? { side: wingArgs.side as "L" | "R" } : {}), ...(wingArgs.depth !== undefined ? { depth: wingArgs.depth as number } : {}), ...(wingArgs.yard !== undefined ? { yard: wingArgs.yard as string } : {}) } } : {}),
    };
    const built = buildJpCityBuilding(input, { world: { width: map.width, height: map.height, passable: (x, y) => isPassable(draft, map, x, y) }, minReach: MIN_REACH });
    const errors = built.issues.filter((i) => i.severity === "error");
    if (errors.length) {
      const e0 = errors[0]!;
      throw new ToolError(`건물을 짓지 않았다 — 오류 ${errors.length}건: ${errors.slice(0, 6).map(formatIssue).join(" / ")}${errors.length > 6 ? " …" : ""}${nextActions(mapId, map, errors)}`, { code: e0.code, mapId, ...(e0.x !== undefined ? { x: e0.x, y: e0.y } : {}) });
    }

    // 복제본에 찍어 엔진 통행으로 다시 확인한 뒤에만 맵에 반영한다.
    const next = structuredClone(map);
    let noGround = 0;
    for (const p of built.placements) {
      const i = p.y * next.width + p.x;
      if (p.lower !== undefined) { setLower(next, p.x, p.y, p.lower); continue; }
      if ((next.lowerTiles[i] ?? -1) < 0 && !built.solid[p.y - built.rect.y0]![p.x - built.rect.x0]) noGround++;
      setLayerTileAt(next, 3, i, p.upper ?? -1);
      setLayerTileAt(next, 4, i, p.overlay ?? -1);
      clearTileStack(next, "upper", i);
    }
    const asm = built.assembled!;
    const { x0, y0 } = built.rect;
    let solidCells = 0, solidMismatch = 0;
    for (let r = 0; r < asm.rows; r++) for (let c = 0; c < asm.n; c++) {
      if (!built.solid[r]![c]) continue;
      solidCells++;
      if (isPassable(draft, next, x0 + c, y0 + r)) solidMismatch++;
    }
    const blockedAccess = built.access.filter((a) => accessReach(draft, next, a, MIN_REACH) < MIN_REACH);
    if (blockedAccess.length) {
      const a0 = blockedAccess[0]!;
      throw new ToolError(`건물을 짓지 않았다 — 오류 ${blockedAccess.length}건: DOOR_BLOCKED(${a0.x},${a0.y}) 찍고 난 뒤 문 앞 접근칸에서 걸어갈 수 있는 칸이 ${MIN_REACH}개 미만 — 문 앞 바닥(보도·도로)을 먼저 깐다 → 다음: ${doorBlockedFix(mapId, map, blockedAccess)}`, { code: "DOOR_BLOCKED", mapId, x: a0.x, y: a0.y });
    }
    if (solidMismatch) throw new ToolError(`건물을 짓지 않았다 — 막힘 칸 ${solidMismatch}개가 엔진 통행에서 열려 있다(칸 번호의 통행 정의가 부품 사전과 다르다). 번들 타일셋을 갱신한다`, { code: "passability-mismatch", mapId });
    draft.maps[mapId] = next;

    const warnings = built.issues.filter((i) => i.severity === "warning").map(formatIssue);
    const covered = (next.events ?? []).filter((ev) => { const c = ev.x - x0, r = ev.y - y0; return c >= 0 && r >= 0 && r < asm.rows && c < asm.n && built.solid[r]![c]; });
    if (covered.length) warnings.push(`건물이 막는 칸 위에 이벤트 ${covered.length}개가 있다: ${covered.slice(0, 4).map((ev) => `${ev.name ?? ev.id}(${ev.x},${ev.y})`).join(" ")} — 옮기거나 지운다`);
    if (noGround) warnings.push(`건물 아래 1층(바닥)이 비어 있는 칸이 ${noGround}개 — 걸어 지나가는 칸(★)은 바닥이 있어야 통행이 열린다`);
    return {
      summary: `일본 도시 건물 ${built.rect.w}×${built.rect.h}칸을 (${x0},${y0})~(${x0 + built.rect.w - 1},${y0 + built.rect.h - 1}) 에 지었다(${mapId}) — 문 ${built.doors.map((d) => `(${d.x},${d.y})`).join(" ")}, 문 앞 접근칸 ${built.access.map((d) => `(${d.x},${d.y})`).join(" ")} 에서 ${MIN_REACH}칸 이상 이어짐 확인, 막힘 칸 ${solidCells}개 엔진 통행과 일치${warnings.length ? ` · 경고 ${warnings.length}: ${warnings.slice(0, 3).join(" / ")}` : ""}`,
      data: { mapId, tilesetId: JP_CITY_ID, rect: built.rect, foot: built.foot, doors: built.doors, access: built.access, placedCells: built.placements.length, solidCells, warnings },
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const JP_CITY_TOOLS: readonly ToolDefinition[] = [LIST_JP_CITY_BUILDING_PARTS_TOOL, BUILD_JP_CITY_BUILDING_TOOL, LINK_JP_CITY_INTERIOR_TOOL];
