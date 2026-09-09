import { afterEach, describe, expect, it } from "vitest";
import { newCommand } from "@/editor/eventActions";
import { handleShopTransaction } from "@/player/playSceneShop";
import { sellPrice } from "@/player/playSceneShopDom";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_SHOP_MERCHANT_GOLD, resolveShopMerchantGold } from "@/project/shopStock";
import { changeItem, startSession } from "@/project/session";
import { store } from "@/project/store";
import type { ItemRecord } from "@/project/types/database";
import type { PlaySceneContext } from "@/player/playSceneTypes";

const previous = store.getCurrent();
afterEach(() => store.replaceProject(previous));

function fakeScene(session: ReturnType<typeof startSession>): PlaySceneContext {
  return {
    session,
    syncRuntimeState: () => {},
  } as unknown as PlaySceneContext;
}

function potionLike(price: number): ItemRecord {
  return {
    id: "item_potion",
    name: "회복약",
    price,
    description: "test",
    type: "medicine",
    scope: "ally",
    occasion: "always",
    consumable: true,
    stateEffects: [],
    consumptionLimit: "noLimit",
    usableActorIds: [],
    usableClassIds: [],
    healStateIds: [],
    hpRecovery: { flat: 50, percentMax: 0 },
    mpRecovery: { flat: 0, percentMax: 0 },
    onlyUsableInMenu: false,
    onlyEffectiveOnDeadActors: false,
    usageMessage: "normal",
    occasionField: true,
    occasionBattle: true,
    seedParameterBonuses: { maxHp: 0, maxMp: 0, attack: 0, defense: 0, spirit: 0, agility: 0 },
    equipmentProfile: { equipable: false },
  };
}

describe("shop merchant gold", () => {
  it("defaults missing/invalid merchant gold to 100G", () => {
    expect(DEFAULT_SHOP_MERCHANT_GOLD).toBe(100);
    expect(resolveShopMerchantGold(undefined)).toBe(100);
    expect(resolveShopMerchantGold(Number.NaN)).toBe(100);
    expect(resolveShopMerchantGold(-5)).toBe(0);
    expect(resolveShopMerchantGold(42.9)).toBe(42);
  });

  it("new shop commands start with merchantGold 100", () => {
    const command = newCommand("shop");
    expect(command.kind).toBe("shop");
    if (command.kind !== "shop") return;
    expect(command.merchantGold).toBe(100);
  });

  it("blocks selling when merchant cannot afford the payout", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const item = potionLike(200); // sellPrice = 100
    // The canonical price consumer reads the active authored project, as real shops do.
    project.database.items = [...project.database.items.filter((entry) => entry.id !== item.id), item];
    store.replaceProject(project);
    changeItem(session, item.id, "+=", 2);
    const scene = fakeScene(session);

    const blocked = handleShopTransaction(scene, item, "sell", 1, 50);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.status).toContain("상인");
    expect(session.inventory[item.id]).toBe(2);
    expect(session.gold).toBe(project.system.startGold ?? session.gold);

    const startGold = session.gold;
    const payout = sellPrice(item);
    const ok = handleShopTransaction(scene, item, "sell", 1, payout);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.merchantGold).toBe(0);
    expect(session.inventory[item.id]).toBe(1);
    expect(session.gold).toBe(startGold + payout);
  });

  it("adds player purchase payments to merchant gold", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.gold = 500;
    const item = potionLike(80);
    const scene = fakeScene(session);

    const result = handleShopTransaction(scene, item, "buy", 2, 100);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.merchantGold).toBe(100 + 160);
    expect(session.gold).toBe(500 - 160);
    expect(session.inventory[item.id]).toBe(2);
  });
});
