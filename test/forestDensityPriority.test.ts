import { describe, expect, it } from "vitest";

import { forestPlacementPlan, treeFootprintCells } from "@/editor/tools/forestDensity";
import { broadleafCountFor, coniferCountFor, resolveWorldGenRules } from "@/project/worldGenRules";

/**
 * PR #350 은 «울창한 숲» 이 잔디밭처럼 드물던 결함을 밀도 축으로 고쳤고, PR #355 는 그 수치를
 * DB 「세계 → 생성 규칙」 탭에서 저작하게 만들었다. 두 PR 은 같은 호출부를 서로 다르게 고쳐서
 * 충돌했다 — #355 가 #350 보다 먼저 갈라졌기 때문에 #355 쪽 코드는 «의도적 대체» 가 아니라
 * 그냥 구버전이다.
 *
 * 그래서 «요청문이 저작 기본값을 이긴다» 로 합성했다. 이 테스트는 그 우선순위가 필요하다는
 * 근거(저작 기본값이 훨씬 드물다)를 숫자로 못 박는다. 순서가 뒤집히면 #350 이 되돌아간다.
 */
describe("숲 밀도 — 요청문이 저작 기본값을 이긴다", () => {
  const area = { x: 0, y: 0, w: 10, h: 10 } as const;
  const areaTiles = area.w * area.h;
  const forest = resolveWorldGenRules(undefined).forest;

  it("저작 기본값은 요청된 «통행 불가» 보다 훨씬 드물다 — 그래서 요청문이 이겨야 한다", () => {
    const requested = forestPlacementPlan({
      area,
      footprintCells: treeFootprintCells("침엽수"),
      density: "impassable",
      share: 0.45,
    });
    const authoredDefault = coniferCountFor(areaTiles, forest);

    expect(authoredDefault).toBeLessThan(requested.count);
    // 저작 기본값을 그대로 쓰면 그루 수가 절반도 안 된다. #350 이 고친 «잔디밭» 이 그 상태다.
    expect(authoredDefault * 2).toBeLessThan(requested.count);
  });

  it("«촘촘함» 요청도 저작 기본값보다 촘촘하다", () => {
    const requested = forestPlacementPlan({
      area,
      footprintCells: treeFootprintCells("침엽수"),
      density: "dense",
      share: 0.45,
    });
    expect(coniferCountFor(areaTiles, forest)).toBeLessThan(requested.count);
  });

  it("활엽수도 같은 방향이다 — 저작 기본값이 요청된 밀도보다 드물다", () => {
    const requested = forestPlacementPlan({
      area,
      footprintCells: treeFootprintCells("활엽수"),
      density: "impassable",
      share: 0.55,
    });
    expect(broadleafCountFor(areaTiles, forest)).toBeLessThan(requested.count);
  });

  it("밀도 축은 촘촘해질수록 그루 수가 늘고 간격이 좁아진다", () => {
    const plans = (["sparse", "normal", "dense", "impassable"] as const).map((density) =>
      forestPlacementPlan({
        area,
        footprintCells: treeFootprintCells("침엽수"),
        density,
        share: 1,
      }),
    );
    for (let i = 1; i < plans.length; i += 1) {
      expect(plans[i]!.count).toBeGreaterThan(plans[i - 1]!.count);
      expect(plans[i]!.minGap).toBeLessThanOrEqual(plans[i - 1]!.minGap);
    }
    // 통행 불가만 빈틈 채우기로 보낸다.
    expect(plans[3]!.packing).toBe("dense");
    expect(plans[2]!.packing).toBe("natural");
  });
});
