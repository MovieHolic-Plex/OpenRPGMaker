/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInterpreter } from "@/player/interpreter";
import { enterBattleAudio, exitBattleAudio } from "@/player/battleAudio";
import { playBattleCue, type BattleJuiceEvent } from "@/player/battleJuice";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { getAudioEngine, playAudioCommand } from "@/player/audio";
import { applySaveSnapshot, createSaveSnapshot, readSaveSlot, saveSlotKey, saveToSlot } from "@/player/saveSlots";
import { createDefaultM2Fields, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { startSession, type PlaySession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, M2CommandFields, Project } from "@/project/types";
import { audioCommandRepairsProject } from "./fixtures/eventCommandAudioRepairs";

const ids = { bgm: "m2-027-change-system-bgm", se: "m2-028-change-system-se" } as const;
const elements: HTMLAudioElement[] = [];
// A fewer-argument implementation is assignable here, so RED exercises the
// approved optional-context API without missing imports or suppressed errors.
const sessionBattleCue: (event: BattleJuiceEvent, context: {
  readonly project: Project; readonly session: PlaySession;
}) => void = playBattleCue;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance"] });
  vi.stubGlobal("Audio", function PlatformAudio(src: string) {
    const element = document.createElement("audio");
    element.src = src;
    vi.spyOn(element, "play").mockResolvedValue();
    vi.spyOn(element, "pause").mockImplementation(() => {});
    elements.push(element);
    return element;
  });
  getAudioEngine().stopAll(false);
  getAudioEngine().setVolume("bgm", 0.7);
  getAudioEngine().setVolume("se", 0.8);
  getAudioEngine().setFadeInMs(0);
  getAudioEngine().unlock();
});

afterEach(() => {
  getAudioEngine().stopAll(false);
  window.sessionStorage.removeItem(saveSlotKey(1));
  document.body.replaceChildren();
  elements.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function fixture() {
  const project = audioCommandRepairsProject();
  const session = startSession(project, 12345);
  vi.spyOn(store, "getCurrent").mockReturnValue(project);
  return { project, session };
}

function execute(f: ReturnType<typeof fixture>, family: keyof typeof ids, fields: M2CommandFields) {
  const command: Command = { kind: "m2Command", commandId: ids[family], fields };
  expect(createInterpreter([command], f.session, f.project).start().kind).toBe("done");
}

function roundtrip(f: ReturnType<typeof fixture>) {
  expect(saveToSlot(window.sessionStorage, 1, createSaveSnapshot(f.project, f.session))).toEqual({ ok: true });
  const saved = readSaveSlot(window.sessionStorage, 1);
  if (saved.kind !== "present") throw new Error("Expected present save slot");
  return { snapshot: saved.snapshot, session: applySaveSnapshot(f.project, saved.snapshot) };
}

function media(project: Project, resourceId: string) {
  const asset = project.assets.uploaded[resourceId];
  if (!asset) throw new Error(`Missing PCM fixture: ${resourceId}`);
  const element = [...elements].reverse().find(candidate => candidate.src === asset.dataUrl);
  expect(element, `Media element for ${resourceId}`).toBeDefined();
  if (!element) throw new Error(`No playback for ${resourceId}`);
  return element;
}

function confirm(f: ReturnType<typeof fixture>) {
  const options = { event: "menu-confirm" as const, project: f.project, session: f.session };
  return emitRuntimeJuice(options);
}

describe("system audio cue selection and real consumers", () => {
  it("restores battle cue override through save slot", () => {
    const f = fixture();
    execute(f, "bgm", { cue: "battle", resourceId: "qa_bgm", volume: 37 });
    const restored = roundtrip(f);
    expect.soft(restored.snapshot.session).toMatchObject({
      systemAudioOverrides: { bgm: { battle: { resourceId: "qa_bgm", volume: 37 } } },
    });
    enterBattleAudio(f.project, restored.session);
    const audio = media(f.project, "qa_bgm");
    expect.soft(audio.loop).toBe(true);
    expect.soft(audio.volume).toBeCloseTo(0.259);
  });

  it("applies BGM gain even when the selected resource equals the project cue", () => {
    const f = fixture();
    f.project.system.battleBgmResourceId = "qa_bgm";
    execute(f, "bgm", { cue: "battle", resourceId: "qa_bgm", volume: 37 });
    enterBattleAudio(f.project, f.session);
    expect(media(f.project, "qa_bgm").volume).toBeCloseTo(0.259);
  });

  it("applies SE gain even when the selected resource equals the default confirm cue", () => {
    const f = fixture();
    execute(f, "se", { cue: "confirm", resourceId: "easyrpg-sound-decision1", volume: 23 });
    confirm(f);
    expect(elements.at(-1)?.volume).toBeCloseTo(0.184);
  });

  it.each([23, 0])("restores menu confirm cue with authored SE volume %s", volume => {
    const f = fixture();
    execute(f, "se", { cue: "confirm", resourceId: "qa_se", volume });
    const { session } = roundtrip(f);
    confirm({ project: f.project, session });
    const audio = media(f.project, "qa_se");
    expect.soft(audio.loop).toBe(false);
    expect(audio.volume).toBeCloseTo(volume === 23 ? 0.184 : 0);
  });

  it("plays selected victory music as a one-shot in the BGM mixer group", () => {
    const f = fixture();
    execute(f, "bgm", { cue: "victory", resourceId: "qa_bgm", volume: 37 });
    sessionBattleCue("victory", f);
    const audio = media(f.project, "qa_bgm");
    expect.soft(audio.loop).toBe(false);
    expect.soft(audio.volume).toBeCloseTo(0.259);
    getAudioEngine().setVolume("se", 0);
    expect.soft(audio.volume).toBeCloseTo(0.259);
    getAudioEngine().setVolume("bgm", 0.5);
    expect(audio.volume).toBeCloseTo(0.185);
  });

  it.each([
    ["cursor", "command-select"], ["confirm", "command-confirm"], ["cancel", "command-cancel"],
    ["attack", "attack-swing"], ["damage", "hit-damage"], ["critical", "hit-critical"],
    ["miss", "hit-miss"], ["heal", "hit-heal"], ["faint", "faint"],
    ["defend", "defend"], ["defeat", "defeat"], ["escape", "escape"],
  ] as const)("routes SE slot %s through the existing %s battle consumer", (cue, event) => {
    const f = fixture();
    execute(f, "se", { cue, resourceId: "qa_se", volume: 23 });
    sessionBattleCue(event, f);
    expect(media(f.project, "qa_se").volume).toBeCloseTo(0.184);
  });

  it.each([
    ["cursor", "menu-select"], ["confirm", "menu-open"], ["cancel", "menu-back"],
    ["cancel", "menu-close"], ["buzzer", "menu-invalid"],
  ] as const)("routes SE slot %s through the existing %s UI consumer", (cue, event) => {
    const f = fixture();
    execute(f, "se", { cue, resourceId: "qa_se", volume: 23 });
    const options = { event, project: f.project, session: f.session };
    emitRuntimeJuice(options);
    expect(media(f.project, "qa_se").volume).toBeCloseTo(0.184);
  });

  it("does not disturb BGS or ambient when changing or playing selected cues", () => {
    const f = fixture();
    const layers = {
      bgs: { resourceId: "qa_bgs", loop: true, volume: 41, fadeInMs: 0 },
      ambient: { resourceId: "qa_ambient", loop: true, volume: 29, fadeInMs: 0 },
    };
    f.session.audio = layers;
    for (const channel of ["bgs", "ambient"] as const) playAudioCommand({ ...layers[channel], channel }, f.project);
    const bgs = media(f.project, "qa_bgs"), ambient = media(f.project, "qa_ambient");
    const before = structuredClone(f.session.audio);
    execute(f, "bgm", { cue: "battle", resourceId: "qa_bgm", volume: 37 });
    execute(f, "se", { cue: "confirm", resourceId: "qa_se", volume: 23 });
    expect.soft(elements).toHaveLength(2);
    enterBattleAudio(f.project, f.session);
    confirm(f);
    expect.soft(media(f.project, "qa_se").volume).toBeCloseTo(0.184);
    expect.soft(media(f.project, "qa_bgs")).toBe(bgs);
    expect.soft(media(f.project, "qa_ambient")).toBe(ambient);
    expect.soft(bgs.volume).toBeCloseTo(0.287);
    expect.soft(ambient.volume).toBeCloseTo(0.203);
    expect.soft(bgs.pause).not.toHaveBeenCalled();
    expect.soft(ambient.pause).not.toHaveBeenCalled();
    expect(f.session.audio).toMatchObject(before);
  });

  it("restores complete field track gain and fade after leaving battle", () => {
    const f = fixture();
    const field = { resourceId: "qa_bgm", loop: true, volume: 61, fadeInMs: 0 };
    f.session.audio.bgm = field;
    playAudioCommand(field, f.project);
    const saved = enterBattleAudio(f.project, f.session);
    exitBattleAudio(f.project, f.session, saved);
    expect.soft(f.session.audio.bgm).toEqual(field);
    expect(media(f.project, "qa_bgm").volume).toBeCloseTo(0.427);
  });
});

describe("system cue defaults, silence, reset and legacy isolation", () => {
  it.each([["bgm", "battle"], ["se", "confirm"]] as const)("new %s authoring selects %s explicitly", (family, cue) => {
    const entry = m2CommandById(ids[family]);
    if (!entry) throw new Error("Missing existing system command");
    expect(createDefaultM2Fields(entry)).toMatchObject({ cue, operation: "set", resourceId: "", volume: 100 });
  });

  it.each(["bgm", "se"] as const)("keeps legacy cue-less %s inert while retaining resource precedence", family => {
    const f = fixture();
    execute(f, family, { resourceId: "", value: "qa_bgm", volume: 0 });
    expect.soft(f.session.m2Runtime?.system[`system_${family}`]).toBe("");
    expect.soft(f.session.m2Runtime?.system[`system_${family}_volume`]).toBe(0);
    expect.soft(Reflect.get(f.session, "systemAudioOverrides")).toBeUndefined();
    expect(elements).toHaveLength(0);
    execute(f, family, { value: "qa_se" });
    expect(f.session.m2Runtime?.system[`system_${family}`]).toBe("qa_se");
  });

  it.each(["battle", "victory", "confirm"] as const)("explicit empty %s suppresses default playback", cue => {
    const f = fixture();
    f.project.system.battleVictoryMeResourceId = "qa_bgs";
    const family = cue === "confirm" ? "se" : "bgm";
    execute(f, family, { cue, resourceId: "", value: "qa_bgm", volume: 100 });
    if (cue === "battle") enterBattleAudio(f.project, f.session);
    else if (cue === "victory") sessionBattleCue("victory", f);
    else confirm(f);
    expect(elements).toHaveLength(0);
    expect(f.session).toMatchObject({ systemAudioOverrides: { [family]: { [cue]: { resourceId: "", volume: 100 } } } });
  });

  it("reset restores default battle cue without deleting a separate SE override", () => {
    const f = fixture();
    execute(f, "bgm", { cue: "battle", resourceId: "qa_bgm", volume: 37 });
    execute(f, "se", { cue: "confirm", resourceId: "qa_se", volume: 23 });
    execute(f, "bgm", { cue: "battle", operation: "reset" });
    enterBattleAudio(f.project, f.session);
    expect.soft(f.session.audio.bgm?.resourceId).toBe(f.project.system.battleBgmResourceId);
    confirm(f);
    expect(media(f.project, "qa_se").volume).toBeCloseTo(0.184);
  });

  it.each([["bgm", "confirm"], ["se", "battle"], ["se", "unknown"]] as const)("rejects invalid %s cue %s without metadata mutation", (family, cue) => {
    const f = fixture();
    execute(f, family, { cue, resourceId: "qa_bgm", volume: 37 });
    expect.soft(Reflect.get(f.session, "systemAudioOverrides")).toBeUndefined();
    expect.soft(f.session.m2Runtime?.system).toEqual({});
    expect(elements).toHaveLength(0);
  });

  it.each(["old-save", "new-session"] as const)("does not leak an active override into %s", source => {
    const f = fixture();
    const old = createSaveSnapshot(f.project, f.session);
    execute(f, "se", { cue: "confirm", resourceId: "qa_se", volume: 23 });
    expect.soft(confirm(f).soundResourceId).toBe("qa_se");
    getAudioEngine().stopAll(false);
    elements.length = 0;
    const session = source === "old-save" ? applySaveSnapshot(f.project, old) : startSession(f.project, 456);
    expect.soft(Reflect.get(session, "systemAudioOverrides")).toBeUndefined();
    expect(confirm({ project: f.project, session }).soundResourceId).toBe("easyrpg-sound-decision1");
    expect(elements.some(audio => audio.src === f.project.assets.uploaded.qa_se?.dataUrl)).toBe(false);
  });
});

describe("system cue save boundary", () => {
  it.each([
    null, [], { bgm: { unknown: { resourceId: "qa_bgm", volume: 37 } } },
    { bgm: { confirm: { resourceId: "qa_bgm", volume: 37 } } },
    { se: { confirm: { resourceId: 12, volume: 23 } } },
    ...[-1, 101, "23", null].map(volume => ({ se: { confirm: { resourceId: "qa_se", volume } } })),
  ].map(value => ({ value })))("rejects malformed optional persisted overrides $value", ({ value: systemAudioOverrides }) => {
    const f = fixture();
    const snapshot = createSaveSnapshot(f.project, f.session);
    const malformed = { ...snapshot, session: { ...snapshot.session, systemAudioOverrides } };
    window.sessionStorage.setItem(saveSlotKey(1), JSON.stringify(malformed));
    expect(readSaveSlot(window.sessionStorage, 1).kind).toBe("corrupt");
  });
});
