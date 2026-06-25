// MCGA 결정론적 엔진 — 순수 함수. GPT 의존성 없음.
// 자원 갱신, 전투 해석, 점령 규칙, 멸만 조건.
// 스펙: "결정론적 엔진(코드) → 공정·예측 가능. GPT 안 씀."

import type {
  ActionKind,
  CombatResult,
  FactionId,
  Office,
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

// ── 행동 카드 (신하 부문) ────────────────────────────────
// 각 카드는 "고을 1곳에 대한 부분 갱신"을 반환. GPT 없이 결정론적.
// 스펙 4절의 행동 카드 표와 1:1.

/** 행동 적용 결과 — 갱신된 고을 부분 + 사람이 볼 효과 요약. */
export interface ActionResult {
  territoryPatch: Partial<Territory>;
  summary: string; // "곡물 +200, 민심 -5" 식의 한 줄
  fame_delta: number; // 왕의 판결(STEP 3)에 영향 줄 공명 변화
}

/** 어떤 행동이 어떤 부문에 속하는지. */
export function actionOffice(kind: ActionKind): Office {
  switch (kind) {
    case "tax_raise":
    case "grain_levy":
    case "infrastructure":
    case "relief":
      return "interior";
    case "conscript":
    case "train":
    case "attack":
    case "defend":
      return "military";
  }
}

/**
 * 내정 행동 적용 — 영의정이 한 고을에 대해.
 * 민심은 명시적 필드가 없으므로, population 증감으로 대리 표현
 * (민심 하락 = 인구 유출, 진휼 = 인구 유지/회복).
 */
function applyInterior(kind: ActionKind, t: Territory): ActionResult {
  switch (kind) {
    case "tax_raise": {
      // 세수 ↑ → 곡물 증가, 민심↓ → 인구 유출
      const grainGain = Math.round(t.population * 0.1);
      const popLoss = Math.round(t.population * 0.03);
      return {
        territoryPatch: {
          grain: t.grain + grainGain,
          population: Math.max(0, t.population - popLoss),
        },
        summary: `곡물 +${grainGain}, 민심 하락(인구 -${popLoss})`,
        fame_delta: 1,
      };
    }
    case "grain_levy": {
      // 군량 징수 → 곡물 대폭 증가, 민심 크게↓
      const grainGain = Math.round(t.population * 0.2);
      const popLoss = Math.round(t.population * 0.06);
      return {
        territoryPatch: {
          grain: t.grain + grainGain,
          population: Math.max(0, t.population - popLoss),
        },
        summary: `군량 +${grainGain}, 민심 급락(인구 -${popLoss})`,
        fame_delta: 0,
      };
    }
    case "infrastructure": {
      // 치수·양잠 → 장기 효과, 즉효 약함. 곡물 약간 소비, 인구 약 증가
      const grainCost = 50;
      const popGain = Math.round(t.population * 0.02);
      return {
        territoryPatch: {
          grain: Math.max(0, t.grain - grainCost),
          population: t.population + popGain,
        },
        summary: `치수 시공 (곡물 -${grainCost}), 인구 +${popGain}`,
        fame_delta: 2,
      };
    }
    case "relief": {
      // 진휼 → 곡물 소비, 민심↑ (인구 회복)
      const grainCost = Math.round(t.population * 0.1);
      const popGain = Math.round(t.population * 0.04);
      return {
        territoryPatch: {
          grain: Math.max(0, t.grain - grainCost),
          population: t.population + popGain,
        },
        summary: `기민 구제 (곡물 -${grainCost}), 인구 +${popGain}`,
        fame_delta: 2,
      };
    }
    default:
      return { territoryPatch: {}, summary: "알 수 없는 내정 행동", fame_delta: 0 };
  }
}

/**
 * 군사 행동 적용 — 병조판서가 한 고을에 대해.
 * attack은 별도 전투 흐름(전쟁 생성)으로 가야 하지만, MVP에선
 * 출병 시 즉시 인접 약한 고을 타격으로 단순화.
 */
function applyMilitary(kind: ActionKind, t: Territory): ActionResult {
  switch (kind) {
    case "conscript": {
      // 징병 → 병력↑, 인구↓, 곡물↓
      const troopGain = Math.round(t.population * 0.1);
      const popLoss = troopGain;
      const grainCost = troopGain * 2;
      return {
        territoryPatch: {
          troops: t.troops + troopGain,
          population: Math.max(0, t.population - popLoss),
          grain: Math.max(0, t.grain - grainCost),
        },
        summary: `병력 +${troopGain}, 인구 -${popLoss}, 곡물 -${grainCost}`,
        fame_delta: 1,
      };
    }
    case "train": {
      // 훈련 → 전투력↑, 병력 약간 손실(부상)
      const powerGain = 5;
      const troopLoss = Math.round(t.troops * 0.02);
      return {
        territoryPatch: {
          combat_power: Math.min(100, t.combat_power + powerGain),
          troops: Math.max(0, t.troops - troopLoss),
        },
        summary: `전투력 +${powerGain}, 병력 -${troopLoss}`,
        fame_delta: 1,
      };
    }
    case "defend": {
      // 철수/수비 → 병력 보존, 전투력 약↑ (방비 강화)
      return {
        territoryPatch: {
          combat_power: Math.min(100, t.combat_power + 3),
        },
        summary: "수비 태세 (전투력 +3)",
        fame_delta: 1,
      };
    }
    case "attack": {
      // 출병 — 별도 전쟁 흐름이 필요하나 MVP에선 자원 소모만 표시.
      // 실제 점령은 전쟁 시뮬레이션(bot-step과 동일 공식)으로 submit-action에서 처리.
      const troopCost = Math.round(t.troops * 0.3);
      return {
        territoryPatch: {
          troops: Math.max(0, t.troops - troopCost),
        },
        summary: `출병 준비 (병력 -${troopCost} 투입)`,
        fame_delta: 0,
      };
    }
    default:
      return { territoryPatch: {}, summary: "알 수 없는 군사 행동", fame_delta: 0 };
  }
}

/**
 * 행동 적용 진입점.
 * 부문 불일치(군사 부문 신하가 내정 행동 제출)는 호출 측에서 사전 검증 권장.
 */
export function applyAction(kind: ActionKind, t: Territory): ActionResult {
  if (actionOffice(kind) === "interior") {
    return applyInterior(kind, t);
  }
  return applyMilitary(kind, t);
}

