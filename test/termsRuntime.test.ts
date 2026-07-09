import { describe, expect, it } from "vitest";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime, type BattleRuntime } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions } from "@/player/battleCommandDom";
import { innTextModel } from "@/player/playSceneCommerce";
import { createPlayerStatusMenuSnapshot } from "@/player/playerStatusMenuModel";
import { renderShopItems, renderShopMenu, shopPromptText } from "@/player/playSceneShopDom";
import { createBlankProject, DEFAULT_ACTOR_ID, DEFAULT_CLASS_ID, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { defaultTermValue, resolveTerms } from "@/project/terms";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Project } from "@/project/types";
import { installFakeDom, type FakeElement } from "./fakeDom";

type ShopStep = Parameters<typeof renderShopMenu>[0];
type InnStep = Parameters<typeof innTextModel>[0];

function blankWithTermOverrides(): Project {
  const project = createBlankProject();
  project.meta.terms = {
    attack: "Strike",
    skill: "Arts",
    item: "Goods",
    capture: "Catch",
    back: "Return",
    target: "Mark",
    shopGreeting: "Welcome, traveler.",
    shopBuy: "Acquire",
    shopSell: "Trade",
    shopCancel: "Leave",
    shopSellPrompt: "What will you trade?",
    innTitle: "Lodge",
    yes: "Stay",
    no: "Pass",
    notEnoughGold: "You are short.",
    gold: "Z",
    goldPrefix: "Coins ",
    hp: "Life",
    mp: "Mana",
  };
  return project;
}

function shopStep(): ShopStep {
  return {
    kind: "shop",
    itemIds: [DEFAULT_ITEM_ID],
    allowSell: true,
    quantityMode: "single",
    shopType: "normal",
    messageType: "welcome",
    branchOnTransaction: false,
  };
}

function innStep(): InnStep {
  return { kind: "inn", price: 25 };
}

function panelOptions(runtime: BattleRuntime): BattleCommandPanelOptions {
  return {
    runtime,
    submenu: null,
    setSubmenu: () => undefined,
    setDirectorState: () => undefined,
    render: () => undefined,
    runActorCommand: () => undefined,
    beginTargetCommand: (command) => runtime.beginActorCommand(command),
    confirmTargetSelection: (enemyId) => runtime.selectTargetEnemy(enemyId),
  };
}

describe("Terms runtime integration", () => {
  it("resolveTerms fills defaults while preserving overrides", () => {
    const project = createBlankProject();
    project.meta.terms = { gold: "Coin", shopBuy: "Buy Now" };

    const terms = resolveTerms(project);

    expect(terms.gold).toBe("Coin");
    expect(terms.shopBuy).toBe("Buy Now");
    expect(terms.attack).toBe(defaultTermValue("attack"));
    expect(terms.goldPrefix).toBe("돈 ");
  });

  it("loads old v3 project JSON without meta.terms and keeps missing fields compact", () => {
    const raw = JSON.parse(serialize(createBlankProject())) as Record<string, unknown>;
    const meta = raw.meta as Record<string, unknown>;
    delete meta.terms;

    const restored = deserialize(JSON.stringify(raw));

    expect(restored.meta.terms).toEqual({});
    expect(resolveTerms(restored).gold).toBe("G");
    expect(serialize(restored)).not.toContain("shopGreeting");
  });

  it("preserves unknown term fields and does not synthesize missing known fields on roundtrip", () => {
    const raw = JSON.parse(serialize(createBlankProject())) as Record<string, unknown>;
    const meta = raw.meta as Record<string, unknown>;
    meta.terms = { gold: "Z", customTerm: "Keep me" };

    const restored = deserialize(JSON.stringify(raw));
    const restoredTerms = restored.meta.terms as Record<string, unknown>;

    expect(restoredTerms.customTerm).toBe("Keep me");
    expect("attack" in restoredTerms).toBe(false);
    expect(JSON.parse(serialize(restored)).meta.terms).toEqual({ gold: "Z", customTerm: "Keep me" });
  });

  it("renders battle command labels and target UI from terms overrides", () => {
    const cleanup = installFakeDom();
    try {
      const project = blankWithTermOverrides();
      project.system.monsterCollection = true;
      project.session.inventory[DEFAULT_ITEM_ID] = 1;
      const klass = project.database.classes.find((record) => record.id === DEFAULT_CLASS_ID);
      if (!klass) throw new Error("missing default class");
      klass.battleCommands = [];
      store.replace(project);

      expect(battleCommandsForActor(project, DEFAULT_ACTOR_ID).map((command) => command.name)).toContain("Strike");
      expect(battleCommandsForActor(project, DEFAULT_ACTOR_ID).map((command) => command.name)).toContain("Catch");

      const runtime = createBattleRuntime({
        project,
        troopId: DEFAULT_TROOP_ID,
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
      });
      const grid = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
      expect(grid.textContent).toContain("Strike");
      expect(grid.textContent).toContain("Arts");
      expect(grid.textContent).toContain("Goods");
      expect(grid.textContent).toContain("Catch");

      runtime.beginActorCommand({ kind: "attack" });
      const target = commandPanel(runtime.snapshot(), panelOptions(runtime)) as unknown as FakeElement;
      expect(target.textContent).toContain("Mark");
    } finally {
      cleanup();
    }
  });

  it("renders shop text from terms overrides", () => {
    const cleanup = installFakeDom();
    try {
      const project = blankWithTermOverrides();
      store.replace(project);
      const terms = resolveTerms(project);
      const menu = renderShopMenu(shopStep(), terms, () => undefined, () => undefined) as unknown as FakeElement;
      expect(menu.textContent).toContain("Welcome, traveler.");
      expect(menu.textContent).toContain("Acquire");
      expect(menu.textContent).toContain("Trade");
      expect(menu.textContent).toContain("Leave");
      expect(shopPromptText(shopStep(), "sell", terms)).toBe("What will you trade?");

      const scene = { session: { gold: 77, partyActorIds: [], inventory: {} } } as unknown as PlaySceneContext;
      const items = [project.database.items[0]!];
      const itemsView = renderShopItems({
        scene,
        step: shopStep(),
        items,
        mode: "sell",
        prompt: "What will you trade?",
        terms,
        setStatus: () => undefined,
        showMenu: () => undefined,
        onItem: () => undefined,
      }) as unknown as FakeElement;
      expect(itemsView.textContent).toContain("What will you trade?");
      expect(itemsView.textContent).toContain("Leave");
      expect(itemsView.textContent).toContain("77Z");
    } finally {
      cleanup();
    }
  });

  it("builds inn text from terms overrides", () => {
    const project = blankWithTermOverrides();
    const text = innTextModel(innStep(), resolveTerms(project));

    expect(text.title).toBe("Lodge");
    expect(text.question).toContain("25 Z");
    expect(text.yes).toBe("Stay");
    expect(text.no).toBe("Pass");
    expect(text.notEnoughGold).toBe("You are short.");
  });

  it("builds status menu common labels from terms overrides", () => {
    const project = blankWithTermOverrides();
    const session = startSession(project);
    session.gold = 42;

    const snapshot = createPlayerStatusMenuSnapshot(project, session);

    expect(snapshot.goldLabel).toBe("Coins 42Z");
    expect(snapshot.partyRows[0]?.hpLabel).toContain("Life ");
    expect(snapshot.partyRows[0]?.mpLabel).toContain("Mana ");
  });
});
