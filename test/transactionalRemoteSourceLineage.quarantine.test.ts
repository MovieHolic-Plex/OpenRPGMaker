/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { audioDescriptionProject } from "./helpers/audioDescriptionPersistenceTransport";

const sourceId = "transaction-source";
const targetId = "transaction-target";
type Phase = "flush" | "save" | "reload";
type Row = { project_id: string; current_json: Project; current_sha256: string };
let finishCommitWrites: () => Promise<void>;

beforeEach(() => {
  vi.resetModules();
  finishCommitWrites = async () => {};
  vi.useFakeTimers(); // Autosave must not race the explicitly awaited transaction.
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "http://transaction.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", sourceId);
  vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
  localStorage.clear();
  window.history.replaceState(null, "", `/?project=${sourceId}`);
});

afterEach(async () => {
  try { await finishCommitWrites(); }
  finally {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
}, 30_000);

async function fixture(metadata: "audio" | "monster" | "both" = "both") {
  const base = audioDescriptionProject(undefined);
  const rows = new Map<string, Row>([[sourceId, {
    project_id: sourceId, current_json: base, current_sha256: "initial",
  }]]);
  const writes: string[] = [];
  const hooks = new Map<Phase, () => void | Promise<void>>();
  const at = async (phase: Phase) => {
    const hook = hooks.get(phase);
    hooks.delete(phase);
    await hook?.();
  };
  // Exercise production store.flush, metadata delta/CAS, receipt hashing and
  // target proof reader. Only PostgREST is replaced; no store/save/load stubs.
  vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname !== "transaction.invalid") throw new Error(`Unexpected host: ${url.hostname}`);
    const method = init?.method ?? "GET";
    if (url.pathname === "/rest/v1/projects") {
      if (method === "POST" || method === "PATCH") {
        const row: Row = JSON.parse(String(init?.body));
        if (![sourceId, targetId].includes(row.project_id)) throw new Error("Unexpected write target");
        if (method === "PATCH"
          && url.searchParams.get("current_sha256") !== `eq.${rows.get(row.project_id)?.current_sha256}`) {
          return Response.json([]);
        }
        rows.set(row.project_id, row);
        writes.push(row.project_id);
        await at(row.project_id === sourceId ? "flush" : "save");
        return Response.json([row]);
      }
      if (method !== "GET") throw new Error(`Unexpected project method: ${method}`);
      const id = url.searchParams.get("project_id")?.replace(/^eq\./, "");
      if (!id || ![sourceId, targetId].includes(id)) throw new Error("Unexpected read target");
      if (id === targetId) await at("reload");
      return Response.json(rows.has(id) ? [rows.get(id)] : []);
    }
    if (["/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/project_commits", "/rest/v1/project_changes"].includes(url.pathname)) {
      return Response.json([]);
    }
    throw new Error(`Unexpected transport: ${method} ${url.pathname}`);
  }));
  const sync = await import("@/project/supabaseProjectSync");
  const commitWrites = vi.spyOn(sync, "recordProjectCommitToSupabase");
  finishCommitWrites = async () => {
    for (const write of commitWrites.mock.results) {
      if (write.type !== "return") throw new Error("Commit writer did not return");
      expect(await write.value).toMatchObject({ kind: "saved" });
    }
  };
  const { store } = await import("@/project/store");
  await store.load();
  store.updateMap(store.getCurrent().startMapId, map => { map.name = "source authored map"; });
  const source = store.getCurrent();
  const identity = store.getProjectIdentity();
  const href = location.href;
  const remote = structuredClone(source);
  if (metadata !== "monster") remote.audioDescriptions = { music: { remote: "remote audio description" } };
  if (metadata !== "audio") remote.monsterMetadata = { remote: { description: "remote monster description" } };
  // A different client changed metadata, not the locally edited map.
  remote.maps = structuredClone(base.maps);
  rows.set(sourceId, { project_id: sourceId, current_json: remote, current_sha256: "remote-metadata" });
  const candidate = audioDescriptionProject(undefined);
  candidate.meta.title = "new target";
  return { store, source, identity, href, remote, candidate, rows, writes, hooks };
}

describe("transactional remote source ownership", () => {
  it.each(["audio", "monster", "both"] as const)(
    "accepts its own %s metadata reconciliation through real source flush",
    async metadata => {
      const f = await fixture(metadata);
      const synchronized: Project[] = [];
      const stop = f.store.subscribe((project, change) => {
        if (change.origin === "system" && change.projectSwitch === false) synchronized.push(project);
      });
      const beforeAdoption: Project[] = [];
      for (const phase of ["save", "reload"] as const) {
        f.hooks.set(phase, () => {
          beforeAdoption.push(f.store.getCurrent());
          expect(f.store.getProjectIdentity()).toEqual(f.identity);
          expect(f.store.hasUnsavedChanges()).toBe(false);
          expect(location.href).toBe(f.href);
        });
      }
      try {
        await expect(f.store.loadNewRemoteProjectTransactionally(f.candidate, { projectId: targetId }))
          .resolves.toEqual({ projectId: targetId });
        expect(synchronized).toHaveLength(1);
        expect(synchronized[0]).not.toBe(f.source);
        expect(synchronized[0]?.maps).toBe(f.source.maps);
        expect(synchronized[0]?.audioDescriptions).toEqual(f.remote.audioDescriptions);
        expect(synchronized[0]?.monsterMetadata).toEqual(f.remote.monsterMetadata);
        expect(beforeAdoption).toEqual([synchronized[0], synchronized[0]]);
        expect(f.writes).toEqual([sourceId, targetId]);
        expect(f.rows.get(sourceId)?.current_json.maps[f.source.startMapId]?.name).toBe("source authored map");
        expect(f.rows.get(sourceId)?.current_json.audioDescriptions).toEqual(f.remote.audioDescriptions);
        expect(f.rows.get(sourceId)?.current_json.monsterMetadata).toEqual(f.remote.monsterMetadata);
        expect(f.store.getProjectIdentity()).toEqual({ kind: "remote", id: targetId });
        expect(f.store.getCurrent().meta.title).toBe("new target");
        expect(f.store.hasUnsavedChanges()).toBe(false);
      } finally { stop(); }
    }, 30_000,
  );

  it.each([
    ["flush", "edit"], ["save", "edit"], ["reload", "edit"],
    ["flush", "replacement"], ["save", "replacement"], ["reload", "replacement"],
    ["flush", "cancel"], ["save", "cancel"], ["reload", "cancel"],
  ] as const)("rejects %s-time %s even when the source ends clean with the same identity", async (phase, action) => {
    const f = await fixture();
    const controller = new AbortController();
    let intervened = false;
    f.hooks.set(phase, async () => {
      intervened = true;
      if (action === "cancel") controller.abort();
      else if (action === "replacement") {
        // A same-ID load is a new lineage, not an authored mutation. At save/
        // reload it even has the same accepted content as the reconciled source.
        await f.store.load();
      } else {
        f.store.updateMap(f.source.startMapId, map => { map.name = "newer authored map"; });
        // Flush-time edits are saved by the real catch-up loop. Later edits are
        // explicitly saved here, so a dirty-only guard cannot pass this test.
        if (phase !== "flush") await f.store.flush();
      }
    });
    await expect(f.store.loadNewRemoteProjectTransactionally(f.candidate, {
      projectId: targetId, signal: controller.signal,
    })).rejects.toMatchObject({ stage: action === "cancel" ? "cancelled" : "concurrent-edit" });
    expect(intervened).toBe(true);
    expect(f.store.getProjectIdentity()).toEqual(f.identity);
    expect(f.store.hasUnsavedChanges()).toBe(false);
    expect(location.href).toBe(f.href);
    expect(f.store.getCurrent().meta.title).toBe(f.source.meta.title);
    if (action === "edit") expect(f.store.getCurrent().maps[f.source.startMapId]?.name).toBe("newer authored map");
    expect(f.writes.includes(targetId)).toBe(phase !== "flush");
  }, 30_000);
});
