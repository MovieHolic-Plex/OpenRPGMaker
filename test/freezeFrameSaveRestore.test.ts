import { describe, expect, it } from "vitest";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { createBlankProject } from "@/project/defaults";
import type { PlaySession } from "@/project/session";

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

describe("세이브/로드 — 정지 화면", () => {
  it("정지 화면이 없으면 화면 상태에 적지 않는다", () => {
    const project = createBlankProject();
    const snapshot = createSaveSnapshot(project, mkSession(project));
    expect(snapshot.session.screen).toBeUndefined();
  });

  it("색감·다시 찍기 횟수·전환 시간은 슬롯을 다시 읽어도 남고, 찍은 그림은 세이브에 없다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const screen = ensureM2Runtime(session).screen;
    screen.freeze = { style: "sepia", at: 2 };
    screen.freezeDurationMs = 400;

    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const stored = JSON.parse(storage.getItem(saveSlotKey(1)) ?? "{}") as {
      session: { screen: { freeze: Record<string, unknown> } };
    };
    expect(stored.session.screen.freeze).toEqual({ style: "sepia", at: 2 });

    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.screen).toMatchObject({
      freeze: { style: "sepia", at: 2 },
      freezeDurationMs: 400,
    });

    const restored = applySaveSnapshot(project, result.snapshot);
    expect(restored.m2Runtime?.screen.freeze).toEqual({ style: "sepia", at: 2 });
    expect(restored.m2Runtime?.screen.freezeDurationMs).toBe(400);
  });

  it("정지를 푼 뒤에는 세이브에 남지 않는다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const screen = ensureM2Runtime(session).screen;
    screen.freeze = { style: "warm", at: 1 };
    screen.freezeDurationMs = 200;
    delete screen.freeze;
    delete screen.freezeDurationMs;

    const restored = applySaveSnapshot(project, createSaveSnapshot(project, session));
    expect(restored.m2Runtime?.screen.freeze).toBeUndefined();
  });

  it("깨진 정지 화면 칸은 슬롯 전체를 손상으로 보지 않고, 같이 적힌 색조는 남긴다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    ensureM2Runtime(session).screen.tint = "128,64,32";
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const key = saveSlotKey(1);
    const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: { screen: Record<string, unknown> } };
    raw.session.screen.freeze = { style: "poster", at: 0, image: "data:image/png;base64,aaaa" };
    raw.session.screen.freezeDurationMs = -20;
    storage.setItem(key, JSON.stringify(raw));

    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.screen?.freeze).toBeUndefined();
    expect(result.snapshot.session.screen?.freezeDurationMs).toBeUndefined();
    expect(result.snapshot.session.screen?.tint).toBe("128,64,32");

    const restored = applySaveSnapshot(project, result.snapshot);
    expect(restored.m2Runtime?.screen.freeze).toBeUndefined();
    expect(restored.m2Runtime?.screen.tint).toBe("128,64,32");
  });

  it("전환 시간만 깨지면 정지 화면은 즉시(0ms)로 불러온다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    ensureM2Runtime(session).screen.freeze = { style: "mono", at: 1 };
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const key = saveSlotKey(1);
    const raw = JSON.parse(storage.getItem(key) ?? "{}") as { session: { screen: Record<string, unknown> } };
    raw.session.screen.freezeDurationMs = 9_999_999;
    storage.setItem(key, JSON.stringify(raw));

    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind !== "present") return;
    expect(result.snapshot.session.screen?.freeze).toEqual({ style: "mono", at: 1 });
    expect(result.snapshot.session.screen?.freezeDurationMs).toBeUndefined();
    expect(applySaveSnapshot(project, result.snapshot).m2Runtime?.screen.freezeDurationMs).toBe(0);
  });
});
