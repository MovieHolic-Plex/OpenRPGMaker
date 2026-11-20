/** @vitest-environment happy-dom */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { checkSmallTaskScope } from "@/ai/smallTaskScope";
import { BATTLE_DEFEAT_BRANCH_INDEX, BATTLE_VICTORY_BRANCH_INDEX, FORK_THEN_BRANCH_INDEX, LOOP_BODY_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { readCheckPath, resolveTarget, type CorpusCase, type FixtureName } from "@/editor/smallTask/primitives/corpusSchema";
import { PrimitiveError, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "@/editor/smallTask/primitives/errors";
import { runPrimitive } from "@/editor/smallTask/primitives/run";
import { PRIMITIVES } from "@/editor/smallTask/primitives/units/06-cmd-monster-battle";
import { playCommandBattle } from "@/player/commandBattle";
import { addFieldSpawnEntry, createFieldSpawnRuntime, removeFieldSpawnEntry } from "@/player/fieldSpawns";
import { createInterpreter } from "@/player/interpreter";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { ensureSwitchVariableSlots } from "@/project/defaults/blankProject";
import { removeLegacySpriteReferences } from "@/project/defaults/defaultAssets";
import { defaultBattleRecords } from "@/project/defaults/defaultDatabaseBattleRecords";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { eventCommandHash } from "@/project/eventCommands/singleCommandOps";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
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
const TROOP_VARIABLE = "var_trial_troop";
const spawn = { id: SPAWN, troopId: TROOP, area: { x: 1, y: 2, w: 3, h: 2 }, chase: true };
const dynamicSpawn: Extract<Command, { kind: "spawnFieldEnemy" }> = { kind: "spawnFieldEnemy", spawn: { ...spawn, id: "spawn_event" } };
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
    // Match the editor's normalization before runPrimitive freezes the fixture.
    ensureSwitchVariableSlots(base);
    removeLegacySpriteReferences(base);
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
    variables: [...base.variables, { id: TROOP_VARIABLE, name: "도전 상대" }],
    session: { ...base.session, variables: { ...base.session.variables, [TROOP_VARIABLE]: 0 } },
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
    command: dynamicSpawn,
    insert: { spawnId: dynamicSpawn.spawn.id, troopId: TROOP, x: 1, y: 2, w: 3, h: 2 },
    update: { troopId: BAT_TROOP, chase: false, maxAlive: 2 },
    existingBranches: { spawn: { ...dynamicSpawn.spawn, persistKill: true, timePhases: ["night" as const] } },
    expected: { kind: "spawnFieldEnemy", spawn: { ...dynamicSpawn.spawn, troopId: BAT_TROOP, chase: false, maxAlive: 2, persistKill: true, timePhases: ["night"] } },
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
      expect(() => runPrimitive(project, target, id, { ...args, pageId: "page_other" })).toThrow(PrimitiveError);
      await expectUndoRestores(project, after, target);
    });
  }
});

it("해시가 없거나 같은 종류의 다른 줄을 가리키면 수정을 거절한다", () => {
  const first: Command = { kind: "giveMonster", speciesId: SLIME, level: 5 };
  const second: Command = { kind: "giveMonster", speciesId: BAT, level: 7 };
  const { project, target } = fixture("blank", [first, second]);
  expect(() => runPrimitive(project, target, "cmd.giveMonster.update", { index: 1, level: 8 })).toThrow(PrimitiveError);
  expect(() => runPrimitive(project, target, "cmd.giveMonster.update", { index: 2, level: 8, expectedHash: eventCommandHash(first) }))
    .toThrow(STALE_COMMAND_LIST);
  expect(() => runPrimitive(project, target, "cmd.moveMonster.update", { index: 1, to: "box", expectedHash: eventCommandHash(first) }))
    .toThrow(/이 종류의 명령을 찾을 수 없습니다/u);
  const { after } = runPrimitive(project, target, "cmd.giveMonster.update", { index: 1, level: 8, expectedHash: eventCommandHash(first) });
  expect(stored(after)).toEqual([greeting, { ...first, level: 8 }, second]);
});

it("고른 페이지에서 현재 줄의 해시로 몬스터 지급 명령을 옮기고 지운다", () => {
  const give: Command = { kind: "giveMonster", speciesId: SLIME, level: 5 };
  const { project, target } = fixture("blank", [give]);
  const eventOnly = eventTarget(project, MAP, EVENT);
  expect(() => runPrimitive(project, eventOnly, "cmd.giveMonster.insert", {})).toThrow(SELECT_EVENT_PAGE);

  const expectedHash = eventCommandHash(give);
  const { after: moved } = runPrimitive(project, target, "cmd.move", { index: 1, toIndex: 0, expectedHash });
  expect(stored(moved)).toEqual([give, greeting]);
  expect(() => runPrimitive(moved, target, "cmd.delete", { index: 1, expectedHash })).toThrow(STALE_COMMAND_LIST);
  const { after } = runPrimitive(moved, target, "cmd.delete", { index: 0, expectedHash });
  expect(stored(after)).toEqual([greeting]);
  expect(after.maps[MAP]!.events[0]!.pages![1]).toBe(project.maps[MAP]!.events[0]!.pages![1]);
  expect(stored(project)).toEqual([greeting, give]);
});

it("고른 페이지를 하나로 확인할 수 없으면 적용을 거절한다", () => {
  const { project, target } = fixture("blank");
  const pages = project.maps[MAP]!.events[0]!.pages!;
  pages[1] = { ...pages[1]!, id: PAGE };
  expect(() => runPrimitive(project, target, "cmd.giveMonster.insert", {})).toThrow(/페이지를 하나로 확인/u);
  expect(pages.map(page => page.commands)).toEqual([[greeting], [greeting]]);
});

it("다른 분기도 같은 명령 목록을 공유하면 한쪽만 고칠 수 없어 거절한다", () => {
  const give: Command = { kind: "giveMonster", speciesId: SLIME, level: 5 };
  const shared = [give];
  const battle: Command = {
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: true, branchOnResult: true,
    victoryBranch: shared, defeatBranch: shared,
  };
  const { project, target } = fixture("blank", [battle]);
  const branchPath = [1, BATTLE_DEFEAT_BRANCH_INDEX];
  expect(() => runPrimitive(project, target, "cmd.giveMonster.insert", { branchPath }))
    .toThrow(/분기 위치를 하나로 확인/u);
  expect(() => runPrimitive(project, target, "cmd.giveMonster.update", { branchPath, index: 0, expectedHash: eventCommandHash(give), level: 6 }))
    .toThrow(/분기 위치를 하나로 확인/u);
  expect(shared).toEqual([give]);
});

it("같은 부모 줄이 두 곳에 있으면 한쪽 빈 분기만 만들 수 없어 거절한다", () => {
  const battle: Command = {
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: true, branchOnResult: true,
  };
  const { project, target } = fixture("blank", [battle, battle]);
  expect(() => runPrimitive(project, target, "cmd.giveMonster.insert", { branchPath: [1, BATTLE_DEFEAT_BRANCH_INDEX] }))
    .toThrow(/분기 위치를 하나로 확인/u);
  expect(battle.defeatBranch).toBeUndefined();
});

it.each([
  ["spawnFieldEnemy", { troopId: TROOP }, dynamicSpawn, { chase: false }],
  ["despawnFieldEnemy", { spawnId: SPAWN }, { kind: "despawnFieldEnemy", spawnId: SPAWN }, { spawnId: "spawn_spare" }],
  ["tacticsBattle", { troopId: TROOP }, { kind: "tacticsBattle", troopId: TROOP }, { canLose: true }],
] as const)("%s 명령이 실행되지 않는 병렬 페이지는 거절한다", (kind, insert, command, patch) => {
  const { project, target } = fixture("blank", [command]);
  const selectedPage = project.maps[MAP]!.events[0]!.pages![0]!;
  selectedPage.trigger = { kind: "parallel" };
  expect(() => runPrimitive(project, target, `cmd.${kind}.insert`, insert)).toThrow(/병렬 실행 페이지에서/u);
  expect(() => runPrimitive(project, target, `cmd.${kind}.update`, {
    index: 1, expectedHash: eventCommandHash(command), ...patch,
  })).toThrow(/병렬 실행 페이지에서/u);
  expect(stored(project)).toEqual([greeting, command]);
  expect(stored(runPrimitive(project, target, "cmd.battleProcessing.insert", { troopId: TROOP }).after).at(-1))
    .toMatchObject({ kind: "battleProcessing", troopId: TROOP });
});

it("패배 분기에 삽입하고 그 줄만 수정한다", () => {
  const { project, target } = fixture("built", [{
    kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: true, branchOnResult: true,
    victoryBranch: victory, defeatBranch: defeat,
  }]);
  const branchPath = [1, BATTLE_DEFEAT_BRANCH_INDEX];
  const inserted = runPrimitive(project, target, "cmd.giveMonster.insert", { branchPath, index: 0, level: 3 }).after;
  const expectedHash = eventCommandHash({ kind: "giveMonster", speciesId: SLIME, level: 3 });
  const edited = runPrimitive(inserted, target, "cmd.giveMonster.update", { branchPath, index: 0, level: 4, expectedHash }).after;
  expect(stored(edited)[1]).toMatchObject({
    victoryBranch: victory,
    defeatBranch: [{ kind: "giveMonster", speciesId: SLIME, level: 4 }, ...defeat],
  });
  expect(stored(project)[1]).toMatchObject({ defeatBranch: defeat });
});

it("열려 있는 빈 전투 분기에만 첫 줄을 넣고 잘못된 위치는 거절한다", () => {
  const battle: Command = { kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: true, branchOnResult: true, victoryBranch: victory };
  const { project, target } = fixture("blank", [battle]);
  const id = "cmd.giveMonster.insert";
  const { after } = runPrimitive(project, target, id, { branchPath: [1, BATTLE_DEFEAT_BRANCH_INDEX] });
  expect(stored(after)).toEqual([greeting, { ...battle, defeatBranch: [{ kind: "giveMonster", speciesId: SLIME, level: 5 }] }]);
  expect(stored(project)).toEqual([greeting, battle]);
  for (const branchPath of [[1], [1, FORK_THEN_BRANCH_INDEX], [0, BATTLE_DEFEAT_BRANCH_INDEX], [1, BATTLE_DEFEAT_BRANCH_INDEX, 0, BATTLE_VICTORY_BRANCH_INDEX]]) {
    expect(() => runPrimitive(project, target, id, { branchPath })).toThrow(PrimitiveError);
  }
  expect(() => runPrimitive(project, target, id, { branchPath: [1, BATTLE_DEFEAT_BRANCH_INDEX], index: 1 })).toThrow(/줄의 위치/u);
  expect(() => runPrimitive(project, target, id, { index: 3 })).toThrow(/줄의 위치/u);
});

it("기존 전투의 결과 분기를 켜고 저장된 분기 명령을 보존한다", () => {
  const battle: Command = {
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: false, victoryBranch: victory,
  };
  const { project, target } = fixture("built", [battle]);
  const { after } = runPrimitive(project, target, "cmd.battleProcessing.update", { index: 1, branchOnResult: true, expectedHash: eventCommandHash(battle) });
  expect(stored(after)[1]).toEqual({
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: false, branchOnResult: true,
    victoryBranch: victory, defeatBranch: [], escapeBranch: [],
  });
  const interpreter = createInterpreter(stored(after).slice(1), startSession(after, 11), after);
  expect(interpreter.start()).toMatchObject({ kind: "battleProcessing", branchOnResult: true });
  expect(interpreter.resume("victory")).toMatchObject({ kind: "text", body: "승리했습니다." });
});

it("꺼진 결과 분기와 그 안의 중첩 분기는 편집을 거절하고 다시 켜면 원래 줄을 실행한다", async () => {
  const gift: Command = { kind: "giveMonster", speciesId: SLIME, level: 3 };
  const battle: Command = {
    kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: true, branchOnResult: true,
    victoryBranch: [{ kind: "loop", body: [gift, { kind: "breakLoop" }] }, ...victory],
    defeatBranch: defeat,
  };
  const { project, target } = fixture("blank", [battle]);
  const toggleResults = (before: Project, branchOnResult: boolean) => runPrimitive(before, target, "cmd.battleProcessing.update", {
    index: 1, expectedHash: eventCommandHash(stored(before)[1]!), branchOnResult,
  }).after;
  const disabled = toggleResults(project, false);
  expect(stored(disabled)[1]).toEqual({ ...battle, branchOnResult: false });
  const session = startSession(disabled, 11);
  const interpreter = createInterpreter(stored(disabled).slice(1), session, disabled);
  expect(interpreter.start()).toMatchObject({ kind: "battleProcessing", branchOnResult: false });
  expect(interpreter.resume("victory")).toEqual({ kind: "done" });
  expect(session.monsterParty).toEqual([]);

  const branchPath = [1, BATTLE_VICTORY_BRANCH_INDEX];
  const editGift = { branchPath: [...branchPath, 0, LOOP_BODY_BRANCH_INDEX], index: 0, expectedHash: eventCommandHash(gift), level: 4 };
  expect(() => runPrimitive(disabled, target, "cmd.giveMonster.insert", { branchPath })).toThrow(/결과 분기를 먼저 켠/u);
  expect(() => runPrimitive(disabled, target, "cmd.giveMonster.update", editGift)).toThrow(/결과 분기를 먼저 켠/u);
  const enabled = toggleResults(disabled, true);
  expect(stored(enabled)[1]).toEqual({ ...battle, escapeBranch: [] });
  const edited = runPrimitive(enabled, target, "cmd.giveMonster.update", editGift).after;
  const resumedSession = startSession(edited, 11);
  const resumed = createInterpreter(stored(edited).slice(1), resumedSession, edited);
  expect(resumed.start()).toMatchObject({ kind: "battleProcessing", branchOnResult: true });
  expect(resumed.resume("victory")).toMatchObject({ kind: "text", body: "승리했습니다." });
  expect(resumedSession.monsterInstances.monster_1).toMatchObject({ level: 4 });
  await expectUndoRestores(enabled, edited, target);
  await expectUndoRestores(disabled, enabled, target);
  await expectUndoRestores(project, disabled, target);
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

it("넓은 출현 영역에서는 동시 출현 상한까지 배치하고 그보다 큰 입력을 거절한다", () => {
  const { project, target } = fixture("blank");
  const insert = "cmd.spawnFieldEnemy.insert";
  const update = "cmd.spawnFieldEnemy.update";
  const region = { troopId: TROOP, x: 0, y: 0, w: 12, h: 10 };
  expect(() => runPrimitive(project, target, insert, { ...region, maxAlive: 65 })).toThrow(PrimitiveError);
  const { after } = runPrimitive(project, target, insert, { ...region, maxAlive: 64 });
  const command = stored(after)[1];
  if (command?.kind !== "spawnFieldEnemy") throw new Error("출현 명령이 필요합니다.");
  const edit = { index: 1, expectedHash: eventCommandHash(command) };
  expect(() => runPrimitive(after, target, update, { ...edit, maxAlive: 65 })).toThrow(PrimitiveError);
  const map = after.maps[MAP]!;
  const player = { x: 2, y: 3 };
  const runtime = createFieldSpawnRuntime(after, map, player);
  addFieldSpawnEntry(runtime, after, map, command.spawn, player);
  expect(runtime.entries.at(-1)?.alive).toHaveLength(64);
});

it("기존 큰 출현 상한은 다른 속성을 고칠 때 보존하고 넓은 영역으로 바꿀 때 제한한다", () => {
  const legacy = { ...dynamicSpawn, spawn: { ...dynamicSpawn.spawn, maxAlive: 200 } };
  const { project, target } = fixture("blank", [legacy]);
  const update = "cmd.spawnFieldEnemy.update";
  const row = { index: 1, expectedHash: eventCommandHash(legacy) };
  const { after } = runPrimitive(project, target, update, { ...row, chase: false });
  expect(stored(after)[1]).toEqual({ ...legacy, spawn: { ...legacy.spawn, chase: false } });
  const region = { ...row, x: 0, y: 0, w: 12, h: 10 };
  expect(() => runPrimitive(project, target, update, region)).toThrow(/동시 출현 마릿수를 64 이하로/u);
  expect(stored(runPrimitive(project, target, update, { ...region, maxAlive: 64 }).after)[1])
    .toMatchObject({ spawn: { area: { x: 0, y: 0, w: 12, h: 10 }, maxAlive: 64 } });
});

it("올바르지 않은 출현 스위치와 적 무리 참조를 한국어로 거절한다", () => {
  const { project, target } = fixture("blank");
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, onKillSwitchId: "missing_switch" }))
    .toThrow("자료집에서 쓰러뜨렸을 때 켤 스위치를 찾을 수 없습니다.");
  expect(() => runPrimitive(project, target, "cmd.battleProcessing.insert", { troopId: "missing_troop" }))
    .toThrow("자료집에서 전투에 쓸 적 무리를 찾을 수 없습니다.");
});

it("맵이나 다른 페이지에서 쓰는 출현 이름과 같은 런타임 이벤트 ID를 거절한다", () => {
  const { project, target } = fixture("blank");
  project.maps[MAP]!.events[0]!.pages![1]!.commands.push(dynamicSpawn);
  for (const spawnId of [SPAWN, dynamicSpawn.spawn.id, "spawn event"]) {
    expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, spawnId }))
      .toThrow(/이미 쓰는 출현 이름/u);
  }
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, spawnId: " " }))
    .toThrow(/출현 이름을 입력/u);
  expect(stored(project)).toEqual([greeting]);
});

it("저작 이벤트와 충돌하는 출현 이름을 거절하고 기본 이름은 충돌을 건너뛴다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  const map = project.maps[MAP]!;
  map.events.push({ ...map.events[0]!, id: "__field_spawn__spawn_new_1" });
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, spawnId: "spawn new" }))
    .toThrow(/이미 쓰는 출현 이름/u);
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn_new",
  })).toThrow(/이미 쓰는 출현 이름/u);
  const { after } = runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP });
  expect(stored(after).at(-1)).toMatchObject({ spawn: { id: "spawn_new_2" } });
  expect(after.maps[MAP]!.events[1]).toEqual(map.events[1]);
});

it("다른 페이지가 같은 출현 줄을 공유하면 런타임 ID가 겹치는 이름 변경을 거절한다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  project.maps[MAP]!.events[0]!.pages![1]!.commands.push(dynamicSpawn);
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn event",
  })).toThrow(/이미 쓰는 출현 이름/u);
});

it.each(["constructor", "__proto__"])("처치 기록에서 예약된 출현 이름 %s를 거절한다", spawnId => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, spawnId, persistKill: true }))
    .toThrow(/예약한 이름/u);
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId,
  })).toThrow(/예약한 이름/u);
});

it.each(["map", "common", "troop"] as const)("%s에서 제거할 출현 이름을 바꾸지 못한다", owner => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  const remove: Command = { kind: "despawnFieldEnemy", spawnId: dynamicSpawn.spawn.id };
  const commands: Command[] = [{ kind: "loop", body: [remove] }];
  if (owner === "map") project.maps[MAP]!.events[0]!.pages![1]!.commands.push(...commands);
  if (owner === "common") project.commonEvents = [...project.commonEvents, { id: "ce_remove", name: "정리", trigger: "none", commands }];
  if (owner === "troop") project.database.troops = project.database.troops.map(troop => troop.id === TROOP
    ? { ...troop, afterBattle: { victory: commands } } : troop);

  const args = { index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn_renamed" };
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", args)).toThrow(/이 출현 이름을 쓰는 명령이나 조건/u);
  expect(stored(project)).toEqual([greeting, dynamicSpawn]);
});

it("출현으로 생기는 이벤트를 조건에서 쓸 때 출현 이름을 유지한다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  project.maps[MAP]!.events[0]!.pages![1]!.conditions = [{ kind: "pursuitActive", eventId: "__field_spawn__spawn_event_1", value: true }];
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn_renamed",
  })).toThrow(/이 출현 이름을 쓰는 명령이나 조건/u);
});

it("출현 이벤트의 시작 셀프 스위치를 끊는 이름 변경을 거절한다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  project.session = { ...project.session, selfSwitches: { "__field_spawn__spawn_event_1": { A: true } } };
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn_renamed",
  })).toThrow(/이 출현 이름을 쓰는 명령이나 조건/u);
});

it("공용 스크립트에서 출현 이름이나 그 이벤트를 참조하면 이름 변경을 거절한다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  const rename = (before: Project, spawnId: string) => runPrimitive(before, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId,
  });
  // The runtime event id would stay the same, but the script's despawn still uses the original name.
  const remove = "game.cmd({kind: 'despawnFieldEnemy', spawnId: 'spawn_event'});";
  const withRemove = { ...project, scriptLibrary: [{ id: "remove_spawn", source: remove, compiled: remove }] };
  expect(() => rename(withRemove, "spawn event")).toThrow(/스크립트 참조를 확인할 수 없어/u);

  const move = "game.cmd({kind: 'moveEvent', eventId: '__field_spawn__spawn_event_1', route: {steps: []}});";
  const withMove = { ...project, scriptLibrary: [{ id: "move_spawn", source: move, compiled: move }] };
  expect(() => rename(withMove, "spawn_renamed")).toThrow(/스크립트 참조를 확인할 수 없어/u);
});

it.each(["page", "library"] as const)("출현 ID를 조합하는 실행 가능한 %s 스크립트가 있으면 이름을 유지한다", owner => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  const source = "const id = ['spawn', 'event'].join('_'); await game.cmd({ kind: 'despawnFieldEnemy', spawnId: id });";
  const script = { source, compiled: source, effects: { reads: [], writes: [], calls: [], dynamic: [] } };
  if (owner === "page") project.maps[MAP]!.events[0]!.pages![1]!.commands.push({ kind: "script", ...script });
  else project.scriptLibrary = [{
    id: "remove_spawn",
    source: `export async function remove() { ${source} }`,
    compiled: `exports.remove = async () => { ${source} };`,
    effects: script.effects,
  }];
  const args = { index: 1, expectedHash: eventCommandHash(dynamicSpawn) };
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", { ...args, spawnId: "spawn event" }))
    .toThrow(/스크립트 참조를 확인할 수 없어/u);
  const { after } = runPrimitive(project, target, "cmd.spawnFieldEnemy.update", { ...args, chase: false });
  expect(stored(after)[1]).toMatchObject({ spawn: { id: dynamicSpawn.spawn.id, chase: false } });
});

it("다른 이벤트의 편집을 취소하면 돌아올 제거 명령도 보호한다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn]);
  const remove: Command = { kind: "despawnFieldEnemy", spawnId: dynamicSpawn.spawn.id };
  const original = { ...project.maps[MAP]!.events[0]!, id: "event_remove", commands: [], pages: [page("remove", [remove])] };
  project.maps[MAP]!.events.push({ ...original, pages: [page("remove", [])], draft: { kind: "edit", original } });
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn_renamed",
  })).toThrow(/이 출현 이름을 쓰는 명령이나 조건/u);
});

it("기존 처치 기록을 쓰는 출현의 이름을 유지한다", () => {
  const persistent = { ...dynamicSpawn, spawn: { ...dynamicSpawn.spawn, persistKill: true } };
  const { project, target } = fixture("blank", [persistent]);
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(persistent), spawnId: "spawn_renamed",
  })).toThrow(/기존 기록/u);
});

it("처치 수 저장을 끈 뒤 이전 슬롯을 불러와도 출현 이름과 처치 수를 유지한다", async () => {
  const persistent = { ...dynamicSpawn, spawn: { ...dynamicSpawn.spawn, maxAlive: 1, persistKill: true } };
  const { project, target } = fixture("blank", [persistent]);
  const session = startSession(project, 11);
  session.killedFieldSpawns = { [MAP]: { [persistent.spawn.id]: 1 } };
  const snapshot = createSaveSnapshot(project, session);
  const { after } = runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(persistent), persistKill: false,
  });
  const command = stored(after)[1];
  expect(command).toEqual({ ...persistent, spawn: { ...persistent.spawn, persistKill: false } });
  expect(() => runPrimitive(after, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(command!), spawnId: "spawn_renamed",
  })).toThrow(/기존 기록/u);

  const loaded = applySaveSnapshot(after, snapshot);
  const step = createInterpreter(stored(after).slice(1), loaded, after).start();
  if (step.kind !== "spawnFieldEnemy") throw new Error("출현 단계가 필요합니다.");
  const map = after.maps[MAP]!;
  const player = { x: loaded.x, y: loaded.y };
  const runtime = createFieldSpawnRuntime(after, map, player);
  addFieldSpawnEntry(runtime, after, map, step.spawn, player, loaded.killedFieldSpawns?.[MAP]?.[step.spawn.id]);
  expect(runtime.entries.at(-1)).toMatchObject({ spawn: { id: persistent.spawn.id }, persistedDead: 1, alive: [] });
  await expectUndoRestores(project, after, target);
});

it("부대의 전투 뒤 출현은 제거할 수 있고 전투 중 출현은 거절한다", () => {
  const { project, target } = fixture("blank");
  project.database.troops = project.database.troops.map(troop => troop.id === TROOP
    ? { ...troop, afterBattle: { victory: [dynamicSpawn] } } : troop);
  const args = { spawnId: dynamicSpawn.spawn.id };
  const { after } = runPrimitive(project, target, "cmd.despawnFieldEnemy.insert", args);
  expect(stored(after).at(-1)).toEqual({ kind: "despawnFieldEnemy", spawnId: dynamicSpawn.spawn.id });

  const troops = project.database.troops.map(troop => troop.id === TROOP ? {
    ...troop, afterBattle: undefined,
    battleEventPages: [{ id: "trial_battle_event", name: "전투 중", conditions: [], span: "battle" as const, commands: [dynamicSpawn] }],
  } : troop);
  const duringBattle = { ...project, database: { ...project.database, troops } };
  expect(() => runPrimitive(duringBattle, target, "cmd.despawnFieldEnemy.insert", args)).toThrow(/제거할 적 무리의 출현/u);
});

it.each([false, true])("출현을 제거 대상으로 쓸 수 있는지는 결과 분기 활성 여부(%s)를 따른다", branchOnResult => {
  const { project, target } = fixture("blank", [{
    kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: false, branchOnResult, victoryBranch: [dynamicSpawn],
  }]);
  const args = { spawnId: dynamicSpawn.spawn.id };
  const insert = () => runPrimitive(project, target, "cmd.despawnFieldEnemy.insert", args);
  if (branchOnResult) expect(stored(insert().after).at(-1)).toEqual({ kind: "despawnFieldEnemy", ...args });
  else expect(insert).toThrow(/제거할 적 무리의 출현/u);
});

it("꺼진 결과 분기에서 가리키는 출현 이름을 유지한다", () => {
  const { project, target } = fixture("blank", [dynamicSpawn, {
    kind: "battleProcessing", troopId: TROOP, canEscape: false, canLose: false, branchOnResult: false,
    victoryBranch: [{ kind: "despawnFieldEnemy", spawnId: dynamicSpawn.spawn.id }],
  }]);
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", {
    index: 1, expectedHash: eventCommandHash(dynamicSpawn), spawnId: "spawn_renamed",
  })).toThrow(/이 출현 이름을 쓰는 명령이나 조건/u);
});

it("이름 있는 구역을 지울 때만 직접 지정한 영역으로 바꾼다", () => {
  const anchored = { ...dynamicSpawn, spawn: { ...dynamicSpawn.spawn, locationId: "loc_trial" } };
  const { project, target } = fixture("blank", [anchored]);
  project.maps[MAP]!.locations = [{ id: "loc_trial", name: "연습 마당", x: 4, y: 4, w: 3, h: 4 }];
  const id = "cmd.spawnFieldEnemy.update";
  const args = { index: 1, expectedHash: eventCommandHash(anchored) };
  expect(runPrimitive(project, target, id, { ...args, chase: false }).sentence).toContain("연습 마당");
  expect(() => runPrimitive(project, target, id, { ...args, x: 5 })).toThrow(/구역 지정을 비워/u);
  const { after } = runPrimitive(project, target, id, { ...args, locationId: "", x: 5 });
  expect(stored(after)[1]).toEqual({ ...dynamicSpawn, spawn: { ...dynamicSpawn.spawn, area: { ...spawn.area, x: 5 } } });
});

it("출현 구역 지정을 지우면 다시 쓰게 될 좌표의 범위를 검사한다", () => {
  const legacy = { ...dynamicSpawn, spawn: { ...dynamicSpawn.spawn, locationId: "loc_trial", area: { ...spawn.area, x: 11 } } };
  const { project, target } = fixture("blank", [legacy]);
  project.maps[MAP]!.locations = [{ id: "loc_trial", name: "연습 마당", x: 4, y: 4, w: 3, h: 4 }];
  const args = { index: 1, expectedHash: eventCommandHash(legacy), locationId: "" };
  expect(() => runPrimitive(project, target, "cmd.spawnFieldEnemy.update", args)).toThrow(/출현 영역을 선택한 맵 안에/u);
  const { after } = runPrimitive(project, target, "cmd.spawnFieldEnemy.update", { ...args, x: 1 });
  expect(stored(after)[1]).toEqual(dynamicSpawn);
});

it("이름 있는 구역을 지정하면 런타임과 예비 좌표가 그 구역을 사용한다", () => {
  const { project, target } = fixture("blank");
  const area = { x: 4, y: 4, w: 3, h: 4 };
  project.maps[MAP]!.locations = [{ id: "loc_trial", name: "연습 마당", ...area }];
  const { after } = runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", {
    troopId: TROOP, locationId: "loc_trial",
  }, { rect: { x: 1, y: 1, w: 2, h: 2 } });
  const interpreter = createInterpreter(stored(after).slice(1), startSession(after, 11), after);
  const step = interpreter.start();
  expect(step).toMatchObject({ kind: "spawnFieldEnemy", spawn: { area, locationId: "loc_trial" } });
  if (step.kind !== "spawnFieldEnemy") throw new Error("출현 단계가 필요합니다.");
  const map = after.maps[MAP]!;
  const player = { x: 0, y: 0 };
  const runtime = createFieldSpawnRuntime(after, map, player);
  addFieldSpawnEntry(runtime, after, map, step.spawn, player);
  expect(runtime.entries.at(-1)?.spawn.area).toEqual(area);
  expect(runtime.entries.at(-1)?.alive[0]).toMatchObject({ x: area.x, y: area.y });
});

it("실행에 쓰이지 않는 전투 상대와 잘못된 격자 크기, 빈 진화 종 ID를 거절한다", () => {
  const { project, target } = fixture("blank");
  const insert = (kind: string, args: Record<string, unknown>) => runPrimitive(project, target, `cmd.${kind}.insert`, args);
  expect(() => insert("battleProcessing", { troopId: TROOP, troopVariableId: "bad_var" })).toThrow(/변수에서 읽는 방식/u);
  expect(() => insert("battleProcessing", { troopId: "bad_troop", troopSource: "variable", troopVariableId: "var_trial_troop" }))
    .toThrow(/적 무리를 직접 고르는 방식/u);
  expect(() => insert("tacticsBattle", { troopId: TROOP, width: 17 })).toThrow(PrimitiveError);
  expect(() => insert("tacticsBattle", { troopId: TROOP, height: 13 })).toThrow(PrimitiveError);
  expect(() => insert("evolveMonster", { instanceId: "monster_1", toSpeciesId: " " })).toThrow(/몬스터 종을 찾을 수 없습니다/u);
  expect(() => insert("moveMonster", { instanceId: "monster_99999999999999999", to: "box" })).toThrow(/몬스터 개체를 찾을 수 없습니다/u);
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

it("변수로 지정한 적 무리를 실제 전투 시작에 전달한다", async () => {
  const { project, target } = fixture("blank");
  const variableId = "var_trial_troop";
  const { after } = runPrimitive(project, target, "cmd.battleProcessing.insert", {
    troopSource: "variable", troopVariableId: variableId,
  });
  const session = startSession(after, 11);
  session.variables[variableId] = after.database.troops.findIndex(troop => troop.id === BAT_TROOP) + 1;
  const step = createInterpreter(stored(after).slice(1), session, after).start();
  if (step.kind !== "battleProcessing") throw new Error("전투 단계가 필요합니다.");
  const playBattle = vi.fn().mockResolvedValue("victory");
  const scene: Pick<PlaySceneContext, "session" | "map" | "clearRuntimeOverlay" | "playBattle"> = {
    session, map: after.maps[MAP]!, clearRuntimeOverlay: vi.fn(), playBattle,
  };
  const current = vi.spyOn(store, "getCurrent").mockReturnValue(after);
  try {
    expect(await playCommandBattle(scene as PlaySceneContext, step, () => true)).toBe("victory");
    expect(playBattle).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ troopId: BAT_TROOP }), expect.any(Function));
  } finally {
    current.mockRestore();
  }
});

it.each([["victory", "승리했습니다."], ["defeat", "다음 기회에."]] as const)("전술 전투를 편집해도 %s 분기를 실행한다", (result, body) => {
  const battle: Command = { kind: "tacticsBattle", troopId: TROOP, canLose: false, victoryBranch: victory, defeatBranch: defeat };
  const { project, target } = fixture("blank", [battle]);
  const { after } = runPrimitive(project, target, "cmd.tacticsBattle.update", {
    index: 1, expectedHash: eventCommandHash(battle), width: 9, height: 7, canLose: true,
  });
  const interpreter = createInterpreter(stored(after).slice(1), startSession(after, 11), after);
  expect(interpreter.start()).toMatchObject({ kind: "tacticsBattle", width: 9, height: 7, canLose: true });
  expect(interpreter.resume(result)).toMatchObject({ kind: "text", body });
});

it("저장된 출현 명령으로 적을 만들고 제거 명령으로 그 적만 없앤다", () => {
  let { project, target } = fixture("blank");
  project = runPrimitive(project, target, "cmd.spawnFieldEnemy.insert", { troopId: TROOP, spawnId: "spawn_dynamic" }).after;
  project = runPrimitive(project, target, "cmd.despawnFieldEnemy.insert", { spawnId: "spawn_dynamic" }).after;
  const session = startSession(project, 11);
  const interpreter = createInterpreter(stored(project).slice(1), session, project);
  const spawnStep = interpreter.start();
  expect(spawnStep).toMatchObject({ kind: "spawnFieldEnemy", spawn: { id: "spawn_dynamic", troopId: TROOP } });
  if (spawnStep.kind !== "spawnFieldEnemy") throw new Error("출현 단계가 필요합니다.");
  const map = project.maps[MAP]!;
  const player = { x: session.x, y: session.y };
  const runtime = createFieldSpawnRuntime(project, map, player);
  const otherEntries = runtime.entries.slice();
  addFieldSpawnEntry(runtime, project, map, spawnStep.spawn, player);
  expect(runtime.entries.at(-1)?.alive[0]?.spawnId).toBe("spawn_dynamic");
  const despawnStep = interpreter.resume(undefined);
  expect(despawnStep).toMatchObject({ kind: "despawnFieldEnemy", spawnId: "spawn_dynamic" });
  if (despawnStep.kind !== "despawnFieldEnemy") throw new Error("제거 단계가 필요합니다.");
  removeFieldSpawnEntry(runtime, despawnStep.spawnId);
  expect(runtime.entries).toEqual(otherEntries);
});

const testDirectory = dirname(fileURLToPath(import.meta.url));
const seededCases: (Omit<CorpusCase, "seed"> & { seed?: Command })[] = JSON.parse(readFileSync(
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
    if (entry.refusalMessage) expect(apply).toThrow(entry.refusalMessage);
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
