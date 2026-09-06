import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import {
  clearAgentGhostPreview,
  getAgentGhostDraftMap,
  setAgentGhostDraftMapProvider,
  subscribeAgentGhostPreview,
} from "@/editor/agentGhostPreview";
import { createAiTurnRunner, type AiTurnRunnerDeps } from "@/editor/panels/aiTurnRunner";
import type { AiRunSurface } from "@/editor/panels/aiRunSurface";
import { getPendingRegionApply, setPendingRegionApply } from "@/editor/regionTask/pendingRegionApply";
import { createBlankProject, TILE } from "@/project/defaults";
import type { GameMap } from "@/project/types";
import { store } from "@/project/store";
import { installFakeDom } from "./fakeDom";

vi.mock("@/ai/activityLog", async (original) => ({
  ...await original<typeof import("@/ai/activityLog")>(),
  recordAiActivity: vi.fn(async () => ({})),
}));
vi.mock("@/ai/preferenceSignals", () => ({ observeTurn: () => ({}), shouldDistillPreferences: () => false }));
vi.mock("@/editor/ui/aiGateModal", () => ({ showAiGateNotice: vi.fn() }));

let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  clearAgentBlueprint();
  clearAgentGhostPreview();
  setAgentGhostDraftMapProvider(null);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
});
afterEach(() => {
  getPendingRegionApply()?.discard();
  clearAgentBlueprint();
  clearAgentGhostPreview();
  setAgentGhostDraftMapProvider(null);
  restoreDom?.();
  vi.restoreAllMocks();
});

function setup() {
  const session = new AssistantSession(store.getCurrent(), { config: defaultAiConfig() });
  const log = document.createElement("div");
  const surface: AiRunSurface = {
    panel: document.createElement("div"), log, sendButton: document.createElement("button"),
    controller: { session, auditHistory: [], statusTimeline: [] },
    turnBusy: false, disposed: false, collapsed: false, abortNoticeShown: false,
    activeAbortController: null, collapseAfterAiWork: false, runningPhaseStatus: null, runningProgress: null,
    conversationId: "region-handoff", conversationScope: "region-handoff-scope",
    setStatus: vi.fn(), beginTurnProgress: vi.fn(), endTurnProgress: vi.fn(), refreshRunningStatus: vi.fn(),
    refreshAbortButton: vi.fn(), startLiveActivity: vi.fn(), completeLiveActivity: vi.fn(),
    expandForAiWork: vi.fn(), scheduleCollapseAfterAiWork: vi.fn(), notifyIfObscuredByTestPlay: vi.fn(),
    drainPendingSends: vi.fn(), persistConversation: vi.fn(), sendText: vi.fn(async () => {}),
    appendBubble: (_role, text) => {
      const bubble = document.createElement("div");
      bubble.textContent = text;
      log.append(bubble);
      return bubble;
    },
    appendReasoning: () => ({ box: document.createElement("div"), body: document.createElement("div") }),
    closeToolActivity: vi.fn(), clearLastReasoning: vi.fn(), isLastReasoningBox: () => false,
  };
  const deps: AiTurnRunnerDeps = {
    surface, applyingProposal: false, projectIdentityId: "region-handoff", workPlanSurfaceState: null,
    applyProposal: vi.fn(async () => "applied"), noteNoChanges: vi.fn(),
    settleWorkPlanTurn: vi.fn(), refreshWorkPlanSurface: vi.fn(), showWorkPlan: vi.fn(),
    noteWorkPlanActivity: vi.fn(), appendMilestoneFeedLine: vi.fn(), appendTileThumbs: vi.fn(), appendTileGrid: vi.fn(),
    appendAiDocument: vi.fn(), hasPendingQuestion: () => false, openAiSettings: vi.fn(),
    renderQuickReplies: vi.fn(), refreshContextMeter: vi.fn(),
  };
  return { session, surface, runner: createAiTurnRunner(deps) };
}

describe("pending region preview handoff", () => {
  it.each(["final", "error", "aborted", "throw", "abort-throw"] as const)(
    "supplies the region water neighborhood during the restoration notification after %s",
    async (ending) => {
      const { session, surface, runner } = setup();
      const base = store.getCurrent();
      const mapId = base.startMapId;
      const draft = structuredClone(base);
      const regionMap = draft.maps[mapId];
      const waterCells = [
        [4, 4], [5, 4], [6, 4],
        [4, 5], [5, 5], [6, 5],
        [4, 6], [5, 6], [6, 6],
      ];
      for (const [x, y] of waterCells) regionMap.lowerTiles[y * regionMap.width + x] = TILE.WATER;
      const pending = setPendingRegionApply({
        baseProject: base, clippedProject: draft, mapId,
        region: { x: 4, y: 4, width: 3, height: 3 }, changedCells: 9, changedEvents: 0,
        instruction: "pond", getCurrentProject: () => store.getCurrent(),
        onApply: vi.fn(), onDiscard: vi.fn(), onSettle: vi.fn(),
      });
      clearAgentGhostPreview();
      const notifications: { map: GameMap | undefined; cells: (number | undefined)[][]; neighborhood: (number | undefined)[] }[] = [];
      // Like EditScene, read the provider synchronously when the preview is published.
      // A later getter would miss the stale map used to build/cache the tile layer.
      const unsubscribe = subscribeAgentGhostPreview((state) => {
        if (state.previews.length === 0) return;
        const map = getAgentGhostDraftMap(mapId);
        notifications.push({
          map,
          cells: state.previews.flatMap((preview) => preview.cells.map(({ x, y, tileId }) => [x, y, tileId])),
          neighborhood: waterCells.map(([x, y]) => map?.lowerTiles[y * map.width + x]),
        });
      });
      try {
        await runner.executeTurn(session, "inspect", async () => {
          if (ending === "abort-throw") surface.activeAbortController?.abort();
          if (ending === "throw" || ending === "abort-throw") throw new Error("scripted transport failure");
          return { assistantText: "", proposedCalls: [], stoppedReason: ending };
        }, { composerMode: "ask" });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].cells).toEqual(waterCells.map(([x, y]) => [x, y, TILE.WATER]));
        expect(notifications[0].neighborhood).toEqual(Array(9).fill(TILE.WATER));
        expect(notifications[0].map).toBe(regionMap);
        expect(getPendingRegionApply()).toBe(pending);
        expect(pending.settled).toBe(false);
        expect(store.getCurrent()).toBe(base);
      } finally {
        unsubscribe();
      }
    },
  );
});
