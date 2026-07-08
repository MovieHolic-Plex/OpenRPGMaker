import { describe, it, expect } from "vitest";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { createBlankProject } from "@/project/defaults";
import type { PlaySession } from "@/project/session";

function mkSession(): PlaySession {
  return {
    switches: {},
    selfSwitches: {},
    variables: {},
    timers: {},
    gold: 0,
    inventory: {},
    partyActorIds: [],
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
    currentMapId: "m1",
    x: 0,
    y: 0,
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

describe("세이브/로드 — 화면 색조/날씨 복원", () => {
  it("tint/weather/tintDurationMs 가 스냅샷에 저장되고 로드 후 복원된다", () => {
    const project = createBlankProject();
    const session = mkSession();
    const screen = ensureM2Runtime(session).screen;
    screen.tint = "128,64,32";
    screen.tintDurationMs = 800;
    screen.weather = "rain,5";

    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.screen).toEqual({
      tint: "128,64,32",
      weather: "rain,5",
      hidden: undefined,
      tintDurationMs: 800,
    });

    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.m2Runtime?.screen.tint).toBe("128,64,32");
    expect(restored.m2Runtime?.screen.weather).toBe("rain,5");
    expect(restored.m2Runtime?.screen.tintDurationMs).toBe(800);
  });

  it("화면 효과가 없으면 screen 을 생략한다", () => {
    const project = createBlankProject();
    const snapshot = createSaveSnapshot(project, mkSession());
    expect(snapshot.session.screen).toBeUndefined();
  });

  it("픽처의 트윈 필드(scale/opacity)도 저장/복원된다", () => {
    const project = createBlankProject();
    const session = mkSession();
    session.pictures = {
      pic1: { pictureId: "pic1", resourceId: "hero", x: 3, y: 4, scale: 150, opacity: 200 },
    };
    const snapshot = createSaveSnapshot(project, session);
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.pictures.pic1).toMatchObject({ scale: 150, opacity: 200, x: 3, y: 4 });
  });

  it("액터 그래픽, 파라미터 보정, 상태 이상 세션 필드를 저장/복원한다", () => {
    const project = createBlankProject();
    const session = mkSession();
    session.actorCharacterResourceIds = { actor_hero: "easyrpg-charset-actor2" };
    session.actorParamBonuses = { actor_hero: { maxHp: 20, attack: 4 } };
    session.actorStateIds = { actor_hero: ["state_poison"] };

    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const result = readSaveSlot(storage, 1);

    expect(result.kind).toBe("present");
    if (result.kind === "present") {
      const restored = applySaveSnapshot(project, result.snapshot);
      expect(restored.actorCharacterResourceIds).toEqual({ actor_hero: "easyrpg-charset-actor2" });
      expect(restored.actorParamBonuses).toEqual({ actor_hero: { maxHp: 20, attack: 4 } });
      expect(restored.actorStateIds).toEqual({ actor_hero: ["state_poison"] });
    }
  });

  it("storage 왕복(직렬화)에서도 화면 상태가 유지된다", () => {
    const project = createBlankProject();
    const session = mkSession();
    ensureM2Runtime(session).screen.weather = "snow,8";
    const storage = new MemoryStorage();
    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const result = readSaveSlot(storage, 1);
    expect(result.kind).toBe("present");
    if (result.kind === "present") {
      const restored = applySaveSnapshot(project, result.snapshot);
      expect(restored.m2Runtime?.screen.weather).toBe("snow,8");
    }
  });
});
