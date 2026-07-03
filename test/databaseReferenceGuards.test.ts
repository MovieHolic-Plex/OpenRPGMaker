import { beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, deleteDatabaseRecord, updateDatabaseRecord } from "@/editor/databaseActions";
import { resourceReferenceMessage, switchVariableReferenceMessage } from "@/editor/databaseReferences";
import { createBlankProject, DEFAULT_TROOP_ID } from "@/project/defaults";
import { store } from "@/project/store";

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
    if (!result.ok) expect(result.message).toContain("이벤트 명령");
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
});
