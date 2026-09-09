// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createTilesetAiProposalController } from "@/editor/panels/tilesetAiProposalController";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { installAdmitClient, PNG_DATA_URL } from "./aiJobAdmitSupport";

vi.mock("@/project/tileMetadataDb", () => ({
  recordAiAnalysisRun: vi.fn(async () => undefined),
}));

let harness: ReturnType<typeof installAdmitClient>;

beforeEach(async () => {
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  harness = installAdmitClient();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("proposal-draft waits for the durable mapping answer and does not treat the job id as analysis", async () => {
  const tileset = store.getCurrent().tilesets[Object.keys(store.getCurrent().tilesets)[0] ?? ""];
  if (!tileset) throw new Error("missing tileset");
  const controller = createTilesetAiProposalController({
    tileset,
    selectedTiles: [0, 1],
    setupChoice: { intent: "unsure", repeatability: "auto", scope: "preview", structure: "mixed" },
    readSnapshot: () => ({ imageDataUrl: PNG_DATA_URL, summary: "Task8 snapshot" }),
  });
  const pending = harness.nextAdmitted();
  const mapping = { tiles: [{ tile: 0, label: "Task8 floor" }, { tile: 1, label: "Task8 wall" }] };
  const analyzed = controller.analyze("");
  const admitted = await pending;
  expect(admitted.input.family).toBe("tileset");
  expect(admitted.input.payload.operation).toBe("proposal-draft");
  const job = harness.lastJob();
  await expect(Promise.race([analyzed, Promise.resolve("pending")])).resolves.toBe("pending");
  await harness.complete({ answer: JSON.stringify(mapping), mapping, kind: "proposal-draft" }, job.id);
  const result = await analyzed;
  expect(result.failed).toBe(false);
  expect(result.invalidJson).toBe(false);
  expect(result.answer).toBe(JSON.stringify(mapping));
  expect(result.answer).not.toBe(job.id);
  expect(result.answer).not.toContain(job.id);
});
