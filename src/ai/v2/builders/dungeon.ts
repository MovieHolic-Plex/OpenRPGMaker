// 조수 v2 던전·동굴 빌더 — PlaceSpec(dungeon|cave) → v1 author_dungeon 인자. 모델은 칸·좌표를 쓰지 않는다.
// 명세 낱말(한·영)을 도구 손잡이(type·direction·gimmick·troops·inspiration)로 옮기고, 도구가 손잡이로 못 하는 것만
// 기존 도구(upsert_enemy·upsert_troop·place_field_enemy·place_chest·remove_event)로 뒤에서 채운다:
// 층마다 보이는 적 수, 가장 깊은 곳 상자, 보스 그림이 잡몹·수문장과 다르게.
import { isBlankMap } from "@/editor/tools/mapEmptiness";
import { dungeonTheme } from "@/editor/tools/dungeonThemeTroops";
import { fitEnemyToStartParty } from "@/editor/tools/bossThreatScaling";
import { ensureBossRest, ensureHealingAccess } from "../healingAccess";
import { pickTroops } from "@/editor/tools/jrpgVolumeTools";
import { DUNGEON_TYPES, type DungeonType } from "@/editor/dungeonKit/types";
import { isPassable } from "@/project/collision";
import { terrainReachability } from "@/project/terrainReachability";
import { cloneProjectSharingSharedDictionaries } from "@/project/projectClone";
import type { EnemyRecord, GameMap, Project } from "@/project/types";
import { createBuildRun } from "../buildRun";
import { carryFloorEvents, retargetIncoming } from "./dungeonRebuildCarry";
import type { BuildRun, BuilderCall, PlaceBuildResult, PlaceBuilder, PlaceRecord, PlaceSpec } from "../types";

/** v2 계획 모델에게 주는 유일한 던전 지식(≤900자). */
export const DUNGEON_CARD =
  "[던전·동굴 type:dungeon|cave] 버들항 칩셋. theme 낱말(한·영 다 된다): forest 숲·정글 · swamp 늪·독늪·습지 · volcano 화산·용암 · ice 얼음·빙굴·설산 · " +
  "pyramid 피라미드·사막 왕묘 · tower 마법사의 탑·마법탑 · otherworld 이세계·마계·지옥·심연 · castle 성·마왕성 · catacomb 지하묘지(기본) · temple 신전·유적 · " +
  "mine 광산 · sewer 하수도 · labyrinth 미궁 · cave 동굴. size small|medium|large, floors 1~5(탑·마법탑은 위로, 나머지는 아래로; 보스는 마지막 층 맨 안쪽 방). " +
  "features: 원문의 적 낱말(늑대·유령·미라·전갈·도마뱀 인간·눈알·갑옷·악마·박쥐…)과 보스 낱말(히드라·붉은 용·얼음 용·대마법사·마계의 군주…)을 그대로, " +
  "boss·chests·enemies, 장치 함정(모래 함정)·다리·마법진·레버·얼음 미끄럼·광차, flooded(물에 잠긴 방), goblin lair. 적 낱말 → 보이는 적 그림, 보스 낱말 → 보스 그림. " +
  "층은 네가 설계한다: spec.dungeonDesign = {entrance 입구 쪽, rooms[{id, role(entrance·boss·treasure·lake·camp·shrine·hall·grotto), size, shape(blob·cavern·long·shaft·ring·twin), at 맵 안 자리, water(none·pool·lake·stream), features}], links[{from,to,kind}]} — 어휘·예시 그림은 dungeon_parts, 함수는 겹침·길·도달만 고친다(설계 없이 오면 한 번 되돌려 보낸다). " +
  "hints: variant(다른 배치)·direction(up|down)·gimmick·inspiration(「엘든링 같은」 게임 이름). 탑은 층마다 직접 고른다: floorShapes 「cross,spiral,hall」(아래층부터 — 중간 ring·gallery·cross·spiral·twin, 꼭대기 ring·hall·observatory), floorGimmicks 「none,teleporter」(중간 층 장치 lever·bridge·teleporter·minecart·iceslide·sandpit·none). 고치기는 edit_place set.dungeonDesign(고친 설계 전체)·variant·features — 소품 하나하나는 못 한다.";

const KNOWN_HINTS = new Set(["type", "size", "floors", "direction", "seed", "variant", "width", "height", "populate", "flooded", "lair", "puzzle", "style", "gimmick", "inspiration", "layout", "floorShapes", "floorGimmicks"]);
const BEODEUL_TILESET = "beodeul_city";
const TYPES: readonly DungeonType[] = DUNGEON_TYPES;

interface DungeonState { readonly args: Record<string, unknown>; readonly seed?: number; readonly variant?: number; readonly floors: readonly string[] }

const words = (spec: PlaceSpec): string => [spec.name, spec.style, spec.theme, ...(spec.features ?? []), ...Object.values(spec.hints ?? {}).map(String)].join(" ").toLowerCase();
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

/** 주제 낱말 → 도구 type. 앞이 더 구체적이다(「얼음 동굴」은 ice, 「마계 성」은 otherworld, 「마법사의 탑」은 tower). */
const TYPE_WORDS: readonly [DungeonType, RegExp][] = [
  ["otherworld", /otherworld|abyss|hell|demon\s*realm|netherworld|이세계|마계|지옥|심연|이계|차원/],
  ["pyramid", /pyramid|desert|pharaoh|피라미드|사막|왕묘|파라오|모래\s*무덤/],
  ["tower", /magic\s*tower|wizard|mage\s*tower|sorcer|마법사의\s*탑|마법탑|마도사|마탑|마술사의\s*탑/],
  ["swamp", /swamp|marsh|bog|mangrove|늪|습지|소택|맹그로브/],
  ["forest", /forest|jungle|woods|grove|world\s*tree|숲|정글|밀림|세계수|수풀/],
  ["ice", /\bice\b|icy|frost|frozen|glacier|snow|얼음|빙굴|빙하|설산|서리|눈\s*덮/],
  ["volcano", /volcan|lava|magma|화산|용암|마그마/],
  ["mine", /\bmine\b|mines|mining|광산|갱도/],
  ["sewer", /sewer|하수/],
  ["labyrinth", /labyrinth|maze|미궁|미로/],
  ["temple", /temple|ruin|shrine|신전|유적|사원|폐허/],
  ["castle", /castle|fortress|keep|tower|마왕성|성채|요새|성\s|성$|탑/],
  ["catacomb", /catacomb|grave|crypt|tomb|묘지|지하묘|무덤|납골|카타콤|감옥/],
  ["cave", /cave|cavern|grotto|동굴|굴/],
];

/** 테마 낱말이 없는 「던전」의 종류 후보 — 늘 지하묘지였다(2026-10-23 사용자 「던전 만들어 줘가 늘 비슷하다」). 무작위로 하나. */
const PLAIN_TYPES: readonly DungeonType[] = ["catacomb", "castle", "sewer", "temple", "mine"]; // 미궁은 판이 늘 같은 틀이라 뺐다

function pickType(spec: PlaceSpec, text: string, keep?: DungeonType): DungeonType {
  const hinted = String(spec.hints?.type ?? "");
  if ((TYPES as readonly string[]).includes(hinted)) return hinted as DungeonType;
  const own = `${spec.theme ?? ""} ${spec.style ?? ""} ${spec.name}`.toLowerCase();
  for (const [t, re] of TYPE_WORDS) if (re.test(own)) return t;
  if (spec.type === "cave") return "cave";
  for (const [t, re] of TYPE_WORDS) if (t !== "cave" && re.test(text)) return t;
  return keep ?? PLAIN_TYPES[(spec.salt ?? Math.floor(Math.random() * 1_000_000)) % PLAIN_TYPES.length]!;
}

/** 적 낱말 → 데이터베이스 적 id(보이는 잡몹). 「불 속성」처럼 종이 없는 말은 주제 적에 맡긴다. */
const FOE_WORDS: readonly [RegExp, string][] = [
  [/늑대|wolf|wolves/, "enemy_wolf_grey"], [/유령|ghost|망령|spectre|specter/, "enemy_ghost_pale"], [/박쥐|bat\b|bats/, "enemy_bat_cave"],
  [/거미|spider/, "enemy_spider_cave"], [/해골|skeleton/, "enemy_skeleton_bone"], [/좀비|zombie/, "enemy_zombie_rot"],
  [/고블린|goblin/, "enemy_goblin_scout"], [/슬라임|slime/, "enemy_slime_blue"], [/미라|mummy|mummies/, "enemy_mummy_bandage"],
  [/전갈|scorpion/, "enemy_scorpion_sand"], [/도마뱀|리자드|lizard/, "enemy_lizardman_spear"], [/독사|뱀|snake|viper/, "enemy_snake_viper"],
  [/눈알|떠다니는\s*눈|부유하는\s*눈|floating\s*eye|eyeball|beholder/, "enemy_eye_floating"], [/갑옷|armou?r/, "enemy_armor_living"],
  [/악마|demon|임프|imp\b|devil/, "enemy_imp_mischief"], [/골렘|golem/, "enemy_golem_stone"], [/쥐|\brats?\b/, "enemy_rat_giant"],
  [/오크|\borcs?\b/, "enemy_orc_warrior"], [/가고일|gargoyle/, "enemy_gargoyle_stone"], [/식충|carnivor|plant/, "enemy_plant_carnivore"],
  [/화염\s*지네|centipede/, "enemy_centipede_fire"], [/사냥개|hellhound|hound/, "enemy_hound_hell"], [/도깨비불|wisp/, "enemy_wisp_blue"],
];
/** 보스 낱말 → [적 id, 보스 이름]. 잡몹 낱말과 겹치지 않는 보스급만. 그림은 맵에서 잡몹과 구별되는 것으로 골랐다(1배 그림 대조, 2026-10-23). */
const BOSS_WORDS: readonly [RegExp, string, string][] = [
  [/히드라|hydra/, "enemy_hydra_three", "늪의 히드라"], [/얼음\s*용|빙룡|청룡|ice\s*dragon|frost\s*dragon|blue\s*dragon/, "enemy_dragon_blue", "빙굴의 얼음 용"],
  [/붉은\s*용|화룡|red\s*dragon|fire\s*dragon/, "enemy_dragon_red", "화산의 붉은 용"], [/본\s*드래곤|뼈\s*용|bone\s*dragon/, "enemy_dragon_bone", "본 드래곤"],
  // 피라미드 왕: 금빛 머리 장식의 본 드래곤 그림이 맵에서 파라오처럼 읽힌다(수정 골렘은 갈색 덩어리로 묘실 바닥에 묻혔다).
  [/파라오|pharaoh|왕의\s*묘실|왕묘|묘실의?\s*왕|tomb\s*king|mummy\s*king|미라\s*왕/, "enemy_dragon_bone", "왕묘의 파라오"],
  [/마왕|군주|demon\s*lord|overlord|archdemon/, "enemy_demon_lord", "마계의 군주"],
  [/대마법사|마법사\s*보스|archmage|arch-?mage|wizard\s*boss|sorcerer/, "enemy_mage_rogue", "탑의 대마법사"], [/리치|lich/, "enemy_lich_frost", "리치"],
  [/미노타우로스|minotaur/, "enemy_minotaur_maze", "미궁의 미노타우로스"], [/트롤|troll/, "enemy_troll_cave", "늙은 트롤"], [/베히모스|behemoth/, "enemy_behemoth_horn", "베히모스"],
  [/숲의\s*주인|forest\s*lord|forest\s*guardian/, "enemy_troll_cave", "숲의 주인"],
  [/드래곤|dragon|(^|\s)용(\s|$)/, "enemy_dragon_red", "용"],
];
/** 이름·외형 낱말 → 적 그림 id(보스 낱말 → 기사·망령 → 잡몹 낱말). 프로젝트 DB 에 있는 것만. add_boss_encounter 가 쓴다. */
export function enemyArtFor(project: Project, text: string): string | undefined {
  const t = text.toLowerCase();
  const has = (id: string) => project.database.enemies.some((e) => e.id === id);
  const knights: readonly [RegExp, string][] = [[/해골\s*기사|skeleton\s*knight|죽음의\s*기사|death\s*knight/, "enemy_skeleton_knight"], [/타락한?\s*기사|흑기사|기사|knight/, "enemy_knight_fallen"], [/망령|사령|wraith/, "enemy_wraith_dark"]];
  for (const [re, id] of BOSS_WORDS) if (re.test(t) && has(id)) return id;
  for (const [re, id] of knights) if (re.test(t) && has(id)) return id;
  for (const [re, id] of FOE_WORDS) if (re.test(t) && has(id)) return id;
  return undefined;
}
/** 맵 위 그림이 서로 닮은 적 묶음 — 보스는 잡몹·수문장과 다른 묶음이어야 「보스」로 읽힌다. 골렘은 맵에서 갈색 덩어리라 보스·잡몹 모두 피한다. */
const LOOKALIKE: readonly (readonly string[])[] = [
  ["enemy_armor_living", "enemy_knight_fallen", "enemy_skeleton_knight"], ["enemy_ghost_pale", "enemy_wraith_dark"],
  ["enemy_eye_floating", "enemy_lich_frost"], ["enemy_golem_stone", "enemy_golem_iron", "enemy_golem_crystal", "enemy_golem_clay"],
];
const BLOB = new Set(LOOKALIKE[3]);
const lookGroup = (id: string): string => LOOKALIKE.find((g) => g.includes(id))?.[0] ?? id;
/** 요청한 잡몹 → 같은 무리의 우두머리(보스 낱말이 없을 때). */
const KIN_BOSS: Readonly<Record<string, [string, string]>> = {
  enemy_bat_cave: ["enemy_bat_vampire", "동굴의 흡혈 박쥐"], enemy_wolf_grey: ["enemy_wolf_dire", "늑대 우두머리"], enemy_spider_cave: ["enemy_spider_widow", "동굴의 과부 거미"],
  enemy_slime_blue: ["enemy_slime_king", "슬라임 왕"], enemy_goblin_scout: ["enemy_goblin_brute", "고블린 대장"], enemy_orc_warrior: ["enemy_orc_shaman", "오크 족장"],
  enemy_skeleton_bone: ["enemy_dragon_bone", "본 드래곤"], enemy_rat_giant: ["enemy_slime_king", "하수도의 슬라임 왕"],
};
/** 주제 보스 그림이 덩어리이거나 잡몹과 닮았을 때 대신 쓸 보스(종류별). */
const BOSS_FALLBACK: Partial<Record<DungeonType, [string, string]>> = {
  pyramid: ["enemy_dragon_bone", "왕묘의 파라오"], temple: ["enemy_dragon_bone", "신전의 수호룡"], mine: ["enemy_behemoth_horn", "광산 깊은 곳의 괴수"],
  castle: ["enemy_angel_fallen", "탑의 흑기사"], tower: ["enemy_mage_rogue", "탑의 대마법사"],
};
/** 장치 낱말 → gimmick. */
const GIMMICK_WORDS: readonly [string, RegExp][] = [
  ["sandpit", /함정|trap|pitfall|모래\s*구덩/], ["teleporter", /마법진|순간이동|teleport|warp/], ["iceslide", /미끄럼|빙판\s*길|ice\s*slide|slide/],
  ["minecart", /광차|minecart|mine\s*cart/], ["lever", /레버|lever/], ["bridge", /도개교|내리는\s*다리|drawbridge/],
];

interface DungeonPlan {
  readonly args: Record<string, unknown>;
  readonly type: DungeonType;
  readonly foes: readonly string[];
  readonly boss?: readonly [string, string];
  readonly missing: string[];
  readonly warnings: string[];
}

/** 명세 → author_dungeon 인자 + 요청한 적·보스 + 표현 못 하는 요청·경고. */
export function dungeonArgs(spec: PlaceSpec, keepType?: DungeonType): DungeonPlan {
  const args: Record<string, unknown> = {};
  const missing: string[] = [];
  const warnings: string[] = [];
  const text = words(spec);
  const type = pickType(spec, text, keepType);
  args.type = type;
  if (spec.size) args.size = spec.size;
  const floors = Math.max(1, Math.min(5, Math.round(spec.floors ?? 1)));
  const upWords = /tower|탑|꼭대기|위층|top\s*floor|summit/.test(text);
  const downWords = /지하|아래층|맨\s*아래|basement|underground|below/.test(text);
  if (floors > 1) { args.floors = floors; args.direction = type === "tower" || (upWords && !downWords) ? "up" : "down"; }
  else if (upWords && type !== "tower") warnings.push("탑이지만 floors 가 1 이다 — 층수를 주면 위로 오른다");
  const empty = /no.?enem|적\s*없|빈\s*던전|empty/.test(text);
  args.populate = !empty;
  if (/flood|물에\s*잠|수몰|잠긴/.test(text)) {
    if (["cave", "volcano", "ice", "forest", "swamp", "otherworld", "labyrinth"].includes(type)) warnings.push(`${type} 은 물에 잠기지 않는다(flooded 는 방 문법 던전만) — 무시했다`);
    else args.flooded = true;
  }
  for (const [g, re] of GIMMICK_WORDS) if (re.test(text)) { args.gimmick = g; break; }
  // 장치를 말하지 않았으면 요청에 맞는 것으로: 늪·화산 「건너가는」 길 = 다리, 탑 = 마법진(레버 쇠창살은 좁은 탑 통로에 떠 보였다 — 2026-10-23 비교 검수).
  if (args.gimmick === undefined) {
    if ((type === "swamp" || type === "volcano") || /다리|bridge|건너|cross/.test(text)) args.gimmick = "bridge";
    else if (type === "tower" || (type === "castle" && args.direction === "up")) args.gimmick = "teleporter";
    else if (type === "pyramid") args.gimmick = "sandpit";
    else if (type === "ice") args.gimmick = "iceslide";
  }
  if (/goblin|lair|소굴|고블린/.test(text)) {
    if (type === "cave") args.lair = true;
    else warnings.push("고블린 소굴은 동굴 type 에서만 된다 — 무시했다");
  }
  if (/torch|횃불|door|문\s*지정/.test(text)) warnings.push("조각(문·횃불) 지정은 못 한다 — 도구가 알아서 놓는다");
  for (const [key, value] of Object.entries(spec.hints ?? {})) {
    // 스키마 칸을 0·빈 값으로 다 채우는 모델(terra)이 있다 — 빈 값은 「안 줬다」로 읽는다. 마을의 hints.layout(자리 객체)이 던전 layout(배치 가족 낱말)으로
    // 넘어가 author_dungeon 인자 검증에 걸렸다(2026-10-30 dd1030 terra 같은 요청 3판 모두 실패).
    if (value === "" || value === 0 || value === null || (typeof value === "object" && !Array.isArray(value))) continue;
    if (value === false && !KNOWN_HINTS.has(key)) continue;
    if (!KNOWN_HINTS.has(key)) { warnings.push(`알 수 없는 hints.${key} 는 무시했다`); continue; }
    if (key === "variant" || key === "style") continue;
    if (key === "type" && !(TYPES as readonly string[]).includes(String(value))) { warnings.push(`알 수 없는 type ${String(value)} → ${type}`); continue; }
    if (key === "floorShapes" || key === "floorGimmicks") { args[key] = String(value).split(/[,\s·]+/).map((x) => x.trim().toLowerCase()).filter(Boolean); continue; }
    args[key] = value;
  }
  // 적·보스 낱말. 보스 낱말을 먼저 지워야 「얼음 용」의 「용」이 잡몹으로 안 잡힌다.
  let rest = text;
  let boss: [string, string] | undefined;
  for (const [re, id, name] of BOSS_WORDS) if (re.test(rest)) { boss ??= [id, name]; rest = rest.replace(new RegExp(re.source, "g"), " "); }
  const foes: string[] = [];
  for (const [re, id] of FOE_WORDS) if (re.test(rest)) { if (!foes.includes(id)) foes.push(id); rest = rest.replace(new RegExp(re.source, "g"), " "); }
  // 조수가 설계한 층(2026-10-29): 방·길·입구 쪽은 설계 그대로 도구에 넘긴다 — 함수는 조화(겹침·길·도달)만 하고 「고침:」으로 알린다.
  if (spec.dungeonDesign && typeof spec.dungeonDesign === "object") args.design = spec.dungeonDesign;
  if (Array.isArray(spec.floorDesigns) && spec.floorDesigns.length) args.floorDesigns = spec.floorDesigns;
  return { args, type: args.type as DungeonType, foes, boss, missing, warnings };
}

/** 지을 맵 고르기: 이전 기록의 첫 층 → 명세 mapId → 현재 맵이 빈 버들항 맵이면 그 맵 → 새 맵. */
function targetMapId(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): string | undefined {
  if (previous?.result.mapIds[0]) return previous.result.mapIds[0];
  if (spec.mapId) return spec.mapId;
  const cur = run.ctx.currentMapId ? run.ctx.project.maps[run.ctx.currentMapId] : undefined;
  if (cur && cur.tilesetId === BEODEUL_TILESET && isBlankMap(cur)) return cur.id;
  return undefined;
}

type Pt = { x: number; y: number };
const enemyOf = (project: Project, troopId: string | undefined) => {
  const troop = project.database.troops.find((t) => t.id === troopId);
  const lead = troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0];
  return project.database.enemies.find((e) => e.id === lead);
};
const art = (project: Project, troopId: string | undefined): string | undefined => {
  const e = enemyOf(project, troopId) as { monsterResourceId?: string; id?: string } | undefined;
  return e?.monsterResourceId ?? e?.id;
};

const strength = (project: Project, troopId: string | undefined): number =>
  (project.database.troops.find((t) => t.id === troopId)?.members ?? []).reduce((sum, m) => {
    const e = project.database.enemies.find((x) => x.id === m.enemyId);
    return sum + (e?.stats?.maxHp ?? 0) + 4 * (e?.stats?.attack ?? 0);
  }, 0);

/**
 * 요청한 적 하나의 전용 적 그룹. 그림은 그 적 그대로, 세기는 도구가 그 역할로 고르던 그룹(like)에 맞춘 사본 — 원본 그대로 쓰면
 * 부유하는 눈(체력 1312)이 잡몹이 되어 「파티가 레벨을 올려도 전멸」 경고가 났다. 도구 주제 적(dungeonThemeTroops)과 같은 비례 규칙이다.
 */
export function ensureFoeTroop(run: BuildRun, enemyId: string, role: "field" | "boss" | "midBoss", like: string | undefined, name?: string): string | undefined {
  const project = run.ctx.project;
  const source = project.database.enemies.find((e) => e.id === enemyId);
  if (!source) return undefined;
  const short = enemyId.replace(/^enemy_/, "");
  const troopId = `troop_v2_${role}_${short}`;
  if (project.database.troops.some((t) => t.id === troopId)) return troopId;
  const count = role === "field" ? Math.max(1, Math.min(3, project.database.troops.find((t) => t.id === like)?.members?.length ?? 2)) : 1;
  const target = strength(project, like);
  const own = (source.stats?.maxHp ?? 0) + 4 * (source.stats?.attack ?? 0);
  const k = target > 0 && own > 0 ? target / own : 1;
  const stats = { ...(source.stats as unknown as Record<string, number>) };
  for (const key of ["maxHp", "attack", "defense", "mind", "agility", "luck"]) if (typeof stats[key] === "number") stats[key] = Math.max(1, Math.round(stats[key]! * (key === "maxHp" ? k / count : Math.sqrt(k))));
  const enemyIdCopy = `enemy_v2_${role}_${short}`;
  const s = source as unknown as Record<string, unknown>;
  const copy: Record<string, unknown> = { id: enemyIdCopy, name: name ?? source.name, stats };
  for (const key of ["monsterResourceId", "battleScalePercent", "level", "skillIds", "rewards", "actions", "criticalHit", "attackOptions"]) if (s[key] !== undefined) copy[key] = structuredClone(s[key]);
  // 세기는 시작 파티에 맞춘다(dungeonThemeTroops 와 같은 맞춤) — 비례 옮기기는 파티가 없을 때만.
  const fit = fitEnemyToStartParty(project, { ...source, id: enemyIdCopy, stats } as unknown as EnemyRecord, role, count);
  if (fit) { copy.stats = fit.stats; copy.level = fit.level; if (fit.actions) copy.actions = fit.actions; if (fit.skillIds) copy.skillIds = fit.skillIds; }
  const made = run.call("upsert_enemy", { enemy: copy, role: role === "boss" ? "boss" : "normal" });
  const useId = made.ok ? enemyIdCopy : enemyId;
  const r = run.call("upsert_troop", { troop: { id: troopId, name: role === "field" ? `${source.name} 무리` : name ?? source.name, enemyIds: Array.from({ length: count }, () => useId) } });
  return r.ok ? troopId : undefined;
}

/**
 * 적 그룹 정하기: 요청한 적·보스가 있으면 그 그림의 전용 그룹, 없으면 도구 주제 적. 보스 그림은 잡몹·수문장과 닮지 않게(LOOKALIKE),
 * 맵에서 갈색 덩어리로 보이는 골렘은 피한다 — 「3층 보스가 2층 몬스터 그림을 다시 써서 보스답지 않다」(2026-10-23 비교 검수).
 */
function planTroops(run: BuildRun, plan: DungeonPlan, toolArgs: Record<string, unknown>, warnings: string[]): Record<string, unknown> | undefined {
  const theme = dungeonTheme(toolArgs);
  const base = pickTroops(run.ctx.project, undefined);
  const troops: Record<string, unknown> = {};
  const like = (i: number) => base.field[i % Math.max(1, base.field.length)];
  // 잡몹: 요청 > 주제(덩어리 골렘 빼고). 도구는 주제 잡몹 앞 둘을 쓴다.
  let fieldEnemies: string[] = theme.field.slice(0, 2);
  if (plan.foes.length) fieldEnemies = plan.foes.slice(0, 3);
  else if (fieldEnemies.some((id) => BLOB.has(id))) {
    const keep = theme.field.filter((id) => !BLOB.has(id));
    fieldEnemies = [...keep, ...["enemy_sword_flying", "enemy_skeleton_bone"].filter((id) => !keep.includes(id))].slice(0, 2);
  }
  if (plan.foes.length || fieldEnemies.join() !== theme.field.slice(0, 2).join()) {
    const ids = fieldEnemies.map((id, i) => ensureFoeTroop(run, id, "field", like(i))).filter((v): v is string => !!v);
    if (ids.length) troops.field = ids;
    else fieldEnemies = theme.field.slice(0, 2);
  }
  const taken = new Set(fieldEnemies.map(lookGroup));
  // 보스: 요청 > 주제. 잡몹과 닮았거나 덩어리면 종류별 대체.
  // 보스 낱말이 없으면 요청한 잡몹의 큰 친척(박쥐 동굴 → 흡혈 박쥐): 「박쥐 동굴」 보스가 과부 거미라 거미 굴로 읽혔다(2026-10-23 비교 검수).
  const kin = plan.boss ? undefined : plan.foes.map((id) => KIN_BOSS[id]).find((v) => !!v);
  let boss: [string, string] = plan.boss ? [plan.boss[0], plan.boss[1]] : kin ?? [theme.boss, ""];
  if (taken.has(lookGroup(boss[0])) || BLOB.has(boss[0])) {
    const type = String(toolArgs.type) as DungeonType;
    const alt = [BOSS_FALLBACK[type], ["enemy_demon_lord", "깊은 곳의 마왕"] as [string, string], ["enemy_behemoth_horn", "베히모스"] as [string, string]]
      .find((c): c is [string, string] => !!c && !taken.has(lookGroup(c[0])) && !BLOB.has(c[0]));
    if (alt) boss = alt; else warnings.push("보스 그림이 잡몹과 닮았다 — 대신할 그림을 찾지 못했다");
  }
  if (boss[0] !== theme.boss) {
    const id = ensureFoeTroop(run, boss[0], "boss", base.boss, boss[1] || undefined);
    if (id) troops.boss = id; else boss = [theme.boss, ""];
  }
  taken.add(lookGroup(boss[0]));
  // 수문장(마지막 앞 층): 보스·잡몹과 닮지 않게(성: 타락한 기사 둘, 탑: 살아있는 갑옷 = 잡몹).
  if (Number(toolArgs.floors) > 1 && (taken.has(lookGroup(theme.midBoss)) || BLOB.has(theme.midBoss))) {
    const alt = ["enemy_gargoyle_stone", "enemy_ogre_club", "enemy_wolf_dire", "enemy_spider_widow", "enemy_worm_sand"].find((id) => !taken.has(lookGroup(id)));
    const id = alt ? ensureFoeTroop(run, alt, "midBoss", base.midBoss) : undefined;
    if (id) troops.midBoss = id;
  }
  return Object.keys(troops).length ? troops : undefined;
}

interface FloorRoom { id: string; kind: string; x: number; y: number; w: number; h: number }
const roomsOf = (d: Record<string, unknown> | undefined): FloorRoom[] =>
  (Array.isArray(d?.rooms) ? (d!.rooms as Record<string, unknown>[]) : []).flatMap((r) => (typeof r.id === "string" && Number.isFinite(r.x) ? [{ id: r.id, kind: String(r.kind), x: Number(r.x), y: Number(r.y), w: Number(r.w), h: Number(r.h) }] : []));
const inRoom = (r: FloorRoom, p: Pt): boolean => p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** 출발 칸에서 걸어서 닿는 칸들의 걸음 거리(BFS). 닿지 않는 칸은 -1. */
function walkDistance(project: Project, map: GameMap, start: Pt): Int32Array {
  const dist = new Int32Array(map.width * map.height).fill(-1);
  const reach = terrainReachability(project, map, start);
  const q: Pt[] = [start];
  if (!reach[start.y * map.width + start.x]) return dist;
  dist[start.y * map.width + start.x] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx, y = c.y + dy, k = y * map.width + x;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height || dist[k]! >= 0 || !reach[k]) continue;
      dist[k] = dist[c.y * map.width + c.x]! + 1;
      q.push({ x, y });
    }
  }
  return dist;
}

const isFoe = (id: string): boolean => /_foe\d|_v2foe\d/.test(id);
const isChest = (id: string): boolean => /_chest\d|_v2chest/.test(id);
const isBoss = (id: string): boolean => /_boss$|_guardian$/.test(id);

/**
 * 보스를 크게 그린다(2026-10-23 3·4차 눈가림: 두 쪽 다 «붉은 용»·«숲의 주인»이 1칸 잡몹 크기라 보스로 안 읽혔다).
 * 그림 배율(graphic.scale, 자동 맞춤에 곱함)은 충돌과 따로라, 몸 사각(footprint 3×2, 발밑 한 줄만 막음)을 같이 줘서
 * 큰 몸이 벽을 뚫고 보이거나 플레이어가 몸 위를 걸어 지나가지 않게 한다. 몸 여섯 칸이 모두 걸을 수 있는 바닥이고 다른 이벤트가 없으며
 * 발밑 줄을 막아도 전에 닿던 칸이 모두 닿는 자리여야 한다 — 지금 자리가 안 되면 같은 방(없으면 4칸 안)에서 가장 가까운 자리로 옮긴다.
 */
function enlargeBoss(run: BuildRun, mapId: string, d: Record<string, unknown> | undefined, eventRe: RegExp, scale: number, warnings: string[], allowMove = true): string | undefined {
  const project = run.ctx.project;
  const map = project.maps[mapId];
  const ev = map?.events.find((e) => eventRe.test(e.id));
  if (!map || !ev || !(ev.pages ?? []).some((pg) => pg.graphic?.sprite)) return undefined;
  const w = map.width;
  const front = (d?.entryStair as { front?: Pt } | null | undefined)?.front ?? (d?.entrance as Pt | undefined);
  let start: Pt | undefined = project.startMapId === mapId && project.startPos ? { x: project.startPos.x, y: project.startPos.y } : front ? { x: front.x, y: front.y } : undefined;
  let reach = start ? terrainReachability(project, map, start) : undefined;
  // 장치(다리·레버·마법진)로만 이어지는 보스방은 입구에서 땅으로 안 닿는다 — 그때는 보스 자리가 속한 덩이 안에서 보스에서 가장 먼 칸을 기준으로 잰다.
  if (!reach || !reach[ev.y * w + ev.x]) {
    const local = terrainReachability(project, map, { x: ev.x, y: ev.y });
    let far: Pt | undefined, best = -1;
    for (let k = 0; k < local.length; k++) if (local[k]) { const x = k % w, y = Math.floor(k / w), dd = Math.abs(x - ev.x) + Math.abs(y - ev.y); if (dd > best) { best = dd; far = { x, y }; } }
    start = far; reach = far ? local : undefined;
  }
  const occupied = new Set(map.events.filter((e) => e.id !== ev.id).map((e) => e.y * w + e.x));
  const free = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < map.height && isPassable(project, map, x, y) && !occupied.has(y * w + x)
    && (map.upperTiles?.[y * w + x] ?? -1) < 0;
  const stillConnected = (bx: number, by: number): boolean => {
    if (!reach || !start) return true;
    const blocked = new Set([bx - 1, bx, bx + 1].map((x) => by * w + x));
    if (blocked.has(start.y * w + start.x)) return false;
    const seen = new Uint8Array(reach.length);
    const q = [start]; seen[start.y * w + start.x] = 1;
    for (let i = 0; i < q.length; i++) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = q[i]!.x + dx, y = q[i]!.y + dy, k = y * w + x;
      if (x < 0 || y < 0 || x >= w || y >= map.height || seen[k] || !reach[k] || blocked.has(k)) continue;
      seen[k] = 1; q.push({ x, y });
    }
    // 보스 앞(발밑 줄 아래 한 칸)에 설 수 있어야 싸움을 건다.
    for (let k = 0; k < reach.length; k++) if (reach[k] && !blocked.has(k) && !seen[k]) return false;
    return [bx - 1, bx, bx + 1].some((x) => seen[(by + 1) * w + x]) || seen[by * w + bx - 2] === 1 || seen[by * w + bx + 2] === 1;
  };
  const fits = (x: number, y: number) => [-1, 0, 1].every((dx) => free(x + dx, y) && free(x + dx, y - 1)) && stillConnected(x, y);
  const room = roomsOf(d).find((r) => inRoom(r, ev));
  let at: Pt | undefined = fits(ev.x, ev.y) ? { x: ev.x, y: ev.y } : undefined;
  if (!at && allowMove) {
    const cands: (Pt & { dd: number })[] = [];
    for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < w - 1; x++) {
      const dd = Math.abs(x - ev.x) + Math.abs(y - ev.y);
      if ((room ? inRoom(room, { x, y }) && inRoom(room, { x: x - 1, y: y - 1 }) && inRoom(room, { x: x + 1, y }) : dd <= 4) && fits(x, y)) cands.push({ x, y, dd });
    }
    cands.sort((a, b) => a.dd - b.dd);
    for (const c of cands.slice(0, 6)) {
      const moved = run.call("move_event", { mapId, eventId: ev.id, x: c.x, y: c.y });
      const now = run.ctx.project.maps[mapId]?.events.find((e) => e.id === ev.id);
      if (moved.ok && now && now.x === c.x && now.y === c.y) { at = c; break; }
    }
  }
  if (!at) { warnings.push(`보스(${ev.name ?? ev.id}): 3×2 몸이 들어갈 빈 바닥이 없어 1칸 크기 그대로 둔다`); return undefined; }
  const cur = run.ctx.project.maps[mapId]!.events.find((e) => e.id === ev.id)!;
  (cur.pages ?? []).forEach((page, pageIndex) => {
    if (!page.graphic?.sprite) return;
    const res = run.call("patch_event_page", { mapId, eventId: cur.id, pageIndex, set: { graphic: { ...page.graphic, scale, scaleMode: "auto" }, footprint: { width: 3, height: 2 }, passRows: 1 } });
    if (!res.ok) warnings.push(`보스 크게 그리기 실패: ${String(res.summary).slice(0, 140)}`);
  });
  return `${cur.name ?? cur.id} ${scale}배·몸 3×2 (${at.x},${at.y})`;
}

/** 층마다 보이는 적 수·가장 깊은 곳 상자를 맞춘다(도구 손잡이가 없는 것만). */
function topUp(run: BuildRun, floors: readonly string[], floorData: readonly Record<string, unknown>[], fieldTroops: readonly string[], wantsFoes: boolean, wantsChest: boolean, tower: boolean, warnings: string[]): void {
  const project = run.ctx.project;
  let addedFoes = 0;
  floors.forEach((floorId, i) => {
    const map = project.maps[floorId];
    if (!map) return;
    const d = floorData[i];
    const front = (d?.entryStair as { front?: Pt } | null | undefined)?.front ?? (d?.entrance as Pt | undefined);
    const start = project.startMapId === floorId && project.startPos ? { x: project.startPos.x, y: project.startPos.y } : front ? { x: front.x, y: front.y } : { x: Math.floor(map.width / 2), y: map.height - 2 };
    const dist = walkDistance(project, map, start);
    const rooms = roomsOf(d);
    const bossRoomId = typeof (d?.anchors as Record<string, unknown> | undefined)?.boss === "string" ? String((d!.anchors as Record<string, unknown>).boss) : undefined;
    const bossRoom = rooms.find((r) => r.id === bossRoomId);
    const last = i === floors.length - 1;
    const near = (p: Pt, r: number) => map.events.some((e) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= r);
    const cells: (Pt & { d: number; clean: boolean })[] = [];
    for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
      const dd = dist[y * map.width + x]!;
      if (dd < 0 || !isPassable(project, map, x, y)) continue;
      // 머리 위 층(수관·처마)에 덮인 칸은 뺀다 — 숲 큰 나무 수관 위에 상자가 그려졌다.
      const k = y * map.width + x;
      if ((map.upperTiles?.[k] ?? -1) >= 0 || (map.upperOverlayTiles?.[k] ?? -1) >= 0) continue;
      // 1칸 통로 막지 않게: 네 이웃 중 셋 이상 걸을 수 있는 칸만(방 안).
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => dist[(y + dy!) * map.width + x + dx!]! >= 0).length;
      if (open < 3) continue;
      // 바닥 덧칠(수관 가장자리·잎 그늘 등)이 없는 칸을 먼저 쓴다 — 큰 나무 수관 끝에 상자가 겹쳐 보였다.
      cells.push({ x, y, d: dd, clean: (map.lowerOverlayTiles?.[k] ?? -1) < 0 });
    }
    // 보이는 적: 탑 층 2마리, 그 밖 3마리 이상(보스방 밖, 입구에서 6걸음 넘게, 서로 떨어지게).
    if (wantsFoes && fieldTroops.length) {
      const target = tower ? 2 : 3;
      let have = map.events.filter((e) => isFoe(e.id)).length;
      const picks: Pt[] = map.events.filter((e) => isFoe(e.id) || isBoss(e.id)).map((e) => ({ x: e.x, y: e.y }));
      let k = 0;
      while (have < target) {
        const all = cells.filter((c) => c.d >= 6 && !(bossRoom && inRoom(bossRoom, c)) && !near(c, 2));
        const pool = all.some((c) => c.clean) ? all.filter((c) => c.clean) : all;
        if (!pool.length) break;
        const anchors = [start, ...picks];
        const score = (c: Pt) => Math.min(...anchors.map((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y)));
        const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a));
        if (score(best) < 4) break;
        const troopId = fieldTroops[(have + i) % fieldTroops.length];
        const r = run.call("place_field_enemy", { mapId: floorId, x: best.x, y: best.y, troopId, behavior: "patrol", patrol: { length: 2, axis: k % 2 ? "vertical" : "horizontal" }, id: `ev_${floorId}_v2foe${++k}` });
        const r2 = r.ok ? r : run.call("place_field_enemy", { mapId: floorId, x: best.x, y: best.y, troopId, behavior: "stationary", id: `ev_${floorId}_v2foe${k}` });
        cells.splice(cells.indexOf(best), 1);
        if (r2.ok) { have++; addedFoes++; picks.push(best); }
      }
    }
    // 가장 깊은 곳 상자: 마지막 층(한 층이면 그 층)에서 입구에서 가장 먼 쪽(보스방이 있으면 보스 뒤 그 방 안 가장 먼 칸).
    if (wantsChest && last) {
      const maxD = Math.max(0, ...cells.map((c) => c.d));
      const deepZone = (c: Pt & { d: number }) => (bossRoom ? inRoom(bossRoom, c) && c.d >= maxD * 0.6 : c.d >= maxD * 0.8);
      const chests = map.events.filter((e) => isChest(e.id));
      const deepChest = chests.some((e) => { const dd = dist[e.y * map.width + e.x]!; return dd >= maxD * (bossRoom ? 0.6 : 0.8) && (!bossRoom || inRoom(bossRoom, e)); });
      if (!deepChest) {
        const zone = [...cells].filter((c) => deepZone(c) && !near(c, 1));
        // 벽을 등진 상자 자리(조립기 chestSpots: 물에서 떨어진 칸)가 먼저 — 트인 바닥 한가운데·물길 옆 상자는 떠 있어 보였다(2026-10-29 야외 VQA).
        const backedSet = new Set(((d?.rooms ?? []) as { chestSpots?: Pt[] }[]).flatMap((r) => r.chestSpots ?? []).map((c) => c.y * map.width + c.x));
        const rank = (c: Pt) => (backedSet.has(c.y * map.width + c.x) ? 0 : 1);
        const pool = zone.some((c) => c.clean) ? zone.filter((c) => c.clean) : zone;
        const spot = pool.sort((a, b) => rank(a) - rank(b) || b.d - a.d)[0];
        if (spot) {
          // 같은 그림 상자 셋부터는 「임시 표식」 린트 — 둘이면 얕은 상자 하나를 깊은 곳으로 옮긴다.
          if (chests.length >= 2) {
            const shallow = [...chests].sort((a, b) => dist[a.y * map.width + a.x]! - dist[b.y * map.width + b.x]!)[0]!;
            run.call("remove_event", { mapId: floorId, eventId: shallow.id });
          }
          const r = run.call("place_chest", { mapId: floorId, x: spot.x, y: spot.y, id: `ev_${floorId}_v2chest`, name: "깊은 곳의 보물상자", contents: { gold: 500 } });
          if (r.ok) warnings.push(`${map.name}: 맨 안쪽(${spot.x},${spot.y})에 보물상자를 두었다`);
        }
      }
    }
  });
  if (addedFoes) warnings.push(`보이는 적이 적은 층에 ${addedFoes}마리를 입구에서 먼 방에 더 세웠다`);
}

const SEED_TRIALS = 4;

/** 배치 점수(높을수록 요청에 맞다): 건너는 다리·요청 장치·보이는 적·상자·맨바닥 넓이. */
function layoutScore(data: Record<string, unknown>, type: DungeonType, args: Record<string, unknown>): number {
  const floors = (Array.isArray(data.floorData) ? data.floorData : [data]) as Record<string, unknown>[];
  let score = 0;
  for (const d of floors) {
    const liquid = (d.liquid ?? {}) as { kind?: string; cells?: number; bridges?: number };
    if (type === "swamp" || type === "volcano") score += 4 * Math.min(3, liquid.bridges ?? 0) + Math.min(3, (liquid.cells ?? 0) / 60);
    const placed = (d.placed ?? {}) as { enemies?: number; chests?: number };
    score += Math.min(4, placed.enemies ?? 0) + Math.min(2, placed.chests ?? 0);
    score -= (Number(d.width) * Number(d.height)) / 900; // 같은 방 수면 작은 판이 덜 휑하다
  }
  if (args.gimmick && data.gimmick === args.gimmick) score += 4;
  return score;
}

function build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult {
  const plan = dungeonArgs(spec, (previous?.result.state as DungeonState | undefined)?.args?.type as DungeonType | undefined);
  const { args, type, missing, warnings } = plan;
  const prev = previous?.result.state as DungeonState | undefined;
  const mapId = targetMapId(run, spec, previous);
  // 다시 짓기 전에: 던전 밖 맵(숲·마을)에서 이 던전 층으로 들어오는 이동을 조수가 따로 이었으면, 층을 다시 지으면 크기가 바뀌어
  // 그 이동 좌표가 맵 밖이 되고 커밋이 거부된다(2026-10-25 조수 단독 게임 G5: 「transfer 목적지가 맵 경계 밖 (29,50)」).
  // 다시 짓기 전에: 던전 밖 맵(숲·마을)에서 이 던전 층으로 들어오는 문이 이미 이어져 있으면, 층을 다시 지을 때 크기가 바뀌어
  // 그 이동 좌표가 맵 밖이 되고 커밋이 거부된다(2026-10-25 G5). 1층으로 들어오는 바깥 문이 한 맵에서 하나면 그 문을 지우고
  // 같은 칸에 다시 잇는다(author_dungeon entrance) — 짓기가 문을 잇고 나면 던전을 못 고치던 것(G26)을 푼다. 더 깊은 층으로 들어오는 문은 그대로 거절.
  let relink: { readonly fromMapId: string; readonly x: number; readonly y: number; readonly eventIds: readonly string[] } | undefined;
  // 남겨 두고 다시 가리킬 바깥 문(다시 잇는 문 빼고) — 「맵 id:이벤트 id」.
  let incomingKeep = new Set<string>();
  if (previous) {
    const floorList = [...(prev?.floors ?? previous.result.mapIds)];
    const floors = new Set<string>(floorList);
    const linked: { mapId: string; mapName: string; event: { id: string; name?: string; x: number; y: number }; floor: string }[] = [];
    for (const m of Object.values(run.ctx.project.maps)) {
      if (floors.has(m.id)) continue;
      for (const ev of m.events) {
        const text = JSON.stringify(ev.pages ?? []);
        for (const hit of text.matchAll(/\{[^{}]*"kind":"transfer"[^{}]*\}/gu)) {
          const to = /"mapId":"([^"]+)"/u.exec(hit[0])?.[1] ?? "";
          if (floors.has(to)) { linked.push({ mapId: m.id, mapName: m.name, event: ev, floor: to }); break; }
        }
      }
    }
    // 1층으로 들어오는 바깥 문 하나(맵 하나)는 지우고 다시 지은 입구에 그 칸 그대로 다시 잇는다(relink). 나머지 문(다른 맵·아래층으로 들어오는 문)은
    // 거절하지 않고 남겨 두었다가 다시 지은 층의 가장 가까운 걸어 닿는 칸으로 다시 가리킨다(dungeonRebuildCarry — 2026-10-30 omo-loop-1030b boss-room:
    // 마을·지하 던전 두 곳에서 들어오는 보스 방을 «여러 맵에서 이어져 있다»로 세 판 모두 못 고쳤다).
    const head = linked.find((l) => l.floor === floorList[0]);
    if (head) {
      const gate = head.event;
      relink = { fromMapId: head.mapId, x: gate.x, y: gate.y, eventIds: linked.filter((l) => l.mapId === head.mapId && l.floor === floorList[0]).map((l) => l.event.id) };
      warnings.push(`바깥 ${head.mapName}(${gate.x},${gate.y})의 던전 문을 다시 지은 입구와 다시 이었다`);
    }
    const others = linked.filter((l) => !relink?.eventIds.includes(l.event.id));
    incomingKeep = new Set(others.map((l) => `${l.mapId}:${l.event.id}`));
    if (others.length) warnings.push(`다른 곳에서 들어오는 문 ${others.length}개(${others.slice(0, 3).map((l) => `${l.mapName}의 ${l.event.name ?? l.event.id}`).join(", ")})는 그대로 두고 다시 지은 층의 가까운 칸으로 다시 가리켰다`);
  }
  // 다시 짓기 전 층 사본 — 짓기 도구 밖에서 붙은 이벤트(사람·컷신·상자…)를 다시 지은 층으로 옮겨 싣는다(rebuild:true 는 층 이벤트를 비운다).
  const oldFloorMaps: GameMap[] = previous ? [...((previous.result.state as DungeonState | undefined)?.floors ?? previous.result.mapIds)].map((id) => run.ctx.project.maps[id]).filter((m): m is GameMap => !!m).map((m) => structuredClone(m)) : [];
  /** 사본에서 바깥 문과 이 던전 층을 가리키는 월드 그래프 연결을 지운다 — 다시 지은 던전에 새로 잇는다(옛 착지 좌표가 새 맵 밖·벽이 된다). */
  const oldFloors = new Set<string>(previous ? [...(prev?.floors ?? previous.result.mapIds)] : []);
  const dropOldGate = (trial: BuildRun) => {
    if (!previous) return;
    if (relink) { const m = trial.ctx.project.maps[relink.fromMapId]; if (m) m.events = m.events.filter((e) => !relink!.eventIds.includes(e.id)); }
    const graph = (trial.ctx.project as unknown as { worldGraph?: { edges?: { from?: { mapId?: string }; to?: { mapId?: string } }[] } }).worldGraph;
    if (graph?.edges) graph.edges = graph.edges.filter((e) => !oldFloors.has(String(e.to?.mapId)) && !oldFloors.has(String(e.from?.mapId)));
  };
  const variant = num(spec.hints?.variant);
  // 다른 배치(variant): 앞 씨앗이 없으면(도구가 맵 id 로 정함) 이름에서 씨앗을 만들어 variant 만큼 민다 — 안 그러면 세 번 고쳐도 같은 모양이었다(2026-10-23 v2 실조수).
  if (args.seed === undefined && (prev || variant)) {
    const base0 = prev?.seed ?? [...spec.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11) % 90000;
    args.seed = base0 + (variant ?? 0) * 7919;
  }
  const base: Record<string, unknown> = { name: spec.name, ...args };
  // 바깥 문 자리를 make_place·make_game 이 정해 주면(세계 방향 가장자리 길 칸) 짓기가 그 칸과 바로 잇는다 — 기본 출구(시작점 곁 갱구 자리)를 쓰지 않는다.
  if (spec.gate && run.ctx.project.maps[spec.gate.fromMapId]) base.entrance = { fromMapId: spec.gate.fromMapId, x: spec.gate.x, y: spec.gate.y };
  // 다시 짓기: 옛 바깥 문 칸에 짓기가 바로 잇는다(entrance) — 기본 출구 + 나중 create_transfer_pair 로 문이 둘 생기던 것.
  else if (relink) base.entrance = { fromMapId: relink.fromMapId, x: relink.x, y: relink.y };
  const gateAt = base.entrance as { x: number; y: number } | undefined;
  const firstCall = run.calls.length;
  const wanted = words(spec);
  const wantsFoes = args.populate !== false;
  const wantsChest = args.populate !== false;
  let usedTroops: Record<string, unknown> | undefined;
  const exec = (target: BuildRun, extra: Record<string, unknown> = {}, notes: string[] = warnings) => {
    const callArgs: Record<string, unknown> = { ...base, ...extra };
    const troops = wantsFoes ? planTroops(target, plan, callArgs, notes) : undefined;
    if (troops) callArgs.troops = troops;
    usedTroops = troops;
    return target.call("author_dungeon", callArgs);
  };
  // 씨앗 고르기: 같은 명세를 사본 위에서 씨앗 몇 개로 지어 보고 요청에 가장 맞는 배치를 쓴다(늪·화산은 건너는 다리, 요청한 장치가 실제로 놓였나,
  // 보이는 적·상자 수, 너무 넓은 맨바닥). 마을 빌더가 집 수를 고르는 것과 같은 방식이다. 씨앗을 명시하면 건너뛴다.
  if (spec.hints?.seed === undefined) {
    // 새로 지을 때는 이름 해시에 무작위를 더한다 — 이름만 쓰면 같은 요청이 늘 같은 던전이었다(2026-10-23 사용자 「던전 만들어 줘가 늘 비슷하다」).
    // 고치기(prev·variant)는 앞 씨앗에서 밀어 재현된다.
    const nameHash = [...spec.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
    // 씨앗은 요청·게임 열쇠(variety)와 이름에서 — 모델이 준 seed 는 make_place 가 버린다(2026-10-29 terra 가 seed 0·1·2 만 보내 동굴 8장이 세 무리로 같았다).
    const keyHash = spec.variety ? [...`${spec.variety}|${spec.name}`].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 17) : undefined;
    const seed0 = num(args.seed) ?? (keyHash !== undefined ? keyHash % 90000 : (nameHash + (spec.salt ?? Math.floor(Math.random() * 90000))) % 90000);
    let best: { seed: number; score: number; gimmick?: unknown } | undefined;
    const requestedLever = /레버|lever/.test(wanted) || spec.hints?.gimmick === "lever" || spec.hints?.puzzle === "lever";
    for (let i = 0; i < (Number(args.floors) > 1 ? SEED_TRIALS - 1 : SEED_TRIALS); i++) {
      const seed = seed0 + i * 104729;
      const trial = createBuildRun({ ...run.ctx, project: cloneProjectSharingSharedDictionaries(run.ctx.project) });
      if (previous) {
        for (const id of [...(prev?.floors ?? previous.result.mapIds)].slice(1).reverse()) if (trial.ctx.project.maps[id]) trial.call("remove_map", { mapId: id });
        dropOldGate(trial);
      }
      const r = exec(trial, { seed, ...(mapId ? { mapId } : {}), ...(previous && mapId ? { rebuild: true } : {}) }, []);
      const score = r.ok ? layoutScore(r.data as Record<string, unknown>, type, args) : -Infinity;
      if (!best || score > best.score) best = { seed, score, gimmick: (r.data as Record<string, unknown> | undefined)?.gimmick };
    }
    if (best && Number.isFinite(best.score)) args.seed = base.seed = best.seed;
    // 레버 쇠창살은 요청했을 때만: 장치 자리가 없어 도구가 레버로 바꾸면 좁은 탑·동굴 통로를 쇠창살이 막아 「통로에 뜬 쇠창살」로 읽혔다(2026-10-23 비교 검수).
    if (best && best.gimmick === "lever" && !requestedLever) args.gimmick = base.gimmick = "none";
  }
  // 고치기: 첫 층은 author_dungeon rebuild:true 로 그 자리에서(시작 맵은 지울 수 없다), 나머지 층은 지우고 다시 만든다.
  let result: ReturnType<BuildRun["call"]>;
  let into: BuildRun = run;
  if (previous) {
    // 다시 짓기는 사본 위에서 통째로 — 위층을 지운 뒤 짓기가 무결성 검사로 거부되면 위층만 사라진 반쪽 탑이 남았다(2026-10-23 v2 실조수).
    const trial = createBuildRun({ ...run.ctx, project: cloneProjectSharingSharedDictionaries(run.ctx.project) });
    const old = prev?.floors ?? previous.result.mapIds;
    for (const id of [...old].slice(1).reverse()) if (trial.ctx.project.maps[id]) trial.call("remove_map", { mapId: id });
    dropOldGate(trial);
    if (mapId) { base.mapId = mapId; base.rebuild = true; }
    result = exec(trial);
    if (!result.ok && base.entrance) { warnings.push(`바깥 문 자리 (${gateAt!.x},${gateAt!.y}) 와 잇지 못해 기본 출구로 지었다`); delete base.entrance; result = exec(trial); }
    // 지운 바깥 문을 다시 지은 1층 입구와 다시 잇는다 — 짓기(make_game)가 처음 이은 방식(create_transfer_pair, 던전 쪽은 입구 칸) 그대로.
    // 바깥 문 자리(entrance)를 짓기에 넘겼으면 짓기가 이미 이었다 — 또 이으면 문이 둘이 된다(2026-10-30 dd1030 opus 마을+동굴: (19,0)·(30,19)).
    if (result.ok && relink && !base.entrance) {
      const d = (result.data ?? {}) as { floors?: string[]; entrance?: { x: number; y: number } };
      const first = d.floors?.[0];
      const fm = first ? trial.ctx.project.maps[first] : undefined;
      if (fm && d.entrance) {
        fm.events = fm.events.filter((e) => e.id !== `ev_${fm.id}_exit_placeholder`);
        const pair = trial.call("create_transfer_pair", { a: { mapId: relink.fromMapId, x: relink.x, y: relink.y }, b: { mapId: first, x: d.entrance.x, y: d.entrance.y } });
        if (!pair.ok) result = { ...result, ok: false, summary: `다시 지은 던전을 바깥 문과 다시 잇지 못했다: ${pair.summary}` };
      } else result = { ...result, ok: false, summary: "다시 지은 던전의 입구 칸을 몰라 바깥 문과 다시 잇지 못했다" };
    }
    if (result.ok) {
      const d = (result.data ?? {}) as { floors?: unknown[] };
      const newFloors = Array.isArray(d.floors) ? d.floors.filter((f): f is string => typeof f === "string") : [];
      if (newFloors.length) {
        const oldToNew = new Map(oldFloorMaps.map((m, k) => [m.id, newFloors[Math.min(k, newFloors.length - 1)]!] as const));
        const moved = retargetIncoming(trial.ctx.project, oldToNew, incomingKeep);
        if (moved) warnings.push(`다른 맵에서 이 던전으로 들어오던 이동 ${moved}개를 다시 지은 층의 가까운 걸어 닿는 칸으로 다시 가리켰다`);
        warnings.push(...carryFloorEvents(trial.ctx.project, oldFloorMaps, newFloors, new Set(relink ? [relink.fromMapId] : [])));
      }
      into = trial;
    }
    else run.calls.push(...trial.calls);
  } else {
    if (mapId) base.mapId = mapId;
    result = exec(run);
    if (!result.ok && base.entrance) { warnings.push(`바깥 문 자리 (${gateAt!.x},${gateAt!.y}) 와 잇지 못해 기본 출구로 지었다`); delete base.entrance; result = exec(run); }
  }
  const data = (result.data ?? {}) as Record<string, unknown>;
  const floors = Array.isArray(data.floors) ? (data.floors as unknown[]).filter((f): f is string => typeof f === "string") : [];
  if (!result.ok || floors.length === 0) {
    const refused = (result.issues ?? []).some((i) => i.code === "type-unsupported-by-tileset");
    if (refused) missing.push(`${type} 던전 그림이 이 칩셋에 없다 — 가장 가까운 대체: cave 동굴(type 을 cave 로 바꿔 다시 요청)`);
    return { ok: false, mapIds: [], summary: `던전 짓기 실패: ${result.summary}`, warnings: [...warnings, ...(result.issues ?? []).map((i) => i.message)], missingArt: missing, calls: run.calls.slice(firstCall), state: prev };
  }
  // 쓰기 도구의 경고(「고침:」 줄 포함)는 diff.warnings 로 온다 — result.warnings 만 읽어 설계 조화 보고가 조수에게 가지 않았다(2026-10-30).
  warnings.push(...(result.warnings ?? []), ...((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).filter((w) => !(result.warnings ?? []).includes(w)));
  // 도구가 손잡이로 못 하는 것: 층마다 보이는 적 수, 맨 안쪽 상자. 잡몹 그룹은 실제로 놓인 적에서 읽는다.
  const floorData = (Array.isArray(data.floorData) ? data.floorData : [data]) as Record<string, unknown>[];
  const project = into.ctx.project;
  const placedTroops = floors.flatMap((id) => (project.maps[id]?.events ?? []).filter((e) => isFoe(e.id)).flatMap((e) => JSON.stringify(e).match(/troop_[a-z0-9_]+/g)?.slice(0, 1) ?? []));
  const givenField = ((usedTroops as { field?: string[] } | undefined)?.field ?? []);
  const fieldTroops = [...new Set([...givenField, ...placedTroops])];
  if (!fieldTroops.length && /박쥐|bat|해골|거미|고블린|슬라임|늑대|좀비|유령/u.test(wanted)) warnings.push("요청한 적 그룹을 찾지 못했다");
  topUp(into, floors, floorData, fieldTroops, wantsFoes, wantsChest, type === "tower" || (args.direction === "up" && floors.length > 1), warnings);
  if (into !== run) { run.calls.push(...into.calls); run.ctx.project = into.ctx.project; }
  // 보스만 크게(2.5배). 중간 수문장은 파티와 같은 크기로 둔다 — 2배로 키운 24px 칩은 도트가 뭉툭해져
  // 16px 파티 옆에서 확대한 그림으로 읽혔다(2026-10-25 심사 J23 jrpg-herb 동굴 수문장).
  {
    const lastIdx = floors.length - 1;
    const big = enlargeBoss(run, floors[lastIdx]!, floorData[lastIdx], /_boss$/, 2.5, warnings);
    if (big) warnings.push(`보스를 크게: ${big}`);
  }
  // 보스 그림 확인: 보스가 잡몹·수문장과 같은 그림이면 보고한다.
  const last = floors[floors.length - 1]!;
  const bossEv = run.ctx.project.maps[last]?.events.find((e) => /_boss$/.test(e.id));
  if (bossEv) {
    const bossTroop = JSON.stringify(bossEv).match(/troop_[a-z0-9_]+/)?.[0];
    const others = floors.flatMap((id) => (run.ctx.project.maps[id]?.events ?? []).filter((e) => isFoe(e.id) || /_guardian$/.test(e.id))).map((e) => art(run.ctx.project, JSON.stringify(e).match(/troop_[a-z0-9_]+/)?.[0]));
    if (others.includes(art(run.ctx.project, bossTroop))) warnings.push("보스 그림이 잡몹·수문장 그림과 같다");
  } else if (/boss|보스|주인|군주|용|히드라|대마법사/u.test(wanted)) warnings.push("보스를 놓지 못했다");
  // 적을 둔 던전인데 이 게임에 회복할 길이 하나도 없으면 시작 맵에 회복의 샘·시작 회복약(2026-10-29 vm1 flash jrpg 「전투 못 이김」).
  let healNote = "";
  try { const heal = ensureHealingAccess(run); if (heal.length) healNote = ` · 회복 길을 넣었다: ${heal.join(", ")}`; } catch { /* 회복 넣기 실패는 던전을 깨지 않는다 */ }
  try { const rest = ensureBossRest(run); if (rest.length) healNote += ` · ${rest.join(", ")}`; } catch { /* 쉼터 넣기 실패는 던전을 깨지 않는다 */ }
  const calls: BuilderCall[] = run.calls.slice(firstCall);
  const first = floors[0]!;
  const ent = data.entrance as { x?: number; y?: number } | undefined;
  const start = run.ctx.project.startPos;
  const entrance = run.ctx.project.startMapId === first && start
    ? { mapId: first, x: start.x, y: start.y }
    : { mapId: first, x: ent?.x ?? Math.floor((num(data.width) ?? 40) / 2), y: ent?.y ?? Math.floor((num(data.height) ?? 30) / 2) };
  const seed = num(data.seed) ?? num(args.seed);
  const state: DungeonState = { args, seed, variant, floors };
  const summary = `${spec.name}: ${type} ${floors.length}층${args.direction === "up" ? "(위로)" : ""}${args.flooded ? " · 물에 잠김" : ""}${args.lair ? " · 고블린 소굴" : ""}${data.gimmick ? ` · 장치 ${String(data.gimmick)}` : ""} (${num(data.width)}×${num(data.height)})${healNote}`;
  return { ok: true, mapIds: floors, entrance, summary, warnings, missingArt: missing, calls, state };
}

export const DUNGEON_BUILDER: PlaceBuilder = {
  id: "dungeon",
  accepts: (spec) => spec.type === "dungeon" || spec.type === "cave",
  build,
};
