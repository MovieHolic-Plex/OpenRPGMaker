import { describe, expect, it } from "vitest";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { resolveMapBackgroundLayers } from "@/player/playSceneMapBackground";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import type { PlaySceneContext } from "@/player/playSceneTypes";
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

function firstLayer(session: PlaySession, mapId: string, authoredImageId: string): string | undefined {
  const layers = resolveMapBackgroundLayers({
    map: { id: mapId, background: { imageId: authoredImageId } } as PlaySceneContext["map"],
    session,
  });
  return layers[0]?.imageId;
}

describe("세이브/로드 — 먼 배경 변경", () => {
  it("그 맵의 그림과 멈춘 흐름이 저장을 지나 다시 그려진다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const map = ensureM2Runtime(session).map;
    map.parallax_override = { mapId: project.startMapId, x: 0, y: 0, value: "sky-dusk" };
    map.parallax_flow = { mapId: project.startMapId, x: 0, y: 0, value: "0|1500" };
    map.encounter_rate = { mapId: "", x: 0, y: 0, value: "12" };
    map.tileset_override = { mapId: "", x: 0, y: 0, value: "other-town" };

    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const raw = storage.getItem(saveSlotKey(1)) ?? "";
    expect(raw).toContain("sky-dusk");
    expect(raw).toContain("0|1500");
    expect(raw).not.toContain("encounter_rate");
    expect(raw).not.toContain("tileset_override");

    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    expect(read.snapshot.session.mapBackground).toEqual({
      override: { mapId: project.startMapId, value: "sky-dusk" },
      flow: { mapId: project.startMapId, value: "0|1500" },
    });
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(restored.m2Runtime?.map.parallax_override).toEqual({ mapId: project.startMapId, x: 0, y: 0, value: "sky-dusk" });
    expect(restored.m2Runtime?.map.parallax_flow).toEqual({ mapId: project.startMapId, x: 0, y: 0, value: "0|1500" });
    expect(restored.m2Runtime?.map.encounter_rate).toBeUndefined();
    expect(firstLayer(restored, project.startMapId, "authored-sky")).toBe("sky-dusk");
    expect(firstLayer(restored, "other-map", "authored-sky")).toBe("authored-sky");
  });

  it("저작 속도와 빈 그림은 적지 않아 불러오면 맵 배경 그대로다", () => {
    const project = createBlankProject();
    const session = mkSession(project);
    const map = ensureM2Runtime(session).map;
    map.parallax_override = { mapId: project.startMapId, x: 0, y: 0, value: "  " };
    map.parallax_flow = { mapId: project.startMapId, x: 0, y: 0, value: "100|800" };

    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.mapBackground).toBeUndefined();
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.m2Runtime?.map.parallax_override).toBeUndefined();
    expect(restored.m2Runtime?.map.parallax_flow).toBeUndefined();
    expect(firstLayer(restored, project.startMapId, "authored-sky")).toBe("authored-sky");
  });

  it("필드가 없는 옛 세이브와 깨진 배경 기록은 슬롯을 손상으로 보지 않는다", () => {
    const project = createBlankProject();
    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, mkSession(project)))).toEqual({ ok: true });
    const key = saveSlotKey(1);
    const legacy = JSON.parse(storage.getItem(key) ?? "{}") as { session: Record<string, unknown> };
    delete legacy.session.mapBackground;
    legacy.session.mapBackground = {
      override: { mapId: "", value: "  legacy-sky  " },
      flow: { mapId: project.startMapId, value: "not-a-flow" },
      extra: true,
    };
    storage.setItem(key, JSON.stringify(legacy));

    const read = readSaveSlot(storage, 1);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    expect(read.snapshot.session.mapBackground).toEqual({ override: { mapId: "", value: "legacy-sky" } });
    const restored = applySaveSnapshot(project, read.snapshot);
    expect(firstLayer(restored, "anywhere", "authored-sky")).toBe("legacy-sky");
    expect(restored.m2Runtime?.map.parallax_flow).toBeUndefined();

    legacy.session.mapBackground = "nope";
    storage.setItem(key, JSON.stringify(legacy));
    const dropped = readSaveSlot(storage, 1);
    expect(dropped.kind).toBe("present");
    if (dropped.kind !== "present") return;
    expect(dropped.snapshot.session.mapBackground).toBeUndefined();
    expect(firstLayer(applySaveSnapshot(project, dropped.snapshot), project.startMapId, "authored-sky")).toBe("authored-sky");
  });
});
