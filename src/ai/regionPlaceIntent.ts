// ai/regionPlaceIntent.ts
// 영역 지시 문장 → 장소 레시피 종류(build_region_place 의 kind). 범위 노트(intentDeclaration)·도구·능력 표가 같은 표를 쓴다.
export type RegionPlaceKind =
  | "shop" | "weapon_shop" | "smithy" | "inn" | "tavern" | "house" | "chapel" | "bakery" | "pharmacy"
  | "warehouse" | "stable" | "school" | "guard_post" | "windmill" | "lighthouse"
  | "bridge" | "gate" | "farm" | "market" | "forest"
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
  [/창고|곡간|헛간/, "warehouse"],
  [/마구간|외양간|마차고/, "stable"],
  [/학교|서당|학당|교실|학원/, "school"],
  [/초소|경비소|초막|병영|검문소/, "guard_post"],
  [/풍차|방앗간/, "windmill"],
  [/등대/, "lighthouse"],
  [/성문|성문루|관문|성벽/, "gate"],
  // 「사다리」는 다리가 아니다. 「텃밭·꽃밭 놓아 줘」·「노점 놓아 줘」는 소품 하나라 농장·시장 통짜 레시피로 보내지 않는다.
  [/(?:^|[^사])다리|교량/, "bridge"],
  [/농장|포도원|과수원|농사|(?:^|[^꽃텃])밭/, "farm"],
  [/시장|장터|장마당/, "market"],
  // 「나무 심어 줘」 는 나무 한두 그루라 장소가 아니다 — 숲·수풀·숲속만 숲 레시피로.
  [/숲|수풀|삼림/, "forest"],
  [/상점|가게|도구점|잡화점|만물상|상회|매점/, "shop"],
  [/(?:^|[^빵모])집|주택|민가|오두막|살림집/, "house"],
];

/** 결과 카드 「고치기」 가 보내는 지시의 머리 — 경고 글에 장소 낱말·짓는 말이 있어도 장소를 다시 짓는 지시가 아니다. */
export const REGION_FIX_PREFIX = "[고치기]";

const BUILD_VERB = /만들|지어|짓|세워|세우|놓아|넣어|추가|생기게|하나/;

/** 문장에 나온 장소 종류. 맞는 것이 없으면 null. */
export function regionPlaceKindFromText(text: string): RegionPlaceKind | null {
  const flat = text.replace(/\s+/g, "");
  for (const [pattern, kind] of RULES) if (pattern.test(flat)) return kind;
  return null;
}

/** 「여기 상점 만들어 줘」처럼 장소를 짓는 지시면 그 종류. 장소 낱말만 있고 짓는 말이 없으면(「상점 앞에 나무」) null. */
export function regionPlaceRequest(text: string): RegionPlaceKind | null {
  if (text.trimStart().startsWith(REGION_FIX_PREFIX)) return null;
  const kind = regionPlaceKindFromText(text);
  return kind && BUILD_VERB.test(text.replace(/\s+/g, "")) ? kind : null;
}
