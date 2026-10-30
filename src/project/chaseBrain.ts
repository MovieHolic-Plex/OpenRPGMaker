// project/chaseBrain.ts
// 추격자의 «성격»(EventPageMovement.chaseBrain) — 어떻게 알아채고, 어디로 가고, 무엇을 지나가는가.
//
// 2026-10-30 사용자 「추격하는 걸 졸라 스마트하게」: 폴른 스타 B5 들개가 순찰하며 위·아래만 바라봐 옆 3칸에 선 주인공을
// 끝내 못 봤다(부채꼴 110°만 보았다). 그래서 모든 추격자가 기본으로 발소리를 듣고(사방), 뛰면 더 멀리서 듣고,
// 레버·스위치·밀기 소리를 들으면 그 자리로 와서 뒤진다. 느낌표는 멈추지 않고 달리면서 띄운다.
// 순수 표·함수 — 런타임(@/player/playSceneAutonomous·horrorRuntime)·조수 도구(set_field_detection·place_field_enemy)가 같은 값을 쓴다.
import { isFieldApproachStyle, type FieldApproachStyle } from "./fieldApproachStyle";

export const CHASE_BRAINS = ["auto", "smart", "beast", "knight", "ghost", "classic"] as const;
export type ChaseBrain = (typeof CHASE_BRAINS)[number];
export type ResolvedChaseBrain = Exclude<ChaseBrain, "auto">;

export const CHASE_BRAIN_LABELS: Readonly<Record<ChaseBrain, string>> = {
  auto: "자동 — 다가오는 방식으로 고른다(질주·도약·급강하·기기 = 야수, 육중 = 기사, 나머지 = 영리함)",
  smart: "영리함(기본) — 발소리를 사방으로 듣고(걷기 3칸·달리기 8칸), 진행 방향을 앞질러 막고, 여럿이면 갈라져 감싼다",
  beast: "야수 — 시야 +3칸·앞쪽 반원, 발소리 5/10칸, 꾀부리지 않고 곧장 돌진, 쉽게 포기하지 않는다",
  knight: "기사 — 시야 +1칸·160° 경계, 혼자여도 앞질러 길목을 막고, 여럿이면 3칸 밖에서 포위해 퇴로를 끊는다",
  ghost: "유령 — 벽·지형을 통과하고 벽 너머도 본다(맵 밖·안전지대는 못 들어간다)",
  classic: "옛 방식 — 시야로만 알아채고 느낌표에서 저작한 만큼 멈춘다(2026-10-29 이전 추격)",
};

export interface ChaseBrainProfile {
  readonly brain: ResolvedChaseBrain;
  /** 걷는 주인공 발소리를 사방으로 듣는 거리(칸, 맨해튼). 0 = 안 듣는다. */
  readonly hearWalkCells: number;
  /** 달리는(대시) 주인공 발소리 거리(칸). */
  readonly hearRunCells: number;
  /** 서 있는 주인공을 곁에서 느끼는 거리(칸). */
  readonly senseStillCells: number;
  /** 레버·스위치·밀기 같은 소리를 듣는 거리 배율(소리 반경 × 이 값). */
  readonly noiseScale: number;
  /** 저작 시야에 더하는 칸(야수의 냄새·기사의 경계). 0 = 저작 그대로 — 영리함은 시야를 늘리지 않고 귀로 안다. */
  readonly sightBonusCells: number;
  /** 부채꼴 시야의 최소 각(도). 0 = 저작 그대로. */
  readonly minConeDegrees: number;
  /** 느낌표 멈춤 상한(ms). Infinity = 저작 그대로. */
  readonly alertHoldCapMs: number;
  /** 앞질러 막기(진행 방향 예측). */
  readonly intercept: boolean;
  /** 앞질러 막기를 시작하는 최소 흐름(같은 방향 칸 수). */
  readonly interceptMinRun: number;
  /** 여럿이면 갈라져 감싸기. */
  readonly flank: boolean;
  /** 감싸기 자리를 주인공에서 몇 칸에 잡는가. */
  readonly flankOffset: number;
  /** 벽·지형을 통과한다(맵 밖·안전지대·막는 이벤트는 그대로). */
  readonly phase: boolean;
  /** 벽 너머도 본다(시선 막힘 무시). */
  readonly seeThroughWalls: boolean;
  /** 포기 거리 덤(칸). */
  readonly giveUpBonus: number;
}

const PROFILES: Readonly<Record<ResolvedChaseBrain, ChaseBrainProfile>> = {
  smart: {
    brain: "smart", hearWalkCells: 3, hearRunCells: 8, senseStillCells: 1, noiseScale: 1, sightBonusCells: 0, minConeDegrees: 0,
    alertHoldCapMs: 0, intercept: true, interceptMinRun: 2, flank: true, flankOffset: 2, phase: false, seeThroughWalls: false, giveUpBonus: 2,
  },
  beast: {
    brain: "beast", hearWalkCells: 5, hearRunCells: 10, senseStillCells: 2, noiseScale: 1.3, sightBonusCells: 3, minConeDegrees: 180,
    alertHoldCapMs: 0, intercept: false, interceptMinRun: 99, flank: false, flankOffset: 2, phase: false, seeThroughWalls: false, giveUpBonus: 5,
  },
  knight: {
    brain: "knight", hearWalkCells: 3, hearRunCells: 8, senseStillCells: 1, noiseScale: 1, sightBonusCells: 1, minConeDegrees: 160,
    alertHoldCapMs: 0, intercept: true, interceptMinRun: 1, flank: true, flankOffset: 3, phase: false, seeThroughWalls: false, giveUpBonus: 3,
  },
  ghost: {
    brain: "ghost", hearWalkCells: 3, hearRunCells: 8, senseStillCells: 1, noiseScale: 1, sightBonusCells: 0, minConeDegrees: 0,
    alertHoldCapMs: 0, intercept: true, interceptMinRun: 2, flank: true, flankOffset: 2, phase: true, seeThroughWalls: true, giveUpBonus: 3,
  },
  classic: {
    brain: "classic", hearWalkCells: 0, hearRunCells: 0, senseStillCells: 0, noiseScale: 0, sightBonusCells: 0, minConeDegrees: 0,
    alertHoldCapMs: Number.POSITIVE_INFINITY, intercept: true, interceptMinRun: 2, flank: true, flankOffset: 2, phase: false, seeThroughWalls: false, giveUpBonus: 0,
  },
};

export function isChaseBrain(value: unknown): value is ChaseBrain {
  return typeof value === "string" && (CHASE_BRAINS as readonly string[]).includes(value);
}

/** 다가오는 방식으로 고르는 자동 성격. 유령(float)은 자동으로 벽을 통과시키지 않는다 — 벽으로 피하게 만든 옛 맵이 깨진다. */
export function autoChaseBrain(style: FieldApproachStyle | undefined): ResolvedChaseBrain {
  if (style === "dash" || style === "pounce" || style === "swoop" || style === "slither") return "beast";
  if (style === "lumber") return "knight";
  return "smart";
}

/** 페이지 movement 의 성격 표. 생략·auto·모르는 값은 다가오는 방식으로 고른다. */
export function chaseBrainProfile(movement: { readonly chaseBrain?: unknown; readonly approachStyle?: unknown } | undefined): ChaseBrainProfile {
  const raw = movement?.chaseBrain;
  const brain: ResolvedChaseBrain = isChaseBrain(raw) && raw !== "auto"
    ? raw
    : autoChaseBrain(isFieldApproachStyle(movement?.approachStyle) ? movement!.approachStyle as FieldApproachStyle : undefined);
  return PROFILES[brain];
}

/** 소리 반경(칸). 레버·스위치 8, 밀기 6, 효과음 5. */
export const CHASE_NOISE_RADIUS = { lever: 8, push: 6, sound: 5 } as const;
