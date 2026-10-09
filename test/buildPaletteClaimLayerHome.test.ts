import { describe, expect, it } from "vitest";
import { BUILD_PALETTE_GROUP_CLAIMS } from "@/editor/panels/buildPaletteCore";
import { combinedTownTileset as defaultTileset } from "@/project/defaults/defaultAssets";
import { roleCapabilities } from "@/project/tileRoles";

/**
 * 팔레트 클레임의 layerHome 은 역할 능력의 layerHome 과 의도적으로 갈린다.
 * vocabLayerHomeFor(rmTypeExpander.ts:59-64) 가 group.layerHome → defaultLayer →
 * profile.layerHomeByRole[role] 순으로 해석하므로, 클레임 값은 역할 기본값을 덮는
 * **그룹 단위 오버라이드**다. 같은 role("prop")이 슬롯에 따라 lower/upper/perCell
 * 세 값을 갖는 것이 그 증거이며, 역할 키 조회로는 재현할 수 없다.
 *
 * 이 테스트는 "불일치가 없어야 한다"가 아니라 "알려진 발산이 이 4건 그대로여야 한다"를
 * 고정한다. 클레임이나 역할 표가 바뀌면 이 목록이 변해 눈에 띈다.
 */
describe("건축 팔레트 클레임의 layerHome", () => {
  const compare = (): { readonly agreed: string[]; readonly diverged: string[] } => {
    const tileset = defaultTileset();
    const agreed: string[] = [];
    const diverged: string[] = [];
    for (const [key, claim] of Object.entries(BUILD_PALETTE_GROUP_CLAIMS)) {
      const fromRole = roleCapabilities(tileset, claim.role).layerHome;
      const line = `${key}  claim=${claim.layerHome}  role(${claim.role})=${fromRole}`;
      if (fromRole !== claim.layerHome) diverged.push(line);
      else agreed.push(line);
    }
    return { agreed, diverged };
  };

  it("역할 기본값을 덮는 오버라이드는 알려진 4건 그대로다", () => {
    expect(compare().diverged).toEqual([
      "door  claim=lower  role(prop)=perCell",
      "window  claim=upper  role(prop)=perCell",
      "roof  claim=lower  role(roof)=perCell",
      "prop  claim=upper  role(prop)=perCell",
    ]);
  });

  it("역할 기본값과 같은 값을 쓰는 4건도 그대로다", () => {
    expect(compare().agreed).toEqual([
      "wall  claim=lower  role(wall)=lower",
      "path  claim=lower  role(terrain)=lower",
      "water  claim=lower  role(water)=lower",
      "tree  claim=perCell  role(prop)=perCell",
    ]);
  });

  /**
   * 컬럼을 지울 수 없는 핵심 이유. role 이 같아도 팔레트 슬롯에 따라 답이 갈리므로
   * roleCapabilities(tileset, role).layerHome 같은 역할 키 조회로는 이 표를 대체할 수 없다.
   * 문은 벽을 대체하니 lower, 창문·꽃은 벽/바닥 위에 겹치니 upper, 나무는 수관(상위)과
   * 밑동(하위)이 갈리니 perCell — 전부 슬롯 단위 사실이고 역할 단위 사실이 아니다.
   */
  it("같은 role 이 슬롯에 따라 서로 다른 layerHome 을 갖는다 — 역할 키 조회로 대체 불가", () => {
    const byRole = new Map<string, Set<string>>();
    for (const claim of Object.values(BUILD_PALETTE_GROUP_CLAIMS)) {
      const homes = byRole.get(claim.role) ?? new Set<string>();
      homes.add(claim.layerHome);
      byRole.set(claim.role, homes);
    }

    expect([...(byRole.get("prop") ?? [])].sort()).toEqual(["lower", "perCell", "upper"]);

    const multivalued = [...byRole.entries()]
      .filter(([, homes]) => homes.size > 1)
      .map(([role, homes]) => `${role}=${[...homes].sort().join("|")}`);
    expect(multivalued).toEqual(["prop=lower|perCell|upper"]);
  });
});
