import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { createBlankProject, DEFAULT_EQUIPMENT_ID } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import { createStatusMenuDetail, bestEquipmentPlan } from "@/player/playerStatusMenuDetails";
import { useItemFromMenu } from "@/player/playerItemUse";
import { type ItemRecord, SCHEMA_VERSION, type Project, type Command, type SkillRecord, type StateRecord, type M2CommandFields } from "@/project/types";
import { renderPlayerStatusMenu } from "@/player/playerStatusMenu";
import type { PlayerStatusMenuActions } from "@/player/playerStatusMenuTypes";
import { findByTestId, installFakeDom, renderWithFakeDom, FakeElement } from "./fakeDom";
import { isolateTimers } from "./mergedTeardown";
import { AUTOSAVE_DEBOUNCE_MS, maybeAutosave, performAutosave, resetAutosaveDebounce, shouldAutosave } from "@/player/autosave";
import { applySaveSnapshot, autosaveKey, createSaveSnapshot, readAutosave, readSaveSlot, saveSlotKey, saveToSlot, setSaveSlotStorageNamespace } from "@/player/saveSlots";
import { beginCutsceneControl } from "@/player/cutsceneControl";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { executeModernCommand } from "@/player/interpreter/m2ModernRuntime";
import { syncRuntimeState } from "@/player/playSceneMapRuntime";
import { store } from "@/project/store";
import { applyFieldStepStates } from "@/project/stateFieldSteps";
import { recordTeleportPoint, teleportMenuEntries } from "@/project/teleportPoints";
import { executeM2RuntimeCommand } from "@/player/interpreter/m2Runtime";
import { m2CommandById, M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { createInterpreter } from "@/player/interpreter";
import { applyHighScore, applyKeyPoll, judgeQuickTime, quickTimeStep } from "@/player/interpreter/minigameCommands";
import { prepareFieldAbility } from "@/player/fieldAbility";
import { clientToWorld, pointerTile } from "@/player/playScenePointerMove";
import { screenColorToRgb, clampMs } from "@/player/interpreter/commandCatalog";
import { HIDE_SHOW_SCREEN_FADE_MS } from "@/player/interpreter/screenEffectPlan";
import { shakeIntensityRatio } from "@/player/playSceneMapCommands";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

describe("player", () => {
  isolateTimers();
  describe("playerMenuItemTargets", () => {
    isolateTimers();
    function fixture(changes: Partial<ItemRecord> = {}) {
      const project = createBlankProject();
      const item = project.database.items.find((item) => item.id === "item_potion")!;
      Object.assign(item, {
        type: "medicine", scope: "ally", occasion: "field", consumable: true,
        consumptionLimit: 1, skillId: undefined, activateSkillId: undefined,
        hpRecovery: { flat: 0, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
        healStateIds: [], stateEffects: [], usableActorIds: [], usableClassIds: [],
        ...changes,
      });
      const session = startSession(project);
      const actorId = session.partyActorIds[0]!;
      session.inventory = { [item.id]: 2 };
      const use = vi.fn((id: string, target?: string) => useItemFromMenu(project, session, id, target));
      const select = vi.fn();
      const detail = (targetItemId?: string) => createStatusMenuDetail({
        project, session, selectedCommand: "items", slots: [], waitModeEnabled: true,
        targetItemId, onSelectItemTarget: select, onUseItem: use,
      });
      const target = () => detail(item.id).entries.find((entry) => entry.testId === `status-menu-item-target-${actorId}`)!;
      return { project, session, item, actorId, detail, target, use, select };
    }
    describe("item menu targets agree with executable effects", () => {
      it.each(["healStateIds", "remove"] as const)("allows %s cures at full HP/MP", (kind) => {
        const f = fixture();
        const stateId = f.project.database.states[0]!.id;
        f.session.actorStateIds![f.actorId] = [stateId];
        if (kind === "healStateIds") f.item.healStateIds = [stateId];
        else f.item.stateEffects = [{ stateId, operation: "remove", chance: 100 }];
        expect(f.target().disabled).toBe(false);
        f.target().onActivate!();
        expect(f.use.mock.results[0]?.value.kind).toBe("used");
        expect(f.session.actorStateIds?.[f.actorId]).toEqual([]);
        expect(f.session.inventory[f.item.id]).toBe(1);
        expect(f.target().disabled).toBe(true);
      });

      it("allows an add-state item at full HP without rolling RNG while browsing", () => {
        const f = fixture();
        const stateId = f.project.database.states[0]!.id;
        f.item.stateEffects = [{ stateId, operation: "add", chance: 100 }];
        const before = structuredClone(f.session);
        expect(f.target().disabled).toBe(false);
        expect(f.session).toEqual(before);
        f.target().onActivate!();
        expect(f.session.actorStateIds?.[f.actorId]).toContain(stateId);
        expect(f.session.inventory[f.item.id]).toBe(1);
        expect(f.target().disabled).toBe(true);
      });

      it.each(["book", "seed"] as const)("selects a recipient for a %s even when its stored scope is none", (type) => {
        const f = fixture({ type, scope: "none" });
        const skillId = f.project.database.skills.at(-1)!.id;
        f.item.learnedSkillId = skillId;
        f.session.actorSkillIds[f.actorId] = [];
        f.item.seedParameterBonuses = { attack: 3, defense: 0, mind: 0, agility: 0 };
        f.detail().entries.find((entry) => entry.testId === `status-menu-item-${f.item.id}`)!.onActivate!();
        expect(f.select).toHaveBeenCalledWith(f.item.id);
        expect(f.use).not.toHaveBeenCalled();
        expect(f.target().disabled).toBe(false);
        f.target().onActivate!();
        expect(f.use.mock.results[0]?.value.kind).toBe("used");
        expect(f.session.inventory[f.item.id]).toBe(1);
        if (type === "book") {
          expect(f.session.actorSkillIds[f.actorId]).toContain(skillId);
          expect(f.target().disabled).toBe(true);
        } else expect(f.session.actorParamBonuses?.[f.actorId]?.attack).toBe(3);
      });

      it("does not enter a stale recovery target screen for ordinary goods", () => {
        const f = fixture({ type: "normalGoods", hpRecovery: { flat: 50, percentMax: 0 } });
        f.session.actorVitals[f.actorId]!.hp = 1;
        f.detail().entries.find((entry) => entry.testId === `status-menu-item-${f.item.id}`)!.onActivate!();
        expect(f.select).not.toHaveBeenCalled();
        expect(f.use.mock.results[0]?.value.kind).toBe("unusable");
        expect(f.target().disabled).toBe(true);
        expect(f.session.inventory[f.item.id]).toBe(2);
      });

      it("activates a switch directly despite a stale ally scope", () => {
        const f = fixture({ type: "switch", scope: "ally", switchId: "qa_device" });
        f.detail().entries.find((entry) => entry.testId === `status-menu-item-${f.item.id}`)!.onActivate!();
        expect(f.select).not.toHaveBeenCalled();
        expect(f.use.mock.results[0]?.value.kind).toBe("used");
        expect(f.session.switches.qa_device).toBe(true);
        expect(f.session.inventory[f.item.id]).toBe(1);
      });

      it("honors actor and effective class restrictions before a target can be selected", () => {
        const f = fixture({ hpRecovery: { flat: 50, percentMax: 0 } });
        f.session.actorVitals[f.actorId]!.hp = 1;
        f.item.usableActorIds = ["another_actor"];
        expect(f.target().disabled).toBe(true);
        f.item.usableActorIds = [];
        f.item.usableClassIds = ["promoted_class"];
        expect(f.target().disabled).toBe(true);
        f.project.database.classes.push({ ...f.project.database.classes[0]!, id: "promoted_class" });
        f.session.classOverrides[f.actorId] = "promoted_class";
        expect(f.target().disabled).toBe(false);
      });
    });
  });
  // 기본 도트 창(메뉴 스킨 pixel) — 상점 기본 프리셋과 같은 창 체계가 ESC 메뉴·장비·아이템 대상으로 이어진다.
  // 화면 모양은 런타임 QA(esc-pixel · inn-battle-pixel)가 본다. 여기서는 수치 계약만 고정한다.
  describe("playerStatusMenuPixel", () => {
    isolateTimers();
    const noop = () => undefined;
    const actions: PlayerStatusMenuActions = {
      onCommand: noop, onOpenGroup: noop, onSaveSlot: noop, onLoadSlot: noop, onSelectItemTarget: noop, onUseItem: noop,
      onSelectSkillActor: noop, onSelectSkill: noop, onSelectEquipmentActor: noop, onSelectEquipmentSlot: noop,
      onEquipItem: noop, onUnequipItem: noop, onOptimizeEquipment: noop, onToggleRow: noop, onSelectFormationActor: noop,
      onMoveFormationActor: noop, onToggleMonsterView: noop, onMoveMonster: noop, onToggleWait: noop, onToTitle: noop,
    };
    /** 전투가 있는 게임으로 만든다 — 전투 없는 게임은 첫 화면이 파티 개요 대신 이야기 개요다(combatPresence, #3660). */
    function withCombat<T extends ReturnType<typeof createBlankProject>>(project: T): T {
      const map = project.maps[project.startMapId]!;
      map.encounterRate = 30;
      map.troopIds = [project.database.troops[0]!.id];
      return project;
    }
    function fourParty() {
      const project = withCombat(createBlankProject());
      const session = startSession(project);
      session.partyActorIds = ["actor_hero", "actor_guardian", "actor_mage", "actor_scout"];
      for (const id of session.partyActorIds) session.actorVitals[id] ??= { hp: 50, maxHp: 100, mp: 5, maxMp: 20 };
      return { project, session };
    }
    describe("pixel window menu (default skin)", () => {
      it("첫 화면 파티 창에 상태이상과 다음 레벨까지 EXP 를 숫자로 보인다", () => {
        const restore = installFakeDom();
        try {
          const { project, session } = fourParty();
          session.actorStateIds = { actor_mage: ["state_poison"] };
          const menu = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "main" }));
          expect(menu.getAttribute("data-menu-skin")).toBe("pixel");
          expect(menu.getAttribute("data-menu-skin-stats")).toBe("true");
          expect(findByTestId(menu, "status-menu-party-overview")).not.toBeNull();
          expect(findByTestId(menu, "status-menu-overview-states-2")?.textContent).toBe("독");
          expect(findByTestId(menu, "status-menu-overview-states-0")?.textContent).toBe("정상");
          expect(findByTestId(menu, "status-menu-overview-exp-0")?.getAttribute("role")).toBe("meter");
          expect(findByTestId(menu, "status-menu-overview-row-0")?.textContent).toMatch(/다음 \d+/);
        } finally { restore(); }
      });

      it("최강 장비는 가방 속 더 강한 무기를 고르고 증감을 현재 → 변경 후로 계산한다", () => {
        const { project, session } = fourParty();
        session.inventory = { equip_iron_sword: 1, equip_steel_sword: 1 };
        const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
        const plan = bestEquipmentPlan({ project, session }, hero)!;
        expect(plan.changes.map((change) => [change.slotId, change.equipmentId])).toEqual([["weapon", "equip_steel_sword"]]);
        const attack = plan.statDelta.find((delta) => delta.label === "공격")!;
        expect(attack.next - attack.current).toBe(20 - 8);
        // 강철 검은 공격 +12 를 주지만 민첩 −1 도 낸다(0b13578d30 이후 음수 장비 보정이 0 으로 깎이지 않는다) — 합계는 12 − 1 = 11.
        expect(plan.gain).toBe(11);
        // 가방이 비면 바꿀 것이 없다.
        session.inventory = {};
        expect(bestEquipmentPlan({ project, session }, hero)!.changes).toEqual([]);
      });

      it("장비 부위 화면 끝에 「최강 장비 합계 +N」, 후보 행에는 가장 큰 변화와 ▲ 가 붙는다", () => {
        const restore = installFakeDom();
        try {
          const { project, session } = fourParty();
          session.inventory = { equip_steel_sword: 1 };
          const slots = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "equipment", equipmentActorId: "actor_hero" }));
          expect(findByTestId(slots, "status-menu-equipment-optimize")?.textContent).toContain("합계 +11");
          const candidates = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "equipment", equipmentActorId: "actor_hero", equipmentSlotId: "weapon", selectedDetailActionIndex: 1 }));
          expect(findByTestId(candidates, "status-menu-equipment-item-equip_steel_sword")?.textContent).toContain("공격+12");
          expect(findByTestId(candidates, "status-menu-stat-delta-공격")?.textContent).toContain("▲12");
        } finally { restore(); }
      });

      it("해독 아이템 대상 카드는 「독 → 정상」, 회복 아이템은 늘어나는 양을 ▲ 로 보인다", () => {
        const restore = installFakeDom();
        try {
          const { project, session } = fourParty();
          session.actorStateIds = { actor_mage: ["state_poison"] };
          session.inventory = { item_antidote: 1, item_potion: 1 };
          // startSession 이 시작 파티의 체력을 이미 채워 두므로(fourParty 의 ??= 는 주인공을 건너뛴다) 회복 대상 주인공을 다치게 둔다.
          session.actorVitals.actor_hero = { hp: 50, maxHp: 100, mp: 5, maxMp: 20 };
          const antidote = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "items", targetItemId: "item_antidote" }));
          expect(findByTestId(antidote, "status-menu-item-target-actor_mage-states")?.textContent).toBe("독 → 정상");
          expect(findByTestId(antidote, "status-menu-item-target-actor_hero-states")?.textContent).toBe("정상");
          const potion = renderWithFakeDom(() => renderPlayerStatusMenu({ project, session, slots: [], actions, mode: "function", selectedCommand: "items", targetItemId: "item_potion" }));
          expect(findByTestId(potion, "status-menu-item-target-actor_hero")?.textContent).toMatch(/HP 50\/100 → \d+ ▲\d+/);
        } finally { restore(); }
      });
    });
  });
  // 스킬 메뉴의 소모 글자가 전투와 같은 값인지 — 고정 MP 만 보이면 최대 MP %·장비 절반·연계 몫이 0 으로 읽힌다.
  describe("playerStatusMenuSkillCost", () => {
    isolateTimers();
    const noop = () => undefined;
    const actions: PlayerStatusMenuActions = {
      onCommand: noop, onOpenGroup: noop, onSaveSlot: noop, onLoadSlot: noop, onSelectItemTarget: noop, onUseItem: noop,
      onSelectSkillActor: noop, onSelectSkill: noop, onSelectEquipmentActor: noop, onSelectEquipmentSlot: noop,
      onEquipItem: noop, onUnequipItem: noop, onOptimizeEquipment: noop, onToggleRow: noop, onSelectFormationActor: noop,
      onMoveFormationActor: noop, onToggleMonsterView: noop, onMoveMonster: noop, onToggleWait: noop, onToTitle: noop,
    };
    function skillMenu() {
      const project = createBlankProject();
      const session = startSession(project);
      const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
      hero.initialLevel = 1;
      hero.parameterCurves = { ...hero.parameterCurves, maxMp: [100, ...hero.parameterCurves.maxMp.slice(1)] };
      session.actorLevels.actor_hero = 1;
      session.actorSkillIds = { ...session.actorSkillIds, actor_hero: ["skill_fire"] };
      const fire = project.database.skills.find((skill) => skill.id === "skill_fire")!;
      fire.mpCost = { flat: 4, percentMax: 10 };
      const sword = project.database.equipment.find((record) => record.id === DEFAULT_EQUIPMENT_ID)!;
      session.actorEquipment = { ...session.actorEquipment, actor_hero: { ...session.actorEquipment.actor_hero, weapon: sword.id } };
      const row = () => createStatusMenuDetail({
        project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills", skillActorId: "actor_hero",
      }).entries.find((entry) => entry.testId === "status-menu-skill-actor_hero-skill_fire")!;
      return { project, session, fire, sword, row };
    }
    describe("status menu skill cost", () => {
      it("shows flat plus percent of max MP, and halves that when equipment says so", () => {
        const { fire, sword, row } = skillMenu();
        // 4 + floor(100 * 10 / 100) = 14. 고정 4 만 보이면 전투에서 실제로 내는 값과 다르다.
        expect(row().value).toBe("MP 14");
        sword.effectFlags.halfMpCost = true;
        // (14 + 1) / 2 = 7. 1 짜리 기술이 0 이 되지 않는 전투 내림과 같다.
        expect(row().value).toBe("MP 7");
        fire.fieldCommonEventId = "common_field_fire";
        expect(row().value).toBe("MP 7 · 필드에서 사용");
      });

      it("uses the project MP term, a combo share, and the second resource when that gauge is on", () => {
        const { project, fire, row } = skillMenu();
        project.meta.terms = { ...project.meta.terms, mp: "마나" };
        expect(row().value).toBe("마나 14");
        fire.comboActorIds = ["actor_hero", "actor_mage"];
        fire.comboMpCosts = [{ actorId: "actor_hero", mp: 6 }, { actorId: "actor_mage", mp: 9 }];
        expect(row().value).toBe("마나 6");
        expect(row().description).toContain("연계:");
        expect(row().description).toContain("마나 6");
        expect(row().description).toContain("마나 9");
        fire.comboActorIds = undefined;
        fire.comboMpCosts = undefined;
        fire.resource2Cost = 5;
        project.system.resource2 = { enabled: true, label: "기력" };
        expect(row().value).toBe("마나 14 · 기력 5");
      });

      it("keeps the equipped mark and still shows the cost the battle will charge", () => {
        const { project, session } = skillMenu();
        const hero = project.database.actors.find((actor) => actor.id === "actor_hero")!;
        hero.loadoutSlots = 2;
        session.actorSkillLoadouts = { actor_hero: ["skill_fire"] };
        const detail = createStatusMenuDetail({
          project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills", skillActorId: "actor_hero",
          onToggleSkillLoadout: () => undefined,
        });
        const row = detail.entries.find((entry) => entry.testId === "status-menu-skill-actor_hero-skill_fire")!;
        expect(row.label.startsWith("● ")).toBe(true);
        expect(row.attributes?.loadoutEquipped).toBe("true");
        expect(row.value).toBe("MP 14");
      });

      it("party row shows the skill count, and the drill-down lists every skill", () => {
        // 이름을 다 잇던 행이 1890px 로 늘어 열 경계에서 잘렸다(폴른 스타 QA, 2026-11-08).
        const { project, session } = skillMenu();
        const names = project.database.skills.slice(0, 13);
        session.actorSkillIds = { ...session.actorSkillIds, actor_hero: names.map((skill) => skill.id) };
        const party = createStatusMenuDetail({ project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills" });
        const heroRow = party.entries.find((entry) => entry.testId === "status-menu-skill-actor-actor_hero")!;
        const listed = createStatusMenuDetail({
          project, session, slots: [], waitModeEnabled: true, selectedCommand: "skills", skillActorId: "actor_hero",
        }).entries;
        expect(listed.length).toBeGreaterThanOrEqual(names.length);
        expect(heroRow.value).toBe(`스킬 ${listed.length}개`);
        for (const skill of names) expect(heroRow.value).not.toContain(skill.name);
      });

      it("paints the same cost on the skill screen row", () => {
        const restore = installFakeDom();
        try {
          const { project, session } = skillMenu();
          const menu = renderWithFakeDom(() => renderPlayerStatusMenu({
            project, session, slots: [], actions, mode: "function", selectedCommand: "skills", skillActorId: "actor_hero",
          }));
          expect(findByTestId(menu, "status-menu-skill-actor_hero-skill_fire")?.textContent).toContain("MP 14");
        } finally { restore(); }
      });
    });
  });
});

describe("playerInterpreterSuite", () => {
  isolateTimers();
  describe("autosave", () => {
    isolateTimers();
    class MemoryStorage implements Storage {
      private readonly values = new Map<string, string>();

      get length(): number {
        return this.values.size;
      }

      clear(): void {
        this.values.clear();
      }

      getItem(key: string): string | null {
        return this.values.get(key) ?? null;
      }

      key(index: number): string | null {
        return Array.from(this.values.keys())[index] ?? null;
      }

      removeItem(key: string): void {
        this.values.delete(key);
      }

      setItem(key: string, value: string): void {
        this.values.set(key, value);
      }
    }
    function projectAndSession(): { project: Project; session: PlaySession } {
      const project = createBlankProject();
      const session = startSession(project);
      return { project, session };
    }
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      resetAutosaveDebounce();
      setSaveSlotStorageNamespace(null);
    });
    describe("autosave policy (shouldAutosave)", () => {
      it("saves by default with no prior autosave", () => {
        const { session } = projectAndSession();
        expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(true);
      });

      it("respects Change Save Access: m2Runtime.access.save === false skips", () => {
        const { session } = projectAndSession();
        ensureM2Runtime(session).access.save = false;
        expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(false);
        expect(shouldAutosave(session, "battleVictory", null, 10_000)).toBe(false);
      });

      it("disables autosave when the current map has disableSave", () => {
        const { project, session } = projectAndSession();
        project.maps[session.currentMapId]!.disableSave = true;
        expect(shouldAutosave(session, "transfer", null, 10_000, project)).toBe(false);
        expect(shouldAutosave(session, "battleVictory", null, 10_000, project)).toBe(false);
      });

      it("skips during cutscene input lock", () => {
        const { session } = projectAndSession();
        beginCutsceneControl(session, "cutscene-1", false);
        expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(false);
      });

      it("debounces 5 seconds since the last autosave", () => {
        const { session } = projectAndSession();
        const last = 100_000;
        expect(shouldAutosave(session, "transfer", last, last + AUTOSAVE_DEBOUNCE_MS - 1)).toBe(false);
        expect(shouldAutosave(session, "transfer", last, last + AUTOSAVE_DEBOUNCE_MS)).toBe(true);
        // 트리거 종류가 달라도 디바운스는 공유된다.
        expect(shouldAutosave(session, "battleVictory", last, last + 1_000)).toBe(false);
      });
    });
    describe("performAutosave / round trip", () => {
      it("writes savedBy=auto with the trigger and round-trips through readAutosave into an identical session", () => {
        const { project, session } = projectAndSession();
        session.gold = 777;
        session.variables["v1"] = 42;
        session.x = 5;
        session.y = 6;
        const storage = new MemoryStorage();

        const written = performAutosave(project, session, storage, "battleVictory");
        expect(written).not.toBeNull();
        expect(written?.savedBy).toBe("auto");
        expect(written?.autosaveTrigger).toBe("battleVictory");

        const result = readAutosave(storage);
        expect(result.kind).toBe("present");
        if (result.kind !== "present") throw new Error("expected present autosave");
        expect(result.snapshot.savedBy).toBe("auto");
        expect(result.snapshot.autosaveTrigger).toBe("battleVictory");

        const restored = applySaveSnapshot(project, result.snapshot);
        expect(restored.gold).toBe(777);
        expect(restored.variables["v1"]).toBe(42);
        expect(restored.x).toBe(5);
        expect(restored.y).toBe(6);
        expect(restored.currentMapId).toBe(session.currentMapId);
      });

      it("keeps the autosave key fully separate from the 3 manual slots (namespace included)", () => {
        expect(autosaveKey()).toBe("oprn:save-slot:v5:auto");
        for (const slot of [1, 2, 3] as const) expect(autosaveKey()).not.toBe(saveSlotKey(slot));
        setSaveSlotStorageNamespace("proj-x");
        expect(autosaveKey()).toBe("proj-x:save-slot:v5:auto");
        expect(saveSlotKey(1)).toBe("proj-x:save-slot:v5:1");
      });

      it("does not touch manual slots when autosaving", () => {
        const { project, session } = projectAndSession();
        const storage = new MemoryStorage();
        saveToSlot(storage, 1, createSaveSnapshot(project, session));
        const before = storage.getItem(saveSlotKey(1));
        performAutosave(project, session, storage, "transfer");
        expect(storage.getItem(saveSlotKey(1))).toBe(before);
        expect(readSaveSlot(storage, 1).kind).toBe("present");
      });

      it("swallows quota failures: warn only, returns null, nothing thrown", () => {
        const { project, session } = projectAndSession();
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const storage = new MemoryStorage();
        vi.spyOn(storage, "setItem").mockImplementation(() => {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        });
        expect(performAutosave(project, session, storage, "transfer")).toBeNull();
        expect(warn).toHaveBeenCalledTimes(1);
        expect(readAutosave(storage).kind).toBe("empty");
      });
    });
    describe("maybeAutosave (PlayScene hook wrapper)", () => {
      it("no-ops without throwing when localStorage is unavailable (headless safety)", () => {
        vi.stubGlobal("localStorage", undefined);
        const { project, session } = projectAndSession();
        expect(maybeAutosave(project, session, "transfer")).toBe(false);
      });

      it("writes once then debounces, and saves again after the window", () => {
        const storage = new MemoryStorage();
        vi.stubGlobal("localStorage", storage);
        const { project, session } = projectAndSession();
        resetAutosaveDebounce();

        expect(maybeAutosave(project, session, "transfer", 50_000)).toBe(true);
        expect(readAutosave(storage).kind).toBe("present");
        expect(maybeAutosave(project, session, "battleVictory", 51_000)).toBe(false);
        expect(maybeAutosave(project, session, "battleVictory", 50_000 + AUTOSAVE_DEBOUNCE_MS)).toBe(true);

        const result = readAutosave(storage);
        if (result.kind !== "present") throw new Error("expected present autosave");
        expect(result.snapshot.autosaveTrigger).toBe("battleVictory");
      });

      it("does not consume the debounce window when the write fails", () => {
        const storage = new MemoryStorage();
        vi.stubGlobal("localStorage", storage);
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
          throw new DOMException("quota exceeded", "QuotaExceededError");
        });
        const { project, session } = projectAndSession();
        resetAutosaveDebounce();

        expect(maybeAutosave(project, session, "transfer", 10_000)).toBe(false);
        setItem.mockRestore();
        // 실패는 lastAutosaveAtMs 를 갱신하지 않으므로 바로 다음 기회에 다시 시도된다.
        expect(maybeAutosave(project, session, "transfer", 10_001)).toBe(true);
      });
    });
    describe("manual slot schemaVersion compatibility (regression)", () => {
      it("preserves persistent runtime progression through the real storage loader", () => {
        // Break caught: adding a PlaySession field without wiring the save type, writer,
        // known-field parser, and restorer silently resets player progress after reload.
        const { project, session } = projectAndSession();
        project.database.lifeSkills = [
          { id: "skill_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] },
        ];
        session.actorBattleCommands = { actor_hero: ["cmd_item"] };
        session.lifeSkills = { skill_farming: { xp: 100, level: 2 } };
        session.actorNicknames = { actor_hero: "별명" };
        session.actorFaceResourceIds = { actor_hero: "face_custom" };
        session.shopLoyaltySpend = { shop_1: 500 };
        session.shopTradeCounts = { shop_1: { sold: 2, bought: 1 } };
        session.shopMileagePoints = 42;
        session.shopPawnTickets = {
          ticket_1: { itemId: "item_bomb", pawnPrice: 25, dueDayKey: "1:spring:3" },
        };
        session.shopLastRestockDayKey = { shop_1: "1:spring:3" };
        ensureM2Runtime(session).access.save = false;
        const storage = new MemoryStorage();

        saveToSlot(storage, 1, createSaveSnapshot(project, session));
        const loaded = readSaveSlot(storage, 1);

        expect(loaded.kind).toBe("present");
        if (loaded.kind !== "present") throw new Error("expected present slot");
        const restored = applySaveSnapshot(project, loaded.snapshot);
        expect(restored.actorBattleCommands).toEqual(session.actorBattleCommands);
        expect(restored.lifeSkills).toEqual(session.lifeSkills);
        expect(restored.actorNicknames).toEqual(session.actorNicknames);
        expect(restored.actorFaceResourceIds).toEqual(session.actorFaceResourceIds);
        expect(restored.shopLoyaltySpend).toEqual(session.shopLoyaltySpend);
        expect(restored.shopTradeCounts).toEqual(session.shopTradeCounts);
        expect(restored.shopMileagePoints).toBe(42);
        expect(restored.shopPawnTickets).toEqual(session.shopPawnTickets);
        expect(restored.shopLastRestockDayKey).toEqual(session.shopLastRestockDayKey);
        expect(restored.m2Runtime?.access?.save).toBe(false);
      });

      it("parses a pre-autosave manual snapshot JSON (no savedBy/autosaveTrigger) as present", () => {
        const { project, session } = projectAndSession();
        const snapshot = createSaveSnapshot(project, session);
        // 구 스냅샷 시뮬레이션: 새 optional 필드가 아예 없는 JSON.
        const legacy = { ...snapshot, schemaVersion: SCHEMA_VERSION };
        delete legacy.savedBy;
        delete legacy.autosaveTrigger;
        expect(legacy.schemaVersion).toBe(SCHEMA_VERSION);

        const storage = new MemoryStorage();
        storage.setItem(saveSlotKey(2), JSON.stringify(legacy));
        const result = readSaveSlot(storage, 2);
        expect(result.kind).toBe("present");
        if (result.kind !== "present") throw new Error("expected present slot");
        expect(result.snapshot.savedBy).toBeUndefined();
        expect(result.snapshot.autosaveTrigger).toBeUndefined();
      });

      it("ignores unknown savedBy/autosaveTrigger values instead of corrupting the slot", () => {
        const { project, session } = projectAndSession();
        const snapshot = createSaveSnapshot(project, session) as unknown as Record<string, unknown>;
        snapshot.savedBy = "cloud";
        snapshot.autosaveTrigger = "meteor";
        const storage = new MemoryStorage();
        storage.setItem(autosaveKey(), JSON.stringify(snapshot));
        const result = readAutosave(storage);
        expect(result.kind).toBe("present");
        if (result.kind !== "present") throw new Error("expected present autosave");
        expect(result.snapshot.savedBy).toBeUndefined();
        expect(result.snapshot.autosaveTrigger).toBeUndefined();
      });

      it("reports empty/corrupt autosave results distinctly", () => {
        const storage = new MemoryStorage();
        expect(readAutosave(storage)).toEqual({ kind: "empty" });
        storage.setItem(autosaveKey(), "{broken json");
        expect(readAutosave(storage).kind).toBe("corrupt");
        storage.setItem(autosaveKey(), JSON.stringify({ schemaVersion: 999 }));
        expect(readAutosave(storage)).toEqual({ kind: "corrupt", message: "Unsupported save schema" });
      });
    });
  });
  // 컷신 중 필드 HUD 억제. hideHud 는 Modern `Cutscene Control` 의 드롭다운 옵션으로만 존재하고
  // 런타임 소비처가 없는 죽은 값이었다 — 미니맵·손 슬롯을 숨기는 유일한 경로가 대화창 `:has()`
  // CSS 라, 대사가 없는 비트(카메라 팬·픽처)에서는 HUD 가 그대로 떠 있었다.
  //
  // 단정은 **프로덕션 경로**(syncRuntimeState)를 지난다. 리더 함수를 직접 부르면 호출 지점이
  // syncRuntimeState 에서 사라져도 초록으로 남는다 — 그 구멍이 이 회귀의 원인이었다.
  // 플래그·클래스 이름은 리터럴로 고정한다: 구현 상수를 import 해 비교하면 이름이 바뀌어도
  // 통과하는 항등 단정이 된다(CSS 는 상수를 볼 수 없으므로 계약은 문자열 그 자체다).
  describe("cutsceneHudVisibility", () => {
    isolateTimers();
    const HIDE_HUD_FLAG = "cutscene:hideHud";
    const LOCK_FLAG = "cutscene:inputLocked";
    const HUD_HIDDEN_CLASS = "cutscene-hud-hidden";
    /** 스테이지가 붙은 최소 씬. 보이는 HUD 갱신 경로(비계측)만 지나간다. */
    function sceneWithStage(stage: FakeElement) {
      const session = startSession(store.getCurrent());
      const scene = {
        game: { registry: { get: (key: string) => (key === "dialogueHost" ? stage : undefined) } },
        runtimeDom: {
          instrumented: false,
          syncPictureLayer: vi.fn(),
          syncVisibleHud: vi.fn(),
        },
        runtimeTimers: new Map(),
        session,
      };
      return { scene, session };
    }
    let restoreDom: (() => void) | null = null;
    beforeEach(() => {
      restoreDom = installFakeDom();
    });
    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });
    describe("컷신 HUD 억제", () => {
      it("hideHud 플래그가 켜지면 스테이지에 억제 클래스가 붙는다", () => {
        // Given: 스테이지가 마운트된 씬과 HUD 숨김을 요청한 컷신.
        const stage = new FakeElement("div");
        stage.className = "play-stage";
        const { scene, session } = sceneWithStage(stage);
        session.flags[HIDE_HUD_FLAG] = true;

        // When: 런타임이 보이는 표면을 동기화한다.
        syncRuntimeState(scene as never);

        // Then: HUD 억제 클래스가 붙는다.
        expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
      });

      it("입력 잠금 중에도 억제된다 — 대사 없는 비트(카메라 팬·픽처)를 포함한다", () => {
        // Given: 대화 오버레이가 비어 있는(자식이 없는) 스테이지와 입력 잠금.
        const stage = new FakeElement("div");
        stage.className = "play-stage";
        const { scene, session } = sceneWithStage(stage);
        session.flags[LOCK_FLAG] = true;
        expect(stage.childNodes.length).toBe(0);

        // When: 런타임이 보이는 표면을 동기화한다.
        syncRuntimeState(scene as never);

        // Then: 대화창 `:has()` 규칙에 의존하지 않고 억제된다.
        expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
      });

      it("컷신이 끝나면 억제 클래스를 걷어낸다", () => {
        // Given: 이전 컷신의 억제 클래스가 남은 스테이지, 플래그는 모두 꺼져 있다.
        const stage = new FakeElement("div");
        stage.className = `play-stage ${HUD_HIDDEN_CLASS}`;
        const { scene } = sceneWithStage(stage);

        // When: 런타임이 보이는 표면을 동기화한다.
        syncRuntimeState(scene as never);

        // Then: 남은 억제 클래스가 사라진다(HUD 가 영구히 숨는 것을 막는다).
        expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(false);
      });

      it("Modern `Cutscene Control` 의 HUD 숨김 액션이 억제까지 이어진다", () => {
        // Given: 스테이지가 마운트된 씬(잠금은 걸지 않는다 — hideHud 단독 경로를 본다).
        const stage = new FakeElement("div");
        stage.className = "play-stage";
        const { scene, session } = sceneWithStage(stage);

        // When: 작가가 실제로 배치하는 Modern 커맨드를 그대로 실행하고 표면을 동기화한다.
        executeModernCommand(session, ensureM2Runtime(session), "Cutscene Control", {
          action: "hideHud",
          enabled: true,
        });
        syncRuntimeState(scene as never);

        // Then: 커맨드가 심은 플래그가 리더가 읽는 키와 같아서 HUD 가 숨는다.
        expect(session.flags[HIDE_HUD_FLAG]).toBe(true);
        expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
      });

      it("억제 클래스가 미니맵과 손 슬롯을 실제로 숨긴다", async () => {
        // Given: 런타임 플레이 서페이스 시트.
        const css = await readFile(
          fileURLToPath(new URL("../src/styles/runtime/playSurface.css", import.meta.url)),
          "utf8",
        );

        // When: display:none 을 선언한 규칙의 선택자만 모은다.
        const suppressionSelectors = Array.from(
          css.matchAll(/([^{}]+)\{([^{}]*)\}/gu),
          ([, selectors, declarations]) => ({ declarations, selectors }),
        )
          .filter(({ declarations }) => /display:\s*none/u.test(declarations))
          .map(({ selectors }) => selectors)
          .join("\n");

        // Then: 두 필드 HUD 표면이 모두 억제 대상이다.
        expect(suppressionSelectors).toContain(`.play-stage.${HUD_HIDDEN_CLASS} .minimap-root`);
        expect(suppressionSelectors).toContain(`.play-stage.${HUD_HIDDEN_CLASS} .hand-slot`);
      });
    });
  });
  describe("freezeFrameSaveRestore", () => {
    isolateTimers();
    function mkSession(project = createBlankProject()): PlaySession {
      return {
        switches: {},
        selfSwitches: {},
        variables: {},
        timers: {},
        gold: 0,
        inventory: {},
        partyActorIds: [],
        monsterInstances: {},
        monsterParty: [],
        monsterBox: [],
        classOverrides: {},
        actorSkillIds: {},
        actorExperience: {},
        actorLevels: {},
        actorVitals: {},
        eventLocations: {},
        erasedEventIds: [],
        npcTravelStates: {},
        followers: [],
        followerTrail: [],
        actorEquipment: {},
        actorRows: {},
        currentMapId: project.startMapId,
        x: project.startPos.x,
        y: project.startPos.y,
        lighting: { ambient: 0, sources: [] },
        mapOverrides: {},
        flags: {},
        audio: {},
        pictures: {},
        playTimeSeconds: 0,
      };
    }
    class MemoryStorage implements Storage {
      private store = new Map<string, string>();
      get length(): number {
        return this.store.size;
      }
      clear(): void {
        this.store.clear();
      }
      getItem(key: string): string | null {
        return this.store.get(key) ?? null;
      }
      key(index: number): string | null {
        return [...this.store.keys()][index] ?? null;
      }
      removeItem(key: string): void {
        this.store.delete(key);
      }
      setItem(key: string, value: string): void {
        this.store.set(key, value);
      }
    }
    describe("세이브/로드 — 정지 화면", () => {
      it("정지 화면이 없으면 화면 상태에 적지 않는다", () => {
        const project = createBlankProject();
        const snapshot = createSaveSnapshot(project, mkSession(project));
        expect(snapshot.session.screen).toBeUndefined();
      });

      it("색감·다시 찍기 횟수·전환 시간은 슬롯을 다시 읽어도 남고, 찍은 그림은 세이브에 없다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const screen = ensureM2Runtime(session).screen;
        screen.freeze = { style: "sepia", at: 2 };
        screen.freezeDurationMs = 400;

        const storage = new MemoryStorage();
        expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
        const stored = JSON.parse(storage.getItem(saveSlotKey(1)) ?? "{}") as {
          session: { screen: { freeze: Record<string, unknown> } };
        };
        expect(stored.session.screen.freeze).toEqual({ style: "sepia", at: 2 });

        const result = readSaveSlot(storage, 1);
        expect(result.kind).toBe("present");
        if (result.kind !== "present") return;
        expect(result.snapshot.session.screen).toMatchObject({
          freeze: { style: "sepia", at: 2 },
          freezeDurationMs: 400,
        });

        const restored = applySaveSnapshot(project, result.snapshot);
        expect(restored.m2Runtime?.screen.freeze).toEqual({ style: "sepia", at: 2 });
        expect(restored.m2Runtime?.screen.freezeDurationMs).toBe(400);
      });

      it("정지를 푼 뒤에는 세이브에 남지 않는다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        const screen = ensureM2Runtime(session).screen;
        screen.freeze = { style: "warm", at: 1 };
        screen.freezeDurationMs = 200;
        delete screen.freeze;
        delete screen.freezeDurationMs;

        const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
        expect(restored.m2Runtime?.screen.freeze).toBeUndefined();
      });

      it("깨진 정지 화면 칸은 슬롯 전체를 손상으로 보지 않고, 같이 적힌 색조는 남긴다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        ensureM2Runtime(session).screen.tint = "128,64,32";
        const storage = new MemoryStorage();
        expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
        const key = saveSlotKey(1);
        const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: { screen: Record<string, unknown> } };
        raw.session.screen.freeze = { style: "poster", at: 0, image: "data:image/png;base64,aaaa" };
        raw.session.screen.freezeDurationMs = -20;
        storage.setItem(key, JSON.stringify(raw));

        const result = readSaveSlot(storage, 1);
        expect(result.kind).toBe("present");
        if (result.kind !== "present") return;
        expect(result.snapshot.session.screen?.freeze).toBeUndefined();
        expect(result.snapshot.session.screen?.freezeDurationMs).toBeUndefined();
        expect(result.snapshot.session.screen?.tint).toBe("128,64,32");

        const restored = applySaveSnapshot(project, result.snapshot);
        expect(restored.m2Runtime?.screen.freeze).toBeUndefined();
        expect(restored.m2Runtime?.screen.tint).toBe("128,64,32");
      });

      it("전환 시간만 깨지면 정지 화면은 즉시(0ms)로 불러온다", () => {
        const project = createBlankProject();
        const session = mkSession(project);
        ensureM2Runtime(session).screen.freeze = { style: "mono", at: 1 };
        const storage = new MemoryStorage();
        expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
        const key = saveSlotKey(1);
        const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: { screen: Record<string, unknown> } };
        raw.session.screen.freezeDurationMs = 9_999_999;
        storage.setItem(key, JSON.stringify(raw));

        const result = readSaveSlot(storage, 1);
        expect(result.kind).toBe("present");
        if (result.kind !== "present") return;
        expect(result.snapshot.session.screen?.freeze).toEqual({ style: "mono", at: 1 });
        expect(result.snapshot.session.screen?.freezeDurationMs).toBeUndefined();
        expect(applySaveSnapshot(project, result.snapshot).m2Runtime?.screen.freezeDurationMs).toBe(0);
      });
    });
  });
});

describe("playerInterpreterSuite2", () => {
  isolateTimers();
  // 명작 공백 G3 필드 키트(#1 미니게임 · #5 필드 능력 · #24 순간이동 · #25 걸음 상태 · #32 클릭 이동) — 2026-09-27.
  describe("mgL6FieldKit", () => {
    isolateTimers();
    function poisonProject(state: Partial<StateRecord>): Project {
      const project = createBlankProject();
      project.database.states = [{ id: "state_swamp", name: "늪독", ...state } as StateRecord];
      return project;
    }
    function partySession(project: Project) {
      const session = startSession(project);
      session.partyActorIds = ["hero"];
      session.actorVitals = { hero: { hp: 10, mp: 8, maxHp: 30, maxMp: 20 } };
      session.actorStateIds = { hero: ["state_swamp"] };
      return session;
    }
    describe("#25 필드 걸음 상태", () => {
      it("간격마다 HP 를 깎고 1 아래로는 내리지 않는다", () => {
        const project = poisonProject({ hpReleaseStep: -4, fieldStepInterval: 2 });
        const session = partySession(project);
        applyFieldStepStates(project, session);
        expect(session.actorVitals.hero!.hp).toBe(10);
        applyFieldStepStates(project, session);
        expect(session.actorVitals.hero!.hp).toBe(6);
        for (let i = 0; i < 10; i += 1) applyFieldStepStates(project, session);
        expect(session.actorVitals.hero!.hp).toBe(1);
      });

      it("fieldStepCanKill 이면 전원 0 에서 패배를 알린다", () => {
        const project = poisonProject({ hpReleaseStep: -20, fieldStepCanKill: true });
        const session = partySession(project);
        expect(applyFieldStepStates(project, session).defeated).toBe(true);
      });

      it("releaseAfterSteps 를 채우면 상태가 풀리고 카운터도 지운다", () => {
        const project = poisonProject({ releaseAfterSteps: 3 });
        const session = partySession(project);
        applyFieldStepStates(project, session);
        applyFieldStepStates(project, session);
        expect(session.actorStateIds!.hero).toContain("state_swamp");
        const result = applyFieldStepStates(project, session);
        expect(result.released).toEqual([{ actorId: "hero", stateId: "state_swamp" }]);
        expect(session.actorStateIds!.hero).not.toContain("state_swamp");
      });

      it("걸음 효과가 없는 옛 상태는 아무것도 바꾸지 않는다", () => {
        const project = poisonProject({});
        const session = partySession(project);
        expect(applyFieldStepStates(project, session)).toEqual({ changed: 0, released: [], defeated: false });
        expect(session.stateStepCounts).toBeUndefined();
      });
    });
    describe("#24 방문지 순간이동", () => {
      it("Set Teleportation Point 가 목록에 쌓이고 메뉴는 지금 맵과 없는 맵을 뺀다", () => {
        const project = createBlankProject();
        project.maps.town = { ...project.maps[project.startMapId]!, id: "town", name: "물가 마을" };
        const session = startSession(project);
        const entry = m2CommandById("m2-072-set-teleportation-point")!;
        executeM2RuntimeCommand(session, entry, { commandId: entry.id, fields: { mapId: "town", x: 3, y: 4 } }, { project });
        recordTeleportPoint(session, { mapId: "gone", x: 0, y: 0 });
        recordTeleportPoint(session, { mapId: session.currentMapId, x: 1, y: 1 });
        expect(teleportMenuEntries(session, project.maps).map((e) => e.label)).toEqual(["물가 마을"]);
      });

      it("순간이동이 금지되면 Teleport Menu 는 결과 변수에 -1 을 쓰고 멈추지 않는다", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const commands: Command[] = [
          { kind: "m2Command", commandId: "m2-073-teleportation-on-off", fields: { enabled: "false" } },
          { kind: "m2Command", commandId: "m2-223-teleport-menu", fields: { resultVariableId: "where" } },
        ];
        const step = createInterpreter(commands, session, project).start();
        expect(step.kind).toBe("done");
        expect(session.variables.where).toBe(-1);
      });
    });
    describe("#1 미니게임 키트", () => {
      it("Key Poll 이 지금 눌린 키를 변수·스위치로 옮긴다", () => {
        const session = startSession(createBlankProject());
        session.heldInput = { dir: 6, confirm: true, cancel: false, dash: true };
        applyKeyPoll(session, { dirVariableId: "dir", confirmSwitchId: "hit", dashSwitchId: "run" });
        expect(session.variables.dir).toBe(6);
        expect(session.switches.hit).toBe(true);
        expect(session.switches.run).toBe(true);
      });

      it("High Score: 높은 점수만 갱신하고 새 기록 스위치를 켠다, 시간 기록은 낮을수록", () => {
        const session = startSession(createBlankProject());
        session.variables.score = 120;
        applyHighScore(session, { scoreId: "fish", action: "submit", valueVariableId: "score", resultVariableId: "best", recordSwitchId: "new" });
        expect([session.variables.best, session.switches.new]).toEqual([120, true]);
        session.variables.score = 80;
        applyHighScore(session, { scoreId: "fish", action: "submit", valueVariableId: "score", resultVariableId: "best", recordSwitchId: "new" });
        expect([session.variables.best, session.switches.new]).toEqual([120, false]);
        session.variables.score = 42;
        applyHighScore(session, { scoreId: "race", action: "submitLow", valueVariableId: "score", resultVariableId: "best" });
        session.variables.score = 50;
        applyHighScore(session, { scoreId: "race", action: "submitLow", valueVariableId: "score", resultVariableId: "best" });
        expect(session.highScores).toEqual({ fish: 120, race: 42 });
      });

      it("QTE 판정: 순서가 맞아야 1, 연타는 횟수", () => {
        const step = quickTimeStep({ mode: "sequence", keys: "up, down ,z, nope", windowMs: 800 });
        expect(step.keys).toEqual(["up", "down", "z"]);
        expect(judgeQuickTime(step, ["up", "down", "z"])).toBe(1);
        expect(judgeQuickTime(step, ["up", "z"])).toBe(0);
        expect(judgeQuickTime(quickTimeStep({ mode: "mash", keys: "z" }), ["z", "z", "z", "z"])).toBe(4);
      });

      it("Timed Choice·QTE 는 일시정지하고 결과가 변수·스위치로 돌아온다", () => {
        const project = createBlankProject();
        const session = startSession(project);
        const commands: Command[] = [
          { kind: "m2Command", commandId: "m2-220-timed-choice", fields: { options: "싸운다\n도망친다", timeLimitMs: 2000, resultVariableId: "pick" } },
          { kind: "m2Command", commandId: "m2-221-quick-time-event", fields: { mode: "sequence", keys: "z", resultVariableId: "qte", resultSwitchId: "ok" } },
        ];
        const interpreter = createInterpreter(commands, session, project);
        const first = interpreter.start();
        expect(first).toMatchObject({ kind: "timedChoice", options: ["싸운다", "도망친다"], timeLimitMs: 2000 });
        const second = interpreter.resume(0);
        expect(session.variables.pick).toBe(0);
        expect(second.kind).toBe("quickTimeEvent");
        interpreter.resume(1);
        expect([session.variables.qte, session.switches.ok]).toEqual([1, true]);
      });
    });
    describe("#5 필드 능력", () => {
      it("MP 를 내고 정면 대상과 좌표를 적는다, MP 가 모자라면 쓰지 못한다", () => {
        const project = createBlankProject();
        project.commonEvents = [{ id: "ce_move", name: "무브", trigger: "none", commands: [] } as Project["commonEvents"][number]];
        const skill = { id: "sk_move", name: "무브", mpCost: { flat: 5, percentMax: 0 }, fieldCommonEventId: "ce_move" } as SkillRecord;
        const session = startSession(project);
        session.partyActorIds = ["hero"];
        session.actorVitals = { hero: { hp: 10, mp: 7, maxHp: 10, maxMp: 20 } };
        session.x = 4;
        session.y = 4;
        expect(prepareFieldAbility(project, session, "hero", skill, { facing: "up", eventId: "boulder" })).toEqual({ kind: "ok", commonEventId: "ce_move" });
        expect(session.actorVitals.hero!.mp).toBe(2);
        expect([session.variables.fieldAbilityX, session.variables.fieldAbilityY, session.stringVariables?.fieldAbilityTarget]).toEqual([4, 3, "boulder"]);
        expect(prepareFieldAbility(project, session, "hero", skill, { facing: "up" }).kind).toBe("unusable");
      });
    });
    describe("#32 클릭 이동", () => {
      it("화면 좌표를 타일로 바꾸고 맵 밖은 무시한다", () => {
        const scene = { map: { width: 10, height: 8, tileSize: 16 } } as unknown as Parameters<typeof pointerTile>[0];
        expect(pointerTile(scene, 40, 20)).toEqual({ x: 2, y: 1 });
        expect(pointerTile(scene, -1, 5)).toBeUndefined();
        expect(pointerTile(scene, 16 * 10, 5)).toBeUndefined();
      });

      it("화면 좌표를 캔버스 배율·스크롤·줌으로 월드 좌표로 되돌리고 캔버스 밖은 버린다", () => {
        // 캔버스 CSS 960x720 에 논리 320x240(3배), 왼쪽·위 32·24 px 여백.
        const rect = { left: 32, top: 24, width: 960, height: 720 };
        const camera = { scrollX: 0, scrollY: 0, zoom: 1, width: 320, height: 240 };
        expect(clientToWorld(rect, camera, 32 + 12.5 * 16 * 3, 24 + 8.5 * 16 * 3)).toEqual({ x: 200, y: 136 });
        expect(clientToWorld(rect, { ...camera, scrollX: 48, zoom: 2 }, 32 + 96, 24)).toEqual({ x: 64, y: 0 });
        expect(clientToWorld(rect, camera, 10, 10)).toBeUndefined();
      });
    });
  });
  describe("screenEffects", () => {
    isolateTimers();
    function mkSession(): PlaySessionLike {
      return {
        flags: {},
        switches: {},
        variables: {},
        timers: {},
        gold: 0,
        inventory: {},
        partyActorIds: [],
        actorExperience: {},
        actorLevels: {},
        actorEquipment: {},
        actorVitals: {},
        currentMapId: "m1",
        x: 0,
        y: 0,
        audio: {},
        pictures: {},
      };
    }
    function modernM2Command(title: string, fields: M2CommandFields = {}): Command {
      const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
      if (!entry) throw new Error(`missing catalog entry for ${title}`);
      return { kind: "m2Command", commandId: entry.id, fields };
    }
    // flashScreen/shakeScreen/wait(화면 숨기기·표시 페이드 포함)는 pause 이므로 resume 으로 넘긴다.
    function drainScreenCommands(commands: Command[], session: PlaySessionLike): void {
      const interp = createInterpreter(commands, session);
      let r = interp.start();
      let guard = 0;
      while (r.kind !== "done" && guard++ < 1000) {
        if (r.kind === "flashScreen" || r.kind === "shakeScreen") {
          r = interp.resume(undefined);
        } else if (r.kind === "text" || r.kind === "wait") {
          r = interp.resume(undefined);
        } else {
          break;
        }
      }
    }
    describe("화면 효과 — 인터프리터", () => {
      it("Flash Screen 명령이 flashScreen StepResult 를 반환한다", () => {
        const session = mkSession();
        const interp = createInterpreter(
          [modernM2Command("Flash Screen", { color: "red", durationMs: 500 })],
          session
        );
        const r = interp.start();

        expect(r.kind).toBe("flashScreen");
        if (r.kind === "flashScreen") {
          expect(r.red).toBe(255);
          expect(r.green).toBe(0);
          expect(r.blue).toBe(0);
          expect(r.durationMs).toBe(500);
        }
      });

      it("Shake Screen 명령이 shakeScreen StepResult 를 반환한다", () => {
        const session = mkSession();
        const interp = createInterpreter(
          [modernM2Command("Shake Screen", { intensity: 6, durationMs: 700 })],
          session
        );
        const r = interp.start();

        expect(r.kind).toBe("shakeScreen");
        if (r.kind === "shakeScreen") {
          expect(r.intensity).toBe(6);
          expect(r.durationMs).toBe(700);
        }
      });

      it("Flash/Shake 효과 후 다음 명령이 정상 실행된다", () => {
        const session = mkSession();
        const commands: Command[] = [
          modernM2Command("Flash Screen", { color: "white" }),
          { kind: "setVariable", variableId: "v", op: "=", value: 1 },
        ];

        drainScreenCommands(commands, session);

        expect(session.variables.v).toBe(1);
      });

      it("Tint Screen 이 m2Runtime.screen.tint 에 색상을 기록한다", () => {
        const session = mkSession();
        drainScreenCommands([modernM2Command("Tint Screen", { color: "blue" })], session);

        expect(session.m2Runtime?.screen.tint).toBe("blue");
      });

      it("Tint Screen 의 value(r,g,b)가 color 보다 우선한다", () => {
        const session = mkSession();
        drainScreenCommands(
          [modernM2Command("Tint Screen", { color: "blue", value: "255,128,0" })],
          session
        );

        expect(session.m2Runtime?.screen.tint).toBe("255,128,0");
      });

      it("Hide Screen 이 m2Runtime.screen.hidden = true 를 기록하고 페이드가 끝날 때까지 기다린다", () => {
        const session = mkSession();
        const interp = createInterpreter([modernM2Command("Hide Screen")], session);
        const step = interp.start();

        expect(session.m2Runtime?.screen.hidden).toBe(true);
        expect(session.m2Runtime?.screen.hideFadeMs).toBe(HIDE_SHOW_SCREEN_FADE_MS);
        expect(step).toEqual({ kind: "wait", ms: HIDE_SHOW_SCREEN_FADE_MS });
      });

      it("Show Screen 이 hidden 상태를 해제하고 같은 길이만큼 페이드한다", () => {
        const session = mkSession();
        const interp = createInterpreter(
          [modernM2Command("Hide Screen"), modernM2Command("Show Screen")],
          session
        );
        const hide = interp.start();
        expect(hide).toMatchObject({ kind: "wait", ms: HIDE_SHOW_SCREEN_FADE_MS });
        const show = interp.resume(undefined);

        expect(session.m2Runtime?.screen.hidden).toBe(false);
        expect(session.m2Runtime?.screen.hideFadeMs).toBe(HIDE_SHOW_SCREEN_FADE_MS);
        expect(show).toEqual({ kind: "wait", ms: HIDE_SHOW_SCREEN_FADE_MS });
      });
    });
    describe("화면 효과 — 헬퍼", () => {
      it("screenColorToRgb 가 색 이름을 RGB 로 변환한다", () => {
        expect(screenColorToRgb("red")).toEqual({ red: 255, green: 0, blue: 0 });
        expect(screenColorToRgb("white")).toEqual({ red: 255, green: 255, blue: 255 });
      });

      it("screenColorToRgb 가 hex 를 RGB 로 변환한다", () => {
        expect(screenColorToRgb("#ff8800")).toEqual({ red: 255, green: 136, blue: 0 });
        expect(screenColorToRgb("00ff00")).toEqual({ red: 0, green: 255, blue: 0 });
      });

      it("clampMs 가 지속시간을 안전 범위로 묶는다", () => {
        expect(clampMs(300)).toBe(300);
        expect(clampMs(0)).toBe(300);
        expect(clampMs(-10)).toBe(300);
        expect(clampMs(99999)).toBe(5000);
        expect(clampMs(50)).toBe(50);
      });
    });
    // 에디터 프리셋(commandBodyM2Page3.ts 의 SHAKE_INTENSITY_SEGMENTS)이 화면에서 실제로
    // 구분되는지 지킨다. 상한이 0.05 였을 때 6 과 10 이 둘 다 0.05 로 잘려 같았다.
    describe("shakeIntensityRatio", () => {
      const PRESETS = [1, 3, 6, 10] as const;

      it("에디터 4단계 프리셋이 서로 다른 값으로 매핑된다", () => {
        const ratios = PRESETS.map(shakeIntensityRatio);
        expect(new Set(ratios).size).toBe(PRESETS.length);
      });

      it("강도가 커질수록 흔들림도 커진다", () => {
        const ratios = PRESETS.map(shakeIntensityRatio);
        for (let index = 1; index < ratios.length; index += 1) {
          expect(ratios[index]).toBeGreaterThan(ratios[index - 1]!);
        }
      });

      it("프리셋별 자연값을 그대로 낸다", () => {
        expect(shakeIntensityRatio(1)).toBeCloseTo(0.01, 5);
        expect(shakeIntensityRatio(3)).toBeCloseTo(0.03, 5);
        expect(shakeIntensityRatio(6)).toBeCloseTo(0.06, 5);
        expect(shakeIntensityRatio(10)).toBeCloseTo(0.1, 5);
      });

      it("범위 밖 입력은 가드로 막는다", () => {
        expect(shakeIntensityRatio(0)).toBeCloseTo(0.01, 5);
        expect(shakeIntensityRatio(-5)).toBeCloseTo(0.01, 5);
        expect(shakeIntensityRatio(999)).toBeCloseTo(0.1, 5);
        expect(shakeIntensityRatio(Number.NaN)).toBeCloseTo(0.01, 5);
      });
    });
  });
});
