import { describe, expect, it } from "vitest";

import {
  BATTLER_PLACEMENTS,
  CANONICAL_SIDEVIEW_ANCHOR_X,
  MANUAL_FRONTAL_DAMPING,
  resolveSkinEnemyPosition,
} from "@/player/battleFieldDom";
import type { BattleSkinId } from "@/battle/skins/types";

const SKIN_IDS = Object.keys(BATTLER_PLACEMENTS) as BattleSkinId[];
const SIDEVIEW: BattleSkinId[] = ["rm2003", "ff", "octopath", "bravely", "goldensun", "chrono"];
const FRONTAL: BattleSkinId[] = ["rm2000", "mv", "vxace", "mother", "dragonquest", "pokemon"];

describe("resolveSkinEnemyPosition", () => {
  it("자동 배치는 기존 배치표와 바이트 동일 — feet-ratio 픽스처를 건드리지 않는다", () => {
    for (const skin of SKIN_IDS) {
      for (const n of [1, 2, 3, 4]) {
        for (let i = 0; i < n; i += 1) {
          expect(resolveSkinEnemyPosition(skin, { x: 200, y: 200 }, i, n, true)).toEqual(
            BATTLER_PLACEMENTS[skin].enemy(i, n),
          );
        }
      }
    }
  });

  it("자동 배치는 정규 좌표 없이도 배치표를 돌려준다", () => {
    for (const skin of SKIN_IDS) {
      expect(resolveSkinEnemyPosition(skin, undefined, 0, 3, true)).toEqual(
        BATTLER_PLACEMENTS[skin].enemy(0, 3),
      );
    }
  });

  it("측면 스킨 수동 배치는 정규 좌표를 직접 쓴다 (y는 0..240→0..160)", () => {
    for (const skin of SIDEVIEW) {
      expect(resolveSkinEnemyPosition(skin, { x: 200, y: 180 }, 0, 3, false)).toEqual({
        x: 200,
        y: 120,
      });
    }
  });

  it("측면 스킨 수동 배치는 표시 범위로 클램프한다", () => {
    expect(resolveSkinEnemyPosition("rm2003", { x: 400, y: 300 }, 0, 1, false)).toEqual({
      x: 320,
      y: 160,
    });
    expect(resolveSkinEnemyPosition("rm2003", { x: -10, y: -5 }, 0, 1, false).x).toBe(0);
  });

  it("정면 스킨 수동 배치는 y를 유지하고 x만 중앙 기준 오프셋으로 옮긴다", () => {
    for (const skin of FRONTAL) {
      const fallback = BATTLER_PLACEMENTS[skin].enemy(1, 3);
      expect(
        resolveSkinEnemyPosition(skin, { x: CANONICAL_SIDEVIEW_ANCHOR_X, y: 0 }, 1, 3, false),
      ).toEqual(fallback);
      const moved = resolveSkinEnemyPosition(
        skin,
        { x: CANONICAL_SIDEVIEW_ANCHOR_X + 40, y: 0 },
        1,
        3,
        false,
      );
      expect(moved.y).toBe(fallback.y);
      expect(moved.x).toBe(
        Math.max(0, Math.min(320, Math.round(fallback.x + 40 * MANUAL_FRONTAL_DAMPING))),
      );
    }
  });

  it("수동이어도 좌표가 없으면 자동 배치로 폴백한다", () => {
    for (const skin of SKIN_IDS) {
      expect(resolveSkinEnemyPosition(skin, undefined, 2, 4, false)).toEqual(
        BATTLER_PLACEMENTS[skin].enemy(2, 4),
      );
      expect(resolveSkinEnemyPosition(skin, { x: Number.NaN, y: 50 }, 2, 4, false)).toEqual(
        BATTLER_PLACEMENTS[skin].enemy(2, 4),
      );
    }
  });
});
