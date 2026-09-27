// 난이도 — system.difficulties 에 저작한 배율 묶음과 세션의 현재 난이도(session.difficultyId).
//
// 목록이 없으면 모든 함수가 "배율 1 / 난이도 없음" 을 돌려준다 — 레거시 프로젝트는 동작이 같다.
// 배율은 전투 적 생성(battleBattlers.enemyBattlers), 보상 합산(battleRewards), 랜덤 인카운트
// 누적(playSceneMovement) 세 곳에서 곱한다. 세 곳 모두 이 파일의 함수 하나만 부른다.
import type { DifficultyRecord, SystemRecords } from "@/project/types";

export const DIFFICULTY_RATE_MIN = 0.1;
export const DIFFICULTY_RATE_MAX = 10;
export const DIFFICULTY_LIMIT = 8;

export type DifficultyRateKey = "enemyHpRate" | "enemyAttackRate" | "expRate" | "goldRate" | "encounterRate";
export const DIFFICULTY_RATE_KEYS: readonly DifficultyRateKey[] = ["enemyHpRate", "enemyAttackRate", "expRate", "goldRate", "encounterRate"];

type DifficultySystem = Pick<SystemRecords, "difficulties" | "defaultDifficultyId">;
type DifficultySession = { readonly difficultyId?: string };

/** 잘못된 줄(빈 id·중복 id)은 버리고, 배율은 범위로 자르며 1 은 저장하지 않는다. 남는 줄이 없으면 undefined. */
export function normalizeDifficulties(value: readonly Partial<DifficultyRecord>[] | undefined): DifficultyRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const rows: DifficultyRecord[] = [];
  for (const raw of value) {
    if (rows.length >= DIFFICULTY_LIMIT) break;
    const id = typeof raw?.id === "string" ? raw.id.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 24) : id;
    const row: DifficultyRecord = { id, name };
    for (const key of DIFFICULTY_RATE_KEYS) {
      const rate = normalizeDifficultyRate(raw[key]);
      if (rate !== undefined) row[key] = rate;
    }
    rows.push(row);
  }
  return rows.length > 0 ? rows : undefined;
}

function normalizeDifficultyRate(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.round(Math.min(DIFFICULTY_RATE_MAX, Math.max(DIFFICULTY_RATE_MIN, value)) * 100) / 100;
  return clamped === 1 ? undefined : clamped;
}

export function difficultiesOf(system: DifficultySystem): readonly DifficultyRecord[] {
  return system.difficulties ?? [];
}

/** 새 게임의 난이도 id — 기본값이 목록에 있으면 그것, 아니면 첫 줄. 목록이 없으면 undefined. */
export function initialDifficultyId(system: DifficultySystem): string | undefined {
  const rows = difficultiesOf(system);
  if (rows.length === 0) return undefined;
  return rows.some((row) => row.id === system.defaultDifficultyId) ? system.defaultDifficultyId : rows[0]!.id;
}

/** 세션이 가리키는 난이도. 세션 값이 무효(삭제된 난이도)면 새 게임 기본값으로 읽는다. */
export function activeDifficulty(system: DifficultySystem, session: DifficultySession | undefined): DifficultyRecord | undefined {
  const rows = difficultiesOf(system);
  if (rows.length === 0) return undefined;
  return rows.find((row) => row.id === session?.difficultyId)
    ?? rows.find((row) => row.id === initialDifficultyId(system));
}

export function activeDifficultyId(system: DifficultySystem, session: DifficultySession | undefined): string | undefined {
  return activeDifficulty(system, session)?.id;
}

export function difficultyRate(system: DifficultySystem, session: DifficultySession | undefined, key: DifficultyRateKey): number {
  return activeDifficulty(system, session)?.[key] ?? 1;
}

/** 배율을 곱하고 정수로 내린다. 원래 값이 양수면 결과도 1 이상으로 둔다(HP 0 적·공격력 0 방지). */
export function scaleByDifficulty(value: number, rate: number): number {
  if (rate === 1) return value;
  const scaled = Math.floor(value * rate);
  return value > 0 ? Math.max(1, scaled) : scaled;
}

/** setDifficulty 명령 — 목록에 있는 id 만 받는다. 바뀌었으면 true. */
export function setSessionDifficulty(system: DifficultySystem, session: { difficultyId?: string }, difficultyId: string): boolean {
  const id = difficultyId.trim();
  if (!difficultiesOf(system).some((row) => row.id === id)) return false;
  session.difficultyId = id;
  return true;
}

/** 전투 적 생성 직후 한 번 — HP(최대·현재)와 공격력에 난이도 배율을 곱한다. */
export function applyDifficultyToEnemyBattlers(
  system: DifficultySystem,
  session: DifficultySession | undefined,
  enemies: { maxHp: number; hp: number; attackPower: number }[],
): void {
  const hpRate = difficultyRate(system, session, "enemyHpRate");
  const attackRate = difficultyRate(system, session, "enemyAttackRate");
  if (hpRate === 1 && attackRate === 1) return;
  for (const enemy of enemies) {
    enemy.maxHp = scaleByDifficulty(enemy.maxHp, hpRate);
    enemy.hp = enemy.maxHp;
    enemy.attackPower = scaleByDifficulty(enemy.attackPower, attackRate);
  }
}

/** 편집기 요약문용 — 난이도 이름(없으면 id, 비었으면 안내). */
export function difficultyDisplayName(system: DifficultySystem, difficultyId: string): string {
  const id = difficultyId.trim();
  if (!id) return "(난이도 선택)";
  return difficultiesOf(system).find((row) => row.id === id)?.name ?? id;
}
