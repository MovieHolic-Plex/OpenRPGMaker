// 장소의 테마 — 세계 장소(구성기 맵)에 서는 적 · 그 맵의 전투 배경 · 상자 보상을 그 장소의 세계·종류에서 고른다.
// 고를 그림이 없으면 대역을 쓰되 «없는 그림» 한 줄(project/artGap 의 artGapLine)을 남긴다 — 다른 테마의 대역이 말없이 지나가지 않게.
// 적 id 는 기본 DB 의 것이다(프로젝트 DB 에 없으면 빼고, 하나도 안 남으면 종전 고르기 + 없는 그림 줄). 서는 것은 현행 그림이 있는 종뿐이다(story/currentFoes).
import { fitTroopCopy, type EnemyFitRole } from "@/editor/tools/bossThreatScaling";
import type { GameMap, Project } from "@/project/types";
import { artGapLine } from "@/project/artGap";
import { FIELD_BATTLE_BACKGROUND_ID } from "@/project/databaseEnemyTroopRecordModel";
import { battleSceneryStill } from "@/assets/battleSceneryCatalog";
import { WORLDS, worldOf, worldKind, type WorldKind, type WorldSetting } from "./world";
import { currentFoe, hasCurrentArt, leadEnemyId, useCurrentArt, wantedArtName } from "../story/currentFoes";
import { foeSkillNames } from "../judge/enemyChecks";
import { enemyArtFor } from "./builders/dungeonFoes";

const B = { forest: "battle-scenery-forest", plains: "battle-scenery-plains", cave: "battle-scenery-cave", snow: "battle-scenery-snow", desert: "battle-scenery-desert" } as const;

interface ThemeEntry {
  /** 이 장소와 같은 종류의 겹 배경(숲·평원·동굴·눈·사막). 같은 종류가 아니면 적지 않는다 — 다른 지형을 대역으로 쓰지 않는다. */
  readonly backdrop?: string;
  /** 이 장소를 그린 번들 장소 그림의 키(battle-scenery-<키>, battle-backdrop 하네스). 번들에 실려 있을 때만 쓴다. */
  readonly still?: string;
  /** 맞는 그림이 없을 때 «그릴 것» 으로 남기는 이름. 없으면 그 종류의 설명. */
  readonly wantedBackdrop?: string;
  /** 길에서 만나는 적(기본 DB 적 id, enemy_ 뺀 꼬리). */
  readonly foes?: readonly string[];
  /** 단계 싸움의 상대. */
  readonly bosses?: readonly string[];
  /** foes·bosses 가 이 테마의 대역일 때 정말 바란 것 — 없는 그림으로 남긴다. */
  readonly wantedFoes?: string;
}

/** 실내·종류 덮어쓰기에서 바탕의 배경을 물려받지 않는다(거리 그림이 방 안 전투에 깔리지 않게). */
const NO_BACKDROP = { backdrop: undefined, still: undefined, wantedBackdrop: undefined } as const;

/**
 * 세계마다 바탕 테마와 종류별 덮어쓰기. 전투 배경은 그 장소와 같은 종류의 그림만 적는다: 겹 배경 다섯 가운데 같은 종류이거나(backdrop),
 * 그 장소를 보고 그린 번들 장소 그림(still). 둘 다 없는 장소의 전투는 «그 맵 그대로»(필드 화면) 위에서 벌어지고 없는 그림 줄이 남는다.
 * 적 목록 = 그 장소가 바라는 종(앞) + 현행 그림(story/currentFoes)이 있는 그 장소의 종(뒤). 서는 것은 현행 그림이 있는 종뿐이고,
 * 그림이 없는 종은 없는 그림 줄로만 남는다(그릴 목록) — 그 종이 그려지면 표를 고치지 않아도 선다.
 */
const THEMES: Readonly<Record<string, { readonly base: ThemeEntry; readonly indoor?: ThemeEntry; readonly kinds?: Readonly<Record<string, ThemeEntry>> }>> = {
  snow_north: {
    base: { backdrop: B.snow, foes: ["wolf_grey", "bear_brown", "goat_mountain", "wolf_dire", "bird_hawk"], bosses: ["lich_frost", "golem_crystal", "wraith_dark"] },
    indoor: { wantedBackdrop: "log hall interior" },
    kinds: { "ice-cave": { still: "ice-cave", wantedBackdrop: "ice cave interior", foes: ["bat_cave", "wisp_blue", "slime_blue", "golem_crystal"] } },
  },
  desert_east: {
    base: { backdrop: B.desert, foes: ["scorpion_sand", "worm_sand", "snake_viper", "beetle_horn", "bandit_mask"], bosses: ["golem_clay", "mummy_bandage", "totem_cursed"] },
    indoor: { wantedBackdrop: "adobe room interior" },
    kinds: { tomb: { still: "tomb", wantedBackdrop: "stone burial chamber", foes: ["mummy_bandage", "skeleton_bone", "bonepile_crawler", "ghost_pale", "bat_cave", "spider_cave"], bosses: ["mummy_bandage", "wraith_dark", "golem_stone"] } },
  },
  pirate_isles: {
    base: { still: "beach", wantedBackdrop: "tropical beach and sea", foes: ["crab_rock", "snake_viper", "bandit_mask", "lizardman_spear"], bosses: ["squid_deep", "shark_land", "skeleton_knight", "eel_electric", "spirit_water"] },
    indoor: { wantedBackdrop: "ship deck / tavern interior" },
    kinds: {
      harbor: { ...NO_BACKDROP, wantedBackdrop: "harbor piers and plank houses" },
      field: { ...NO_BACKDROP, backdrop: B.plains },
      fort: { ...NO_BACKDROP, wantedBackdrop: "stone fort with cannons" },
      wreck: { ...NO_BACKDROP, still: "shipwreck", wantedBackdrop: "shipwreck on a reef", foes: ["skeleton_bone", "ghost_pale", "crab_rock", "eel_electric"] },
      cave: { backdrop: B.cave, foes: ["bat_cave", "crab_rock", "skeleton_bone", "spider_cave"] },
    },
  },
  sky_island: {
    base: { still: "cloud-sea", wantedBackdrop: "sky above a sea of clouds", foes: ["bird_hawk", "harpy_cliff", "sylph_air", "spirit_wind", "bee_giant", "moth_dust"], bosses: ["griffin_sky", "roc_giant", "gargoyle_stone", "dragon_blue", "golem_crystal"] },
    indoor: { wantedBackdrop: "cottage / cabin interior", foes: ["wisp_blue", "spirit_light", "spirit_wind", "eye_floating"] },
    kinds: { "shrine-hall": { still: "sky-shrine", wantedBackdrop: "shrine inner hall" } },
  },
  steampunk_city: {
    base: { still: "brick-street", wantedBackdrop: "brick street under factory smoke", foes: ["rat_giant", "puppet_string", "sword_flying", "armor_living", "bandit_mask", "hound_hell"], bosses: ["golem_iron", "armor_living"] },
    indoor: { wantedBackdrop: "inn / workshop interior", foes: ["spirit_fire", "puppet_string", "armor_living", "golem_clay"] },
    kinds: {
      "boiler-room": { still: "boiler-room", wantedBackdrop: "boiler / engine room interior" },
      "engine-room": { still: "boiler-room", wantedBackdrop: "boiler / engine room interior" },
    },
  },
  prehistoric: {
    base: { wantedBackdrop: "tribal village / fossil valley", foes: ["snake_viper", "lizardman_spear", "boar_tusk", "tiger_saber", "beetle_horn", "mantis_blade"], bosses: ["behemoth_horn", "tiger_saber", "dragon_whelp", "wolf_dire", "spirit_fire"], wantedFoes: "dinosaurs (raptor, triceratops)" },
    indoor: { wantedBackdrop: "hide hut interior", foes: ["bat_cave", "bear_brown", "tiger_saber", "spider_cave"] },
    kinds: {
      swamp: { still: "swamp", wantedBackdrop: "primeval reed swamp" },
      volcano: { still: "volcano", wantedBackdrop: "lava field at a volcano", foes: ["salamander_flame", "centipede_fire", "spirit_fire", "hound_hell", "golem_clay"] },
      "cave-dwelling": { backdrop: B.cave },
      "cave-gallery": { backdrop: B.cave },
    },
  },
  sengoku_edo: {
    base: { still: "edo-town", wantedBackdrop: "castle yard / Edo town", foes: ["bandit_mask", "cat_shadow", "ghost_pale", "armor_living", "wisp_blue"], bosses: ["ogre_club", "knight_fallen", "wraith_dark"], wantedFoes: "samurai, ninja, yokai" },
    indoor: { wantedBackdrop: "tatami room interior" },
    kinds: {
      village: { ...NO_BACKDROP, backdrop: B.plains },
      temple: { ...NO_BACKDROP, wantedBackdrop: "temple grounds" },
    },
  },
  sf_station: {
    base: { still: "station", wantedBackdrop: "station corridor", foes: ["slime_metal", "eye_floating", "sword_flying", "golem_iron"], bosses: ["golem_iron", "eye_floating"], wantedFoes: "security robots, drones, aliens" },
    kinds: {
      street: { ...NO_BACKDROP, wantedBackdrop: "neon city street" },
      moonbase: { ...NO_BACKDROP, wantedBackdrop: "moon surface base" },
    },
  },
  wasteland: {
    base: { wantedBackdrop: "ruined city under dust", foes: ["zombie_rot", "ghoul_grave", "rat_giant", "hound_hell", "bandit_mask", "snake_viper"], bosses: ["behemoth_horn", "ogre_club", "golem_iron", "wolf_dire"] },
  },
};

/**
 * 테마 표에 없는 세계(버들항)의 종류별 전투 배경 — 같은 종류의 겹 배경이 있는 종류만. 나머지(집 안·신전·탑 …)는 그 맵 그대로.
 * 적은 종전 길(COMMON · 던전 빌더)이라 여기 적지 않는다.
 */
const CLASSIC_BACKDROPS: Readonly<Record<string, Readonly<Record<string, Pick<ThemeEntry, "backdrop" | "wantedBackdrop">>>>> = {
  beodeul: {
    village: { backdrop: B.plains }, port: { backdrop: B.plains },
    "swamp-village": { wantedBackdrop: "stilt village in a swamp" },
    cave: { backdrop: B.cave }, mine: { backdrop: B.cave },
    catacomb: { wantedBackdrop: "catacomb corridor" }, temple: { wantedBackdrop: "ruined temple hall" }, tower: { wantedBackdrop: "wizard tower floor" },
    "deep-forest": { backdrop: B.forest },
    house: { wantedBackdrop: "house interior" }, inn: { wantedBackdrop: "inn common room" }, shop: { wantedBackdrop: "shop interior" },
  },
};

/** 테마 표에 없는 세계(버들항 …)의 싸우는 단계 상대 — 흔한 판타지의 길 적·우두머리(현행 그림). */
const COMMON: ThemeEntry = { foes: ["wolf_grey", "boar_tusk", "goblin_scout", "slime_green", "spider_cave"], bosses: ["wraith_dark", "golem_stone", "wolf_dire", "dragon_blue"] };

export interface PlaceTheme {
  /** «세계/종류» — 없는 그림 줄의 theme. */
  readonly id: string;
  readonly world: WorldSetting;
  readonly kind?: WorldKind;
  readonly entry: ThemeEntry;
}

/** 이 맵이 청사진 장소 목록에서 받은 종류 id(맵 이름 = 장소 이름). */
const blueprintKindId = (project: Project, map: GameMap): string | undefined =>
  (project.gameBlueprint?.places ?? []).find((p) => p.name.trim() === (map.name ?? "").trim())?.kind;

/** 이 맵의 테마 — 청사진 세계(없으면 칩셋이 같은 구성기 세계)와 청사진 장소 목록의 종류. 테마 표에 없는 세계(버들항)는 undefined. */
export function placeThemeOf(project: Project, mapId: string): PlaceTheme | undefined {
  const map = project.maps[mapId];
  if (!map) return undefined;
  const world = [worldOf(project), WORLDS.find((w) => !!w.composer && w.tilesetId === map.tilesetId)].find((w) => !!w && w.tilesetId === map.tilesetId && !!THEMES[w.id]);
  if (!world) return undefined;
  const kindId = blueprintKindId(project, map);
  const kind = kindId ? worldKind(world, kindId) : undefined;
  const t = THEMES[world.id]!;
  const entry: ThemeEntry = { ...t.base, ...(kind?.indoor ? { ...NO_BACKDROP, ...t.indoor } : {}), ...(kind ? t.kinds?.[kind.id] : {}) };
  return { id: `${world.id}/${kind?.id ?? "*"}`, world, ...(kind ? { kind } : {}), entry };
}

const placeName = (map: GameMap): string => map.name ?? map.id;

/**
 * 이 맵에 맞는 전투 배경 — 같은 종류의 겹 배경, 번들에 실린 그 장소의 그림, 둘 다 없으면 «그 맵 그대로»(FIELD_BATTLE_BACKGROUND_ID)와 그릴 것의 이름.
 * 세계 표(THEMES)의 장소, 그리고 청사진이 종류를 적은 버들항 장소(CLASSIC_BACKDROPS)만 안다 — 그 밖의 맵은 undefined.
 */
function fittingBackdrop(project: Project, mapId: string): { readonly id: string; readonly theme: string; readonly wanted?: string } | undefined {
  const map = project.maps[mapId];
  if (!map) return undefined;
  const theme = placeThemeOf(project, mapId);
  const world = theme?.world ?? worldOf(project);
  const kindId = theme?.kind?.id ?? blueprintKindId(project, map);
  const entry = theme?.entry ?? (world && kindId ? CLASSIC_BACKDROPS[world.id]?.[kindId] : undefined);
  if (!entry || !world) return undefined;
  const still = "still" in entry && entry.still ? battleSceneryStill(`battle-scenery-${entry.still}`)?.resourceId : undefined;
  const id = entry.backdrop ?? still;
  const themeId = theme?.id ?? `${world.id}/${kindId}`;
  if (id) return { id, theme: themeId };
  return { id: FIELD_BATTLE_BACKGROUND_ID, theme: themeId, wanted: entry.wantedBackdrop ?? theme?.kind?.about ?? theme?.world.name ?? "this place" };
}

/**
 * 이 맵의 전투 배경을 그 장소의 것으로 적는다(이미 다른 값을 저작했으면 그대로 — 기본값 숲은 저작으로 치지 않는다).
 * 맞는 그림이 없어 그 맵 그대로 싸우게 되면 없는 그림 줄을 돌려준다.
 */
export function applyThemeBackdrop(project: Project, mapId: string): { readonly note?: string; readonly gap?: string } {
  const pick = fittingBackdrop(project, mapId);
  const map = project.maps[mapId];
  if (!pick || !map) return {};
  const gap = pick.wanted ? artGapLine({ theme: pick.theme, want: "backdrop", wanted: pick.wanted, where: placeName(map), standIn: pick.id }) : undefined;
  if (map.battleBackground === pick.id) return gap ? { gap } : {};
  if (map.battleBackground && map.battleBackground !== B.forest) return {};
  map.battleBackground = pick.id;
  return { note: `전투 배경 ${placeName(map)} → ${pick.id}`, ...(gap ? { gap } : {}) };
}

const slugOf = (enemyId: string): string => enemyId.replace(/^enemy_/u, "");

/** 그 적 하나짜리 무리(`troop_theme_<적>`) — 없으면 기본 무리 하나를 본떠 만든다. */
function soloTroop(project: Project, enemyId: string): string | undefined {
  const enemy = project.database.enemies.find((e) => e.id === enemyId);
  if (!enemy) return undefined;
  const id = `troop_theme_${slugOf(enemyId)}`;
  if (project.database.troops.some((t) => t.id === id)) return id;
  const template = project.database.troops.find((t) => (t.members?.length ?? 0) === 1 && !t.trainerBattle);
  const member = template?.members?.[0] ?? { x: 88, y: 96, hidden: false };
  const troop = { ...(template ? structuredClone(template) : { autoAlign: true, battleEventPages: [] }), id, name: enemy.name, enemyIds: [enemyId], members: [{ ...member, enemyId }] };
  (project.database.troops as unknown[]).push(troop);
  return id;
}

function fitted(project: Project, enemyIds: readonly string[], role: EnemyFitRole): string[] {
  const out: string[] = [];
  for (const enemyId of enemyIds) {
    const solo = soloTroop(project, enemyId);
    const fit = solo ? fitTroopCopy(project, solo, role) : undefined;
    // 시작 파티가 없어 못 맞춘 무리(원본 그대로 돌아온다)는 쓰지 않는다 — Lv19 미라가 Lv1 파티 앞에 서지 않게.
    if (fit && fit !== solo && !out.includes(fit)) out.push(fit);
  }
  return out;
}

/**
 * 한 맵에 같이 설 길 적 — 종마다 다른 종에 없는 자기 기술이 하나는 있는 무리만(순서대로). 끝맺음 «적 개성» 검사와 같은 값(judge/enemyChecks)으로 고른다.
 * 왜(2026-11-12 은행 jrpg-w3): 현행 그림으로 좁히자 사막 길 적이 독사·복면 산적이 되었는데 맞춘 사본 둘 다 「맹독 이빨」이라 독사에게 자기 기술이 없었다.
 */
function withOwnSkills(project: Project, troopIds: readonly string[], others: readonly ReadonlySet<string>[] = []): string[] {
  const skills = (troopId: string) => foeSkillNames(project, leadEnemyId(project, troopId));
  // 그 맵에서 이미 싸우는 다른 적(단계 상대)과도 견준다 — 같은 종의 길 적은 그 상대와 기술이 같아 둘 다 «자기 기술이 없다» 가 된다.
  const sets = (ids: readonly string[]) => [...others, ...ids.map(skills)];
  const own = (ids: readonly string[]) => { const all = sets(ids); return all.slice(others.length).every((mine) => [...mine].some((s) => all.every((o) => o === mine || !o.has(s)))); };
  const kept: string[] = [];
  for (const id of troopIds) if (own([...kept, id])) kept.push(id);
  return kept.length ? kept : troopIds.slice(0, 1);
}

/** 이 맵에서 세계 채우기의 적(`ev_<맵>_wfoe<n>`)이 아닌 이벤트가 여는 전투의 적들 — 기본 공격을 뺀 기술 이름 집합(적마다). */
function otherFoeSkills(project: Project, map: GameMap): ReadonlySet<string>[] {
  const out: ReadonlySet<string>[] = [];
  const seen = new Set<string>();
  const worldFoe = new RegExp(`^ev_${map.id}_wfoe\\d+$`, "u");
  for (const event of map.events ?? []) {
    if (worldFoe.test(event.id)) continue;
    const visit = (node: unknown): void => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== "object") return;
      const cmd = node as { kind?: unknown; troopId?: unknown };
      if (cmd.kind === "battleProcessing" && typeof cmd.troopId === "string") {
        const troop = project.database.troops.find((t) => t.id === cmd.troopId);
        for (const enemyId of troop?.members?.map((m) => m.enemyId) ?? troop?.enemyIds ?? []) {
          if (seen.has(enemyId)) continue;
          seen.add(enemyId);
          const names = foeSkillNames(project, enemyId);
          if (names.size) out.push(names);
        }
      }
      for (const value of Object.values(node)) if (value && typeof value === "object") visit(value);
    };
    visit(event.pages);
  }
  return out;
}

/** 테마가 바란 적 가운데 현행 그림이 있는 것(세울 수 있는 것)과, 그림이 없어 못 세우는 종의 이름(그릴 목록). 프로젝트 DB 에 없는 적은 뺀다. */
function drawn(project: Project, tails: readonly string[] | undefined): { readonly ids: string[]; readonly undrawn: string[] } {
  const ids: string[] = [], undrawn: string[] = [];
  for (const tail of tails ?? []) {
    const id = `enemy_${tail}`;
    if (!project.database.enemies.some((e) => e.id === id)) continue;
    if (hasCurrentArt(project, id)) ids.push(id);
    else undrawn.push(wantedArtName(project, id));
  }
  return { ids, undrawn };
}

const nameOf = (project: Project, id: string) => project.database.enemies.find((e) => e.id === id)?.name ?? "";

/** 없는 그림 줄들 — 테마가 통째로 바란 것(wantedFoes) 하나 + 그림이 없는 종마다 하나. */
function foeGaps(theme: PlaceTheme | undefined, want: "foe" | "boss", where: string, standIn: string, undrawn: readonly string[], whole?: string): string[] {
  const id = theme?.id ?? "*";
  return [...(whole ? [whole] : []), ...undrawn].map((wanted) => artGapLine({ theme: id, want, wanted, where, standIn }));
}

/** 이 맵의 길 적 무리(시작 파티에 맞춘 사본) — 현행 그림이 있는 종만. 테마가 없거나 세울 종이 없으면 빈 목록(부르는 쪽이 종전 고르기로 간다). */
export function themeFieldTroops(project: Project, mapId: string): { readonly troopIds: string[]; readonly gaps: string[] } {
  const theme = placeThemeOf(project, mapId);
  const map = project.maps[mapId];
  if (!theme || !map) return { troopIds: [], gaps: [] };
  const want = drawn(project, theme.entry.foes);
  const troopIds = withOwnSkills(project, fitted(project, want.ids, "field"), otherFoeSkills(project, map));
  const names = troopIds.map((id) => project.database.troops.find((t) => t.id === id)?.name ?? id).join("·");
  if (!troopIds.length) return { troopIds, gaps: foeGaps(theme, "foe", placeName(map), "default field troops", want.undrawn, theme.entry.wantedFoes ?? `foes of ${theme.kind?.about ?? theme.world.name}`) };
  return { troopIds, gaps: foeGaps(theme, "foe", placeName(map), names, want.undrawn, theme.entry.wantedFoes) };
}

/**
 * 이 맵에서 싸우는 단계의 상대 무리(보스·중간 보스로 맞춘 사본) — 현행 그림이 있는 종만. 고르는 순서: 상대 이름(who)과 낱말이 겹치는 테마 적 →
 * 이름의 적 낱말이 가리키는 종(dungeonFoes 의 낱말 표, 그림이 없으면 대역) → 단계마다 돌려 고른 테마 우두머리. 테마 표에 없는 세계는 흔한 판타지 목록(COMMON).
 * taken = 이 게임의 다른 싸우는 단계가 이미 세운 종. 고른 종이 거기 있고 이름이 그 종을 가리킨 것이 아니면(대역 · 돌려 고른 것) 아직 안 쓴 가까운 종으로 바꾼다 —
 * 테마 우두머리 → 같은 갈래(적 id 머리말이 같은 현행 종: golem_iron → golem_clay) → 테마 길 적. 보스 둘이 같은 전투 그림으로 서지 않게(2026-11-13 r2s-fun: 둘 다 철 골렘).
 */
export function themeBossTroop(project: Project, mapId: string, who: string | undefined, final: boolean, salt: number, taken?: ReadonlySet<string>): { readonly troopId?: string; readonly enemyId?: string; readonly gaps: string[] } {
  const theme = placeThemeOf(project, mapId);
  const map = project.maps[mapId];
  if (!map) return { gaps: [] };
  const entry = theme?.entry ?? COMMON;
  const want = drawn(project, entry.bosses), road = drawn(project, entry.foes);
  const words = (who ?? "").split(/[\s의]+/u).filter((w) => w.length >= 2);
  // 이름 겹침: 보스 후보는 어느 낱말이든, 길 적은 머리 명사(마지막 낱말)만 — 「모래 수호자」 가 모래 전갈이 되지 않게.
  const akin = want.ids.find((id) => words.some((w) => nameOf(project, id).includes(w))) ?? road.ids.find((id) => !!words.at(-1) && nameOf(project, id).includes(words.at(-1)!));
  const worded = akin ? undefined : currentFoe(project, enemyArtFor(project, who ?? ""));
  const natural = akin ?? worded?.enemyId ?? want.ids[Math.abs(salt) % Math.max(1, want.ids.length)];
  const named = !!akin || (!!worded && !worded.wanted);
  const kin = (id: string) => { const head = id.replace(/^enemy_/u, "").split("_")[0]; return project.database.enemies.map((e) => e.id).filter((e) => e.startsWith(`enemy_${head}_`) && hasCurrentArt(project, e)); };
  const pick = natural && taken?.has(natural) && !named ? [...want.ids, ...kin(natural), ...road.ids].find((id) => !taken.has(id)) ?? natural : natural;
  const troopId = pick ? fitted(project, [pick], final ? "boss" : "midBoss")[0] : undefined;
  if (troopId) useCurrentArt(project, pick);
  const where = placeName(map);
  if (!troopId) return { gaps: foeGaps(theme, "boss", where, "default boss troop", want.undrawn, who?.trim() || entry.wantedFoes || `boss of ${theme?.kind?.about ?? theme?.world.name ?? "this place"}`) };
  // 고른 상대가 바란 그대로면(이름·낱말이 맞았다) 그 밖의 없는 종은 적지 않는다 — 돌려 고른 대역일 때만 그릴 목록을 남긴다.
  // 이름이 어느 종도 가리키지 않아 돌려 고른 대역으로 선 상대는 제 이름의 그림도 바란 것으로 적는다(«그림자 종지기» · «폭주 중앙 기관» — 그릴 목록에 그 상대가 빠지지 않게).
  const own = who?.trim() && !akin && !worded ? [who.trim()] : [];
  const undrawn = [...own, ...(akin ? [] : worded ? (worded.wanted ? [worded.wanted] : []) : want.undrawn)];
  return { troopId, enemyId: pick, gaps: foeGaps(theme, "boss", where, nameOf(project, pick!), undrawn, akin || worded ? undefined : entry.wantedFoes) };
}

/**
 * 상자 보상 — 이 게임에서 쓸 수 있는 것만: 전투 중에도 쓰는 회복약(값 순서로 돌려 고른다), 세 번에 한 번은 돈.
 * 제작 재료(슬라임 젤리 · 기록용 깃펜)는 제작도 납품도 없는 게임에서 쓸 곳이 없다.
 */
export function usableLoot(project: Project, salt: number): { itemId?: string; count?: number; gold?: number } {
  const heals = (project.database.items ?? []).filter((i) => i.type === "medicine" && (i.price ?? 0) >= 40 && (i.price ?? 0) <= 400
    && ((i.hpRecovery?.flat ?? 0) >= 30 || (i.hpRecovery?.percentMax ?? 0) > 0) && i.occasion !== "never" && i.occasion !== "field" && !i.onlyUsableInMenu)
    .sort((a, b) => (a.price ?? 0) - (b.price ?? 0) || a.id.localeCompare(b.id));
  const step = Math.abs(Math.trunc(salt));
  const pick = heals[step % Math.max(1, Math.min(heals.length, 6))];
  return pick && step % 3 !== 2 ? { itemId: pick.id, count: (pick.price ?? 0) <= 120 ? 2 : 1 } : { gold: 150 + 50 * (step % 8) };
}
