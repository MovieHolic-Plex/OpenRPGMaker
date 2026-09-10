// OPRN-OUT-026 — 타일 레이어·배경 정책. 투명하다는 사실과 홈 레이어 결정, 그리고
// 하위 배치 시 받침 전략이 서로 다른 축임을 고정한다.
import { describe, expect, it } from "vitest";
import {
  backgroundlessLowerReviews,
  DEFAULT_TRUNK_BACKING_TILE,
  tileBackingTile,
  tileLayerPolicy,
} from "@/editor/tileLayerPolicy";
import { setTileBackingOverride, setTileLayerOverride } from "@/editor/runtimeTileMetadata";
import { TILE } from "@/project/defaults/constants";
import { defaultTileset } from "@/project/defaults/defaultAssets";

const BENCH = 357;
const CONIFER_TRUNK = 290;
const BROADLEAF_TRUNK = 292;
const CONIFER_CANOPY = 260;
const STRAIGHT_ROOF = 404;

describe("tileLayerPolicy — 다섯 부류", () => {
  it("불투명 바닥은 opaqueFloor이고 받침이 없다", () => {
    const tileset = defaultTileset();
    for (const tile of [TILE.GRASS, TILE.WATER, STRAIGHT_ROOF]) {
      const policy = tileLayerPolicy(tileset, tile);
      expect(policy.kind, `타일 ${tile}`).toBe("opaqueFloor");
      expect(policy.home).toBe("lower");
      expect(policy.backingTile).toBeNull();
    }
  });

  it("투명 소품(벤치)은 상위 오버레이이고 받침을 쓰지 않는다", () => {
    const policy = tileLayerPolicy(defaultTileset(), BENCH);
    expect(policy.kind).toBe("transparentOverlay");
    expect(policy.home).toBe("upper");
    expect(policy.transparent).toBe(true);
    expect(policy.backingTile).toBeNull();
  });

  it("나무 밑동 290~293은 받침 있는 하위이고 잔디를 받침으로 쓴다", () => {
    const tileset = defaultTileset();
    for (const tile of [290, 291, 292, 293]) {
      const policy = tileLayerPolicy(tileset, tile);
      expect(policy.kind, `타일 ${tile}`).toBe("backedLower");
      expect(policy.home).toBe("lower");
      expect(policy.backingTile).toBe(DEFAULT_TRUNK_BACKING_TILE);
      expect(policy.multiPart?.partnerTiles).toContain(CONIFER_CANOPY);
    }
  });

  it("수관은 다중 조각 제약으로 표시되고 밑동을 짝으로 가리킨다", () => {
    const policy = tileLayerPolicy(defaultTileset(), CONIFER_CANOPY);
    expect(policy.kind).toBe("multiPart");
    expect(policy.home).toBe("upper");
    expect(policy.multiPart?.partnerTiles).toContain(CONIFER_TRUNK);
  });

  it("사용자가 받침을 없음으로 두면 의도적 투명 하위가 된다", () => {
    const tileset = defaultTileset();
    setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
    expect(policy.kind).toBe("transparentLower");
    expect(policy.backingTile).toBeNull();
    expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBeNull();
  });

  // 브라우저 실측(2026-09-10, verify-shots/oprn-026/03-backing-none-warning.png): 규칙 탭이
  // 「투명 하위(받침 없음)」 부류와 함께 "받침 타일로 투명 픽셀을 채웁니다" 근거를 같이 띄워
  // 바로 위 경고와 모순됐다. 근거는 실제 받침 결과를 말해야 한다.
  it("받침을 없음으로 확정한 밑동의 근거는 받침이 채운다고 말하지 않는다", () => {
    const tileset = defaultTileset();
    setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
    expect(policy.reason).not.toContain("받침 타일로 투명 픽셀을 채웁니다");
    expect(policy.reason).toContain("비어 보일 수 있습니다");
  });

  it("받침이 살아 있는 밑동의 근거는 여전히 받침 합성을 설명한다", () => {
    const policy = tileLayerPolicy(defaultTileset(), CONIFER_TRUNK);
    expect(policy.reason).toContain("받침 타일로 투명 픽셀을 채웁니다");
  });

  it("사용자가 받침 타일을 지정하면 그 타일이 받침이 된다", () => {
    const tileset = defaultTileset();
    setTileBackingOverride(tileset, CONIFER_TRUNK, TILE.PATH);
    expect(tileBackingTile(tileset, CONIFER_TRUNK)).toBe(TILE.PATH);
  });

  it("사용자가 밑동을 상위로 확정하면 받침이 사라진다 — 상위는 하위 지면을 덮지 않는다", () => {
    const tileset = defaultTileset();
    setTileLayerOverride(tileset, BROADLEAF_TRUNK, "upper");
    const policy = tileLayerPolicy(tileset, BROADLEAF_TRUNK);
    expect(policy.home).toBe("upper");
    expect(policy.backingTile).toBeNull();
    expect(policy.source).toBe("user");
  });

  it("자동으로 되돌리면 하네스 기본값(받침 있는 하위)으로 복귀한다", () => {
    const tileset = defaultTileset();
    setTileLayerOverride(tileset, CONIFER_TRUNK, "upper");
    setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    setTileLayerOverride(tileset, CONIFER_TRUNK, "auto");
    setTileBackingOverride(tileset, CONIFER_TRUNK, "auto");
    const policy = tileLayerPolicy(tileset, CONIFER_TRUNK);
    expect(policy.home).toBe("lower");
    expect(policy.backingTile).toBe(DEFAULT_TRUNK_BACKING_TILE);
  });
});

describe("backgroundlessLowerReviews — 검토 신호는 변형하지 않는다", () => {
  it("기본 칩셋에서 받침 있는 밑동은 검토 목록에 들어가지 않는다", () => {
    const reviews = backgroundlessLowerReviews(defaultTileset());
    for (const tile of [290, 291, 292, 293]) {
      expect(reviews.some((review) => review.tile === tile), `타일 ${tile}`).toBe(false);
    }
  });

  it("받침 없는 투명 하위 타일은 네 가지 선택지와 함께 검토 목록에 오른다", () => {
    const tileset = defaultTileset();
    setTileBackingOverride(tileset, CONIFER_TRUNK, "none");
    const review = backgroundlessLowerReviews(tileset).find((item) => item.tile === CONIFER_TRUNK);
    expect(review).toBeDefined();
    expect(review?.kind).toBe("transparentLower");
    expect(review?.choices).toEqual(["overlay", "lowerWithBacking", "transparentLower", "auto"]);
  });

  it("목록을 만드는 것만으로는 타일셋이 바뀌지 않는다 — 가져오기 자동 재분류 금지", () => {
    const tileset = defaultTileset();
    const before = JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta });
    backgroundlessLowerReviews(tileset);
    expect(JSON.stringify({ priority: tileset.priority, tileMeta: tileset.tileMeta })).toBe(before);
  });
});
