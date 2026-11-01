// 폴른 스타 장비 판 측정 공용 — 구운 판 위에 「아직 굽지 않은 결정」을 덧칠하고, 무리 힘 배수를 mobBalance 와 같은 식으로 곱한다.
import { applyFallenGearRules, FS_ELITES, FS_PIERCE_FORMULA } from "../../../src/project/flagship/fallen/mobBalance";
import type { EnemyRecord, Project } from "../../../src/project/types";

export const PARTY = ["actor_hero", "actor_fs_elena", "actor_fs_iris", "actor_fs2_sarah"];
/** 1막 대장간에서 살 수 있는 가장 센 방어구(카엘 판금·철 투구·철 방패 = 방어 +30, 엘레나 마법사 로브·수습모, 이리스 사냥꾼 가죽 갑옷). */
export const ARMOR: Record<string, Record<string, string>> = {
  actor_hero: { armor: "equip_gen_armor_plate", helmet: "equip_gen_helm_iron", shield: "equip_gen_shield_iron" },
  actor_fs_elena: { armor: "equip_gen_robe_mage", helmet: "equip_mage_hat" },
  actor_fs_iris: { armor: "equip_gen_armor_leather" },
};
/** 가장 센 무기(카엘 별꿰기 창, 엘레나 수정 지팡이). B4 뒤 카엘은 이야기로 받는 로한의 창이 덮는다. */
export const WEAPONS: Record<string, Record<string, string>> = { actor_hero: { weapon: "equip_fs_spear_star" }, actor_fs_elena: { weapon: "equip_gen_staff_crystal" } };

/** 구운 판이 이번 결정보다 옛것이면 맞춘다(같은 값이면 그대로) — 대장간 방어구 규칙·통금 2인조·수문장 민첩·뚫는 일격. */
export function overlayDecisions(project: Project): void {
  const db = project.database;
  applyFallenGearRules(project);
  const patrol = db.troops.find((t) => t.id === "troop_fs2_curfew_patrol");
  if (patrol && patrol.enemyIds.length === 3) { patrol.enemyIds = patrol.enemyIds.slice(0, 2); patrol.members = (patrol.members ?? []).slice(0, 2); }
  for (const spec of FS_ELITES) {
    const e = db.enemies.find((x) => x.id === spec.id);
    if (e && spec.id === "enemy_fs2_elite_warden") e.stats = { ...e.stats, agility: spec.stats.agility };
    const sk = db.skills.find((x) => x.id === spec.skill.id) as unknown as { damageFormula?: string } | undefined;
    const want = (spec.skill.fields as { damageFormula?: string }).damageFormula;
    if (sk && want === FS_PIERCE_FORMULA) sk.damageFormula = want;
  }
}

const eliteIds = new Set(FS_ELITES.map((e) => e.id));
/** 무리 적을 떼어 낸다(이미 그 무리 몫이거나 우두머리면 그대로). 돌려주는 것은 곱할 적 id. */
export function detach(project: Project, troopId: string, elite: boolean): string[] {
  const db = project.database;
  const troop = db.troops.find((t) => t.id === troopId)!;
  if (elite) return [...new Set(troop.enemyIds.filter((id) => eliteIds.has(id)))];
  const suffix = `_t_${troopId.replace(/^troop_/, "")}`;
  const remap = new Map<string, string>();
  for (const id of new Set(troop.enemyIds)) {
    if (id.endsWith(suffix)) { remap.set(id, id); continue; }
    const base = db.enemies.find((e) => e.id === id)!;
    const copy = JSON.parse(JSON.stringify(base)) as EnemyRecord;
    copy.id = `${id.replace(/_t_fs.*$/, "")}${suffix}`;
    if (!db.enemies.some((e) => e.id === copy.id)) db.enemies.push(copy);
    remap.set(id, copy.id);
  }
  troop.enemyIds = troop.enemyIds.map((id) => remap.get(id)!);
  if (troop.members) troop.members = troop.members.map((m) => ({ ...m, enemyId: remap.get(m.enemyId) ?? m.enemyId }));
  return [...new Set(troop.enemyIds)];
}

/** mobBalance 와 같은 곱하기 — 잡몹 HP·공격·마력 √p 씩, 우두머리는 HP √p 를 0.92~1.1 에 묶고 나머지를 공격·마력으로. */
export function scaleStats(stats: EnemyRecord["stats"], p: number, elite: boolean): EnemyRecord["stats"] {
  const hpMul = elite ? Math.min(1.1, Math.max(0.92, Math.sqrt(p))) : Math.sqrt(p);
  const atkMul = p / hpMul;
  return { ...stats, attack: Math.round(stats.attack * atkMul), mind: Math.round(stats.mind * atkMul), maxHp: Math.max(10, Math.round(stats.maxHp * hpMul / 10) * 10) };
}

/** 배수 표(무리 id → p)를 구운 판에 곱한다. 우두머리 무리는 그 우두머리 적을. */
export function applyDelta(project: Project, delta: Record<string, number>): void {
  const db = project.database;
  for (const [troopId, p] of Object.entries(delta)) {
    const troop = db.troops.find((t) => t.id === troopId);
    if (!troop) continue;
    const elite = troop.enemyIds.some((id) => eliteIds.has(id));
    for (const id of detach(project, troopId, elite)) {
      const e = db.enemies.find((x) => x.id === id)!;
      e.stats = scaleStats(e.stats, p, elite);
    }
  }
}
