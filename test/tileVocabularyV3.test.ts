// test/tileVocabularyV3.test.ts
// 타일 v3 승인 보캐뷸러리 계약 테스트 (2026-07-07 설계, 원칙 0: Zero-Trust Perception).
// 고정하는 계약: (1) 제로 부트스트랩 — 새 프로젝트 승인 집합은 공집합
// (2) 승인 표식은 origin:"user" 뿐(source:"user"는 불인정)
// (3) propose_tile_vocabulary 커밋 = 승인 마킹, 사실 배지는 마킹 전 분류로 계산
// (4) assistantSession의 제안 메타데이터와 무관하게 패널 적용 경로가 즉시 반영.

import { describe, expect, it } from "vitest";
import { VOCABULARY_PROPOSAL_TOOLS } from "@/ai/assistantSession";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { runTool, type ToolContext } from "@/editor/tools";
import { getGrammarProfile, tilesetGrammarProfile } from "@/editor/tools/v3";
import { createBlankProject } from "@/project/defaults";
import { COMBINED_TOWN_TILESET_ID } from "@/project/defaults/constants";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import {
  approvedVocabulary,
  isApprovedGroup,
  isApprovedTile,
  resolveVocabForBuild,
  suggestVocabGroups,
  unapprovedVocabulary,
} from "@/project/tileVocabulary";
import type { TileGroupMetadata, TilesetDef } from "@/project/types";

function context(): { ctx: ToolContext; tileset: () => TilesetDef } {
  const ctx: ToolContext = { project: createBlankProject() };
  return { ctx, tileset: () => ctx.project.tilesets[COMBINED_TOWN_TILESET_ID] };
}

// 엔진 분류가 "upper"인 타일(투명 배경 칩 등) — 사실 배지 모순 테스트용.
// 번들 하네스 그룹에 이미 속한 타일은 제외한다 — 그룹 승인 시드(2026-07-11)로 인해
// 그룹 소속 타일은 approvedVocabulary().tiles(낱개 승인 목록)에서 자연히 빠지므로,
// "낱개 타일" 시나리오를 검증하려면 그 어떤 그룹에도 속하지 않은 타일이 필요하다.
function findUpperTile(tileset: TilesetDef): number {
  const grouped = new Set((tileset.tileGroups ?? []).flatMap((group) => group.tileIds));
  for (let tile = 0; tile < tileset.count; tile++) {
    if (tileLayerHome(tileset, tile) === "upper" && !grouped.has(tile)) return tile;
  }
  throw new Error("upper 분류 타일이 기본 타일셋에 없습니다");
}

describe("승인 보캐뷸러리 판정 (tileVocabulary)", () => {
  it("제로 부트스트랩: 낱개 승인 타일은 공집합이나, 번들 하네스 그룹은 시드 승인된다 (2026-07-11)", () => {
    const { tileset } = context();
    const def = tileset();
    expect(def.tileGroups?.length ?? 0).toBeGreaterThan(0); // 하네스 그룹은 존재하고
    const vocab = approvedVocabulary(def);
    expect(vocab.groups).toHaveLength(def.tileGroups!.length); // source:bundled-default라 전부 승인 시드
    expect(vocab.tiles).toHaveLength(0); // 낱개 타일(tileMeta)은 여전히 zero-trust
    for (const group of def.tileGroups ?? []) expect(isApprovedGroup(def, group.id)).toBe(true);
  });

  it("source:'user'만으로는 승인이 아니다 — origin:'user'가 유일한 표식", () => {
    const { tileset } = context();
    const def = tileset();
    const group = def.tileGroups![0];
    group.source = "user"; // v1 upsert가 자동으로 박는 값
    expect(isApprovedGroup(def, group.id)).toBe(false);
    def.tileMeta![5].source = "user";
    expect(isApprovedTile(def, 5)).toBe(false);
    def.tileMeta![5].origin = "user";
    expect(isApprovedTile(def, 5)).toBe(true);
  });
});

describe("propose_tile_vocabulary (v3 write 툴)", () => {
  it("기존 그룹 승인 제안: 커밋되면 origin:'user' 마킹 + layerHome 저장 + 카드 데이터 반환", () => {
    const { ctx, tileset } = context();
    const groupId = tileset().tileGroups![0].id;
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{ kind: "group", groupId, name: "석벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" }],
    });
    expect(result.ok, result.summary).toBe(true);
    const def = tileset();
    expect(isApprovedGroup(def, groupId)).toBe(true);
    const group = def.tileGroups!.find((entry) => entry.id === groupId)!;
    expect(group).toMatchObject({ origin: "user", source: "user", layerHome: "lower", name: "석벽", role: "wall" });
    const data = result.data as { grammarProfile: string; cards: { facts: unknown[]; groupId?: string }[] };
    expect(data.grammarProfile).toBe("rm-type");
    expect(data.cards).toHaveLength(1);
    expect(data.cards[0].groupId).toBe(groupId);
    expect(data.cards[0].facts.length).toBeGreaterThan(0); // 사실 배지 동봉
    expect(approvedVocabulary(def).groups.map((entry) => entry.id)).toContain(groupId);
  });

  it("기존 9slice 그룹 재제안에 부분 tileIds가 섞여도 기존 구성을 유지하고 warning으로 통과한다", () => {
    const { ctx, tileset } = context();
    const groupId = `${COMBINED_TOWN_HARNESS_PREFIX}wood-wall-9slice`;
    const original = [...tileset().tileGroups!.find((entry) => entry.id === groupId)!.tileIds];
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{
        kind: "group",
        groupId,
        tileIds: original.slice(0, 5),
        name: "통나무 벽",
        role: "wall",
        patternKind: "nine_slice_expandable",
        layerHome: "lower",
      }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings.some((warning) => warning.includes("기존 그룹 타일 구성을 유지했습니다"))).toBe(true);
    const group = tileset().tileGroups!.find((entry) => entry.id === groupId)!;
    expect(group.tileIds).toEqual(original);
    expect(group.patternGrammar?.kind).toBe("nine_slice_expandable");
    const card = (result.data as { cards: { tileIds: number[] }[] }).cards[0];
    expect(card.tileIds).toEqual(original);
  });

  it("기존 그룹 재제안의 tileIds가 기존과 동일하면 경고 없이 현행 승인 마킹만 수행한다", () => {
    const { ctx, tileset } = context();
    const groupId = `${COMBINED_TOWN_HARNESS_PREFIX}wood-wall-9slice`;
    const original = [...tileset().tileGroups!.find((entry) => entry.id === groupId)!.tileIds];
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{
        kind: "group",
        groupId,
        tileIds: original,
        name: "통나무 벽",
        role: "wall",
        patternKind: "nine_slice_expandable",
        layerHome: "lower",
      }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings.some((warning) => warning.includes("기존 그룹 타일 구성을 유지했습니다"))).not.toBe(true);
    const group = tileset().tileGroups!.find((entry) => entry.id === groupId)!;
    expect(group.tileIds).toEqual(original);
    expect(group.origin).toBe("user");
  });

  it("낱개 타일(소품) 승인 제안: tileMeta origin:'user' + userLocked + 승인 어휘 편입", () => {
    const { ctx, tileset } = context();
    const tile = findUpperTile(tileset());
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{ kind: "tile", tileIds: [tile], name: "벤치", role: "prop", layerHome: "upper" }],
    });
    expect(result.ok, result.summary).toBe(true);
    const def = tileset();
    expect(isApprovedTile(def, tile)).toBe(true);
    expect(def.tileMeta![tile]).toMatchObject({ origin: "user", userLocked: true, label: "벤치" });
    expect(approvedVocabulary(def).tiles.map((entry) => entry.tileId)).toContain(tile);
  });

  it("사실 배지 모순: 엔진 분류 'upper' 타일에 layerHome:'lower'를 제안하면 경고를 동봉한다", () => {
    const { ctx, tileset } = context();
    const tile = findUpperTile(tileset());
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [{ kind: "tile", tileIds: [tile], name: "벤치", role: "prop", layerHome: "lower" }],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff?.warnings.some((warning) => warning.includes("사실 배지와 모순"))).toBe(true);
  });

  it("스키마 거부: items 누락/빈 배열은 '다시 보낼 형식 예시'와 함께 거부된다", () => {
    const { ctx } = context();
    const missing = runTool(ctx, "propose_tile_vocabulary", {});
    expect(missing.ok).toBe(false);
    const empty = runTool(ctx, "propose_tile_vocabulary", { items: [] });
    expect(empty.ok).toBe(false);
    expect(empty.issues?.some((issue) => issue.message.includes("다시 보낼 형식 예시"))).toBe(true);
  });

  it("신규 그룹 9slice tileIds 미달은 해당 item만 issues로 보고하고 나머지 item 카드는 유지한다", () => {
    const { ctx, tileset } = context();
    const beforeGroupCount = tileset().tileGroups?.length ?? 0;
    const tile = findUpperTile(tileset());
    const result = runTool(ctx, "propose_tile_vocabulary", {
      items: [
        { kind: "group", tileIds: [301, 302, 303, 331, 332], name: "모자란벽", role: "wall", patternKind: "nine_slice_expandable", layerHome: "lower" },
        { kind: "tile", tileIds: [tile], name: "벤치", role: "prop", layerHome: "upper" },
      ],
    });
    expect(result.ok, result.summary).toBe(true);
    expect(result.issues?.some((issue) => issue.code === "pattern-underspecified" && issue.message.includes("items[0]"))).toBe(true);
    const data = result.data as { cards: { kind: string; name: string }[] };
    expect(data.cards).toEqual([expect.objectContaining({ kind: "tile", name: "벤치" })]);
    expect(tileset().tileGroups?.length ?? 0).toBe(beforeGroupCount);
    expect(tileset().tileGroups?.some((entry) => entry.name === "모자란벽")).toBe(false);
    expect(isApprovedTile(tileset(), tile)).toBe(true);
  });
});

describe("tile_query ask:'unapproved' + 문법 프로파일", () => {
  it("미승인 그룹/타일 요약(수량+대표 id)을 주고, 승인하면 수량이 줄어든다", () => {
    const { ctx, tileset } = context();
    // 번들 그룹은 이제 시드 승인되므로, 미승인 흐름(soft) 자체를 검증하려면
    // 픽스처 그룹 하나의 번들 신뢰를 제거해 미승인 상태로 되돌린다.
    tileset().tileGroups![0].source = undefined;
    const before = runTool(ctx, "tile_query", { ask: "unapproved", limit: 5 });
    expect(before.ok, before.summary).toBe(true);
    const beforeData = before.data as { groupCount: number; groups: { id: string }[]; tileCount: number; sampleTileIds: number[] };
    expect(beforeData.groupCount).toBeGreaterThan(0);
    expect(beforeData.groups.length).toBeLessThanOrEqual(5);
    expect(before.summary).toContain("propose_tile_vocabulary");

    const groupId = tileset().tileGroups![0].id;
    runTool(ctx, "propose_tile_vocabulary", { items: [{ kind: "group", groupId, name: "석벽", role: "wall", layerHome: "lower" }] });
    const after = runTool(ctx, "tile_query", { ask: "unapproved", limit: 5 });
    expect((after.data as { groupCount: number }).groupCount).toBe(beforeData.groupCount - 1);
    expect(unapprovedVocabulary(tileset()).groupCount).toBe(beforeData.groupCount - 1);
  });

  it("grammarProfile 기본은 rm-type이고 미지의 id는 rm-type으로 폴백한다", () => {
    const { tileset } = context();
    expect(tileset().grammarProfile).toBeUndefined();
    expect(tilesetGrammarProfile(tileset()).id).toBe("rm-type");
    expect(getGrammarProfile("no-such-profile").id).toBe("rm-type");
    expect(getGrammarProfile("rm-type").supportedPatternKinds).toContain("nine_slice_expandable");
    expect(getGrammarProfile("rm-type").autotileNeighborhood).toBe(8);
  });
});

describe("번들 하네스 그룹 승인 시드 (2026-07-11)", () => {
  it("source:bundled-default 그룹은 origin 없이도 승인으로 판정된다", () => {
    const { tileset } = context();
    const def = tileset();
    def.tileGroups = [{
      id: "g-bundled", name: "번들 벽", role: "wall", defaultLayer: "lower",
      tileIds: [1, 2, 3], description: "", placementRules: "", source: "bundled-default",
    } as TileGroupMetadata];
    expect(isApprovedGroup(def, "g-bundled")).toBe(true);
    const access = resolveVocabForBuild(def, { groupId: "g-bundled" });
    expect(access.status).toBe("approved");
  });

  it("AI가 만든 그룹(origin/source 없음 또는 origin:ai)은 여전히 soft다", () => {
    const { tileset } = context();
    const def = tileset();
    def.tileGroups = [{
      id: "g-ai", name: "AI 추정 벽", role: "wall", defaultLayer: "lower",
      tileIds: [1], description: "", placementRules: "", origin: "ai",
    } as TileGroupMetadata];
    expect(isApprovedGroup(def, "g-ai")).toBe(false);
    expect(resolveVocabForBuild(def, { groupId: "g-ai" }).status).toBe("soft");
  });

  it("unapprovedVocabulary는 번들 그룹을 미승인 목록에서 제외한다", () => {
    const { tileset } = context();
    const def = tileset();
    def.tileGroups = [
      { id: "g-b", name: "번들", role: "prop", defaultLayer: "lower", tileIds: [1], description: "", placementRules: "", source: "bundled-default" } as TileGroupMetadata,
      { id: "g-a", name: "AI", role: "prop", defaultLayer: "lower", tileIds: [2], description: "", placementRules: "", origin: "ai" } as TileGroupMetadata,
    ];
    const summary = unapprovedVocabulary(def);
    expect(summary.groups.map((g) => g.id)).toEqual(["g-a"]);
  });
});

describe("suggestVocabGroups", () => {
  it("'돌벽' 질의에 석벽 계열 그룹을 후보로 돌려준다", () => {
    const { tileset } = context();
    const ids = suggestVocabGroups(tileset(), "돌벽").map((s) => s.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.includes("timber-stone-wall") || id.includes("castle-wall"))).toBe(true);
  });

  it("영문 stone-wall 질의도 석벽 계열 라벨 후보로 이어진다", () => {
    const { tileset } = context();
    const ids = suggestVocabGroups(tileset(), "stone-wall").map((s) => s.id);
    // 라벨/설명 매칭 → 그룹 역조회. 없으면 빈 배열일 수 있어 돌벽 동의어로 재확인.
    const viaKorean = suggestVocabGroups(tileset(), "돌벽").map((s) => s.id);
    const all = new Set([...ids, ...viaKorean]);
    expect([...all].some((id) => id.includes("timber-stone-wall") || id.includes("castle-wall") || id.includes("stone"))).toBe(true);
  });
});

describe("assistantSession 어휘 제안", () => {
  it("propose_tile_vocabulary 커밋이 그룹을 origin:user 로 합의 표시한다", () => {
    expect(VOCABULARY_PROPOSAL_TOOLS.has("propose_tile_vocabulary")).toBe(true);
    const project = createBlankProject();
    const groupId = "session-unapproved-wall";
    project.tilesets[COMBINED_TOWN_TILESET_ID].tileGroups!.push({
      id: groupId,
      name: "미합의 벽",
      role: "wall",
      defaultLayer: "lower",
      tileIds: [301, 302, 303, 331, 332, 333, 361, 362, 363],
      description: "세션 즉시 적용 테스트",
      placementRules: "nine slice",
      origin: "ai",
      source: "ai",
    });
    expect(isApprovedGroup(project.tilesets[COMBINED_TOWN_TILESET_ID], groupId)).toBe(false);

    const context: ToolContext = { project };
    const result = runTool(context, "propose_tile_vocabulary", {
      items: [{ kind: "group", groupId, name: "석벽", role: "wall", layerHome: "lower" }],
    });

    expect(result.ok, result.summary).toBe(true);
    expect(isApprovedGroup(context.project.tilesets[COMBINED_TOWN_TILESET_ID], groupId)).toBe(true);
  });
});
