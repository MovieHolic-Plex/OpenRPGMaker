import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { battleAnimationDurationMs } from "@/player/battleAnimationPlayback";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import type { Command } from "@/project/types";
import { shopTransferInitializerFixture } from "./fixtures/functionalAcceptance";

function fixture(mode: "purchase" | "choice" | "animation" | "direct", nested = false, suspendAgain = false) {
  const f = shopTransferInitializerFixture();
  const page = f.seller.pages?.[0], initializer = f.initializer.pages?.[0];
  const shop = page?.commands[0];
  const animation = f.project.database.battleAnimations[0];
  if (!page || !initializer || !shop || !animation) throw new Error("Missing test runtime records");
  const barrier: Command[] = mode === "purchase" ? [shop] : mode === "choice" ? [{ kind: "choices", options: [{ text: "Continue", branch: [] }] }]
    : mode === "animation" ? [{ kind: "showAnimation", target: "player", animationId: animation.id, wait: true }] : [];
  page.commands = [...barrier, ...(suspendAgain ? [structuredClone(shop)] : []), { kind: "transfer", mapId: f.destination.id, x: 1, y: 1 }];
  if (nested) initializer.commands = [structuredClone(shop)];
  const resume: SceneStep[] = mode === "purchase" ? [{ kind: "purchase", eventId: f.seller.id, itemId: "item_potion", count: 2, unitPrice: 10 }]
    : mode === "choice" ? [{ kind: "choose", index: 0 }]
    // Deterministic engine time is the behavior under test, not a wall-clock synchronization delay.
    : mode === "animation" ? [{ kind: "wait", ticks: Math.ceil(battleAnimationDurationMs(animation) / 16) }] : [];
  const steps: SceneStep[] = [{ kind: "walk", to: { x: f.seller.x, y: f.seller.y }, adjacent: true }, { kind: "interact", eventId: f.seller.id }, ...resume];
  return { ...f, steps };
}

describe("consumed interpreter holds do not block resumed continuations", () => {
  it.each(["direct", "purchase", "choice", "animation"] as const)("%s -> transfer runs the non-suspending arrival initializer", mode => {
    const f = fixture(mode);
    const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [...f.steps,
      { kind: "expect", mapId: f.destination.id, variableEquals: { var_0001: 1 }, interactionComplete: true,
        lastTransfer: { fromMapId: f.origin.id, eventId: f.seller.id, toMapId: f.destination.id } },
    ] });
    expect(result, JSON.stringify(result.failureReason)).toMatchObject({ ok: true, finalState: {
      mapId: f.destination.id, variables: { var_0001: 1 }, gold: mode === "purchase" ? 80 : 100,
    } });
    expect(result.session.erasedEventIds).toContain(f.initializer.id);
  });
  it("verifies the requested purchase even when its continuation transfers through a non-suspending initializer", () => {
    const f = shopTransferInitializerFixture();
    const ledger = new AssistantAcceptanceLedger("resume", "Purchase", f.project);
    ledger.adopt([{ id: "purchase", title: "Purchase", criteria: [{ kind: "shopPurchase", target: { mapId: f.origin.id },
      start: f.project.startPos, seller: { eventId: f.seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 }] }]);
    expect(ledger.evaluate(f.project).items[0].evidence[0].passed).toBe(true);
  });
  it.each(["purchase", "choice", "animation"] as const)("%s continuation can suspend again under the same event owner", mode => {
    const f = fixture(mode, false, true);
    const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: [...f.steps,
      { kind: "expect", interactionComplete: false, variableEquals: { var_0001: 0 }, mapId: f.origin.id },
      { kind: "purchase", eventId: f.seller.id, itemId: "item_potion", count: 1, unitPrice: 10 },
      { kind: "expect", interactionComplete: true, mapId: f.destination.id, variableEquals: { var_0001: 1 },
        goldDelta: mode === "purchase" ? -30 : -10, inventoryDelta: { item_potion: mode === "purchase" ? 3 : 1 } },
    ] });
    expect(result, JSON.stringify(result.failureReason)).toMatchObject({ ok: true });
  });
  it.each(["purchase", "choice", "animation"] as const)("%s cannot overwrite a newly suspended nested initializer", mode => {
    const f = fixture(mode, true);
    const result = runSceneTest(f.project, { mapId: f.origin.id, start: f.project.startPos, steps: f.steps });
    expect(result.ok).toBe(false);
    expect(result.finalState.mapId).toBe(f.destination.id);
  });
});
