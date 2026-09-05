import { describe, expect, it, vi } from "vitest";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

describe("imageGenerationQueue", () => {
  it("빈 프롬프트는 넣지 않는다", () => {
    const queue = createImageGenerationQueue({ runner: async () => "x" });
    expect(() => queue.enqueue({ prompt: "  " })).toThrow();
    expect(queue.getSnapshot().jobs).toHaveLength(0);
  });

  it("작업은 들어온 순서대로 끝나고 상태가 전이된다", async () => {
    const order: string[] = [];
    const queue = createImageGenerationQueue({
      runner: async (job) => {
        order.push(job.label);
        return `data:${job.label}`;
      },
    });
    const seen: string[][] = [];
    queue.subscribe((snapshot) => seen.push(snapshot.jobs.map((job) => job.status)));
    const first = queue.enqueue({ prompt: "슬라임", kind: "monster" });
    const second = queue.enqueue({ prompt: "고블린", kind: "monster" });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
    });
    expect(order).toEqual(["슬라임", "고블린"]);
    const jobs = queue.getSnapshot().jobs;
    expect(jobs.map((job) => job.id)).toEqual([first, second]);
    expect(jobs[0]!.attempts).toBe(1);
    expect(jobs[0]!.result).toBe("data:슬라임");
    expect(seen.flat()).toContain("running");
    expect(queue.getSnapshot().queued).toBe(0);
    expect(queue.getSnapshot().running).toBe(0);
  });

  it("동시성은 직렬이 기본이고 실패한 작업은 에러를 들고 멈춘다", async () => {
    let active = 0;
    let peak = 0;
    const queue = createImageGenerationQueue({
      runner: async (job) => {
        active += 1;
        peak = Math.max(peak, active);
        try {
          if (job.label === "깨짐") throw new Error("서버 불량");
          await new Promise((resolve) => setTimeout(resolve, 5));
          return "ok";
        } finally {
          active -= 1;
        }
      },
    });
    queue.enqueue({ prompt: "하나" });
    queue.enqueue({ prompt: "깨짐" });
    queue.enqueue({ prompt: "셋" });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.filter((job) => job.status === "done")).toHaveLength(2);
    });
    expect(peak).toBe(1);
    const snapshot = queue.getSnapshot();
    expect(snapshot.failed).toBe(1);
    const failed = snapshot.jobs.find((job) => job.label === "깨짐")!;
    expect(failed.status).toBe("error");
    expect(failed.error).toBe("서버 불량");
  });

  it("실행 중 취소는 결과를 버리고 다음 작업을 돌린다", async () => {
    const gate = deferred<string>();
    const started: string[] = [];
    const queue = createImageGenerationQueue({
      runner: async (job, options) => {
        started.push(job.label);
        if (job.label === "느림") {
          // runner 가 signal 을 무시하고 늦게 resolve 해도 큐는 버려야 한다.
          void options.signal;
          return gate.promise;
        }
        return "fast";
      },
    });
    const slow = queue.enqueue({ prompt: "느림" });
    queue.enqueue({ prompt: "빠름" });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.find((job) => job.id === slow)?.status).toBe("running");
    });
    expect(queue.cancel(slow)).toBe(true);
    gate.resolve("late-data");
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.find((job) => job.label === "빠름")?.status).toBe("done");
    });
    const slowJob = queue.getSnapshot().jobs.find((job) => job.id === slow)!;
    expect(slowJob.status).toBe("cancelled");
    expect(slowJob.result).toBeNull();
    expect(started).toEqual(["느림", "빠름"]);
    queue.dispose();
  });

  it("취소 후 재시도하면 이전 실행의 늦은 결과는 버린다", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    let calls = 0;
    const queue = createImageGenerationQueue({
      runner: async () => {
        calls += 1;
        return calls === 1 ? first.promise : second.promise;
      },
    });
    const id = queue.enqueue({ prompt: "느림" });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs[0]?.status).toBe("running");
    });
    expect(queue.cancel(id)).toBe(true);
    expect(queue.retry(id)).toBe(true);
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs[0]?.attempts).toBe(2);
    });
    // 취소된 첫 실행이 늦게 성공해도 재시도 실행에는 닿지 않는다. 첫 promise 의
    // continuation 은 runOne 이 먼저 붙였으므로, 여기서 await 하면 stale 분기가
    // 완전히 정착한 뒤에 깨어난다(고정 sleep 없이 결정적이다).
    first.resolve("stale-data");
    await first.promise;
    const during = queue.getSnapshot().jobs[0]!;
    expect(during.status).toBe("running");
    expect(during.result).toBeNull();
    // 재시도 실행의 결과만 적용된다.
    second.resolve("fresh-data");
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs[0]?.status).toBe("done");
    });
    expect(queue.getSnapshot().jobs[0]?.result).toBe("fresh-data");
    queue.dispose();
  });

  it("대기 중 취소는 runner 를 부르지 않고 재시도하면 다시 돈다", async () => {
    const gate = deferred<string>();
    let calls = 0;
    const queue = createImageGenerationQueue({
      runner: async (job) => {
        calls += 1;
        if (job.label === "차단") return gate.promise;
        if (calls === 2) throw new Error("한 번 실패");
        return "recovered";
      },
    });
    queue.enqueue({ prompt: "차단" });
    const waiting = queue.enqueue({ prompt: "대기" });
    expect(queue.cancel(waiting)).toBe(true);
    expect(calls).toBe(1);
    gate.resolve("blocker-done");
    const failed = queue.enqueue({ prompt: "실패" });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("error");
    });
    expect(queue.retry(failed)).toBe(true);
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("done");
    });
    expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.attempts).toBe(2);
    expect(queue.cancel(failed)).toBe(false);
    expect(queue.retry(failed)).toBe(false);
  });

  it("clearFinished 는 끝난 것만 걷고 실패는 남긴다", async () => {
    const queue = createImageGenerationQueue({
      runner: async (job) => {
        if (job.label === "깨짐") throw new Error("불량");
        return "ok";
      },
    });
    queue.enqueue({ prompt: "성공" });
    const bad = queue.enqueue({ prompt: "깨짐" });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.every((job) => job.status !== "queued" && job.status !== "running")).toBe(true);
    });
    queue.clearFinished();
    const remaining = queue.getSnapshot().jobs;
    expect(remaining.map((job) => job.id)).toEqual([bad]);
  });

  it("구독 해지는 이후 알림을 받지 않는다", () => {
    const queue = createImageGenerationQueue({ runner: async () => "x" });
    let calls = 0;
    const off = queue.subscribe(() => {
      calls += 1;
    });
    queue.enqueue({ prompt: "하나" });
    const afterEnqueue = calls;
    off();
    queue.enqueue({ prompt: "둘" });
    expect(calls).toBe(afterEnqueue);
    queue.dispose();
  });

  it("concurrency 상한은 1~4 로 고정된다", async () => {
    let active = 0;
    let peak = 0;
    const queue = createImageGenerationQueue({
      concurrency: 99,
      runner: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return "ok";
      },
    });
    for (let index = 0; index < 8; index += 1) queue.enqueue({ prompt: `작업${index}` });
    await vi.waitFor(() => {
      expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
    });
    expect(peak).toBeLessThanOrEqual(4);
    queue.dispose();
  });
});
