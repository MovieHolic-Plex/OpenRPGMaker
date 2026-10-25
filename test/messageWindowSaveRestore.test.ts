import { describe, expect, it } from "vitest";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_MESSAGE_WINDOW_SETTINGS, type PlaySession } from "@/project/session";

function mkSession(project = createBlankProject()): PlaySession {
  return {
    switches: {},
    selfSwitches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
    monsterInstances: {},
    monsterParty: [],
    monsterBox: [],
    classOverrides: {},
    actorSkillIds: {},
    actorExperience: {},
    actorLevels: {},
    actorVitals: {},
    eventLocations: {},
    erasedEventIds: [],
    npcTravelStates: {},
    followers: [],
    followerTrail: [],
    actorEquipment: {},
    actorRows: {},
    currentMapId: project.startMapId,
    x: project.startPos.x,
    y: project.startPos.y,
    lighting: { ambient: 0, sources: [] },
    mapOverrides: {},
    flags: {},
    audio: {},
    pictures: {},
    playTimeSeconds: 0,
  };
}

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

const pinnedWindow = {
  format: "transparent" as const,
  position: "top" as const,
  preventObscuringPlayer: false,
  allowEventMovementDuringWait: true,
};

describe("세이브/로드 — 문장 표시 설정", () => {
  it("기본 대사창은 세이브에 적지 않고, 불러오면 기본 창이다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    session.messageWindowSettings = { ...DEFAULT_MESSAGE_WINDOW_SETTINGS };

    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.messageWindowSettings).toBeUndefined();

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.messageWindowSettings).toEqual(DEFAULT_MESSAGE_WINDOW_SETTINGS);
  });

  it("바꿔 둔 대사창은 슬롯을 다시 읽어도 그대로다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    session.messageWindowSettings = pinnedWindow;

    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;

    expect(result.snapshot.session.messageWindowSettings).toEqual(pinnedWindow);
    expect(applySaveSnapshot(project, result.snapshot).messageWindowSettings).toEqual(pinnedWindow);
  });

  it("가림 방지만 끈 창도 저장된다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    session.messageWindowSettings = { ...DEFAULT_MESSAGE_WINDOW_SETTINGS, preventObscuringPlayer: false };

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.messageWindowSettings).toEqual({
      ...DEFAULT_MESSAGE_WINDOW_SETTINGS,
      preventObscuringPlayer: false,
    });
  });

  it("깨진 대사창 칸은 슬롯 전체를 손상으로 보지 않고 기본 창으로 불러온다", () => {
    const project = createBlankProject();
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, mkSession(project)))).toEqual({ ok: true });
    const key = saveSlotKey(1);
    const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: Record<string, unknown> };
    raw.session.messageWindowSettings = { format: "nope", position: "top", preventObscuringPlayer: false };
    storage.setItem(key, JSON.stringify(raw));

    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.messageWindowSettings).toBeUndefined();
    expect(applySaveSnapshot(project, result.snapshot).messageWindowSettings).toEqual(DEFAULT_MESSAGE_WINDOW_SETTINGS);
  });
});
