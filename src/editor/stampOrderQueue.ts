// editor/stampOrderQueue.ts
// 바로 깔기 주문 대기열 — 맵당 하나만 실행하고 다른 맵은 병렬로 진행한다.
//
// 왜(2026-09-28, 사용자 목표: 「드래그하면서 AI 명령을 팍팍팍 내리며 게임을 만든다」):
// 예전 바로 깔기는 채팅 패널의 turnBusy 슬롯 하나를 잡았다. 두 번째 드래그는 「진행 중인 응답이 끝난 뒤
// 다시 시도하세요」 토스트와 함께 버려졌다. 주문은 보존하고 같은 맵에서는 순서대로 실행한다.
//
// 규칙:
//  - 같은 맵의 주문은 영역과 관계없이 먼저 들어온 주문이 끝날 때까지 기다린다(FIFO).
//  - 동시에 도는 주문(모델 읽기 + 적용 대기)은 STAMP_ORDER_CONCURRENCY 개까지.
//  - 적용(스토어 커밋)은 조수 채팅 턴이 돌고 있으면 끝날 때까지 기다린다 — Pi 턴은 시작 시점 프로젝트를 바닥으로
//    잡고 적용 때 stale-base 를 검사하므로, 그 사이에 깔면 조수의 결과가 통째로 거절된다.
//    적용 자체는 동기 호출이라 주문끼리는 자연히 한 번에 하나다.
//  - 적용 직전에 프로젝트가 바뀌었으면(다른 프로젝트를 열었다) 그 주문은 중단한다.
//
// 수명: 모듈 싱글턴이다. 스튜디오 모드에서 장면을 추가하면 채팅 패널이 통째로 다시 만들어진다
// (aiLaneSession.ts 와 같은 실측). 패널이 대기열을 소유하면 그 순간 돌던 주문이 사라진다.
// 패널은 구독해서 그리기만 하고, 결과 줄은 takeUnreported() 로 한 번만 가져간다.
import type { StampRunInput, StampRunResult, StampRunSelection } from "@/editor/stampPlaceRunner";
import { editorAiMapRuns } from "@/ai/piAgent/editorMapRunLocks";

/** 동시에 도는 주문 상한. 공급자 동시 호출 한도를 넘지 않게 작게 둔다. */
export const STAMP_ORDER_CONCURRENCY = 3;
/** 끝나고 보고까지 된 주문을 들고 있는 수. 넘으면 오래된 것부터 버린다. */
const FINISHED_KEEP = 20;

export type StampOrderStatus = "waiting" | "planning" | "applying" | "done" | "failed" | "aborted";

/** 기다리는 이유 — 캔버스 라벨이 그대로 읽는다. */
export type StampOrderWait = "overlap" | "capacity" | "chat";

export interface StampOrderRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface StampOrder {
  readonly id: number;
  readonly text: string;
  /** 말풍선·캔버스용 짧은 이름. */
  readonly label: string;
  readonly mapId: string;
  /** 이 주문이 손대는 칸. 선택이 없으면 맵 전체. */
  readonly rect: StampOrderRect;
  readonly selection: StampRunSelection | null;
  readonly projectKey: string;
  status: StampOrderStatus;
  wait: StampOrderWait | null;
  /** 기다리게 만든 앞선 같은 맵의 주문 id. */
  blockedBy: number | null;
  /** 모델 수리 호출 중(두 번째 읽기). */
  repairing: boolean;
  lines: readonly string[];
  applied: number;
  reported: boolean;
}

export interface StampOrderSummary {
  readonly waiting: number;
  readonly running: number;
  readonly total: number;
}

export interface StampOrderQueueDeps {
  readonly run: (input: StampRunInput) => Promise<StampRunResult>;
  readonly projectKey: () => string;
  readonly mapSize: (mapId: string) => { readonly width: number; readonly height: number } | undefined;
  readonly concurrency?: number;
}

export interface StampOrderQueue {
  /** 주문을 쌓는다. 맵이 없으면 null. */
  enqueue(input: { readonly text: string; readonly mapId: string; readonly selection: StampRunSelection | null }): StampOrder | null;
  orders(): readonly StampOrder[];
  active(): boolean;
  summary(): StampOrderSummary;
  subscribe(listener: () => void): () => void;
  cancel(id: number): void;
  /** 도는 주문과 기다리는 주문을 모두 끊는다. 끊은 수를 돌려준다. */
  cancelAll(): number;
  /** 채팅 턴 진행 여부를 알려 주는 함수. 패널이 붙을 때 건다. */
  setChatBusyProbe(probe: (() => boolean) | null): void;
  /** 채팅 턴이 끝났다 — 적용을 기다리던 주문을 깨운다. */
  pokeGate(): void;
  /** 끝났지만 아직 채팅에 보고하지 않은 주문을 꺼내고 보고한 것으로 표시한다. */
  takeUnreported(): readonly StampOrder[];
  dispose(): void;
}

const ACTIVE: ReadonlySet<StampOrderStatus> = new Set(["waiting", "planning", "applying"]);

export function isStampOrderActive(order: Pick<StampOrder, "status">): boolean {
  return ACTIVE.has(order.status);
}

export function stampRectsOverlap(a: StampOrderRect, b: StampOrderRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** 선택을 맵 안으로 자른 칸. 선택이 없거나 다른 맵이면 맵 전체. 러너의 targetRect 와 같은 규칙이다. */
export function stampOrderRect(
  map: { readonly width: number; readonly height: number },
  mapId: string,
  selection: StampRunSelection | null,
): StampOrderRect {
  if (selection && selection.mapId === mapId && selection.width > 0 && selection.height > 0) {
    const x = Math.max(0, Math.min(map.width - 1, selection.x));
    const y = Math.max(0, Math.min(map.height - 1, selection.y));
    return { x, y, w: Math.max(1, Math.min(selection.width, map.width - x)), h: Math.max(1, Math.min(selection.height, map.height - y)) };
  }
  return { x: 0, y: 0, w: map.width, h: map.height };
}

export function stampOrderLabel(text: string): string {
  const flat = text.replace(/\s+/gu, " ").trim();
  if (!flat) return "알아서";
  return flat.length > 14 ? `${flat.slice(0, 13)}…` : flat;
}

/** 캔버스·목록에 붙는 상태 말. */
export function stampOrderStatusText(order: Pick<StampOrder, "status" | "wait" | "blockedBy" | "repairing">): string {
  switch (order.status) {
    case "waiting":
      if (order.wait === "overlap") return order.blockedBy !== null ? `#${order.blockedBy} 끝나면` : "앞 주문 대기";
      if (order.wait === "capacity") return "차례 대기";
      return "대기";
    case "planning":
      return order.repairing ? "고쳐 읽는 중" : "읽는 중";
    case "applying":
      return order.wait === "chat" ? "조수 응답 뒤에 깔기" : "까는 중";
    case "done":
      return "완료";
    case "failed":
      return "실패";
    case "aborted":
      return "중단";
  }
}

export function stampOrderCaption(order: Pick<StampOrder, "id" | "label" | "status" | "wait" | "blockedBy" | "repairing">): string {
  return `#${order.id} ${order.label} · ${stampOrderStatusText(order)}`;
}

/** 컴포저 한 줄 요약. 도는 주문이 없으면 빈 문자열. */
export function formatStampOrderSummary(summary: StampOrderSummary): string {
  if (summary.total === 0) return "";
  const parts = [`바로 깔기 ${summary.running}개 진행`];
  if (summary.waiting > 0) parts.push(`${summary.waiting}개 대기`);
  return parts.join(" · ");
}

export function createStampOrderQueue(deps: StampOrderQueueDeps): StampOrderQueue {
  const concurrency = Math.max(1, deps.concurrency ?? STAMP_ORDER_CONCURRENCY);
  const list: StampOrder[] = [];
  const controllers = new Map<number, AbortController>();
  const claims = new Map<number, () => void>();
  const unsubscribeOwnership = editorAiMapRuns.subscribe(() => pump());
  const listeners = new Set<() => void>();
  let gateWaiters: (() => void)[] = [];
  let chatBusy: (() => boolean) | null = null;
  let nextId = 1;
  let disposed = false;

  const emit = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (cause) {
        console.warn("[stampOrderQueue] listener failed", cause);
      }
    }
  };

  const trim = (): void => {
    let excess = list.filter((order) => !isStampOrderActive(order) && order.reported).length - FINISHED_KEEP;
    for (let i = 0; i < list.length && excess > 0; ) {
      const order = list[i]!;
      if (!isStampOrderActive(order) && order.reported) {
        list.splice(i, 1);
        excess -= 1;
      } else {
        i += 1;
      }
    }
  };

  const inFlight = (): number => list.filter((order) => order.status === "planning" || order.status === "applying").length;

  const gateOpen = (): boolean => !(chatBusy?.() ?? false);

  const releaseGate = (): void => {
    if (!gateOpen()) return;
    const waiters = gateWaiters;
    gateWaiters = [];
    for (const resolve of waiters) resolve();
  };

  const waitForApply = (order: StampOrder, signal: AbortSignal) => async (): Promise<void> => {
    if (!gateOpen()) {
      order.status = "applying";
      order.wait = "chat";
      emit();
      await new Promise<void>((resolve) => {
        const done = (): void => {
          signal.removeEventListener("abort", done);
          resolve();
        };
        gateWaiters.push(done);
        signal.addEventListener("abort", done, { once: true });
      });
    }
    // 적용 직전 확인: 다른 프로젝트가 열렸으면 이 주문은 옛 프로젝트의 것이다.
    if (!signal.aborted && deps.projectKey() !== order.projectKey) controllers.get(order.id)?.abort();
  };

  const finish = (order: StampOrder, status: StampOrderStatus, lines: readonly string[], applied: number): void => {
    controllers.delete(order.id);
    order.status = status;
    claims.get(order.id)?.();
    claims.delete(order.id);
    order.wait = null;
    order.blockedBy = null;
    order.repairing = false;
    order.lines = lines;
    order.applied = applied;
    trim();
    emit();
    pump();
  };

  const start = (order: StampOrder): void => {
    const claim = editorAiMapRuns.acquire(order.projectKey, [order.mapId], `바로 깔기 #${order.id}`);
    if (!claim.ok) { order.wait = "chat"; return; }
    claims.set(order.id, claim.release);
    const controller = new AbortController();
    controllers.set(order.id, controller);
    order.status = "planning";
    order.wait = null;
    order.blockedBy = null;
    let run: Promise<StampRunResult>;
    try {
      run = deps.run({
        text: order.text,
        mapId: order.mapId,
        selection: order.selection,
        signal: controller.signal,
        waitForApply: waitForApply(order, controller.signal),
        onPhase: (phase) => {
          if (disposed || !isStampOrderActive(order)) return;
          order.repairing = phase === "repairing";
          order.status = phase === "applying" ? "applying" : "planning";
          order.wait = null;
          emit();
        },
      });
    } catch (cause) {
      run = Promise.reject(cause);
    }
    void run.then(
      (result) => {
        if (disposed) { claims.get(order.id)?.(); claims.delete(order.id); return; }
        const aborted = controller.signal.aborted;
        finish(order, aborted && result.applied === 0 ? "aborted" : result.ok ? "done" : "failed", result.lines, result.applied);
      },
      (cause: unknown) => {
        if (disposed) { claims.get(order.id)?.(); claims.delete(order.id); return; }
        finish(order, "failed", [`바로 깔기에 실패했습니다: ${cause instanceof Error ? cause.message : String(cause)}`], 0);
      },
    );
  };

  /** 기다리는 주문 중 시작할 수 있는 것을 시작한다. 겹침·상한 이유를 주문에 적는다. */
  function pump(): void {
    if (disposed) return;
    let changed = false;
    for (const order of list) {
      if (order.status !== "waiting") continue;
      if (!gateOpen()) {
        if (order.wait !== "chat") { order.wait = "chat"; order.blockedBy = null; changed = true; }
        continue;
      }
      const blocker = list.find((other) => other.id < order.id && isStampOrderActive(other)
        && other.projectKey === order.projectKey && other.mapId === order.mapId);
      if (blocker) {
        if (order.wait !== "overlap" || order.blockedBy !== blocker.id) {
          order.wait = "overlap";
          order.blockedBy = blocker.id;
          changed = true;
        }
        continue;
      }
      if (inFlight() >= concurrency) {
        if (order.wait !== "capacity") {
          order.wait = "capacity";
          order.blockedBy = null;
          changed = true;
        }
        continue;
      }
      start(order);
      changed = true;
    }
    if (changed) emit();
  }

  const summary = (): StampOrderSummary => {
    let waiting = 0;
    let running = 0;
    for (const order of list) {
      if (order.status === "waiting") waiting += 1;
      else if (order.status === "planning" || order.status === "applying") running += 1;
    }
    return { waiting, running, total: waiting + running };
  };

  return {
    enqueue(input) {
      if (disposed) return null;
      const map = deps.mapSize(input.mapId);
      if (!map || map.width < 1 || map.height < 1) return null;
      const order: StampOrder = {
        id: nextId++,
        text: input.text,
        label: stampOrderLabel(input.text),
        mapId: input.mapId,
        rect: stampOrderRect(map, input.mapId, input.selection),
        selection: input.selection,
        projectKey: deps.projectKey(),
        status: "waiting",
        wait: null,
        blockedBy: null,
        repairing: false,
        lines: [],
        applied: 0,
        reported: false,
      };
      list.push(order);
      emit();
      pump();
      return order;
    },
    orders: () => list,
    active: () => list.some(isStampOrderActive),
    summary,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cancel(id) {
      const order = list.find((item) => item.id === id);
      if (!order || !isStampOrderActive(order)) return;
      const controller = controllers.get(id);
      if (controller) {
        controller.abort();
        return;
      }
      finish(order, "aborted", ["바로 깔기를 중단했습니다."], 0);
    },
    cancelAll() {
      let count = 0;
      // 기다리는 주문부터 지운다 — 도는 주문을 먼저 끊으면 pump 가 기다리던 주문을 곧바로 시작한다.
      for (const order of list) {
        if (order.status !== "waiting") continue;
        count += 1;
        order.status = "aborted";
        order.wait = null;
        order.blockedBy = null;
        order.lines = ["바로 깔기를 중단했습니다."];
      }
      for (const [id, controller] of controllers) {
        const order = list.find((item) => item.id === id);
        if (order && isStampOrderActive(order)) count += 1;
        controller.abort();
      }
      if (count > 0) emit();
      return count;
    },
    setChatBusyProbe(probe) {
      chatBusy = probe;
      releaseGate();
      pump();
    },
    pokeGate() {
      releaseGate();
      pump();
    },
    takeUnreported() {
      const out = list.filter((order) => !isStampOrderActive(order) && !order.reported);
      for (const order of out) order.reported = true;
      trim();
      return out;
    },
    dispose() {
      disposed = true;
      unsubscribeOwnership();
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
      const waiters = gateWaiters;
      gateWaiters = [];
      for (const resolve of waiters) resolve();
      listeners.clear();
      list.length = 0;
    },
  };
}

// ── 세션 싱글턴 ──────────────────────────────────────────────────────────────
// 러너(스토어·모델 배선)를 이 모듈이 import 하면 캔버스 렌더러가 대기열을 읽으려고 스토어 배선까지 끌어온다.
// 그래서 만드는 함수를 패널이 건다(configure). 캔버스는 peek/구독만 한다.

let current: StampOrderQueue | null = null;
let factory: (() => StampOrderQueue) | null = null;
const sessionListeners = new Set<() => void>();
let unsubscribeCurrent: (() => void) | null = null;

/** 기본 대기열을 만드는 함수를 건다. 이미 만들어졌으면 아무것도 하지 않는다. */
export function configureStampOrderQueue(create: () => StampOrderQueue): void {
  factory ??= create;
}

/** 이 브라우저 세션의 대기열. 처음 부를 때 만든다. */
export function stampOrderQueue(): StampOrderQueue {
  if (!current) {
    if (!factory) throw new Error("stampOrderQueue: configureStampOrderQueue 가 먼저 불려야 합니다");
    current = factory();
    unsubscribeCurrent = current.subscribe(() => {
      for (const listener of [...sessionListeners]) listener();
    });
    for (const listener of [...sessionListeners]) listener();
  }
  return current;
}

/** 이미 만들어진 대기열만 돌려준다(렌더러가 대기열을 만들지 않게). */
export function peekStampOrderQueue(): StampOrderQueue | null {
  return current;
}

/** 세션 대기열의 변화를 구독한다 — 대기열이 아직 없어도 된다(생기면 알린다). */
export function subscribeStampOrders(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/** 테스트 전용 — 모듈 상태를 비운다. */
export function resetStampOrderQueueForTest(): void {
  unsubscribeCurrent?.();
  unsubscribeCurrent = null;
  current?.dispose();
  current = null;
  factory = null;
  sessionListeners.clear();
}

