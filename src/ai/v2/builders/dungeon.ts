// 조수 v2 던전·동굴 빌더 — PlaceSpec(dungeon|cave) → v1 author_dungeon 인자. 모델은 칸·좌표를 쓰지 않는다.
// 명세 낱말만 도구 손잡이로 옮기고, 도구가 못 하는 것(예: 버들항 얼음 동굴)은 missingArt 로 정직하게 보고한다.
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import type { BuildRun, BuilderCall, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

/** v2 계획 모델에게 주는 유일한 던전 지식(≤900자). */
export const DUNGEON_CARD =
  "[던전·동굴 type:dungeon|cave] 버들항 던전 칩셋. theme/style 낱말: catacomb(묘지·지하묘지·기본)·castle(성·마왕성)·" +
  "labyrinth(미궁)·sewer(하수도)·cave(동굴)·temple(신전·유적)·mine(광산)·volcano(화산)·ice(얼음 동굴=그림 없음, 동굴로 대체 안내). " +
  "size small|medium|large, floors 1~5(탑 tower·탑은 위로 올라가고 그 밖은 아래로). " +
  "features 낱말: boss(보스방)·chests(보물상자)·enemies(적 배치; 없으면 빈 던전)·flooded(물에 잠긴 방, 동굴 제외)·" +
  "lever(마지막 층 레버 퍼즐)·goblin/lair(고블린 소굴, 동굴만). 입구는 첫 층 시작점, 층 사이 계단은 도구가 잇는다. " +
  "hints 키: type·size·floors·direction(up|down)·seed·variant(씨앗 바꾸기)·width·height·populate·flooded·lair·puzzle. " +
  "모르는 키는 무시되고 경고된다. 문·함정·횃불 같은 조각 지정은 못 한다.";

const KNOWN_HINTS = new Set(["type", "size", "floors", "direction", "seed", "variant", "width", "height", "populate", "flooded", "lair", "puzzle", "style"]);
const BEODEUL_TILESET = "beodeul_city";
const TYPES = ["catacomb", "castle", "labyrinth", "sewer", "cave", "temple", "mine", "volcano", "ice"] as const;
type DungeonType = (typeof TYPES)[number];

interface DungeonState { readonly args: Record<string, unknown>; readonly seed?: number; readonly variant?: number; readonly floors: readonly string[] }

const words = (spec: PlaceSpec): string => [spec.name, spec.style, spec.theme, ...(spec.features ?? [])].join(" ").toLowerCase();
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function pickType(spec: PlaceSpec, text: string): DungeonType {
  const own = `${spec.theme ?? ""} ${spec.style ?? ""} ${spec.name}`.toLowerCase();
  const order: [DungeonType, RegExp][] = [
    ["ice", /ice|얼음|빙/], ["volcano", /volcano|화산|용암/], ["mine", /mine|광산|갱도/], ["sewer", /sewer|하수/],
    ["labyrinth", /labyrinth|maze|미궁|미로/], ["temple", /temple|ruins|신전|유적/], ["castle", /castle|마왕성|성채|tower|탑/],
    ["catacomb", /catacomb|grave|묘지|지하묘|무덤|crypt/], ["cave", /cave|동굴|굴/],
  ];
  for (const [t, re] of order) if (re.test(own)) return t;
  if (spec.type === "cave") return "cave";
  for (const [t, re] of order) if (t !== "cave" && re.test(text)) return t;
  return "catacomb";
}

/** 명세 → author_dungeon 인자 + 표현 못 하는 요청·경고. */
export function dungeonArgs(spec: PlaceSpec): { args: Record<string, unknown>; type: DungeonType; missing: string[]; warnings: string[] } {
  const args: Record<string, unknown> = {};
  const missing: string[] = [];
  const warnings: string[] = [];
  const text = words(spec);
  const type = pickType(spec, text);
  args.type = type;
  if (spec.size) args.size = spec.size;
  const floors = Math.max(1, Math.min(5, Math.round(spec.floors ?? 1)));
  if (floors > 1) { args.floors = floors; args.direction = /tower|탑/.test(text) ? "up" : "down"; }
  else if (/tower|탑/.test(text)) warnings.push("탑이지만 floors 가 1 이다 — 층수를 주면 위로 오른다");
  const enemies = /enem|monster|적|몬스터|boss|보스/.test(text);
  const empty = /no.?enem|적\s*없|빈\s*던전|empty/.test(text);
  args.populate = empty ? false : true;
  if (enemies && /boss|보스/.test(text)) args.troops = undefined; // 보스방은 populate 가 앵커에 놓는다(편성은 도구 몫)
  if (/flood|물에\s*잠|수몰|잠긴/.test(text)) {
    if (type === "cave") warnings.push("동굴은 물에 잠기지 않는다(flooded 는 방 문법 던전만) — 무시했다");
    else args.flooded = true;
  }
  if (/lever|레버/.test(text)) args.puzzle = "lever";
  if (/goblin|lair|소굴|고블린/.test(text)) {
    if (type === "cave") args.lair = true;
    else warnings.push("고블린 소굴은 동굴 type 에서만 된다 — 무시했다");
  }
  if (/torch|횃불|door|문\s*지정|trap|함정/.test(text)) warnings.push("조각(문·함정·횃불) 지정은 못 한다 — 도구가 알아서 놓는다");
  for (const [key, value] of Object.entries(spec.hints ?? {})) {
    if (!KNOWN_HINTS.has(key)) { warnings.push(`알 수 없는 hints.${key} 는 무시했다`); continue; }
    if (key !== "variant") args[key] = value;
  }
  if (!TYPES.includes(args.type as DungeonType)) { warnings.push(`알 수 없는 type ${String(args.type)} → ${type}`); args.type = type; }
  delete args.troops;
  return { args, type: args.type as DungeonType, missing, warnings };
}

/** 지을 맵 고르기: 이전 기록의 첫 층 → 명세 mapId → 현재 맵이 빈 버들항 맵이면 그 맵 → 새 맵. */
function targetMapId(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): string | undefined {
  if (previous?.result.mapIds[0]) return previous.result.mapIds[0];
  if (spec.mapId) return spec.mapId;
  const cur = run.ctx.currentMapId ? run.ctx.project.maps[run.ctx.currentMapId] : undefined;
  if (cur && cur.tilesetId === BEODEUL_TILESET && isBlankMap(cur)) return cur.id;
  return undefined;
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const { args, type, missing, warnings } = dungeonArgs(spec);
  const prev = previous?.result.state as DungeonState | undefined;
  const mapId = targetMapId(run, spec, previous);
  const variant = num(spec.hints?.variant);
  if (prev && args.seed === undefined && prev.seed !== undefined) args.seed = prev.seed + (variant !== undefined && variant !== prev.variant ? variant : 0);
  const base: Record<string, unknown> = { name: spec.name, ...args };
  const firstCall = run.calls.length;
  // 고치기: 이전 층들을 지우고 같은 id 로 다시 짓는다(여러 층 rebuild 는 첫 층만 되므로).
  if (previous) {
    const old = prev?.floors ?? previous.result.mapIds;
    for (const id of [...old].reverse()) if (run.ctx.project.maps[id]) run.call("remove_map", { mapId: id });
    if (mapId) base.id = mapId;
  } else if (mapId) base.mapId = mapId;
  const result = run.call("author_dungeon", base);
  const calls: BuilderCall[] = run.calls.slice(firstCall);
  const data = (result.data ?? {}) as Record<string, unknown>;
  const floors = Array.isArray(data.floors) ? (data.floors as unknown[]).filter((f): f is string => typeof f === "string") : [];
  if (!result.ok || floors.length === 0) {
    const refused = (result.issues ?? []).some((i) => i.code === "type-unsupported-by-tileset") || type === "ice";
    if (refused) missing.push(`${type} 던전 그림이 이 칩셋에 없다 — 가장 가까운 대체: cave 동굴(type 을 cave 로 바꿔 다시 요청)`);
    return { ok: false, mapIds: [], summary: `던전 짓기 실패: ${result.summary}`, warnings: [...warnings, ...(result.issues ?? []).map((i) => i.message)], missingArt: missing, calls, state: prev };
  }
  warnings.push(...(result.warnings ?? []));
  const first = floors[0]!;
  const ent = data.entrance as { x?: number; y?: number } | undefined;
  const start = run.ctx.project.startPos;
  const entrance = run.ctx.project.startMapId === first && start
    ? { mapId: first, x: start.x, y: start.y }
    : { mapId: first, x: ent?.x ?? Math.floor((num(data.width) ?? 40) / 2), y: ent?.y ?? Math.floor((num(data.height) ?? 30) / 2) };
  const seed = num(data.seed) ?? num(args.seed);
  const state: DungeonState = { args, seed, variant, floors };
  const summary = `${spec.name}: ${type} ${floors.length}층${args.direction === "up" ? "(위로)" : ""}${args.flooded ? " · 물에 잠김" : ""}${args.lair ? " · 고블린 소굴" : ""}${args.puzzle ? " · 레버" : ""} (${num(data.width)}×${num(data.height)})`;
  return { ok: true, mapIds: floors, entrance, summary, warnings, missingArt: missing, calls, state };
}

export const DUNGEON_BUILDER: PlaceBuilder = {
  id: "dungeon",
  accepts: (spec) => spec.type === "dungeon" || spec.type === "cave",
  build,
};
