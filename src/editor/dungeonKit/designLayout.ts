// 모델이 설계한 던전·동굴 층(2026-10-29 사용자 결정 「맵·방을 설계하는 건 조수여야 한다 — 함수는 조화·검사만」).
// 조수가 make_place 의 dungeonDesign 에 방(역할·크기·모양·자리·물·특징)과 잇는 길·입구 쪽을 쓴다. 이 파일은 그 설계를 그대로 짓고,
// 함수는 겹침 밀기·길 잇기·도달·벽 두께·칩셋에 없는 것만 고친 뒤 「고침:」 줄로 돌려준다. 방 수·자리·역할을 함수가 고르지 않는다.
//   · layoutDesignedBlob : 불규칙 동굴 문법(cave·volcano·ice·forest·swamp·otherworld) — 방 덩이를 설계한 자리·모양으로 판다
//   · designToRooms      : 방+통로 문법(catacomb·castle·temple·mine·sewer·pyramid·tower) — 설계를 rooms 목록(kind·크기·from·dir)으로 옮긴다
import type { DungeonLayout, DungeonRoomInput, DungeonRoomKind, DungeonSpec, DungeonType, PlacedCorridor, PlacedRoom } from "./types";
import { DungeonComposeError } from "./errors";
import type { JsonSchema } from "@/editor/tools/types";
import { Grid, carveDisc, edgeDistance, rng, smooth, vnoise } from "./grid";
import type { GrammarInfo } from "./grammar";

// ---------------------------------------------------------------- 설계 형식

export interface DungeonDesignRoom {
  readonly id?: string;
  /** 역할: entrance 입구 · boss 보스 · treasure 보물 · lake 호수 · camp 야영·둥지 · shrine 제단 · forge 대장간(화산) · hall·cavern 넓은 굴 · grotto 곁굴 … */
  readonly role?: string;
  /** small·medium·large·huge 또는 바닥 w×h(칸). */
  readonly size?: string;
  readonly w?: number;
  readonly h?: number;
  /** blob 둥근 덩이 · cavern 여러 잎 큰 굴 · long 길쭉한 굴(dir ew|ns) · shaft 좁고 긴 세로 굴 · ring 가운데 바위·못을 도는 고리 · twin 목으로 이은 두 잎. */
  readonly shape?: string;
  readonly dir?: string;
  /** 맵 안 자리: n·ne·e·se·s·sw·w·nw·center 또는 {x,y}(0~1, 왼쪽 위 0,0) 또는 "0.2,0.7". */
  readonly at?: string | { readonly x?: number; readonly y?: number };
  /** none · pool 작은 웅덩이 · lake 호수(가장자리만 걷는다) · stream 다음 방으로 흐르는 물줄기(다리로 건넌다). 테마 액체로 칠한다(동굴 물·화산 용암·마계 허공). */
  readonly water?: string;
  /** stalagmites 석순 무리 · crystals 수정 · mushrooms 빛 버섯 · bones 뼈 더미 · pillars 부러진 돌기둥 · boulders 바위 · camp 모닥불 야영 흔적 · bridge(물줄기가 지나면 다리). */
  readonly features?: readonly string[];
}
export interface DungeonDesignLink { readonly from?: string; readonly to?: string; readonly kind?: string }
export interface DungeonDesign {
  readonly rooms?: readonly DungeonDesignRoom[];
  /** 잇는 길: [{from,to,kind}] · [["a","b"]] · ["a-b"]. kind: winding 굽은 길(기본) · straight 곧은 길 · narrow 좁은 틈 · wide 넓은 길. */
  readonly links?: readonly (DungeonDesignLink | readonly string[] | string)[];
  /** links 를 안 줄 때 방 순서대로 잇는 모양: linear 한 줄 · branch 갈래 · loop 고리 · hub 가운데 방에서 사방. */
  readonly connections?: string;
  /** 입구가 맵의 어느 쪽: south(기본)·north·west·east. 입구 방에 at 이 없으면 이 쪽에 둔다. 숲·늪은 이 쪽 맵 끝으로 나가는 길이 출구다. */
  readonly entrance?: string;
  /** 높이 단 — 던전은 아직 짓지 못한다(무시하고 알린다). */
  readonly levels?: unknown;
}

// 모델에게 보이는 스키마(v2 make_place spec.dungeonDesign · author_dungeon design) — enum·범위 없이, 아래 normalize* 가 너그럽게 읽는다.
const ROOM_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", description: "방 이름(links 가 가리킨다) — 예: 입구굴, 수정굴, 용의둥지" },
    role: { type: "string", description: "entrance 입구 · boss 보스 · treasure 보물 · lake 호수 · camp 야영·둥지 · shrine 제단 · forge 대장간(화산) · hall 넓은 굴 · grotto 곁굴" },
    size: { type: "string", description: "small · medium · large · huge (또는 w·h)" },
    w: { type: "integer", description: "(선택) 바닥 가로 칸 6~24" },
    h: { type: "integer", description: "(선택) 바닥 세로 칸 6~18" },
    shape: { type: "string", description: "blob 둥근 덩이 · cavern 여러 잎 큰 굴 · long 길쭉한 굴(dir) · shaft 좁고 긴 세로 굴 · ring 가운데 바위·못을 도는 고리 · twin 목으로 이은 두 잎" },
    dir: { type: "string", description: "(long·twin) ew 가로 · ns 세로" },
    at: { type: "string", description: "맵 안 자리 — n·ne·e·se·s·sw·w·nw·center 또는 \"x,y\"(0~1, 왼쪽 위 0,0). 방마다 다른 자리를 준다" },
    water: { type: "string", description: "none · pool 웅덩이 · lake 호수 · stream 다음 방으로 흐르는 물줄기(다리로 건넌다). 테마 액체로 칠한다(동굴·숲·늪 물, 화산 용암, 마계 허공)" },
    features: { type: "array", items: { type: "string" }, description: "stalagmites 석순 · crystals 수정 · mushrooms 빛 버섯 · bones 뼈 더미 · pillars 부러진 돌기둥 · boulders 바위 · camp 모닥불 야영" },
  },
};
export const DUNGEON_DESIGN_SCHEMA: JsonSchema = {
  type: "object",
  description: "(던전·동굴, 이 층을 직접 설계할 때) 방(역할·크기·모양·자리·물·특징)과 잇는 길·입구 쪽. 주면 빌더는 함수 배치 대신 이 설계대로 짓고, 겹침 밀기·길 잇기·도달·크기 모순만 고쳐 「고침:」으로 돌려준다. 어휘·예시 그림은 dungeon_parts.",
  properties: {
    rooms: { type: "array", items: ROOM_SCHEMA, description: "방 2~12개(입구 하나·보스 하나 포함). 방 수·크기·자리는 네가 정한다" },
    links: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, kind: { type: "string", description: "winding 굽은 길(기본) · straight 곧은 길 · narrow 좁은 틈 · wide 넓은 길" } } }, description: "잇는 길(방 id 끼리). 고리(지름길)를 원하면 닫히는 길을 하나 더" },
    connections: { type: "string", description: "(links 를 안 줄 때) 방을 적은 순서로 잇는 모양: linear · branch · loop · hub" },
    entrance: { type: "string", description: "입구가 맵의 어느 쪽: south · north · west · east" },
  },
};


// ---------------------------------------------------------------- 너그러운 읽기

const COMPASS: Record<string, [number, number]> = {
  n: [0.5, 0.1], north: [0.5, 0.1], 북: [0.5, 0.1], 북쪽: [0.5, 0.1], top: [0.5, 0.1], 위: [0.5, 0.1],
  s: [0.5, 0.9], south: [0.5, 0.9], 남: [0.5, 0.9], 남쪽: [0.5, 0.9], bottom: [0.5, 0.9], 아래: [0.5, 0.9],
  w: [0.1, 0.5], west: [0.1, 0.5], 서: [0.1, 0.5], 서쪽: [0.1, 0.5], left: [0.1, 0.5], 왼쪽: [0.1, 0.5],
  e: [0.9, 0.5], east: [0.9, 0.5], 동: [0.9, 0.5], 동쪽: [0.9, 0.5], right: [0.9, 0.5], 오른쪽: [0.9, 0.5],
  nw: [0.12, 0.12], northwest: [0.12, 0.12], 북서: [0.12, 0.12], ne: [0.88, 0.12], northeast: [0.88, 0.12], 북동: [0.88, 0.12],
  sw: [0.12, 0.88], southwest: [0.12, 0.88], 남서: [0.12, 0.88], se: [0.88, 0.88], southeast: [0.88, 0.88], 남동: [0.88, 0.88],
  c: [0.5, 0.5], center: [0.5, 0.5], centre: [0.5, 0.5], middle: [0.5, 0.5], 가운데: [0.5, 0.5], 중앙: [0.5, 0.5],
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** 자리 읽기 → [x,y](0~1) 또는 없음. 0~100·0~10 같은 큰 수도 비율로 읽는다. */
export function readAt(at: DungeonDesignRoom["at"]): [number, number] | undefined {
  if (at === undefined || at === null) return undefined;
  const frac = (v: number, scale: number) => clamp01(v > 1 ? v / scale : v);
  if (typeof at === "object") {
    const x = Number(at.x), y = Number(at.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    const scale = Math.max(x, y) > 10 ? 100 : Math.max(x, y) > 1 ? 10 : 1;
    return [frac(x, scale), frac(y, scale)];
  }
  const s = String(at).trim().toLowerCase().replace(/[\s_-]+/gu, "");
  if (COMPASS[s]) return COMPASS[s];
  const m = /^\(?(-?[\d.]+)[,/×x ]+(-?[\d.]+)\)?$/u.exec(String(at).trim());
  if (m) { const x = Number(m[1]), y = Number(m[2]); const scale = Math.max(x, y) > 10 ? 100 : Math.max(x, y) > 1 ? 10 : 1; return [frac(x, scale), frac(y, scale)]; }
  // 「north east」「북동쪽」
  const k = Object.keys(COMPASS).sort((a, b) => b.length - a.length).find((key) => s.includes(key) && key.length >= 2);
  return k ? COMPASS[k] : undefined;
}

export type DesignShape = "blob" | "cavern" | "long" | "shaft" | "ring" | "twin";
export const DESIGN_SHAPES: readonly { readonly id: DesignShape; readonly ko: string; readonly use: string; readonly min: string }[] = [
  { id: "blob", ko: "둥근 덩이", use: "보통 굴·곁굴·보물 굴", min: "아무 크기" },
  { id: "cavern", ko: "여러 잎 큰 굴", use: "넓은 홀·보스 굴 — 잎마다 다른 쓰임", min: "medium 이상" },
  { id: "long", ko: "길쭉한 굴(dir ew 가로·ns 세로)", use: "물줄기 따라 난 굴·회랑", min: "medium 이상" },
  { id: "shaft", ko: "좁고 긴 세로 굴", use: "깊이 내려가는 틈·수직 갱", min: "아무 크기(세로로 길어진다)" },
  { id: "ring", ko: "고리(가운데 바위 또는 못을 도는 길)", use: "제단·호수를 도는 방, 보스 둘레", min: "large 이상" },
  { id: "twin", ko: "목으로 이은 두 잎", use: "앞방·안방이 붙은 굴, 야영지", min: "medium 이상" },
];

const normShape = (v: unknown): DesignShape | undefined => {
  const s = String(v ?? "").toLowerCase();
  if (!s) return undefined;
  if (/ring|loop|donut|고리|도넛|둘레/u.test(s)) return "ring";
  if (/shaft|vertical|수직|세로\s*굴|틈|갱/u.test(s)) return "shaft";
  if (/twin|two|double|lobe|쌍|두\s*잎/u.test(s)) return "twin";
  if (/long|corridor|hall|elong|길쭉|회랑|긴/u.test(s)) return "long";
  if (/cavern|large|lobed|irregular|여러|큰\s*굴|불규칙/u.test(s)) return "cavern";
  if (/blob|round|circle|oval|둥근|덩이|원/u.test(s)) return "blob";
  return undefined;
};

type Water = "none" | "pool" | "lake" | "stream";
const normWater = (v: unknown): { water: Water; said: string } => {
  const s = String(v ?? "").toLowerCase();
  if (!s || /none|no|dry|없|마른/u.test(s)) return { water: "none", said: s };
  if (/stream|river|flow|줄기|강|흐르/u.test(s)) return { water: "stream", said: s };
  if (/pool|puddle|spring|웅덩|샘/u.test(s)) return { water: "pool", said: s };
  return { water: "lake", said: s };   // lake·lava·chasm·void·호수·용암·낭떠러지 → 그 방을 채우는 액체(테마 액체로 칠한다)
};

export const DESIGN_FEATURES: Readonly<Record<string, string>> = {
  stalagmites: "석순 무리", crystals: "수정 덩이", mushrooms: "빛 버섯·이끼", bones: "뼈 더미·해골", pillars: "부러진 돌기둥",
  boulders: "이끼 바위", camp: "모닥불 야영 흔적", bridge: "물줄기 위 다리(stream 과 함께)",
};
const normFeature = (v: unknown): string | undefined => {
  const s = String(v ?? "").toLowerCase();
  if (/stalag|석순|종유/u.test(s)) return "stalagmites";
  if (/crystal|수정|보석/u.test(s)) return "crystals";
  if (/mush|fung|moss|glow|버섯|이끼|빛/u.test(s)) return "mushrooms";
  if (/bone|skull|뼈|해골/u.test(s)) return "bones";
  if (/pillar|column|기둥/u.test(s)) return "pillars";
  if (/boulder|rock|바위|돌/u.test(s)) return "boulders";
  if (/camp|fire|nest|모닥|야영|둥지/u.test(s)) return "camp";
  if (/bridge|다리/u.test(s)) return "bridge";
  return undefined;
};

type Role = "entrance" | "boss" | "treasure" | "lake" | "camp" | "shrine" | "forge" | "hall" | "grotto";
const normRole = (v: unknown): Role => {
  const s = String(v ?? "").toLowerCase();
  if (/entr|start|입구|시작|들어/u.test(s)) return "entrance";
  if (/boss|throne|lord|보스|옥좌|우두머리|주인/u.test(s)) return "boss";
  if (/treas|vault|loot|chest|보물|금고/u.test(s)) return "treasure";
  if (/lake|pond|호수|못/u.test(s)) return "lake";
  if (/camp|nest|den|lair|야영|둥지|소굴|굴\s*집/u.test(s)) return "camp";
  if (/shrine|altar|chapel|제단|사당|성소/u.test(s)) return "shrine";
  if (/forge|smith|대장|용광/u.test(s)) return "forge";
  if (/grotto|side|nook|곁|샘굴|작은/u.test(s)) return "grotto";
  return "hall";
};

const SIZE_R: Record<string, [number, number]> = { small: [4, 3], medium: [6, 4], large: [8, 6], huge: [10, 7] };
const normSize = (r: DungeonDesignRoom): [number, number] => {
  const w = Number(r.w), h = Number(r.h);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return [Math.max(3, Math.min(12, Math.round(w / 2))), Math.max(3, Math.min(9, Math.round(h / 2)))];
  const s = String(r.size ?? "").toLowerCase();
  const m = /(\d+)\s*[x×*]\s*(\d+)/u.exec(s);
  if (m) return [Math.max(3, Math.min(12, Math.round(Number(m[1]) / 2))), Math.max(3, Math.min(9, Math.round(Number(m[2]) / 2)))];
  if (/huge|giant|거대|아주/u.test(s)) return SIZE_R.huge!;
  if (/large|big|큰|크/u.test(s)) return SIZE_R.large!;
  if (/small|tiny|작/u.test(s)) return SIZE_R.small!;
  return SIZE_R.medium!;
};

type LinkKind = "winding" | "straight" | "narrow" | "wide";
const normLinkKind = (v: unknown): LinkKind => {
  const s = String(v ?? "").toLowerCase();
  if (/straight|direct|곧/u.test(s)) return "straight";
  if (/narrow|squeeze|crack|좁|틈/u.test(s)) return "narrow";
  if (/wide|broad|넓/u.test(s)) return "wide";
  return "winding";
};

const normSide = (v: unknown): "south" | "north" | "west" | "east" | undefined => {
  const s = String(v ?? "").toLowerCase();
  if (/north|top|북|위/u.test(s)) return "north";
  if (/west|left|서|왼/u.test(s)) return "west";
  if (/east|right|동|오른/u.test(s)) return "east";
  if (/south|bottom|남|아래/u.test(s)) return "south";
  return undefined;
};

interface NRoom { id: string; role: Role; rx: number; ry: number; shape: DesignShape; dir: "ew" | "ns"; at?: [number, number]; water: Water; features: string[] }
export interface NormalizedDesign { rooms: NRoom[]; links: { a: number; b: number; kind: LinkKind }[]; side: "south" | "north" | "west" | "east"; fixes: string[] }

/**
 * 설계 읽기 + 조화(자리·크기·연결 말고 「모순」만): 입구·보스가 하나씩, 이름 중복, 모르는 낱말. 고친 것은 fixes 에 「고침:」 줄로.
 * 함수는 방을 더하거나 빼지 않는다(12개 넘으면 뒤를 뺀다는 것만).
 */
export function normalizeDesign(design: DungeonDesign, profile: GrammarInfo): NormalizedDesign {
  const fixes: string[] = [];
  const raw = (Array.isArray(design.rooms) ? design.rooms : []).filter((r) => r && typeof r === "object");
  if (raw.length < 2) throw new DungeonComposeError("dungeonDesign.rooms 에 방이 둘 이상 있어야 한다(입구·보스 포함).", "invalid-args");
  if (raw.length > 12) fixes.push(`고침: 방이 ${raw.length}개라 앞 12개만 지었다(한 층 12개까지 — 더 깊은 곳은 floors 로).`);
  const ids = new Set<string>();
  const rooms: NRoom[] = raw.slice(0, 12).map((r, i) => {
    let id = String(r.id ?? "").trim() || `room${i + 1}`;
    while (ids.has(id)) id = `${id}_${i + 1}`;
    ids.add(id);
    const [rx, ry] = normSize(r);
    const shapeSaid = r.shape;
    const shape = normShape(shapeSaid) ?? "blob";
    if (shapeSaid !== undefined && !normShape(shapeSaid)) fixes.push(`고침: 방 ${id} 모양 「${String(shapeSaid)}」을 몰라 blob(둥근 덩이)으로 지었다 — 모양: ${DESIGN_SHAPES.map((s) => s.id).join("·")}.`);
    const dirS = String(r.dir ?? "").toLowerCase();
    const dir: "ew" | "ns" = /ns|north|south|vert|세로|남북/u.test(dirS) ? "ns" : "ew";
    const { water, said } = normWater(r.water ?? (normRole(r.role) === "lake" ? "lake" : undefined));
    if (water !== "none" && !profile.liquid && profile.id !== "ice") fixes.push(`고침: 방 ${id} 의 물(${said})은 ${profile.label} 에 칠할 액체가 없어 마른 바닥으로 지었다.`);
    else if (water !== "none" && /lava|용암/u.test(said) && profile.liquid !== "lava") fixes.push(`고침: 방 ${id} 의 용암은 ${profile.label} 의 액체(${profile.liquid === "void" ? "허공" : "물"})로 칠했다 — 용암은 volcano 테마에서만.`);
    else if (water !== "none" && /water|물|호수|lake/u.test(said) && profile.liquid === "lava") fixes.push(`고침: 방 ${id} 의 물은 화산 테마라 용암으로 칠했다.`);
    const features: string[] = [];
    for (const f of Array.isArray(r.features) ? r.features : r.features ? [r.features as unknown as string] : []) {
      const k = normFeature(f);
      if (k && !features.includes(k)) features.push(k);
      else if (!k) fixes.push(`고침: 방 ${id} 특징 「${String(f)}」을 몰라 뺐다 — 특징: ${Object.keys(DESIGN_FEATURES).join("·")}.`);
    }
    return { id, role: normRole(r.role), rx, ry, shape, dir, at: readAt(r.at), water: profile.liquid || profile.id === "ice" ? water : "none", features };
  });
  // 역할 모순: 입구·보스는 하나씩. 없으면 자리로 정하고 알린다.
  let side = normSide(design.entrance) ?? "south";
  const sideScore = (r: NRoom) => { const [x, y] = r.at ?? [0.5, 0.5]; return side === "south" ? y : side === "north" ? -y : side === "west" ? -x : x; };
  const entrances = rooms.filter((r) => r.role === "entrance");
  if (!entrances.length) {
    const e = [...rooms].sort((a, b) => sideScore(b) - sideScore(a))[0]!;
    e.role = "entrance";
    fixes.push(`고침: 입구 역할 방이 없어 ${side} 쪽에 가장 가까운 방 ${e.id} 을 입구로 삼았다.`);
  } else for (const extra of entrances.slice(1)) { extra.role = "hall"; fixes.push(`고침: 입구가 여럿이라 ${extra.id} 은 넓은 굴로 지었다(입구는 ${entrances[0]!.id}).`); }
  // 입구 쪽을 안 줬으면 입구 방 자리에서 가장 가까운 맵 끝(야외 던전 출구 길이 그쪽으로 난다).
  if (!normSide(design.entrance)) {
    const e = rooms.find((r) => r.role === "entrance")!;
    if (e.at) { const [x, y] = e.at; const d = { south: 1 - y, north: y, west: x, east: 1 - x }; side = (Object.entries(d).sort((a, b) => a[1] - b[1])[0]![0]) as typeof side; }
  }
  const bosses = rooms.filter((r) => r.role === "boss");
  for (const extra of bosses.slice(1)) { extra.role = "hall"; fixes.push(`고침: 보스 방이 여럿이라 ${extra.id} 은 넓은 굴로 지었다(보스 방은 ${bosses[0]!.id}).`); }
  if (profile.id !== "volcano") for (const r of rooms) if (r.role === "forge") { r.role = "hall"; fixes.push(`고침: 방 ${r.id} 대장간은 화산 테마에만 있어 넓은 굴로 지었다.`); }
  // 입구를 맨 앞으로(방 번호 0 = 입구 — 마스크·조립기가 그렇게 읽는다).
  rooms.sort((a, b) => Number(b.role === "entrance") - Number(a.role === "entrance"));
  const at = new Map(rooms.map((r, i) => [r.id, i] as const));
  // 연결
  const links: { a: number; b: number; kind: LinkKind }[] = [];
  const addLink = (a: number | undefined, b: number | undefined, kind: LinkKind, said: string) => {
    if (a === undefined || b === undefined) { fixes.push(`고침: 길 「${said}」의 방 이름을 몰라 뺐다(방 id: ${rooms.map((r) => r.id).join("·")}).`); return; }
    if (a === b || links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return;
    links.push({ a, b, kind });
  };
  const find = (name: unknown): number | undefined => {
    const s = String(name ?? "").trim();
    if (at.has(s)) return at.get(s);
    const low = s.toLowerCase();
    const hit = rooms.findIndex((r) => r.id.toLowerCase() === low || r.role === normRole(low) && /^(entrance|boss|treasure|입구|보스|보물)/u.test(low));
    return hit >= 0 ? hit : undefined;
  };
  for (const l of Array.isArray(design.links) ? design.links : []) {
    if (typeof l === "string") { const [a, b] = l.split(/\s*(?:->|→|-|~|,|to)\s*/u); addLink(find(a), find(b), "winding", l); }
    else if (Array.isArray(l)) addLink(find(l[0]), find(l[1]), normLinkKind(l[2]), l.join("-"));
    else if (l && typeof l === "object") { const o = l as DungeonDesignLink; addLink(find(o.from), find(o.to), normLinkKind(o.kind), `${o.from}-${o.to}`); }
  }
  // links 가 없으면 connections 모양을 「방을 적은 순서」로 잇는다 — 순서는 모델이 정했다.
  if (!links.length) {
    const fam = String(design.connections ?? "").toLowerCase();
    const order = rooms.map((_, i) => i);
    if (/hub|star|가운데|허브/u.test(fam)) {
      const hub = rooms.findIndex((r, i) => i > 0 && r.role !== "boss" && r.role !== "treasure");
      const h = hub > 0 ? hub : 1;
      addLink(0, h, "winding", "hub");
      for (const i of order) if (i !== 0 && i !== h) addLink(h, i, "winding", "hub");
    } else if (/branch|fork|tree|갈래|가지/u.test(fam)) {
      // 갈래: 앞 절반은 줄기, 나머지는 줄기 방에 번갈아 붙는 가지
      const trunk = order.slice(0, Math.max(2, Math.ceil(order.length / 2)));
      for (let k = 1; k < trunk.length; k += 1) addLink(trunk[k - 1], trunk[k], "winding", "branch");
      order.slice(trunk.length).forEach((i, k) => addLink(trunk[1 + (k % Math.max(1, trunk.length - 1))], i, "winding", "branch"));
    } else {
      for (let k = 1; k < order.length; k += 1) addLink(order[k - 1], order[k], "winding", "chain");
      if (/loop|ring|cycle|고리|순환/u.test(fam) && order.length >= 4) addLink(order[order.length - 2], 1, "winding", "loop");
      if (!/linear|chain|line|loop|ring|cycle|한\s*줄|사슬|고리|순환/u.test(fam)) fixes.push(fam ? `고침: connections 「${fam}」를 몰라 적은 순서대로 한 줄로 이었다 — linear·branch·loop·hub.` : "고침: links·connections 가 없어 방을 적은 순서대로 한 줄로 이었다.");
    }
  }
  // 이어지지 않은 방: 가장 가까운(자리 기준) 이어진 방과 잇는다.
  const linked = () => { const seen = new Set([0]); let grew = true; while (grew) { grew = false; for (const l of links) { if (seen.has(l.a) !== seen.has(l.b)) { seen.add(l.a); seen.add(l.b); grew = true; } } } return seen; };
  for (let guard = 0; guard < rooms.length; guard += 1) {
    const seen = linked();
    const lost = rooms.findIndex((_, i) => !seen.has(i));
    if (lost < 0) break;
    const p = rooms[lost]!.at ?? [0.5, 0.5];
    const near = [...seen].sort((a, b) => { const pa = rooms[a]!.at ?? [0.5, 0.5], pb = rooms[b]!.at ?? [0.5, 0.5]; return Math.hypot(pa[0] - p[0], pa[1] - p[1]) - Math.hypot(pb[0] - p[0], pb[1] - p[1]); })[0]!;
    links.push({ a: near, b: lost, kind: "winding" });
    fixes.push(`고침: 방 ${rooms[lost]!.id} 이 어디와도 이어지지 않아 가까운 ${rooms[near]!.id} 와 이었다.`);
  }
  if (!rooms.some((r) => r.role === "boss")) {
    // 보스 방이 없으면 입구에서 길로 가장 깊은 방
    const depth = bfsDepth(rooms.length, links);
    const deep = rooms.map((r, i) => ({ r, d: depth[i]! })).filter((x) => x.r.role !== "entrance").sort((a, b) => b.d - a.d)[0]!.r;
    deep.role = "boss";
    fixes.push(`고침: 보스 방이 없어 입구에서 가장 깊은 ${deep.id} 를 보스 방으로 삼았다.`);
  }
  if (design.levels !== undefined) fixes.push("고침: 높이 단(levels)은 던전에서 아직 짓지 못해 한 단으로 지었다.");
  return { rooms, links, side, fixes };
}

function bfsDepth(n: number, links: readonly { a: number; b: number }[]): number[] {
  const d = new Array<number>(n).fill(-1); d[0] = 0;
  const q = [0];
  for (let k = 0; k < q.length; k += 1) for (const l of links) {
    const o = l.a === q[k] ? l.b : l.b === q[k] ? l.a : -1;
    if (o >= 0 && d[o]! < 0) { d[o] = d[q[k]!]! + 1; q.push(o); }
  }
  return d.map((v) => (v < 0 ? 0 : v));
}

// ---------------------------------------------------------------- 불규칙 문법: 설계대로 파기

const MARGIN = 2;
const KIND: Record<Role, DungeonRoomKind> = { entrance: "entrance", boss: "boss", treasure: "vault", lake: "lake", camp: "cavern", shrine: "grotto", forge: "forge", hall: "cavern", grotto: "grotto" };

/** 방 모양 → 그 방에 속하는 타원 잎 목록(중심 기준 상대). */
function lobesOf(r: NRoom, random: () => number): { dx: number; dy: number; rx: number; ry: number }[] {
  switch (r.shape) {
    case "long": return r.dir === "ns" ? [{ dx: 0, dy: 0, rx: Math.max(3, Math.round(r.rx * 0.6)), ry: Math.round(r.ry * 1.8) }] : [{ dx: 0, dy: 0, rx: Math.round(r.rx * 1.7), ry: Math.max(4, Math.round(r.ry * 0.8)) }];
    case "shaft": return [{ dx: 0, dy: 0, rx: Math.max(2, Math.min(3, Math.round(r.rx * 0.5))), ry: Math.max(6, Math.round(r.ry * 2)) }];
    case "twin": {
      const ew = r.dir !== "ns";
      const a = { rx: Math.max(3, Math.round(r.rx * 0.8)), ry: Math.max(3, Math.round(r.ry * 0.85)) };
      const off = ew ? a.rx + 1 : a.ry + 2;
      return [{ dx: ew ? -off : 0, dy: ew ? 0 : -off, ...a }, { dx: ew ? off : 0, dy: ew ? 0 : off, rx: Math.max(3, a.rx - 1), ry: Math.max(3, a.ry - (ew ? 0 : 1)) }];
    }
    case "cavern": {
      const out = [{ dx: 0, dy: 0, rx: r.rx, ry: r.ry }];
      const n = 2 + Math.floor(random() * 2);
      for (let k = 0; k < n; k += 1) {
        const th = random() * Math.PI * 2;
        out.push({ dx: Math.round(Math.cos(th) * r.rx * 0.85), dy: Math.round(Math.sin(th) * r.ry * 0.8), rx: Math.max(3, Math.round(r.rx * (0.5 + random() * 0.2))), ry: Math.max(3, Math.round(r.ry * (0.5 + random() * 0.2))) });
      }
      return out;
    }
    default: return [{ dx: 0, dy: 0, rx: r.rx, ry: r.ry }];
  }
}

const bounds = (lobes: { dx: number; dy: number; rx: number; ry: number }[]) => ({
  x0: Math.min(...lobes.map((l) => l.dx - l.rx)), x1: Math.max(...lobes.map((l) => l.dx + l.rx)),
  y0: Math.min(...lobes.map((l) => l.dy - l.ry)), y1: Math.max(...lobes.map((l) => l.dy + l.ry)),
});

/**
 * 설계한 동굴 한 층. 방 자리(at)는 모델이 정한 비율 그대로 맵에 옮기고, 함수는 겹치는 방을 밀고(「고침:」), 너무 멀어 허공이 큰 판을 당기고,
 * 모델이 적은 길만 판다. 방 모양·물·특징·입구 쪽도 설계대로. 벽 두께·도달은 마스크(settle)가 맞춘다.
 */
export function layoutDesignedBlob(spec: DungeonSpec, profile: GrammarInfo, design: DungeonDesign): DungeonLayout & { grid: Grid } {
  const nd = normalizeDesign(design, profile);
  const fixes = [...nd.fixes];
  const seed = spec.seed ?? 7;
  const random = rng(seed * 92821 + 29);
  const rooms = nd.rooms;
  // 크기 맞춤(조화): 보스는 3×2 몸과 제단이 설 만큼, 고리는 가운데 섬이 벽으로 설 만큼, 입구는 계단 벽이 설 만큼.
  for (const r of rooms) {
    if (r.role === "boss" && (r.rx < 6 || r.ry < 4)) { fixes.push(`고침: 보스 방 ${r.id} 이 작아(보스 몸 3×2·제단이 못 선다) 바닥을 ${Math.max(r.rx, 6) * 2}×${Math.max(r.ry, 4) * 2} 로 키웠다.`); r.rx = Math.max(r.rx, 6); r.ry = Math.max(r.ry, 4); }
    if (r.shape === "ring" && (r.rx < 7 || r.ry < 5)) { fixes.push(`고침: 방 ${r.id} 고리 모양은 가운데 섬이 설 만큼 커야 해 바닥을 ${Math.max(r.rx, 7) * 2}×${Math.max(r.ry, 5) * 2} 로 키웠다.`); r.rx = Math.max(r.rx, 7); r.ry = Math.max(r.ry, 5); }
    if (r.role === "entrance") { r.rx = Math.max(r.rx, 6); r.ry = Math.max(r.ry, 3); if (r.shape !== "blob") { fixes.push(`고침: 입구 방 ${r.id} 은 계단·문을 걸 평평한 북벽이 있어야 해 ${r.shape} 대신 둥근 덩이로 지었다.`); r.shape = "blob"; } }
    if (r.water === "lake" && r.rx < 5 && r.shape !== "shaft") { fixes.push(`고침: 방 ${r.id} 호수는 작은 방에 둥근 네모 물감처럼 보여 웅덩이(pool)로 지었다.`); r.water = "pool"; }
    if (r.water === "lake" && r.role === "entrance") { fixes.push(`고침: 입구 방 ${r.id} 에는 호수를 두지 않았다(계단 앞 길).`); r.water = "none"; }
  }
  const lobeSets = rooms.map((r) => lobesOf(r, random));
  // ---- 자리: at 그대로(없으면 이어진 방 곁) ----
  const span = Math.sqrt(rooms.reduce((s, _r, i) => { const b = bounds(lobeSets[i]!); return s + (b.x1 - b.x0 + 4) * (b.y1 - b.y0 + 7); }, 0) * 1.25);
  const SW = Math.max(30, Math.round(span * 1.15)), SH = Math.max(26, Math.round(span * 0.95));
  const pos: { x: number; y: number }[] = rooms.map((r) => ({ x: (r.at?.[0] ?? NaN) * SW, y: (r.at?.[1] ?? NaN) * SH }));
  const sideAt: Record<string, [number, number]> = { south: [0.5, 0.92], north: [0.5, 0.08], west: [0.06, 0.5], east: [0.94, 0.5] };
  if (!rooms[0]!.at) { const [x, y] = sideAt[nd.side]!; pos[0] = { x: x * SW, y: y * SH }; }
  const missing = rooms.map((r, i) => (!r.at && i > 0 ? r.id : "")).filter(Boolean);
  // 자리 없는 방: 이어진 방(자리 있는) 곁, 입구에서 먼 쪽으로
  for (let pass = 0; pass < rooms.length; pass += 1) for (let i = 1; i < rooms.length; i += 1) {
    if (Number.isFinite(pos[i]!.x)) continue;
    const nb = nd.links.filter((l) => l.a === i || l.b === i).map((l) => (l.a === i ? l.b : l.a)).find((j) => Number.isFinite(pos[j]!.x));
    if (nb === undefined) continue;
    const away = { x: pos[nb]!.x - pos[0]!.x, y: pos[nb]!.y - pos[0]!.y };
    const len = Math.hypot(away.x, away.y) || 1;
    const th = Math.atan2(away.y / len, away.x / len) + (random() - 0.5) * 1.6;
    const step = rooms[nb]!.rx + rooms[i]!.rx + 6;
    pos[i] = { x: pos[nb]!.x + Math.cos(th) * step, y: pos[nb]!.y + Math.sin(th) * step * 0.8 };
  }
  for (let i = 0; i < rooms.length; i += 1) if (!Number.isFinite(pos[i]!.x)) pos[i] = { x: SW / 2 + (random() - 0.5) * 8, y: SH / 2 + (random() - 0.5) * 8 };
  if (missing.length) fixes.push(`고침: 방 ${missing.join("·")} 에 자리(at)가 없어 이어진 방 곁에 두었다 — at 으로 자리를 정할 수 있다.`);
  // ---- 겹침 밀기(조화): 방 상자가 벽 앞면 줄까지 겹치지 않게. 많이 민 방만 알린다. ----
  const start = pos.map((p) => ({ ...p }));
  const box = (i: number, p = pos[i]!) => { const b = bounds(lobeSets[i]!); return { x0: p.x + b.x0 - 1, x1: p.x + b.x1 + 1, y0: p.y + b.y0 - 4, y1: p.y + b.y1 + 1 }; };
  for (let it = 0; it < 200; it += 1) {
    let moved = false;
    for (let i = 0; i < rooms.length; i += 1) for (let j = i + 1; j < rooms.length; j += 1) {
      const a = box(i), b = box(j);
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 2, oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
      if (ox <= 0 || oy <= 0) continue;
      moved = true;
      const pi = pos[i]!, pj = pos[j]!;
      // 덜 겹친 축으로 반씩 민다(입구는 덜 움직인다)
      const wi = i === 0 ? 0.2 : 0.5, wj = 1 - wi;
      if (ox < oy) { const s = pi.x <= pj.x ? -1 : 1; pi.x += s * ox * wi; pj.x -= s * ox * wj; }
      else { const s = pi.y <= pj.y ? -1 : 1; pi.y += s * oy * wi; pj.y -= s * oy * wj; }
    }
    if (!moved) break;
  }
  const pushed = rooms.map((r, i) => ({ r, d: Math.hypot(pos[i]!.x - start[i]!.x, pos[i]!.y - start[i]!.y) })).filter((x) => x.d >= 4);
  if (pushed.length) fixes.push(`고침: 겹치는 방을 밀었다 — ${pushed.map((x) => `${x.r.id} ${Math.round(x.d)}칸`).join(", ")}.`);
  // ---- 당기기(조화): 이은 방 사이 빈 거리가 14칸을 넘으면 그 만큼 판 전체를 줄인다(방 크기는 그대로). ----
  {
    const gaps = nd.links.map((l) => { const a = box(l.a), b = box(l.b); return Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)); });
    const worst = Math.max(0, ...gaps);
    if (worst > 8) {
      const cx = pos.reduce((s, p) => s + p.x, 0) / pos.length, cy = pos.reduce((s, p) => s + p.y, 0) / pos.length;
      let k = 1;
      for (let t = 0; t < 20; t += 1) {
        const trial = pos.map((p) => ({ x: cx + (p.x - cx) * 0.9, y: cy + (p.y - cy) * 0.9 }));
        const overlap = rooms.some((_, i) => rooms.some((__, j) => { if (j <= i) return false; const a = box(i, trial[i]), b = box(j, trial[j]); return Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 2 > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1 > 0; }));
        if (overlap) break;
        k *= 0.9;
        const g2 = nd.links.map((l) => { const a = box(l.a, trial[l.a]), b = box(l.b, trial[l.b]); return Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1), Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1)); });
        pos.forEach((p, i) => { p.x = trial[i]!.x; p.y = trial[i]!.y; });
        if (Math.max(0, ...g2) <= 6) break;
      }
      if (k < 1) fixes.push(`고침: 이은 방 사이가 ${Math.round(worst)}칸까지 떨어져 한 화면이 거의 빈 굴이 돼 판을 ${Math.round((1 - k) * 100)}% 당겼다(자리 순서는 그대로).`);
    }
  }
  // ---- 판 크기: 방 상자 둘레 + 여백 ----
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  rooms.forEach((_, i) => { const b = box(i); x0 = Math.min(x0, b.x0); x1 = Math.max(x1, b.x1); y0 = Math.min(y0, b.y0); y1 = Math.max(y1, b.y1); });
  const offX = MARGIN + 3 - Math.floor(x0), offY = MARGIN + 4 - Math.floor(y0);
  const W = Math.max(40, Math.ceil(x1 - x0) + 2 * (MARGIN + 3) + 2), H = Math.max(34, Math.ceil(y1 - y0) + 2 * (MARGIN + 4) + 2);
  if (W > 200 || H > 150) throw new DungeonComposeError(`설계한 방 배치가 ${W}×${H} 로 너무 크다 — 방 크기·수를 줄이거나 floors 로 나눠라.`, "layout-failed");
  const C = pos.map((p) => ({ x: Math.round(p.x + offX), y: Math.round(p.y + offY) }));
  const g = new Grid(W, H);
  // ---- 통로: 모델이 적은 길만 ----
  const ent = rooms[0]!, ec = C[0]!;
  const entCore = { x0: ec.x - 3, x1: ec.x + 3, y0: ec.y - ent.ry + 1, y1: ec.y + ent.ry - 1 };   // 입구 계단 벽 아래 평평한 심
  /** 입구에서 나가는 길의 출발점: 다른 방 쪽 옆구리(북쪽 계단 벽을 뚫지 않게 — 북쪽 방이면 북쪽 모서리 옆). */
  const exitPoint = (to: { x: number; y: number }) => {
    const dx = to.x - ec.x, dy = to.y - ec.y;
    if (Math.abs(dx) >= Math.abs(dy) * 0.6 || dy < 0) return { x: ec.x + Math.sign(dx || 1) * (ent.rx - 1), y: ec.y + (dy < 0 ? -Math.max(0, ent.ry - 2) : 0) };
    return { x: ec.x + Math.sign(dx || 1) * 2, y: ec.y + ent.ry - 1 };
  };
  const passage = (a: { x: number; y: number }, b: { x: number; y: number }, kind: LinkKind, salt: number) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const steps = Math.ceil(len * 1.5);
    const nxv = -(b.y - a.y) / len, nyv = (b.x - a.x) / len;
    const amp = kind === "straight" ? 0 : Math.min(kind === "narrow" ? 4 : 7, len * 0.22);
    const phase = salt * 37.1;
    const r0 = kind === "narrow" ? 0.95 : kind === "wide" ? 1.9 : 1.3;
    const rv = kind === "narrow" ? 0.3 : 0.6;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const wob = (vnoise(t * len, phase, 6, seed) - 0.5) * 2 * amp * Math.sin(Math.PI * t);
      const x = a.x + (b.x - a.x) * t + nxv * wob, y = a.y + (b.y - a.y) * t + nyv * wob;
      carveDisc(g, x, y, r0 + vnoise(x, y, 5, seed + 3) * rv, -1);
    }
  };
  // 입구 심 위 벽 띠(아래에서 다시 벽으로 지킨다): 북쪽으로 가는 길이 띠를 비스듬히 지나면 끊겼다(2026-10-29 terra «물길굴» 판 — 가운데 방이 입구 바로 위).
  // 그런 길은 옆구리에서 띠 바깥 열로 곧게 올라간 뒤 굽이친다.
  const bandClear = (p: { x: number; y: number }, to: { x: number; y: number }) => {
    if (to.y >= entCore.y0) return undefined;
    const sx = Math.sign(p.x - ec.x || to.x - ec.x || 1);
    return { x: ec.x + sx * Math.max(ent.rx, 6), y: entCore.y0 - 6 };
  };
  nd.links.forEach((l, k) => {
    const pa = l.a === 0 ? exitPoint(C[l.b]!) : C[l.a]!, pb = l.b === 0 ? exitPoint(C[l.a]!) : C[l.b]!;
    const wp = l.a === 0 ? bandClear(pa, pb) : l.b === 0 ? bandClear(pb, pa) : undefined;
    if (wp && l.a === 0) { passage(pa, wp, "straight", k + 1); passage(wp, pb, l.kind, k + 1); }
    else if (wp) { passage(pa, wp, l.kind, k + 1); passage(wp, pb, "straight", k + 1); }
    else passage(pa, pb, l.kind, k + 1);
  });
  // ---- 방 ----
  rooms.forEach((r, i) => {
    const c = C[i]!;
    for (const lb of lobeSets[i]!) {
      const lx = c.x + lb.dx, ly = c.y + lb.dy;
      for (let y = ly - lb.ry - 2; y <= ly + lb.ry + 2; y += 1) for (let x = lx - lb.rx - 2; x <= lx + lb.rx + 2; x += 1) {
        if (!g.inb(x, y) || y < MARGIN + 4 || x < MARGIN || x >= W - MARGIN || y >= H - MARGIN) continue;
        const d = ((x - lx) / lb.rx) ** 2 + ((y - ly) / lb.ry) ** 2;
        const wob = (vnoise(x, y, 4.5, seed + i * 13) - 0.5) * (r.role === "entrance" ? 0.5 : 0.85);
        if (d < 1 + wob) { g.floor[g.idx(x, y)] = 1; g.roomAt[g.idx(x, y)] = i; }
      }
    }
    if (r.shape === "twin") {   // 두 잎 사이 목(폭 3)
      const [a, b] = lobeSets[i]!;
      passage({ x: c.x + a!.dx, y: c.y + a!.dy }, { x: c.x + b!.dx, y: c.y + b!.dy }, "straight", 99 + i);
    }
  });
  // 입구 심: 평평한 북벽 아래 네모(계단·문 자리) — 덩이 흔들림이 북벽을 울퉁불퉁하게 하면 계단을 못 건다.
  for (let y = entCore.y0; y <= entCore.y1; y += 1) for (let x = entCore.x0; x <= entCore.x1; x += 1) if (g.inb(x, y)) { g.floor[g.idx(x, y)] = 1; g.roomAt[g.idx(x, y)] = 0; }
  const entLock = (x: number, y: number) => x >= entCore.x0 - 2 && x <= entCore.x1 + 2 && y >= entCore.y0 - 4 && y <= entCore.y1 + 1;
  // 가장자리 안쪽으로
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (x < MARGIN || y < MARGIN + 4 || x >= W - MARGIN || y >= H - MARGIN) { g.floor[g.idx(x, y)] = 0; g.roomAt[g.idx(x, y)] = -1; }
  smooth(g, 3, entLock);
  // 입구 심 북벽 지키기: 심 위 세 줄은 벽(통로가 뚫지 않게 — exitPoint 가 옆구리로 나가게 했지만 흔들림이 닿을 수 있다).
  for (let y = entCore.y0 - 4; y < entCore.y0; y += 1) for (let x = entCore.x0 - 1; x <= entCore.x1 + 1; x += 1) if (g.inb(x, y)) { g.floor[g.idx(x, y)] = 0; g.roomAt[g.idx(x, y)] = -1; }
  // 고리: 가운데 섬(바위 — 물이 있는 방은 못)
  rooms.forEach((r, i) => {
    if (r.shape !== "ring") return;
    const c = C[i]!;
    const irx = Math.max(4, r.rx - 3), iry = Math.max(3, r.ry - 2);
    for (let y = c.y - iry; y <= c.y + iry; y += 1) for (let x = c.x - irx; x <= c.x + irx; x += 1) {
      if (!g.inb(x, y) || g.roomAt[g.idx(x, y)] !== i) continue;
      const d = ((x - c.x) / irx) ** 2 + ((y - c.y) / iry) ** 2;
      if (d >= 1 + (vnoise(x, y, 3, seed + i * 5) - 0.5) * 0.3) continue;
      if (r.water !== "none") g.liquid[g.idx(x, y)] = 1;
      else { g.floor[g.idx(x, y)] = 0; g.roomAt[g.idx(x, y)] = -1; }
    }
    if (r.water !== "none") r.water = "none";   // 고리의 못이 곧 그 방의 물
  });
  // 북벽 한 칸 이빨 고르기(layoutBlob 과 같은 규칙)
  for (let pass = 0; pass < 2; pass += 1) for (let x = 1; x < W - 1; x += 1) {
    if (x >= entCore.x0 - 2 && x <= entCore.x1 + 2) continue;
    for (let y = MARGIN + 5; y < H - MARGIN - 1; y += 1) {
      const i = g.idx(x, y);
      const top = (xx: number, yy: number) => g.floor[g.idx(xx, yy)] === 1 && g.floor[g.idx(xx, yy - 1)] === 0;
      if (top(x, y - 1) && g.floor[i] === 1 && top(x - 1, y) && top(x + 1, y)) { g.floor[g.idx(x, y - 1)] = 0; g.roomAt[g.idx(x, y - 1)] = -1; }
      else if (g.floor[i] === 0 && top(x, y + 1) && top(x - 1, y) && top(x + 1, y)) { g.floor[i] = 1; g.roomAt[i] = g.roomAt[g.idx(x, y + 1)]!; }
    }
  }
  // 작은 벽 섬은 메운다(고리 섬은 크다)
  fillSmallWallIslands(g, 30);
  // ---- 물: 방마다 설계대로 ----
  if (profile.liquid === "void") {
    // 마계: 통로는 허공(떠 있는 땅 사이) — 다리는 settle 이 놓는다. 입구 목은 마른 땅.
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const i = g.idx(x, y); if (g.floor[i] && g.roomAt[i] === -1 && !entLock(x, y)) g.liquid[i] = 1; }
  }
  const ed = edgeDistance(g, 7);
  const liquidOk = !!profile.liquid;
  // 물줄기는 입구가 아닌 이웃 굴로 흐른다 — 입구에만 이어진 방이면 웅덩이로(아래 웅덩이 규칙이 판다).
  const streamTo = (i: number) => nd.links.filter((l) => l.a === i || l.b === i).map((l) => (l.a === i ? l.b : l.a)).filter((j) => j !== 0);
  rooms.forEach((r, i) => {
    if (r.water !== "stream" || !liquidOk || streamTo(i).length) return;
    r.water = "pool";
    fixes.push(`고침: 방 ${r.id} 은 입구에만 이어져 물줄기가 흘러갈 굴이 없어 웅덩이로 지었다.`);
  });
  rooms.forEach((r, i) => {
    if (r.water === "none" || r.water === "stream" || !liquidOk) return;
    const c = C[i]!;
    let count = 0;
    const cells: number[] = [];
    for (let y = c.y - r.ry * 2 - 2; y <= c.y + r.ry * 2 + 2; y += 1) for (let x = c.x - r.rx * 2 - 2; x <= c.x + r.rx * 2 + 2; x += 1) {
      if (!g.inb(x, y) || g.roomAt[g.idx(x, y)] !== i) continue;
      const e = ed[g.idx(x, y)]!;
      if (r.water === "lake") {
        if (e < 2) continue;
        if (profile.liquid === "lava") { const d = ((x - c.x) / Math.max(2.5, r.rx - 1.5)) ** 2 + ((y - c.y) / Math.max(2, r.ry - 1.2)) ** 2; if (d > 1 + (vnoise(x, y, 2.5, seed + i * 7) - 0.5) * 0.3) continue; }
        else if (vnoise(x, y, 5, seed + i * 7) < 0.22) continue;
      } else {   // pool
        if (e < 3) continue;
        const d = ((x - c.x) / 3.2) ** 2 + ((y - c.y) / 2.2) ** 2;
        if (d > 1 + (vnoise(x, y, 3, seed + i) - 0.5) * 0.4) continue;
      }
      cells.push(g.idx(x, y)); count += 1;
    }
    if (r.water === "pool" && count < 10) { fixes.push(`고침: 방 ${r.id} 웅덩이 자리가 좁아(${count}칸) 마른 바닥으로 두었다 — 방을 키우면 웅덩이가 선다.`); return; }
    if (!count) { fixes.push(`고침: 방 ${r.id} 에 물을 담을 안쪽 바닥이 없어 마른 바닥으로 두었다.`); return; }
    for (const k of cells) g.liquid[k] = 1;
  });
  if (profile.id === "ice") rooms.forEach((r) => { if (r.water === "lake" || r.water === "pool") r.water = "none"; });   // 얼음: 호수 방(kind lake) = 얼어붙은 빙판(걷는다)
  // 다듬기(용암·허공·늪은 가장자리 그림이 모양이다)
  if (profile.liquid === "lava" || profile.liquid === "void" || profile.id === "swamp") for (let pass = 0; pass < 2; pass += 1) {
    const next = g.liquid.slice();
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
      const i = g.idx(x, y);
      if (!g.floor[i] || ed[i]! < 2) continue;
      let n = 0; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && g.liquid[g.idx(x + dx, y + dy)]) n += 1;
      if (g.liquid[i] && n <= 3) next[i] = 0; else if (!g.liquid[i] && n >= 5) next[i] = 1;
    }
    g.liquid.set(next);
  }
  // 물줄기: stream 방에서 길로 이어진 다음 방(입구에서 먼 쪽)까지 굽이치는 줄기 — 통로를 가로지르면 settle 이 다리를 놓는다.
  const depth = bfsDepth(rooms.length, nd.links);
  rooms.forEach((r, i) => {
    if (r.water !== "stream" || !liquidOk) return;
    // 보스·보물 방이 아닌 이웃을 먼저(깊은 쪽부터), 없으면 보스·보물 방까지 흐른다.
    const side = (j: number) => rooms[j]!.role === "boss" || rooms[j]!.role === "treasure" ? 1 : 0;
    const nbs = streamTo(i).sort((a, b) => side(a) - side(b) || depth[b]! - depth[a]!);
    if (!nbs.some((to) => stream(g, C[i]!, C[to]!, ed, seed + i * 31))) fixes.push(`고침: 방 ${r.id} 물줄기를 이웃 굴까지 그을 길이 짧거나 막혀 마른 바닥으로 두었다.`);
  });
  // 늪: 8칸 미만 외톨이 물 조각은 마른 땅으로
  if (profile.id === "swamp") dropSmallLiquid(g, 8);
  // 도달 고치기: 입구 심에서 마른 바닥(다리 포함)으로 닿지 않는 방은 가장 가까운 닿는 칸과 곧은 길로 잇는다(그 길의 액체는 걷어 낸다).
  // 벽 띠·물이 길을 끊은 판이 compose 의 «입구에서 걸어 닿지 않는 방»으로 짓기 전체가 실패했다(2026-10-29).
  for (let round = 0; round < rooms.length; round += 1) {
    const walk = (i: number) => g.floor[i] === 1 && (!g.liquid[i] || g.bridge[i] === 1);
    const seen = new Uint8Array(W * H); const q = [g.idx(ec.x, ec.y)]; seen[q[0]!] = 1;
    for (let k = 0; k < q.length; k += 1) {
      const c = q[k]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!g.inb(x + dx, y + dy)) continue; const n = g.idx(x + dx, y + dy); if (!seen[n] && walk(n)) { seen[n] = 1; q.push(n); } }
    }
    const lost = rooms.map((_, i) => i).filter((i) => { for (let c = 0; c < W * H; c += 1) if (g.roomAt[c] === i && seen[c]) return false; return true; });
    if (!lost.length) break;
    const i = lost[0]!, c = C[i]!;
    let best = -1, bd = Infinity;
    for (let n = 0; n < W * H; n += 1) if (seen[n]) { const x = n % W, y = (n - x) / W; if (entLock(x, y) && g.roomAt[n] !== 0) continue; const d = (x - c.x) ** 2 + (y - c.y) ** 2; if (d < bd) { bd = d; best = n; } }
    if (best < 0) break;
    const bx = best % W, by = (best - bx) / W, len = Math.ceil(Math.hypot(bx - c.x, by - c.y) * 1.5) || 1;
    for (let s2 = 0; s2 <= len; s2 += 1) {
      const x = Math.round(c.x + (bx - c.x) * s2 / len), y = Math.round(c.y + (by - c.y) * s2 / len);
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        if (Math.abs(dx) + Math.abs(dy) > 1 || !g.inb(x + dx, y + dy) || x + dx < MARGIN || y + dy < MARGIN + 4 || x + dx >= W - MARGIN || y + dy >= H - MARGIN) continue;
        const n = g.idx(x + dx, y + dy);
        if (!g.floor[n]) { g.floor[n] = 1; g.roomAt[n] = -1; }
        g.liquid[n] = 0;
      }
    }
    fixes.push(`고침: 방 ${rooms[i]!.id} 이 입구에서 걸어 닿지 않아(벽·물이 길을 끊음) 가장 가까운 닿는 굴과 곧은 길로 이었다.`);
  }
  // ---- 출력 ----
  const placed: PlacedRoom[] = rooms.map((r, i) => {
    const b = bounds(lobeSets[i]!);
    const parent = nd.links.filter((l) => l.a === i || l.b === i).map((l) => (l.a === i ? l.b : l.a)).filter((j) => depth[j]! < depth[i]!).sort((a, b2) => depth[a]! - depth[b2]!)[0];
    return {
      id: i === 0 ? "entrance" : r.role === "boss" ? "boss" : r.role === "treasure" ? "vault" : r.id, kind: KIND[r.role],
      x: C[i]!.x + b.x0, y: C[i]!.y + b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1,
      from: i === 0 ? null : parent === undefined ? "entrance" : parent === 0 ? "entrance" : rooms[parent]!.role === "boss" ? "boss" : rooms[parent]!.role === "treasure" ? "vault" : rooms[parent]!.id,
      dir: null, depth: depth[i]!, ...(r.features.length ? { features: r.features } : {}),
    };
  });
  // 같은 id 가 둘이면(설계 id 가 entrance·boss·vault 와 겹침) 뒤를 바꾼다
  const seenIds = new Set<string>();
  for (const p of placed) { let id = p.id; let k = 2; while (seenIds.has(id)) id = `${p.id}${k++}`; seenIds.add(id); p.id = id; }
  const corridors: PlacedCorridor[] = nd.links.map((l) => ({ a: placed[l.a]!.id, b: placed[l.b]!.id, dir: "N", rect: { x: Math.min(C[l.a]!.x, C[l.b]!.x), y: Math.min(C[l.a]!.y, C[l.b]!.y), w: 1, h: 1 } }));
  return cropToContent({ rooms: placed, corridors, width: W, height: H, notes: fixes, grid: g, entranceSide: nd.side });
}

/** a→b 굽이치는 줄기(가중 최단 길, 금지: 입구·보스·보물 방 칸). 방 안 깊은 칸은 폭 2. */
function stream(g: Grid, a: { x: number; y: number }, b: { x: number; y: number }, ed: Uint8Array, seed: number): boolean {
  const near = (p: { x: number; y: number }) => {
    for (let r = 0; r < 6; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) { const x = p.x + dx, y = p.y + dy; if (g.inb(x, y) && g.floor[g.idx(x, y)] && g.roomAt[g.idx(x, y)]! > 0) return g.idx(x, y); }
    return -1;
  };
  const s0 = near(a), t0 = near(b);
  if (s0 < 0 || t0 < 0) return false;
  const okCell = (i: number) => g.floor[i] === 1 && g.roomAt[i] !== 0;
  const prev = new Int32Array(g.W * g.H).fill(-2); prev[s0] = -1;
  const dist = new Int32Array(g.W * g.H).fill(1 << 30); dist[s0] = 0;
  const buckets: number[][] = [[s0]];
  for (let d = 0; d < buckets.length && prev[t0] === -2; d += 1) for (const c of buckets[d] ?? []) {
    if (dist[c] !== d) continue;
    const x = c % g.W, y = (c / g.W) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!g.inb(x + dx, y + dy)) continue;
      const n = g.idx(x + dx, y + dy);
      if (!okCell(n)) continue;
      const nd = d + 1 + Math.floor(vnoise(x + dx, y + dy, 2.5, seed + 77) * 9);
      if (nd >= dist[n]!) continue;
      dist[n] = nd; prev[n] = c; (buckets[nd] ??= []).push(n);
    }
  }
  if (prev[t0] === -2) return false;
  const path: number[] = [];
  for (let c = t0; c >= 0; c = prev[c]!) path.push(c);
  if (path.length < 8) return false;
  for (const c of path) { g.liquid[c] = 1; if (ed[c]! >= 2 && g.roomAt[c]! > 0) { const r = c + 1; if (ed[r]! >= 2) g.liquid[r] = 1; } }
  return true;
}

function dropSmallLiquid(g: Grid, min: number): void {
  const seen = new Uint8Array(g.W * g.H);
  for (let s0 = 0; s0 < g.W * g.H; s0 += 1) {
    if (seen[s0] || !g.liquid[s0] || !g.floor[s0]) continue;
    const comp = [s0]; seen[s0] = 1;
    for (let k = 0; k < comp.length; k += 1) {
      const c = comp[k]!, x = c % g.W, y = (c - x) / g.W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!g.inb(x + dx, y + dy)) continue; const n = g.idx(x + dx, y + dy); if (!seen[n] && g.liquid[n] && g.floor[n]) { seen[n] = 1; comp.push(n); } }
    }
    if (comp.length < min) for (const c of comp) g.liquid[c] = 0;
  }
}

function fillSmallWallIslands(g: Grid, maxArea: number): void {
  const seen = new Uint8Array(g.W * g.H);
  for (let i0 = 0; i0 < g.W * g.H; i0 += 1) {
    if (g.floor[i0] || seen[i0]) continue;
    const comp = [i0]; seen[i0] = 1; let border = false;
    for (let k = 0; k < comp.length; k += 1) {
      const i = comp[k]!, x = i % g.W, y = (i - x) / g.W;
      if (x === 0 || y === 0 || x === g.W - 1 || y === g.H - 1) border = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (!g.inb(nx, ny)) continue; const j = g.idx(nx, ny); if (!g.floor[j] && !seen[j]) { seen[j] = 1; comp.push(j); } }
    }
    if (border || comp.length > maxArea) continue;
    for (const i of comp) {
      const x = i % g.W, y = (i - x) / g.W;
      let room = -1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const r = g.inb(x + dx, y + dy) ? g.roomAt[g.idx(x + dx, y + dy)]! : -1; if (r >= 0) { room = r; break; } }
      g.floor[i] = 1; g.roomAt[i] = room;
    }
  }
}

/** 열린 칸 둘레로 맵을 줄인다(layoutBlob 과 같은 여백). */
function cropToContent<T extends DungeonLayout & { grid: Grid }>(layout: T): T {
  const g = layout.grid;
  let x0 = g.W, y0 = g.H, x1 = -1, y1 = -1;
  for (let y = 0; y < g.H; y += 1) for (let x = 0; x < g.W; x += 1) if (g.floor[g.idx(x, y)]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) throw new DungeonComposeError("설계한 굴에 바닥이 하나도 없다.", "layout-failed");
  const nx0 = Math.max(0, x0 - MARGIN - 1), ny0 = Math.max(0, y0 - (MARGIN + 4)), nx1 = Math.min(g.W - 1, x1 + MARGIN + 1), ny1 = Math.min(g.H - 1, y1 + MARGIN + 1);
  const W = nx1 - nx0 + 1, H = ny1 - ny0 + 1;
  const out = new Grid(W, H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const si = g.idx(x + nx0, y + ny0), di = out.idx(x, y);
    out.floor[di] = g.floor[si]!; out.roomAt[di] = g.roomAt[si]!; out.liquid[di] = g.liquid[si]!; out.bridge[di] = g.bridge[si]!; out.protect[di] = g.protect[si]!;
  }
  const mv = <R extends { x: number; y: number }>(r: R): R => ({ ...r, x: r.x - nx0, y: r.y - ny0 });
  return { ...layout, rooms: layout.rooms.map(mv), corridors: layout.corridors.map((c) => ({ ...c, rect: mv(c.rect) })), width: W, height: H, grid: out };
}

// ---------------------------------------------------------------- 방+통로 문법: 설계 → rooms

const ROOM_ROLE_KIND: Partial<Record<DungeonType, Partial<Record<Role, DungeonRoomKind>>>> = {
  catacomb: { hall: "hall", camp: "cell", shrine: "shrine", grotto: "crypt", lake: "hall" },
  castle: { hall: "hall", camp: "storage", shrine: "shrine", grotto: "cell", lake: "hall" },
  temple: { hall: "nave", camp: "storage", shrine: "shrine", grotto: "crypt", lake: "nave" },
  pyramid: { hall: "hall", camp: "storage", shrine: "shrine", grotto: "crypt", lake: "hall" },
  tower: { hall: "hall", camp: "storage", shrine: "shrine", grotto: "library", lake: "hall" },
  sewer: { hall: "channel", camp: "storage", shrine: "pump", grotto: "storage", lake: "cistern" },
  mine: { hall: "junction", camp: "depot", shrine: "stope", grotto: "stope", lake: "junction" },
};
const RECT_SIZE: Record<string, [number, number]> = { small: [8, 6], medium: [11, 8], large: [15, 10], huge: [19, 12] };

/**
 * 방+통로 던전: 설계의 방(역할·크기)·길·자리를 rooms 목록으로 옮긴다 — 첫 방 = 입구, from = 길로 이어진 앞 방(입구에서 가까운 쪽),
 * dir = 앞 방에서 이 방으로 가는 방향(두 방의 at 비교, 큰 축). 고리 길(나무 밖 길)은 layout loop 로만 그린다(알린다).
 */
export function designToRooms(design: DungeonDesign, type: DungeonType, profile: GrammarInfo): { rooms: DungeonRoomInput[]; fixes: string[]; loop: boolean } {
  const nd = normalizeDesign(design, profile);
  const fixes = nd.fixes.filter((f) => !/물|용암|웅덩이/u.test(f));
  const map = ROOM_ROLE_KIND[type] ?? {};
  const depth = bfsDepth(nd.rooms.length, nd.links);
  const order = nd.rooms.map((_, i) => i).sort((a, b) => depth[a]! - depth[b]! || a - b);
  const idOf = (i: number) => (i === 0 ? "entrance" : nd.rooms[i]!.role === "boss" ? "boss" : nd.rooms[i]!.role === "treasure" ? "vault" : nd.rooms[i]!.id);
  const rooms: DungeonRoomInput[] = [];
  const treeLinks = new Set<string>();
  for (const i of order) {
    const r = nd.rooms[i]!;
    const kind: DungeonRoomKind = r.role === "entrance" ? "entrance" : r.role === "boss" ? "boss" : r.role === "treasure" ? "vault" : map[r.role] ?? "hall";
    const s = String((design.rooms ?? [])[nd.rooms.indexOf(r)]?.size ?? "").toLowerCase();
    const [w, h] = /huge|giant|거대/u.test(s) ? RECT_SIZE.huge! : /large|big|큰/u.test(s) ? RECT_SIZE.large! : /small|tiny|작/u.test(s) ? RECT_SIZE.small! : r.rx * 2 >= 6 && r.ry * 2 >= 5 && !s ? [Math.min(24, r.rx * 2 + 1), Math.min(16, r.ry * 2)] : RECT_SIZE.medium!;
    const parent = i === 0 ? undefined : nd.links.filter((l) => l.a === i || l.b === i).map((l) => (l.a === i ? l.b : l.a)).filter((j) => depth[j]! < depth[i]!).sort((a, b) => depth[a]! - depth[b]!)[0];
    let dir: "N" | "S" | "W" | "E" | undefined;
    if (parent !== undefined) {
      treeLinks.add(`${Math.min(i, parent)}-${Math.max(i, parent)}`);
      const p = nd.rooms[parent]!.at, q = r.at;
      if (p && q) { const dx = q[0] - p[0], dy = q[1] - p[1]; dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N"; }
    }
    rooms.push({ id: idOf(i), kind, w, h, ...(parent !== undefined ? { from: idOf(parent) } : {}), ...(dir ? { dir } : {}), ...(r.shape === "ring" ? { shape: "round" as const } : {}) });
  }
  const loop = nd.links.some((l) => !treeLinks.has(`${Math.min(l.a, l.b)}-${Math.max(l.a, l.b)}`));
  if (nd.rooms.some((r) => r.shape !== "blob" && r.shape !== "ring")) fixes.push(`고침: ${profile.label} 은 네모 방+통로라 방 모양(cavern·long·shaft·twin)은 크기로만 옮겼다 — 고리(ring)는 팔각 방.`);
  if (nd.rooms.some((r) => r.water !== "none") && type !== "sewer") fixes.push(`고침: ${profile.label} 방에는 물을 설계대로 칠하지 못한다 — 잠긴 던전은 features 에 flooded.`);
  if (loop) fixes.push("고침: 나무 밖 길(고리)은 방+통로 던전에서 layout loop 의 지름길 하나로 그렸다.");
  return { rooms, fixes, loop };
}
