import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
});
afterEach(() => {
  restoreDom?.();
  vi.unstubAllGlobals();
});

describe("aiImageGenerateField queue", () => {
  it("프롬프트를 비우지 않고 여러 작업을 쌓는다", () => {
    const queue = createImageGenerationQueue({ runner: () => new Promise<string>(() => {}) });
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue, onInserted: vi.fn() })
    );
    const prompt = findByTestId(field, "q-prompt");
    expect(prompt).not.toBeNull();
    if (prompt) prompt.value = "슬라임";
    findByTestId(field, "q-generate")?.click();
    if (prompt) prompt.value = "고블린";
    findByTestId(field, "q-generate")?.click();
    const snapshot = queue.getSnapshot();
    expect(snapshot.jobs).toHaveLength(2);
    expect(snapshot.jobs.map((job) => job.label)).toEqual(["슬라임", "고블린"]);
    expect(prompt?.value).toBe("");
    expect(findByTestId(field, "q-queue-list")?.textContent).toContain("고블린");
  });

  it("빈 프롬프트는 큐에 넣지 않는다", () => {
    const queue = createImageGenerationQueue({ runner: async () => "x" });
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue, onInserted: vi.fn() })
    );
    findByTestId(field, "q-generate")?.click();
    expect(queue.getSnapshot().jobs).toHaveLength(0);
  });

  it("끝난 작업은 에셋으로 등록하고 onInserted 를 부른다", async () => {
    const queue = createImageGenerationQueue({
      runner: async () => "data:image/png;base64,AAA",
    });
    const inserted: string[] = [];
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "q",
        queue,
        onInserted: (id) => inserted.push(id),
      })
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "슬라임";
    findByTestId(field, "q-generate")?.click();
    await vi.waitFor(() => {
      expect(inserted).toHaveLength(1);
    });
    expect(inserted[0]).toContain("monster_img");
    expect(store.getCurrent().assets.uploaded[inserted[0]!]?.kind).toBe("monster");
    expect(findByTestId(field, "q-queue-list")?.textContent).toContain("완료");
  });

  it("실패한 작업은 목록에 남고 다시 시도할 수 있다", async () => {
    let calls = 0;
    const queue = createImageGenerationQueue({
      runner: async () => {
        calls += 1;
        if (calls === 1) throw new Error("서버 불량");
        return "data:image/png;base64,AAA";
      },
    });
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue, onInserted: vi.fn() })
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "슬라임";
    findByTestId(field, "q-generate")?.click();
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs[0]?.status).toBe("error");
    });
    expect(findByTestId(field, "q-queue-list")?.textContent).toContain("서버 불량");
    expect(findByTestId(field, "q-queue-retry")).not.toBeNull();
    findByTestId(field, "q-queue-retry")?.click();
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs[0]?.status).toBe("done");
    });
    expect(calls).toBe(2);
  });

  it("대기 중인 작업은 목록에서 취소할 수 있다", async () => {
    const queue = createImageGenerationQueue({
      runner: async (job) => {
        if (job.label === "느림") return new Promise<string>(() => {});
        return "data:image/png;base64,AAA";
      },
    });
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue, onInserted: vi.fn() })
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "느림";
    findByTestId(field, "q-generate")?.click();
    if (prompt) prompt.value = "빠름";
    findByTestId(field, "q-generate")?.click();
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs).toHaveLength(2);
    });
    const waiting = queue.getSnapshot().jobs.find((job) => job.label === "빠름")!;
    expect(queue.cancel(waiting.id)).toBe(true);
    const rendered = findByTestId(field, "q-queue-list");
    expect(rendered?.textContent).toContain("취소됨");
    queue.dispose();
  });

  it("끝난 항목 지우기는 완료·취소만 걷는다", async () => {
    let calls = 0;
    const queue = createImageGenerationQueue({
      runner: async (job) => {
        calls += 1;
        if (job.label === "깨짐") throw new Error("불량");
        return "data:image/png;base64,AAA";
      },
    });
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue, onInserted: vi.fn() })
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "깨짐";
    findByTestId(field, "q-generate")?.click();
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs[0]?.status).toBe("error");
    });
    expect(calls).toBe(1);
    expect(findByTestId(field, "q-queue-clear")).toBeNull();
  });
});
