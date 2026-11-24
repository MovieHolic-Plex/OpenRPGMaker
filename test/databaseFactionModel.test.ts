import { describe, expect, it } from "vitest";
import { authoredFactionStance, defaultFactionStance, deleteFaction, duplicateFaction, factionMatrixCell, renameFaction, setPlayerKillReputation, setSparseFactionStance } from "@/editor/panels/databaseFactionModel";
import { setEffectiveFactionStance } from "@/project/factionRuntime";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { resolveFactionTable, factionStance, normalizeProjectFactions } from "@/project/factions";
import type { Command, EventPage, Project, ProjectFactions } from "@/project/types";
import { applyFactionsFromWorldPlan, combatFactionIdFromWorldEntityId, planFactionsFromWorld, WORLD_ALLY_STANCE, WORLD_COMBAT_FACTION_ID_PATTERN, WORLD_ENEMY_STANCE } from "@/project/factionsFromWorld";
import type { ProjectWorld, WorldEntity } from "@/project/world";
import { isolateTimers } from "./mergedTeardown";

describe("databaseFactionModel", () => {
  isolateTimers();
  const FACTIONS: ProjectFactions = {
    defs: [
      { id: "guard", name: "경비병" },
      { id: "bandit", name: "산적" },
    ],
    relations: [],
  };
  function projectWithFactions(factions: ProjectFactions): Project {
    const project = createBlankProject();
    project.factions = factions;
    return project;
  }
  describe("database faction editor model", () => {
    it("shows runtime defaults while preserving whether a cell was actually authored", () => {
      const table = resolveFactionTable(FACTIONS);
      expect(factionMatrixCell(table, FACTIONS, "guard", "guard")).toEqual({ stance: 2, authored: false });
      expect(factionMatrixCell(table, FACTIONS, "guard", "bandit")).toEqual({ stance: 0, authored: false });
      expect(factionMatrixCell(table, FACTIONS, "player", "enemy")).toEqual({ stance: -1, authored: false });

      const authored = setSparseFactionStance(FACTIONS, "guard", "bandit", -1)!;
      expect(factionMatrixCell(resolveFactionTable(authored), authored, "bandit", "guard")).toEqual({ stance: -1, authored: true });
    });

    it("writes only non-default relations and removes reverse-order duplicates", () => {
      const hostile = setSparseFactionStance(FACTIONS, "guard", "bandit", -1)!;
      expect(hostile.relations).toEqual([{ a: "guard", b: "bandit", stance: -1 }]);

      const defaulted = setSparseFactionStance(hostile, "bandit", "guard", 0)!;
      expect(defaulted.relations).toEqual([]);
      expect(defaultFactionStance(defaulted, "guard", "guard")).toBe(2);
      expect(defaultFactionStance(defaulted, "player", "enemy")).toBe(-1);
    });

    it("uses the runtime more-hostile-wins resolution for imported asymmetric data", () => {
      const table = resolveFactionTable(FACTIONS);
      const guard = table.ids.indexOf("guard");
      const bandit = table.ids.indexOf("bandit");
      table.stances[guard * table.size + bandit] = 2;
      table.stances[bandit * table.size + guard] = -2;

      expect(authoredFactionStance(table, "guard", "bandit")).toBe(-2);
      expect(authoredFactionStance(table, "bandit", "guard")).toBe(-2);
    });

    it("never displays a fractional runtime overlay in the authoring matrix", () => {
      const table = resolveFactionTable(FACTIONS);
      const overrides = setEffectiveFactionStance(table, {}, "guard", "player", 0.25);
      expect(overrides).not.toEqual({});
      expect(factionMatrixCell(table, FACTIONS, "guard", "player")).toEqual({ stance: 0, authored: false });
    });

    it("rewrites every relation endpoint when a faction id changes", () => {
      const source: ProjectFactions = {
        ...FACTIONS,
        relations: [
          { a: "guard", b: "player", stance: 2 },
          { a: "bandit", b: "guard", stance: -1 },
        ],
      };
      const result = renameFaction(projectWithFactions(source), "guard", "watch");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.project.factions?.defs.map((def) => def.id)).toEqual(["watch", "bandit"]);
      expect(result.project.factions?.relations).toEqual([
        { a: "watch", b: "player", stance: 2 },
        { a: "bandit", b: "watch", stance: -1 },
      ]);
    });

    it("preserves and edits the project-wide kill reputation option across faction mutations", () => {
      const source: ProjectFactions = {
        ...FACTIONS,
        playerKillReputation: { weight: 0.75 },
        relations: [{ a: "guard", b: "bandit", stance: -1 }],
      };
      const changed = setSparseFactionStance(source, "guard", "bandit", 0)!;
      expect(changed.playerKillReputation).toEqual({ weight: 0.75 });

      const renamed = renameFaction(projectWithFactions(changed), "guard", "watch");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      expect(renamed.project.factions?.playerKillReputation).toEqual({ weight: 0.75 });

      expect(setPlayerKillReputation(renamed.project.factions, true, 0.4)?.playerKillReputation).toEqual({ weight: 0.4 });
      expect(setPlayerKillReputation(renamed.project.factions, false)?.playerKillReputation).toBeUndefined();
    });

    it("duplicates authored identity without inheriting world-lore provenance", () => {
      const source = { id: "w_iron", name: "철의 손", worldEntityId: "w_iron", aggression: 2 as const };

      const duplicated = duplicateFaction({ defs: [source], relations: [] }, source, "w_iron_1");

      expect(duplicated.defs).toEqual([
        source,
        { id: "w_iron_1", name: "철의 손 복사본", aggression: 2 },
      ]);
    });

    it("removes dangling relations on delete and refuses reserved ids", () => {
      const source: ProjectFactions = {
        ...FACTIONS,
        relations: [
          { a: "guard", b: "player", stance: 1 },
          { a: "bandit", b: "guard", stance: -1 },
          { a: "bandit", b: "enemy", stance: -2 },
        ],
      };
      const project = projectWithFactions(source);
      const result = deleteFaction(project, "guard");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.project.factions?.defs.map((def) => def.id)).toEqual(["bandit"]);
      expect(result.project.factions?.relations).toEqual([{ a: "bandit", b: "enemy", stance: -2 }]);

      expect(deleteFaction(project, "player")).toEqual({ ok: false, reason: "player와 enemy 진영은 삭제할 수 없습니다." });
      expect(renameFaction(project, "enemy", "foe")).toEqual({ ok: false, reason: "예약 진영의 ID는 바꿀 수 없습니다." });
    });

    it("rewrites all durable command operands and blocks deletion with actionable owners", () => {
      const project = projectWithFactions(FACTIONS);
      const enemy = project.database.enemies[0]!;
      project.database.enemies[0] = {
        ...enemy,
        name: "성문 경비",
        factionId: "guard",
      };
      const map = project.maps[project.startMapId]!;
      map.fieldSpawns = [{
        id: "spawn_guard",
        troopId: project.database.troops[0]!.id,
        area: { x: 0, y: 0, w: 1, h: 1 },
        factionId: "guard",
      }];
      const stanceCommand = (): Command => (
        { kind: "changeFactionStance", a: "guard", b: "player", op: "+=", value: 0.25 }
      );
      const eventPage: EventPage = {
        id: "page_guard",
        name: "경비대 평판",
        conditions: [],
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [stanceCommand()],
      };
      map.events.push({
        id: "event_guard",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "loop", body: [stanceCommand()] }],
        pages: [eventPage],
      });
      project.commonEvents.push({
        id: "common_guard",
        name: "경비대 공통 평판",
        trigger: "none",
        commands: [{
          kind: "fork",
          condition: { kind: "selfSwitch", key: "A", value: true },
          then: [stanceCommand()],
        }],
      });
      const troop = project.database.troops[0]!;
      troop.battleEventPages.push({
        id: "troop_guard_page",
        name: "경비대 전투 평판",
        conditions: [],
        span: "battle",
        commands: [{
          kind: "battleProcessing",
          troopId: troop.id,
          canEscape: true,
          canLose: false,
          victoryBranch: [stanceCommand()],
        }],
      });

      const blocked = deleteFaction(project, "guard");
      expect(blocked.ok).toBe(false);
      if (blocked.ok) return;
      expect(blocked.reason).toContain(`몬스터 '성문 경비' (${enemy.id})`);
      expect(blocked.reason).toContain(`맵 '${map.name}'의 필드 스폰 'spawn_guard'`);
      expect(blocked.reason).toContain(`맵 '${map.name}'의 이벤트 'event_guard'`);
      expect(blocked.reason).toContain("페이지 '경비대 평판'");
      expect(blocked.reason).toContain("커먼 이벤트 '경비대 공통 평판' (common_guard)");
      expect(blocked.reason).toContain("전투 이벤트 페이지 '경비대 전투 평판'");

      const renamed = renameFaction(project, "guard", "watch");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      expect(renamed.project.database.enemies[0]?.factionId).toBe("watch");
      expect(renamed.project.maps[project.startMapId]?.fieldSpawns?.[0]?.factionId).toBe("watch");
      expect(serialize(renamed.project)).not.toContain('"guard"');
      expect(() => deserialize(serialize(renamed.project))).not.toThrow();

      const renamedBlocked = deleteFaction(renamed.project, "watch");
      expect(renamedBlocked.ok).toBe(false);
      if (!renamedBlocked.ok) expect(renamedBlocked.reason).toContain("common_guard");
    });

    it("rewrites monster and field-spawn faction references on rename and blocks referenced deletion", () => {
      const project = projectWithFactions(FACTIONS);
      project.database.enemies[0] = { ...project.database.enemies[0]!, id: "enemy_guard", name: "성문 경비", factionId: "guard" };
      const map = project.maps[project.startMapId]!;
      map.fieldSpawns = [{
        id: "spawn_guard",
        troopId: project.database.troops[0]!.id,
        area: { x: 0, y: 0, w: 1, h: 1 },
        factionId: "guard",
      }];

      const blocked = deleteFaction(project, "guard");
      expect(blocked).toEqual({
        ok: false,
        reason: `이 진영을 사용 중이라 삭제할 수 없습니다: 몬스터 '성문 경비' (enemy_guard), 맵 '${map.name}'의 필드 스폰 'spawn_guard'`,
      });

      const renamed = renameFaction(project, "guard", "watch");
      expect(renamed.ok).toBe(true);
      if (!renamed.ok) return;
      expect(renamed.project.database.enemies[0]?.factionId).toBe("watch");
      expect(renamed.project.maps[project.startMapId]?.fieldSpawns?.[0]?.factionId).toBe("watch");
    });
  });
});

describe("factionsFromWorld", () => {
  isolateTimers();
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

    it.each([
      ["original first", [
        { id: "w_iron", name: "철의 손", aggression: 1 as const, worldEntityId: "w_iron" },
        { id: "w_iron_1", name: "철의 손 복사본", aggression: 1 as const, worldEntityId: "w_iron" },
      ]],
      ["copy first", [
        { id: "w_iron_1", name: "철의 손 복사본", aggression: 1 as const, worldEntityId: "w_iron" },
        { id: "w_iron", name: "철의 손", aggression: 1 as const, worldEntityId: "w_iron" },
      ]],
    ] as const)("chooses the same provenance owner when duplicate claims are %s", (_label, defs) => {
      const existing: ProjectFactions = { defs: [...defs], relations: [] };

      const plan = planFactionsFromWorld(world([faction("w_iron", "철의 손")]), existing);

      expect(plan.mapping[0]).toEqual(expect.objectContaining({
        combatFactionId: "w_iron",
        status: "existing",
      }));
      expect(plan.hasChanges).toBe(false);
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
});
