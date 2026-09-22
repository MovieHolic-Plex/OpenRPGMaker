vi.mock("@/editor/panels/aiActivitySave", () => ({ observeActivitySave: vi.fn() }));
// Pi 경로(2026-09-10 이후 기본)에도 실행 결과 4축(ai-run-outcome)이 산다 — 세션 경로만
// 있던 불일치(2026-09-11 실측: 20턴 내내 1회도 미렌더)의 회귀.
// 렌더는 패널이 소유하고, 여기선 surface.setRunOutcome 으로 흘린 facts 만 고정한다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  villageIssues: [] as string[],
  planError: false,
  harmony: true,
  verdicts: [] as boolean[],
  /** 검수 호출마다 돌려줄 지적. 비우면 매번 같은 ["density"] — 수리가 아무것도 못 바꾼 경우다. */
  findings: [] as string[][],
  reviewCalls: 0,
  applyCalls: 0,
  harmonyError: false,
  requests: [] as Record<string, unknown>[],
  results: [] as { project: unknown; toolCalls?: number; toolErrors?: number; villageCompletion?: { mapIds: string[]; issues: string[] } }[],
  errorEvents: [] as string[],
  assistantTexts: [] as string[],
  outcomes: [] as (Record<string, unknown> | null)[], // 호출 순서 보존
  boardStates: [] as { phase?: string; applied?: string | null }[],
  spills: [] as { mapIds: readonly string[]; keys: readonly string[] }[],
  bubbles: [] as string[],
  process: [] as string[],
  // 검토 액션 버스 — runPiCommand 가 「검토 대기」 게시 직전에 등록하고 적용·버리기·새 실행에서 null 로 지운다.
  reviewActions: [] as ({ apply: () => void; discard: () => void; openReport?: () => void } | null)[],
  project: {
    maps: { map_a: { id: "map_a", name: "A", width: 4, height: 4 } },
  } as unknown,
  piApply: "default" as "yolo" | "auto" | "default" | "review" | "step",
  /** showConfirm 의 대답. 맵 소실 확인 모달을 사람 없이 굴린다. */
  confirmAnswer: true,
}));

vi.mock("@/editor/panels/aiPendingReview", () => ({ createPendingReviewPrompt: () => ({ root: { remove() {} }, setBusy() {} }) }));
// `unresolvedReviewSignature` 는 순수 함수라 진짜를 쓴다 — 수리 진전 판정을 목으로 흉내 내면
// 「지적이 그대로면 멈춘다」 계약이 테스트 안에서만 참이 된다.
vi.mock("@/ai/ultrabrainReview", async importOriginal => ({
  ...await importOriginal<typeof import("@/ai/ultrabrainReview")>(),
  reviewMapHarmony: async () => {
    h.reviewCalls += 1;
    if (h.harmonyError) throw new Error("image unavailable");
    const harmonious = h.verdicts.shift() ?? h.harmony;
    const findings = h.findings.shift() ?? ["density"];
    return [{ mapId: "map_a", harmonious, summary: "review", findings: harmonious ? [] : findings }];
  },
}));
vi.mock("@/ai/piAgent/client", () => ({
  runPiAgentViaCompanion: async (request: Record<string, unknown>, options?: { onEvent?: (event: unknown) => void }) => {
    h.requests.push(request);
    if (request.readOnly && String(request.task).startsWith("[계획 턴]")) {
      if (h.planError) options?.onEvent?.({ type: "error", message: "plan failed" });
      options?.onEvent?.({ type: "assistant", text: "1. 요청 범위에 변경을 적용하고 검증한다." });
      return { type: "done", project: request.project, changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 } };
    }
    const next = h.results.shift() ?? { project: request.project };
    for (const message of h.errorEvents.splice(0)) options?.onEvent?.({ type: "error", message });
    options?.onEvent?.({ type: "start", provider: "p", model: "m", toolCount: 1 });
    if ((next.toolCalls ?? 1) > 0) {
      options?.onEvent?.({ type: "tool_end", id: "t1", name: "paint", ok: (next.toolErrors ?? 0) === 0, summary: (next.toolErrors ?? 0) > 0 ? "OAuth token expired before request — please retry; AuthStorage will refresh on the next attempt." : "칠함" });
    }
    for (const text of h.assistantTexts.splice(0)) options?.onEvent?.({ type: "assistant", text });
    const done = {
      type: "done", project: next.project, villageCompletion: next.villageCompletion,
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
  openWideChangeViewer: () => {},
}));
vi.mock("@/ai/piAgent/teamActivity", () => ({
  publishTeamActivity: () => {},
  setTeamReviewActions: (actions: { apply: () => void; discard: () => void; openReport?: () => void } | null) => { h.reviewActions.push(actions); },
}));
vi.mock("@/ai/piAgent/teamSpecStore", () => ({ loadTeamSpec: () => ({ version: 1, orchestratorNotes: "", members: [] }) }));
vi.mock("@/ai/piAgent/mapBundle", () => ({
  mergeMapBundles: (_base: unknown, bundles: { project: unknown }[]) => ({
    project: bundles[0]!.project,
    spills: h.spills.splice(0),
    conflicts: [] as string[],
  }),
}));
vi.mock("@/project/authoredProjectBaseline", () => ({ AuthoredProjectBaseline: class {} }));
// subscribe 가 빠져 있어 mapEditHistory 의 모듈 초기화가 즉시 죽었다 — 파일 전체가 로드조차
// 되지 않아 여기 담긴 12개 케이스가 통째로 침묵했다(main 기준으로도 빨간불).
vi.mock("@/project/store", () => ({ store: { getCurrent: () => h.project, getProjectIdentity: () => ({ kind: "local-session", id: "outcome-fixture" }), subscribe: () => () => {} } }));
// 실제 모달을 띄우지 않는다. 맵 소실 확인은 별도 케이스에서 반환값을 갈아 끼워 검사한다.
vi.mock("@/editor/ui/modal", () => ({ showConfirm: async () => h.confirmAnswer }));
vi.mock("@/ai/llmClient", () => ({ loadAiConfig: () => ({ providerId: "google-antigravity", model: "m", piApply: h.piApply }) }));
vi.mock("@/editor/tools/changeset", () => ({ summarizeChanges: () => ({}) }));
vi.mock("@/editor/tools/applyChangesetToStore", () => ({
  captureProposalBase: () => ({}),
  captureApplyAuthority: () => ({ base: {}, baseline: {} }),
  applyProposedProject: async () => { h.applyCalls += 1; return { ok: true }; },
}));

vi.mock("@/ai/piAgent/villageCompletion", () => ({
  inspectPiVillageCompletion: (_project: unknown, _base: unknown, ids: Iterable<string>) => ({ mapIds: [...ids], issues: h.villageIssues }),
}));

const { runPiCommand } = await import("@/editor/panels/aiPiAgentCommand");

// GameMap 계약대로 타일·이벤트 배열을 채운다 — reviewInput 이 실제 computeChangeSites 를 탄다.
const mapWith = (name: string) => ({ id: "map_a", name, width: 4, height: 4, lowerTiles: new Array(16).fill(0), upperTiles: new Array(16).fill(0), events: [] });
const projectWith = (name: string) => ({ maps: { map_a: mapWith(name) } });

const harness = () => {
  const outcomeCalls: (Record<string, unknown> | null)[] = [];
  const surface = () => ({
    appendBubble: (role: string, text: string) => { h.bubbles.push(`${role}:${text}`); return null; },
    appendProcess: (text: string) => { h.process.push(text); },
    appendCard: () => {},
    setStatus: () => {},
    getCurrentMapId: () => "map_a",
    setRunOutcome: (outcome: Record<string, unknown> | null) => { outcomeCalls.push(outcome); },
  });
  return { outcomeCalls, surface };
};

beforeEach(() => {
  h.villageIssues.length = 0;
  h.planError = false; h.verdicts.length = 0; h.findings.length = 0;
  h.reviewCalls = 0; h.applyCalls = 0; h.outcomes.length = 0;
  h.requests.length = 0; h.results.length = 0; h.bubbles.length = 0; h.process.length = 0;
  h.assistantTexts.length = 0; h.boardStates.length = 0; h.reviewActions.length = 0;
  h.project = projectWith("A");
  h.piApply = "default"; h.harmony = true; h.harmonyError = false;
  // 예전에는 mergeMapBundles 목이 매 턴 splice 로 비워 줘서 눈에 안 띄었다. 평문 턴이 더 이상
  // 병합을 타지 않으므로(2026-09-17) 여기서 직접 비우지 않으면 다음 케이스로 샌다.
  h.spills.length = 0; h.errorEvents.length = 0; h.confirmAnswer = true;
});

describe("Pi 경로 실행 결과 4축", () => {
  it.each(["default", "yolo"] as const)("%s: 마을 완료 검사 실패는 조화 검수 성공으로 지워지지 않는다", async mode => {
    h.piApply = mode;
    h.villageIssues.push("map_a: 대사 없는 페이지");
    h.results.push({ project: projectWith("시공"), villageCompletion: { mapIds: ["map_a"], issues: h.villageIssues } });
    const { outcomeCalls, surface } = harness();
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "마을을 지어라" }, surface());
    expect(outcomeCalls.at(-1)).toMatchObject({ goal: "incomplete", delivery: mode === "yolo" ? "applied" : "draft" });
    expect(h.applyCalls).toBe(mode === "yolo" ? 1 : 0);
  });

  it("passes initial schema candidates into the companion request", async () => {
    const { surface } = harness();
    const initialToolNames = ["find_tools", "get_project_summary", "set_party"];
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "파티를 바꿔줘" }, surface(), {
      routineEdit: true, initialToolNames,
    });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]?.initialToolNames).toEqual(initialToolNames);
    expect(h.requests[0]?.toolNames).toBeUndefined();
  });

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

  it.each(["negative", "unavailable"])("Ultrabrain %s leaves a manual draft in DEFAULT mode", async kind => {
    h.harmony = false;
    h.harmonyError = kind === "unavailable";
    h.results.push({ project: projectWith("바뀜") });
    const { outcomeCalls, surface } = harness();
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "바꿔라" }, surface());
    expect(outcomeCalls.at(-1)).toMatchObject({ delivery: "draft" });
    expect(h.boardStates.at(-1)?.phase).not.toBe("적용됨");
  });
  it("검토 대기는 draft, 버리면 no-change로 갈아엎는다", async () => {
    h.piApply = "review";
    h.results.push({ project: projectWith("검토"), toolErrors: 0 });
    let discard: (() => void) | null = null;
    const { outcomeCalls } = harness();
    const surface = () => ({
      appendBubble: (role: string, text: string) => { h.bubbles.push(`${role}:${text}`); return null; },
      appendProcess: (text: string) => { h.process.push(text); },
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

    // 「작업」 탭 스트립이 누르는 버스 액션은 같은 실행에서 등록된다 — 시작 시 null 로 지우고, 검토 대기 직전에 apply·discard·openReport 를 건다.
    expect(h.reviewActions[0]).toBeNull();
    const bus = h.reviewActions.at(-1)!;
    expect(typeof bus?.apply).toBe("function");
    expect(typeof bus?.discard).toBe("function");
    expect(typeof bus?.openReport).toBe("function");
    // 버스의 버리기는 카드의 버리기와 같은 클로저다 — 결과가 no-change 로 갈아엎히고 버스 슬롯도 비워진다.
    bus!.discard();
    expect(outcomeCalls.at(-1)).toMatchObject({ delivery: "no-change" });
    expect(h.reviewActions.at(-1)).toBeNull();
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
    const assistantIndex = h.bubbles.findIndex((line) => line.startsWith("assistant:") && !line.startsWith("assistant:Ultrabrain 계획"));
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
    expect(h.boardStates.some(state => state.applied?.includes("오류 1건") && state.applied?.includes("OAuth token expired"))).toBe(true);
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
        appendProcess: (text: string) => { h.process.push(text); },
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

    // 사용자가 `/pi map_a …` 로 범위를 직접 적은 턴만 병합이 범위 밖을 버린다(2026-09-17).
    await runPiCommand({ mode: "single", mapIds: ["map_a"], scopedByUser: true, task: "스위치를 바꿔라" }, surface());

    expect(h.boardStates.some(state => state.applied?.includes("범위 밖 1건 버림") && state.applied?.includes("switches"))).toBe(true);
    // outcome 축 자체는 적용 성공을 그대로 말한다 — spill 은 성공을 지우지 않는다(4축 독립).
    expect(outcomeCalls.at(-1)).toMatchObject({ delivery: "applied", execution: "response-final" });
  });

  // 2026-09-17 실측: 「회복약 아이템 만들어줘」에 대해 병합이 `database` 를 버리고, 에이전트는
  // 「등록을 완료했습니다」라고 답하고, 시스템은 「프로젝트는 바뀌지 않았습니다」로 끝냈다.
  // 화면의 모든 어휘가 성공을 가리켰고 바뀐 것은 0바이트였다.
  it("한 일이 전부 범위 밖이면 성공이 아니라 실패로 끝난다", async () => {
    h.results.push({ project: projectWith("A"), toolErrors: 0 }); // 병합 뒤 base 와 같아진다
    h.spills.push({ mapIds: ["map_a"], keys: ["database"] });
    h.assistantTexts.push("회복약 아이템 등록을 완료했습니다.");
    const { surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], scopedByUser: true, task: "회복약 만들어줘" }, surface());

    expect(h.process.some((line) => line.includes("적용되지 않았습니다") && line.includes("database"))).toBe(true);
    expect(h.bubbles.some((line) => line.includes("프로젝트는 바뀌지 않았습니다"))).toBe(false);
    expect(h.boardStates.at(-1)?.phase).toBe("실패");
    expect(h.applyCalls).toBe(0);
  });

  // 같은 실측: 시공이 「실패 · 17턴 · 중단」으로 끝났는데 검수는 「검수 통과」를 찍었고, 그 부분
  // 결과가 auto 설정에서 확인 없이 적용돼 맵 12개가 사라졌다.
  it("상한에 걸려 끊긴 실행은 DEFAULT 설정이어도 자동 적용하지 않는다", async () => {
    h.results.push({ project: projectWith("하다 만 것"), toolErrors: 0 });
    h.errorEvents.push("턴 상한(16)을 넘어 중단했습니다.");
    h.piApply = "default"; h.harmony = true;
    const { surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "마을 만들어줘" }, surface());

    expect(h.applyCalls).toBe(0);
    expect(h.bubbles.some((line) => line.includes("완성되지 않은 결과"))).toBe(true);
    // 원인과 해법을 사람 말로 — 영문 원문(Request was aborted)이 그대로 나가던 자리다.
    expect(h.bubbles.some((line) => line.includes("Request was aborted"))).toBe(false);
  });

  it("상한 안내는 다이얼 단계 이름과 다시 보내는 법을 함께 말한다", async () => {
    h.results.push({ project: projectWith("A"), toolErrors: 0 });
    h.errorEvents.push("턴 상한(16)을 넘어 중단했습니다.");
    const { surface } = harness();

    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "마을" }, surface(), { autonomyLabel: "균형" });

    // 문구는 error 이벤트 하나에서 갈라져 보드 행·실행 요약·적용 캡션으로 퍼진다. 갈라지기 전에
    // 고쳐 두므로 보드가 들고 있는 error 를 보면 모든 표면이 같은 말을 하는지 알 수 있다.
    const shown = h.bubbles.concat(
      h.boardStates.map((state) => String((state as { error?: string }).error ?? "")),
    );
    expect(shown.some((line) => line.includes("균형") && line.includes("16턴") && line.includes("다이얼"))).toBe(true);
  });
});


describe("model role routing", () => {
  it("does not execute a partial or failed plan", async () => {
    h.planError = true;
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface());
    expect(h.requests).toHaveLength(1);
    expect(h.process.some(text => text.includes("plan failed"))).toBe(true);
  });
  it("plans with Ultrabrain before Deep edits", async () => {
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface());
    expect(h.requests).toHaveLength(2);
    expect(h.requests[0]).toMatchObject({ model: "gemini-3.8-flash", thinkingLevel: "high", readOnly: true });
    expect(h.requests[1]).toMatchObject({ model: "m", thinkingLevel: "high" });
    expect(h.requests[1]!.task).toContain("Ultrabrain 실행 계획");
  });
  it("planOnly always disables writes and never starts Deep", async () => {
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "계획" }, harness().surface(), { planOnly: true });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ model: "gemini-3.8-flash", thinkingLevel: "high", readOnly: true });
  });
});


describe("routine edits", () => {
  it("uses only Deep and preserves manual preview, apply and receipt", async () => {
    h.piApply = "review";
    h.planError = true; h.harmonyError = true;
    h.results.push({ project: projectWith("숲길") });
    const receipt = vi.fn();
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "이름 수정" },
      { ...harness().surface(), showChangeReceipt: receipt }, { routineEdit: true });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ model: "m", task: "이름 수정" });
    expect(h.reviewCalls).toBe(0);
    expect(h.applyCalls).toBe(0);
    const review = h.outcomes.at(-1) as unknown as { onApply: () => void; preview: { dataset: { state: string } } };
    expect(review.preview.dataset.state).toBe("proposed");
    review.onApply();
    await vi.waitFor(() => expect(receipt).toHaveBeenCalledOnce());
    expect(h.applyCalls).toBe(1);
    expect(receipt.mock.calls[0]![0]).toMatchObject({ before: h.project, after: projectWith("숲길") });
  });

  it("keeps the user's auto-apply setting without claiming a review", async () => {
    h.results.push({ project: projectWith("숲길") });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface(), { routineEdit: true });
    expect(h.applyCalls).toBe(1);
    expect(h.reviewCalls).toBe(0);
    expect(h.bubbles.join("\n")).not.toContain("Ultrabrain");
  });

  it("a house with a new interior skips planning but retains review for the extra map", async () => {
    h.planError = true;
    h.harmony = false;
    h.results.push({ project: {
      maps: { map_a: mapWith("집 외관"), map_interior: { ...mapWith("집 실내"), id: "map_interior" } },
    } });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "이 맵에 집을 만들어라" },
      harness().surface(), { routineEdit: true });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ model: "m", task: "이 맵에 집을 만들어라" });
    expect(h.reviewCalls).toBe(1);
    expect(h.applyCalls).toBe(0);
    expect(h.outcomes.at(-1)).toBeTruthy();
  });

  it("restores review when the actual change extends beyond the target map", async () => {
    h.harmony = false;
    h.results.push({ project: { ...projectWith("숲길"), switches: [{ id: "flag", name: "추가" }] } });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface(), { routineEdit: true });
    expect(h.reviewCalls).toBe(1);
    expect(h.applyCalls).toBe(0);
  });

  it.each([
    { mode: "team" as const, mapIds: ["map_a"] },
    { mode: "single" as const, mapIds: [] },
    { mode: "single" as const, mapIds: ["map_a", "map_b"] },
  ])("never shortcuts team or unbounded/multi-map work: %j", async command => {
    h.results.push({ project: projectWith("숲길") });
    await runPiCommand({ ...command, task: "큰 작업" }, harness().surface(), { routineEdit: true });
    expect(h.reviewCalls).toBe(1);
    if (command.mode === "single") expect(h.requests[0]!.readOnly).toBe(true);
    else expect(h.requests[0]!.mode).toBe("team");
  });

  // 실측(2026-09-15): 팀 모드가 현재 맵을 버려 팀장이 43맵 중 다른 마을에 배정했다. 팀 요청은 후보를 비워 두더라도
  // 사용자가 보고 있는 맵을 currentMapId 로 싣는다 — 명령이 안 실었으면 패널의 현재 맵으로 채운다.
  it("team requests carry the map the user is looking at even when candidates are empty", async () => {
    h.results.push({ project: projectWith("숲길") });
    await runPiCommand({ mode: "team", mapIds: [], task: "여기에 마을" }, harness().surface());
    expect(h.requests[0]).toMatchObject({ mode: "team", mapIds: [], currentMapId: "map_a" });
  });

  it("plan-only still uses read-only Ultrabrain even with a routine hint", async () => {
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "계획" }, harness().surface(), { routineEdit: true, planOnly: true });
    expect(h.requests).toHaveLength(1);
    expect(h.requests[0]).toMatchObject({ model: "gemini-3.8-flash", readOnly: true });
    expect(h.applyCalls).toBe(0);
  });
});

describe("five application modes", () => {
  it("YOLO skips planning and visual review", async () => {
    h.piApply = "yolo"; h.harmony = false;
    h.results.push({ project: projectWith("YOLO") });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface());
    expect(h.requests).toHaveLength(1); expect(h.reviewCalls).toBe(0); expect(h.applyCalls).toBe(1);
  });
  it("AUTO repairs a failed review without asking the user", async () => {
    h.piApply = "auto"; h.verdicts.push(false, true);
    h.results.push({ project: projectWith("first") }, { project: projectWith("repaired") });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface(), { routineEdit: true });
    expect(h.reviewCalls).toBe(2); expect(h.applyCalls).toBe(1);
    expect(h.requests[1]!.task).toContain("density");
    expect(h.reviewActions.every(action => action === null)).toBe(true);
  });
  it("AUTO stops after two repairs instead of silently applying an unresolved draft", async () => {
    // 지적이 라운드마다 달라지면 상한(2회)까지 간다 — 수리가 무언가를 바꾸고 있다는 뜻이다.
    h.piApply = "auto"; h.harmony = false;
    h.findings.push(["density"], ["palette"], ["proportion"]);
    h.results.push({ project: projectWith("first") }, { project: projectWith("second") }, { project: projectWith("third") });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface(), { routineEdit: true });
    expect(h.reviewCalls).toBe(3); expect(h.applyCalls).toBe(0);
    expect(h.boardStates.at(-1)?.phase).toBe("실패");
    expect(h.reviewActions.every(action => action === null)).toBe(true);
  });
  // 2026-09-18: 마을 턴에 딸려 만들어진 실내 맵이 「마을이 아니다」로 떨어졌고, 고칠 수 없는
  // 지적이라 수리 두 바퀴 내내 글자 하나 안 바뀌며 파이 에이전트를 한 번 더 태웠다.
  it("수리가 지적을 하나도 못 바꾸면 다음 바퀴를 돌지 않는다 — 판정은 그대로 실패", async () => {
    h.piApply = "auto"; h.harmony = false;
    h.results.push({ project: projectWith("first") }, { project: projectWith("second") }, { project: projectWith("third") });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "수정" }, harness().surface(), { routineEdit: true });
    expect(h.reviewCalls, "첫 검수 + 수리 한 번의 재검수").toBe(2);
    expect(h.requests.filter(request => String(request.task).includes("검수 문제만 수정")), "수리 실행은 한 번뿐").toHaveLength(1);
    expect(h.applyCalls, "안 풀린 초안을 조용히 적용하지 않는다").toBe(0);
    expect(h.boardStates.at(-1)?.phase).toBe("실패");
    expect(h.process.join("\n")).toContain("수리 뒤에도 그대로라 반복을 멈췄어요");
  });
  it("read-only refuses returned mutations even under YOLO", async () => {
    h.piApply = "yolo"; h.results.push({ project: projectWith("forbidden") });
    await runPiCommand({ mode: "single", mapIds: ["map_a"], task: "조회" }, harness().surface(), { readOnly: true });
    expect(h.applyCalls).toBe(0);
  });
});
