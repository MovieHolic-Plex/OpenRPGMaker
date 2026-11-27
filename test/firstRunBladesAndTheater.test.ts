import { describe, expect, it } from "vitest";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import {
  BLADE_EVENTS,
  BLADE_HEROES,
  BLADE_PLACES,
  FIRST_RUN_BLADES,
  composeBladeSentence,
  findPlaceTilesetHint,
  rollKeywordSlots,
} from "@/start/firstRun/firstRunBlades";
import { firstRunBladeBrief } from "@/start/firstRun/firstRunBrief";
import { deriveFirstBuildViewModel } from "@/editor/panels/firstBuildTheater";
import type { TeamBoardState } from "@/ai/piAgent/teamBoardState";

describe("첫 실행 사선 블레이드 · 3키워드 자유 조합", () => {
  it("5개 블레이드는 원작 게임 이름을 포함하지 않는다", () => {
    expect(FIRST_RUN_BLADES).toHaveLength(5);
    const forbidden = /포켓몬|투더문|다크소울|아오오니|이브|드퀘|파판/u;
    for (const blade of FIRST_RUN_BLADES) {
      expect(`${blade.spine} ${blade.kicker} ${blade.title} ${blade.desc}`).not.toMatch(forbidden);
    }
  });

  it("잠긴 슬롯은 유지하고 풀린 슬롯만 다시 뽑는다", () => {
    const initial: [string, string, string] = [BLADE_PLACES[0]!.label, "직접 적은 주인공", BLADE_EVENTS[0]!];
    const next = rollKeywordSlots(initial, [false, true, false], () => 0.42);
    expect(next[1]).toBe("직접 적은 주인공");
    expect(next[0]).not.toBe(initial[0]);
    expect(next[2]).not.toBe(initial[2]);
    expect(BLADE_HEROES.length).toBeGreaterThanOrEqual(10);
  });

  it("3키워드 조합 기획은 normalizeGameDesignBrief 계약을 통과하고 선택한 presetId 를 보존한다", () => {
    const souls = FIRST_RUN_BLADES.find((b) => b.id === "souls")!;
    const place = BLADE_PLACES[10]!.label;
    const { brief, title, sentence } = firstRunBladeBrief({
      blade: souls,
      keywords: [place, "심야 편의점 알바생", "첫 체육관 배지 도전"],
      tilesetHint: findPlaceTilesetHint(place),
    });
    expect(brief.presetId).toBe("action-rpg");
    expect(title).toBe("첫 체육관 배지 도전");
    expect(sentence).toBe(composeBladeSentence(souls, [place, "심야 편의점 알바생", "첫 체육관 배지 도전"]));
    expect(brief.answers.detail.text).toContain("joseon_baram");
    expect(normalizeGameDesignBrief(brief)).toEqual(brief);
  });
});

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
