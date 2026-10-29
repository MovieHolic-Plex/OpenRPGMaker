// project/chaseTempo.ts
// 필드 추격의 «박자» 정본 — 쫓는 동안 한 칸에 드는 시간, 알아챔 멈춤, 지치기. 런타임(playSceneAutonomous)과
// 조수 도구(place_field_enemy·set_field_detection·make_chase_scene)가 같은 수를 쓴다(순수 함수).
//
// 2026-10-29 사용자 지시 「전체적으로 몬스터나 적들이 쫓아오는 속도를 2배 이상 빠르고 스마트하게」:
//   예전 추격 한 칸 = 걸음 트윈(speed) + 다음 결정까지 대기(frequency). 보통(pace normal) 240+240 = 480ms,
//   느림 720ms — 주인공 걷기(160ms)의 1/3~1/4 속도라 걸어서도 쉽게 따돌렸고, 칸마다 섰다 걸어 뚝뚝 끊겼다.
//   지금: 쫓는 동안은 쉬지 않고 미끄러지듯 이어 걷고(칸 사이 대기 없음), 저자가 박자(chaseStepMs)를 적지 않은
//   페이지는 예전 한 칸 시간을 CHASE_SPEEDUP 으로 나눈다(보통 480 → 218, 빠름 280 → 127).
//   「pace 는 언제나 주인공보다 느리다」는 옛 규칙은 버렸다. 빠른 추격자를 피하는 수단은 시야 끊기·엄폐·문·숨는 곳,
//   그리고 지치기다 — 주인공보다 빠른 추격자는 CHASE_STAMINA_STEPS 칸을 달리면 CHASE_BREATHER_MS 숨을 고른다.
//   저자가 적은 chaseStepMs·sightAlert.holdMs 는 그대로 존중한다(폴른 스타 등 데모는 그 값으로 남는다).

import { npcMoveDurationMs, npcPageMoveIntervalMs, PLAYER_WALK_STEP_MS } from "./characterMotion";

/** 박자를 적지 않은 추격 페이지의 예전 한 칸 시간을 이만큼 나눈다(「2배 이상」). */
export const CHASE_SPEEDUP = 2.2;
/** 박자를 적지 않은 페이지가 내려갈 수 있는 가장 빠른 한 칸(ms). 공포 추격자(speed 6~7)가 순간이동처럼 보이지 않게. */
export const CHASE_LEGACY_MIN_STEP_MS = 115;
/** chaseStepMs 로 적을 수 있는 범위(ms/칸). 주인공 걷기 160 보다 빠르게도 적을 수 있다. */
export const CHASE_STEP_MIN_MS = 90;
export const CHASE_STEP_MAX_MS = 3000;
/** 조수 도구 pace 프리셋이 런타임에서 내는 한 칸(ms) — speed·frequency 표(CHASE_PACE)와 같은 값이어야 한다. */
export const CHASE_PACE_STEP_MS = { slow: 327, normal: 218, fast: 127 } as const;
/** 새로 놓는 추격 적의 알아챔(느낌표) 멈춤 기본(ms). 예전 700. */
export const CHASE_ALERT_HOLD_MS = 300;
/** 박자를 적지 않은 옛 페이지의 알아챔 멈춤 상한(ms) — 예전 도구 기본 700 이 저장돼 있다. */
export const CHASE_LEGACY_ALERT_CAP_MS = 350;
/** 주인공보다 빠른 추격자가 쉬지 않고 달리는 칸 수. 그 뒤 숨을 고른다(피할 틈). */
export const CHASE_STAMINA_STEPS = 12;
/** 숨 고르는 시간(ms). */
export const CHASE_BREATHER_MS = 650;
/** 놓친 뒤 마지막 목격 자리·진행 방향을 뒤지고 돌아갈 때는 쫓을 때보다 이만큼 느리다(두리번거림). */
export const CHASE_SEARCH_SLOWDOWN = 1.15;
/**
 * 박자를 적지 않은 옛 페이지의 수색 시간 하한(ms). 예전 도구 기본 1500ms 는 마지막 목격 자리에 닿기도 전에 끝나
 * 모퉁이 하나 돌면 곧장 집으로 돌아갔다.
 */
export const CHASE_LEGACY_SEARCH_MIN_MS = 3500;

type ChaseTempoMovement = {
  readonly speed: number;
  readonly frequency: number;
  readonly moveIntervalMs?: number;
  readonly chaseStepMs?: number;
  readonly sightAlert?: { readonly holdMs: number };
};

/** 저자가 박자를 직접 적었는가(적었으면 그 값을 그대로 쓰고 알아챔 멈춤도 손대지 않는다). */
export function chaseTempoAuthored(movement: Pick<ChaseTempoMovement, "chaseStepMs">): boolean {
  return movement.chaseStepMs !== undefined && Number.isFinite(movement.chaseStepMs);
}

/** 예전 런타임의 추격 한 칸(ms) — 걸음 트윈 + 결정 대기. 비교·이주 설명용. */
export function legacyChaseCellMs(movement: ChaseTempoMovement): number {
  return npcMoveDurationMs(movement.speed) + npcPageMoveIntervalMs(movement);
}

/** 쫓는 동안 한 칸에 드는 시간(ms). 칸 사이에 서지 않고 이 시간 동안 한 칸을 미끄러진다. */
export function chaseCellMs(movement: ChaseTempoMovement): number {
  if (chaseTempoAuthored(movement)) {
    return Math.max(CHASE_STEP_MIN_MS, Math.min(CHASE_STEP_MAX_MS, Math.round(movement.chaseStepMs!)));
  }
  return Math.max(CHASE_LEGACY_MIN_STEP_MS, Math.round(legacyChaseCellMs(movement) / CHASE_SPEEDUP));
}

/** 알아챔(느낌표) 멈춤(ms). 박자를 적지 않은 옛 페이지는 CHASE_LEGACY_ALERT_CAP_MS 로 줄인다. */
export function chaseAlertHoldMs(movement: ChaseTempoMovement): number {
  const hold = Math.max(0, movement.sightAlert?.holdMs ?? 0);
  return chaseTempoAuthored(movement) ? hold : Math.min(hold, CHASE_LEGACY_ALERT_CAP_MS);
}

/** 놓친 뒤 뒤지는 시간(ms). 박자를 적지 않은 옛 페이지는 CHASE_LEGACY_SEARCH_MIN_MS 아래로 내려가지 않는다. */
export function chaseSearchLimitMs(movement: Pick<ChaseTempoMovement, "chaseStepMs">, searchMs: number): number {
  return chaseTempoAuthored(movement) ? searchMs : Math.max(searchMs, CHASE_LEGACY_SEARCH_MIN_MS);
}

/** 이 박자면 지친다(주인공 걷기보다 빠르다). 같거나 느리면 지치지 않는다. */
export function chaseTires(cellMs: number): boolean {
  return cellMs < PLAYER_WALK_STEP_MS;
}
