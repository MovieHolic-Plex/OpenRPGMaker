// 던전의 적·보스 — 주제 낱말로 적 그림 고르기(enemyArtFor), 닮은 적 무리, 트룹 만들기(ensureFoeTroop)·층별 트룹 계획(planTroops). 짓기는 dungeon.ts.
import { dungeonTheme } from "@/editor/tools/dungeonThemeTroops";
import { fitEnemyToStartParty } from "@/editor/tools/bossThreatScaling";
import { pickTroops } from "@/editor/tools/jrpgVolumeTools";
import { type DungeonType } from "@/editor/dungeonKit/types";
import type { EnemyRecord, Project } from "@/project/types";
import type { BuildRun } from "../../shared/types";

/** 적 낱말 → 데이터베이스 적 id(보이는 잡몹). 「불 속성」처럼 종이 없는 말은 주제 적에 맡긴다. */
export const FOE_WORDS: readonly [RegExp, string][] = [
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
export const BOSS_WORDS: readonly [RegExp, string, string][] = [
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

export interface DungeonPlan {
  readonly args: Record<string, unknown>;
  readonly type: DungeonType;
  readonly foes: readonly string[];
  readonly boss?: readonly [string, string];
  readonly missing: string[];
  readonly warnings: string[];
}

export type Pt = { x: number; y: number };

const enemyOf = (project: Project, troopId: string | undefined) => {
  const troop = project.database.troops.find((t) => t.id === troopId);
  const lead = troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0];
  return project.database.enemies.find((e) => e.id === lead);
};

export const art = (project: Project, troopId: string | undefined): string | undefined => {
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
export function planTroops(run: BuildRun, plan: DungeonPlan, toolArgs: Record<string, unknown>, warnings: string[]): Record<string, unknown> | undefined {
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
