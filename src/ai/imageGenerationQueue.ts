import { generateAiImage } from "@/ai/imageGenerationClient";
import { genId } from "@/util/id";

/**
 * AI 이미지 생성 큐 — 프롬프트 단위가 아니라 작업(job) 단위로 생성을 관리한다.
 *
 * 왜 필요한가: 기존 aiImageGenerateField 는 단발성이다. 버튼을 누르면 그 자리에서
 * 요청이 나가고 끝날 때까지 버튼이 잠긴다. 두 번째 그림을 예약할 수 없고, 실패하면
 * 프롬프트가 증발하며, 여러 생성이 동시에 나가면 서버·타임아웃 경합이 난다.
 * 이 큐는 FIFO + 동시성 상한(기본 1, 직렬)으로 그 문제를 구조적으로 막는다.
 *
 * 설계:
 * - DOM·스토어에 닿지 않는 순수 상태 기계. runner 가 실제 생성 한 건을 맡는다.
 * - 기본 runner 는 generateAiImage → dataUrl. 에셋 삽입(store.update)은 UI 층이
 *   done 전이를 구독해 처리한다(큐가 project/store 를 모르게 둔다).
 * - 실행 중 취소는 AbortController + cancelled 플래그 이중 처리. runner 가 signal 을
 *   무시하고 늦게 resolve/reject 해도 이미 cancelled 면 결과를 버린다.
 */
export type ImageQueueJobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface ImageQueueJob {
  readonly id: string;
  /** 목록에 보여줄 짧은 이름(원문 앞부분). */
  readonly label: string;
  /** 실제 요청 프롬프트(접두사 포함 완성형). */
  readonly prompt: string;
  /** 생성 종류(picture/faceset/title/backdrop/monster 등, UI 층 표기 그대로). */
  readonly kind: string;
  readonly status: ImageQueueJobStatus;
  readonly attempts: number;
  readonly error: string | null;
  /** runner 가 돌려준 불투명 결과(기본 runner 면 dataUrl). */
  readonly result: string | null;
  readonly createdAt: number;
}

export interface ImageQueueSnapshot {
  readonly jobs: readonly ImageQueueJob[];
  readonly queued: number;
  readonly running: number;
  readonly failed: number;
}

export type ImageQueueRunner = (
  job: ImageQueueJob,
  options: { readonly signal: AbortSignal },
) => Promise<string>;

export interface ImageQueueEnqueueInput {
  readonly prompt: string;
  readonly label?: string;
  readonly kind?: string;
}

export interface ImageQueueOptions {
  /** 동시 실행 상한. 기본 1(직렬). 1 미만은 1로, 4 초과는 4로 고정한다. */
  readonly concurrency?: number;
  readonly runner?: ImageQueueRunner;
  readonly idPrefix?: string;
}

export interface ImageGenerationQueue {
  /** 새 작업을 맨 뒤에 넣고 id 를 돌려준다. 빈 프롬프트는 throw. */
  readonly enqueue: (input: ImageQueueEnqueueInput) => string;
  /** queued → cancelled, running → 중단 후 cancelled. done/error 는 false. */
  readonly cancel: (id: string) => boolean;
  /** error/cancelled → queued 로 되돌리고 재실행. 그 외는 false. */
  readonly retry: (id: string) => boolean;
  /** done + cancelled 작업을 목록에서 걷어낸다(error 는 재시도 대상이라 유지). */
  readonly clearFinished: () => void;
  readonly subscribe: (listener: (snapshot: ImageQueueSnapshot) => void) => () => void;
  readonly getSnapshot: () => ImageQueueSnapshot;
  /** 실행 중 작업을 전부 취소하고 구독을 끊는다. */
  readonly dispose: () => void;
}

type JobRecord = {
  id: string;
  label: string;
  prompt: string;
  kind: string;
  status: ImageQueueJobStatus;
  attempts: number;
  error: string | null;
  result: string | null;
  createdAt: number;
  controller: AbortController | null;
  cancelled: boolean;
};

const DEFAULT_CONCURRENCY = 1;
const MAX_CONCURRENCY = 4;

const defaultRunner: ImageQueueRunner = async (job, options) => {
  const image = await generateAiImage({ prompt: job.prompt, signal: options.signal });
  return image.dataUrl;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createImageGenerationQueue(options: ImageQueueOptions = {}): ImageGenerationQueue {
  const concurrency = Math.min(
    MAX_CONCURRENCY,
    Math.max(1, Math.trunc(options.concurrency ?? DEFAULT_CONCURRENCY) || 1),
  );
  const runner = options.runner ?? defaultRunner;
  const idPrefix = options.idPrefix ?? "imgjob";
  const records = new Map<string, JobRecord>();
  const listeners = new Set<(snapshot: ImageQueueSnapshot) => void>();
  let sequence = 0;
  let disposed = false;

  function freeze(record: JobRecord): ImageQueueJob {
    return {
      id: record.id,
      label: record.label,
      prompt: record.prompt,
      kind: record.kind,
      status: record.status,
      attempts: record.attempts,
      error: record.error,
      result: record.result,
      createdAt: record.createdAt,
    };
  }

  function snapshot(): ImageQueueSnapshot {
    const jobs = [...records.values()]
      .sort((left, right) => left.createdAt - right.createdAt)
      .map(freeze);
    return {
      jobs,
      queued: jobs.filter((job) => job.status === "queued").length,
      running: jobs.filter((job) => job.status === "running").length,
      failed: jobs.filter((job) => job.status === "error").length,
    };
  }

  function notify(): void {
    const current = snapshot();
    for (const listener of [...listeners]) listener(current);
  }

  function runningCount(): number {
    let count = 0;
    for (const record of records.values()) {
      if (record.status === "running") count += 1;
    }
    return count;
  }

  function pump(): void {
    if (disposed) return;
    while (runningCount() < concurrency) {
      const next = [...records.values()]
        .filter((record) => record.status === "queued")
        .sort((left, right) => left.createdAt - right.createdAt)[0];
      if (!next) return;
      void runOne(next);
    }
  }

  async function runOne(record: JobRecord): Promise<void> {
    record.status = "running";
    record.attempts += 1;
    record.error = null;
    record.cancelled = false;
    record.controller = new AbortController();
    const { signal } = record.controller;
    const frozen = freeze(record);
    notify();
    try {
      const result = await runner(frozen, { signal });
      // 취소된 뒤 늦게 도착한 성공은 버린다 — 다음 작업은 cancel() 시점에 이미 시작했다.
      if (record.cancelled) return;
      record.status = "done";
      record.result = result;
      record.controller = null;
      notify();
    } catch (error) {
      if (record.cancelled) return;
      record.status = "error";
      record.error = errorMessage(error);
      record.controller = null;
      notify();
    } finally {
      pump();
    }
  }

  return {
    enqueue(input) {
      if (disposed) throw new Error("이미 종료된 큐입니다.");
      const prompt = input.prompt.trim();
      if (!prompt) throw new Error("그림 설명(prompt)이 비어 있습니다.");
      sequence += 1;
      const id = genId(idPrefix);
      records.set(id, {
        id,
        label: input.label?.trim() || prompt.slice(0, 40),
        prompt,
        kind: input.kind ?? "",
        status: "queued",
        attempts: 0,
        error: null,
        result: null,
        createdAt: Date.now() * 1000 + sequence,
        controller: null,
        cancelled: false,
      });
      notify();
      pump();
      return id;
    },

    cancel(id) {
      const record = records.get(id);
      if (!record || record.status === "done" || record.status === "error") return false;
      if (record.status === "cancelled") return false;
      record.cancelled = true;
      record.controller?.abort();
      record.controller = null;
      record.status = "cancelled";
      record.error = null;
      notify();
      pump();
      return true;
    },

    retry(id) {
      const record = records.get(id);
      if (!record || (record.status !== "error" && record.status !== "cancelled")) return false;
      record.status = "queued";
      record.error = null;
      record.cancelled = false;
      notify();
      pump();
      return true;
    },

    clearFinished() {
      let removed = false;
      for (const [id, record] of records) {
        if (record.status === "done" || record.status === "cancelled") {
          records.delete(id);
          removed = true;
        }
      }
      if (removed) notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getSnapshot() {
      return snapshot();
    },

    dispose() {
      disposed = true;
      for (const record of records.values()) {
        if (record.status === "running" || record.status === "queued") {
          record.cancelled = true;
          record.controller?.abort();
          record.controller = null;
          record.status = "cancelled";
        }
      }
      listeners.clear();
    },
  };
}
