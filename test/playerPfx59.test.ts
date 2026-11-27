import { describe, expect, it, vi, afterEach } from "vitest";
import { itemEffectSummary, renderStatusMenuDetailPanel, statusMenuHintClauses } from "@/player/playerStatusMenuDetailRenderer";
import { createBlankProject, createBlankMap, TILE } from "@/project/defaults";
import type { ItemRecord, ItemCaptureProfile, EventPage, GameEvent, Project, GameMap, Command } from "@/project/types";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession, changeFriendship, evalCondition, getMapTile, nextSessionRandom, setMapTileOverride } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { listStatusMenuCommandIds, createPlayerStatusMenuSnapshot, listStatusMenuGroupCommandIds, STATUS_MENU_COMMAND_IDS, statusMenuCommandLabel } from "@/player/playerStatusMenuModel";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { activeItemEffects } from "@/project/itemUsage";
import { canUseMenuItemOnActor, useItemFromMenu } from "@/player/playerItemUse";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { isolateTimers } from "./mergedTeardown";
import type { InventoryView } from "@/player/playerInventoryView";
import { actorFieldStateNames, KNOCKED_OUT_STATE_NAME } from "@/player/actorFieldStates";
import { formatFriendshipFeedback, friendshipTier, friendshipTierLabel, listFriendshipEntries } from "@/project/friendship";
import { type SaveSlotReadResult, applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";
import { deserialize, serialize, resolveEventPage } from "@/project/io";
import { combinationPartnersOf, combinationRecipeFor, combineItems } from "@/project/craftRecipes";
import { findFacedItemTarget } from "@/player/itemUseOnTarget";
import { createBattleRuntime } from "@/battle/runtime";
import { normalizeActorRecord } from "@/project/actorModel";
import { equippedBattleSkillIds, toggleSkillLoadout } from "@/project/skillLoadout";
import { giveMonster, swapMonsterPartyOrder, monsterBattleStats, monsterMaxHp } from "@/project/monsterCollection";
import { configureEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { monsterDexNote, monsterDexSpeciesIds, monsterJournalEntry, monsterSpeciesHabitats, recordMonsterSeen } from "@/project/monsterJournal";
import { habitatSummary } from "@/player/playerMonsterDexDetail";
import type { MonsterCollectAction } from "@/player/playerMonsterCollectTypes";
import { monsterBoxUnavailableReason, monsterMoveDescription, monsterTypeLabel } from "@/player/playerMonsterPartyModel";
import { recoveryPreview } from "@/player/shopPartyFit";
import { itemToGoods } from "@/player/playSceneShopGoods";
import { UNIT_FOOTPRINT, footprintBounds, nearestCellInRect, pointRect } from "@/project/footprint";
import { facingForDelta } from "@/player/playSceneAutonomousRouteDirection";
import { findBlockingEventOverlappingRect, findBlockingRuntimeEventAt, findBlockingRuntimeEventAtInMap, findEventOverlappingRect, findRuntimeEventAt, findRuntimeEventAtInMap, initialRuntimeEventPositions, runtimeEventView } from "@/project/runtimeEventState";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";
import { TILE_SIZE } from "@/assets/bundled";
import { characterSpriteX, characterSpriteY, footprintSpriteX } from "@/player/characterDepth";
import { store } from "@/project/store";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { emitRuntimeJuice, runtimeJuiceLog } from "@/player/runtimeJuice";
import { isCancelKey, isConfirmKey, moveCursorIndex, moveTitleSelection, navDirection, reduceStatusMenuKeyboard, type StatusMenuKeyboardState } from "@/player/runtimeKeyboardMenu";
import { createInterpreter } from "@/player/interpreter";
import { AUTORUN_REPEAT_LIMIT, type RuntimeSafetyStop } from "@/player/runtimeSafetyStop";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createProjectPackage, projectPackageFileName } from "@/project/package";
import { isOprnGameFile, OPRN_GAME_FILE_ACCEPT, pickOprnGameFile, readOprnGameFile } from "@/player/oprnGameFile";
import { exportedProjectId } from "@/player/exportProjectStoreShim";
import { resolveCommunitySaveScope, resolveExportSaveNamespace } from "@/player/exportSaveNamespace";
import { appendBattleReport, BATTLE_REPORT_LIMIT, BATTLE_REPORT_LINE_LIMIT, normalizeBattleReports } from "@/project/battleReports";
import { battleReportDetail } from "@/player/playerBattleReportDetail";
import fixture from "./fixtures/projects/battle-v3.json";
import { actorBattlers, battlerSnapshot, refreshActorBattlerDerivedStats } from "@/battle/battleBattlers";
import { formationDamage } from "@/battle/battleFormation";
import { applySkillLike } from "@/battle/battleDamage";
import { predictSkillDamage } from "@/battle/battlePredict";
import { formationDetail } from "@/player/playerFormationDetail";

describe("playerStatusMenuDetailRenderer", () => {
  isolateTimers();
  describe("craftShopItemEffect", () => {
    isolateTimers();
    // 제작 공방 창은 산출물 효과를 자료집 아이템 값에서 가방 상세와 같은 글로 만든다(손으로 쓴 문구 없음).
    // 효과가 없는 물건은 빈칸 자리표시 없이 줄 자체가 없어야 한다.
    function itemWith(patch: Partial<ItemRecord>): ItemRecord {
      const project = createBlankProject();
      const base = project.database.items[0]!;
      return {
        ...base,
        hpRecovery: { flat: 0, percentMax: 0 },
        mpRecovery: { flat: 0, percentMax: 0 },
        healStateIds: [],
        stateEffects: [],
        learnedSkillId: undefined,
        activateSkillId: undefined,
        ...patch,
      } as ItemRecord;
    }
    describe("craft window output effect line", () => {
      const project = createBlankProject();

      it("formats recovery values from the item data", () => {
        expect(itemEffectSummary(project, itemWith({ hpRecovery: { flat: 40, percentMax: 25 } }))).toBe("HP +40 · HP 25%");
        expect(itemEffectSummary(project, itemWith({ repelSteps: 60 }))).toBe("벌레퇴치 60걸음");
      });

      it("names the state an item cures by the database name", () => {
        const state = project.database.states[0]!;
        expect(itemEffectSummary(project, itemWith({ healStateIds: [state.id] }))).toBe(`치료 ${state.name}`);
      });

      it("returns nothing for an item without effects", () => {
        expect(itemEffectSummary(project, itemWith({}))).toBeUndefined();
      });
    });
  });
  describe("p0LifeLedgerUi", () => {
    isolateTimers();
    function ledgerRuntime() {
      const project = createBlankProject();
      const longName = "새벽 안개를 머금은 최고급 무지개 감자 ".repeat(5).trim();
      const item = normalizeItemRecord({ id: "item_ledger_crop", name: longName, scope: "none", price: 120 });
      project.database.items.push(item);
      project.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
      project.system.shipping = { enabled: true, allowedItemIds: [item.id] };
      project.system.bundles = [{
        id: "bundle_crop",
        name: "봄 작물 꾸러미",
        requirements: [{ itemId: item.id, count: 2 }],
      }];
      project.system.skillSystem = { enabled: true };
      project.database.lifeSkills = [{
        id: "life_farming",
        name: "농사",
        skillType: "farming",
        maxLevel: 10,
        levelUpRewards: [],
      }];
      project.system.makers = [{
        id: "maker_crop",
        name: "감자 가공기",
        inputs: [{ itemId: item.id, count: 1 }],
        outputs: [{ itemId: item.id, count: 1 }],
        durationMinutes: 30,
      }];
      const session = startSession(project, 301);
      session.inventory[item.id] = 5;
      return { project, session, item, longName };
    }
    describe("P0 life ledger status menu", () => {
      it("does not expose the optional record command for a legacy project", () => {
        const project = createBlankProject();
        expect(listStatusMenuCommandIds(project, startSession(project))).not.toContain("life-ledger");
      });

      it("renders five pointer/keyboard reachable tabs, generated artwork, and long names without truncating the text node", () => {
        const restoreDom = installFakeDom();
        try {
          const { project, session, longName } = ledgerRuntime();
          const selected: string[] = [];
          const detail = createStatusMenuDetail({
            project,
            session,
            selectedCommand: "life-ledger",
            lifeLedgerTab: "shipping",
            slots: [],
            waitModeEnabled: true,
            onSelectLifeLedgerTab: (tab) => selected.push(tab),
          });
          const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail));

          for (const tab of ["shipping", "bundles", "skills", "makers", "animals"]) {
            const button = findByTestId(panel, `life-ledger-tab-${tab}`);
            expect(button?.tagName).toBe("BUTTON");
            expect(button?.getAttribute("role")).toBe("tab");
          }
          expect(findByTestId(panel, "life-ledger-tab-shipping")?.getAttribute("aria-selected")).toBe("true");
          expect(findByTestId(panel, "life-ledger-artwork")?.getAttribute("src")).toContain("/assets/farming/life-ui/");
          expect(panel.textContent).toContain(longName);
          findByTestId(panel, "life-ledger-tab-bundles")?.click();
          expect(selected).toEqual(["bundles"]);
        } finally {
          restoreDom();
        }
      });

      it("deposits and withdraws real inventory through shipping APIs", () => {
        const restoreDom = installFakeDom();
        try {
          const { project, session, item } = ledgerRuntime();
          const mutations: boolean[] = [];
          const renderShipping = () => renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
            project,
            session,
            selectedCommand: "life-ledger",
            lifeLedgerTab: "shipping",
            slots: [],
            waitModeEnabled: true,
            onLifeLedgerMutation: (ok) => mutations.push(ok),
          })));

          findByTestId(renderShipping(), `life-ledger-shipping-deposit-${item.id}`)?.click();
          expect(session.inventory[item.id]).toBe(4);
          expect(session.shippingQueue?.[item.id]).toBe(1);
          findByTestId(renderShipping(), `life-ledger-shipping-withdraw-${item.id}`)?.click();
          expect(session.inventory[item.id]).toBe(5);
          expect(session.shippingQueue?.[item.id]).toBeUndefined();
          expect(mutations).toEqual([true, true]);
        } finally {
          restoreDom();
        }
      });

      it("contributes bundles and starts/collects makers through their pure APIs", () => {
        const restoreDom = installFakeDom();
        try {
          const { project, session, item } = ledgerRuntime();
          const detailFor = (lifeLedgerTab: "bundles" | "makers") => renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
            project,
            session,
            selectedCommand: "life-ledger",
            lifeLedgerTab,
            slots: [],
            waitModeEnabled: true,
          })));

          findByTestId(detailFor("bundles"), `life-ledger-bundle-bundle_crop-${item.id}`)?.click();
          expect(session.bundleContributions?.bundle_crop?.[item.id]).toBe(1);

          findByTestId(detailFor("makers"), "life-ledger-maker-maker_crop")?.click();
          expect(session.makerInstances?.["ledger:maker_crop"]?.status).toBe("processing");
          session.makerInstances!["ledger:maker_crop"] = {
            ...session.makerInstances!["ledger:maker_crop"]!,
            status: "ready",
          };
          const before = session.inventory[item.id];
          findByTestId(detailFor("makers"), "life-ledger-maker-maker_crop")?.click();
          expect(session.makerInstances?.["ledger:maker_crop"]?.status).toBe("idle");
          expect(session.inventory[item.id]).toBe(before + 1);
        } finally {
          restoreDom();
        }
      });

      it("shows empty tabs and stale records without crashing or mutating them", () => {
        const restoreDom = installFakeDom();
        try {
          const { project, session } = ledgerRuntime();
          project.system.makers = [];
          session.makerInstances = {
            stale: { instanceId: "stale", makerId: "deleted-maker", status: "ready", startedAtMinute: 0, readyAtMinute: 1 },
          };
          const frozen = structuredClone(session);
          const detail = createStatusMenuDetail({
            project,
            session,
            selectedCommand: "life-ledger",
            lifeLedgerTab: "makers",
            slots: [],
            waitModeEnabled: true,
          });
          const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail));
          expect(panel.textContent).toContain("등록된 가공 설비가 없습니다");
          expect(panel.textContent).toContain("삭제된 가공 설비");
          expect(session).toEqual(frozen);
        } finally {
          restoreDom();
        }
      });
    });
  });
  describe("p2LifeLedgerUi", () => {
    isolateTimers();
    function renderLedger(tab: "collections" | "museum", inventory = 0) {
      const project = p2LifeProject();
      const trout = project.database.items.find((item) => item.id === "item_trout")!;
      trout.name = "은빛 비늘이 아침 햇살에 반짝이는 강송어 도감 기록".repeat(3);
      const session = startSession(project, 1701);
      session.inventory.item_trout = inventory;
      session.collections!.item_trout = { discovered: true, shippedCount: 12, caughtCount: 4, donated: false };
      const mutations: boolean[] = [];
      const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: tab,
        slots: [],
        waitModeEnabled: true,
        onLifeLedgerMutation: (ok) => mutations.push(ok),
      })));
      return { project, session, trout, panel, mutations };
    }
    describe("P2 life ledger surface", () => {
      it("exposes collection and museum tabs with generated forage artwork and complete counts", () => {
        const restoreDom = installFakeDom();
        try {
          const { project, session, trout, panel } = renderLedger("collections");
          expect(listStatusMenuCommandIds(project, session)).toContain("life-ledger");
          for (const id of ["collections", "museum"]) {
            const tab = findByTestId(panel, `life-ledger-tab-${id}`);
            expect(tab?.tagName).toBe("BUTTON");
            expect(tab?.getAttribute("role")).toBe("tab");
          }
          expect(findByTestId(panel, "life-ledger-artwork")?.getAttribute("src")).toBe("/assets/farming/life-ui/foraging-card.png");
          expect(panel.textContent).toContain(trout.name);
          expect(panel.textContent).toContain("출하 12");
          expect(panel.textContent).toContain("낚시 4");
          expect(session.collections?.item_trout).toEqual({ discovered: true, shippedCount: 12, caughtCount: 4, donated: false });
        } finally {
          restoreDom();
        }
      });

      it("donates through the atomic museum API and disables repeated donation", () => {
        const restoreDom = installFakeDom();
        try {
          const first = renderLedger("museum", 1);
          findByTestId(first.panel, "life-ledger-museum-donate-item_trout")?.click();
          expect(first.mutations).toEqual([true]);
          expect(first.session.inventory.item_trout).toBeUndefined();
          expect(first.session.collections?.item_trout?.donated).toBe(true);
          expect(first.session.inventory.item_reward).toBe(2);
          expect(first.session.gold).toBe(50);

          const rerendered = renderWithFakeDom(() => renderStatusMenuDetailPanel(first.project, createStatusMenuDetail({
            project: first.project,
            session: first.session,
            selectedCommand: "life-ledger",
            lifeLedgerTab: "museum",
            slots: [],
            waitModeEnabled: true,
          })));
          expect(findByTestId(rerendered, "life-ledger-museum-donate-item_trout")?.getAttribute("disabled")).toBe("true");
          expect(rerendered.textContent).toContain("기부 완료");
        } finally {
          restoreDom();
        }
      });

      it("renders honest empty states without mutating the session", () => {
        const restoreDom = installFakeDom();
        try {
          const project = p2LifeProject();
          project.system.collections = { enabled: true, trackedItemIds: [] };
          project.database.fishSpecies = [];
          project.system.fishing = { enabled: false, spots: [] };
          project.system.seasonalForage = { enabled: false, areas: [] };
          project.system.museum = { enabled: true, eligibleItemIds: [], rewards: [] };
          const session = startSession(project, 1702);
          const frozen = structuredClone(session);
          const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
            project,
            session,
            selectedCommand: "life-ledger",
            lifeLedgerTab: "collections",
            slots: [],
            waitModeEnabled: true,
          })));
          expect(panel.textContent).toContain("수집 도감에 등록된 항목이 없습니다");
          expect(session).toEqual(frozen);
        } finally {
          restoreDom();
        }
      });
    });
  });
  describe("playerStatusMenuItemShowcase", () => {
    isolateTimers();
    const noopActions: PlayerStatusMenuActions = {
      onCommand: () => undefined,
      onOpenGroup: () => undefined,
      onSaveSlot: () => undefined,
      onLoadSlot: () => undefined,
      onSelectItemTarget: () => undefined,
      onUseItem: () => undefined,
      onSelectSkillActor: () => undefined,
      onSelectSkill: () => undefined,
      onSelectEquipmentActor: () => undefined,
      onSelectEquipmentSlot: () => undefined,
      onEquipItem: () => undefined,
      onUnequipItem: () => undefined,
      onToggleRow: () => undefined,
      onSelectFormationActor: () => undefined,
      onMoveFormationActor: () => undefined,
      onToggleMonsterView: () => undefined,
      onMoveMonster: () => undefined,
      onToggleWait: () => undefined,
      onToTitle: () => undefined,
    };
    function factValue(entry: { facts?: readonly { id: string; value: string }[] } | undefined, id: string): string | undefined {
      return entry?.facts?.find((fact) => fact.id === id)?.value;
    }
    const SEED_KEYS = ["attack", "defense", "mind", "agility"] as const satisfies readonly (keyof ItemRecord["seedParameterBonuses"])[];
    function metadataFixture(changes: Partial<ItemRecord> = {}) {
      const project = createBlankProject();
      const item = project.database.items.find((record) => record.id === "item_potion");
      if (!item) throw new Error("missing item_potion fixture");
      const [removed, added] = project.database.states;
      if (!removed || !added) throw new Error("missing two state fixtures");
      const skill = project.database.skills.at(-1);
      if (!skill) throw new Error("missing skill fixture");
      Object.assign(item, {
        type: "medicine", scope: "ally", occasion: "field", consumable: true, consumptionLimit: 1,
        skillId: undefined, learnedSkillId: undefined, activateSkillId: undefined,
        hpRecovery: { flat: 0, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
        healStateIds: [], stateEffects: [], usableActorIds: [], usableClassIds: [],
        ...changes,
      });
      const session = startSession(project, 42);
      session.inventory = { [item.id]: 2 };
      const actorId = session.partyActorIds[0];
      if (!actorId) throw new Error("missing party actor fixture");
      const vitals = session.actorVitals[actorId];
      if (!vitals) throw new Error("missing party actor vitals fixture");
      const secondActor = project.database.actors.find((actor) => actor.id !== actorId);
      if (!secondActor) throw new Error("missing second actor fixture");
      const detail = () => createStatusMenuDetail({
        project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
        onUseItem: () => undefined, onSelectItemTarget: () => undefined,
      });
      const fact = (id: string) => detail().entries.find((entry) => entry.testId === `status-menu-item-${item.id}`)?.facts?.find((entry) => entry.id === id);
      const text = (id: string) => {
        const restore = installFakeDom();
        try {
          const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
            project, session, slots: [], selectedCommand: "items", mode: "function",
            selectedDetailActionIndex: 0, actions: noopActions,
          }));
          return findByTestId(menu, `status-menu-item-fact-${id}`)?.textContent ?? "";
        } finally { restore(); }
      };
      return { project, session, item, actorId, vitals, secondActor, removed, added, skill, detail, fact, text };
    }
    describe("item showcase executable metadata regressions", () => {
      it("deduplicates removal IDs across both sources in first-occurrence order without changing use", () => {
        const f = metadataFixture();
        const third = f.project.database.states[2];
        if (!third) throw new Error("missing third state fixture");
        f.removed.name = "Removal-A-271";
        f.added.name = "Removal-B-389";
        third.name = "Removal-C-593";
        f.item.healStateIds = [f.added.id, f.removed.id, f.added.id];
        f.item.stateEffects = [
          { stateId: f.removed.id, operation: "remove", chance: 0 },
          { stateId: third.id, operation: "remove", chance: 0 },
          { stateId: f.added.id, operation: "remove", chance: 100 },
          { stateId: third.id, operation: "remove", chance: 37 },
        ];
        f.session.actorStateIds = { [f.actorId]: [f.removed.id, f.added.id, third.id] };
        const before = structuredClone(f.session);
        const effects = f.fact("effects")?.value;
        const text = f.text("effects");
        expect(f.session).toEqual(before);
        expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(true);
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        expect(f.session.actorStateIds[f.actorId]).toEqual([]);
        expect(f.session.inventory[f.item.id]).toBe(1);
        expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(false);
        expect(effects?.split(",")).toEqual([f.added.id, f.removed.id, third.id].map((id) => `heal:${encodeURIComponent(id)}`));
        for (const state of [f.added, f.removed, third]) {
          expect(text.split(state.name)).toHaveLength(2);
        }
        expect(text.indexOf(f.added.name)).toBeLessThan(text.indexOf(f.removed.name));
        expect(text.indexOf(f.removed.name)).toBeLessThan(text.indexOf(third.name));
      });

      it("keeps add-state probability separate from duplicate removals of the same ID", () => {
        const f = metadataFixture();
        f.item.healStateIds = [f.removed.id, f.removed.id];
        f.item.stateEffects = [
          { stateId: f.removed.id, operation: "add", chance: 100 },
          { stateId: f.removed.id, operation: "remove", chance: 0 },
        ];
        f.session.actorStateIds = { [f.actorId]: [f.removed.id] };
        const effects = f.fact("effects")?.value;
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        expect(f.session.actorStateIds[f.actorId]).toEqual([f.removed.id]);
        expect(f.session.inventory[f.item.id]).toBe(1);
        expect(effects?.split(",")).toEqual([
          `heal:${encodeURIComponent(f.removed.id)}`,
          `state:${encodeURIComponent(f.removed.id)}:100`,
        ]);
      });

      it("groups consecutive heal prefixes while keeping unique resolved names and other effect kinds", () => {
        const f = metadataFixture();
        const states = f.project.database.states.slice(0, 8);
        if (states.length < 8) throw new Error("need eight state fixtures");
        f.item.healStateIds = states.map((state) => state.id);
        f.item.stateEffects = [];
        f.item.hpRecovery = { flat: 12, percentMax: 0 };
        const text = f.text("effects");
        expect(text.match(/치료/g)?.length ?? 0).toBe(1);
        expect(text).toContain(`HP +12`);
        expect(text.indexOf("HP +12")).toBeLessThan(text.indexOf("치료"));
        for (const state of states) {
          expect(text.split(state.name)).toHaveLength(2);
        }
        f.item.healStateIds = [states[0].id];
        f.item.stateEffects = [{ stateId: states[1].id, operation: "add", chance: 40 }];
        const mixed = f.text("effects");
        expect(mixed).toContain(states[0].name);
        expect(mixed).toContain(states[1].name);
        expect(mixed).toContain("40%");
        expect(mixed).toContain("치료");
        expect(mixed).toContain("상태");
      });

      it("retains zero-chance removal while excluding impossible additions, matching eligibility and mutation", () => {
        const f = metadataFixture();
        const { removed, added } = f;
        f.item.stateEffects = [
          { stateId: removed.id, operation: "remove", chance: 0 },
          { stateId: added.id, operation: "add", chance: 0 },
        ];
        f.session.actorStateIds = { [f.actorId]: [removed.id] };
        expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(true);
        const before = structuredClone(f.session);
        const effects = f.fact("effects")?.value;
        expect(f.session).toEqual(before);
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        expect(f.session.actorStateIds[f.actorId]).toEqual([]);
        expect(f.session.inventory[f.item.id]).toBe(1);
        expect(canUseMenuItemOnActor(f.project, f.session, f.item, f.actorId)).toBe(false);
        expect(effects).toContain(`heal:${removed.id}`);
        expect(effects).not.toContain(`state:${added.id}`);
      });

      it.each(["switch", "special"] as const)("ignores stale restriction arrays after changing medicine to %s", (type) => {
        const f = metadataFixture({ usableActorIds: ["other-actor"], usableClassIds: ["other-class"] });
        expect(f.fact("eligibility")?.value).toBe("restricted");
        f.item.type = type;
        f.item.switchId = "metadata-switch";
        f.item.stateEffects = [{ stateId: f.added.id, operation: "add", chance: 100 }];
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        if (type === "switch") expect(f.session.switches[f.item.switchId]).toBe(true);
        else expect(f.session.actorStateIds?.[f.actorId]).toContain(f.added.id);
        expect(f.fact("eligibility")?.value).toBe("usable");
      });

      it("renders resolved state identities and add chances as safe text", () => {
        const f = metadataFixture();
        const { removed, added } = f;
        removed.name = "Cure <b>A</b>,: 271";
        added.name = "Ward <img src=x> 389";
        f.item.healStateIds = [removed.id];
        const effect: ItemRecord["stateEffects"][number] = { stateId: added.id, operation: "add", chance: 37 };
        f.item.stateEffects = [effect];
        const text = f.text("effects");
        expect(text).toContain(removed.name);
        expect(text).toContain(added.name);
        expect(text).toContain(`${effect.chance}%`);
      });

      it.each(["book", "special", "switch"] as const)("resolves %s effect identity including legacy skillId", (type) => {
        const f = metadataFixture({ type });
        const { skill } = f;
        skill.name = "Record <strong>593</strong>";
        f.item.skillId = skill.id;
        f.item.learnedSkillId = undefined;
        f.item.activateSkillId = undefined;
        const switchDef = { id: "metadata-switch", name: "Gate <b>617</b>" };
        f.project.switches.push(switchDef);
        f.item.switchId = switchDef.id;
        expect(f.text("effects")).toContain(type === "switch" ? switchDef.name : skill.name);
      });

      it.each(["feed", "toy"] as const)("shows %s care amounts", (kind) => {
        const careProfile = { kind, friendshipDelta: 17, expDelta: 43 };
        const f = metadataFixture({ type: "special", careProfile });
        const text = f.text("effects");
        expect(text).toContain(`+${careProfile.friendshipDelta}`);
        expect(text).toContain(`+${careProfile.expDelta}`);
      });

      it.each(["rm2k3", undefined] as const)("shows capture multiplier for battle model %s", (battleModel) => {
        const captureProfile: ItemCaptureProfile = { multiplier: 2.75, ballClass: "master" };
        const f = metadataFixture({ type: "special", captureProfile });
        f.project.system.battleModel = battleModel;
        const initialText = f.text("effects");
        expect(initialText).toContain(String(captureProfile.multiplier));
        expect(initialText).not.toContain(captureProfile.ballClass);
        captureProfile.ballClass = "poke";
        expect(f.text("effects")).toBe(initialText);
        captureProfile.multiplier = 4.25;
        expect(f.text("effects")).toContain(String(captureProfile.multiplier));
        expect(f.text("effects")).not.toBe(initialText);
      });

      it.each(["poke", "great", "ultra", "master", undefined] as const)("shows effective Gen1 capture class %s without inactive multiplier", (ballClass) => {
        const captureProfile: ItemCaptureProfile = { multiplier: 2.75, ballClass };
        const f = metadataFixture({ type: "special", captureProfile });
        f.project.system.battleModel = "gen1";
        const effectiveClass = ballClass ?? "poke";
        expect(f.fact("effects")?.value).toBe(`capture-class:${effectiveClass}`);
        expect(f.text("effects")).toContain(effectiveClass);
        expect(f.text("effects")).not.toContain(String(captureProfile.multiplier));
      });

      it("keeps Gen1 capture details invariant when only the inactive multiplier changes", () => {
        const captureProfile: ItemCaptureProfile = { multiplier: 2.75, ballClass: "great" };
        const f = metadataFixture({ type: "special", captureProfile });
        f.project.system.battleModel = "gen1";
        const initialText = f.text("effects");
        const initialFacts = f.fact("effects");
        captureProfile.multiplier = 4.25;
        expect(f.text("effects")).toBe(initialText);
        expect(f.fact("effects")).toEqual(initialFacts);
      });

      it("distinguishes all Gen1 capture classes and defaults an omitted class to poke", () => {
        const captureProfile: ItemCaptureProfile = { multiplier: 2.75 };
        const f = metadataFixture({ type: "special", captureProfile });
        f.project.system.battleModel = "gen1";
        const defaultText = f.text("effects");
        const classTexts = ["poke", "great", "ultra", "master"] as const;
        const rendered = classTexts.map((ballClass) => {
          captureProfile.ballClass = ballClass;
          return f.text("effects");
        });
        expect(new Set(rendered).size).toBe(classTexts.length);
        expect(rendered[0]).toBe(defaultText);
      });

      it("shows each seed parameter with signed amounts and matches the actual negative mutation", () => {
        const f = metadataFixture({ type: "seed", seedParameterBonuses: { attack: -7, defense: 13, mind: 19, agility: 23 } });
        const text = f.text("effects");
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        for (const key of SEED_KEYS) {
          const delta = f.item.seedParameterBonuses[key];
          expect(f.session.actorParamBonuses?.[f.actorId]?.[key]).toBe(delta);
          expect(text).toContain(`${delta > 0 ? "+" : ""}${delta}`);
          expect(f.fact("effects")?.value).toContain(`seed:${key}:${delta}`);
        }
        expect(new Set(f.fact("effects")?.value.split(",")).size).toBe(4);
        // Equal amounts must still be distinguishable by their data-derived parameter labels.
        const parameterTexts = SEED_KEYS.map((key) => {
          f.item.seedParameterBonuses = { attack: 0, defense: 0, mind: 0, agility: 0, [key]: 11 };
          return f.text("effects");
        });
        expect(new Set(parameterTexts).size).toBe(4);
      });

      it.each([
        { type: "medicine", scope: "ally", dead: false, target: "ally" },
        { type: "medicine", scope: "allAllies", dead: false, target: "allAllies" },
        { type: "medicine", scope: "allAllies", dead: true, target: "allAllies" },
        { type: "book", scope: "allAllies", dead: true, target: "ally" },
        { type: "seed", scope: "allAllies", dead: true, target: "ally" },
        { type: "switch", scope: "allAllies", dead: true, target: "none" },
        { type: "book", scope: "none", dead: false, target: "ally" },
        { type: "seed", scope: "none", dead: false, target: "ally" },
      ] as const)("projects effective targeting $type/$scope/dead=$dead", ({ type, scope, dead, target }) => {
        const f = metadataFixture({ type, scope, onlyEffectiveOnDeadActors: dead,
          seedParameterBonuses: { attack: -7, defense: 0, mind: 0, agility: 0 } });
        f.item.learnedSkillId = f.skill.id;
        f.item.switchId = "metadata-switch";
        expect(f.fact("eligibility")?.targeting).toEqual({ scope: target, deadOnly: type === "medicine" && dead });
        const secondId = f.secondActor.id;
        f.session.partyActorIds = [f.actorId, secondId];
        f.session.actorSkillIds = { [f.actorId]: [], [secondId]: [] };
        f.session.actorParamBonuses = {};
        f.session.actorVitals[f.actorId] = { hp: dead ? 0 : 1, maxHp: 100, mp: 10, maxMp: 10 };
        f.session.actorVitals[secondId] = { hp: 1, maxHp: 100, mp: 10, maxMp: 10 };
        f.item.hpRecovery = { flat: 9, percentMax: 0 };
        expect(useItemFromMenu(f.project, f.session, f.item.id, target === "none" ? undefined : f.actorId).kind).toBe("used");
        if (type === "book") {
          expect(f.session.actorSkillIds[f.actorId]).toContain(f.item.learnedSkillId);
          expect(f.session.actorSkillIds[secondId]).toEqual([]);
        } else if (type === "seed") {
          expect(f.session.actorParamBonuses[f.actorId]?.attack).toBe(-7);
          expect(f.session.actorParamBonuses[secondId]).toBeUndefined();
        } else if (type === "switch") expect(f.session.switches[f.item.switchId]).toBe(true);
        else {
          expect(f.session.actorVitals[f.actorId]?.hp).toBe(dead ? 9 : 10);
          expect(f.session.actorVitals[secondId]?.hp).toBe(scope === "allAllies" && !dead ? 10 : 1);
        }
      });

      it("distinguishes target cases in rendered text without pinning copy", () => {
        const f = metadataFixture();
        const single = f.text("target");
        f.item.scope = "allAllies";
        const all = f.text("target");
        f.item.onlyEffectiveOnDeadActors = true;
        const dead = f.text("target");
        f.item.type = "switch";
        const none = f.text("target");
        expect(new Set([single, all, dead, none]).size).toBe(4);
      });

      it("projects FIFO remaining uses across partially charged and fresh copies without mutating session", () => {
        const f = metadataFixture({ consumptionLimit: 3, hpRecovery: { flat: 1, percentMax: 0 } });
        f.session.itemUseCharges = { [f.item.id]: 2 };
        const before = structuredClone(f.session);
        const fact = f.fact("eligibility");
        const text = f.text("consumption");
        expect(f.session).toEqual(before);
        expect(fact?.consumption).toEqual({ consumable: true, usesPerCopy: 3, remainingCopyUses: 1, remainingUses: 4 });
        expect(text).toContain("1/3");
        expect(text).toMatch(/\b4\b/);
        f.vitals.hp = 1;
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        expect(f.session.inventory[f.item.id]).toBe(1);
        expect(f.session.itemUseCharges[f.item.id]).toBeUndefined();
        expect(f.fact("eligibility")?.consumption).toEqual({ consumable: true, usesPerCopy: 3, remainingCopyUses: 3, remainingUses: 3 });
        expect(f.text("consumption")).toContain("3/3");
      });

      it("distinguishes reusable from one-use consumables despite stale finite-use settings", () => {
        const f = metadataFixture({ consumptionLimit: "noLimit", hpRecovery: { flat: 1, percentMax: 0 } });
        const consumableText = f.text("consumption");
        expect(f.fact("eligibility")?.consumption).toEqual({ consumable: true, usesPerCopy: 1, remainingCopyUses: 1, remainingUses: 2 });
        f.item.consumable = false;
        f.item.consumptionLimit = 5;
        f.session.itemUseCharges = { [f.item.id]: 2 };
        expect(f.fact("eligibility")?.consumption).toEqual({ consumable: false });
        expect(f.text("consumption")).not.toBe(consumableText);
        const reusableText = f.text("consumption");
        f.item.consumptionLimit = 3;
        f.session.itemUseCharges[f.item.id] = 1;
        expect(f.text("consumption")).toBe(reusableText);
        f.vitals.hp = 1;
        expect(useItemFromMenu(f.project, f.session, f.item.id, f.actorId).kind).toBe("used");
        expect(f.session.inventory[f.item.id]).toBe(2);
      });
    });
    describe("status menu inventory showcase parity", () => {
      it("exposes authored icon, count, type, effects, and use eligibility on the selected item", () => {
        const restoreDom = installFakeDom();
        try {
          const project = createBlankProject();
          const session = startSession(project);
          const potion = project.database.items.find((record) => record.id === "item_potion");
          if (!potion) throw new Error("missing item_potion fixture");
          session.inventory[potion.id] = 3;
          const item = activeItemEffects(potion);

          const detail = createStatusMenuDetail({
            project,
            session,
            slots: [],
            waitModeEnabled: true,
            selectedCommand: "items",
            onSelectItemTarget: () => undefined,
            onUseItem: () => undefined,
          });
          const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-item-${potion.id}`);
          expect(entry?.icon?.resourceId).toBe(potion.iconResourceId ?? potion.imageResourceId);
          expect(entry?.value).toBe("3개");
          expect(factValue(entry, "type")).toBe(item.type);
          expect(factValue(entry, "effects")).toContain(`hp:${item.hpRecovery.flat}`);
          expect(factValue(entry, "eligibility")).toBe("usable");

          const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail, {
            showcase: true,
            selectedActionIndex: 0,
          }));
          expect(findByTestId(panel, "status-menu-detail-showcase")).not.toBeNull();
          expect(findByTestId(panel, "status-menu-showcase-art")).not.toBeNull();
          expect(findByTestId(panel, "status-menu-showcase-name")?.textContent).toBe(item.name);
          expect(findByTestId(panel, "status-menu-item-fact-effects")?.textContent).toContain(`HP +${item.hpRecovery.flat}`);
        } finally {
          restoreDom();
        }
      });

      it("marks a battle-only item ineligible without dropping it from keyboard selection", () => {
        const restoreDom = installFakeDom();
        try {
          const project = createBlankProject();
          const session = startSession(project);
          const potion = project.database.items.find((record) => record.id === "item_potion");
          if (!potion) throw new Error("missing item_potion fixture");
          potion.occasion = "battle";
          session.inventory[potion.id] = 1;

          const detail = createStatusMenuDetail({
            project,
            session,
            slots: [],
            waitModeEnabled: true,
            selectedCommand: "items",
            onSelectItemTarget: () => undefined,
            onUseItem: () => undefined,
          });
          const entry = detail.entries.find((candidate) => candidate.testId === `status-menu-item-${potion.id}`);
          expect(entry?.onActivate).toBeTypeOf("function");
          expect(factValue(entry, "eligibility")).toBe("battle");
          expect(entry?.unavailableReason).toBeTruthy();

          const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, detail, {
            showcase: true,
            selectedActionIndex: 0,
          }));
          expect(findByTestId(panel, "status-menu-showcase-description")?.textContent).toBe(entry?.unavailableReason);
        } finally {
          restoreDom();
        }
      });

      it("keeps the production items work panel showcase wired the same way as equipment", () => {
        const restoreDom = installFakeDom();
        try {
          const project = createBlankProject();
          const session = startSession(project);
          const potion = project.database.items.find((record) => record.id === "item_potion");
          if (!potion) throw new Error("missing item_potion fixture");
          session.inventory[potion.id] = 2;
          const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
            project,
            session,
            slots: [],
            selectedCommand: "items",
            mode: "function",
            selectedDetailActionIndex: 0,
            actions: noopActions,
          }));
          expect(findByTestId(menu, "status-menu-detail")?.className).toContain("has-showcase");
          expect(findByTestId(menu, "status-menu-detail-showcase")).not.toBeNull();
          expect(findByTestId(menu, "status-menu-item-facts")?.className.split(/\s+/)).toContain("status-menu-item-facts");
          expect(findByTestId(menu, "status-menu-item-fact-effects")?.textContent).toContain(`HP +${activeItemEffects(potion).hpRecovery.flat}`);
          expect(findByTestId(menu, "status-menu-item-fact-target")?.textContent).toMatch(/\S/);
          expect(findByTestId(menu, "status-menu-item-fact-consumption")?.textContent).toMatch(/\S/);
          expect(findByTestId(menu, "status-menu-entry-icon-item-item_potion")).not.toBeNull();
        } finally {
          restoreDom();
        }
      });
    });
  });
  describe("statusMenuHintClauses", () => {
    isolateTimers();
    describe("statusMenuHintClauses", () => {
      it("marks every clause of a keys-only hint so touch devices can hide the whole line", () => {
        const clauses = statusMenuHintClauses("↑↓로 임무 목록을 읽습니다. ← 메뉴로 돌아갑니다.");
        expect(clauses.map((c) => c.key)).toEqual([true, true]);
      });

      it("keeps key-free clauses visible and marks only the key clause", () => {
        const clauses = statusMenuHintClauses("설명은 커서를 올리면 아래에 보입니다. 필드 스킬만 Enter로 사용합니다.");
        expect(clauses.map((c) => c.key)).toEqual([false, true]);
        expect(statusMenuHintClauses("파티원을 선택하세요.").map((c) => c.key)).toEqual([false]);
      });

      it("joins back to the original text so desktop shows the same hint", () => {
        for (const hint of ["Enter 사용 · Esc 아이템 목록", "목록 끝에서 분류·정렬 변경 · ↑↓ 이동 · Enter 선택", "결정 키로 화면 가득 봅니다. 연 뒤 좌우로 넘깁니다."]) {
          expect(statusMenuHintClauses(hint).map((c) => c.text).join("")).toBe(hint);
        }
      });
    });
  });
});

describe("playerStatusMenuDetails", () => {
  isolateTimers();
  describe("feature16PlayerInventory", () => {
    isolateTimers();
    function fixture() {
      const project = createBlankProject();
      const a = project.database.items[0]!;
      const b = project.database.items[1]!;
      Object.assign(a, { type: 'medicine', occasion: 'field', name: '가 약' });
      Object.assign(b, { type: 'normalGoods', name: '나 물품' });
      const equipment = project.database.equipment[0]!;
      const session = startSession(project);
      session.inventory = { [a.id]: 2, [b.id]: 8, [equipment.id]: 3, missing_record: 4 };
      const detail = (filter: InventoryView['filter'], sort: InventoryView['sort'] = 'default') => createStatusMenuDetail({
        project, session, slots: [], selectedCommand: 'items', waitModeEnabled: true,
        inventoryView: { filter, sort }, onInventoryViewChange() {}, onUseItem() {}, onSelectItemTarget() {},
      });
      return { project, session, a, b, equipment, detail };
    }
    describe('inventory display projection', () => {
      it('filters every category without changing quantities, charges, equipment or unknown stacks', () => {
        const f = fixture(), before = structuredClone(f.session);
        expect(f.detail('usable').entries.map(e => e.testId)).toContain(`status-menu-item-${f.a.id}`);
        expect(f.detail('usable').entries.map(e => e.testId)).not.toContain(`status-menu-item-${f.b.id}`);
        expect(f.detail('equipment').entries.map(e => e.testId)).toContain(`status-menu-owned-equipment-${f.equipment.id}`);
        expect(f.detail('other').entries.map(e => e.testId)).toContain('status-menu-item-missing_record');
        for (const sort of ['default', 'name', 'quantity'] as const) {
          const rows = f.detail('all', sort).entries;
          for (const id of [f.a.id, f.b.id, 'missing_record']) expect(rows.map(e => e.testId)).toContain(`status-menu-item-${id}`);
        }
        expect(f.session).toEqual(before);
      });
      it('uses the existing equipment classification for legacy item records too', () => {
        const f = fixture();
        f.b.type = 'weapon';
        expect(f.detail('equipment').entries.map(e => e.testId)).toContain(`status-menu-item-${f.b.id}`);
        expect(f.detail('other').entries.map(e => e.testId)).not.toContain(`status-menu-item-${f.b.id}`);
      });
      it('sorts names and numeric quantities while keeping control rows last', () => {
        const f = fixture();
        const rows = f.detail('all', 'quantity').entries.filter(e => e.testId?.startsWith('status-menu-item-'));
        expect(rows.map(e => e.testId)).toEqual([`status-menu-item-${f.b.id}`, 'status-menu-item-missing_record', `status-menu-item-${f.a.id}`]);
        const names = f.detail('all', 'name').entries.filter(e => [f.a.name, f.b.name].includes(e.label));
        expect(names.map(e => e.label)).toEqual([f.a.name, f.b.name]);
        expect(f.detail('all').entries.slice(-2).map(e => e.testId)).toEqual(['inventory-filter', 'inventory-sort']);
      });
      it('keeps controls accessible for empty inventory and does not inject them into target selection', () => {
        const f = fixture();
        f.session.inventory = {};
        expect(f.detail('usable').entries.map(e => e.testId)).toEqual(['inventory-filter-empty', 'inventory-filter', 'inventory-sort']);
        const targets = createStatusMenuDetail({ project: f.project, session: f.session, slots: [], selectedCommand: 'items', waitModeEnabled: true, targetItemId: f.a.id });
        expect(targets.entries.some(e => e.testId === 'inventory-filter')).toBe(false);
      });
    });
  });
  // J7: HP 0 인 파티원은 필드 메뉴(파티 개요·회복약 대상)에서 「정상」이 아니라 「전투불능」으로 보인다.
  describe("fieldMenuKnockedOutState", () => {
    isolateTimers();
    function knockedOutParty() {
      const project = createBlankProject();
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.actorVitals[actorId] = { ...session.actorVitals[actorId]!, hp: 0 };
      return { project, session, actorId };
    }
    describe("필드 메뉴의 전투불능 표시", () => {
      it("HP 0 이면 상태 이름 맨 앞에 전투불능을 붙인다", () => {
        const { project, session, actorId } = knockedOutParty();
        expect(actorFieldStateNames(project, session, actorId)).toEqual([KNOCKED_OUT_STATE_NAME]);
        session.actorVitals[actorId] = { ...session.actorVitals[actorId]!, hp: 1 };
        expect(actorFieldStateNames(project, session, actorId)).toEqual([]);
      });

      it("파티 개요 행의 상태가 정상이 아니다", () => {
        const { project, session, actorId } = knockedOutParty();
        const row = createPlayerStatusMenuSnapshot(project, session).partyRows.find((entry) => entry.actorId === actorId)!;
        expect(row.stateNames).toContain(KNOCKED_OUT_STATE_NAME);
        expect(row.condition).toBe(KNOCKED_OUT_STATE_NAME);
      });

      it("회복약 대상 카드도 전투불능을 보인다", () => {
        const { project, session, actorId } = knockedOutParty();
        const potion = project.database.items.find((item) => item.id === "item_potion")!;
        session.inventory[potion.id] = 2;
        const detail = createStatusMenuDetail({ project, session, selectedCommand: "items", targetItemId: potion.id, slots: [], waitModeEnabled: true } as Parameters<typeof createStatusMenuDetail>[0]);
        const entry = detail.entries.find((candidate) => candidate.vitals && candidate.label === project.database.actors.find((actor) => actor.id === actorId)!.name)!;
        expect(entry.vitals?.stateNames).toContain(KNOCKED_OUT_STATE_NAME);
      });
    });
  });
  describe("friendshipPresentation", () => {
    isolateTimers();
    describe("friendship presentation", () => {
      it("maps friendshipTier bounds at 0, mid, and max", () => {
        expect(friendshipTier(0)).toBe(0);
        expect(friendshipTier(-10)).toBe(0);
        expect(friendshipTier(500)).toBe(5);
        expect(friendshipTier(999)).toBe(9);
        expect(friendshipTier(1000)).toBe(10);
        expect(friendshipTier(1200)).toBe(10);
        expect(friendshipTierLabel(0)).toBe("무관심");
        expect(friendshipTierLabel(3)).toBe("친구");
      });

      it("formats non-empty friendship feedback for a positive gift delta", () => {
        const feedback = formatFriendshipFeedback({ delta: 80, friendship: 80 });
        expect(feedback.length).toBeGreaterThan(0);
        expect(feedback).toContain("호감");
        expect(feedback).toContain("+80");
        expect(feedback).toMatch(/\(0\/10\)/);
      });

      it("lists no relationship entries without friendship keys, then shows keys after changeFriendship", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const slots: readonly SaveSlotReadResult[] = [];

        expect(listFriendshipEntries(session.friendship)).toEqual([]);
        const emptyDetail = createStatusMenuDetail({
          project,
          session,
          selectedCommand: "relationships",
          slots,
          waitModeEnabled: true,
        });
        expect(emptyDetail.title).toBe("관계");
        expect(emptyDetail.entries).toEqual([]);
        expect(emptyDetail.emptyLabel).toBe("알려진 관계가 없습니다.");

        changeFriendship(session, "char_farmer", 240);
        changeFriendship(session, "char_miner", 80);

        const entries = listFriendshipEntries(session.friendship);
        expect(entries.map((entry) => entry.key)).toEqual(["char_farmer", "char_miner"]);
        expect(entries[0]?.secondary).toMatch(/\(2\/10\) · 240/);
        expect(entries[1]?.secondary).toMatch(/\(0\/10\) · 80/);

        const detail = createStatusMenuDetail({
          project,
          session,
          selectedCommand: "relationships",
          slots,
          waitModeEnabled: true,
        });
        expect(detail.entries.map((entry) => entry.label)).toEqual(["char_farmer", "char_miner"]);
        expect(detail.entries[0]?.value).toContain("240");
        expect(detail.entries[0]?.testId).toBe("status-menu-relationship-char_farmer");
      });

      it("registers the relationships status menu command as 관계", () => {
        expect(STATUS_MENU_COMMAND_IDS).toContain("relationships");
        expect(statusMenuCommandLabel("relationships", true)).toBe("관계");
      });

      it("gates relationships command unless giftSystem or friendship keys", () => {
        const project = createBlankProject();
        const session = startSession(project);
        expect(listStatusMenuCommandIds(project, session)).not.toContain("relationships");
        project.system.giftSystem = true;
        expect(listStatusMenuCommandIds(project, session)).toContain("relationships");
        project.system.giftSystem = false;
        session.friendship = { char_a: 10 };
        expect(listStatusMenuCommandIds(project, session)).toContain("relationships");
        // 레일에는 접힌 "기록 ▸" 만 오고, 관계는 그 그룹 목록에 들어간다.
        const snap = createPlayerStatusMenuSnapshot(project, session);
        expect(snap.commands.some((c) => c.id === "record-menu")).toBe(true);
        expect(listStatusMenuGroupCommandIds("record-menu", project, session)).toContain("relationships");
      });
    });
  });
  describe("mgL7sysItemCombineUse", () => {
    isolateTimers();
    function page(overrides: Partial<EventPage> = {}): EventPage {
      return {
        id: "page-talk",
        name: "대화",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", body: "문이 잠겨 있다." }],
        ...overrides,
      };
    }
    function lockedDoor(x: number, y: number): GameEvent {
      return {
        id: "ev_door",
        x,
        y,
        trigger: { kind: "action" },
        commands: [],
        pages: [
          page(),
          page({
            id: "page-key",
            name: "열쇠 사용",
            conditions: [{ kind: "itemUsed", itemId: "item_old_key" }],
            commands: [{ kind: "changeItem", itemId: "item_old_key", op: "-=", amount: 1 }, { kind: "text", body: "문이 열렸다." }],
          }),
        ],
      };
    }
    function combineProject(): Project {
      const project = createBlankProject();
      project.system.craftRecipes = [
        { id: "rc_hi", name: "혼합약", ingredients: [{ itemId: "item_potion", count: 1 }, { itemId: "item_ether", count: 1 }], outputItemId: "item_hi_potion" },
        { id: "rc_double", ingredients: [{ itemId: "item_antidote", count: 2 }], outputItemId: "item_wake_herb" },
        // 재료 셋은 조합이 아니다(제작 명령 전용).
        { id: "rc_three", ingredients: [{ itemId: "item_potion", count: 1 }, { itemId: "item_ether", count: 1 }, { itemId: "item_antidote", count: 1 }], outputItemId: "item_poison_dart" },
      ];
      const map = project.maps[project.startMapId]!;
      map.events.push(lockedDoor(project.startPos.x, project.startPos.y - 1));
      return project;
    }
    describe("inventory item combination (#12)", () => {
      it("finds two-item recipes in either order and ignores three-ingredient recipes", () => {
        const project = combineProject();
        expect(combinationRecipeFor(project, "item_ether", "item_potion")?.id).toBe("rc_hi");
        expect(combinationRecipeFor(project, "item_antidote", "item_antidote")?.id).toBe("rc_double");
        expect(combinationPartnersOf(project, "item_potion")).toEqual(["item_ether"]);
        expect(combinationRecipeFor(project, "item_potion", "item_antidote")).toBeUndefined();
      });

      it("combineItems consumes both ingredients and adds the output", () => {
        const project = combineProject();
        const session = startSession(project, 1);
        session.inventory = { item_potion: 1, item_ether: 2 };
        expect(combineItems(project, session, "item_potion", "item_ether")).toMatchObject({ ok: true, outputItemId: "item_hi_potion" });
        expect(session.inventory.item_potion ?? 0).toBe(0);
        expect(session.inventory).toMatchObject({ item_ether: 1, item_hi_potion: 1 });
        expect(combineItems(project, session, "item_potion", "item_ether")).toEqual({ ok: false, reason: "missing-ingredients" });
      });

      it("the item menu opens an action screen with a combine row that runs the combination", () => {
        const project = combineProject();
        const session = startSession(project, 1);
        session.inventory = { item_potion: 1, item_ether: 1 };
        const openActions = vi.fn();
        const combine = vi.fn((a: string, b: string) => combineItems(project, session, a, b));
        const list = createStatusMenuDetail({
          project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
          onOpenItemActions: openActions, onCombineItems: combine, onUseItem: vi.fn(), onSelectItemTarget: vi.fn(),
        });
        const potionRow = list.entries.find((entry) => entry.testId === "status-menu-item-item_potion")!;
        expect(potionRow.attributes?.itemActions).toBe("true");
        potionRow.onActivate!();
        expect(openActions).toHaveBeenCalledWith("item_potion");

        const actions = createStatusMenuDetail({
          project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
          itemActionId: "item_potion", onCombineItems: combine, onUseItem: vi.fn(), onSelectItemTarget: vi.fn(),
        });
        expect(actions.entries.map((entry) => entry.testId)).toEqual([
          "status-menu-item-use-item_potion",
          "status-menu-item-combine-item_potion-item_ether",
        ]);
        actions.entries[1]!.onActivate!();
        expect(session.inventory.item_hi_potion).toBe(1);
      });

      it("items without partners keep the legacy direct-use row", () => {
        const project = combineProject();
        const session = startSession(project, 1);
        session.inventory = { item_potion: 1 };
        const list = createStatusMenuDetail({
          project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
          onOpenItemActions: vi.fn(), onCombineItems: vi.fn(), onUseItem: vi.fn(), onSelectItemTarget: vi.fn(),
        });
        expect(list.entries.find((entry) => entry.testId === "status-menu-item-item_potion")!.attributes?.itemActions).toBeUndefined();
      });
    });
    describe("use item on faced target (#12)", () => {
      it("itemUsed is false during normal interaction and true only while the item is being used", () => {
        const project = combineProject();
        const session = startSession(project, 1);
        const door = project.maps[project.startMapId]!.events.find((event) => event.id === "ev_door")!;
        expect(resolveEventPage(door, session)?.id).toBe("page-talk");
        expect(evalCondition(session, { kind: "itemUsed", itemId: "item_old_key" })).toBe(false);
        session.itemUsedId = "item_old_key";
        expect(resolveEventPage(door, session)?.id).toBe("page-key");
        expect(evalCondition(session, { kind: "itemUsed", itemId: "item_old_key" })).toBe(true);
      });

      it("findFacedItemTarget returns the item page of the faced event and leaves the session unchanged", () => {
        const project = combineProject();
        const session = startSession(project, 1);
        const map = project.maps[project.startMapId]!;
        const player = { x: project.startPos.x, y: project.startPos.y, facing: "up" as const };
        const target = findFacedItemTarget(project, map, session, {}, player, "item_old_key");
        expect(target?.event.id).toBe("ev_door");
        expect(target?.page.id).toBe("page-key");
        expect(session.itemUsedId).toBeUndefined();
        // 다른 아이템·다른 방향은 받지 않는다.
        expect(findFacedItemTarget(project, map, session, {}, player, "item_potion")).toBeUndefined();
        expect(findFacedItemTarget(project, map, session, {}, { ...player, facing: "down" }, "item_old_key")).toBeUndefined();
      });

      it("the item action screen offers «바라보는 대상에 사용» only when the faced event accepts the item", () => {
        const project = combineProject();
        const session = startSession(project, 1);
        session.inventory = { item_old_key: 1 };
        const useOnTarget = vi.fn();
        const detail = (accepts: boolean) => createStatusMenuDetail({
          project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
          itemActionId: "item_old_key", canUseItemOnFacedTarget: () => accepts, onUseItemOnFacedTarget: useOnTarget,
        });
        const row = detail(true).entries.find((entry) => entry.testId === "status-menu-item-use-target-item_old_key");
        expect(row).toBeDefined();
        row!.onActivate!();
        expect(useOnTarget).toHaveBeenCalledWith("item_old_key");
        expect(detail(false).entries.some((entry) => entry.testId === "status-menu-item-use-target-item_old_key")).toBe(false);
      });

      it("keeps itemUsed pages through serialize/deserialize", () => {
        const project = combineProject();
        const reloaded = deserialize(serialize(project));
        const door = reloaded.maps[project.startMapId]!.events.find((event) => event.id === "ev_door")!;
        expect(door.pages?.[1]?.conditions).toEqual([{ kind: "itemUsed", itemId: "item_old_key" }]);
      });
    });
  });
  describe("mgL7sysSkillLoadout", () => {
    isolateTimers();
    const LEARNED = ["skill_attack", "skill_sword_slash", "skill_fire", "skill_ice"] as const;
    function loadoutProject(slots: number | undefined): Project {
      const project = createBlankProject();
      const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
      hero.learnedSkills = LEARNED.map((skillId) => ({ level: 1, skillId }));
      if (slots === undefined) delete hero.loadoutSlots;
      else hero.loadoutSlots = slots;
      return project;
    }
    function heroBattleSkills(project: Project, loadout?: readonly string[]): readonly string[] {
      const runtime = createBattleRuntime({
        project,
        troopId: "troop_slime",
        canEscape: true,
        canLose: true,
        battleFlow: "strict",
        sessionState: { switches: {}, variables: {}, inventory: {}, ...(loadout ? { actorSkillLoadouts: { actor_hero: loadout } } : {}) },
        party: { levels: { actor_hero: 1 }, experience: {}, partyActorIds: ["actor_hero"] },
      });
      return runtime.snapshot().actors.find((actor) => actor.id === "actor_hero")!.skillIds;
    }
    describe("actor skill loadout (#18)", () => {
      it("battle uses every learned skill when the actor has no loadout slots (legacy)", () => {
        // 직업이 주는 스킬도 함께 들어온다 — 장착 칸이 없으면 아무것도 걸러내지 않는다.
        const skills = heroBattleSkills(loadoutProject(undefined), ["skill_fire"]);
        expect(skills).toEqual(expect.arrayContaining([...LEARNED]));
        expect(skills.length).toBeGreaterThan(LEARNED.length - 1);
      });

      it("battle offers only the equipped skills when the actor has loadout slots", () => {
        const project = loadoutProject(2);
        expect(heroBattleSkills(project, ["skill_ice", "skill_attack"])).toEqual(["skill_ice", "skill_attack"]);
        // 장착하지 않은 첫 전투는 배운 순서(데이터베이스 순서) 앞에서부터 칸 수만큼.
        expect(heroBattleSkills(project)).toEqual(["skill_attack", "skill_sword_slash"]);
        // 배우지 않은 스킬은 장착 목록에 있어도 쓰지 못한다.
        expect(heroBattleSkills(project, ["skill_heal", "skill_fire"])).toEqual(["skill_fire"]);
      });

      it("toggleSkillLoadout equips up to the slot count and unequips on the second toggle", () => {
        const project = loadoutProject(2);
        const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
        const session = startSession(project, 1);
        session.actorSkillLoadouts = { actor_hero: [] };
        expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_fire")).toMatchObject({ ok: true, equipped: true });
        expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_ice")).toMatchObject({ ok: true, equipped: true });
        expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_attack")).toEqual({ ok: false, reason: "full" });
        expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_fire")).toMatchObject({ ok: true, equipped: false });
        expect(session.actorSkillLoadouts.actor_hero).toEqual(["skill_ice"]);
        expect(toggleSkillLoadout(session, hero, [...LEARNED], "skill_heal")).toEqual({ ok: false, reason: "notLearned" });
      });

      it("the menu skill screen toggles loadout and reports the equipped count", () => {
        const project = loadoutProject(2);
        const session = startSession(project, 1);
        const toggled: string[] = [];
        const detail = () => createStatusMenuDetail({
          project, session, selectedCommand: "skills", slots: [], waitModeEnabled: true,
          skillActorId: "actor_hero",
          onToggleSkillLoadout: (actorId, skillId) => {
            toggled.push(skillId);
            const hero = project.database.actors.find((actor) => actor.id === actorId)!;
            toggleSkillLoadout(session, hero, project.database.skills.filter((skill) => (LEARNED as readonly string[]).includes(skill.id)).map((skill) => skill.id), skillId);
          },
        });
        const first = detail();
        expect(first.title).toContain("(2/2)");
        const equippedRows = first.entries.filter((entry) => entry.attributes?.loadoutEquipped === "true").map((entry) => entry.testId);
        expect(equippedRows).toEqual(["status-menu-skill-actor_hero-skill_attack", "status-menu-skill-actor_hero-skill_sword_slash"]);
        first.entries.find((entry) => entry.testId === "status-menu-skill-actor_hero-skill_attack")!.onActivate!();
        expect(toggled).toEqual(["skill_attack"]);
        expect(detail().title).toContain("(1/2)");
        expect(equippedBattleSkillIds({ loadoutSlots: 2 }, [...LEARNED], session.actorSkillLoadouts?.actor_hero)).toEqual(["skill_sword_slash"]);
      });

      it("keeps loadoutSlots through actor normalize / project serialize and loadouts through save/load", () => {
        const project = loadoutProject(3);
        expect(normalizeActorRecord(project.database.actors[0]!).loadoutSlots).toBe(3);
        expect(normalizeActorRecord({ ...project.database.actors[0]!, loadoutSlots: 99 }).loadoutSlots).toBe(12);
        expect("loadoutSlots" in normalizeActorRecord(loadoutProject(undefined).database.actors[0]!)).toBe(false);
        const reloaded = deserialize(serialize(project));
        expect(reloaded.database.actors.find((actor) => actor.id === "actor_hero")!.loadoutSlots).toBe(3);

        const session = startSession(project, 1);
        session.actorSkillLoadouts = { actor_hero: ["skill_fire"] };
        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(restored.actorSkillLoadouts).toEqual({ actor_hero: ["skill_fire"] });
      });
    });
  });
  describe("monsterCollectDex", () => {
    isolateTimers();
    function fixture(collection: boolean) {
      const project = createBlankProject();
      project.system.battleParty = 'monsters';
      if (collection) project.system.monsterCollection = true;
      configureEmeraldMonsterStyle(project);
      project.database.monsterSpecies![0]!.dexNote = '도감 설명 한 줄.';
      return { project, session: startSession(project) };
    }
    const base = (v: ReturnType<typeof fixture>) => ({ project: v.project, session: v.session, selectedCommand: 'monster-dex' as const, slots: [], waitModeEnabled: true });
    describe('monster dex without a campaign definition', () => {
      it('lists every species only for a capture game, and nothing for other games', () => {
        const on = fixture(true), off = fixture(false);
        expect(monsterDexSpeciesIds(on.project)).toEqual(on.project.database.monsterSpecies!.map((s) => s.id));
        expect(monsterDexSpeciesIds(off.project)).toEqual([]);
      });
      it('records sightings and captures without a campaign, and not for a non-capture game', () => {
        const on = fixture(true), off = fixture(false);
        const id = on.project.database.monsterSpecies![0]!.id;
        recordMonsterSeen(on.project, on.session, id);
        expect(monsterJournalEntry(on.session, id)).toEqual({ seen: true, caught: false });
        giveMonster(on.project, on.session, { speciesId: id, level: 5 });
        expect(monsterJournalEntry(on.session, id).caught).toBe(true);
        recordMonsterSeen(off.project, off.session, id);
        expect(off.session.switches[`mx_seen_${id}`]).toBeUndefined();
      });
      it('reads the note from the species record and falls back to nothing', () => {
        const { project } = fixture(true);
        expect(monsterDexNote(project, project.database.monsterSpecies![0]!.id)).toBe('도감 설명 한 줄.');
        expect(monsterDexNote(project, 'nope')).toBeUndefined();
      });
      it('builds a list with progress meter and a paged detail on the emerald skin', () => {
        const v = fixture(true);
        const id = v.project.database.monsterSpecies![0]!.id;
        recordMonsterSeen(v.project, v.session, id);
        const list = createStatusMenuDetail(base(v));
        expect(list.meter).toEqual({ seen: 1, caught: 0, total: v.project.database.monsterSpecies!.length });
        const detail = createStatusMenuDetail({ ...base(v), campaignSpeciesId: id, onDexPage: () => {}, onSelectCampaignSpecies: () => {} });
        expect(detail.entries.some((e) => e.testId === 'campaign-dex-page')).toBe(true);
        expect(detail.entries.some((e) => e.testId === `campaign-dex-habitat-${id}`)).toBe(true);
        const stats = createStatusMenuDetail({ ...base(v), campaignSpeciesId: id, dexPage: 'stats', onDexPage: () => {}, onSelectCampaignSpecies: () => {} });
        expect(stats.entries.some((e) => e.label === '공격')).toBe(true);
        expect(stats.entries.some((e) => e.testId === `campaign-dex-habitat-${id}`)).toBe(false);
      });
      it('shows the dex command for a capture game without a campaign, hides it otherwise', () => {
        const on = fixture(true), off = fixture(false);
        expect(listStatusMenuCommandIds(on.project, on.session)).toContain('monster-dex');
        expect(listStatusMenuCommandIds(off.project, off.session)).not.toContain('monster-dex');
      });
    });
    describe('habitats', () => {
      it('finds maps whose encounter table reaches the species through troop and enemy records', () => {
        const { project } = fixture(true);
        const species = project.database.monsterSpecies![0]!;
        const enemy = { ...project.database.enemies[0]!, id: 'dex_enemy', speciesId: species.id };
        project.database.enemies.push(enemy);
        const troop = { ...project.database.troops[0]!, id: 'dex_troop', enemyIds: ['dex_enemy'], members: undefined };
        project.database.troops.push(troop);
        const map = Object.values(project.maps)[0]!;
        map.name = '1번길';
        map.encounterTable = [{ troopId: 'dex_troop', weight: 1 }];
        expect(monsterSpeciesHabitats(project, species.id)).toEqual(['1번길']);
        expect(monsterSpeciesHabitats(project, 'nope')).toEqual([]);
      });
      it('folds long habitat lists', () => {
        expect(habitatSummary([])).toBe('');
        expect(habitatSummary(['가', '나'])).toBe('가 · 나');
        expect(habitatSummary(['가', '나', '다', '라'])).toBe('가 · 나 외 2곳');
      });
    });
  });
  describe("monsterCollectParty", () => {
    isolateTimers();
    function fixture(count = 3) {
      const project = createBlankProject();
      project.system.battleParty = 'monsters';
      configureEmeraldMonsterStyle(project);
      const session = startSession(project);
      const species = project.database.monsterSpecies![0]!;
      const ids: string[] = [];
      for (let i = 0; i < count; i++) {
        const given = giveMonster(project, session, { speciesId: species.id, level: 5 + i, nickname: `동료${i}` });
        if (!given.ok) throw new Error('give failed');
        ids.push(given.instance.instanceId);
      }
      return { project, session, ids };
    }
    const base = (value: ReturnType<typeof fixture>) => ({ project: value.project, session: value.session, selectedCommand: 'monsters' as const, slots: [], waitModeEnabled: true });
    describe('swapMonsterPartyOrder', () => {
      it('swaps two party slots and keeps instances', () => {
        const { session, ids } = fixture();
        expect(swapMonsterPartyOrder(session, ids[0]!, ids[2]!)).toEqual({ ok: true });
        expect(session.monsterParty).toEqual([ids[2], ids[1], ids[0]]);
        expect(Object.keys(session.monsterInstances)).toHaveLength(3);
      });
      it('rejects the same monster and box monsters without touching the party', () => {
        const { session, ids } = fixture();
        session.monsterBox = ['monster_box'];
        session.monsterInstances['monster_box'] = { ...session.monsterInstances[ids[0]!]!, instanceId: 'monster_box' };
        const before = [...session.monsterParty];
        expect(swapMonsterPartyOrder(session, ids[0]!, ids[0]!)).toEqual({ ok: false, reason: 'same' });
        expect(swapMonsterPartyOrder(session, ids[0]!, 'monster_box')).toEqual({ ok: false, reason: 'notInParty' });
        expect(session.monsterParty).toEqual(before);
      });
    });
    describe('emerald party list and summary pages', () => {
      it('a swap source turns the next party pick into a swap and picking it again cancels', () => {
        const value = fixture();
        const actions: MonsterCollectAction[] = [];
        const options = { ...base(value), monsterCollect: { swapSourceId: value.ids[0] }, onMonsterCollect: (action: MonsterCollectAction) => { actions.push(action); }, onSelectMonster: vi.fn() };
        const detail = createStatusMenuDetail(options);
        const slots = detail.entries.filter((row) => row.attributes?.partySlot !== undefined);
        slots.find((row) => row.testId === `status-menu-monster-${value.ids[2]}`)!.onActivate!();
        slots.find((row) => row.testId === `status-menu-monster-${value.ids[0]}`)!.onActivate!();
        expect(actions).toEqual([{ kind: 'swap', sourceId: value.ids[0], targetId: value.ids[2] }, { kind: 'cancelSwap' }]);
        expect(options.onSelectMonster).not.toHaveBeenCalled();
        expect(slots.find((row) => row.testId === `status-menu-monster-${value.ids[0]}`)?.attributes?.partySwapSource).toBe('true');
      });

      it('the summary shows one page at a time and the page row cycles stats, moves, manage', () => {
        const value = fixture();
        const actions: MonsterCollectAction[] = [];
        const options = { ...base(value), monsterInstanceId: value.ids[0], onMonsterCollect: (action: MonsterCollectAction) => { actions.push(action); }, onSelectMonster: vi.fn(), onMoveMonster: vi.fn() };
        const stats = createStatusMenuDetail({ ...options, monsterCollect: { summaryPage: 'stats' } });
        expect(stats.entries.some((row) => row.testId === 'status-menu-monster-current-stats')).toBe(true);
        expect(stats.entries.some((row) => row.testId === `status-menu-monster-move-${value.ids[0]}`)).toBe(false);
        stats.entries.find((row) => row.testId === 'status-menu-monster-page')!.onActivate!();
        expect(actions).toEqual([{ kind: 'summaryPage', page: 'moves' }]);
        const manage = createStatusMenuDetail({ ...options, monsterCollect: { summaryPage: 'manage' } });
        expect(manage.entries.some((row) => row.testId === `status-menu-monster-swap-${value.ids[0]}`)).toBe(true);
        expect(manage.entries.some((row) => row.testId === `status-menu-monster-move-${value.ids[0]}`)).toBe(true);
      });

      it('keeps the flat legacy list when no collect callbacks are wired (existing tests and non-emerald skins)', () => {
        const value = fixture();
        const detail = createStatusMenuDetail({ ...base(value), monsterInstanceId: value.ids[0], onSelectMonster: vi.fn(), onMoveMonster: vi.fn() });
        expect(detail.entries.some((row) => row.testId === 'status-menu-monster-current-stats')).toBe(true);
        expect(detail.entries.some((row) => row.testId === `status-menu-monster-move-${value.ids[0]}`)).toBe(true);
        expect(detail.entries.some((row) => row.testId === 'status-menu-monster-page')).toBe(false);
      });
    });
  });
  describe("monsterPartyMenuDogfood", () => {
    isolateTimers();
    function fixture(legacyFlag = false) {
      const project = createBlankProject();
      if (legacyFlag) project.system.monsterBattleParty = true;
      else project.system.battleParty = 'monsters';
      const session = startSession(project);
      const species = project.database.monsterSpecies![0];
      // The blank project no longer ships a PP move; give the first damage skill PP so the menu has one to show.
      const skill = project.database.skills.find(record => record.maxPp !== undefined && record.maxPp > 1)
        ?? project.database.skills.find(record => record.effect?.kind === 'damage');
      if (skill && (skill.maxPp === undefined || skill.maxPp <= 1)) skill.maxPp = 10;
      if (!species || !skill) throw new Error('Monster and PP skill fixtures are required');
      const given = giveMonster(project, session, { speciesId: species.id, level: 12, nickname: '동료', skillIds: [skill.id], skillPp: { [skill.id]: 1 } });
      if (!given.ok) throw new Error('Failed to give fixture monster');
      session.monsterInstances[given.instance.instanceId] = { ...given.instance, currentHp: 1 };
      return { project, session, species, skill, id: given.instance.instanceId };
    }
    function detailOptions(value: ReturnType<typeof fixture>) {
      return { project: value.project, session: value.session, selectedCommand: 'monsters' as const, slots: [], waitModeEnabled: true };
    }
    describe('monster party menu dogfood regressions', () => {
      it.each([false, true])('uses actual monster HP and current PP for both party flags (%s)', legacy => {
        const { project, session, id, skill } = fixture(legacy);
        const rows = createPlayerStatusMenuSnapshot(project, session).partyRows;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ monsterInstanceId: id, name: '동료', level: 12, hpValueLabel: `1/${monsterMaxHp(project, session.monsterInstances[id])}`, mpValueLabel: `1/${skill.maxPp}`, resourceLabel: 'PP' });
        for (const command of ['equipment', 'row', 'formation']) expect(listStatusMenuCommandIds(project, session)).not.toContain(command);
        session.monsterParty = [];
        expect(createPlayerStatusMenuSnapshot(project, session).partyRows).toEqual([]);
      });

      it('inspects the instance before an explicit box action and shows battle stats and known PP', () => {
        const value = fixture();
        const select = vi.fn(), move = vi.fn();
        const options = { ...detailOptions(value), onSelectMonster: select, onMoveMonster: move };
        const list = createStatusMenuDetail(options);
        list.entries.find(row => row.testId === `status-menu-monster-${value.id}`)!.onActivate!();
        expect(select).toHaveBeenCalledWith(value.id);
        expect(move).not.toHaveBeenCalled();
        const detail = createStatusMenuDetail({ ...options, monsterInstanceId: value.id });
        expect(detail.entries.find(row => row.testId === `status-menu-monster-known-skill-${value.id}-${value.skill.id}`)?.value).toBe(`PP 1/${value.skill.maxPp}`);
        const stats = monsterBattleStats(value.project, value.session.monsterInstances[value.id]);
        expect(detail.entries.find(row => row.testId === 'status-menu-monster-current-stats')?.value).toBe(String(stats.attack));
        expect(detail.entries.find(row => row.testId === `status-menu-monster-move-${value.id}`)?.unavailableReason).toContain('마지막 파티');
        expect(monsterBoxUnavailableReason(value.project, value.session, value.id)).toContain('마지막 파티');
        const second = giveMonster(value.project, value.session, { speciesId: value.species.id, level: 2 });
        expect(second.ok).toBe(true);
        expect(monsterBoxUnavailableReason(value.project, value.session, value.id)).toBeUndefined();
      });

      it('field skills contain only the selected monster’s known moves', () => {
        const value = fixture();
        const detail = createStatusMenuDetail({ ...detailOptions(value), selectedCommand: 'skills', skillActorId: value.id });
        expect(detail.entries.map(row => row.label)).toEqual([value.skill.name]);
        expect(detail.entries[0].value).toBe(`PP 1/${value.skill.maxPp}`);
      });

      it('shop purchase preview uses the damaged monster and allows an unowned medicine without mutating it', () => {
        const { project, session, id } = fixture();
        const item = project.database.items.find(record => record.type === 'medicine' && record.scope === 'ally' && record.hpRecovery.flat > 0 && !record.usableActorIds.length && !record.usableClassIds.length && record.occasion !== 'battle')!;
        if (!item) throw new Error('Required unrestricted medicine fixture');
        session.inventory[item.id] = 0;
        const before = JSON.stringify(session);
        const rows = recoveryPreview(project, session, itemToGoods(item));
        expect(rows).toHaveLength(1);
        expect(rows![0]).toMatchObject({ actorId: id, name: '동료', current: 1, kind: 'hp' });
        expect(rows![0].next).toBeGreaterThan(1);
        expect(rows![0].max).toBe(monsterMaxHp(project, session.monsterInstances[id]));
        expect(JSON.stringify(session)).toBe(before);
      });

      it('save metadata follows the leading monster and persisted menu vitals survive load', () => {
        const { project, session, id, skill } = fixture();
        const snapshot = createSaveSnapshot(project, session);
        expect(snapshot.partyLevel).toBe(12);
        const loaded = applySaveSnapshot(project, JSON.parse(JSON.stringify(snapshot)));
        const row = createPlayerStatusMenuSnapshot(project, loaded).partyRows[0];
        expect(row.monsterInstanceId).toBe(id);
        expect(row.hpValueLabel).toContain('1/');
        expect(row.mpValueLabel).toBe(`1/${skill.maxPp}`);
      });

      it('uses authored element names in type labels and move description tokens', () => {
        const { project } = fixture();
        const element = project.database.elements[0];
        expect(monsterTypeLabel(project, [element.id])).toBe(element.name);
        expect(monsterMoveDescription(project, `${element.id} 타입의 기술입니다.`)).toBe(`${element.name} 타입의 기술입니다.`);
      });

      it('retains actor RPG overview, skills and save metadata when monster mode is absent', () => {
        const project = createBlankProject(), session = startSession(project);
        const rows = createPlayerStatusMenuSnapshot(project, session).partyRows;
        expect(rows[0].actorId).toBe(session.partyActorIds[0]);
        expect(rows[0].monsterInstanceId).toBeUndefined();
        // 배우 RPG 는 장비가 있고, 동료가 있으면 열·진형도 있다(혼자인 게임의 기본 메뉴는 열·진형을 싣지 않는다 — 2026-11-13).
        expect(listStatusMenuCommandIds(project, session)).toContain('equipment');
        session.partyActorIds = [session.partyActorIds[0]!, project.database.actors.find((actor) => actor.id !== session.partyActorIds[0])!.id];
        expect(listStatusMenuCommandIds(project, session)).toEqual(expect.arrayContaining(['equipment', 'row', 'formation']));
        expect(createSaveSnapshot(project, session).partyLevel).toBe(session.actorLevels[session.partyActorIds[0]]);
      });
    });
  });
});

describe("playerSuite10", () => {
  isolateTimers();
  // test/runtimeEventFootprint.test.ts
  // 이벤트 발자국의 런타임 해석 — 페이지에서 읽어 RuntimeEventView 로 노출한다.
  // 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §2.
  describe("runtimeEventFootprint", () => {
    isolateTimers();
    function page(overrides: Partial<EventPage> = {}): EventPage {
      return {
        id: "page1",
        name: "page1",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
        ...overrides,
      };
    }
    function event(pages: EventPage[]): GameEvent {
      return { id: "ev1", x: 5, y: 7, trigger: { kind: "action" }, commands: [], pages };
    }
    function session(): PlaySessionLike {
      return {
        flags: {},
        switches: {},
        variables: {},
        timers: {},
        gold: 0,
        inventory: {},
        partyActorIds: [],
        actorVitals: {},
        currentMapId: "map_runtime",
        x: 0,
        y: 0,
      };
    }
    function viewOf(pages: EventPage[]) {
      const target = event(pages);
      return runtimeEventView(target, session(), initialRuntimeEventPositions([target]));
    }
    describe("RuntimeEventView.footprint", () => {
      it("발자국이 없는 페이지는 1x1 이다", () => {
        expect(viewOf([page()]).footprint).toEqual(UNIT_FOOTPRINT);
      });

      it("페이지가 지정한 발자국을 노출한다", () => {
        expect(viewOf([page({ footprint: { width: 2, height: 2 } })]).footprint).toEqual({ width: 2, height: 2 });
      });

      it("쓰레기 값은 1x1 로 정규화된다", () => {
        const broken = page({ footprint: { width: 0, height: 999 } as never });
        expect(viewOf([broken]).footprint).toEqual({ width: 1, height: 8 });
      });

      it("페이지가 아예 없는 레거시 이벤트도 1x1 이다", () => {
        const legacy: GameEvent = { id: "ev0", x: 1, y: 1, trigger: { kind: "action" }, commands: [] };
        const view = runtimeEventView(legacy, session(), initialRuntimeEventPositions([legacy]));
        expect(view.footprint).toEqual(UNIT_FOOTPRINT);
      });
    });
    describe("RuntimeEventView.scale", () => {
      it("배율이 없으면 1 이다", () => {
        expect(viewOf([page()]).scale).toBe(1);
      });

      it("그래픽 배율을 노출한다", () => {
        expect(viewOf([page({ graphic: { scale: 2 } })]).scale).toBe(2);
      });

      it("배율과 발자국은 독립이다 — 한쪽만 줘도 다른 쪽은 기본값이다", () => {
        const view = viewOf([page({ graphic: { scale: 3 } })]);
        expect(view.scale).toBe(3);
        expect(view.footprint).toEqual(UNIT_FOOTPRINT);
      });
    });
    function mapWithEvent(target: GameEvent): { project: Project; map: GameMap } {
      const project = createBlankProject();
      const map = createBlankMap("발자국 맵", 20, 15, project.maps[project.startMapId].tilesetId);
      map.events = [target];
      project.maps[map.id] = map;
      return { project, map };
    }
    function bigEvent(footprint: { width: number; height: number }, passRows?: number): GameEvent {
      return {
        id: "ev_big",
        x: 5,
        y: 7,
        trigger: { kind: "action" },
        commands: [],
        pages: [page({ footprint, passRows, priority: "same", overlapForbidden: true })],
      };
    }
    describe("사각 질의 승격 — 2x2 이벤트", () => {
      // (5,7) 에 선 2x2 의 발자국은 (5,6) (6,6) (5,7) (6,7).
      const OCCUPIED = [[5, 6], [6, 6], [5, 7], [6, 7]] as const;
      const FREE = [[4, 7], [7, 7], [5, 5], [5, 8]] as const;

      it("발자국 네 칸 어디에서 조사해도 같은 이벤트를 찾는다", () => {
        const target = bigEvent({ width: 2, height: 2 });
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        for (const [x, y] of OCCUPIED) {
          const found = findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action");
          expect(found?.event.id, `(${x},${y})`).toBe("ev_big");
        }
      });

      it("발자국 밖에서는 찾지 못한다", () => {
        const target = bigEvent({ width: 2, height: 2 });
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        for (const [x, y] of FREE) {
          expect(findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action"), `(${x},${y})`).toBeUndefined();
        }
      });

      it("발자국 네 칸 전부가 통행을 막는다", () => {
        const target = bigEvent({ width: 2, height: 2 });
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        for (const [x, y] of OCCUPIED) {
          expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `(${x},${y})`).toBeDefined();
        }
        for (const [x, y] of FREE) {
          expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `(${x},${y})`).toBeUndefined();
        }
      });
    });
    // 2차 스펙 §3 — 몸 사각(조사·전투)과 통행 사각(차단)이 갈라진다.
    describe("passRows — 상체는 지나가되 조사는 몸 전체로 받는다", () => {
      // (5,7) 에 선 3x3 의 몸 사각은 x 4..6 / y 5..7. passRows 1 이면 통행 사각은 y 7 한 줄.
      const TORSO = [[4, 5], [5, 5], [6, 5], [4, 6], [5, 6], [6, 6]] as const;
      const LEGS = [[4, 7], [5, 7], [6, 7]] as const;
      // 앵커는 (5,7) 이다. 앵커를 겨냥한 단정은 1x1 이어도 같은 결과라 아무것도 증명하지 않는다.
      const LEGS_DISCRIMINATING = [[4, 7], [6, 7]] as const;

      function fixture(passRows?: number) {
        const { project, map } = mapWithEvent(bigEvent({ width: 3, height: 3 }, passRows));
        return { project, map, positions: initialRuntimeEventPositions(map.events) };
      }

      // 판별력의 핵심: 같은 칸에서 조사는 **되고** 통행 차단은 **안 되는** 조합이다.
      // - 1x1 이라면 상체 칸에서 조사가 아예 안 된다 → 앞 단정이 잡는다.
      // - passRows 없는 3x3 이라면 상체 칸이 통행을 막는다 → 뒤 단정이 잡는다.
      // 둘을 같이 봐야 "사각이 둘로 갈라졌다" 가 증명된다.
      it("상체 칸은 조사되지만 통행을 막지 않는다", () => {
        const { project, map, positions } = fixture(1);
        for (const [x, y] of TORSO) {
          expect(
            findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action")?.event.id,
            `조사 (${x},${y})`
          ).toBe("ev_big");
          expect(
            findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y),
            `통행 (${x},${y})`
          ).toBeUndefined();
        }
      });

      it("발밑 줄은 여전히 막는다 — 앵커가 아닌 칸으로 본다", () => {
        const { project, map, positions } = fixture(1);
        for (const [x, y] of LEGS_DISCRIMINATING) {
          expect(
            findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y),
            `(${x},${y})`
          ).toBeDefined();
        }
      });

      it("passRows 생략은 몸 전체 차단이다 — 1차와 동일", () => {
        const { project, map, positions } = fixture(undefined);
        for (const [x, y] of [...TORSO, ...LEGS]) {
          expect(
            findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y),
            `(${x},${y})`
          ).toBeDefined();
        }
      });

      it("뷰가 두 사각을 계산해 내보낸다 — 소비자가 크기를 다시 조립하지 않는다", () => {
        const { map, positions } = fixture(1);
        const view = runtimeEventView(map.events[0], session(), positions);
        expect(view.passRows).toBe(1);
        expect(view.bodyRect).toEqual({ left: 4, right: 6, top: 5, bottom: 7 });
        expect(view.passRect).toEqual({ left: 4, right: 6, top: 7, bottom: 7 });
      });

      it("passRows 가 몸 높이와 같으면 두 사각이 같은 객체값이다", () => {
        const { map, positions } = fixture(3);
        const view = runtimeEventView(map.events[0], session(), positions);
        expect(view.passRect).toEqual(view.bodyRect);
      });

      it("비정규 passRows 는 몸 전체를 막는다 — fail-closed", () => {
        for (const bad of [0, -2, 2.5, Number.NaN]) {
          const { project, map, positions } = fixture(bad);
          expect(
            findBlockingRuntimeEventAtInMap(project, map, session(), positions, 4, 5),
            `행 수 ${bad}`
          ).toBeDefined();
        }
      });
    });
    describe("사각 질의 원본", () => {
      it("겹치는 사각으로 질의하면 찾는다 — 커진 플레이어 경로", () => {
        const target = bigEvent({ width: 2, height: 2 });
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        // 이벤트 발자국은 x 5..6 / y 6..7. 아래 사각은 x 6..8 / y 7..9 라 (6,7) 에서 겹친다.
        const overlapping = { left: 6, right: 8, top: 7, bottom: 9 };
        expect(findEventOverlappingRect(project, map, session(), positions, overlapping, "action")?.event.id).toBe("ev_big");
        expect(findBlockingEventOverlappingRect(project, map, session(), positions, overlapping)?.event.id).toBe("ev_big");
      });

      it("닿지 않는 사각은 못 찾는다", () => {
        const target = bigEvent({ width: 2, height: 2 });
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        const apart = { left: 7, right: 9, top: 8, bottom: 10 };
        expect(findEventOverlappingRect(project, map, session(), positions, apart, "action")).toBeUndefined();
      });

      it("점 질의는 1x1 사각 질의와 같은 답을 준다 — 독립적으로 손으로 계산한 정답과 대조한다", () => {
        // 1x1 이벤트 하나를 (5,7) 에 놓는다. 1x1 의 사각은 그 칸 자신이므로 정답은
        // "(5,7) 에서만 defined, 나머지 55 좌표는 전부 undefined" 라고 손으로 안다 —
        // 함수 자체를 서로 비교하면(피검사 함수를 정답으로 쓰면) 이 비교는 아무것도
        // 보장하지 않는다(findRuntimeEventAtInMap 이 findEventOverlappingRect 를
        // pointRect 로 위임하는 래퍼라 자기 자신과 비교하는 꼴이 되기 때문).
        const anchor = { x: 5, y: 7 };
        const target: GameEvent = {
          id: "ev_unit",
          x: anchor.x,
          y: anchor.y,
          trigger: { kind: "action" },
          commands: [],
          pages: [page({ priority: "same", overlapForbidden: true })],
        };
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        for (let y = 4; y <= 10; y += 1) {
          for (let x = 2; x <= 9; x += 1) {
            const expectedId = x === anchor.x && y === anchor.y ? "ev_unit" : undefined;
            const viaPoint = findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action");
            const viaRect = findEventOverlappingRect(project, map, session(), positions, pointRect(x, y), "action");
            expect(viaPoint?.event.id, `점 질의 (${x},${y})`).toBe(expectedId);
            expect(viaRect?.event.id, `사각 질의 (${x},${y})`).toBe(expectedId);
          }
        }
      });
    });
    describe("배열 형태 finder 도 발자국을 본다", () => {
      it("findRuntimeEventAt / findBlockingRuntimeEventAt 이 2x2 네 칸에서 잡힌다", () => {
        const target = bigEvent({ width: 2, height: 2 });
        const positions = initialRuntimeEventPositions([target]);
        for (const [x, y] of [[5, 6], [6, 6], [5, 7], [6, 7]]) {
          expect(findRuntimeEventAt([target], session(), positions, x, y, "action")?.event.id, `조사 (${x},${y})`).toBe("ev_big");
          expect(findBlockingRuntimeEventAt([target], session(), positions, x, y), `막힘 (${x},${y})`).toBeDefined();
        }
        for (const [x, y] of [[4, 7], [7, 7], [5, 5], [5, 8]]) {
          expect(findRuntimeEventAt([target], session(), positions, x, y, "action"), `조사 (${x},${y})`).toBeUndefined();
          expect(findBlockingRuntimeEventAt([target], session(), positions, x, y), `막힘 (${x},${y})`).toBeUndefined();
        }
      });
    });
    describe("1x1 이벤트는 승격 후에도 한 칸만 차지한다", () => {
      it("자기 칸에서만 잡히고 이웃 칸에서는 안 잡힌다", () => {
        const target: GameEvent = {
          id: "ev_small",
          x: 5,
          y: 7,
          trigger: { kind: "action" },
          commands: [],
          pages: [page({ priority: "same", overlapForbidden: true })],
        };
        const { project, map } = mapWithEvent(target);
        const positions = initialRuntimeEventPositions(map.events);
        expect(findRuntimeEventAtInMap(project, map, session(), positions, 5, 7, "action")?.event.id).toBe("ev_small");
        for (const [x, y] of [[4, 7], [6, 7], [5, 6], [5, 8]]) {
          expect(findRuntimeEventAtInMap(project, map, session(), positions, x, y, "action"), `(${x},${y})`).toBeUndefined();
        }
      });
    });
    describe("footprintSpriteX — 발자국 가로 중앙", () => {
      it("1x1 은 기존 characterSpriteX 와 같다", () => {
        for (let x = 0; x <= 12; x += 1) {
          expect(footprintSpriteX(x, UNIT_FOOTPRINT)).toBe(characterSpriteX(x));
        }
      });

      it("홀수 폭도 기존과 같다 — 발밑 칸 중앙이 곧 발자국 중앙이다", () => {
        expect(footprintSpriteX(5, { width: 3, height: 3 })).toBe(characterSpriteX(5));
        expect(footprintSpriteX(5, { width: 5, height: 1 })).toBe(characterSpriteX(5));
      });

      it("짝수 폭은 두 칸 경계에 온다", () => {
        expect(footprintSpriteX(5, { width: 2, height: 2 })).toBe(6 * TILE_SIZE);
        expect(footprintSpriteX(5, { width: 4, height: 1 })).toBe(6 * TILE_SIZE);
      });

      it("Y 는 발자국 높이와 무관하게 발밑 칸 하단이다", () => {
        // 높이를 실제로 바꿔가며 본다. 이전 판은 characterSpriteY(7) 하나만 단정해서
        // 발자국이 인자로 등장하지 않았고, 이름이 약속한 높이 무관성을 검사하지 않았다.
        // footprintSpriteY 가 따로 없는 이유가 이것이다: 세로축은 앵커가 이미 그 축의
        // 끝(하단)이라 가로처럼 보정할 게 없다.
        for (const height of [1, 2, 3, 8]) {
          const rect = footprintBounds(7, 7, { width: 2, height });
          expect(rect.bottom, `높이 ${height} 의 하단은 앵커 행이다`).toBe(7);
          expect(rect.top, `높이 ${height} 의 상단은 위로 자란다`).toBe(7 - (height - 1));
          expect(characterSpriteY(rect.bottom), `높이 ${height} 의 스프라이트 Y`).toBe(8 * TILE_SIZE);
        }
      });
    });
    type CapturedSprite = {
      x: number;
      y: number;
      scale: number;
      setOrigin(originX: number, originY: number): void;
      setDepth(depth: number): void;
      play(key: string): CapturedSprite;
      setPosition(x: number, y: number): void;
      setFrame(frame: string | number): void;
      setScale(value: number): void;
      destroy(): void;
    };
    function renderSceneFor(target: GameEvent): {
      created: CapturedSprite[];
      scene: Parameters<typeof renderTiles>[0];
    } {
      const project = createBlankProject();
      const map = project.maps[project.startMapId];
      map.events = [target];
      store.replace(project);

      const created: CapturedSprite[] = [];
      const scene: Parameters<typeof renderTiles>[0] = {
        map,
        session: startSession(project),
        eventPositions: initialRuntimeEventPositions(map.events),
        tileLayer: { removeAll: () => undefined, add: () => undefined },
        eventSprites: new Map(),
        runtimeDom: {
          clearEventMarkers: () => undefined,
          upsertEventMarker: () => undefined,
          syncMissingResourceError: () => undefined,
        },
        missingResources: new Set<string>(),
        add: {
          image: () => ({ y: 0, setOrigin: () => undefined, setDepth: () => undefined }),
          sprite: (x: number, y: number) => {
            const sprite: CapturedSprite = {
              x,
              y,
              scale: 1,
              setOrigin: () => undefined,
              setDepth: () => undefined,
              play: () => sprite,
              setPosition: (px, py) => {
                sprite.x = px;
                sprite.y = py;
              },
              setFrame: () => undefined,
              setScale: (value) => {
                sprite.scale = value;
              },
              destroy: () => undefined,
            };
            created.push(sprite);
            return sprite;
          },
        },
        runEvent: async () => undefined,
        syncRuntimeState: () => undefined,
      };
      return { created, scene };
    }
    function golemEvent(footprint: { width: number; height: number }, scale: number): GameEvent {
      return {
        id: "ev_golem",
        x: 5,
        y: 7,
        trigger: { kind: "action" },
        commands: [],
        pages: [page({
          footprint,
          graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_monster1" }, scale },
          priority: "same",
          overlapForbidden: true,
        })],
      };
    }
    describe("renderEvents 는 발자국 중앙에 배율을 걸어 그린다", () => {
      it("2x2 배율 2 는 두 칸 경계에 배율 2 로 놓인다", () => {
        const { created, scene } = renderSceneFor(golemEvent({ width: 2, height: 2 }, 2));
        renderTiles(scene);

        expect(created).toHaveLength(1);
        expect(created[0].x).toBe(6 * TILE_SIZE);
        expect(created[0].y).toBe(8 * TILE_SIZE);
        expect(created[0].scale).toBe(2);
      });

      it("1x1 배율 1 은 기존 좌표와 배율 그대로다", () => {
        const { created, scene } = renderSceneFor(golemEvent({ width: 1, height: 1 }, 1));
        renderTiles(scene);

        expect(created).toHaveLength(1);
        expect(created[0].x).toBe(characterSpriteX(5));
        expect(created[0].y).toBe(characterSpriteY(7));
        expect(created[0].scale).toBe(1);
      });

      it("배율만 크고 발자국은 1x1 인 조합도 성립한다", () => {
        const { created, scene } = renderSceneFor(golemEvent({ width: 1, height: 1 }, 3));
        renderTiles(scene);

        expect(created[0].x).toBe(characterSpriteX(5));
        expect(created[0].scale).toBe(3);
      });
    });
    describe("골렘 시나리오 — 2x2 가 길을 막고 어디서든 말이 걸린다", () => {
      // 여태 프리미티브·통행·히트테스트·렌더를 따로 검증해 왔다. 여기서 보는 것은
      // **저작물 한 개**에서 넷이 동시에 맞는지다. 그래서 같은 golem 객체를 통행/조사
      // 질의와 renderTiles 양쪽에 통과시킨다 — 서로 다른 이벤트를 쓰면 "페이지에서
      // 읽는 경로"와 "그리는 경로"가 갈라져 있어도 통과해버린다.
      //
      // 이 테스트가 실패하려면 무엇이 깨져야 하는가:
      //  - 발자국 4칸 막힘 → findBlockingEventOverlappingRect 가 발자국 사각 대신 앵커
      //    점만 보면 (5,6) (6,6) (6,7) 세 칸이 undefined 로 떨어진다.
      //  - 서는 칸 4개가 안 막힘 → footprintBounds 가 반대로 전개하면(left 를
      //    x-(width-1) 로 잡으면) (4,7) 이 막혀버린다.
      //  - 4방향 조사 → 점 질의를 사각으로 승격하지 않으면 앵커 (5,7) 말고 세 칸이 빈다.
      //  - 렌더 x → renderEvents 가 footprintSpriteX 대신 characterSpriteX 를 쓰면
      //    5.5*TILE_SIZE 가 나온다(짝수 폭의 두 칸 경계가 아니라 한 칸 중앙).
      //  - 렌더 scale → graphic.scale 배선이 끊기면 1 이 나온다.
      it("발자국 네 칸이 통행을 막고 인접 네 방향에서 조사가 걸리고 두 칸 경계에 그려진다", () => {
        const golem = golemEvent({ width: 2, height: 2 }, 2);
        const { project, map } = mapWithEvent(golem);
        const positions = initialRuntimeEventPositions(map.events);

        // 발자국은 (5,6) (6,6) (5,7) (6,7).
        for (const [x, y] of [[5, 6], [6, 6], [5, 7], [6, 7]]) {
          expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, x, y), `막힘 (${x},${y})`).toBeDefined();
        }

        // 발자국 바로 바깥에서 정면 조사 — 각 방향에서 인접 칸을 조사하면 골렘이 잡힌다.
        // 서는 칸이 비어 있다는 단정을 같이 두는 이유: 발자국이 과도하게 커져도
        // "조사가 걸린다" 쪽만 보면 통과하기 때문이다.
        const probes = [
          [4, 7, 5, 7], // 왼쪽에서 오른쪽 보기 — 앵커 칸이라 1x1 이어도 잡힌다
          [7, 6, 6, 6], // 오른쪽에서 왼쪽 보기 — 앵커 아님. 발자국 없으면 빈 칸이다
          [5, 5, 5, 6], // 위에서 아래 보기 — 앵커 아님
          [6, 8, 6, 7], // 아래에서 위 보기 — 앵커 아님
        ] as const;
        for (const [px, py, tx, ty] of probes) {
          expect(findBlockingRuntimeEventAtInMap(project, map, session(), positions, px, py), `서는 칸 (${px},${py})`).toBeUndefined();
          expect(findRuntimeEventAtInMap(project, map, session(), positions, tx, ty, "action")?.event.id, `조사 (${tx},${ty})`).toBe("ev_golem");
        }

        // 렌더 좌표: 2x2 라 두 칸 경계, 배율 2.
        const view = runtimeEventView(golem, session(), positions);
        expect(footprintSpriteX(view.x, view.footprint)).toBe(6 * TILE_SIZE);
        expect(view.scale).toBe(2);

        // 같은 골렘을 실제 렌더 경로에 태운다. 위 두 줄은 footprintSpriteX 를 직접 부르므로
        // renderEvents 가 그 함수를 **쓴다는 것**은 증명하지 않는다.
        const { created, scene } = renderSceneFor(golem);
        renderTiles(scene);
        expect(created).toHaveLength(1);
        expect(created[0].x, "렌더된 스프라이트 x").toBe(6 * TILE_SIZE);
        expect(created[0].y, "렌더된 스프라이트 y — 발밑 칸 하단").toBe(characterSpriteY(7));
        expect(created[0].scale, "렌더된 스프라이트 배율").toBe(2);
      });
    });
    describe("사각으로 찾은 이벤트를 앵커 점으로 돌려세우지 않는다", () => {
      // playSceneMovement.directionTowardPlayer 는 정확히 이 합성이다. 히트테스트가
      // 발자국 사각으로 올라갔으므로 그 결과를 쓰는 방향 계산도 사각을 봐야 한다 —
      // 앵커 델타를 쓰면 앵커가 최근접 칸이 아닐 때 엉뚱한 쪽을 본다.
      //
      // 이 테스트가 실패하려면: 델타를 앵커에서 뽑으면(near 대신 anchor) 첫 단정이
      // facingForDelta(1, 1) → |dx| >= |dy| 가로 우선 → "right" 로 뒤집힌다.
      function facingToward(
        anchorX: number,
        anchorY: number,
        footprint: { width: number; height: number },
        px: number,
        py: number
      ): string {
        const near = nearestCellInRect(footprintBounds(anchorX, anchorY, footprint), px, py);
        return facingForDelta(px - near.x, py - near.y, "down");
      }

      const GOLEM = { width: 2, height: 2 }; // 앵커 (15,18) → (15,17)(16,17)(15,18)(16,18)

      it("2x2 의 비앵커 칸 정남향에서는 down 이다", () => {
        // QA 하네스의 down-alt 프로브가 정확히 이 입력이다.
        expect(facingToward(15, 18, GOLEM, 16, 19)).toBe("down");
        expect(facingToward(15, 18, GOLEM, 15, 19), "앵커 칸 정남향").toBe("down");
      });

      it("2x2 의 나머지 세 면도 사람 눈과 일치한다", () => {
        expect(facingToward(15, 18, GOLEM, 15, 16), "위").toBe("up");
        expect(facingToward(15, 18, GOLEM, 16, 16), "위 — 오른쪽 열").toBe("up");
        expect(facingToward(15, 18, GOLEM, 17, 18), "오른쪽").toBe("right");
        expect(facingToward(15, 18, GOLEM, 14, 17), "왼쪽 — 위쪽 행").toBe("left");
      });

      it("1x1 은 기존 동작과 같다", () => {
        expect(facingToward(5, 7, UNIT_FOOTPRINT, 5, 8)).toBe("down");
        expect(facingToward(5, 7, UNIT_FOOTPRINT, 5, 6)).toBe("up");
        expect(facingToward(5, 7, UNIT_FOOTPRINT, 6, 7)).toBe("right");
        expect(facingToward(5, 7, UNIT_FOOTPRINT, 4, 7)).toBe("left");
        // 1x1 대각은 예전처럼 가로 우선이다 — 클램프가 항등이라 아무것도 바뀌지 않는다.
        expect(facingToward(5, 7, UNIT_FOOTPRINT, 6, 8)).toBe("right");
      });
    });
  });
  describe("runtimeJuice", () => {
    isolateTimers();
    describe("emitRuntimeJuice", () => {
      afterEach(() => {
        const host = globalThis as typeof globalThis & {
          window?: Window & { __oprnRuntimeJuice?: { log: unknown[] } };
          Audio?: unknown;
        };
        if (host.window?.__oprnRuntimeJuice) host.window.__oprnRuntimeJuice.log = [];
        Reflect.deleteProperty(host, "Audio");
        vi.restoreAllMocks();
      });

      it("returns resolved entry and logs override soundResourceId", () => {
        installJuiceGlobals();
        const entry = emitRuntimeJuice({
          event: "title-select",
          soundResourceId: "easyrpg-sound-cursor2",
        });
        expect(entry.soundResourceId).toBe("easyrpg-sound-cursor2");
        expect(entry.event).toBe("title-select");
        expect(entry.motionClass).toBe("juice-title-select");
        expect(runtimeJuiceLog().at(-1)?.soundResourceId).toBe("easyrpg-sound-cursor2");
      });

      it("title cursor/confirm follow the project SE cue table when the title has no own sound", () => {
        installJuiceGlobals();
        const project = { meta: {}, system: { seCues: { cursor: "store-cursor-a", confirm: "store-confirm-a" } } } as never;
        expect(emitRuntimeJuice({ event: "title-select", project }).soundResourceId).toBe("store-cursor-a");
        expect(emitRuntimeJuice({ event: "title-confirm", project }).soundResourceId).toBe("store-confirm-a");
        // 타이틀 전용 소리(titleScreen.sounds → soundResourceId)를 저작했으면 그쪽이 이긴다.
        expect(emitRuntimeJuice({ event: "title-select", project, soundResourceId: "title-own-cursor" }).soundResourceId).toBe("title-own-cursor");
      });

      it("keeps default sound when override is omitted", () => {
        installJuiceGlobals();
        const entry = emitRuntimeJuice({ event: "title-enter" });
        expect(entry.soundResourceId).toBe("easyrpg-sound-decision2");
        expect(runtimeJuiceLog().at(-1)?.soundResourceId).toBe("easyrpg-sound-decision2");
      });
    });
    function installJuiceGlobals(): void {
      class FakeAudio {
        volume = 1;
        play = () => Promise.resolve();
      }
      const host = globalThis as typeof globalThis & {
        window?: Window & { __oprnRuntimeJuice?: { log: unknown[] }; __oprnJuiceLog?: unknown };
        Audio?: unknown;
      };
      host.Audio = FakeAudio;
      host.window = host.window ?? ({} as Window & { __oprnRuntimeJuice?: { log: unknown[] } });
      (host.window as { __oprnRuntimeJuice?: { log: unknown[] } }).__oprnRuntimeJuice = { log: [] };
    }
  });
  describe("runtimeKeyboardMenu", () => {
    isolateTimers();
    describe("runtime keyboard menus", () => {
      it("moves title selection with wrapping arrow keys for count 1/2/3", () => {
        // count 3 (default)
        expect(moveTitleSelection(0, "ArrowDown")).toBe(1);
        expect(moveTitleSelection(0, "ArrowUp")).toBe(2);
        expect(moveTitleSelection(2, "ArrowDown")).toBe(0);
        // count 2 (e.g. continue hidden): New ↔ Quit
        expect(moveTitleSelection(0, "ArrowDown", 2)).toBe(1);
        expect(moveTitleSelection(1, "ArrowDown", 2)).toBe(0);
        expect(moveTitleSelection(0, "ArrowUp", 2)).toBe(1);
        // count 1 (only newGame): sticky 0
        expect(moveTitleSelection(0, "ArrowDown", 1)).toBe(0);
        expect(moveTitleSelection(0, "ArrowUp", 1)).toBe(0);
        // invalid count coerces to ≥1
        expect(moveTitleSelection(0, "ArrowDown", 0)).toBe(0);
      });

      it("moves X-menu command selection and enters/cancels function mode", () => {
        let state: StatusMenuKeyboardState = { selectedCommand: "items", mode: "main" };

        state = reduceStatusMenuKeyboard(state, "ArrowDown");
        expect(state).toEqual({ selectedCommand: "skills", mode: "main", action: "select" });

        state = reduceStatusMenuKeyboard(state, "ArrowDown");
        expect(state).toEqual({ selectedCommand: "equipment", mode: "main", action: "select" });

        state = reduceStatusMenuKeyboard(state, "ArrowUp");
        expect(state).toEqual({ selectedCommand: "skills", mode: "main", action: "select" });

        state = reduceStatusMenuKeyboard(state, "Enter");
        expect(state).toEqual({ selectedCommand: "skills", mode: "function", action: "enter-function" });

        state = reduceStatusMenuKeyboard(state, "Escape");
        expect(state).toEqual({ selectedCommand: "skills", mode: "main", action: "back-to-main" });

        expect(reduceStatusMenuKeyboard(state, "z")).toEqual({
          selectedCommand: "skills",
          mode: "function",
          action: "enter-function",
        });
      });

      it("backs out of X-menu function mode with the cancel key before closing", () => {
        const state: StatusMenuKeyboardState = { selectedCommand: "skills", mode: "function" };

        expect(reduceStatusMenuKeyboard(state, "x")).toEqual({
          selectedCommand: "skills",
          mode: "main",
          action: "back-to-main",
        });
      });
    });
    describe("status menu grid cursor (hub skin)", () => {
      it("columns>1 이면 ←→ 도 격자를 움직이고 ↑↓ 는 열 수만큼 뛴다(토러스 래핑)", () => {
        const ids = ["items", "skills", "equipment", "party-menu", "record-menu", "system-menu"] as const;
        const base = { mode: "main" as const, commandIds: ids, columns: 3 };
        expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowRight").selectedCommand).toBe("skills");
        expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowDown").selectedCommand).toBe("party-menu");
        expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowLeft").selectedCommand).toBe("system-menu");
        expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "party-menu" }, "ArrowDown").selectedCommand).toBe("items");
        expect(reduceStatusMenuKeyboard({ ...base, selectedCommand: "items" }, "ArrowRight").action).toBe("select");
        // 1열은 기존과 같다 — ←→ 는 none
        expect(reduceStatusMenuKeyboard({ selectedCommand: "items", mode: "main", commandIds: ids }, "ArrowRight").action).toBe("none");
      });
    });
    describe("runtime cursor pure helpers", () => {
      it("classifies confirm/cancel keys (RM2003 Z/X + Enter/Esc/Space)", () => {
        for (const key of ["z", "Z", "Enter", " ", "e"]) expect(isConfirmKey(key)).toBe(true);
        for (const key of ["x", "X", "Escape"]) expect(isCancelKey(key)).toBe(true);
        expect(isConfirmKey("x")).toBe(false);
        expect(isCancelKey("z")).toBe(false);
        expect(isConfirmKey("a")).toBe(false);
      });

      it("maps arrow keys to directions", () => {
        expect(navDirection("ArrowUp")).toBe("up");
        expect(navDirection("ArrowDown")).toBe("down");
        expect(navDirection("ArrowLeft")).toBe("left");
        expect(navDirection("ArrowRight")).toBe("right");
        expect(navDirection("z")).toBeNull();
      });

      it("moves a 1D cursor with wrapping (↑↓←→ all ±1)", () => {
        expect(moveCursorIndex(0, 3, "down")).toBe(1);
        expect(moveCursorIndex(0, 3, "right")).toBe(1);
        expect(moveCursorIndex(0, 3, "up")).toBe(2);
        expect(moveCursorIndex(2, 3, "down")).toBe(0);
      });

      it("clamps a 1D cursor when wrap is disabled", () => {
        expect(moveCursorIndex(0, 3, "up", { wrap: false })).toBe(0);
        expect(moveCursorIndex(2, 3, "down", { wrap: false })).toBe(2);
      });

      it("moves a grid cursor by columns", () => {
        expect(moveCursorIndex(0, 4, "down", { columns: 2 })).toBe(2);
        expect(moveCursorIndex(0, 4, "right", { columns: 2 })).toBe(1);
        expect(moveCursorIndex(0, 2, "left", { columns: 2 })).toBe(1);
      });

      it("returns 0 for empty collections", () => {
        expect(moveCursorIndex(0, 0, "down")).toBe(0);
      });
    });
  });
  describe("runtimeSafetyStop", () => {
    isolateTimers();
    function mkSession(): PlaySessionLike {
      return {
        flags: {}, switches: {}, variables: {}, timers: {}, gold: 0, inventory: {},
        partyActorIds: [], actorExperience: {}, actorLevels: {}, actorEquipment: {}, actorVitals: {},
        currentMapId: "m1", x: 0, y: 0, audio: {}, pictures: {},
      } as unknown as PlaySessionLike;
    }
    function runCollectingStops(commands: Command[], options: { maxLoopIterations?: number; maxInstructions?: number }): RuntimeSafetyStop[] {
      const stops: RuntimeSafetyStop[] = [];
      const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        createInterpreter(commands, mkSession(), undefined, { ...options, currentEventId: "ev_spin", onSafetyStop: (stop) => stops.push(stop) }).start();
      } finally {
        consoleWarn.mockRestore();
      }
      return stops;
    }
    describe("테스트 안전 레일", () => {
      it("명령 예산을 다 쓴 실행은 이유가 담긴 기록을 남긴다", () => {
        const stops = runCollectingStops([{ kind: "label", name: "top" }, { kind: "gotoLabel", name: "top" }], { maxInstructions: 50 });
        expect(stops).toEqual([expect.objectContaining({ kind: "instruction-budget", limit: 50, eventId: "ev_spin" })]);
        expect(stops[0]!.message).toContain("ev_spin");
      });

      it("탈출 없는 반복은 반복 예산 기록을 남기고 빠져나온다", () => {
        const stops = runCollectingStops([{ kind: "loop", body: [{ kind: "label", name: "x" }] }], { maxLoopIterations: 4, maxInstructions: 1000 });
        expect(stops.map((stop) => stop.kind)).toEqual(["loop-budget"]);
      });

      it("끝나는 반복은 기록을 남기지 않는다", () => {
        expect(runCollectingStops([{ kind: "loop", body: [{ kind: "breakLoop" }] }], { maxLoopIterations: 4 })).toEqual([]);
      });

      it("장면 테스트는 끝나지 않는 이벤트를 실패와 구조화된 기록으로 돌려준다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.events.push({ id: "ev_spin", x: 1, y: 1, trigger: { kind: "action" },
          commands: [{ kind: "loop", body: [{ kind: "label", name: "x" }] }] } as GameEvent);
        const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
        try {
          const result = runSceneTest(project, { mapId: map.id, start: { x: 1, y: 2 }, steps: [{ kind: "face", dir: "up" }, { kind: "interact" }] });
          expect(result.ok).toBe(false);
          // 본문이 명령 하나뿐이어도 반복 한 바퀴가 명령 둘(본문 + 반복 재진입)이라 명령 예산(10만)이 반복 예산(10만 회)보다 먼저 찬다.
          expect(result.safetyStops).toEqual([expect.objectContaining({ kind: "instruction-budget", eventId: "ev_spin", mapId: map.id })]);
          expect(result.failureReason).toBe(result.safetyStops![0]!.message);
        } finally {
          consoleWarn.mockRestore();
        }
      });

      it("같은 맵으로 이동하는 자동 실행은 걸음 없이 상한을 넘기면 멈춘다", () => {
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        map.events.push({ id: "ev_autorun_loop", x: 1, y: 1, trigger: { kind: "auto" },
          commands: [{ kind: "transfer", mapId: map.id, x: 2, y: 2 }] } as GameEvent);
        const result = runSceneTest(project, { mapId: map.id, start: { x: 2, y: 2 }, steps: [{ kind: "wait", ticks: 1 }] });
        expect(result.ok).toBe(false);
        expect(result.safetyStops).toEqual([expect.objectContaining({ kind: "autorun-repeat", limit: AUTORUN_REPEAT_LIMIT, eventId: "ev_autorun_loop" })]);
      });
    });
  });
  describe("runtimeSession", () => {
    isolateTimers();
    describe("runtime session map overrides", () => {
      it("keeps project map tile arrays unchanged while session overrides resolve at runtime", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const map = project.maps[mapId];
        const originalLower = [...map.lowerTiles];
        const session = startSession(project);

        setMapTileOverride(session, mapId, "lower", 0, TILE.WATER);

        expect(project.maps[mapId].lowerTiles).toEqual(originalLower);
        expect(getMapTile(session, mapId, "lower", map, 0)).toBe(TILE.WATER);
        expect(map.lowerTiles[0]).toBe(originalLower[0]);
      });

      it("saves and restores deterministic RNG stream progress", () => {
        const project = createBlankProject();
        const session = startSession(project, 1234);
        const beforeSaveNext = nextSessionRandom(session, "encounter");
        const snapshot = createSaveSnapshot(project, session);
        const expectedAfterSaveNext = nextSessionRandom(session, "encounter");

        const restored = applySaveSnapshot(project, snapshot);

        expect(restored.rng?.seed).toBe(1234);
        expect(beforeSaveNext).not.toBe(expectedAfterSaveNext);
        expect(nextSessionRandom(restored, "encounter")).toBe(expectedAfterSaveNext);
      });

      it("loads legacy save snapshots without RNG by assigning a compatible RNG state", () => {
        const project = createBlankProject();
        const session = startSession(project, 99);
        const snapshot = createSaveSnapshot(project, session);
        const legacySnapshot = {
          ...snapshot,
          session: {
            ...snapshot.session,
            rng: undefined,
          },
        };

        const restored = applySaveSnapshot(project, legacySnapshot);

        expect(restored.rng?.seed).toBeGreaterThan(0);
        expect(Number.isFinite(nextSessionRandom(restored, "battle"))).toBe(true);
      });
    });
  });
});

describe("playerSuite2", () => {
  isolateTimers();
  describe("oprnGameFile", () => {
    isolateTimers();
    function fileStub(name: string, type = ""): Pick<File, "name" | "type"> {
      return { name, type };
    }
    describe("oprn game file", () => {
      it("derives publication isolation from listing paths, independently of legacy host/file namespaces", () => {
        expect(resolveCommunitySaveScope("/play/listing-a/releases/" + "a".repeat(64) + "/player.html")).toBe("listing-a");
        expect(resolveCommunitySaveScope("/play/listing-b/releases/" + "a".repeat(64) + "/player.html")).toBe("listing-b");
        expect(resolveCommunitySaveScope("/play/encoded%20listing/player.html")).toBe("encoded listing");
        expect(resolveCommunitySaveScope("/renamed-standalone.html")).toBeUndefined();
        expect(resolveCommunitySaveScope("/other/renamed-standalone.html")).toBeUndefined();
      });
      it("accepts the .oprn extension and the package mime types", () => {
        expect(isOprnGameFile(fileStub("my-game.oprn"))).toBe(true);
        expect(isOprnGameFile(fileStub("MY-GAME.OPRN"))).toBe(true);
        expect(isOprnGameFile(fileStub("legacy.rpgzzu"))).toBe(true);
        expect(isOprnGameFile(fileStub("game", "application/vnd.openrpg.project+zip"))).toBe(true);
        expect(isOprnGameFile(fileStub("notes.txt"))).toBe(false);
        expect(isOprnGameFile(fileStub("project.json", "application/json"))).toBe(false);
        expect(OPRN_GAME_FILE_ACCEPT).toContain(".oprn");
      });

      it("picks the first game file out of a mixed drop", () => {
        const dropped = [
          { name: "readme.txt", type: "text/plain" },
          { name: "hero.oprn", type: "" },
          { name: "spare.oprn", type: "" },
        ] as unknown as File[];

        expect(pickOprnGameFile(dropped)?.name).toBe("hero.oprn");
        expect(pickOprnGameFile([{ name: "readme.txt", type: "text/plain" }] as unknown as File[])).toBeNull();
      });

      it("reads a project back out of a single exported .oprn file", async () => {
        // Given
        const project = createBlankProject();
        project.meta.title = "단일 파일 게임";
        const blob = createProjectPackage(project);

        // When
        const read = await readOprnGameFile(blob);

        // Then
        expect(projectPackageFileName(project)).toBe("단일-파일-게임.oprn");
        expect(read.ok).toBe(true);
        if (!read.ok) return;
        expect(read.project.meta.title).toBe("단일 파일 게임");
        expect(Object.keys(read.project.maps)).toEqual(Object.keys(project.maps));
        expect(read.project.startMapId).toBe(project.startMapId);
      });

      it("reports a readable reason instead of throwing when the file is not a package", async () => {
        // Given
        const notAPackage = new Blob([new Uint8Array([1, 2, 3, 4, 5])]);

        // When
        const read = await readOprnGameFile(notAPackage);

        // Then
        expect(read.ok).toBe(false);
        if (read.ok) return;
        expect(read.message.length).toBeGreaterThan(0);
      });

      it("namespaces an opened file by its own identity instead of the host identity", () => {
        const project = createBlankProject();
        project.meta.title = "가져온 게임";
        project.meta.author = "파일 저자";

        expect(resolveExportSaveNamespace(project, {
          source: "opened-file",
          hostSaveNamespace: "host-injected-save-slots",
          pathname: "/play/host-community-game",
        })).toBe(`oprn-export:${exportedProjectId(project)}`);
      });

      it("preserves the bundled player's host, community, then project namespace precedence", () => {
        const project = createBlankProject();
        project.meta.title = "번들 게임";

        expect(resolveExportSaveNamespace(project, {
          source: "bundled",
          hostSaveNamespace: "host-injected-save-slots",
          pathname: "/play/community-game",
        })).toBe("host-injected-save-slots");
        expect(resolveExportSaveNamespace(project, {
          source: "bundled",
          pathname: "/play/community%20game",
        })).toBe("oprn-export:community game");
        expect(resolveExportSaveNamespace(project, {
          source: "bundled",
          pathname: "/player.html",
        })).toBe(`oprn-export:${exportedProjectId(project)}`);
      });
    });
  });
  describe("feature16BattleUiReports", () => {
    isolateTimers();
    function completedBattle() {
      const project = deserialize(JSON.stringify(fixture));
      project.database.enemies.forEach(enemy => { enemy.stats.maxHp = 1; enemy.stats.agility = 1; });
      const session = startSession(project, 12);
      const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true, rng: () => 0.5 });
      for (let i = 0; i < 300 && !runtime.snapshot().result; i++) {
        runtime.tick(1000);
        const state = runtime.snapshot();
        if (state.phase === "actorCommand") {
          const enemy = state.enemies.find(e => !e.defeated);
          if (enemy) runtime.performActorCommand({ kind: "attack", targetEnemyId: enemy.id });
        }
      }
      const snapshot = runtime.snapshot();
      expect(snapshot.result).toBe("victory");
      expect(snapshot.timeline.some(line => line.kind === "damage")).toBe(true);
      appendBattleReport(session, project, snapshot, snapshot.result!);
      return { project, session, snapshot };
    }
    function slot(payload: unknown) {
      const storage = { getItem: (key: string) => key === saveSlotKey(1) ? JSON.stringify(payload) : null } as Storage;
      const read = readSaveSlot(storage, 1);
      expect(read.kind).toBe("present");
      if (read.kind !== "present") throw new Error("save rejected");
      return read.snapshot;
    }
    describe("feature16 actual battle reports and save compatibility", () => {
      it("retains runtime facts after completion and makes every line keyboard navigable", () => {
        const { project, session, snapshot } = completedBattle();
        const report = session.battleReports![0]!;
        expect(report.lines.map(l => l.sequence)).toEqual(snapshot.timeline.map(l => l.sequence).slice(-BATTLE_REPORT_LINE_LIMIT));
        expect(report.lines.some(l => l.text.includes("피해"))).toBe(true);
        let selected: number | undefined;
        const options = { project, session, selectedCommand: "battle-reports" as const, slots: [], waitModeEnabled: true, onSelectBattleReport: (index: number | undefined) => { selected = index; } };
        battleReportDetail(options).entries[0]!.onActivate!();
        expect(selected).toBe(0);
        const detail = battleReportDetail({ ...options, battleReportIndex: selected });
        expect(detail.entries.filter(e => e.testId?.includes("-line-")).every(e => !!e.onActivate)).toBe(true);
        detail.entries[0]!.onActivate!();
        expect(selected).toBeUndefined();
      });
      it("round-trips rows, party order and reports through serialized slot parsing and restore", () => {
        const { project, session } = completedBattle();
        session.partyActorIds.reverse();
        session.actorRows[session.partyActorIds[0]!] = "back";
        const snapshot = slot(createSaveSnapshot(project, session));
        const restored = applySaveSnapshot(project, snapshot);
        expect(restored.battleReports).toEqual(session.battleReports);
        expect(restored.actorRows).toEqual(session.actorRows);
        expect(restored.partyActorIds).toEqual(session.partyActorIds);
        restored.battleReports![0]!.lines[0]!.text = "changed";
        expect(snapshot.session.battleReports![0]!.lines[0]!.text).not.toBe("changed");
      });
      it("loads older saves with front rows and empty history; discards malformed optional history", () => {
        const { project, session } = completedBattle();
        const old = JSON.parse(JSON.stringify(createSaveSnapshot(project, session)));
        delete old.session.actorRows;
        delete old.session.battleReports;
        const restored = applySaveSnapshot(project, slot(old));
        expect(restored.battleReports).toEqual([]);
        expect(Object.values(restored.actorRows).every(row => row === "front")).toBe(true);
        old.session.battleReports = [{ result: "invented", lines: "bad" }];
        expect(applySaveSnapshot(project, slot(old)).battleReports).toEqual([]);
      });
      it("bounds history and drops animations/unknown payloads rather than copying battle graphs", () => {
        const { project, session, snapshot } = completedBattle();
        for (let i = 0; i < BATTLE_REPORT_LIMIT + 5; i++) appendBattleReport(session, project, snapshot, "victory");
        expect(session.battleReports).toHaveLength(BATTLE_REPORT_LIMIT);
        const raw = { ...session.battleReports![0], lines: Array.from({ length: 200 }, (_, sequence) => ({ sequence, text: "x".repeat(600), animation: { huge: true } })) };
        const bounded = normalizeBattleReports([raw])[0]!;
        expect(bounded.lines).toHaveLength(BATTLE_REPORT_LINE_LIMIT);
        expect(bounded.omittedLines).toBe(80);
        expect(bounded.lines[0]).toEqual({ sequence: 80, text: "x".repeat(500) });
      });
      it.each(["defeat", "escape"] as const)("does not claim victory rewards on %s", result => {
        const { project, session, snapshot } = completedBattle();
        appendBattleReport(session, project, snapshot, result);
        expect(session.battleReports!.at(-1)).toMatchObject({ result, exp: 0, gold: 0, items: [] });
      });
    });
  });
  describe("feature16BattleUiFormation", () => {
    isolateTimers();
    const setup = () => deserialize(JSON.stringify(fixture));
    describe("feature16 physical formation", () => {
      it("reduces outgoing/incoming physical damage with legacy fronts and magic unchanged", () => {
        expect(formationDamage(100, "back", "front", "attack", "damage")).toBe(75);
        expect(formationDamage(100, "front", "back", "attack", "damage")).toBe(75);
        expect(formationDamage(100, "back", "back", "attack", "damage")).toBe(56);
        expect(formationDamage(100, undefined, undefined, "attack", "damage")).toBe(100);
        expect(formationDamage(100, "back", "back", "mind", "damage")).toBe(100);
        expect(formationDamage(100, "back", "back", "attack", "healing")).toBe(100);
        expect(formationDamage(-10, "back", "back", "attack", "damage")).toBe(-10);
        expect(formationDamage(0, "back", "back", "attack", "damage")).toBe(0);
        expect(formationDamage(1, "back", "back", "attack", "damage")).toBe(1);
      });
      it("retains raw stats and row through equipment refresh and snapshot", () => {
        const project = setup();
        const front = actorBattlers(project)[0]!;
        const back = actorBattlers(project, { rows: { [front.recordId]: "back" } })[0]!;
        expect(back.attackPower).toBe(front.attackPower);
        expect(back.defense).toBe(front.defense);
        refreshActorBattlerDerivedStats(project, back, {});
        expect(back.row).toBe("back");
        expect(battlerSnapshot(back).row).toBe("back");
        expect(back.defense).toBe(front.defense);
      });
      // Parent combat integration: runtime forwards party.rows; shared damage and prediction apply formationDamage once.
      it("wires saved rows into runtime, damage and prediction without affecting mind skills", () => {
        const project = setup();
        const session = startSession(project);
        const id = session.partyActorIds[0]!;
        const runtime = createBattleRuntime({ project, troopId: "troop_slime", canEscape: false, canLose: true,
          party: { levels: session.actorLevels, experience: {}, rows: { [id]: "back" } } });
        expect(runtime.snapshot().actors.find(a => a.recordId === id)?.row).toBe("back");
        const front = actorBattlers(project)[0]!;
        const back = actorBattlers(project, { rows: { [id]: "back" } })[0]!;
        for (const statistic of ["attack", "mind"] as const) {
          const spec = { power: 100, statistic, effect: "damage" as const, hitRate: 100, variance: 0, criticalRate: 0, rng: () => 0.5 };
          const target = structuredClone(front);
          const base = applySkillLike(structuredClone(front), target, spec).amount;
          const actual = applySkillLike(structuredClone(back), structuredClone(front), spec).amount;
          expect(actual).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
          const incoming = applySkillLike(structuredClone(front), structuredClone(back), spec).amount;
          expect(incoming).toBe(statistic === "attack" ? Math.max(1, Math.floor(base * 0.75)) : base);
          const prediction = predictSkillDamage(project, battlerSnapshot(back), spec, battlerSnapshot(front));
          expect(prediction.amount).toBe(actual);
        }
      });
      it("offers active/reserve ordering and row actions via real detail callbacks", () => {
        const project = setup();
        project.system.activeSlots = 1;
        project.database.actors.push({ ...structuredClone(project.database.actors[0]!), id: "feature16_reserve", name: "대기 동료" });
        const session = startSession(project);
        session.partyActorIds = [session.partyActorIds[0]!, "feature16_reserve"];
        let picked = "";
        let toggled = "";
        let move: unknown;
        const options = { project, session, slots: [], waitModeEnabled: true, selectedCommand: "formation" as const,
          onSelectFormationActor: (id: string) => { picked = id; }, onToggleRow: (id: string) => { toggled = id; },
          onMoveFormationActor: (id: string, index: number) => { move = [id, index]; } };
        const list = formationDetail(options);
        expect(list.entries[0]!.value).toContain("참전");
        list.entries[0]!.onActivate!();
        expect(picked).toBe(session.partyActorIds[0]);
        const selected = formationDetail({ ...options, formationActorId: picked });
        selected.entries.find(e => e.testId === "status-menu-formation-toggle-row")!.onActivate!();
        expect(toggled).toBe(picked);
        expect(selected.entries[1]!.value).toContain("대기");
        selected.entries[1]!.onActivate!();
        expect(move).toEqual([picked, 1]);
      });
    });
  });
  describe("playerItemUse", () => {
    isolateTimers();
    describe("player menu item use", () => {
      // Break caught: 메뉴 경로가 stateEffects 의 remove 만 읽어서, 상태를 "부여"하는 아이템은
      // 필드에서 항상 "효과가 없습니다" 였다(전투에서만 작동).
      it("applies a guaranteed add-op state effect from the menu and consumes the item", () => {
        const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);

        const result = useItemFromMenu(project, session, itemId, actorId);

        expect(result.kind).toBe("used");
        expect(session.actorStateIds?.[actorId]).toContain(stateId);
        expect(session.inventory[itemId]).toBeUndefined();
      });

      it("refuses an add-op state item when the target already carries the state", () => {
        const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);
        session.actorStateIds = { [actorId]: [stateId] };

        const result = useItemFromMenu(project, session, itemId, actorId);

        expect(result.kind).toBe("unusable");
        expect(session.actorStateIds[actorId]).toEqual([stateId]);
        expect(session.inventory[itemId]).toBe(1);
      });

      // Break caught: 부여 판정을 Math.random 으로 굴리면 같은 시드의 세이브가 다른 결과를 낳는다
      // (저장소 계약: src/player·src/battle 는 세션 시드 스트림만 쓴다).
      it("replays the same partial-chance inflict outcome for the same session seed", () => {
        const outcomeFor = (seed: number): readonly string[] => {
          const { project, session, itemId, actorId } = stateInflictFixture(50, seed);
          const results: string[] = [];
          for (let attempt = 0; attempt < 6; attempt += 1) {
            session.inventory[itemId] = 1;
            session.actorStateIds = { [actorId]: [] };
            results.push(useItemFromMenu(project, session, itemId, actorId).kind);
          }
          return results;
        };

        expect(outcomeFor(20260904)).toEqual(outcomeFor(20260904));
        // 부분 확률이므로 시드가 다르면 시퀀스도 갈라져야 한다(상수 반환 방지).
        expect(outcomeFor(20260904)).not.toEqual(outcomeFor(11111));
      });

      it("keeps a zero-chance add-op state item unused instead of burning a copy", () => {
        const { project, session, itemId, actorId, stateId } = stateInflictFixture(0);

        const result = useItemFromMenu(project, session, itemId, actorId);

        expect(result.kind).toBe("unusable");
        expect(session.actorStateIds?.[actorId] ?? []).not.toContain(stateId);
        expect(session.inventory[itemId]).toBe(1);
      });

      it("does not advance the battle RNG for guaranteed, impossible, existing or missing states", () => {
        for (const condition of ["guaranteed", "impossible", "existing", "missing"] as const) {
          const { project, session, itemId, actorId, stateId } = stateInflictFixture(condition === "impossible" ? 0 : condition === "guaranteed" ? 100 : 50, 42);
          if (condition === "existing") session.actorStateIds = { [actorId]: [stateId] };
          if (condition === "missing") project.database.states = project.database.states.filter((state) => state.id !== stateId);
          const beforeRng = structuredClone(session.rng);

          const result = useItemFromMenu(project, session, itemId, actorId);

          expect(session.rng).toEqual(beforeRng);
          expect(result.kind).toBe(condition === "guaranteed" ? "used" : "unusable");
          if (condition === "missing") expect(session.actorStateIds?.[actorId] ?? []).not.toContain(stateId);
        }
      });

      it("applies a party state item to each eligible actor and spends one charge for the whole use", () => {
        const { project, session, itemId, actorId, stateId } = stateInflictFixture(100);
        const secondActorId = project.database.actors.find((actor) => actor.id !== actorId)!.id;
        session.partyActorIds.push(secondActorId);
        session.actorVitals[secondActorId] = { ...session.actorVitals[actorId]! };
        const item = project.database.items.find((item) => item.id === itemId)!;
        item.scope = "allAllies";
        item.consumptionLimit = 3;

        expect(useItemFromMenu(project, session, itemId).kind).toBe("used");
        expect(session.actorStateIds?.[actorId]).toEqual([stateId]);
        expect(session.actorStateIds?.[secondActorId]).toEqual([stateId]);
        expect(session.inventory[itemId]).toBe(1);
        // FIFO cursor counts successful uses of the current copy, not remaining charges.
        expect(session.itemUseCharges?.[itemId]).toBe(1);
      });

      it("does not consume a recovery item on a full-HP target", () => {
        const { project, session, itemId, actorId } = itemUseFixture();
        const beforeHp = session.actorVitals[actorId]!.hp;

        const result = useItemFromMenu(project, session, itemId, actorId);

        expect(result.kind).toBe("unusable");
        expect(session.actorVitals[actorId]!.hp).toBe(beforeHp);
        expect(session.inventory[itemId]).toBe(1);
      });

      it("does not let a normal recovery item revive a dead actor", () => {
        const { project, session, itemId, actorId } = itemUseFixture();
        session.actorVitals[actorId]!.hp = 0;

        const result = useItemFromMenu(project, session, itemId, actorId);

        expect(result.kind).toBe("unusable");
        expect(session.actorVitals[actorId]!.hp).toBe(0);
        expect(session.inventory[itemId]).toBe(1);
      });

      it("applies all-ally recovery to every eligible actor and consumes once", () => {
        const { project, session, itemId, actorId } = itemUseFixture();
        const secondActorId = project.database.actors[1]!.id;
        session.partyActorIds = [actorId, secondActorId];
        session.actorVitals[actorId]!.hp = 10;
        session.actorVitals[secondActorId] = { hp: 80, mp: 10, maxHp: 80, maxMp: 10 };
        session.actorVitals[secondActorId]!.hp = session.actorVitals[secondActorId]!.maxHp;
        const item = project.database.items.find((record) => record.id === itemId)!;
        item.scope = "allAllies";

        const result = useItemFromMenu(project, session, itemId);

        expect(result.kind).toBe("used");
        expect(session.actorVitals[actorId]!.hp).toBe(40);
        expect(session.actorVitals[secondActorId]!.hp).toBe(session.actorVitals[secondActorId]!.maxHp);
        expect(session.inventory[itemId]).toBeUndefined();
      });

      it("removes cured states from the menu and refuses battle-only items", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const actorId = session.partyActorIds[0]!;
        session.actorVitals[actorId] = { hp: 50, mp: 10, maxHp: 100, maxMp: 20 };
        session.actorStateIds = { [actorId]: ["state_poison"] };
        session.inventory = { item_antidote: 1, item_poison_dart: 1 };

        expect(useItemFromMenu(project, session, "item_antidote", actorId).kind).toBe("used");
        expect(session.actorStateIds[actorId]).toEqual([]);
        expect(useItemFromMenu(project, session, "item_poison_dart", actorId).kind).toBe("unusable");
      });
    });
    function stateInflictFixture(chance: number, seed?: number) {
      const project = createBlankProject();
      const session = startSession(project, seed);
      const state = project.database.states[0];
      const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0];
      if (!state || !item) throw new Error("missing fixture");
      item.name = "테스트 강화제";
      item.scope = "ally";
      item.occasion = "field";
      item.occasionField = true;
      item.consumable = true;
      item.consumptionLimit = "noLimit";
      item.hpRecovery = { percentMax: 0, flat: 0 };
      item.mpRecovery = { percentMax: 0, flat: 0 };
      item.healStateIds = [];
      item.stateEffects = [{ stateId: state.id, chance, operation: "add" }];
      session.inventory = { [item.id]: 1 };
      const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id;
      if (!actorId) throw new Error("missing actor fixture");
      session.partyActorIds = [actorId];
      session.actorVitals[actorId] = { hp: 40, mp: 10, maxHp: 40, maxMp: 10 };
      return { project, session, itemId: item.id, actorId, stateId: state.id };
    }
    function itemUseFixture() {
      const project = createBlankProject();
      const session = startSession(project);
      const item = project.database.items.find((record) => record.id === "item_potion") ?? project.database.items[0];
      if (!item) throw new Error("missing item fixture");
      item.name = "테스트 회복약";
      item.scope = "ally";
      item.occasion = "field";
      item.consumable = true;
      item.hpRecovery = { percentMax: 0, flat: 30 };
      item.mpRecovery = { percentMax: 0, flat: 0 };
      session.inventory = { [item.id]: 1 };
      const actorId = session.partyActorIds[0] ?? project.database.actors[0]?.id;
      if (!actorId) throw new Error("missing actor fixture");
      session.partyActorIds = [actorId];
      return { project, session, itemId: item.id, actorId };
    }
  });
});
