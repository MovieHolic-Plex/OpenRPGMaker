// MCGA 결정론적 엔진 — 순수 함수. GPT 의존성 없음.
// 자원 갱신, 전투 해석, 점령 규칙, 멸만 조건.
// 스펙: "결정론적 엔진(코드) → 공정·예측 가능. GPT 안 씀."

import type {
  CombatResult,
  FactionId,
  TickResult,
  Territory,
} from "@/types";

// ── 상수 (튜닝 포인트) ──────────────────────────────────

export const TICK_INTERVAL_SECONDS = 300; // 5분 (pg_cron과 일치)

/** 고을 1틱당 자연 자원 갱신. 인구 기반 생산 + 곡물 소비. */
export function tickResources(t: Territory): Territory {
  // 인구의 5%씩 곡물 생산, 인구의 3% 소비 → 순 +2%
  const grainGross = Math.round(t.population * 0.05);
  const grainConsume = Math.round(t.population * 0.03);
  // 인구는 자연증가 (곡물이 충분할 때만)
  const canGrow = t.grain + grainGross - grainConsume >= 0;
  const popGrowth = canGrow ? Math.max(1, Math.round(t.population * 0.01)) : -Math.round(t.population * 0.02);

  return {
    ...t,
    grain: Math.max(0, t.grain + grainGross - grainConsume),
    population: Math.max(0, t.population + popGrowth),
  };
}

/**
 * 전투 해석 — 결정론적.
 * 승률 = (공격 병력×전투력) / (공격력 + 수비력).
 * 병력 손실은 양쪽 전력 비율로.
 * 수비 패배 → 고을 점령.
 */
export function resolveCombat(
  attackerTroops: number,
  attackerPower: number, // 공격 측 출병 부대의 전투력 (보통 50~80)
  defender: Territory
): CombatResult {
  const attackerStrength = attackerTroops * (attackerPower / 100);
  const defenderStrength = defender.troops * (defender.combat_power / 100);

  if (defenderStrength <= 0 && attackerStrength <= 0) {
    return {
      winner: "defender", // 양쪽 무력 → 현상 유지
      attacker_losses: 0,
      defender_losses: 0,
      territory_captured: false,
      defender_nation_eliminated: false,
    };
  }

  const total = attackerStrength + defenderStrength;
  const attackerWinRate = attackerStrength / total;

  // 결정론적: 승률 ≥ 0.5면 공격 승. (실제 서버에선 약간의 무작위 가미 가능하나 MVP엔 결정론)
  const attackerWins = attackerWinRate >= 0.5;

  // 손실: 패자는 전력의 60%, 승자는 35% (전쟁은 양쪽 다 다친다)
  const loserLossRate = 0.6;
  const winnerLossRate = 0.35;
  const attackerLosses = attackerWins
    ? Math.round(attackerTroops * winnerLossRate)
    : Math.round(attackerTroops * loserLossRate);
  const defenderLosses = attackerWins
    ? Math.round(defender.troops * loserLossRate)
    : Math.round(defender.troops * winnerLossRate);

  // 점령: 공격 승 시 고을 함락. (문명식 — 수비 격파 = 영토 획득)
  const territoryCaptured = attackerWins;

  return {
    winner: attackerWins ? "attacker" : "defender",
    attacker_losses: attackerLosses,
    defender_losses: defenderLosses,
    territory_captured: territoryCaptured,
    // 멸만 여부는 점령 후 남은 고을 수로 판단 → 호출 측에서 결정
    defender_nation_eliminated: false,
  };
}

/**
 * 점령 적용 — 고을 소유권 이전.
 * 반환: 갱신된 고을 + 이전 소유자(멸만 판정용).
 */
export function applyCapture(
  territory: Territory,
  newOwner: FactionId
): { territory: Territory; previousOwner: FactionId | null } {
  return {
    territory: {
      ...territory,
      nation_id: newOwner,
      // 점령 직후: 저항 잔여 병력 제거, 전투력 반으로 (점령군 정비 필요)
      troops: Math.round(territory.troops * 0.2),
      combat_power: Math.max(10, Math.round(territory.combat_power * 0.5)),
    },
    previousOwner: territory.nation_id,
  };
}

/**
 * 멸만 판정 — 한 세력의 모든 고을이 타 세력/무주공산이면 멸만.
 */
export function isNationEliminated(
  nationId: FactionId,
  allTerritories: Territory[]
): boolean {
  const owned = allTerritories.filter((t) => t.nation_id === nationId);
  return owned.length === 0;
}

/**
 * 통일 조건 — 한 세력이 전체 고을 과반(>50%) 점유.
 * (세력 전멸 조건은 시즌 로직에서 별도 — STEP 4)
 */
export function isUnificationAchieved(
  allTerritories: Territory[]
): FactionId | null {
  const total = allTerritories.length;
  if (total === 0) return null;
  const counts = new Map<FactionId, number>();
  for (const t of allTerritories) {
    if (t.nation_id) {
      counts.set(t.nation_id, (counts.get(t.nation_id) ?? 0) + 1);
    }
  }
  for (const [nation, count] of counts) {
    if (count / total > 0.5) return nation;
  }
  return null;
}

/**
 * 세계 틱 1회 분량 집계 — 모든 고을 자원 갱신.
 * 전투 해석/점령은 활성 전쟁이 있을 때 호출 측에서 별도 적용 (DB 트랜잭션).
 */
export function computeTick(allTerritories: Territory[], tick: number): TickResult {
  const updated = allTerritories.map(tickResources);
  void updated; // 실제 DB 적용은 Edge Function/SQL에서. 여기선 순수 계산만.
  return {
    tick,
    resource_updates: allTerritories.length,
    combats_resolved: 0,
    nations_eliminated: [],
    territory_ownership_changes: [],
  };
}
