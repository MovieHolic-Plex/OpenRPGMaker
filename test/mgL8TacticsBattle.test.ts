/** @vitest-environment happy-dom */
// 전술(격자) 전투 tacticsBattle: 규칙 상태기계 · 키보드 오버레이 · 프로젝트 유닛 · 결과 분기.
import { describe, expect, it, vi } from "vitest";
import {
  adjacentFoes,
  createTacticsState,
  partyTacticsSeeds,
  reachableTiles,
  runEnemyTurn,
  tacticsAttack,
  tacticsDamage,
  tacticsMove,
  tacticsWait,
  troopTacticsSeeds,
  writeTacticsVitals,
  type TacticsUnitSeed,
} from "@/player/tacticsBattle";
import { mountTacticsBattle } from "@/player/tacticsBattleOverlay";
import { createBlankProject } from "@/project/defaults";
import { normalizeEnemyRecord } from "@/project/databaseEnemyTroopRecordModel";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { isInputCapturingSurfaceActive } from "@/player/keyBindings";

const seed = (name: string, stats: Partial<TacticsUnitSeed> = {}): TacticsUnitSeed => ({
  sourceId: name, name, hp: 10, maxHp: 10, attack: 5, defense: 0, move: 3, ...stats,
});

describe("격자 규칙", () => {
  it("파티는 왼쪽 열, 적은 오른쪽 열에 선다", () => {
    const state = createTacticsState([seed("a"), seed("b")], [seed("x")], { width: 6, height: 4 });
    expect(state.units.map((u) => [u.id, u.x, u.y])).toEqual([["party:0", 0, 0], ["party:1", 0, 1], ["enemy:0", 5, 0]]);
    expect(state.turn).toBe("party");
  });

  it("이동 범위는 맨해튼 이동력 안이고 유닛 칸은 막는다", () => {
    const state = createTacticsState([seed("a", { move: 2 }), seed("b")], [seed("x")], { width: 6, height: 4 });
    const a = state.units[0]!;
    const tiles = reachableTiles(state, a).map((t) => `${t.x},${t.y}`);
    expect(tiles).toContain("2,0");
    expect(tiles).toContain("1,1");
    expect(tiles).not.toContain("0,1"); // b 가 서 있다
    expect(tiles).not.toContain("3,0"); // 3칸
    expect(tacticsMove(state, a.id, 3, 0)).toBe(false);
    expect(tacticsMove(state, a.id, 2, 0)).toBe(true);
    // 한 번 움직였으면 다시는 못 움직인다.
    expect(tacticsMove(state, a.id, 2, 1)).toBe(false);
  });

  it("인접한 적만 공격할 수 있고 피해는 공격-방어/2(최소 1)", () => {
    expect(tacticsDamage({ attack: 5 }, { defense: 4 })).toBe(3);
    expect(tacticsDamage({ attack: 1 }, { defense: 10 })).toBe(1);
    const state = createTacticsState([seed("a", { move: 4 })], [seed("x", { hp: 4 })], { width: 5, height: 2 });
    const a = state.units[0]!;
    const x = state.units[1]!;
    expect(tacticsAttack(state, a.id, x.id)).toBeUndefined();
    tacticsMove(state, a.id, 3, 0);
    expect(adjacentFoes(state, a).map((u) => u.id)).toEqual([x.id]);
    expect(tacticsAttack(state, a.id, x.id)).toBe(5);
    expect(x.hp).toBe(0);
    expect(state.result).toBe("victory");
  });

  it("아군이 모두 행동하면 적 차례, 적 AI 는 다가와 친다, 다음 라운드는 아군 차례", () => {
    const state = createTacticsState([seed("a", { hp: 20, maxHp: 20 })], [seed("x", { move: 3, attack: 7 })], { width: 5, height: 1 });
    const a = state.units[0]!;
    expect(tacticsWait(state, a.id)).toBe(true);
    expect(state.turn).toBe("enemy");
    runEnemyTurn(state);
    const x = state.units[1]!;
    expect(x.x).toBe(1);
    expect(a.hp).toBe(13);
    expect(state.turn).toBe("party");
    expect(state.round).toBe(2);
    expect(a.acted).toBe(false);
  });

  it("파티가 전멸하면 패배", () => {
    const state = createTacticsState([seed("a", { hp: 3 })], [seed("x", { attack: 9, move: 5 })], { width: 4, height: 1 });
    tacticsWait(state, state.units[0]!.id);
    runEnemyTurn(state);
    expect(state.result).toBe("defeat");
  });
});

describe("키보드 오버레이", () => {
  it("방향키·결정으로 고르고 이동하고 공격해 이기면 onEnd(victory) 한 번", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const state = createTacticsState([seed("a", { attack: 99 })], [seed("x")], { width: 4, height: 1 });
    const onEnd = vi.fn();
    const controller = mountTacticsBattle(host, state, onEnd);
    expect(isInputCapturingSurfaceActive(host)).toBe(true);
    const press = (key: string) => window.dispatchEvent(new KeyboardEvent("keydown", { key, cancelable: true }));
    press("z"); // a 고르기
    expect(controller.root.dataset.phase).toBe("move");
    press("ArrowRight");
    press("ArrowRight");
    press("z"); // (2,0) 으로 이동
    expect(state.units[0]!.x).toBe(2);
    expect(controller.root.dataset.phase).toBe("target");
    press("ArrowRight");
    press("Enter"); // x 공격
    expect(state.result).toBe("victory");
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith("victory");
    press("z");
    expect(onEnd).toHaveBeenCalledTimes(1);
    controller.destroy();
    expect(host.querySelector("[data-testid='tactics-battle']")).toBeNull();
  });

  it("취소는 선택을 되돌리고, 제자리 결정은 대기로 적 차례를 넘긴다", () => {
    const host = document.createElement("div");
    const state = createTacticsState([seed("a", { hp: 50, maxHp: 50 })], [seed("x", { move: 1 })], { width: 6, height: 1 });
    const controller = mountTacticsBattle(host, state, vi.fn());
    controller.press("z");
    controller.press("x");
    expect(controller.root.dataset.phase).toBe("select");
    controller.press("z"); // 고르기
    controller.press("z"); // 제자리 = 이동 없음 → 공격 단계
    controller.press("z"); // 제자리 = 대기
    // 적 차례가 자동으로 돌고 다시 아군 차례
    expect(state.units[1]!.x).toBe(4);
    expect(state.turn).toBe("party");
    expect(host.querySelector("[data-testid='tactics-status']")?.textContent).toContain("2턴");
    controller.destroy();
  });
});

describe("프로젝트 → 유닛 · 세션 되쓰기 · 저장 왕복", () => {
  it("파티 HP·능력치와 트룹 적을 유닛으로 만들고 끝난 HP 를 세션에 되돌린다", () => {
    const project = createBlankProject();
    project.database.enemies.push(normalizeEnemyRecord({
      id: "slime", name: "슬라임", stats: { maxHp: 12, maxMp: 0, attack: 4, defense: 1, mind: 0, agility: 1 },
      rewards: { exp: 0, gold: 0, dropRatePercent: 0 },
    }));
    project.database.troops.push({ id: "t", name: "T", enemyIds: ["slime", "slime"], autoAlign: true, battleEventPages: [] });
    const session = startSession(project);
    const party = partyTacticsSeeds(project, session);
    expect(party.length).toBe(session.partyActorIds.length);
    expect(party[0]!.hp).toBeGreaterThan(0);
    const foes = troopTacticsSeeds(project, "t");
    expect(foes.map((f) => [f.name, f.hp, f.attack])).toEqual([["슬라임", 12, 4], ["슬라임", 12, 4]]);
    expect(troopTacticsSeeds(project, "missing")).toEqual([]);
    const state = createTacticsState(party, foes);
    state.units[0]!.hp = 1;
    writeTacticsVitals(project, session, state);
    expect(session.actorVitals[session.partyActorIds[0]!]!.hp).toBe(1);
  });

  it("tacticsBattle 명령과 옆보기·동료 필드가 저장/불러오기에서 살아남는다", () => {
    const project = createBlankProject();
    project.database.troops.push({ id: "t", name: "T", enemyIds: [], autoAlign: true, battleEventPages: [] });
    const map = project.maps[project.startMapId]!;
    map.sideView = true;
    map.sideViewJumpTiles = 3;
    project.system.actionCombat = { enabled: true, allies: true };
    map.events.push({
      id: "ev_tactics", x: 1, y: 1, trigger: { kind: "action" },
      commands: [{ kind: "tacticsBattle", troopId: "t", width: 7, canLose: true, victoryBranch: [{ kind: "setFlag", flag: "won", value: true }], defeatBranch: [] }],
    });
    const restored = deserialize(serialize(project));
    const restoredMap = restored.maps[restored.startMapId]!;
    expect(restoredMap.sideView).toBe(true);
    expect(restoredMap.sideViewJumpTiles).toBe(3);
    expect(restored.system.actionCombat?.allies).toBe(true);
    expect(restoredMap.events.find((e) => e.id === "ev_tactics")?.commands[0]).toMatchObject({ kind: "tacticsBattle", troopId: "t", width: 7, canLose: true });
  });
});
