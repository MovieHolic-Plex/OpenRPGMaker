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

/** 전투 개시 진형. normal 은 기존 전투와 같다(저장하지 않는다). */
export type BattleStartFormation = "normal" | "preemptive" | "backAttack" | "pincer" | "surprise";
export const BATTLE_START_FORMATIONS: readonly BattleStartFormation[] = ["normal", "preemptive", "backAttack", "pincer", "surprise"];
export const BATTLE_START_FORMATION_LABELS: Readonly<Record<BattleStartFormation, string>> = {
  normal: "보통",
  preemptive: "선제 공격",
  backAttack: "백어택",
  pincer: "협공",
  surprise: "기습",
};
/** 전투 시작 메시지에 한 줄 덧붙이는 배너 문구. normal 은 없다. */
export const BATTLE_START_FORMATION_BANNERS: Readonly<Record<Exclude<BattleStartFormation, "normal">, string>> = {
  preemptive: "선제 공격! 아군이 먼저 움직인다.",
  backAttack: "백어택! 뒤를 잡혔다 — 대열이 뒤바뀌었다.",
  pincer: "협공! 앞뒤로 둘러싸였다.",
  surprise: "기습당했다! 적이 먼저 움직인다.",
};

export function isBattleStartFormation(value: unknown): value is BattleStartFormation {
  return typeof value === "string" && (BATTLE_START_FORMATIONS as readonly string[]).includes(value);
}

export interface BattleFormationRollInput {
  /** 참전 아군 평균 민첩. */
  readonly partyAgility: number;
  /** 보이는 적 평균 민첩. */
  readonly enemyAgility: number;
  /** 참전 아군 중 누군가 장비 effectFlags.preemptive 를 켰다. */
  readonly preemptiveEquipment: boolean;
}

/**
 * 진형 확률(%). 민첩 우위가 선제를, 열세가 기습을 올린다. 장비 선제 플래그는 선제 +25%p.
 * 백어택·협공은 민첩과 무관한 작은 고정 확률이다.
 */
export function battleFormationChances(input: BattleFormationRollInput): Readonly<Record<Exclude<BattleStartFormation, "normal">, number>> {
  const party = Math.max(1, input.partyAgility);
  const enemy = Math.max(1, input.enemyAgility);
  const edge = (party - enemy) / Math.max(party, enemy);
  const preemptive = clampPercent(5 + edge * 15 + (input.preemptiveEquipment ? 25 : 0), 0, 60);
  const surprise = clampPercent(input.preemptiveEquipment ? 0 : 4 - edge * 10, 0, 20);
  return { preemptive, surprise, backAttack: 3, pincer: 2 };
}

/** rng 한 번으로 진형을 고른다. */
export function rollBattleFormation(input: BattleFormationRollInput, rng: () => number): BattleStartFormation {
  const chances = battleFormationChances(input);
  let cursor = rng() * 100;
  for (const formation of ["preemptive", "surprise", "backAttack", "pincer"] as const) {
    cursor -= chances[formation];
    if (cursor < 0) return formation;
  }
  return "normal";
}

type FacingDir = "down" | "left" | "right" | "up";
const FACING_DELTA: Readonly<Record<FacingDir, { readonly x: number; readonly y: number }>> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * 심볼 인카운트 접촉 방향. 둘이 같은 쪽을 보고 있을 때만 "등" 이 성립한다.
 * 주인공이 적의 등 뒤에서 닿으면 선제, 적이 주인공 등 뒤에서 닿으면 기습. 그 밖은 undefined(굴림에 맡긴다).
 */
export function contactFormation(
  player: { readonly x: number; readonly y: number; readonly facing: FacingDir },
  enemy: { readonly x: number; readonly y: number; readonly facing?: FacingDir },
): "preemptive" | "surprise" | undefined {
  if (!enemy.facing || enemy.facing !== player.facing) return undefined;
  const delta = FACING_DELTA[player.facing];
  const toEnemy = { x: Math.sign(enemy.x - player.x), y: Math.sign(enemy.y - player.y) };
  if (toEnemy.x === delta.x && toEnemy.y === delta.y) return "preemptive";
  if (toEnemy.x === -delta.x && toEnemy.y === -delta.y) return "surprise";
  return undefined;
}

/** 백어택은 대열을 뒤집고, 협공은 후열 보호가 사라져 전원 전열로 선다. */
export function formationStartRow(row: BattleRow | undefined, formation: BattleStartFormation): BattleRow | undefined {
  if (formation === "backAttack") return row === "back" ? "front" : "back";
  if (formation === "pincer") return "front";
  return row;
}

function clampPercent(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)) * 100) / 100;
}
