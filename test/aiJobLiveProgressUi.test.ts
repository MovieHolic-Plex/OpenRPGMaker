// @vitest-environment happy-dom
//
// Live progress UI binding. The queue's public surface never streams progress
// (LIVE-PROGRESS-HANDOFF.md): the running job's session observation lives inside the durable
// checkpoint blob, so these cases publish a real checkpoint and assert the chat panel and the
// queue row read it through `bindJobProgress`. Every case subscribes to its exact signal
// before triggering; no sleeps and no polling.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import type { SessionProgress } from "@/ai/jobs/sessionProgress";
import type { WorkPlan } from "@/ai/workPlan";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { closeJobQueue, openJobQueue } from "@/editor/aiJobs/jobQueuePanel";
import { readJobProgress } from "@/editor/aiJobs/jobProgress";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installAdmitClient, whenDom, whenTestId } from "./aiJobAdmitSupport";

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  resetAiConnectionStatusCache();
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    authMode: "apiKey",
    apiKey: "test-key",
    baseUrl: "https://example.test",
    maxTokens: 1024,
    model: "gpt-5.6-sol",
    liteModel: "gpt-5.4-mini",
    reasoningEffort: "medium",
  }));
  harness = installAdmitClient();
});

afterEach(() => {
  closeJobQueue();
  teardownAiChatPanel();
  document.body.replaceChildren();
  resetAiConnectionStatusCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function plan(status: "in_progress" | "done" = "in_progress"): WorkPlan {
  return {
    id: "plan-live",
    goal: "마을 입구 정비",
    createdAt: new Date(1700000000000).toISOString(),
    layers: [{
      id: "layer-1",
      title: "1단계",
      items: [{ id: "item-1", title: "길 놓기", instruction: "paint_road", status }],
    }],
    currentLayerIndex: 0,
    currentItemId: "item-1",
  };
}

function progress(overrides: Partial<SessionProgress> = {}): SessionProgress {
  return {
    version: 1,
    revision: 6,
    turnIndex: 1,
    workPlan: plan(),
    phase: "execute",
    currentTool: { turnIndex: 1, index: 2, name: "paint_road" },
    recentActivity: [
      { id: 3, turnIndex: 1, kind: "tool", index: 1, name: "get_project_summary", ok: true, summary: "맵 3개를 읽었습니다", truncated: false },
      { id: 5, turnIndex: 1, kind: "milestone", summary: "1단계 저장", truncated: false },
    ],
    omittedActivityCount: 0,
    budget: { rounds: { used: 3, total: 12 }, driverContinuations: { used: 5, total: 48, exhausted: false } },
    usage: null,
    ...overrides,
  };
}

async function admitChatTurn(): Promise<{ panel: HTMLElement; jobId: string }> {
  const panel = renderAiChatPanel();
  document.body.append(panel);
  const input = panel.querySelector<HTMLTextAreaElement>('[data-testid="ai-input"]');
  const send = panel.querySelector<HTMLButtonElement>('[data-testid="ai-send"]');
  if (!input || !send) throw new Error("missing chat controls");
  input.value = "마을 입구를 만들어 주세요";
  const pending = harness.nextAdmitted();
  send.click();
  await pending;
  await whenTestId(panel, "ai-job-origin-open");
  return { panel, jobId: harness.lastJob().id };
}

it("reads family-nested session progress from the verified running checkpoint", async () => {
  await admitChatTurn();
  const job = await harness.running(progress());
  const snapshot = await readJobProgress(job.id, harness.client);
  if (!snapshot) throw new Error("expected a progress snapshot");
  expect(snapshot.live).toBe(true);
  expect(snapshot.attemptId).toBe(job.activeAttemptId);
  expect(snapshot.progress.currentTool?.name).toBe("paint_road");
  expect(snapshot.progress.budget.rounds).toEqual({ used: 3, total: 12 });
});

it("binds a running job's live plan, current tool, activity and both budget axes into the chat surface", async () => {
  const { panel } = await admitChatTurn();
  const painted = whenDom(panel, () => panel.querySelector('[data-testid="ai-job-current-tool"]') !== null);
  await harness.running(progress());
  await painted;

  const checklist = panel.querySelector<HTMLElement>('[data-testid="ai-work-plan-checklist"]');
  if (!checklist) throw new Error("missing live work plan checklist");
  expect(checklist.dataset.active).toBe("true");
  expect(checklist.querySelector('[data-testid="ai-run-stop"]')).not.toBeNull();
  expect(panel.querySelector('[data-testid="ai-autonomous-goal"]')?.textContent).toBe("마을 입구 정비");

  const tool = panel.querySelector<HTMLElement>('[data-testid="ai-job-current-tool"]');
  expect(tool?.dataset.live).toBe("true");
  expect(tool?.textContent).toContain("중…");

  // Session rounds and driver continuations are separate facts — separate chips.
  expect(panel.querySelector('[data-testid="ai-run-rounds"]')?.textContent).toBe("라운드 3/12");
  expect(panel.querySelector('[data-testid="ai-autonomous-budget"]')?.textContent).toBe("예산 5/48");

  const activity = [...panel.querySelectorAll('[data-testid="ai-job-activity-line"]')].map(node => node.textContent ?? "");
  expect(activity).toHaveLength(2);
  expect(activity[0]).toContain("맵 3개를 읽었습니다");
  expect(activity[1]).toContain("1단계 저장");
  // Progress is text, never markup.
  expect(panel.querySelector('[data-testid="ai-job-activity-line"]')?.querySelector("img,script,a")).toBeNull();
});

it("renders a retained currentTool as history with no running animation or stop affordance when live is false", async () => {
  const { panel } = await admitChatTurn();
  const painted = whenDom(panel, () => panel.querySelector('[data-testid="ai-job-current-tool"]') !== null);
  // A replaying new attempt still exposes the previous attempt's retained checkpoint.
  await harness.running(progress(), { attemptId: "attempt-old", activeAttemptId: "attempt-new" });
  await painted;

  const tool = panel.querySelector<HTMLElement>('[data-testid="ai-job-current-tool"]');
  expect(tool?.dataset.live).toBe("false");
  expect(tool?.textContent).toContain("마지막 기록");
  expect(tool?.className).toContain("is-history");
  expect(tool?.textContent).not.toContain("중…");
  // The job itself is still running, so its own stop stays reachable — what must not appear is a
  // fresh starting-tool animation for a tool nobody is executing.
  const checklist = panel.querySelector<HTMLElement>('[data-testid="ai-work-plan-checklist"]');
  expect(checklist?.querySelector('[data-testid="ai-run-stop"]')).not.toBeNull();

  // Once the job goes terminal, both the tool history and the turn chrome must stop moving.
  const settled = whenDom(panel, () => panel.querySelector('[data-testid="ai-run-stop"]') === null);
  await harness.terminal("interrupted");
  await settled;
  const retained = panel.querySelector<HTMLElement>('[data-testid="ai-job-current-tool"]');
  expect(retained?.dataset.live).toBe("false");
  expect(panel.querySelector<HTMLElement>('[data-testid="ai-work-plan-checklist"]')?.dataset.active).toBe("false");
});

it("clears running and stop chrome on a terminal generation while the work plan stays inspectable", async () => {
  const { panel } = await admitChatTurn();
  const live = whenDom(panel, () => panel.querySelector('[data-testid="ai-run-stop"]') !== null);
  await harness.running(progress());
  await live;

  const settled = whenDom(panel, () => panel.querySelector('[data-testid="ai-run-stop"]') === null);
  await harness.terminal("interrupted");
  await settled;

  const checklist = panel.querySelector<HTMLElement>('[data-testid="ai-work-plan-checklist"]');
  if (!checklist) throw new Error("terminal work plan must stay inspectable");
  expect(checklist.dataset.active).toBe("false");
  expect(checklist.querySelector('[data-testid="ai-run-stop"]')).toBeNull();
  expect(panel.querySelector<HTMLElement>('[data-testid="ai-job-current-tool"]')?.dataset.live).toBe("false");
  expect(panel.querySelector('[data-testid="ai-autonomous-goal"]')?.textContent).toBe("마을 입구 정비");
});

it("drops a late snapshot resolved after the conversation changed owner", async () => {
  const { panel } = await admitChatTurn();
  const held = harness.holdNextArtifact();
  const publishing = harness.running(progress());
  await held.started;
  // 새 대화 — this conversation no longer owns the tracked job.
  const newSession = panel.querySelector<HTMLButtonElement>('[data-testid="ai-new-session"]');
  if (!newSession) throw new Error("missing new conversation control");
  newSession.click();
  held.release();
  await held.idle;
  await publishing;
  await whenTestId(panel, "ai-input");
  expect(panel.querySelector('[data-testid="ai-job-current-tool"]')).toBeNull();
  expect(panel.querySelector('[data-testid="ai-work-plan-checklist"]')).toBeNull();
});

it("shows one progress line on a running queue row and stops the binding when the queue closes", async () => {
  await admitChatTurn();
  const opener = document.createElement("button");
  document.body.append(opener);
  const queue = openJobQueue(opener, harness.client);
  if (!queue) throw new Error("missing job queue");
  const painted = whenDom(queue, () => (queue.querySelector('[data-testid="ai-job-row-progress"]')?.textContent ?? "") !== "");
  await harness.running(progress());
  await painted;
  const line = queue.querySelector<HTMLElement>('[data-testid="ai-job-row-progress"]');
  expect(line?.textContent).toBe("paint_road 실행 중 · 라운드 3/12 · 예산 5/48");

  closeJobQueue();
  expect(queue.isConnected).toBe(false);
  const before = line?.textContent;
  await harness.running(progress({ revision: 7, currentTool: { turnIndex: 1, index: 3, name: "place_props" } }));
  // The stopped binding must not paint the detached row from a later checkpoint.
  expect(line?.textContent).toBe(before);
});
