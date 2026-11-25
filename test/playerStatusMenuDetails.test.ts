import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession, changeFriendship, evalCondition } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import type { InventoryView } from "@/player/playerInventoryView";
import { actorFieldStateNames, KNOCKED_OUT_STATE_NAME } from "@/player/actorFieldStates";
import { createPlayerStatusMenuSnapshot, listStatusMenuCommandIds, listStatusMenuGroupCommandIds, STATUS_MENU_COMMAND_IDS, statusMenuCommandLabel } from "@/player/playerStatusMenuModel";
import { formatFriendshipFeedback, friendshipTier, friendshipTierLabel, listFriendshipEntries } from "@/project/friendship";
import { type SaveSlotReadResult, applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { deserialize, serialize, resolveEventPage } from "@/project/io";
import { combinationPartnersOf, combinationRecipeFor, combineItems } from "@/project/craftRecipes";
import { findFacedItemTarget } from "@/player/itemUseOnTarget";
import type { EventPage, GameEvent, Project } from "@/project/types";
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
import { isolateTimers } from "./mergedTeardown";

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
