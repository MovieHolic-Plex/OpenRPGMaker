import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { createSaveSnapshot, readSaveSlot, saveSlotKey } from "@/player/saveSlots";

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

/** 옛 세이브는 (시트 리소스 id, 셀 번호) 짝을 따로 들고 있었다. 얼굴이 낱장 파일이 된 뒤에도
 *  그 세이브를 열면 같은 얼굴이 보여야 한다 — 짝을 낱장 id 하나로 접어서 읽는다. */
function legacySlotPayload(faceMaps: {
  readonly ids: Record<string, string>;
  readonly indices?: Record<string, number>;
}): string {
  const project = createBlankProject();
  const session = startSession(project);
  const snapshot = createSaveSnapshot(project, session);
  const payload = JSON.parse(JSON.stringify(snapshot)) as {
    session: Record<string, unknown>;
  };
  payload.session.actorFaceResourceIds = faceMaps.ids;
  if (faceMaps.indices) payload.session.actorFaceIndices = faceMaps.indices;
  return JSON.stringify(payload);
}

describe("save slot legacy faceset payloads", () => {
  it("folds a legacy (sheet id, cell) pair into the per-face id", () => {
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), legacySlotPayload({
      ids: { actor_hero: "easyrpg-faceset-actor1", actor_second: "easyrpg-faceset-people1" },
      indices: { actor_hero: 7, actor_second: 15 },
    }));
    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.actorFaceResourceIds).toEqual({
      actor_hero: "easyrpg-faceset-actor1-07",
      actor_second: "easyrpg-faceset-people1-15",
    });
    expect(result.snapshot.session).not.toHaveProperty("actorFaceIndices");
  });

  it("clamps an out-of-range legacy cell instead of dropping the face", () => {
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), legacySlotPayload({
      ids: { actor_hero: "easyrpg-faceset-actor1" },
      indices: { actor_hero: 99 },
    }));
    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.actorFaceResourceIds).toEqual({
      actor_hero: "easyrpg-faceset-actor1-15",
    });
  });

  it("leaves an already-split per-face id untouched when no legacy cell map exists", () => {
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), legacySlotPayload({
      ids: { actor_hero: "easyrpg-faceset-actor1-03" },
    }));
    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.actorFaceResourceIds).toEqual({
      actor_hero: "easyrpg-faceset-actor1-03",
    });
  });
});
