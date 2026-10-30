// 「파티클 효과」 paper(떨군 서류) — 종이답게 떨어지는 낱장 시뮬레이션.
//
// 예전 paper 는 Phaser 파티클 이미터였다: 한 방향 중력 + 일정한 회전 + 공중에서 투명해지기. 종이가 돌멩이처럼
// 포물선을 그리며 빙글빙글 돌다 허공에서 사라졌다(사용자 2026-10-30 「종이 떨어지는 거 이상함」, 첫사랑 출근길 부딪힘).
// 실제 종이는: 확 튀어 오른다 → 공기 저항으로 곧 멈춘다 → 좌우로 흔들리며(흔들림 쪽으로 기울며) 느리게 내려온다 →
// 이따금 뒤집힌다(앞면/뒷면) → 바닥에 납작하게 내려앉아 잠시 남는다.
//
// 모델은 순수 함수(stepPaperSheet)라 시각 없이도 잰다. Phaser 쪽은 낱장마다 이미지 하나를 매 프레임 옮길 뿐이다.

/** 한 장의 상태. 단위는 월드 px · 초. s = 칸 배율(16px 칸 기준 1). */
export type PaperSheet = {
  x: number; y: number;
  vx: number; vy: number;
  /** 바닥(이 y 에 닿으면 내려앉는다). */
  groundY: number;
  /** 흔들림 위상·빠르기(rad/s)·폭(px). */
  phase: number; swayRate: number; swayAmp: number;
  /** 뒤집힘 위상·빠르기. cos(tumble) < 0 이면 뒷면. */
  tumble: number; tumbleRate: number;
  /** 내려앉은 뒤 흐른 시간(초). 공중이면 -1. */
  restSec: number;
  /** 바닥에 놓인 각도(도). */
  restAngle: number;
  /** 흔들림이 시작된(낙하로 들어선) 뒤 흐른 시간. */
  fallSec: number;
};

export type PaperPose = { x: number; y: number; angle: number; scaleX: number; scaleY: number; back: boolean; alpha: number; landed: boolean };

const AIR_DRAG = 3.2;        // 튀어 오르는 속도가 줄어드는 비율(/s)
const GRAVITY = 300;         // px/s² (s=1)
const TERMINAL_FALL = 22;    // 낙하 끝 속도 px/s (s=1) — 종이는 느리게 내려온다
export const PAPER_REST_SEC = 1.6;  // 바닥에 남아 있는 시간
export const PAPER_FADE_SEC = 0.45;

/** 결정적 난수(같은 씨앗 → 같은 낱장). */
export function seededRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

/** 부딪힌 자리(ox, oy = 발밑)에서 흩어지는 낱장들. */
export function spawnPaperSheets(ox: number, oy: number, count: number, s: number, rand: () => number): PaperSheet[] {
  const sheets: PaperSheet[] = [];
  for (let i = 0; i < count; i += 1) {
    // 반은 왼쪽, 반은 오른쪽으로 — 고르게 퍼진다.
    const side = i % 2 === 0 ? -1 : 1;
    const spread = 0.35 + rand() * 0.65;
    sheets.push({
      x: ox + (rand() - 0.5) * 8 * s,
      y: oy - (12 + rand() * 8) * s,                     // 가슴께(품에 안은 서류)에서 터진다
      vx: side * spread * 95 * s,
      vy: -(85 + rand() * 75) * s,
      groundY: oy + (rand() * 14 - 4) * s,               // 발밑 둘레(앞뒤로 조금씩)
      phase: rand() * Math.PI * 2,
      swayRate: 3.2 + rand() * 2.4,
      swayAmp: (9 + rand() * 9) * s,
      tumble: rand() * Math.PI * 2,
      tumbleRate: (rand() < 0.5 ? -1 : 1) * (1.6 + rand() * 2.8),
      restSec: -1,
      restAngle: (rand() - 0.5) * 70,
      fallSec: 0,
    });
  }
  return sheets;
}

/** dt 초 진행. 흔들림은 위치에 직접 더하지 않고 수평 속도로 준다(낙하 중에만). */
export function stepPaperSheet(sheet: PaperSheet, dt: number, s: number): void {
  if (sheet.restSec >= 0) { sheet.restSec += dt; return; }
  const drag = Math.exp(-AIR_DRAG * dt);
  sheet.vx *= drag;
  sheet.vy = sheet.vy * drag + GRAVITY * s * dt;
  const terminal = TERMINAL_FALL * s;
  const falling = sheet.vy >= terminal * 0.6;
  if (sheet.vy > terminal) sheet.vy = terminal;
  sheet.tumble += sheet.tumbleRate * dt * (falling ? 1 : 2.2);
  let swayVx = 0;
  if (falling) {
    sheet.fallSec += dt;
    // 흔들림이 갑자기 튀지 않게 0.4초에 걸쳐 들어온다.
    const ease = Math.min(1, sheet.fallSec / 0.4);
    sheet.phase += sheet.swayRate * dt;
    swayVx = Math.cos(sheet.phase) * sheet.swayAmp * sheet.swayRate * ease;
    // 흔들림의 끝(옆으로 멈출 때)에서는 조금 더 빨리 떨어지고, 가운데를 지날 때는 떠오르듯 느려진다(낙엽 낙하).
    sheet.vy = terminal * (0.75 + 0.45 * Math.abs(Math.sin(sheet.phase))) * ease + sheet.vy * (1 - ease);
  }
  sheet.x += (sheet.vx + swayVx) * dt;
  sheet.y += sheet.vy * dt;
  if (sheet.vy > 0 && sheet.y >= sheet.groundY) {
    sheet.y = sheet.groundY;
    sheet.vx = 0; sheet.vy = 0;
    sheet.restSec = 0;
  }
}

/** 그릴 모습. 공중: 흔들림 쪽으로 기울고, 뒤집힘이 가로 폭을 줄인다. 바닥: 납작하게(3/4 시점의 눕힌 종이). */
export function paperPose(sheet: PaperSheet, s: number): PaperPose {
  if (sheet.restSec >= 0) {
    const fade = Math.max(0, sheet.restSec - PAPER_REST_SEC) / PAPER_FADE_SEC;
    return { x: sheet.x, y: sheet.y, angle: sheet.restAngle, scaleX: s, scaleY: s * 0.55, back: false, alpha: Math.max(0, 1 - fade), landed: true };
  }
  const flip = Math.cos(sheet.tumble);
  const tilt = sheet.fallSec > 0 ? Math.sin(sheet.phase) * 32 : Math.sin(sheet.tumble) * 35;
  return { x: sheet.x, y: sheet.y, angle: tilt, scaleX: s * Math.max(0.18, Math.abs(flip)), scaleY: s, back: flip < 0, alpha: 1, landed: false };
}

export function paperSheetDone(sheet: PaperSheet): boolean {
  return sheet.restSec >= PAPER_REST_SEC + PAPER_FADE_SEC;
}
