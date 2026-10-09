import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import {
  createHorrorPhase3Fixture,
  HORROR_FLAG_SWITCH,
  HORROR_TRUE_ENDING,
} from "./fixtures/horrorPhase3Fixture";

type SceneToolData = {
  ok: boolean;
  failureReason?: string;
  finalState: {
    x: number;
    y: number;
    gameOver: boolean;
    endingsReached: readonly string[];
  };
};

describe("Phase 3 horror skeleton scene fixture", () => {
  it("트랩을 밟으면 gameOver가 되고 체크포인트 리트라이로 시작 위치를 복원한다", () => {
    const project = createHorrorPhase3Fixture();
    const result = runTool(
      { project },
      "run_scene_test",
      {
        mapId: project.startMapId,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "move", dir: "right" },
          { kind: "expect", gameOver: true },
          { kind: "retryCheckpoint" },
          { kind: "expect", gameOver: false, playerAt: { x: 2, y: 2, mapId: project.startMapId } },
        ],
      }
    );

    expect(result.ok, result.summary).toBe(true);
    const data = result.data as SceneToolData;
    expect(data.ok, data.failureReason ?? JSON.stringify(data.finalState)).toBe(true);
    expect(data.finalState).toMatchObject({
      x: 2,
      y: 2,
      gameOver: false,
    });
  });

  it("조건 분기 엔딩이 priority 선택 후 endingReached 기대값을 만족한다", () => {
    const project = createHorrorPhase3Fixture();
    const result = runTool(
      { project },
      "run_scene_test",
      {
        mapId: project.startMapId,
        start: { x: 2, y: 2 },
        steps: [
          { kind: "interact" },
          { kind: "expect", switchOn: HORROR_FLAG_SWITCH, endingReached: HORROR_TRUE_ENDING },
        ],
      }
    );

    expect(result.ok, result.summary).toBe(true);
    const data = result.data as SceneToolData;
    expect(data.ok, data.failureReason ?? JSON.stringify(data.finalState)).toBe(true);
    expect(data.finalState.endingsReached).toEqual([HORROR_TRUE_ENDING]);
  });
});
