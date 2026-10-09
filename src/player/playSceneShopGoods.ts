import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type {
  EquipmentRecord,
  EquipmentStatBonuses,
  ItemRecord,
  ItemType,
} from "@/project/types/database";

/**
 * 가게 진열대의 한 칸 — 아이템과 장비를 같은 모양으로 다룬다.
 *
 * 예전에는 상점이 `database.items` 만 읽어서 장비 탭 레코드(청동검 등)를 아예 담을 수 없었다.
 * 기본 프로젝트 items 179개 중 장비 타입은 0개였으므로 "기본 자료집으로는 무기점을 만들 수 없다"가
 * 실제 결과였다. 아이템 탭에서 종류를 무기로 지정해 우회하면 장비 메뉴(`database.equipment` 기준)가
 * 그 물건을 못 찾아 장착이 안 됐다 — 팔리지만 못 입는 무기.
 *
 * 이제 두 컬렉션을 한 view model 로 합친다. 장비를 사면 `session.inventory[equipmentId]` 가 늘고,
 * 장비 메뉴가 그 키로 후보를 고르므로 곧바로 장착된다.
 */
export type ShopGoods = {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly description: string;
  /** 어느 컬렉션에서 왔는지 — 상세 카드가 보여줄 정보가 갈린다. */
  readonly source: "item" | "equipment";
  /** 목록 분류 칩과 상세 카드 부제에 쓰는 한국어 종류 이름. */
  readonly typeLabel: string;
  /** 카테고리 필터 키. */
  readonly category: ShopCategory;
  readonly iconResourceId?: string;
  /** 장비만 — 상세 카드의 능력치 증감 줄. */
  readonly statBonuses?: EquipmentStatBonuses;
  readonly slot?: EquipmentRecord["slot"];
  /** 아이템만 — '장비' 보유 줄을 붙일지 판단한다. */
  readonly itemType?: ItemType;
};

export type ShopCategory = "consumable" | "equipment" | "material" | "special";

export const SHOP_CATEGORY_LABELS: Readonly<Record<ShopCategory, string>> = {
  consumable: "소비",
  equipment: "장비",
  material: "재료",
  special: "특수",
};

const ITEM_TYPE_LABELS: Readonly<Record<string, string>> = {
  normalGoods: "일반 물품",
  weapon: "무기",
  shield: "방패",
  body: "갑옷",
  head: "머리",
  accessory: "장신구",
  medicine: "약",
  book: "책",
  seed: "씨앗",
  special: "특수",
  switch: "스위치",
};

const EQUIPMENT_SLOT_LABELS: Readonly<Record<EquipmentRecord["slot"], string>> = {
  weapon: "무기",
  shield: "방패",
  armor: "갑옷",
  helmet: "머리",
  accessory: "장신구",
};

/** 장비 슬롯을 가진 아이템 종류 — '장비' 줄은 이 종류에만 뜬다(잡화에 항상 0 은 잡음). */
export const EQUIPPABLE_ITEM_TYPES: ReadonlySet<string> = new Set([
  "weapon",
  "shield",
  "body",
  "head",
  "accessory",
]);

function itemCategory(item: ItemRecord): ShopCategory {
  if (EQUIPPABLE_ITEM_TYPES.has(item.type)) return "equipment";
  // 일반 물품이라도 '소비'로 저작됐으면 소비 칸이다 — 회복약이 재료에 들어가던 분류 오류.
  if (item.type === "medicine" || item.type === "book" || item.type === "seed" || item.consumable) return "consumable";
  if (item.type === "special" || item.type === "switch") return "special";
  return "material";
}

export function itemToGoods(item: ItemRecord): ShopGoods {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    description: item.description ?? "",
    source: "item",
    typeLabel: ITEM_TYPE_LABELS[item.type] ?? item.type,
    category: itemCategory(item),
    iconResourceId: item.iconResourceId ?? item.imageResourceId,
    itemType: item.type,
  };
}

export function equipmentToGoods(record: EquipmentRecord): ShopGoods {
  return {
    id: record.id,
    name: record.name,
    price: record.price,
    description: record.description ?? "",
    source: "equipment",
    typeLabel: EQUIPMENT_SLOT_LABELS[record.slot] ?? record.slot,
    category: "equipment",
    iconResourceId: record.iconResourceId ?? record.imageResourceId,
    statBonuses: record.statBonuses,
    slot: record.slot,
  };
}

/**
 * 진열 가능한 물건 전체를 id → goods 로 색인한다. 아이템이 우선이고, 같은 id 의 장비는
 * 덮어쓰지 않는다(중복 id 프로젝트에서 구매/판매가 서로 다른 레코드를 보는 사고 방지).
 */
export function goodsIndex(project: Project): ReadonlyMap<string, ShopGoods> {
  const index = new Map<string, ShopGoods>();
  for (const item of project.database.items) {
    if (!index.has(item.id)) index.set(item.id, itemToGoods(item));
  }
  for (const record of project.database.equipment) {
    if (!index.has(record.id)) index.set(record.id, equipmentToGoods(record));
  }
  return index;
}

/** 에디터 자료집·상점 진열이 함께 쓰는 전체 목록(아이템 → 장비 순, id 중복 제거). */
export function allShopGoods(project: Project = store.getCurrent()): readonly ShopGoods[] {
  return Array.from(goodsIndex(project).values());
}

/** 되팔기 값 — 정가의 절반, 최소 1G. 정가 0이면 0 유지(에디터에서 막는 게 정답). */
export function goodsSellPrice(goods: { readonly price: number }): number {
  if (goods.price <= 0) return 0;
  return Math.max(1, Math.floor(goods.price / 2));
}
