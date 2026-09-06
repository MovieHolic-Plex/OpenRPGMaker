import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type TurnResult } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { agentBlueprintForMap, clearAgentBlueprint, getAgentBlueprintState, syncAgentBlueprintWithSpec } from "@/editor/agentBlueprint";
import { appendAgentGhostPreviewForToolCall, clearAgentGhostPreview, getAgentGhostPreviewState, setAgentGhostRunningTool, replaceAgentGhostPreviewFromProjectDiff, getAgentGhostDraftMap } from "@/editor/agentGhostPreview";
import { getPendingRegionApply, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

const observed = vi.hoisted(() => ({ activity: vi.fn(async () => ({})), gate: vi.fn() }));
vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(), recordAiActivity: observed.activity,
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: observed.gate }));

const spec = {
  mapId: "map_blank_start", title: "plan",
  assets: [{ id: "house", kind: "house", x: 4, y: 4, w: 6, h: 5 }],
};
let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  clearAgentBlueprint(); clearAgentGhostPreview(); observed.activity.mockClear();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
});
afterEach(() => {
  getPendingRegionApply()?.discard();
  clearAgentBlueprint(); clearAgentGhostPreview(); restoreDom?.(); vi.restoreAllMocks();
});

function setup() {
  const session = new AssistantSession(store.getCurrent(), { config: defaultAiConfig() });
  vi.spyOn(session, "getActiveSpec").mockReturnValue(spec);
  const audit = session.getAuditEntries();
  const log = document.createElement("div");
  const appendBubble = (_role: unknown, text: string) => {
    const bubble = document.createElement("div"); bubble.textContent = text; log.append(bubble); return bubble;
  };
  const surface = {
    panel: document.createElement("div"), log, sendButton: document.createElement("button"),
    controller: { session, auditHistory: [] }, turnBusy: false, disposed: false, collapsed: false,
    conversationId: "cleanup", conversationScope: "cleanup-scope", appendBubble,
    setStatus: vi.fn(), expandForAiWork: vi.fn(), beginTurnProgress: vi.fn(), endTurnProgress: vi.fn(),
    refreshAbortButton: vi.fn(), persistConversation: vi.fn(), notifyIfObscuredByTestPlay: vi.fn(), drainPendingSends: vi.fn(),
  } as unknown as AiRunSurface;
  const deps = {
    surface, applyingProposal: false, projectIdentityId: "cleanup", workPlanSurfaceState: null,
    applyProposal: vi.fn<AiTurnRunnerDeps["applyProposal"]>(async () => "applied"),
    beginWorkPlanTurn: vi.fn(),
    noteNoChanges: vi.fn(), settleWorkPlanTurn: vi.fn(), refreshWorkPlanSurface: vi.fn(), showWorkPlan: vi.fn(),
    noteWorkPlanActivity: vi.fn(), appendMilestoneFeedLine: vi.fn(), appendTileThumbs: vi.fn(), appendTileGrid: vi.fn(),
    appendAiDocument: vi.fn(), hasPendingQuestion: () => false, openAiSettings: vi.fn(), renderQuickReplies: vi.fn(), refreshContextMeter: vi.fn(),
  } satisfies AiTurnRunnerDeps;
  return { session, audit, surface, deps, runner: createAiTurnRunner(deps) };
}

describe("assistant owner-turn presentation cleanup", () => {
  it.each(["final", "error", "aborted", "throw", "abort-throw"] as const)("retires visible planning on %s without changing retained data", async (ending) => {
    const h = setup();
    const before = store.getCurrent();
    const regionDraft = structuredClone(before);
    regionDraft.maps[spec.mapId].lowerTiles[0] += 1;
    const regionPreviews = replaceAgentGhostPreviewFromProjectDiff(before, regionDraft);
    expect(regionPreviews.length).toBeGreaterThan(0);
    const onDiscard = vi.fn();
    const pending = setPendingRegionApply({
      baseProject: before, clippedProject: regionDraft, mapId: spec.mapId,
      region: { x: 0, y: 0, width: 2, height: 2 }, changedCells: 0, changedEvents: 0,
      instruction: "independent region approval", getCurrentProject: () => store.getCurrent(),
      onApply: vi.fn(), onDiscard, onSettle: vi.fn(),
    });
    const visibleCounts: number[] = [];
    await h.runner.executeTurn(h.session, "inspect", async (onEvent) => {
      visibleCounts.push(agentBlueprintForMap(getAgentBlueprintState(), spec.mapId).length);
      appendAgentGhostPreviewForToolCall(before, "fill_region", { mapId: spec.mapId, rect: { x: 4, y: 4, w: 6, h: 5 } });
      setAgentGhostRunningTool("fill_region");
      onEvent({ type: "assistant_message", content: "retained answer" });
      if (ending === "abort-throw") h.surface.activeAbortController?.abort();
      if (ending === "throw" || ending === "abort-throw") throw new Error("scripted transport failure");
      return { assistantText: "retained answer", proposedCalls: [], stoppedReason: ending };
    }, { composerMode: "ask" });
    expect(getAgentBlueprintState().entries).toHaveLength(0);
    expect(getAgentGhostPreviewState()).toMatchObject({ previews: regionPreviews, runningToolName: "" });
    expect(getAgentGhostDraftMap(spec.mapId)).toBe(regionDraft.maps[spec.mapId]);
    expect(h.session.getActiveSpec()).toBe(spec);
    expect(h.session.getAuditEntries()).toEqual(h.audit);
    expect(store.getCurrent()).toBe(before);
    expect(getPendingRegionApply()).toBe(pending);
    expect(pending.settled).toBe(false);
    expect(onDiscard).not.toHaveBeenCalled();
    expect(h.surface.log.textContent).toContain("retained answer");
    expect(h.deps.applyProposal).not.toHaveBeenCalled();
    expect(observed.activity).toHaveBeenLastCalledWith(expect.objectContaining({ result: expect.objectContaining({ appliedCalls: 0 }) }));
    await h.runner.executeTurn(h.session, "follow-up", async () => {
      visibleCounts.push(agentBlueprintForMap(getAgentBlueprintState(), spec.mapId).length);
      return { assistantText: "follow-up answer", proposedCalls: [], stoppedReason: "final" };
    }, { composerMode: "ask" });
    expect(getAgentBlueprintState().entries).toHaveLength(0);
    expect(visibleCounts).toEqual([1, 0]);
  });

  it.each(["final", "error", "aborted", "throw", "abort-throw"] as const)("clears the owner ghost on %s when no region approval owns it", async (ending) => {
    const h = setup();
    await h.runner.executeTurn(h.session, "ghost", async () => {
      setAgentGhostRunningTool("fill_region");
      if (ending === "abort-throw") h.surface.activeAbortController?.abort();
      if (ending === "throw" || ending === "abort-throw") throw new Error("scripted failure");
      return { assistantText: "answer", proposedCalls: [], stoppedReason: ending };
    }, { composerMode: "ask" });
    expect(getAgentGhostPreviewState()).toMatchObject({ previews: [], runningToolName: "" });
    expect(getAgentGhostDraftMap(spec.mapId)).toBeUndefined();
  });

  it.each(["applied", "rejected"] as const)("retires after an %s proposal without altering outcome accounting", async (outcome) => {
    const h = setup();
    h.deps.applyProposal.mockResolvedValue(outcome);
    const result: TurnResult = {
      assistantText: "answer", stoppedReason: "final",
      proposedCalls: [{ name: "set_title_screen", args: { title: "title" }, destructive: false, summary: "title", result: { ok: true, summary: "title" } }],
    };
    await h.runner.executeTurn(h.session, "title", async () => result, { composerMode: "ask" });
    expect(getAgentBlueprintState().entries).toHaveLength(0);
    expect(h.deps.applyProposal).toHaveBeenCalledWith(result.proposedCalls, expect.anything());
    expect(observed.activity).toHaveBeenLastCalledWith(expect.objectContaining({ result: expect.objectContaining({ appliedCalls: outcome === "applied" ? 1 : 0 }) }));
  });

  it("retires unseen automatic spec expansion before a follow-up turn can sync it", async () => {
    const h = setup();
    await h.runner.executeTurn(h.session, "expand", async () => {
      vi.mocked(h.session.getActiveSpec).mockReturnValue({
        ...spec, assets: [...spec.assets, { id: "new", kind: "house", x: 12, y: 4, w: 6, h: 5 }],
      });
      return { assistantText: "answer", proposedCalls: [], stoppedReason: "final" };
    }, { composerMode: "ask" });
    const observedCounts: number[] = [];
    await h.runner.executeTurn(h.session, "follow-up", async () => {
      observedCounts.push(agentBlueprintForMap(getAgentBlueprintState(), spec.mapId).length);
      return { assistantText: "answer", proposedCalls: [], stoppedReason: "final" };
    }, { composerMode: "ask" });
    expect(observedCounts).toEqual([0]);
  });

  it("an orphaned completion cannot retire its replacement turn's blueprint", async () => {
    const h = setup();
    await h.runner.executeTurn(h.session, "old", async () => {
      h.surface.activeAbortController = new AbortController();
      setAgentGhostRunningTool("replacement-tool");
      return { assistantText: "old", proposedCalls: [], stoppedReason: "final" };
    });
    expect(getAgentGhostPreviewState().runningToolName).toBe("replacement-tool");
    expect(getAgentBlueprintState().entries).toHaveLength(1);
    syncAgentBlueprintWithSpec(spec);
    expect(agentBlueprintForMap(getAgentBlueprintState(), spec.mapId)).toHaveLength(1);
  });
});
