import { describe, expect, it } from "vitest";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";

function makeMap(actionCombat: boolean): GameMap {
  return {
    id: actionCombat ? "map_action" : "map_normal",
    name: "t",
    encounterRate: 1000,
    troopIds: ["troop_a"],
    actionCombat,
  } as unknown as GameMap;
}

function makeScene(map: GameMap, playBattleCalls: string[]): PlaySceneContext {
  return {
    running: false,
    map,
    tileX: 0,
    tileY: 0,
    session: { partyActorIds: [], switches: {}, variables: {} },
    playBattle: (cmd: { kind: string }) => {
      playBattleCalls.push(cmd.kind);
    },
  } as unknown as PlaySceneContext;
}

describe("랜덤 인카운트 액션 전투 가드", () => {
  it("액션 전투 맵에서는 walk 스텝이 playBattle 을 부르지 않는다", () => {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: true };
    const calls: string[] = [];
    const scene = makeScene(makeMap(true), calls);

    resetEncounterCounter();
    for (let i = 0; i < 5; i += 1) maybeTriggerRandomEncounter(scene);

    expect(calls).toEqual([]);
  });

  it("같은 설정의 비(非)액션 맵에서는 playBattle 이 호출된다", () => {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: true };
    const calls: string[] = [];
    const scene = makeScene(makeMap(false), calls);

    resetEncounterCounter();
    maybeTriggerRandomEncounter(scene);

    expect(calls).toEqual(["battleProcessing"]);
  });

  it("액션 맵에서 쌓인 누적값이 리셋되어 맵을 나가자마자 전투가 터지지 않는다", () => {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: true };
    const calls: string[] = [];
    const actionScene = makeScene(makeMap(true), calls);
    const normalScene = makeScene({ ...makeMap(false), encounterRate: 10 } as unknown as GameMap, calls);

    resetEncounterCounter();
    // rate 1000 이면 한 스텝마다 누적이 임계를 채우지만, 액션 맵에선 발동 대신 리셋된다.
    for (let i = 0; i < 10; i += 1) maybeTriggerRandomEncounter(actionScene);
    expect(calls).toEqual([]);

    // 낮은 encounterRate 맵으로 나가면 오래된 누적값이 남아 즉시 발동하면 안 된다.
    maybeTriggerRandomEncounter(normalScene);
    expect(calls).toEqual([]);
  });
});
