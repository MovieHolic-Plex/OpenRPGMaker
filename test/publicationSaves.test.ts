import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { preparePublication, upgradePublication, forkPublication } from "@/project/publication";
import * as saves from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  getItem(key: string) { return this.values.get(key) ?? null; }
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
  it("writes Save6 and ignores host/title namespaces", () => {
    const { project, session, storage } = fixture();
    saves.setSavePublication(project.meta.publication);
    const key = saves.saveSlotKey(1);
    saves.setSaveSlotStorageNamespace("different-host");
    const snapshot = saves.createSaveSnapshot(project, session);
    saves.saveToSlot(storage, 1, snapshot);
    expect(snapshot.schemaVersion).toBe(6);
    expect(saves.saveSlotKey(1)).toBe(key);
    expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "present", snapshot: { identity: {
      gameId: project.meta.publication?.gameId,
    } } });
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
