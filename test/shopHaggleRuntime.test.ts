import { describe, expect, it } from "vitest";
import { handleShopTransaction } from "@/player/playSceneShop";
import { createBlankProject } from "@/project/defaults";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { changeItem, startSession } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { PlaySceneContext } from "@/player/playSceneTypes";

function sceneOf(session: ReturnType<typeof startSession>): PlaySceneContext {
  return { session, syncRuntimeState: () => {} } as unknown as PlaySceneContext;
}

const potion = { id: "item_potion", name: "회복약", price: 200 };

describe("haggle runtime invariants", () => {
  it("Given / When / Then an agreed buy stays in [floor, list] and changes gold once", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.gold = 1000;
    const scene = sceneOf(session);
    const ok = handleShopTransaction(scene, potion, "buy", 1, 100, 160);
    expect(ok.ok).toBe(true);
    expect(session.gold).toBe(840);
    expect(session.inventory.item_potion).toBe(1);
    const bad = handleShopTransaction(scene, potion, "buy", 1, 100, 50);
    expect(bad.ok).toBe(false);
  });

  it("Given / When / Then an agreed sell stays below buy and above the list sell", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.gold = 0;
    changeItem(session, potion.id, "+=", 1);
    const scene = sceneOf(session);
    const ok = handleShopTransaction(scene, potion, "sell", 1, 200, 120);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.merchantGold).toBe(80);
    expect(session.gold).toBe(120);
    const copy = handleShopTransaction(sceneOf(startSession(project)), potion, "sell", 1, 200, 200);
    expect(copy.ok).toBe(false);
  });

  it("Given / When / Then a broken visit state survives save/load", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.shopHaggleState = {
      "shop_a:item_potion:1:spring:1": { patience: 0, drift: 0, attemptIndex: 2, broken: true },
    };
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.shopHaggleState?.["shop_a:item_potion:1:spring:1"]?.broken).toBe(true);
    const reserve = resolveHaggleReserve({
      role: "playerBuys",
      reference: 200,
      buyPrice: 200,
      maxDiscount: 0.25,
      itemId: "item_potion",
      merchantKey: "shop_a",
      dayKey: "1:spring:1",
      attemptIndex: 2,
    });
    expect(proposeHaggle({
      role: "playerBuys",
      reference: 200,
      reserve,
      patience: 1,
      insultRatio: 0.6,
      buyPrice: 200,
    }, 40).kind).toBe("broken");
  });
});
