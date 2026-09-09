import { vi } from "vitest";
import type { AiJob, AiJobCheckpoint, AiJobResult, BlobRef, JsonObject, JsonValue } from "@/ai/jobs/contracts";
import type { SessionProgress } from "@/ai/jobs/sessionProgress";
import { JobClient, type JobAdmission } from "@/editor/aiJobs/jobClient";
import * as jobClient from "@/editor/aiJobs/jobClient";
import { sha256HexBytes } from "@/util/sha256";

export const PNG_1x1 = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAXgN1WQAAAABJRU5ErkJggg=="),
  char => char.charCodeAt(0),
);

export const PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAXgN1WQAAAABJRU5ErkJggg==";

const EMPTY_REF = { sha256: "0".repeat(64), byteLength: 2, mediaType: "application/json" } as const;

export function jobResult(family: AiJob["family"], jobId: string, payload: JsonObject, extras: {
  readonly project?: AiJob["project"];
  readonly baseSnapshot?: BlobRef;
  readonly generatedSnapshot?: BlobRef | null;
} = {}): AiJobResult {
  return {
    version: 1,
    family,
    jobId,
    attemptId: `${jobId}-a`,
    project: extras.project ?? { backend: "local", projectId: "fixture" },
    baseSnapshot: extras.baseSnapshot ?? EMPTY_REF,
    generatedSnapshot: extras.generatedSnapshot === undefined ? null : extras.generatedSnapshot,
    artifacts: [],
    payload,
  };
}

export function whenDom(root: Node, predicate: () => boolean, timeoutMs = 5_000): Promise<void> {
  if (predicate()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      if (predicate()) {
        observer.disconnect();
        clearTimeout(deadline);
        resolve();
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    const deadline = setTimeout(() => {
      observer.disconnect();
      reject(new Error("dom predicate not reached"));
    }, timeoutMs);
  });
}

export function whenTestId(root: ParentNode, testId: string, timeoutMs = 5_000): Promise<Element> {
  const existing = root.querySelector(`[data-testid="${testId}"]`);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const node = root.querySelector(`[data-testid="${testId}"]`);
      if (node) {
        observer.disconnect();
        clearTimeout(deadline);
        resolve(node);
      }
    });
    observer.observe(root, { subtree: true, childList: true, attributes: true });
    const deadline = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Missing ${testId}`));
    }, timeoutMs);
  });
}

export function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

export function fakeJob(family: AiJob["family"], id: string): AiJob {
  return {
    id,
    idempotencyKey: id,
    family,
    project: { backend: "local", projectId: "fixture" },
    inputRef: { sha256: "0".repeat(64), byteLength: 2, mediaType: "application/json" },
    createdAt: 1,
    updatedAt: 1,
    generation: "queued",
    report: "pending",
    application: "not-requested",
    save: "not-requested",
    activeAttemptId: null,
    resultRef: null,
    reportRef: null,
    applicationEvidence: null,
    saveEvidence: null,
  };
}

export function installAdmitClient(options: { readonly reconcile?: boolean } = {}): {
  readonly client: JobClient;
  readonly admits: JobAdmission[];
  readonly keys: string[];
  readonly jobs: Map<string, AiJob>;
  readonly admitted: Promise<JobAdmission>;
  nextAdmitted: () => Promise<JobAdmission>;
  failNext: (message?: string) => void;
  lastJob: () => AiJob;
  putJson: (value: unknown) => Promise<BlobRef>;
  putBytes: (bytes: Uint8Array, mediaType: string) => Promise<BlobRef>;
  complete: (payload: JsonObject, id?: string, generated?: unknown) => Promise<AiJob>;
  /** Publish a durable running checkpoint carrying the backend's session progress DTO. */
  running: (progress: SessionProgress, options?: {
    readonly id?: string;
    readonly attemptId?: string;
    readonly activeAttemptId?: string | null;
    readonly generation?: AiJob["generation"];
  }) => Promise<AiJob>;
  /** Move a job to a terminal generation state without a result blob. */
  terminal: (generation: AiJob["generation"], id?: string) => Promise<AiJob>;
  holdArtifact: (sha256: string) => { started: Promise<void>; idle: Promise<void>; release: () => void };
  holdNextArtifact: () => { started: Promise<void>; idle: Promise<void>; release: () => void };
  holdNextAdmission: () => { started: Promise<void>; idle: Promise<void>; release: () => void };
  holdArtifactReads: (count: number) => { started: Promise<void>; idle: Promise<void>; release: () => void };
  failArtifact: (sha256: string) => void;
  failHeldArtifact: (message?: string) => void;
} {
  const admits: JobAdmission[] = [];
  const keys: string[] = [];
  let waiting = deferred<JobAdmission>();
  let failMessage: string | null = null;
  let seq = 0;
  const jobs = new Map<string, AiJob>();
  const blobs = new Map<string, { bytes: Uint8Array; mediaType: string }>();
  const snapshotByJob = new Map<string, BlobRef>();
  const artifactHolds = new Map<string, { start: () => void; wait: Promise<void>; finish: () => void }>();
  let nextArtifactHold: { start: () => void; wait: Promise<void>; finish: () => void } | null = null;
  let nextAdmissionHold: { start: () => void; wait: Promise<void>; finish: () => void } | null = null;
  let artifactReadBarrier: { start: () => void; wait: Promise<void>; finish: () => void } | null = null;
  const failedArtifacts = new Set<string>();
  let failHeldMessage: string | null = null;
  function makeHold() {
    const started = deferred<void>();
    const wait = deferred<void>();
    const idle = deferred<void>();
    const gate = { start: () => started.resolve(), wait: wait.promise, finish: () => idle.resolve() };
    return { gate, started: started.promise, idle: idle.promise, release: () => wait.resolve() };
  }
  async function storeBytes(bytes: Uint8Array, mediaType: string): Promise<BlobRef> {
    const sha256 = await sha256HexBytes(bytes);
    blobs.set(sha256, { bytes, mediaType });
    return { sha256, byteLength: bytes.byteLength, mediaType };
  }
  async function storeJson(value: unknown): Promise<BlobRef> {
    return storeBytes(new TextEncoder().encode(JSON.stringify(value)), "application/json");
  }
  const transport: typeof fetch = async (url, init) => {
    const href = String(url);
    const path = href.replace(/^.*\/api\/ai-jobs/, "") || "";
    if (init?.method === "POST" && (path === "" || path === "/")) {
      const admitHold = nextAdmissionHold;
      if (admitHold) {
        nextAdmissionHold = null;
        admitHold.start();
        await admitHold.wait;
      }
      try {
      const body = JSON.parse(String(init.body)) as JobAdmission;
      let header = "";
      if (init.headers instanceof Headers) header = init.headers.get("Idempotency-Key") ?? "";
      else if (init.headers && typeof init.headers === "object" && "Idempotency-Key" in init.headers) {
        const value = (init.headers as Record<string, string | undefined>)["Idempotency-Key"];
        header = value ?? "";
      }
      admits.push(body);
      keys.push(header);
      if (failMessage) {
        const message = failMessage;
        failMessage = null;
        waiting.reject(new Error(message));
        waiting = deferred<JobAdmission>();
        return new Response(message, { status: 500 });
      }
      const snapshotRef = await storeJson(body.projectSnapshot);
      const inputRef = await storeJson({ ...body.input, projectSnapshot: snapshotRef, artwork: body.artwork });
      const job: AiJob = {
        ...fakeJob(body.input.family, `job-${body.input.family}-${seq}`),
        project: body.input.project,
        inputRef,
        idempotencyKey: header || `job-${body.input.family}-${seq}`,
      };
      seq += 1;
      snapshotByJob.set(job.id, snapshotRef);
      jobs.set(job.id, job);
      waiting.resolve(body);
      waiting = deferred<JobAdmission>();
      return Response.json({ job, created: true });
      } finally {
        admitHold?.finish();
      }
    }
    if (path === "/session" || href.endsWith("/session")) {
      return Response.json({ csrfToken: "fixture", generationAvailable: true, configuredBackend: "local" });
    }
    if (path === "/inbox") return Response.json({ inbox: [] });
    if (path === "" && (!init?.method || init.method === "GET")) {
      return Response.json({ jobs: [...jobs.values()] });
    }
    const application = /^\/([^/]+)\/application\/([a-z-]+)$/.exec(path);
    if (application && init?.method === "POST") {
      return Response.json({});
    }
    const cancel = /^\/([^/]+)\/(cancel|retry)$/.exec(path);
    if (cancel && init?.method === "POST") {
      const job = jobs.get(cancel[1] ?? "");
      if (job && cancel[2] === "cancel") {
        jobs.set(job.id, { ...job, generation: "cancelled", updatedAt: job.updatedAt + 1 });
      }
      return Response.json({ job: jobs.get(cancel[1] ?? "") ?? job });
    }
    const artifact = /^\/([^/]+)\/artifacts\/([a-f0-9]{64})$/.exec(path);
    if (artifact) {
      const sha = artifact[2] ?? "";
      const hold = artifactHolds.get(sha) ?? nextArtifactHold ?? artifactReadBarrier;
      if (hold === nextArtifactHold) nextArtifactHold = null;
      if (hold) {
        hold.start();
        await hold.wait;
      }
      try {
        if (failHeldMessage) {
          const message = failHeldMessage;
          failHeldMessage = null;
          return new Response(message, { status: 500 });
        }
        if (failedArtifacts.has(sha)) return new Response("failed artifact", { status: 500 });
        const stored = blobs.get(sha);
        if (!stored) return new Response("missing artifact", { status: 404 });
        const copy = new ArrayBuffer(stored.bytes.byteLength);
        new Uint8Array(copy).set(stored.bytes);
        return new Response(copy);
      } finally {
        hold?.finish();
      }
    }
    const detail = /^\/([^/]+)$/.exec(path);
    if (detail) {
      const job = jobs.get(detail[1] ?? "") ?? [...jobs.values()].at(-1);
      const manifest = [...blobs.entries()].map(([sha256, stored]) => ({
        sha256,
        byteLength: stored.bytes.byteLength,
        mediaType: stored.mediaType,
      }));
      return Response.json({ job, manifest });
    }
    throw new Error(`unexpected job transport ${href}`);
  };
  const client = new JobClient({ transport, reconcile: options.reconcile === true });
  vi.spyOn(jobClient, "getJobClient").mockReturnValue(client);
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const href = String(input);
    if (/generativelanguage|openai\.com|api\.anthropic|chat\/completions/.test(href)) {
      throw new Error("browser-owned paid path");
    }
    if (href.includes("/api/ai-jobs")) throw new Error(`unexpected global job fetch ${href}`);
    return new Response(PNG_1x1, { status: 200, headers: { "content-type": "image/png" } });
  });
  return {
    client,
    admits,
    keys,
    jobs,
    admitted: waiting.promise,
    nextAdmitted() {
      return waiting.promise;
    },
    failNext(message = "uncertain-ack") {
      failMessage = message;
    },
    lastJob() {
      const job = [...jobs.values()].at(-1);
      if (!job) throw new Error("no admitted job");
      return job;
    },
    putJson: storeJson,
    putBytes: storeBytes,
    holdArtifact(sha256) {
      const made = makeHold();
      artifactHolds.set(sha256, made.gate);
      return { started: made.started, idle: made.idle, release: made.release };
    },
    holdNextArtifact() {
      const made = makeHold();
      nextArtifactHold = made.gate;
      return { started: made.started, idle: made.idle, release: made.release };
    },
    holdNextAdmission() {
      const made = makeHold();
      nextAdmissionHold = made.gate;
      return { started: made.started, idle: made.idle, release: made.release };
    },
    holdArtifactReads(count) {
      const started = deferred<void>();
      const wait = deferred<void>();
      const idle = deferred<void>();
      let starts = 0;
      let finishes = 0;
      artifactReadBarrier = {
        start: () => {
          starts += 1;
          if (starts >= count) started.resolve();
        },
        wait: wait.promise,
        finish: () => {
          finishes += 1;
          if (finishes >= count) {
            artifactReadBarrier = null;
            idle.resolve();
          }
        },
      };
      return { started: started.promise, idle: idle.promise, release: () => wait.resolve() };
    },
    failArtifact(sha256) {
      failedArtifacts.add(sha256);
    },
    failHeldArtifact(message = "failed artifact") {
      failHeldMessage = message;
    },
    async running(progress, options = {}) {
      const current = options.id ? jobs.get(options.id) : [...jobs.values()].at(-1);
      if (!current) throw new Error("no admitted job");
      const attemptId = options.attemptId ?? `${current.id}-a`;
      // Real family nesting (LIVE-PROGRESS-HANDOFF.md): assistant `state`,
      // region `state.session.state`, tileset cluster `state.session`.
      const session = { progress: progress as unknown as JsonValue };
      const state: JsonObject = current.family === "region"
        ? { session: { state: session } }
        : current.family === "tileset"
          ? { session }
          : session;
      const checkpoint: AiJobCheckpoint = {
        version: 1,
        jobId: current.id,
        attemptId,
        inputSha256: current.inputRef.sha256,
        stageKey: "assistant/turn",
        state,
        artifacts: [],
      };
      const checkpointRef = await storeJson(checkpoint);
      const next: AiJob = {
        ...current,
        generation: options.generation ?? "running",
        activeAttemptId: options.activeAttemptId === undefined ? attemptId : options.activeAttemptId,
        checkpointRef,
        updatedAt: current.updatedAt + 1,
      };
      jobs.set(current.id, next);
      await client.refresh();
      return next;
    },
    async terminal(generation, id) {
      const current = id ? jobs.get(id) : [...jobs.values()].at(-1);
      if (!current) throw new Error("no admitted job");
      const next: AiJob = { ...current, generation, report: "ready", updatedAt: current.updatedAt + 1 };
      jobs.set(current.id, next);
      await client.refresh();
      return next;
    },
    async complete(payload, id, generated) {
      const current = id ? jobs.get(id) : [...jobs.values()].at(-1);
      if (!current) throw new Error("no admitted job");
      const baseSnapshot = snapshotByJob.get(current.id) ?? current.inputRef;
      const generatedSnapshot = generated === undefined ? null : await storeJson(generated);
      const result = jobResult(current.family, current.id, payload, {
        project: current.project,
        baseSnapshot,
        generatedSnapshot,
      });
      const resultRef = await storeJson(result);
      const next: AiJob = {
        ...current,
        generation: "succeeded",
        report: "ready",
        application: generatedSnapshot ? "awaiting-editor" : "awaiting-review",
        resultRef,
        updatedAt: current.updatedAt + 1,
      };
      jobs.set(current.id, next);
      await client.refresh();
      return next;
    },
  };
}
