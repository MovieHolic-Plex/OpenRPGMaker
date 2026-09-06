import { describe, expect, it } from "vitest";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, ProjectFormatError, serialize } from "@/project/io";
import { validateSystem } from "@/project/io/shapeDatabaseFields";
import { collectUsedUploadedAssetIds, prepareWebExport } from "@/project/webExport";
import { exactWebExportEntries } from "@/project/webExportZip";
import type { CinematicScene, CinematicSequence, GameOverSettings, Project, UploadedAsset } from "@/project/types";

function sequence(): CinematicSequence {
  return {
    enabled: false,
    skippable: false,
    scenes: [
      { id: "text", kind: "text", narration: "  <em>Story</em>\nNext line  ", durationMs: 0, narrationAudioResourceId: "voice" },
      { id: "image", kind: "image", resourceId: "image", narration: "", durationMs: 120000, motion: "pan" },
      { id: "video", kind: "video", resourceId: "video", narration: "Movie caption", durationMs: 0 },
    ],
  };
}

function uploaded(id: string, kind: UploadedAsset["kind"], mime: string): UploadedAsset {
  return { id, name: id, kind, dataUrl: `data:${mime};base64,AQID`, meta: { width: 1, height: 1 } };
}

function authoredProject(): Project {
  const project = createBlankProject();
  project.assets.uploaded = {
    image: uploaded("image", "picture", "image/gif"),
    video: uploaded("video", "movie", "video/mp4"),
    voice: uploaded("voice", "sound", "audio/ogg"),
    background: uploaded("background", "gameOver", "image/webp"),
    unused: uploaded("unused", "picture", "image/png"),
  };
  project.system.opening = sequence();
  project.system.gameOver = {
    sequence: sequence(), title: "Defeat", message: "", retryLabel: "Try again",
    titleLabel: "Main menu", backgroundResourceId: "background",
  };
  return project;
}

const textScene: CinematicScene = { id: "scene", kind: "text", narration: "", durationMs: 0 };
const malformedScenes: ReadonlyArray<readonly [string, unknown]> = [
  ["null", null], ["array", []], ["missing id", { ...textScene, id: undefined }],
  ["blank id", { ...textScene, id: "  " }], ["numeric id", { ...textScene, id: 7 }],
  ["unknown kind", { ...textScene, kind: "audio" }], ["missing kind", { ...textScene, kind: undefined }],
  ["missing narration", { ...textScene, narration: undefined }], ["numeric narration", { ...textScene, narration: 1 }],
  ["missing duration", { ...textScene, durationMs: undefined }], ["negative duration", { ...textScene, durationMs: -1 }],
  ["fractional duration", { ...textScene, durationMs: 0.5 }], ["excess duration", { ...textScene, durationMs: 120001 }],
  ["string duration", { ...textScene, durationMs: "100" }], ["NaN duration", { ...textScene, durationMs: NaN }],
  ["infinite duration", { ...textScene, durationMs: Infinity }],
  ["blank voice", { ...textScene, narrationAudioResourceId: " " }], ["numeric voice", { ...textScene, narrationAudioResourceId: 1 }],
  ["image missing resource", { ...textScene, kind: "image", motion: "none" }],
  ["video missing resource", { ...textScene, kind: "video" }],
  ["blank resource", { ...textScene, kind: "video", resourceId: " " }],
  ["numeric resource", { ...textScene, kind: "video", resourceId: 1 }],
  ["image missing motion", { ...textScene, kind: "image", resourceId: "image" }],
  ["unknown motion", { ...textScene, kind: "image", resourceId: "image", motion: "spin" }],
  ["text with resource", { ...textScene, resourceId: "image" }],
  ["video with motion", { ...textScene, kind: "video", resourceId: "video", motion: "fade" }],
  ["unknown field", { ...textScene, duration: 10 }],
];

describe("cinematic persistence", () => {
  it("leaves legacy absence absent through normalization and repeated roundtrips", () => {
    const project = deserialize(serialize(createBlankProject()));
    const normalized = normalizeSystemRecords(project.system);
    expect(normalized).not.toHaveProperty("opening");
    expect(normalized).not.toHaveProperty("gameOver");
    expect(serialize(deserialize(serialize(project)))).toBe(serialize(project));
  });

  it("retains disabled authored scenes, exact text, labels and media without mutating input", () => {
    const project = authoredProject();
    const before = structuredClone(project);
    const normalized = normalizeSystemRecords(project.system);
    expect(normalized.opening).toEqual(project.system.opening);
    expect(normalized.gameOver).toEqual(project.system.gameOver);
    const restored = deserialize(serialize(project));
    expect(restored.system.opening).toEqual(project.system.opening);
    expect(restored.system.gameOver).toEqual(project.system.gameOver);
    expect(serialize(deserialize(serialize(restored)))).toBe(serialize(restored));
    expect(project).toEqual(before);
  });

  it("cleans IDs deterministically while retaining scene order and authored text", () => {
    const project = authoredProject();
    project.system.opening = { enabled: true, skippable: true, scenes: [
      { ...textScene, id: "  first  ", narration: "  Keep spaces  ", narrationAudioResourceId: " voice " },
      { id: " second ", kind: "image", resourceId: " image ", narration: "", durationMs: 1, motion: "zoom" },
    ] };
    project.system.gameOver = { backgroundResourceId: " background ", title: "  Keep title  " };
    const restored = deserialize(serialize(project));
    expect(restored.system.opening).toEqual({ enabled: true, skippable: true, scenes: [
      { ...textScene, id: "first", narration: "  Keep spaces  ", narrationAudioResourceId: "voice" },
      { id: "second", kind: "image", resourceId: "image", narration: "", durationMs: 1, motion: "zoom" },
    ] });
    expect(restored.system.gameOver).toEqual({ backgroundResourceId: "background", title: "  Keep title  " });
    expect(normalizeSystemRecords(restored.system)).toEqual(restored.system);
  });

  it.each([{}, { title: "" }, { sequence: { enabled: true, skippable: true, scenes: [] } }] satisfies GameOverSettings[])(
    "preserves optional/empty game-over settings %j", (gameOver) => {
      const project = createBlankProject();
      project.system.gameOver = gameOver;
      project.system.opening = { enabled: true, skippable: false, scenes: [] };
      const restored = deserialize(serialize(project));
      expect(restored.system.gameOver).toEqual(gameOver);
      expect(restored.system.opening).toEqual(project.system.opening);
    },
  );
});

describe.each(["opening", "gameOver"] as const)("%s strict wire validation", (target) => {
  function systemWithSequence(value: unknown) {
    return { startActorIds: [], [target]: target === "opening" ? value : { sequence: value } };
  }

  it.each(malformedScenes)("rejects malformed scene: %s before normalization", (_label, scene) => {
    const system = systemWithSequence({ enabled: false, skippable: true, scenes: [scene] });
    expect(() => validateSystem(system)).toThrow(ProjectFormatError);
    expect(() => deserialize(JSON.stringify({ ...createBlankProject(), system }))).toThrow(ProjectFormatError);
  });

  it.each([
    null, [], {}, { enabled: "false", skippable: true, scenes: [] },
    { enabled: true, scenes: [] }, { enabled: true, skippable: 1, scenes: [] },
    { enabled: true, skippable: true, scenes: {} }, { enabled: true, skippable: true, scenes: [], extra: 1 },
  ])("rejects malformed sequence %j", (value) => {
    expect(() => validateSystem(systemWithSequence(value))).toThrow(ProjectFormatError);
  });

  it("rejects duplicate IDs including trim collisions", () => {
    for (const id of ["scene", " scene "]) {
      const system = systemWithSequence({ enabled: false, skippable: false, scenes: [textScene, { ...textScene, id }] });
      expect(() => deserialize(JSON.stringify({ ...createBlankProject(), system }))).toThrow(/\.id/);
    }
  });

  it("accepts 100 scenes and rejects 101 without silently truncating", () => {
    const scenes = Array.from({ length: 100 }, (_, i) => ({ ...textScene, id: `scene-${i}` }));
    const system = systemWithSequence({ enabled: true, skippable: false, scenes });
    expect(() => validateSystem(system)).not.toThrow();
    scenes.push({ ...textScene, id: "overflow" });
    expect(() => validateSystem(system)).toThrow(ProjectFormatError);
  });

  it.each(["none", "fade", "pan", "zoom"] as const)("accepts image motion %s", (motion) => {
    const system = systemWithSequence({ enabled: true, skippable: true, scenes: [
      { ...textScene, kind: "image", resourceId: "image", motion },
    ] });
    expect(() => validateSystem(system)).not.toThrow();
  });

  it.each(["image", "video", "voice"])("rejects missing %s references even in disabled content", (id) => {
    const project = authoredProject();
    delete project.system[target === "opening" ? "gameOver" : "opening"];
    delete project.assets.uploaded[id];
    expect(() => deserialize(serialize(project))).toThrow(new RegExp(`system\\.${target}`));
  });
});

describe("game-over wire fields", () => {
  it.each([null, [], { title: 1 }, { message: null }, { retryLabel: false }, { titleLabel: [] },
    { backgroundResourceId: " " }, { backgroundResourceId: 1 }, { unknown: true }])("rejects %j", (gameOver) => {
    expect(() => validateSystem({ startActorIds: [], gameOver })).toThrow(ProjectFormatError);
  });

  it("rejects a missing game-over background", () => {
    const project = authoredProject();
    delete project.assets.uploaded.background;
    expect(() => deserialize(serialize(project))).toThrow(/system\.gameOver\.backgroundResourceId/);
  });
});

describe("cinematic web export", () => {
  it.each(["opening", "gameOver"] as const)("collects media referenced only by disabled %s scenes", (target) => {
    const project = authoredProject();
    delete project.system[target === "opening" ? "gameOver" : "opening"];
    expect([...collectUsedUploadedAssetIds(project)].sort()).toEqual(
      (target === "opening" ? ["image", "video", "voice"] : ["background", "image", "video", "voice"]).sort(),
    );
    const prepared = prepareWebExport(project);
    expect(deserialize(prepared.projectJson).system[target]).toEqual(project.system[target]);
  });

  it.each([["video/mp4", "mp4"], ["video/webm", "webm"], ["video/ogg", "ogv"]])(
    "exports %s, animated image, voice and background bytes with correct filenames", async (mime, extension) => {
      const project = authoredProject();
      project.assets.uploaded.video = uploaded("video", "movie", mime);
      const prepared = prepareWebExport(project);
      const paths = ["image.gif", `video.${extension}`, "voice.ogg", "background.webp"].map((name) => `assets/uploaded/${name}`);
      expect(prepared.assets.filter((asset) => asset.kind === "uploaded").map((asset) => asset.zipPath).sort()).toEqual(paths.sort());
      const entries = await exactWebExportEntries(prepared, { bundleFiles: [], runtimeAssets: [] }, async (path) => new TextEncoder().encode(path));
      for (const path of paths) expect(entries.find((entry) => entry.name === path)?.bytes).toEqual(new Uint8Array([1, 2, 3]));
      const json = entries.find((entry) => entry.name === "project.json");
      expect(json).toBeDefined();
      const restored = deserialize(new TextDecoder().decode(json?.bytes));
      expect(restored.system.opening).toEqual(project.system.opening);
      expect(restored.system.gameOver).toEqual(project.system.gameOver);
      expect(Object.keys(restored.assets.uploaded).sort()).toEqual(["background", "image", "video", "voice"]);
    },
  );
});
