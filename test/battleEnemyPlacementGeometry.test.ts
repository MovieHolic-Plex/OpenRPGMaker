import { describe, expect, it } from "vitest";

import { BATTLER_PLACEMENTS } from "@/player/battleFieldDom";
import fixture from "./fixtures/battleEnemyFeetRatios.json";

/** RED 가 나면 배치표 y 를 되돌리거나, 아래로 픽스처를 다시 재서 갱신해라:
 *  `node scripts/runtime-qa.mjs --scenario battle [--skin <id>]` 실행 →
 *  verify-shots/runtime-qa/(battle|skin-*)/manifest.json 의 beats[].battlers 값으로
 *  test/fixtures/battleEnemyFeetRatios.json 을 다시 쓴다. */
const TROOP_SIZE = 3;
const GROUND_BAND_RATIO = fixture._axes.groundBandRatio;
const NO_TOP_CLIP_RATIO = fixture._axes.noTopClipRatio;
const skinIds = Object.keys(fixture.skins) as (keyof typeof fixture.skins)[];

describe("적 세로 배치 기하", () => {
  it("픽스처가 등록 스킨을 모두 덮는다 — 스킨이 늘면 측정도 늘어야 한다", () => {
    expect(skinIds.sort()).toEqual(Object.keys(BATTLER_PLACEMENTS).sort());
  });

  for (const skin of skinIds) {
    const record = fixture.skins[skin];

    it(`${skin}: 저작 y 가 실측 시점과 같다 — 바꿨으면 런타임 게이트로 다시 재라`, () => {
      const placement = BATTLER_PLACEMENTS[skin];
      const authored = Array.from({ length: TROOP_SIZE }, (_, i) => placement.enemy(i, TROOP_SIZE).y);
      expect(authored).toEqual(record.authoredY);
    });

    it(`${skin}: 실측 발이 접지 띠(하위 40%) 안이다 — 하늘에 떠 있지 않다`, () => {
      for (const ratio of record.measured.feetRatio) {
        expect(ratio).toBeGreaterThanOrEqual(GROUND_BAND_RATIO);
        expect(ratio).toBeLessThanOrEqual(1);
      }
    });

    it(`${skin}: 실측 머리가 필드 안이다 — 상단으로 잘리지 않는다`, () => {
      for (const ratio of record.measured.topRatio) {
        expect(ratio).toBeGreaterThanOrEqual(NO_TOP_CLIP_RATIO);
      }
    });
  }

  it("rm2000 정면 구도는 아군을 뒷모습으로 세운다(2026-09-03 전까지는 숨겼다)", () => {
    expect(BATTLER_PLACEMENTS.rm2000.partyFacing).toBe("back");
    // 4인: 가운데(적 자리)를 비우고 좌우 두 쌍, 발끝은 필드 바닥.
    const slots = [0, 1, 2, 3].map((i) => BATTLER_PLACEMENTS.rm2000.party(i, 4));
    expect(slots.map((s) => s.y)).toEqual([160, 160, 160, 160]);
    expect(slots.map((s) => s.x)).toEqual([44, 116, 204, 276]);
    expect(slots.every((s) => Math.abs(s.x - 160) >= 44)).toBe(true);
  });
});
