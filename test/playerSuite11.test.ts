import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import { shopKeyOf } from "@/player/playSceneShopVisit";
import { handleShopTransaction } from "@/player/playSceneShop";
import { DEFAULT_ACTOR_ID, DEFAULT_CLASS_ID, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { proposeHaggle, resolveHaggleReserve } from "@/project/haggle";
import { changeItem, startSession, GOLD_MAX } from "@/project/session";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { newCommand } from "@/editor/eventActions";
import { sellPrice, renderShopItems, renderShopMenu, shopPromptText } from "@/player/playSceneShopDom";
import { DEFAULT_SHOP_MERCHANT_GOLD, resolveShopMerchantGold } from "@/project/shopStock";
import { store } from "@/project/store";
import type { ItemRecord } from "@/project/types/database";
import { contentHash, mergeClearRecords, planSlot, savedAtMs } from "@/player/storeCloudSync";
import { cloudParentOrigin, parseCloudSlot, type CloudSlot } from "@/player/storeCloudBridge";
import type { StoreGameBoot } from "@/player/storeGameHost";
import { battleCommandsForActor } from "@/battle/battleCommands";
import { createBattleRuntime, type BattleRuntime } from "@/battle/runtime";
import { commandPanel, type BattleCommandPanelOptions } from "@/player/battleCommandDom";
import { innTextModel } from "@/player/playSceneCommerce";
import { createPlayerStatusMenuSnapshot } from "@/player/playerStatusMenuModel";
import { defaultTermValue, resolveTerms } from "@/project/terms";
import type { Project } from "@/project/types";
import { installFakeDom, FakeElement, findByTestId, renderWithFakeDom } from "./fakeDom";
import { installTimeTintLayer, timeTintVisualForPhase, updateTimeTint } from "@/player/playSceneTime";
import { DEFAULT_TITLE_PARTICLE_DENSITY, TITLE_FIREFLY_MAX, TITLE_PARTICLE_MAX, TITLE_PARTICLE_STAGE, createTitleParticlesCanvas, titleParticleCount, titleParticlePositions } from "@/player/titleParticles";
import { estimateTextEm, fitTitleSubtitle, fitTitleText, TITLE_STAGE_WIDTH } from "@/player/titleTextFit";
import { calculateTouchLayout } from "@/player/playSurface";
import { readFileSync } from "node:fs";
import { markClassicWindowSkin, usesClassicWindowSkin } from "@/player/systemGraphics";
import { storeImageSizeProblem } from "@/assetStore/format";
import { createZoneFeedbackDom, feedbackSuppressedByOverlay } from "@/player/playSceneZoneFeedback";
import { createZoneFeedbackModel, updateZoneFeedback, type ZoneFeedbackView } from "@/player/zoneFeedback";
import { isolateTimers } from "./mergedTeardown";

describe("shopEconomyValidationAndKey", () => {
  isolateTimers();
  /**
   * PR #300 병합 시 고친 차단 결함 2건의 계약.
   *
   * 둘 다 "조용히 잘못 동작한다" 부류다 — 오류도 경고도 없이 저자 의도와 다르게 굴러간다.
   * 그래서 눈으로는 못 잡고 테스트로 고정해야 한다.
   *
   * 페이지를 손으로 만들지 않고 **실제 프로젝트의 이벤트 페이지를 복제해** 명령만 갈아 끼운다.
   * 손 리터럴은 검증기가 요구하는 필드(name·conditions·graphic·movement…)를 계속 놓쳐서
   * 정작 재려는 것과 무관한 실패를 낸다 — 빌더를 우회하는 리터럴이 함정이라는 기록 그대로다.
   */

  function projectWithShopCommand(economy?: unknown, restockPolicy?: unknown): string {
    const project = createScarloxyDemoProject();
    const map = project.maps[project.startMapId];
    const page = map.events[0].pages[0];
    page.commands = [
      {
        kind: "shop",
        itemIds: ["item_potion"],
        ...(economy === undefined ? {} : { economy }),
        ...(restockPolicy === undefined ? {} : { restockPolicy }),
      } as never,
    ];
    return JSON.stringify(JSON.parse(serialize(project)));
  }
  describe("저작된 상점 economy 는 로드 경계에서 검사된다", () => {
    it("정상 값은 통과한다", () => {
      const raw = projectWithShopCommand(
        { haggleEnabled: true, shopkeeperEnabled: false, haggle: { patience: 3, insultRatio: 0.4, maxDiscount: 0.3 } },
        "daily",
      );
      expect(() => deserialize(raw)).not.toThrow();
    });

    // 런타임이 `=== true` 로 엄격히 보므로 참 같은 문자열은 기능을 조용히 끈다.
    // 저자가 켠 기능이 오류도 경고도 없이 꺼지는 것이 이 검사가 막는 실패다.
    it("참 같은 문자열을 boolean 자리에 넣으면 막는다", () => {
      expect(() => deserialize(projectWithShopCommand({ haggleEnabled: "yes" }))).toThrow(/haggleEnabled/);
    });

    it("boolean 자리의 배열도 막는다", () => {
      expect(() => deserialize(projectWithShopCommand({ shopkeeperEnabled: [] }))).toThrow(/shopkeeperEnabled/);
    });

    it("무한대에 가까운 흥정 수치를 막는다", () => {
      expect(() => deserialize(projectWithShopCommand({ haggle: { insultRatio: 1.79e308 } }))).toThrow(/insultRatio/);
    });

    it("음수 인내심을 막는다", () => {
      expect(() => deserialize(projectWithShopCommand({ haggle: { patience: -999 } }))).toThrow(/patience/);
    });

    // 런타임 shouldRestock 은 유니온 밖이면 false 로 떨어진다 = "재입고 안 함".
    // 오타가 조용히 기능을 끄는 같은 부류다.
    it("유니온 밖 restockPolicy 를 막는다", () => {
      expect(() => deserialize(projectWithShopCommand(undefined, "hourly"))).toThrow(/restockPolicy/);
    });
  });
  describe("상점 원장 키는 상점마다 다르다", () => {
    it("맵+이벤트가 다르면 키가 다르다 — 대장간과 잡화점이 지갑을 공유하지 않는다", () => {
      expect(shopKeyOf({}, { mapId: "map_town", eventId: "ev_smith" })).not.toBe(
        shopKeyOf({}, { mapId: "map_town", eventId: "ev_store" }),
      );
    });

    it("같은 이벤트를 다시 방문하면 같은 키다 — 지갑이 이어진다", () => {
      expect(shopKeyOf({}, { mapId: "map_town", eventId: "ev_smith" })).toBe(
        shopKeyOf({}, { mapId: "map_town", eventId: "ev_smith" }),
      );
    });

    it("다른 맵의 같은 이벤트 id 도 갈린다", () => {
      expect(shopKeyOf({}, { mapId: "map_town", eventId: "ev_shop" })).not.toBe(
        shopKeyOf({}, { mapId: "map_port", eventId: "ev_shop" }),
      );
    });

    it("loyaltyTierId 가 있으면 그것이 이긴다 — 여러 이벤트가 한 상인을 공유하는 저작", () => {
      expect(shopKeyOf({ loyaltyTierId: "tier_gil" }, { mapId: "map_town", eventId: "ev_a" })).toBe(
        shopKeyOf({ loyaltyTierId: "tier_gil" }, { mapId: "map_port", eventId: "ev_b" }),
      );
    });

    it("신원을 모르면 전역으로 떨어지되 맵만 알면 맵으로 가른다", () => {
      expect(shopKeyOf({})).toBe("global");
      expect(shopKeyOf({}, { mapId: "map_town" })).toBe("map:map_town");
    });
  });
});

describe("shopHaggleRuntime", () => {
  isolateTimers();
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
});

describe("shopMerchantGold", () => {
  isolateTimers();
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

    it("names the gold cap when a sale would pass it and leaves the purse unchanged", () => {
      const project = createBlankProject();
      const session = startSession(project);
      const item = potionLike(200);
      project.database.items = [...project.database.items.filter((entry) => entry.id !== item.id), item];
      store.replaceProject(project);
      changeItem(session, item.id, "+=", 2);
      session.gold = GOLD_MAX;
      const scene = fakeScene(session);

      const blocked = handleShopTransaction(scene, item, "sell", 1, 500);
      expect(blocked.ok).toBe(false);
      if (blocked.ok) return;
      expect(blocked.status).toBe("소지금이 한도에 도달했습니다.");
      expect(session.gold).toBe(GOLD_MAX);
      expect(session.inventory[item.id]).toBe(2);

      session.gold = GOLD_MAX - sellPrice(item);
      const ok = handleShopTransaction(scene, item, "sell", 1, 500);
      expect(ok.ok).toBe(true);
      if (!ok.ok) return;
      expect(session.gold).toBe(GOLD_MAX);
      expect(session.inventory[item.id]).toBe(1);
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
});

describe("storeCloudSync", () => {
  isolateTimers();
  const save = (at: string, extra = ""): string => JSON.stringify({ savedAt: at, session: { note: extra } });
  const cloud = (data: string, revision: number): CloudSlot => ({ slot: "1", revision, data, savedAt: null, updatedAt: "", gameVersion: null });
  describe("store cloud save planning", () => {
    const older = save("2026-10-24T01:00:00Z", "a");
    const newer = save("2026-10-24T02:00:00Z", "b");

    it("pulls cloud into an empty slot and offers (not forces) uploading local-only saves", () => {
      expect(planSlot("1", null, cloud(older, 1), undefined)).toEqual({ kind: "take-cloud", keepLocalAsOther: false });
      expect(planSlot("1", older, null, undefined)).toEqual({ kind: "offer-upload", base: 0, keepCloudAsOther: false });
      expect(planSlot("1", null, null, undefined)).toEqual({ kind: "none" });
    });

    it("follows whichever side changed since the last sync", () => {
      expect(planSlot("1", newer, cloud(older, 3), { rev: 3, hash: contentHash(older) })).toEqual({ kind: "push", base: 3, keepCloudAsOther: false });
      expect(planSlot("1", older, cloud(newer, 4), { rev: 3, hash: contentHash(older) })).toEqual({ kind: "take-cloud", keepLocalAsOther: false });
      expect(planSlot("1", older, cloud(older, 4), undefined)).toEqual({ kind: "mark", rev: 4 });
    });

    it("keeps both when both changed: newest takes the slot, the other is kept", () => {
      const local = save("2026-10-24T03:00:00Z", "local");
      expect(planSlot("1", local, cloud(newer, 4), { rev: 3, hash: contentHash(older) })).toEqual({ kind: "push", base: 4, keepCloudAsOther: true });
      expect(planSlot("1", older, cloud(newer, 4), { rev: 3, hash: contentHash(save("2026-10-24T00:00:00Z")) })).toEqual({ kind: "take-cloud", keepLocalAsOther: true });
      // 이 계정과 처음인데 로컬이 더 늦다 → 묻는다(공용 PC 의 남 세이브를 몰래 올리지 않는다).
      expect(planSlot("1", local, cloud(newer, 4), undefined)).toEqual({ kind: "offer-upload", base: 4, keepCloudAsOther: true });
    });

    it("merges clear records instead of choosing one", () => {
      const merged = JSON.parse(mergeClearRecords(
        JSON.stringify({ endingIds: ["a"], clearCount: 1, clearedAt: "2026-10-24T01:00:00Z", carry: {} }),
        JSON.stringify({ endingIds: ["b"], clearCount: 2, clearedAt: "2026-10-24T02:00:00Z", carry: {} }),
      )) as { endingIds: string[]; clearCount: number };
      expect(merged.endingIds.sort()).toEqual(["a", "b"]);
      expect(merged.clearCount).toBe(2);
      expect(savedAtMs(JSON.stringify({ clearedAt: "2026-10-24T02:00:00Z" }))).toBe(Date.parse("2026-10-24T02:00:00Z"));
    });

    it("rejects malformed cloud slots", () => {
      expect(parseCloudSlot({ slot: "9", revision: 1, data: "{}" })).toBeNull();
      expect(parseCloudSlot({ slot: "1", revision: 0, data: "{}" })).toBeNull();
      expect(parseCloudSlot({ slot: "auto", revision: 2, data: "{}" })?.slot).toBe("auto");
    });
  });
  describe("store cloud bridge parent origin", () => {
    const boot: StoreGameBoot = { slug: "first-love", version: "1.5", title: "t", savePrefix: "oprn-export:store:first-love@", embedders: ["https://play.openrpgmaker.com"] };
    const fakeWindow = (ancestor: string | null, framed = true): Window => {
      const self = {} as Window;
      return {
        self, parent: framed ? ({} as Window) : self,
        location: { origin: "https://games-kr.openrpgmaker.com", ancestorOrigins: ancestor ? { length: 1, item: () => ancestor } : { length: 0, item: () => null } },
        document: { referrer: "" },
      } as unknown as Window;
    };
    it("opens only under the allowed store parent", () => {
      expect(cloudParentOrigin(boot, fakeWindow("https://play.openrpgmaker.com"))).toBe("https://play.openrpgmaker.com");
      expect(cloudParentOrigin(boot, fakeWindow("https://evil.example"))).toBeNull();
      expect(cloudParentOrigin(boot, fakeWindow(null))).toBeNull();
    });
  });
});

describe("termsRuntime", () => {
  isolateTimers();
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

        // Canonical generic commands may retain old localized names in authored class data;
        // the runtime surface must still use the project's term resolver.
        klass.battleCommands = [
          { id: "cmd_attack", name: "공격", kind: "attack" },
          { id: "cmd_skill", name: "스킬", kind: "skill" },
          { id: "cmd_item", name: "아이템", kind: "item" },
        ];

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
        // 타깃 선택 시 presentation은 하단 메뉴 유지(menu) — 필드 오버레이로 비우지 않는다
        expect(target.getAttribute("data-target-presentation")).toBe("menu");
        expect(target.getAttribute("aria-label")).toBe("Mark");
        // 타깃 오버레이는 현재 적 이름을 그대로 노출한다 — 메뉴 텍스트 계승
        expect(target.textContent).toContain("Mark");
      } finally {
        cleanup();
      }
    });

    it("shows the shop command title in the shop header and falls back to the service name", () => {
      const cleanup = installFakeDom();
      try {
        const project = createBlankProject();
        store.replace(project);
        const terms = resolveTerms(project);
        const header = (step: ShopStep) => (renderShopMenu(step, terms, () => undefined, () => undefined) as unknown as FakeElement).textContent;
        expect(header({ ...shopStep(), title: "오든 약재상" })).toContain("오든 약재상");
        expect(header({ ...shopStep(), title: "   " })).toContain("상점");
        expect(header({ ...shopStep(), shopServiceKind: "repair" })).toContain("수리점");
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
});

describe("timeTintFrame", () => {
  isolateTimers();
  function graphicsRecorder() {
    return {
      clears: 0,
      fills: 0,
      visible: true,
      lastFill: undefined as { color: number; alpha: number } | undefined,
      lastRect: undefined as { x: number; y: number; w: number; h: number } | undefined,
      clear() { this.clears += 1; },
      setVisible(visible: boolean) { this.visible = visible; return this; },
      setScrollFactor() { return this; },
      setDepth() { return this; },
      fillStyle(color: number, alpha: number) { this.lastFill = { color, alpha }; return this; },
      fillRect(x: number, y: number, w: number, h: number) { this.fills += 1; this.lastRect = { x, y, w, h }; return this; },
    };
  }
  function sceneFor(graphics: ReturnType<typeof graphicsRecorder>) {
    const camera = { width: 480, height: 270 };
    const scene = {
      add: { graphics: () => graphics },
      cameras: { main: camera },
      session: { gameTime: undefined as { minute: number; hour: number; day: number; season: "spring"; year: number } | undefined },
      timeTintTransition: null,
    };
    return { scene, camera };
  }
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe("time tint frame budget", () => {
    it("clears a hidden tint once when the clock is off", () => {
      vi.spyOn(store, "getCurrent").mockReturnValue(createBlankProject());
      const graphics = graphicsRecorder();
      const { scene } = sceneFor(graphics);
      installTimeTintLayer(scene as never);
      expect(graphics.clears).toBe(1);
      expect(graphics.visible).toBe(false);
      for (let frame = 0; frame < 30; frame += 1) updateTimeTint(scene as never, 16);
      expect(graphics.clears).toBe(1);
      expect(graphics.fills).toBe(0);
    });

    it("paints a stable night tint once and again when the camera size changes", () => {
      const project = createBlankProject();
      project.system = { ...project.system, timeSystem: { enabled: true } };
      vi.spyOn(store, "getCurrent").mockReturnValue(project);
      const graphics = graphicsRecorder();
      const { scene, camera } = sceneFor(graphics);
      const session = startSession(project);
      session.gameTime = { minute: 0, hour: 21, day: 1, season: "spring", year: 1 };
      scene.session = session;
      installTimeTintLayer(scene as never);
      const night = timeTintVisualForPhase("night");
      updateTimeTint(scene as never, 1500);
      expect(graphics.fills).toBe(1);
      expect(graphics.lastFill).toEqual({ color: night.color, alpha: night.alpha });
      expect(graphics.lastRect).toEqual({ x: 0, y: 0, w: 480, h: 270 });
      expect(graphics.visible).toBe(true);
      const clears = graphics.clears;
      for (let frame = 0; frame < 30; frame += 1) updateTimeTint(scene as never, 16);
      expect(graphics.clears).toBe(clears);
      expect(graphics.fills).toBe(1);
      camera.width = 960;
      updateTimeTint(scene as never, 16);
      expect(graphics.fills).toBe(2);
      expect(graphics.clears).toBe(clears + 1);
      expect(graphics.lastRect).toEqual({ x: 0, y: 0, w: 960, h: 270 });
      updateTimeTint(scene as never, 16);
      expect(graphics.fills).toBe(2);
    });
  });
});

// test/titleParticles.test.ts
// 타이틀 파티클 순수 모델 검증 — fakeDom 에는 canvas 2D API 가 없으므로
// 렌더러 대신 좌표 모델의 결정론/개수/경계를 직접 검증한다.
describe("titleParticles", () => {
  isolateTimers();
  describe("title particle pure model", () => {
    it("is a deterministic function of (preset, density, t)", () => {
      const a = titleParticlePositions({ preset: "snow", density: 60 }, 1234);
      const b = titleParticlePositions({ preset: "snow", density: 60 }, 1234);
      expect(b).toEqual(a);

      const later = titleParticlePositions({ preset: "snow", density: 60 }, 1734);
      expect(later).not.toEqual(a);

      const fireA = titleParticlePositions({ preset: "fireflies", density: 100 }, 987);
      const fireB = titleParticlePositions({ preset: "fireflies", density: 100 }, 987);
      expect(fireB).toEqual(fireA);
    });

    it("maps density 0..100 to particle counts with the weather-model contract", () => {
      // 눈/비는 날씨 관례 상한 96 을 그대로 쓴다.
      expect(titleParticleCount("snow", 100)).toBe(TITLE_PARTICLE_MAX);
      expect(titleParticleCount("rain", 50)).toBe(TITLE_PARTICLE_MAX / 2);
      expect(titleParticleCount("snow", 0)).toBe(0);
      // 밀도 생략 = 기본 50.
      expect(titleParticleCount("snow", undefined)).toBe(
        titleParticleCount("snow", DEFAULT_TITLE_PARTICLE_DENSITY),
      );
      // 클램프: 0..100 밖 입력도 안전.
      expect(titleParticleCount("rain", 999)).toBe(TITLE_PARTICLE_MAX);
      expect(titleParticleCount("rain", -5)).toBe(0);
      // 반딧불은 별도 낮은 상한.
      expect(titleParticleCount("fireflies", 100)).toBe(TITLE_FIREFLY_MAX);
      expect(titleParticleCount("fireflies", 25)).toBe(Math.round(TITLE_FIREFLY_MAX * 0.25));
    });

    it("keeps every particle inside the extended 320x240 stage bounds over time", () => {
      const { width, height } = TITLE_PARTICLE_STAGE;
      for (const preset of ["snow", "rain", "fireflies"] as const) {
        for (const t of [0, 500, 5000, 123456]) {
          for (const point of titleParticlePositions({ preset, density: 100 }, t)) {
            // 눈/비는 화면 가장자리 밖 -16/-24 여유폭까지 허용(날씨 오버레이와 동일 눈금).
            expect(point.x).toBeGreaterThanOrEqual(-24);
            expect(point.x).toBeLessThanOrEqual(width + 24);
            expect(point.y).toBeGreaterThanOrEqual(-24);
            expect(point.y).toBeLessThanOrEqual(height + 24);
            expect(point.opacity).toBeGreaterThan(0);
            expect(point.opacity).toBeLessThanOrEqual(1);
            expect(point.size).toBeGreaterThan(0);
          }
        }
      }
    });

    it("gives fireflies a visible pulse (opacity varies over time for the same particle)", () => {
      const at = (t: number): number => titleParticlePositions({ preset: "fireflies", density: 10 }, t)[0]?.opacity ?? 0;
      const samples = new Set([at(0), at(400), at(800), at(1200)]);
      expect(samples.size).toBeGreaterThan(1);
    });

    it("creates a canvas without starting rAF when no 2D context exists (fakeDom contract)", () => {
      const restoreDom = installFakeDom();
      try {
        const canvas = renderWithFakeDom(() =>
          createTitleParticlesCanvas({ preset: "rain", density: 30 }) as unknown as HTMLElement,
        );
        expect(canvas).toBeInstanceOf(FakeElement);
        expect(canvas.tagName).toBe("CANVAS");
        expect(findByTestId(canvas, "title-particles") ?? canvas).toBeTruthy();
        expect(canvas.dataset.testid).toBe("title-particles");
        expect(canvas.dataset.titleParticlePreset).toBe("rain");
        expect(canvas.dataset.titleParticleDensity).toBe("30");
      } finally {
        restoreDom();
      }
    });
  });
});

describe("titleTextFit", () => {
  isolateTimers();
  describe("titleTextFit (jrpg-real-1 J05)", () => {
    it("keeps a short title at its base size on one line", () => {
      const fit = fitTitleText("버들항", { left: 20, basePx: 24, letterSpacingEm: 0.02 });
      expect(fit).toMatchObject({ fontPx: 24, lines: 1 });
    });

    it("shrinks or wraps a long title so its estimated width fits", () => {
      const text = "아르카디아 연대기: 버들나루와 고대 봉인";
      const fit = fitTitleText(text, { left: 20, basePx: 24, letterSpacingEm: 0.02 });
      const em = estimateTextEm(text, 0.02);
      expect(fit.fontPx * em).toBeLessThanOrEqual(fit.availablePx * fit.lines + 1);
      expect(fit.availablePx).toBeLessThanOrEqual(TITLE_STAGE_WIDTH);
    });

    it("fits a wide English subtitle inside the stage", () => {
      const fit = fitTitleSubtitle("A Chronicle Of Two Worlds And The Ashen Stone", { left: 20, basePx: 7, baseSpacingEm: 0.3 });
      expect(fit.lines).toBeGreaterThanOrEqual(1);
      expect(fit.letterSpacingEm).toBeLessThanOrEqual(0.3);
    });
  });
});

describe("touchLayout", () => {
  isolateTimers();
  const zero = { top: 0, right: 0, bottom: 0, left: 0 };
  describe("calculateTouchLayout (mobile touch play, 2026-10-24)", () => {
    it.each([
      ["iPhone 15 Safari portrait", 393, 659, { top: 0, right: 0, bottom: 0, left: 0 }],
      ["iPhone top-level with home bar", 393, 852, { top: 59, right: 0, bottom: 34, left: 0 }],
      ["Galaxy Z Fold 7 unfolded", 984, 1016, zero],
      ["Pixel 7 in the store iframe", 412, 795, zero],
    ])("portrait %s: stage on top, controls fully on screen below it", (_name, w, h, safe) => {
      const layout = calculateTouchLayout(w, h, 480, 270, safe);
      expect(layout.mode).toBe("portrait");
      const stageBottom = layout.stageTop + 270 * layout.scale;
      expect(layout.stageTop).toBeGreaterThanOrEqual(safe.top);
      // 조이스틱 위쪽(메뉴 줄 포함)은 무대 아래, 아래쪽은 안전 영역 위.
      expect(layout.controlsY - layout.stick / 2 - 52).toBeGreaterThanOrEqual(stageBottom - 0.5);
      expect(layout.controlsY + layout.stick / 2).toBeLessThanOrEqual(h - safe.bottom);
      expect(layout.stick).toBeGreaterThanOrEqual(112);
      expect(layout.stick).toBeLessThanOrEqual(136);
    });

    it.each([
      ["iPhone 15 landscape", 852, 393, { top: 0, right: 59, bottom: 21, left: 59 }],
      ["Pixel 7 landscape", 915, 412, zero],
      ["iPhone 13 landscape", 844, 390, zero],
    ])("landscape %s: controls sit in side gutters and never cover the stage", (_name, w, h, safe) => {
      const layout = calculateTouchLayout(w, h, 480, 270, safe);
      expect(layout.mode).toBe("landscape");
      // 무대는 좌우 조작 칸 사이에만 있다(2026-10-25 2판 — 조작이 게임을 덮지 않는다).
      expect(layout.stageLeft).toBeGreaterThanOrEqual(layout.gutter - 1);
      expect(layout.stageLeft + 480 * layout.scale).toBeLessThanOrEqual(w - layout.gutter + 1);
      expect(layout.stageTop + 270 * layout.scale).toBeLessThanOrEqual(h - safe.bottom + 0.5);
      // 칸은 A·B 묶음(120px)과 조이스틱이 들어갈 만큼 넓다.
      expect(layout.gutter).toBeGreaterThanOrEqual(124);
      expect(layout.stick).toBeLessThanOrEqual(layout.gutter);
      // 게임 화면은 1배보다 크다(폰 가로에서 데스크톱 모양을 비율대로 키운다).
      expect(layout.scale).toBeGreaterThan(1);
    });

    it("portrait phones below 1x get the 320x300 window panel at 1x", () => {
      const layout = calculateTouchLayout(393, 659, 480, 270, zero, { scaleMode: "integer" });
      expect(layout.scale).toBeLessThan(1);
      expect(layout.panel?.scale).toBe(1);
      expect(layout.panel!.top).toBeGreaterThanOrEqual(layout.stageTop);
    });

    // 제작 창은 320 칸 대신 칸이 들어갈 방 통째를 쓴다(2026-11-07 실제 플레이어 390×844 에서 이름이 한 글자씩 감겼다).
    it.each([
      ["iPhone 13 portrait", 390, 844],
      ["Android portrait", 412, 915],
    ])("%s: the window room is wider than the 320 slot, holds the slot, and ends above the menu row", (_name, w, h) => {
      const layout = calculateTouchLayout(w, h, 480, 270, zero);
      const p = layout.panel!;
      expect(p.room.width).toBeGreaterThan(320);
      expect(p.room.left + p.room.width).toBeLessThanOrEqual(w);
      expect(p.room.top).toBe(layout.stageTop);
      expect(p.top).toBeGreaterThanOrEqual(p.room.top);
      expect(p.top + p.height * p.scale).toBeLessThanOrEqual(p.room.top + p.room.height + 0.5);
      expect(p.room.top + p.room.height).toBeLessThanOrEqual(layout.controlsY - layout.stick / 2 - 52);
    });

    it("iPad mini uses the 1.5x step in portrait and landscape", () => {
      expect(calculateTouchLayout(768, 1024, 480, 270, zero, { scaleMode: "integer" }).scale).toBe(1.5);
      expect(calculateTouchLayout(1024, 768, 480, 270, zero, { scaleMode: "integer" }).scale).toBe(1.5);
      expect(calculateTouchLayout(1024, 768, 480, 270, zero, { scaleMode: "integer" }).panel).toBeNull();
    });

    // J33: 4:3 무대(320×240)는 폰 세로에서 1배를 넘어 예전엔 대사 독이 꺼지고 무대 아래 540px 가 비었다.
    it("4:3 stage above 1x on a portrait phone still docks the dialogue below the stage at stage scale", () => {
      const layout = calculateTouchLayout(390, 844, 320, 240, zero);
      expect(layout.scale).toBeGreaterThan(1);
      const stageBottom = layout.stageTop + 240 * layout.scale;
      expect(layout.dock).not.toBeNull();
      expect(layout.dock!.scale).toBeCloseTo(layout.scale);
      expect(layout.dock!.top).toBeGreaterThanOrEqual(stageBottom);
      // 독 아래에 조작(메뉴 줄 포함)이 그대로 들어간다.
      expect(layout.controlsY - layout.stick / 2 - 52).toBeGreaterThanOrEqual(layout.dock!.top + layout.dock!.height);
      expect(layout.controlsY + layout.stick / 2).toBeLessThanOrEqual(844);
    });
  });
});

describe("windowSkinSurfaces", () => {
  isolateTimers();
  // 고전 윈도스킨 대화창을 고른 게임은 메뉴·상점·타이틀 창에도 같은 9칸 그림을 쓴다(windowSkinSurfaces.css).
  // 유리(기본)·에메랄드 몬스터 화면은 표식이 붙지 않아 지금 화면 그대로다.
  describe("classic window skin surfaces", () => {
    let restoreDom: (() => void) | undefined;
    beforeEach(() => { restoreDom = installFakeDom(); store.replace(createBlankProject()); });
    afterEach(() => { restoreDom?.(); restoreDom = undefined; });

    it("marks surfaces only when the dialogue style is classic", () => {
      const node = document.createElement("div") as unknown as FakeElement;
      expect(markClassicWindowSkin(node as unknown as HTMLElement)).toBe(false);
      expect(node.dataset.windowSkin).toBeUndefined();
      store.update((draft) => { draft.system.dialogueStyle = "classic"; });
      expect(markClassicWindowSkin(node as unknown as HTMLElement)).toBe(true);
      expect(node.dataset.windowSkin).toBe("classic");
    });

    it("leaves the emerald monster style alone", () => {
      const project = createBlankProject();
      project.system.dialogueStyle = "classic";
      project.meta.oprnMonsterStyle = { version: 1, reference: "emerald" };
      expect(usesClassicWindowSkin(project)).toBe(false);
    });

    it("paints only under the classic marker", () => {
      const css = readFileSync("src/styles/runtime/windowSkinSurfaces.css", "utf8");
      const selectors = css.replace(/\/\*[\s\S]*?\*\//gu, "").split("}").map((block) => block.split("{")[0]!.trim()).filter(Boolean);
      expect(selectors.length).toBeGreaterThan(0);
      for (const selector of selectors) {
        for (const part of selector.split(/,(?![^(]*\))/u)) expect(part).toContain('[data-window-skin="classic"]');
      }
      expect(css).not.toMatch(/battle-/u);
    });

    it("store accepts only 96x96 system window skins", () => {
      expect(storeImageSizeProblem("system", 96, 96)).toBeNull();
      expect(storeImageSizeProblem("system", 160, 80)).not.toBeNull();
      expect(storeImageSizeProblem("system2", 80, 96)).toBeNull();
    });
  });
});

// Zone feedback is asked every play frame. Suppression used to walk the dialogue host and
// then the document once per overlay id, and an unchanged line rewrote its text node.
describe("zoneFeedbackFrame", () => {
  isolateTimers();
  const SUPPRESSING_TEST_IDS = [
    "dialogue-box",
    "battle-scene",
    "title-screen",
    "game-over-screen",
    "main-menu",
    "status-menu",
    "shop-scene",
    "inn-scene",
    "chest-scene",
    "ending-screen",
    // 숫자 입력창 뒤로 목표 안내가 비쳐 두 창이 겹쳐 보였다(d0b27522d4, 장부 hud #18·#37).
    "runtime-input-number",
  ] as const;
  let restoreDom: (() => void) | null = null;
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });
  function field(): FakeElement {
    restoreDom = installFakeDom();
    const host = new FakeElement("div");
    (document.body as unknown as FakeElement).append(host);
    return host;
  }
  function watch(host: FakeElement): { host: number; document: number; selector: string } {
    const counts = { host: 0, document: 0, selector: "" };
    const hostQuery = host.querySelector.bind(host);
    Object.assign(host, {
      querySelector: (selector: string) => {
        counts.host += 1;
        counts.selector = selector;
        return hostQuery(selector);
      },
    });
    const doc = host.ownerDocument as unknown as { querySelector(selector: string): FakeElement | null };
    const docQuery = doc.querySelector.bind(doc);
    Object.assign(doc, {
      querySelector: (selector: string) => {
        counts.document += 1;
        counts.selector = selector;
        return docQuery(selector);
      },
    });
    return counts;
  }
  function overlay(testId: string): FakeElement {
    const node = new FakeElement("div");
    node.dataset.testid = testId;
    return node;
  }
  describe("zone feedback frame", () => {
    it("scans a clear field once on the host and once on the document", () => {
      const host = field();
      const counts = watch(host);
      expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(false);
      expect(counts.host).toBe(1);
      expect(counts.document).toBe(1);
      expect(counts.selector.split(",")).toEqual(
        SUPPRESSING_TEST_IDS.map((id) => `[data-testid='${id}']`),
      );
      host.append(overlay("zone-feedback"));
      expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(false);
    });

    it("hides for an overlay inside a detached host without asking the document", () => {
      restoreDom = installFakeDom();
      const host = new FakeElement("div");
      host.append(overlay("dialogue-box"));
      const counts = watch(host);
      expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(true);
      expect(counts.host).toBe(1);
      expect(counts.document).toBe(0);
    });

    it("hides for every suppressing overlay, including one mounted outside the host", () => {
      const host = field();
      for (const testId of SUPPRESSING_TEST_IDS) {
        const node = overlay(testId);
        host.append(node);
        expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement), testId).toBe(true);
        node.remove();
      }
      const shop = overlay("shop-scene");
      (document.body as unknown as FakeElement).append(shop);
      const counts = watch(host);
      expect(feedbackSuppressedByOverlay(host as unknown as HTMLElement)).toBe(true);
      expect(counts.host).toBe(1);
      expect(counts.document).toBe(1);
      expect(feedbackSuppressedByOverlay(null)).toBe(true);
    });

    it("reuses the model while the message is stable and keeps an unchanged text node", () => {
      const host = field();
      const entries = [{ surface: "banner", message: "골목", durationMs: 0 }];
      const shown = updateZoneFeedback(createZoneFeedbackModel([]), {
        entries, nowMs: 0, prompt: "Z 조사", suppressed: false,
      });
      const idle = updateZoneFeedback(shown.model, {
        entries, nowMs: 16, prompt: "Z 조사", suppressed: false,
      });
      expect(idle.model).toBe(shown.model);
      expect(idle.effects).toBe(shown.effects);
      expect(idle.view.banner).toBe("골목");

      const expired = updateZoneFeedback(shown.model, {
        entries, nowMs: 1500, prompt: null, suppressed: false,
      });
      expect(expired.model).not.toBe(shown.model);
      expect(expired.view.banner).toBeNull();

      const dom = createZoneFeedbackDom(host as unknown as HTMLElement);
      const view: ZoneFeedbackView = {
        banner: "골목", toast: null, objective: "열쇠", prompt: "Z 조사", suppressed: false,
      };
      dom.render(view, []);
      const banner = host.querySelector("[data-testid='zone-feedback-banner']") as FakeElement;
      const text = banner.firstChild;
      let hiddenWrites = 0;
      let hidden = banner.hidden;
      Object.defineProperty(banner, "hidden", {
        configurable: true,
        get: () => hidden,
        set: (value: boolean) => { hiddenWrites += 1; hidden = value; },
      });
      dom.render(view, []);
      expect(banner.firstChild).toBe(text);
      expect(hiddenWrites).toBe(0);
      dom.render({ ...view, banner: "광장" }, []);
      expect(banner.textContent).toBe("광장");
      expect(banner.firstChild).not.toBe(text);

      const root = host.querySelector("[data-testid='zone-feedback']") as FakeElement;
      let removes = 0;
      const remove = root.remove.bind(root);
      Object.assign(root, { remove: () => { removes += 1; remove(); } });
      dom.render({ ...view, banner: "광장", suppressed: true }, []);
      dom.render({ ...view, banner: "광장", suppressed: true }, []);
      expect(removes).toBe(1);
      dom.destroy();
    });

    it("advances the cursor without copying the seen set when the same line is appended", () => {
      const entries = [{ surface: "banner", message: "골목", durationMs: 0 }];
      const shown = updateZoneFeedback(createZoneFeedbackModel([]), {
        entries, nowMs: 0, prompt: null, suppressed: false,
      });
      entries.push({ surface: "banner", message: "골목", durationMs: 0 });
      const repeated = updateZoneFeedback(shown.model, {
        entries, nowMs: 32, prompt: null, suppressed: false,
      });
      expect(repeated.model).not.toBe(shown.model);
      expect(repeated.model.cursor).toBe(2);
      expect(repeated.model.seen).toBe(shown.model.seen);
      expect(repeated.view.banner).toBe("골목");
    });

    it("still chimes once when a checkpoint toast arrives", () => {
      const entries = [{ surface: "checkpoint", message: "쉼터", durationMs: 1000 }];
      const chimed = updateZoneFeedback(createZoneFeedbackModel([]), {
        entries, nowMs: 0, prompt: null, suppressed: false,
      });
      expect(chimed.effects).toEqual([{ kind: "checkpointChime" }]);
      expect(chimed.view.toast).toBe("쉼터");
      const quiet = updateZoneFeedback(chimed.model, {
        entries, nowMs: 16, prompt: null, suppressed: false,
      });
      expect(quiet.model).toBe(chimed.model);
      expect(quiet.effects).toEqual([]);
      expect(quiet.view.toast).toBe("쉼터");
    });
  });
});
