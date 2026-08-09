export interface SwingDamageInput {
  readonly attackerAttack: number;
  readonly defenderDefense: number;
  readonly bonus: number;
  readonly rand: () => number;
}

export interface ContactDamageInput {
  readonly contactDamage: number | undefined;
  readonly enemyAttack: number;
  readonly defenderDefense: number;
}

export function computeSwingDamage(input: SwingDamageInput): number {
  const base = Math.max(1, Math.round(input.attackerAttack + input.bonus - input.defenderDefense / 2));
  const variance = 0.9 + input.rand() * 0.2;
  return Math.max(1, Math.round(base * variance));
}

export function computeContactDamage(input: ContactDamageInput): number {
  const raw = input.contactDamage ?? Math.max(1, Math.round(input.enemyAttack / 2));
  return Math.max(1, Math.round(raw - input.defenderDefense / 4));
}
