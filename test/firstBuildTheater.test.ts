import { describe, expect, it } from "vitest";
import { briefContentKey, deriveFirstBuildViewModel, shouldRearmFirstBuild } from "@/editor/panels/firstBuildTheater";
import { firstRunBrief } from "@/start/firstRun/firstRunBrief";
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

    // 첫 빌드가 끝난 뒤의 일반 팀 실행은 첫 빌드 집중 뷰로 되돌리지 않는다.
    expect(deriveFirstBuildViewModel({
      tracked: true,
      generationPending: false,
      completed: true,
      title: "새 게임",
      board: baseBoard({ phase: "실행 중" }),
    })).toMatchObject({ phase: "ready", stepIndex: 4 });
  });

  it("중단·실패 뒤 generationPending 이 유지되거나 복구되어도 사용자가 닫은 기획은 building 으로 되돌리지 않고 새 기획에만 재진입한다", () => {
    const base = firstRunBrief("안개 낀 항구 도시에서 시작하는 모험");
    const firstKey = briefContentKey({ ...base, generationPending: true });
    const restoredSameKey = briefContentKey({ ...base, generationPending: false });
    const newBriefKey = briefContentKey({
      ...firstRunBrief("사막 오아시스 성채에서 왕의 반지를 찾는 새 모험"),
      generationPending: true,
    });

    // generationPending 플래그 여부와 무관하게 같은 기획 키로 비교된다.
    expect(firstKey).toBe(restoredSameKey);
    // 사용자가 실패/중단 화면에서 닫은 뒤 같은 기획의 generationPending 이 유지·복구돼도 재진입하지 않는다.
    expect(shouldRearmFirstBuild({
      pending: true,
      tracked: false,
      dismissed: true,
      briefKey: firstKey,
      dismissedBriefKey: firstKey,
    })).toBe(false);
    // 새 기획으로 바뀌면 다시 첫 빌드 집중 뷰로 진입한다.
    expect(shouldRearmFirstBuild({
      pending: true,
      tracked: false,
      dismissed: true,
      briefKey: newBriefKey,
      dismissedBriefKey: firstKey,
    })).toBe(true);
    // 닫지 않은 초기 상태에서 pending 이 올라오면 정상 진입한다.
    expect(shouldRearmFirstBuild({
      pending: true,
      tracked: false,
      dismissed: false,
      briefKey: firstKey,
      dismissedBriefKey: null,
    })).toBe(true);
  });
});
