import { afterEach, describe, expect, it, vi } from "vitest";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { loadProjectFromSupabase, saveProjectMapPatchToSupabase } from "@/project/supabaseProjectSync";
import type { GameEvent, Project } from "@/project/types";
import { animalProject } from "./fixtures/p1FarmAnimals";

const config = { url: "https://memory.invalid", anonKey: "test-only", projectId: "housing-recovery" };

function housingProject(): Project {
  const project = animalProject();
  project.database.farmBuildingTypes = [{
    id: "shed", name: "Shed", animalHousing: { allowedSpeciesIds: ["chicken"] },
    levels: [{ level: 1, footprint: { width: 1, height: 1 }, capacity: 99, animalCapacity: 2,
      graphicResourceId: "easyrpg-picture-cloud" }],
  }];
  project.session.farmBuildingPlacements = [{ instanceId: "home1", typeId: "shed", level: 1,
    mapId: project.startMapId, x: 5, y: 5, orientation: "down" }];
  project.session.farmAnimals = ["a1", "a2"].map((instanceId) => ({
    instanceId, speciesId: "chicken", name: instanceId, housingPlacementId: "home1",
  }));
  project.maps.remote = { ...structuredClone(project.maps[project.startMapId]!), id: "remote", name: "Remote" };
  project.mapTree.children.push({ mapId: "remote", children: [] });
  return deserialize(serialize(project));
}

function invalidateHousing(project: Project): void {
  project.database.farmBuildingTypes![0]!.animalHousing!.allowedSpeciesIds.length = 0;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

/** Only transport is mocked. Every GET must be explicitly released by the test. */
function remoteTransport(initial: Project) {
  let remote = structuredClone(initial);
  let sha = "remote-sha-0";
  let getCount = 0;
  const reads = Array.from({ length: 4 }, () => ({ entered: deferred<void>(), release: deferred<void>() }));
  const writes: { method: string; url: URL; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", (async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    expect(url.origin).toBe(config.url);
    if (method === "GET" && url.pathname === "/rest/v1/projects") {
      expect(url.searchParams.get("project_id")).toBe(`eq.${config.projectId}`);
      const read = reads[getCount++]!;
      const row = { current_json: JSON.parse(serialize(remote)), current_sha256: sha };
      read.entered.resolve();
      await read.release.promise;
      return Response.json([row]);
    }
    if (method !== "GET") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      writes.push({ method, url, body });
      if (url.pathname === "/rest/v1/projects" && method === "PATCH") {
        if (url.searchParams.get("current_sha256") !== `eq.${sha}`) return Response.json([]);
        remote = deserialize(JSON.stringify(body.current_json));
        sha = String(body.current_sha256);
        return Response.json([body]);
      }
      if (url.pathname === "/rest/v1/maps" && method === "POST") return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected transport operation: ${method} ${url.pathname}`);
  }) satisfies typeof fetch);
  return {
    reads, writes,
    get project() { return remote; },
    get sha() { return sha; },
    setRemote(project: Project, nextSha: string) { remote = structuredClone(project); sha = nextSha; },
  };
}

// Capture rejection immediately, including while a fetch barrier is held.
function settled<T>(promise: Promise<T>) {
  return promise.then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error }));
}

async function releaseRead(transport: ReturnType<typeof remoteTransport>, index = 0) {
  const read = transport.reads[index]!;
  await read.entered.promise;
  read.release.resolve();
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("map-patch baseline contracts", () => {
  it("merges local edits without replacing a concurrent remote map", async () => {
    const base = housingProject();
    const local = structuredClone(base);
    local.maps[local.startMapId]!.name = "Local edit";
    const remote = structuredClone(base);
    remote.maps.remote!.name = "Concurrent edit";
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok && result.value.kind).toBe("saved");
    expect(transport.project.maps.remote).toEqual(remote.maps.remote);
    expect(transport.project.maps[local.startMapId]!.name).toBe("Local edit");
    expect(transport.writes[0]!.url.searchParams.get("current_sha256")).toBe("eq.remote-sha-0");
  });

  it("refuses a same-map conflict without writes", async () => {
    const base = housingProject();
    const local = structuredClone(base);
    local.maps[local.startMapId]!.name = "Local edit";
    const remote = structuredClone(base);
    remote.maps[remote.startMapId]!.name = "Concurrent edit";
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok && result.value).toEqual({ kind: "conflict", conflicts: [{ mapId: base.startMapId, name: "Local edit" }] });
    expect(transport.writes).toEqual([]);
    expect(transport.project).toEqual(remote);
  });

  it("ordinary load rejects invalid linked housing without changing the raw row", async () => {
    const remote = housingProject();
    invalidateHousing(remote);
    const original = serialize(remote);
    const transport = remoteTransport(remote);
    const pending = settled(loadProjectFromSupabase(config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected load rejection");
    expect(result.error).toBeInstanceOf(ProjectFormatError);
    expect(collectProjectReferenceIssues(remote)).toHaveLength(2);
    expect(serialize(transport.project)).toBe(original);
    expect(transport.writes).toEqual([]);
  });
});

describe("map-patch reference-dependent event retention", () => {
  it.each([true, false])("retains remote common-event calls restored by local roots (invalid housing: %s)", async (invalidHousing) => {
    const base = housingProject();
    if (invalidHousing) invalidateHousing(base);
    const local = housingProject();
    local.commonEvents.push({ id: "ce_restored", name: "Restored", trigger: "none", commands: [] });
    const remote = structuredClone(base);
    const concurrent: GameEvent = {
      id: "concurrent_call", name: "Concurrent call", x: 1, y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "callCommonEvent", commonEventId: "ce_restored" }],
      pages: [{
        id: "concurrent_page", name: "Concurrent page", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "loop", body: [{ kind: "callCommonEvent", commonEventId: "ce_restored" }] }],
      }],
    };
    const remoteMap = remote.maps.remote;
    if (!remoteMap) throw new Error("Fixture requires remote map");
    remoteMap.events.push(concurrent);
    const validLocal = deserialize(serialize(local));
    const intended = { ...validLocal, maps: structuredClone(remote.maps), mapTree: structuredClone(remote.mapTree) };
    expect(collectProjectReferenceIssues(validLocal)).toEqual([]);
    expect(collectProjectReferenceIssues(intended)).toEqual([]);
    expect(deserialize(serialize(intended)).maps.remote?.events).toEqual([concurrent]);
    const originals = [base, validLocal, remote].map(serialize);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: validLocal, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect([base, validLocal, remote].map(serialize)).toEqual(originals);
    expect(result.ok && result.value.kind).toBe("saved");
    expect(transport.project.maps.remote?.events).toEqual([concurrent]);
    expect(transport.project.commonEvents).toEqual(validLocal.commonEvents);
    expect(transport.writes.map((call) => call.method)).toEqual(["PATCH"]);
    expect(transport.writes[0]?.body).toMatchObject({ current_json: { maps: { remote: { events: [concurrent] } } } });
    expect(transport.writes[0]?.url.searchParams.get("current_sha256")).toBe("eq.remote-sha-0");
  });

  it("retains remote commands and movement targeting a locally restored map and event", async () => {
    const base = housingProject();
    invalidateHousing(base);
    const local = housingProject();
    const template = local.maps.remote;
    if (!template) throw new Error("Fixture requires remote map");
    local.maps.restored = { ...structuredClone(template), id: "restored", name: "Restored map", events: [{
      id: "restored_target", x: 1, y: 1, trigger: { kind: "action" }, commands: [],
    }] };
    local.mapTree.children.push({ mapId: "restored", children: [] });
    const remote = structuredClone(base);
    const concurrent: GameEvent = {
      id: "concurrent_movement", x: 1, y: 1, trigger: { kind: "action" },
      commands: [
        { kind: "transfer", mapId: "restored", x: 1, y: 1 },
        { kind: "showEmote", target: { eventId: "restored_target" }, emote: "heart" },
      ],
      schedule: [{ when: { hourRange: [6, 18] }, at: { mapId: "restored", x: 1, y: 1 } }],
      pages: [{
        id: "movement_page", name: "Movement", conditions: [], graphic: {},
        trigger: { kind: "action" }, priority: "same", commands: [],
        movement: { type: "living", speed: 3, frequency: 3,
          living: { destinations: [{ mapId: "restored", x: 1, y: 1 }], repeat: true } },
      }],
    };
    const remoteMap = remote.maps.remote;
    if (!remoteMap) throw new Error("Fixture requires remote map");
    remoteMap.events.push(concurrent);
    const intended = { ...local, maps: { ...remote.maps, restored: local.maps.restored } };
    expect(collectProjectReferenceIssues(local)).toEqual([]);
    expect(collectProjectReferenceIssues(intended)).toEqual([]);
    expect(deserialize(serialize(intended)).maps.remote?.events).toEqual([concurrent]);
    const originals = [base, local, remote].map(serialize);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect([base, local, remote].map(serialize)).toEqual(originals);
    expect(result.ok && result.value.kind).toBe("saved");
    expect(transport.project.maps.remote?.events).toEqual([concurrent]);
    expect(transport.project.maps.restored).toEqual(local.maps.restored);
    expect(transport.writes[0]?.body).toMatchObject({ current_json: { maps: { remote: { events: [concurrent] } } } });
  });

  it("refuses unresolved remote calls instead of publishing repaired command loss", async () => {
    const local = housingProject();
    const remote = structuredClone(local);
    invalidateHousing(remote);
    const remoteMap = remote.maps.remote;
    if (!remoteMap) throw new Error("Fixture requires remote map");
    remoteMap.events.push({ id: "unresolved_call", x: 1, y: 1, trigger: { kind: "action" },
      commands: [{ kind: "callCommonEvent", commonEventId: "ce_missing" }] });
    const originals = [local, remote].map(serialize);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: local }, config));
    await releaseRead(transport);
    const result = await pending;
    expect([local, remote].map(serialize)).toEqual(originals);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected unresolved-reference rejection");
    expect(result.error).toBeInstanceOf(ProjectFormatError);
    expect(transport.writes).toEqual([]);
    expect(transport.project).toEqual(remote);
  });

  it("does not hide a same-map command-only remote change during conflict detection", async () => {
    const base = housingProject();
    const baseMap = base.maps.remote;
    if (!baseMap) throw new Error("Fixture requires remote map");
    baseMap.events.push({ id: "existing_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [] });
    const local = structuredClone(base);
    const localMap = local.maps.remote;
    if (!localMap) throw new Error("Fixture requires local map");
    localMap.name = "Local edit";
    local.commonEvents.push({ id: "ce_restored", name: "Restored", trigger: "none", commands: [] });
    const remote = structuredClone(base);
    const remoteEvent = remote.maps.remote?.events[0];
    if (!remoteEvent) throw new Error("Fixture requires remote event");
    remoteEvent.commands.push({ kind: "callCommonEvent", commonEventId: "ce_restored" });
    const originals = [base, local, remote].map(serialize);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok && result.value).toEqual({ kind: "conflict", conflicts: [{ mapId: "remote", name: "Local edit" }] });
    expect(transport.writes).toEqual([]);
    expect(transport.project).toEqual(remote);
    expect([base, local, remote].map(serialize)).toEqual(originals);
  });
});

describe("map-patch housing recovery", () => {
  it("publishes the valid local housing correction while retaining a concurrent remote map", async () => {
    const base = housingProject();
    invalidateHousing(base); // persisted baseline may itself be the poisoned snapshot
    const local = housingProject();
    local.maps[local.startMapId]!.name = "Local edit";
    const remote = structuredClone(base);
    remote.maps.remote!.name = "Concurrent edit";
    const originals = [base, local, remote].map(serialize);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok && result.value.kind).toBe("saved");
    expect(transport.project.database.farmBuildingTypes![0]!.animalHousing!.allowedSpeciesIds).toEqual(["chicken"]);
    expect(transport.project.session.farmAnimals).toEqual(local.session.farmAnimals);
    expect(transport.project.maps.remote).toEqual(remote.maps.remote);
    expect(transport.project.maps[local.startMapId]!.name).toBe("Local edit");
    expect(collectProjectReferenceIssues(transport.project)).toEqual([]);
    expect(transport.writes.map((call) => [call.method, call.url.pathname])).toEqual([
      ["PATCH", "/rest/v1/projects"], ["POST", "/rest/v1/maps"],
    ]);
    expect(transport.writes[0]!.url.searchParams.get("current_sha256")).toBe("eq.remote-sha-0");
    expect([base, local, remote].map(serialize)).toEqual(originals);
  });

  it("saves a housing-only correction without writing or replacing remote maps", async () => {
    const local = housingProject();
    const base = structuredClone(local);
    invalidateHousing(base);
    const remote = structuredClone(base);
    remote.maps.remote!.name = "Concurrent edit";
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok && result.value.kind).toBe("saved");
    expect(transport.project.maps).toEqual(remote.maps);
    expect(transport.project.session.farmAnimals).toEqual(local.session.farmAnimals);
    expect(collectProjectReferenceIssues(transport.project)).toEqual([]);
    expect(transport.writes.map((call) => call.method)).toEqual(["PATCH"]);
  });

  it("still reports same-map conflict when remote housing is invalid", async () => {
    const base = housingProject();
    const local = structuredClone(base);
    local.maps[local.startMapId]!.name = "Local edit";
    const remote = structuredClone(base);
    remote.maps[remote.startMapId]!.name = "Concurrent edit";
    invalidateHousing(remote);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok && result.value).toEqual({ kind: "conflict", conflicts: [{ mapId: base.startMapId, name: "Local edit" }] });
    expect(transport.writes).toEqual([]);
    expect(transport.project).toEqual(remote);
  });

  it("re-reads and re-merges after a SHA race, preserving a new remote map and tree entry", async () => {
    const local = housingProject();
    const base = structuredClone(local);
    invalidateHousing(base);
    const transport = remoteTransport(base);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await transport.reads[0]!.entered.promise;
    const concurrent = structuredClone(base);
    concurrent.maps.added = { ...structuredClone(concurrent.maps.remote!), id: "added", name: "Concurrent addition" };
    concurrent.mapTree.children.push({ mapId: "added", children: [] });
    transport.setRemote(concurrent, "remote-sha-1");
    transport.reads[0]!.release.resolve();
    await releaseRead(transport, 1);
    const result = await pending;
    expect(result.ok && result.value.kind).toBe("saved");
    expect(transport.project.maps).toEqual(concurrent.maps);
    expect(transport.project.mapTree).toEqual(concurrent.mapTree);
    expect(collectProjectReferenceIssues(transport.project)).toEqual([]);
    expect(transport.writes.map((call) => [call.method, call.url.searchParams.get("current_sha256")])).toEqual([
      ["PATCH", "eq.remote-sha-0"], ["PATCH", "eq.remote-sha-1"],
    ]);
  });

  it("rejects invalid local housing without publishing or mutating the inputs", async () => {
    const base = housingProject();
    const local = structuredClone(base);
    invalidateHousing(local);
    const originals = [base, local].map(serialize);
    const transport = remoteTransport(base);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: base }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected candidate rejection");
    expect(result.error).toBeInstanceOf(ProjectFormatError);
    expect(transport.writes).toEqual([]);
    expect([base, local].map(serialize)).toEqual(originals);
    expect(transport.project).toEqual(base);
  });

  it.each(["malformed-map", "unsupported-version"] as const)("rejects %s remote data without writes", async (kind) => {
    const local = housingProject();
    const remote = structuredClone(local);
    invalidateHousing(remote);
    if (kind === "malformed-map") Object.assign(remote.maps.remote!, { width: "not-a-number" });
    else Object.assign(remote, { version: 999 });
    const original = serialize(remote);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: local }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected remote rejection");
    expect(result.error).toBeInstanceOf(ProjectFormatError);
    expect(transport.writes).toEqual([]);
    expect(serialize(transport.project)).toBe(original);
  });

  it("rejects a merged remote map whose tileset is missing from the intended local roots", async () => {
    const local = housingProject();
    const remote = structuredClone(local);
    const tileset = remote.tilesets[remote.maps.remote!.tilesetId]!;
    remote.tilesets.concurrent = { ...structuredClone(tileset), id: "concurrent" };
    remote.maps.remote!.tilesetId = "concurrent";
    invalidateHousing(remote);
    const original = serialize(remote);
    const transport = remoteTransport(remote);
    const pending = settled(saveProjectMapPatchToSupabase({ project: local, baseProject: local }, config));
    await releaseRead(transport);
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected merged-reference rejection");
    expect(result.error).toBeInstanceOf(ProjectFormatError);
    expect(transport.writes).toEqual([]);
    expect(serialize(transport.project)).toBe(original);
  });
});
