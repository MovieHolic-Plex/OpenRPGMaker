import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CC0_AUDIO_ASSETS } from "@/assets/cc0AudioAssets";
import {
  MONSTER_SFX_CUES,
  MONSTER_SFX_UI_CUE,
  monsterSfxPath,
  monsterSfxResourceId,
  monsterSfxRuntimeResourceIds,
  usesMonsterSfxSet,
} from "@/assets/monsterSfxAssets";
import { WEATHER_CONTINUE_LINES, WEATHER_END_LINES, WEATHER_START_LINES } from "@/battle/weather";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { createMonsterDialogueTick, monsterBattleCue, monsterTimelineCue } from "@/player/monsterSfx";
import { emitRuntimeJuice } from "@/player/runtimeJuice";
import { createBlankProject } from "@/project/defaults";
import { collectWebExportAssets } from "@/project/webExportAssets";

type Manifest = {
  readonly license: string;
  readonly sampleRate: number;
  readonly sounds: Record<string, {
    readonly file: string; readonly sha256: string; readonly gate: unknown; readonly model: string;
    readonly durationSeconds: number; readonly clippedSamples: number; readonly patch: { readonly voices: readonly unknown[] };
  }>;
};

const manifest = JSON.parse(readFileSync(resolve("public/assets/monster-sfx/manifest.json"), "utf8")) as Manifest;

function monsterProject() {
  const project = createBlankProject();
  project.system.monsterCollection = true;
  return project;
}

// Heavy under CI load (15s default is too tight): decodes the shipped OGG and builds blank projects.
describe("monster-collection default sound set", { timeout: 120_000 }, () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "Audio");
    vi.restoreAllMocks();
  });

  it("ships a decodable OGG, a CC0 registry row and a passing manifest entry for every cue", () => {
    expect(manifest.license).toBe("CC0-1.0");
    expect(manifest.sampleRate).toBe(44100);
    for (const cue of MONSTER_SFX_CUES) {
      const file = resolve("public", monsterSfxPath(cue));
      expect(existsSync(file), cue).toBe(true);
      const bytes = readFileSync(file);
      expect(bytes.subarray(0, 4).toString("ascii"), cue).toBe("OggS");
      const entry = manifest.sounds[cue];
      expect(entry, cue).toBeDefined();
      expect(entry?.gate, cue).toBe("pass");
      expect(entry?.clippedSamples, cue).toBe(0);
      expect(entry?.model, cue).toMatch(/^gemini-4-argon/);
      expect(entry?.patch.voices.length, cue).toBeGreaterThan(0);
      expect(createHash("sha256").update(bytes).digest("hex"), cue).toBe(entry?.sha256);
      const row = CC0_AUDIO_ASSETS.find((asset) => asset.id === monsterSfxResourceId(cue));
      expect(row, cue).toMatchObject({ kind: "sound", license: "CC0-1.0", path: monsterSfxPath(cue) });
      expect(resolveAssetResourceUrl(monsterSfxResourceId(cue), { project: createBlankProject() }), cue).toBe(`/${monsterSfxPath(cue)}`);
    }
  });

  it("applies only to monster-collection projects", () => {
    expect(usesMonsterSfxSet(createBlankProject())).toBe(false);
    expect(monsterSfxRuntimeResourceIds(createBlankProject())).toEqual([]);
    expect(usesMonsterSfxSet(monsterProject())).toBe(true);
    const party = createBlankProject();
    party.system.battleParty = "monsters";
    expect(usesMonsterSfxSet(party)).toBe(true);
    expect(monsterSfxRuntimeResourceIds(monsterProject())).toHaveLength(MONSTER_SFX_CUES.length);
  });

  it("maps battle events to cues and leaves the rest on the existing sounds", () => {
    expect(monsterBattleCue("command-select")).toBe("ui-cursor");
    expect(monsterBattleCue("command-confirm")).toBe("ui-confirm");
    expect(monsterBattleCue("command-cancel")).toBe("ui-cancel");
    expect(monsterBattleCue("hit-damage", "weak")).toBe("hit-weak");
    expect(monsterBattleCue("hit-damage", "normal")).toBe("hit-normal");
    expect(monsterBattleCue("hit-damage")).toBe("hit-normal");
    expect(monsterBattleCue("hit-damage", "super")).toBe("hit-super");
    expect(monsterBattleCue("hit-critical")).toBe("hit-super");
    expect(monsterBattleCue("faint")).toBe("faint");
    for (const untouched of ["hit-miss", "hit-heal", "defend", "attack-swing", "escape", "victory", "defeat"] as const) {
      expect(monsterBattleCue(untouched), untouched).toBeUndefined();
    }
  });

  it("maps timeline entries to status, stat-stage and weather-start cues", () => {
    const states = [
      { id: "st-psn", gen1MajorStatus: "poison" as const },
      { id: "st-tox", gen1MajorStatus: "toxic" as const },
      { id: "st-brn", gen1MajorStatus: "burn" as const },
      { id: "st-par", gen1MajorStatus: "paralysis" as const },
      { id: "st-slp", gen1MajorStatus: "sleep" as const },
      { id: "st-frz", gen1MajorStatus: "freeze" as const },
      { id: "st-cnf", volatileStatus: "confusion" as const },
      { id: "st-none" },
    ];
    const added = (stateId: string) => monsterTimelineCue({ kind: "stateAdded", stateId }, states);
    expect(added("st-psn")).toBe("status-poison");
    expect(added("st-tox")).toBe("status-poison");
    expect(added("st-brn")).toBe("status-burn");
    expect(added("st-par")).toBe("status-paralysis");
    expect(added("st-slp")).toBe("status-sleep");
    expect(added("st-cnf")).toBe("status-confusion");
    expect(added("st-frz")).toBeUndefined();
    expect(added("st-none")).toBeUndefined();
    expect(added("unknown")).toBeUndefined();
    expect(monsterTimelineCue({ kind: "stateRemoved", stateId: "st-psn" }, states)).toBeUndefined();
    const stage = (before: number, after: number) => ({ kind: "special" as const, statStage: { stat: "attack" as const, before, after, requested: after - before } });
    expect(monsterTimelineCue(stage(0, 1), states)).toBe("stat-up");
    expect(monsterTimelineCue(stage(0, -2), states)).toBe("stat-down");
    expect(monsterTimelineCue(stage(6, 6), states)).toBeUndefined();
    for (const kind of ["rain", "sun", "sandstorm", "hail"] as const) {
      const start = { kind: "special" as const, weatherKind: kind, weatherAfter: { kind, turnsLeft: 5 }, message: WEATHER_START_LINES[kind] };
      expect(monsterTimelineCue(start, states), kind).toBe({ rain: "weather-rain", sun: "weather-sun", sandstorm: "weather-sand", hail: "weather-hail" }[kind]);
      expect(monsterTimelineCue({ ...start, message: WEATHER_CONTINUE_LINES[kind] }, states), kind).toBeUndefined();
      expect(monsterTimelineCue({ ...start, weatherAfter: null, message: WEATHER_END_LINES[kind] }, states), kind).toBeUndefined();
    }
  });

  it("dialogue tick only exists for monster projects and only on voiced characters", () => {
    expect(createMonsterDialogueTick(createBlankProject()).speak("가")).toBeUndefined();
    expect(() => createMonsterDialogueTick(monsterProject()).speak("가")).not.toThrow();
  });

  it("menu sounds: monster projects get the set, other genres keep the RTP sounds, authored sounds win", () => {
    class FakeAudio { volume = 1; play = () => Promise.resolve(); }
    Reflect.set(globalThis, "Audio", FakeAudio);
    expect(emitRuntimeJuice({ event: "menu-select", project: monsterProject() }).soundResourceId).toBe("cc0-sound-monster-ui-cursor");
    expect(emitRuntimeJuice({ event: "title-enter", project: monsterProject() }).soundResourceId).toBe("cc0-sound-monster-ui-confirm");
    expect(emitRuntimeJuice({ event: "menu-invalid", project: monsterProject() }).soundResourceId).toBe("cc0-sound-monster-ui-error");
    expect(emitRuntimeJuice({ event: "menu-select", project: createBlankProject() }).soundResourceId).toBe("easyrpg-sound-cursor1");
    expect(emitRuntimeJuice({ event: "title-enter", project: createBlankProject() }).soundResourceId).toBe("easyrpg-sound-decision2");
    expect(emitRuntimeJuice({ event: "menu-select", project: monsterProject(), soundResourceId: "easyrpg-sound-cursor2" }).soundResourceId).toBe("easyrpg-sound-cursor2");
    for (const cue of Object.values(MONSTER_SFX_UI_CUE)) expect(MONSTER_SFX_CUES).toContain(cue);
  });

  it("exports the set only with monster projects", () => {
    const paths = (project: ReturnType<typeof createBlankProject>) => new Set(collectWebExportAssets(project).map((asset) => asset.zipPath));
    const withSet = paths(monsterProject());
    const without = paths(createBlankProject());
    for (const cue of MONSTER_SFX_CUES) {
      expect(withSet.has(monsterSfxPath(cue)), cue).toBe(true);
      expect(without.has(monsterSfxPath(cue)), cue).toBe(false);
    }
  });
});
