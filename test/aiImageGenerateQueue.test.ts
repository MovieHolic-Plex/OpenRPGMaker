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

  it("같은 queueKey 의 필드는 리마운트해도 작업을 공유한다", async () => {
    let calls = 0;
    const shared = createImageGenerationQueue({
      runner: async (job) => {
        calls += 1;
        if (job.label === "느림") return new Promise<string>(() => {});
        return "data:image/png;base64,AAA";
      },
    });
    const first = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue: shared, onInserted: vi.fn() })
    );
    const prompt = findByTestId(first, "q-prompt");
    if (prompt) prompt.value = "느림";
    findByTestId(first, "q-generate")?.click();
    if (prompt) prompt.value = "빠름";
    findByTestId(first, "q-generate")?.click();
    await vi.waitFor(() => {
      expect(shared.getSnapshot().jobs).toHaveLength(2);
    });
    // 폼이 통째로 다시 그려져도 같은 큐 인스턴스를 쓰면 목록이 살아 있다.
    const second = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue: shared, onInserted: vi.fn() })
    );
    expect(findByTestId(second, "q-queue-list")?.textContent).toContain("느림");
    expect(findByTestId(second, "q-queue-list")?.textContent).toContain("빠름");
    expect(calls).toBe(1);
    shared.dispose();
  });

  it("이미 끝난 큐에 붙은 새 필드는 초기 스캔으로 등록한다", async () => {
    const shared = createImageGenerationQueue({
      runner: async () => "data:image/png;base64,AAA",
    });
    const id = shared.enqueue({ prompt: "슬라임", kind: "monster" });
    await vi.waitFor(() => {
      expect(shared.getSnapshot().jobs[0]?.status).toBe("done");
    });
    expect(id).toBeTruthy();
    // 이 큐의 done 을 본 구독이 없으므로, 새로 붙는 필드가 초기 스냅샷을
    // 스캔해 에셋으로 등록한다.
    const inserted: string[] = [];
    renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue: shared, onInserted: (resourceId) => inserted.push(resourceId) })
    );
    expect(inserted).toHaveLength(1);
    expect(store.getCurrent().assets.uploaded[inserted[0]!]?.kind).toBe("monster");
    const afterRemount: string[] = [];
    renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue: shared, onInserted: (resourceId) => afterRemount.push(resourceId) })
    );
    expect(afterRemount).toHaveLength(0);
  });

  it("queueKey 필드는 같은 문서에서 리마운트해도 대기 목록을 유지한다", () => {
    const a = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "share-key", queueKey: "enemy-graphic:e1", onInserted: vi.fn() })
    );
    const prompt = findByTestId(a, "share-key-prompt");
    if (prompt) prompt.value = "느림";
    findByTestId(a, "share-key-generate")?.click();
    const b = renderWithFakeDom(() =>
      aiImageGenerateField({ kind: "monster", testidPrefix: "share-key", queueKey: "enemy-graphic:e1", onInserted: vi.fn() })
    );
    expect(findByTestId(b, "share-key-queue-list")?.textContent).toContain("느림");
  });

  it("store 재진입 리마운트에도 에셋 등록은 한 번만 한다", async () => {
    const shared = createImageGenerationQueue({
      runner: async () => "data:image/png;base64,AAA",
    });
    const inserted: string[] = [];
    const render = (): void => {
      renderWithFakeDom(() =>
        aiImageGenerateField({ kind: "monster", testidPrefix: "q", queue: shared, onInserted: (resourceId) => inserted.push(resourceId) })
      );
    };
    render();
    const off = store.subscribe(() => {
      // 이벤트 에디터처럼 store.update emit 에 리마운트되는 호출부를 흉내낸다.
      render();
    });
    const before = Object.keys(store.getCurrent().assets.uploaded).length;
    shared.enqueue({ prompt: "슬라임", kind: "monster" });
    await vi.waitFor(() => {
      expect(inserted.length).toBe(1);
    });
    const after = Object.keys(store.getCurrent().assets.uploaded).length;
    expect(after - before).toBe(1);
    off();
    shared.dispose();
  });

  it("레코드를 바꾸면 이전 레코드의 완료가 새 레코드에 닿지 않는다", async () => {
    const shared = createImageGenerationQueue({
      runner: async () => "data:image/png;base64,AAA",
    });
    const forA: string[] = [];
    const forB: string[] = [];
    renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "qa",
        queueKey: "monster-species-resource:speciesA",
        queue: shared,
        onInserted: (resourceId) => forA.push(resourceId),
      })
    );
    shared.enqueue({ prompt: "A종족 그림", kind: "monster" });
    await vi.waitFor(() => {
      expect(forA.length).toBe(1);
    });
    // 같은 testid 로 B 레코드를 열면(done 작업이 있는 공유 큐라도) B 에는 닿지 않는다.
    renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "qa",
        queueKey: "monster-species-resource:speciesB",
        queue: shared,
        onInserted: (resourceId) => forB.push(resourceId),
      })
    );
    // 큐 notify 와 초기 스캔은 모두 동기라 렌더 직후 판정이 확정된다.
    expect(forB).toHaveLength(0);
    shared.dispose();
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
