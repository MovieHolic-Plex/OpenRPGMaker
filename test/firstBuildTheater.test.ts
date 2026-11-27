import { describe, expect, it } from "vitest";
import { deriveFirstBuildViewModel } from "@/editor/panels/firstBuildTheater";
import type { TeamBoardState } from "@/ai/piAgent/teamBoardState";

describe("편집기 첫 빌드 집중 뷰 상태 유도", () => {
  const baseBoard = (overrides: Partial<TeamBoardState>): TeamBoardState => ({
    mode: "team",
    task: "첫 구간 제작",
    phase: "실행 중",
    agents: [],
    report: null,
    error: null,
    applied: null,
    changedKeys: [],
    reviewChips: [],
    ...overrides,
  });

  it("대기 중이 아니면 idle 을 돌려준다", () => {
    expect(deriveFirstBuildViewModel({ tracked: false, generationPending: false, board: null, title: "새 게임" }).phase).toBe("idle");
  });

  it("도구 활동에 따라 4단계 마일스톤(0→1→2→3→ready)이 이산적으로 진행된다", () => {
    expect(deriveFirstBuildViewModel({ tracked: true, generationPending: true, board: null, title: "새 게임" })).toMatchObject({
      phase: "building",
      stepIndex: 0,
    });
    expect(deriveFirstBuildViewModel({
      tracked: true,
      generationPending: true,
      title: "새 게임",
      board: baseBoard({
        agents: [{
          agentId: "b1", role: "builder", roleLabel: "시공", kindLabel: "시공", memberId: null, fixOf: null,
          mapId: "m1", mapName: "마을", task: "", state: "실행 중", turns: 1, toolCalls: 2, toolErrors: 0,
          lastLine: "맵을 짓는 중", lastKind: "text", summary: "", changedKeys: ["maps"], spills: [], conflicts: [],
          log: [{ kind: "tool", id: "1", name: "create_map", ok: true, summary: "마을 생성" }], droppedLog: 0,
        }],
      }),
    })).toMatchObject({ phase: "building", stepIndex: 1 });

    expect(deriveFirstBuildViewModel({
      tracked: true,
      generationPending: true,
      title: "새 게임",
      board: baseBoard({ changedKeys: ["maps", "events"] }),
    })).toMatchObject({ phase: "building", stepIndex: 2 });

    expect(deriveFirstBuildViewModel({
      tracked: true,
      generationPending: true,
      title: "새 게임",
      board: baseBoard({ phase: "적용 중" }),
    })).toMatchObject({ phase: "building", stepIndex: 3 });

    expect(deriveFirstBuildViewModel({
      tracked: true,
      generationPending: false,
      title: "새 게임",
      board: baseBoard({ phase: "적용됨" }),
    })).toMatchObject({ phase: "ready", stepIndex: 4 });
  });
});
