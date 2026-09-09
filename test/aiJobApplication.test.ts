import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store, setDevProjectFactory } from "@/project/store";

afterEach(() => { setDevProjectFactory(null); vi.unstubAllGlobals(); });

it("retains the local project UUID across an actual cache reload, not identical replacements", async () => {
  const data = new Map<string, string>();
  const localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { location: { search: "?devProject=1", hostname: "localhost", pathname: "/" }, localStorage });
  setDevProjectFactory(createBlankProject);
  await store.load();
  const identity = store.getProjectIdentity();
  store.update(p => { p.meta.title = "renamed"; });
  await store.flush();
  await store.load();
  expect(store.getCurrent().meta.title).toBe("renamed");
  expect(store.getProjectIdentity()).toEqual(identity);
  store.replaceProject(structuredClone(store.getCurrent()));
  expect(store.getProjectIdentity()).not.toEqual(identity);
});


import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { httpFixture, waitFor, resultFor } from "./aiJobsTestSupport.mjs";
import { ApplicationClient } from "@/editor/aiJobs/applicationClient";
import { applyJobResult, getVolatileApplicationRecovery, retryJobSave } from "@/editor/aiJobs/applyJobResult";
import { openApplicationRecords } from "@/editor/aiJobs/applicationRecords";
import { mergeResultProject, canonicalJson, appliedSnapshotHash } from "@/ai/jobs/resultPatch";
import { getMapEditHistoryEntries, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { _resetEventDraftVaultForTest } from "@/project/eventDraftVault";
import { registerDraftOwner, captureDraftBinding } from "@/editor/aiJobs/draftOwners";
import { createCommandToolbarHistory } from "@/editor/panels/eventEditor/commandToolbarHistory";
import { sha256HexText } from "@/util/sha256";
import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import type { AiJobInput, AiJobResult } from "@/ai/jobs/contracts";
import type { Project, Command } from "@/project/types";

const cleanups: Array<() => unknown> = [];
let storage: IDBFactory;
beforeEach(async () => {
  storage = new IDBFactory();
  _resetEventDraftVaultForTest();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.loadFallbackProject(createBlankProject());
  resetMapEditHistory();
});
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });

async function applicationFixture(overrides: { family?: AiJobInput["family"]; mode?: string; payload?: object; target?: object; generated?: (base: Project) => Project; result?: (input: AiJobInput, host: any) => Promise<AiJobResult> } = {}) {
  const base = structuredClone(store.getCurrent());
  const f = await httpFixture({ after: (cb: () => unknown) => cleanups.push(cb) }, {
    executeJob: async (input: AiJobInput, host: any) => overrides.result ? overrides.result(input, host) : ({ ...resultFor(input, host),
      generatedSnapshot: await host.putJson(JSON.parse(JSON.stringify(overrides.generated ? overrides.generated(structuredClone(base)) : { ...base, meta: { ...base.meta, title: "generated" } }))) }),
  });
  f.scheduler.start();
  const done = waitFor(f.scheduler, (event: any) => ["succeeded", "failed"].includes(event.states.generation));
  const response = await f.post("", { input: { version: 1, family: overrides.family ?? "database", project: store.getLoadedProjectIdentity(),
    target: overrides.target ?? {}, mode: overrides.mode ?? "auto", payload: overrides.payload ?? {}, dependsOn: [] }, projectSnapshot: base, artwork: [] }, { "Idempotency-Key": crypto.randomUUID() });
  expect(response.status).toBe(202);
  const { job } = await response.json();
  await done;
  const generated = await (await f.request(`/${job.id}`)).json();
  expect(generated.job.generation, JSON.stringify(generated.attempts)).toBe("succeeded");
  const transport: typeof fetch = (url, init) => fetch(url, { ...init, headers: { ...f.headers, ...init?.headers } });
  const client = new ApplicationClient(`${f.origin}/api/ai-jobs`, transport);
  return { ...f, base, jobId: job.id, client, transport };
}

it("merges keyed records and maps, preserves unrelated live units, and rejects overlaps, deletions and creation collisions", () => {
  const base = structuredClone(store.getCurrent()), generated = structuredClone(base), live = structuredClone(base);
  generated.meta.title = "AI";
  live.maps[live.startMapId].name = "human map name";
  expect(mergeResultProject(base, generated, live).maps[live.startMapId].name).toBe("human map name");
  live.meta.title = "human";
  expect(() => mergeResultProject(base, generated, live)).toThrow();
  generated.maps.newMap = { ...structuredClone(base.maps[base.startMapId]), id: "newMap" };
  live.maps.newMap = structuredClone(generated.maps.newMap);
  expect(() => mergeResultProject(base, generated, live)).toThrow();
  const b = structuredClone(base), g = structuredClone(base), l = structuredClone(base);
  delete g.maps[g.startMapId]; l.maps[l.startMapId].name = "later";
  expect(() => mergeResultProject(b, g, l)).toThrow();
});

it("records an unchanged read-only result without a project mutation or undo entry", async () => {
  const f = await applicationFixture({ family: "assistant", generated: base => base });
  const before = structuredClone(store.getCurrent());
  let mutations = 0;
  const unsubscribe = store.subscribe(() => { mutations++; });
  try {
    const result = await applyJobResult(f.jobId, { client: f.client, storage });
    expect(result.application, result.reason).toBe("applied");
    expect(mutations).toBe(0);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(store.getCurrent()).toEqual(before);
    expect((await f.client.detail(f.jobId)).job.applicationEvidence?.receipt).toMatchObject({
      evidence: { noChanges: true },
    });
  } finally { unsubscribe(); }
}, 30000);

it("uses real IndexedDB and Web Lock arbitration for one application and one undo across concurrent clients", async () => {
  const f = await applicationFixture();
  store.updateMap(f.base.startMapId, map => { map.name = "unrelated live edit"; });
  const [one, two] = await Promise.all([applyJobResult(f.jobId, { client: f.client, storage }), applyJobResult(f.jobId, { client: f.client, storage })]);
  expect(one.application, one.reason).toBe("applied"); expect(two.application, two.reason).toBe("applied");
  expect(one.receiptId).toBe(two.receiptId);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  expect(store.getCurrent().meta.title).toBe("generated");
  expect(store.getCurrent().maps[f.base.startMapId].name).toBe("unrelated live edit");
  const detail = await f.client.detail(f.jobId);
  const receipt = detail.job.applicationEvidence!.receipt as any;
  expect(receipt.evidence.appliedArtifact.sha256).toBe(await appliedSnapshotHash(store.getCurrent()));
  expect(detail.manifest).toContainEqual(receipt.evidence.appliedArtifact);
  expect(await sha256HexText(canonicalJson(await f.client.json(f.jobId, receipt.evidence.appliedArtifact)))).toBe(receipt.evidence.appliedSnapshotSha256);
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent().meta.title).toBe(f.base.meta.title);
  await applyJobResult(f.jobId, { client: f.client, storage });
  expect(store.getCurrent().meta.title).toBe(f.base.meta.title);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
}, 30000);

it("recovers a lost prepare acknowledgement and resends a lost evidence acknowledgement without another mutation", async () => {
  const f = await applicationFixture();
  let losePrepare = true, loseEvidence = true;
  const client = new ApplicationClient(`${f.origin}/api/ai-jobs`, async (url, init) => {
    const response = await f.transport(url, init);
    if (String(url).endsWith("/prepare") && losePrepare) { losePrepare = false; throw new Error("lost prepare acknowledgement"); }
    if (String(url).endsWith("/evidence") && loseEvidence) { loseEvidence = false; throw new Error("lost evidence acknowledgement"); }
    return response;
  });
  const first = await applyJobResult(f.jobId, { client, storage });
  expect(first.application, first.reason).toBe("applied"); expect(first.evidencePending).toBe(true);
  const second = await applyJobResult(f.jobId, { client, storage });
  expect(second.application, second.reason).toBe("applied"); expect(second.evidencePending).toBeUndefined();
  expect(getMapEditHistoryEntries()).toHaveLength(1);
}, 30000);

it("rejects project replacement during HTTP preparation without relabeling or mutating the replacement", async () => {
  const f = await applicationFixture();
  const client = new ApplicationClient(`${f.origin}/api/ai-jobs`, async (url, init) => {
    const response = await f.transport(url, init);
    if (String(url).endsWith("/prepare")) store.replaceProject({ ...structuredClone(f.base), meta: { ...f.base.meta, title: "replacement" } });
    return response;
  });
  const applied = await applyJobResult(f.jobId, { client, storage });
  expect(applied.application, applied.reason).toBe("conflict");
  expect(store.getCurrent().meta.title).toBe("replacement"); expect(getMapEditHistoryEntries()).toHaveLength(0);
}, 30000);

it("defers while play-test read-only snapshot is exposed and resumes after its exact release notification", async () => {
  const f = await applicationFixture();
  const release = store.beginReadOnlyProjectSnapshot({ ...f.base, meta: { ...f.base.meta, title: "play snapshot" } });
  expect((await applyJobResult(f.jobId, { client: f.client, storage })).application).toBe("awaiting-editor");
  let notified = false;
  const unsubscribe = store.subscribeApplicationAvailability(() => { notified = !store.hasReadOnlyProjectSnapshot(); });
  release(); unsubscribe(); expect(notified).toBe(true);
  expect((await applyJobResult(f.jobId, { client: f.client, storage })).application).toBe("applied");
  expect(undoMapEdit()).toBe(true); expect(store.getCurrent().meta.title).toBe(f.base.meta.title);
}, 30000);

it("treats transaction abort after mutation as unknown and retains exact recovery images without replay", async () => {
  const f = await applicationFixture();
  const put = IDBObjectStore.prototype.put;
  let abort = true;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
    const request = put.call(this, value, key);
    if (value.phase === "applied" && abort) { abort = false; request.addEventListener("success", () => this.transaction.abort(), { once: true }); }
    return request;
  });
  const first = await applyJobResult(f.jobId, { client: f.client, storage });
  expect(first.application, first.reason).toBe("outcome-unknown");
  expect(getVolatileApplicationRecovery(f.jobId)?.applied?.meta.title).toBe("generated");
  const db = await openApplicationRecords(storage); const record = await db.get(`job:${f.jobId}`); db.close();
  expect(record?.phase).toBe("prepared");
  expect((await applyJobResult(f.jobId, { client: f.client, storage })).application).toBe("outcome-unknown");
  expect(getMapEditHistoryEntries()).toHaveLength(1);
}, 30000);

it("never guesses application from equality when a previous process left only a prepared receipt", async () => {
  const f = await applicationFixture();
  const { job } = await f.client.detail(f.jobId);
  const input = await f.client.json<AiJobInput>(f.jobId, job.inputRef);
  const prepare = { claimId: "crashed-claim", receiptId: "crashed-receipt", project: { ...job.project }, resultSha256: job.resultRef!.sha256, baselineSha256: input.projectSnapshot.sha256 };
  const records = await openApplicationRecords(storage);
  await records.put({ key: `job:${f.jobId}`, jobId: f.jobId, project: job.project, resultSha256: job.resultRef!.sha256, claimId: prepare.claimId, receiptId: prepare.receiptId,
    prepare, before: f.base, proposed: f.base, draftOnly: false, phase: "prepared" }); records.close();
  const result = await applyJobResult(f.jobId, { client: f.client, storage });
  expect(result.application, result.reason).toBe("outcome-unknown"); expect(getMapEditHistoryEntries()).toHaveLength(0);
  expect((await f.client.detail(f.jobId)).job.application).toBe("outcome-unknown");
}, 30000);

it.each(["prepared", "applied"] as const)("%s journal recovery cannot supply a missing canonical load or restore snapshots over human edits", async phase => {
  const f = await applicationFixture();
  const { job } = await f.client.detail(f.jobId);
  if (phase === "applied") {
    expect((await applyJobResult(f.jobId, { client: f.client, storage })).application).toBe("applied");
  } else {
    const resultRef = job.resultRef;
    if (!resultRef) throw new Error("Expected the fixture job's durable result reference");
    const input = await f.client.json<AiJobInput>(f.jobId, job.inputRef);
    const result = await f.client.json<AiJobResult>(f.jobId, resultRef);
    const generatedSnapshot = result.generatedSnapshot;
    if (!generatedSnapshot) throw new Error("Expected the fixture result's generated snapshot");
    const proposed = await f.client.json<Project>(f.jobId, generatedSnapshot);
    const prepare = { claimId: "recovery-claim", receiptId: "recovery-receipt", project: { ...job.project },
      resultSha256: resultRef.sha256, baselineSha256: input.projectSnapshot.sha256 };
    const records = await openApplicationRecords(storage);
    try {
      await records.put({ key: `job:${f.jobId}`, jobId: f.jobId, project: job.project,
        resultSha256: resultRef.sha256, claimId: prepare.claimId, receiptId: prepare.receiptId,
        prepare, before: f.base, proposed, draftOnly: false, phase });
    } finally { records.close(); }
  }
  // Close/reopen the durable journal; no mocked recovery or store replacement path.
  const records = await openApplicationRecords(storage);
  const retained = await records.get(`job:${f.jobId}`);
  records.close();
  expect(retained?.phase).toBe(phase);
  expect(retained?.proposed.meta.title).toBe("generated");
  store.update(project => {
    project.meta.title = "later human title";
    project.maps[project.startMapId].lowerTiles[0] = 17;
    project.database.items[0].price = 731;
  });
  const live = structuredClone(store.getCurrent());
  const history = [...getMapEditHistoryEntries()];
  expect(live).not.toEqual(retained?.before);
  expect(live).not.toEqual(retained?.proposed);
  let mutations = 0;
  const unsubscribe = store.subscribe(() => { mutations++; });
  try {
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false });
    expect(await applyJobResult(f.jobId, { client: f.client, storage })).toMatchObject({
      application: "awaiting-editor", reason: "project-not-loaded",
    });
    expect(store.isLoaded()).toBe(false);
    expect(store.getCurrent()).toEqual(live);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    const recovered = await applyJobResult(f.jobId, { client: f.client, storage });
    expect(recovered.application, recovered.reason).toBe(phase === "applied" ? "applied" : "outcome-unknown");
    expect(recovered.receiptId).toBe(retained?.receiptId);
    expect((await f.client.detail(f.jobId)).job.application).toBe(recovered.application);
    expect(store.getCurrent()).toEqual(live);
    expect(getMapEditHistoryEntries()).toEqual(history);
    expect(mutations).toBe(0);
  } finally { unsubscribe(); }
}, 30000);

it("binds reviewed event commands to the live UUID/revision/owner, applies exclusions in one command undo, and never saves drafts", async () => {
  let commands: Command[] = [{ kind: "text", body: "before" }];
  let open = true;
  const owner = { kind: "common-event" as const, commonEventId: "ce-job" };
  store.update(p => { p.commonEvents.push({ id: owner.commonEventId, name: "job", trigger: "none", commands }); });
  const history = createCommandToolbarHistory({ key: "task5-draft", readCommands: () => commands, replaceCommands: next => { commands = next; } });
  const live = { draftId: crypto.randomUUID(), owner, project: store.getLoadedProjectIdentity(), epoch: store.getProjectEpoch(), isOpen: () => open,
    readCommands: () => commands, replaceAll: history.replaceAll };
  cleanups.push(registerDraftOwner(live));
  const binding = await captureDraftBinding(live);
  const payload = { prompt: "edit", config: { authMode: "chatgpt", model: "fixture", maxTokens: 100, maxToolCalls: 2 }, baseCommands: commands, selection: null, preferenceMemorySection: "", draftBinding: binding };
  const target = { kind: "common-event", commonEventId: owner.commonEventId, mapId: store.getCurrent().startMapId };
  const f = await applicationFixture({ family: "event-commands", mode: "review", target, payload, result: async (input, host) => {
    const proposal = { version: 1, project: input.project, target, baseCommands: payload.baseCommands, finalCommands: [{ kind: "text", body: "after" }] };
    const ref = await host.putJson(proposal);
    return { ...resultFor(input, host), artifacts: [ref], payload: { proposalRef: ref } };
  } });
  expect((await applyJobResult(f.jobId, { client: f.client, storage })).application).toBe("awaiting-review");
  const result = await applyJobResult(f.jobId, { client: f.client, storage, review: { approved: true } });
  expect(result.application, result.reason).toBe("applied"); expect(commands).toEqual([{ kind: "text", body: "after" }]);
  expect(history.canUndo()).toBe(true); history.undo(); expect(commands).toEqual(payload.baseCommands); expect(history.canUndo()).toBe(false);
  expect((await retryJobSave(f.jobId, { client: f.client, storage })).save).toBe("unsaved");
  open = false;
}, 30000);

it("rejects closed/replaced/changed command draft owners", async () => {
  const { resolveDraftOwner } = await import("@/editor/aiJobs/draftOwners");
  let commands: Command[] = [{ kind: "text", body: "captured" }], open = true;
  const live = { draftId: crypto.randomUUID(), owner: { kind: "common-event" as const, commonEventId: "ce" }, project: store.getLoadedProjectIdentity(), epoch: store.getProjectEpoch(), isOpen: () => open,
    readCommands: () => commands, replaceAll: (next: readonly Command[]) => { commands = [...next]; } };
  const dispose = registerDraftOwner(live); cleanups.push(dispose);
  const binding = await captureDraftBinding(live);
  await resolveDraftOwner(live.project, binding);
  commands = [{ kind: "text", body: "changed" }];
  await expect(resolveDraftOwner(live.project, binding)).rejects.toThrow();
  commands = [{ kind: "text", body: "captured" }]; open = false;
  await expect(resolveDraftOwner(live.project, binding)).rejects.toThrow();
  dispose(); open = true; cleanups.push(registerDraftOwner({ ...live, draftId: crypto.randomUUID() }));
  await expect(resolveDraftOwner(live.project, binding)).rejects.toThrow();
});


it("preserves the actual live draft UUID/body in an unrelated DB candidate and application", async () => {
  const { createEventDraft } = await import("@/editor/eventDraftActions");
  const mapId = store.getCurrent().startMapId;
  const eventId = createEventDraft(mapId, 1, 1);
  store.updateMap(mapId, map => { map.events.find(e => e.id === eventId)!.commands = [{ kind: "text", body: "unsaved draft" }]; });
  const draft = structuredClone(store.getCurrent().maps[mapId].events.find(e => e.id === eventId)!);
  const f = await applicationFixture();
  const generated = structuredClone(f.base); generated.meta.title = "generated";
  const candidate = mergeResultProject(f.base, generated, store.getCurrent());
  expect(candidate.maps[mapId].events.find(e => e.id === eventId)).toEqual(draft);
  const applied = await applyJobResult(f.jobId, { client: f.client, storage });
  expect(applied.application, applied.reason).toBe("applied");
  expect(store.getCurrent().maps[mapId].events.find(e => e.id === eventId)).toEqual(draft);
  generated.maps[mapId].name = "AI touches open draft map";
  expect(() => mergeResultProject(f.base, generated, store.getCurrent())).toThrow();
}, 30000);


it("retries acknowledged save failure with a new stable attempt, confirms map rows, and never reapplies", async () => {
  const { createServer } = await import("node:http");
  const { once } = await import("node:events");
  let remote = JSON.parse(JSON.stringify(store.getCurrent())) as Project;
  const mapRows = new Map(Object.values(remote.maps).map(map => [map.id, map]));
  let failPublication = true, writes = 0;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const data = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const path = new URL(req.url!, "http://fixture").pathname;
    res.setHeader("Content-Type", "application/json");
    if (path === "/rest/v1/projects") {
      if (req.method === "GET") return res.end(JSON.stringify([{ current_json: remote, current_sha256: null }]));
      remote = data.current_json; writes++; return res.end(JSON.stringify([{ project_id: "task5-save" }]));
    }
    if (path === "/rest/v1/maps") {
      if (req.method === "GET") return res.end(JSON.stringify([...mapRows].map(([map_id, map_json]) => ({ map_id, map_json }))));
      if (failPublication) { res.statusCode = 503; return res.end(JSON.stringify({ message: "fixture map publication failure" })); }
      if (req.method === "POST") for (const row of data) mapRows.set(row.map_id, row.map_json);
      return res.end("[]");
    }
    return res.end("[]");
  });
  const listening = once(server, "listening"); server.listen(0, "127.0.0.1"); await listening;
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("fixture address missing");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "task5-save");
  vi.stubEnv("VITE_SUPABASE_URL", `http://127.0.0.1:${address.port}`);
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "");
  cleanups.push(() => vi.unstubAllEnvs());
  await store.load();
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  const f = await applicationFixture({ generated: base => { base.maps[base.startMapId].name = "applied map"; return base; } });
  const application = await applyJobResult(f.jobId, { client: f.client, storage });
  expect(application.application, application.reason).toBe("applied");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  const failed = await retryJobSave(f.jobId, { client: f.client, storage });
  expect(failed.save).not.toBe("saved");
  const first = (await f.client.detail(f.jobId)).job.saveEvidence as any;
  const failedId = first.updates.at(-1).saveAttemptId;
  failPublication = false;
  let loseSaveAcknowledgement = true;
  const saveClient = new ApplicationClient(`${f.origin}/api/ai-jobs`, async (url, init) => {
    const response = await f.transport(url, init);
    if (String(url).endsWith("/save-evidence") && loseSaveAcknowledgement) { loseSaveAcknowledgement = false; throw new Error("lost save evidence acknowledgement"); }
    return response;
  });
  await expect(retryJobSave(f.jobId, { client: saveClient, storage })).rejects.toThrow("lost save evidence acknowledgement");
  const writesBeforeEvidenceReplay = writes;
  const saved = await retryJobSave(f.jobId, { client: saveClient, storage });
  expect(writes).toBe(writesBeforeEvidenceReplay);
  expect(saved.save, saved.reason).toBe("saved");
  const second = (await f.client.detail(f.jobId)).job.saveEvidence as any;
  expect(second.updates.at(-1).saveAttemptId).not.toBe(failedId);
  expect(writes).toBeGreaterThanOrEqual(2);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  const writesAtSave = writes;
  await retryJobSave(f.jobId, { client: f.client, storage });
  expect(writes).toBe(writesAtSave);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: "load-failed" });
  await store.flush();
}, 60000);


it.each(["assistant", "region", "image", "tileset"] as const)("materializes the %s full-project result through the real application boundary", async family => {
  const f = await applicationFixture({ family, mode: "review" });
  const result = await applyJobResult(f.jobId, { client: f.client, storage, review: { approved: true } });
  expect(result.application, result.reason).toBe("applied"); expect(store.getCurrent().meta.title).toBe("generated");
  expect(getMapEditHistoryEntries()).toHaveLength(1);
}, 30000);

it.each(["knowledge-analysis", "question-followup", "proposal-draft", "structure-kit-metadata"] as const)("materializes reviewed native tileset %s without generation or new IDs", async operation => {
  const { tilesetKnowledgeFingerprint } = await import("@/editor/tilesetAiNativeAnalysis");
  const { parseProject } = await import("@/ai/jobs/checkpointState");
  const tilesetId = Object.keys(store.getCurrent().tilesets)[0];
  store.update(project => {
    const tileset = project.tilesets[tilesetId]; tileset.tileGroups = []; delete tileset.tileMeta;
    tileset.structureKits = [{ id: "kit-fixture", kind: "section", width: 2, height: 1, rows: [{ tiles: [4, 5] }], learnedFrom: "db-authored" }];
  });
  store.replace(parseProject(JSON.parse(JSON.stringify(store.getCurrent())))); resetMapEditHistory();
  const tileset = store.getCurrent().tilesets[tilesetId];
  const proposal = { id: "proposal-fixture", name: "Reviewed desk", tileIds: [4, 5], confidence: 0.9, cellLayers: null, template: "desk", status: "accepted",
    feedback: "", description: "fixture", evidence: "pixels", question: "", quickReplies: [], placementRules: "fixture", passage: { up: true, down: true, left: true, right: true } };
  const review = { tilesetId, fingerprint: tilesetKnowledgeFingerprint(tileset), status: "ready", summary: "fixture", warnings: [], proposals: [proposal] };
  const image = { sha256: "f".repeat(64), byteLength: 1, mediaType: "image/png" };
  const config = { authMode: "chatgpt", model: "fixture", maxToolCalls: 2, maxTokens: 100 }, context = { budgetChars: 100, preferenceMemorySection: "" };
  const specific = operation === "knowledge-analysis" ? { atlas: image, feedback: [] }
    : operation === "question-followup" ? { atlas: image, review, proposalId: proposal.id, answer: "fixture", turns: [] }
    : operation === "proposal-draft" ? { selectedTiles: [4, 5], snapshot: { image, summary: "fixture" }, lockedAnswer: "", setupChoice: { intent: "objectDetail", repeatability: "auto", scope: "labels", structure: "horizontal" } }
    : { kitId: "kit-fixture" };
  const mapping = { summary: "fixture", confidence: "high", tiles: [{ tile: 4, label: "artifact-label", role: "prop", defaultLayer: "lower", terrainTag: 0 }], groups: [{ name: "artifact-group", tileIds: [4, 5], role: "prop", defaultLayer: "lower" }] };
  const f = await applicationFixture({ family: "tileset", mode: "review", payload: { operation, tilesetId, config, context, ...specific }, result: async (input, host) => {
    const content = operation === "knowledge-analysis" || operation === "question-followup" ? { review, turns: [] }
      : operation === "proposal-draft" ? { answer: JSON.stringify(mapping), mapping }
      : { kitId: "kit-fixture", metadata: { description: "artifact-metadata", placementRules: "fixture", origin: "ai", placement: [] } };
    const ref = await host.putJson({ kind: operation, tilesetId, ...content });
    return { ...resultFor(input, host), artifacts: [ref], payload: { proposalRef: ref } };
  } });
  const applied = await applyJobResult(f.jobId, { client: f.client, storage, review: { approved: true, proposalIds: [proposal.id] } });
  expect(applied.application, applied.reason).toBe("applied");
  const current = store.getCurrent().tilesets[tilesetId];
  if (operation === "structure-kit-metadata") expect(current.structureKits![0].ai!.description).toBe("artifact-metadata");
  else if (operation === "proposal-draft") expect(current.tileMeta![4].label).toBe("artifact-label");
  else expect(current.tileGroups!.some(group => group.name === "Reviewed desk")).toBe(true);
  const after = canonicalJson(current);
  await applyJobResult(f.jobId, { client: f.client, storage, review: { approved: true } });
  expect(canonicalJson(store.getCurrent().tilesets[tilesetId])).toBe(after); expect(getMapEditHistoryEntries()).toHaveLength(1);
}, 30000);

it("creates image resource and links the exact reviewed command in one synchronous application", async () => {
  const { newCommand } = await import("@/editor/eventActions");
  let commands = [newCommand("changeFace")];
  const owner = { kind: "common-event" as const, commonEventId: "image-owner" };
  store.update(project => { project.commonEvents.push({ id: owner.commonEventId, name: "image", trigger: "none", commands }); });
  const live = { draftId: crypto.randomUUID(), owner, project: store.getLoadedProjectIdentity(), epoch: store.getProjectEpoch(), isOpen: () => true,
    readCommands: () => commands, replaceAll: (next: readonly Command[]) => { commands = [...next]; } };
  cleanups.push(registerDraftOwner(live));
  const binding = await captureDraftBinding(live);
  const target = { kind: "event-draft", ...binding, commandPath: [0], binding: "change-face", command: commands[0] };
  const f = await applicationFixture({ family: "image", mode: "review", target, result: async (input, host) => {
    const artifact = await host.putBlob(Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=", "base64")), "image/png");
    return { ...resultFor(input, host), artifacts: [artifact], payload: jsonObject(jsonValue({ proposal: { version: 1, kind: "create-image-and-link", resource: { id: "artifact-face-bust", name: "face", kind: "faceset", width: 1, height: 1, artifact }, destination: target,
      command: { ...commands[0], resourceId: "artifact-face-bust" } } })) };
  } });
  const observations: boolean[] = [];
  const unsubscribe = store.subscribe(project => { if (project.assets.uploaded["artifact-face-bust"]) observations.push(commands[0].kind === "changeFace" && commands[0].resourceId === "artifact-face-bust"); });
  cleanups.push(unsubscribe);
  const applied = await applyJobResult(f.jobId, { client: f.client, storage, review: { approved: true } });
  expect(applied.application, applied.reason).toBe("applied");
  expect(observations).toEqual([true]); expect(store.getCurrent().assets.uploaded["artifact-face-bust"]).toBeDefined();
  expect((await retryJobSave(f.jobId, { client: f.client, storage })).save).toBe("unsaved");
}, 30000);

it("uses the current rerendered owner for the same live draft without retargeting a replacement", async () => {
  const { resolveDraftOwner } = await import("@/editor/aiJobs/draftOwners");
  const commands: Command[] = [{ kind: "text", body: "same" }];
  let firstOpen = true, applied = 0;
  const first = { draftId: crypto.randomUUID(), owner: { kind: "common-event" as const, commonEventId: "rerender" }, project: store.getLoadedProjectIdentity(), epoch: store.getProjectEpoch(), isOpen: () => firstOpen,
    readCommands: () => commands, replaceAll: () => { throw new Error("detached callback invoked"); } };
  cleanups.push(registerDraftOwner(first));
  const binding = await captureDraftBinding(first), resolved = await resolveDraftOwner(first.project, binding);
  firstOpen = false; cleanups.push(registerDraftOwner({ ...first, isOpen: () => true, replaceAll: () => { applied++; } }));
  resolved.check(); resolved.owner.replaceAll(commands); expect(applied).toBe(1);
});


it("captures the synchronous applied image before subscribers and commit-log awaits without overwriting later edits", async () => {
  const f = await applicationFixture();
  const unsubscribe = store.subscribe((_project, change) => {
    if (change.origin !== "ai") return;
    unsubscribe(); store.updateMap(f.base.startMapId, map => { map.name = "later subscriber edit"; });
  });
  cleanups.push(unsubscribe);
  const result = await applyJobResult(f.jobId, { client: f.client, storage });
  expect(result.application, result.reason).toBe("applied");
  const records = await openApplicationRecords(storage), record = await records.get(`job:${f.jobId}`); records.close();
  expect(record!.applied!.maps[f.base.startMapId].name).toBe(f.base.maps[f.base.startMapId].name);
  expect(store.getCurrent().maps[f.base.startMapId].name).toBe("later subscriber edit");
  expect((record!.evidence!.evidence as any).appliedSnapshotSha256).not.toBe(await appliedSnapshotHash(store.getCurrent()));
}, 30000);


it("invalidates the application epoch on every full replacement even when its UI switch annotation is false", () => {
  const epoch = store.getProjectEpoch();
  store.replaceProject(structuredClone(store.getCurrent()), { projectSwitch: false });
  expect(store.getProjectEpoch()).toBeGreaterThan(epoch);
});
