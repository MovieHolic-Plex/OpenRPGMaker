// editor/panels/aiJobList.ts
// 「작업 목록」의 모델 — 흩어진 AI 일의 다섯 줄기를 한 줄 목록(번호·종류·한 줄 요약·맵 좌표·상태)으로 모은다.
//
// 줄기: 대화·팀 레인·드래그 영역(aiPresence 의 chat/region) · 다른 맵에서 도는 실행(background) · 바로 깔기 주문(stampOrderQueue) · 이벤트 AI 작업함(eventAiQueue).
// 새 관측을 만들지 않는다 — 각 줄기가 이미 가진 상태를 읽어 사람의 말로 바꿀 뿐이다. 이벤트는 「보이기만」: 우클릭 J/K 일괄 배치와 별도 작업함 패널은 그대로 두고 여기서는 행으로만 나온다.
//
// 렉 방지(핵심, 2026-10-16):
//  - 조수 이벤트가 초당 수십 건 와도 이 모듈은 **프레임당 한 번만** 계산한다(`createFrameBatch`). 줄기 구독은 「바뀌었다」 표시만 한다.
//  - 계산은 두 층이다. 요약(개수·가장 급한 상태)은 늘 — 접힌 도크·닫힌 목록이어도 상태 줄·레일 배지가 읽는다. 행(JobRow)은 **목록이 열려 있을 때만** 만든다(구독자가 있을 때).
//  - 행은 시그니처가 같으면 직전 객체를 그대로 다시 쓴다. 보는 쪽이 `===` 로 바뀐 행만 고칠 수 있다(키 단위 diff).
//  - 번호는 aiJobNumbers 하나다 — 지도 위 상자·핀·주문 사각형과 같은 번호·같은 색.

import { jobNumber, jobTone, retainJobNumbers } from "@/editor/aiJobNumbers";
import { editorState } from "@/editor/editorState";
import { subscribeAgentGhostPreview } from "@/editor/agentGhostPreview";
import { placedRegions } from "@/editor/aiMapPresence";
import { eventAiQueue, type EventAiJob } from "@/editor/eventAiQueue/eventAiQueue";
import { isStampOrderActive, peekStampOrderQueue, stampOrderStatusText, subscribeStampOrders, type StampOrder } from "@/editor/stampOrderQueue";
import { store } from "@/project/store";
import { createFrameBatch } from "@/util/frameBatch";
import { currentPresences, isActive, needsUser, subscribeAiPresence, summarizeJobs, type JobSummary, type Presence, type PresenceState } from "./aiPresence";

export type JobKind = "chat" | "team" | "drag" | "region" | "background" | "stamp" | "event";

export interface JobWhere {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface JobRow {
  /** 줄기를 가리지 않는 안정 열쇠: `p:<presence id>` · `stamp:<주문 id>` · `event:<작업 id>`. */
  readonly key: string;
  /** 작업 번호 — 지도 위 상자·핀과 같다(aiJobNumbers). */
  readonly no: number;
  /** 번호에서 나온 색 번호(0~3). */
  readonly tone: number;
  readonly kind: JobKind;
  readonly state: PresenceState;
  /** 한 줄 요약(사용자가 쓴 문장일 수 있어 번역 대상이 아니다). */
  readonly title: string;
  /** 지금 하는 일 한 줄. */
  readonly action: string;
  readonly mapId: string | null;
  readonly mapName: string | null;
  readonly where: JobWhere | null;
  /** 내 차례·실패일 때 이유. */
  readonly note: string;
  readonly source:
    | { readonly type: "presence"; readonly presence: Presence }
    | { readonly type: "stamp"; readonly orderId: number }
    | { readonly type: "event"; readonly jobId: number };
  /** 보이는 값이 같으면 같다. 행 재사용 판정에 쓴다. */
  readonly sig: string;
}

type RowsListener = (rows: readonly JobRow[]) => void;
type SummaryListener = (summary: JobSummary) => void;

const summaryListeners = new Set<SummaryListener>();
const rowsListeners = new Set<RowsListener>();
let detach: (() => void) | null = null;
let detachRows: (() => void) | null = null;
let lastSummary: JobSummary = { total: 0, review: 0, failed: 0, running: 0, top: null };
let lastSummarySig = "";
let lastRows: readonly JobRow[] = [];
let rowsStale = true;

const EMPTY: JobSummary = { total: 0, review: 0, failed: 0, running: 0, top: null };

function mapNameOf(mapId: string): string | null {
  return store.getCurrent().maps[mapId]?.name ?? null;
}

function eventState(job: EventAiJob): PresenceState | null {
  switch (job.state) {
    case "queued": return "waiting";
    case "running": return "working";
    case "ready": return "review";
    case "failed": return "failed";
    case "placed": return null;
  }
}

function stampState(order: StampOrder): PresenceState {
  if (order.status === "waiting") return "waiting";
  // 조수 응답 뒤에 깔기(wait=chat)는 일을 못 하고 기다리는 중이다.
  if (order.status === "applying" && order.wait === "chat") return "waiting";
  return "working";
}

function activeStampOrders(): readonly StampOrder[] {
  return peekStampOrderQueue()?.orders().filter(isStampOrderActive) ?? [];
}

function liveEventJobs(): readonly EventAiJob[] {
  return eventAiQueue.list().filter(job => job.state !== "placed");
}

/** 상태 줄·레일이 읽는 요약. 줄기 다섯을 한 번에 센다. 끝난(적용됨) 일은 세지 않는다. */
export function computeJobSummary(): JobSummary {
  const presences = summarizeJobs(currentPresences());
  const stampTotal = activeStampOrders().length;
  let eventRunning = 0; let eventReview = 0; let eventFailed = 0;
  for (const job of liveEventJobs()) {
    if (job.state === "queued" || job.state === "running") eventRunning += 1;
    else if (job.state === "ready") eventReview += 1;
    else if (job.state === "failed") eventFailed += 1;
  }
  const total = presences.total + stampTotal + eventRunning + eventReview + eventFailed;
  if (total === 0) return EMPTY;
  const review = presences.review + eventReview;
  const failed = presences.failed + eventFailed;
  const running = presences.running + stampTotal + eventRunning;
  return { total, review, failed, running, top: review > 0 ? "review" : failed > 0 ? "failed" : running > 0 ? "running" : null };
}

function whereSig(where: JobWhere | null): string {
  return where ? `${where.x},${where.y},${where.w},${where.h}` : "";
}

function row(partial: Omit<JobRow, "tone" | "sig">): JobRow {
  const tone = jobTone(partial.no);
  const sig = [partial.key, partial.no, partial.kind, partial.state, partial.title, partial.action, partial.mapId, partial.mapName, whereSig(partial.where), partial.note].join("\u0001");
  return { ...partial, tone, sig };
}

function stepText(presence: Presence): string {
  return presence.steps > 0 && presence.state === "working" ? ` · ${presence.steps}단계` : "";
}

function presenceRow(presence: Presence, kind: JobKind, where: JobWhere | null): JobRow {
  const region = presence.region;
  const place = region ? { x: region.x, y: region.y, w: region.width, h: region.height } : where;
  return row({
    key: `p:${presence.id}`,
    no: jobNumber(`p:${presence.id}`),
    kind,
    state: presence.state,
    title: presence.task ? `${presence.name} · ${presence.task}` : presence.name,
    action: `${presence.action}${stepText(presence)}`,
    mapId: presence.mapId,
    mapName: presence.mapName ?? (presence.mapId ? mapNameOf(presence.mapId) : null),
    where: place,
    note: presence.note ?? "",
    source: { type: "presence", presence },
  });
}

function stampRow(order: StampOrder): JobRow {
  return row({
    key: `stamp:${order.id}`,
    no: jobNumber(`stamp:${order.id}`),
    kind: "stamp",
    state: stampState(order),
    title: order.label,
    action: stampOrderStatusText(order, id => jobNumber(`stamp:${id}`)),
    mapId: order.mapId,
    mapName: mapNameOf(order.mapId),
    where: { x: order.rect.x, y: order.rect.y, w: order.rect.w, h: order.rect.h },
    note: "",
    source: { type: "stamp", orderId: order.id },
  });
}

function eventRow(job: EventAiJob): JobRow | null {
  const state = eventState(job);
  if (!state) return null;
  const action = job.state === "ready" ? "배치 확인을 기다려요" : job.state === "failed" ? "만들지 못했어요" : job.stage || "만드는 중";
  return row({
    key: `event:${job.id}`,
    no: jobNumber(`event:${job.id}`),
    kind: "event",
    state,
    title: job.draft?.title ?? job.prompt,
    action,
    mapId: job.mapId,
    mapName: mapNameOf(job.mapId),
    where: { x: job.x, y: job.y, w: 1, h: 1 },
    note: job.state === "failed" ? (job.error ?? "") : "",
    source: { type: "event", jobId: job.id },
  });
}

function kindOf(presence: Presence, chatCount: number): JobKind {
  if (presence.source === "region") return "region";
  if (presence.source === "background") return "background";
  if (presence.drag) return "drag";
  return chatCount > 1 ? "team" : "chat";
}

/** 사람이 움직여야 하는 일(내 차례·실패)이 위, 나머지는 번호 순 — 번호는 안 바뀌므로 행이 제자리에 남는다. */
function compareRows(a: JobRow, b: JobRow): number {
  const ua = a.state === "review" || a.state === "failed" ? 0 : 1;
  const ub = b.state === "review" || b.state === "failed" ? 0 : 1;
  return ua - ub || a.no - b.no;
}

/** 지금 모든 일의 행. 목록이 열려 있을 때만 구독자가 이 비용을 낸다. */
export function buildJobRows(previous: readonly JobRow[] = []): readonly JobRow[] {
  const presences = currentPresences();
  const regions = placedRegions(presences);
  const chatCount = presences.filter(p => p.source === "chat").length;
  const out: JobRow[] = [];
  for (const presence of presences) {
    const where = regions.get(presence.id);
    out.push(presenceRow(presence, kindOf(presence, chatCount), where ? { x: where.x, y: where.y, w: where.width, h: where.height } : null));
  }
  for (const order of activeStampOrders()) out.push(stampRow(order));
  for (const job of liveEventJobs()) {
    const built = eventRow(job);
    if (built) out.push(built);
  }
  out.sort(compareRows);
  // 시그니처가 같은 행은 직전 객체를 다시 쓴다.
  const before = new Map(previous.map(item => [item.key, item]));
  return out.map(item => {
    const old = before.get(item.key);
    return old && old.sig === item.sig ? old : item;
  });
}

function sameRows(a: readonly JobRow[], b: readonly JobRow[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function liveKeys(): Set<string> {
  const live = new Set<string>();
  for (const presence of currentPresences()) live.add(`p:${presence.id}`);
  for (const order of activeStampOrders()) live.add(`stamp:${order.id}`);
  for (const job of liveEventJobs()) live.add(`event:${job.id}`);
  return live;
}

const batch = createFrameBatch(() => {
  retainJobNumbers(liveKeys());
  const summary = computeJobSummary();
  const sig = `${summary.total}|${summary.review}|${summary.failed}|${summary.running}|${summary.top}`;
  if (sig !== lastSummarySig) {
    lastSummarySig = sig;
    lastSummary = summary;
    for (const listener of [...summaryListeners]) listener(summary);
  }
  if (rowsListeners.size > 0 && rowsStale) {
    rowsStale = false;
    const rows = buildJobRows(lastRows);
    if (!sameRows(rows, lastRows)) {
      lastRows = rows;
      for (const listener of [...rowsListeners]) listener(rows);
    }
  }
});

function markChanged(): void {
  rowsStale = true;
  batch.schedule();
}

function attach(): void {
  if (detach) return;
  const offs = [
    subscribeAiPresence(markChanged),
    subscribeStampOrders(markChanged),
    eventAiQueue.subscribe(markChanged),
  ];
  detach = () => { for (const off of offs) off(); detach = null; };
}

function attachRows(): void {
  if (detachRows) return;
  // 행의 맵 좌표는 고스트 초안·현재 맵에서 나온다 — 목록이 열려 있는 동안만 이 둘의 변화도 듣는다.
  let lastMap = editorState.get().currentMapId;
  const offGhost = subscribeAgentGhostPreview(markChanged);
  const offEditor = editorState.subscribe(() => {
    const mapId = editorState.get().currentMapId;
    if (mapId !== lastMap) { lastMap = mapId; markChanged(); }
  });
  detachRows = () => { offGhost(); offEditor(); detachRows = null; };
}

function release(): void {
  if (summaryListeners.size === 0 && rowsListeners.size === 0) {
    batch.cancel();
    detach?.();
    lastSummary = EMPTY; lastSummarySig = "";
    lastRows = []; rowsStale = true;
  }
  if (rowsListeners.size === 0) detachRows?.();
}

/** 요약이 **바뀔 때만**(프레임당 한 번 이하) 부른다. 구독 즉시 현재 값을 한 번 준다. 닫힌 목록·접힌 도크도 이것만 읽는다. */
export function subscribeJobSummary(listener: SummaryListener): () => void {
  summaryListeners.add(listener);
  attach();
  retainJobNumbers(liveKeys());
  lastSummary = computeJobSummary();
  lastSummarySig = `${lastSummary.total}|${lastSummary.review}|${lastSummary.failed}|${lastSummary.running}|${lastSummary.top}`;
  listener(lastSummary);
  return () => { summaryListeners.delete(listener); release(); };
}

/** 행이 **바뀔 때만**(프레임당 한 번 이하) 부른다. 구독하는 동안에만 행을 만든다. 구독 즉시 현재 행을 한 번 준다. */
export function subscribeJobRows(listener: RowsListener): () => void {
  rowsListeners.add(listener);
  attach();
  attachRows();
  retainJobNumbers(liveKeys());
  lastRows = buildJobRows(lastRows);
  rowsStale = false;
  listener(lastRows);
  return () => { rowsListeners.delete(listener); release(); };
}

export function currentJobSummary(): JobSummary {
  return summaryListeners.size > 0 ? lastSummary : computeJobSummary();
}

export { isActive, needsUser };
