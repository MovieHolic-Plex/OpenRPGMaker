// project/characterMotion.ts
// 캐릭터 이동 속도·빈도의 정본 표(순수 함수). 런타임(player)·조수 도구·게임 점검이 같은 수를 쓴다.
//
// 실측(2026-10-22, 출하 플레이어, 16px 여관·첫사랑 팀장): 기본 NPC(speed 3·frequency 3)가 명령 경로(moveEvent)로 걸으면
// 한 칸 400ms 미끄러진 뒤 560ms 서 있다가 다시 걸었다 — 칸당 약 0.98초(16px/s), 주인공(160ms/칸, 100px/s)의 1/6.
// 고친 것: 명령 경로는 걸음 사이에 빈도 대기를 넣지 않는다(RPG Maker MV/MZ 「이동 루트 설정」과 같다, playSceneAutonomous),
// 속도 표는 RPG Maker 처럼 「보통 NPC(3) = 주인공 걸음의 절반 속도」에 맞췄다.
//
// speed(1~8) → 한 칸 걸리는 ms. 주인공 기본 걸음은 PLAYER_WALK_STEP_MS(160).
//   1: 640 · 2: 480 · 3: 320(보통 NPC, 주인공의 1/2) · 4: 240 · 5: 200 · 6: 160(주인공과 같음) · 7·8: 80
// 6·7·8 은 옛 표와 같다 — 공포 추격자(speed 6~7, frequency 8)의 균형을 바꾸지 않는다.

/** 주인공 걷기 한 칸(PlayScene.moveDurationMs 기본값). */
export const PLAYER_WALK_STEP_MS = 160;

const SPEED_STEP_MS: readonly number[] = [640, 480, 320, 240, 200, 160, 80, 80];

/** speed·frequency 랭크(1~8). 숫자가 아니면 보통(3). */
export function clampNpcSetting(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(8, Math.max(1, Math.trunc(value)));
}

/** 이동 속도 랭크 → 한 칸 걷는 시간(ms). */
export function npcMoveDurationMs(speed: number): number {
  return SPEED_STEP_MS[clampNpcSetting(speed) - 1]!;
}

/**
 * 이동 빈도 랭크 → 자율 이동(무작위·접근·순찰 페이지)의 걸음 사이 대기(ms). 명령 경로(moveEvent·시간표)는 이 대기 없이
 * 이어 걷고, 경로 안의 `wait` 명령 한 번만 이만큼 쉰다.
 */
export function npcMoveIntervalMs(frequency: number): number {
  return Math.max(80, 1040 - clampNpcSetting(frequency) * 160);
}

/** 페이지 저작 간격(moveIntervalMs)이 있으면 그것, 없으면 빈도 랭크. */
export function npcPageMoveIntervalMs(movement: { readonly moveIntervalMs?: number; readonly frequency: number }): number {
  return movement.moveIntervalMs !== undefined
    ? Math.max(80, Math.min(10000, Math.round(movement.moveIntervalMs)))
    : npcMoveIntervalMs(movement.frequency);
}

/**
 * 걷기 그림 한 장(패턴)을 보여 주는 시간. 한 칸에 두 장 — 한 칸에 한 발씩 내딛는다(0→1, 다음 칸 2→1).
 * 예전에는 속도와 무관하게 80ms 였다: 느린 NPC(400ms/칸)가 한 칸 동안 발을 다섯 번 바꿔 제자리 종종걸음처럼 보였다.
 * 주인공(160ms/칸, 90ms/장)은 한 칸에 약 1.8장이다.
 */
export function npcWalkFrameMsForStep(stepDurationMs: number): number {
  return Math.min(400, Math.max(60, stepDurationMs / 2));
}
