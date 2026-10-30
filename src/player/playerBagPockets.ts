import { isCaptureTool } from "@/project/itemUsage";
import { isEvolutionStone } from "@/project/monsterEvolutionItems";
import { machineSkillOf } from "@/project/monsterMedicine";
import type { ItemBagPocket, ItemRecord, Project } from "@/project/types";

/** 몬스터 수집 게임 가방의 포켓. 순서가 좌우 키 전환 순서다. */
export const BAG_POCKETS: readonly { readonly id: ItemBagPocket; readonly label: string }[] = [
  { id: "items", label: "도구" },
  { id: "balls", label: "볼" },
  { id: "machines", label: "기술머신" },
  { id: "held", label: "지닐 도구" },
  { id: "key", label: "중요한 물건" },
];
export const DEFAULT_BAG_POCKET: ItemBagPocket = "items";

export function bagPocketLabel(id: ItemBagPocket): string {
  return BAG_POCKETS.find((pocket) => pocket.id === id)?.label ?? id;
}

/** 좌우 키로 한 칸 옮긴 포켓(양 끝에서 돈다). */
export function stepBagPocket(current: ItemBagPocket, delta: -1 | 1): ItemBagPocket {
  const index = BAG_POCKETS.findIndex((pocket) => pocket.id === current);
  return BAG_POCKETS[(Math.max(0, index) + delta + BAG_POCKETS.length) % BAG_POCKETS.length]!.id;
}

/**
 * 아이템이 어느 포켓에 속하는가. 저작자가 `item.pocket` 으로 정한 값이 먼저이고, 없으면 쓰임새 필드에서 정해진다 —
 * 포획 도구 → 볼, 기술머신(learnedSkillId) → 기술머신, 지닌 도구(heldEffect) → 지닐 도구,
 * 어디서도 쓸 수 없거나(occasion never) 스위치·장비 종류 → 중요한 물건, 나머지(약·사탕·진화의 돌·전투용 소모품) → 도구.
 * ItemType 은 보지 않는다(조수가 normalGoods 로 저장한 볼·약도 필드로 분류된다).
 */
export function bagPocketOf(project: Project, item: ItemRecord): ItemBagPocket {
  if (item.pocket) return item.pocket;
  if (isCaptureTool(item)) return "balls";
  if (machineSkillOf(project, item)) return "machines";
  if (item.heldEffect) return "held";
  if (isEvolutionStone(project, item)) return "items";
  if (item.occasion === "never" || item.type === "switch" || EQUIPMENT_TYPES.has(item.type)) return "key";
  return "items";
}

const EQUIPMENT_TYPES: ReadonlySet<string> = new Set(["weapon", "shield", "body", "head", "accessory"]);

/**
 * 일반 장르(몬스터 수집이 아닌 게임) 가방의 「중요한 물건」: 저작자가 pocket "key" 로 정했거나,
 * 어디서도 쓸 수 없고(occasion never) 팔 수 없는(가격 0) 물건 — 추리 증거·편지·열쇠 같은 이야기 물건.
 * 장비 종류는 넣지 않는다(장비 칸이 따로 있다). 몬스터 게임은 bagPocketOf 를 쓴다.
 */
export function isKeyItem(item: ItemRecord): boolean {
  if (item.pocket) return item.pocket === "key";
  if (EQUIPMENT_TYPES.has(item.type)) return false;
  return item.occasion === "never" && (item.price ?? 0) === 0;
}

/**
 * 일반 가방이 「중요한 물건」 칸을 보이는가 — 플레이어가 중요한 물건을 하나라도 가졌을 때만.
 * 기본 자료집에 공용 열쇠·편지가 늘 들어 있으므로 「자료집에 있다」로 정하면 모든 게임의 가방이 바뀐다.
 */
export function holdsKeyItems(project: Project, inventory: Readonly<Record<string, number>>): boolean {
  return project.database.items.some((item) => (inventory[item.id] ?? 0) > 0 && isKeyItem(item));
}

/** 포켓별 보유 아이템 종류 수(수량이 아니라 줄 수). 자료집에 없는 id 는 중요한 물건에 센다(목록이 그 줄을 같은 곳에 둔다). 장비 id 는 몬스터 가방에 줄이 없다. */
export function bagPocketCounts(project: Project, inventory: Readonly<Record<string, number>>): Record<ItemBagPocket, number> {
  const counts: Record<ItemBagPocket, number> = { items: 0, balls: 0, machines: 0, held: 0, key: 0 };
  for (const [id, quantity] of Object.entries(inventory)) {
    if (quantity <= 0) continue;
    const item = project.database.items.find((record) => record.id === id);
    if (!item && project.database.equipment.some((record) => record.id === id)) continue;
    counts[item ? bagPocketOf(project, item) : "key"] += 1;
  }
  return counts;
}
