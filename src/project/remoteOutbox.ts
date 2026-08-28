// 원격 저장 실패분 큐(outbox). localStorage 를 "정본"에서 "아직 못 보낸 것들" 로 강등한다.
//
// 왜: AI 로그·대화의 localStorage 는 링버퍼(활동로그 100 / 대화 50)였는데, 스스로를 정본이라
// 선언하고 있었다. 실측(2026-08-29)에서 역할이 완전히 뒤집혀 있었다 —
//
//   정본(localStorage) : 100개 링버퍼 → 12,735행 페이스에서 사실상 즉시 덮어씀
//   미러(Supabase)     : 상한 없음 → 12,735행, 한 번도 안 죽음
//   미러(디스크)       : 두 번 조용히 죽음(경로 리네임 404, 프로덕션 tree-shaking)
//
// 즉 가장 빨리 사라지는 게 정본이고 가장 오래 남는 게 미러였다. 링버퍼는 전송 성공/실패와
// 무관하게 자리를 밀어내므로, 원격이 죽은 동안 쌓인 턴은 복구 근거 없이 사라진다.
//
// 이 모듈은 그 반대를 한다: 원격 쓰기가 실패하면 여기에 남기고, 다음 성공 시점에 밀어 넣는다.
// 링버퍼는 그대로 두되(표시용 캐시) "정본" 지위만 원격으로 넘긴다.
//
// 조용히 죽지 않게 하는 장치:
//   - 예산 초과로 버린 건수를 envelope 에 누적(dropped) — 통계로 드러난다
//   - 연속 실패가 MAX_ATTEMPTS 를 넘으면 버리지 않고 stalled 로 표시하고 자동 재시도에서만 뺀다
//   - window.__oprnRemoteOutbox() 로 언제든 큐 상태를 볼 수 있다

const STORAGE_KEY = "oprn:remote-outbox";
const ENVELOPE_VERSION = 1;
/** localStorage 는 오리진당 5~10MB 다. 활동 로그 1건이 수십 KB 라 큐에 예산을 둔다. */
const BYTE_BUDGET = 1_500_000;
const MAX_ENTRIES = 200;
/** 이 횟수를 넘기면 stalled — 마이그레이션 누락처럼 영구 실패를 무한 재시도하지 않는다. */
const MAX_ATTEMPTS = 6;
/** 한 번의 flush 에서 시도할 최대 건수 — 부팅이 큐 길이만큼 늘어지지 않게 한다. */
const FLUSH_BATCH = 25;

export type RemoteOutboxKind = "ai-activity" | "ai-conversation";

export type RemoteOutboxEntry = {
  /** 원격 upsert 의 충돌 키(logId / conversationId) — 중복 적재를 막는다. */
  readonly id: string;
  readonly kind: RemoteOutboxKind;
  /** 재시도에 그대로 쓸 원본 입력. */
  readonly payload: unknown;
  readonly queuedAt: string;
  readonly attempts: number;
  readonly lastError?: string;
  /** MAX_ATTEMPTS 초과 — 자동 flush 대상에서 제외(데이터는 보존). */
  readonly stalled?: boolean;
};

export type RemoteOutboxStats = {
  readonly pending: number;
  readonly stalled: number;
  /** 예산 초과로 버린 누적 건수. 0 이 아니면 유실이 있었다는 뜻이다. */
  readonly dropped: number;
  readonly oldestQueuedAt?: string;
  readonly bytes: number;
};

type Envelope = {
  readonly version: number;
  readonly entries: readonly RemoteOutboxEntry[];
  readonly dropped: number;
  readonly droppedAt?: string;
};

export type RemoteOutboxSender = (payload: unknown) => Promise<void>;

export type RemoteOutboxFlushResult = {
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
};

const senders = new Map<RemoteOutboxKind, RemoteOutboxSender>();
let flushInFlight: Promise<RemoteOutboxFlushResult> | null = null;

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isEntry(value: unknown): value is RemoteOutboxEntry {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    (value.kind === "ai-activity" || value.kind === "ai-conversation") &&
    typeof value.queuedAt === "string" &&
    typeof value.attempts === "number"
  );
}

function emptyEnvelope(): Envelope {
  return { version: ENVELOPE_VERSION, entries: [], dropped: 0 };
}

function readEnvelope(): Envelope {
  const storage = getStorage();
  if (!storage) return emptyEnvelope();
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyEnvelope();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed) || !Array.isArray(parsed.entries)) return emptyEnvelope();
    return {
      version: typeof parsed.version === "number" ? parsed.version : ENVELOPE_VERSION,
      entries: parsed.entries.filter(isEntry),
      dropped: typeof parsed.dropped === "number" ? parsed.dropped : 0,
      ...(typeof parsed.droppedAt === "string" ? { droppedAt: parsed.droppedAt } : {}),
    };
  } catch {
    return emptyEnvelope();
  }
}

/**
 * 예산 안으로 줄인다. 오래된 것부터 버리되 **버린 수를 세어** envelope 에 남긴다 —
 * 조용한 유실이 이 기능이 존재하는 이유이므로 여기서 또 조용해지면 안 된다.
 */
function fitToBudget(envelope: Envelope): Envelope {
  let entries = [...envelope.entries];
  let dropped = 0;
  if (entries.length > MAX_ENTRIES) {
    dropped += entries.length - MAX_ENTRIES;
    entries = entries.slice(-MAX_ENTRIES);
  }
  while (entries.length > 1 && JSON.stringify(entries).length > BYTE_BUDGET) {
    entries.shift();
    dropped += 1;
  }
  if (dropped === 0) return { ...envelope, entries };
  return {
    ...envelope,
    entries,
    dropped: envelope.dropped + dropped,
    droppedAt: new Date().toISOString(),
  };
}

function writeEnvelope(envelope: Envelope): void {
  const storage = getStorage();
  if (!storage) return;
  const fitted = fitToBudget(envelope);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(fitted));
  } catch {
    // QuotaExceeded — 절반만 남기고 재시도하되 버린 수를 반영한다.
    const half = fitted.entries.slice(-Math.max(1, Math.floor(fitted.entries.length / 2)));
    const shrunk: Envelope = {
      ...fitted,
      entries: half,
      dropped: fitted.dropped + (fitted.entries.length - half.length),
      droppedAt: new Date().toISOString(),
    };
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(shrunk));
    } catch {
      /* 저장 자체가 불가 — 이 턴은 메모리에만 남는다 */
    }
  }
}

/** 원격 쓰기 실패분을 큐에 넣는다. 같은 (kind,id) 는 최신 payload 로 갱신한다. */
export function enqueueRemoteWrite(input: {
  readonly id: string;
  readonly kind: RemoteOutboxKind;
  readonly payload: unknown;
  readonly error?: unknown;
}): void {
  const envelope = readEnvelope();
  const previous = envelope.entries.find((entry) => entry.kind === input.kind && entry.id === input.id);
  const attempts = (previous?.attempts ?? 0) + 1;
  const next: RemoteOutboxEntry = {
    id: input.id,
    kind: input.kind,
    payload: input.payload,
    queuedAt: previous?.queuedAt ?? new Date().toISOString(),
    attempts,
    ...(input.error === undefined ? {} : { lastError: describeError(input.error) }),
    ...(attempts >= MAX_ATTEMPTS ? { stalled: true } : {}),
  };
  writeEnvelope({
    ...envelope,
    entries: [...envelope.entries.filter((entry) => !(entry.kind === input.kind && entry.id === input.id)), next],
  });
}

function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}

export function listRemoteOutbox(): readonly RemoteOutboxEntry[] {
  return readEnvelope().entries;
}

export function remoteOutboxStats(): RemoteOutboxStats {
  const envelope = readEnvelope();
  const pending = envelope.entries.filter((entry) => !entry.stalled);
  return {
    pending: pending.length,
    stalled: envelope.entries.length - pending.length,
    dropped: envelope.dropped,
    ...(envelope.entries[0] ? { oldestQueuedAt: envelope.entries[0].queuedAt } : {}),
    bytes: JSON.stringify(envelope.entries).length,
  };
}

export function clearRemoteOutbox(): void {
  getStorage()?.removeItem(STORAGE_KEY);
}

/**
 * 종류별 전송기를 등록한다. outbox 가 supabaseProjectSync 를 직접 import 하면 순환이 되므로
 * 호출 측(activityLog / conversationStore)이 자기 전송기를 주입한다.
 */
export function registerRemoteOutboxSender(kind: RemoteOutboxKind, sender: RemoteOutboxSender): void {
  senders.set(kind, sender);
}

/**
 * 큐를 비운다. 전송기가 없거나 stalled 인 항목은 건너뛴다(force 면 stalled 도 시도).
 * 동시 호출은 하나로 합친다 — 매 턴 성공마다 부르므로 중복 전송을 막아야 한다.
 */
export function flushRemoteOutbox(options: { readonly force?: boolean } = {}): Promise<RemoteOutboxFlushResult> {
  if (flushInFlight) return flushInFlight;
  const run = flushOnce(options.force === true).finally(() => {
    flushInFlight = null;
  });
  flushInFlight = run;
  return run;
}

async function flushOnce(force: boolean): Promise<RemoteOutboxFlushResult> {
  const entries = readEnvelope().entries;
  if (entries.length === 0) return { sent: 0, failed: 0, skipped: 0 };
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let budget = FLUSH_BATCH;
  for (const entry of entries) {
    const sender = senders.get(entry.kind);
    if (!sender || (entry.stalled && !force) || budget <= 0) {
      skipped += 1;
      continue;
    }
    budget -= 1;
    try {
      await sender(entry.payload);
      dequeue(entry.kind, entry.id);
      sent += 1;
    } catch (error) {
      failed += 1;
      enqueueRemoteWrite({ id: entry.id, kind: entry.kind, payload: entry.payload, error });
      // 첫 실패에서 멈춘다 — 원격이 죽었으면 남은 건도 전부 실패한다.
      break;
    }
  }
  return { sent, failed, skipped };
}

function dequeue(kind: RemoteOutboxKind, id: string): void {
  const envelope = readEnvelope();
  writeEnvelope({
    ...envelope,
    entries: envelope.entries.filter((entry) => !(entry.kind === kind && entry.id === id)),
  });
}

/**
 * 부팅 시 한 번, 큐가 비어 있지 않을 때만 지연 flush. 부팅 경로를 네트워크로 붙잡지 않는다.
 * 등록된 전송기가 아직 없을 수 있으므로 모듈 로드가 끝난 뒤로 미룬다.
 */
export function scheduleRemoteOutboxBootFlush(delayMs = 5_000): void {
  if (typeof setTimeout !== "function") return;
  if (readEnvelope().entries.length === 0) return;
  setTimeout(() => {
    void flushRemoteOutbox().catch(() => undefined);
  }, delayMs);
}
