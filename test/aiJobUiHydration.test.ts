// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY } from "@/ai/llmClient";
import { openDatabaseAiGenerateDialog } from "@/editor/panels/databaseAiGenerateDialog";
import { openRegionTaskModal, closeRegionTaskModal } from "@/editor/panels/regionTaskModal";
import { openClusterAiModal } from "@/editor/panels/clusterAiModal";
import { submitTilesetJob } from "@/editor/aiJobs/submitTilesetJob";
import { renderAiChatPanel, teardownAiChatPanel } from "@/editor/panels/aiChatPanel";
import { resetAiConnectionStatusCache } from "@/editor/panels/aiConnectionStatus";
import { renderEventAiAssist } from "@/editor/panels/eventEditor/aiAssist";
import { openStructureKitEditor } from "@/editor/panels/structureKitEditorDialog";
import { registerStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import type { SectionStructureKitDef } from "@/project/types";
import {
  answerTilesetAiQuestion,
  conversationSnapshot,
  resetTilesetAiConversation,
} from "@/editor/tilesetAiConversationSession";
import {
  resetTilesetAiReviewSessions,
  runTilesetAiReview,
  tilesetAiReviewState,
} from "@/editor/tilesetAiNativeReviewSession";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { deferred, installAdmitClient, PNG_DATA_URL, whenDom, whenTestId } from "./aiJobAdmitSupport";

vi.mock("@/editor/panels/tilesetAiTempMapImage", () => ({
  renderTilesetAtlasImage: async () => PNG_DATA_URL,
}));

vi.mock("@/editor/harnessSuggestion/kitRender", () => ({
  renderTileCellsToCanvas: () => document.createElement("canvas"),
}));

vi.mock("@/editor/panels/tilesetAiCpenClient", async importOriginal => {
  const actual = await importOriginal<typeof import("@/editor/panels/tilesetAiCpenClient")>();
  return { ...actual, hasCpenTilesetApiKey: () => true };
});

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  resetTilesetAiReviewSessions();
  resetTilesetAiConversation();
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
  closeRegionTaskModal();
  teardownAiChatPanel();
  document.body.replaceChildren();
  resetTilesetAiReviewSessions();
  resetTilesetAiConversation();
  resetAiConnectionStatusCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function seedFenceGroup(): void {
  store.update(project => {
    const tileset = project.tilesets[DEFAULT_TILESET_ID];
    if (!tileset) return;
    tileset.tileGroups = [{
      defaultLayer: "lower",
      description: "나무 울타리",
      id: "fence-main",
      name: "울타리",
      placementRules: "경계선에 배치",
      role: "fence",
      tileIds: [1, 2, 3],
    }];
  });
}

it("cluster hydrates transcript, quick replies and guarded Apply from the durable job result", async () => {
  seedFenceGroup();
  const apply = vi.spyOn(harness.client, "apply").mockResolvedValue({
    application: "applied",
    save: "unsaved",
  });
  const pending = harness.nextAdmitted();
  openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
  await pending;
  const job = harness.lastJob();
  const proposal = whenDom(document.body, () => document.querySelector('[data-testid="cluster-ai-proposal"]') !== null);
  await harness.complete({
    assistantText: "울타리를 고쳤습니다. [선택지] 더 높게|그대로",
    proposedCalls: [{
      name: "upsert_tile_group",
      summary: "울타리 그룹 갱신",
      destructive: false,
      args: { tilesetId: DEFAULT_TILESET_ID, name: "울타리" },
      result: { ok: true, summary: "ok" },
    }],
  }, job.id);
  await proposal;
  expect(document.querySelector('[data-testid="cluster-ai-log"]')?.textContent).toContain("울타리를 고쳤습니다");
  expect(document.querySelector('[data-testid="cluster-ai-choice"]')?.textContent).toBe("더 높게");
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-accept"]')?.click();
  await whenDom(document.body, () => apply.mock.calls.length > 0);
  expect(apply).toHaveBeenCalledWith(job.id, { approved: true, excludedRowIds: [] });
});

it("cluster/tileset fingerprint keeps one key for uncertain retry and a new key for changed instructions", async () => {
  seedFenceGroup();
  const owner = {};
  harness.failNext("uncertain-ack");
  const failed = harness.nextAdmitted();
  await submitTilesetJob({
    operation: "cluster-edit",
    tilesetId: DEFAULT_TILESET_ID,
    groupId: "fence-main",
    instruction: "울타리를 두껍게",
  }, { owner }).catch(() => undefined);
  await failed.catch(() => undefined);
  expect(harness.keys).toHaveLength(1);
  const frozen = harness.keys[0];
  const retry = harness.nextAdmitted();
  await submitTilesetJob({
    operation: "cluster-edit",
    tilesetId: DEFAULT_TILESET_ID,
    groupId: "fence-main",
    instruction: "울타리를 두껍게",
  }, { owner });
  await retry;
  expect(harness.keys[1]).toBe(frozen);
  const changed = harness.nextAdmitted();
  await submitTilesetJob({
    operation: "cluster-edit",
    tilesetId: DEFAULT_TILESET_ID,
    groupId: "fence-main",
    instruction: "울타리를 낮게",
  }, { owner });
  await changed;
  expect(harness.keys[2]).not.toBe(frozen);
  expect(String(harness.admits[2]?.input.payload.instruction)).toContain("울타리를 낮게");
});

it("cluster does not hydrate a closed owner's result into a later modal", async () => {
  seedFenceGroup();
  const first = harness.nextAdmitted();
  openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
  await first;
  const firstJob = harness.lastJob();
  document.querySelector<HTMLButtonElement>('[data-testid="cluster-ai-modal-close"]')?.click();
  await harness.complete({ assistantText: "닫힌 모달 전용 결과", proposedCalls: [] }, firstJob.id);
  const second = harness.nextAdmitted();
  openClusterAiModal({ kind: "cluster-edit", tilesetId: DEFAULT_TILESET_ID, groupId: "fence-main" });
  await second;
  expect(document.querySelector('[data-testid="cluster-ai-log"]')?.textContent).not.toContain("닫힌 모달 전용 결과");
});

it("database generate hydrates record facts from the durable result without applying", async () => {
  const before = store.getCurrent().database.items.map(item => item.id);
  const dialog = openDatabaseAiGenerateDialog({ kind: "item", rerender: () => undefined });
  document.body.append(dialog);
  const brief = dialog.querySelector<HTMLTextAreaElement>('[data-testid="db-ai-generate-brief"]');
  const run = dialog.querySelector<HTMLButtonElement>('[data-testid="db-ai-generate-run"]');
  if (!brief || !run) throw new Error("missing generate controls");
  brief.value = "ZXQ-허브-테스트-아이템";
  const pending = harness.nextAdmitted();
  run.click();
  await pending;
  expect(store.getCurrent().database.items.map(item => item.id)).toEqual(before);
  const named = whenDom(dialog, () => (dialog.querySelector(".db-ai-generate-result-name")?.textContent ?? "") === "Task8 Fixture Potion");
  await harness.complete({
    kind: "item",
    recordId: "item_task8_potion",
    name: "Task8 Fixture Potion",
    record: { id: "item_task8_potion", name: "Task8 Fixture Potion", price: 37, type: "item", occasion: "always" },
    summary: "AI 아이템 생성: Task8 Fixture Potion",
  });
  await named;
  expect(dialog.textContent).toContain("37G");
  expect(dialog.querySelector('[data-testid="ai-job-origin-open"]')).toBeTruthy();
  expect(store.getCurrent().database.items.map(item => item.id)).toEqual(before);
  expect(run.textContent).toContain("하나 더");
});

it("region modal default runner admits a region job and exposes the report link", async () => {
  const mapId = store.getCurrent().startMapId;
  const root = openRegionTaskModal({ mapId, region: { x: 1, y: 2, width: 3, height: 4 } });
  document.body.append(root);
  const input = root.querySelector<HTMLTextAreaElement>('[data-testid="region-task-input"]');
  const run = root.querySelector<HTMLButtonElement>('[data-testid="region-task-run"]');
  if (!input || !run) throw new Error("missing region controls");
  input.value = "이 맵 입구에 길을 놓아 주세요";
  const pending = harness.nextAdmitted();
  run.click();
  const admitted = await pending;
  expect(admitted.input.family).toBe("region");
  expect(admitted.input.target).toMatchObject({ mapId, region: { x: 1, y: 2, width: 3, height: 4 } });
  await whenTestId(root, "ai-job-origin-open");
});

it("answerTilesetAiQuestion admits question-followup with the remembered sourceJobId", async () => {
  const tilesetId = Object.keys(store.getCurrent().tilesets)[0] ?? "";
  const tileset = store.getCurrent().tilesets[tilesetId];
  if (!tileset) throw new Error("missing tileset");
  const ready = deferred<void>();
  const pendingAnalysis = harness.nextAdmitted();
  const reviewRun = runTilesetAiReview(tileset, () => {
    if (tilesetAiReviewState(tileset).status === "ready") ready.resolve();
  });
  const analysis = await pendingAnalysis;
  expect(analysis.input.payload.operation).toBe("knowledge-analysis");
  const analysisJob = harness.lastJob();
  const columns = tileset.tilesPerRow;
  await harness.complete({
    tilesetId,
    fingerprint: tilesetKnowledgeFingerprint(tileset),
    status: "ready",
    summary: "Controlled captured atlas review",
    warnings: [],
    proposals: [{
      id: "cliff",
      name: "반복 절벽",
      tileIds: [0, 1, columns, columns + 1],
      confidence: 0.72,
      cellLayers: null,
      template: "repeatable-cliff-2x3",
      status: "pending",
      feedback: "",
      description: "2x3 cliff",
      evidence: "Two rows of cliff faces",
      question: "가로로 이어 붙이는 패턴인가요?",
      quickReplies: ["가로로만 반복", "가로·세로 모두 반복"],
      placementRules: "",
      passage: { down: false, up: false, left: false, right: false },
    }],
  }, analysisJob.id);
  await ready.promise;
  await reviewRun;
  expect(conversationSnapshot(tileset).current?.id).toBe("cliff");
  const pendingFollowup = harness.nextAdmitted();
  await answerTilesetAiQuestion(tileset, "가로로만 반복", () => undefined);
  const followup = await pendingFollowup;
  expect(followup.input.family).toBe("tileset");
  expect(followup.input.payload.operation).toBe("question-followup");
  expect(followup.input.payload.sourceJobId).toBe(analysisJob.id);
  expect(followup.input.dependsOn).toEqual([analysisJob.id]);
  expect(followup.input.payload.answer).toBe("가로로만 반복");
});

it("chat send hydrates assistant text and keeps the report reachable from the origin", async () => {
  const panel = renderAiChatPanel();
  document.body.append(panel);
  const input = panel.querySelector<HTMLTextAreaElement>('[data-testid="ai-input"]');
  const send = panel.querySelector<HTMLButtonElement>('[data-testid="ai-send"]');
  if (!input || !send) throw new Error("missing chat controls");
  input.value = "마을 입구를 만들어 주세요";
  const pending = harness.nextAdmitted();
  send.click();
  const admitted = await pending;
  expect(admitted.input.family).toBe("assistant");
  expect(admitted.input.mode).toBe("auto");
  expect(admitted.input.payload.turn).toMatchObject({ autonomous: true });
  await whenTestId(panel, "ai-job-origin-open");
  const reply = whenDom(panel, () => (panel.textContent ?? "").includes("Controlled chat reply"));
  await harness.complete({
    assistantText: "Controlled chat reply. [선택지] 더 크게|그대로",
  });
  await reply;
  expect(panel.textContent).toContain("Controlled chat reply");
  const firstKey = harness.keys[0];
  input.value = "이어서 지붕을 달아 주세요";
  const continued = harness.nextAdmitted();
  send.click();
  const next = await continued;
  expect(next.input.mode).toBe("auto");
  expect(next.input.payload.instruction).toBe("이어서 지붕을 달아 주세요");
  expect(harness.keys[1]).not.toBe(firstKey);
});

it("event assist admits an event-commands job and exposes the report link", async () => {
  const mapId = store.getCurrent().startMapId;
  const page = {
    id: "page-1",
    name: "EV001",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" as const },
    priority: "same" as const,
    movement: { type: "fixed" as const, speed: 3, frequency: 3 },
    commands: [],
  };
  store.update(project => {
    const map = project.maps[mapId];
    if (!map) return;
    map.events = [{
      id: "event-1",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: [page],
    }];
  });
  const panel = renderEventAiAssist({
    mapId,
    eventId: "event-1",
    page,
    cmdList: document.createElement("div"),
    stagedHost: document.createElement("div"),
    refreshListVisibility: () => undefined,
    replaceAll: () => undefined,
  });
  document.body.append(panel);
  const input = panel.querySelector<HTMLTextAreaElement>('[data-testid="ai-event-input"]');
  const run = panel.querySelector<HTMLButtonElement>('[data-testid="ai-event-generate"]');
  if (!input || !run) throw new Error("missing event assist");
  input.value = "말풍선을 추가해 주세요";
  const pending = harness.nextAdmitted();
  run.click();
  const admitted = await pending;
  expect(admitted.input.family).toBe("event-commands");
  expect(admitted.input.payload.prompt).toBe("말풍선을 추가해 주세요");
  await whenTestId(panel, "ai-job-origin-open");
});

it("structure kit AI draft fills an unchanged form and does not overwrite a later human edit", async () => {
  const kit: SectionStructureKitDef = {
    id: "kit_fill",
    kind: "section",
    name: "우물",
    width: 3,
    height: 3,
    rows: [{ tiles: [240, 240, 240] }, { tiles: [240, 116, 240] }, { tiles: [240, 240, 240] }],
    learnedFrom: "db-authored",
  };
  registerStructureKit(DEFAULT_TILESET_ID, kit);
  openStructureKitEditor(DEFAULT_TILESET_ID, "kit_fill", () => undefined);
  const tab = document.querySelector<HTMLButtonElement>('[data-testid="structure-kit-editor-tab-ai"]');
  if (!tab) throw new Error("missing kit AI tab");
  tab.click();
  const draftButton = document.querySelector<HTMLButtonElement>('[data-testid="structure-kit-editor-ai-draft"]');
  if (!draftButton) throw new Error("missing kit AI draft");
  const pending = harness.nextAdmitted();
  draftButton.click();
  const admitted = await pending;
  expect(admitted.input.payload.operation).toBe("structure-kit-metadata");
  const filled = whenDom(document.body, () =>
    document.querySelector<HTMLTextAreaElement>('[data-testid="structure-kit-editor-ai-description"]')?.value === "돌담을 두른 두레우물",
  );
  await harness.complete({
    metadata: { description: "돌담을 두른 두레우물", placementRules: "마을 광장에 둔다", tags: ["fixture"] },
  });
  await filled;
  const description = document.querySelector<HTMLTextAreaElement>('[data-testid="structure-kit-editor-ai-description"]');
  if (!description) throw new Error("missing kit description");
  const nextDraft = document.querySelector<HTMLButtonElement>('[data-testid="structure-kit-editor-ai-draft"]');
  if (!nextDraft) throw new Error("missing kit AI draft after fill");
  const pendingEdit = harness.nextAdmitted();
  nextDraft.click();
  await pendingEdit;
  description.value = "사람이 고친 초안";
  description.dispatchEvent(new Event("change"));
  await harness.complete({
    metadata: { description: "AI가 쓴 우물", placementRules: "광장", tags: ["fixture"] },
  });
  await whenDom(document.body, () =>
    document.querySelector<HTMLTextAreaElement>('[data-testid="structure-kit-editor-ai-description"]')?.value === "사람이 고친 초안",
  );
});
