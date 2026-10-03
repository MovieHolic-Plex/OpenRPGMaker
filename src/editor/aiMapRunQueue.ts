// editor/aiMapRunQueue.ts — 조수 채팅 실행의 맵별 대기열(2026-10-03).
//
// 왜(사용자 2026-10-03): 「맵당 AI 는 하나만, 맵마다 대기열. 여러 맵에서는 여러 AI 를 동시에 부를 수 있어야 하고,
// 그래도 어디선가 충돌이 나면 merge 할 수 있어야 한다」. 예전 채팅은 실행 슬롯이 하나라 두 번째 요청은
// 「진행 중인 응답이 끝난 뒤 다시 시도하세요」로 버려졌다.
//
// 규칙:
//  - 실행은 맵 하나(보낼 때 보고 있던 맵)를 잡는다. 같은 맵의 요청은 먼저 들어온 순서대로 기다린다(FIFO).
//  - 다른 맵의 요청은 동시에 돈다 — 최대 MAP_RUN_CONCURRENCY 개(공급자 동시 호출 한도를 넘지 않게).
//  - 맵을 특정하지 못하는 실행(팀 모드처럼 여러 맵을 나눠 갖는 실행)은 `exclusive` 로 모든 맵을 잡는다.
//  - 잡는 것은 «같은 맵을 두 실행이 동시에 고치지 않는다» 까지다. 데이터베이스·맵 트리 같은 공용 자리가 겹치면
//    적용 단계가 3-way 병합으로 합친다(project/projectMerge.ts, applyProposedProject 의 rebase).
//
// 수명: 모듈 싱글턴이다(stampOrderQueue 와 같은 이유 — 스튜디오 모드에서 채팅 패널이 통째로 다시 만들어진다).
// 실행 본문(start)은 호출자가 넘긴다. 이 파일은 순서·동시성·중단만 안다.

/** 동시에 도는 실행 상한. */
export const MAP_RUN_CONCURRENCY = 3;
/** 끝난 표를 들고 있는 수. */
const FINISHED_KEEP = 20;

export type MapRunStatus = "waiting" | "running" | "done" | "failed" | "cancelled";
/** 기다리는 이유. */
export type MapRunWait = "same-map" | "exclusive" | "capacity";

export interface MapRunTicket {
  readonly id: number;
  /** 잡는 맵. exclusive 면 모든 맵. */
  readonly mapKey: string;
  readonly exclusive: boolean;
  /** 사람이 읽는 짧은 이름(보낸 문장). */
  readonly label: string;
  status: MapRunStatus;
  wait: MapRunWait | null;
  /** 같은 맵에서 앞에 선 실행 수(기다릴 때). */
  ahead: number;
  readonly enqueuedAt: number;
  startedAt: number | null;
  endedAt: number | null;
  error: string | null;
}

export interface MapRunEnqueueInput {
  readonly mapKey: string;
  readonly label: string;
  readonly exclusive?: boolean;
  /**
   * 호출자가 이미 그 맵이 비어 있음을 확인하고 지금 돌리는 실행(채팅 패널의 앞 턴). 동시 실행 상한을 기다리지 않는다 —
   * 표에 올려 같은 맵의 다음 요청이 그 뒤에 줄 서게 하는 게 목적이다.
   */
  readonly force?: boolean;
  /** 차례가 오면 부른다. signal 은 cancel() 이 끊는다. 던지면 failed, 끝나면 done. */
  readonly start: (ticket: MapRunTicket, signal: AbortSignal) => Promise<void>;
}

export interface MapRunQueue {
  enqueue(input: MapRunEnqueueInput): MapRunTicket;
  /** 기다리는 실행은 빼고, 도는 실행은 signal 을 끊는다. */
  cancel(id: number): void;
  tickets(): readonly MapRunTicket[];
  /** 이 맵을 지금 잡고 있거나 기다리는 실행. */
  forMap(mapKey: string): readonly MapRunTicket[];
  running(): readonly MapRunTicket[];
  subscribe(listener: () => void): () => void;
}

interface Entry {
  readonly ticket: MapRunTicket;
  readonly force: boolean;
  readonly start: MapRunEnqueueInput["start"];
  readonly controller: AbortController;
}

export function createMapRunQueue(options: { readonly concurrency?: number; readonly clock?: () => number } = {}): MapRunQueue {
  const concurrency = options.concurrency ?? MAP_RUN_CONCURRENCY;
  const clock = options.clock ?? (() => Date.now());
  const entries: Entry[] = [];
  const listeners = new Set<() => void>();
  let nextId = 1;

  const emit = (): void => {
    for (const listener of [...listeners]) {
      try { listener(); } catch (error) { console.warn("[mapRunQueue] listener", error); }
    }
  };

  const active = (): Entry[] => entries.filter((e) => e.ticket.status === "running");
  const blocks = (a: MapRunTicket, b: MapRunTicket): boolean => a.exclusive || b.exclusive || a.mapKey === b.mapKey;

  const pump = (): void => {
    let changed = false;
    for (const entry of entries) {
      const ticket = entry.ticket;
      if (ticket.status !== "waiting") continue;
      const running = active();
      // 앞에 선(먼저 들어온) 실행 중 같은 맵을 잡는 것 — 도는 것이든 기다리는 것이든 — 이 있으면 순서를 지킨다.
      const earlier = entries.filter((e) => e !== entry && e.ticket.id < ticket.id
        && (e.ticket.status === "running" || e.ticket.status === "waiting") && blocks(e.ticket, ticket));
      const wait: MapRunWait | null = entry.force ? null : earlier.length
        ? (earlier.some((e) => e.ticket.exclusive) || ticket.exclusive ? "exclusive" : "same-map")
        : running.length >= concurrency ? "capacity" : null;
      const ahead = earlier.length;
      if (wait) {
        if (ticket.wait !== wait || ticket.ahead !== ahead) { ticket.wait = wait; ticket.ahead = ahead; changed = true; }
        continue;
      }
      ticket.status = "running";
      ticket.wait = null;
      ticket.ahead = 0;
      ticket.startedAt = clock();
      changed = true;
      void run(entry);
    }
    if (changed) emit();
  };

  const finish = (entry: Entry, status: MapRunStatus, error: string | null): void => {
    entry.ticket.status = status;
    entry.ticket.error = error;
    entry.ticket.endedAt = clock();
    const finished = entries.filter((e) => e.ticket.status === "done" || e.ticket.status === "failed" || e.ticket.status === "cancelled");
    for (const old of finished.slice(0, Math.max(0, finished.length - FINISHED_KEEP))) entries.splice(entries.indexOf(old), 1);
    emit();
    pump();
  };

  const run = async (entry: Entry): Promise<void> => {
    // 시작은 다음 틱에 — enqueue 를 부른 쪽이 표를 먼저 받아 그릴 수 있게.
    await Promise.resolve();
    try {
      await entry.start(entry.ticket, entry.controller.signal);
      finish(entry, entry.controller.signal.aborted ? "cancelled" : "done", null);
    } catch (error) {
      finish(entry, entry.controller.signal.aborted ? "cancelled" : "failed", error instanceof Error ? error.message : String(error));
    }
  };

  return {
    enqueue(input) {
      const ticket: MapRunTicket = {
        id: nextId++, mapKey: input.mapKey, exclusive: input.exclusive === true, label: input.label,
        status: "waiting", wait: null, ahead: 0, enqueuedAt: clock(), startedAt: null, endedAt: null, error: null,
      };
      entries.push({ ticket, force: input.force === true, start: input.start, controller: new AbortController() });
      emit();
      pump();
      return ticket;
    },
    cancel(id) {
      const entry = entries.find((e) => e.ticket.id === id);
      if (!entry) return;
      if (entry.ticket.status === "waiting") {
        entry.controller.abort();
        finish(entry, "cancelled", null);
        return;
      }
      if (entry.ticket.status === "running") entry.controller.abort();
    },
    tickets: () => entries.map((e) => e.ticket),
    forMap: (mapKey) => entries.filter((e) => (e.ticket.status === "running" || e.ticket.status === "waiting")
      && (e.ticket.exclusive || e.ticket.mapKey === mapKey)).map((e) => e.ticket),
    running: () => active().map((e) => e.ticket),
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

let current: MapRunQueue | null = null;

/** 편집기 전체에 하나. 패널이 다시 만들어져도 도는 실행은 살아 있다. */
export function mapRunQueue(): MapRunQueue {
  return (current ??= createMapRunQueue());
}

/** 테스트용 — 싱글턴을 갈아 끼운다. */
export function resetMapRunQueueForTests(next: MapRunQueue | null = null): void {
  current = next;
}
