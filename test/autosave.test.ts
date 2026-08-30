import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTOSAVE_DEBOUNCE_MS,
  maybeAutosave,
  performAutosave,
  resetAutosaveDebounce,
  shouldAutosave,
} from "@/player/autosave";
import {
  applySaveSnapshot,
  autosaveKey,
  createSaveSnapshot,
  readAutosave,
  readSaveSlot,
  saveSlotKey,
  saveToSlot,
  setSaveSlotStorageNamespace,
} from "@/player/saveSlots";
import { beginCutsceneControl } from "@/player/cutsceneControl";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import { SCHEMA_VERSION, type Project } from "@/project/types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function projectAndSession(): { project: Project; session: PlaySession } {
  const project = createBlankProject();
  const session = startSession(project);
  return { project, session };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetAutosaveDebounce();
  setSaveSlotStorageNamespace(null);
});

describe("autosave policy (shouldAutosave)", () => {
  it("saves by default with no prior autosave", () => {
    const { session } = projectAndSession();
    expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(true);
  });

  it("respects Change Save Access: m2Runtime.access.save === false skips", () => {
    const { session } = projectAndSession();
    ensureM2Runtime(session).access.save = false;
    expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(false);
    expect(shouldAutosave(session, "battleVictory", null, 10_000)).toBe(false);
  });

  it("disables autosave when the current map has disableSave", () => {
    const { project, session } = projectAndSession();
    project.maps[session.currentMapId]!.disableSave = true;
    expect(shouldAutosave(session, "transfer", null, 10_000, project)).toBe(false);
    expect(shouldAutosave(session, "battleVictory", null, 10_000, project)).toBe(false);
  });

  it("skips during cutscene input lock", () => {
    const { session } = projectAndSession();
    beginCutsceneControl(session, "cutscene-1", false);
    expect(shouldAutosave(session, "transfer", null, 10_000)).toBe(false);
  });

  it("debounces 5 seconds since the last autosave", () => {
    const { session } = projectAndSession();
    const last = 100_000;
    expect(shouldAutosave(session, "transfer", last, last + AUTOSAVE_DEBOUNCE_MS - 1)).toBe(false);
    expect(shouldAutosave(session, "transfer", last, last + AUTOSAVE_DEBOUNCE_MS)).toBe(true);
    // 트리거 종류가 달라도 디바운스는 공유된다.
    expect(shouldAutosave(session, "battleVictory", last, last + 1_000)).toBe(false);
  });
});

describe("performAutosave / round trip", () => {
  it("writes savedBy=auto with the trigger and round-trips through readAutosave into an identical session", () => {
    const { project, session } = projectAndSession();
    session.gold = 777;
    session.variables["v1"] = 42;
    session.x = 5;
    session.y = 6;
    const storage = new MemoryStorage();

    const written = performAutosave(project, session, storage, "battleVictory");
    expect(written).not.toBeNull();
    expect(written?.savedBy).toBe("auto");
    expect(written?.autosaveTrigger).toBe("battleVictory");

    const result = readAutosave(storage);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") throw new Error("expected present autosave");
    expect(result.snapshot.savedBy).toBe("auto");
    expect(result.snapshot.autosaveTrigger).toBe("battleVictory");

    const restored = applySaveSnapshot(project, result.snapshot);
    expect(restored.gold).toBe(777);
    expect(restored.variables["v1"]).toBe(42);
    expect(restored.x).toBe(5);
    expect(restored.y).toBe(6);
    expect(restored.currentMapId).toBe(session.currentMapId);
  });

  it("keeps the autosave key fully separate from the 3 manual slots (namespace included)", () => {
    expect(autosaveKey()).toBe("oprn:save-slot:auto");
    for (const slot of [1, 2, 3] as const) expect(autosaveKey()).not.toBe(saveSlotKey(slot));
    setSaveSlotStorageNamespace("proj-x");
    expect(autosaveKey()).toBe("proj-x:save-slot:auto");
    expect(saveSlotKey(1)).toBe("proj-x:save-slot:1");
  });

  it("does not touch manual slots when autosaving", () => {
    const { project, session } = projectAndSession();
    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const before = storage.getItem(saveSlotKey(1));
    performAutosave(project, session, storage, "transfer");
    expect(storage.getItem(saveSlotKey(1))).toBe(before);
    expect(readSaveSlot(storage, 1).kind).toBe("present");
  });

  it("swallows quota failures: warn only, returns null, nothing thrown", () => {
    const { project, session } = projectAndSession();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const storage = new MemoryStorage();
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    expect(performAutosave(project, session, storage, "transfer")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(readAutosave(storage).kind).toBe("empty");
  });
});

describe("maybeAutosave (PlayScene hook wrapper)", () => {
  it("no-ops without throwing when localStorage is unavailable (headless safety)", () => {
    vi.stubGlobal("localStorage", undefined);
    const { project, session } = projectAndSession();
    expect(maybeAutosave(project, session, "transfer")).toBe(false);
  });

  it("writes once then debounces, and saves again after the window", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const { project, session } = projectAndSession();
    resetAutosaveDebounce();

    expect(maybeAutosave(project, session, "transfer", 50_000)).toBe(true);
    expect(readAutosave(storage).kind).toBe("present");
    expect(maybeAutosave(project, session, "battleVictory", 51_000)).toBe(false);
    expect(maybeAutosave(project, session, "battleVictory", 50_000 + AUTOSAVE_DEBOUNCE_MS)).toBe(true);

    const result = readAutosave(storage);
    if (result.kind !== "present") throw new Error("expected present autosave");
    expect(result.snapshot.autosaveTrigger).toBe("battleVictory");
  });

  it("does not consume the debounce window when the write fails", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });
    const { project, session } = projectAndSession();
    resetAutosaveDebounce();

    expect(maybeAutosave(project, session, "transfer", 10_000)).toBe(false);
    setItem.mockRestore();
    // 실패는 lastAutosaveAtMs 를 갱신하지 않으므로 바로 다음 기회에 다시 시도된다.
    expect(maybeAutosave(project, session, "transfer", 10_001)).toBe(true);
  });
});

describe("manual slot schemaVersion compatibility (regression)", () => {
  it("preserves persistent runtime progression through the real storage loader", () => {
    // Break caught: adding a PlaySession field without wiring the save type, writer,
    // known-field parser, and restorer silently resets player progress after reload.
    const { project, session } = projectAndSession();
    project.database.lifeSkills = [
      { id: "skill_farming", name: "농사", skillType: "farming", maxLevel: 10, levelUpRewards: [] },
    ];
    session.actorBattleCommands = { actor_hero: ["cmd_item"] };
    session.lifeSkills = { skill_farming: { xp: 100, level: 2 } };
    session.actorNicknames = { actor_hero: "별명" };
    session.actorFaceResourceIds = { actor_hero: "face_custom" };
    session.shopLoyaltySpend = { shop_1: 500 };
    session.shopTradeCounts = { shop_1: { sold: 2, bought: 1 } };
    session.shopMileagePoints = 42;
    session.shopPawnTickets = {
      ticket_1: { itemId: "item_bomb", pawnPrice: 25, dueDayKey: "1:spring:3" },
    };
    session.shopLastRestockDayKey = { shop_1: "1:spring:3" };
    ensureM2Runtime(session).access.save = false;
    const storage = new MemoryStorage();

    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const loaded = readSaveSlot(storage, 1);

    expect(loaded.kind).toBe("present");
    if (loaded.kind !== "present") throw new Error("expected present slot");
    const restored = applySaveSnapshot(project, loaded.snapshot);
    expect(restored.actorBattleCommands).toEqual(session.actorBattleCommands);
    expect(restored.lifeSkills).toEqual(session.lifeSkills);
    expect(restored.actorNicknames).toEqual(session.actorNicknames);
    expect(restored.actorFaceResourceIds).toEqual(session.actorFaceResourceIds);
    expect(restored.shopLoyaltySpend).toEqual(session.shopLoyaltySpend);
    expect(restored.shopTradeCounts).toEqual(session.shopTradeCounts);
    expect(restored.shopMileagePoints).toBe(42);
    expect(restored.shopPawnTickets).toEqual(session.shopPawnTickets);
    expect(restored.shopLastRestockDayKey).toEqual(session.shopLastRestockDayKey);
    expect(restored.m2Runtime?.access?.save).toBe(false);
  });

  it("parses a pre-autosave manual snapshot JSON (no savedBy/autosaveTrigger) as present", () => {
    const { project, session } = projectAndSession();
    const snapshot = createSaveSnapshot(project, session);
    // 구 스냅샷 시뮬레이션: 새 optional 필드가 아예 없는 JSON.
    const legacy = JSON.parse(JSON.stringify(snapshot)) as Record<string, unknown>;
    delete legacy.savedBy;
    delete legacy.autosaveTrigger;
    expect(legacy.schemaVersion).toBe(SCHEMA_VERSION);

    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(2), JSON.stringify(legacy));
    const result = readSaveSlot(storage, 2);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") throw new Error("expected present slot");
    expect(result.snapshot.savedBy).toBeUndefined();
    expect(result.snapshot.autosaveTrigger).toBeUndefined();
  });

  it("ignores unknown savedBy/autosaveTrigger values instead of corrupting the slot", () => {
    const { project, session } = projectAndSession();
    const snapshot = createSaveSnapshot(project, session) as unknown as Record<string, unknown>;
    snapshot.savedBy = "cloud";
    snapshot.autosaveTrigger = "meteor";
    const storage = new MemoryStorage();
    storage.setItem(autosaveKey(), JSON.stringify(snapshot));
    const result = readAutosave(storage);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") throw new Error("expected present autosave");
    expect(result.snapshot.savedBy).toBeUndefined();
    expect(result.snapshot.autosaveTrigger).toBeUndefined();
  });

  it("reports empty/corrupt autosave results distinctly", () => {
    const storage = new MemoryStorage();
    expect(readAutosave(storage)).toEqual({ kind: "empty" });
    storage.setItem(autosaveKey(), "{broken json");
    expect(readAutosave(storage).kind).toBe("corrupt");
    storage.setItem(autosaveKey(), JSON.stringify({ schemaVersion: 999 }));
    expect(readAutosave(storage)).toEqual({ kind: "corrupt", message: "Unsupported save schema" });
  });
});
