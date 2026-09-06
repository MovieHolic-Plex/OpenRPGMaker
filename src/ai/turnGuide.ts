// ai/turnGuide.ts
// 현재 맵 타일셋의 **재료 라벨 예시**(사실) — 조수 footer 와 영역 작업 메시지가 함께 쓴다.
//
// 예전에는 여기서 「도구 규칙」 가이드 17줄을 조립해 사용자 문장 뒤에 붙였고, 그 기계 텍스트를 되묻기·플래너
// 스킵·툴 노출 스캔이 사용자 발화로 읽어 라우팅이 어긋났다(2026-09-03 의도 라우터 감사). 규칙은 이제 각 툴의
// 설명에 있고(툴이 노출되면 규칙도 함께 보인다), 뜻은 의도 선언(intentDeclaration)이 정한다.
import { BUILD_PALETTE_GROUP_IDS } from "@/editor/regionTask/buildPaletteTileGroups";
import { isBagGroupId, isBagMaterialQuery } from "@/project/materialPolicy";
import { COMBINED_TOWN_HARNESS_PREFIX } from "@/project/tilesetHarness/combinedTownGroups";
import type { TilesetDef } from "@/project/types";

/** 장식 박스 전용 그룹 참조(엔진 내부). 시공 public contract 는 material 라벨만. */
export const PROP_VOCAB = {
  woodBox: `${COMBINED_TOWN_HARNESS_PREFIX}wood-box`,
  fruitBox: `${COMBINED_TOWN_HARNESS_PREFIX}fruit-box`,
} as const;

export function formatMaterialLabelHint(tileset: TilesetDef | undefined): string {
  if (!tileset) {
    return `- 소품 재료: (타일셋 없음) tile_query ask:"labels" — 예: "침엽수", "나무 상자", "과일박스" (가방·그룹 id 금지)`;
  }
  // 구체 소품 우선. 마을 소품(small-props) 가방은 시공 material 후보에서 제외.
  const preferred = [
    BUILD_PALETTE_GROUP_IDS.tree,
    PROP_VOCAB.woodBox,
    PROP_VOCAB.fruitBox,
    BUILD_PALETTE_GROUP_IDS.path,
    BUILD_PALETTE_GROUP_IDS.water,
  ];
  const groups = tileset.tileGroups ?? [];
  const preferredFound = preferred
    .map((id) => groups.find((group) => group.id === id))
    .filter((group): group is NonNullable<typeof group> => group != null && !isBagGroupId(group.id));
  const propish = groups.filter((group) => {
    if (isBagGroupId(group.id) || isBagMaterialQuery(group.name)) return false;
    return (
      group.role === "prop" || group.role === "terrain" || group.role === "water" || group.role === "fence"
      || /tree|bush|flower|fence|path|water|road|box/i.test(group.id)
    );
  });
  const ordered = [
    ...preferredFound,
    ...propish.filter((group) => !preferred.includes(group.id)),
  ];
  const unique = [...new Map(ordered.map((group) => [group.id, group])).values()].slice(0, 10);
  if (unique.length === 0) {
    return `- 소품 재료: tile_query ask:"labels" 로 라벨/설명을 찾아 place_props material 에 넣기 (가방·그룹 id 금지)`;
  }
  const list = unique.map((group) => `${group.name}(${group.role})`).join(", ");
  return `- 소품·지형 material 라벨 예(place_props/fill_region — 가방·그룹 id 금지, 미합의는 목업 확인): ${list}`;
}
