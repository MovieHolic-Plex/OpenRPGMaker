import { describe, expect, it } from "vitest";
import {
  authoredFactionStance,
  defaultFactionStance,
  deleteFaction,
  duplicateFaction,
  factionMatrixCell,
  renameFaction,
  setPlayerKillReputation,
  setSparseFactionStance,
} from "@/editor/panels/databaseFactionModel";
import { setEffectiveFactionStance } from "@/project/factionRuntime";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { resolveFactionTable } from "@/project/factions";
import type { Command, EventPage, Project, ProjectFactions } from "@/project/types";

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
