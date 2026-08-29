import { describe, expect, it } from "vitest";
import {
  applyFactionsFromWorldPlan,
  combatFactionIdFromWorldEntityId,
  planFactionsFromWorld,
  WORLD_ALLY_STANCE,
  WORLD_COMBAT_FACTION_ID_PATTERN,
  WORLD_ENEMY_STANCE,
} from "@/project/factionsFromWorld";
import { renameFaction } from "@/editor/panels/databaseFactionModel";
import { createBlankProject } from "@/project/defaults";
import { factionStance, normalizeProjectFactions, resolveFactionTable } from "@/project/factions";
import { deserialize, serialize } from "@/project/io";
import type { ProjectFactions } from "@/project/types";
import type { ProjectWorld, WorldEntity } from "@/project/world";

function faction(id: string, name = id): WorldEntity {
  return { id, type: "faction", name, summary: `${name} 설명`, origin: "user" };
}

function world(
  entities: readonly WorldEntity[],
  relations: ProjectWorld["relations"] = [],
): ProjectWorld {
  return { entities, relations };
}

describe("world faction materialization", () => {
  it("maps each lore faction to a stable combat def with conservative aggression", () => {
    const input = world([faction("w_iron_hand", "철의 손"), faction("w_watch", "도시 경비대")]);

    const plan = planFactionsFromWorld(input, undefined);

    expect(plan.diff.defs.added).toEqual([
      { id: "w_iron_hand", name: "철의 손", aggression: 1, worldEntityId: "w_iron_hand" },
      { id: "w_watch", name: "도시 경비대", aggression: 1, worldEntityId: "w_watch" },
    ]);
    expect(plan.diff.defs.changed).toEqual([]);
    expect(plan.diff.defs.removed).toEqual([]);
    expect(plan.diff.defs.conflicts).toEqual([]);
    expect(plan.result?.defs).toEqual(plan.diff.defs.added);
  });

  it("maps enemyOf to enemy and allyOf to full alliance while unrelated pairs remain neutral", () => {
    const input = world(
      [faction("w_iron"), faction("w_watch"), faction("w_merchants")],
      [
        { a: "w_iron", b: "w_watch", kind: "enemyOf" },
        { a: "w_watch", b: "w_merchants", kind: "allyOf" },
      ],
    );

    const plan = planFactionsFromWorld(input, undefined);
    const table = resolveFactionTable(plan.result);

    expect(WORLD_ENEMY_STANCE).toBe(-1);
    expect(WORLD_ALLY_STANCE).toBe(2);
    expect(factionStance(table, "w_iron", "w_watch")).toBe(-1);
    expect(factionStance(table, "w_watch", "w_merchants")).toBe(2);
    expect(factionStance(table, "w_iron", "w_merchants")).toBe(0);
  });

  it("keeps the more-hostile interpretation when lore declares both alliance and hostility", () => {
    const input = world(
      [faction("w_iron"), faction("w_watch")],
      [
        { a: "w_iron", b: "w_watch", kind: "allyOf" },
        { a: "w_watch", b: "w_iron", kind: "enemyOf" },
      ],
    );

    const plan = planFactionsFromWorld(input, undefined);

    expect(plan.diff.relations.added).toEqual([{ a: "w_watch", b: "w_iron", stance: -1 }]);
    expect(factionStance(resolveFactionTable(plan.result), "w_iron", "w_watch")).toBe(-1);
  });

  it("is idempotent after applying the first plan", () => {
    const input = world(
      [faction("w_iron"), faction("w_watch")],
      [{ a: "w_iron", b: "w_watch", kind: "enemyOf" }],
    );
    const first = planFactionsFromWorld(input, undefined);
    const applied = applyFactionsFromWorldPlan(first);

    const second = planFactionsFromWorld(input, applied);

    expect(first.hasChanges).toBe(true);
    expect(second.hasChanges).toBe(false);
    expect(second.diff.defs.added).toEqual([]);
    expect(second.diff.relations.added).toEqual([]);
    expect(second.result).toEqual(applied);
  });

  it("keeps a materialized world faction linked after its combat id is renamed", () => {
    const input = world([faction("w_iron", "철의 손")]);
    const materialized = normalizeProjectFactions(
      applyFactionsFromWorldPlan(planFactionsFromWorld(input, undefined)),
    );
    const project = createBlankProject();
    project.world = input;
    project.factions = materialized;

    const renamed = renameFaction(project, "w_iron", "ironhand");
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const persisted = deserialize(serialize(renamed.project));
    const defsBeforeReplan = persisted.factions?.defs.length;

    const replanned = planFactionsFromWorld(input, persisted.factions);

    expect(replanned.mapping).toContainEqual(expect.objectContaining({
      worldEntityId: "w_iron",
      combatFactionId: "ironhand",
      status: "existing",
    }));
    expect(replanned.diff.defs.added).toEqual([]);
    expect(replanned.result?.defs).toHaveLength(defsBeforeReplan ?? 0);
  });

  it("backfills provenance on a legacy materialized def so a later rename keeps the link", () => {
    const input = world([faction("w_iron", "철의 손")]);
    // 출처 필드가 없던 구버전 구체화 산출물 그대로의 행.
    const legacy: ProjectFactions = {
      defs: [{ id: "w_iron", name: "철의 손", aggression: 1 }],
      relations: [],
    };

    const backfill = planFactionsFromWorld(input, legacy);

    expect(backfill.hasChanges).toBe(true);
    expect(backfill.diff.defs.added).toEqual([]);
    expect(backfill.diff.defs.changed).toEqual([{
      before: { id: "w_iron", name: "철의 손", aggression: 1 },
      after: { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
    }]);

    const project = createBlankProject();
    project.world = input;
    project.factions = normalizeProjectFactions(applyFactionsFromWorldPlan(backfill));

    const renamed = renameFaction(project, "w_iron", "ironhand");
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    const persisted = deserialize(serialize(renamed.project));
    const defsBeforeReplan = persisted.factions?.defs.length;

    const replanned = planFactionsFromWorld(input, persisted.factions);

    expect(replanned.hasChanges).toBe(false);
    expect(replanned.diff.defs.added).toEqual([]);
    expect(replanned.diff.defs.changed).toEqual([]);
    expect(replanned.result?.defs).toHaveLength(defsBeforeReplan ?? 0);
    expect(replanned.mapping).toContainEqual(expect.objectContaining({
      worldEntityId: "w_iron",
      combatFactionId: "ironhand",
      status: "existing",
    }));
  });

  it("preserves hand-authored metadata, relations, and player-kill policy while surfacing conflicts", () => {
    const authored: ProjectFactions = {
      defs: [
        { id: "w_iron", name: "철의 손", color: "#123456", aggression: 1, protectedFromNpcs: true },
        { id: "w_watch", name: "도시 경비대", aggression: 3 },
      ],
      relations: [{ a: "w_iron", b: "w_watch", stance: -2 }],
      playerKillReputation: { weight: 0.75 },
    };
    const input = world(
      [faction("w_iron", "철의 손"), faction("w_watch", "도시 경비대")],
      [{ a: "w_iron", b: "w_watch", kind: "allyOf" }],
    );

    const plan = planFactionsFromWorld(input, authored);

    // 상호 호환인 w_iron 은 출처만 보정되고, 사람이 적은 색·보호·평판 설정은 그대로 남는다.
    expect(plan.diff.defs.added).toEqual([]);
    expect(plan.diff.defs.changed).toEqual([{
      before: authored.defs[0],
      after: { ...authored.defs[0], worldEntityId: "w_iron" },
    }]);
    expect(plan.result).toEqual({
      ...authored,
      defs: [{ ...authored.defs[0], worldEntityId: "w_iron" }, authored.defs[1]],
    });
    expect(plan.diff.defs.conflicts).toEqual([
      expect.objectContaining({ worldEntityId: "w_watch", existing: authored.defs[1] }),
    ]);
    expect(plan.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "id-collision", severity: "conflict", worldEntityId: "w_watch" }),
      expect.objectContaining({ code: "relation-endpoint-blocked", severity: "conflict" }),
    ]));
    expect(factionStance(resolveFactionTable(plan.result), "w_iron", "w_watch")).toBe(-2);
  });

  it("does not overwrite a hand-authored stance that disagrees with lore", () => {
    const authored: ProjectFactions = {
      defs: [
        { id: "w_iron", name: "철의 손", aggression: 1 },
        { id: "w_watch", name: "도시 경비대", aggression: 1 },
      ],
      relations: [{ a: "w_iron", b: "w_watch", stance: -2 }],
    };
    const input = world(
      [faction("w_iron", "철의 손"), faction("w_watch", "도시 경비대")],
      [{ a: "w_iron", b: "w_watch", kind: "allyOf" }],
    );

    const plan = planFactionsFromWorld(input, authored);

    expect(plan.diff.relations.added).toEqual([]);
    expect(plan.diff.relations.conflicts).toEqual([
      { existing: authored.relations, implied: { a: "w_iron", b: "w_watch", stance: 2 } },
    ]);
    expect(plan.result?.relations).toEqual(authored.relations);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: "relation-conflict" }));
  });

  it.each(["player", "enemy"])("remaps reserved world id %s without redefining the reserved faction", (id) => {
    const plan = planFactionsFromWorld(world([faction(id, `세계관 ${id}`)]), undefined);
    const mapped = plan.mapping[0]!;

    expect(mapped.combatFactionId).not.toBe(id);
    expect(mapped.combatFactionId).toMatch(WORLD_COMBAT_FACTION_ID_PATTERN);
    expect(plan.diff.defs.added[0]?.id).toBe(mapped.combatFactionId);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: "reserved-id-remapped" }));
  });

  it("remaps invalid lore ids deterministically", () => {
    const id = "w_철의 손 guild!";
    const first = combatFactionIdFromWorldEntityId(id);
    const second = combatFactionIdFromWorldEntityId(id);

    expect(first).toBe(second);
    expect(first).toMatch(WORLD_COMBAT_FACTION_ID_PATTERN);
    expect(planFactionsFromWorld(world([faction(id)]), undefined).issues)
      .toContainEqual(expect.objectContaining({ code: "invalid-id-remapped" }));
  });

  it("keeps a same-name hand-authored faction separate and reports the collision", () => {
    const authored: ProjectFactions = {
      defs: [{ id: "hand_iron", name: "철의 손", color: "#654321", aggression: 2 }],
      relations: [],
    };

    const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), authored);

    expect(plan.diff.defs.added).toEqual([
      { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
    ]);
    expect(plan.result?.defs).toEqual([
      authored.defs[0],
      { id: "w_iron", name: "철의 손", aggression: 1, worldEntityId: "w_iron" },
    ]);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: "name-collision", severity: "warning" }));
  });

  it("blocks an incompatible exact-id collision instead of overwriting it", () => {
    const authored: ProjectFactions = {
      defs: [{ id: "w_iron", name: "수기 철갑단", aggression: 2 }],
      relations: [],
    };

    const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), authored);

    expect(plan.hasChanges).toBe(false);
    expect(plan.result).toEqual(authored);
    expect(plan.mapping[0]?.status).toBe("blocked");
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: "id-collision", severity: "conflict" }));
  });
});
