/** Roof contours transcribed from the user's identified 정주지 reference.
 * Source project: rpg-zzu-region-reference-walled-settlement-v1, map_reference_gabled_houses_20260913.
 * Only building cells are retained; foliage, flags, props and log walls are removed.
 * Door tiles are normalized onto lower with explicit exterior approach anchors.
 */
import type { CompactVillageHouse } from "./compactVillageHouses.mts";
const RECIPES = [
  { id: "front-gable", name: "정주지 · 앞박공 회벽집", width: 8, height: 9,
    doors: [{"x":3,"y":8}], rows: [
      {"tiles":[-1,374,374,374,374,374,374,-1],"upperTiles":[354,-1,-1,-1,-1,-1,-1,355]},
      {"tiles":[376,375,375,375,375,375,375,377],"upperTiles":[-1,-1,-1,354,355,-1,-1,-1]},
      {"tiles":[405,405,376,376,377,377,405,405],"upperTiles":[-1,-1,354,-1,-1,355,-1,-1]},
      {"tiles":[15,17,376,376,377,377,15,17],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[45,47,376,46,46,377,45,47],"upperTiles":[-1,85,-1,384,385,-1,85,-1]},
      {"tiles":[75,77,46,46,46,46,75,77],"upperTiles":[-1,-1,384,85,-1,385,-1,-1]},
      {"tiles":[-1,-1,15,16,16,17,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,45,116,46,47,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,75,146,76,77,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
    ] },
  { id: "long-front-gable", name: "정주지 · 깊은 앞박공 돌집", width: 8, height: 11,
    doors: [{"x":3,"y":10}], rows: [
      {"tiles":[-1,436,436,436,436,436,436,-1],"upperTiles":[356,-1,-1,-1,-1,-1,-1,357]},
      {"tiles":[437,437,437,437,437,437,437,437],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[437,437,437,437,437,437,437,437],"upperTiles":[-1,-1,-1,356,357,-1,-1,-1]},
      {"tiles":[437,437,406,406,407,407,437,437],"upperTiles":[-1,-1,356,-1,-1,357,-1,-1]},
      {"tiles":[467,467,406,406,407,407,467,467],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[12,14,406,406,407,407,12,14],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[42,44,406,43,43,407,42,44],"upperTiles":[-1,85,-1,386,387,-1,85,-1]},
      {"tiles":[72,74,43,43,43,43,72,74],"upperTiles":[-1,-1,386,85,-1,387,-1,-1]},
      {"tiles":[-1,-1,12,13,13,14,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,42,116,43,44,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,72,146,73,74,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
    ] },
  { id: "steep-gable", name: "정주지 · 가파른 박공 회벽집", width: 8, height: 11,
    doors: [{"x":3,"y":10}], rows: [
      {"tiles":[-1,-1,-1,-1,-1,-1,-1,-1],"upperTiles":[-1,-1,-1,356,357,-1,-1,-1]},
      {"tiles":[-1,-1,-1,406,407,-1,-1,-1],"upperTiles":[-1,-1,356,-1,-1,357,-1,-1]},
      {"tiles":[-1,-1,406,406,407,407,-1,-1],"upperTiles":[-1,356,-1,-1,-1,-1,357,-1]},
      {"tiles":[-1,406,406,406,407,407,407,-1],"upperTiles":[356,-1,-1,-1,-1,-1,-1,357]},
      {"tiles":[406,406,406,406,407,407,407,407],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[406,406,406,406,407,407,407,407],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[15,16,406,46,46,407,16,17],"upperTiles":[-1,-1,-1,386,387,-1,-1,-1]},
      {"tiles":[45,46,46,46,46,46,46,47],"upperTiles":[-1,-1,386,85,-1,387,-1,-1]},
      {"tiles":[75,76,45,46,46,47,76,77],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,45,116,46,47,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,75,146,76,77,-1,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1]},
    ] },
  { id: "twin-gable", name: "정주지 · 쌍박공 회벽집", width: 11, height: 9,
    doors: [{"x":7,"y":8}], rows: [
      {"tiles":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1],"upperTiles":[-1,-1,356,357,-1,-1,-1,356,357,-1,-1]},
      {"tiles":[-1,-1,406,407,-1,-1,-1,406,407,-1,-1],"upperTiles":[-1,356,-1,-1,357,-1,356,-1,-1,357,-1]},
      {"tiles":[-1,406,406,407,407,407,406,406,407,407,-1],"upperTiles":[356,-1,-1,-1,-1,356,-1,-1,-1,-1,357]},
      {"tiles":[406,406,46,46,407,406,406,406,407,407,407],"upperTiles":[-1,-1,386,387,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[406,46,46,46,46,406,406,46,46,407,407],"upperTiles":[-1,386,85,-1,387,-1,-1,386,387,-1,-1]},
      {"tiles":[15,16,16,16,16,16,46,46,46,46,17],"upperTiles":[-1,-1,-1,-1,-1,-1,386,85,-1,387,-1]},
      {"tiles":[45,46,46,46,46,46,45,46,46,47,47],"upperTiles":[-1,-1,87,-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[75,76,76,76,76,76,45,116,46,47,77],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]},
      {"tiles":[-1,-1,-1,-1,-1,-1,75,146,76,77,-1],"upperTiles":[-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]},
    ] },
];
export function buildSettlementReferenceHouses(): CompactVillageHouse[] {
  return RECIPES.map(r => ({
    id: "settlement-" + r.id, name: r.name, kind: r.width > 10 || r.height > 10 ? "landmark" : "home",
    exteriorStories: 2, doors: structuredClone(r.doors),
    kit: { id: "settlement-reference-" + r.id, kind: "section", name: r.name, width: r.width, height: r.height,
      rows: structuredClone(r.rows), learnedFrom: "db-authored",
      parts: r.doors.map((d,i) => ({ id: "door-" + (i+1), kind: "entrance", dx: d.x, dy: d.y-1, w: 1, h: 2 })),
      ai: { tags: ["집", "정주지 참고", "박공", "2층 외형", "회벽·석벽"], role: "structure", layerHome: "perCell", repeatability: "fixed",
        description: "본채와 이어지는 앞박공·쌍박공. 통나무 벽과 주변 소품을 제외한 건물 외형.", placementRules: "문 앞에서 남쪽 바깥까지 접근로를 확보한다." } }
  }));
}
