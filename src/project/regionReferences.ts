import { DIVERSE_VILLAGE_PLACES, DIVERSE_VILLAGE_REGIONS } from "./diverseVillageReferences";
import { sharedRegionReferences } from './sharedSpatialReferences';
import { CASTLE_PLACE_REFERENCES } from "./castlePlaceReferences";
import { FOREST_PLACE_REFERENCES } from "./forestPlaceReferences";
import { SHIP_PLACE_REFERENCES } from "./shipPlaceReferences";
import { FANTASY_PLACE_REFERENCES } from "./fantasyPlaceReferences";
import { RPG_INTERIOR_PLACE_REFERENCES } from "./rpgInteriorPlaceReferences";
import { RPG_DUNGEON_PLACE_REFERENCES } from "./rpgDungeonPlaceReferences";
import { CLIMATE_VILLAGE_PLACE_REFERENCES } from "./climateVillagePlaceReferences";
import { FIELD_ROUTE_PLACE_REFERENCES } from "./fieldRoutePlaceReferences";
import { ELF_TREETOP_PLACE_REFERENCES } from "./elfTreetopPlaceReferences";
import { JOSEON_PLACE_REFERENCES } from "./joseonPlaceReferences";
import { REFERENCE_HOUSE_FORM_DEFS } from "./defaults/referenceHouseFormCatalog";

/** Fixed authored examples, independent of procedural RegionDesign and the active project. */
export const REGION_REFERENCES = [
  // 완성 맵 사례 — 실제 저장본에서 온 읽기 전용 자료만 배송한다. 지형 어휘 더미는 내지 않는다.
  // LAKE_PLACE_REFERENCES 가 REGION_REFERENCES[2](호수마을)를 원본으로 삼으므로
  // 기존 네 사례의 순서·인덱스를 유지하고, 새 사례는 배열 뒤에 추가한다.
  {
  id: "walled-settlement-43x45", name: "성벽으로 둘러싸인 정주지", kind: "completed-map" as const, regionKind: "settlement" as const,
  revision: 1, width: 43, height: 45, tilesetId: "easyrpg_chipset_combined_town",
  preview: "/assets/region-references/walled-settlement.png",
  sourceProjectId: "rpg-zzu-reference-houses-20260913-6890",
  sourceMapId: "map_reference_gabled_houses_20260913",
  snapshotProjectId: "rpg-zzu-region-reference-walled-settlement-v1",
  rules: [
    "성벽의 수직 벽면은 3칸. 난간·보행로는 별도이며 동쪽 계단으로 접근한다.",
    "집의 삼각 박공 아래 기본 벽 높이는 3칸. 위쪽 두 집은 ㅜ자 돌출 구조다.",
    "지붕 접합부의 빈 칸을 채우고 경사와 벽의 끝기둥을 연결한다. 여관은 두 봉우리다.",
    "성문 입구와 마을 길은 모래길. 성벽 보행로·쉼터·우물 주변은 일반 판석이다.",
    "과일상자는 마을 상단에 모으고 텃밭·풀숲·덩굴로 꾸민다. 문 앞과 계단 동선은 비운다.",
    "중앙 길 옆에 우물과 물통, 성문 양옆에 횃불, 여관 옆에 장작과 항아리를 둔다.",
  ],
  limitations: "완성 맵 참고 사례. 생성 프리셋이나 배치 명령이 아니다. 실내·우물 상호작용은 포함하지 않는다.",
}, {
  id: "castle-town-100x100", name: "왕궁이 있는 이중 성벽 도시", kind: "completed-map" as const, regionKind: "settlement" as const,
  revision: 1, width: 100, height: 100, tilesetId: "easyrpg_chipset_combined_town",
  preview: "/assets/region-references/castle-town.png",
  sourceProjectId: "rpg-zzu-castle-town-100-20260913-6890",
  sourceMapId: "map_castle_town_100",
  snapshotProjectId: "rpg-zzu-region-reference-castle-town-v1",
  rules: [
    "100×100 도시. 북쪽에 강이 흐르고, 외성과 내성을 떨어뜨려 배치한다. 각 성벽은 남쪽 문만 개방한다.",
    "외성·내성 각각 왼쪽 아래와 오른쪽 아래에 원형 탑 두 개를 둔다. 계단은 성벽 위 보행로에 연결한다.",
    "중앙 왕궁은 3층 외관으로 북쪽 성벽 위로 솟는다. 층별 창과 이어지는 지붕·처마로 높이를 표현한다.",
    "내성은 석재 마당 중심이며 작은 정원 두 곳에 나무·꽃·벤치를 모은다.",
    "남문에서 이어지는 중앙 대로는 5칸. 주택가의 가지 길과 북쪽 통로는 테두리가 이어지는 포장으로 구분한다.",
    "작은 회벽 주택 34채를 불규칙하게 배치하고 박공·가로 지붕·돌출형을 섞는다. 통나무 벽은 쓰지 않는다.",
    "사용자가 최종 수정한 길·정원·궁전 입구·지붕 배치를 그대로 동결한 참고 자료다.",
  ],
  limitations: "외관 배치 참고 사례. 궁전 3개 층의 실내 맵과 상호작용은 포함하지 않는다. 사용자 최종 수정 이후의 플레이 검증은 별도다.",
}, {
  id: "lake-village-60x60", name: "숲과 선착장이 있는 호수마을", kind: "completed-map" as const, regionKind: "settlement" as const,
  revision: 1, width: 60, height: 60, tilesetId: "easyrpg_chipset_combined_town",
  preview: "/assets/region-references/lake-village.png",
  sourceProjectId: "rpg-zzu-lake-village-60-20260913-6890", sourceMapId: "map_lake_village_60",
  snapshotProjectId: "rpg-zzu-region-reference-lake-village-v1",
  rules: ["호숫가를 도는 모래길과 작은 집 13채. 선착장 앞은 짐을 놓는 넓은 공터다.",
    "2×2 활엽수와 1×2 나무를 섞고, 하층 줄기 위로 상층 수관을 대각으로 겹친다.",
    "울타리 마당·텃밭·우물 쉼터를 배치하고 소품은 작업과 생활 공간별로 모은다.",
    "키 큰 풀은 숲과 물가에 불규칙하게 모으며 마른 나무는 드물게 둔다. 선착장 양끝에 사다리가 있다."],
  limitations: "외관 참고 사례. 실내·낚시·수영·NPC 상호작용은 포함하지 않는다.",
}, {
  id: "river-forest-village-78x44", name: "강변 숲마을", kind: "completed-map" as const, regionKind: "settlement" as const,
  revision: 1, width: 78, height: 44, tilesetId: "forest_harmony",
  preview: "/assets/region-references/river-forest-village.png",
  tilesetPreview: "/assets/region-references/river-forest-village-atlas.png",
  projectDownload: "/assets/region-references/river-forest-village.oprn.json",
  sourceProjectId: "original-grove-trunks-20260921-76a3-1789965905810", sourceMapId: "restored_river",
  snapshotProjectId: "oprn-region-river-forest-village-v1",
  rules: [
    "중앙의 굽은 강과 다리 양쪽에 집 8채를 배치하고 집 앞길을 강둑 길에 연결한다.",
    "외곽 숲은 크고 작은 굴곡을 이어 공터를 감싼다. 몸통·뿌리는 굽이숲의 기존 3행 조립과 끝마감을 유지한다.",
    "화단·장작과 통·야외 탁자·수확 상자·쉼터·숲 가장자리 꽃덤불을 생활 공간에 모으고 출입 동선을 비운다.",
    "숲마을 · 거리별 잔디 칩셋을 사용한다. 시장이나 마을 외곽 울타리는 두지 않는다.",
    "사용자가 승인한 저장본을 보존한다. 내려받는 문서에는 연결된 실내 9개와 기존 출입·주민 이벤트를 포함한다.",
  ],
  limitations: "완성 마을 참고 사례. 자동 생성 프리셋이 아니다. 집 앞길 8곳의 연결을 확인했으며 게임 전체 플레이 검증은 별도다.",
}, ...DIVERSE_VILLAGE_REGIONS] as const;

export const LAKE_PLACE_REFERENCES = [
  { id: "lake-pier-workyard", name: "호숫가 선착장 작업터", x: 29, y: 33, width: 14, height: 13,
    rules: ["T자 선착장과 양끝 사다리. 진입 공터의 상자·통은 가운데 통로를 비우고 옆으로 모은다."] },
  { id: "lake-well-rest", name: "호수마을 우물 쉼터", x: 20, y: 35, width: 10, height: 11,
    rules: ["우물은 돌바닥 위에 놓고 벤치와 호숫길을 연결한다."] },
  { id: "lake-cottage-garden", name: "덩굴집과 텃밭 마당", x: 3, y: 30, width: 13, height: 13,
    rules: ["회벽 집 옆에 작은 텃밭과 과일상자를 모으고 덩굴과 나무로 마당을 구분한다."] },
].map(place => ({ ...REGION_REFERENCES[2], ...place, kind: "completed-place" as const,
  preview: `/assets/region-references/${place.id}.png`,
  limitations: "호수마을 저장본에서 추출한 읽기 전용 배치 사례. 이벤트는 포함하지 않는다." }));


/** Shipped place examples remain visible even in a new, empty project. */
export const PLACE_REFERENCES = [...LAKE_PLACE_REFERENCES, ...SHIP_PLACE_REFERENCES, ...FOREST_PLACE_REFERENCES, ...CASTLE_PLACE_REFERENCES, ...FANTASY_PLACE_REFERENCES, ...RPG_INTERIOR_PLACE_REFERENCES, ...RPG_DUNGEON_PLACE_REFERENCES, ...CLIMATE_VILLAGE_PLACE_REFERENCES, ...FIELD_ROUTE_PLACE_REFERENCES, ...ELF_TREETOP_PLACE_REFERENCES, ...JOSEON_PLACE_REFERENCES, {
  id: "emerald-basin-80x64", name: "비취 대계곡", kind: "completed-place" as const,
  placeKind: "natural" as const, revision: 1, x: 0, y: 0, width: 80, height: 64,
  tilesetId: "tileset_emerald_basin_20260914",
  preview: "/assets/region-references/emerald-basin.png",
  tilesetPreview: "/assets/region-references/emerald-basin-atlas.png",
  sourceProjectId: "rpg-zzu-house-template-gallery", sourceMapId: "map_field_emerald_basin_20260914",
  rules: [
    "쌍폭포에서 시작된 강이 굽어 흐르고 지류와 합류한다. 다리는 양쪽 강둑과 길을 잇는다.",
    "대각 절벽의 윗선과 아랫선을 연결하고, 계단 높이를 해당 절벽 높이에 맞춘다.",
    "서쪽·동쪽·남쪽 길을 맵 끝까지 연결해 다음 맵으로 이어질 자리를 남긴다.",
    "활엽수·침엽수·관목은 군락으로 모으고 다리 입구와 계단 동선은 비운다.",
  ],
  limitations: "완성 필드 배치 참고 사례. 프로젝트와 관계없이 표시된다. 자동 생성·현재 맵 배치 기능은 포함하지 않는다.",
}, {
  // 2026-09-18: 혼합 칩셋(합본 마을+레트로 월드맵+숲 나무) 위에 시공기가 결정적으로 만든 괴촌·언덕 마을.
  // 재생성: scripts/author-hill-forest-village-reference.mts (씨앗 7). 집 문 이벤트는 실내 맵이 없어 뺐다.
  id: "hill-forest-village-64x64", name: "언덕 위 숲마을", kind: "completed-place" as const,
  placeKind: "settlement" as const, revision: 1, x: 0, y: 0, width: 64, height: 64,
  tilesetId: "easyrpg_chipset_combined_town_retro_world",
  preview: "/assets/region-references/hill-forest-village.png",
  tilesetPreview: "/assets/easyrpg-chipset-combined-town-retro-world-transparent.png",
  sourceProjectId: "oprn-hill-forest-village-reference-20260918", sourceMapId: "map_hill_forest_village_20260918",
  rules: [
    "괴촌(Haufendorf): 큰길 하나에서 막다른 골목이 갈라지고 집 10채가 골목마다 붙는다. 문 앞은 모두 길에 닿는다.",
    "언덕은 대지 윗선(139)·가장자리 테(78/79/80/108/110)·암벽 면(172→202)·45° 대각(18/19/48/49)으로 두르고, 큰길만 띠를 지난다. 둔덕 위에 2단 둔덕이 겹친다.",
    "나무는 숲 나무 확장 띠(960~)다 — 큰 참나무 4×5, 활엽수 3×4, 짙은 나무 2×4, 덤불 3×3·2×2. 수관은 상위 레이어, 밑동은 하위+잔디 받침.",
    "동쪽 숲 띠는 숲 벽 10×6·숲 기둥 4×6 덩이를 격자로 깔고 남은 자리에 나무를 흩뿌린다. 마을에서 멀수록 큰 나무가 잦다.",
    "밭·과수원·풀밭과 산울타리 덤불(289)은 필지 바깥에 두고, 과수원 나무는 합본 마을 2×2 활엽수 그대로다.",
  ],
  limitations: "시공기 출력 그대로의 참고 사례(씨앗 7). 실내 맵과 집 문 이벤트는 포함하지 않는다. 주민 12명은 배치만 있고 대사는 없다.",
}, {
  // 2026-09-24: 숲마을 칩셋 + 설계도 방식 생성 건물 29종(god-tibo-imagen, 검사기 통과작만)·칩셋에 없는 소품만 손 도트.
  // 재생성: scripts/asset-gen/forest-harmony-buildings/ (author_village2 → hand_props --install → author_village2 → publish_place).
  id: "forest-fantasy-town-104x96", name: "개울 건너 숲성 마을", kind: "completed-place" as const,
  placeKind: "settlement" as const, revision: 2, x: 0, y: 0, width: 104, height: 96,
  tilesetId: "forest_harmony_fantasy_town",
  preview: "/assets/region-references/forest-fantasy-town.png",
  tilesetPreview: "/assets/forest-harmony/fantasy-town-buildings.png",
  sourceProjectId: "oprn-forest-fantasy-town-reference-20260924", sourceMapId: "oprn-forest-fantasy-town",
  rules: [
    "판타지 중세 숲성 마을. 5칸 절벽 윗단에 영주 저택·예배당과 묘지·마법사의 탑, 강 건너 윗단에 룬석 고리. 윗단과 아랫마을은 계단 둘로만 잇는다.",
    "북쪽 숲에서 온 개울이 절벽을 폭포로 넘어 아랫마을을 비스듬히 가로지른다. 다리 둘, 물레방앗간은 물가에 붙는다. 갈대는 물 쪽 끝에 붙은 그림을 두세 칸 무리로.",
    "아랫마을은 나무 울타리 고리로 두르고 남쪽 정문 문루(지나다니는 아치)·모퉁이 망루 둘. 광장과 남북 큰길은 포석, 골목은 흙길 2칸.",
    "구역: 포석 광장(우물·석상·노점), 모험가 길드, 대장간, 여관, 울타리 목장(양·소), 밭 두 뙈기와 허수아비, 풍차, 닭장, 쌓은 짚단과 건초 수레.",
    "건물은 숲마을 칩셋 뒤(2730~)에 tileGrafts 로 붙은 생성 시트 칸이다. 통행은 설계도가 정했다. 입구 (51,95)에서 문 39곳이 모두 닿는다. 빈칸 게이트 통과(최대 빈 정사각 4칸, 한 화면 빈 잔디 38%).",
    "건물 21채는 전부 「생성형 이미지」(god-tibo-imagen, 설계도 검사 통과작)다: 3층 대저택·예배당·마법사의 탑·여관·모험가 길드·잡화점·대장간·물레방앗간·풍차·정문 문루·망루·곳간·닭장·집 여러 채. 첫 쪽(row 0)의 buildings 에 이름·자리·문, kits 에 킷 id·크기·출처가 있고, 같은 이름의 structureKits(fft-…)로 통째 찍을 수 있다. 소품 중 건초 수레·짚단·버섯·갈대·들꽃 변형은 「손 도트」.",
    "키큰 풀은 E/F/G 규칙(#1421)으로 정리했다 — 집·길 곁이라 대부분 G(짧음), 숲 곁 몇 덩이만 E.",
  ],
  limitations: "배치 참고 사례. 실내 맵과 문 이동은 포함하지 않는다. 주민 16명·동물 10마리는 배치와 한 줄 대사만 있다. 물레방아·풍차 날개는 정지 그림이다.",
}, ...DIVERSE_VILLAGE_PLACES];


export function regionReference(id: string) {
  return [...REGION_REFERENCES, ...PLACE_REFERENCES, ...sharedRegionReferences()].find(entry => entry.id === id);
}

/**
 * 참고 사례에서 저작 카탈로그로 옮겨진 집 형태 안내 — 그림만 보고 끝나지 않게, 모델이 바로 지목할
 * templateId 를 준다(2026-09-17: 정주지 4종·왕궁 도시 23종).
 */
function referenceHouseFormNote(referenceId: string): string {
  const forms = REFERENCE_HOUSE_FORM_DEFS.filter(form => form.reference?.id === referenceId);
  if (forms.length === 0) return "";
  const first = forms[0]!.id, last = forms[forms.length - 1]!.id;
  return `\n집 형태 ${forms.length}종은 저작 카탈로그에 있다(templateId ${first}~${last}) — author_house templateId 와 author_village housePlans[].templateId 로 그대로 짓고, 마을 시공기 기본 후보에도 섞인다. 폭 9 이상(${forms.filter(form => form.w > 8).map(form => form.id).join(", ") || "없음"})은 author_house 전용.`;
}

export function regionReferenceContext(): string {
  return "## 지역·장소 — 완성 맵 참고 사례\n" + [...REGION_REFERENCES, ...PLACE_REFERENCES, ...sharedRegionReferences()].map(r =>
    `- ${r.name} (${r.id}, ${r.width}×${r.height}): ${r.rules.join(" ")}\n실제 배치: read_region_reference({id:'${r.id}',row:0,rows:8}), nextRow로 이어 읽기. 그대로 맵으로 쓰려면 import_region_reference({id:'${r.id}'}) 한 번(타일셋·이식 포함).${referenceHouseFormNote(r.id)}`
  ).join("\n");
}
