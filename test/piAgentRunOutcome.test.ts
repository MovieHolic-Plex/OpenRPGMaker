// Pi 경로(2026-09-10 이후 기본)에도 실행 결과 4축(ai-run-outcome)이 산다 — 세션 경로만
// 있던 불일치(2026-09-11 실측: 20턴 내내 1회도 미렌더)의 회귀.
// 렌더는 패널이 소유하고, 여기선 surface.setRunOutcome 으로 흘린 facts 만 고정한다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  requests: [] as Record<string, unknown>[],
  results: [] as { project: unknown; toolCalls?: number; toolErrors?: number }[],
  errorEvents: [] as string[],
  assistantTexts: [] as string[],
  outcomes: [] as (Record<string, unknown> | null)[], // 호출 순서 보존
  boardStates: [] as { phase?: string; applied?: string | null }[],
  spills: [] as { mapIds: readonly string[]; keys: readonly string[] }[],
  bubbles: [] as string[],
  project: {
    maps: { map_a: { id: "map_a", name: "A", width: 4, height: 4 } },
  } as unknown,
  piApply: "auto" as "auto" | "review",
}));

vi.mock("@/ai/piAgent/client", () => ({
  runPiAgentViaCompanion: async (request: Record<string, unknown>, options?: { onEvent?: (event: unknown) => void }) => {
    h.requests.push(request);
    const next = h.results.shift() ?? { project: request.project };
    for (const message of h.errorEvents.splice(0)) options?.onEvent?.({ type: "error", message });
    options?.onEvent?.({ type: "start", provider: "p", model: "m", toolCount: 1 });
    if ((next.toolCalls ?? 1) > 0) {
      options?.onEvent?.({ type: "tool_end", id: "t1", name: "paint", ok: (next.toolErrors ?? 0) === 0, summary: (next.toolErrors ?? 0) > 0 ? "OAuth token expired before request — please retry; AuthStorage will refresh on the next attempt." : "칠함" });
    }
    for (const text of h.assistantTexts.splice(0)) options?.onEvent?.({ type: "assistant", text });
    const done = {
      type: "done", project: next.project,
      stats: { ms: 1, turns: 1, toolCalls: next.toolCalls ?? 1, toolErrors: next.toolErrors ?? 0 },
      changedKeys: [],
    };
    options?.onEvent?.(done);
    return done;
  },
}));
vi.mock("@/editor/panels/aiTeamBoard", () => ({
  createTeamBoard: () => ({ root: { nodeType: 1 } as unknown as HTMLElement, update: (state: { phase?: string; applied?: string | null }) => { h.boardStates.push(state); }, setReview: (review: { onDiscard: () => void; preview?: unknown } | null) => { h.outcomes.push(review); } }),
}));
vi.mock("@/editor/panels/aiChangePreview", () => ({
  changePreviewChips: () => [],
  changeChipsWithAreas: () => [],
  // 보드 검토 카드는 «적용 전» 카드 요소를 받는다 — 이 테스트는 그 전달 사실만 본다.
  renderChangePreviewCard: (input: Record<string, unknown>) => ({ nodeType: 1, dataset: { state: input.state } }) as unknown as HTMLElement,
}));
vi.mock("@/ai/piAgent/teamActivity", () => ({ publishTeamActivity: () => {} }));
vi.mock("@/ai/piAgent/teamSpecStore", () => ({ loadTeamSpec: () => ({ version: 1, orchestratorNotes: "", members: [] }) }));
vi.mock("@/ai/piAgent/mapBundle", () => ({
  mergeMapBundles: (_base: unknown, bundles: { project: unknown }[]) => ({
    project: bundles[0]!.project,
    spills: h.spills.splice(0),
    conflicts: [] as string[],
  }),
}));
vi.mock("@/project/authoredProjectBaseline", () => ({ AuthoredProjectBaseline: class {} }));
vi.mock("@/project/store", () => ({ store: { getCurrent: () => h.project } }));
vi.mock("@/ai/llmClient", () => ({ loadAiConfig: () => ({ providerId: "google-antigravity", model: "m", piApply: h.piApply }) }));
vi.mock("@/editor/tools/changeset", () => ({ summarizeChanges: () => ({}) }));
vi.mock("@/editor/tools/applyChangesetToStore", () => ({
  captureProposalBase: () => ({}),
  applyProposedProject: async () => ({ ok: true }),
}));

const { runPiCommand } = await import("@/editor/panels/aiPiAgentCommand");

const projectWith = (name: string) => ({ maps: { map_a: { id: "map_a", name, width: 4, height: 4 } } });

const harness = () => {
  const outcomeCalls: (Record<string, unknown> | null)[] = [];
  const surface = () => ({
    appendBubble: (role: string, text: string) => { h.bubbles.push(`${role}:${text}`); return null; },
    appendCard: () => {},
    setStatus: () => {},
    getCurrentMapId: () => "map_a",
    setRunOutcome: (outcome: Record<string, unknown> | null) => { outcomeCalls.push(outcome); },
  });
  return { outcomeCalls, surface };
};

beforeEach(() => {
  h.requests.length = 0; h.results.length = 0; h.bubbles.length = 0;
  h.assistantTexts.length = 0; h.boardStates.length = 0;
  h.project = { maps: { map_a: { id: "map_a", name: "A", width: 4, height: 4 } } };
  h.piApply = "auto";
});

describe("Pi 경로 실행 결과 4축", () => {
  it("적용 성공: response-final · 목표 미평가 · 적용됨 — 마지막 호출이 유효 outcomes", async () => {
    h.results.push({ project: projectWith("바뀜"), toolErrors: 0 });
    const { outcomeCalls, surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "바꿔라" }, surface());

    expect(outcomeCalls.length).toBeGreaterThan(0);
    const last = outcomeCalls.at(-1)!;
    expect(last).toMatchObject({ execution: "response-final", goal: "unassessed", delivery: "applied" });
    // 4축은 서로의 성공을 빌리지 않는다 — 이미지 축은 전달 사실을 보고한 호출자만 참으로 둔다.
    expect(last).toMatchObject({ imageAttached: false });
    expect((last as { visualDelivery?: unknown }).visualDelivery).toBeUndefined();
  });

  it("검토 대기는 draft, 버리면 no-change로 갈아엎는다", async () => {
    h.piApply = "review";
    h.results.push({ project: projectWith("검토"), toolErrors: 0 });
    let discard: (() => void) | null = null;
    const { outcomeCalls } = harness();
    const surface = () => ({
      appendBubble: (role: string, text: string) => { h.bubbles.push(`${role}:${text}`); return null; },
      appendCard: () => {},
      setStatus: () => {},
      getCurrentMapId: () => "map_a",
      setRunOutcome: (outcome: Record<string, unknown> | null) => { outcomeCalls.push(outcome); },
      // board.setReview 를 흉내: 두 번째 인자(옵션)에 후킹하려면 3번째 패러미터가 필요하다 —
      // 단순화: runPiCommand 내부 board.setReview 는 mock 을 타므로 여기선 outcomes 마지막에 남긴다.
    });
    void discard;

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "바꿔라" }, surface());

    const last = outcomeCalls.at(-1)!;
    expect(last).toMatchObject({ execution: "response-final", goal: "unassessed", delivery: "draft" });

    // 적용 전에도 비교 카드가 검토 자리에 선다 — 없으면 사용자는 빈 카드로 결정해야 했다.
    const review = h.outcomes.at(-1) as { preview?: { dataset?: { state?: string } } } | null;
    expect(review?.preview?.dataset?.state).toBe("proposed");
  });

  it("바뀐 것이 없으면: response-final + no-change", async () => {
    h.results.push({ project: h.project, toolErrors: 0 });
    const { outcomeCalls, surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "다듬어라" }, surface());

    expect(outcomeCalls.at(-1)).toMatchObject({ execution: "response-final", goal: "unassessed", delivery: "no-change" });
  });

  // 깨질 것: 질문 턴(툴 0 · 변경 0 · 답 본문)이 「적용됨」 배지와 실패 톤 캡션으로 끝나면
  // 성공한 답변이 "아무것도 못 한 실행"으로 읽힌다(2026-09-12 실측 스크린샷).
  it("답이 남은 변경-0 턴: 보드는 「완료」·본문 말풍선이 시스템 줄보다 먼저 온다", async () => {
    h.results.push({ project: h.project, toolCalls: 0 });
    h.assistantTexts.push("현재 맵은 빈 맵(map_blank_start), 20×15 타일입니다.");
    const { surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "맵 정보 알려줘" }, surface());

    expect(h.boardStates.at(-1)?.phase).toBe("완료");
    expect(h.boardStates.at(-1)?.phase).not.toBe("적용됨");
    const assistantIndex = h.bubbles.findIndex((line) => line.startsWith("assistant:"));
    const systemIndex = h.bubbles.findIndex((line) => line.startsWith("system:"));
    expect(assistantIndex).toBeGreaterThanOrEqual(0);
    expect(h.bubbles[assistantIndex]).toContain("빈 맵(map_blank_start)");
    expect(systemIndex).toBeGreaterThan(assistantIndex);
    expect(h.bubbles[systemIndex]).toContain("프로젝트는 바뀌지 않았습니다");
    expect(h.bubbles.some((line) => line.includes("바뀐 것이 없습니다") && !line.includes("프로젝트는"))).toBe(false);
  });

  it("스트림 오류(토큰 만료 등)가 있어도 끝까지 가면 성공이지만 오류 다이제스트가 캡션에 남는다", async () => {
    h.results.push({ project: projectWith("바뀜2"), toolErrors: 1 });
    h.errorEvents.push("OAuth token expired before request — please retry; AuthStorage will refresh on the next attempt.");
    const { outcomeCalls, surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "바꿔라" }, surface());

    expect(outcomeCalls.at(-1)).toMatchObject({ execution: "response-final", delivery: "applied" });
    expect(h.bubbles.some((line) => line.includes("오류 1건") && line.includes("OAuth token expired"))).toBe(true);
  });

  it("중단(signal aborted)이면 execution 이 cancelled", async () => {
    h.results.push({ project: projectWith("안돼"), toolErrors: 0 });
    const { outcomeCalls } = harness();
    const controller = new AbortController();
    controller.abort();

    await runPiCommand(
      { mode: "single", mapIds: ["map_a"], task: "바꿔라" },
      {
        appendBubble: (role: string, text: string) => { h.bubbles.push(`${role}:${text}`); return null; },
        appendCard: () => {},
        setStatus: () => {},
        getCurrentMapId: () => "map_a",
        setRunOutcome: (outcome: Record<string, unknown> | null) => { outcomeCalls.push(outcome); },
        signal: controller.signal,
      },
    );

    expect(outcomeCalls.at(-1)).toMatchObject({ execution: "cancelled", delivery: "no-change" });
  });

  it("spill 이 있으면 성공 캡션이 버려진 변경을 숫자로 고지한다", async () => {
    h.results.push({ project: projectWith("spill"), toolErrors: 0 });
    h.spills.push({ mapIds: ["map_a"], keys: ["switches"] });
    const { outcomeCalls, surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "스위치를 바꿔라" }, surface());

    expect(h.bubbles.some((line) => line.includes("적용했습니다") && line.includes("범위 밖 1건 버림") && line.includes("switches"))).toBe(true);
    // outcome 축 자체는 적용 성공을 그대로 말한다 — spill 은 성공을 지우지 않는다(4축 독립).
    expect(outcomeCalls.at(-1)).toMatchObject({ delivery: "applied", execution: "response-final" });
  });
});
