import { describe, expect, it } from "vitest";
import { createBattleRuntime } from "@/battle/runtime";
import { createBlankProject } from "@/project/defaults";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { activeDifficultyId, difficultyRate, normalizeDifficulties } from "@/project/difficulty";
import { evalCondition, startSession } from "@/project/session";
import { deserialize, serialize } from "@/project/io";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot } from "@/player/saveSlots";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import type { Command, GameMap, Project } from "@/project/types";

function difficultyProject(): Project {
  const project = createBlankProject();
  project.system.difficulties = [
    { id: "easy", name: "쉬움", enemyHpRate: 0.5, expRate: 2, goldRate: 3 },
    { id: "hard", name: "어려움", enemyHpRate: 2, enemyAttackRate: 1.5, encounterRate: 2 },
  ];
  project.system.defaultDifficultyId = "hard";
  return project;
}

function runAll(commands: Command[], project: Project, session = startSession(project, 1)) {
  const interpreter = createInterpreter(commands, session, project);
  let step = interpreter.start();
  while (step.kind !== "done") step = interpreter.resume();
  return session;
}

function slimeBattle(project: Project, difficultyId: string | undefined) {
  const slime = project.database.enemies.find((record) => record.id === "enemy_slime")!;
  slime.stats = { ...slime.stats, maxHp: 2 };
  return createBattleRuntime({
    project,
    troopId: "troop_slime",
    canEscape: true,
    canLose: true,
    battleFlow: "strict",
    sessionState: { switches: {}, variables: {}, inventory: {}, ...(difficultyId ? { difficultyId } : {}) },
  });
}

function winBattle(runtime: ReturnType<typeof createBattleRuntime>): void {
  for (let i = 0; i < 200 && !runtime.snapshot().result; i += 1) {
    if (runtime.snapshot().phase === "actorCommand") runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
    runtime.tick(1_000);
  }
}

describe("difficulty modes (#19)", () => {
  it("seeds new sessions with the authored default difficulty and legacy projects with none", () => {
    expect(startSession(difficultyProject(), 1).difficultyId).toBe("hard");
    expect(startSession(createBlankProject(), 1).difficultyId).toBeUndefined();
  });

  it("scales enemy HP/attack by the active difficulty and leaves the default untouched", () => {
    const base = slimeBattle(difficultyProject(), undefined).snapshot().enemies[0]!;
    // 세션 난이도 없음 → 기본 난이도(hard) 배율.
    const hard = slimeBattle(difficultyProject(), "hard").snapshot().enemies[0]!;
    const easy = slimeBattle(difficultyProject(), "easy").snapshot().enemies[0]!;
    const legacy = slimeBattle(createBlankProject(), undefined).snapshot().enemies[0]!;
    expect(legacy.maxHp).toBe(2);
    expect(hard.maxHp).toBe(4);
    expect(base.maxHp).toBe(4);
    expect(easy.maxHp).toBe(1);
    expect(hard.effectiveStats?.attack ?? 0).toBeGreaterThan(legacy.effectiveStats?.attack ?? 0);
  });

  it("multiplies victory exp and gold by the difficulty rates", () => {
    const legacyProject = createBlankProject();
    const legacy = slimeBattle(legacyProject, undefined);
    winBattle(legacy);
    const easy = slimeBattle(difficultyProject(), "easy");
    winBattle(easy);
    expect(legacy.snapshot().result).toBe("victory");
    expect(easy.snapshot().result).toBe("victory");
    expect(easy.snapshot().rewards.exp).toBe(legacy.snapshot().rewards.exp * 2);
    expect(easy.snapshot().rewards.gold).toBe(legacy.snapshot().rewards.gold * 3);
  });

  it("setDifficulty changes the session difficulty and the difficulty condition reads it", () => {
    const project = difficultyProject();
    const session = runAll([{ kind: "setDifficulty", difficultyId: "easy" }], project);
    expect(session.difficultyId).toBe("easy");
    expect(evalCondition(session, { kind: "difficulty", difficultyId: "easy" })).toBe(true);
    expect(evalCondition(session, { kind: "difficulty", difficultyId: "hard" })).toBe(false);
    // 없는 id 는 무시한다.
    runAll([{ kind: "setDifficulty", difficultyId: "nope" }], project, session);
    expect(session.difficultyId).toBe("easy");
  });

  it("scales the random-encounter accumulator by encounterRate", () => {
    // 세션 시드 1 의 첫 인카운트 난수는 0.789 — 누적 500 은 발동하지 않고, ×2(hard) = 1000 은 반드시 발동한다.
    const encounterCalls = (difficultyId: string | undefined): string[] => {
      const project = difficultyProject();
      project.system.actionCombat = { enabled: false };
      const map = project.maps[project.startMapId]!;
      map.encounterRate = 500;
      map.troopIds = ["troop_slime"];
      map.encounterTable = undefined;
      store.replaceProject(project);
      const calls: string[] = [];
      const session = startSession(project, 1);
      if (difficultyId) session.difficultyId = difficultyId;
      const scene = {
        running: false,
        inputEnabled: true,
        map: store.getCurrent().maps[project.startMapId] as GameMap,
        tileX: project.startPos.x,
        tileY: project.startPos.y,
        session,
        playBattle: async () => { calls.push("battle"); return "escape" as const; },
        setInputEnabled: (enabled: boolean) => { scene.inputEnabled = enabled; },
      } as unknown as PlaySceneContext & { inputEnabled: boolean };
      resetEncounterCounter();
      maybeTriggerRandomEncounter(scene);
      return calls;
    };
    expect(encounterCalls("easy")).toEqual([]);
    expect(encounterCalls("hard")).toEqual(["battle"]);
  });

  it("survives normalize, project shape validation and save/load", () => {
    const project = difficultyProject();
    const normalized = normalizeSystemRecords(project.system);
    expect(normalized.difficulties?.map((row) => row.id)).toEqual(["easy", "hard"]);
    expect(normalized.defaultDifficultyId).toBe("hard");
    expect(normalizeSystemRecords(createBlankProject().system).difficulties).toBeUndefined();
    const reloaded = deserialize(serialize(project));
    expect(reloaded.system.difficulties?.map((row) => row.id)).toEqual(["easy", "hard"]);
    expect(reloaded.system.defaultDifficultyId).toBe("hard");

    const session = startSession(project, 1);
    session.difficultyId = "easy";
    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.difficultyId).toBe("easy");
  });

  it("normalizes rates, drops blank ids and falls back when the session difficulty was deleted", () => {
    const rows = normalizeDifficulties([
      { id: " a ", name: "", enemyHpRate: 99, expRate: 1 },
      { id: "", name: "빈 id" },
      { id: "a", name: "중복" },
    ]);
    expect(rows).toEqual([{ id: "a", name: "a", enemyHpRate: 10 }]);
    const system = { difficulties: rows, defaultDifficultyId: undefined };
    expect(activeDifficultyId(system, { difficultyId: "deleted" })).toBe("a");
    expect(difficultyRate(system, { difficultyId: "deleted" }, "enemyHpRate")).toBe(10);
  });
});
