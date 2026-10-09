// 전투 패배(canLose=false)는 RM2K3 규칙대로 게임 오버로 끝나야 한다.
//
// 실측 버그(2026-08-28): 출하 런타임의 두 전투 진입 경로가 패배를 버렸다.
//  - src/player/playSceneInterpreter.ts battleProcessing: 결과를 session.battleResult 에만
//    저장하고 이벤트를 그대로 이어 실행 — 파티 사망도, 게임 오버 화면도 없었다.
//  - src/player/playSceneMovement.ts 랜덤 인카운터: `void scene.playBattle(...)` 로 결과를
//    완전히 폐기 — 패배해도 아무 일도 일어나지 않았다.
// 헤드리스 하네스(src/testing/sceneTestRunner.ts, walkthroughRunner.ts)는 이미
// defeat + !canLose 를 파티 사망 + 게임 오버로 모델링하고 있어 출하물이 자기 하네스와 어긋났다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleResult } from "@/battle/runtime";
import { runCommands } from "@/player/playSceneInterpreter";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, GameMap } from "@/project/types";

const ENCOUNTER_TROOP_ID = "troop_encounter";

function battleScene(result: BattleResult) {
  const project = createBlankProject();
  project.database.troops = [
    { id: ENCOUNTER_TROOP_ID, name: "인카운터", members: [] },
    ...project.database.troops,
  ] as typeof project.database.troops;
  const session = startSession(project, 7);
  // 파티가 비어 있으면 "파티 사망" 단정이 공허해진다 — 픽스처 자체를 먼저 못 박는다.
  expect(session.partyActorIds.length).toBeGreaterThan(0);
  const gameOverMessages: string[] = [];
  const battleSteps: Array<{ readonly canLose: boolean }> = [];
  let finishBattle: (() => void) | undefined;
  const battleFinished = new Promise<void>(resolve => { finishBattle = resolve; });
  const dialogue = {
    showText: vi.fn(async () => undefined),
    showChoices: vi.fn(async () => 0),
    showNumberInput: vi.fn(async () => 0),
    hide: vi.fn(),
    close: vi.fn(),
  };
  const registry = new Map<string, unknown>([["dialogue", dialogue]]);
  const map = {
    id: session.currentMapId,
    name: "인카운터 맵",
    encounterRate: 1000,
    troopIds: [ENCOUNTER_TROOP_ID],
  } as unknown as GameMap;
  const scene = {
    session,
    running: false,
    inputEnabled: true,
    lastActionTargetKey: "",
    tileX: 0,
    tileY: 0,
    map,
    game: { registry: { get: (key: string) => registry.get(key) } },
    playBattle: async (step: { readonly canLose: boolean }) => {
      battleSteps.push({ canLose: step.canLose });
      return result;
    },
    showGameOverScreen: (message?: string) => gameOverMessages.push(message ?? ""),
    setInputEnabled: vi.fn((enabled: boolean) => { if (enabled) finishBattle?.(); }),
    refreshRuntimeSurfaces: vi.fn(),
    syncRuntimeState: vi.fn(),
    showRuntimeOverlay: vi.fn(),
    clearRuntimeOverlay: vi.fn(),
    registerPageMoveRoutes: vi.fn(),
    renderTiles: vi.fn(),
  } as unknown as PlaySceneContext;
  return { project, session, scene, gameOverMessages, battleSteps, battleFinished };
}

function partyIsDead(session: ReturnType<typeof startSession>): boolean {
  return session.partyActorIds.every((actorId) =>
    session.actorVitals[actorId]?.hp === 0 && (session.actorStateIds?.[actorId] ?? []).includes("state_death")
  );
}

describe("전투 패배 결말", () => {
  let previous = createBlankProject();

  beforeEach(() => {
    previous = store.getCurrent();
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    resetEncounterCounter();
  });

  afterEach(() => {
    store.replaceProject(previous);
    vi.unstubAllGlobals();
    resetEncounterCounter();
  });

  it("이벤트 전투(canLose=false) 패배는 파티를 죽이고 게임 오버를 띄우며 이벤트를 끝낸다", async () => {
    const { project, session, scene, gameOverMessages } = battleScene("defeat");
    store.replaceProject(project);
    const commands: Command[] = [
      { kind: "battleProcessing", troopId: ENCOUNTER_TROOP_ID, canEscape: true, canLose: false },
      { kind: "setSwitch", switchId: "after_battle", value: true },
    ];

    await runCommands(scene, commands);

    expect(session.battleResult).toBe("defeat");
    expect(gameOverMessages.length).toBe(1);
    expect(partyIsDead(session)).toBe(true);
    // 패배로 끝난 이벤트는 뒷 커맨드를 실행하지 않는다(죽은 파티로 시나리오가 이어지면 안 된다).
    expect(session.switches.after_battle).not.toBe(true);
  });

  it("canLose=true 패배는 게임 오버 없이 필드로 복귀하고 패배 분기를 실행한다", async () => {
    const { project, session, scene, gameOverMessages } = battleScene("defeat");
    store.replaceProject(project);
    const commands: Command[] = [
      {
        kind: "battleProcessing",
        troopId: ENCOUNTER_TROOP_ID,
        canEscape: true,
        canLose: true,
        branchOnResult: true,
        defeatBranch: [{ kind: "setSwitch", switchId: "lost_but_alive", value: true }],
      },
      { kind: "setSwitch", switchId: "after_battle", value: true },
    ];

    await runCommands(scene, commands);

    expect(session.battleResult).toBe("defeat");
    expect(gameOverMessages).toEqual([]);
    expect(partyIsDead(session)).toBe(false);
    expect(session.switches.lost_but_alive).toBe(true);
    expect(session.switches.after_battle).toBe(true);
  });

  it("cancelled event cleanup does not unlock a replacement battle in the same session", async () => {
    const { project, session, scene } = battleScene("defeat");
    store.replaceProject(project);
    const replacement = new AbortController();
    // This isolates the caller's ownership contract. Real runtime, DOM and
    // session cancellation are exercised in playSceneBattleCancellation.
    scene.playBattle = async () => { scene.battleAbortController = replacement; return null; };
    await runCommands(scene, [
      { kind: "battleProcessing", troopId: ENCOUNTER_TROOP_ID, canEscape: false, canLose: true },
      { kind: "setSwitch", switchId: "stale", value: true },
    ]);
    expect(scene.running).toBe(true);
    expect(scene.setInputEnabled).not.toHaveBeenCalledWith(true);
    expect(session.switches.stale).toBeUndefined();
    expect(session.battleResult).toBeUndefined();
  });

  it("랜덤 인카운터 패배도 파티 사망 + 게임 오버로 끝난다", async () => {
    const { project, session, scene, gameOverMessages, battleSteps, battleFinished } = battleScene("defeat");
    store.replaceProject(project);

    maybeTriggerRandomEncounter(scene);

    await battleFinished;
    expect(gameOverMessages.length).toBe(1);
    expect(battleSteps).toEqual([{ canLose: false }]);
    expect(session.battleResult).toBe("defeat");
    expect(partyIsDead(session)).toBe(true);
  });

  it("랜덤 인카운터 승리는 게임 오버 없이 결과만 세션에 남긴다", async () => {
    const { project, session, scene, gameOverMessages, battleFinished } = battleScene("victory");
    store.replaceProject(project);

    maybeTriggerRandomEncounter(scene);

    await battleFinished;
    expect(session.battleResult).toBe("victory");
    expect(gameOverMessages).toEqual([]);
    expect(partyIsDead(session)).toBe(false);
  });
});
