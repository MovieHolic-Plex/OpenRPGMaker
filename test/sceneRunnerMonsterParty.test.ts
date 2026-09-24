// 헤드리스 러너(run_scene_test·qa-game 자동 플레이)도 실제 플레이처럼 파티 몬스터로 싸운다.
// 2026-09-24 몬스터 수집 도그푸딩: 러너가 Lv1 영웅으로 싸워 야생에 져 거짓 게임 오버를 냈고,
// 실제 플레이는 스타터 없이 도로에 나가면 매 조우마다 「파티에 몬스터가 없습니다」 오류 창이 떴다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runSceneTest } from "@/testing/sceneTestRunner";
import type { GameEvent, Project } from "@/project/types";

function monsterProject(commands: GameEvent["pages"][number]["commands"]): Project {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  project.system.monsterBattleParty = true;
  project.system.battleParty = "monsters";
  const map = project.maps[project.startMapId]!;
  map.events.push({
    id: "ev_prof", name: "박사", x: project.startPos.x + 1, y: project.startPos.y,
    trigger: { kind: "action" }, commands: [],
    pages: [{ id: "p0", conditions: [], trigger: { kind: "action" }, graphic: { kind: "none" }, priority: "same", commands }],
  } as unknown as GameEvent);
  return project;
}

describe("scene runner monster party battles", () => {
  it("fights with the party monster, not the Lv1 hero", () => {
    const project = monsterProject([
      { kind: "giveMonster", speciesId: "species_leafling", level: 30 },
      { kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: true },
    ] as never);
    const result = runSceneTest(project, {
      mapId: project.startMapId, start: project.startPos,
      steps: [{ kind: "face", dir: "right" }, { kind: "interact", eventId: "ev_prof" }, { kind: "wait", ticks: 30 }],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log.some((line) => line.startsWith("battle troop_slime"))).toBe(true);
    const session = (result as unknown as { session: { monsterParty: string[]; monsterInstances: Record<string, { currentHp?: number }> } }).session;
    const monster = session.monsterInstances[session.monsterParty[0]!]!;
    // 싸운 것은 파티 몬스터다 — 전투 피해가 인스턴스 HP 에 되돌려 쓰인다(Lv30 리프링 최대 HP 62).
    expect(monster.currentHp).toBeLessThan(62);
  });

  it("does not roll wild encounters before the player has a partner", () => {
    const project = monsterProject([]);
    const map = project.maps[project.startMapId]!;
    map.encounterRate = 1000;
    map.encounterTable = [{ troopId: "troop_slime", weight: 1 }];
    const result = runSceneTest(project, {
      mapId: project.startMapId, start: project.startPos,
      steps: [{ kind: "move", dir: "down" }, { kind: "move", dir: "up" }, { kind: "move", dir: "down" }],
    });
    expect(result.log.some((line) => line.startsWith("random encounter"))).toBe(false);
    expect(result.finalState.gameOver).toBe(false);
  });
});

describe("scene runner gen1 battles", () => {
  it("uses the monster's damaging skill when gen1 refuses the plain attack", () => {
    const project = monsterProject([
      { kind: "giveMonster", speciesId: "species_leafling", level: 30 },
      { kind: "battleProcessing", troopId: "troop_slime", canEscape: false, canLose: true },
    ] as never);
    project.system.battleModel = "gen1";
    // 약한 슬라임 — 몬스터가 한 수라도 두면 이긴다. 공격만 고집하면(gen1 이 거부) 한 대도 못 친다.
    for (const enemy of project.database.enemies) if (enemy.id === "enemy_slime") (enemy as unknown as { stats: { maxHp: number } }).stats.maxHp = 5;
    const result = runSceneTest(project, {
      mapId: project.startMapId, start: project.startPos,
      steps: [{ kind: "face", dir: "right" }, { kind: "interact", eventId: "ev_prof" }, { kind: "wait", ticks: 30 }],
    });
    expect(result.ok, result.failureReason).toBe(true);
    expect(result.log, JSON.stringify(result.log)).toContain("battle troop_slime: victory");
  });
});
