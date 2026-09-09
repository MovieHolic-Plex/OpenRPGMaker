import { afterEach, expect, it, vi } from "vitest";

// Characterize the transactional fixture's old setup before changing it. Only the
// vault and deterministic timer/storage boundary run; no DB, store or UI is mocked.
afterEach(async () => {
  const { _resetEventDraftVaultForTest } = await import("@/project/eventDraftVault");
  _resetEventDraftVaultForTest();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("an explicit legacy-project flush leaves a scheduled ephemeral namespace write pending", async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  const vault = await import("@/project/eventDraftVault");
  const pendingKey = vault.eventDraftVaultStorageKey();
  expect(pendingKey).toMatch(/^oprn:event-draft-vault:ephemeral:/);
  vault.rememberEventDraftVaultEntry("map-fixture", {
    id: "draft-event", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [], draft: { kind: "new" },
  });
  vault.persistEventDraftVaultNow("keep-project");
  const legacyKey = vault.eventDraftVaultStorageKey("keep-project");
  expect([...storage.keys()]).toEqual([legacyKey]);
  expect(vi.getTimerCount()).toBe(1);
  // Invoke the exact pending vault timer, not a real sleep or an arbitrary drain.
  vi.advanceTimersToNextTimer();
  expect([...storage.keys()]).toEqual([legacyKey, pendingKey]);
  const pendingValue = storage.get(pendingKey);
  const legacyValue = storage.get(legacyKey);
  if (pendingValue === undefined || legacyValue === undefined) {
    throw new Error("Expected both the scheduled namespace write and explicit legacy flush");
  }
  expect(JSON.parse(pendingValue).entries).toEqual(JSON.parse(legacyValue).entries);
  expect(vi.getTimerCount()).toBe(0);
});

it("a loaded backend/project namespace flushed by default cancels its pending write", async () => {
  vi.useFakeTimers();
  vi.resetModules();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  const vault = await import("@/project/eventDraftVault");
  vault.setEventDraftVaultProjectIdentity({ backend: "supabase:https://fixture.invalid:rpg_zzu", projectId: "keep-project" });
  vault.rememberEventDraftVaultEntry("map-fixture", {
    id: "draft-event", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [], draft: { kind: "new" },
  });
  expect(vi.getTimerCount()).toBe(1);
  vault.persistEventDraftVaultNow();
  expect(vi.getTimerCount()).toBe(0);
  expect([...storage.keys()]).toEqual([vault.eventDraftVaultStorageKey()]);
});
