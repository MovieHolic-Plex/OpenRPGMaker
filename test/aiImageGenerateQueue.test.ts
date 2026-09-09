// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fieldByTestId as findByTestId, mountField as renderWithFakeDom, queueTransition, signal } from "./helpers/aiTestSignals";
beforeEach(() => {
  document.body.replaceChildren();
  store.replace(createBlankProject());
});
afterEach(() => {
  document.body.replaceChildren();
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
    queue.dispose();
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
    const completed = signal();
    const field = renderWithFakeDom(() =>
      aiImageGenerateField({
        kind: "monster",
        testidPrefix: "q",
        queue,
        onInserted: (id) => { inserted.push(id); completed.resolve(); },
      })
    );
    const prompt = findByTestId(field, "q-prompt");
    if (prompt) prompt.value = "슬라임";
    findByTestId(field, "q-generate")?.click();
    await completed.promise;
    expect(inserted).toHaveLength(1);
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
    const failed = queueTransition(queue, (snapshot) => snapshot.jobs[0]?.status === "error");
    findByTestId(field, "q-generate")?.click();
    await failed;
    expect(findByTestId(field, "q-queue-list")?.textContent).toContain("서버 불량");
    expect(findByTestId(field, "q-queue-retry")).not.toBeNull();
    const completed = queueTransition(queue, (snapshot) => snapshot.jobs[0]?.status === "done");
    findByTestId(field, "q-queue-retry")?.click();
    await completed;
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
    expect(queue.getSnapshot().jobs).toHaveLength(2);
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
    expect(shared.getSnapshot().jobs).toHaveLength(2);
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
    const completed = queueTransition(shared, (snapshot) => snapshot.jobs[0]?.status === "done");
    const id = shared.enqueue({ prompt: "슬라임", kind: "monster" });
    await completed;
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
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
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
    const completed = queueTransition(shared, (snapshot) => snapshot.jobs[0]?.status === "done");
    shared.enqueue({ prompt: "슬라임", kind: "monster" });
    await completed;
    expect(inserted).toHaveLength(1);
    const after = Object.keys(store.getCurrent().assets.uploaded).length;
    expect(after - before).toBe(1);
    off();
    shared.dispose();
  });

  it("레코드를 바꾸면 진행 중 작업의 완료가 새 레코드에 닿지 않는다", async () => {
    // queueKey 격리를 진짜로 타야 한다: 주입 큐를 쓰면 resolveQueue 가 키 조회를
    // 건너뛰어 와이어링을 지워도 테스트가 초록이 된다(재검토 지적). 그래서 기본
    // runner + fetch 스텁으로 in-flight 를 붙잡고, 같은 testid·다른 queueKey 로 연다.
    // 결함 형태: B 가 작업 진행 중에 마운트되고 A 구독이 끊기면, 키가 공유될 때
    // done notify 가 B 에게 꽂혀 B 의 onInserted 가 A 그림을 받는다.
    const png = "data:image/png;base64,AAA";
    let resolveFetch!: (response: Response) => void;
    const gate = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => gate),
    );
    const forA: string[] = [];
    const forB: string[] = [];
    const completed = signal();
    const renderFor = (recordId: string, sink: string[]): HTMLElement =>
      renderWithFakeDom(() =>
        aiImageGenerateField({
          kind: "monster",
          testidPrefix: "qa",
          queueKey: `monster-species-resource:${recordId}`,
          onInserted: (resourceId) => { sink.push(resourceId); completed.resolve(); },
        })
      );
    const rootA = renderFor("speciesA", forA);
    const promptA = findByTestId(rootA, "qa-prompt");
    if (promptA) promptA.value = "A종족 그림";
    findByTestId(rootA, "qa-generate")?.click();
    rootA.remove();
    expect(rootA.isConnected).toBe(false);
    // B 를 A 작업이 끝나기 전에 연다. 키가 분리돼 있으면 B 의 큐는 비어 있다.
    const rootB = renderFor("speciesB", forB);
    expect(findByTestId(rootB, "qa-queue-list")?.textContent).not.toContain("A종족 그림");
    // Return to A while its request is pending; only A may receive the result.
    renderFor("speciesA", forA);
    resolveFetch(
      new Response(JSON.stringify({ image: { dataUrl: png } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await completed.promise;
    expect(forA).toHaveLength(1);
    expect(forB).toHaveLength(0);
    expect(store.getCurrent().assets.uploaded[forA[0]!]?.kind).toBe("monster");
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
    const failed = queueTransition(queue, (snapshot) => snapshot.jobs[0]?.status === "error");
    findByTestId(field, "q-generate")?.click();
    await failed;
    expect(calls).toBe(1);
    expect(findByTestId(field, "q-queue-clear")).toBeNull();
  });
});
