import { afterEach, describe, expect, it, vi } from "vitest";
import * as saves from "@/player/saveSlots";
import * as old from "./fixtures/life-full/saveSlots.phase1";
import { maybeAutosave, performAutosave, resetAutosaveDebounce } from "@/player/autosave";
import { getSessionCheckpoint, restoreSessionCheckpoint, saveSessionCheckpoint } from "@/player/checkpoints";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { SCHEMA_VERSION } from "@/project/types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function fixture() {
  const project = createBlankProject();
  const session = startSession(project, 205);
  session.gold = 17;
  session.variables.progress = 23;
  const storage = new MemoryStorage();
  const legacy = old.createSaveSnapshot(project, session);
  const raw = JSON.stringify(legacy, null, 2) + "\n";
  return { project, session, storage, legacy, raw };
}

afterEach(() => {
  saves.setSaveSlotStorageNamespace(null);
  old.setSaveSlotStorageNamespace(null);
  resetAutosaveDebounce();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Save5 version and original ownership boundary", () => {
  it("writes independent Save5 even without life packages, leaving Project4 and live state unchanged", () => {
    const { project, session } = fixture();
    const before = structuredClone(session);
    const snapshot = saves.createSaveSnapshot(project, session);
    expect(snapshot.schemaVersion).toBe(5);
    expect(SCHEMA_VERSION).toBe(4);
    expect(project.version).toBe(4);
    expect(saves.SAVE_SCHEMA_VERSION).toBe(5);
    expect(session).toEqual(before);
  });

  it.each([null, "  exported:game-a  "])("migrates manual and auto only in memory in namespace %j", (namespace) => {
    const { project, session, storage, raw } = fixture();
    saves.setSaveSlotStorageNamespace(namespace);
    old.setSaveSlotStorageNamespace(namespace);
    const prefix = namespace?.trim() ?? "oprn";
    storage.setItem(old.saveSlotKey(2), raw);
    storage.setItem(old.autosaveKey(), raw);
    const before = storage.length;
    const manual = saves.readSaveSlot(storage, 2);
    const auto = saves.readAutosave(storage);
    expect(storage.length).toBe(before);
    expect(manual.kind).toBe("present");
    expect(auto.kind).toBe("present");
    if (manual.kind !== "present" || auto.kind !== "present") throw new Error("Missing legacy save");
    expect(manual.snapshot.schemaVersion).toBe(5);
    expect(auto.snapshot.schemaVersion).toBe(5);
    expect(saves.applySaveSnapshot(project, manual.snapshot).variables.progress).toBe(23);
    session.gold = 89;
    expect(saves.saveToSlot(storage, 2, saves.createSaveSnapshot(project, session))).toEqual({ ok: true });
    expect(performAutosave(project, session, storage, "transfer")?.schemaVersion).toBe(5);
    expect(saves.saveSlotKey(2)).toBe(`${prefix}:save-slot:v5:2`);
    expect(saves.autosaveKey()).toBe(`${prefix}:save-slot:v5:auto`);
    expect(storage.getItem(old.saveSlotKey(2))).toBe(raw);
    expect(storage.getItem(old.autosaveKey())).toBe(raw);
    expect(saves.readSaveSlot(storage, 2)).toMatchObject({ kind: "present", snapshot: { session: { gold: 89 } } });
    expect(saves.readAutosave(storage)).toMatchObject({ kind: "present", snapshot: { session: { gold: 89 } } });
    expect(old.readSaveSlot(storage, 2)).toMatchObject({ kind: "present", snapshot: { session: { gold: 17 } } });
  });

  it("runs the frozen phase1 reader on actual old/new bytes, not a simulated version predicate", () => {
    const { project, session, storage, raw } = fixture();
    storage.setItem(old.saveSlotKey(1), raw);
    expect(old.readSaveSlot(storage, 1).kind).toBe("present");
    storage.setItem(old.saveSlotKey(1), JSON.stringify(saves.createSaveSnapshot(project, session)));
    expect(old.readSaveSlot(storage, 1)).toMatchObject({ kind: "corrupt", message: "Unsupported save schema" });
  });

  it.each([3, 6, 999, "5"])("rejects unsupported wire version %j without rewriting it", (schemaVersion) => {
    const { storage, legacy } = fixture();
    const raw = JSON.stringify({ ...legacy, schemaVersion });
    storage.setItem(saves.saveSlotKey(1), raw);
    storage.setItem(saves.autosaveKey(), raw);
    expect(saves.readSaveSlot(storage, 1)).toMatchObject({ kind: "corrupt", message: "Unsupported save schema" });
    expect(saves.readAutosave(storage)).toMatchObject({ kind: "corrupt", message: "Unsupported save schema" });
    expect(storage.getItem(saves.saveSlotKey(1))).toBe(raw);
    expect(storage.getItem(saves.autosaveKey())).toBe(raw);
  });

  it.each(["", "{broken", "null", '{"schemaVersion":5}', '{"schemaVersion":6}'])("never falls back from present malformed new bytes %j", (broken) => {
    const { storage, raw } = fixture();
    storage.setItem(old.saveSlotKey(1), raw);
    storage.setItem(old.autosaveKey(), raw);
    storage.setItem("oprn:save-slot:v5:1", broken);
    storage.setItem("oprn:save-slot:v5:auto", broken);
    expect(saves.readSaveSlot(storage, 1).kind).toBe("corrupt");
    expect(saves.readAutosave(storage).kind).toBe("corrupt");
    expect(storage.getItem(old.saveSlotKey(1))).toBe(raw);
    expect(storage.getItem(old.autosaveKey())).toBe(raw);
  });

  it("does not borrow another namespace's legacy progress", () => {
    const { storage, raw } = fixture();
    storage.setItem(old.saveSlotKey(1), raw);
    storage.setItem(old.autosaveKey(), raw);
    saves.setSaveSlotStorageNamespace("other-game");
    expect(saves.readSaveSlot(storage, 1).kind).toBe("empty");
    expect(saves.readAutosave(storage).kind).toBe("empty");
  });

  it.each([false, true])("preserves legacy bytes, previous new slot and live progress on quota (existing new=%j)", (hasNew) => {
    const { project, session, storage, raw } = fixture();
    storage.setItem(old.saveSlotKey(1), raw);
    storage.setItem(old.autosaveKey(), raw);
    if (hasNew) {
      saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, session));
      performAutosave(project, session, storage, "transfer");
    }
    const manualBefore = storage.getItem(saves.saveSlotKey(1));
    const autoBefore = storage.getItem(saves.autosaveKey());
    session.gold = 99;
    const before = structuredClone(session);
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    const warn = vi.spyOn(console, "warn");
    expect(saves.saveToSlot(storage, 1, saves.createSaveSnapshot(project, session)).ok).toBe(false);
    expect(performAutosave(project, session, storage, "transfer")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(session).toEqual(before);
    expect(storage.getItem(old.saveSlotKey(1))).toBe(raw);
    expect(storage.getItem(old.autosaveKey())).toBe(raw);
    expect(storage.getItem(saves.saveSlotKey(1))).toBe(manualBefore);
    expect(storage.getItem(saves.autosaveKey())).toBe(autoBefore);
  });

  it("characterizes construction failure: throws explicitly, preserves checkpoint and disk, does not debounce retry", () => {
    const { project, session, storage, raw } = fixture();
    storage.setItem(old.autosaveKey(), raw);
    const checkpoint = saveSessionCheckpoint(project, session);
    vi.stubGlobal("localStorage", storage);
    const clone = vi.spyOn(globalThis, "structuredClone").mockImplementation(() => { throw new DOMException("cannot clone", "DataCloneError"); });
    expect(() => maybeAutosave(project, session, "transfer", 10_000)).toThrow(DOMException);
    expect(() => saveSessionCheckpoint(project, session)).toThrow(DOMException);
    expect(getSessionCheckpoint(session)).toBe(checkpoint);
    expect(storage.getItem(old.autosaveKey())).toBe(raw);
    expect(storage.length).toBe(1);
    clone.mockRestore();
    expect(maybeAutosave(project, session, "transfer", 10_000)).toBe(true);
  });

  it("creates Save5 memory checkpoints and resumes an independent session without mutating the live one", () => {
    const { project, session } = fixture();
    const checkpoint = saveSessionCheckpoint(project, session);
    session.gold = 101;
    const restored = restoreSessionCheckpoint(project, session);
    expect(checkpoint.schemaVersion).toBe(5);
    expect(restored?.gold).toBe(17);
    expect(session.gold).toBe(101);
    expect(restored).not.toBe(session);
    if (!restored) throw new Error("Missing checkpoint");
    expect(getSessionCheckpoint(restored)).toBe(checkpoint);
  });
});
