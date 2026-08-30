// AI 표면의 프론트 액션 로그 — 사람이 조수 UI 에서 «무엇을 눌렀는가» 를 남긴다.
//
// 왜 필요한가 (실측 2026-08-30): 채팅 기록에는 지시와 툴 호출만 있고 사람이 만진 버튼은
// 한 건도 없었다. `AiActivityLogRecord.uiEvents` 는 타입에만 있고 chat 채널에서는 항상
// 비어 있었다(region task 와 play-boot 진단만 채운다). 그래서 "압축을 눌렀는데 뭐가 줄었나",
// "되감기가 실제로 되돌렸나", "도크를 바꾼 직후 턴이 깨졌나" 를 사후에 물을 수 없었다.
//
// 설계: **위임 리스너 1개**로 받는다. 버튼마다 기록 호출을 심는 방식은 다음에 버튼을 추가하는
// 사람이 잊고, 그게 지금 상태를 만든 실패 모드다. document capture 에서 한 번 듣고 AI 표면
// 안쪽만 남기면 «앞으로 추가될 버튼» 도 자동으로 들어온다.
//
// 클릭 사실만으로 결과를 알 수 없는 액션(압축·되감기·복원 등)은 `recordAiUiEvent` 를 직접
// 불러 결과 수치를 함께 남긴다. 두 경로는 서로를 대체하지 않는다 — 위임은 빠짐없음을,
// 명시 호출은 의미를 담당한다.
import { AI_UI_EVENT_SURFACES, type AiUiEvent, type AiUiEventInput } from "./uiEventTypes";

export type { AiUiEvent, AiUiEventInput } from "./uiEventTypes";
export { AI_UI_EVENT_SURFACES } from "./uiEventTypes";

const STORAGE_KEY = "oprn:ai-ui-events";
/** 링버퍼 크기. 활동 로그(100건)와 **분리**한다 — 섞으면 UI 이벤트가 채팅 턴을 밀어낸다. */
const MAX_EVENTS = 300;
const MAX_LABEL = 40;
const MAX_DETAIL_JSON = 2_000;
/** 이 개수가 쌓이면 즉시 flush 한다. 턴 밖 액션이 브라우저에만 남는 창을 짧게 유지한다. */
const FLUSH_AT_COUNT = 25;
/** 마지막 액션 후 이 시간 동안 조용하면 flush 한다(ms). */
const FLUSH_IDLE_MS = 10_000;

/** 기록을 어디로 내보낼지는 앱 배선이 정한다(src/app/mode.ts) — 이 모듈은 순수하게 모은다. */
export type AiUiEventSink = (events: readonly AiUiEvent[]) => void;

let sink: AiUiEventSink | null = null;
let seq = 0;
let pending: AiUiEvent[] = [];
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let detach: (() => void) | null = null;
/**
 * 진실의 원본은 메모리 링이고 localStorage 는 그 거울이다. 반대로 두면 저장소가 없는 환경
 * (node 러너·시크릿 모드 쿼터 초과)에서 턴 구간 절단이 조용히 빈 배열이 된다.
 */
let ring: AiUiEvent[] | null = null;

export function setAiUiEventSink(next: AiUiEventSink | null): void {
  sink = next;
}

function getStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

function clipDetail(detail: Record<string, unknown>): Record<string, unknown> {
  try {
    const raw = JSON.stringify(detail);
    if (raw.length <= MAX_DETAIL_JSON) return detail;
    return { _truncated: true, preview: clip(raw, MAX_DETAIL_JSON) };
  } catch {
    return { _unserializable: true };
  }
}

function isAiUiEvent(value: unknown): value is AiUiEvent {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.at === "string" && typeof row.seq === "number" && typeof row.action === "string";
}

function hydrate(): AiUiEvent[] {
  if (ring) return ring;
  const storage = getStorage();
  const raw = storage?.getItem(STORAGE_KEY);
  if (!raw) {
    ring = [];
    return ring;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    ring = Array.isArray(parsed) ? parsed.filter(isAiUiEvent).slice(-MAX_EVENTS) : [];
  } catch {
    ring = [];
  }
  // 새로고침 후에도 seq 가 이어지게 한다 — 되감으면 예전 턴 구간이 새 턴에 섞인다.
  for (const event of ring) if (event.seq > seq) seq = event.seq;
  return ring;
}

function writeLocal(events: readonly AiUiEvent[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-Math.floor(MAX_EVENTS / 2))));
    } catch {
      /* 저장 못 해도 메모리 링과 구간 절단(takeAiUiEventsSince)은 계속 동작한다 */
    }
  }
}

/** 링버퍼에 남아 있는 이벤트(오래된 것부터). */
export function listAiUiEvents(limit = MAX_EVENTS): readonly AiUiEvent[] {
  const rows = hydrate();
  const n = Math.max(1, Math.min(MAX_EVENTS, Math.floor(limit)));
  return rows.slice(-n);
}

export function clearAiUiEvents(): void {
  pending = [];
  ring = [];
  getStorage()?.removeItem(STORAGE_KEY);
  publishUiEventApi();
}

/**
 * 턴 구간 절단용 표식. 턴 시작 때 받아 두고 종료 때 `takeAiUiEventsSince` 로 그 구간만 꺼낸다.
 * 인덱스가 아니라 단조 증가 seq 다 — 링버퍼가 앞을 버려도 구간 판정이 흔들리지 않는다.
 */
export function aiUiEventMarker(): number {
  return seq;
}

export function takeAiUiEventsSince(marker: number): readonly AiUiEvent[] {
  return hydrate().filter((event) => event.seq > marker);
}

/** 액션 1건 기록. 의미 이벤트는 `detail` 에 결과 수치를 함께 넣는다. */
export function recordAiUiEvent(input: AiUiEventInput): AiUiEvent {
  const rows = hydrate();
  seq += 1;
  const event: AiUiEvent = {
    at: input.at ?? new Date().toISOString(),
    seq,
    surface: input.surface,
    action: input.action,
    ...(input.testid ? { testid: input.testid } : {}),
    ...(input.label ? { label: clip(input.label, MAX_LABEL) } : {}),
    ...(input.disabled === undefined ? {} : { disabled: input.disabled }),
    ...(input.detail ? { detail: clipDetail(input.detail) } : {}),
  };
  rows.push(event);
  if (rows.length > MAX_EVENTS) rows.splice(0, rows.length - MAX_EVENTS);
  writeLocal(rows);
  pending.push(event);
  publishUiEventApi(event);
  scheduleFlush();
  return event;
}

function scheduleFlush(): void {
  if (pending.length >= FLUSH_AT_COUNT) {
    flushAiUiEvents();
    return;
  }
  if (idleTimer) clearTimeout(idleTimer);
  if (typeof setTimeout === "undefined") return;
  idleTimer = setTimeout(() => {
    idleTimer = null;
    flushAiUiEvents();
  }, FLUSH_IDLE_MS);
  // Node 타이머가 프로세스를 붙잡지 않게 한다(테스트가 10초 매달리는 것을 막는다).
  (idleTimer as unknown as { unref?: () => void }).unref?.();
}

/**
 * 모인 액션을 sink 로 내보낸다. sink 가 없으면 로컬 링버퍼에만 남는다 —
 * 유실이 아니라 «원격 미설정» 이고, 그 상태는 하네스 배지가 알린다.
 */
export function flushAiUiEvents(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  if (!sink) return;
  try {
    sink(batch);
  } catch {
    /* 기록이 앱을 죽이면 안 된다 */
  }
}

/** AI 표면 안에서 일어난 상호작용인지 판정하고, 해당 표면 이름을 돌려준다. */
export function resolveAiUiSurface(element: Element | null): string | null {
  if (!element) return null;
  for (const [selector, surface] of AI_UI_EVENT_SURFACES) {
    if (element.closest(selector)) return surface;
  }
  return null;
}

function labelOf(element: Element): string | undefined {
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
  return text.length > 0 ? text : undefined;
}

/**
 * 위임 리스너를 붙인다. 두 번 불러도 리스너는 하나다.
 *
 * capture 단계를 쓰지만 **절대 preventDefault/stopPropagation 하지 않는다** — 읽기 전용
 * 관찰자다. 전면 투명 레이어가 맵 클릭을 삼킨 2026-08-19 P0 과 같은 이유로, 기록이 입력을
 * 건드리는 순간 기능이 죽는다.
 */
export function installAiUiEventCapture(target: Document | null = typeof document === "undefined" ? null : document): () => void {
  if (!target) return () => undefined;
  if (detach) return detach;

  const onInteraction = (event: Event): void => {
    const origin = event.target;
    if (!(origin instanceof Element)) return;
    const surface = resolveAiUiSurface(origin);
    if (!surface) return;
    const node = origin.closest<HTMLElement>("[data-testid]");
    if (!node) return;
    const testid = node.dataset.testid ?? "";
    const label = labelOf(node);
    recordAiUiEvent({
      surface,
      action: `${event.type}:${testid}`,
      testid,
      ...(label ? { label } : {}),
      disabled:
        node.getAttribute("aria-disabled") === "true" ||
        (node as HTMLButtonElement).disabled === true,
    });
  };

  const onHide = (): void => flushAiUiEvents();

  target.addEventListener("click", onInteraction, true);
  target.addEventListener("change", onInteraction, true);
  target.defaultView?.addEventListener("pagehide", onHide);

  detach = () => {
    target.removeEventListener("click", onInteraction, true);
    target.removeEventListener("change", onInteraction, true);
    target.defaultView?.removeEventListener("pagehide", onHide);
    detach = null;
  };
  publishUiEventApi();
  return detach;
}

/** 테스트 전용 — 리스너·링·seq/pending 을 초기 상태로 되돌린다. */
export function resetAiUiEventLogForTest(): void {
  detach?.();
  seq = 0;
  pending = [];
  ring = [];
  sink = null;
  getStorage()?.removeItem(STORAGE_KEY);
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function publishUiEventApi(latest?: AiUiEvent): void {
  if (typeof window === "undefined") return;
  window.__oprnAiUiEventLatest = latest ?? listAiUiEvents(1)[0];
  window.__oprnListAiUiEvents = (limit?: number) => listAiUiEvents(limit);
  window.__oprnClearAiUiEvents = () => clearAiUiEvents();
  window.__oprnFlushAiUiEvents = () => flushAiUiEvents();
}
