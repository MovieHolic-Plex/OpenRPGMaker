// benchmarkScoringDetection.test.ts
// 벤치마크 감지(detection) 스코어러(todo 6) 계약 테스트 — TDD: 구현 전에 먼저 작성.
// .omo/plans/tileset-vision-benchmark.md todo 6의 수용 기준을 그대로 옮긴다.
//
// 픽스처 규칙: groundTruth의 실제 멤버를 import해서 사용한다(리터럴 복사 금지 —
// stale-state 방어: groundTruth가 바뀌면 이 테스트도 같은 변경 안에서 갱신되어야 한다).
// 기대 수치는 주석에 산술을 인용해 손으로 고정한다.
import { describe, expect, it } from "vitest";

import { FLOOR_TILES, TRAP_TILES, WALL_TILES } from "@/benchmark/groundTruth";
import { scoreD1, scoreDetection } from "@/benchmark/scoringDetection";

// ── 픽스처 ─────────────────────────────────────────────────────────────────
// WALL_TILES / FLOOR_TILES / TRAP_TILES는 서로 서로소다(groundTruth 계약:
// WALL∩WINDOW=∅, 함정 {342,246}∉FLOOR, TRAP 목록이 다른 세트와 겹치지 않음).
// 따라서 예측에 포함된 trap id는 항상 truth에 없어 "일반 FP"로만 세어진다.

const WALL_IDS = [...WALL_TILES]; // 22개 (2026-08-15 스냅샷)
const FLOOR_IDS = [...FLOOR_TILES]; // 6개: [240,288,303,343,360,423]
const TRAP_IDS = [...TRAP_TILES]; // 8개: [246,273,333,342,411,412,413,443]
const THREE_TRAPS = TRAP_IDS.slice(0, 3); // [246,273,333]

describe("scoreDetection", () => {
  it("완벽 답: f1=1, passed, FP/FN/trapHits=0", () => {
    const result = scoreDetection({ predicted: WALL_IDS, truth: WALL_IDS, traps: TRAP_IDS });
    // tp=|WALL|=22 → prec=22/22=1, rec=22/22=1, f1=2·1·1/(1+1)=1
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.f1).toBe(1);
    expect(result.falsePositives).toBe(0);
    expect(result.falseNegatives).toBe(0);
    expect(result.trapHits).toBe(0); // WALL ∩ TRAP = ∅
    expect(result.passed).toBe(true); // 1 >= 0.8
  });

  it("부분 답: f1=0.5, passed=false", () => {
    const [a, b, c] = WALL_IDS; // 서로 다른 실제 벽 타일 3개
    const result = scoreDetection({ predicted: [a, b], truth: [a, c], traps: [] });
    // tp=1(a) → prec=1/2, rec=1/2, f1=2·(1/2·1/2)/(1/2+1/2)=1/2=0.5
    expect(result.precision).toBe(0.5);
    expect(result.recall).toBe(0.5);
    expect(result.f1).toBe(0.5);
    expect(result.falsePositives).toBe(1); // b (truth에 없음)
    expect(result.falseNegatives).toBe(1); // c (예측에 없음)
    expect(result.trapHits).toBe(0);
    expect(result.passed).toBe(false); // 0.5 < 0.8
  });

  it("빈 예측: precision 0, f1 0, passed=false (NaN 금지)", () => {
    const result = scoreDetection({ predicted: [], truth: WALL_IDS, traps: TRAP_IDS });
    // 빈 pred vs 비어있지 않은 truth → scoringUtils 계약: prec=0, rec=0, f1=0 (NaN 아님)
    expect(result.precision).toBe(0);
    expect(result.recall).toBe(0);
    expect(result.f1).toBe(0);
    expect(Number.isNaN(result.f1)).toBe(false);
    expect(result.falsePositives).toBe(0);
    expect(result.falseNegatives).toBe(WALL_IDS.length);
    expect(result.trapHits).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("오직 trap id만 예측: trapHits=3, 점수는 동등한 함정-없는 예측(빈 배열)과 같은 f1=0", () => {
    const allTraps = scoreDetection({ predicted: THREE_TRAPS, truth: FLOOR_IDS, traps: TRAP_IDS });
    // tp=0 (trap ∉ FLOOR) → prec=0/3=0, rec=0/6=0, f1=0
    // 동등한 함정-없는 예측: [] → f1=0 (빈 pred vs 비어있지 않은 truth).
    // trapHits는 정보용으로만 기록되고 점수에 "추가 페널티"를 주지 않는다 —
    // 즉 함정 예측은 일반 FP 3개로만 점수에 영향을 준다.
    const trapFreeEquivalent = scoreDetection({ predicted: [], truth: FLOOR_IDS, traps: TRAP_IDS });
    expect(allTraps.trapHits).toBe(3); // [246,273,333] ∩ TRAP_TILES
    expect(allTraps.precision).toBe(0);
    expect(allTraps.recall).toBe(0);
    expect(allTraps.f1).toBe(trapFreeEquivalent.f1); // 0 === 0
    expect(allTraps.f1).toBe(0);
    expect(allTraps.falsePositives).toBe(3);
    expect(allTraps.falseNegatives).toBe(FLOOR_IDS.length);
    expect(allTraps.passed).toBe(false);
  });

  it("함정은 일반 FP로만 점수에 영향: pred=truth∪{3 trap} → f1=0.8, trapHits=3 (f1=0이 아님)", () => {
    const trapFree = scoreDetection({ predicted: FLOOR_IDS, truth: FLOOR_IDS, traps: TRAP_IDS });
    const withTraps = scoreDetection({
      predicted: [...FLOOR_IDS, ...THREE_TRAPS],
      truth: FLOOR_IDS,
      traps: TRAP_IDS,
    });
    // trapHits 자체는 점수에 추가 페널티를 주지 않는다. trap id는 truth에 없으므로
    // "일반 FP 3개"로만 세어진다: tp=6, prec=6/9=2/3, rec=1,
    // f1=2·(2/3)·1/(2/3+1)=(4/3)/(5/3)=4/5=0.8 — 함정이 완전히 무시된 1.0도, f1=0도 아니다.
    expect(trapFree.f1).toBe(1);
    expect(trapFree.trapHits).toBe(0);
    expect(withTraps.trapHits).toBe(3);
    expect(withTraps.precision).toBeCloseTo(6 / 9, 10);
    expect(withTraps.recall).toBe(1);
    expect(withTraps.f1).toBeCloseTo(0.8, 10);
    expect(withTraps.falsePositives).toBe(3);
    expect(withTraps.falseNegatives).toBe(0);
    expect(withTraps.passed).toBe(true); // 0.8 >= 0.8 (통과 경계)
  });
});

describe("scoreD1 (벽/바닥 평균 F1 집계)", () => {
  it("두 서브런 모두 완벽 → f1=1, passed", () => {
    const d1 = scoreD1({
      walls: scoreDetection({ predicted: WALL_IDS, truth: WALL_IDS, traps: TRAP_IDS }),
      floors: scoreDetection({ predicted: FLOOR_IDS, truth: FLOOR_IDS, traps: TRAP_IDS }),
    });
    // f1 = (1 + 1)/2 = 1, passed = 1 >= 0.8
    expect(d1.precision).toBe(1);
    expect(d1.recall).toBe(1);
    expect(d1.f1).toBe(1);
    expect(d1.passed).toBe(true);
    expect(d1.falsePositives).toBe(0);
    expect(d1.falseNegatives).toBe(0);
    expect(d1.trapHits).toBe(0);
  });

  it("wall 완벽 + floor 절반 → f1=(1+0.5)/2=0.75, passed=false", () => {
    const [a, b, c] = FLOOR_IDS;
    const d1 = scoreD1({
      walls: scoreDetection({ predicted: WALL_IDS, truth: WALL_IDS, traps: TRAP_IDS }),
      floors: scoreDetection({ predicted: [a, b], truth: [a, c], traps: TRAP_IDS }),
    });
    // wall f1=1, floor f1=0.5(위 "부분 답"과 동일 산술) → 평균 0.75 < 0.8
    expect(d1.f1).toBe(0.75);
    expect(d1.passed).toBe(false);
    expect(d1.falsePositives).toBe(0 + 1); // wall 0 + floor 1
    expect(d1.falseNegatives).toBe(0 + 1); // wall 0 + floor 1
  });

  it("trapHits는 서브런 합산으로만 전달되고 점수는 평균 F1로만 계산", () => {
    const d1 = scoreD1({
      walls: scoreDetection({ predicted: [...WALL_IDS, ...THREE_TRAPS], truth: WALL_IDS, traps: TRAP_IDS }),
      floors: scoreDetection({ predicted: FLOOR_IDS, truth: FLOOR_IDS, traps: TRAP_IDS }),
    });
    // wall: tp=22, prec=22/25, rec=1 → f1=2·(22/25)/(22/25+1)=44/47≈0.93617
    // floor: f1=1 → d1 f1=(44/47+1)/2≈0.96809 >= 0.8
    expect(d1.trapHits).toBe(3);
    expect(d1.f1).toBeCloseTo((44 / 47 + 1) / 2, 10);
    expect(d1.passed).toBe(true);
  });
});
