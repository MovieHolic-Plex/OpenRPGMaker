import type { AiJob, AiJobEvent, AiJobInboxItem, AiJobInput, AiJobResult, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import { store } from "@/project/store";
import { sameProjectIdentity } from "@/project/loadedProjectIdentity";
import { ApplicationClient } from "./applicationClient";
import { applyJobResult, retryJobSave, type JobApplicationOutcome } from "./applyJobResult";
import type { JobReview } from "./materializeJobResult";

export interface JobAdmission {
  readonly input: Omit<AiJobInput, "projectSnapshot" | "artwork">;
  readonly projectSnapshot: JsonValue;
  readonly artwork: readonly { mediaType: string; base64: string }[];
}
export type JobConnection = "connecting" | "connected" | "offline" | "unavailable";
export interface JobClientOptions {
  readonly transport?: typeof fetch;
  readonly events?: (url: string) => EventSource;
  readonly root?: string;
  readonly reconcile?: boolean;
}
export class JobClient {
  readonly artifacts: ApplicationClient;
  readonly jobs = new Map<string, AiJob>();
  readonly inbox = new Map<number, AiJobInboxItem>();
  readonly outcomes = new Map<string, JobApplicationOutcome>();
  readonly labels = new Map<string, string>();
  private readonly inputs = new Map<string, Promise<AiJobInput>>();
  connection: JobConnection = "connecting";
  error = "";
  generationAvailable = false;
  configuredBackend: string | null = null;
  sequence = 0;
  private readonly transport: typeof fetch;
  private readonly root: string;
  private readonly events: (url: string) => EventSource;
  private readonly listeners = new Set<() => void>();
  private readonly versions = new Map<string, number>();
  private readonly acceptedRequests = new Map<string, number>();
  private nextRequest = 0;
  private readonly reads = new Map<number, Promise<void>>();
  private readonly acknowledged = new Set<number>();
  private readonly autoKeys = new Map<string, string>();
  private readonly applying = new Set<string>();
  private source: EventSource | null = null;
  private streamOpen = false;
  private sessionRequest = 0;
  private started = false;
  private disposed = false;
  private epoch = 0;
  private availability: (() => void) | null = null;
  private projectSubscription: (() => void) | null = null;
  private connectivityTarget: Window | null = null;
  private readonly onOffline = (): void => {
    this.epoch++; this.source?.close(); this.source = null; this.streamOpen = false;
    this.connection = "offline"; this.error = "네트워크 연결이 끊겼습니다. 입력과 보존된 결과는 유지됩니다."; this.emit();
  };
  private readonly onOnline = (): void => { void this.connect(); };
  private readonly reconcileEnabled: boolean;
  constructor(options: JobClientOptions = {}) {
    this.root = options.root ?? "/api/ai-jobs";
    this.transport = options.transport ?? ((...args) => fetch(...args));
    this.events = options.events ?? (url => new EventSource(url));
    this.artifacts = new ApplicationClient(this.root, this.transport);
    this.reconcileEnabled = options.reconcile !== false;
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(): void { if (!this.disposed) for (const listener of this.listeners) listener(); }
  get running(): number { return [...this.jobs.values()].filter(job => job.generation === "running" || job.generation === "queued").length; }
  get unread(): number { return [...this.inbox.values()].filter(item => item.readAt === null).length; }
  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    let projectKey = this.loadedKey();
    const changed = (): void => {
      const next = this.loadedKey();
      if (next === projectKey) return;
      projectKey = next; this.retryPendingApplicationReads(); this.emit(); void this.reconcile();
    };
    this.availability = store.subscribeApplicationAvailability(changed);
    this.projectSubscription = store.subscribe(changed);
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      this.connectivityTarget = window;
      this.connectivityTarget.addEventListener("offline", this.onOffline);
      this.connectivityTarget.addEventListener("online", this.onOnline);
      void this.connect();
    } else {
      this.connection = "unavailable";
      this.error = "브라우저 창이 없어 작업 서버에 연결하지 않습니다.";
      this.emit();
    }
  }
  private loadedKey(): string {
    const identity = store.getLoadedProjectIdentity();
    return JSON.stringify([identity.backend, identity.projectId, store.getProjectEpoch(), store.isLoaded(), store.hasReadOnlyProjectSnapshot()]);
  }
  private retryPendingApplicationReads(): void {
    for (const id of this.autoKeys.keys()) {
      const outcome = this.outcomes.get(id);
      if (!outcome || outcome.application === "awaiting-editor") this.autoKeys.delete(id);
    }
  }
  async connect(): Promise<void> {
    if (this.disposed) return;
    this.retryPendingApplicationReads();
    const epoch = ++this.epoch;
    this.source?.close(); this.source = null; this.streamOpen = false;
    this.connection = "connecting"; this.emit();
    try {
      // Reads do not require CSRF. Start the native reconnecting stream even if
      // an online-transition session fetch fails before the network is ready.
      // No query cursor: native reconnect must be allowed to send its newer Last-Event-ID.
      const source = this.events(`${this.root}/events`); this.source = source;
      source.addEventListener("open", () => {
        if (source !== this.source) return;
        this.streamOpen = true; this.retryPendingApplicationReads();
        void this.refreshSession(epoch).then(ready => { if (ready) void this.refresh(); });
      });
      source.addEventListener("error", () => {
        if (source !== this.source) return;
        this.streamOpen = false; this.connection = "offline"; this.error = "로컬 작업 서버 연결이 끊겼습니다. 저장된 결과는 유지됩니다."; this.emit();
      });
      for (const name of ["admitted", "updated", "outcome", "inbox-read"]) source.addEventListener(name, event => {
        if (source !== this.source) return;
        try { this.receive(JSON.parse((event as MessageEvent<string>).data) as AiJobEvent); }
        catch (error) { this.fail(error); }
      });
      if (await this.refreshSession(epoch)) await this.refresh();
    } catch (error) { if (epoch === this.epoch) this.fail(error); }
  }
  private async refreshSession(epoch: number): Promise<boolean> {
    const request = ++this.sessionRequest;
    try {
      const session = await this.get<{ generationAvailable: boolean; unavailableReason?: string; configuredBackend: string | null }>("/session");
      if (epoch !== this.epoch || request !== this.sessionRequest || this.disposed) return false;
      this.generationAvailable = session.generationAvailable;
      this.configuredBackend = session.configuredBackend;
      this.error = session.unavailableReason ?? "";
      this.connection = this.streamOpen ? this.generationAvailable ? "connected" : "unavailable" : "connecting";
      this.emit(); return true;
    } catch (error) {
      if (epoch === this.epoch && request === this.sessionRequest) this.fail(error);
      return false;
    }
  }
  private receive(event: AiJobEvent): void {
    if (!Number.isSafeInteger(event.seq) || event.seq < 1 || !["admitted", "updated", "outcome", "inbox-read"].includes(event.kind)) throw new Error("Invalid AI job event");
    if (event.seq <= this.sequence) return;
    this.sequence = event.seq;
    this.versions.set(event.jobId, (this.versions.get(event.jobId) ?? 0) + 1);
    if (event.kind === "outcome" && !this.inbox.has(event.seq)) this.inbox.set(event.seq, { eventSeq: event.seq, jobId: event.jobId, createdAt: event.createdAt, readAt: this.acknowledged.has(event.seq) ? event.createdAt : null });
    // inbox-read carries the job identity, not the original inbox sequence. Read the authoritative inbox.
    if (event.kind === "inbox-read") void this.refreshInbox();
    this.emit(); void this.refreshJob(event.jobId);
  }
  private async get<T>(path: string): Promise<T> {
    const response = await this.transport(this.root + path, { cache: "no-store" });
    if (!response.ok) throw new Error(`AI jobs HTTP ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }
  private fail(error: unknown): void { this.error = error instanceof Error ? error.message : String(error); this.connection = "offline"; this.emit(); }
  async refresh(): Promise<void> {
    const epoch = this.epoch, versions = new Map(this.versions), request = ++this.nextRequest;
    try {
      const [{ jobs }] = await Promise.all([this.get<{ jobs: AiJob[] }>(""), this.refreshInbox()]);
      if (this.disposed || epoch !== this.epoch) return;
      for (const job of jobs) if ((versions.get(job.id) ?? 0) === (this.versions.get(job.id) ?? 0) && request > (this.acceptedRequests.get(job.id) ?? 0)) {
        this.acceptJob(job); this.acceptedRequests.set(job.id, request);
      }
      this.emit(); void this.reconcile();
    } catch (error) { if (epoch === this.epoch) this.fail(error); }
  }
  async refreshJob(id: string): Promise<void> {
    const version = this.versions.get(id) ?? 0, epoch = this.epoch, request = ++this.nextRequest;
    try {
      const { job } = await this.artifacts.detail(id);
      if (this.disposed || epoch !== this.epoch || version !== (this.versions.get(id) ?? 0) || request <= (this.acceptedRequests.get(id) ?? 0)) return;
      this.acceptJob(job); this.acceptedRequests.set(id, request);
      this.emit(); void this.reconcile();
    } catch (error) { if (epoch === this.epoch) this.fail(error); }
  }
  private acceptJob(job: AiJob): void {
    this.jobs.set(job.id, job);
    const local = this.outcomes.get(job.id);
    const receipt = job.applicationEvidence?.receipt as JsonObject | null | undefined;
    if (local?.receiptId && receipt
      && receipt.receiptId === local.receiptId && receipt.resultSha256 === job.resultRef?.sha256
      && receipt.application === local.application) this.outcomes.delete(job.id);
  }
  private async refreshInbox(): Promise<boolean> {
    const epoch = this.epoch;
    try {
      const { inbox } = await this.get<{ inbox: AiJobInboxItem[] }>("/inbox");
      if (epoch !== this.epoch || this.disposed) return false;
      for (const item of inbox) {
        if (item.readAt !== null) this.acknowledged.add(item.eventSeq);
        const current = this.inbox.get(item.eventSeq);
        this.inbox.set(item.eventSeq, { ...item, readAt: current?.readAt ?? (this.acknowledged.has(item.eventSeq) ? item.readAt ?? item.createdAt : item.readAt) });
      }
      this.emit(); return true;
    } catch (error) { if (epoch === this.epoch) this.fail(error); return false; }
  }
  async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    const { csrfToken } = await this.get<{ csrfToken: string }>("/session");
    const response = await this.transport(this.root + path, { method: "POST", headers: { "Content-Type": "application/json", "X-AI-Jobs-CSRF": csrfToken, ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`AI jobs HTTP ${response.status}: ${await response.text()}`);
    return response.json() as Promise<T>;
  }
  readInput(job: AiJob): Promise<AiJobInput> {
    const key = `${job.id}:${job.inputRef.sha256}`;
    let pending = this.inputs.get(key);
    if (!pending) {
      pending = this.artifacts.json<AiJobInput>(job.id, job.inputRef).then(input => {
        const label = [input.payload.instruction, input.payload.brief, input.payload.prompt].find(value => typeof value === "string");
        if (typeof label === "string") { this.labels.set(job.id, label); this.emit(); }
        return input;
      }).catch(error => { this.inputs.delete(key); throw error; });
      this.inputs.set(key, pending);
    }
    return pending;
  }
  async admit(request: JobAdmission, idempotencyKey: string): Promise<{ job: AiJob; created: boolean }> {
    const receipt = await this.post<{ job: AiJob; created: boolean }>("", request, idempotencyKey);
    await this.refreshJob(receipt.job.id); return receipt;
  }
  async cancel(id: string): Promise<void> { await this.post(`/${encodeURIComponent(id)}/cancel`, {}); await this.refreshJob(id); }
  async retry(id: string, stage: "generation" | "report", acknowledgeDuplicateSpend = false): Promise<void> {
    await this.post(`/${encodeURIComponent(id)}/retry`, { stage, acknowledgeDuplicateSpend }); await this.refreshJob(id);
  }
  async markRead(id: string): Promise<void> {
    if (!await this.refreshInbox()) throw new Error(this.error || "알림 상태를 확인하지 못했습니다.");
    await Promise.all([...this.inbox.values()].filter(item => item.jobId === id && item.readAt === null).map(item => {
      const pending = this.reads.get(item.eventSeq); if (pending) return pending;
      const promise = this.post<{ inbox: AiJobInboxItem[] }>(`/inbox/${item.eventSeq}/read`, {}).then(({ inbox }) => {
        this.acknowledged.add(item.eventSeq);
        for (const next of inbox) { if (next.readAt !== null) this.acknowledged.add(next.eventSeq); if (!this.inbox.get(next.eventSeq)?.readAt) this.inbox.set(next.eventSeq, next); }
        this.emit();
      }).finally(() => this.reads.delete(item.eventSeq));
      this.reads.set(item.eventSeq, promise); return promise;
    }));
  }
  async apply(id: string, review: JobReview): Promise<JobApplicationOutcome> {
    const outcome = await applyJobResult(id, { client: this.artifacts, review });
    this.outcomes.set(id, outcome); this.emit(); await this.refreshJob(id); return outcome;
  }
  async save(id: string): Promise<JobApplicationOutcome> {
    const outcome = await retryJobSave(id, { client: this.artifacts });
    this.outcomes.set(id, outcome); this.emit(); await this.refreshJob(id); return outcome;
  }
  private async reconcile(): Promise<void> {
    if (!this.reconcileEnabled || this.disposed || !store.isLoaded() || this.connection === "offline") return;
    for (const job of this.jobs.values()) {
      const localApplication = this.outcomes.get(job.id)?.application;
      if (localApplication && ["conflict", "outcome-unknown", "applied"].includes(localApplication)) continue;
      if (job.generation !== "succeeded" || !job.resultRef || !["not-requested", "awaiting-editor"].includes(job.application) || !sameProjectIdentity(job.project, store.getLoadedProjectIdentity()) || this.applying.has(job.id)) continue;
      const key = `${job.resultRef.sha256}:${store.getProjectEpoch()}`;
      if (this.autoKeys.get(job.id) === key) continue;
      this.autoKeys.set(job.id, key); this.applying.add(job.id);
      try {
        const [input, result] = await Promise.all([this.readInput(job), this.artifacts.json<AiJobResult>(job.id, job.resultRef)]);
        if (this.disposed || input.mode !== "auto" || !["assistant", "database", "image"].includes(job.family) || !result.generatedSnapshot) continue;
        const outcome = await applyJobResult(job.id, { client: this.artifacts });
        this.outcomes.set(job.id, outcome); this.emit(); await this.refreshJob(job.id);
      } catch (error) { this.autoKeys.delete(job.id); this.fail(error); }
      finally { this.applying.delete(job.id); }
    }
  }
  dispose(): void {
    this.disposed = true; this.epoch++; this.source?.close(); this.source = null;
    this.availability?.(); this.projectSubscription?.();
    this.connectivityTarget?.removeEventListener("offline", this.onOffline);
    this.connectivityTarget?.removeEventListener("online", this.onOnline);
    this.connectivityTarget = null; this.listeners.clear();
  }
}
let editorClient: JobClient | undefined;
export function getJobClient(): JobClient { editorClient ??= new JobClient(); editorClient.start(); return editorClient; }
export function disposeJobClient(): void { editorClient?.dispose(); editorClient = undefined; }

/** Manifest membership plus byte hash verification; caller owns the resulting object URL. */
export async function verifiedArtifact(client: JobClient, id: string, ref: BlobRef, manifest: readonly BlobRef[]): Promise<Uint8Array> {
  if (!manifest.some(item => item.sha256 === ref.sha256 && item.byteLength === ref.byteLength && item.mediaType === ref.mediaType)) throw new Error("Artifact is outside the immutable report manifest");
  return client.artifacts.bytes(id, ref);
}
