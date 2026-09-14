import type { VillageLayoutPresetRecord } from "../../src/project/types/village";

/** User-authored small-village contract. Publication is explicit; never a global engine default. */
export function smallVillageDefinition(objectIds: readonly string[], width = 76, height = 76): VillageLayoutPresetRecord {
  return {
    id: "small-village-dense", name: "소규모 마을 · 밀집 주택과 호수 장터", houseCount: 26,
    pathStyle: "dirt", roadWidth: 2, roadNaturalness: 0.55, settlementLayout: "clusters",
    yardStyle: "garden", plazaStyle: "market", plazaLayout: "center", edgeTrees: "dense", groundTheme: "grass", npcCount: 0,
    note: "소규모 마을의 정본. 집 26채 중 1층 23채·2층 이상 3채(큰집 포함). 큰집은 2채 이하·최대 15×15. 가까운 주택군과 좁은 골목, 통나무 벽 제외, 비대칭 호수·장터·숲·243 계열 풀밭. 중규모 마을·도시는 별도 설계서를 사용한다. 실내·주민 저작은 별도 단계.",
    design: {
      version: 1, revision: 1,
      policies: { appearance: "fixed", layout: "fixed", nature: "fixed", residents: "fixed", interior: "fixed" },
      houseCount: { mode: "fixed", min: 26, max: 26 }, stories: [1, 2], interior: false,
      objectVillage: { composition: "compact", objectIds: [...objectIds], multiStoreyCount: 3, clustering: "tight", previewSize: { width, height } },
      nature: { water: "lake", waterSide: "east", forest: "dense", forestSide: "west", riverWidthRatio: 0.12, lakeSizeRatio: 0.28, forestDepthRatio: 0.14 },
    },
  };
}
