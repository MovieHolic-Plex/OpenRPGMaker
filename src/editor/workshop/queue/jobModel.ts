// src/editor/workshop/queue/jobModel.ts
/**
 * 공방 작업 줄의 순수 모델(DOM·IndexedDB 없음 — 시험한다).
 * 작업 하나 = 사용자가 기다리는 결과물 하나: 물건 한 판(object-gen 실행기, 후보 1~3장) 또는 가져온 묶음 하나(char-gen·tile-gen·object-gen pack).
 * 물건 작업의 단계는 엔진 판(WorkshopRound)에서 읽고(정본은 판), 작업에는 일정·멈춤·넣음 기록만 둔다.
 */
import type { WorkshopRound, WorkshopRun } from "@/harnesses/_core/workshop/types";
import type { ObjectGenRequest } from "../objectRequest";

export type JobGenerator = "object-gen" | "char-gen" | "tile-gen";
/** 누가 넣었나 — 공방 화면 · 조수(generate_missing_object) · 묶음 가져오기 */
export type JobSource = "workshop" | "assistant" | "import";
/**
 * 보이는 단계. queued 줄 서는 중 · reference 참고 그림 · drawing 그리는 중 · review 검수 중 · ready 고를 차례(묶음은 넣을 차례)
 * · installing 넣는 중(조수 작업이 끝나기를 기다림 포함) · installed 넣음 · failed 못 그림 · paused 멈춤 · cancelled 그만둠
 */
export type JobState = "queued" | "reference" | "drawing" | "review" | "ready" | "installing" | "installed" | "failed" | "paused" | "cancelled";
/** quota·rate·auth = 계정 막힘(다른 작업도 함께 기다린다) · network = 연결 끊김(이 작업만 잠깐 뒤 다시) · user = 사람이 멈춤 */
export type PauseKind = "quota" | "rate" | "auth" | "network" | "user";
export type BlockKind = Exclude<PauseKind, "user">;
/** 계정 단위로 함께 기다리는 막힘 — 이것만 다른 작업의 호출을 붙잡는다. */
export const isAccountPause = (kind: PauseKind): boolean => kind === "quota" || kind === "rate" || kind === "auth";
/** 연결 끊김으로 다시 해 보는 최대 횟수 — 넘으면 「못 그림」으로 둔다(서버가 정말 죽었을 때 끝없이 돌지 않게). */
export const NETWORK_RETRY_LIMIT = 4;

export type JobPause = {
  readonly kind: PauseKind;
  /** 사람이 읽는 이유(짧게) */
  readonly reason: string;
  /** 다시 해 볼 때(ms). null = 사람이 「계속」을 누르거나 AI 연결이 바뀔 때까지 */
  readonly until: number | null;
  readonly at: number;
};

export type JobTimelineEntry = { readonly at: number; readonly state: JobState | "call"; readonly note?: string };

export type JobInstalled =
  | { readonly kind: "object"; readonly letter: string; readonly objectId: string; readonly tilesetId: string; readonly auto: boolean; readonly at: number }
  | { readonly kind: "pack"; readonly title: string; readonly assetIds: readonly string[]; readonly tilesetIds: readonly string[]; readonly at: number };

export type WorkshopJob = {
  readonly id: string;
  readonly projectKey: string;
  readonly generator: JobGenerator;
  readonly source: JobSource;
  readonly title: string;
  readonly createdAt: number;
  /** 물건 작업: 실행기·기물·후보 수 */
  readonly harnessId?: string;
  readonly itemKey?: string;
  readonly count?: number;
  readonly note?: string;
  /** 조수 요청이면 원래 요청(후속 요청·자리) */
  readonly request?: ObjectGenRequest;
  /** 묶음 작업: 묶음 머리(그림 바이트는 따로 저장) */
  readonly pack?: { readonly folder: string; readonly manifest: unknown; readonly previewBlob?: string };
  roundId: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  pause: JobPause | null;
  /** 사람이 그만뒀다 */
  cancelled: boolean;
  /** 넣으려고 기다리는 중(조수가 그 맵을 쥐고 있다) — 이유 */
  installWait: string | null;
  installed: JobInstalled | null;
  error: string | null;
  /** 이 작업에 쓴 모델 호출 수(작업 줄이 센다) */
  calls: number;
  timeline: JobTimelineEntry[];
};

const PENDING: ReadonlySet<WorkshopRun["status"]> = new Set(["queued", "drawing", "reviewing"]);

export const isRunPending = (run: WorkshopRun): boolean => PENDING.has(run.status);
export const roundSettled = (round: WorkshopRound): boolean => round.runs.every((run) => !isRunPending(run));
export const usableRuns = (round: WorkshopRound): WorkshopRun[] => round.runs.filter((run) => run.status === "done" && run.grid !== null);

/** 막혀(한도·로그인·연결 끊김) 끝난 장 — 옛 저장본(errorKind 없음)은 오류 글로 가린다. */
export function blockedRun(run: WorkshopRun): BlockKind | null {
  if (run.status !== "failed") return null;
  if (run.errorKind) return run.errorKind;
  const text = run.error ?? "";
  if (/한도|quota/i.test(text)) return "quota";
  if (/로그인|login/i.test(text)) return "auth";
  // 잠깐 끊긴 연결(와이파이·VPN 바뀜, 서버 재시작) — 10개가 함께 돌 때 몇 초 끊기면 모두 실패로 끝났다(2026-10-21 실측).
  if (/네트워크 오류|Failed to fetch|NetworkError|network error|ECONNRESET|ERR_NETWORK|연결할 수 없/i.test(text)) return "network";
  return null;
}

/**
 * 참고 그림 단계(object-gen 실행기의 makeReference, engine.ts referenceFor): 장은 「그리는 중」으로 바뀌지만 시도 번호(attempt)는 아직 0 이고,
 * round.reference 는 그 단계가 끝날 때 { status: ok|none|failed } 로 한 번 채워진다(pending 상태는 없다).
 * 그래서 「참고가 아직 없고 어느 장도 첫 시도에 들어가지 않았다」를 참고 그림 단계로 읽는다(2026-10-22 실화면: 약 2분).
 */
function referencePending(round: WorkshopRound): boolean {
  if ((round as { reference?: unknown }).reference !== undefined) return false;
  return round.runs.length > 0 && round.runs.some((run) => run.status === "drawing") && round.runs.every((run) => (run.attempt ?? 0) === 0);
}

/** 작업의 보이는 단계. round = 이 작업의 판(없으면 아직 시작 전). */
export function jobState(job: WorkshopJob, round: WorkshopRound | null): JobState {
  if (job.installed) return "installed";
  if (job.cancelled) return "cancelled";
  if (job.installWait !== null) return "installing";
  if (job.pause) return "paused";
  if (job.generator !== "object-gen" || job.pack) return job.error ? "failed" : "ready";
  if (!job.roundId) return job.error ? "failed" : "queued";
  if (!round) return "queued";
  if (round.runs.length > 0 && round.runs.every((run) => run.status === "cancelled")) return "cancelled";
  if (!roundSettled(round)) {
    if (referencePending(round)) return "reference";
    if (round.runs.some((run) => run.status === "drawing")) return "drawing";
    if (round.runs.some((run) => run.status === "reviewing")) return "review";
    return "queued";
  }
  if (usableRuns(round).length > 0) return "ready";
  return "failed";
}

export const ACTIVE_STATES: ReadonlySet<JobState> = new Set(["reference", "drawing", "review"]);
export const OPEN_STATES: ReadonlySet<JobState> = new Set(["queued", "reference", "drawing", "review", "ready", "installing", "paused"]);

/** 진행(0~1): 끝난 장 + 지금 장의 시도 진행을 반쯤 센다. */
export function jobProgress(job: WorkshopJob, round: WorkshopRound | null): number {
  const state = jobState(job, round);
  if (state === "ready" || state === "installed" || state === "installing") return 1;
  if (!round || round.runs.length === 0) return 0;
  let sum = 0;
  for (const run of round.runs) {
    if (!isRunPending(run)) sum += 1;
    else if (run.status === "reviewing") sum += 0.75;
    else if (run.status === "drawing") sum += 0.15 + 0.15 * Math.max(0, run.attempt - 1);
  }
  return Math.min(1, sum / round.runs.length);
}

/** 지난 작업들에서 한 작업(판)이 걸린 시간 평균(ms). 기록이 없으면 2분. */
export function averageJobMs(jobs: readonly WorkshopJob[]): number {
  const spans = jobs
    .filter((job) => job.generator === "object-gen" && job.startedAt !== null && job.finishedAt !== null && job.finishedAt > job.startedAt)
    .map((job) => job.finishedAt! - job.startedAt!)
    .slice(-20);
  return spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : 120_000;
}

/**
 * 남은 시간(ms) 어림. 도는 작업 = 평균 − 지난 시간(진행이 평균을 넘으면 진행 비율로), 줄 선 작업 = 앞에 선 작업 수 ÷ 동시 수 만큼 판을 더 기다린다.
 * null = 어림할 수 없음(멈춤·끝남).
 */
export function jobEtaMs(job: WorkshopJob, round: WorkshopRound | null, context: { readonly now: number; readonly averageMs: number; readonly queuePosition: number; readonly limit: number }): number | null {
  const state = jobState(job, round);
  if (ACTIVE_STATES.has(state)) {
    const elapsed = job.startedAt !== null ? Math.max(0, context.now - job.startedAt) : 0;
    const progress = jobProgress(job, round);
    // 진행이 조금이라도 보이면 지금 작업의 빠르기로, 아니면 지난 작업 평균으로 전체 시간을 어림한다.
    const total = progress > 0.05 ? Math.max(elapsed / progress, context.averageMs * 0.5) : Math.max(context.averageMs, elapsed * 1.2);
    return Math.max(10_000, total - elapsed);
  }
  if (state === "queued") return context.averageMs * (1 + Math.floor(context.queuePosition / Math.max(1, context.limit)));
  return null;
}

/** 「약 N분」 — 1분 아래는 「1분 안」. */
export function etaText(ms: number | null): string {
  if (ms === null) return "";
  const minutes = Math.ceil(ms / 60_000);
  return minutes <= 1 ? "1분 안" : `약 ${minutes}분`;
}

/** 남은 때(숫자만 — 번역 없이 읽힌다): 「0:42」·「12:05」·「61:28:00」 */
export function countdownText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/**
 * 다시 해 볼 때까지 남은 시간을 말로(「12분 29초 뒤 다시 시도」). 「12:29 뒤」는 시각(오후 12시 29분)으로 읽혔다(2026-10-21 VQA).
 * 조각 하나가 완성된 숫자 틀이라 화면 번역이 통째로 맞춘다.
 */
export function retryText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  if (total <= 0) return "곧 다시 시도";
  if (h > 0) return `${h}시간 ${m}분 뒤 다시 시도`;
  if (m > 0) return `${m}분 ${sec}초 뒤 다시 시도`;
  return `${sec}초 뒤 다시 시도`;
}

/** 멈춤 조각: 이유 + (때가 있으면) 다시 해 볼 때까지 */
export function pauseParts(pause: Pick<JobPause, "reason" | "until">, now: number): string[] {
  if (pause.until === null) return [pause.reason];
  return [pause.reason, pause.until > now ? retryText(pause.until - now) : "곧 다시 시도"];
}

/** 멈춤 한 줄(조수 카드 등 한 덩이가 필요한 곳) */
export function pauseLine(pause: JobPause, now: number): string {
  return pauseParts(pause, now).join(" · ");
}

/**
 * 풀리는 때 → ms. 공급자 문구 「Resets in 61h28m」과, 엔진이 그 문구를 옮겨 적은 장 오류 「약 2분 뒤 풀림」·「약 3시간 뒤 풀림」을 읽는다.
 * (장 오류만 보고 30분으로 잡던 것 — 2분짜리 한도를 30분 기다렸다, 2026-10-21 실측.) 없으면 null.
 */
export function resetsInMs(text: string): number | null {
  const m = /Resets in (?:(\d+)h)?\s*(?:(\d+)m)?/i.exec(text);
  if (m && (m[1] || m[2])) return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60_000;
  const hours = /약\s*(\d+)\s*시간\s*뒤/.exec(text);
  if (hours) return Number(hours[1]) * 3_600_000;
  const minutes = /약\s*(\d+)\s*분\s*뒤/.exec(text);
  if (minutes) return Number(minutes[1]) * 60_000;
  return null;
}

/** 잠깐 몰림(rate) 물러서기: 2분부터 두 배씩, 30분까지. */
export function rateBackoffMs(strikes: number): number {
  return Math.min(30 * 60_000, 2 * 60_000 * 2 ** Math.max(0, strikes - 1));
}

/** 연결 끊김 물러서기: 20초부터 두 배씩, 5분까지. */
export function networkBackoffMs(strikes: number): number {
  return Math.min(5 * 60_000, 20_000 * 2 ** Math.max(0, strikes - 1));
}

/** 막힘 → 멈춤 기록. quota 는 공급자가 말한 풀리는 때(없으면 30분), rate·network 는 물러서기, auth 는 사람이 다시 로그인할 때까지. */
export function pauseFor(kind: BlockKind, errorText: string, now: number, strikes: number): JobPause {
  if (kind === "network") return { kind, reason: "연결이 끊김", until: now + networkBackoffMs(strikes), at: now };
  if (kind === "auth") return { kind, reason: "로그인 만료 · AI 설정에서 다시 로그인하면 이어서 그려요", until: null, at: now };
  if (kind === "quota") {
    const wait = resetsInMs(errorText) ?? 30 * 60_000;
    return { kind, reason: "계정 사용 한도", until: now + wait, at: now };
  }
  const wait = rateBackoffMs(strikes);
  return { kind, reason: "요청이 몰림", until: now + wait, at: now };
}

export const JOB_STATE_LABELS: Readonly<Record<JobState, string>> = {
  queued: "줄 서는 중", reference: "참고 그림", drawing: "그리는 중", review: "검수 중", ready: "고를 차례",
  installing: "넣는 중", installed: "넣음", failed: "못 그림", paused: "잠시 멈춤", cancelled: "그만둠",
};

/** 묶음 작업의 「고를 차례」는 「넣을 차례」로 읽는다. */
export function jobStateLabel(job: WorkshopJob, state: JobState): string {
  if (state === "ready" && job.generator !== "object-gen") return "넣을 차례";
  if (state === "ready" && job.pack) return "넣을 차례";
  return JOB_STATE_LABELS[state];
}

export const SOURCE_LABELS: Readonly<Record<JobSource, string>> = { workshop: "공방", assistant: "조수", import: "가져옴" };
