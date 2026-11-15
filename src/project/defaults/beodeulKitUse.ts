// 버들항 문 달린 건물 킷의 쓰임 자료 — 크기 단(tier:)과 그 건물 안의 방 종류(interior:)를 킷 태그로 적는다.
//   단: src/project/kitTier.ts 의 규칙(문 하나에 딸린 넓이). 참고 건물(bd-bld-ref-*)은 그린 사람이 적은 태그 그대로.
//   안: 참고 건물은 굽기(scripts/content/beodeul-ref-buildings)가 적었다. 그 밖의 건물은 아래 표 — 그 킷이 무슨 건물로 그려졌는가(킷 id 마다 한 줄, 그린 쪽 자료).
//       표에 없는 집은 쓰임이 정해지지 않은 살림집이다(안은 그 장소의 방 종류가 정한다).
// 읽는 곳: 실내 빌더(interiorExterior.ts · interiorTier.ts — 몇 방짜리로 짓나) · 마을 짓기(beodeulVillage.ts — 이야기가 청한 큰 건물을 세운다).
// 요청 낱말·장소 이름은 여기서 보지 않는다.
import { kitEntranceCount, kitTierByFootprint } from "../kitTier";
import type { StructureKitDef, TilesetDef } from "../types";

/** 킷 id → 그 건물 안의 방 종류(방 종류 id, 앞이 주인 방). */
export const BEODEUL_KIT_INTERIOR: Readonly<Record<string, readonly string[]>> = {
  // 원본 버들항 도시의 이름 붙은 건물
  "bd-house-inn": ["tavern"], "bd-house-cathedral": ["chapel"], "bd-house-manor": ["living"], "bd-house-smithy_town": ["forge"], "bd-house-ware0": ["storeroom"],
  "bd-block-church-14x17": ["chapel"], "bd-block-church-20x17": ["chapel"],
  // 중세 건물(bd-house-mk-*)
  "bd-house-mk-inn": ["tavern"], "bd-house-mk-chapel": ["chapel"], "bd-house-mk-town-hall": ["waiting_room", "study"], "bd-house-mk-great-hall": ["great_hall", "study"],
  "bd-house-mk-barracks": ["guard_room", "jail"], "bd-house-mk-manor": ["living"], "bd-house-mk-market-hall": ["general_store"], "bd-house-mk-smithy": ["forge"],
  "bd-house-mk-bakery": ["bakery_shop"], "bd-house-mk-granary-mill": ["mill", "storeroom"], "bd-house-mk-warehouse": ["storeroom"], "bd-house-mk-tithe-barn": ["stable", "storeroom"],
  "bd-house-mk-lighthouse": ["lighthouse"],
  // 시설(건물 + 작업 마당, bd-facility-*)
  "bd-facility-inn": ["tavern"], "bd-facility-tavern": ["tavern"], "bd-facility-chapel": ["chapel"], "bd-facility-adventurers-guild": ["great_hall", "study"],
  "bd-facility-village-hall": ["waiting_room", "study"], "bd-facility-guardhouse": ["guard_room"], "bd-facility-prison": ["jail", "guard_room"], "bd-facility-library": ["library"],
  "bd-facility-bakery": ["bakery_shop"], "bd-facility-smithy": ["forge"], "bd-facility-brewery": ["brewery"], "bd-facility-warehouse": ["storeroom"], "bd-facility-granary": ["storeroom"],
  "bd-facility-stable": ["stable"], "bd-facility-general-shop": ["general_store"], "bd-facility-weapon-shop": ["weapon_shop"], "bd-facility-apothecary": ["pharmacy_shop"], "bd-facility-carpenter": ["carpentry"],
};

/** 문 달린 킷마다 tier: 태그(없을 때만)와 표의 interior: 태그(없을 때만)를 적는다. 바뀐 킷 수. */
export function stampBeodeulKitUse(tileset: Pick<TilesetDef, "structureKits">): number {
  let changed = 0;
  for (const kit of tileset.structureKits ?? []) {
    if (!kitEntranceCount(kit)) continue;
    const ai = (kit as StructureKitDef & { ai?: { tags?: string[] } }).ai ??= {} as never;
    const tags = (ai as { tags?: string[] }).tags ??= [];
    let touched = false;
    if (!tags.some((t) => t.startsWith("tier:"))) { tags.push(`tier:${kitTierByFootprint(kit)!}`); touched = true; }
    const inside = BEODEUL_KIT_INTERIOR[kit.id];
    if (inside && !tags.some((t) => t.startsWith("interior:"))) { tags.push(`interior:${inside.join("+")}`); touched = true; }
    if (touched) changed++;
  }
  return changed;
}
