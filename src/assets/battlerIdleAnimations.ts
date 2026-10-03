// 배틀러 idle 애니메이션 카탈로그 — 전투 화면에서 제자리 숨쉬기/날개짓을 돌리는 프레임 스트립.
//
// 이 카탈로그가 **유일한 정본**이다. 생성기·런타임·계약 테스트가 같은 목록을 봐야 한다
// (`generatedEffectSheets.ts` 가 같은 이유로 카탈로그 단일 정본을 못 박아 뒀다).
// **파일이름 규약**: 스트립은 원본과 같은 파일이름으로 원본 옆 `idle/` 아래에 둔다. 그러면
// 배경 URL 이 원본 파일이름을 그대로 포함해서, "이 배틀러가 자기 자산을 쓰고 있다" 를 재는
// 기존 계약(`test/battleFieldAllySprite.test.ts` 의 부분및자열 단언)이 애니메이션에도 성립한다.
//
// 일반 이미지의 몬스터는 native idle_a 초상을 쓴다. 도트 적의 대기 루프/공격/피격은
// pixelEnemySheets.ts 의 3×3 포즈 계약이 소유한다. 폐기된 painted monster idle은 등록하지 않는다.
//
// ## 두 티어와 그 근거
//
// | 티어 | 대상 | 소스 | 왜 |
// |---|---|---|---|
// | `image-strip` | 후면 액터 배틀러 | 영상 클립에서 프레임 추출 | 영상은 한 클립 안에서 같은 픽셀을 이어 그려 실루엣이 유지된다 |
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
import { withInlineAsset } from "@/assets/inlineAssetStore";

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
 * hero-04 는 핑퐁이라 다르다: 5프레임 간격으로 되짚으므로 5÷24fps = 208ms.
 *
 * 프레임 선택 계약은 **넷 다 상대값**이다(`test/battlerBackIdleAnimation.test.ts`). 절대 상한은
 * 이 티어에서 전부 틀린 계약이었다.
 *
 * 1. 색: 원본에서 2% 이상을 지하는 성분의 **상대** 지분 편차 ≤ 0.15. 절대 편차는 지분이 작은
 *    성분이 사라지는 것을 놓친다 — hero-04 는 갈색 두건 망토가 녹색 튜닉을 덮었는데 녹색이
 *    피사체의 8% 라 절대 편차 0.035 로 조용히 통과했다(상대로는 0.42). 상한은 **불량 쪽에서**
 *    정해진다: 알려진 불량이 망토 0.42 / 갈색 튜닉 0.999 이므로 0.15 는 가장 가까운 불량과
 *    2.8배 떨어져 있다.
 * 2. 모션: 인접한 **모든** 칸 쌍의 변화 ≥ 2%. `max()` 로 재면 8칸 중 한 쌍만 움직여도 통과한다.
 * 3. 루프 이음매 ≤ 평소 최대 걸음 × 1.5. 절대 상한은 진폭 큰 모션을 부당하게 떨어뜨린다.
 *
 * 4. 머리: **머리 영역만**(피사체 상단 30%) 같은 7버킷으로 재서 상대편차 ≤ 1.0. 전신 지표로는
 *    부족하다 — 한때 실렸던 hero-04 스트립은 고개가 돌아 귀·볼이 보이고 머리띠에 녹색 이물이
 *    있었는데, 머리가 피사체의 일부라 전신 편차 0.125 로 통과했다. 머리 영역에 걸면 1.941 이다.
 *    상한의 여유는 두 방향으로 적는다: 불량 1.941 은 상한의 1.94배 위, 실린 최악 0.665 는
 *    상한의 1.50배 아래. 그 스트립은 `test/fixtures/battler-idle/` 에 음성 픽스처로 남겨,
 *    상한이 슬그머니 올라가면 테스트가 깨지게 했다.
 *
 * 실린 자산의 **전 칸 worst**(테스트와 같은 집계):
 *   색 편차 0.071 / 0.075 / 0.080 / 0.092, 머리 편차 0.526 / 0.167 / 0.337 / 0.665,
 *   최소 모션 3.58% / 4.09% / 12.20% / 2.36%, 이음매 비 1.17 / 0.25 / 0.65 / 0.71.
 */
const BACK_IDLE: readonly BattlerIdleAnimation[] = [
  backActor("hero-01", 83),
  backActor("hero-02", 104),
  backActor("hero-03", 125),
  backActor("hero-04", 208),
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

// Starter front sheets were removed; the back catalog is independent.
export const BATTLER_IDLE_ANIMATIONS: readonly BattlerIdleAnimation[] = [...BACK_IDLE];

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
  return withInlineAsset(`/${entry.path}`);
}
