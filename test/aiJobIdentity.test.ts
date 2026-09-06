import { afterEach, expect, it, vi } from "vitest";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "vite";
import { aiJobsPlugin } from "../scripts/lib/aiJobs/vitePlugin.mjs";
import { store, setDevProjectFactory } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { connectionProjectIdentity } from "@/project/loadedProjectIdentity";
import { loadLocalProjectEnvelope, persistLocalProjectEnvelope } from "@/project/devProjectPersistence";

const cleanups: Array<() => unknown> = [];
afterEach(async () => {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false }); await store.flush();
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  setDevProjectFactory(null); vi.unstubAllEnvs(); vi.unstubAllGlobals();
});
function browser(search: string, protocol = "http:") {
  const data = new Map<string, string>();
  const localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) };
  let location = new URL(`${protocol}//editor.invalid/${search}`);
  const window = { get location() { return location; }, localStorage, history: { state: null, replaceState: (_s: unknown, _t: string, url: string) => { location = new URL(url, location); } } };
  vi.stubGlobal("window", window); vi.stubGlobal("localStorage", localStorage);
  return { data, window };
}
it("serializes two cache migrations with real Web Locks and keeps identical new/reset content a different identity", async () => {
  const fixture = browser("?devProject=1");
  fixture.data.set("oprn:dev-project:editor.invalid/?devProject=1", JSON.stringify(createBlankProject()));
  const [a, b] = await Promise.all([loadLocalProjectEnvelope(createBlankProject()), loadLocalProjectEnvelope(createBlankProject())]);
  expect(a.localProjectId).toBe(b.localProjectId);
  const persisted = JSON.parse(fixture.data.get("oprn:dev-project:editor.invalid/?devProject=1")!);
  expect(persisted.localProjectId).toBe(a.localProjectId); expect(persisted.version).toBe(1);
  setDevProjectFactory(createBlankProject); await store.load();
  const identity = store.getLoadedProjectIdentity();
  store.replaceProject(structuredClone(store.getCurrent())); await store.flush();
  const replacement = store.getLoadedProjectIdentity(); expect(replacement).not.toEqual(identity);
  await store.load(); expect(store.getLoadedProjectIdentity()).toEqual(replacement);
  await store.clearAll(); await store.flush(); expect(store.getLoadedProjectIdentity()).not.toEqual(replacement);
});
it.each(["persist", "migrate"])("keeps a queued cache %s bound to its captured slot", async operation => {
  const f = browser("?devProject=old");
  const oldKey = "oprn:dev-project:editor.invalid/?devProject=old";
  const newKey = "oprn:dev-project:editor.invalid/?devProject=new";
  const project = createBlankProject();
  const untouched = JSON.stringify({ version: 1, localProjectId: "new-project", project });
  f.data.set(oldKey, JSON.stringify(project));
  f.data.set(newKey, untouched);
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const released = new Promise<void>(resolve => { release = resolve; });
  const held = navigator.locks.request(`project-cache:${oldKey}`, async () => {
    enter();
    await released;
  });
  await entered;
  const pending = operation === "persist"
    ? persistLocalProjectEnvelope(project, "old-project")
    : loadLocalProjectEnvelope(project);
  f.window.history.replaceState(null, "", "?devProject=new");
  release();
  await held;
  await pending;
  expect(f.data.get(newKey)).toBe(untouched);
  expect(JSON.parse(f.data.get(oldKey)!)).toMatchObject({ version: 1, localProjectId: expect.any(String) });
});
it.each(["?freshProject=1", "?devProject=1&blankProject=1"])("does not restore intentionally temporary boot %s", async search => {
  const f = browser(search);
  const a = await loadLocalProjectEnvelope(createBlankProject());
  expect(await persistLocalProjectEnvelope(a.project, a.localProjectId)).toBe(false);
  const b = await loadLocalProjectEnvelope(createBlankProject());
  expect(b.localProjectId).not.toBe(a.localProjectId); expect(a.durable).toBe(false); expect(f.data.size).toBe(0);
});
it("normalizes HTTPS raw-HTTP new/reconnect loads to the actual Vite proxy target digest; rotation retains identity and upstream replacement does not", async () => {
  const nativeFetch = globalThis.fetch;
  const wire: Array<{ url: string; status: number }> = [];
  let remote = JSON.parse(JSON.stringify(createBlankProject()));
  const backend = createHttpServer(async (req, res) => {
    for await (const _chunk of req) { /* Drain actual proxy upload before acknowledging. */ }
    res.setHeader("Content-Type", "application/json");
    res.end(req.method === "GET" && req.url?.startsWith("/rest/v1/projects?") ? JSON.stringify([{ current_json: remote, current_sha256: null }]) : "[]");
  });
  const listening = once(backend, "listening"); backend.listen(0, "127.0.0.1"); await listening;
  cleanups.push(async () => { backend.closeAllConnections(); await new Promise<void>((resolve, reject) => backend.close(e => e ? reject(e) : resolve())); });
  const address = backend.address(); if (!address || typeof address === "string") throw new Error("backend address missing");
  const target = `http://127.0.0.1:${address.port}`;
  const directory = await mkdtemp(join(tmpdir(), "ai-job-identity-")); cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const previousDirectory = process.env.AI_JOBS_DIRECTORY;
  process.env.AI_JOBS_DIRECTORY = join(directory, "jobs");
  cleanups.push(() => { if (previousDirectory === undefined) delete process.env.AI_JOBS_DIRECTORY; else process.env.AI_JOBS_DIRECTORY = previousDirectory; });
  let vite = await createServer({ configFile: false, envFile: false, root: resolve(import.meta.dirname, ".."), cacheDir: join(directory, "cache"),
    plugins: [aiJobsPlugin()], server: { host: "127.0.0.1", port: 19841, strictPort: true, proxy: { "/supabase": { target, rewrite: path => path.replace(/^\/supabase/, ""), headers: { apikey: "first-key" } } } } });
  cleanups.push(() => vite.close()); await vite.listen();
  const origin = "http://127.0.0.1:19841";
  const firstSession = await (await nativeFetch(`${origin}/api/ai-jobs/session`)).json();
  expect(firstSession.configuredBackend).toMatch(/^supabase-proxy:[a-f0-9]{64}$/);
  browser("", "https:");
  vi.stubEnv("VITE_SUPABASE_URL", target); vi.stubEnv("VITE_SUPABASE_ANON_KEY", "first-key"); vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "before"); vi.stubEnv("VITE_SUPABASE_USE_PROXY", "");
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const response = await nativeFetch(typeof url === "string" && url.startsWith("/") ? `${origin}${url}` : url, init);
    wire.push({ url: String(url), status: response.status }); return response;
  });
  await store.loadNewRemoteProject(createBlankProject(), { projectId: "https-new" });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false }); await store.flush();
  expect(store.getLoadedConnection()?.url).toBe("/supabase");
  const identity = store.getLoadedProjectIdentity(); expect(identity).toEqual({ backend: firstSession.configuredBackend, projectId: "https-new" });
  await store.assertEffectiveConnection(identity);
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "rotated-key"); await store.assertEffectiveConnection(identity);
  remote = JSON.parse(JSON.stringify(store.getCurrent()));
  const reconnected = await store.reconnectRemotePersistence();
  expect(reconnected.kind, JSON.stringify({ reconnected, wire })).toBe("connected");
  expect(store.getLoadedProjectIdentity()).toEqual(identity); await store.assertEffectiveConnection(identity);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false }); await store.flush();
  await vite.close();
  vite = await createServer({ configFile: false, envFile: false, root: resolve(import.meta.dirname, ".."), cacheDir: join(directory, "cache"),
    plugins: [aiJobsPlugin()], server: { host: "127.0.0.1", port: 19841, strictPort: true, proxy: { "/supabase": { target: `${target}/different-upstream`, headers: { apikey: "rotated-key" } } } } });
  await vite.listen();
  const changed = await connectionProjectIdentity({ url: "/supabase", anonKey: "rotated-key", projectId: identity.projectId });
  expect(changed.backend).not.toBe(identity.backend); await expect(store.assertEffectiveConnection(identity)).rejects.toThrow();
}, 60000);
