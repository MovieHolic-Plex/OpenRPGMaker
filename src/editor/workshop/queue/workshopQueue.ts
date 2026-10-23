// src/editor/workshop/queue/workshopQueue.ts
/**
 * 공방 작업 줄 — 생성기 작업(물건 한 판·조수 요청·가져온 묶음)을 한 줄에 세우고, 동시에 N개(기본 10, 1~10)까지 비동기로 돌린다.
 * 화면(queueDock.ts)은 구독해서 그리기만 한다. 모듈 싱글턴: 채팅 패널·공방 화면이 다시 만들어져도 작업은 계속 돈다.
 *
 * 일정:
 * - 물건 작업은 줄 설 때 기물 정의만 하고, 자리가 나면 엔진 판(startRound)을 연다. 단계·후보는 판이 정본이다(jobModel.jobState).
 * - 한도·로그인 막힘(429·401·403): 막힌 작업만 「멈춤」으로 바꾸고(이유·다시 해 볼 때), 그동안 다른 작업의 모델 호출은
 *   공급자에 보내지 않고 여기서 기다리게 한다(chatHooks.before). 때가 되면 멈춘 작업 하나만 먼저 다시 해 보고(탐침),
 *   호출이 하나라도 통하면 나머지를 푼다. 또 막히면 기다림을 두 배로 늘린다 — 두드리지 않는다.
 * - 넣기(칩셋 굽기·묶음 넣기)는 installOwnership 의 맵 예약을 거친다. 조수가 그 맵을 쥐고 있으면 「넣는 중(기다림)」으로 두고
 *   예약이 풀리면 다시 넣는다. 되돌리기 기록(recordProjectSnapshot)은 굽기 자신이 남긴다.
 * 저장: jobStore(IndexedDB `oprn-workshop-jobs`). 새로 고침 뒤 다시 읽고, 판이 남은 작업은 엔진 resume 이 잇는다.
 */
import type { WorkshopItem, WorkshopRound } from "@/harnesses/_core/workshop/types";
import type { StorePackManifest } from "@/assetStore/format";
import { AI_CONNECTION_STATUS_CHANGED_EVENT } from "@/editor/panels/aiConnectionStatus";
import { addLocalPackToProject, type LocalPack } from "../genPackImport";
import type { GeneratorId } from "../generators";
import { mapObjectPalette } from "../mapObjectTarget";
import { autoPickRun, objectGenDefinition, type ObjectGenRequest } from "../objectRequest";
import { bakeWorkshopPick, isWorkshopPickBaked } from "../workshopBake";
import type { WorkshopBakedDetail } from "../workshopEvents";
import { currentWorkshopProjectKey, getWorkshopSession, peekWorkshopSession, type WorkshopSession } from "../workshopSession";
import { onInstallOwnershipChange, WorkshopInstallBusy } from "../installOwnership";
import { statusError, workshopChatHooks } from "./chatHooks";
import {
  ACTIVE_STATES, averageJobMs, blockedRun, isAccountPause, NETWORK_RETRY_LIMIT, networkBackoffMs, jobEtaMs, jobProgress, jobState, OPEN_STATES, pauseFor, usableRuns,
  type JobGenerator, type JobPause, type JobState, type WorkshopJob,
} from "./jobModel";
import { openJobStore, type JobStore } from "./jobStore";

export const QUEUE_LIMIT_KEY = "oprn:workshop-queue-limit";
export const QUEUE_MAX_LIMIT = 10;
export const QUEUE_DEFAULT_LIMIT = 10;
/** 작업 하나가 후보 몇 장을 함께 그리는가 — 엔진 장 동시 수 = 작업 수 × 이것(엔진 상한 30). */
const RUNS_PER_JOB = 3;
/** 작업이 넣어졌다(칩셋·프로젝트). detail = { jobId, job, baked? } — 조수 카드가 듣고 후속 요청을 보낸다. */
/** 시간표에 남기는 연결 끊김 기록(재시도 횟수를 센다) */
const NETWORK_PAUSE_NOTE = "연결이 끊김";
const NETWORK_REDRAW_NOTE = "연결이 끊긴 후보를 잠깐 뒤 다시 그림";
export const WORKSHOP_JOB_INSTALLED_EVENT = "oprn:workshop-job-installed";
export type WorkshopJobInstalledDetail = { readonly jobId: string; readonly job: WorkshopJob; readonly baked: WorkshopBakedDetail | null; readonly auto: boolean; readonly reason?: string };

export type JobView = {
  readonly job: WorkshopJob;
  readonly state: JobState;
  /** 한도 대기(다른 작업이 멈춰 계정이 쉬는 중)로 이 작업도 기다리는가 */
  readonly holding: boolean;
  readonly progress: number;
  readonly etaMs: number | null;
  readonly round: WorkshopRound | null;
  readonly item: WorkshopItem | null;
  readonly session: WorkshopSession | null;
};

export type AccountHold = { readonly kind: JobPause["kind"]; readonly reason: string; readonly until: number | null; readonly probeJobId: string | null };

export type QueueSnapshot = {
  readonly projectKey: string;
  readonly backend: "indexeddb" | "memory";
  readonly limit: number;
  readonly jobs: readonly JobView[];
  readonly hold: AccountHold | null;
  readonly counts: Readonly<Record<"active" | "queued" | "ready" | "paused" | "failed" | "done", number>>;
};

const now = () => Date.now();
const newJobId = () => `j${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function savedQueueLimit(): number {
  try {
    const value = Number(localStorage.getItem(QUEUE_LIMIT_KEY));
    return Number.isInteger(value) && value >= 1 && value <= QUEUE_MAX_LIMIT ? value : QUEUE_DEFAULT_LIMIT;
  } catch {
    return QUEUE_DEFAULT_LIMIT;
  }
}

type Fault = { readonly status: number; readonly message: string };

class WorkshopQueue {
  private store: JobStore | null = null;
  private storePromise: Promise<JobStore> | null = null;
  private projectKey = "";
  private loaded: Promise<void> | null = null;
  private readonly jobs = new Map<string, WorkshopJob>();
  private readonly sessionUnsubs = new Map<string, () => void>();
  private readonly listeners = new Set<() => void>();
  private readonly starting = new Set<string>();
  private readonly installing = new Set<string>();
  private readonly pendingInstall = new Map<string, { letter: string | null; auto: boolean; reason?: string }>();
  /** 「알아서 고르기」 고르기 호출이 도는 작업 */
  private readonly choosing = new Set<string>();
  /** 판 → 작업 */
  private readonly byRound = new Map<string, string>();
  /** dev: 작업 id → 다음 호출에 낼 막힘 */
  private readonly faults = new Map<string, Fault>();
  /** 막힘을 이미 멈춤으로 바꾼 장(판|글자|끝난 때) */
  private readonly handledFailures = new Set<string>();
  private probeJobId: string | null = null;
  private holdWaiters: (() => void)[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private notifyQueued = false;
  limit = savedQueueLimit();

  constructor() {
    workshopChatHooks.before = (_surface, meta) => this.beforeCall(meta?.roundId ?? null);
    workshopChatHooks.after = (_surface, meta, outcome) => this.afterCall(meta?.roundId ?? null, outcome);
    if (typeof window !== "undefined") {
      window.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, () => this.authChanged());
      onInstallOwnershipChange(() => this.retryPendingInstalls());
      // 탭을 닫거나 새로 고치면 도는 장을 「끊김」으로 남긴다(dispose → 저장소에 queued) — 그냥 두면 브라우저가 요청을 끊으면서
      // 「네트워크 오류」로 실패 처리돼, 다시 열었을 때 이어 그리지 못했다(2026-10-21 실측: 새로 고침한 작업 3장이 모두 실패로 남음).
      window.addEventListener("pagehide", (event) => {
        if (event.persisted) return;
        for (const harnessId of this.sessionUnsubs.keys()) peekWorkshopSession(harnessId)?.engine.dispose();
      });
    }
  }

  // ── 읽기 ─────────────────────────────────────────────

  backend(): "indexeddb" | "memory" { return this.store?.backend ?? "indexeddb"; }

  /** 지금 프로젝트의 줄을 읽어 둔다(프로젝트가 바뀌었으면 다시 읽는다). */
  ensure(): Promise<void> {
    const key = currentWorkshopProjectKey();
    if (key !== this.projectKey || !this.loaded) {
      this.projectKey = key;
      this.loaded = this.load(key);
    }
    return this.loaded;
  }

  private async load(key: string): Promise<void> {
    const store = await (this.storePromise ??= openJobStore());
    this.store = store;
    const rows = await store.listJobs(key);
    if (this.projectKey !== key) return;
    this.jobs.clear();
    this.byRound.clear();
    for (const job of rows.sort((a, b) => a.createdAt - b.createdAt)) {
      job.installWait = null; // 넣기 기다림은 이 세션의 예약 구독이 있어야 산다
      this.jobs.set(job.id, job);
      if (job.roundId) this.byRound.set(job.roundId, job.id);
    }
    // 판이 있는 열린 작업은 그 실행기 세션을 연다 — 세션이 열리면 엔진 resume 이 남은 장을 잇는다.
    const harnesses = new Set([...this.jobs.values()].filter((job) => job.harnessId && job.roundId && !job.installed && !job.cancelled).map((job) => job.harnessId!));
    await Promise.all([...harnesses].map((id) => this.attach(id).catch((error) => console.warn("[workshop-queue] 세션을 열지 못했다:", id, error))));
    this.emit();
    this.pump();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): QueueSnapshot {
    const views: JobView[] = [];
    const t = now();
    const all = [...this.jobs.values()].filter((job) => job.projectKey === this.projectKey).sort((a, b) => a.createdAt - b.createdAt);
    const averageMs = averageJobMs(all);
    const hold = this.accountHold();
    let queuePosition = 0;
    const counts = { active: 0, queued: 0, ready: 0, paused: 0, failed: 0, done: 0 };
    for (const job of all) {
      const session = job.harnessId ? peekWorkshopSession(job.harnessId) : null;
      const round = this.roundOf(job, session);
      const state = jobState(job, round);
      const holding = hold !== null && hold.probeJobId !== job.id && (ACTIVE_STATES.has(state) || state === "queued");
      const item = session && job.itemKey ? session.items().find((candidate) => candidate.key === job.itemKey) ?? null : null;
      const etaMs = holding ? null : jobEtaMs(job, round, { now: t, averageMs, queuePosition, limit: this.limit });
      if (state === "queued") queuePosition += 1;
      // 계정 대기로 붙잡힌 작업은 「멈춤」으로 센다 — 알약·판 머리·공방 화면이 같은 수를 보인다.
      if (holding) counts.paused += 1;
      else if (ACTIVE_STATES.has(state)) counts.active += 1;
      else if (state === "queued") counts.queued += 1;
      else if (state === "ready" || state === "installing") counts.ready += 1;
      else if (state === "paused") counts.paused += 1;
      else if (state === "failed") counts.failed += 1;
      else counts.done += 1;
      views.push({ job, state, holding, progress: jobProgress(job, round), etaMs, round, item, session });
    }
    return { projectKey: this.projectKey, backend: this.backend(), limit: this.limit, jobs: views, hold, counts };
  }

  /** 그 물건의 가장 새 작업(공방 화면이 물건 상태를 작업 줄과 맞출 때 읽는다). */
  itemView(harnessId: string, itemKey: string): JobView | null {
    const views = this.snapshot().jobs.filter((view) => view.job.harnessId === harnessId && view.job.itemKey === itemKey);
    return views.at(-1) ?? null;
  }

  private roundOf(job: WorkshopJob, session: WorkshopSession | null): WorkshopRound | null {
    if (!job.roundId || !session) return null;
    return session.rounds.find((round) => round.id === job.roundId) ?? null;
  }

  private viewState(job: WorkshopJob): JobState {
    const session = job.harnessId ? peekWorkshopSession(job.harnessId) : null;
    return jobState(job, this.roundOf(job, session));
  }

  // ── 넣기(줄 세우기) ─────────────────────────────────────

  /** 공방 화면에서 정의한 기물의 새 판을 줄 세운다. */
  async enqueueObject(input: { harnessId: string; itemKey: string; title: string; count?: number; note?: string; source?: "workshop" | "assistant"; request?: ObjectGenRequest }): Promise<WorkshopJob> {
    await this.ensure();
    const job: WorkshopJob = {
      id: newJobId(), projectKey: this.projectKey, generator: "object-gen", source: input.source ?? "workshop", title: input.title, createdAt: now(),
      harnessId: input.harnessId, itemKey: input.itemKey, ...(input.count ? { count: input.count } : {}), ...(input.note ? { note: input.note } : {}),
      ...(input.request ? { request: input.request } : {}),
      roundId: null, startedAt: null, finishedAt: null, pause: null, cancelled: false, installWait: null, installed: null, error: null, calls: 0,
      timeline: [{ at: now(), state: "queued" }],
    };
    // 같은 물건을 다시 그리면 앞서 끝난 작업(고를 차례·못 그림·그만둠)은 줄에서 뺀다 — 판·후보는 공방 기록에 남는다.
    // 안 빼면 물건 하나가 줄에 둘로 세어져 공방 화면(물건 수)과 작업 줄(작업 수)의 「고를 차례」가 어긋났다(2026-10-21 VQA).
    for (const older of [...this.jobs.values()]) {
      if (older.harnessId !== input.harnessId || older.itemKey !== input.itemKey || older.installed || older.projectKey !== this.projectKey) continue;
      const session = peekWorkshopSession(input.harnessId);
      const olderState = jobState(older, this.roundOf(older, session));
      if (olderState === "ready" || olderState === "failed" || olderState === "cancelled") await this.remove(older.id).catch(() => undefined);
    }
    this.jobs.set(job.id, job);
    await this.persist(job);
    void this.attach(input.harnessId);
    this.emit();
    this.pump();
    return job;
  }

  /** 조수의 generate_missing_object 요청: 기물을 정의하고(그 맵 칩셋의 팔레트를 뽑는다) 줄 세운다. 여러 요청이 오면 모두 함께 돈다. */
  async enqueueAssistantRequest(request: ObjectGenRequest): Promise<WorkshopJob> {
    const { store: projectStore } = await import("@/project/store");
    const project = projectStore.getCurrent();
    const map = project.maps[request.mapId];
    if (!map || map.tilesetId !== request.tilesetId || !project.tilesets[request.tilesetId]) {
      throw new Error("요청한 맵이나 칩셋이 바뀌었어요. 조수에게 다시 부탁해 주세요.");
    }
    const session = await getWorkshopSession(request.harnessId);
    let palette: string[] = [];
    if (request.harnessId === "map-objects") {
      palette = await mapObjectPalette(session.env, request.tilesetId, request.title, request.description);
      if (!palette.length) throw new Error("칩셋 그림을 읽지 못했어요. 맵 칩셋이 다 불러와졌는지 확인하고 다시 부탁해 주세요.");
    }
    const def = objectGenDefinition(request, new Set(session.items().map((item) => item.key)), palette);
    await session.store.putItemDef(session.projectKey, def);
    await session.reload();
    return this.enqueueObject({ harnessId: request.harnessId, itemKey: def.key, title: request.title, source: "assistant", request });
  }

  /** 생성기 묶음(char-gen·tile-gen·object-gen pack)을 「넣을 차례」 작업으로 둔다. 그림 바이트도 이 기기에 남겨 새로 고침 뒤에도 넣을 수 있다. */
  async enqueuePack(pack: LocalPack, generator: JobGenerator): Promise<WorkshopJob> {
    await this.ensure();
    // 같은 묶음(그림 해시 집합이 같다)을 다시 읽으면 줄에 하나만 둔다.
    const signature = pack.manifest.blobs.map((blob) => blob.sha256).sort().join(",");
    const same = [...this.jobs.values()].find((job) => job.pack && !job.installed && !job.cancelled
      && ((job.pack.manifest as StorePackManifest).blobs ?? []).map((blob) => blob.sha256).sort().join(",") === signature);
    if (same) return same;
    const firstImage = Object.values(pack.manifest.content.assets).find((asset) => pack.blobs.has(asset.blob))?.blob;
    const job: WorkshopJob = {
      id: newJobId(), projectKey: this.projectKey, generator, source: "import", title: pack.manifest.title, createdAt: now(),
      pack: { folder: pack.folder, manifest: pack.manifest, ...(firstImage ? { previewBlob: firstImage } : {}) },
      roundId: null, startedAt: now(), finishedAt: now(), pause: null, cancelled: false, installWait: null, installed: null, error: null, calls: 0,
      timeline: [{ at: now(), state: "ready", note: `묶음 「${pack.folder}」` }],
    };
    this.jobs.set(job.id, job);
    await this.store!.putPackBlobs(job.id, pack.blobs);
    await this.persist(job);
    this.emit();
    return job;
  }

  async packOf(job: WorkshopJob): Promise<LocalPack> {
    if (!job.pack) throw new Error("묶음 작업이 아니에요.");
    await this.ensure();
    const blobs = await this.store!.getPackBlobs(job.id);
    return { manifest: job.pack.manifest as StorePackManifest, blobs, folder: job.pack.folder };
  }

  // ── 사람 조작 ─────────────────────────────────────────

  setLimit(n: number): void {
    this.limit = Math.max(1, Math.min(QUEUE_MAX_LIMIT, Math.round(n)));
    try { localStorage.setItem(QUEUE_LIMIT_KEY, String(this.limit)); } catch { /* restricted storage */ }
    for (const harnessId of this.sessionUnsubs.keys()) peekWorkshopSession(harnessId)?.engine.setConcurrency(this.engineConcurrency());
    this.emit();
    this.pump();
  }

  private engineConcurrency(): number { return Math.min(30, this.limit * RUNS_PER_JOB); }

  async cancel(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || job.installed) return;
    job.cancelled = true;
    job.pause = null;
    job.finishedAt = now();
    this.mark(job, "cancelled");
    if (job.roundId && job.harnessId) await (await getWorkshopSession(job.harnessId)).engine.cancelRound(job.roundId);
    await this.persist(job);
    this.emit();
    this.pump();
  }

  /** 못 그림·그만둠·멈춤을 다시: 판이 있으면 못 그린 장만 다시 그리고, 없으면 줄에 다시 선다. */
  async retry(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || job.installed) return;
    job.cancelled = false;
    job.error = null;
    job.pause = null;
    job.finishedAt = null;
    await this.redrawStuckRuns(job);
    this.mark(job, "queued", "다시");
    await this.persist(job);
    this.emit();
    this.pump();
  }

  /** 사람이 멈춤(줄 선 작업은 자리를 비켜 주고, 도는 작업은 그만 그렸다가 「계속」에서 못 그린 장만 다시). */
  async pause(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job || job.installed || job.cancelled) return;
    job.pause = { kind: "user", reason: "직접 멈춤", until: null, at: now() };
    this.mark(job, "paused", "직접 멈춤");
    if (job.roundId && job.harnessId) await (await getWorkshopSession(job.harnessId)).engine.cancelRound(job.roundId);
    await this.persist(job);
    this.emit();
    this.pump();
  }

  async resume(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job?.pause) return;
    if (job.pause.kind !== "user") {
      // 계정 막힘은 사람이 「지금 다시」를 눌러도 탐침 하나로만 시작한다.
      job.pause = { ...job.pause, until: now() };
      await this.persist(job);
      this.pump();
      return;
    }
    job.pause = null;
    await this.redrawStuckRuns(job);
    this.mark(job, "queued", "계속");
    await this.persist(job);
    this.emit();
    this.pump();
  }

  /** 끝난 작업을 줄에서 지운다(넣은 결과·판 기록은 그대로). */
  async remove(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    const state = this.viewState(job);
    if (ACTIVE_STATES.has(state)) return;
    this.jobs.delete(id);
    if (job.roundId) this.byRound.delete(job.roundId);
    await this.store?.deleteJob(id);
    if (job.pack) await this.store?.deletePackBlobs(id);
    this.emit();
  }

  async clearFinished(): Promise<number> {
    const done = [...this.jobs.values()].filter((job) => {
      const state = this.viewState(job);
      return state === "installed" || state === "cancelled";
    });
    for (const job of done) await this.remove(job.id);
    return done.length;
  }

  /**
   * 고른 후보(물건) 또는 묶음을 프로젝트에 넣는다. 조수가 그 맵을 쥐고 있으면 「넣는 중(기다림)」으로 두고 예약이 풀리면 다시 넣는다.
   * letter = 물건 후보 글자(묶음은 무시). auto = 「알아서 고르기」가 골랐다.
   */
  async install(id: string, letter: string | null, options: { auto?: boolean; reason?: string } = {}): Promise<"installed" | "waiting"> {
    const job = this.jobs.get(id);
    if (!job) throw new Error("작업을 찾지 못했어요.");
    if (job.installed) return "installed";
    if (this.installing.has(id)) return "waiting";
    this.installing.add(id);
    const auto = options.auto === true;
    const reason = options.reason ?? "";
    try {
      let baked: WorkshopBakedDetail | null = null;
      if (job.pack) {
        const added = await addLocalPackToProject(await this.packOf(job), job.generator as GeneratorId);
        job.installed = { kind: "pack", title: added.title, assetIds: added.assetIds, tilesetIds: added.tilesetIds, at: now() };
      } else {
        if (!letter || !job.harnessId || !job.roundId) throw new Error("고른 후보가 없어요.");
        const session = await getWorkshopSession(job.harnessId);
        const item = session.items().find((candidate) => candidate.key === job.itemKey);
        const round = session.rounds.find((candidate) => candidate.id === job.roundId);
        const run = round?.runs.find((candidate) => candidate.letter === letter);
        if (!item || !round || !run?.grid) throw new Error("고른 후보를 찾지 못했어요.");
        baked = bakeWorkshopPick(item, run.grid, session.runner.palette(item), session.env, { autoPicked: auto, gate: run.gate ?? null, base: run.base ?? null });
        const at = now();
        await session.store.putPick({ projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter, at });
        await session.store.addFeedback({
          id: `f${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`, projectKey: session.projectKey, itemKey: item.key, roundId: round.id,
          letter, verdict: "pick", reasons: [], note: auto ? `알아서 고르기${reason ? ` — ${reason}` : ""}` : "작업 줄에서 고름", at,
        });
        await session.reload();
        job.installed = { kind: "object", letter, objectId: baked.objectId, tilesetId: baked.tilesetId, auto, at };
      }
      job.installWait = null;
      this.pendingInstall.delete(id);
      this.mark(job, "installed", job.installed.kind === "object" ? `${job.installed.letter} 를 넣음${auto ? "(알아서 고르기)" : ""}` : undefined);
      await this.persist(job);
      this.emit();
      window.dispatchEvent(new CustomEvent<WorkshopJobInstalledDetail>(WORKSHOP_JOB_INSTALLED_EVENT, { detail: { jobId: id, job: structuredClone(job), baked, auto, ...(reason ? { reason } : {}) } }));
      return "installed";
    } catch (error) {
      if (error instanceof WorkshopInstallBusy) {
        job.installWait = error.message;
        this.pendingInstall.set(id, { letter, auto, reason });
        this.mark(job, "installing", "조수 작업이 끝나기를 기다림");
        this.emit();
        return "waiting";
      }
      throw error;
    } finally {
      this.installing.delete(id);
    }
  }

  private retryPendingInstalls(): void {
    for (const [id, pending] of [...this.pendingInstall]) {
      void this.install(id, pending.letter, { auto: pending.auto, ...(pending.reason ? { reason: pending.reason } : {}) }).catch((error: unknown) => {
        const job = this.jobs.get(id);
        if (!job) return;
        job.installWait = null;
        this.pendingInstall.delete(id);
        job.error = error instanceof Error ? error.message : String(error);
        this.emit();
      });
    }
  }

  // ── dev 시험 고리 ──────────────────────────────────────

  /** 다음 모델 호출을 429(계정 한도)로 막는다 — 실제 막힘과 같은 길(엔진 → 멈춤 → 탐침)을 탄다. dev 빌드에서만 창에 걸린다. */
  fault429(jobId: string, resetsIn = "0h1m"): void {
    this.faults.set(jobId, { status: 429, message: `Individual quota reached (RESOURCE_EXHAUSTED, simulated). Resets in ${resetsIn}` });
  }

  // ── 일정 ──────────────────────────────────────────────

  /** 계정 대기: 계정 막힘으로 멈춘 작업 중 아직 때가 안 된 것이 있으면 그 이유. 때가 지났으면 탐침 중일 때만. */
  accountHold(): AccountHold | null {
    const t = now();
    let hold: AccountHold | null = null;
    for (const job of this.jobs.values()) {
      const pause = job.pause;
      if (!pause || !isAccountPause(pause.kind) || job.cancelled || job.installed || job.projectKey !== this.projectKey) continue;
      if (pause.until !== null && pause.until <= t) continue;
      if (!hold || pause.until === null || (hold.until !== null && pause.until > hold.until)) hold = { kind: pause.kind, reason: pause.reason, until: pause.until, probeJobId: null };
    }
    if (hold) return hold;
    if (this.probeJobId) {
      const probe = this.jobs.get(this.probeJobId);
      return { kind: "rate", reason: `「${probe?.title ?? ""}」로 먼저 다시 해 보는 중`, until: null, probeJobId: this.probeJobId };
    }
    return null;
  }

  /** 모델 호출 직전: 막아 둔 시험 고장이 있으면 던지고, 계정 대기 중이면(탐침이 아니면) 공급자에 보내지 않고 기다린다. */
  private async beforeCall(roundId: string | null): Promise<void> {
    const jobId = roundId ? this.byRound.get(roundId) ?? null : null;
    const fault = jobId ? this.faults.get(jobId) : undefined;
    if (jobId && fault) {
      this.faults.delete(jobId);
      throw statusError(fault.status, fault.message);
    }
    for (;;) {
      const hold = this.accountHold();
      if (!hold || (jobId !== null && hold.probeJobId === jobId)) return;
      await new Promise<void>((resolve) => this.holdWaiters.push(resolve));
    }
  }

  private afterCall(roundId: string | null, outcome: { ok: boolean; status?: number; ms: number }): void {
    const jobId = roundId ? this.byRound.get(roundId) : undefined;
    const job = jobId ? this.jobs.get(jobId) : undefined;
    if (!job) return;
    job.calls += 1;
    job.timeline.push({ at: now(), state: "call", note: `${outcome.ok ? "ok" : `오류 ${outcome.status ?? ""}`.trim()} ${Math.round(outcome.ms / 100) / 10}s` });
    if (outcome.ok && this.probeJobId === job.id) {
      // 탐침이 통했다 — 계정이 풀렸다. 기다리던 호출·멈춘 작업을 푼다.
      this.probeJobId = null;
      job.timeline.push({ at: now(), state: "call", note: "탐침 통과 — 계정이 풀림" });
      this.releaseDuePauses();
      this.releaseHoldWaiters();
      this.pump();
    }
    void this.persist(job);
  }

  /** 탐침이 통한 뒤: 때가 된 계정 멈춤을 모두 풀고 못 그린 장을 다시 그린다. */
  private releaseDuePauses(): void {
    const t = now();
    for (const job of this.jobs.values()) {
      if (!job.pause || job.pause.kind === "user" || job.pause.until === null || job.pause.until > t || job.cancelled || job.installed) continue;
      job.pause = null;
      this.mark(job, "queued", "계정이 풀려 이어서");
      void this.persist(job);
      void this.redrawStuckRuns(job).then(() => this.emit());
    }
  }

  private releaseHoldWaiters(): void {
    if (this.accountHold()) return;
    const waiters = this.holdWaiters;
    this.holdWaiters = [];
    for (const resolve of waiters) resolve();
  }

  private authChanged(): void {
    let changed = false;
    for (const job of this.jobs.values()) {
      if (job.pause?.kind === "auth") { job.pause = { ...job.pause, until: now() }; changed = true; }
    }
    if (changed) this.pump();
  }

  /** 실행기 세션을 붙인다(판 변화 구독 + 엔진 장 동시 수). */
  private async attach(harnessId: string): Promise<WorkshopSession> {
    const session = await getWorkshopSession(harnessId);
    if (!this.sessionUnsubs.has(harnessId)) {
      session.engine.setConcurrency(this.engineConcurrency());
      this.sessionUnsubs.set(harnessId, session.subscribe(() => this.onSessionChange(session)));
    }
    return session;
  }

  private onSessionChange(session: WorkshopSession): void {
    // 한 판의 여러 장이 같은 까닭으로 한꺼번에 막히면 멈춤은 한 번만 센다(물러서기·재시도 횟수가 장 수만큼 뛰지 않게).
    const pausedNow = new Set<string>();
    for (const job of this.jobs.values()) {
      if (job.harnessId !== session.harnessId || !job.roundId || job.installed) continue;
      const round = session.rounds.find((candidate) => candidate.id === job.roundId);
      if (!round) continue;
      // 막힌 장 → 이 작업 멈춤 + 계정 대기(다른 작업 호출은 beforeCall 에서 기다린다)
      for (const run of round.runs) {
        const kind = blockedRun(run);
        const key = `${round.id}|${run.letter}|${run.finishedAt ?? ""}`;
        if (!kind || this.handledFailures.has(key)) continue;
        this.handledFailures.add(key);
        // 이미 같은 까닭으로 멈춰 있으면 다시 세지 않는다 — 풀릴 때 못 그린 장을 모두 다시 그린다.
        if (pausedNow.has(job.id) || job.pause?.kind === kind) continue;
        if (kind === "network") {
          // 연결 끊김은 몇 번까지만 다시 해 본다 — 그 뒤는 「못 그림」(다시 그리기는 사람이)
          const tries = job.timeline.filter((entry) => entry.note === NETWORK_PAUSE_NOTE || entry.note === NETWORK_REDRAW_NOTE).length;
          if (tries >= NETWORK_RETRY_LIMIT) continue;
          // 고를 후보가 이미 있으면 작업을 멈추지 않는다(사람이 지금 고를 수 있게) — 끊긴 장만 잠깐 뒤 다시 그린다.
          if (round.runs.some((other) => other.status === "done" && other.grid)) {
            this.mark(job, jobState(job, round), NETWORK_REDRAW_NOTE);
            void this.persist(job);
            const roundId = round.id, letter = run.letter;
            setTimeout(() => {
              if (job.cancelled || job.installed || job.roundId !== roundId) return;
              void session.engine.redrawRun(roundId, letter, "");
            }, networkBackoffMs(tries + 1));
            continue;
          }
        }
        const strikes = (job.pause?.kind === kind ? 1 : 0) + (this.probeJobId === job.id ? 1 : 0) + (job.timeline.filter((entry) => entry.state === "paused").length);
        job.pause = pauseFor(kind, run.error ?? "", now(), strikes);
        if (this.probeJobId === job.id) this.probeJobId = null;
        pausedNow.add(job.id);
        this.mark(job, "paused", job.pause.reason);
        void this.persist(job);
      }
      const state = jobState(job, round);
      const last = [...job.timeline].reverse().find((entry) => entry.state !== "call")?.state;
      if (state !== last && state !== "paused") {
        if ((state === "ready" || state === "failed") && !job.finishedAt) job.finishedAt = now();
        this.mark(job, state);
        void this.persist(job);
      }
      // 공방 화면(판 화면)에서 고르고 구운 경우 — 줄에도 「넣음」으로 맞춘다.
      if (state === "ready") {
        const pick = session.picks.find((candidate) => candidate.roundId === round.id);
        const item = session.items().find((candidate) => candidate.key === job.itemKey);
        const grid = pick ? round.runs.find((run) => run.letter === pick.letter)?.grid : undefined;
        if (pick && item && grid && isWorkshopPickBaked(item, grid)) {
          job.installed = { kind: "object", letter: pick.letter, objectId: `workshop:${item.key.replace(/^new:/, "")}`, tilesetId: item.tilesetId ?? "atlas_biome_interior", auto: false, at: now() };
          this.mark(job, "installed", `${pick.letter} 를 넣음(공방 화면)`);
          void this.persist(job);
          window.dispatchEvent(new CustomEvent<WorkshopJobInstalledDetail>(WORKSHOP_JOB_INSTALLED_EVENT, { detail: { jobId: job.id, job: structuredClone(job), baked: null, auto: false } }));
        } else if (job.source === "assistant" && !this.installing.has(job.id) && !this.pendingInstall.has(job.id) && !this.choosing.has(job.id)) {
          this.maybeAutoPick(job, round);
        }
      }
    }
    this.emit();
    this.pump();
  }

  /**
   * 조수 요청 작업은 사용자가 켠 「알아서 고르기」면 검수 통과 후보를 넣는다(카드가 닫혀 있어도).
   * 통과가 둘 이상이면 object-gen 고르기(assistantObjectGen.chooseAutoPick — 고르기 3번 다수결)를 한 번 거친다.
   */
  private maybeAutoPick(job: WorkshopJob, round: WorkshopRound): void {
    let on = false;
    try { on = localStorage.getItem("oprn:assistant-objectgen-autopick") === "1"; } catch { /* restricted */ }
    if (!on || job.timeline.some((entry) => entry.note === "알아서 고르기: 통과 후보 없음")) return;
    if (!autoPickRun(usableRuns(round))) {
      this.mark(job, "ready", "알아서 고르기: 통과 후보 없음");
      return;
    }
    if (!job.harnessId || !job.itemKey) return;
    this.choosing.add(job.id);
    if (!job.timeline.some((entry) => entry.note === "알아서 고르기: 고르는 중")) this.mark(job, "ready", "알아서 고르기: 고르는 중");
    const session = peekWorkshopSession(job.harnessId);
    const itemKey = job.itemKey;
    void import("../assistantObjectGen")
      .then(async ({ chooseAutoPick }) => (session ? chooseAutoPick({ session, itemKey, roundId: round.id }) : null))
      .then((choice) => {
        this.choosing.delete(job.id);
        const letter = choice?.letter ?? autoPickRun(usableRuns(round))?.letter;
        if (!letter || job.installed || job.cancelled) { this.emit(); return; }
        return this.install(job.id, letter, { auto: true, reason: choice?.reason ?? "검수 통과 첫 후보" });
      })
      .catch((error: unknown) => {
        this.choosing.delete(job.id);
        job.error = error instanceof Error ? error.message : String(error);
        this.emit();
      });
  }

  private async redrawStuckRuns(job: WorkshopJob): Promise<void> {
    if (!job.roundId || !job.harnessId) return;
    const session = await this.attach(job.harnessId);
    const round = session.rounds.find((candidate) => candidate.id === job.roundId);
    if (!round) { job.roundId = null; return; }
    for (const run of round.runs) {
      if (run.status === "failed" || run.status === "cancelled") await session.engine.redrawRun(round.id, run.letter, "");
    }
  }

  /** 자리가 나면 줄 선 작업을 시작하고, 때가 된 멈춘 작업은 하나씩(탐침) 다시 해 본다. */
  pump(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const t = now();
    const all = [...this.jobs.values()].filter((job) => job.projectKey === this.projectKey).sort((a, b) => a.createdAt - b.createdAt);
    // 0) 때가 된 연결 끊김: 계정과 상관없으니 하나씩 재지 않고 모두 다시 그린다
    for (const job of all) {
      if (job.pause?.kind !== "network" || job.pause.until === null || job.pause.until > t || job.cancelled || job.installed) continue;
      job.pause = null;
      this.mark(job, "queued", "연결이 돌아와 다시 그림");
      void this.persist(job);
      void this.redrawStuckRuns(job).then(() => this.emit());
    }
    // 1) 때가 된 계정 멈춤: 탐침이 없을 때 하나만 다시 해 본다
    const due = all.filter((job) => job.pause && isAccountPause(job.pause.kind) && job.pause.until !== null && job.pause.until <= t && !job.cancelled && !job.installed);
    if (due.length && !this.probeJobId && !this.accountHoldIgnoring(due)) {
      const probe = due[0]!;
      this.probeJobId = probe.id;
      probe.pause = null;
      this.mark(probe, "queued", "다시 해 보기(탐침)");
      void this.persist(probe);
      void this.redrawStuckRuns(probe).then(() => { this.emit(); this.pump(); });
      // 탐침이 아직 판을 못 열었으면(줄에서 멈춘 작업) 아래에서 시작된다.
    }
    const hold = this.accountHold();
    const active = all.filter((job) => this.starting.has(job.id) || ACTIVE_STATES.has(this.viewState(job))).length;
    let room = this.limit - active;
    for (const job of all) {
      if (room <= 0) break;
      if (job.generator !== "object-gen" || job.pack || job.roundId || job.pause || job.cancelled || job.error || this.starting.has(job.id)) continue;
      if (hold && hold.probeJobId !== job.id) break; // 계정 대기 중에는 새 작업을 열지 않는다(탐침만)
      room -= 1;
      void this.start(job);
    }
    // 다음 깰 때: 가장 이른 멈춤 풀리는 때
    const next = all.map((job) => job.pause?.until ?? null).filter((until): until is number => until !== null && until > t).sort((a, b) => a - b)[0];
    if (next !== undefined) this.timer = setTimeout(() => { this.releaseHoldWaiters(); this.emit(); this.pump(); }, Math.min(next - t + 50, 2 ** 31 - 1));
    this.releaseHoldWaiters();
  }

  /** due 를 빼고도 남는 계정 대기가 있는가(다른 작업이 아직 막힘 기간 안이면 탐침도 미룬다). */
  private accountHoldIgnoring(due: readonly WorkshopJob[]): boolean {
    const t = now();
    const ids = new Set(due.map((job) => job.id));
    return [...this.jobs.values()].some((job) => !ids.has(job.id) && job.pause && isAccountPause(job.pause.kind) && (job.pause.until === null || job.pause.until > t) && !job.cancelled && !job.installed);
  }

  private async start(job: WorkshopJob): Promise<void> {
    if (!job.harnessId || !job.itemKey) return;
    this.starting.add(job.id);
    try {
      const session = await this.attach(job.harnessId);
      const item = session.items().find((candidate) => candidate.key === job.itemKey);
      if (!item) throw new Error("기물 정의를 찾지 못했어요(다른 기기에서 지웠을 수 있어요).");
      if (job.cancelled) return;
      // 판을 열기 전에 판 id 를 알 수 없으므로, 열리는 동안 낸 호출은 onChange 가 판을 넘겨 줄 때 이어 붙인다.
      const round = await session.engine.startRound(item, { ...(job.count ? { count: job.count } : {}), ...(job.note ? { note: job.note } : {}) });
      job.roundId = round.id;
      job.startedAt = now();
      this.byRound.set(round.id, job.id);
      this.mark(job, "drawing", `후보 ${round.runs.length}장`);
      await this.persist(job);
      await session.reload();
    } catch (error) {
      job.error = error instanceof Error ? error.message : String(error);
      job.finishedAt = now();
      this.mark(job, "failed", job.error);
      await this.persist(job);
    } finally {
      this.starting.delete(job.id);
      this.emit();
      this.pump();
    }
  }

  private mark(job: WorkshopJob, state: JobState, note?: string): void {
    job.timeline.push({ at: now(), state, ...(note ? { note } : {}) });
    if (job.timeline.length > 200) job.timeline.splice(0, job.timeline.length - 200);
  }

  private persist(job: WorkshopJob): Promise<void> {
    return this.store ? this.store.putJob(job).catch((error) => console.warn("[workshop-queue] 저장 실패:", error)) : Promise.resolve();
  }

  private emit(): void {
    if (this.notifyQueued) return;
    this.notifyQueued = true;
    queueMicrotask(() => {
      this.notifyQueued = false;
      for (const listener of this.listeners) listener();
    });
  }

  /** 열린 작업이 있는가(다음 단계를 기다리거나 사람 손을 기다린다) */
  hasOpenJobs(): boolean {
    return [...this.jobs.values()].some((job) => job.projectKey === this.projectKey && OPEN_STATES.has(this.viewState(job)));
  }
}

let instance: WorkshopQueue | null = null;

export function workshopQueue(): WorkshopQueue {
  if (!instance) {
    instance = new WorkshopQueue();
    // 시험 고리(fault429·snapshot): dev 빌드, 또는 이 기기에 QA 표시(localStorage oprn:workshop-queue-qa=1)가 있을 때만.
    // 자기 세션의 호출만 막을 수 있어 남에게 닿는 것은 없다 — 출하본에서 한도 막힘 흐름을 실제로 재현하려고 둔다.
    let qa = import.meta.env.DEV;
    try { qa ||= localStorage.getItem("oprn:workshop-queue-qa") === "1"; } catch { /* restricted storage */ }
    if (qa && typeof window !== "undefined") (window as unknown as Record<string, unknown>).__oprnWorkshopQueue = instance;
  }
  return instance;
}

export type { WorkshopQueue };
