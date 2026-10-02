/** Shared defaults: all new projects and the read-only choreography gallery receive the same 32 programs. */
import {
  BATTLE_MOTION_PATTERNS,
  BATTLE_MOTION_LABELS,
  type BattleMotionPattern,
} from "@/battle/battleMotionProgram";
import type { RetroSkillMotion } from "@/assets/retroClassSkills";
import type {
  SkillRecord,
  SkillChoreographyRecord,
} from "@/project/types/database";
const SHOT = new Set<BattleMotionPattern>([
  "fire",
  "return-weapon",
  "bounce",
  "orbit",
  "absorb",
  "marked-spear",
  "mirror-counter",
]);
const LEAP = new Set<BattleMotionPattern>([
  "jump",
  "sky",
  "sky-crush",
  "air-chase",
]);
const MELEE = new Set<BattleMotionPattern>([
  "walk",
  "dash",
  "through",
  "throw",
  "swap",
  "relay",
  "sacrifice",
  "blood-summon",
]);
const SUPPORT = new Set<BattleMotionPattern>([
  "counter",
  "cover",
  "absorb",
  "mirror-counter",
  "transform",
  "trap",
  "summon",
]);
export const BATTLE_MOTION_DESCRIPTIONS: Readonly<
  Record<BattleMotionPattern, string>
> = {
  stationary: "제자리에서 검풍을 보낸다. 이동 없이 짧은 준비와 회수.",
  walk: "등속 구간 전후로 부드럽게 출발·제동하며 접근한다.",
  dash: "뒤로 준비한 뒤 가속해 접촉하고 관성으로 조금 더 나아간다.",
  jump: "상승은 감속, 정점은 잠깐 체류, 낙하는 가속한다.",
  blink: "사라져 대상 뒤에 나타나 베고 원래 자리로 돌아온다.",
  fire: "제자리에서 준비한 뒤 가속 투사체를 발사한다.",
  sky: "화면 위로 완전히 빠져나갔다가 대상에게 강하한다.",
  through: "명중 지점을 통과해 화면 밖으로 퇴장한다.",
  clones: "두 분신이 반대 방향에서 교차해 공격한다.",
  pull: "대상을 점점 빠르게 끌어당긴 뒤 폭발시킨다.",
  freeze: "시간을 멈추고 연타한 뒤 충격을 해제한다.",
  counter: "반격 태세를 준비한다. 다음 물리 명중을 받아낸 뒤 1회 되받아친다.",
  "air-chase": "첫 명중에만 띄우고 추격한다. 빗나가면 후속 타격 취소.",
  throw: "잡기에 성공해야 던진다. 다른 적과 충돌하면 약한 추가 피해.",
  "return-weapon": "밖으로 관통한 무기가 귀환하며 두 번째 타격을 가한다.",
  bounce: "다음 적으로 위력이 줄며 도탄한다. 첫 빗나감 뒤 연쇄 종료.",
  orbit: "표식이 있어야 궤도가 수렴해 공격한다.",
  trap: "지금은 설치하고 대상의 다음 차례에 기폭 판정을 한다.",
  mark: "명중마다 표식을 쌓고 마지막 타격에서 소비해 증폭한다.",
  absorb: "정신력 계열의 지정 속성 피해를 저장한다. 다시 사용해 방출한다.",
  cover: "동료를 엄호한다. 다음 단일 물리 공격을 대신 맞고 반격한다.",
  swap: "명중 뒤 대기 동료와 실제 전투 슬롯을 교대해 후속 공격한다.",
  relay: "첫 명중 뒤 행동 가능한 동료가 이어받는다. 동료 MP도 소비.",
  summon: "소환수가 남아 다음 자기 차례마다 지원한다. 주인이 맞으면 해제.",
  transform: "한시적으로 그림과 공격 배율을 바꾸며 종료 후 복구한다.",
  charge: "한 차례 힘을 모아 더 강하게 공격한다. 준비 중 피격에 취약.",
  zone: "대상 위치에 장판을 남긴다. 차례마다 범위 안에서만 피해.",
  sacrifice: "HP 대가를 먼저 지불한다. 실제 처치에 성공할 때만 환급.",
  "sky-crush": "올려치기 명중 후 강하한다. 마지막 명중에만 주변 충격파.",
  "marked-spear": "나갈 때 표식을 남기고 돌아올 때 소비해 폭발시킨다.",
  "mirror-counter":
    "속성이 맞는 마법을 저장하고 다음 사용 때 세 갈래로 방출한다.",
  "blood-summon":
    "HP를 먼저 내고 소환한다. 지속 지원과 처치 환급을 함께 사용한다.",
};
export const BUNDLED_BATTLE_MOTIONS: readonly SkillChoreographyRecord[] =
  BATTLE_MOTION_PATTERNS.map((pattern, i) => {
    const motion: RetroSkillMotion = LEAP.has(pattern)
      ? "leap-strike"
      : MELEE.has(pattern)
        ? "dash-strike"
        : pattern === "blink"
          ? "blink-strike"
          : pattern === "freeze"
            ? "flurry"
            : SHOT.has(pattern)
              ? "cast"
              : SUPPORT.has(pattern)
                ? "buff"
                : "cast";
    return {
      id: `chor_builtin_${pattern}`,
      name: BATTLE_MOTION_LABELS[i]!,
      description: BATTLE_MOTION_DESCRIPTIONS[pattern],
      motion,
      movement: {
        pattern,
        anticipationMs: 140,
        travelMs: MELEE.has(pattern) ? 180 : 320,
        recoveryMs: 320,
        jumpHeight: LEAP.has(pattern) ? 140 : 90,
        apexMs: 70,
        acceleration: 1,
      },
      weight: LEAP.has(pattern) || pattern === "sacrifice" ? "heavy" : "normal",
      layers: SHOT.has(pattern)
        ? [
            {
              sheet: pattern === "fire" ? "mage_fireball_orb" : "ranger_arrow",
              anchor: "projectile",
            },
            { sheet: "hero_cross", anchor: "target", onHit: "each" },
          ]
        : [
            {
              sheet: SUPPORT.has(pattern) ? "guard_counter" : "hero_cross",
              anchor: SUPPORT.has(pattern) ? "user" : "target",
              onHit: "each",
            },
          ],
      tags: { family: "motion-programs" },
    };
  });
export function defaultBattleMotionSkills(): SkillRecord[] {
  return BUNDLED_BATTLE_MOTIONS.map((c) => {
    const p = c.movement!.pattern,
      support = SUPPORT.has(p);
    const hits =
      p === "freeze" || p === "clones"
        ? [0.3, 0.3, 0.4]
        : ["air-chase", "sky-crush", "mark"].includes(p)
          ? [0.3, 0.3, 0.6]
          : [
                "return-weapon",
                "marked-spear",
                "relay",
                "swap",
                "blood-summon",
              ].includes(p)
            ? [0.55, 0.65]
            : undefined;
    return {
      id: `skill_motion_${p}`,
      name: c.name,
      description: c.description ?? "",
      scope: support && p !== "trap" ? "self" : "enemy",
      type: "normal",
      power: p === "charge" ? 34 : 20,
      mpCost: { flat: support ? 10 : hits ? 14 : 8, percentMax: 0 },
      successRate: 100,
      hitRate: 96,
      variance: 10,
      criticalRate: 5,
      effect: support
        ? { kind: "support" }
        : {
            kind: "damage",
            statistic: SHOT.has(p) ? "mind" : "attack",
            affects: "hp",
          },
      retroChoreographyId: c.id,
      ...(hits ? { hitSequence: hits } : {}),
      battleGimmick: {
        pattern: p,
        durationTurns: 2,
        followOnHit: [
          "air-chase",
          "throw",
          "bounce",
          "relay",
          "sky-crush",
        ].includes(p),
        markKey: "motion",
        maxStacks: 3,
        consumeMarks: ["mark", "marked-spear"].includes(p),
        requiredMark: p === "orbit",
        triggerChance: 85,
        powerMultiplier: 0.45,
        killRefundPercent: ["sacrifice", "blood-summon"].includes(p) ? 12 : 0,
        ...(["summon", "blood-summon", "transform"].includes(p)
          ? { resourceId: "party-pixel-animal-7" }
          : {}),
      },
      ...(["sacrifice", "blood-summon"].includes(p)
        ? { hpCostPercent: 12 }
        : {}),
      ...(p === "charge" ? { chargeTurns: 1 } : {}),
      ...(p === "freeze"
        ? {
            stateEffects: [
              { stateId: "state_stop", operation: "add" as const, chance: 70 },
            ],
          }
        : {}),
    };
  });
}
