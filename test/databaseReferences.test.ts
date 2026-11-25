import { beforeEach, describe, expect, it, afterEach } from "vitest";
import { deleteSwitch, deleteVariable } from "@/editor/actions";
import { addDatabaseRecord, deleteDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { resourceReferenceMessage, switchVariableReferenceMessage, databaseReferenceMessage } from "@/editor/databaseReferences";
import { DEFAULT_TROOP_ID } from "@/project/defaults";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";
import { createSaveSnapshot, applySaveSnapshot } from "@/player/saveSlots";
import type { PlaySession } from "@/project/session";
import { isolateTimers } from "./mergedTeardown";

describe("databaseReferenceGuards", () => {
  isolateTimers();
  function firstMapId(): string {
    return Object.keys(store.getCurrent().maps)[0] ?? "";
  }
  describe("database reference guards for command-bearing records", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
    });

    it("blocks deleting records referenced by map event command branches", () => {
      const actorId = addDatabaseRecord("actors");
      const equipmentId = addDatabaseRecord("equipment");
      const mapId = firstMapId();
      updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
      updateDatabaseRecord("equipment", equipmentId, { equippableActorIds: [], equippableClassIds: [] });

      store.update((project) => {
        project.maps[mapId]?.events.push({
          id: "ev_command_refs",
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [
            {
              kind: "choices",
              options: [{ text: "Equip", branch: [{ kind: "changeEquipment", actorId, slot: "weapon", equipmentId }] }],
              cancelBehavior: "branch",
              cancelBranch: [{ kind: "changeParty", actorId, action: "add" }],
            },
          ],
        });
      });

      expect(deleteDatabaseRecord("actors", actorId)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("equipment", equipmentId)).toMatchObject({ ok: false });
    });

    it("blocks deleting records referenced by common event commands and nested shop branches", () => {
      const itemId = addDatabaseRecord("items");
      store.update((project) => {
        const commonEvent = project.commonEvents[0] ?? { id: "ce_refs", name: "Reference CE", trigger: "none", commands: [] };
        if (!project.commonEvents[0]) project.commonEvents.push(commonEvent);
        commonEvent.commands.push({
          kind: "shop",
          itemIds: [],
          branchOnTransaction: true,
          transactionBranch: [{ kind: "changeItem", itemId, op: "+=", amount: 1 }],
        });
      });

      const result = deleteDatabaseRecord("items", itemId);

      expect(result.ok).toBe(false);
      // fix(db): 삭제 거부 메시지는 "무엇이"뿐 아니라 "어디서"(커먼 이벤트 이름) 참조하는지도 밝힌다.
      if (!result.ok) {
        expect(result.message).toContain("커먼 이벤트");
        expect(result.message).toContain("Reference CE");
      }
    });

    it("names the referencing map and event in the deletion-block message", () => {
      const actorId = addDatabaseRecord("actors");
      const mapId = firstMapId();
      updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
      const mapName = store.getCurrent().maps[mapId]?.name ?? "";
      expect(mapName.length).toBeGreaterThan(0);

      store.update((project) => {
        project.maps[mapId]?.events.push({
          id: "ev_named_location",
          x: 2,
          y: 3,
          trigger: { kind: "action" },
          pages: [{ id: "page_1", name: "이름 있는 이벤트", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }],
          commands: [{ kind: "changeParty", actorId, action: "add" }],
        });
      });

      const result = deleteDatabaseRecord("actors", actorId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain(mapName);
        expect(result.message).toContain("이름 있는 이벤트");
        expect(result.message).toContain("ev_named_location");
      }
    });

    it("names the first referencing record for direct field references (e.g. a class learning a skill)", () => {
      const skillId = addDatabaseRecord("skills");
      const classId = store.getCurrent().database.classes[0]?.id ?? "";
      const className = store.getCurrent().database.classes[0]?.name ?? "";
      expect(classId).not.toBe("");
      updateDatabaseRecord("classes", classId, { learnedSkills: [{ level: 1, skillId }] });

      const result = deleteDatabaseRecord("skills", skillId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain(className);
        expect(result.message).toContain("배웁니다");
      }
    });

    it("appends an '외 N-1건' summary when more than one location references the record", () => {
      const actorId = addDatabaseRecord("actors");
      updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
      const mapId = firstMapId();

      store.update((project) => {
        project.maps[mapId]?.events.push(
          { id: "ev_ref_1", x: 0, y: 0, trigger: { kind: "action" }, commands: [{ kind: "changeParty", actorId, action: "add" }] },
          { id: "ev_ref_2", x: 1, y: 1, trigger: { kind: "action" }, commands: [{ kind: "changeParty", actorId, action: "remove" }] }
        );
      });

      const result = deleteDatabaseRecord("actors", actorId);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("외 1건");
    });

    it("blocks deleting records referenced by battle event page commands and conditions", () => {
      const actorId = addDatabaseRecord("actors");
      const enemyId = addDatabaseRecord("enemies");
      updateDatabaseRecord("actors", actorId, { initialEquipment: {} });
      updateDatabaseRecord("enemies", enemyId, { skillIds: [] });

      store.update((project) => {
        const troop = project.database.troops.find((record) => record.id === DEFAULT_TROOP_ID);
        if (!troop) return;
        troop.battleEventPages.push({
          id: "battle_refs",
          name: "Battle refs",
          span: "battle",
          conditions: [
            { kind: "actorHp", actorId, minPercent: 0, maxPercent: 50 },
            { kind: "enemyTurn", enemyId, turn: 1 },
          ],
          commands: [{ kind: "recoverAll", actorId }],
        });
      });

      expect(deleteDatabaseRecord("actors", actorId)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("enemies", enemyId)).toMatchObject({ ok: false });
    });

    it("finds nested command switch, variable, and resource references", () => {
      const mapId = firstMapId();
      store.update((project) => {
        project.switches = [{ id: "sw_nested", name: "Nested Switch" }];
        project.variables = [{ id: "var_nested", name: "Nested Variable" }];
        project.assets.uploaded.ref_sound = {
          id: "ref_sound",
          name: "Reference Sound",
          kind: "sound",
          dataUrl: "data:audio/ogg;base64,T2dnUw==",
          meta: {},
        };
        project.maps[mapId]?.events.push({
          id: "ev_nested_refs",
          x: 1,
          y: 1,
          trigger: { kind: "action" },
          commands: [{
            kind: "loop",
            body: [{
              kind: "fork",
              condition: { kind: "switch", switchId: "sw_nested", value: true },
              then: [{ kind: "setVariable", variableId: "var_nested", op: "+=", value: { kind: "var", id: "var_nested" } }],
              else: [{ kind: "playAudio", resourceId: "ref_sound", loop: false }],
            }],
          }],
        });
      });

      expect(switchVariableReferenceMessage("switch", "sw_nested")).toContain("스위치");
      expect(switchVariableReferenceMessage("variable", "var_nested")).toContain("변수");
      expect(resourceReferenceMessage("ref_sound")).toContain("이벤트 명령");
    });

    it("deletes unreferenced records while keeping referenced records blocked", () => {
      const referencedActorId = addDatabaseRecord("actors");
      const unreferencedActorId = addDatabaseRecord("actors");
      const mapId = firstMapId();
      updateDatabaseRecord("actors", referencedActorId, { initialEquipment: {} });
      updateDatabaseRecord("actors", unreferencedActorId, { initialEquipment: {} });
      store.update((project) => {
        project.maps[mapId]?.events.push({
          id: "ev_actor_ref",
          x: 0,
          y: 0,
          trigger: { kind: "action" },
          commands: [{ kind: "changeParty", actorId: referencedActorId, action: "add" }],
        });
      });

      expect(deleteDatabaseRecord("actors", referencedActorId)).toMatchObject({ ok: false });
      expect(deleteDatabaseRecord("actors", unreferencedActorId)).toEqual({ ok: true });
      expect(store.getCurrent().database.actors.some((actor) => actor.id === unreferencedActorId)).toBe(false);
    });

    // fix(db): 복합 조건(all/any/not) 안에만 있는 참조도 삭제 가드가 봐야 한다.
    // 예전에는 leaf 조건만 검사해서, AND 그룹 안의 스위치가 경고 없이 삭제되고
    // 남은 조건이 조용히 절대 발동하지 않는 상태가 됐다.
    function pushPageWithConditions(mapId: string, eventId: string, conditions: unknown[]): void {
      store.update((project) => {
        project.maps[mapId]?.events.push({
          id: eventId,
          x: 4,
          y: 4,
          trigger: { kind: "action" },
          pages: [{
            id: `${eventId}_page`,
            name: "복합 조건 페이지",
            conditions: conditions as never,
            graphic: {},
            trigger: { kind: "action" },
            priority: "same",
            movement: { type: "fixed", speed: 3, frequency: 3 },
            commands: [],
          }],
          commands: [],
        });
      });
    }

    it("blocks deleting a switch referenced only inside an 'all' page condition group", () => {
      const mapId = firstMapId();
      store.update((project) => {
        project.switches = [{ id: "sw_in_all", name: "All Switch" }];
      });
      pushPageWithConditions(mapId, "ev_all_group", [
        { kind: "all", conditions: [{ kind: "switch", switchId: "sw_in_all", value: true }] },
      ]);

      expect(switchVariableReferenceMessage("switch", "sw_in_all")).not.toBeNull();
      expect(deleteSwitch("sw_in_all")).toMatchObject({ ok: false });
      expect(store.getCurrent().switches.some((entry) => entry.id === "sw_in_all")).toBe(true);
    });

    it("blocks deleting a variable referenced only inside a 'not' page condition", () => {
      const mapId = firstMapId();
      store.update((project) => {
        project.variables = [{ id: "var_in_not", name: "Not Variable" }];
      });
      pushPageWithConditions(mapId, "ev_not_group", [
        { kind: "not", condition: { kind: "variable", variableId: "var_in_not", op: ">=", value: 3 } },
      ]);

      expect(switchVariableReferenceMessage("variable", "var_in_not")).not.toBeNull();
      expect(deleteVariable("var_in_not")).toMatchObject({ ok: false });
      expect(store.getCurrent().variables.some((entry) => entry.id === "var_in_not")).toBe(true);
    });

    it("blocks deleting an item referenced only inside an 'any' page condition group", () => {
      const itemId = addDatabaseRecord("items");
      const mapId = firstMapId();
      pushPageWithConditions(mapId, "ev_any_group", [
        {
          kind: "any",
          conditions: [
            { kind: "gold", op: ">=", amount: 10 },
            { kind: "item", itemId, present: true },
          ],
        },
      ]);

      expect(deleteDatabaseRecord("items", itemId)).toMatchObject({ ok: false });
      expect(store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(true);
    });

    it("blocks deleting a switch that a switch item activates", () => {
      const switchItem = store.getCurrent().database.items.find(
        (item) => item.type === "switch" && item.switchId
      );
      expect(switchItem).toBeDefined();

      expect(switchVariableReferenceMessage("switch", switchItem!.switchId!)).not.toBeNull();
      expect(deleteSwitch(switchItem!.switchId!)).toMatchObject({ ok: false });
      expect(store.getCurrent().switches.some((entry) => entry.id === switchItem!.switchId)).toBe(true);
    });

    it("blocks deleting a switch that a skill switch effect activates", () => {
      store.update((project) => {
        project.switches.push({ id: "sw_skill_effect", name: "스킬 스위치" });
        const skill = project.database.skills[0];
        skill.effect = { kind: "switch", switchId: "sw_skill_effect" };
      });

      expect(switchVariableReferenceMessage("switch", "sw_skill_effect")).not.toBeNull();
      expect(deleteSwitch("sw_skill_effect")).toMatchObject({ ok: false });
      expect(store.getCurrent().switches.some((entry) => entry.id === "sw_skill_effect")).toBe(true);
    });

    it("still deletes a switch that has no references at all", () => {
      store.update((project) => {
        project.switches = [{ id: "sw_orphan", name: "Orphan Switch" }];
      });

      expect(switchVariableReferenceMessage("switch", "sw_orphan")).toBeNull();
      expect(deleteSwitch("sw_orphan")).toEqual({ ok: true });
      // 세션 슬롯이 남아 있으면 ensureSwitchVariableSlots가 이름 없는 슬롯을 되살리므로
      // "정의가 사라졌다"는 이름으로 확인한다.
      expect(store.getCurrent().switches.some((entry) => entry.name === "Orphan Switch")).toBe(false);
    });
  });
});

describe("databaseStatesGuardEquipmentDefense", () => {
  isolateTimers();
  let restoreDom: (() => void) | undefined;
  beforeEach(() => {
    restoreDom = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = undefined;
  });
  /** States delete guard must cover equipment.stateDefenseIds, not just stateInflictIds —
   *  otherwise deleting a defended-against state leaves a dangling ref with no warning. */
  describe("states delete guard covers equipment defense", () => {
    it("blocks deleting a state referenced only by equipment.stateDefenseIds", () => {
      const project = store.getCurrent();
      const state = project.database.states[1] ?? project.database.states[0];
      if (!state) throw new Error("no states in fixture");
      const stateId = state.id;
      store.update((draft) => {
        for (const skill of draft.database.skills) {
          skill.stateEffects = (skill.stateEffects ?? []).filter((effect) => effect.stateId !== stateId);
        }
        for (const item of draft.database.items) {
          item.stateEffects = (item.stateEffects ?? []).filter((effect) => effect.stateId !== stateId);
          item.healStateIds = (item.healStateIds ?? []).filter((id) => id !== stateId);
          item.equipmentProfile.stateInflictIds = item.equipmentProfile.stateInflictIds.filter((id) => id !== stateId);
          item.equipmentProfile.stateDefenseIds = item.equipmentProfile.stateDefenseIds.filter((id) => id !== stateId);
        }
        for (const equip of draft.database.equipment) {
          equip.stateInflictIds = equip.stateInflictIds.filter((id) => id !== stateId);
          equip.stateDefenseIds = equip.stateDefenseIds.filter((id) => id !== stateId);
        }
        draft.database.equipment[0]!.stateDefenseIds = [stateId];
      });
      expect(databaseReferenceMessage("states", stateId)).not.toBeNull();
    });
  });
});

describe("saveAndReferences", () => {
  isolateTimers();
  function mkSession(): PlaySession {
    return {
      switches: {},
      selfSwitches: { ev1: { A: true } },
      variables: {},
      timers: {},
      gold: 750,
      inventory: { potion: 3 },
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
      currentMapId: "m1",
      x: 5,
      y: 6,
      lighting: { ambient: 0, sources: [] },
      mapOverrides: {},
      flags: {},
      audio: {},
      pictures: {},
      playTimeSeconds: 0,
    };
  }
  function mkSessionWithMeta(): PlaySession {
    const session = mkSession();
    session.playTimeSeconds = 3661; // 1h 1m 1s
    return session;
  }
  describe("세이브 직렬화 — gold/selfSwitches", () => {
    it("gold 가 스냅샷에 저장되고 로드 후 복원된다", () => {
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, mkSession());

      expect(snapshot.session.gold).toBe(750);

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.gold).toBe(750);
    });

    it("selfSwitches 가 스냅샷에 저장되고 로드 후 복원된다", () => {
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, mkSession());

      expect(snapshot.session.selfSwitches?.ev1?.A).toBe(true);

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.selfSwitches.ev1?.A).toBe(true);
    });

    it("playTimeSeconds 가 스냅샷에 저장되고 복원된다", () => {
      const project = createBlankProject();
      const snapshot = createSaveSnapshot(project, mkSessionWithMeta());

      expect(snapshot.playTimeSeconds).toBe(3661);
      expect(snapshot.session.playTimeSeconds).toBe(3661);

      const restored = applySaveSnapshot(project, snapshot);
      expect(restored.playTimeSeconds).toBe(3661);
    });

    it("현재 맵 이름이 스냅샷 메타데이터에 저장된다", () => {
      const project = createBlankProject();
      const firstMapId = Object.keys(project.maps)[0]!;
      project.maps[firstMapId]!.name = "시작 마을";
      const session = mkSession();
      session.currentMapId = firstMapId;

      const snapshot = createSaveSnapshot(project, session);

      expect(snapshot.mapName).toBe("시작 마을");
    });

    it("대표 파티 레벨이 슬롯 메타데이터에 저장된다", () => {
      const project = createBlankProject();
      const actorId = project.database.actors[0]!.id;
      const session = mkSession();
      session.partyActorIds = [actorId];
      session.actorLevels = { [actorId]: 7 };

      const snapshot = createSaveSnapshot(project, session);

      expect(snapshot.partyLevel).toBe(7);
    });

    it("erasedEventIds 가 스냅샷에 저장되고 로드 후 복원된다", () => {
      const project = createBlankProject();
      const session = mkSession();
      session.erasedEventIds = ["ev_erased"];

      const snapshot = createSaveSnapshot(project, session);
      const restored = applySaveSnapshot(project, snapshot);

      expect(snapshot.session.erasedEventIds).toEqual(["ev_erased"]);
      expect(restored.erasedEventIds).toEqual(["ev_erased"]);
    });
  });
  describe("스위치/변수 삭제 참조 경고", () => {
    beforeEach(() => {
      // store 에 테스트용 프로젝트를 올린다.
      const project = createBlankProject();
      project.switches = [{ id: "sw1", name: "문 열림" }];
      project.variables = [{ id: "var1", name: "카운트" }];
      store.replace(project);
    });

    afterEach(() => {
      store.replace(createBlankProject());
    });

    it("참조되지 않은 스위치는 경고 없이 삭제 가능하다", () => {
      expect(switchVariableReferenceMessage("switch", "sw1")).toBeNull();
    });

    it("참조되지 않은 변수는 경고 없이 삭제 가능하다", () => {
      expect(switchVariableReferenceMessage("variable", "var1")).toBeNull();
    });

    it("명령에서 참조 중인 스위치는 경고를 반환한다", () => {
      const project = store.getCurrent();
      project.maps[Object.keys(project.maps)[0]!].events.push({
        id: "ev1", x: 0, y: 0, trigger: { kind: "action" },
        commands: [{ kind: "setSwitch", switchId: "sw1", value: true }],
      });
      store.replace(project);

      expect(switchVariableReferenceMessage("switch", "sw1")).not.toBeNull();
    });

    it("fork 조건에서 참조 중인 변수는 경고를 반환한다", () => {
      const project = store.getCurrent();
      project.maps[Object.keys(project.maps)[0]!].events.push({
        id: "ev1", x: 0, y: 0, trigger: { kind: "action" },
        commands: [{
          kind: "fork",
          condition: { kind: "variable", variableId: "var1", op: ">=", value: 5 },
          then: [{ kind: "text", body: "hi" }],
        }],
      });
      store.replace(project);

      expect(switchVariableReferenceMessage("variable", "var1")).not.toBeNull();
    });
  });
});
