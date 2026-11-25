import { describe, expect, it, afterEach } from "vitest";
import { preparePublication, forkPublication, upgradePublication } from "@/project/publication";
import { createGameRelease, verifyGameRelease, createRuntimeManifest } from "@/project/gameRelease";
import { writeStoredZip } from "@/project/packageZip";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { startSession } from "@/project/session";
import * as saves from "@/player/saveSlots";
import { isolateTimers } from "./mergedTeardown";

describe("gameRelease", () => {
  isolateTimers();
  const bytes = (value: string) => new TextEncoder().encode(value);
  async function fixture() {
    const runtimeEntries = [
      { name: "web/player.html", bytes: bytes('<script src="./player.js"></script>') },
      { name: "web/player.js", bytes: bytes("trusted executable") },
      { name: "web/sdk-manifest.json", bytes: bytes("sdk") },
      { name: "standalone/standalone.js", bytes: bytes("trusted standalone") },
      { name: "standalone/standalone.css", bytes: bytes("body{}") },
      { name: "public/assets/runtime.png", bytes: bytes("retained image") },
    ];
    const runtime = await createRuntimeManifest(runtimeEntries);
    const publication = preparePublication(runtime.runtimeTarget);
    const project = { version: 4, meta: { publication } };
    const entries = runtimeEntries.filter(entry => entry.name.startsWith("web/") || entry.name.startsWith("public/"))
      .map(entry => ({ ...entry, name: entry.name.replace(/^(web|public)\//, "") }));
    entries.push({ name: "project.json", bytes: bytes(JSON.stringify(project, null, 2) + "\n") });
    return { runtime, publication, entries };
  }
  describe("content-addressed game release", () => {
    it("binds exact project, SDK, runtime and assets to a trusted target", async () => {
      const { runtime, publication, entries } = await fixture();
      const release = await createGameRelease({ publication, entries });
      const verified = await verifyGameRelease(new Uint8Array(await release.blob.arrayBuffer()), runtime);
      expect(verified.manifest.releaseId).toBe(release.manifest.releaseId);
      expect(verified.entries.get("project.json")).toEqual(entries.at(-1)?.bytes);
      expect(verified.manifest.files.some(file => file.path === "release.json")).toBe(false);
    });
    it.each(["tamper", "duplicate", "traversal", "missing", "undeclared"])("rejects %s payloads", async (kind) => {
      const { runtime, publication, entries } = await fixture();
      const release = await createGameRelease({ publication, entries });
      const altered = [...entries, { name: "release.json", bytes: bytes(JSON.stringify(release.manifest)) }];
      switch (kind) {
        case "tamper": altered[1] = { name: "player.js", bytes: bytes("evil") }; break;
        case "duplicate": altered.push(entries[0]); break;
        case "traversal": altered.push({ name: "../evil", bytes: bytes("evil") }); break;
        case "missing": altered.shift(); break;
        case "undeclared": altered.push({ name: "extra", bytes: bytes("extra") }); break;
      }
      const zip = new Uint8Array(await writeStoredZip(altered).arrayBuffer());
      await expect(verifyGameRelease(zip, runtime)).rejects.toThrow();
    });
    it("rejects self-consistent attacker executable hashes against operator trust", async () => {
      const { runtime, publication, entries } = await fixture();
      entries[1] = { name: "player.js", bytes: bytes("evil") };
      const release = await createGameRelease({ publication, entries });
      await expect(verifyGameRelease(new Uint8Array(await release.blob.arrayBuffer()), runtime)).rejects.toThrow();
    });
    it("rejects an unavailable or different runtime, never substituting latest", async () => {
      const { runtime, publication, entries } = await fixture();
      const release = await createGameRelease({ publication, entries });
      const zip = new Uint8Array(await release.blob.arrayBuffer());
      await expect(verifyGameRelease(zip, undefined)).rejects.toThrow();
      await expect(verifyGameRelease(zip, { ...runtime, runtimeTarget: "b".repeat(64) })).rejects.toThrow();
    });
  });
});

describe("publication", () => {
  isolateTimers();
  const target = "a".repeat(64);
  describe("explicit publication identity", () => {
    it("keeps legacy reads identity-free", () => {
      const project = deserialize(serialize(createBlankProject()));
      expect(project.meta.publication).toBeUndefined();
    });
    it("preserves identity through rename and package round-trip", async () => {
      const project = createBlankProject();
      project.meta.publication = preparePublication(target);
      project.meta.title = "renamed";
      const result = await readProjectPackage(createProjectPackage(project));
      expect(result.meta.publication).toEqual(project.meta.publication);
    });
    it("upgrades only the draft and starts an isolated lineage", () => {
      const original = preparePublication(target);
      const before = structuredClone(original);
      const upgraded = upgradePublication(original, "b".repeat(64));
      expect(upgraded.gameId).toBe(original.gameId);
      expect(upgraded.saveCompatibilityId).not.toBe(original.saveCompatibilityId);
      expect(upgraded.acceptedSaveCompatibilityIds).toEqual([]);
      expect(original).toEqual(before);
    });
    it("forks game and save identity", () => {
      const original = preparePublication(target);
      const fork = forkPublication(original);
      expect(fork.gameId).not.toBe(original.gameId);
      expect(fork.saveCompatibilityId).not.toBe(original.saveCompatibilityId);
    });
    it("rejects malformed identity instead of repairing it", () => {
      const raw = JSON.parse(serialize(createBlankProject()));
      raw.meta.publication = { gameId: "x" };
      expect(() => deserialize(JSON.stringify(raw))).toThrow();
    });
  });
});

describe("publicationSaves", () => {
  isolateTimers();
  class MemoryStorage implements Storage {
    private readonly values = new Map<string, string>();
    readonly reads: string[] = [];
    get length() { return this.values.size; }
    clear() { this.values.clear(); }
    key(index: number) { return [...this.values.keys()][index] ?? null; }
    getItem(key: string) { this.reads.push(key); return this.values.get(key) ?? null; }
    setItem(key: string, value: string) { this.values.set(key, value); }
    removeItem(key: string) { this.values.delete(key); }
  }
  function fixture() {
    const project = createBlankProject();
    project.meta.publication = preparePublication("a".repeat(64));
    const session = startSession(project, 12);
    session.gold = 41;
    return { project, session, storage: new MemoryStorage() };
  }
  afterEach(() => { saves.setSavePublication(undefined); saves.setSaveSlotStorageNamespace(null); });
  describe("identity-bearing saves", () => {
    it("keeps standalone identity stable across title and filename namespaces", () => {
      const { project, session, storage } = fixture();
      saves.setSavePublication(project.meta.publication);
      const key = saves.saveSlotKey(1);
      project.meta.title = "Renamed standalone";
      saves.setSaveSlotStorageNamespace("renamed-file.html");
      const snapshot = saves.createSaveSnapshot(project, session);
      saves.saveToSlot(storage, 1, snapshot);
      expect(snapshot.schemaVersion).toBe(6);
      expect(saves.saveSlotKey(1)).toBe(key);
      expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "present", snapshot: { identity: {
        gameId: project.meta.publication?.gameId,
      } } });
    });
    it("isolates identical public identities in two community listings, including autosaves and imports", () => {
      const { project, session, storage } = fixture();
      saves.setSavePublication(project.meta.publication, "listing-a");
      const snapshot = saves.createSaveSnapshot(project, session);
      saves.saveToSlot(storage, 1, snapshot);
      saves.writeAutosave(storage, snapshot);
      const manual = saves.saveSlotKey(1), auto = saves.autosaveKey();
      const originalManual = storage.getItem(manual), originalAuto = storage.getItem(auto);
      saves.setSavePublication(project.meta.publication, "listing-b");
      expect(saves.saveSlotKey(1)).not.toBe(manual);
      expect(saves.autosaveKey()).not.toBe(auto);
      expect(saves.readSaveSlot(storage, 1).kind).toBe("empty");
      expect(saves.readAutosave(storage).kind).toBe("empty");
      expect(saves.saveToSlot(storage, 2, snapshot).ok).toBe(false);
      expect(() => saves.writeAutosave(storage, snapshot)).toThrow();
      storage.setItem(saves.saveSlotKey(2), JSON.stringify(snapshot));
      expect(saves.readSaveSlot(storage, 2).kind).toBe("corrupt");
      storage.removeItem(saves.saveSlotKey(2));
      storage.setItem(saves.autosaveKey(), JSON.stringify(snapshot));
      expect(saves.readAutosave(storage).kind).toBe("corrupt");
      storage.removeItem(saves.autosaveKey());
      expect(() => saves.applySaveSnapshot(project, snapshot)).toThrow();
      storage.reads.length = 0;
      expect(() => saves.importSaveCopy({ project, storage, sourceKey: manual, slot: 2 })).toThrow();
      expect(() => saves.importSaveCopy({ project, storage, sourceKey: auto, slot: 2 })).toThrow();
      expect(storage.reads).not.toContain(manual);
      expect(storage.reads).not.toContain(auto);
      session.gold = 999;
      const other = saves.createSaveSnapshot(project, session);
      saves.saveToSlot(storage, 1, other);
      saves.writeAutosave(storage, other);
      expect(storage.getItem(manual)).toBe(originalManual);
      expect(storage.getItem(auto)).toBe(originalAuto);
      saves.setSavePublication(project.meta.publication, "listing-a");
      expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "present", snapshot: { session: { gold: 41 } } });
      expect(saves.readAutosave(storage)).toMatchObject({ kind: "present", snapshot: { session: { gold: 41 } } });
    });
    it("copies a player-selected foreign file only into an empty slot and preserves compatibility checks", () => {
      const { project, session, storage } = fixture();
      const original = project.meta.publication;
      if (!original) throw new Error("fixture publication missing");
      saves.setSavePublication(original, "listing-a");
      const raw = JSON.stringify(saves.createSaveSnapshot(project, session), null, 2);
      const sourceKey = saves.saveSlotKey(1); storage.setItem(sourceKey, raw);
      project.meta.publication = { ...upgradePublication(original, "b".repeat(64)), acceptedSaveCompatibilityIds: [original.saveCompatibilityId] };
      saves.setSavePublication(project.meta.publication, "listing-b");
      saves.importSelectedSaveFileCopy({ project, storage, text: raw, slot: 1 });
      expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "present", snapshot: {
        identity: { isolationScope: "listing-b", saveCompatibilityId: project.meta.publication.saveCompatibilityId }, session: { gold: 41 },
      } });
      expect(storage.getItem(sourceKey)).toBe(raw);
      const copy = storage.getItem(saves.saveSlotKey(1));
      expect(() => saves.importSelectedSaveFileCopy({ project, storage, text: raw, slot: 1 })).toThrow();
      expect(storage.getItem(saves.saveSlotKey(1))).toBe(copy);
      project.meta.publication = forkPublication(original);
      saves.setSavePublication(project.meta.publication, "listing-c");
      expect(() => saves.importSelectedSaveFileCopy({ project, storage, text: raw, slot: 1 })).toThrow();
      project.meta.publication = upgradePublication(original, "b".repeat(64));
      saves.setSavePublication(project.meta.publication, "listing-c");
      expect(() => saves.importSelectedSaveFileCopy({ project, storage, text: raw, slot: 1 })).toThrow();
      expect(saves.readSaveSlot(storage, 1).kind).toBe("empty");
      // A standalone destination explicitly adopts a selected scoped file without retaining its host scope.
      project.meta.publication = original; saves.setSavePublication(original);
      saves.importSelectedSaveFileCopy({ project, storage, text: raw, slot: 1 });
      const standalone = saves.readSaveSlot(storage, 1);
      expect(standalone).toMatchObject({ kind: "present", snapshot: { session: { gold: 41 } } });
      if (standalone.kind !== "present") throw new Error("Missing copy");
      expect(standalone.snapshot.identity?.isolationScope).toBeUndefined();
      expect(saves.applySaveSnapshot(project, standalone.snapshot).gold).toBe(41);
    });
    it("rejects other games and unaccepted lineages before applying", () => {
      const { project, session } = fixture();
      const snapshot = saves.createSaveSnapshot(project, session);
      const publication = project.meta.publication;
      if (!publication) throw new Error("fixture publication missing");
      project.meta.publication = forkPublication(publication);
      expect(() => saves.applySaveSnapshot(project, snapshot)).toThrow();
      project.meta.publication = upgradePublication(publication, "b".repeat(64));
      expect(() => saves.applySaveSnapshot(project, snapshot)).toThrow();
      expect(session.gold).toBe(41);
    });
    it("explicitly copies an accepted predecessor without changing its bytes", () => {
      const { project, session, storage } = fixture();
      const predecessor = project.meta.publication;
      if (!predecessor) throw new Error("fixture publication missing");
      saves.setSavePublication(predecessor);
      const oldKey = saves.saveSlotKey(1);
      const raw = JSON.stringify(saves.createSaveSnapshot(project, session), null, 2);
      storage.setItem(oldKey, raw);
      project.meta.publication = { ...upgradePublication(predecessor, "b".repeat(64)),
        acceptedSaveCompatibilityIds: [predecessor.saveCompatibilityId] };
      saves.setSavePublication(project.meta.publication);
      expect(saves.readSaveSlot(storage, 1).kind).toBe("empty");
      saves.importSaveCopy({ project, storage, sourceKey: oldKey, slot: 1 });
      expect(storage.getItem(oldKey)).toBe(raw);
      expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "present", snapshot: {
        identity: { saveCompatibilityId: project.meta.publication.saveCompatibilityId }, session: { gold: 41 },
      } });
    });
    it("requires explicit legacy adoption and preserves state on failed import", () => {
      const { project, session, storage } = fixture();
      const publication = project.meta.publication;
      if (!publication) throw new Error("fixture publication missing");
      delete project.meta.publication;
      const raw = JSON.stringify(saves.createSaveSnapshot(project, session));
      storage.setItem("chosen-legacy", raw);
      project.meta.publication = publication;
      saves.setSavePublication(publication);
      expect(() => saves.importSaveCopy({ project, storage, sourceKey: "chosen-legacy", slot: 1 })).toThrow();
      expect(storage.length).toBe(1);
      saves.importSaveCopy({ project, storage, sourceKey: "chosen-legacy", slot: 1, adoptLegacy: true });
      expect(storage.getItem("chosen-legacy")).toBe(raw);
      expect(session.gold).toBe(41);
    });
  });
});
