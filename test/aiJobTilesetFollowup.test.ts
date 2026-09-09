// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { rememberTilesetSourceJob, resetTilesetAiReviewSessions } from "@/editor/tilesetAiNativeReviewSession";
import { submitTilesetJob } from "@/editor/aiJobs/submitTilesetJob";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installAdmitClient } from "./aiJobAdmitSupport";

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  resetTilesetAiReviewSessions();
});

afterEach(() => {
  resetTilesetAiReviewSessions();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("question follow-up admits with sourceJobId and dependsOn of the predecessor analysis job", async () => {
  const harness = installAdmitClient();
  const tilesetId = Object.keys(store.getCurrent().tilesets)[0] ?? "";
  rememberTilesetSourceJob(tilesetId, "job-knowledge-1");
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAXgN1WQAAAABJRU5ErkJggg==";
  const pending = harness.nextAdmitted();
  await submitTilesetJob({
    operation: "question-followup",
    tilesetId,
    atlasDataUrl: png,
    review: {
      tilesetId,
      fingerprint: "fp",
      status: "ready",
      summary: "summary",
      warnings: [],
      proposals: [{
        id: "p1",
        name: "절벽",
        tileIds: [0],
        confidence: 0.5,
        cellLayers: null,
        template: "repeatable-cliff-2x3",
        status: "pending",
        feedback: "",
        description: "d",
        evidence: "e",
        question: "가로로 반복인가요?",
        quickReplies: [],
        placementRules: "",
        passage: { down: false, up: false, left: false, right: false },
      }],
    },
    proposalId: "p1",
    answer: "가로로만 반복",
    turns: [
      { role: "assistant", text: "가로로 반복인가요?", tone: "question" },
      { role: "user", text: "가로로만 반복", tone: "answer" },
    ],
    sourceJobId: "job-knowledge-1",
  });
  const admitted = await pending;
  expect(admitted.input.family).toBe("tileset");
  expect(admitted.input.payload.operation).toBe("question-followup");
  expect(admitted.input.payload.sourceJobId).toBe("job-knowledge-1");
  expect(admitted.input.dependsOn).toEqual(["job-knowledge-1"]);
});
