/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { BATTLE_DEFEAT_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/06-cmd-monster-battle";
import { createInterpreter } from "@/player/interpreter";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import type { Command, EventPage, Project } from "@/project/types";
import { jsonEqual } from "@/util/structuralJson";
import { eventTarget, expectKoreanSentence, expectUndoRestores, loadFixture } from "./harness";

const SLIME = "species_wild_slime";
const KING = "species_king_slime";
const BAT = "species_cave_bat";
const TROOP = "troop_slime";
const BAT_TROOP = "troop_bat_swarm";
const MAP = "map_monster_trial";
const EVENT = "event_monster_trial";
const PAGE = "page_monster_trial";
const SPAWN = "spawn_trial";
const spawn = { id: SPAWN, troopId: TROOP, area: { x: 1, y: 2, w: 3, h: 2 }, chase: true };
const greeting: Command = { kind: "text", body: "도전을 시작할까요?" };
const victory: Command[] = [{ kind: "text", body: "승리했습니다." }];
const defeat: Command[] = [{ kind: "text", body: "다음 기회에." }];
const failure: Command[] = [{ kind: "text", body: "아직은 때가 아니에요." }];
const battleRecords = defaultBattleRecords();
const bases = new Map<FixtureName, Project>();

function page(id: string, commands: Command[]): EventPage {
  return {
    id, name: "도전", commands, conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 },
  };
}

function baseFixture(name: FixtureName): Project {
  let base = bases.get(name);
  if (!base) {
    base = loadFixture(name);
    bases.set(name, base);
  }
  return base;
}

function fixture(name: FixtureName, commands: Command[] = []) {
  const base = baseFixture(name);
  const map = {
    ...createBlankMap("도전의 방", 12, 10, Object.keys(base.tilesets)[0]!),
    id: MAP,
    fieldSpawns: [spawn, ...["spawn_spare", "spawn_north", "spawn_south", "spawn_east"].map(id => ({ ...spawn, id }))],
    events: [{
      id: EVENT, name: "시험관", x: 3, y: 4, trigger: { kind: "action" } as const, commands: [greeting],
      pages: [page(PAGE, [greeting, ...commands]), page("page_other", [greeting])],
    }],
  };
  const project: Project = {
    ...base, startMapId: MAP, startPos: { x: 2, y: 3 },
    maps: { ...base.maps, [MAP]: map },
    variables: [...base.variables, { id: "var_trial_troop", name: "도전 상대" }],
    database: {
      ...base.database,
      troops: battleRecords.troops,
      enemies: battleRecords.enemies,
      monsterSpecies: battleRecords.monsterSpecies,
    },
  };
  const target = eventTarget(project, MAP, EVENT, PAGE);
  return { project, target };
}

const cases = [
  {
    command: { kind: "giveMonster", speciesId: SLIME, level: 5 },
    insert: {},
    update: { speciesId: BAT, level: 7, nickname: "밤송이" },
    expected: { kind: "giveMonster", speciesId: BAT, level: 7, nickname: "밤송이" },
  },
  {
    command: { kind: "moveMonster", instanceId: "monster_1", to: "party" },
    insert: { instanceId: "monster_1" },
    update: { to: "box" },
    expected: { kind: "moveMonster", instanceId: "monster_1", to: "box" },
  },
  {
    command: { kind: "evolveMonster", instanceId: "monster_1", toSpeciesId: KING, successBranch: [], failureBranch: [] },
    insert: { instanceId: "monster_1", toSpeciesId: KING },
    update: { toSpeciesId: "" },
    existingBranches: { successBranch: victory, failureBranch: failure },
    expected: { kind: "evolveMonster", instanceId: "monster_1", toSpeciesId: "", successBranch: victory, failureBranch: failure },
  },
  {
    command: { kind: "spawnFieldEnemy", spawn },
    insert: { spawnId: SPAWN, troopId: TROOP, x: 1, y: 2, w: 3, h: 2 },
    update: { troopId: BAT_TROOP, chase: false, maxAlive: 2 },
    existingBranches: { spawn: { ...spawn, persistKill: true, timePhases: ["night"] } },
    expected: { kind: "spawnFieldEnemy", spawn: { ...spawn, troopId: BAT_TROOP, chase: false, maxAlive: 2, persistKill: true, timePhases: ["night"] } },
  },
  {
    command: { kind: "despawnFieldEnemy", spawnId: SPAWN },
    insert: { spawnId: SPAWN },
    update: { spawnId: "spawn_spare" },
    expected: { kind: "despawnFieldEnemy", spawnId: "spawn_spare" },
  },
  {
    command: { kind: "removeMonster", instanceId: "" },
    insert: {},
    update: { instanceId: "monster_2" },
    expected: { kind: "removeMonster", instanceId: "monster_2" },
  },
  {
    command: { kind: "tradeMonster", fromSpeciesId: SLIME, toSpeciesId: BAT },
    insert: { fromSpeciesId: SLIME, toSpeciesId: BAT },
    update: { toSpeciesId: KING, level: 11 },
    expected: { kind: "tradeMonster", fromSpeciesId: SLIME, toSpeciesId: KING, level: 11 },
  },
  {
    command: { kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_2" },
    insert: { instanceIdA: "monster_1", instanceIdB: "monster_2" },
    update: { instanceIdB: "monster_3" },
    expected: { kind: "fuseMonsters", instanceIdA: "monster_1", instanceIdB: "monster_3" },
  },
  {
    command: { kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: false },
    insert: { troopId: TROOP },
    update: { troopSource: "variable", troopVariableId: "var_trial_troop", canLose: true },
    existingBranches: { branchOnResult: true, victoryBranch: victory, defeatBranch: defeat, escapeBranch: [] },
    expected: {
      kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: true,
      troopSource: "variable", troopVariableId: "var_trial_troop",
      branchOnResult: true, victoryBranch: victory, defeatBranch: defeat, escapeBranch: [],
    },
  },
  {
    command: { kind: "tacticsBattle", troopId: TROOP, canLose: false, victoryBranch: [], defeatBranch: [] },
    insert: { troopId: TROOP },
    update: { width: 10, height: 4, canLose: true },
    existingBranches: { victoryBranch: victory, defeatBranch: defeat },
    expected: { kind: "tacticsBattle", troopId: TROOP, canLose: true, width: 10, height: 4, victoryBranch: victory, defeatBranch: defeat },
  },
] satisfies readonly {
  command: Command;
  insert: Record<string, unknown>;
  update: Record<string, unknown>;
  existingBranches?: Record<string, unknown>;
  expected: Command;
}[];

const fixtures = ["blank", "built", "maou"] as const;

beforeAll(() => {
  fixtures.forEach(baseFixture);
}, 180_000);

function stored(project: Project): Command[] {
  return project.maps[MAP]!.events[0]!.pages![0]!.commands;
}

describe.each(cases)("$command.kind", ({ command, insert, update, existingBranches, expected }) => {
  for (const mode of ["insert", "update"] as const) {
    it(`${mode} 한 줄의 결과와 범위 거절 및 한 번 되돌리기를 확인한다`, async () => {
      const updating = mode === "update";
      const existing = { ...command, ...existingBranches };
      const name = fixtures[cases.findIndex(row => row.command.kind === command.kind) % fixtures.length]!;
      const { project, target } = fixture(name, updating ? [existing] : []);
      const snapshots = structuredClone(project.maps[MAP]!.events);
      const id = `cmd.${command.kind}.${mode}`;
      const args = updating ? { index: 1, expectedHash: eventCommandHash(existing), ...update } : insert;
      const { after, sentence } = runPrimitive(project, target, id, args);

      expect(stored(after)).toEqual([greeting, updating ? expected : command]);
      expect(after.maps[MAP]!.events[0]!.pages![1]).toEqual(snapshots[0]!.pages![1]);
      expect(after.maps[MAP]!.events[0]!.commands).toEqual([greeting]);
      expect(jsonEqual(project.maps[MAP]!.events, snapshots)).toBe(true);
      expectKoreanSentence(sentence);
      expect(sentence).not.toMatch(/(?:troop_|species_|monster_|spawn_|var_|[{}\[\]"])/u);
      expect(sentence.length).toBeLessThanOrEqual(80);

      const primitive = PRIMITIVES.find(entry => entry.id === id)!;
      const outOfScope = { ...after, meta: { ...after.meta, title: "범위를 벗어난 제목" } };
      expect(checkSmallTaskScope(project, outOfScope, primitive.scope({ project, target }, args)))
        .toMatchObject({ ok: false, reason: expect.stringContaining("범위 밖") });
      expect(() => runPrimitive(project, { kind: "map", mapId: MAP, label: "도전의 방" }, id, args)).toThrow(/범위 밖/u);
      await expectUndoRestores(project, after, target);
    });
  }
});

it("해시가 달라진 줄과 명령 종류가 다른 줄의 수정을 거절한다", () => {
  const { project, target } = fixture("blank", [{ kind: "giveMonster", speciesId: SLIME, level: 5 }]);
  expect(() => runPrimitive(project, target, "cmd.giveMonster.update", { index: 1, level: 8, expectedHash: "old" }))
    .toThrow(/그 줄의 내용이 바뀌었습니다/u);
  expect(() => runPrimitive(project, target, "cmd.moveMonster.update", { index: 1, to: "box" })).toThrow(PrimitiveError);
});

it("패배 분기에 삽입하고 그 줄만 수정한다", () => {
  const { project, target } = fixture("built", [{
    kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true, branchOnResult: true,
    victoryBranch: victory, defeatBranch: defeat,
  }]);
  const branchPath = [1, BATTLE_DEFEAT_BRANCH_INDEX];
  const inserted = runPrimitive(project, target, "cmd.giveMonster.insert", { branchPath, index: 0, level: 3 }).after;
  const edited = runPrimitive(inserted, target, "cmd.giveMonster.update", { branchPath, index: 0, level: 4 }).after;
  expect(stored(edited)[1]).toMatchObject({
    victoryBranch: victory,
    defeatBranch: [{ kind: "giveMonster", speciesId: SLIME, level: 4 }, ...defeat],
  });
  expect(stored(project)[1]).toMatchObject({ defeatBranch: defeat });
});

it("기존 전투의 결과 분기를 켜고 저장된 분기 명령을 보존한다", () => {
  const { project, target } = fixture("built", [{
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: false, victoryBranch: victory,
  }]);
  const { after } = runPrimitive(project, target, "cmd.battleProcessing.update", { index: 1, branchOnResult: true });
  expect(stored(after)[1]).toEqual({
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: false, branchOnResult: true,
    victoryBranch: victory, defeatBranch: [], escapeBranch: [],
  });
});

it("출현 영역은 호스트에서 고른 칸을 기본으로 쓰고 맵 바깥 영역은 거절한다", () => {
  const { project, target } = fixture("blank");
  const args = { troopId: TROOP };
  const rect = { x: 7, y: 5, w: 2, h: 1 };
  const { after } = runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", args, { rect });
  expect(stored(after).at(-1)).toEqual({ kind: "spawnFieldEnemy", spawn: { id: "spawn_new", troopId: TROOP, area: rect, chase: true } });
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { ...args, x: 11, w: 2 }))
    .toThrow(/범위 밖/u);
  const second = runPrimitive(after, target, "cmd.spawnFieldEnemy.insert", args).after;
  expect(stored(second).at(-1)).toMatchObject({ spawn: { id: "spawn_new_2" } });
});

it("올바르지 않은 출현 스위치와 적 무리 참조를 한국어로 거절한다", () => {
  const { project, target } = fixture("blank");
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, onKillSwitchId: "missing_switch" }))
    .toThrow("자료집에서 쓰러뜨렸을 때 켤 스위치를 찾을 수 없습니다.");
  expect(() => runPrimitive(project, target, "cmd.battleProcessing.insert", { troopId: "missing_troop" }))
    .toThrow("자료집에서 전투에 쓸 적 무리를 찾을 수 없습니다.");
});

it("지급한 몬스터를 보관함으로 옮긴다", () => {
  let { project, target } = fixture("blank");
  project = runPrimitive(project, target, "cmd.giveMonster.insert", { speciesId: BAT, level: 7, nickname: "밤송이" }).after;
  project = runPrimitive(project, target, "cmd.moveMonster.insert", { instanceId: "monster_1", to: "box" }).after;
  const session = startSession(project, 11);
  expect(createInterpreter(stored(project).slice(1), session, project).start()).toEqual({ kind: "done" });
  expect(session.monsterInstances.monster_1).toMatchObject({ speciesId: BAT, level: 7, nickname: "밤송이" });
  expect(session.monsterParty).toEqual([]);
  expect(session.monsterBox).toEqual(["monster_1"]);
});

it("보관함 첫 슬라임을 박쥐로 교환하고 내준 개체를 없앤다", () => {
  let { project, target } = fixture("blank");
  project = runPrimitive(project, target, "cmd.giveMonster.insert", { level: 9 }).after;
  project = runPrimitive(project, target, "cmd.moveMonster.insert", { instanceId: "monster_1", to: "box" }).after;
  project = runPrimitive(project, target, "cmd.tradeMonster.insert", { fromSpeciesId: SLIME, toSpeciesId: BAT }).after;
  const session = startSession(project, 11);
  expect(createInterpreter(stored(project).slice(1), session, project).start()).toEqual({ kind: "done" });
  expect(session.flags.tradeMonsterSuccess).toBe(true);
  expect(session.monsterInstances.monster_1).toBeUndefined();
  expect(session.monsterInstances.monster_2).toMatchObject({ speciesId: BAT, level: 9 });
});

it("저장된 적 무리와 패배 허용을 전투 시작 단계에 전달한다", () => {
  const { project, target } = fixture("built");
  const { after } = runPrimitive(project, target, "cmd.battleProcessing.insert", { troopId: BAT_TROOP, canEscape: false, canLose: true });
  const session = startSession(after, 11);
  const result = createInterpreter(stored(after).slice(1), session, after, { currentEventId: EVENT }).start();
  expect(result).toMatchObject({
    kind: "battleProcessing", troopId: BAT_TROOP, canEscape: false, canLose: true, ownerEventId: EVENT,
  });
});

it("저장된 출현·제거 명령을 현재 맵의 실행 단계에 순서대로 전달한다", () => {
  let { project, target } = fixture("blank");
  project = runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, spawnId: "spawn_dynamic" }).after;
  project = runPrimitive(project, target, "cmd.despawnFieldEnemy.insert", { spawnId: "spawn_dynamic" }).after;
  const session = startSession(project, 11);
  const interpreter = createInterpreter(stored(project).slice(1), session, project);
  expect(interpreter.start()).toMatchObject({ kind: "spawnFieldEnemy", spawn: { id: "spawn_dynamic", troopId: TROOP } });
  expect(interpreter.resume(undefined)).toMatchObject({ kind: "despawnFieldEnemy", spawnId: "spawn_dynamic" });
});

const testDirectory = dirname(fileURLToPath(import.meta.url));
const seededCases: (CorpusCase & { seed?: Command })[] = JSON.parse(readFileSync(
  resolve(testDirectory, "06-cmd-monster-battle/seeded-corpus.json"), "utf8",
));
const stockCases: CorpusCase[] = JSON.parse(readFileSync(
  resolve(testDirectory, "../../harness-data/small-task-corpus/06-cmd-monster-battle.json"), "utf8",
));

it("동작마다 한국어 요청 여덟 개와 거절 두 개를 유지한다", () => {
  const all = [...stockCases, ...seededCases];
  expect(new Set(all.map(entry => entry.request)).size).toBe(all.length);
  for (const primitive of PRIMITIVES) {
    const rows = all.filter(entry => entry.primitive === primitive.id);
    expect(rows, primitive.id).toHaveLength(8);
    expect(rows.filter(entry => entry.expectRefusal), primitive.id).toHaveLength(2);
  }
});

// Seed rows and field spawns that do not occur in the stock projects.
it.each(seededCases)("$request", async entry => {
  const { project } = fixture(entry.fixture, entry.seed ? [entry.seed] : []);
  const target = resolveTarget(project, entry.target);
  const apply = () => runPrimitive(project, target, entry.primitive, entry.args, entry.selection);
  if (entry.expectRefusal) {
    expect(apply).toThrow(PrimitiveError);
    return;
  }
  const { after, sentence } = apply();
  expectKoreanSentence(sentence, target);
  for (const check of entry.expect ?? []) {
    const value = readCheckPath(after, check.at);
    if (Object.hasOwn(check, "equals")) expect(value, check.at).toEqual(check.equals);
    if (check.count !== undefined) expect(value, check.at).toHaveLength(check.count);
  }
  await expectUndoRestores(project, after, target);
});
