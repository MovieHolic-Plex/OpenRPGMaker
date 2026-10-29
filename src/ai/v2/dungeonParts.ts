// 던전·동굴을 조수가 설계하기 전에 보는 재료(2026-10-29 「맵은 조수가 설계한다 — 함수는 조화·검사만」).
// dungeon_parts 동사: 모양·역할·물·특징·잇는 모양 어휘 + 서로 다른 설계 예시(한 공식이 아니다) + 그 예시를 지금 빌더로 실제로 지은 1배 그림.
// 예시는 참고 — 카드가 「베끼지 않는다」고 적는다. 설계 형식은 src/editor/dungeonKit/designLayout.ts DungeonDesign.
import type { PiToolExecResult, PiToolShape } from "@/ai/piAgent/toolAdapter";
import { DESIGN_FEATURES, DESIGN_SHAPES, type DungeonDesign } from "@/editor/dungeonKit/designLayout";
export { DUNGEON_DESIGN_SCHEMA } from "@/editor/dungeonKit/designLayout";
import { GRAMMAR, inferDungeonType } from "@/editor/dungeonKit/grammar";
import type { DungeonType } from "@/editor/dungeonKit/types";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import { createBuildRun } from "./buildRun";
import type { PiAssistantV2Env } from "./env";
import type { PlaceRecord } from "./types";

/** 서로 다른 뼈대의 예시 — 한 공식(덩이+호수+아래 입구)을 되풀이하지 않게 입구 쪽·연결 모양·모양·물이 모두 다르다. */
export const DUNGEON_DESIGN_EXAMPLES: readonly { readonly name: string; readonly ko: string; readonly design: DungeonDesign }[] = [
  {
    name: "branch-north", ko: "갈래 굴 — 남쪽 입구, 가운데 큰 굴에서 세 갈래, 북쪽 고리 보스",
    design: {
      entrance: "south", rooms: [
        { id: "입구굴", role: "entrance", size: "medium", at: "s" },
        { id: "큰굴", role: "hall", shape: "cavern", size: "large", at: "0.5,0.55", features: ["stalagmites"] },
        { id: "수정굴", role: "treasure", size: "small", at: "0.12,0.45", features: ["crystals"] },
        { id: "물굴", role: "lake", shape: "long", dir: "ew", size: "medium", at: "0.85,0.6", water: "lake" },
        { id: "둥지", role: "boss", shape: "ring", size: "large", at: "0.5,0.1", features: ["bones"] },
      ],
      links: [{ from: "입구굴", to: "큰굴" }, { from: "큰굴", to: "수정굴", kind: "narrow" }, { from: "큰굴", to: "물굴" }, { from: "큰굴", to: "둥지", kind: "wide" }],
    },
  },
  {
    name: "chain-east", ko: "물줄기 따라 동쪽으로 — 서쪽 입구, 길쭉한 굴·세로 틈 사슬, 동쪽 끝 보스",
    design: {
      entrance: "west", rooms: [
        { id: "갱구", role: "entrance", size: "medium", at: "w" },
        { id: "샘굴", role: "grotto", shape: "long", dir: "ew", size: "medium", at: "0.3,0.4", water: "stream", features: ["mushrooms"] },
        { id: "틈", role: "hall", shape: "shaft", size: "small", at: "0.52,0.6" },
        { id: "야영지", role: "camp", shape: "twin", size: "medium", at: "0.72,0.35", features: ["camp"] },
        { id: "옥좌굴", role: "boss", shape: "blob", size: "large", at: "e", features: ["pillars"] },
      ],
      connections: "linear",
    },
  },
  {
    name: "loop-lake", ko: "호수 둘레 고리 — 동쪽 입구, 가운데 호수를 두 길로 돌아 서쪽 보스",
    design: {
      entrance: "east", rooms: [
        { id: "입구", role: "entrance", size: "medium", at: "e" },
        { id: "북굴", role: "hall", size: "medium", at: "0.5,0.12", features: ["boulders"] },
        { id: "호수", role: "lake", shape: "cavern", size: "large", at: "center", water: "lake" },
        { id: "남굴", role: "grotto", size: "medium", at: "0.45,0.88", features: ["mushrooms"] },
        { id: "보물", role: "treasure", size: "small", at: "0.15,0.85" },
        { id: "보스", role: "boss", size: "large", at: "0.12,0.3", features: ["bones"] },
      ],
      links: [{ from: "입구", to: "북굴" }, { from: "입구", to: "남굴" }, { from: "북굴", to: "보스" }, { from: "남굴", to: "호수" }, { from: "호수", to: "보스", kind: "narrow" }, { from: "남굴", to: "보물" }],
    },
  },
  {
    name: "hub-down", ko: "허브 — 북쪽 입구, 한가운데 제단 굴에서 사방, 남쪽 깊은 곳 보스",
    design: {
      entrance: "north", rooms: [
        { id: "입구", role: "entrance", size: "medium", at: "n" },
        { id: "제단굴", role: "shrine", shape: "ring", size: "large", at: "center", water: "pool" },
        { id: "서굴", role: "grotto", shape: "long", dir: "ns", size: "medium", at: "w", features: ["stalagmites"] },
        { id: "동굴", role: "hall", size: "medium", at: "e", features: ["crystals"] },
        { id: "깊은굴", role: "boss", shape: "cavern", size: "large", at: "s", features: ["bones"] },
      ],
      connections: "hub",
    },
  },
];

/**
 * 참고 그림(2026-10-30 사용자 지시): 사람이 조각을 고른 버들항 던전 변형 렌더 다섯(tiledata/beodeul-variants/<id>/render-1x.png).
 * 맵 검수(suite/mapvqa refs/anchors.json)의 기준 그림과 같다 — 그래서 «구성 아이디어»로만 쓰고 베끼지 말라고 적는다(검수는 기준과 거의 같은 맵을 반복으로 친다).
 * 그림 파일은 저장소에만 있다(출하본에는 없음) — 없으면 글만 준다.
 */
export const DUNGEON_REFERENCE_PICTURES: readonly { readonly id: string; readonly themes: readonly DungeonType[]; readonly idea: string }[] = [
  { id: "sea-cave", themes: ["cave", "ice"], idea: "바다 동굴 56×42 — 해변 쪽 입구로 들어와 조간대 웅덩이 굴 → 기둥 홀 → 가장 먼 구석 밀수꾼 은닉처(끝). 가지로 바다와 이어진 밀수 부두·발광 이끼방." },
  { id: "volcano-cave", themes: ["volcano"], idea: "화산 동굴 56×44 — 입구 → 옛 대장간 폐허 → 용암 폭포 굴 → 바위다리로 용암 강 건너 → 재 벌판·흑요석 제단(끝) → 입구로 도는 고리." },
  { id: "castle-catacombs", themes: ["catacomb", "castle", "tower"], idea: "성 지하 감옥·카타콤 56×42 — 입구 계단실 → 한쪽 감방동·간수실 → 고문실 → 가장 안쪽 뼈의 방 제단. 방은 복도로만 잇고 고립 방 없음." },
  { id: "aqueduct-sewer", themes: ["sewer", "mine"], idea: "수도교 하수도 60×44 — 입구 계단 홀 → 본수로 따라 걷기 → 다리로 건너기 → 밸브방(수위 장치) → 비밀문 뒤 교단 제단." },
  { id: "temple-ruins", themes: ["temple", "pyramid", "forest", "swamp", "otherworld"], idea: "신전 폐허 58×44 — 바깥 진입로·앞뜰·성림 → 무너진 열주 → 실내 대신랑·모자이크 홀 → 내전 제단 앞 내려가는 계단(끝)." },
];

/** 테마에 맞는 참고 그림을 앞에, 나머지는 게임마다 돌린 순서로. */
export function referencePictures(theme: DungeonType, gameKey: string): typeof DUNGEON_REFERENCE_PICTURES {
  const h = [...`ref|${gameKey}`].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);
  const fit = DUNGEON_REFERENCE_PICTURES.filter((r) => r.themes.includes(theme));
  const rest = DUNGEON_REFERENCE_PICTURES.filter((r) => !r.themes.includes(theme));
  const k = rest.length ? h % rest.length : 0;
  return [...fit, ...rest.slice(k), ...rest.slice(0, k)];
}

async function referencePng(id: string): Promise<string | undefined> {
  try {
    const fs = await import("node:fs");
    const url = new URL(`../../../tiledata/beodeul-variants/${id}/render-1x.png`, import.meta.url);
    return fs.existsSync(url) ? fs.readFileSync(url).toString("base64") : undefined;
  } catch { return undefined; }
}

const ROLES = "entrance 입구(하나) · boss 보스(하나, 3×2 몸이 설 large 이상) · treasure 보물(막다른 곳이 좋다) · lake 호수 · camp 야영·둥지 · shrine 제단 · forge 대장간(화산만) · hall 넓은 굴 · grotto 곁굴";

export interface DungeonPartsOut {
  readonly theme: DungeonType;
  readonly label: string;
  /** 어휘 한 덩이(모양·역할·물·특징·잇기·입구) — 글을 짧게(2026-10-30 실내 안내 동사 회귀: 글 1.3만 자+그림 8장이면 Gemini 가 짓지 못하고 끝났다). */
  readonly vocab: string;
  /** 예시 설계 둘(게임마다 돌린 순서의 앞 둘) — 형식 보기. 나머지 둘은 한 줄로. */
  readonly examples: readonly { name: string; ko: string; design: DungeonDesign }[];
  readonly moreExamples: string;
  /** 참고 그림(버들항 던전 다섯)의 구성 한 줄씩 — 구성 아이디어, 베끼지 않는다. */
  readonly references: string;
  readonly note: string;
  /** 이 게임에서 이미 지은 장소의 출구(들어오는 길)·이미 지은 굴의 설계 한 줄 — 입구 쪽과 「다르게」의 근거. */
  readonly context?: string;
}

/** 입구 쪽 낱말 순서를 게임마다 돌린다 — 늘 south 가 먼저 적혀 있어 맨 요청의 입구가 남쪽으로 쏠렸다(2026-10-30 지문: 13/16). */
export function sideOrder(gameKey: string): string[] {
  const all = ["north", "east", "south", "west"];
  const h = [...`side|${gameKey}`].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 5) % all.length;
  return [...all.slice(h), ...all.slice(0, h)];
}

const OPP: Record<string, "north" | "south" | "east" | "west"> = { north: "south", south: "north", east: "west", west: "east" };
const KO_SIDE: Record<string, string> = { north: "북", south: "남", east: "동", west: "서" };

/** 설계 한 줄(입구 쪽·방 수·역할@자리·높이) — 같은 게임의 다음 굴에 「이미 지은 굴」로 보여 준다. */
export function designLine(d: DungeonDesign | undefined): string {
  const rooms = (d?.rooms ?? []) as readonly { role?: unknown; at?: unknown; level?: unknown; shape?: unknown }[];
  return `입구 ${String(d?.entrance ?? "-")} · ${rooms.length}방 ${rooms.map((r) => `${String(r.role ?? "?")}@${typeof r.at === "string" ? r.at : JSON.stringify(r.at ?? "-")}${r.shape ? `/${String(r.shape)}` : ""}${r.level ? `/단${String(r.level)}` : ""}`).join(" ")}`;
}

/** 이 게임에서 지은 장소들 → 던전 안내에 붙일 맥락: 바깥 장소의 출구 쪽(들어오는 길)과 이미 지은 굴 설계. */
export function dungeonContext(places: Iterable<PlaceRecord>, name: string): string {
  const seen = new Set<PlaceRecord>(); const exits: string[] = []; const caves: string[] = [];
  for (const p of places) {
    if (seen.has(p)) continue; seen.add(p);
    if (p.spec.name === name) continue;
    if (p.spec.dungeonDesign) caves.push(`「${p.spec.name}」 ${designLine(p.spec.dungeonDesign)}`);
    else if (p.spec.exits?.length && p.spec.type !== "interior") exits.push(`「${p.spec.name}」 출구 ${p.spec.exits.join("·")} → 그 출구로 오는 굴이면 입구는 ${p.spec.exits.map((e) => OPP[e]).join("·")}`);
  }
  return [exits.length ? `이 게임의 바깥 장소: ${exits.join(" / ")}.` : "", caves.length ? `이미 지은 굴(같은 게임 — 방 수·입구 쪽·자리·모양을 다르게): ${caves.join(" / ")}.` : ""].filter(Boolean).join(" ");
}

/** 십자 공식: 방 넷 이상의 자리가 모두 나침반 낱말이고 가운데와 네 끝 중 셋 이상을 한 칸씩 채웠다(2026-10-30 terra 같은 요청 3판이 모두 s·center·e·w·n). */
export function crossFormula(design: DungeonDesign | undefined): boolean {
  const rooms = (design?.rooms ?? []) as readonly { at?: unknown }[];
  if (rooms.length < 4) return false;
  const word = (a: unknown) => (typeof a === "string" ? a.trim().toLowerCase() : "");
  const norm: Record<string, string> = { n: "n", north: "n", s: "s", south: "s", e: "e", east: "e", w: "w", west: "w", c: "c", center: "c", centre: "c", middle: "c", 가운데: "c", 북: "n", 남: "s", 동: "e", 서: "w" };
  const ws = rooms.map((r) => norm[word(r.at)] ?? (word(r.at) ? "other" : ""));
  if (ws.some((w) => w === "" )) return false;
  const card = new Set(ws.filter((w) => w === "n" || w === "s" || w === "e" || w === "w"));
  return ws.includes("c") && card.size >= 3 && ws.filter((w) => w === "other").length <= 1;
}

/**
 * 들어오는 길 → 입구 쪽(make_game 의 from·side, 또는 명세 exits). 설계가 다른 쪽을 적었으면 세계 배치가 이긴다(고치고 알린다).
 * side = 부모에서 본 이 장소의 방향 → 입구는 그 반대 쪽.
 */
export function arrivalEntrance<T extends { name: string; exits?: readonly string[]; dungeonDesign?: DungeonDesign }>(spec: T, side?: string): { spec: T; note?: string } {
  const want = side && OPP[side] ? OPP[side] : spec.exits?.length === 1 && OPP[spec.exits[0]!] ? spec.exits[0]! : undefined;
  if (!want || !spec.dungeonDesign) return { spec };
  const said = String(spec.dungeonDesign.entrance ?? "").toLowerCase();
  if (said === want) return { spec };
  const note = said ? `고침: 「${spec.name}」 입구를 ${said} 대신 ${want}(${KO_SIDE[want]}쪽)로 — ${side ? `부모 장소에서 ${side} 쪽으로 이어져 들어오는 길이 ${KO_SIDE[want]}쪽이다` : `명세 exits 가 ${want}`}.` : undefined;
  // 입구 방 at 이 반대쪽 끝이면 입구 쪽과 맞지 않아 normalize 가 at 을 따른다 — at 을 지우고 쪽을 따르게 한다.
  const rooms = (spec.dungeonDesign.rooms ?? []).map((r) => (/^entrance$|입구/u.test(String(r.role ?? "")) && said && said !== want ? { ...r, at: undefined } : r));
  return { spec: { ...spec, dungeonDesign: { ...spec.dungeonDesign, entrance: want, rooms } }, ...(note ? { note } : {}) };
}

/** 게임마다 예시 순서를 돌린다 — 모두 첫 예시(남쪽 입구·북쪽 보스 갈래)에 기대어 비슷하게 짰다(2026-10-29 실조수 terra·argon). 설계는 여전히 모델이 한다. */
export function rotatedExamples(gameKey: string): typeof DUNGEON_DESIGN_EXAMPLES {
  const n = DUNGEON_DESIGN_EXAMPLES.length;
  const h = [...gameKey].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7) % n;
  return [...DUNGEON_DESIGN_EXAMPLES.slice(h), ...DUNGEON_DESIGN_EXAMPLES.slice(0, h)];
}

/** 테마(낱말) → 재료(짧게). 방+통로 문법(지하묘지·성·신전…)은 모양·물을 크기·역할로만 옮긴다고 적는다. gameKey 로 예시 순서를 돌린다. */
export function dungeonParts(theme: string, gameKey = "", context = ""): DungeonPartsOut {
  const type: DungeonType = inferDungeonType(theme).type ?? "cave";
  const g = GRAMMAR[type];
  const liquid = g.liquid === "lava" ? "용암" : g.liquid === "void" ? "허공(다리로 건넌다)" : g.liquid === "water" ? "물" : type === "ice" ? "얼어붙은 빙판(걷는다)" : "없음";
  const grammar = g.grammar === "blob" ? "불규칙 굴 — 설계한 자리·모양 그대로 판다" : g.grammar === "rooms" ? "네모 방+통로 — 역할·크기·이웃·방향으로 옮긴다(ring 은 팔각 방)" : "미궁 격자 — 설계한 방을 자리(at)·크기대로 격자 안 방으로 두고 그 사이를 갈림길 미로로 잇는다(보스·보물은 막다른 끝)";
  const ex = rotatedExamples(gameKey);
  const refs = referencePictures(type, gameKey);
  const sides = sideOrder(gameKey);
  return {
    theme: type, label: g.label,
    vocab: `${grammar}. 모양 ${DESIGN_SHAPES.map((x) => `${x.id} ${x.ko}(${x.min})`).join(" · ")}. 역할 ${ROLES}. `
      + `물 none·pool·lake·stream(이 테마 액체 ${liquid}). 특징 ${Object.entries(DESIGN_FEATURES).map(([k, v]) => `${k} ${v}`).join(" · ")}. `
      + `잇기 links[{from,to,kind winding·straight·narrow·wide}] 또는 connections linear·branch·loop·hub. `
      + `입구 ${sides.join("·")} — 플레이어가 들어오는 길 쪽(이 굴로 오는 마을 출구·세계 배치에 맞춘다, 정해진 기본 쪽은 없다; 숲·늪은 그 쪽 맵 끝이 출구). `
      + `높이 level 0 바닥 · 1 한 단 · 2 두 단 — 턱 위 제단·내려다보는 둥지·물 아래 낮은 굴처럼 방마다 준다. 높이가 다른 방 사이 길에 버들항 돌계단(마을 지형과 같은 조각)을 놓는다. `
      + `at 은 "x,y"(0~1, 왼쪽 위 0,0)로 굴의 흐름에 맞게 — n·s·e·w·center 낱말만으로 한 칸씩 채우면 십자 공식이 된다.`,
    examples: ex.slice(0, 2),
    moreExamples: ex.slice(2).map((e) => e.ko).join(" / "),
    references: refs.map((r) => `${r.id}: ${r.idea}`).join(" / "),
    ...(context ? { context } : {}),
    note: "방 수는 굴의 크기·요청에 맞게 네가 정한다(작은 굴 3~4 · 보통 5~7 · 큰 굴 8~10 — 입구·보스 둘만 잇는 일자 굴은 걸을 거리가 없다). 예시·참고 그림은 구성 아이디어일 뿐 — 베끼지 말고 요청(무엇이 사는 굴인지·어디가 위험한지·무엇을 숨겼는지)에 맞게 방 수·자리·모양·물·길·입구 쪽을 새로 짠다. 검수는 예시·참고 그림과 거의 같은 맵, 그리고 흔한 십자 공식(입구 한쪽 끝 · 가운데 회랑 · 양옆 곁굴 · 반대쪽 끝 보스)을 반복으로 친다.",
  };
}

const text = (value: unknown): PiToolExecResult => ({ content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }] });

/** 예시 설계를 따로 지은 사본에서 1배로 찍는다(프로젝트에는 남기지 않는다). */
async function examplePicture(env: PiAssistantV2Env, type: DungeonType, design: DungeonDesign, name: string): Promise<string | undefined> {
  if (!env.render) return undefined;
  const scratch = { project: cloneProjectSharingSharedDictionaries(env.ctx.project), currentMapId: env.ctx.currentMapId, assistantRun: true } as typeof env.ctx;
  const r = createBuildRun(scratch).call("author_dungeon", { name, type, design, populate: false, gimmick: "none", adapter: "beodeul", genre: "rpg" });
  const mapId = String((r as { data?: { mapId?: string } }).data?.mapId ?? "");
  const m = scratch.project.maps[mapId];
  if (!r.ok || !m) return undefined;
  const keep = env.ctx.project;
  try { env.ctx.project = scratch.project; return await env.render(mapId, 0, 0, m.width, m.height); } catch { return undefined; } finally { env.ctx.project = keep; }
}

export function createDungeonPartsVerb(env: PiAssistantV2Env, places?: () => Iterable<PlaceRecord>): PiToolShape {
  const pictures = new Map<string, string>();
  return {
    name: "dungeon_parts", label: "던전 재료 보기", concurrency: "shared",
    description: "던전·동굴 층을 직접 설계(make_place spec.dungeonDesign)하기 전에 부른다. 그 테마의 방 모양·역할·물·특징·잇는 모양 어휘와, 뼈대가 서로 다른 설계 예시 넷(하나는 지금 빌더로 지은 그림과 함께), 사람이 고른 버들항 던전 참고 그림(구성 아이디어 — 베끼지 않는다)을 돌려준다. 예시는 참고일 뿐 — 요청에 맞게 방 수·자리·모양·길을 새로 짠다.",
    parameters: { type: "object", properties: { theme: { type: "string", description: "던전 테마 낱말 — 예: 동굴, 화산, 마계, 숲, 지하묘지" } }, required: ["theme"] },
    async execute(_id, params) {
      const gameKey = String(env.request.projectKey ?? env.ctx.project.meta.title ?? "");
      const out = dungeonParts(String((params as { theme?: string }).theme ?? "cave"), gameKey, places ? dungeonContext(places(), "") : "");
      const result = text({ ok: true, ...out, how: "make_place({spec:{type:'cave'|'dungeon', name, theme, dungeonDesign:{entrance, rooms:[{id, role, size, shape, dir?, at, water?, features?}], links:[{from,to,kind?}]}}}). 방마다 at 을 서로 다르게, 입구 하나·보스 하나. 함수는 겹침·길·도달·크기 모순만 고쳐 「고침:」으로 알린다." });
      // 그림은 한 장으로 합친다(참고 그림 둘 + 첫 예시를 지금 빌더로 지은 그림, 반 크기로 나란히).
      // Gemini(argon·flash)는 큰 그림 여러 장을 받은 바로 다음 차례에 제공자 오류·글로 적은 tool_call 을 자주 냈다(2026-10-29 던전 6판 중 4판, 2026-10-30 실내 안내 동사).
      const refs = referencePictures(out.theme, gameKey).slice(0, 2);
      const panels: { label: string; b64: string }[] = [];
      for (const r of refs) { const b64 = await referencePng(r.id); if (b64) panels.push({ label: `참고 그림 ${r.id}`, b64 }); }
      const ex = out.theme === "labyrinth" ? undefined : out.examples[0];
      if (ex) {
        const key = `${out.theme}:${ex.name}`;
        let url = pictures.get(key);
        if (!url) { url = await examplePicture(env, out.theme, ex.design, `예시 ${ex.ko.split(" — ")[0]}`).catch(() => undefined); if (url) pictures.set(key, url); }
        if (url) panels.push({ label: `예시 ${ex.name} 를 지금 빌더로 지은 그림`, b64: url.slice(url.indexOf(",") + 1) });
      }
      const sheet = panels.length ? await sideBySide(panels.map((x) => x.b64)).catch(() => undefined) : undefined;
      if (sheet) {
        result.content.push({ type: "text", text: `그림 한 장(반 크기, 왼쪽부터): ${panels.map((x) => x.label).join(" · ")} — 구성 아이디어만, 베끼지 않는다.` });
        result.content.push({ type: "image", mimeType: "image/png", data: sheet });
      }
      return result;
    },
  };
}

/** PNG 여러 장을 같은 높이(≤280px, 정수 배 축소)로 줄여 한 줄로 붙인다(pngjs — 워커·스크립트 전용 경로). */
async function sideBySide(pngs: readonly string[]): Promise<string | undefined> {
  type Img = { width: number; height: number; data: Uint8Array };
  type PngLib = { PNG: { new (o: { width: number; height: number }): Img; sync: { read(b: Uint8Array): Img; write(p: Img): Uint8Array } } };
  const lib = "pngjs";   // 형식 선언이 없는 모듈 — 이름을 변수로 두어 타입 검사에서 뺀다
  const { PNG } = (await import(lib)) as PngLib;
  const ims = pngs.map((b) => PNG.sync.read(Buffer.from(b, "base64")));
  const H = 280, GAP = 8;
  const scaled = ims.map((im) => {
    const f = Math.max(1, Math.ceil(im.height / H));
    const w = Math.floor(im.width / f), h = Math.floor(im.height / f);
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) for (let c = 0; c < 4; c += 1) {
      let sum = 0; for (let dy = 0; dy < f; dy += 1) for (let dx = 0; dx < f; dx += 1) sum += im.data[((y * f + dy) * im.width + x * f + dx) * 4 + c]!;
      out[(y * w + x) * 4 + c] = Math.round(sum / (f * f));
    }
    return { w, h, data: out };
  });
  const W = scaled.reduce((a, s) => a + s.w, 0) + GAP * (scaled.length - 1), HH = Math.max(...scaled.map((s) => s.h));
  const sheet = new PNG({ width: W, height: HH });
  for (let k = 0; k < W * HH; k += 1) { sheet.data[k * 4] = 20; sheet.data[k * 4 + 1] = 20; sheet.data[k * 4 + 2] = 24; sheet.data[k * 4 + 3] = 255; }
  let ox = 0;
  for (const s of scaled) {
    for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) for (let c = 0; c < 4; c += 1) sheet.data[((y * W) + ox + x) * 4 + c] = s.data[(y * s.w + x) * 4 + c]!;
    ox += s.w + GAP;
  }
  return Buffer.from(PNG.sync.write(sheet)).toString("base64");
}

const roomKey = (r: { id?: unknown; role?: unknown; at?: unknown }) => `${String(r.role ?? "")}@${String(r.at ?? "").replace(/\s+/gu, "")}`;

/** 설계가 예시 하나를 그대로 옮겨 적었는가(방 id 절반 이상 같음, 또는 역할@자리 70% 이상 같음). 그 예시 이름. */
export function copiedExample(design: DungeonDesign | undefined): string | undefined {
  const rooms = (design?.rooms ?? []) as readonly { id?: unknown; role?: unknown; at?: unknown }[];
  if (rooms.length < 2) return undefined;
  for (const ex of DUNGEON_DESIGN_EXAMPLES) {
    const exRooms = (ex.design.rooms ?? []) as readonly { id?: unknown; role?: unknown; at?: unknown }[];
    const ids = new Set(exRooms.map((r) => String(r.id)));
    const keys = new Set(exRooms.map(roomKey));
    const sameIds = rooms.filter((r) => ids.has(String(r.id ?? ""))).length;
    const sameKeys = rooms.filter((r) => keys.has(roomKey(r))).length;
    const n = Math.max(rooms.length, exRooms.length);
    if (sameIds * 2 >= n || sameKeys >= 0.7 * n) return ex.name;
  }
  return undefined;
}

/**
 * make_place 던전 명세 손질(함수는 설계를 고르지 않는다 — 모델이 쓴 것 중 짓지 못할 것만 덜고 알린다).
 * - 없는 mapId: 새 층에 지을 맵 id 를 모델이 지어내면(2026-10-29 argon «map_cave_1», flash «cave_dungeon») author_dungeon 이 «맵이 없습니다»로 실패했다 → 버리고 새 맵.
 * - 방이 둘 미만인 dungeonDesign(빈 껍데기 {rooms:[]})은 설계가 없는 것으로 본다(되돌려 보내기가 걸리게).
 * - 예시를 그대로 옮긴 설계는 장소마다 한 번 되돌려 보낸다(flash 가 branch-north 를 id·자리까지 그대로 옮겼다). 두 번째는 그대로 짓고 알린다.
 */
export function screenDungeonSpec<T extends { name: string; mapId?: string; dungeonDesign?: DungeonDesign; floorDesigns?: readonly DungeonDesign[] }>(
  spec: T, maps: Readonly<Record<string, unknown>>, bounced: Set<string>,
): { spec: T; note?: string; bounce?: Record<string, unknown> } {
  let out = spec; const notes: string[] = [];
  if (out.mapId && !maps[out.mapId]) { notes.push(`없는 맵 id «${out.mapId}» 는 버리고 새 맵에 지었다(새 층의 id 는 함수가 정한다).`); const { mapId: _drop, ...rest } = out; out = rest as T; }
  const real = (d?: DungeonDesign) => !!d && Array.isArray(d.rooms) && d.rooms.length >= 2;
  if (out.dungeonDesign && !real(out.dungeonDesign)) { const { dungeonDesign: _d, ...rest } = out; out = rest as T; }
  if (out.floorDesigns) { const fd = out.floorDesigns.filter(real); out = { ...out, floorDesigns: fd.length ? fd : undefined }; }
  const copied = [out.dungeonDesign, ...(out.floorDesigns ?? [])].map(copiedExample).find(Boolean);
  if (!copied && [out.dungeonDesign, ...(out.floorDesigns ?? [])].some(crossFormula)) {
    const key = `cross:${out.name}`;
    if (!bounced.has(key)) {
      bounced.add(key);
      return { spec: out, bounce: { ok: false, notFailure: true, summary: `아직 짓지 않았다(실패 아님) — 「${out.name}」 설계가 흔한 십자 공식(가운데 방 + 네 끝 낱말 자리 n·s·e·w 를 한 방씩)이다. 같은 요청마다 같은 굴이 나온다. 이 굴의 사연(무엇이 살고·어디로 흘러가고·무엇을 숨겼는지)에 맞게 방 수와 자리를 "x,y"(0~1) 좌표로 다시 짜라 — 한쪽으로 치우친 긴 굴, 둘로 갈라지는 갈래, 높이(level)가 다른 턱 위 방처럼. spec.dungeonDesign 을 다시 채워 make_place 를 바로 다시 부른다.` } };
    }
    notes.push("설계가 십자 공식이다(한 번 되돌려 보낸 뒤에도) — 그대로 지었다.");
  }
  if (copied) {
    const key = `copy:${out.name}`;
    if (!bounced.has(key)) {
      bounced.add(key);
      return { spec: out, bounce: { ok: false, notFailure: true, summary: `아직 짓지 않았다(실패 아님) — 「${out.name}」 설계가 dungeon_parts 예시 «${copied}» 를 거의 그대로 옮겼다. 예시는 뼈대 참고일 뿐이다. 이 요청(무엇이 사는 굴인지·어디가 위험한지·무엇을 숨겼는지)에 맞게 방 수·입구 쪽·자리(at)·모양·물·잇는 모양을 새로 짜서 spec.dungeonDesign 을 다시 채워 make_place 를 바로 다시 부른다.` } };
    }
    notes.push(`설계가 예시 «${copied}» 와 거의 같다(한 번 되돌려 보낸 뒤에도) — 그대로 지었다.`);
  }
  return { spec: out, note: notes.join(" ") || undefined };
}
