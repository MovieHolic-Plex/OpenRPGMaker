import { describe, expect, it } from "vitest";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("세이브/로드 — 알아낸 약점", () => {
  it("흡수(음수 배율)가 있어도 약점 장부가 슬롯을 왕복한다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.gold = 40;
    session.knownWeaknesses = {
      wolf: { "element:fire": -0.5, "type:physical": 0.5 },
      slime: { "element:fire": 2 },
      ghost: { "type:magic": 0 },
    };

    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const saved = readSaveSlot(storage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
    expect(saved.snapshot.session.knownWeaknesses).toEqual(session.knownWeaknesses);

    const restored = applySaveSnapshot(project, saved.snapshot);
    expect(restored.knownWeaknesses).toEqual(session.knownWeaknesses);
    expect(restored.gold).toBe(40);
  });

  it("깨진 약점 칸은 장부만 버리고 나머지 세이브는 읽는다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.gold = 9;
    session.knownWeaknesses = { slime: { "element:fire": 2 } };
    const raw = JSON.parse(JSON.stringify(createSaveSnapshot(project, session))) as {
      session: { knownWeaknesses: { slime: Record<string, unknown> }; gold: number };
    };
    raw.session.knownWeaknesses.slime["element:fire"] = "no";
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(raw));

    const saved = readSaveSlot(storage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}: ${saved.kind === "corrupt" ? saved.message : ""}`);
    expect(saved.snapshot.session.knownWeaknesses).toBeUndefined();
    expect(saved.snapshot.session.gold).toBe(9);
    expect(applySaveSnapshot(project, saved.snapshot).gold).toBe(9);
  });
});
