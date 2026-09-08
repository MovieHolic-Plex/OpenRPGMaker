import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type RequestExecution, type TurnResult } from "@/ai/assistantSession";
import type { AiActivityLogInput, AiActivityLogRecord } from "@/ai/activityLog";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import type { AiRunSurface, ConversationPersistTarget } from "@/editor/panels/aiRunSurface";
import type { AiBubbleRole } from "@/editor/panels/aiConversationLog";
import type { ToolResult } from "@/editor/tools";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

function recordedActivity(input: AiActivityLogInput): AiActivityLogRecord {
  return {
    id: input.id ?? "activity-1",
    at: input.at ?? "1970-01-01T00:00:00.000Z",
    channel: input.channel,
    instruction: input.instruction,
    result: input.result,
    toolCalls: input.toolCalls ?? [],
    audit: input.audit ?? [],
    diagnostics: { severity: "ok", kinds: [], messages: [], failedTools: [] },
    index: { toolNames: [], failedToolNames: [], uiActions: [], commitIds: [], mapIds: [], userTexts: [], reasons: [] },
  };
}

const observed = vi.hoisted(() => ({
  activity: vi.fn(async (input: AiActivityLogInput): Promise<AiActivityLogRecord> => {
    void input;
    throw new Error("recordAiActivity mock not implemented");
  }),
}));
vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: observed.activity,
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: vi.fn() }));

let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  clearAgentBlueprint();
  clearAgentGhostPreview();
  observed.activity.mockReset();
  observed.activity.mockImplementation(async (input) => recordedActivity(input));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
});
afterEach(() => {
  clearAgentBlueprint();
  clearAgentGhostPreview();
  restoreDom?.();
  vi.restoreAllMocks();
});

function createSurface(session: AssistantSession): AiRunSurface {
  const log = document.createElement("div");
  return {
    panel: document.createElement("div"),
    log,
    sendButton: document.createElement("button"),
    controller: { session, auditHistory: [], statusTimeline: [] },
    turnBusy: false,
    disposed: false,
    abortNoticeShown: false,
    activeAbortController: null,
    collapseAfterAiWork: false,
    collapsed: false,
    conversationId: "retire",
    conversationScope: "retire-scope",
    runningPhaseStatus: null,
    runningProgress: null,
    setStatus: vi.fn((_text: string, _record?: boolean) => {}),
    beginTurnProgress: vi.fn(() => {}),
    endTurnProgress: vi.fn(() => {}),
    refreshRunningStatus: vi.fn((_record?: boolean) => {}),
    refreshAbortButton: vi.fn(() => {}),
    startLiveActivity: vi.fn((_toolName: string, _index: number) => {}),
    completeLiveActivity: vi.fn((_toolName: string, _result: ToolResult, _args?: Record<string, unknown>) => {}),
    expandForAiWork: vi.fn(() => {}),
    scheduleCollapseAfterAiWork: vi.fn(() => {}),
    notifyIfObscuredByTestPlay: vi.fn(() => {}),
    drainPendingSends: vi.fn(() => {}),
    persistConversation: vi.fn((_target?: ConversationPersistTarget) => {}),
    sendText: vi.fn(async (_text: string, _displayAs?: string, _opts?: { readonly replay?: boolean }) => {}),
    appendBubble: (_role: AiBubbleRole, text: string) => {
      const bubble = document.createElement("div");
      bubble.textContent = text;
      log.append(bubble);
      return bubble;
    },
    appendReasoning: () => {
      const box = document.createElement("div");
      const body = document.createElement("div");
      return { box, body };
    },
    closeToolActivity: vi.fn(() => {}),
    clearLastReasoning: vi.fn(() => {}),
    isLastReasoningBox: vi.fn((_node: HTMLElement) => false),
  };
}

function setup() {
  const session = new AssistantSession(store.getCurrent(), { config: defaultAiConfig() });
  const surface = createSurface(session);
  const deps: AiTurnRunnerDeps = {
    surface,
    applyingProposal: false,
    projectIdentityId: "retire",
    workPlanSurfaceState: null,
    applyProposal: vi.fn<AiTurnRunnerDeps["applyProposal"]>(async () => "applied"),
    beginWorkPlanTurn: vi.fn(),
    showAcceptance: vi.fn(),
    noteNoChanges: vi.fn(),
    settleWorkPlanTurn: vi.fn(),
    refreshWorkPlanSurface: vi.fn(),
    showWorkPlan: vi.fn(),
    noteWorkPlanActivity: vi.fn(),
    appendMilestoneFeedLine: vi.fn(),
    appendTileThumbs: vi.fn(),
    appendTileGrid: vi.fn(),
    appendAiDocument: vi.fn(),
    hasPendingQuestion: () => false,
    openAiSettings: vi.fn(),
    renderQuickReplies: vi.fn(),
    refreshContextMeter: vi.fn(),
  };
  return { session, surface, deps, runner: createAiTurnRunner(deps) };
}

function switchExecution(): RequestExecution {
  return { requestId: "request-1", state: "project-switch", segment: 6, rounds: 1, roundCap: 1 };
}

function switchResult(execution: RequestExecution): TurnResult {
  return { assistantText: "retired", proposedCalls: [], stoppedReason: "aborted", execution };
}

function expectRecordedExecution(record: AiActivityLogInput, execution: RequestExecution): void {
  const recordedExecution = record.result.execution;
  if (recordedExecution === undefined) {
    throw new Error("Missing execution on orphaned activity");
  }
  expect(recordedExecution).toEqual(execution);
  expect(recordedExecution.state).toBe("project-switch");
}

async function nextOrphaned(): Promise<AiActivityLogInput> {
  let resolve!: (input: AiActivityLogInput) => void;
  const orphaned = new Promise<AiActivityLogInput>(done => { resolve = done; });
  observed.activity.mockImplementation(async (input) => {
    if (input.result.orphaned === true) resolve(input);
    return recordedActivity(input);
  });
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([orphaned, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error("Missing subscribed orphaned activity")), 5_000);
    })]);
  } finally { clearTimeout(deadline); }
}

describe("panel owner retirement activity", () => {
  it("RED/GREEN C4-panel-retire: replacing activeAbortController still records result.execution on the orphaned terminal", async () => {
    const h = setup();
    const execution = switchExecution();
    const orphaned = nextOrphaned();
    await h.runner.executeTurn(h.session, "Resize current map to 22x17", async () => {
      h.surface.activeAbortController = new AbortController();
      return switchResult(execution);
    });
    const record = await orphaned;
    expect(record.result.stoppedReason).toBe("aborted");
    expectRecordedExecution(record, execution);
  });

  it("C4-panel-retire-harness-fallback: session snapshot execution is copied when the returned result omitted it", async () => {
    const h = setup();
    const execution = switchExecution();
    vi.spyOn(h.session, "getHarnessSnapshot").mockReturnValue({
      model: "stub", maxTokens: 512, messages: [], audit: [], workPlan: null, runEndProof: undefined,
      requests: [], execution,
    });
    const orphaned = nextOrphaned();
    await h.runner.executeTurn(h.session, "Resize current map to 22x17", async () => {
      h.surface.activeAbortController = new AbortController();
      return { assistantText: "retired", proposedCalls: [], stoppedReason: "aborted" };
    });
    const record = await orphaned;
    expectRecordedExecution(record, execution);
  });
});
