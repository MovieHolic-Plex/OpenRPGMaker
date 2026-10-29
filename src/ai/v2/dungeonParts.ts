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

const ROLES = "entrance 입구(하나) · boss 보스(하나, 3×2 몸이 설 large 이상) · treasure 보물(막다른 곳이 좋다) · lake 호수 · camp 야영·둥지 · shrine 제단 · forge 대장간(화산만) · hall 넓은 굴 · grotto 곁굴";

export interface DungeonPartsOut {
  readonly theme: DungeonType;
  readonly label: string;
  readonly grammar: string;
  readonly liquid: string;
  readonly shapes: readonly { id: string; ko: string; use: string; min: string }[];
  readonly roles: string;
  readonly water: string;
  readonly features: Readonly<Record<string, string>>;
  readonly connections: string;
  readonly entrance: string;
  readonly examples: readonly { name: string; ko: string; design: DungeonDesign }[];
  readonly note: string;
}

/** 테마(낱말) → 재료. 방+통로 문법(지하묘지·성·신전…)은 모양·물을 크기·역할로만 옮긴다고 적는다. */
export function dungeonParts(theme: string): DungeonPartsOut {
  const type: DungeonType = inferDungeonType(theme).type ?? "cave";
  const g = GRAMMAR[type];
  const liquid = g.liquid === "lava" ? "용암" : g.liquid === "void" ? "허공(다리로 건넌다)" : g.liquid === "water" ? "물" : type === "ice" ? "얼어붙은 빙판(걷는다)" : "없음";
  return {
    theme: type, label: g.label, grammar: g.grammar === "blob" ? "불규칙 굴 — 설계한 자리·모양 그대로 판다" : g.grammar === "rooms" ? "네모 방+통로 — 역할·크기·from·방향(at 비교)으로 옮긴다(모양은 크기로, ring 은 팔각 방)" : "미궁 격자 — 설계를 쓰지 않는다(type 을 바꿔라)",
    liquid, shapes: DESIGN_SHAPES, roles: ROLES,
    water: `none · pool · lake · stream — 이 테마의 액체는 ${liquid}`,
    features: DESIGN_FEATURES,
    connections: "links 로 방 id 끼리 직접(고리 = 닫히는 길 하나 더), 또는 connections: linear 한 줄 · branch 갈래 · loop 고리 · hub 가운데 방에서 사방",
    entrance: "entrance: south·north·west·east — 입구 방(at 없으면 그 쪽 끝). 숲·늪은 그 쪽 맵 끝으로 나가는 길이 출구",
    examples: DUNGEON_DESIGN_EXAMPLES,
    note: "예시는 뼈대가 서로 다른 참고일 뿐 — 베끼지 말고 요청(무엇이 사는 굴인지, 어디가 위험한지, 무엇을 숨겼는지)에 맞게 방 수·자리·모양·물·길을 새로 짠다. 같은 게임의 다른 던전과도 입구 쪽·연결 모양을 다르게.",
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

export function createDungeonPartsVerb(env: PiAssistantV2Env): PiToolShape {
  const pictures = new Map<string, string>();
  return {
    name: "dungeon_parts", label: "던전 재료 보기", concurrency: "shared",
    description: "던전·동굴 층을 직접 설계(make_place spec.dungeonDesign)하기 전에 부른다. 그 테마의 방 모양·역할·물·특징·잇는 모양 어휘와, 뼈대가 서로 다른 설계 예시 넷, 그 예시를 지금 빌더로 실제로 지은 1배 그림을 돌려준다. 예시는 참고일 뿐 — 요청에 맞게 방 수·자리·모양·길을 새로 짠다.",
    parameters: { type: "object", properties: { theme: { type: "string", description: "던전 테마 낱말 — 예: 동굴, 화산, 마계, 숲, 지하묘지" } }, required: ["theme"] },
    async execute(_id, params) {
      const out = dungeonParts(String((params as { theme?: string }).theme ?? "cave"));
      const result = text({ ok: true, ...out, how: "make_place({spec:{type:'cave'|'dungeon', name, theme, dungeonDesign:{entrance, rooms:[{id, role, size, shape, dir?, at, water?, features?}], links:[{from,to,kind?}]}}}). 방마다 at 을 서로 다르게, 입구 하나·보스 하나. 함수는 방을 더하거나 고르지 않고 겹침·길·도달·크기 모순만 고쳐 「고침:」으로 알린다." });
      const pics = out.theme === "labyrinth" ? [] : DUNGEON_DESIGN_EXAMPLES;
      for (const ex of pics) {
        const key = `${out.theme}:${ex.name}`;
        let url = pictures.get(key);
        if (!url) { url = await examplePicture(env, out.theme, ex.design, `예시 ${ex.ko.split(" — ")[0]}`).catch(() => undefined); if (url) pictures.set(key, url); }
        if (url) { result.content.push({ type: "text", text: `예시 ${ex.name}(${ex.ko}) — 이 설계로 지은 1배 그림:` }); result.content.push({ type: "image", mimeType: "image/png", data: url.slice(url.indexOf(",") + 1) }); }
      }
      return result;
    },
  };
}
