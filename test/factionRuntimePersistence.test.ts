import { describe, expect, it } from "vitest";
import { resolveHostileTarget } from "@/battle/action/factionTargeting";
import {
  adjustEffectiveFactionStance,
  effectiveFactionStance,
  factionStancePairKey,
} from "@/project/factionRuntime";
import { PLAYER_FACTION_ID, resolveFactionTable } from "@/project/factions";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readSaveSlot,
  saveSlotKey,
} from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

describe("faction runtime persistence", () => {
  it("round-trips the sparse overlay through the known-field parser", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "경비병" }], relations: [] };
    const session = startSession(project);
    const table = resolveFactionTable(project.factions);
    session.factionStanceOverrides = adjustEffectiveFactionStance(
      table,
      session.factionStanceOverrides,
      "guard",
      PLAYER_FACTION_ID,
      -1,
    );
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(createSaveSnapshot(project, session)));

    const loaded = readSaveSlot(storage, 1);
    expect(loaded.kind).toBe("present");
    if (loaded.kind !== "present") throw new Error("expected present save");
    const restored = applySaveSnapshot(project, loaded.snapshot);
    expect(restored.factionStanceOverrides).toEqual(session.factionStanceOverrides);
  });

  it("discards overlay keys for factions that no longer exist", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "옛 경비대" }], relations: [] };
    const session = startSession(project);
    session.factionStanceOverrides = adjustEffectiveFactionStance(
      resolveFactionTable(project.factions),
      session.factionStanceOverrides,
      "guard",
      PLAYER_FACTION_ID,
      -2,
    );
    const snapshot = createSaveSnapshot(project, session);

    project.factions = { defs: [], relations: [] };
    const restored = applySaveSnapshot(project, snapshot);

    expect(restored.factionStanceOverrides).toEqual({});
  });

  it("inherits an overlay when a faction id is deliberately reused", () => {
    const project = createBlankProject();
    project.factions = { defs: [{ id: "guard", name: "옛 경비대" }], relations: [] };
    const session = startSession(project);
    session.factionStanceOverrides = adjustEffectiveFactionStance(
      resolveFactionTable(project.factions),
      session.factionStanceOverrides,
      "guard",
      PLAYER_FACTION_ID,
      -2,
    );
    const snapshot = createSaveSnapshot(project, session);

    project.factions = { defs: [{ id: "guard", name: "새 경비대" }], relations: [] };
    const restored = applySaveSnapshot(project, snapshot);

    // killedFieldSpawns·switches와 같은 세션 규칙: id가 정체성이므로 같은 id를 재사용하면 상태를 이어받는다.
    expect(effectiveFactionStance(
      resolveFactionTable(project.factions),
      restored.factionStanceOverrides,
      "guard",
      PLAYER_FACTION_ID,
    )).toBe(-2);
  });

  it("loads old snapshots without an overlay through the known-field parser", () => {
    const project = createBlankProject();
    const snapshot = createSaveSnapshot(project, startSession(project));
    const legacy = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
    delete (legacy.session as { factionStanceOverrides?: unknown }).factionStanceOverrides;
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(2), JSON.stringify(legacy));

    const loaded = readSaveSlot(storage, 2);
    expect(loaded.kind).toBe("present");
    if (loaded.kind !== "present") throw new Error("expected present legacy save");
    expect(applySaveSnapshot(project, loaded.snapshot).factionStanceOverrides).toEqual({});
  });
});

describe("mid-session targeting", () => {
  it("flips an existing NPC target decision after the shared overlay changes", () => {
    const table = resolveFactionTable({
      defs: [{ id: "guard", name: "경비병" }],
      relations: [],
    });
    const self = { id: "guard_1", factionId: "guard", x: 0, y: 0 };
    const player = { id: "player", factionId: PLAYER_FACTION_ID, x: 0, y: 1 };
    const overrides: Record<string, number> = {};
    expect(resolveHostileTarget({ self, candidates: [self, player], table, stanceOverrides: overrides, aggroRange: 3 })).toBeNull();

    Object.assign(overrides, adjustEffectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID, -1));

    expect(effectiveFactionStance(table, overrides, "guard", PLAYER_FACTION_ID)).toBe(-1);
    expect(resolveHostileTarget({ self, candidates: [self, player], table, stanceOverrides: overrides, aggroRange: 3 })?.id).toBe("player");
    expect(overrides[factionStancePairKey("guard", PLAYER_FACTION_ID)]).toBe(-1);
  });
});
