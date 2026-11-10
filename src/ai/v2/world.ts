// 조수 v2 게임 세계 — 「게임 하나 만들어 줘」가 게임마다 다른 세계(칩셋 한 벌)에서, 그 세계의 서로 다른 장소 종류로 지어지게 한다.
//
// 왜(2026-11-10 오너 「자꾸 '비슷한' 맵을 만들어내는 조수도 문제」, 같은 날 Terra high 두 판): 요청이 달라도 두 게임 모두
// 버들항 마을 + 버들항 동굴 + author_forest_route{count:4}(세는 맵 6장을 채우는 가장 싼 길)였고 숲길 4장은 서로도 닮았다.
// v2 의 장소 낱말이 village·dungeon·cave·interior 넷뿐이고, 테마 구성기 아홉 벌(compose_*_map)은 v2 에서 닿지 않았다.
// 마을 한 장만 다른 칩셋으로 고르는 풀(villageChipsetPool.ts)은 「마을」 요청에만 걸려 동굴·숲은 버들항에 남았다(사막 마을 옆 초록 숲).
//
// 하는 일(순수 데이터와 순수 함수 — 짓기는 builders/worldPlace.ts, 동사는 verbs.ts):
//   1) 세계 표: 세계마다 칩셋 하나와 장소 종류(kind) 목록. 종류 하나 = 이미 있는 결정론 구성기 호출 하나(새 그림·새 시공기 없음).
//   2) 고르기: 요청이 세계를 말하면 그 세계, 다른 테마 낱말이 있으면 고르지 않고(종전 길), 아무 낱말도 없으면 프로젝트 열쇠 해시로 풀에서 하나.
//   3) 청사진 장소 검사: places[{name, kind}] 가 그 세계의 종류이고 종류가 겹치지 않게 퍼졌는지.
import type { GameBlueprint, GameBlueprintPlace } from "@/project/gameBlueprint";
import type { Project } from "@/project/types";
import { isLivedMap } from "@/editor/tools/livedMap";
import { describesDesertEast } from "@/ai/desertEastPolicy";
import { describesPiratePlace } from "@/ai/pirateIslesPolicy";
import { describesPrehistoric } from "@/ai/prehistoricPolicy";
import { describesSengoku } from "@/ai/sengokuEdoPolicy";
import { describesSfPlace } from "@/ai/sfStationPolicy";
import { describesSkyIsland } from "@/ai/skyIslandPolicy";
import { describesSnowNorth } from "@/ai/snowNorthPolicy";
import { describesSteampunk } from "@/ai/steampunkCityPolicy";
import { hasThemeWord, projectKeyHash } from "@/ai/villageChipsetPool";
import type { PlaceSpec } from "./types";

/** 구성기 호출 하나로 짓는 종류 — 맵 크기는 구성기가 받는 크기(실내는 방 크기 그대로). */
export interface ComposedKind {
  /** 구성기에 넘기는 값(style·kind 인자). */
  readonly value: string;
  readonly size: readonly [number, number];
  /** 세계의 기본 구성기와 다른 도구(사막 실내 compose_desert_east_room). */
  readonly tool?: string;
}

export interface WorldKind {
  readonly id: string;
  /** 함수가 장소 이름을 지어야 할 때 쓰는 한국어 이름. */
  readonly ko: string;
  /** 모델 카드에 싣는 영어 한 줄. */
  readonly about: string;
  readonly indoor?: true;
  /** 싸움·보스가 어울리는 곳. */
  readonly danger?: true;
  /** 실내 종류: 이 방으로 들어가는 문이 어느 집 문인가(구성기가 돌려주는 집 키트·이름에 맞춘다) — 얼음 동굴 방은 얼음 동굴 입구, 묘실은 피라미드 입구. */
  readonly door?: RegExp;
  /** 구성기로 짓는다. 없으면 spec 으로 종전 빌더(버들항 마을·던전·실내)가 짓는다. */
  readonly compose?: ComposedKind;
  readonly spec?: Pick<PlaceSpec, "type"> & Partial<PlaceSpec>;
}

export interface WorldSetting {
  readonly id: string;
  readonly tilesetId: string;
  /** 모델 카드 제목(영어). */
  readonly name: string;
  readonly ko: string;
  /** 세계 한 줄(영어) — 분위기와 어울리는 이야기 재료. */
  readonly pitch: string;
  /** 요청이 이 세계를 말하나. */
  readonly named: (text: string) => boolean;
  /** 낱말 없는 요청의 풀: fantasy = 판타지 요청도, open = 장르 낱말이 전혀 없을 때만, named = 요청이 말했을 때만. */
  readonly pool: "fantasy" | "open" | "named";
  /** 이 세계의 구성기(종류마다 value 만 다르다). newMap = 구성기가 칩셋·크기를 맞춘 새 맵을 스스로 만든다. */
  readonly composer?: { readonly tool: string; readonly param: "style" | "kind"; readonly newMap?: true };
  readonly kinds: readonly WorldKind[];
}

const out = (id: string, ko: string, about: string, size: readonly [number, number], flags: { danger?: true; value?: string } = {}): WorldKind =>
  ({ id, ko, about, ...(flags.danger ? { danger: true as const } : {}), compose: { value: flags.value ?? id, size } });
const room = (id: string, ko: string, about: string, size: readonly [number, number], door: RegExp, flags: { danger?: true; value?: string; tool?: string } = {}): WorldKind =>
  ({ id, ko, about, indoor: true, door, ...(flags.danger ? { danger: true as const } : {}), compose: { value: flags.value ?? id, size, ...(flags.tool ? { tool: flags.tool } : {}) } });
const classic = (id: string, ko: string, about: string, spec: WorldKind["spec"], flags: { indoor?: true; danger?: true } = {}): WorldKind => ({ id, ko, about, ...flags, spec });

const WASTELAND_WORDS = /좀비|아포칼립스|종말|황무지|폐허\s*도시|포스트\s*아포|\b(?:zombies?|apocalypse|wasteland|post[-\s]?apocalyptic)\b/iu;
const BEODEUL_WORDS = /버들\s*항|beodeul/iu;

/** 세계 표. 방 크기는 구성기가 짜는 크기 그대로(100칸 미만 방은 세는 맵이 못 되어 싣지 않는다: 사우나 11×9·사막 가게 10×8). 찻집은 13×9 에서만 짜진다(12×9 는 문에서 안 닿는 바닥이 남는다 — scripts/qa/assistant-v2/worldProbe.mts 로 잰다). */
export const WORLDS: readonly WorldSetting[] = [
  {
    id: "beodeul", tilesetId: "beodeul_city", name: "Beodeul — green medieval countryside", ko: "버들항", pool: "fantasy", named: (t) => BEODEUL_WORDS.test(t),
    pitch: "Rivers, farms and old stone under a mild sky; trouble comes up from below — mines, catacombs, forgotten temples.",
    kinds: [
      classic("village", "강가 마을", "farm village by a river (houses, plaza)", { type: "village", theme: "river", size: "small" }),
      classic("port", "포구 마을", "fishing port on the coast", { type: "village", theme: "coast", size: "small" }),
      classic("swamp-village", "늪지 마을", "stilt village in a swamp", { type: "village", theme: "swamp", size: "small" }),
      classic("cave", "동굴", "natural cave", { type: "cave", size: "small" }, { danger: true }),
      classic("mine", "폐광", "abandoned mine with rails", { type: "dungeon", theme: "mine", size: "small" }, { danger: true }),
      classic("catacomb", "지하 묘지", "catacombs under the land", { type: "dungeon", theme: "catacomb", size: "small" }, { danger: true }),
      classic("temple", "옛 신전", "ruined temple", { type: "dungeon", theme: "temple", size: "small" }, { danger: true }),
      classic("deep-forest", "깊은 숲", "forest maze of clearings", { type: "dungeon", theme: "forest", size: "small" }, { danger: true }),
      classic("tower", "마법사의 탑", "wizard tower going up", { type: "dungeon", theme: "tower", size: "small" }, { danger: true }),
    ],
  },
  {
    id: "snow_north", tilesetId: "snow_north", name: "Snowbound North", ko: "북방 설원", pool: "fantasy", named: (t) => describesSnowNorth(t),
    pitch: "Log villages behind palisades, frozen lakes and ice caves; long winters, hearth stories, things sleeping under the ice.",
    composer: { tool: "compose_snow_north_map", param: "style", newMap: true },
    kinds: [
      out("village", "눈 덮인 마을", "log village inside a palisade (houses with doors)", [46, 36]),
      out("market", "겨울 장터", "winter market square with stalls", [42, 32]),
      out("lake", "얼어붙은 호수", "frozen lake with ice-fishing holes and huts", [42, 32]),
      out("ice-cliff", "얼음 절벽", "snowy cliff with the mouth of an ice cave", [38, 30], { value: "cave", danger: true }),
      room("cabin", "통나무 오두막", "one-room log cabin", [12, 10], /cabin|오두막/u),
      room("longhall", "회관", "chieftain's long hall with a hearth", [20, 12], /meadhall|회관/u),
      room("tavern", "선술집", "mead tavern", [16, 12], /meadhall|smokehouse|훈제막/u),
      room("ice-cave", "얼음 동굴", "inside of the ice cave", [18, 12], /ice-cave|얼음 동굴/u, { danger: true }),
    ],
  },
  {
    id: "desert_east", tilesetId: "desert_east", name: "Desert of the East", ko: "사막 동방", pool: "fantasy", named: (t) => describesDesertEast(t),
    pitch: "Oasis towns, bazaars and a sultan's palace on the sand, with pyramids and sealed tombs beyond; caravans, bargains, curses.",
    composer: { tool: "compose_desert_east_map", param: "kind" },
    kinds: [
      out("oasis", "오아시스 마을", "adobe village around an oasis pond", [44, 36]),
      out("bazaar", "바자르", "crowded market street of stalls", [46, 34]),
      out("caravanserai", "대상 숙소", "walled caravan inn yard", [40, 34]),
      out("palace", "궁전", "palace grounds with gardens", [48, 40]),
      out("pyramid", "피라미드 유적", "pyramid ruins in the dunes", [48, 38], { danger: true }),
      room("teahouse", "찻집", "tea house", [13, 9], /shop|가게|회당/u, { tool: "compose_desert_east_room" }),
      room("inn", "여관", "inn room", [12, 9], /-2f|2층|adobe-5/u, { tool: "compose_desert_east_room" }),
      room("hammam", "목욕탕", "bath house", [12, 10], /dome|돔/u, { tool: "compose_desert_east_room" }),
      room("throne-hall", "알현실", "palace audience hall", [16, 13], /palace|궁전/u, { value: "palace_hall", tool: "compose_desert_east_room" }),
      room("tomb", "묘실", "burial chamber inside the pyramid", [13, 16], /pyramid|피라미드/u, { tool: "compose_desert_east_room", danger: true }),
    ],
  },
  {
    id: "pirate_isles", tilesetId: "pirate_isles", name: "Pirate Isles", ko: "해적 군도", pool: "fantasy", named: (t) => describesPiratePlace(t),
    pitch: "Tropical islands, a rowdy harbor, a fort and wrecks on the reef; maps, mutiny and buried things.",
    composer: { tool: "compose_pirate_isles_map", param: "kind" },
    kinds: [
      out("harbor", "해적 항구", "harbor town with piers and a tavern", [56, 40]),
      out("beach", "야자 해변", "palm beach with huts", [52, 40]),
      out("fort", "요새", "stone fort with cannons", [48, 40], { danger: true }),
      out("wreck", "난파선 암초", "shipwreck on a reef", [46, 36], { danger: true }),
      room("ship", "해적선", "deck of a pirate ship", [30, 22], /harbor-office|warehouse|항만|부두/u),
      room("tavern", "해적 술집", "tavern interior", [26, 20], /tavern|술집/u),
      room("hut", "오두막", "beach hut interior", [14, 12], /hut|오두막/u),
      room("cave", "보물 동굴", "sea cave with treasure", [30, 24], /cave|동굴/u, { danger: true }),
    ],
  },
  {
    id: "sky_island", tilesetId: "sky_island", name: "Sky Islands", ko: "하늘섬", pool: "fantasy", named: (t) => describesSkyIsland(t),
    pitch: "Islands floating over a sea of clouds, joined by rope bridges and airships; old shrines, wind, things falling from above.",
    composer: { tool: "compose_sky_island_map", param: "style" },
    kinds: [
      out("village", "하늘 마을", "village on a floating island", [50, 34]),
      out("dock", "비공정 부두", "airship dock", [52, 30]),
      out("archipelago", "섬 사슬", "chain of small islands and bridges", [54, 42]),
      out("shrine", "신전 섬", "shrine island", [46, 40], { danger: true }),
      room("cottage", "오두막", "cottage interior", [11, 11], /cottage|지붕/u, { value: "room-cottage" }),
      room("cabin", "비공정 선실", "airship cabin", [11, 10], /dockhouse|lighthouse|부두|등대/u, { value: "room-cabin" }),
      room("observatory", "천문대", "observatory room", [13, 12], /observatory|천문대/u, { value: "room-observatory" }),
      room("shrine-hall", "신전 안", "inner hall of the shrine", [13, 14], /shrine|신전/u, { value: "room-shrine", danger: true }),
    ],
  },
  {
    id: "steampunk_city", tilesetId: "steampunk_city", name: "Steam City", ko: "증기 도시", pool: "open", named: (t) => describesSteampunk(t),
    pitch: "Brick streets under smoke, factories, canals and airship moorings; inventors, strikes, machines that should not run.",
    composer: { tool: "compose_steampunk_city_map", param: "style", newMap: true },
    kinds: [
      out("street", "증기 도시 거리", "brick street of row houses and shops", [48, 34]),
      out("industrial", "공장 지대", "factory district with chimneys", [52, 40], { danger: true }),
      out("dock", "운하 부두", "canal dock and moorings", [48, 34]),
      room("inn", "여관", "inn interior", [18, 13], /sp-inn|여관/u),
      room("tavern", "선술집", "tavern interior", [18, 13], /tavern|선술집/u),
      room("workshop", "공방", "inventor's workshop", [16, 11], /workshop|공방|gears/u),
      room("lab", "연구실", "laboratory", [15, 11], /apoth|약방|pump/u),
      room("boiler-room", "보일러실", "boiler room", [15, 11], /boiler|보일러/u, { danger: true }),
      room("engine-room", "기관실", "engine room", [17, 12], /factory|공장|station/u, { danger: true }),
    ],
  },
  {
    id: "prehistoric", tilesetId: "prehistoric", name: "Primeval World", ko: "선사 시대", pool: "open", named: (t) => describesPrehistoric(t),
    pitch: "Tribal huts around a fire, swamps, a smoking volcano and a valley of giant bones; hunts, spirits and omens.",
    composer: { tool: "compose_prehistoric_map", param: "style", newMap: true },
    kinds: [
      out("village", "부족 마을", "tribal village around a bonfire", [48, 36]),
      out("fossil", "화석 계곡", "valley of giant fossils", [46, 34]),
      out("swamp", "늪", "swamp of reeds and mud", [44, 34], { danger: true }),
      out("volcano", "화산 기슭", "foot of a volcano with lava", [44, 34], { danger: true }),
      room("chieftain-hut", "족장 움집", "chieftain's hut", [16, 13], /chief|족장/u),
      room("shaman-hut", "주술사 움집", "shaman's hut", [13, 11], /tipi|천막/u),
      room("cave-dwelling", "동굴 거처", "cave home with paintings", [18, 13], /cave-mouth|동굴/u),
      room("cave-gallery", "벽화 동굴", "deep painted cave", [24, 12], /cave-mouth|동굴/u, { danger: true }),
    ],
  },
  {
    id: "sengoku_edo", tilesetId: "sengoku_edo", name: "Sengoku · Edo Japan", ko: "전국·에도", pool: "open", named: (t) => describesSengoku(t),
    pitch: "Castle towns, inn streets, samurai estates and temples; duty, rivalry and night visitors.",
    composer: { tool: "compose_sengoku_edo_map", param: "style" },
    kinds: [
      out("village", "농촌 마을", "farm village with paddies", [54, 42]),
      out("castle-town", "성하 마을", "town below the castle", [56, 48], { value: "castle_town" }),
      out("inn-street", "여관 거리", "post-town inn street", [56, 40], { value: "inn_street" }),
      out("samurai", "무가 저택", "samurai estate", [52, 36]),
      out("temple", "절", "temple grounds", [54, 38]),
      out("castle", "성", "castle keep and yard", [44, 38], { danger: true }),
    ],
  },
  {
    id: "sf_station", tilesetId: "sf_station", name: "Orbital Station", ko: "우주 정거장", pool: "open", named: (t) => describesSfPlace(t),
    pitch: "A station lobby, neon streets, a research lab and a moon base; malfunctions, quarantine, signals from outside.",
    composer: { tool: "compose_sf_station_map", param: "kind" },
    kinds: [
      out("station", "정거장", "space station decks (lobby, quarters)", [44, 32]),
      out("street", "네온 거리", "neon city street", [48, 30]),
      out("lab", "연구 기지", "research base", [40, 30], { danger: true }),
      out("moonbase", "달 기지", "moon base on the surface", [48, 32], { danger: true }),
    ],
  },
  {
    id: "wasteland", tilesetId: "wasteland_ruins", name: "Wasteland", ko: "황무지", pool: "named", named: (t) => WASTELAND_WORDS.test(t),
    pitch: "A survivors' settlement, a shanty town and a ruined city; scarcity, barricades, what is left of the old world.",
    composer: { tool: "compose_wasteland_map", param: "kind" },
    kinds: [
      out("settlement", "생존자 정착지", "walled survivors' settlement", [40, 30]),
      out("shanty", "판잣집 촌", "shanty town", [36, 28]),
      out("ruined-city", "폐허 도시", "ruined city blocks", [40, 30], { danger: true }),
    ],
  },
];

export const WORLD_STYLE_PREFIX = "world:";
/** 한 게임에서 같은 종류를 쓸 수 있는 횟수(씨앗이 달라 배치는 다르다). */
export const MAX_SAME_KIND = 2;
/** 세계 장소 수(끝맺음 관문의 세는 맵 수와 같다 — mapCount.MIN_COUNTED_MAPS). */
export const MIN_WORLD_PLACES = 6;
/** 핵심 경로가 지나야 하는 서로 다른 장소 수. */
export const MIN_STEP_PLACES = 4;

export function worldById(id: string | undefined): WorldSetting | undefined {
  return id ? WORLDS.find((w) => w.id === id) : undefined;
}
export function worldKind(world: WorldSetting, kind: string): WorldKind | undefined {
  const k = kind.trim().toLowerCase().replace(/[\s_]+/gu, "-");
  return world.kinds.find((x) => x.id === k) ?? world.kinds.find((x) => x.compose?.value === kind.trim());
}
/** 이 게임의 세계(청사진이 정한 것). */
export function worldOf(project: Pick<Project, "gameBlueprint">): WorldSetting | undefined {
  return worldById(project.gameBlueprint?.setting);
}
/** 구성기로 짓는 세계인가(버들항은 종전 빌더). */
export const isComposedWorld = (world: WorldSetting | undefined): world is WorldSetting => !!world?.composer;

const FANTASY_WORDS = /판타지|용사|마왕|기사|왕국|검과|드래곤|\b(?:fantasy|hero|knight|dragon|kingdom)\b/iu;

/**
 * 게임 하나를 새로 만드는 요청의 세계 고르기. 요청은 사용자 글(의도 메모를 뗀 것)이다.
 *  - 요청이 세계를 말하면 그 세계.
 *  - 다른 테마·장르 낱말(조선·현대·학교·연애·추리·숲·항구…)이 있으면 undefined — 종전 길(장소 이름으로 추정)이 맡는다.
 *  - 손댄 맵이 이미 있으면 그 칩셋의 세계(없으면 undefined) — 게임 중간에 칩셋이 바뀌지 않게.
 *  - 낱말이 없으면 프로젝트 열쇠 해시로 풀에서 하나(같은 게임은 늘 같은 세계, 다른 게임은 다른 세계). 열쇠가 없으면 undefined.
 * 후보는 프로젝트에 칩셋이 실제로 있는 세계만.
 */
export function pickWorld(project: Pick<Project, "tilesets" | "maps">, projectKey: string | undefined, request: string): WorldSetting | undefined {
  const have = WORLDS.filter((w) => project.tilesets[w.tilesetId]);
  const lived = Object.values(project.maps).filter((m) => isLivedMap(m));
  if (lived.length) return have.find((w) => w.composer && lived.some((m) => m.tilesetId === w.tilesetId));
  const named = have.find((w) => w.named(request));
  if (named) return named;
  if (hasThemeWord(request) || !projectKey?.trim()) return undefined;
  const pool = have.filter((w) => w.pool === "fantasy" || (w.pool === "open" && !FANTASY_WORDS.test(request)));
  return pool.length >= 2 ? pool[projectKeyHash(`world|${projectKey}`) % pool.length] : undefined;
}

/** 종류 하나의 짓기 명세. 구성기 종류는 style "world:<세계>:<종류>" 로 worldPlace 빌더가 받는다. */
export function worldPlaceSpec(world: WorldSetting, kind: WorldKind, name: string): PlaceSpec {
  if (kind.spec) return { ...kind.spec, name };
  return { type: kind.indoor ? "interior" : "village", name, style: `${WORLD_STYLE_PREFIX}${world.id}:${kind.id}` };
}
export function parseWorldStyle(style: string | undefined): { world: WorldSetting; kind: WorldKind } | undefined {
  if (!style?.startsWith(WORLD_STYLE_PREFIX)) return undefined;
  const [worldId, kindId] = style.slice(WORLD_STYLE_PREFIX.length).split(":");
  const world = worldById(worldId);
  const kind = world && kindId ? world.kinds.find((k) => k.id === kindId) : undefined;
  return world && kind?.compose ? { world, kind } : undefined;
}

/**
 * 실내 종류가 들어갈 집 문 — 그 종류의 문(얼음 동굴 방 ↔ 얼음 동굴 입구)이 있으면 그것, 없으면 다른 종류가 찜하지 않은 문, 그래도 없으면 아무 문.
 * doors 는 아직 안 쓴 문만 준다.
 */
export function pickWorldDoor<T extends { readonly kit?: string }>(world: WorldSetting, kind: WorldKind, doors: readonly T[]): T | undefined {
  const own = kind.door ? doors.find((d) => kind.door!.test(d.kit ?? "")) : undefined;
  if (own) return own;
  const claimed = world.kinds.filter((k) => k.door && k !== kind).map((k) => k.door!);
  return doors.find((d) => !claimed.some((re) => re.test(d.kit ?? ""))) ?? doors[0];
}

const norm = (s: string) => s.normalize("NFC").replace(/[\s·・,.!?'"「」『』()[\]~\-_/]+/gu, "").toLowerCase();
const kindList = (world: WorldSetting) => world.kinds.map((k) => k.id).join(" · ");

/** 종류를 못 읽은 장소에 줄 종류 — 아직 덜 쓴 종류 중 실내/바깥·위험이 맞는 것 먼저. */
export function spareKind(world: WorldSetting, used: readonly string[], want: { indoor?: boolean; danger?: boolean } = {}): WorldKind {
  const count = (id: string) => used.filter((u) => u === id).length;
  const fits = (k: WorldKind) => (want.indoor === undefined || !!k.indoor === want.indoor) && (want.danger === undefined || !!k.danger === want.danger);
  const byUse = [...world.kinds].sort((a, b) => count(a.id) - count(b.id));
  return byUse.find((k) => fits(k) && count(k.id) < MAX_SAME_KIND) ?? byUse.find(fits) ?? byUse[0]!;
}

/**
 * 청사진 장소가 이 세계에서 지을 수 있고 고르게 퍼졌나 — 문제면 모델에게 돌려줄 영어 한 줄들, 없으면 [].
 * oneRoom(방탈출·「방 하나」)은 장소 수·퍼짐을 보지 않는다.
 */
export function worldPlaceProblems(bp: Pick<GameBlueprint, "places" | "steps">, world: WorldSetting, oneRoom = false): string[] {
  const places = bp.places ?? [];
  const problems: string[] = [];
  if (!places.length) return [`places is missing — list every place of the game as places:[{name, kind}] with kind from this world: ${kindList(world)}.`];
  const unknown = places.filter((p) => !worldKind(world, p.kind));
  if (unknown.length) problems.push(`unknown kind ${unknown.map((p) => `«${p.kind}» (place «${p.name}»)`).join(", ")} — kinds of this world: ${kindList(world)}.`);
  const names = new Set(places.map((p) => norm(p.name)));
  const strays = [...new Set(bp.steps.map((s) => s.place))].filter((p) => !names.has(norm(p)));
  if (strays.length) problems.push(`steps use place ${strays.map((p) => `«${p}»`).join(", ")} that is not in places — every steps[].place must be a places[].name.`);
  if (oneRoom) return problems;
  const need = Math.min(MIN_WORLD_PLACES, world.kinds.length * MAX_SAME_KIND);
  if (places.length < need) problems.push(`only ${places.length} places — list ${need} to 8 (the finish gate counts ${MIN_WORLD_PLACES} maps reached by doors).`);
  const kinds = places.map((p) => worldKind(world, p.kind)?.id).filter((k): k is string => !!k);
  const over = [...new Set(kinds)].filter((k) => kinds.filter((x) => x === k).length > MAX_SAME_KIND);
  if (over.length) problems.push(`kind ${over.join(", ")} is used more than ${MAX_SAME_KIND} times — use other kinds (${world.kinds.filter((k) => !kinds.includes(k.id)).map((k) => k.id).join(" · ") || kindList(world)}) so the maps differ.`);
  const distinct = new Set(kinds).size;
  const wantDistinct = Math.min(5, world.kinds.length, places.length);
  if (!unknown.length && distinct < wantDistinct) problems.push(`only ${distinct} different kinds — use at least ${wantDistinct} different kinds so the maps differ.`);
  const visited = new Set(bp.steps.map((s) => norm(s.place)).filter((p) => names.has(p))).size;
  const wantVisited = Math.min(MIN_STEP_PLACES, places.length);
  if (!strays.length && visited < wantVisited) problems.push(`the steps happen in only ${visited} place(s) — spread them over at least ${wantVisited} of the places (a game that stays in two maps does not use its world).`);
  return problems;
}

/**
 * 돌려보낸 뒤에도 남은 문제를 함수가 메운다(막다른 길을 만들지 않는다): 모르는 종류는 남는 종류로, 단계가 가리키는 없는 장소는 장소로 더한다.
 * 고친 것 한 줄씩과 고친 장소 목록.
 */
export function repairWorldPlaces(bp: Pick<GameBlueprint, "places" | "steps">, world: WorldSetting): { places: GameBlueprintPlace[]; notes: string[] } {
  const notes: string[] = [];
  const places: GameBlueprintPlace[] = [];
  const used = (): string[] => places.map((p) => p.kind);
  for (const p of bp.places ?? []) {
    const kind = worldKind(world, p.kind);
    const over = kind && used().filter((k) => k === kind.id).length >= MAX_SAME_KIND;
    const fixed = kind && !over ? kind : spareKind(world, used(), kind ? { indoor: !!kind.indoor } : {});
    if (fixed.id !== p.kind) notes.push(`place «${p.name}» kind ${p.kind} → ${fixed.id}`);
    places.push({ ...p, kind: fixed.id });
  }
  for (const name of [...new Set(bp.steps.map((s) => s.place))]) {
    if (places.some((p) => norm(p.name) === norm(name))) continue;
    const kind = spareKind(world, used());
    places.push({ name, kind: kind.id });
    notes.push(`added place «${name}» as ${kind.id}`);
  }
  return { places, notes };
}

/** 모델 카드 — 이 게임의 세계와 장소 종류, 짓는 순서. */
export function worldCard(world: WorldSetting): string {
  const line = (k: WorldKind) => `${k.id}${k.danger ? "★" : ""} — ${k.about}`;
  const outdoor = world.kinds.filter((k) => !k.indoor), indoor = world.kinds.filter((k) => k.indoor);
  const minDistinct = Math.min(5, world.kinds.length);
  return [
    `[World of this game — ${world.name}] ${world.pitch} Every game gets its own world; all places of this game are built from this world's place kinds (one chipset), so its maps belong together and differ from other games. Write names, story and dialogue that fit this world.`,
    `Outdoor kinds: ${outdoor.map(line).join(" · ")}.`,
    ...(indoor.length ? [`Indoor kinds: ${indoor.map(line).join(" · ")}.`] : []),
    "(★ = fits fights and a boss.)",
    `- In write_blueprint list places:[{name, kind, from?}] — ${Math.min(MIN_WORLD_PLACES, world.kinds.length * MAX_SAME_KIND)} to 8 places, at least ${minDistinct} different kinds, no kind more than ${MAX_SAME_KIND} times. The first place is where the game starts; each later place is entered from «from» (default: the place listed before it); an indoor place hangs off a door of its «from» place. Spread the steps over at least ${MIN_STEP_PLACES} places.`,
    `- Then call build_world once: code builds every listed place and links the doors and roads between them${world.composer ? " (no make_place, no layouts to design, no author_forest_route)" : " (to design a village, dungeon or interior yourself, call make_place with the same name first — build_world builds whatever is still missing)"}. To add a place later: build_world{add:[{name, kind, from}]}.`,
    "- After build_world: build_blueprint_path, then people and events per place (add_people, add_event…).",
  ].join("\n");
}
