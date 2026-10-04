import type { MutableBattler } from "@/battle/battleBattlers";
import type { SkillRecord } from "@/project/types";

type SkillVitals = Pick<MutableBattler, "hp" | "maxHp" | "mp" | "maxMp">;

/** Deterministic cast cost; returns the actual HP spent, leaving at least 1 HP. */
export function spendSkillHp(user: SkillVitals, skill: Pick<SkillRecord, "hpCostPercent">): number {
  const percent = skill.hpCostPercent ?? 0;
  if (percent <= 0 || user.hp <= 1) return 0;
  const before = user.hp;
  user.hp = Math.max(1, before - Math.max(1, Math.floor(user.maxHp * percent / 100)));
  return before - user.hp;
}

/** Post-hit drain follows the runtime's rolled-damage policy, including overkill. */
export function restoreSkillDrain(user: SkillVitals, skill: Pick<SkillRecord, "drainPercent">, dealt: number, affects: "hp" | "mp"): number {
  const percent = skill.drainPercent ?? 0;
  if (percent <= 0 || dealt <= 0 || user.hp <= 0) return 0;
  const before = user[affects];
  const maximum = affects === "mp" ? user.maxMp : user.maxHp;
  user[affects] = Math.min(maximum, before + Math.max(1, Math.floor(dealt * percent / 100)));
  return user[affects] - before;
}
