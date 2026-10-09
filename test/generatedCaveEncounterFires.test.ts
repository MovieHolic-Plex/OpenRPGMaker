// 도그푸딩 「등대지기의 겨울」: 얼어붙은 해안 동굴(인카운터 표 2개·조우율 25)에서 30걸음을 오갔는데
// 전투가 한 번도 나지 않았다고 보고됐다. 생성된 모양 그대로(조건 `{}` 인 표 항목, encounterRate 25)
// 런타임 조우 판정이 30걸음 안에 발동하는지 여러 시드로 못박는다. 당시 재현은 다른 맵으로
// __oprnDebug.teleport 한 뒤라 화면·입력이 옛 맵에 묶여 있었다(PR #1219 로 고침).
import { describe, expect, it } from "vitest";
import { maybeTriggerRandomEncounter, resetEncounterCounter } from "@/player/playSceneMovement";
import { store } from "@/project/store";
import { reseedSessionRng, startSession } from "@/project/session";
import type { GameMap } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";

function caveLike(): GameMap {
  const project = store.getCurrent();
  const base = project.maps[project.startMapId]!;
  return {
    ...base,
    id: "map_ice_cave",
    encounterRate: 25,
    encounterTable: [
      { troopId: project.database.troops[0]!.id, weight: 50, conditions: {} },
      { troopId: project.database.troops[1]!.id, weight: 50, conditions: {} },
    ],
  } as GameMap;
}

function stepsUntilEncounter(seed: number, maxSteps: number): number | null {
  const project = store.getCurrent();
  project.system.actionCombat = { enabled: false };
  const session = startSession(project);
  reseedSessionRng(session, seed);
  const battles: string[] = [];
  const scene = {
    running: false,
    inputEnabled: true,
    map: caveLike(),
    tileX: 3,
    tileY: 3,
    session,
    playBattle: (step: { troopId: string }) => { battles.push(step.troopId); return new Promise(() => {}); },
    setInputEnabled: () => {},
    refreshRuntimeSurfaces: () => {},
  } as unknown as PlaySceneContext;
  resetEncounterCounter();
  for (let step = 1; step <= maxSteps; step += 1) {
    maybeTriggerRandomEncounter(scene);
    if (battles.length > 0) return step;
  }
  return null;
}

describe("generated cave encounter table", () => {
  it("fires within 30 steps for every seed", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const steps = stepsUntilEncounter(seed, 30);
      expect(steps, `seed ${seed}`).not.toBeNull();
    }
  });
});
