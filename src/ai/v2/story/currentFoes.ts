// v2 가 세우는 적은 현행 그림(『폴른 스타』가 쓰는 새 전투 시트 — @/assets/currentMonsterArt)이 있는 종에서만 고른다.
// 왜(2026-11-12 오너, r1w-fun): 기본 DB 적 106종의 번들 3×3 그림(구형)이 그대로 섰다 — 폴른 스타와 다른 그림체, 맵에는 옛 걷기 칩.
// 고르는 함수들(place/placeTheme · place/builders/dungeonFoes · story/sceneVerbs · blueprintPath.foeTroop)이 여기 하나에 묻는다:
//   currentFoe(적 id) → 그 적의 그림이 현행이면 그 적, 아니면 가장 가까운 현행 종(대역) + 바란 그림 이름(없는 그림 줄에 싣는다 — 그릴 목록).
// 고른 적의 그림은 그 자리에서 프로젝트에 넣는다(전투·맵 그림이 같은 새 그림이 된다). 옛 판은 끝맺음 current-monster-art 단계가 맞춘다.
import { hasCurrentMonsterArt, installCurrentMonsterArt, isCurrentMonsterArt } from "@/assets/currentMonsterArt";
import { fieldGraphicForBattler } from "@/editor/tools/fieldEnemyGraphics";
import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Project } from "@/project/types";

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
