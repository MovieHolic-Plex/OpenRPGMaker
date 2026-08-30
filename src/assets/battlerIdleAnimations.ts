// 배틀러 idle 애니메이션 카탈로그 — 전투 화면에서 제자리 숨쉬기/날개짓을 돌리는 프레임 스트립.
//
// 이 카탈로그가 **유일한 정본**이다. 생성기·런타임·계약 테스트가 같은 목록을 봐야 한다
// (`generatedEffectSheets.ts` 가 같은 이유로 카탈로그 단일 정본을 못 박아 뒀다).
// **파일이름 규약**: 스트립은 원본과 같은 파일이름으로 `starter/idle/` 아래에 둔다. 그러면
// 배경 URL 이 원본 파일이름을 그대로 포함해서, "이 배틀러가 자기 자산을 쓰고 있다" 를 재는
// 기존 계약(`test/battleFieldAllySprite.test.ts` 의 부분및자열 단언)이 애니메이션에도 성립한다.
//
// 등록되지 않은 리소스 id 는 애니메이션 없이 지금까지의 정적 그림을 그대로 쓴다 — 몬스터 그래픽이
// 140여 종이라 전량 생성은 목표가 아니고, 옵트인이라 나중에 줄만 늘리면 된다.
//
// ## 두 티어와 그 근거
//
// | 티어 | 대상 | 소스 | 왜 |
// |---|---|---|---|
// | `image-strip` | 384·712px 통짜 배틀러(적·파티 몬스터) | 영상 클립에서 프레임 추출 | 영상은 한 클립 안에서 같은 픽셀을 이어 그려 실루엣이 유지된다 |
// | `sheet-cell` | 48px 전투 캐릭터셋(액터) | 절차 생성(`scripts/asset-gen/gen-battler-idle-strips.mjs`) | 48px 를 업스케일해 모델에 넣으면 캐릭터가 다른 사람이 된다 |
//
// 두 티어는 **재생 좌표계가 다르다**:
//  - `image-strip` 은 스킨마다 CSS width 가 달라(`_battlers.css`, 일부 `!important`) px 로 스텝하면
//    어긋난다 → 백분율(`background-position-x: 0% → 100%`).
//  - `sheet-cell` 은 이미 `--battle-sprite-frame-width` px 계약이 있다 → px 로 스텝한다.
//
// ## 프레임 간격
//
// 영상 티어의 `frameDurationMs` 는 **원본 클립에서 잰 값**이다(루프 구간 프레임 수 ÷ 24fps ÷ 뽑은
// 장수). 임의로 고르면 슬라임이 경련하고 골렘이 슬로모션이 된다. 절차 티어는 전투 애니메이션
// 프레임 간격(`BATTLE_ANIMATION_FRAME_MS` = 120ms)을 그대로 쓴다.
import { BATTLE_ANIMATION_FRAME_MS } from "@/player/battleAnimationPlayback";

export type BattlerIdleAnimationTier = "image-strip" | "sheet-cell";

export type BattlerIdleAnimation = {
  /** 정적 배틀러가 쓰는 리소스 id. 이 id 로 조회한다. */
  readonly resourceId: string;
  /** public 기준 경로(선행 슬래시 없음) — `battlerIdleAnimationUrl` 이 URL 로 바꾼다. */
  readonly path: string;
  readonly frameCount: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly frameDurationMs: number;
  readonly tier: BattlerIdleAnimationTier;
};

/** 영상 클립에서 뽑은 몬스터 idle. 셀 192px = 정적 원본(384px)의 절반. */
const MONSTER_IDLE: readonly BattlerIdleAnimation[] = [
  // 루프 구간 30→72 프레임(1.75s) ÷ 8장 = 219ms — 슬라임이 느리게 부풀었다 가라앉는 속도.
  monster("generated-enemy-slime-01", "monster-slime-01.png", 8, 219),
  // 89→109(0.83s) ÷ 8 = 104ms — 날개짓 한 사이클.
  monster("generated-enemy-bat-01", "monster-bat-01.png", 8, 104),
  // 73→85(0.5s) ÷ 8 = 62ms — 어깨가 오르내리는 짧은 구간이라 실측대로 두면 무게감이 산다.
  monster("generated-enemy-golem-01", "monster-golem-01.png", 8, 62),
];

/** 절차 생성한 액터 숨쉬기. 셀 48px = 전투 캐릭터셋 셀과 같다. */
const ACTOR_IDLE: readonly BattlerIdleAnimation[] = [1, 2, 3, 4, 5, 6].map((index) => ({
  resourceId: `generated-actor-hero-0${index}-battle`,
  path: `assets/generated/starter/idle/hero-0${index}-battle.png`,
  frameCount: 4,
  cellWidth: 48,
  cellHeight: 48,
  frameDurationMs: BATTLE_ANIMATION_FRAME_MS,
  tier: "sheet-cell",
}));

/**
 * 후면(뒷모습) 액터 idle — 영상 클립에서 뽑았다.
 *
 * 셀이 **정사각이 아니다**(290×280 = 1.036). 재생 CSS 는 가로를 표시 상자 폭에 묶고 세로를
 * `auto` 로 두므로, 칸 종횡비가 상자와 다르면 칸이 상자보다 커져 잘린다. 포켓몬 스킨의 아군
 * 뒷모습 상자는 `145px × 140px`(`_battlers.css` 1:1 대치 크기)라 가로가 더 넓다 — 그 비율을
 * 셀에 굽는다. 290×280 은 그 상자의 2배로, 필드 zoom(~2×) 에서 1:1 로 떨어진다.
 *
 * 프레임 간격은 클립 실측 루프 구간에서 나온 값이다(구간 길이 ÷ 8프레임, 24fps 기준):
 * hero-01 16프레임(0.67s) → 83ms, hero-02 20(0.83s) → 104ms, hero-03 24(1.0s) → 125ms,
 * hero-04 20 → 104ms.
 *
 * 프레임 선택은 **의상 색 충실도**가 1순위다(루프 이음매는 2순위). 영상 모델은 클립이 진행되며
 * 색을 흘린다 — hero-01 첫 클립은 파란 튜닉이 갈색으로 바뀌어 색 분포 편차 0.234 였고, 그
 * 프레임을 골랐다면 "다른 옷을 입은 주인공"이 실렸다. 의상을 명시해 다시 생성한 클립에서
 * 편차 0.018·루프 이음매 0.068% 구간을 골랐다. 최종 실측 편차: hero-01 0.018, hero-02 0.016,
 * hero-03 0.032, hero-04 0.069 (계약 상한 0.08, `test/battlerBackIdleAnimation.test.ts`).
 */
const BACK_IDLE: readonly BattlerIdleAnimation[] = [
  backActor("hero-01", 83),
  backActor("hero-02", 104),
  backActor("hero-03", 125),
  backActor("hero-04", 104),
];

function backActor(slug: string, frameDurationMs: number): BattlerIdleAnimation {
  return {
    resourceId: `generated-actor-${slug}-back`,
    // 원본과 같은 파일명으로 `idle/` 아래 둔다 — 파일명 부분문자열을 재는 기존 계약
    // (`test/battleFieldAllySprite.test.ts`)을 그대로 살리기 위해서다.
    path: `assets/generated/battle-skins/sprites/idle/${slug}-back.png`,
    frameCount: 8,
    cellWidth: 290,
    cellHeight: 280,
    frameDurationMs,
    tier: "image-strip",
  };
}

function monster(
  resourceId: string,
  file: string,
  frameCount: number,
  frameDurationMs: number
): BattlerIdleAnimation {
  return {
    resourceId,
    path: `assets/generated/starter/idle/${file}`,
    frameCount,
    cellWidth: 192,
    cellHeight: 192,
    frameDurationMs,
    tier: "image-strip",
  };
}

/**
 * 레거시 별칭 `hero` — 리졸버가 `hero-01-battle.png` 로 보내는 옛 id 다
 * (`generatedAssetResourceResolver.ts:18`). 많은 기존 프로젝트·픽스처가 아직 이 id 를 쓰고
 * `actorBattleImage` 도 생성 시트와 똑같이 3×8 로 다루므로, 같은 스트립을 그대로 붙인다.
 */
const LEGACY_HERO_IDLE: BattlerIdleAnimation = {
  ...ACTOR_IDLE[0],
  resourceId: "hero",
};

export const BATTLER_IDLE_ANIMATIONS: readonly BattlerIdleAnimation[] = [
  ...MONSTER_IDLE,
  ...ACTOR_IDLE,
  ...BACK_IDLE,
  LEGACY_HERO_IDLE,
];

const BY_RESOURCE_ID = new Map(BATTLER_IDLE_ANIMATIONS.map((entry) => [entry.resourceId, entry]));

/** 등록된 idle 애니메이션. 없으면 undefined — 호출자는 정적 렌더로 폴백한다. */
export function battlerIdleAnimation(resourceId: string | undefined): BattlerIdleAnimation | undefined {
  if (!resourceId) return undefined;
  return BY_RESOURCE_ID.get(resourceId);
}

/** 한 사이클 총 길이(ms). CSS 애니메이션 duration 으로 쓴다. */
export function battlerIdleAnimationDurationMs(entry: BattlerIdleAnimation): number {
  return entry.frameCount * entry.frameDurationMs;
}

export function battlerIdleAnimationUrl(entry: BattlerIdleAnimation): string {
  return `/${entry.path}`;
}
