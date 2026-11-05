// editor/tools/defaultItemIcon.ts
// 조수가 아이콘 없이 만든 아이템·장비에 번들 CC0 아이콘(cc0-jetrel-*, 모든 프로젝트에 있다)을 채운다.
// 스토어 아이콘 팩이 없는 프로젝트에서 아이템이 메뉴·상점·조수 카드에 빈칸으로 나오던 것(2026-11-05 리드: 「약/샘/여 글자 동그라미」)의 바닥 처리다.
// 이름·설명 낱말이 맞으면 그 그림, 아니면 종류(약·무기·방패…)의 기본 그림. 스토어 아이콘 자동 부여(autoStoreIcon) 다음에만 돈다.
import type { Project } from "@/project/types";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";

const ICON = (name: string): string => `cc0-jetrel-${name}`;

/** 이름·설명에 들어 있으면 그 그림 — 위에서부터 먼저 맞는 것. */
const WORD_ICONS: readonly (readonly [RegExp, string])[] = [
  [/엘릭서|엘릭시르|elixir/iu, "elixir"],
  [/불사조|피닉스|부활|phoenix/iu, "phoenix-down"],
  [/만병|panacea/iu, "panacea"],
  [/해독|antidote/iu, "antidote-green"],
  [/에테르|마나|마력.*(약|물약)|ether|mana/iu, "ether-blue"],
  [/하이\s*포션|고급.*(회복|물약)|큰.*(회복|물약)|hi-?potion/iu, "hi-potion"],
  [/물약|포션|회복약|potion/iu, "potion-red"],
  [/약초|허브|herb/iu, "herb-green"],
  [/빵|bread/iu, "bread"],
  [/고기|meat/iu, "meat"],
  [/사과|apple/iu, "apple"],
  [/수프|국(?![\p{L}])|\bsoup\b/iu, "soup"],
  // 한 글자 낱말은 낱말 전체일 때만(「달빛 차」·「맑은 물」). \b 는 한글을 낱말 글자로 보지 않아 한 번도 맞지 않았다(2026-11-05 실측: 「달빛 차」 → 빨간 물약).
  [/(?<![\p{L}\p{N}])차(?![\p{L}\p{N}])|홍차|녹차|\btea\b/iu, "tea"],
  [/(?<![\p{L}\p{N}])물(?![\p{L}\p{N}])|샘물|물병|\bwater\b/iu, "water-flask"],
  [/폭탄|bomb/iu, "bomb"],
  [/두루마리|스크롤|scroll/iu, "scroll"],
  [/열쇠|\bkeys?\b/iu, "old-key"],
  [/지도|\bmaps?\b/iu, "map"],
  [/편지|letter/iu, "letter"],
  [/횃불|torch/iu, "torch"],
  [/랜턴|등불|lantern/iu, "lantern"],
  [/보석|\bgems?\b|루비|ruby/iu, "gem-ruby"],
  [/수정|크리스탈|crystal/iu, "crystal"],
  [/목걸이|necklace/iu, "necklace"],
  [/반지|\brings?\b/iu, "ring"],
  [/부적|talisman|charm/iu, "talisman"],
  [/단검|대거|dagger/iu, "scout-dagger"],
  [/지팡이|스태프|staff/iu, "mage-staff"],
  [/강철.*검|steel/iu, "steel-sword"],
  [/검(?![\p{L}])|칼(?![\p{L}])|sword|blade/iu, "iron-sword"],
  [/방패|shield/iu, "iron-shield"],
  [/로브|robe/iu, "mystic-robe"],
  [/갑옷|armor|armour/iu, "leather-armor"],
  [/모자|\bhats?\b/iu, "traveler-hat"],
  [/장갑|gloves?/iu, "gloves"],
  [/장화|부츠|boots?/iu, "boots"],
  [/망토|cloak/iu, "cloak"],
];

const TYPE_ICONS: Readonly<Record<string, string>> = {
  medicine: "potion-red", weapon: "iron-sword", shield: "oak-shield", body: "leather-armor", head: "traveler-hat",
  accessory: "ring", book: "skill-book", seed: "seed-bag", special: "pearl", switch: "old-key", normalGoods: "coin-pouch",
  armor: "leather-armor", helmet: "traveler-hat",
};

export function pickDefaultItemIcon(record: { readonly name?: string; readonly description?: string }, typeOrSlot: string | undefined): string {
  return ICON(nameWordIcon(record.name) ?? nameWordIcon(record.description) ?? TYPE_ICONS[typeOrSlot ?? ""] ?? "coin-pouch");
}

const nameWordIcon = (text: string | undefined): string | undefined => (text ? WORD_ICONS.find(([pattern]) => pattern.test(text))?.[1] : undefined);

/**
 * 번들 그림이 이 이름에 «맞는가». 이름의 낱말이 그림 낱말과 맞을 때만 맞는다 — 설명에만 있는 낱말(「도시락… 약초를 곁들인」)이나
 * 종류 기본 그림(약 → 빨간 물약)은 「대신 쓴 그림」이다(2026-11-05 오너: 「나그네 도시락」 아이템과 아이콘이 맞지 않는다).
 */
export function defaultIconFitsName(name: string | undefined): boolean {
  return nameWordIcon(name) !== undefined;
}

/** 기본 그림을 붙였으면 그 id 와 이름에 맞는지(fits)를 돌려준다. 붙이지 않았으면 undefined. */
export function fillDefaultItemIcon(project: Project, record: { iconResourceId?: string; imageResourceId?: string; name?: string; description?: string }, typeOrSlot: string | undefined, label: string, warnings: string[]): { readonly id: string; readonly fits: boolean } | undefined {
  if (record.iconResourceId) return undefined;
  const id = pickDefaultItemIcon(record, typeOrSlot);
  if (!collectResourceIds(project).has(id)) return undefined;
  record.iconResourceId = id;
  record.imageResourceId ??= id;
  const fits = defaultIconFitsName(record.name);
  warnings.push(fits
    ? `${label} 아이콘이 없어 이름에 맞는 기본 그림 ${id} 를 붙였습니다. 다른 그림을 쓰려면 iconResourceId 를 주세요.`
    : `${label} '${record.name ?? ""}' 에 맞는 아이콘이 없어 종류 기본 그림 ${id} 를 「대신 쓴 그림」으로 붙였습니다 — generate_item_icon 으로 이 이름에 맞는 아이콘을 그려 바꾸세요(호출하지 않으면 실행 끝에 저절로 그립니다).`);
  return { id, fits };
}
