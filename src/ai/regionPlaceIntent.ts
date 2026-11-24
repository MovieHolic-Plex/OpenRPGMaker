// ai/regionPlaceIntent.ts
// 영역 지시 문장 → 장소 레시피 종류(build_region_place 의 kind). 범위 노트(intentDeclaration)·도구·능력 표가 같은 표를 쓴다.
export type RegionPlaceKind =
  | "shop" | "weapon_shop" | "smithy" | "inn" | "tavern" | "house" | "chapel" | "bakery" | "pharmacy"
  | "dungeon_entrance" | "cave_entrance";

const RULES: readonly (readonly [RegExp, RegionPlaceKind])[] = [
  [/던전|지하묘지|카타콤|미궁입구|지하감옥/, "dungeon_entrance"],
  [/동굴|광산입구|굴입구/, "cave_entrance"],
  [/무기점|무기상|방어구점|갑옷가게/, "weapon_shop"],
  [/대장간|대장장이/, "smithy"],
  [/여관|숙소|여인숙|객잔|민박/, "inn"],
  [/주점|술집|선술집|주막/, "tavern"],
  [/교회|성당|예배당|신전/, "chapel"],
  [/빵집|제과점|베이커리/, "bakery"],
  [/약방|약국|약초상|약재상/, "pharmacy"],
  [/상점|가게|도구점|잡화점|만물상|상회|매점/, "shop"],
  [/(?:^|[^빵모])집|주택|민가|오두막|살림집/, "house"],
];

const BUILD_VERB = /만들|지어|짓|세워|세우|놓아|넣어|추가|생기게|하나/;

/** 문장에 나온 장소 종류. 맞는 것이 없으면 null. */
export function regionPlaceKindFromText(text: string): RegionPlaceKind | null {
  const flat = text.replace(/\s+/g, "");
  for (const [pattern, kind] of RULES) if (pattern.test(flat)) return kind;
  return null;
}

/** 「여기 상점 만들어 줘」처럼 장소를 짓는 지시면 그 종류. 장소 낱말만 있고 짓는 말이 없으면(「상점 앞에 나무」) null. */
export function regionPlaceRequest(text: string): RegionPlaceKind | null {
  const kind = regionPlaceKindFromText(text);
  return kind && BUILD_VERB.test(text.replace(/\s+/g, "")) ? kind : null;
}
