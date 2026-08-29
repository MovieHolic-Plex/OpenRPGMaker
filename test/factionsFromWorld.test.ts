import { describe, expect, it } from "vitest";
import {
  applyFactionsFromWorldPlan,
  combatFactionIdFromWorldEntityId,
  planFactionsFromWorld,
  WORLD_ALLY_STANCE,
  WORLD_COMBAT_FACTION_ID_PATTERN,
  WORLD_ENEMY_STANCE,
} from "@/project/factionsFromWorld";
import { factionStance, resolveFactionTable } from "@/project/factions";
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
      { id: "w_iron_hand", name: "철의 손", aggression: 1 },
      { id: "w_watch", name: "도시 경비대", aggression: 1 },
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

    expect(plan.hasChanges).toBe(false);
    expect(plan.result).toEqual(authored);
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

    expect(plan.diff.defs.added).toEqual([{ id: "w_iron", name: "철의 손", aggression: 1 }]);
    expect(plan.result?.defs).toEqual([
      authored.defs[0],
      { id: "w_iron", name: "철의 손", aggression: 1 },
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
