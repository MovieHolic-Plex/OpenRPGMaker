import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { TILE } from "@/project/defaults/constants";
import {
  applyVocabSoftConfirmApprovals,
  extractVocabSoftConfirm,
  isApprovedGroup,
  resolveVocabForBuild,
} from "@/project/tileVocabulary";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import { collectVocabSoftConfirms, markSoftVocabApprovalsOnProject } from "@/editor/panels/aiProposalFusion";
import type { ProposedCall } from "@/ai/assistantSession";

const MAP_ID = "map_soft";
const TREE = `${COMBINED_TOWN_HARNESS_PREFIX}conifer-tree`;

function makeCtx() {
  const context = { project: createBlankProject() };
  const created = runTool(context, "create_map", { id: MAP_ID, name: "soft", width: 20, height: 16 });
  expect(created.ok).toBe(true);
  context.project.maps[MAP_ID].lowerTiles.fill(TILE.GRASS);
  context.project.maps[MAP_ID].upperTiles.fill(TILE.EMPTY);
  // 번들 하네스 그룹은 source:"bundled-default"로 시드 승인된다(2026-07-11). 이 스위트는
  // soft-confirm 흐름 자체를 검증하므로, 테스트에 쓰는 TREE 그룹의 번들 신뢰를 제거해
  // 미승인 상태로 되돌린다.
  const tileset = context.project.tilesets[context.project.maps[MAP_ID].tilesetId];
  const tree = tileset.tileGroups?.find((group) => group.id === TREE);
  if (tree) {
    tree.origin = undefined;
    tree.source = undefined;
  }
  return context;
}

describe("vocab soft-confirm", () => {
  it("resolveVocabForBuild soft-allows existing harness tree, missing fails", () => {
    const ctx = makeCtx();
    const tileset = ctx.project.tilesets[ctx.project.maps[MAP_ID].tilesetId];
    const soft = resolveVocabForBuild(tileset, { groupId: TREE });
    expect(soft.status).toBe("soft");
    if (soft.status === "soft") {
      expect(soft.softConfirm.groupId).toBe(TREE);
      expect(soft.softConfirm.name.length).toBeGreaterThan(0);
    }
    expect(resolveVocabForBuild(tileset, { groupId: "missing-xyz" }).status).toBe("missing");
  });

  it("place_props soft result carries confirm payload; immediate apply marks origin:user", () => {
    const ctx = makeCtx();
    const result = runTool(ctx, "place_props", {
      mapId: MAP_ID,
      area: { x: 2, y: 2, w: 10, h: 8 },
      material: "침엽수",
      count: 2,
      seed: 11,
    });
    expect(result.ok, result.summary).toBe(true);
    const soft = extractVocabSoftConfirm(result.data);
    expect(soft?.groupId).toBe(TREE);

    const tilesetId = ctx.project.maps[MAP_ID].tilesetId;
    expect(isApprovedGroup(ctx.project.tilesets[tilesetId], TREE)).toBe(false);

    const call: ProposedCall = {
      name: "place_props",
      args: { mapId: MAP_ID, material: "침엽수" },
      summary: result.summary,
      result,
      destructive: false,
      requiresApproval: true,
    };
    expect(collectVocabSoftConfirms([call])).toHaveLength(1);

    const marked = markSoftVocabApprovalsOnProject(ctx.project, [call]);
    expect(marked).toBeGreaterThan(0);
    expect(isApprovedGroup(ctx.project.tilesets[tilesetId], TREE)).toBe(true);

    // 두 번째 자동 합의는 멱등이다.
    expect(applyVocabSoftConfirmApprovals(ctx.project, [soft!])).toBe(0);
  });
});
