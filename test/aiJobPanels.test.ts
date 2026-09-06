// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { renderTopbar } from "@/editor/panels/menu";
import { JobClient, disposeJobClient, getJobClient } from "@/editor/aiJobs/jobClient";
import { mountJobLauncher, filteredJobs } from "@/editor/aiJobs/jobInbox";
import { closeJobQueue, openJobQueue } from "@/editor/aiJobs/jobQueuePanel";
import { closeJobReport, openJobReport } from "@/editor/aiJobs/jobReportPanel";
import type { AiJob, AiJobEvent } from "@/ai/jobs/contracts";
import { sha256HexBytes, sha256HexText } from "@/util/sha256";
import type { JobReport, ReportSection } from "@/ai/jobs/reportModel";
import { modalStackDepthForTest } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { httpFixture } from "./aiJobsTestSupport.mjs";
import { IDBFactory } from "fake-indexeddb";
import { locks } from "node:worker_threads";
import { createJobReview } from "@/editor/aiJobs/jobReviewControls";
import { registerDraftOwner, captureDraftBinding } from "@/editor/aiJobs/draftOwners";
import { createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { tilesetKnowledgeFingerprint } from "@/editor/tilesetAiNativeAnalysis";
import { parseProject, jsonValue, jsonObject } from "@/ai/jobs/checkpointState";
import type { AiJobInput, AiJobsDraft } from "@/ai/jobs/contracts";
import { request as httpRequest } from "node:http";
import type { Command } from "@/project/types";
import { shouldIgnoreEditorShortcut, historyHotkeyOwnedByPanel } from "@/editor/hotkeys";

const cleanups: (() => unknown)[] = [];
afterEach(async () => { closeJobReport(); closeJobQueue(); disposeJobClient(); for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function signal(client: JobClient, predicate: () => boolean): Promise<void> {
  const done = deferred<void>(); const off = client.subscribe(() => { if (predicate()) done.resolve(); });
  const deadline = setTimeout(() => done.reject(new Error("Expected exact client state not observed")), 5000);
  return done.promise.finally(() => { clearTimeout(deadline); off(); });
}
class Source extends EventTarget {
  closed = false;
  close() { this.closed = true; }
  send(event: AiJobEvent) { this.dispatchEvent(new MessageEvent(event.kind, { data: JSON.stringify(event), lastEventId: String(event.seq) })); }
}
const ref = { sha256: "0".repeat(64), byteLength: 2, mediaType: "application/json" };
function job(id = "job-one"): AiJob { return { id, idempotencyKey: id, family: "assistant", project: { backend: "local", projectId: "other-project" }, inputRef: ref, createdAt: 1, updatedAt: 1, generation: "queued", report: "pending", application: "not-requested", save: "not-requested", activeAttemptId: null, resultRef: null, reportRef: null, applicationEvidence: null, saveEvidence: null }; }
function event(seq: number, kind: AiJobEvent["kind"] = "outcome"): AiJobEvent { return { seq, kind, jobId: "job-one", createdAt: seq, states: { generation: "succeeded", report: "ready", application: "awaiting-review", save: "unsaved" } }; }
function fixture(reconcile = false) {
  const sources: Source[] = [], paths: string[] = [], writes: { path: string; body: unknown }[] = [];
  let current = job(), inbox: { eventSeq: number; jobId: string; createdAt: number; readAt: number | null }[] = [];
  const blobs = new Map<string, Uint8Array>();
  const handlers = new Map<string, () => Promise<Response>>();
  const transport: typeof fetch = async (url, init) => {
    const path = String(url).replace("/api/ai-jobs", ""); paths.push(path);
    if (handlers.has(path)) return handlers.get(path)!();
    if (init?.method === "POST") {
      writes.push({ path, body: JSON.parse(String(init.body)) });
      if (path.includes("/read")) { inbox = inbox.map(item => ({ ...item, readAt: 10 })); return Response.json({ inbox }); }
      return Response.json({ job: current });
    }
    if (path === "/session") return Response.json({ csrfToken: "fixture", generationAvailable: true, configuredBackend: "local" });
    if (path === "") return Response.json({ jobs: [current] });
    if (path === "/inbox") return Response.json({ inbox });
    if (path.includes("/artifacts/")) return new Response(new Uint8Array(blobs.get(path.split("/").at(-1)!) ?? []));
    return Response.json({ job: current, manifest: [...blobs].map(([sha256, bytes]) => ({ sha256, byteLength: bytes.length, mediaType: sha256 === imageHash ? "image/png" : "application/json" })) });
  };
  let imageHash = "";
  const streamReady = deferred<void>();
  const client = new JobClient({ transport, events: url => { paths.push(url); const source = new Source(); sources.push(source); streamReady.resolve(); return source as unknown as EventSource; }, reconcile });
  cleanups.push(() => client.dispose());
  async function put(value: unknown) { const bytes = new TextEncoder().encode(JSON.stringify(value)); const sha256 = await sha256HexBytes(bytes); blobs.set(sha256, bytes); return { sha256, byteLength: bytes.length, mediaType: "application/json" }; }
  return { client, streamReady: streamReady.promise, sources, paths, writes, handlers, blobs, put, setJob(value: AiJob) { current = value; }, setInbox(value: typeof inbox) { inbox = value; }, async image() { const bytes = new Uint8Array([137, 80, 78, 71]); imageHash = await sha256HexBytes(bytes); blobs.set(imageHash, bytes); return { sha256: imageHash, byteLength: bytes.length, mediaType: "image/png" }; } };
}
it("mounts one persistent job launcher across topbar rebuilds", () => {
  vi.stubGlobal("fetch", async () => Response.json({ jobs: [], inbox: [], csrfToken: "fixture", generationAvailable: false }));
  vi.stubGlobal("EventSource", Source);
  const topbar = document.createElement("div"); document.body.append(topbar);
  renderTopbar(topbar);
  expect(topbar.querySelectorAll('[data-testid="ai-jobs-open"]')).toHaveLength(1);
  const singleton = getJobClient(); topbar.querySelector<HTMLButtonElement>('[data-testid="ai-jobs-open"]')!.focus(); renderTopbar(topbar);
  expect(document.activeElement).toBe(topbar.querySelector('[data-testid="ai-jobs-open"]'));
  expect(getJobClient()).toBe(singleton);
  expect(topbar.querySelectorAll('[data-testid="ai-jobs-open"]')).toHaveLength(1);
  expect(topbar.querySelector('[data-testid="ai-jobs-running"]')).not.toBeNull();
  expect(topbar.querySelector('[data-testid="ai-jobs-unread"]')).not.toBeNull();
});
it("handles named replay, deduplicates durable outcomes, and never lets initial fetch overwrite live detail", async () => {
  const f = fixture(), old = deferred<Response>(), live = { ...job(), generation: "succeeded" as const, updatedAt: 3 };
  const listRequested = deferred<void>();
  f.handlers.set("", () => { listRequested.resolve(); return old.promise; });
  const connected = f.client.connect();
  await listRequested.promise;
  f.setJob(live);
  const completed = signal(f.client, () => f.client.jobs.get(live.id)?.generation === "succeeded");
  f.sources[0].send(event(1)); f.sources[0].send(event(1)); await completed;
  old.resolve(Response.json({ jobs: [job()] })); await connected;
  expect(f.client.jobs.get(live.id)?.generation).toBe("succeeded"); expect(f.client.unread).toBe(1);
  expect(f.paths.filter(path => path === "/job-one")).toHaveLength(1);
  const mounts = [mountJobLauncher(f.client), mountJobLauncher(f.client)]; mounts.forEach(item => item.dispose());
  expect(f.sources).toHaveLength(1); expect(f.sources[0].closed).toBe(false);
  const offline = signal(f.client, () => f.client.connection === "offline"); f.sources[0].dispatchEvent(new Event("error")); await offline;
  expect(f.client.jobs.get(live.id)).toEqual(live);
  f.handlers.delete(""); f.handlers.delete("/session"); await f.client.connect();
  f.sources[1].send(event(1)); expect(f.client.unread).toBe(1);
  expect(f.paths.filter(path => path.includes("events")).every(path => !path.includes("after="))).toBe(true);
  expect(f.sources[0].closed).toBe(true);
});
it("server read acknowledgement is deduplicated across concurrent opens and stale inbox fetches", async () => {
  const f = fixture(); f.setInbox([{ eventSeq: 1, jobId: "job-one", createdAt: 1, readAt: null }]); await f.client.connect();
  await Promise.all([f.client.markRead("job-one"), f.client.markRead("job-one")]);
  expect(f.writes.filter(write => write.path.endsWith("/read"))).toHaveLength(1); expect(f.client.unread).toBe(0);
  f.setInbox([{ eventSeq: 1, jobId: "job-one", createdAt: 1, readAt: null }]); await f.client.refresh();
  expect(f.client.unread).toBe(0); await f.client.markRead("job-one"); expect(f.writes).toHaveLength(1);
});
it("retains queue input, row identity, selection and scroll on background events; close never cancels", async () => {
  const f = fixture(); await f.client.connect(); const opener = document.createElement("button"); document.body.append(opener);
  const panel = openJobQueue(opener, f.client)!;
  const search = panel.querySelector<HTMLInputElement>("input")!; search.value = "job"; search.dispatchEvent(new Event("input")); search.focus(); search.setSelectionRange(1, 2);
  const list = panel.querySelector<HTMLElement>('[data-testid="ai-jobs-list"]')!; list.scrollTop = 90;
  const row = list.firstElementChild;
  f.setJob({ ...job(), generation: "running", updatedAt: 2 }); const changed = signal(f.client, () => f.client.jobs.get("job-one")?.generation === "running"); f.sources[0].send(event(2, "updated")); await changed;
  expect(list.firstElementChild).toBe(row); expect(document.activeElement).toBe(search); expect(search.selectionStart).toBe(1); expect(list.scrollTop).toBe(90);
  expect(filteredJobs(f.client, "running", "job")).toHaveLength(1); expect(filteredJobs(f.client, "failed", "")).toHaveLength(0);
  closeJobQueue(); expect(f.writes).toHaveLength(0); expect(f.sources[0].closed).toBe(false); expect(document.activeElement).toBe(opener);
});
it("requires explicit retry consent and nested Escape only closes that confirmation", async () => {
  const f = fixture(); f.setJob({ ...job(), generation: "interrupted" }); await f.client.connect();
  const opener = document.createElement("button"); document.body.append(opener); const panel = openJobQueue(opener, f.client)!;
  panel.querySelector<HTMLButtonElement>('[data-testid="ai-job-retry"]')!.click();
  const retryButton = panel.querySelector<HTMLButtonElement>('[data-testid="ai-job-retry"]')!;
  const enabled = deferred<void>();
  const observer = new MutationObserver(() => { if (!retryButton.disabled) enabled.resolve(); });
  observer.observe(retryButton, { attributes: true, attributeFilter: ["disabled"] });
  const deadline = setTimeout(() => enabled.reject(new Error("Retry did not settle after cancelled consent")), 5000);
  expect(modalStackDepthForTest()).toBe(1); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  try { await enabled.promise; } finally { observer.disconnect(); clearTimeout(deadline); }
  expect(modalStackDepthForTest()).toBe(0); expect(panel.isConnected).toBe(true); expect(f.writes).toHaveLength(0);
  panel.querySelector<HTMLButtonElement>('[data-testid="ai-job-retry"]')!.click();
  const done = signal(f.client, () => f.writes.length === 1);
  document.querySelector<HTMLButtonElement>('[data-testid="app-modal-confirm"]')!.click(); await done;
  expect(f.writes[0]).toEqual({ path: "/job-one/retry", body: { stage: "generation", acknowledgeDuplicateSpend: true } });
});
it("opens immutable media without application/provider writes, retains revision on update and revokes owned URLs", async () => {
  const f = fixture(), image = await f.image();
  const inputRef = await f.put({ version: 1, family: "assistant", project: job().project, projectSnapshot: ref, artwork: [], mode: "review", target: {}, payload: { request: "captured" }, dependsOn: [] });
  const report: JobReport = { version: 1, kind: "ai-job-report", jobId: "job-one", family: "assistant", project: job().project, generationAttemptId: null, source: "input", checkpoint: null, reportAttemptId: "report-1", input: inputRef, result: null, baseSnapshot: ref, generatedSnapshot: null, previous: null, evidenceKey: "fixed", states: { generation: "cancelled", application: "not-requested", save: "not-requested" }, applied: { status: "not-applied", scope: null, noChanges: false, receiptId: null, hashScheme: null, artifact: null, reason: null }, applicationEvidence: null, saveEvidence: null, output: { assistantText: "captured answer" }, usage: null, sections: [{ id: "art", kind: "artwork", objectId: "resource", title: "Captured image", phase: "staged", snapshot: ref, data: {}, previews: [{ id: "image", role: "artwork", status: "ready", source: image, artifact: image, width: 16, height: 16, error: null }] }], artifacts: [image], failure: null };
  const reportRef = await f.put(report); f.setJob({ ...job(), generation: "cancelled", report: "ready", inputRef, reportRef }); await f.client.connect();
  const revoked: string[] = []; vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:owned"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(url => { revoked.push(url); });
  const opener = document.createElement("button"); document.body.append(opener); const panel = await openJobReport("job-one", opener, f.client);
  expect(panel.querySelector("img")?.getAttribute("src")).toBe("blob:owned"); expect(f.writes).toHaveLength(0);
  expect(panel.querySelector<HTMLButtonElement>('[data-testid="ai-job-apply"]')!.hidden).toBe(true);
  const oldBody = panel.querySelector('[data-testid="ai-job-report-body"]')!.firstChild;
  f.setJob({ ...job(), generation: "cancelled", report: "running", inputRef, reportRef: { ...reportRef, sha256: await sha256HexText("new revision") }, updatedAt: 3 });
  await f.client.refresh(); expect(panel.querySelector('[data-testid="ai-job-report-body"]')!.firstChild).toBe(oldBody);
  closeJobReport(); expect(revoked).toEqual(["blob:owned"]); expect(document.activeElement).toBe(opener); expect(modalStackDepthForTest()).toBe(0);
});

it("keeps authoritative already-read inbox records read when historical outcomes replay later", async () => {
  const f = fixture(); f.setInbox([{ eventSeq: 1, jobId: "job-one", createdAt: 1, readAt: 8 }]);
  await f.client.connect(); expect(f.client.unread).toBe(0);
  f.sources[0].send(event(1)); expect(f.client.unread).toBe(0);
  expect(f.client.inbox.get(1)?.readAt).toBe(8);
});
it.each(["detail", "list"])("rejects older list completion after newer %s with no SSE and identical timestamps", async kind => {
  const f = fixture(); await f.client.connect();
  const old = deferred<Response>(); f.handlers.set("", () => old.promise); const pending = f.client.refresh();
  f.setJob({ ...job(), generation: "succeeded" }); f.handlers.delete("");
  if (kind === "detail") await f.client.refreshJob("job-one"); else await f.client.refresh();
  expect(f.client.jobs.get("job-one")?.generation).toBe("succeeded");
  old.resolve(Response.json({ jobs: [job()] })); await pending;
  expect(f.client.jobs.get("job-one")?.generation).toBe("succeeded");
});
it("notifies eligibility on actual loaded identity/epoch replacement but not ordinary paint", async () => {
  await store.loadFallbackProject(createBlankProject());
  const f = fixture(true); const ready = signal(f.client, () => f.client.jobs.has("job-one")); f.client.start(); await ready;
  let updates = 0; const off = f.client.subscribe(() => updates++);
  store.updateMap(store.getCurrent().startMapId, map => { map.name = "ordinary edit"; }); expect(updates).toBe(0);
  store.replaceProject(createBlankProject()); expect(updates).toBe(1); off();
});
it.each(["explicit", "native"])("retries transient auto input reads on %s reconnect without generation replay", async recovery => {
  await store.loadFallbackProject(createBlankProject()); const f = fixture(true);
  const inputRef = await f.put({ version: 1, family: "database", mode: "auto", project: store.getLoadedProjectIdentity(), projectSnapshot: ref, artwork: [], target: {}, payload: {}, dependsOn: [] });
  const resultRef = await f.put({ version: 1, family: "database", jobId: "job-one", attemptId: "a", project: store.getLoadedProjectIdentity(), baseSnapshot: ref, generatedSnapshot: ref, artifacts: [], payload: {} });
  f.setJob({ ...job(), family: "database", project: store.getLoadedProjectIdentity(), inputRef, resultRef, generation: "succeeded" });
  const path = `/job-one/artifacts/${inputRef.sha256}`;
  f.handlers.set(path, async () => { throw new Error("controlled transient input transport failure"); });
  const failed = signal(f.client, () => f.client.connection === "offline"); f.client.start(); await failed;
  const before = f.paths.filter(item => item === path).length; f.handlers.delete(path);
  if (recovery === "explicit") await f.client.connect();
  else { const refreshed = signal(f.client, () => f.paths.filter(item => item === path).length > before); f.sources[0].dispatchEvent(new Event("open")); await refreshed; }
  expect(f.paths.filter(item => item === path).length).toBeGreaterThan(before);
  expect(f.writes).toHaveLength(0);
});

async function reportFixture(sections: ReportSection[] = []) {
  const f = fixture();
  const inputRef = await f.put({ version: 1, family: "database", mode: "review", payload: {} });
  const resultRef = await f.put({ version: 1, family: "database", jobId: "job-one", generatedSnapshot: null, payload: {} });
  const report: JobReport = { version: 1, kind: "ai-job-report", jobId: "job-one", family: "database", project: store.getLoadedProjectIdentity(), generationAttemptId: null, source: "input", checkpoint: null, reportAttemptId: "r", input: inputRef, result: null, baseSnapshot: ref, generatedSnapshot: null, previous: null, evidenceKey: "fixed", states: { generation: "failed", application: "not-requested", save: "not-requested" }, applied: { status: "not-applied", scope: null, noChanges: false, receiptId: null, hashScheme: null, artifact: null, reason: null }, applicationEvidence: null, saveEvidence: null, output: {}, usage: null, sections, artifacts: [], failure: null };
  const reportRef = await f.put(report);
  f.setJob({ ...job(), family: "database", project: store.getLoadedProjectIdentity(), inputRef, resultRef, reportRef, generation: "succeeded", report: "ready" }); await f.client.connect();
  return { ...f, report, resultRef, reportRef };
}
it("does not pair an old failed report with a successful retry's review/apply controls", async () => {
  await store.loadFallbackProject(createBlankProject()); const f = await reportFixture();
  const opener = document.createElement("button"); document.body.append(opener);
  const panel = await openJobReport("job-one", opener, f.client);
  expect(panel.querySelector<HTMLButtonElement>('[data-testid="ai-job-apply"]')!.disabled).toBe(true);
  expect(panel.querySelector('[data-testid="ai-job-review"]')).toBeNull();
  const keyboard = new KeyboardEvent("keydown", { key: "F5", bubbles: true });
  const button = panel.querySelector("button")!; button.dispatchEvent(keyboard);
  expect(shouldIgnoreEditorShortcut(keyboard)).toBe(true);
  expect(historyHotkeyOwnedByPanel()).toBe(true);
});
it("reconciles local unsaved outcome only with the matching durable receipt including cross-client save", async () => {
  const f = fixture(); await f.client.connect();
  f.client.outcomes.set("job-one", { application: "applied", save: "unsaved", receiptId: "ours", evidencePending: true });
  const saved = { ...job(), application: "applied" as const, save: "saved" as const, resultRef: ref, applicationEvidence: { receipt: { receiptId: "other", resultSha256: ref.sha256, application: "applied" } } };
  f.setJob(saved); await f.client.refresh(); expect(f.client.outcomes.get("job-one")?.save).toBe("unsaved");
  f.setJob({ ...saved, applicationEvidence: { receipt: { receiptId: "ours", resultSha256: ref.sha256, application: "applied" } } }); await f.client.refresh();
  expect(f.client.outcomes.get("job-one")?.save ?? f.client.jobs.get("job-one")?.save).toBe("saved");
  expect(f.client.outcomes.get("job-one")?.evidencePending).not.toBe(true);
});
it("places newly admitted rows in newest-first DOM order without replacing focused existing rows", async () => {
  const f = fixture(); await f.client.connect(); const opener = document.createElement("button"); document.body.append(opener);
  const panel = openJobQueue(opener, f.client)!, list = panel.querySelector<HTMLElement>('[data-testid="ai-jobs-list"]')!;
  const old = list.firstElementChild!; const button = old.querySelector<HTMLButtonElement>("button")!; button.focus();
  f.setJob({ ...job("newest"), createdAt: 2 }); await f.client.refresh();
  expect([...list.children].map(item => (item as HTMLElement).dataset.jobId)).toEqual(["newest", "job-one"]);
  expect(old.isConnected).toBe(true); expect(document.activeElement).toBe(button);
});
it("mounts the selected object's complete inventory before a held image and defers offscreen media", async () => {
  const f = await reportFixture(); const image = await f.image();
  const section: ReportSection = { id: "atlas", kind: "tileset", objectId: "tileset", title: "Captured tileset", phase: "before", snapshot: ref, data: {}, previews: Array.from({ length: 300 }, (_, index) => ({ id: `crop-${index}`, role: "crop", status: "ready", artifact: image, source: image, width: 16, height: 16, error: null })) };
  const reportRef = await f.put({ ...f.report, sections: [section], artifacts: [image] });
  f.setJob({ ...f.client.jobs.get("job-one")!, reportRef }); await f.client.refresh();
  const requested = deferred<void>(), held = deferred<Response>();
  f.handlers.set(`/job-one/artifacts/${image.sha256}`, () => { requested.resolve(); return held.promise; });
  const opener = document.createElement("button"); document.body.append(opener);
  const opening = openJobReport("job-one", opener, f.client);
  await requested.promise;
  try {
    expect(document.querySelectorAll('[data-preview-id]')).toHaveLength(300);
    expect(document.querySelector('.ai-jobs-object')).not.toBeNull();
    expect(f.paths.filter(path => path === "/job-one")).toHaveLength(1);
  } finally { closeJobReport(); held.resolve(new Response(new Uint8Array(f.blobs.get(image.sha256)!))); await opening; }
});

async function seedRealReview(family: AiJobInput["family"], payload: object, target: object, proposal: object) {
  vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("navigator", { locks });
  // Node HTTP retains real service security/application seams without happy-dom's
  // synthetic about:blank CORS origin. No application or repository mock.
  const wireFetch: typeof fetch = async (url, init) => new Promise((resolve, reject) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const request = httpRequest(String(url), { method: init?.method, headers }, response => {
      const chunks: Buffer[] = []; response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("error", reject); response.on("end", () => {
        const result = new Response(new Uint8Array(Buffer.concat(chunks)), { status: response.statusCode });
        for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) result.headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        resolve(result);
      });
    });
    request.on("error", reject); request.end(init?.body === undefined ? undefined : String(init.body));
  });
  vi.stubGlobal("fetch", wireFetch);
  const f = await httpFixture({ after: (cleanup: () => unknown) => cleanups.push(cleanup) });
  const base = await f.repository.putJson(JSON.parse(JSON.stringify(store.getCurrent())));
  const input: AiJobInput = { version: 1, family, project: store.getLoadedProjectIdentity(), projectSnapshot: base, artwork: [], target: jsonObject(jsonValue(target)), mode: "review", payload: jsonObject(jsonValue(payload)), dependsOn: [] };
  const { job } = await f.repository.admit({ idempotencyKey: crypto.randomUUID(), input });
  const proposalRef = await f.repository.putJson(jsonValue(proposal));
  const resultRef = await f.repository.putJson(jsonValue({ version: 1, family, jobId: job.id, attemptId: "fixture-attempt", project: input.project, baseSnapshot: base, generatedSnapshot: null, artifacts: [proposalRef], payload: { proposalRef } }));
  await f.repository.transaction((draft: AiJobsDraft) => {
    draft.attempts.push({ id: "fixture-attempt", jobId: job.id, stage: "generation", status: "succeeded", startedAt: 1, finishedAt: 2, error: null });
    Object.assign(draft.jobs.find(item => item.id === job.id)!, { generation: "succeeded", application: "awaiting-review", resultRef });
  });
  const source = new Source();
  const transport: typeof fetch = (url, init) => fetch(url, { ...init, headers: { ...f.headers, ...init?.headers } });
  const client = new JobClient({ root: `${f.origin}/api/ai-jobs`, transport, events: () => source as unknown as EventSource, reconcile: false }); cleanups.push(() => client.dispose());
  await client.connect(); return { client, job: client.jobs.get(job.id)!, repository: f.repository };
}
it("passes local event exclusion choices through real HTTP/Task5 draft application and save-only retry", async () => {
  await store.loadFallbackProject(createBlankProject());
  let commands: Command[] = []; const owner = { kind: "common-event" as const, commonEventId: "ce-panel" };
  store.update(project => { project.commonEvents.push({ id: owner.commonEventId, name: "fixture", trigger: "none", commands }); });
  const history = createCommandToolbarHistory({ key: "task7-draft", readCommands: () => commands, replaceCommands: next => { commands = next; } });
  const live = { draftId: crypto.randomUUID(), owner, project: store.getLoadedProjectIdentity(), epoch: store.getProjectEpoch(), isOpen: () => true, readCommands: () => commands, replaceAll: history.replaceAll };
  cleanups.push(registerDraftOwner(live)); const binding = await captureDraftBinding(live);
  const target = { kind: "common-event", commonEventId: owner.commonEventId, mapId: store.getCurrent().startMapId };
  const payload = { prompt: "fixture", config: { authMode: "chatgpt", model: "fixture", maxTokens: 100, maxToolCalls: 2 }, baseCommands: commands, selection: null, preferenceMemorySection: "", draftBinding: binding };
  const finalCommands = [{ kind: "text", body: "excluded" }, { kind: "text", body: "retained" }];
  const f = await seedRealReview("event-commands", payload, target, { version: 1, project: live.project, target, baseCommands: [], finalCommands });
  const controls = await createJobReview(f.client, f.job); document.body.append(controls.element);
  controls.element.querySelector<HTMLButtonElement>("button")!.click(); expect(controls.review().excludedRowIds).toHaveLength(1);
  const reopened = await createJobReview(f.client, f.job); expect(reopened.review()).toEqual(controls.review());
  const outcome = await f.client.apply(f.job.id, controls.review()); expect(outcome.application, outcome.reason).toBe("applied");
  expect(commands).toEqual([{ kind: "text", body: "retained" }]); expect(history.canUndo()).toBe(true);
  const saved = await f.client.save(f.job.id); expect(saved.save).toBe("unsaved");
  expect(f.repository.snapshot().operations).toHaveLength(0);
  history.undo(); expect(commands).toEqual([]); expect(history.canUndo()).toBe(false);
}, 60000);
it("passes only selected immutable native tileset proposal IDs through real Task5 without a live analysis handler", async () => {
  await store.loadFallbackProject(createBlankProject());
  const tilesetId = Object.keys(store.getCurrent().tilesets)[0];
  store.update(project => { project.tilesets[tilesetId].tileGroups = []; delete project.tilesets[tilesetId].tileMeta; });
  store.replace(parseProject(JSON.parse(JSON.stringify(store.getCurrent()))));
  const tileset = store.getCurrent().tilesets[tilesetId];
  const proposals = [0, 1].map(index => ({ id: `proposal-${index}`, name: `Desk ${index}`, tileIds: index ? [8, 9] : [4, 5], confidence: 0.9, cellLayers: null, template: "desk", status: "pending", feedback: "", description: "fixture", evidence: "captured pixels", question: "", quickReplies: [], placementRules: "fixture", passage: { up: true, down: true, left: true, right: true } }));
  const review = { tilesetId, fingerprint: tilesetKnowledgeFingerprint(tileset), status: "ready", summary: "fixture", warnings: [], proposals };
  const payload = { operation: "knowledge-analysis", tilesetId, config: { authMode: "chatgpt", model: "fixture", maxToolCalls: 2, maxTokens: 100 }, context: { budgetChars: 100, preferenceMemorySection: "" }, atlas: { sha256: "f".repeat(64), byteLength: 1, mediaType: "image/png" }, feedback: [] };
  const f = await seedRealReview("tileset", payload, {}, { kind: "knowledge-analysis", tilesetId, review, turns: [] });
  const controls = await createJobReview(f.client, f.job); document.body.append(controls.element);
  const selected = controls.element.querySelectorAll<HTMLInputElement>("input")[1]; selected.checked = true; selected.dispatchEvent(new Event("change"));
  expect(controls.review().proposalIds).toEqual(["proposal-1"]);
  const outcome = await f.client.apply(f.job.id, controls.review()); expect(outcome.application, outcome.reason).toBe("applied");
  expect(store.getCurrent().tilesets[tilesetId].tileGroups?.some(group => group.name === "Desk 1")).toBe(true);
  expect(store.getCurrent().tilesets[tilesetId].tileGroups?.some(group => group.name === "Desk 0")).toBe(false);
  expect(f.repository.snapshot().operations).toHaveLength(0);
}, 60000);

it("rebinds an open queue to the replacement launcher without a close-and-reopen click", async () => {
  const f = fixture(); await f.client.connect();
  const first = mountJobLauncher(f.client); document.body.append(first.element); first.element.click();
  first.dispose(); first.element.remove();
  const second = mountJobLauncher(f.client); document.body.append(second.element); cleanups.push(second.dispose);
  expect(second.element.getAttribute("aria-expanded")).toBe("true");
  second.element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); second.element.click();
  expect(document.querySelector('[data-testid="ai-jobs-queue"]')).toBeNull();
});
it("reads the authoritative inbox before acknowledging a report opened before the initial snapshot", async () => {
  const f = fixture(); f.setInbox([{ eventSeq: 7, jobId: "job-one", createdAt: 7, readAt: null }]);
  expect(f.client.inbox.size).toBe(0); await f.client.markRead("job-one");
  expect(f.writes.map(item => item.path)).toEqual(["/inbox/7/read"]); expect(f.client.unread).toBe(0);
});

it("reacts to browser offline/online signals even when a quiet SSE socket has not errored", async () => {
  const f = fixture(); const ready = signal(f.client, () => f.client.jobs.has("job-one")); f.client.start(); await ready;
  f.sources[0].dispatchEvent(new Event("open"));
  const offline = signal(f.client, () => f.client.connection === "offline"); window.dispatchEvent(new Event("offline")); await offline;
  expect(f.client.jobs.has("job-one")).toBe(true);
  const connecting = signal(f.client, () => f.client.connection === "connecting"); window.dispatchEvent(new Event("online")); await connecting;
  expect(f.sources[0].closed).toBe(true);
});

it("keeps native SSE recovery available when the online session handshake fails once", async () => {
  const f = fixture(); f.handlers.set("/session", async () => { throw new Error("online transport not ready"); });
  await f.client.connect(); expect(f.client.connection).toBe("offline");
  expect(f.sources).toHaveLength(1);
  f.handlers.delete("/session"); const recovered = signal(f.client, () => f.client.connection === "connected");
  f.sources[0].dispatchEvent(new Event("open")); await recovered;
  expect(f.sources).toHaveLength(1);
});
