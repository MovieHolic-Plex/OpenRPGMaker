// 장소 구성 문법(2026-11-23 map-variety): 계획(어떤 모양의 장소인가)과 시공(빌더)을 나눈다.
// 오너: «결정론 빌더가 너무 뻔하게 똑같은 것만 짓는다» — 설계 없이 지은 마을·숲·동굴이 요청이 달라도 같은 문법 한 벌(뭉친 굴·남쪽 입구·
// 강 하나 낀 길가 마을)로 수렴했다. 여기서는 종류마다 문법 여럿과 매개변수(입구 쪽·방 수·자리 흔들기)를 두고,
// 사용자 글(원문만 — #4956)과 장소 이름의 낱말로 문법을 고른다. 낱말이 없으면 게임 열쇠·장소 이름의 해시로 고른다.
// 결과는 이미 있는 시공 입력이다: 동굴·숲은 dungeonDesign(designLayout.ts 가 설계대로 판다), 마을은 author_beodeul_town 손잡이.
// 모델이 계획을 직접 주면(spec.dungeonDesign · hints.layout · hints.grammar) 그것이 이긴다.
import type { DungeonDesign, DungeonDesignRoom } from "@/editor/dungeonKit/designLayout";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import type { PlaceSpec } from "../shared/types";

export type PlaceGrammarKind = "cave" | "forest" | "village";
export type Side = "south" | "north" | "west" | "east";

export interface GrammarPick { readonly kind: PlaceGrammarKind; readonly grammar: string; readonly why: "plan" | "words" | "hash"; readonly side: Side; readonly seed: number }

const hash = (s: string): number => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 2166136261);

/** 사용자 글: spec.variety = `<게임 열쇠>|<요청문>[|<세션 덧값>]` 에서 요청문만, 조립 지시문(의도 메모 뒤)은 뗀다. */
export function userWordsOf(spec: PlaceSpec): string {
  const v = spec.variety ?? "";
  const bar = v.indexOf("|");
  if (bar < 0) return "";
  return withoutIntentNote(v.slice(bar + 1));
}

/** 유사도 관문이 다시 지을 때 넘기는 «이미 쓴 문법»(hints.avoidGrammars — 쉼표로 이은 문법 id). */
export function avoidGrammars(spec: PlaceSpec): string[] {
  const v = spec.hints?.avoidGrammars;
  return typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** 게임 열쇠(variety 의 첫 칸) — 같은 게임 안 같은 낱말은 같은 문법, 다른 게임은 다른 문법이 되게 해시에 섞는다. */
const gameKeyOf = (spec: PlaceSpec): string => (spec.variety ?? "").split("|")[0] ?? "";

interface GrammarRule { readonly id: string; readonly words: RegExp; readonly hashable: boolean }

/** 문법별 낱말. 장소 이름 낱말이 요청 글 낱말보다 먼저다(«지하 호수 동굴» 이름이면 그 굴이 호수 굴). */
export const GRAMMARS: Readonly<Record<PlaceGrammarKind, readonly GrammarRule[]>> = {
  cave: [
    { id: "lake", words: /지하\s*호수|호수|물웅덩이|샘|underground lake|lake|pool/u, hashable: true },
    { id: "branch", words: /갈래|갈림|분기|미로|미궁|여러\s*갈|branch|fork|maze|labyrinth/u, hashable: true },
    { id: "corridor", words: /갱도|폐광|땅굴|굴길|일자|긴\s*굴|터널|tunnel|mine|shaft/u, hashable: true },
    { id: "descent", words: /깊은|아래로|내려가|밑바닥|지하\s*깊|낭떠러지|deep|descent|abyss/u, hashable: true },
    { id: "den", words: /소굴|둥지|굴\s*집|은신|도적|늑대\s*굴|lair|den|hideout|nest/u, hashable: true },
  ],
  forest: [
    { id: "creek", words: /개울|시내|냇물|냇가|물안개|강|creek|stream|brook|river/u, hashable: true },
    { id: "clearing", words: /공터|빈터|꽃밭|꽃\s*공터|들판|clearing|glade|meadow/u, hashable: true },
    { id: "cliff", words: /절벽|벼랑|언덕|산길|비탈|고개|cliff|ridge|hill|slope/u, hashable: true },
    { id: "trail", words: /오솔길|숲길|외길|산책|길을\s*따라|trail|path|road/u, hashable: true },
    { id: "thicket", words: /울창|깊은\s*숲|빽빽|정령|덩굴|미로|thicket|dense|tangled/u, hashable: true },
  ],
  village: [
    { id: "harbor", words: /바닷가|바다|항구|포구|어촌|해안|부두|harbou?r|coast|port|seaside/u, hashable: false },
    { id: "riverline", words: /강가|강변|방앗간|나루|다리|물레|riverbank|mill|ferry/u, hashable: true },
    { id: "terraced", words: /언덕|비탈|계단식|포도밭|다랑|산마을|hill|terrace|vineyard|slope/u, hashable: false },
    { id: "plaza", words: /광장|장터|시장|교역|상인|우물|plaza|square|market|trade/u, hashable: true },
    { id: "crossroads", words: /교차로|네거리|사거리|갈림길|여관|여행자|crossroads|junction|inn/u, hashable: true },
    { id: "scatter", words: /흩어진|농가|농장|산골|목장|외딴|scatter|farmstead|farm|hamlet/u, hashable: true },
    { id: "glade", words: /숲속|나무꾼|숲\s*마을|빈터|울창|woodcutter|forest village|glade/u, hashable: true },
  ],
};

const SIDE_WORDS: readonly [Side, RegExp][] = [["north", /북쪽|북문|north/u], ["west", /서쪽|서문|west/u], ["east", /동쪽|동문|east/u], ["south", /남쪽|남문|south/u]];

/** 장소 종류: 명세가 그 문법을 쓰는 종류인가(동굴·숲·바깥 마을만). */
export function grammarKindOf(spec: PlaceSpec): PlaceGrammarKind | undefined {
  const theme = `${spec.theme ?? ""} ${String(spec.hints?.type ?? "")}`.toLowerCase();
  if (spec.type === "cave" && !/volcano|ice|swamp|otherworld/u.test(theme)) return "cave";
  if (spec.type === "dungeon" && /\bcave\b/u.test(theme)) return "cave";
  if (spec.type === "dungeon" && /forest/u.test(theme)) return "forest";
  if (spec.type === "village" && !spec.style) return "village";
  return undefined;
}

/**
 * 문법 고르기: (1) 모델이 hints.grammar 로 준 문법 (2) 장소 이름 낱말 (3) 사용자 글 낱말 (4) 해시.
 * avoid: 같은 게임에서 이미 쓴 문법(유사도 관문이 넘긴다) — 낱말로 고른 것도 그 목록에 있으면 다음 후보로 간다.
 */
export function pickGrammar(spec: PlaceSpec, kind: PlaceGrammarKind, avoid: readonly string[] = []): GrammarPick {
  const rules = GRAMMARS[kind];
  const name = `${spec.name ?? ""} ${spec.theme ?? ""} ${(spec.features ?? []).join(" ")}`.toLowerCase();
  const user = userWordsOf(spec).toLowerCase();
  const seed = (hash(`${gameKeyOf(spec)}|${spec.name ?? ""}|${kind}`) ^ (spec.salt ?? 0)) >>> 0;
  const said = SIDE_WORDS.find(([, re]) => re.test(name))?.[0];
  const side: Side = said ?? (["south", "west", "east", "north"] as const)[(seed >>> 3) % (kind === "village" ? 1 : 4)]!;
  const asked = typeof spec.hints?.grammar === "string" ? spec.hints.grammar.trim() : "";
  if (asked && rules.some((r) => r.id === asked)) return { kind, grammar: asked, why: "plan", side, seed };
  const ok = (r: GrammarRule) => !avoid.includes(r.id);
  for (const text of [name, user]) {
    const hit = rules.filter((r) => r.words.test(text));
    // 낱말이 여럿 맞으면 이름·글에서 먼저 나온 낱말의 문법(«숲 너머 동굴의 호수» 는 호수)
    hit.sort((a, b) => (text.search(a.words) - text.search(b.words)));
    const first = hit.find(ok);
    if (first) return { kind, grammar: first.id, why: "words", side, seed };
  }
  const pool = rules.filter((r) => r.hashable && ok(r));
  const from = pool.length ? pool : rules.filter((r) => r.hashable);
  return { kind, grammar: from[seed % from.length]!.id, why: "hash", side, seed };
}

// ---------------------------------------------------------------- 동굴·숲: 설계 만들기

type V2 = readonly [number, number];
/** 입구 쪽에 맞춰 남쪽 기준 자리(x 가로, y 깊이 0 입구 → 1 가장 안)를 맵 비율로 돌린다. mirror 는 좌우 뒤집기. */
function place(side: Side, mirror: boolean, [x0, depth]: V2): string {
  // 가장자리(0.1·0.9)의 방은 반지름만큼 맵을 넓혔다(동굴 57×44, 빈 칸 97%) — 자리를 가운데로 모은다(격치면 설계 빌더가 밀어 둔다).
  const x = 0.3 + 0.4 * (mirror ? 1 - x0 : x0);
  const d = 0.72 - depth * 0.44;
  const [px, py] = side === "south" ? [x, d] : side === "north" ? [1 - x, 1 - d] : side === "west" ? [1 - d, x] : [d, 1 - x];
  return `${px.toFixed(2)},${py.toFixed(2)}`;
}

function rnd(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

interface Plan { readonly rooms: readonly (Omit<DungeonDesignRoom, "at"> & { at: V2 })[]; readonly links?: readonly [string, string, string?][]; readonly connections?: string }

/** 문법 → 남쪽 입구 기준 방 목록. 자리는 [가로 0~1, 깊이 0~1]. */
function caveOrForestPlan(kind: "cave" | "forest", grammar: string, r: () => number): Plan {
  const j = (v: number, k = 0.06) => v + (r() - 0.5) * 2 * k;
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const hall = kind === "forest" ? "clearing" : "hall";
  const feat = kind === "forest" ? ["mushrooms", "boulders"] : ["stalagmites", "crystals", "boulders", "bones"];
  switch (grammar) {
    case "lake": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
        { id: "lake", role: "lake", size: "large", water: "lake", at: [j(0.5, 0.05), j(0.5)] },
        { id: "shore_w", role: "grotto", size: "small", features: [pick(feat)], at: [j(0.12), j(0.45)] },
        { id: "shore_e", role: "treasure", size: "small", at: [j(0.88), j(0.55)] },
        { id: "boss", role: "boss", size: "large", at: [j(0.5), 1] },
      ],
      links: [["entrance", "lake"], ["lake", "shore_w"], ["lake", "shore_e"], ["shore_w", "boss"], ["shore_e", "boss", "narrow"]],
    };
    case "branch": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
        { id: "fork", role: "hall", size: "medium", at: [j(0.5), j(0.4)] },
        { id: "left", role: "grotto", size: "small", features: [pick(feat)], at: [j(0.2), j(0.3)] },
        { id: "right", role: "treasure", size: "small", at: [j(0.8), j(0.35)] },
        { id: "boss", role: "boss", size: "large", at: [j(0.65), 1] },
      ],
      links: [["entrance", "fork"], ["fork", "left", "narrow"], ["fork", "right", "narrow"], ["fork", "boss"]],
    };
    case "corridor": {
      const zig = r() < 0.5 ? 1 : -1;
      return {
        rooms: [
          { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
          { id: "gallery1", role: "hall", size: "medium", shape: "long", dir: "ns", features: [pick(feat)], at: [0.5 + 0.18 * zig, j(0.3)] },
          { id: "gallery2", role: "grotto", size: "medium", shape: "long", dir: "ew", at: [0.5 - 0.2 * zig, j(0.6)] },
          { id: "boss", role: "boss", size: "large", at: [0.5 + 0.15 * zig, 1] },
        ],
        connections: "linear",
      };
    }
    case "descent": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.3), 0] },
        { id: "ledge", role: "hall", size: "small", at: [j(0.7), j(0.3)] },
        { id: "shaft", role: "grotto", size: "small", shape: "shaft", at: [j(0.25), j(0.6)] },
        { id: "treasure", role: "treasure", size: "small", at: [j(0.85), j(0.7)] },
        { id: "boss", role: "boss", size: "medium", at: [j(0.5), 1] },
      ],
      connections: "linear",
    };
    case "den": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
        { id: "den", role: "camp", size: "medium", shape: "twin", features: ["camp", "bones"], at: [j(0.5), j(0.55)] },
        { id: "stash", role: "treasure", size: "small", at: [j(0.12), j(0.75)] },
        { id: "boss", role: "boss", size: "large", at: [j(0.75), 1] },
      ],
      connections: "linear",
    };
    case "creek": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
        { id: "ford", role: "hall", size: "medium", shape: "long", dir: "ew", water: "stream", features: ["bridge"], at: [j(0.35), j(0.3)] },
        { id: "pool", role: "lake", size: "large", water: "lake", at: [j(0.7), j(0.6)] },
        { id: "bank", role: "grotto", size: "medium", features: [pick(feat)], at: [j(0.15), j(0.7)] },
        { id: "boss", role: "boss", size: "large", at: [j(0.5), 1] },
      ],
      links: [["entrance", "ford"], ["ford", "pool"], ["ford", "bank"], ["pool", "boss"], ["bank", "boss"]],
    };
    case "clearing": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
        { id: hall, role: "hall", size: "huge", shape: "cavern", at: [j(0.5, 0.04), j(0.5, 0.04)] },
        { id: "nook_w", role: "grotto", size: "small", features: [pick(feat)], at: [j(0.08), j(0.4)] },
        { id: "nook_e", role: "treasure", size: "small", at: [j(0.92), j(0.4)] },
        { id: "boss", role: "boss", size: "large", at: [j(0.5), 1] },
      ],
      connections: "hub",
    };
    case "cliff": return {
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.2), 0] },
        { id: "lower", role: "hall", size: "medium", shape: "long", dir: "ew", at: [j(0.55), j(0.25)] },
        { id: "ledge", role: "grotto", size: "medium", level: 1, features: ["boulders"], at: [j(0.85), j(0.55)] },
        { id: "overlook", role: "shrine", size: "small", level: 1, at: [j(0.3), j(0.7)] },
        { id: "boss", role: "boss", size: "large", level: 2, at: [j(0.6), 1] },
      ],
      connections: "linear",
    };
    case "trail": {
      const lean = r() < 0.5 ? 0.15 : 0.85;
      return {
        rooms: [
          { id: "entrance", role: "entrance", size: "small", at: [lean, 0] },
          { id: "bend1", role: "grotto", size: "small", features: [pick(feat)], at: [j(0.5), j(0.3)] },
          { id: "bend2", role: "hall", size: "medium", shape: "long", dir: "ew", at: [1 - lean, j(0.55)] },
          { id: "bend3", role: "treasure", size: "small", at: [j(0.5), j(0.78)] },
          { id: "boss", role: "boss", size: "large", at: [lean, 1] },
        ],
        connections: "linear",
      };
    }
    default: return {   // thicket — 작은 빈터 여럿이 고리로
      rooms: [
        { id: "entrance", role: "entrance", size: "small", at: [j(0.5), 0] },
        { id: "a", role: "grotto", size: "small", features: [pick(feat)], at: [j(0.15), j(0.3)] },
        { id: "b", role: "hall", size: "medium", at: [j(0.8), j(0.3)] },
        { id: "c", role: "treasure", size: "small", at: [j(0.2), j(0.7)] },
        { id: "d", role: "grotto", size: "small", at: [j(0.8), j(0.7)] },
        { id: "boss", role: "boss", size: "large", at: [j(0.5), 1] },
      ],
      links: [["entrance", "a"], ["entrance", "b"], ["a", "c", "narrow"], ["b", "d", "narrow"], ["c", "boss"], ["d", "boss"], ["a", "b", "narrow"]],
    };
  }
}

/** 동굴·숲 문법 → dungeonDesign(입구 쪽·좌우 뒤집기·자리 흔들기는 씨앗). */
export function grammarDesign(pick: GrammarPick): DungeonDesign {
  const r = rnd(pick.seed);
  const plan = caveOrForestPlan(pick.kind === "forest" ? "forest" : "cave", pick.grammar, r);
  const mirror = r() < 0.5;
  // 방마다 특징 셋 — 설계 동굴은 특징이 소품을 놓는다. 하나씩이면 동굴이 전(설계 없는 굴)보다 빈 칸이 많았다(소품 4.0 대 5.7/100칸).
  const extra = pick.kind === "forest" ? ["mushrooms", "boulders"] : ["stalagmites", "crystals", "boulders", "mushrooms"];
  const dressed = (room: Plan["rooms"][number], i: number): Plan["rooms"][number] => {
    if (room.role === "entrance") return room;
    const have = [...(room.features ?? [])];
    for (let k = 0; have.length < 3 && k < extra.length; k++) { const f = extra[(i + k) % extra.length]!; if (!have.includes(f)) have.push(f); }
    return { ...room, features: have };
  };
  return {
    entrance: pick.side,
    rooms: plan.rooms.map((room, i) => ({ ...dressed(room, i), at: place(pick.side, mirror, room.at) })),
    ...(plan.links ? { links: plan.links.map(([from, to, kind]) => ({ from, to, ...(kind ? { kind } : {}) })) } : {}),
    ...(plan.connections ? { connections: plan.connections } : {}),
  };
}

// ---------------------------------------------------------------- 마을: 시공 손잡이

/** 마을 문법 → author_beodeul_town 인자(요청이 이미 정한 값은 덮지 않는다 — 부르는 쪽이 own 을 뒤에 펼친다). */
export function villageGrammarArgs(pick: GrammarPick): Record<string, unknown> {
  const r = rnd(pick.seed);
  const high = (["north", "west", "east"] as const)[Math.floor(r() * 3)]!;
  switch (pick.grammar) {
    case "harbor": return { theme: "coast", harbour: true };
    case "riverline": return { theme: "river", form: "riverbank", water: "river" };
    case "terraced": return { theme: "river", landform: r() < 0.5 ? "terraces" : "slope", tiers: 2, high, water: "none" };
    case "plaza": return { theme: "river", form: "plaza", water: "none", landform: "flat", terrain: "flat" };
    // 코드 지형(기본)은 form·water·woods 를 거의 안 보고 북쪽 단 띠·옆 강·같은 집 줄로 지었다(2026-11-23 탐침). 띠 지형(bands)은 손잡이를
    // 그림에 내지만 남쪽에 가로 강을 내고(water none·layout.exits 를 안 본다) 다리 없는 판은 강 건너 밭에 못 갔다(도달 77~88%).
    // 그래서 띠 지형은 흩어진 마을(나루 널다리가 서는 꼴)에만 쓴다.
    case "crossroads": return { theme: "river", form: "street", water: "none", layout: { exits: r() < 0.5 ? ["west", "east"] : ["north", "south"] } };
    case "scatter": return { theme: "river", form: "scatter", woods: "edge", terrainGen: "bands" };
    default: return { theme: "river", woods: "dense", water: "none", form: "street" };   // glade
  }
}
