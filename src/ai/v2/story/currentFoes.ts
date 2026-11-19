// v2 가 세우는 적은 현행 그림(『폴른 스타』가 쓰는 새 전투 시트 — @/assets/currentMonsterArt)이 있는 종에서만 고른다.
// 왜(2026-11-12 오너, r1w-fun): 기본 DB 적 106종의 번들 3×3 그림(구형)이 그대로 섰다 — 폴른 스타와 다른 그림체, 맵에는 옛 걷기 칩.
// 고르는 함수들(place/placeTheme · place/builders/dungeonFoes · story/sceneVerbs · blueprintPath.foeTroop)이 여기 하나에 묻는다:
//   currentFoe(적 id) → 그 적의 그림이 현행이면 그 적, 아니면 가장 가까운 현행 종(대역) + 바란 그림 이름(없는 그림 줄에 싣는다 — 그릴 목록).
// 고른 적의 그림은 그 자리에서 프로젝트에 넣는다(전투·맵 그림이 같은 새 그림이 된다). 옛 판은 끝맺음 current-monster-art 단계가 맞춘다.
import { hasCurrentMonsterArt, installCurrentMonsterArt, isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { fieldGraphicForBattler } from "@/editor/tools/fieldEnemyGraphics";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Project } from "@/project/types";
import { isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import { RETRO_MONSTER_PLAN } from "@/assets/retroMonsterPlan";

type Obj = Record<string, unknown>;

/** 현행 그림이 없는 종 → 가장 가까운 현행 종(기본 DB 적 id 의 enemy_ 뺀 꼬리). 표에 없는 종은 대역도 없다. */
const STAND_IN: Readonly<Record<string, string>> = (() => {
  const groups: Record<string, readonly string[]> = {
    slime_green: ["slime", "meadow_slime", "slime_blue", "slime_red", "slime_metal", "slime_king", "slime_cube", "ooze_black", "ooze_acid"],
    bat_cave: ["cave_bat", "bat_vampire", "rat_giant"],
    spider_cave: ["spider_widow"],
    golem_stone: ["stone_golem", "totem_cursed", "gargoyle_stone", "ape_stone", "spirit_earth", "troll_cave", "ogre_club", "minotaur_maze", "behemoth_horn"],
    golem_iron: ["armor_living", "knight_fallen", "skeleton_knight", "sword_flying", "puppet_string"],
    dragon_blue: ["dragon", "dragon_whelp", "dragon_red", "dragon_bone", "hydra_three", "wyvern_cliff"],
    ghost_pale: ["skeleton_bone", "skeleton_archer", "mine_skel_archer", "zombie_rot", "ghoul_grave", "mummy_bandage", "banshee_wail", "bonepile_crawler"],
    wraith_dark: ["lich_frost", "revenant_vengeful", "spirit_dark", "demon_lord", "angel_fallen", "mage_rogue"],
    beetle_horn: ["scorpion_sand", "ant_soldier"],
    snake_viper: ["worm_sand", "lizardman_spear"],
    spirit_fire: ["salamander_flame", "centipede_fire"],
    wolf_dire: ["bear_brown", "tiger_saber"],
    hound_hell: ["cat_shadow"],
    boar_tusk: ["goat_mountain", "deer_forest", "centaur_plains"],
    goblin_scout: ["goblin_brute", "orc_warrior", "orc_shaman", "kobold_digger", "imp_mischief"],
    wisp_blue: ["spirit_wind", "spirit_light", "sylph_air"],
    spirit_water: ["undine_sea"],
    bird_hawk: ["harpy_cliff", "griffin_sky", "roc_giant", "phoenix_rebirth"],
    eel_electric: ["fish_piranha", "squid_deep", "shark_land"],
  };
  const out: Record<string, string> = {};
  for (const [to, from] of Object.entries(groups)) for (const tail of from) out[tail] = to;
  return out;
})();

const enemyOf = (project: Project, enemyId: string | undefined) => project.database.enemies.find((e) => e.id === enemyId);
const artOf = (project: Project, enemyId: string | undefined): string | undefined => (enemyOf(project, enemyId) as { monsterResourceId?: string } | undefined)?.monsterResourceId;

/** 그 무리에서 앞장선 적. */
export const leadEnemyId = (project: Project, troopId: string | undefined): string | undefined => {
  const troop = project.database.troops.find((t) => t.id === troopId);
  return troop?.members?.length ? troop.members[0]!.enemyId : troop?.enemyIds?.[0];
};

/** 바란 그림의 이름 — 그 적 그림 id 의 꼬리(lizardman-spear). 같은 종은 늘 같은 이름이다. */
export const wantedArtName = (project: Project, enemyId: string): string =>
  (artOf(project, enemyId) ?? enemyId).replace(/^generated-enemy-/u, "").replace(/^enemy_/u, "").replace(/_/gu, "-");

/** 그 적의 그림이 현행 세트인가. */
export const hasCurrentArt = (project: Project, enemyId: string | undefined): boolean => isCurrentMonsterArt(artOf(project, enemyId));

export interface CurrentFoe {
  /** 세울 적(현행 그림이 있는 기본 DB 적). */
  readonly enemyId: string;
  /** 대역일 때 — 정말 바란 그림의 이름. */
  readonly wanted?: string;
}

/**
 * 이 적을 세우려 할 때 실제로 세울 적 — 그림이 현행이면 그대로, 아니면 대역(가장 가까운 현행 종). 둘 다 없으면 undefined(부르는 쪽이 다른 후보로 간다).
 * 고른 적의 그림을 프로젝트에 넣는다.
 */
export function currentFoe(project: Project, enemyId: string | undefined): CurrentFoe | undefined {
  if (!enemyId || !enemyOf(project, enemyId)) return undefined;
  if (hasCurrentArt(project, enemyId)) { useCurrentArt(project, enemyId); return { enemyId }; }
  const standIn = `enemy_${STAND_IN[enemyId.replace(/^enemy_/u, "")] ?? ""}`;
  if (!hasCurrentArt(project, standIn)) return undefined;
  useCurrentArt(project, standIn);
  return { enemyId: standIn, wanted: wantedArtName(project, enemyId) };
}

/**
 * 모델이 글로 짚은 적 — 그 적의 그림이 어느 묶음에든 있으면(현행 세트가 아닌 옛 묶음이어도) 그 적 그대로, 없으면 currentFoe(가장 가까운 현행 종 + 바란 그림).
 * 한 화풍(현행 세트)은 구성기가 스스로 고를 때의 기본값이다 — 모델이 고른 것이 실제로 있으면 쓴다(오너 2026-11-16 «에셋을 자유롭게»).
 * 옛 묶음 그림으로 선 적은 끝맺음 step-foes 가 «old-set picture» 없는 그림 줄로 알린다.
 * 왜(2026-11-16 확인 빌드 r6a P6 · r7a): «거대한 해골 종지기» 가 던전의 푸른 용으로 서고 싸웠다 — 해골 그림은 옛 묶음에 있었다.
 */
export function namedFoe(project: Project, enemyId: string | undefined): CurrentFoe | undefined {
  const art = artOf(project, enemyId);
  if (enemyId && art && !isCurrentMonsterArt(art) && isGeneratedMonsterSprite(art)) return { enemyId };
  return currentFoe(project, enemyId);
}

/** 그 적의 현행 그림을 프로젝트에 넣는다(그림 데이터를 읽어 둔 뒤에만 — 아니면 끝맺음 단계가 넣는다). */
export function useCurrentArt(project: Project, enemyId: string | undefined): void {
  const art = artOf(project, enemyId);
  if (art && isCurrentMonsterArt(art) && !hasCurrentMonsterArt(project, art)) installCurrentMonsterArt(project, [art]);
}

function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Obj);
  for (const v of Object.values(node as Obj)) if (v && typeof v === "object") walk(v, visit);
}

/** 맵에서 실제로 싸우게 되는 무리(이벤트의 전투 명령 · 조우 표) → 그 무리가 쓰이는 맵 이름. */
function battleTroops(project: Project): Map<string, string> {
  const used = new Map<string, string>();
  for (const map of Object.values(project.maps)) {
    const where = map.name ?? map.id;
    for (const entry of map.encounterTable ?? []) if (entry.troopId && !used.has(entry.troopId)) used.set(entry.troopId, where);
    walk(map.events ?? [], (c) => { if (c.kind === "battleProcessing" && typeof c.troopId === "string" && !used.has(c.troopId)) used.set(c.troopId, where); });
  }
  return used;
}

/**
 * 옛 판 맞추기 — 맵에서 싸우는 무리의 적마다 현행 그림을 넣고, 그 적이 옛 걷기 칩(같은 종류의 charset)으로 서 있으면 전투 그림으로 세운다.
 * 현행 그림이 없는 종은 그대로 두고 바란 그림을 돌려준다(없는 그림 줄 — 그릴 목록). 되풀이 안전.
 */
export function settleCurrentArtIn(project: Project): { readonly notes: string[]; readonly missing: { readonly wanted: string; readonly where: string; readonly name: string }[] } {
  const notes: string[] = [];
  const missing = new Map<string, { wanted: string; where: string; name: string }>();
  const installed: string[] = [];
  const troops = battleTroops(project);
  for (const [troopId, where] of troops) {
    const troop = project.database.troops.find((t) => t.id === troopId);
    const ids = new Set([...(troop?.enemyIds ?? []), ...(troop?.members ?? []).map((m) => m.enemyId)]);
    for (const enemyId of ids) {
      const art = artOf(project, enemyId);
      if (!art) continue;
      if (!isCurrentMonsterArt(art)) {
        if (/^generated-enemy-/u.test(art) && !project.assets.uploaded[art]) { const wanted = wantedArtName(project, enemyId); if (!missing.has(wanted)) missing.set(wanted, { wanted, where, name: String(enemyOf(project, enemyId)?.name ?? enemyId) }); }
        continue;
      }
      if (hasCurrentMonsterArt(project, art)) continue;
      useCurrentArt(project, enemyId);
      if (hasCurrentMonsterArt(project, art)) installed.push(art.replace(/^generated-enemy-/u, ""));
    }
  }
  if (installed.length) notes.push(`적 그림 ${[...new Set(installed)].length}종을 현행 그림으로(${[...new Set(installed)].join("·")})`);
  // 맵 위 그림: 현행 그림이 든 적이 같은 종류의 옛 걷기 칩으로 서 있으면 전투 그림 그대로 세운다(런타임이 그 그림에서 걷기 칩을 뽑는다).
  let restood = 0;
  for (const map of Object.values(project.maps)) {
    map.events = (map.events ?? []).map((ev) => {
      let changed = false;
      const pages = (ev.pages ?? []).map((page) => {
        let troopId = "";
        walk(page.commands ?? [], (c) => { if (c.kind === "battleProcessing" && typeof c.troopId === "string") troopId ||= c.troopId; });
        const art = troopId ? artOf(project, leadEnemyId(project, troopId)) : undefined;
        if (!art || !hasCurrentMonsterArt(project, art)) return page;
        const chip = fieldGraphicForBattler(art);
        const graphic = (page.graphic ?? {}) as { sprite?: { id?: unknown }; pattern?: unknown };
        if (!chip || graphic.sprite?.id !== chip.textureKey) return page;
        if (typeof graphic.pattern !== "number" || decodeCharsetFrameIndex(graphic.pattern).characterIndex !== chip.characterIndex) return page;
        changed = true; restood += 1;
        return { ...page, graphic: { sprite: { type: "bundled", id: art }, direction: "down", pattern: 0 } } as typeof page;
      });
      return changed ? { ...ev, pages } : ev;
    });
  }
  if (restood) notes.push(`맵 위 적 ${restood}곳을 옛 걷기 칩에서 전투 그림으로`);
  return { notes, missing: [...missing.values()] };
}

// ---------------------------------------------------------------- 보스 그림은 게임 안에서 하나씩
// 왜(2026-11-15 버들항 던전): 현행 그림이 있는 종이 서른여덟뿐이라 주제 보스가 대역으로 접히면 한 그림에 몰린다 — 리치·마왕·대마법사가 모두
// 어둠 망령, 붉은 용·얼음 용·본 드래곤이 모두 푸른 용. 던전 둘을 지은 게임에서 두 보스가 같은 그림이었다(planTroops 의 taken 은 한 번 부를 때만 살았다).
// 이 게임의 다른 곳 보스가 이미 쓰는 그림은 «쓴 그림» 이고, 새 보스는 남은 그림 가운데 가장 가까운 종(BOSS_KIN) → 센 종 순으로 고른다.

/** 보스 그림이 이미 쓰였을 때 대신 설 가까운 종(적 id 의 enemy_ 뺀 꼬리, 앞이 가깝다). */
const BOSS_KIN: Readonly<Record<string, readonly string[]>> = {
  dragon_blue: ["dragon_whelp", "spirit_fire", "hound_hell"],
  wraith_dark: ["eye_floating", "ghost_pale", "hound_hell", "mantis_blade"],
  golem_iron: ["golem_stone", "golem_crystal", "bandit_mask", "golem_clay"],
  golem_stone: ["golem_crystal", "golem_iron", "golem_clay", "bear_brown"],
  golem_crystal: ["golem_stone", "golem_iron", "golem_clay"],
  spider_cave: ["mantis_blade", "centipede_fire", "bear_brown"],
  slime_green: ["eel_electric", "crab_rock", "spirit_water"],
  spirit_water: ["eel_electric", "crab_rock"],
  goblin_scout: ["bandit_mask", "bear_brown", "wolf_dire"],
  wolf_dire: ["bear_brown", "hound_hell"],
  hound_hell: ["wolf_dire", "spirit_fire"],
};

const BOSS_EVENT = /_boss(?:_|$)/u;

/**
 * 이 게임의 보스들이 이미 쓰는 적 그림 — 보스 이벤트(id·무리 id 가 …_boss)의 전투 무리에서 앞장선 적의 그림. skip 맵(지금 다시 짓는 던전)은 뺀다.
 */
export function bossArtInUse(project: Project, skip: (map: { id: string; name?: string }) => boolean = () => false): Set<string> {
  const used = new Set<string>();
  for (const map of Object.values(project.maps)) {
    if (skip(map)) continue;
    for (const ev of map.events ?? []) walk(ev.pages ?? [], (c) => {
      if (c.kind !== "battleProcessing" || typeof c.troopId !== "string") return;
      if (!BOSS_EVENT.test(ev.id) && !BOSS_EVENT.test(c.troopId)) return;
      const a = artOf(project, leadEnemyId(project, c.troopId));
      if (a) used.add(a);
    });
  }
  return used;
}

const keyHash = (key: string): number => [...key].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 17);

/**
 * 보스로 설 적 — want(이미 현행 그림으로 접힌 적)의 그림이 이 게임의 다른 보스와 겹치면 남은 그림의 종으로 바꾼다.
 * 순서: 가까운 종(BOSS_KIN) → 기본 DB 의 현행 그림 종을 센 순으로(위 여섯은 게임 열쇠로 돌린다 — 게임마다 다른 종이 먼저). avoid = 잡몹과 닮은 종 등 부르는 쪽 금지.
 * 남은 그림이 없으면 want 그대로(겹침을 받아들인다).
 */
export function distinctBossFoe(project: Project, want: string, used: ReadonlySet<string>, avoid: (enemyId: string) => boolean, key: string): string {
  const free = (id: string): boolean => { const a = artOf(project, id); return !!a && isCurrentMonsterArt(a) && !used.has(a) && !avoid(id); };
  if (!used.has(artOf(project, want) ?? "")) return want;
  const kin = (BOSS_KIN[want.replace(/^enemy_/u, "")] ?? []).map((t) => `enemy_${t}`).filter((id) => enemyOf(project, id));
  const strength = (id: string): number => { const s = enemyOf(project, id)?.stats; return (s?.maxHp ?? 0) + 4 * (s?.attack ?? 0); };
  const pool = project.database.enemies.map((e) => e.id).filter((id) => /^enemy_(?!v2_|dg_)/u.test(id) && hasCurrentArt(project, id))
    .sort((a, b) => strength(b) - strength(a) || a.localeCompare(b));
  const head = pool.slice(0, 6), turn = head.length ? keyHash(key) % head.length : 0;
  const order = [...kin, ...head.slice(turn), ...head.slice(0, turn), ...pool.slice(6)];
  const pick = order.find(free);
  if (!pick) return want;
  useCurrentArt(project, pick);
  return pick;
}

/**
 * 글(모델이 적은 이름·생김새)이 이름과 그림 설계 글로 짚은 적 — 그 적의 그림이 어느 묶음에든 있으면(현행 세트가 아니어도) 그 적. 겹치는 낱말이 둘 이상이고
 * 그런 적이 하나로 갈릴 때만(«해골» 한 낱말은 해골·해골 궁수·해골 기사를 가르지 못한다). 낱말 표가 아니라 적 이름과 그림 설계 글(retroMonsterPlan)을 읽는다.
 * 왜(2026-11-16 확인 빌드 r6a P6 · 오너 «에셋을 자유롭게»): «녹슨 갑옷과 방패를 든 해골 병사» 의 그림(해골 기사 — 설계 글 «녹슨 갑옷·방패·장검의 해골»)이
 * 옛 세트에 있는데 현행 세트에 없다고 «창백한 유령» 이 대신 섰다. 한 화풍은 구성기가 스스로 고를 때의 기본값이다 — 모델이 짚은 그림은 그대로 쓴다.
 */
export function namedFoeArt(project: Project, text: string): string | undefined {
  const said = text.normalize("NFC");
  const design = new Map(RETRO_MONSTER_PLAN.map((plan) => [`generated-enemy-${plan.slug}`, plan.design]));
  const scored = project.database.enemies.flatMap((enemy) => {
    const art = (enemy as { monsterResourceId?: string }).monsterResourceId;
    if (!art || /^enemy_(?:v2|path|fit)_/u.test(enemy.id) || !(isCurrentMonsterArt(art) || isGeneratedMonsterSprite(art))) return [];
    const words = new Set(`${enemy.name ?? ""} ${design.get(art) ?? ""}`.split(/[\s·,()]+/u).filter((w) => w.length >= 2 && said.includes(w)));
    return words.size >= 2 ? [{ id: enemy.id, art, hits: words.size }] : [];
  }).sort((a, b) => b.hits - a.hits);
  const [best, next] = scored;
  return best && (!next || next.hits < best.hits || next.art === best.art) ? best.id : undefined;
}
