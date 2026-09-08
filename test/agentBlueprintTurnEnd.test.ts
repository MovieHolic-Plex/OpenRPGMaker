// 청사진 턴 정산 — 표시된 상태와 저장소가 어긋나지 않는다.
//
// 실측 결함 1: 턴 끝 정산이 정상 종료 분기에만 있어서 시공 중에 중단하거나 턴이 오류로 끝나면
// 칸 하나가 노란 2px(짓는 중)로 얼어붙었다. 다음 턴 시작의 syncAgentBlueprintWithSpec 은 같은
// 사각형이면 상태를 **물려받으므로** 그 노란 칸은 세션을 버릴 때까지 풀리지 않는다.
//
// 실측 결함 2(1을 고치면서 들어왔다): 모든 종료 경로에서 building 을 done 으로 올렸는데, 다섯
// 종료 경로 중 셋 — 중단 return, catch 두 개 — 은 applyProposal **앞에서** 끝난다. 같은 툴콜을
// 정상 종료와 중단으로 각각 돌려 보면 store 변경은 true/false 로 갈리는데 청사진은 양쪽 다
// done 이었다(중단 쪽 로그에는 "적용" 이 없다). 게다가 markAgentBlueprintProgress 는 planned 가
// 아닌 칸을 다시 올리지 않으므로 그 거짓 완료는 세션이 죽을 때까지 남는다 — 손도 안 댄 타일
// 위에 회색 ✓ "완료" 가 영구히 박힌다. 그래서 아래 세 케이스는 **청사진과 저장소를 함께** 본다.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig } from "@/ai/llmClient";
import { clearConversations } from "@/ai/conversationStore";
import * as activityLog from "@/ai/activityLog";
import { clearAgentBlueprint, getAgentBlueprintState } from "@/editor/agentBlueprint";
import { clearAiActivityLogs, getLatestAiActivityLog } from "@/ai/activityLog";
import { clearAgentGhostPreview, getAgentGhostPreviewState, subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { serialize } from "@/project/io";
import * as apply from "@/editor/tools/applyChangesetToStore";
import { sendAiTurn } from "./aiTurnHarness";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { createRequestSource } from "@/ai/assistantRequestContract";
import { emptyWikiResponse, isWikiExtraction } from "./wikiTransportFixture";

vi.mock("@/ai/yieldToUi", () => ({ defaultYieldToUi: async () => {} }));


const MAP_ID = "map_blank_start";
const OTHER_MAP_ID = "map_viewed_b";

/** 20×15 빈 맵 안에 들어가는 최소 계획 — 집 한 채. */
const SPEC = {
  mapId: MAP_ID,
  title: "작은 마을",
  assets: [{ id: "house_a", kind: "house", x: 4, y: 4, w: 6, h: 5 }],
} as const;

/**
 * 집 칸을 그대로 덮는 쓰기 툴콜 — 스펙 게이트 안(에셋 사각형과 동일)이고 타일을 **실제로** 바꾼다.
 * 종전 fixture 는 mirror_region 이었는데 빈 맵을 대칭시키면 바뀌는 타일이 0장이다 — 적용이
 * 들어갔는지로 정산을 판정하는 지금은 "변경 없음" 과 구분되지 않는다.
 */
const FILL_ARGS = { mapId: MAP_ID, rect: { x: 4, y: 4, w: 6, h: 5 }, material: "물" } as const;

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

beforeEach(async () => {
  clearAgentBlueprint();
  clearAgentGhostPreview();
  const project = createBlankProject();
  project.maps[OTHER_MAP_ID] = { ...structuredClone(project.maps[MAP_ID]), id: OTHER_MAP_ID };
  store.replace(project);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  editorState.set({ currentMapId: MAP_ID, selection: null });
  resetMapEditHistory();
  restoreDom = installFakeDom();
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
  await clearConversations();
  clearAiActivityLogs(); // 턴 결과(stoppedReason)를 이 링버퍼로 읽으므로 앞 케이스의 기록을 지운다.
  // chat 모드 = 턴 1개(플래너 라운드 없음). 스크립트 라운드 수를 예측 가능하게 만든다.
  storage.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), apiKey: "sk-test", agentMode: "chat", maxToolCalls: 4 }));
});

afterEach(() => {
  teardownAiChatPanel();
  clearAgentBlueprint();
  clearAgentGhostPreview();
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// The tool loop can request stream:false. JSON messages are supported by the
// real client for both streaming and non-streaming requests; SSE deltas are not.
function toolCallsResponse(calls: readonly { readonly name: string; readonly args: unknown }[]): Response {
  const toolCalls = calls.map((call, index) => ({
    id: `call_${index}`,
    type: "function",
    function: { name: call.name, arguments: JSON.stringify(call.args) },
  }));
  return Response.json({ choices: [{ message: { role: "assistant", content: null, tool_calls: toolCalls }, finish_reason: "tool_calls" }] });
}

/** 툴콜 없는 마무리 응답 — 턴을 정상 종료로 끝낸다. */
function textResponse(text: string): Response {
  return Response.json({ choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] });
}

/** 진행을 옮기지 않는 읽기 툴콜 — 루프를 한 라운드 더 돌리되 제안은 만들지 않는다. */
const READ_ARGS = { mapId: MAP_ID, x: 0, y: 0, w: 6, h: 5 } as const;

/**
 * 1라운드는 밑그림 확정 + 집 칸 시공, 2라운드부터는 `afterFirstRound()` 가 턴을 끝낸다.
 * (중단이면 abort 를 누르고 던지고, 오류면 401 을 돌려준다.)
 */
/**
 * LLM 왕복만 라운드로 센다.
 *
 * 왜 URL 을 보는가: 이 하네스는 «fetch 는 곧 LLM 호출» 로 짜여 있었는데, 턴은 LLM 말고도 요청을
 * 낸다 — 활동 로그의 디스크 미러(`/__oprn/ai-activity`)가 그렇고, 그 요청이 라운드를 한 칸
 * 훔치면 1라운드 툴콜 대본이 미러에게 배달되고 모델은 «끝» 응답을 받는다(실측: 툴 0건, 청사진
 * 0칸으로 다섯 케이스가 한꺼번에 빨감). 라운드 대본은 LLM 요청에만 답한다.
 */
function isLlmRequest(input: unknown, init?: unknown): boolean {
  const url = typeof input === "string" ? input : String((input as { url?: unknown })?.url ?? input);
  if (!url.includes("/chat/completions")) return false;
  try {
    const body = JSON.parse(String((init as { body?: unknown } | undefined)?.body ?? "{}"));
    return Array.isArray(body.tools) && body.tools.length > 0;
  } catch {
    return false;
  }
}




function requestUserText(init?: RequestInit): string {
  try {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const user = [...messages].reverse().find((message: { role?: string }) => message.role === "user");
    const content = user && "content" in user ? user.content : "";
    if (typeof content !== "string") return "";
    if (content.startsWith("## 요청\n")) {
      return content.slice("## 요청\n".length).split("\n\n")[0] ?? "";
    }
    try {
      const payload = JSON.parse(content);
      if (payload && typeof payload.userText === "string") return payload.userText;
    } catch { /* user content is the kickoff */ }
    return content;
  } catch {
    return "";
  }
}

function intentDeclarationResponse(init?: RequestInit): Response {
  const raw = requestUserText(init);
  const question = /알려|상태|어떤지/.test(raw);
  const source = createRequestSource("preview", raw);
  const payload = question
    ? { mode: "question", needsPlan: false, space: "none", tools: [], summary: raw.slice(0, 200) }
    : {
        mode: "modify",
        needsPlan: true,
        space: "outdoor",
        tools: ["set_build_spec", "fill_region"],
        requestRequirements: {
          entries: source.units.map(unit => ({
            source: [unit.source],
            criteria: [{ kind: "targetChange", target: { mapId: MAP_ID } }],
            bindings: [],
          })),
        },
        summary: raw.slice(0, 200),
      };
  return Response.json({ choices: [{ message: { role: "assistant", content: JSON.stringify(payload) }, finish_reason: "stop" }] });
}


function chatMessages(value: unknown): readonly { readonly content?: unknown }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((entry): entry is { readonly content?: unknown } => typeof entry === "object" && entry !== null);
}

function plannerDirect(): Response {
  return Response.json({ choices: [{ message: { role: "assistant", content: JSON.stringify({ action: "direct" }) }, finish_reason: "stop" }] });
}
function nonToolLlm(input: unknown, init: RequestInit | undefined, plannerCalls: { n: number }): Response {
  const url = typeof input === "string" ? input : String((input as { url?: unknown })?.url ?? input);
  if (!url.includes("/chat/completions")) return okResponse();
  const body = String(init?.body ?? "");
  if (body.includes("json_object") || body.includes("response_format")) return intentDeclarationResponse(init);
  plannerCalls.n += 1;
  return plannerDirect();
}

const okResponse = (): Response => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });

function scriptTurn(afterFirstRound: () => Response | never): void {
  let round = 0;
  const plannerCalls = { n: 0 };
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    let request: { messages?: unknown } = {};
    try { request = JSON.parse(String(init?.body ?? "{}")); } catch { return okResponse(); }
    if (isWikiExtraction(chatMessages(request.messages))) return emptyWikiResponse();
    if (!isLlmRequest(input, init)) return nonToolLlm(input, init, plannerCalls);
    round += 1;
    if (round > 8) return new Response("script-exhausted", { status: 401 });
    if (round === 1) {
      return toolCallsResponse([
        { name: "set_build_spec", args: SPEC },
        { name: "fill_region", args: FILL_ARGS },
      ]);
    }
    return afterFirstRound();
  }));
}

/** 라운드별 응답을 그대로 지정한다 — 마지막 응답은 남은 라운드에서 되쓴다. */
function scriptRounds(rounds: readonly (() => Response | never)[]): void {
  let round = 0;
  const plannerCalls = { n: 0 };
  vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
    let request: { messages?: unknown } = {};
    try { request = JSON.parse(String(init?.body ?? "{}")); } catch { return okResponse(); }
    if (isWikiExtraction(chatMessages(request.messages))) return emptyWikiResponse();
    if (!isLlmRequest(input, init)) return nonToolLlm(input, init, plannerCalls);
    round += 1;
    if (round > 8) return new Response("script-exhausted", { status: 401 });
    const step = rounds[Math.min(round - 1, rounds.length - 1)];
    return step();
  }));
}

async function runTurn(panel: FakeElement, text = "야외에 집 한 채 지어줘"): Promise<void> {
  const input = findByTestId(panel, "ai-input") as unknown as HTMLTextAreaElement;
  input.value = text;
  const otherMapBefore = structuredClone(store.getCurrent().maps[OTHER_MAP_ID]);
  const viewedMapId = editorState.get().currentMapId;
  const runningOwners: Array<string | null> = [];
  const unsubscribe = subscribeAgentGhostPreview((state) => {
    if (state.runningToolName && state.runningToolMapId) runningOwners.push(state.runningToolMapId);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const persist = activityLog.recordAiActivity;
  let persistenceSpy: MockInstance<typeof persist> | undefined;
  // Activity persistence is queued independently of the panel's finally block.
  // Observe completion of the real terminal write, including its queued mirrors,
  // so teardown cannot race a write from this turn into the next test's storage.
  const logged = new Promise<Awaited<ReturnType<typeof persist>>>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error("Terminal AI activity log was not saved within 10s")), 10_000);
    persistenceSpy = vi.spyOn(activityLog, "recordAiActivity").mockImplementation((record) => {
      const saved = persist(record);
      if (!record.result.pending) void saved.then(resolve, reject);
      return saved;
    });
  });
  try {
    const [record] = await Promise.all([logged, sendAiTurn(panel)]);
    expect(getLatestAiActivityLog()?.toolCalls.length).toBeGreaterThan(0);
    expect(new Set(runningOwners)).toEqual(new Set([MAP_ID]));
    expect(getAgentGhostPreviewState().runningToolName).toBe("");
    expect(getAgentGhostPreviewState().runningToolMapId).toBeNull();
    // Applying changes deliberately focuses their owner (focusAcceptedAgentChanges).
    // Aborts and lookups leave the viewed map alone; neither may mutate map B.
    expect(editorState.get().currentMapId).toBe(record.result.appliedCalls ? MAP_ID : viewedMapId);
    expect(store.getCurrent().maps[OTHER_MAP_ID]).toEqual(otherMapBefore);
  } finally {
    clearTimeout(timer);
    persistenceSpy?.mockRestore();
    unsubscribe();
  }
}

function statusById(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of getAgentBlueprintState().entries) out[entry.id] = entry.status;
  return out;
}

describe.each([MAP_ID, OTHER_MAP_ID])("중단·오류로 끝난 턴의 청사진 정산 (viewed: %s)", (viewedMapId) => {
  beforeEach(() => editorState.set({ currentMapId: viewedMapId }));

  it("시공 중 중단하면 짓던 칸이 planned 로 되돌아간다 — 저장소가 안 바뀌었는데 완료를 찍지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    scriptRounds([
      () => toolCallsResponse([{ name: "set_build_spec", args: SPEC }]),
      () => {
        // Abort after the spec is in-flight and before a store-mutating fill can auto-apply.
        (findByTestId(panel, "ai-abort") as unknown as HTMLElement).click();
        throw new Error("aborted by user");
      },
    ]);

    try {
      await runTurn(panel);
    } finally {
      teardownAiChatPanel();
    }

    // 중단 통보가 붙었고(= 중단 분기를 지났다) 초안은 적용되지 않았다.
    const logText = (findByTestId(panel, "ai-chat-log") as unknown as FakeElement).textContent ?? "";
    expect(logText).toContain("사용자가 중단했습니다");
    expect(logText).not.toContain("적용했습니다");
    // 저장소는 한 글자도 안 바뀌었다 — applyProposedProject 만 store.replace 를 부른다.
    expect(store.getCurrent()).toBe(before);
    expect(getAgentBlueprintState().entries).toHaveLength(0);
  });

  it("턴이 오류로 끝나도 남은 제안은 적용되므로 그 칸은 done 으로 확정된다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    scriptTurn(() => new Response("nope", { status: 401, headers: { "Content-Type": "text/plain" } }));

    await runTurn(panel);

    // 오류 분기는 적용 경로를 그대로 통과한다(제안이 0건이 아니다) — 시공이 실제로 들어갔고,
    // 들어간 계획은 착공 안내 역할을 다 했으므로 캔버스에서 물러난다.
    expect(store.getCurrent()).not.toBe(before);
    expect(getAgentBlueprintState().entries).toHaveLength(0);
  });

  it("정상 종료 + 적용에서만 저장소가 바뀝고 밑그림이 물러난다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    scriptTurn(() => textResponse("집을 지었습니다."));

    await runTurn(panel);

    expect(store.getCurrent()).not.toBe(before);
    expect(getAgentBlueprintState().entries).toHaveLength(0);
  });

  // 실측 결함: 조수와의 대화가 끝난 뒤에도 밑그림이 맵에 남았다. 전 칸 done 이면 읽기 경로가 감추지만
  // 모델이 에셋 하나를 건너뛰면 그 칸은 planned 로 남고, 스펙이 세션에 살아 있어 다음 턴 시작의
  // 재동기화가 계획을 다시 깔았다 — 질문 한 번에도 시공이 끝난 맵 위에 파랑 칸이 되살았다.
  it("일부만 지은 계획도 적용된 턴이 끝나면 물러나고, 다음 턴이 되살리지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const twoAssets = {
      ...SPEC,
      assets: [...SPEC.assets, { id: "house_b", kind: "house", x: 12, y: 4, w: 6, h: 5 }],
    };
    // 1턴: 집 듑 채를 계획하고 한 채만 짓고 끝낸다 — house_b 는 planned 로 남을 칸이다.
    scriptRounds([
      () => toolCallsResponse([{ name: "set_build_spec", args: twoAssets }, { name: "fill_region", args: FILL_ARGS }]),
      () => textResponse("집 한 채를 지었습니다."),
    ]);
    const before = store.getCurrent();
    await runTurn(panel, "야외에 집 두 채 지어줘");
    expect(store.getCurrent()).not.toBe(before);
    expect(getAgentBlueprintState().entries).toHaveLength(0);

    // 2턴: 스펙은 세션에 그대로 있다 — 턴 시작 재동기화가 물러난 칸을 다시 그리지 않아야 한다.
    scriptRounds([
      () => toolCallsResponse([{ name: "get_map_region", args: READ_ARGS }]),
      () => textResponse("지어진 집을 확인했습니다."),
    ]);
    editorState.set({ currentMapId: viewedMapId });
    await runTurn(panel, "야외 맵 상태가 지금 어떤지 알려줘");
    expect(getAgentBlueprintState().entries).toHaveLength(0);
    const status = findByTestId(panel, "ai-status") as unknown as FakeElement;
    expect(status.textContent ?? "").not.toContain("밑그림 확정");
  });

  // 4차 리뷰 N4-7: 위 세 케이스는 전송이 **던지는** 중단만 태운다 — 즉 catch 안의 중단 분기다.
  // 세션에는 라운드 머리에서 signal.aborted 를 보고 `stoppedReason: "aborted"` 로 **정상 반환**
  // 하는 길이 따로 있고, 패널은 그 결과를 try 안의 다른 분기에서 처리한다. 두 분기는 서로 다른
  // 코드라 한쪽만 pin 하면 다른 쪽이 정산을 잃어도 초록이 유지된다.
  it("전송이 던지지 않고 정상 반환한 중단도 정산된다 — 제안이 남아 있어도 적용에 닿지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    const beforeBytes = serialize(before);
    const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage");
    scriptRounds([
      () => toolCallsResponse([{ name: "set_build_spec", args: SPEC }]),
      () => {
        (findByTestId(panel, "ai-abort") as unknown as HTMLElement).click();
        return toolCallsResponse([{ name: "fill_region", args: FILL_ARGS }]);
      },
      () => textResponse("여기까지 했습니다."),
    ]);

    try {
      await runTurn(panel);
      const session = send.mock.contexts.at(-1);
      if (!(session instanceof AssistantSession)) throw new Error("Missing real panel session");
      const terminal = getLatestAiActivityLog()?.result;
      expect(terminal?.stoppedReason).toBe("aborted");
      expect(terminal?.proposedCalls ?? 0).toBe(0);
      expect(store.getCurrent()).toBe(before);
      expect(serialize(store.getCurrent())).toBe(beforeBytes);
      expect(getMapEditHistoryEntries()).toHaveLength(0);
      expect(statusById()).toEqual({});
      expect(session.getActiveSpec()).toMatchObject({ mapId: MAP_ID, title: SPEC.title });
      const toolsBefore = session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "fill_region").length;

      const applySpy = vi.spyOn(apply, "applyProposedProject");
      const applied = await apply.applyProposedProject(session.getProposedProject(), {
        source: "agent", summary: "resume-retained-draft", toolNames: ["set_build_spec"],
      });
      expect(applied.ok, applied.ok ? "" : applied.issue).toBe(true);
      if (!applied.ok) throw new Error(applied.issue ?? "apply failed");
      session.recordAppliedProject(applied);
      expect(applySpy).toHaveBeenCalledTimes(1);
      expect(store.getCurrent()).not.toBe(before);
      expect(session.getAuditEntries().filter(entry => entry.kind === "tool" && entry.name === "fill_region")).toHaveLength(toolsBefore);
    } finally {
      teardownAiChatPanel();
    }
  });

  // 리뷰 지적: 캔버스가 다 지은 계획을 물러나게 하면 상태줄이 여전히 "밑그림 확정 — 에셋 N개" 를
  // 찍어 맵과 서로 다른 말을 한다. 그 분기는 쓰기 제안 0건인 턴에서만 달리므로 시공이 끝난 뒤의
  // 조회 턴이 정확히 그 상황이다.
  it("다 지은 뒤의 조회 턴은 상태줄에 밑그림 확정을 다시 찍지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    // 1턴: 계획을 세우고 집을 실제로 지어 적용까지 간다.
    scriptTurn(() => textResponse("집을 지었습니다."));
    await runTurn(panel);
    // 시공이 적용된 턴이 끝났으므로 계획은 물러났다.
    expect(getAgentBlueprintState().entries).toHaveLength(0);

    // 2턴: 스펙은 세션에 그대로 살아 있고(턴 간 유지) 쓰기 제안은 0건인 조회 턴.
    scriptRounds([
      () => toolCallsResponse([{ name: "get_map_region", args: READ_ARGS }]),
      () => textResponse("지어진 집을 확인했습니다."),
    ]);
    // 시공 지시가 아니라 조회다 — 완성도 린트가 경고를 내면 상태줄 분기에 닿지 못한다.
    editorState.set({ currentMapId: viewedMapId });
    await runTurn(panel, "야외 맵 상태가 지금 어떤지 알려줘");

    const status = findByTestId(panel, "ai-status") as unknown as FakeElement;
    expect(status.textContent ?? "").not.toContain("밑그림 확정");
    // 계획은 물러났고 재동기화도 되살리지 않았다 — 두 표면이 같은 말을 한다.
    expect(getAgentBlueprintState().entries).toHaveLength(0);
  });

  // 4차 리뷰 N4-7: 쓰기 제안이 0건인 종료(변경 없음 분기)도 정산을 부른다. 그 분기가 정산을
  // 잃으면 "이번 턴에 올린 칸" 이 그대로 남아 다음 턴 정산이 남의 칸을 되돌린다.
  it("쓰기 제안 0건으로 끝난 턴은 진행을 하나도 남기지 않는다", async () => {
    const panel = renderAiChatPanel({ getChatDock: () => "side" }) as unknown as FakeElement;
    const before = store.getCurrent();
    const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage");
    scriptRounds([
      () => toolCallsResponse([{ name: "set_build_spec", args: SPEC }, { name: "get_map_region", args: READ_ARGS }]),
      () => textResponse("먼저 지형을 확인했습니다."),
    ]);

    await runTurn(panel);

    const session = send.mock.contexts.at(-1);
    if (!(session instanceof AssistantSession)) throw new Error("Missing real panel session");
    const terminal = getLatestAiActivityLog()?.result;
    const logText = (findByTestId(panel, "ai-chat-log") as unknown as FakeElement).textContent ?? "";
    expect(store.getCurrent()).toBe(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(terminal?.appliedCalls ?? 0).toBe(0);
    expect(terminal?.proposedCalls ?? 0).toBe(0);
    expect(terminal?.stoppedReason).toBe("error");
    expect(logText).toContain("script-exhausted");
    expect(logText).toMatch(/401/);
    expect(logText).not.toContain("적용했습니다");
    expect(logText).not.toContain("변경 제안 없음(0건)");
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(session.getAcceptanceSnapshot()?.items.some(item => item.status === "blocked")).toBe(true);
    expect(getAgentBlueprintState().entries).toHaveLength(0);
    expect(statusById()).toEqual({});
  });
});
