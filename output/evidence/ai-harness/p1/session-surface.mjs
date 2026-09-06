import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

// Real session/tool/apply/store entry points. Only LLM and HTTP are deterministic.
// This is not browser or live-Supabase acceptance; the surface worker owns those.
const projectId = "p1-session-surface-fixture";
const server = await createServer({
  configFile: false, envDir: false,
  resolve: { alias: { "@": resolve("src") } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://p1-session.invalid"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-anon-key"),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(projectId),
    "import.meta.env.VITE_SUPABASE_USE_PROXY": JSON.stringify("0"),
    "import.meta.env.VITE_EDIT_ACTIVITY_DISK_MIRROR": JSON.stringify("0"),
  },
  server: { middlewareMode: true, hmr: false, watch: null },
});
const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const evidence = { surface: "AssistantSession.sendUserMessage/retryLastTurn/proveAppliedRevision via Vite SSR", transport: "deterministic, no live remote", projectId, steps: [], events: [], requests: [], cleanup: {} };
let row;
let mode = "failed";
let store;
let readStarted;
let readReply;
let commitFinished;
const deadline = (promise) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Session signal deadline")), 60_000);
  })]).finally(() => clearTimeout(timer));
};
const final = (content) => ({ message: { role: "assistant", content }, finishReason: "stop" });
const savedAudits = (session) => session.getAuditEntries().filter((entry) => entry.kind === "status" && entry.text.split(" ")[0] === "agent_run_saved");
const capture = (event) => { if (event.type === "persistence_proof") evidence.events.push(event.state); };
try {
  globalThis.window = { location: { hostname: "127.0.0.1", pathname: "/", search: "" },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input), "http://p1-session.invalid");
    assert.equal(url.hostname, "p1-session.invalid");
    const method = init?.method ?? "GET";
    evidence.requests.push({ path: url.pathname, method, projectId: url.searchParams.get("project_id") });
    if (url.pathname === "/rest/v1/projects") {
      if (method !== "GET") { row = JSON.parse(String(init.body)); return Response.json(method === "PATCH" ? [row] : []); }
      assert.equal(url.searchParams.get("project_id"), `eq.${projectId}`);
      if (mode === "failed") return new Response("unavailable", { status: 503 });
      if (mode === "deferred") { readStarted.resolve(); return readReply.promise; }
      return Response.json([row]);
    }
    if (url.pathname === "/rest/v1/project_changes") commitFinished?.resolve();
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(url.pathname)) return Response.json([]);
    throw new Error(`Unexpected transport: ${method} ${url.pathname}`);
  };
  const { AssistantSession } = await server.ssrLoadModule("/src/ai/assistantSession.ts");
  ({ store } = await server.ssrLoadModule("/src/project/store.ts"));
  const { fixedDeclarer } = await server.ssrLoadModule("/test/intentFixture.ts");
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  let wrote = false;
  let chatCalls = 0;
  const session = new AssistantSession(store.getCurrent(), {
    config: { authMode: "apiKey", agentMode: "auto", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 1024, maxToolCalls: 10 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
    yieldToUi: async () => {},
    chat: async (_config, request) => {
      chatCalls += 1;
      if (!request.tools?.length) return final(JSON.stringify({ action: "new_plan", goal: "Title", layers: [{ title: "Title", items: [{ title: "Title", instruction: "set_title_screen", successTools: ["set_title_screen"] }] }] }));
      if (wrote) return final("Finished.");
      wrote = true;
      return { message: { role: "assistant", content: null, tool_calls: [{ id: "title", type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: "session-surface-title" }) } }] }, finishReason: "tool_calls" };
    },
  });
  const result = await deadline(session.sendUserMessage("Set the title", capture, undefined, { autonomous: true }));
  assert.deepEqual(result.appliedCalls.map((call) => call.name), ["set_title_screen"]);
  assert.equal(session.getRunEndProof().status, "failed");
  assert.equal(savedAudits(session).length, 0);
  const receipt = session.getRunEndProof().receipt;
  evidence.steps.push({ action: "completion-503", proof: session.getRunEndProof(), appliedCalls: result.appliedCalls.map((call) => call.name), savedAudits: 0 });
  mode = "matched";
  const chatsBefore = chatCalls;
  await deadline(session.retryLastTurn(capture));
  assert.equal(session.getRunEndProof().verified, true);
  assert.equal(session.getRunEndProof().receipt, receipt);
  assert.equal(chatCalls, chatsBefore);
  evidence.steps.push({ action: "same-revision-retry", proof: session.getRunEndProof(), llmCallsAdded: chatCalls - chatsBefore });
  const count = evidence.requests.length;
  await deadline(session.proveAppliedRevision(capture));
  assert.equal(evidence.requests.length, count);
  evidence.steps.push({ action: "succeeded-dedup", requestsAdded: 0 });
  // The next accepted revision is saved before the delayed proof read is armed.
  store.update((draft) => { draft.meta.title = "next-accepted-title"; });
  assert.equal(session.getRunEndProof().verified, false);
  readStarted = Promise.withResolvers(); readReply = Promise.withResolvers(); commitFinished = Promise.withResolvers();
  const pending = session.proveAppliedRevision((event) => {
    capture(event);
    if (event.type === "persistence_proof" && event.state.status === "attempted" && event.state.receipt) mode = "deferred";
  });
  await deadline(readStarted.promise);
  store.update((draft) => { draft.meta.title = "newer-human-edit"; });
  const live = store.getCurrent();
  readReply.resolve(Response.json([row]));
  const historical = await deadline(pending);
  await deadline(commitFinished.promise);
  assert.equal(historical.status, "failed"); assert.equal(historical.reason, "stale");
  assert.equal(historical.proof.kind, "verified"); assert.equal(historical.verified, false);
  assert.notEqual(historical.receipt.revisionId, receipt.revisionId);
  assert.equal(store.getCurrent(), live); assert.equal(store.getCurrent().meta.title, "newer-human-edit");
  assert.equal(store.hasUnsavedChanges(), true);
  evidence.steps.push({ action: "new-revision-local-edit-during-read", proof: historical, title: store.getCurrent().meta.title, dirty: store.hasUnsavedChanges(), liveIdentityPreserved: true });
  assert.equal(evidence.requests.filter((r) => r.path === "/rest/v1/project_commits" && r.method === "GET").length, 0);
  assert.equal(savedAudits(session).length, 1);
  evidence.pass = true;
} finally {
  readReply?.resolve(Response.json([]));
  if (store) { store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false, disabledReason: null }); await store.flush(); }
  const activity = await server.ssrLoadModule("/src/editor/editActivityLog.ts");
  activity._resetEditActivityForTest();
  await server.close();
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  evidence.cleanup = { viteClosed: true, transportRestored: true, autosaveCleared: true, activityTimersCleared: true, deferredSettled: true, remoteFixturesCreated: 0, listenerStarted: false };
  await writeFile(new URL("./session-surface.json", import.meta.url), JSON.stringify(evidence, null, 2) + "\n");
}
console.log(JSON.stringify({ pass: evidence.pass, steps: evidence.steps, cleanup: evidence.cleanup }, null, 2));
