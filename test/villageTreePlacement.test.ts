import { describe, expect, it } from "vitest";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { repairTreePairsOnProject } from "@/project/lint/repairTreePairs";
import { startOnRetiredCombinedTown } from "./support/retiredEasyRpgTilesets";

// 이 시험의 칸 번호(벽 76 · 울타리 409 · 밑동 290 · 수관 260 · TILE.GRASS)와 재료 낱말 «침엽수» 는 합본 마을(combined_town) 칩셋의 것이다.
// 2026-09-30 부터 새 프로젝트의 기본 칩셋은 버들항(beodeul_city)이고 합본 마을 정의는 2026-10-07 정리로 새 프로젝트에서 빠졌다 —
// 버들항의 나무는 구조 킷(stamp_object)이라 «침엽수» 라벨 타일이 없고 76·409 도 벽·울타리가 아니다. 그래서 열 경우가 모두
// material-not-found 로 끝났다(공개 기준선 0d4f13e7c 부터). 옛 저장본처럼 시작 맵을 합본 마을 위에 놓고 본다(#3560 이 같은 갈래 시험들을 옮긴 방식).
const combinedTownProject = () => startOnRetiredCombinedTown(createBlankProject());

// A single candidate proves rejection happens before either half is written.
// No runner rollback or cleanup can conceal a partial tree here.
describe.each(["natural", "dense"] as const)("tree footprint eligibility (%s)", (packing) => {
  it.each(["canopy over wall", "trunk over fence", "recorded stacked house", "recorded empty house"])("rejects the whole object: %s", (obstacle) => {
    const project = combinedTownProject();
    const map = project.maps.map_blank_start;
    const top = 3 * map.width + 3;
    const bottom = top + map.width;
    if (obstacle === "canopy over wall") map.lowerTiles[top] = 76;
    if (obstacle === "trunk over fence") map.upperTiles[bottom] = 409;
    if (obstacle === "recorded stacked house") map.lowerTileStacks = { [top]: [TILE.GRASS, 76] };
    if (obstacle.startsWith("recorded")) map.layoutPlan = {
      version: 1, kind: "houses", regions: [{ id: "house", role: "house", x: 3, y: 3, w: 1, h: 1 }],
    };
    const before = structuredClone(map);
    expect(() => placePropsOnDraft(project, {
      // expandArea:false — 이 검사는 "그 자리 적격성" 이다. 기본값(확장)이면 옆 칸에 놓여 검사 뜻이 사라진다.
      mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7, packing, expandArea: false,
    })).toThrowError(expect.objectContaining({ code: "placement-zero" }));
    expect(map).toEqual(before);
    expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
  });

  it("keeps legitimate canopy-over-trunk forest overlap", () => {
    const project = combinedTownProject();
    const map = project.maps.map_blank_start;
    const top = 3 * map.width + 3;
    map.lowerTiles[top] = 290;
    map.upperTiles[top - map.width] = 260;
    const result = placePropsOnDraft(project, {
      mapId: map.id, area: { x: 3, y: 3, w: 1, h: 2 }, material: "침엽수", count: 1, seed: 7, packing,
    });
    expect(result.data).toMatchObject({ placed: 1 });
    expect(map.lowerTiles[top]).toBe(290);
    expect(map.upperTiles[top]).toBe(260);
    expect(map.lowerTiles[top + map.width]).toBe(290);
    expect(repairTreePairsOnProject(project)).toEqual({ canopiesPlaced: 0, orphanTrunksRemoved: 0 });
  });
});
