import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import {
  applySaveSnapshot,
  createSaveSnapshot,
  createSystemShellState,
  getSaveSlotStatus,
  listSaveSlots,
  reduceSystemShell,
  readSaveSlot,
  saveSlotKey,
  saveToSlot,
} from "@/player/saveSlots";
import {
  clearAudioState,
  erasePictureState,
  setAudioState,
  showPictureState,
  startSession,
} from "@/project/session";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("T12 save slots", () => {
  it("roundtrips runtime location, switches, variables, audio, pictures, and battle result", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const storage = new MemoryStorage();
    session.currentMapId = project.startMapId;
    session.x = 3;
    session.y = 4;
    session.switches.sw_gate = true;
    session.variables.var_score = 17;
    session.battleResult = "victory";
    setAudioState(session, { channel: "bgm", resourceId: "bgm_theme", loop: true });
    showPictureState(session, { pictureId: "pic_1", resourceId: "picture_gate", x: 16, y: 24 });

    saveToSlot(storage, 1, createSaveSnapshot(project, session));
    const loaded = readSaveSlot(storage, 1);
    expect(loaded.kind).toBe("present");
    if (loaded.kind !== "present") throw new Error("expected present save slot");
    const restored = applySaveSnapshot(project, loaded.snapshot);

    expect(restored.currentMapId).toBe(project.startMapId);
    expect(restored.x).toBe(3);
    expect(restored.y).toBe(4);
    expect(restored.switches.sw_gate).toBe(true);
    expect(restored.variables.var_score).toBe(17);
    expect(restored.battleResult).toBe("victory");
    expect(restored.audio.bgm?.resourceId).toBe("bgm_theme");
    expect(restored.pictures.pic_1?.resourceId).toBe("picture_gate");
  });

  it("isolates a corrupt slot while keeping another slot loadable", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const storage = new MemoryStorage();
    storage.setItem("rpg-zzu:save-slot:1", "{not-json");
    session.variables.var_score = 2;
    saveToSlot(storage, 2, createSaveSnapshot(project, session));

    const slots = listSaveSlots(storage);

    expect(getSaveSlotStatus(slots, 1).kind).toBe("corrupt");
    expect(getSaveSlotStatus(slots, 2).kind).toBe("present");
  });

  it("treats malformed audio state as a corrupt slot while keeping another slot loadable", () => {
    const project = createBlankProject();
    const session = startSession(project);
    const storage = new MemoryStorage();
    const malformedAudioSlot = {
      schemaVersion: 3,
      projectTitle: "T12 corrupt audio",
      savedAt: "2026-06-19T00:00:00.000Z",
      session: {
        switches: {},
        variables: {},
        timers: {},
        currentMapId: project.startMapId,
        x: 0,
        y: 0,
        mapOverrides: {},
        flags: {},
        audio: { bgm: { resourceId: 42, loop: true } },
        pictures: {},
      },
    };

    storage.setItem(saveSlotKey(1), JSON.stringify(malformedAudioSlot));
    session.variables.var_score = 2;
    saveToSlot(storage, 2, createSaveSnapshot(project, session));

    const slots = listSaveSlots(storage);

    expect(getSaveSlotStatus(slots, 1).kind).toBe("corrupt");
    expect(getSaveSlotStatus(slots, 2).kind).toBe("present");
  });
});

describe("T12 shell state", () => {
  it("models title, load, main menu, game over, and return-title transitions", () => {
    let state = createSystemShellState("title");

    state = reduceSystemShell(state, { kind: "open-load" });
    expect(state.screen).toBe("load");

    state = reduceSystemShell(state, { kind: "start-new-game" });
    expect(state.screen).toBe("play");

    state = reduceSystemShell(state, { kind: "open-menu" });
    expect(state.screen).toBe("main-menu");

    state = reduceSystemShell(state, { kind: "game-over" });
    expect(state.screen).toBe("game-over");

    state = reduceSystemShell(state, { kind: "return-title" });
    expect(state.screen).toBe("title");
  });
});

describe("T12 audio and picture session state", () => {
  it("tracks browser-safe audio command state without requiring playback", () => {
    const session = startSession(createBlankProject());

    setAudioState(session, { channel: "bgm", resourceId: "bgm_theme", loop: true });
    setAudioState(session, { channel: "se", resourceId: "se_cursor", loop: false });
    clearAudioState(session);

    expect(session.audio.bgm).toBeUndefined();
    expect(session.audio.se).toBeUndefined();
  });

  it("persists picture state until an erase command removes that picture id", () => {
    const session = startSession(createBlankProject());

    showPictureState(session, { pictureId: "pic_1", resourceId: "picture_gate", x: 16, y: 24 });
    showPictureState(session, { pictureId: "pic_2", resourceId: "picture_badge", x: 48, y: 64 });
    erasePictureState(session, "pic_1");

    expect(session.pictures.pic_1).toBeUndefined();
    expect(session.pictures.pic_2?.resourceId).toBe("picture_badge");
  });
});
