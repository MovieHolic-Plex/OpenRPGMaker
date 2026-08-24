import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  readSaveSlot,
  saveToSlot,
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

describe("custom season save compatibility", () => {
  it("preserves day 40 through wire parsing and applies the current project calendar", () => {
    const project = createBlankProject();
    project.system.timeSystem = { enabled: true, daysPerSeason: 40, dayStartHour: 6, dayEndHour: 26 };
    const session = startSession(project, 41);
    session.gameTime = { minute: 30, hour: 18, day: 40, season: "spring", year: 2 };
    session.farmPlotsAdvancedThrough = { day: 40, season: "spring", year: 2 };

    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    expect(read.snapshot.session.gameTime?.day).toBe(40);
    expect(read.snapshot.session.farmPlotsAdvancedThrough?.day).toBe(40);
    expect(applySaveSnapshot(project, read.snapshot).gameTime).toEqual(session.gameTime);

    project.system.timeSystem = { ...project.system.timeSystem, daysPerSeason: 28 };
    const restoredUnderShorterCalendar = applySaveSnapshot(project, read.snapshot);
    expect(restoredUnderShorterCalendar.gameTime?.day).toBe(28);
    expect(restoredUnderShorterCalendar.farmPlotsAdvancedThrough?.day).toBe(28);
  });
});
