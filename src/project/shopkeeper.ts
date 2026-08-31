import { hash32, normalizeHaggleConfig, type HaggleConfig } from "@/project/haggle";

export const SHOP_REPUTATION_MIN = 0;
export const SHOP_REPUTATION_MAX = 100;
export const SHOPKEEPER_QUEUE_SIZE = 4;

const CUSTOMER_NAMES = ["여행자", "모험가", "마을 사람", "행상인", "아이", "노인"] as const;

export type ShopkeeperCustomer = {
  readonly id: string;
  readonly name: string;
  readonly itemId: string;
  readonly attemptIndex: number;
};

export function clampShopReputation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(SHOP_REPUTATION_MAX, Math.max(SHOP_REPUTATION_MIN, Math.trunc(value)));
}

export function reputationAfterVerdict(
  reputation: number,
  kind: "accept" | "counter" | "broken",
): number {
  if (kind === "accept") return clampShopReputation(reputation + 2);
  if (kind === "broken") return clampShopReputation(reputation - 5);
  return clampShopReputation(reputation);
}

export function generateShopkeeperCustomers(input: {
  readonly shopKey: string;
  readonly dayKey: string;
  readonly itemIds: readonly string[];
  readonly count?: number;
}): readonly ShopkeeperCustomer[] {
  if (input.itemIds.length === 0) return [];
  const count = Math.min(SHOPKEEPER_QUEUE_SIZE, Math.max(1, input.count ?? SHOPKEEPER_QUEUE_SIZE));
  const customers: ShopkeeperCustomer[] = [];
  for (let index = 0; index < count; index += 1) {
    const seed = hash32(`${input.shopKey}|${input.dayKey}|${index}`);
    const itemId = input.itemIds[seed % input.itemIds.length] ?? input.itemIds[0];
    if (itemId === undefined) continue;
    customers.push({
      id: `customer-${index}`,
      name: CUSTOMER_NAMES[seed % CUSTOMER_NAMES.length] ?? CUSTOMER_NAMES[0],
      itemId,
      attemptIndex: index,
    });
  }
  return customers;
}

export function shopkeeperHaggleConfig(config: HaggleConfig | undefined): ReturnType<typeof normalizeHaggleConfig> {
  return normalizeHaggleConfig(config);
}

export function shelfQuantity(
  shelf: Readonly<Record<string, number>> | undefined,
  itemId: string,
): number {
  const qty = shelf?.[itemId] ?? 0;
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.trunc(qty));
}
