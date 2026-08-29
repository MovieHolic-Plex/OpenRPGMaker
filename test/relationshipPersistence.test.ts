import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { getRelationshipState, setRelationshipState } from "@/project/relationshipState";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveToSlot } from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

/* 이 스위트는 반드시 saveToSlot → readSaveSlot 을 지나야 한다. createSaveSnapshot 을
   applySaveSnapshot 에 바로 넘기면 알려진 필드만 고르는 JSON 파서를 건너뛰어서,
   네 경계 중 파서만 빠뜨린 결함을 잡지 못한다. */
describe("관계 상태 세이브 왕복", () => {
  it("네 경계를 모두 지나 살아남는다", () => {
    const project = createBlankProject();
    const storage = new MemoryStorage();
    const session = startSession(project);
    setRelationshipState(session, "npc_ha", "engaged");
    setRelationshipState(session, "npc_yu", "married");

    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;

    const restored = applySaveSnapshot(project, read.snapshot);
    expect(getRelationshipState(restored, "npc_ha")).toBe("engaged");
    expect(getRelationshipState(restored, "npc_yu")).toBe("married");
  });

  it("관계가 없는 낡은 세이브는 관계 없음으로 열린다", () => {
    const project = createBlankProject();
    const storage = new MemoryStorage();
    const snapshot = createSaveSnapshot(project, startSession(project));
    const legacy = {
      ...snapshot,
      session: Object.fromEntries(
        Object.entries(snapshot.session).filter(([key]) => key !== "relationships")
      ),
    } as typeof snapshot;
    expect("relationships" in legacy.session).toBe(false);

    saveToSlot(storage, 2, legacy);
    const read = readSaveSlot(storage, 2);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;

    const restored = applySaveSnapshot(project, read.snapshot);
    expect(getRelationshipState(restored, "npc_ha")).toBe("single");
  });

  it("열거 밖 값이 든 세이브는 그 항목만 버린다", () => {
    const project = createBlankProject();
    const storage = new MemoryStorage();
    const snapshot = createSaveSnapshot(project, startSession(project));
    const hostile = {
      ...snapshot,
      session: { ...snapshot.session, relationships: { npc_ha: "maried", npc_yu: "dating" } },
    } as unknown as typeof snapshot;

    saveToSlot(storage, 3, hostile);
    const read = readSaveSlot(storage, 3);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;

    const restored = applySaveSnapshot(project, read.snapshot);
    expect(getRelationshipState(restored, "npc_ha")).toBe("single");
    expect(getRelationshipState(restored, "npc_yu")).toBe("dating");
  });
});
