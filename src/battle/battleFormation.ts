/** Session rows affect physical damage only; raw stats and monster parties are unchanged. */
export type BattleRow = "front" | "back";
export const FORMATION_EFFECT_TEXT = "후열: 주는 물리 피해·받는 물리 피해 각각 25% 감소. 마법·회복은 동일.";
export function battleRow(value: unknown): BattleRow { return value === "back" ? "back" : "front"; }
/** Apply after damage calculation, before HP/MP mutation. Absorption/healing are unchanged. */
export function formationDamage(amount: number, userRow: BattleRow | undefined, targetRow: BattleRow | undefined,
  statistic: "attack" | "mind", effect: "damage" | "healing" | "support" | "switch"): number {
  if (effect !== "damage" || statistic !== "attack" || amount <= 0) return amount;
  const multiplier = (userRow === "back" ? 0.75 : 1) * (targetRow === "back" ? 0.75 : 1);
  return multiplier === 1 ? amount : Math.max(1, Math.floor(amount * multiplier));
}
export function formationActiveSlots(project: { system: { activeSlots?: number; battleModel?: string } }, count: number): number {
  if (count <= 0) return 0;
  const requested = project.system.activeSlots ?? (project.system.battleModel === "gen1" ? 1 : count);
  return Math.max(1, Math.min(count, Number.isFinite(requested) ? Math.trunc(requested) : count));
}
