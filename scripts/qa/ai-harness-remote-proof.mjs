#!/usr/bin/env node
// Real Supabase only. No product load/switch, browser storage, or default-project access.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createServer, loadEnv } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { values } = parseArgs({ options: {
  "create-isolated-project": { type: "boolean" },
  scenario: { type: "string" }, report: { type: "string" },
} });
assert.equal(values["create-isolated-project"], true, "Explicit isolated fixture creation is required");
assert.equal(values.scenario, "all", "Only the complete real-remote scenario is supported");
assert.ok(values.report, "--report is required");
const reportPath = resolve(values.report);
const runId = randomUUID();
const projectId = `qa-ai-proof-${runId}`;
const ownerTitle = `QA persistence proof ${runId}`;
const dialogueToken = `qa-dialogue-${runId}`;
const hash = (text) => createHash("sha256").update(text).digest("hex");
const evidence = {
  schemaVersion: 1, runId, projectId, startedAt: new Date().toISOString(),
  surface: "actual ProjectStore flush/verifyPersistedRevision via Vite SSR and live Supabase REST",
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  storeSourceSha256: hash(await readFile(resolve(root, "src/project/store.ts"))),
  harnessSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  scenario: "all", pass: false, actions: [], steps: [], cleanup: {},
};
const action = (kind, data = {}) => evidence.actions.push({ sequence: evidence.actions.length + 1, kind, ...data });
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const inflight = new Set();
const pendingProofs = new Set();
const controllers = new Set();
const commitIds = new Set();
const commitFinished = Promise.withResolvers(); // Subscribe before the only store save.
let config, server, store, activity, vault, unsubscribe;
let fixtureWriteAttempted = false;
let absenceConfirmed = false;
let proofMode = "real";
let responseGate;
let liveEmissions = 0;
let failure;
let closing = false;
const safeError = (error) => ({ name: error?.name ?? "Error", message: String(error?.message ?? error).replaceAll(config?.anonKey || "\0", "[REDACTED]") });
async function bounded(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Deadline: ${label}`)), 60_000);
    })]);
  } finally { clearTimeout(timer); }
}
function track(promise, set) {
  set.add(promise);
  // Both handlers settle normally; no unhandled rejected finally-promise.
  promise.then(() => set.delete(promise), () => set.delete(promise));
  return promise;
}
function headers() {
  return { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`,
    "Accept-Profile": "rpg_zzu", "Content-Profile": "rpg_zzu", "Content-Type": "application/json" };
}
function tableUrl(table, query = {}) {
  return `${config.url}/rest/v1/${table}?${new URLSearchParams({ project_id: `eq.${projectId}`, ...query })}`;
}
async function rest(table, method = "GET", query = {}, body) {
  const response = await globalThis.fetch(tableUrl(table, query), {
    method, headers: { ...headers(), Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; }
  catch { throw new Error(`Invalid JSON: ${method} ${table} HTTP ${response.status}`); }
  if (!response.ok) {
    // Do not propagate a remote body (or credentials) into product logs/evidence.
    const error = new Error(`Remote ${method} ${table} HTTP ${response.status}; code=${parsed?.code ?? "unknown"}`);
    error.status = response.status;
    error.remoteCode = parsed?.code;
    throw error;
  }
  return parsed;
}
function guardedFetch(input, init = {}) {
  return track((async () => {
    assert.equal(closing, false, "No late transport after cleanup");
    const url = new URL(String(input));
    assert.equal(url.origin, config.url, "Only the configured Supabase origin is permitted");
    const table = url.pathname.replace("/rest/v1/", "");
    assert.ok(["projects", "maps", "tilesets", "project_commits", "project_changes"].includes(table), "Unexpected remote table");
    const method = init.method ?? "GET";
    const payload = init.body ? JSON.parse(String(init.body)) : undefined;
    if (method === "POST") {
      for (const row of Array.isArray(payload) ? payload : [payload]) {
        if (table === "project_changes") assert.ok(commitIds.has(row.commit_id), "Changes must belong to this run's commit");
        else assert.equal(row.project_id, projectId, "Write must target the isolated project");
        if (table === "project_commits") commitIds.add(row.commit_id);
      }
      if (table === "projects") {
        assert.ok(absenceConfirmed, "Cannot write before isolated-id absence check");
        assert.equal(payload.title, ownerTitle);
        fixtureWriteAttempted = true;
      }
    } else if (table === "project_changes") {
      assert.ok([...commitIds].some((id) => url.searchParams.get("commit_id") === `eq.${id}`));
    } else assert.equal(url.searchParams.get("project_id"), `eq.${projectId}`, "Request must not touch the default project");
    const mode = table === "projects" && method === "GET" ? proofMode : "real";
    const request = { table, method, projectId, query: url.search, mode, network: mode !== "injected-transport-503" };
    action("request", request);
    if (mode === "injected-transport-503") {
      action("injection", { fault: mode, network: false });
      return new Response("QA injected transport failure; not a remote outage", { status: 503 });
    }
    const controller = new AbortController();
    controllers.add(controller);
    const timer = setTimeout(() => controller.abort(new Error("Remote request deadline")), 30_000);
    let response;
    try {
      const transportHeaders = new Headers(init.headers);
      transportHeaders.set("Connection", "close"); // Do not leave this run's sockets in the global keep-alive pool.
      response = await originalFetch(input, { ...init, headers: transportHeaders, redirect: "error",
        signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal });
      const bytes = await response.arrayBuffer(); // Own body completion and deadline, too.
      request.status = response.status;
      request.responseBytes = bytes.byteLength;
      if (!response.ok) {
        let code = "unknown";
        try { code = JSON.parse(Buffer.from(bytes).toString()).code ?? code; } catch { /* Non-JSON errors are represented by status only. */ }
        request.remoteCode = code;
        response = Response.json({ code, message: `Remote HTTP ${response.status}` }, { status: response.status });
      } else response = new Response(bytes.byteLength ? bytes : null, { status: response.status, headers: response.headers });
      if (mode === "injected-target") {
        const rows = await response.json();
        assert.equal(rows[0]?.project_id, projectId);
        rows[0].project_id = `injected-wrong-${runId}`;
        response = Response.json(rows);
        action("injection", { fault: mode, realReadCompleted: true, returnedProjectId: rows[0].project_id });
      }
      if (mode === "gated-real-read") {
        const gate = responseGate;
        gate.started.resolve();
        const aborted = () => gate.release.reject(init.signal.reason ?? new DOMException("Aborted", "AbortError"));
        if (init.signal?.aborted) aborted();
        else init.signal?.addEventListener("abort", aborted, { once: true });
        try { await bounded(gate.release.promise, "response gate release"); }
        finally { init.signal?.removeEventListener("abort", aborted); }
      }
      if (table === "project_changes" && method === "POST") commitFinished.resolve({ status: response.status });
      if (table === "project_commits" && !response.ok) commitFinished.resolve({ status: response.status });
      return response;
    } catch (error) {
      request.error = safeError(error);
      if (["project_commits", "project_changes"].includes(table) && method === "POST") commitFinished.resolve({ error: safeError(error) });
      throw error;
    } finally { clearTimeout(timer); controllers.delete(controller); }
  })(), inflight);
}
try {
  const env = loadEnv("development", root, "");
  const rawUrl = (env.SUPABASE_UPSTREAM_URL ?? env.VITE_SUPABASE_URL ?? "").trim();
  // This executable QA also supports the repository's configured self-hosted HTTP
  // Supabase origin. It does not reuse the HTTPS-only novice onboarding policy.
  assert.ok(/^https?:\/\/[^/?#@\\\s]+\/?$/i.test(rawUrl), "Supabase must be a credential-free HTTP(S) origin");
  const origin = new URL(rawUrl);
  const anonKey = (env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  let anon = /^sb_publishable_[A-Za-z0-9_-]+$/.test(anonKey);
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(anonKey)) {
    try { anon = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString()).role === "anon"; }
    catch { anon = false; }
  }
  assert.ok(anon, "Configured key must be anon/publishable, never service-role/admin");
  const configuredProjectId = (env.VITE_SUPABASE_PROJECT_ID ?? "").trim();
  assert.ok(configuredProjectId.length > 0 && configuredProjectId.length <= 200 && !/[\p{C}\\'"`]/u.test(configuredProjectId), "A valid configured project id is required");
  config = { url: origin.origin, anonKey, projectId: configuredProjectId };
  assert.notEqual(config.projectId, projectId);
  evidence.configuration = { origin: config.url, configuredProjectId: config.projectId, anonValidated: true,
    configuredProjectLoaded: false, configuredProjectAccessed: false, fixtureProjectId: projectId };
  config = { ...config, projectId }; // Established before any product module import.
  globalThis.fetch = guardedFetch;
  const absent = await rest("projects", "GET", { select: "project_id", limit: "1" });
  assert.deepEqual(absent, [], "Run UUID must not pre-exist");
  absenceConfirmed = true;
  action("isolated-target-established", { projectId, absent: true, beforeStoreImport: true });
  const storage = new Map();
  globalThis.window = {
    location: { protocol: "http:", hostname: "127.0.0.1", pathname: "/", search: `?project=${projectId}` },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
  };
  server = await createServer({
    root, configFile: false, envDir: false,
    resolve: { alias: { "@": resolve(root, "src") } },
    define: Object.fromEntries(Object.entries({
      VITE_SUPABASE_URL: config.url, VITE_SUPABASE_ANON_KEY: config.anonKey,
      VITE_SUPABASE_PROJECT_ID: projectId, VITE_SUPABASE_USE_PROXY: "0",
      VITE_EDIT_ACTIVITY_DISK_MIRROR: "0",
    }).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])),
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const modules = await Promise.all([
    server.ssrLoadModule("/src/project/store.ts"), server.ssrLoadModule("/src/project/supabaseProjectSync.ts"),
    server.ssrLoadModule("/src/project/io.ts"), server.ssrLoadModule("/src/project/eventDrafts.ts"),
    server.ssrLoadModule("/src/editor/editActivityLog.ts"), server.ssrLoadModule("/src/project/eventDraftVault.ts"),
  ]);
  [{ store }, , , , activity, vault] = modules;
  const [, sync, io, drafts] = modules;
  const identity = (project) => hash(io.serializeForComparison(drafts.projectWithoutEventDrafts(project)));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  // Test-only bootstrap of a fresh singleton; never call load(), reload(), or switch APIs.
  store.update((draft) => {
    draft.meta.title = ownerTitle;
    draft.maps[draft.startMapId].events.push({ id: "qa-proof-npc", x: 2, y: 2,
      trigger: { kind: "action" }, commands: [{ kind: "text", body: dialogueToken }] });
  });
  const saved = await bounded(store.flush(), "actual store save");
  assert.equal(saved.kind, "saved");
  const committed = await bounded(commitFinished.promise, "background commit transport");
  assert.ok(committed.status >= 200 && committed.status < 300, "Background commit must settle successfully");
  evidence.commitTransport = { ...committed, commitIds: [...commitIds] };
  assert.ok(saved.receipt, "Real accepted save must issue a receipt");
  const receipt = saved.receipt;
  evidence.receipt = receipt;
  assert.equal(receipt.projectId, projectId);
  assert.ok(Object.isFrozen(receipt));
  assert.equal(identity(store._getPersistedBaselineForTest()), receipt.contentIdentity);
  const initialLive = store.getCurrent();
  const initialJson = JSON.stringify(initialLive);
  const initialStorage = [...storage];
  unsubscribe = store.subscribe(() => { liveEmissions += 1; });
  const startProof = (options) => track(store.verifyPersistedRevision(receipt, options), pendingProofs);
  async function check(name, expected, options) {
    const firstAction = evidence.actions.length;
    const proof = await bounded(startProof(options), name);
    const step = { name, mode: proofMode, projectId, receiptId: receipt.revisionId,
      kind: proof.kind, reason: proof.reason, isCurrent: proof.isCurrent, expected,
      actionSequences: evidence.actions.slice(firstAction).map((entry) => entry.sequence) };
    evidence.steps.push(step); // Retain actual false success before asserting (mutation RED).
    assert.equal(proof.kind, expected, `${name}: false verified or wrong typed outcome`);
    assert.equal(proof.receipt, receipt, `${name}: must preserve the exact receipt`);
    if (expected === "mismatch") assert.equal(proof.reason, name === "injected-target" ? "target" : "content");
    if (expected === "verified") assert.equal(proof.isCurrent, true);
    assert.equal(store.getCurrent(), initialLive);
    assert.equal(JSON.stringify(store.getCurrent()), initialJson);
    assert.equal(store.hasUnsavedChanges(), false);
    assert.equal(liveEmissions, 0);
    assert.deepEqual([...storage], initialStorage);
    assert.ok(evidence.actions.slice(firstAction).filter((entry) => entry.kind === "request").every((entry) => entry.method === "GET"));
  }
  async function observe(name) {
    const read = await sync.loadProjectForPersistenceProof(config);
    assert.ok(read);
    assert.equal(read.projectId, projectId);
    assert.equal(read.sha256, receipt.sha256, "Wire hash must stay unchanged even when real content differs");
    const observedIdentity = identity(read.project);
    const event = read.project.maps[read.project.startMapId].events.find((entry) => entry.id === "qa-proof-npc");
    assert.ok(JSON.stringify(event).includes(dialogueToken), "Saved NPC dialogue sentinel must survive the real normalized read");
    evidence.steps.push({ name, realRemote: true, projectId: read.projectId,
      acceptedIdentity: receipt.contentIdentity, observedIdentity, observedWireSha256: read.sha256, npcId: event.id, dialogueToken });
    return observedIdentity;
  }
  assert.equal(await observe("accepted-real-read"), receipt.contentIdentity);
  await check("matched-real-content", "verified");
  const clean = await store.flush();
  assert.equal(clean.receipt, receipt);
  const [acceptedRow] = await rest("projects", "GET", { select: "project_id,title,current_json,current_sha256" });
  assert.equal(acceptedRow.title, ownerTitle);
  const changedJson = structuredClone(acceptedRow.current_json);
  changedJson.meta.title = `${ownerTitle} changed remotely`;
  const changed = await rest("projects", "PATCH", { title: `eq.${ownerTitle}` }, { current_json: changedJson });
  assert.equal(changed.length, 1);
  action("real-remote-content-changed", { projectId, wireHashIntentionallyUnchanged: true });
  assert.notEqual(await observe("changed-real-read"), receipt.contentIdentity);
  await check("changed-real-content", "mismatch");
  const restored = await rest("projects", "PATCH", { title: `eq.${ownerTitle}` }, { current_json: acceptedRow.current_json });
  assert.equal(restored.length, 1);
  action("real-remote-content-restored", { projectId, sameReceipt: receipt.revisionId });
  assert.equal(await observe("restored-real-read"), receipt.contentIdentity);
  await check("restored-same-receipt-retry", "verified");
  proofMode = "injected-transport-503";
  await check("injected-transport-503", "failed");
  proofMode = "real";
  await check("transport-failure-same-receipt-retry", "verified");
  proofMode = "injected-target";
  await check("injected-target", "mismatch");
  proofMode = "real";
  await check("target-failure-same-receipt-retry", "verified");
  action("injection", { fault: "store persistence disabled", remoteOutage: false });
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  await check("injected-disabled", "disabled");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
  responseGate = { started: Promise.withResolvers(), release: Promise.withResolvers() };
  proofMode = "gated-real-read";
  const cancel = new AbortController();
  const cancelled = check("injected-cancel-after-real-response", "cancelled", { signal: cancel.signal });
  await bounded(responseGate.started.promise, "cancel response reached");
  action("injection", { fault: "caller cancellation after real response", remoteOutage: false });
  cancel.abort();
  await cancelled;
  responseGate = undefined;
  proofMode = "real";
  await check("cancel-same-receipt-retry", "verified");
  responseGate = { started: Promise.withResolvers(), release: Promise.withResolvers() };
  proofMode = "gated-real-read";
  const historicalPending = startProof();
  await bounded(responseGate.started.promise, "local-edit response reached");
  store.update((draft) => { draft.meta.title = `${ownerTitle} local-only-newer`; });
  const newerLive = store.getCurrent();
  // Clear the real autosave debounce without waiting for it or writing the local race edit.
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null });
  assert.equal((await store.flush()).kind, "not-configured");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true });
  responseGate.release.resolve();
  const historical = await bounded(historicalPending, "historical proof");
  evidence.steps.push({ name: "newer-local-edit-during-real-read", kind: historical.kind, isCurrent: historical.isCurrent,
    sameLiveObject: store.getCurrent() === newerLive, dirty: store.hasUnsavedChanges(), emissions: liveEmissions });
  assert.equal(historical.kind, "verified");
  assert.equal(historical.isCurrent, false);
  assert.equal(store.isPersistenceReceiptCurrent(receipt), false);
  assert.equal(store.getCurrent(), newerLive);
  assert.equal(store.getCurrent().meta.title, `${ownerTitle} local-only-newer`);
  assert.equal(store.hasUnsavedChanges(), true);
  assert.equal(liveEmissions, 1);
  proofMode = "real";
  responseGate = undefined;
  assert.equal(await observe("remote-still-accepted-after-local-race"), receipt.contentIdentity);
  assert.equal(evidence.actions.filter((entry) => entry.kind === "request" && entry.table === "projects" && entry.method === "POST").length, 1);
  evidence.assertionsPassed = true;
} catch (error) {
  failure = error;
  evidence.failure = safeError(error);
} finally {
  proofMode = "real";
  responseGate?.release.resolve();
  unsubscribe?.();
  try {
    await bounded(Promise.allSettled([...pendingProofs]), "pending proofs cleanup");
    if (store) {
      store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null });
      await store.flush(); // Clears only this fresh singleton's timers, with remote writes disabled.
    }
    activity?._resetEditActivityForTest();
    vault?._resetEventDraftVaultForTest();
    await bounded(Promise.allSettled([...inflight]), "transport cleanup");
    evidence.cleanup.localTimersCleared = true;
    evidence.cleanup.deferredSettled = pendingProofs.size === 0;
    if (fixtureWriteAttempted) {
      const rows = await rest("projects", "GET", { select: "project_id,title", limit: "1" });
      assert.equal(rows.length, 1, "Fixture must remain identifiable before cleanup");
      assert.equal(rows[0].project_id, projectId);
      assert.equal(rows[0].title, ownerTitle, "Refuse cleanup without the run ownership marker");
      evidence.cleanup.ownership = { absentBeforeRun: absenceConfirmed, projectId, ownerTitle, observed: rows[0] };
      try {
        const deleted = await rest("projects", "DELETE", { title: `eq.${ownerTitle}` });
        assert.equal(deleted.length, 1, "Exactly one positively identified fixture must be removed");
        const remaining = await rest("projects", "GET", { select: "project_id" });
        assert.deepEqual(remaining, []);
        // Cascades are not assumed: verify each run-owned child table, including commit-only changes.
        for (const table of ["maps", "tilesets", "project_commits"]) assert.deepEqual(await rest(table, "GET", { select: "project_id" }), []);
        for (const id of commitIds) {
          const response = await globalThis.fetch(`${config.url}/rest/v1/project_changes?${new URLSearchParams({ commit_id: `eq.${id}`, select: "commit_id" })}`, { headers: headers() });
          assert.equal(response.ok, true);
          assert.deepEqual(await response.json(), []);
        }
        evidence.cleanup.remote = { kind: "deleted-and-absence-verified", projectId, commitIds: [...commitIds] };
      } catch (error) {
        if (![401, 403].includes(error.status)) throw error;
        evidence.cleanup.remote = { kind: "permission-limited", projectId, ownerTitle,
          status: error.status, code: error.remoteCode, commitIds: [...commitIds],
          limitation: "Anon project DELETE denied; coherent fixture and cascading children retained. No privilege escalation or unrelated deletion attempted." };
        for (const table of ["projects", "maps", "tilesets", "project_commits"]) {
          evidence.cleanup.remote[`${table}Count`] = (await rest(table, "GET", { select: "project_id" })).length;
        }
      }
    } else evidence.cleanup.remote = { kind: "not-created" };
  } catch (error) {
    evidence.cleanup.failure = safeError(error);
    failure ??= error;
  } finally {
    closing = true;
    for (const controller of controllers) controller.abort();
    await Promise.allSettled([...inflight]);
    try { await server?.close(); evidence.cleanup.viteClosed = true; }
    catch (error) { evidence.cleanup.viteClosed = false; evidence.cleanup.viteError = safeError(error); failure ??= error; }
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    evidence.cleanup.listenerStarted = false;
    evidence.cleanup.globalsRestored = true;
    evidence.cleanup.activeTransports = inflight.size;
    evidence.cleanup.pendingProofs = pendingProofs.size;
    evidence.finishedAt = new Date().toISOString();
    evidence.pass = evidence.assertionsPassed === true && !failure;
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(evidence, null, 2) + "\n");
  }
}
console.log(JSON.stringify({ pass: evidence.pass, projectId, report: reportPath, failure: evidence.failure,
  cleanup: evidence.cleanup, receipt: evidence.receipt }, null, 2));
if (!evidence.pass) process.exitCode = 1;
