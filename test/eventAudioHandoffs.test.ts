/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openEventCommandPicker } from "@/editor/panels/eventEditor/commandPicker";
import { getAudioEngine, playAudioCommand, resumeAudioState } from "@/player/audio";
import { enterBattleAudio, exitBattleAudio, playAuthoredBattleResultCue } from "@/player/battleAudio";
import { createInterpreter } from "@/player/interpreter";
import { runCommands } from "@/player/playSceneInterpreter";
import { applyNonBlockingStep } from "@/player/playSceneSchedulers";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { createSaveSnapshot, applySaveSnapshot, saveToSlot, readSaveSlot } from "@/player/saveSlots";
import { startMapBgm } from "@/player/mapBgm";
import { M2_COMMAND_CATALOG } from "@/project/eventCommands/m2Catalog";
import { deserialize, serialize } from "@/project/io";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import type { Command, M2CommandFields } from "@/project/types";
import { buildContractProject } from "./commandContracts/harness";

const FIELD = "cc0-bgm-rtp-fld-002";
const BATTLE = "cc0-bgm-rtp-btl-002";
const SE = "easyrpg-sound-decision1";
const OTHER_SE = "easyrpg-sound-cancel1";
const originalProject = store.getCurrent();

function m2(title: string, fields: M2CommandFields = {}): Command {
  const entry = M2_COMMAND_CATALOG.find((candidate) => candidate.title === title);
  if (!entry) throw new Error(`Missing command: ${title}`);
  return { kind: "m2Command", commandId: entry.id, fields };
}

function setup(commands: Command[] = []) {
  const project = buildContractProject(commands);
  store.replaceProject(project);
  const session = startSession(project, 3);
  const dialogue = {
    showText: vi.fn(async () => undefined), showChoices: vi.fn(async () => 0),
    showNumberInput: vi.fn(async () => 0), hide: vi.fn(), close: vi.fn(),
  };
  // Only non-audio scene surfaces are stubbed; interpreter, scheduler, resolver and engine are real.
  const scene = {
    session, running: false, inputEnabled: true, lastActionTargetKey: "", tileY: 0,
    map: project.maps[project.startMapId],
    game: { registry: { get: (key: string) => key === "dialogue" ? dialogue : undefined } },
    setInputEnabled: vi.fn(), refreshRuntimeSurfaces: vi.fn(), syncRuntimeState: vi.fn(),
    showRuntimeOverlay: vi.fn(), clearRuntimeOverlay: vi.fn(),
  } as unknown as PlaySceneContext;
  return { project, session, scene };
}

function audioElements(): HTMLAudioElement[] {
  return [...document.querySelectorAll<HTMLAudioElement>("audio[data-oprn-audio]")];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  const engine = getAudioEngine();
  engine.stopAll();
  engine.unlock();
  engine.setFadeInMs(600);
  engine.setVolume("bgm", 0.7);
  engine.setVolume("se", 0.8);
});

afterEach(() => {
  getAudioEngine().stopAll();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  localStorage.clear();
  store.replaceProject(originalProject);
});

describe("U14 actual audio handoffs", () => {
  it.each(["blocking", "parallel"] as const)("delivers ambient gain and explicit zero fade through %s execution", async (path) => {
    const { scene, session } = setup();
    const command = m2("Sound Layer", { channel: "ambient", resourceId: FIELD, volume: 25, fadeMs: 0 });
    if (path === "blocking") await runCommands(scene, [command]);
    else applyNonBlockingStep(scene, createInterpreter([command], session).start());
    const audio = audioElements();
    expect(audio).toHaveLength(1);
    expect(audio[0]?.loop).toBe(true);
    expect(audio[0]?.volume).toBeCloseTo(0.7 * 0.25);
    expect(getAudioEngine().getFadeInMs()).toBe(0);
    expect(session.audio.bgs?.resourceId).toBe(FIELD);
    expect(session.audio.bgm).toBeUndefined();
  });

  it("keeps per-track gain when the group volume changes and the same track is requested again", async () => {
    const { scene } = setup();
    await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 25, fadeMs: 0 })]);
    getAudioEngine().setVolume("bgm", 0.4);
    expect(audioElements()[0]?.volume).toBeCloseTo(0.1);
    await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 50, fadeMs: 0 })]);
    expect(audioElements()).toHaveLength(1);
    expect(audioElements()[0]?.volume).toBeCloseTo(0.2);
  });

  it.each(["command", "map"] as const)("resets omitted gain on the same track through %s and keeps save/resume consistent", async (path) => {
    const { scene, session, project } = setup();
    await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: 25, fadeMs: 0 })]);
    const element = audioElements()[0];
    expect(element?.volume).toBeCloseTo(0.175);

    if (path === "command") await runCommands(scene, [{ kind: "playAudio", resourceId: FIELD, loop: true }]);
    else {
      project.system.defaultBgmResourceId = FIELD;
      startMapBgm(project, session, project.startMapId);
    }

    expect(audioElements()).toEqual([element]);
    expect(element?.volume).toBeCloseTo(0.7);
    expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: true });
    saveToSlot(localStorage, 1, createSaveSnapshot(project, session));
    const saved = readSaveSlot(localStorage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
    const restored = applySaveSnapshot(project, saved.snapshot);
    getAudioEngine().stopAll();
    resumeAudioState(restored.audio, project, { fadeInMs: 0 });
    expect(audioElements()[0]?.volume).toBeCloseTo(0.7);
  });

  it.each([
    { volume: 0.25, sameTrack: false }, { volume: 0, sameTrack: false },
    { volume: 0.25, sameTrack: true }, { volume: 0, sameTrack: true },
  ])("restores field gain $volume after battle (same track: $sameTrack)", async ({ volume, sameTrack }) => {
    const { scene, session, project } = setup();
    project.system.battleBgmResourceId = sameTrack ? FIELD : BATTLE;
    await runCommands(scene, [m2("Sound Layer", { channel: "bgm", resourceId: FIELD, volume: volume * 100, fadeMs: 0 })]);
    const before = { ...session.audio.bgm };
    const saved = enterBattleAudio(project, session);
    expect(audioElements().at(-1)?.volume).toBeCloseTo(sameTrack ? volume * 0.7 : 0.7);

    exitBattleAudio(project, session, saved);

    expect(session.audio.bgm).toEqual(before);
    expect(audioElements().at(-1)?.volume).toBeCloseTo(volume * 0.7);
  });

  it("preserves an explicit field loop flag through a battle handoff", () => {
    const { session, project } = setup();
    session.audio.bgm = { resourceId: FIELD, loop: false, volume: 0.25 };
    const saved = enterBattleAudio(project, session);
    const play = vi.spyOn(getAudioEngine(), "play");
    exitBattleAudio(project, session, saved);
    expect(session.audio.bgm).toEqual({ resourceId: FIELD, loop: false, volume: 0.25 });
    expect(play.mock.calls.at(-1)?.[0]).toBe("bgm");
    expect(play.mock.calls.at(-1)?.[3]).toBe(false);
  });

  it.each(["me", "se"] as const)("plays %s once with its own gain without changing BGM", async (channel) => {
    const { scene, project } = setup();
    playAudioCommand({ resourceId: FIELD, loop: true }, project, { fadeInMs: 0 });
    const field = audioElements()[0];
    await runCommands(scene, [m2("Sound Layer", { channel, resourceId: SE, volume: 50, fadeMs: 0 })]);
    expect(audioElements()[0]).toBe(field);
    expect(field?.volume).toBeCloseTo(0.7);
    expect(audioElements()[1]?.loop).toBe(false);
    expect(audioElements()[1]?.volume).toBeCloseTo((channel === "me" ? 0.7 : 0.8) * 0.5);
    getAudioEngine().setVolume(channel === "me" ? "bgm" : "se", 0.6);
    expect(audioElements()[1]?.volume).toBeCloseTo(0.3);
  });

  it("replays memorized BGM through the engine, not only the session record", async () => {
    const { scene } = setup();
    const play = vi.spyOn(getAudioEngine(), "play");
    await runCommands(scene, [
      { kind: "playAudio", resourceId: FIELD, loop: true }, m2("Memorize Current BGM"),
      { kind: "playAudio", resourceId: BATTLE, loop: true }, m2("Play Memorized BGM"),
    ]);
    expect(play.mock.calls.map(([channel, resource]) => [channel, resource])).toEqual([
      ["bgm", FIELD], ["bgm", BATTLE], ["bgm", FIELD],
    ]);
  });

  it("inserts the Fadeout BGM alias with its channel and preserves it through project export/import", () => {
    let selected: Command | undefined;
    openEventCommandPicker({ title: "Commands", context: "map", onSelect: (command) => { selected = command; } });
    const button = [...document.querySelectorAll<HTMLButtonElement>(".event-command-picker-command")]
      .find((candidate) => candidate.textContent?.includes("BGM 페이드아웃"));
    expect(button).toBeDefined();
    button?.click();
    expect(selected).toEqual({ kind: "stopAudio", channel: "bgm" });
    if (!selected) throw new Error("Picker did not insert a command");
    const project = buildContractProject([selected, { kind: "stopAudio" }]);
    const restored = deserialize(serialize(project));
    expect(restored.maps[restored.startMapId]?.events[0]?.commands).toEqual([selected, { kind: "stopAudio" }]);
  });

  it.each(["blocking", "parallel", "legacy"] as const)("stops only BGM through the %s path", async (path) => {
    const { scene, session } = setup();
    await runCommands(scene, [
      m2("Sound Layer", { channel: "bgm", resourceId: FIELD, fadeMs: 0 }),
      m2("Sound Layer", { channel: "ambient", resourceId: BATTLE, fadeMs: 0 }),
      m2("Sound Layer", { channel: "se", resourceId: SE }),
    ]);
    const stop = vi.spyOn(getAudioEngine(), "stopChannel");
    const stopAll = vi.spyOn(getAudioEngine(), "stopAll");
    if (path === "parallel") applyNonBlockingStep(scene, { kind: "stopAudio", channel: "bgm" });
    else await runCommands(scene, [path === "legacy" ? m2("Fadeout BGM") : { kind: "stopAudio", channel: "bgm" }]);
    expect(stop).toHaveBeenCalledWith("bgm");
    expect(stopAll).not.toHaveBeenCalled();
    expect(session.audio.bgm).toBeUndefined();
    expect(session.audio.bgs?.resourceId).toBe(BATTLE);
    expect(session.audio.se?.resourceId).toBe(SE);
  });

  it("persists system replacements through save-slot parsing and consumes them on map/battle entry", async () => {
    const { project, session, scene } = setup();
    await runCommands(scene, [m2("Change System BGM", { slot: "field", resourceId: FIELD }), m2("Change System BGM", { slot: "battle", resourceId: BATTLE })]);
    expect(saveToSlot(localStorage, 1, createSaveSnapshot(project, session)).ok).toBe(true);
    const saved = readSaveSlot(localStorage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
    const restored = applySaveSnapshot(project, saved.snapshot);
    const play = vi.spyOn(getAudioEngine(), "play");
    startMapBgm(project, restored, project.startMapId);
    enterBattleAudio(project, restored);
    expect(play.mock.calls.map(([, resource]) => resource)).toEqual([FIELD, BATTLE]);
    expect(startSession(project, 3).m2Runtime).toBeUndefined();
  });

  it("keeps battle result overrides session-owned even with overlapping battle lifetimes", async () => {
    const first = setup();
    const second = setup();
    await runCommands(first.scene, [m2("Change System SE", { slot: "defeat", resourceId: SE })]);
    await runCommands(second.scene, [m2("Change System SE", { slot: "defeat", resourceId: OTHER_SE })]);
    const saved = enterBattleAudio(first.project, first.session);
    enterBattleAudio(second.project, second.session);
    exitBattleAudio(first.project, first.session, saved);
    const play = vi.spyOn(getAudioEngine(), "play");
    playAuthoredBattleResultCue(first.project, "defeat", first.session);
    playAuthoredBattleResultCue(second.project, "defeat", second.session);
    expect(play.mock.calls.map(([channel, resource]) => [channel, resource])).toEqual([["se", SE], ["se", OTHER_SE]]);
  });

  it("restores a layer's gain through save parsing and engine resume", async () => {
    const { project, session, scene } = setup();
    await runCommands(scene, [m2("Sound Layer", { channel: "ambient", resourceId: FIELD, volume: 30, fadeMs: 0 })]);
    saveToSlot(localStorage, 1, createSaveSnapshot(project, session));
    const saved = readSaveSlot(localStorage, 1);
    if (saved.kind !== "present") throw new Error(`Save was ${saved.kind}`);
    const restored = applySaveSnapshot(project, saved.snapshot);
    getAudioEngine().stopAll();
    resumeAudioState(restored.audio, project, { fadeInMs: 0 });
    expect(audioElements()[0]?.volume).toBeCloseTo(0.21);
  });
});
