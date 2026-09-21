import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

// Execute the shipped store + sync modules; replace only the HTTP transport.
// envDir:false prevents reading the checkout's private/live project settings.
const server = await createServer({
  configFile: false, envDir: false,
  resolve: { alias: { "@": resolve("src") } },
  define: {
    "import.meta.env.VITE_LEGACY_DB_URL": JSON.stringify("http://p1-transport.invalid"),
    "import.meta.env.VITE_LEGACY_DB_ANON_KEY": JSON.stringify("test-anon-key"),
    "import.meta.env.VITE_LEGACY_DB_PROJECT_ID": JSON.stringify("p1-surface-fixture"),
    "import.meta.env.VITE_LEGACY_DB_USE_PROXY": JSON.stringify("0"),
    "import.meta.env.VITE_EDIT_ACTIVITY_DISK_MIRROR": JSON.stringify("0"),
  },
  server: { middlewareMode: true, hmr: false, watch: null },
});
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const evidence = { surface: "actual ProjectStore API via Vite SSR; deterministic HTTP boundary", steps: [], requests: [], cleanup: {} };
let row;
let readMode = "matched";
let readStarted;
let readReply;
let commitFinished;
let store;
const json = (value) => Response.json(value);
const deadline = (promise) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Persistence signal deadline")), 60_000);
  })]).finally(() => clearTimeout(timer));
};
try {
  globalThis.window = {
    location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "http://p1-transport.invalid");
    const method = init?.method ?? "GET";
    evidence.requests.push({ method, path: url.pathname, projectId: url.searchParams.get("project_id") });
    assert.equal(url.hostname, "p1-transport.invalid");
    if (url.pathname === "/rest/v1/projects") {
      if (method === "POST" || method === "PATCH") {
        row = JSON.parse(String(init.body));
        return json(method === "PATCH" ? [row] : []);
      }
      assert.equal(url.searchParams.get("project_id"), "eq.p1-surface-fixture");
      if (readMode === "failed") return new Response("unavailable", { status: 503 });
      if (readMode === "deferred") { readStarted.resolve(); return readReply.promise; }
      const response = structuredClone(row);
      if (readMode === "content") response.current_json.meta.title = "wrong-content";
      if (readMode === "target") response.project_id = "wrong-target";
      return json([response]);
    }
    if (url.pathname === "/__oprn/edit-activity" && method === "POST") return json({ ok: true });
    if (url.pathname === "/rest/v1/project_changes") commitFinished.resolve();
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(url.pathname)) return json([]);
    throw new Error(`Unexpected request ${method} ${url.pathname}`);
  };
  ({ store } = await server.ssrLoadModule("/src/project/store.ts"));
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  commitFinished = Promise.withResolvers();
  store.update((draft) => { draft.meta.title = "accepted-surface-fixture"; });
  const saved = await deadline(store.flush());
  await deadline(commitFinished.promise);
  assert.equal(saved.kind, "saved");
  assert.ok(saved.receipt);
  const receipt = saved.receipt;
  evidence.receipt = receipt;
  const initialLive = store.getCurrent();
  for (const mode of ["matched", "content", "target", "failed", "matched"]) {
    readMode = mode;
    const proof = await deadline(store.verifyPersistedRevision(receipt));
    assert.equal(proof.kind, mode === "matched" ? "verified" : mode === "failed" ? "failed" : "mismatch");
    if (mode === "target" || mode === "content") assert.equal(proof.reason, mode);
    if (mode === "matched") assert.equal(proof.isCurrent, true);
    assert.equal(store.getCurrent(), initialLive);
    evidence.steps.push({ mode, kind: proof.kind, reason: proof.reason, isCurrent: proof.isCurrent });
  }
  readMode = "deferred";
  readStarted = Promise.withResolvers();
  readReply = Promise.withResolvers();
  const proofPending = store.verifyPersistedRevision(receipt);
  await deadline(readStarted.promise);
  store.update((draft) => { draft.meta.title = "newer-surface-edit"; });
  const latestLive = store.getCurrent();
  readReply.resolve(json([row]));
  const proof = await deadline(proofPending);
  assert.equal(proof.kind, "verified");
  assert.equal(proof.isCurrent, false);
  assert.equal(store.getCurrent(), latestLive);
  assert.equal(store.getCurrent().meta.title, "newer-surface-edit");
  assert.equal(store.hasUnsavedChanges(), true);
  evidence.steps.push({ mode: "local-edit-during-read", kind: proof.kind, isCurrent: proof.isCurrent, title: store.getCurrent().meta.title, dirty: store.hasUnsavedChanges() });
  assert.equal(evidence.requests.filter((call) => call.path === "/rest/v1/projects" && call.method !== "GET").length, 1);
  evidence.pass = true;
} finally {
  readReply?.resolve(json([]));
  if (store) {
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null });
    await store.flush(); // Clears owned autosave/retry timers without writing the newer edit.
  }
  const activity = await server.ssrLoadModule("/src/editor/editActivityLog.ts");
  activity._resetEditActivityForTest(); // Clear timers belonging only to this isolated in-memory fixture.
  await server.close();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  evidence.cleanup = { viteClosed: true, transportRestored: true, autosaveCleared: true, activityTimersCleared: true, deferredSettled: true, remoteFixturesCreated: 0, listenerStarted: false };
  await writeFile(new URL("./persistence-surface.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
}
console.log(JSON.stringify({ pass: evidence.pass, receipt: evidence.receipt, steps: evidence.steps, cleanup: evidence.cleanup }, null, 2));
