import type { MutableBattler } from "@/battle/battleBattlers";

export interface SkillLikeEffect {
  readonly power: number;
  readonly statistic: "attack" | "mind";
  readonly effect: "damage" | "healing" | "support" | "switch";
}

export function applySkillLike(user: MutableBattler, target: MutableBattler, spec: SkillLikeEffect): void {
  const stat = spec.statistic === "mind" ? user.mind : user.attackPower;
  if (spec.effect === "healing") {
    const amount = computeMagnitude(spec.power, user, target, "heal");
    target.hp = Math.min(target.maxHp, target.hp + amount);
    return;
  }
  if (spec.effect === "support" || spec.effect === "switch") return;
  applyDamage(target, computeMagnitude(spec.power, user, target, "damage", stat));
}

function computeMagnitude(
  power: number,
  user: MutableBattler,
  target: MutableBattler,
  mode: "damage" | "heal",
  sourceStat = user.attackPower
): number {
  let magnitude = power + Math.floor(sourceStat / 2);
  if (mode === "damage") {
    magnitude -= Math.floor(target.defense / 2);
    if (target.defending) magnitude = Math.floor(magnitude / 2);
  }
  return Math.max(1, magnitude);
}

function applyDamage(target: MutableBattler, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
}
