// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";
import { installAdmitClient } from "./aiJobAdmitSupport";

function monsterDest(recordId: string) {
  return { kind: "database" as const, table: "enemies" as const, recordId, field: "monsterResourceId" as const };
}

let restoreDom: (() => void) | undefined;
beforeEach(async () => {
  restoreDom = installFakeDom();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
});
afterEach(() => {
  restoreDom?.();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("aiImageGenerateField admission", () => {
  it("does not enqueue into a browser FIFO even if a queue is injected", async () => {
    const harness = installAdmitClient();
    const queue = createImageGenerationQueue({ runner: () => new Promise<string>(() => {}) });
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", destination: monsterDest("e1") }),
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "슬라임";
    const pending = harness.nextAdmitted();
    findByTestId(field, "q-generate")?.click();
    await pending;
    expect(queue.getSnapshot().jobs).toHaveLength(0);
    expect(harness.admits).toHaveLength(1);
    expect(harness.admits[0]?.input.family).toBe("image");
  });

  it("keeps typed input when the prompt is empty", () => {
    const harness = installAdmitClient();
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", destination: monsterDest("e1") }),
    );
    findByTestId(field, "q-generate")?.click();
    expect(harness.admits).toHaveLength(0);
  });

  it("captures the click destination, not a later selected record", async () => {
    const harness = installAdmitClient();
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "q",
        destination: monsterDest("e1"),
      }),
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "슬라임";
    const pending = harness.nextAdmitted();
    findByTestId(field, "q-generate")?.click();
    const admitted = await pending;
    expect(admitted.input.target).toMatchObject({ table: "enemies", recordId: "e1" });
    expect(Object.keys(store.getCurrent().assets.uploaded)).toHaveLength(0);
  });

  it("레코드를 바꾸면 진행 중 작업의 완료가 새 레코드에 닿지 않는다", async () => {
    const harness = installAdmitClient();
    const fieldA = renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "qa",
        queueKey: "monster-species-resource:speciesA",
        destination: monsterDest("speciesA"),
      }),
    );
    const promptA = findByTestId(fieldA, "qa-prompt");
    if (promptA) promptA.value = "A종족 그림";
    const pendingA = harness.nextAdmitted();
    findByTestId(fieldA, "qa-generate")?.click();
    const admittedA = await pendingA;
    const resourceA = String(admittedA.input.payload.resourceId);
    renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "qa",
        queueKey: "monster-species-resource:speciesB",
        destination: monsterDest("speciesB"),
      }),
    );
    expect(admittedA.input.target).toMatchObject({ recordId: "speciesA" });
    expect(resourceA.length).toBeGreaterThan(0);
    expect(harness.admits).toHaveLength(1);
    await harness.complete({
      proposal: { resource: { id: resourceA, name: "A종족 그림" } },
    });
    expect(Object.keys(store.getCurrent().assets.uploaded)).toHaveLength(0);
  });

  it("uncertain acknowledgement retry reuses resource id, destination and idempotency key", async () => {
    const harness = installAdmitClient();
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "q",
        queueKey: "enemy-graphic:e1",
        destination: monsterDest("e1"),
      }),
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "슬라임";
    harness.failNext("uncertain-ack");
    const failed = harness.nextAdmitted();
    findByTestId(field, "q-generate")?.click();
    await failed.catch(() => undefined);
    expect(harness.admits).toHaveLength(1);
    const firstKey = harness.keys[0];
    const firstResource = String(harness.admits[0]?.input.payload.resourceId);
    expect(firstKey?.length).toBeGreaterThan(0);
    expect(firstResource).toContain("monster_img");
    const pending = harness.nextAdmitted();
    findByTestId(field, "q-generate")?.click();
    const admitted = await pending;
    expect(harness.admits).toHaveLength(2);
    expect(String(admitted.input.payload.resourceId)).toBe(firstResource);
    expect(harness.keys[1]).toBe(firstKey);
    expect(admitted.input.target).toMatchObject({ recordId: "e1" });
    if (prompt) prompt.value = "고블린";
    const second = harness.nextAdmitted();
    findByTestId(field, "q-generate")?.click();
    const admittedB = await second;
    expect(harness.admits).toHaveLength(3);
    expect(String(admittedB.input.payload.resourceId)).not.toBe(firstResource);
    expect(harness.keys[2]).not.toBe(firstKey);
    expect(admittedB.input.payload.prompt).toEqual(expect.stringContaining("고블린"));
  });
});
