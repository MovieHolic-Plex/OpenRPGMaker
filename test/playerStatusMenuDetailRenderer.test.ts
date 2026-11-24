import { describe, expect, it } from "vitest";
import { itemEffectSummary, renderStatusMenuDetailPanel, statusMenuHintClauses } from "@/player/playerStatusMenuDetailRenderer";
import { createBlankProject } from "@/project/defaults";
import type { ItemRecord, ItemCaptureProfile } from "@/project/types";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { listStatusMenuCommandIds } from "@/player/playerStatusMenuModel";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { p2LifeProject } from "./fixtures/p2LifeSystems";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import { activeItemEffects } from "@/project/itemUsage";
import { canUseMenuItemOnActor, useItemFromMenu } from "@/player/playerItemUse";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { isolateTimers } from "./mergedTeardown";

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
