import { describe, expect, it } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { createBlankProject } from "@/project/defaults";
import { startSession, type PlaySession } from "@/project/session";
import type { Command, M2CommandFields, Project } from "@/project/types";

function m2(title: string, fields: M2CommandFields = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title && candidate.index <= 97);
  if (!entry) throw new Error(`missing M2 catalog entry for ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function drain(project: Project, session: PlaySession, commands: Command[]): void {
  const interpreter = createInterpreter(commands, session, project);
  let step = interpreter.start();
  for (let guard = 0; step.kind !== "done"; guard += 1) {
    if (guard > 8) throw new Error(`interpreter stuck at ${step.kind}`);
    step = interpreter.resume(undefined);
  }
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

describe("세이브/로드 — 기억한 BGM", () => {
  it("기억한 곡은 지금 나오는 곡과 따로 저장되고, 불러온 뒤 재생된다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.audio.bgm = { resourceId: "field-theme", loop: true };
    drain(project, session, [m2("Memorize Current BGM")]);
    session.audio.bgm = { resourceId: "battle-theme", loop: true };

    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const saved = readSaveSlot(storage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
    expect(saved.snapshot.session.memorizedBgm).toBe("field-theme");
    expect(saved.snapshot.session.audio.bgm).toEqual({ resourceId: "battle-theme", loop: true });

    const restored = applySaveSnapshot(project, saved.snapshot);
    expect(restored.m2Runtime?.audio?.memorizedBgm).toBe("field-theme");
    expect(restored.audio.bgm).toEqual({ resourceId: "battle-theme", loop: true });
    const replay = createInterpreter([m2("Play Memorized BGM")], restored, project).start();
    expect(replay).toMatchObject({ kind: "playAudio", resourceId: "field-theme", loop: true, channel: "bgm" });
  });

  it("기억한 음량 0과 페이드 0은 세이브를 건너도 재생 스텝에 남는다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.audio.bgm = { resourceId: "field-theme", loop: true, volume: 0, fadeInMs: 0 };
    drain(project, session, [m2("Memorize Current BGM")]);
    session.audio.bgm = { resourceId: "battle-theme", loop: true, volume: 80, fadeInMs: 400 };

    const storage = new MemoryStorage();
    expect(saveToSlot(storage, 1, createSaveSnapshot(project, session))).toEqual({ ok: true });
    const saved = readSaveSlot(storage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
    expect(saved.snapshot.session.memorizedBgm).toBe("field-theme");
    expect(saved.snapshot.session.memorizedBgmVolume).toBe(0);
    expect(saved.snapshot.session.memorizedBgmFadeInMs).toBe(0);

    const restored = applySaveSnapshot(project, saved.snapshot);
    expect(restored.m2Runtime?.audio?.memorizedBgmVolume).toBe(0);
    expect(restored.m2Runtime?.audio?.memorizedBgmFadeInMs).toBe(0);
    const replay = createInterpreter([m2("Play Memorized BGM")], restored, project).start();
    expect(replay).toEqual({ kind: "playAudio", resourceId: "field-theme", loop: true, channel: "bgm", volume: 0, fadeInMs: 0 });
    expect(restored.audio.bgm).toEqual({ resourceId: "field-theme", loop: true, volume: 0, fadeInMs: 0 });
  });

  it("깨진 기억 음량은 곡 id 를 남긴 채 그 칸만 버린다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    session.audio.bgm = { resourceId: "field-theme", loop: true, volume: 40, fadeInMs: 250 };
    drain(project, session, [m2("Memorize Current BGM")]);
    const raw = JSON.parse(JSON.stringify(createSaveSnapshot(project, session))) as {
      session: { memorizedBgmVolume?: unknown; memorizedBgmFadeInMs?: unknown; gold: number };
    };
    raw.session.memorizedBgmVolume = "loud";
    raw.session.memorizedBgmFadeInMs = -1;
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(raw));

    const saved = readSaveSlot(storage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}: ${saved.kind === "corrupt" ? saved.message : ""}`);
    expect(saved.snapshot.session.memorizedBgm).toBe("field-theme");
    expect(saved.snapshot.session.memorizedBgmVolume).toBeUndefined();
    expect(saved.snapshot.session.memorizedBgmFadeInMs).toBeUndefined();
    const restored = applySaveSnapshot(project, saved.snapshot);
    const replay = createInterpreter([m2("Play Memorized BGM")], restored, project).start();
    expect(replay).toEqual({ kind: "playAudio", resourceId: "field-theme", loop: true, channel: "bgm" });
  });

  it("기억한 곡이 없으면 칸을 만들지 않고, 재생은 요청을 내지 않는다", () => {
    const project = createBlankProject();
    const session = startSession(project);
    drain(project, session, [m2("Memorize Current BGM")]);

    const snapshot = createSaveSnapshot(project, session);
    expect(snapshot.session.memorizedBgm).toBeUndefined();
    const restored = applySaveSnapshot(project, snapshot);
    expect(restored.m2Runtime?.audio?.memorizedBgm).toBeUndefined();
    expect(createInterpreter([m2("Play Memorized BGM")], restored, project).start()).toEqual({ kind: "done" });
  });

  it.each([
    ["숫자", 12],
    ["빈 칸", "   "],
    ["너무 긴 id", "x".repeat(1025)],
  ])("깨진 기억 칸(%s)은 버리고 나머지 세이브는 읽는다", (_label, memorizedBgm) => {
    const project = createBlankProject();
    const session = startSession(project);
    session.gold = 7;
    session.audio.bgm = { resourceId: "field-theme", loop: true };
    drain(project, session, [m2("Memorize Current BGM")]);
    const raw = JSON.parse(JSON.stringify(createSaveSnapshot(project, session))) as { session: { memorizedBgm?: unknown; gold: number } };
    raw.session.memorizedBgm = memorizedBgm;
    const storage = new MemoryStorage();
    storage.setItem(saveSlotKey(1), JSON.stringify(raw));

    const saved = readSaveSlot(storage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}: ${saved.kind === "corrupt" ? saved.message : ""}`);
    expect(saved.snapshot.session.memorizedBgm).toBeUndefined();
    expect(saved.snapshot.session.gold).toBe(7);
    const restored = applySaveSnapshot(project, saved.snapshot);
    expect(restored.gold).toBe(7);
    expect(restored.m2Runtime?.audio?.memorizedBgm).toBeUndefined();
    expect(createInterpreter([m2("Play Memorized BGM")], restored, project).start()).toEqual({ kind: "done" });
  });
});
