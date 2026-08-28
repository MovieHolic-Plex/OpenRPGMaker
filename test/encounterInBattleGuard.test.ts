import { describe, expect, it } from "vitest";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";

type BattleOutcome = "victory" | "defeat" | "escape";

// encounterRate 1000 이면 첫 스텝의 누적값이 임계(1000)에 정확히 닿아 RNG 없이 발동한다.
// 세션 RNG에 의존하지 않으므로 이 스위트는 시드와 무관하게 결정적이다.
function makeEncounterMap(): GameMap {
  return {
    id: "map_field",
    name: "field",
    encounterRate: 1000,
    troopIds: ["troop_a"],
  } as unknown as GameMap;
}

interface FakeSceneHandle {
  readonly scene: PlaySceneContext;
  readonly battleCalls: string[];
  readonly inputCalls: boolean[];
  finishBattle(result: BattleOutcome): void;
  /** setInputEnabled(true) 로 입력이 복구될 때 resolve — 고정 대기 없이 정확한 상태 변화를 기다린다. */
  readonly inputRestored: Promise<void>;
}

function makeSceneInBattleProbe(map: GameMap): FakeSceneHandle {
  const battleCalls: string[] = [];
  const inputCalls: boolean[] = [];
  let settleBattle: ((result: BattleOutcome) => void) | undefined;
  let signalRestored: (() => void) | undefined;
  const inputRestored = new Promise<void>((resolve) => {
    signalRestored = resolve;
  });

  const scene = {
    running: false,
    inputEnabled: true,
    lastActionTargetKey: "",
    map,
    tileX: 3,
    tileY: 4,
    session: { partyActorIds: [], switches: {}, variables: {} },
    playBattle: (step: { kind: string }): Promise<BattleOutcome> => {
      battleCalls.push(step.kind);
      return new Promise<BattleOutcome>((resolve) => {
        settleBattle = resolve;
      });
    },
    setInputEnabled: (enabled: boolean): void => {
      inputCalls.push(enabled);
      scene.inputEnabled = enabled;
      if (enabled) signalRestored?.();
    },
    refreshRuntimeSurfaces: (): void => {},
  } as unknown as PlaySceneContext & { inputEnabled: boolean };

  return {
    scene,
    battleCalls,
    inputCalls,
    finishBattle: (result) => {
      if (!settleBattle) throw new Error("전투가 시작되지 않았다");
      settleBattle(result);
    },
    inputRestored,
  };
}

describe("전투 중 랜덤 인카운터 재진입 가드", () => {
  it("전투가 진행되는 동안 걸음이 더 발생해도 두 번째 인카운터가 터지지 않는다", () => {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: false };
    const probe = makeSceneInBattleProbe(makeEncounterMap());

    resetEncounterCounter();
    maybeTriggerRandomEncounter(probe.scene);
    for (let step = 0; step < 5; step += 1) maybeTriggerRandomEncounter(probe.scene);

    expect(probe.battleCalls).toEqual(["battleProcessing"]);
  });

  it("인카운터 전투가 시작되면 맵 로직과 입력이 잠긴다", () => {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: false };
    const probe = makeSceneInBattleProbe(makeEncounterMap());

    resetEncounterCounter();
    maybeTriggerRandomEncounter(probe.scene);

    expect(probe.scene.running).toBe(true);
    expect(probe.inputCalls).toEqual([false]);
  });

  it("전투가 끝나면 맵 입력과 인카운터가 정상 복구된다", async () => {
    const project = store.getCurrent();
    project.system.actionCombat = { enabled: false };
    const probe = makeSceneInBattleProbe(makeEncounterMap());

    resetEncounterCounter();
    maybeTriggerRandomEncounter(probe.scene);
    expect(probe.battleCalls).toHaveLength(1);

    probe.finishBattle("victory");
    await probe.inputRestored;

    expect(probe.scene.running).toBe(false);
    expect(probe.inputCalls).toEqual([false, true]);

    maybeTriggerRandomEncounter(probe.scene);
    expect(probe.battleCalls).toEqual(["battleProcessing", "battleProcessing"]);
  });
});
