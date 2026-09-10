// /loop 반복 실행 계약. 실제 워커·모델 없이 클라이언트만 바꿔 끼워 회차 진행·조기 종료·
// 요청 필드(readOnly·timeoutMs) 전달을 고정한다. 브라우저 표면은 e2e 캡처가 따로 본다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requests: [] as Record<string, unknown>[],
  results: [] as { project: unknown; toolCalls?: number }[],
  bubbles: [] as string[],
  applied: [] as { summary: string }[],
  project: { maps: { map_a: { id: "map_a", name: "A", width: 4, height: 4 } } } as unknown,
  piApply: "auto" as "auto" | "review",
}));

vi.mock("@/ai/piAgent/client", () => ({
  runPiAgentViaCompanion: async (request: Record<string, unknown>, options?: { onEvent?: (event: unknown) => void }) => {
    h.requests.push(request);
    const next = h.results.shift() ?? { project: request.project };
    const stats = { ms: 1, turns: 1, toolCalls: next.toolCalls ?? 1, toolErrors: 0 };
    options?.onEvent?.({ type: "start", provider: "p", model: "m", toolCount: 1 });
    options?.onEvent?.({ type: "tool_start", id: "t1", name: "paint", args: {} });
    options?.onEvent?.({ type: "tool_end", id: "t1", name: "paint", ok: true, summary: "칠함" });
    options?.onEvent?.({ type: "assistant", text: "했습니다" });
    const done = { type: "done", project: next.project, stats, changedKeys: [] };
    options?.onEvent?.(done);
    return done;
  },
}));
vi.mock("@/editor/panels/aiTeamBoard", () => ({
  createTeamBoard: () => ({ root: { nodeType: 1 } as unknown as HTMLElement, update: () => {}, setReview: () => {} }),
}));
vi.mock("@/editor/panels/aiChangePreview", () => ({ changePreviewChips: () => [] }));
vi.mock("@/ai/piAgent/teamActivity", () => ({ publishTeamActivity: () => {} }));
vi.mock("@/ai/piAgent/teamSpecStore", () => ({ loadTeamSpec: () => ({ version: 1, orchestratorNotes: "", members: [] }) }));
vi.mock("@/ai/piAgent/mapBundle", () => ({
  mergeMapBundles: (_base: unknown, bundles: { project: unknown }[]) => ({ project: bundles[0]!.project, spills: [], conflicts: [] }),
}));
vi.mock("@/project/authoredProjectBaseline", () => ({ AuthoredProjectBaseline: class {} }));
vi.mock("@/project/store", () => ({ store: { getCurrent: () => h.project } }));
vi.mock("@/ai/llmClient", () => ({ loadAiConfig: () => ({ providerId: "google-antigravity", model: "m", piApply: h.piApply }) }));
vi.mock("@/editor/tools/changeset", () => ({ summarizeChanges: () => ({}) }));
vi.mock("@/editor/tools/applyChangesetToStore", () => ({
  captureProposalBase: () => ({}),
  applyProposedProject: async (_project: unknown, options: { summary: string }) => {
    h.applied.push({ summary: options.summary });
    return { ok: true };
  },
}));

const { runPiCommand } = await import("@/editor/panels/aiPiAgentCommand");

const projectWith = (name: string) => ({ maps: { map_a: { id: "map_a", name, width: 4, height: 4 } } });

const surface = () => ({
  appendBubble: (role: string, text: string) => { h.bubbles.push(`${role}:${text}`); return null; },
  appendCard: () => {},
  setStatus: () => {},
  getCurrentMapId: () => "map_a",
});

describe("/loop 반복 실행", () => {
  beforeEach(() => {
    h.requests.length = 0; h.results.length = 0; h.bubbles.length = 0; h.applied.length = 0;
    h.project = projectWith("A");
    h.piApply = "auto";
  });

  it("요청한 횟수만큼 돌고 회차마다 앞 회차 결과를 기준으로 삼는다", async () => {
    const round1 = projectWith("첫 회차");
    const round2 = projectWith("둘째 회차");
    const round3 = projectWith("셋째 회차");
    h.results.push({ project: round1 }, { project: round2 }, { project: round3 });

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "마을을 다듬어라", loop: 3 }, surface());

    expect(h.requests).toHaveLength(3);
    expect(h.requests[0]!.task).toBe("마을을 다듬어라");
    expect(h.requests[1]!.task).toContain("(반복 2/3)");
    expect(h.requests[2]!.task).toContain("(반복 3/3)");
    // 회차 기준: 앞 회차가 돌려준 프로젝트가 다음 요청의 출발점이다.
    expect(h.requests[0]!.project).toBe(h.project);
    expect(h.requests[1]!.project).toBe(round1);
    expect(h.requests[2]!.project).toBe(round2);
    // 적용은 마지막 결과 하나로 한 번만.
    expect(h.applied).toHaveLength(1);
    expect(h.bubbles.some((line) => line.includes("반복 3/3"))).toBe(true);
  });

  it("계획 턴은 쓰기 없는 실행이고 계획 지시가 앞에 붙는다", async () => {
    h.results.push({ project: h.project });

    await runPiCommand(
      { mode: "single", mapIds: ["map_a"], task: "마을 셋", loop: 1 },
      surface(),
      { readOnly: true, planOnly: true, maxTurns: 6, thinkingLevel: "low" },
    );

    expect(h.requests[0]!).toMatchObject({ readOnly: true, maxTurns: 6, thinkingLevel: "low" });
    expect(h.requests[0]!.task).toContain("[계획 턴]");
    expect(h.requests[0]!.task).toContain("마을 셋");
    // 계획 턴은 아무것도 바뀌지 않는 게 정상이다 — 실패 문구가 아니라 안내가 나와야 한다.
    expect(h.bubbles.some((line) => line.includes("계획만 세웠습니다"))).toBe(true);
    expect(h.applied).toHaveLength(0);
  });

  it("바뀐 것이 없는 회차에서 멈춘다", async () => {
    const round1 = projectWith("첫 회차");
    h.results.push({ project: round1 }, { project: round1 });

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "다듬어라", loop: 5 }, surface());

    expect(h.requests).toHaveLength(2);
    expect(h.bubbles.some((line) => line.includes("2번째 반복에서 바뀐 것이 없어"))).toBe(true);
    expect(h.applied).toHaveLength(1);
  });

  it("아무 회차도 바꾸지 않으면 적용하지 않는다", async () => {
    h.results.push({ project: h.project });

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "다듬어라", loop: 3 }, surface());

    expect(h.requests).toHaveLength(1);
    expect(h.applied).toHaveLength(0);
    expect(h.bubbles.some((line) => line.includes("바뀐 것이 없습니다"))).toBe(true);
  });

  it("읽기 전용·시간 상한은 매 요청에 실린다", async () => {
    h.results.push({ project: projectWith("읽기") });

    await runPiCommand(
      { mode: "single", mapIds: ["map_a"], task: "이 맵에 뭐가 있나", loop: 1, timeoutMs: 1_800_000 },
      surface(),
      { readOnly: true },
    );

    expect(h.requests[0]!.readOnly).toBe(true);
    expect(h.requests[0]!.timeoutMs).toBe(1_800_000);
  });
});
